// Risca e Arrisca — testes das novidades: voltar a entrar, equipas, modo pequenos, listas guardadas,
// Lápis de Ouro, guardar desenhos e Passa o Risco. TV + telemóveis simulados (Playwright).
// Uso: npm start  &&  node tests/risca-novidades.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8080';
const OUT = process.env.OUT || 'shots/risca';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const errs = [];
const ok = (cond, msg) => { console.log((cond ? 'OK      ' : 'FALHOU  ') + msg); if (!cond) process.exitCode = 1; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function newTV() {
  const tv = await b.newPage({ viewport: { width: 1280, height: 720 } });
  tv.on('pageerror', (e) => errs.push('TV ' + e.message));
  await tv.goto(`${BASE}/risca/tv/`);
  await tv.waitForFunction(() => /^[A-Z]{4}$/.test(document.getElementById('room-code').textContent), null, { timeout: 30000 });
  return { tv, code: await tv.$eval('#room-code', (e) => e.textContent) };
}
async function newPhone(code, name) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], acceptDownloads: true });
  const ph = await ctx.newPage();
  ph.on('pageerror', (e) => errs.push('PH ' + e.message));
  await ph.goto(`${BASE}/risca/comando/?room=${code}`);
  await ph.fill('#name', name);
  await ph.click('#btn-join');
  await ph.waitForSelector('#s-lobby:not(.hidden)', { timeout: 10000 });
  return ph;
}
const T = (tv, fn, arg) => tv.evaluate(fn, arg);
const skip = (tv) => T(tv, () => { __risca.phaseEnd = performance.now(); });

async function drawSomething(ph, k = 0) {
  const box = await (await ph.$('#pad')).boundingBox();
  await ph.mouse.move(box.x + box.width * (0.2 + k * 0.1), box.y + box.height * 0.3);
  await ph.mouse.down();
  await ph.mouse.move(box.x + box.width * 0.7, box.y + box.height * (0.5 + k * 0.05), { steps: 8 });
  await ph.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.8, { steps: 8 });
  await ph.mouse.up();
  await wait(150);
}

