// Risca e Arrisca — regras de quem pode abrir salas (sem dependências da Google, para se poder testar).
//
// • Quem compra o produto «anfitriao» na app (compra única) recebe um «passe de anfitrião» e abre todas as salas que quiser.
// • Sem passe, cada telemóvel tem SALAS_GRATIS salas grátis para experimentar.
// • Os convidados nunca pagam: a TV só pede isto ao chefe da sala quando ele carrega em COMEÇAR.
//
// O passe é o resumo SHA-256 do token de compra da Google Play: não revela o token e é sempre o mesmo para a mesma compra.
import { createHash } from 'node:crypto';

export const SALAS_GRATIS = 3;          // salas grátis por telemóvel (mude aqui e volte a publicar)
export const PACOTE = 'pt.riscaearrisca.app';
export const PRODUTO = 'anfitriao';     // ID do produto na Play Console (compra única, «não consumível»)

export const passeDe = (token) => createHash('sha256').update(String(token)).digest('hex');
const chaveValida = (k) => typeof k === 'string' && /^[a-z0-9]{8,40}$/i.test(k);
const passeValido = (p) => typeof p === 'string' && /^[0-9a-f]{64}$/.test(p);
const tokenValido = (t) => typeof t === 'string' && t.length > 10 && t.length < 4096 && /^[\w.\-:]+$/.test(t);

// db: { getExperiencia(key) → {usadas}|null, usarExperiencia(key, max) → {ok, usadas}, getCompra(passe) → {...}|null, setCompra(passe, dados) }
// play: { verificar(token) → { estado:'pago'|'pendente'|'cancelado', orderId, reconhecida }, reconhecer(token) }
export async function tratar(pedido, { db, play }) {
  const { acao } = pedido || {};
  const key = pedido?.key;

  if (acao === 'estado') {
    // o telemóvel pergunta se já é anfitrião e quantas salas grátis lhe restam
    if (!chaveValida(key)) return { erro: 'chave' };
    if (passeValido(pedido.passe) && (await db.getCompra(pedido.passe))?.estado === 'pago') return { pago: true, salasGratis: SALAS_GRATIS, restantes: SALAS_GRATIS };
    const e = await db.getExperiencia(key);
    const usadas = e?.usadas || 0;
    return { pago: false, salasGratis: SALAS_GRATIS, usadas, restantes: Math.max(0, SALAS_GRATIS - usadas) };
  }

  if (acao === 'comprar') {
    // o telemóvel acabou de comprar (ou está a restaurar uma compra antiga): confirmar com a Google Play
    if (!tokenValido(pedido.purchaseToken)) return { erro: 'token' };
    const passe = passeDe(pedido.purchaseToken);
    const antiga = await db.getCompra(passe);
    if (antiga?.estado === 'pago') return { ok: true, passe };
    const v = await play.verificar(pedido.purchaseToken);
    if (v.estado !== 'pago') {
      await db.setCompra(passe, { estado: v.estado, orderId: v.orderId || '', key: chaveValida(key) ? key : '' });
      return { ok: false, estado: v.estado };
    }
    // a Google devolve o dinheiro se a compra não for «reconhecida» em 3 dias
    if (!v.reconhecida) { try { await play.reconhecer(pedido.purchaseToken); } catch {} }
    await db.setCompra(passe, { estado: 'pago', orderId: v.orderId || '', key: chaveValida(key) ? key : '' });
    return { ok: true, passe };
  }

  if (acao === 'sala') {
    // a TV pergunta, quando o chefe carrega em COMEÇAR, se esta sala pode abrir
    const passes = (Array.isArray(pedido.passes) ? pedido.passes : []).filter(passeValido).slice(0, 8);
    for (const p of passes) if ((await db.getCompra(p))?.estado === 'pago') return { ok: true, tipo: 'pago' };
    if (!chaveValida(key)) return { ok: false, restantes: 0, salasGratis: SALAS_GRATIS };
    const r = await db.usarExperiencia(key, SALAS_GRATIS);
    if (r.ok) return { ok: true, tipo: 'experiencia', usadas: r.usadas, restantes: Math.max(0, SALAS_GRATIS - r.usadas), salasGratis: SALAS_GRATIS };
    return { ok: false, restantes: 0, salasGratis: SALAS_GRATIS };
  }

  return { erro: 'acao' };
}

// Memória simples para os testes (e para o servidor local npm start, se quiser).
export function dbMemoria() {
  const exp = new Map(), compras = new Map();
  return {
    exp, compras,
    async getExperiencia(k) { return exp.get(k) || null; },
    async usarExperiencia(k, max) {
      const u = exp.get(k)?.usadas || 0;
      if (u >= max) return { ok: false, usadas: u };
      exp.set(k, { usadas: u + 1 });
      return { ok: true, usadas: u + 1 };
    },
    async getCompra(p) { return compras.get(p) || null; },
    async setCompra(p, d) { compras.set(p, { ...(compras.get(p) || {}), ...d }); },
  };
}
