// Testa as regras de quem pode abrir salas (functions/logica.js), sem Google nem Firestore.
// node tests/risca-anfitriao-logica.mjs
import assert from 'node:assert/strict';
import { tratar, dbMemoria, passeDe, SALAS_GRATIS } from '../functions/logica.js';

const db = dbMemoria();
const tokens = { BOM_TOKEN_123: { estado: 'pago', orderId: 'GPA.1', reconhecida: false }, PENDENTE_TOKEN_1: { estado: 'pendente' } };
const reconhecidos = [];
const play = {
  async verificar(t) { return tokens[t] || { estado: 'invalido' }; },
  async reconhecer(t) { reconhecidos.push(t); },
};
const r = (p) => tratar(p, { db, play });
const KEY = 'abc123def456', KEY2 = 'zzz999yyy888';

// estado inicial
assert.deepEqual(await r({ acao: 'estado', key: KEY }), { pago: false, salasGratis: SALAS_GRATIS, usadas: 0, restantes: SALAS_GRATIS });
assert.equal((await r({ acao: 'estado', key: '../x' })).erro, 'chave');

// salas grátis: SALAS_GRATIS e depois recusa
for (let i = 1; i <= SALAS_GRATIS; i++) {
  const s = await r({ acao: 'sala', key: KEY, passes: [] });
  assert.equal(s.ok, true); assert.equal(s.tipo, 'experiencia'); assert.equal(s.restantes, SALAS_GRATIS - i);
}
assert.equal((await r({ acao: 'sala', key: KEY, passes: [] })).ok, false);
assert.equal((await r({ acao: 'estado', key: KEY })).restantes, 0);
// outro telemóvel tem as suas
assert.equal((await r({ acao: 'sala', key: KEY2 })).ok, true);

// compra falsa é recusada e não desbloqueia
assert.equal((await r({ acao: 'comprar', key: KEY, purchaseToken: 'TOKEN_INVENTADO' })).ok, false);
assert.equal((await r({ acao: 'sala', key: KEY, passes: [passeDe('TOKEN_INVENTADO')] })).ok, false);
// pendente também não
assert.equal((await r({ acao: 'comprar', key: KEY, purchaseToken: 'PENDENTE_TOKEN_1' })).estado, 'pendente');

// compra verdadeira: passe, reconhecimento, e salas sem fim
const c = await r({ acao: 'comprar', key: KEY, purchaseToken: 'BOM_TOKEN_123' });
assert.equal(c.ok, true); assert.equal(c.passe, passeDe('BOM_TOKEN_123'));
assert.deepEqual(reconhecidos, ['BOM_TOKEN_123']);
for (let i = 0; i < 5; i++) assert.deepEqual(await r({ acao: 'sala', key: KEY, passes: [c.passe] }), { ok: true, tipo: 'pago' });
assert.equal((await r({ acao: 'estado', key: KEY, passe: c.passe })).pago, true);
// o passe de um convidado na sala também serve (o chefe da sala pode ser outro)
assert.equal((await r({ acao: 'sala', key: 'semexperiencia0', passes: ['x', c.passe] })).tipo, 'pago');
// restaurar (mesmo token noutro telemóvel) devolve o mesmo passe sem voltar a reconhecer
assert.equal((await r({ acao: 'comprar', key: KEY2, purchaseToken: 'BOM_TOKEN_123' })).passe, c.passe);
assert.equal(reconhecidos.length, 1);

assert.equal((await r({ acao: 'xpto' })).erro, 'acao');
console.log('regras do anfitrião: tudo certo');