// ============ 1. voltar a entrar, equipas, listas, modo pequenos, Lápis de Ouro ============
{
  const { tv, code } = await newTV();
  const A = await newPhone(code, 'Ana'), B = await newPhone(code, 'Bruno'), C = await newPhone(code, 'Carla');
  const phones = [A, B, C];

  // listas guardadas no telemóvel do chefe
  await A.fill('#o-custom', 'célula, planta, raiz, folha, flor');
  await A.fill('#o-listname', 'Ciências');
  await A.click('#list-save');
  await A.reload();
  ok(await A.$eval('#s-lobby', (e) => !e.classList.contains('hidden')), 'recarregar a página a meio volta a entrar sozinho');
  ok(await T(tv, () => __risca.players.size === 3 && __risca.list[0].name === 'Ana'), 'quem recarrega fica com o mesmo lugar (sem duplicar)');
  await A.waitForSelector('#o-lists option:nth-child(2)', { state: 'attached' });
  ok((await A.$$eval('#o-lists option', (o) => o.map((x) => x.textContent))).some((t) => t.startsWith('Ciências (5)')), 'a lista guardada continua no telemóvel depois de recarregar');
  await A.selectOption('#o-lists', '0');
  await wait(300);
  ok(await T(tv, () => __risca.settings.theme === 'nossas' && __risca.settings.custom.length === 5), 'escolher uma lista guardada usa essas palavras');

  // equipas + modo pequenos
  await A.selectOption('#o-mode', 'equipas');
  await wait(200);
  await A.check('#o-kids');
  await A.selectOption('#o-rounds', '1');
  await wait(300);
  await C.waitForSelector('#team-pick:not(.hidden)');
  await C.click('#team-btns button >> nth=0');
  await wait(300);
  const teams = await T(tv, () => __risca.list.map((p) => p.team));
  ok(__dummy(teams), `equipas formadas e o jogador pode trocar de equipa (${teams})`);
  function __dummy(t) { return t.length === 3 && t[2] === 0; }
  await tv.screenshot({ path: `${OUT}/tv-lobby-equipas.png` });
  await A.screenshot({ path: `${OUT}/telemovel-sala-equipas.png` });
  await B.click('#btn-start');
  await wait(400);
  const order = await T(tv, () => [__risca.turn.drawer, ...__risca.queue].map((id) => __risca.players.get(id).team));
  ok(order[0] !== order[1], `as equipas desenham à vez (${order})`);

  // primeira vez: escolher palavra, desenhar
  let dIdx = await T(tv, () => __risca.order.indexOf(__risca.turn.drawer));
  let D = phones[dIdx];
  await D.waitForSelector('#s-choose:not(.hidden)');
  await D.click('#choices button >> nth=0');
  await D.waitForSelector('#s-draw:not(.hidden)');
  await drawSomething(D);
  // quem desenha perde a ligação (WebSocket cai) e volta: o desenho regressa ao telemóvel
  const opsBefore = await T(tv, () => __risca.quadro.ops.length);
  await D.evaluate(() => window.__ctrl.transport.ws.close());
  await wait(2500);
  const back = await D.evaluate(() => window.__ctrl.quadro.ops.length);
  ok(await T(tv, () => __risca.phase === 'draw' && __risca.online.length === 3), 'quem desenha perde a ligação por instantes e o jogo continua');
  ok(back === opsBefore && opsBefore > 0, `o desenho volta ao telemóvel depois de religar (${back}/${opsBefore} traços)`);

  // modo pequenos: opções em vez de teclado
  const word = await T(tv, () => __risca.turn.word);
  const G = phones.filter((_, i) => i !== dIdx);
  await G[0].waitForSelector('#g-options:not(.hidden)');
  ok(await G[0].$eval('#g-form', (e) => e.classList.contains('hidden')), 'modo pequenos: sem teclado, só 4 botões');
  const opts = await G[0].$$eval('#g-options button', (bs) => bs.map((x) => x.textContent));
  ok(opts.length === 4 && opts.includes(word), `as 4 opções incluem a palavra certa (${opts})`);
  const wrong = opts.find((o) => o !== word);
  await G[0].click(`#g-options button:text-is("${wrong}")`);
  await wait(300);
  ok(await G[0].$eval(`#g-options button:text-is("${wrong}")`, (e) => e.disabled), 'opção errada fica riscada');
  await tv.screenshot({ path: `${OUT}/tv-pequenos.png` });
  await G[0].screenshot({ path: `${OUT}/telemovel-pequenos.png` });
  await wait(3100);
  await G[0].click(`#g-options button:text-is("${word}")`);
  await G[1].click(`#g-options button:text-is("${word}")`);
  await wait(1800);
  ok(await T(tv, () => __risca.phase === 'reveal'), 'acertam pelos botões e a vez acaba');
  ok(await D.$eval('#msg-save', (e) => !e.classList.contains('hidden')), 'quem desenhou pode guardar o seu desenho');
  const [dl1] = await Promise.all([D.waitForEvent('download'), D.click('#msg-save')]);
  ok(/\.png$/.test(dl1.suggestedFilename()), `guardar o desenho descarrega uma imagem (${dl1.suggestedFilename()})`);

  // segunda vez: desenhar também (para haver 2 desenhos na votação)
  await skip(tv); await wait(400);
  dIdx = await T(tv, () => __risca.order.indexOf(__risca.turn.drawer));
  D = phones[dIdx];
  await D.waitForSelector('#s-choose:not(.hidden)');
  await D.click('#choices button >> nth=1');
  await D.waitForSelector('#s-draw:not(.hidden)');
  await drawSomething(D, 2);
  await skip(tv); await wait(400); // fim do tempo → revelar
  await skip(tv); await wait(400); // terceira vez
  await skip(tv); await wait(400); // escolha automática
  await skip(tv); await wait(400); // fim do tempo
  await skip(tv); await wait(600); // → votação
  ok(await T(tv, () => __risca.phase === 'vote'), 'depois das voltas vem a votação do Lápis de Ouro');
  await A.waitForSelector('#s-vote:not(.hidden)');
  const gal = await T(tv, () => __risca.gallery.map((g) => g.p.name));
  for (const ph of phones) {
    const btns = await ph.$$('#v-list button:not([disabled])');
    if (btns.length) await btns[0].click();
  }
  await tv.screenshot({ path: `${OUT}/tv-lapis-de-ouro.png` });
  await A.screenshot({ path: `${OUT}/telemovel-votar.png` });
  await wait(1500);
  ok(await T(tv, () => __risca.phase === 'final' && __risca.golden.length >= 1), `quando todos votam, aparece o vencedor do Lápis de Ouro (galeria: ${gal})`);
  ok(await T(tv, () => !!document.querySelector('#gallery figure.gold')), 'o desenho vencedor fica destacado na galeria');
  ok(/Equipa/.test(await tv.$eval('#podium', (e) => e.textContent)), 'no modo equipas o pódio é das equipas');
  await tv.screenshot({ path: `${OUT}/tv-podio-equipas.png` });
  await A.waitForSelector('#s-final:not(.hidden)');
  const [dl2] = await Promise.all([A.waitForEvent('download'), A.click('#f-gal button >> nth=0')]);
  ok(/\.jpg$/.test(dl2.suggestedFilename()), `no fim, qualquer um guarda desenhos da galeria (${dl2.suggestedFilename()})`);
  await A.screenshot({ path: `${OUT}/telemovel-fim-guardar.png` });
  await A.click('#btn-again');
  await wait(300);

  // ============ 2. Passa o Risco ============
  await A.selectOption('#o-mode', 'passa');
  await A.selectOption('#o-theme', 'ingles');
  await wait(300);
  ok(await T(tv, () => __risca.settings.mode === 'passa' && __risca.settings.theme === 'ingles'), 'escolher Passa o Risco e o tema em inglês');
  await tv.screenshot({ path: `${OUT}/tv-lobby-passa.png` });
  await C.click('#btn-start');
  await wait(500);
  ok(await T(tv, () => __risca.phase === 'pdraw' && __risca.passa.n === 3), 'Passa o Risco: todos começam a desenhar ao mesmo tempo');
  const prompts = await Promise.all(phones.map((p) => p.$eval('#d-word', (e) => e.textContent)));
  const words = await T(tv, () => __risca.passa.chains.map((c) => c.items[0].text));
  ok(prompts.join() === words.join(), `cada um desenha a sua palavra (${prompts})`);
  for (let k = 0; k < 3; k++) await drawSomething(phones[k], k);
  await wait(300);
  await tv.screenshot({ path: `${OUT}/tv-passa-desenhar.png` });
  await phones[1].screenshot({ path: `${OUT}/telemovel-passa-desenhar.png` });
  for (const p of phones) await p.click('#t-done');
  await wait(1500);
  ok(await T(tv, () => __risca.phase === 'pguess'), 'quando todos carregam em Pronto, passa a adivinhar');
  await B.waitForSelector('#s-pguess:not(.hidden)');
  await B.waitForFunction(() => document.querySelector('#pg-img').src.startsWith('data:image'));
  ok(true, 'cada um recebe no telemóvel o desenho do anterior');
  await B.screenshot({ path: `${OUT}/telemovel-passa-adivinhar.png` });
  for (const [k, p] of phones.entries()) { await p.fill('#pg-input', ['house', 'a cat', 'rocket'][k]); await p.press('#pg-input', 'Enter'); }
  await wait(1500);
  ok(await T(tv, () => __risca.phase === 'pdraw' && __risca.passa.step === 3), 'o palpite passa ao seguinte, que o desenha');
  const p3 = await A.$eval('#d-word', (e) => e.textContent);
  const expect = await T(tv, () => { const P = __risca.passa; const c = P.assign.get(__risca.order[0]); return P.chains[c].items[2].text; });
  ok(p3 === expect, `o terceiro passo pede para desenhar o palpite recebido («${p3}»)`);
  await drawSomething(A);
  await skip(tv); await wait(600);
  ok(await T(tv, () => __risca.phase === 'pshow'), 'no fim, a TV mostra as cadeias');
  for (let k = 0; k < 3; k++) await T(tv, () => __risca.passaShowNext());
  await wait(300);
  await tv.screenshot({ path: `${OUT}/tv-passa-cadeia.png` });
  ok(await T(tv, () => document.querySelectorAll('#pshow .card').length === 4), 'a cadeia aparece peça a peça (palavra, desenho, palpite, desenho)');
  await A.click('#msg-next');
  await wait(300);
  ok(await T(tv, () => __risca.passa.show.c === 1), 'o chefe da sala pode passar à cadeia seguinte');
  for (let k = 0; k < 10 && (await T(tv, () => __risca.phase)) === 'pshow'; k++) await T(tv, () => __risca.passaShowNext());
  ok(await T(tv, () => __risca.phase === 'final'), 'depois de todas as cadeias, aparece a galeria final');
  await tv.screenshot({ path: `${OUT}/tv-passa-fim.png` });
  await tv.close();
}

ok(!errs.length, 'sem erros de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
await b.close();
