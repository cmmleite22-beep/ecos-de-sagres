// Risca e Arrisca — teste ponta-a-ponta do anfitrião (salas grátis e compra única), sem Google nem Firebase:
// a função na nuvem é simulada com as mesmas regras (functions/logica.js) e a Google Play com um falso Digital Goods API.
// Uso: npm start  &&  node tests/risca-anfitriao-e2e.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { tratar, dbMemoria, SALAS_GRATIS } from '../functions/logica.js';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8080';
const OUT = process.env.OUT || 'shots/risca-anfitriao';
const API = 'https://europe-west1-risca-e-arrisca.cloudfunctions.net/anfitriao';
fs.mkdirSync(OUT, { recursive: true });
const ok = (cond, msg) => { console.log((cond ? 'OK      ' : 'FALHOU  ') + msg); if (!cond) process.exitCode = 1; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const db = dbMemoria();
const play = { async verificar(t) { return t === 'BOM_TOKEN_123' ? { estado: 'pago', orderId: 'GPA.1', reconhecida: false } : { estado: 'invalido' }; }, async reconhecer() {} };
let servidorLigado = true;
async function rota(route) {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST' };
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  if (!servidorLigado) return route.abort();
  const body = JSON.parse(route.request().postData() || '{}');
  route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(await tratar(body, { db, play })) });
}
// telemóvel com a app Android (Digital Goods API + Payment Request da Google Play, simulados)
const APP = `
  window.getDigitalGoodsService = async () => ({
    getDetails: async () => [{ itemId: 'anfitriao', price: { currency: 'EUR', value: '2.99' } }],
    listPurchases: async () => JSON.parse(localStorage.getItem('falso.compras') || '[]'),
  });
  window.PaymentRequest = class { async show() {
    localStorage.setItem('falso.compras', JSON.stringify([{ itemId: 'anfitriao', purchaseToken: 'BOM_TOKEN_123' }]));
    return { details: { purchaseToken: 'BOM_TOKEN_123' }, complete: async () => {} };
  } };`;

const b = await chromium.launch();
const errs = [];
const tvCtx = await b.newContext({ viewport: { width: 1280, height: 720 }, locale: 'pt-PT' });
await tvCtx.route(API, rota);
async function novaTV() {
  const tv = await tvCtx.newPage();
  tv.on('pageerror', (e) => errs.push('TV ' + e.message));
  await tv.goto(`${BASE}/risca/tv/?anfitriao`);
  await tv.waitForFunction(() => /^[A-Z]{4}$/.test(document.getElementById('room-code').textContent), null, { timeout: 30000 });
  return { tv, code: await tv.$eval('#room-code', (e) => e.textContent) };
}
const ctxs = {};
async function telemovel(nome, code, { app = false } = {}) {
  let ctx = ctxs[nome];
  if (!ctx) {
    ctx = ctxs[nome] = await b.newContext({ ...devices['Pixel 7'], locale: 'pt-PT' });
    await ctx.route(API, rota);
    if (app) await ctx.addInitScript(APP);
  }
  const ph = await ctx.newPage();
  ph.on('pageerror', (e) => errs.push(nome + ' ' + e.message));
  await ph.goto(`${BASE}/risca/comando/?room=${code}&anfitriao`);
  await ph.fill('#name', nome);
  await ph.click('#btn-join');
  await ph.waitForSelector('#s-lobby:not(.hidden)', { timeout: 10000 });
  return ph;
}
const fase = (tv) => tv.evaluate(() => __risca.phase);

// 1) salas grátis: o chefe (Ana, com a app) tem SALAS_GRATIS; a convidada (Rita, no Chrome) nunca paga
for (let i = 1; i <= SALAS_GRATIS; i++) {
  const { tv, code } = await novaTV();
  const ana = await telemovel('Ana', code, { app: true });
  const rita = await telemovel('Rita', code);
  await wait(400);
  if (i === 1) {
    ok(/restam 3 de 3/.test(await ana.$eval('#anf-line', (e) => e.textContent)), 'o chefe vê as salas grátis que lhe restam');
    ok(await rita.$eval('#anf', (e) => e.classList.contains('hidden')), 'a convidada não vê nada sobre pagamentos');
    await ana.screenshot({ path: `${OUT}/telemovel-chefe-salas-gratis.png` });
  }
  await ana.click('#btn-start');
  await tv.waitForFunction(() => __risca.phase !== 'lobby', null, { timeout: 8000 }).catch(() => {});
  ok(await fase(tv) !== 'lobby', `sala grátis ${i} de ${SALAS_GRATIS} começa`);
  if (i === 1) {
    await ana.waitForSelector('#toast-c:not(.hidden)', { timeout: 3000 }).catch(() => {});
    ok(/Restam 2 de 3/.test(await ana.$eval('#toast-c', (e) => e.textContent)), 'o chefe é avisado de quantas salas grátis restam');
  }
  // «Jogar de novo» na mesma sala não gasta outra sala grátis
  if (i === 1) {
    const antes = db.exp.size && [...db.exp.values()][0].usadas;
    await tv.evaluate(() => { __risca.toLobby(); __risca.pedirInicio(); });
    await wait(300);
    ok([...db.exp.values()][0].usadas === antes, 'jogar de novo na mesma sala não gasta outra sala grátis');
  }
  await tv.close(); await ana.close(); await rita.close();
}

// 2) salas grátis acabaram: a TV não começa e o chefe vê o pedido de compra; a convidada vê porquê
let { tv, code } = await novaTV();
let ana = await telemovel('Ana', code, { app: true });
let rita = await telemovel('Rita', code);
await wait(400);
ok(/acabaram/.test(await ana.$eval('#anf-line', (e) => e.textContent)) && await ana.$eval('#anf-unlock', (e) => !e.classList.contains('hidden')), 'sem salas grátis, o chefe vê o botão para desbloquear');
await rita.click('#btn-start'); // até um convidado pode carregar em COMEÇAR: o pedido vai para o chefe
await ana.waitForSelector('#pay:not(.hidden)', { timeout: 8000 }).catch(() => {});
ok(await fase(tv) === 'lobby', 'sem anfitrião desbloqueado a sala não começa');
ok(await ana.$eval('#pay', (e) => !e.classList.contains('hidden')), 'o chefe vê o pedido de compra');
await wait(400);
ok(/2,99/.test(await ana.$eval('#pay-buy', (e) => e.textContent)), `o botão mostra o preço da Google Play («${await ana.$eval('#pay-buy', (e) => e.textContent)}»)`);
ok(await rita.$eval('#pay', (e) => e.classList.contains('hidden')), 'à convidada não se pede nada');
ok(/chefe da sala/.test(await rita.$eval('#anf-line', (e) => e.textContent)), 'a convidada sabe porque não começa');
await ana.screenshot({ path: `${OUT}/telemovel-comprar.png` });
await tv.screenshot({ path: `${OUT}/tv-sala-bloqueada.png` });

// 3) compra: o chefe paga, a função confirma, a sala começa sozinha
await ana.click('#pay-buy');
await tv.waitForFunction(() => __risca.phase !== 'lobby', null, { timeout: 8000 }).catch(() => {});
ok(await ana.evaluate(() => /^[0-9a-f]{64}$/.test(localStorage.getItem('risca.passe') || '')), 'depois de comprar, o telemóvel guarda o passe de anfitrião');
ok(await fase(tv) !== 'lobby', 'depois de comprar, a sala começa');
await ana.screenshot({ path: `${OUT}/telemovel-desbloqueado.png` });
await tv.close(); await ana.close(); await rita.close();

// 4) anfitrião pago: salas sem fim
({ tv, code } = await novaTV());
ana = await telemovel('Ana', code, { app: true });
rita = await telemovel('Rita', code);
await wait(500);
ok(/desbloqueado/.test(await ana.$eval('#anf-line', (e) => e.textContent)), 'o chefe vê «Anfitrião desbloqueado»');
await ana.click('#btn-start');
await tv.waitForFunction(() => __risca.phase !== 'lobby', null, { timeout: 8000 }).catch(() => {});
ok(await fase(tv) !== 'lobby', 'anfitrião pago abre outra sala');
await tv.close(); await ana.close(); await rita.close();

// 5) a convidada (sem salas grátis) chega primeiro e fica chefe, mas a Ana (paga) está na sala: começa na mesma
({ tv, code } = await novaTV());
rita = await telemovel('Rita', code);
ana = await telemovel('Ana', code, { app: true });
const ritaKey = await rita.evaluate(() => localStorage.getItem('risca.key'));
db.exp.set(ritaKey, { usadas: 99 });
await wait(400);
await rita.click('#btn-start');
await tv.waitForFunction(() => __risca.phase !== 'lobby', null, { timeout: 8000 }).catch(() => {});
ok(await fase(tv) !== 'lobby', 'um anfitrião pago na sala chega, mesmo que não seja o chefe');
await tv.close(); await ana.close(); await rita.close();

// 6) restaurar num telemóvel novo (mesma conta Google): o passe volta sozinho ao abrir a app
const ctxNovo = ctxs['Ana2'] = await b.newContext({ ...devices['Pixel 7'], locale: 'pt-PT' });
await ctxNovo.route(API, rota);
await ctxNovo.addInitScript(APP + `localStorage.setItem('falso.compras', JSON.stringify([{ itemId: 'anfitriao', purchaseToken: 'BOM_TOKEN_123' }]));`);
({ tv, code } = await novaTV());
const ana2 = await telemovel('Ana2', code);
await ana2.waitForFunction(() => !!localStorage.getItem('risca.passe'), null, { timeout: 5000 }).catch(() => {});
ok(await ana2.evaluate(() => !!localStorage.getItem('risca.passe')), 'num telemóvel novo a compra é restaurada sozinha');
await tv.close(); await ana2.close();

// 7) no Chrome (sem a app) o pedido manda para a Google Play
({ tv, code } = await novaTV());
rita = await telemovel('Rita', code);
const bea = await telemovel('Bea', code);
await rita.click('#btn-start');
await rita.waitForSelector('#pay:not(.hidden)', { timeout: 8000 }).catch(() => {});
ok(await rita.$eval('#pay-store', (e) => !e.classList.contains('hidden') && /play\.google\.com/.test(e.href)) && await rita.$eval('#pay-buy', (e) => e.classList.contains('hidden')),
  'no Chrome, o pedido de compra leva à app na Google Play');
await rita.screenshot({ path: `${OUT}/chrome-pedido-app.png` });
await tv.close(); await rita.close(); await bea.close();

// 8) servidor em baixo: joga-se na mesma
servidorLigado = false;
({ tv, code } = await novaTV());
rita = await telemovel('Rita', code);
const bea2 = await telemovel('Bea', code);
await rita.click('#btn-start');
await tv.waitForFunction(() => __risca.phase !== 'lobby', null, { timeout: 10000 }).catch(() => {});
ok(await fase(tv) !== 'lobby', 'sem resposta do servidor, o jogo começa na mesma');

ok(!errs.length, 'sem erros de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
await b.close();
