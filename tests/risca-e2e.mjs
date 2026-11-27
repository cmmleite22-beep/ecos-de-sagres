// Risca e Arrisca — teste ponta-a-ponta: TV + 3 telemóveis (Playwright).
// Uso: npm start  &&  node tests/risca-e2e.mjs      (BASE=http://localhost:8080 por omissão)
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

// cria uma categoria com um conjunto de palavras no telemóvel do chefe
async function makeCat(ph, name, list) {
  if (await ph.$eval('#cats', (e) => e.classList.contains('hidden'))) await ph.click('#cat-open');
  await ph.fill('#cat-name', name);
  await ph.click('#cat-add');
  await ph.fill('#set-words', list);
  await ph.click('#set-save');
  await new Promise((r) => setTimeout(r, 300));
}

const tv = await b.newPage({ viewport: { width: 1280, height: 720 }, locale: 'pt-PT' });
tv.on('pageerror', (e) => errs.push('TV ' + e.message));
tv.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errs.push('TVc ' + m.text()); });
await tv.goto(`${BASE}/risca/tv/`);
await tv.waitForFunction(() => /^[A-Z]{4}$/.test(document.getElementById('room-code').textContent), null, { timeout: 30000 });
const code = await tv.$eval('#room-code', (e) => e.textContent);
console.log('sala', code);

const phones = [];
for (const name of ['Joana', 'Miguel', 'Rita']) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'pt-PT' });
  const ph = await ctx.newPage();
  ph.on('pageerror', (e) => errs.push('PH ' + e.message));
  await ph.goto(`${BASE}/risca/comando/?room=${code}`);
  await ph.fill('#name', name);
  if (!phones.length) await ph.screenshot({ path: `${OUT}/telemovel-entrar.png` });
  await ph.click('#btn-join');
  await ph.waitForSelector('#s-lobby:not(.hidden)', { timeout: 10000 });
  phones.push(ph);
}
await wait(400);
ok(await tv.evaluate(() => __risca.players.size === 3), 'três telemóveis entram na sala');
ok(await phones[1].$eval('#opts', (e) => e.classList.contains('ro')), 'só o chefe da sala muda as regras');
// o chefe escolhe 1 volta, 60 s e palavras próprias
await phones[0].selectOption('#o-rounds', '1');
await phones[0].selectOption('#o-time', '60');
await makeCat(phones[0], 'Escola', 'recreio, lancheira, professora, quadro');
await wait(400);
const s = await tv.evaluate(() => __risca.settings);
ok(s.rounds === 1 && s.time === 60 && s.theme === 'propria' && s.themeName === 'Escola' && s.custom.length === 4, `regras chegam à TV (${JSON.stringify(s)})`);
await tv.screenshot({ path: `${OUT}/tv-lobby.png` });
await phones[0].screenshot({ path: `${OUT}/telemovel-sala.png` });

await phones[1].click('#btn-start');
await wait(500);
ok(await tv.evaluate(() => __risca.phase === 'choose'), 'qualquer telemóvel pode começar');
const drawerIdx = await tv.evaluate(() => __risca.order.indexOf(__risca.turn.drawer));
const D = phones[drawerIdx], G = phones.filter((_, i) => i !== drawerIdx);
await D.waitForSelector('#s-choose:not(.hidden)');
ok(await G[0].$eval('#s-msg', (e) => !e.classList.contains('hidden')), 'quem não desenha fica à espera');
await tv.screenshot({ path: `${OUT}/tv-escolher.png` });
await D.screenshot({ path: `${OUT}/telemovel-escolher.png` });
const choices = await D.$$eval('#choices b', (els) => els.map((e) => e.textContent));
ok(choices.length === 3 && choices.every((w) => ['recreio', 'lancheira', 'professora', 'quadro'].includes(w)), `3 palavras próprias para escolher (${choices})`);
await D.click('#choices button >> nth=1');
await wait(400);
const word = await tv.evaluate(() => __risca.turn.word);
ok(word === choices[1], `quem desenha escolhe a palavra (${word})`);
await D.waitForSelector('#s-draw:not(.hidden)');

// desenhar: uma casa com o dedo (rato) + balde de tinta
const box = await (await D.$('#pad')).boundingBox();
const P = (x, y) => [box.x + box.width * x, box.y + box.height * y];
async function line(pts) {
  await D.mouse.move(...P(...pts[0])); await D.mouse.down();
  for (const p of pts.slice(1)) await D.mouse.move(...P(...p), { steps: 6 });
  await D.mouse.up();
}
await D.click('#colors button >> nth=9'); // azul
await D.click('#sizes button >> nth=1');
await line([[0.25, 0.85], [0.25, 0.45], [0.5, 0.2], [0.75, 0.45], [0.75, 0.85], [0.25, 0.85]]);
await D.click('#colors button >> nth=3'); // vermelho
await line([[0.42, 0.85], [0.42, 0.62], [0.55, 0.62], [0.55, 0.85]]);
await D.click('#colors button >> nth=5'); // amarelo
await D.click('.tool[data-tool=fill]');
await D.mouse.click(...P(0.35, 0.55));
await D.click('.tool[data-tool=pen]');
await D.click('#colors button >> nth=6');
await D.click('#sizes button >> nth=2');
await line([[0.05, 0.92], [0.95, 0.92]]);
await line([[0.85, 0.1], [0.86, 0.11]]);
await D.click('#t-undo');
await wait(500);
const same = await Promise.all([tv, D].map((p) => p.evaluate(() => {
  const c = (window.__risca?.quadro || window.__ctrl.quadro).ctx.getImageData(0, 0, 800, 600).data;
  let h = 0; for (let i = 0; i < c.length; i += 97) h = (h * 31 + c[i]) >>> 0; return h;
})));
const nops = await tv.evaluate(() => __risca.quadro.ops.length);
ok(nops === 4, `os traços, o balde e o desfazer chegam à TV (${nops} operações)`);
ok(same[0] === same[1], 'o desenho na TV é igual ao do telemóvel');

// palpites: errado, quase, certo
const g0 = G[0], g1 = G[1];
await g0.waitForSelector('#s-guess:not(.hidden)');
await g0.fill('#g-input', 'casa'); await g0.press('#g-input', 'Enter');
await wait(250);
const nearly = word.slice(0, -1) + (word.endsWith('a') ? 'e' : 'a');
await g0.fill('#g-input', nearly.toUpperCase()); await g0.press('#g-input', 'Enter');
await wait(300);
ok(/quase/.test(await g0.$eval('#g-fb', (e) => e.textContent)), `palpite quase certo («${nearly}») avisa só esse jogador`);
ok(!(await tv.$eval('#feed', (e) => e.textContent)).includes(nearly), 'o palpite quase certo não aparece escrito na TV');
await g1.fill('#g-input', 'o ' + word.toUpperCase()); await g1.press('#g-input', 'Enter');
await wait(400);
ok(await g1.$eval('#g-done', (e) => !e.classList.contains('hidden')), 'palpite certo (com artigo e maiúsculas) é aceite');
await g1.click('#reacts button >> nth=0');
await tv.waitForTimeout(400);
await tv.screenshot({ path: `${OUT}/tv-desenho.png` });
await D.screenshot({ path: `${OUT}/telemovel-desenhar.png` });
await g0.screenshot({ path: `${OUT}/telemovel-adivinhar.png` });
await g1.screenshot({ path: `${OUT}/telemovel-acertou.png` });
const sc = await tv.evaluate(() => __risca.list.map((p) => [p.name, p.score]));
ok(sc.filter(([, v]) => v > 0).length === 2, `quem acertou e quem desenhou ganham pontos (${JSON.stringify(sc)})`);
await g0.fill('#g-input', word); await g0.press('#g-input', 'Enter');
await wait(1800);
ok(await tv.evaluate(() => __risca.phase === 'reveal'), 'quando todos acertam, a vez acaba logo');
await tv.screenshot({ path: `${OUT}/tv-revelar.png` });

// próximas vezes: passar o tempo à frente (escolha automática e fim do tempo)
for (let k = 0; k < 2; k++) {
  await tv.evaluate(() => { __risca.phaseEnd = performance.now(); });
  await wait(500);
  ok(await tv.evaluate(() => __risca.phase === 'choose'), `vez ${k + 2}: outro jogador desenha`);
  await tv.evaluate(() => { __risca.phaseEnd = performance.now(); });
  await wait(500);
  ok(await tv.evaluate(() => __risca.phase === 'draw' && !!__risca.turn.word), 'sem escolha, a palavra é escolhida sozinha');
  if (k === 0) {
    await tv.evaluate(() => { __risca.phaseEnd = performance.now() + 15000; __risca.tick(); });
    await wait(300);
    ok(await tv.evaluate(() => __risca.turn.revealed.size >= 1), 'aparecem letras de ajuda com o tempo');
  }
  await tv.evaluate(() => { __risca.phaseEnd = performance.now(); });
  await wait(500);
}
const drawers = await tv.evaluate(() => __risca.gallery.length);
await tv.evaluate(() => { __risca.phaseEnd = performance.now(); });
await wait(800);
ok(await tv.evaluate(() => __risca.phase === 'final'), `depois de todos desenharem, aparece o pódio (${drawers} desenho(s) na galeria)`);
await tv.screenshot({ path: `${OUT}/tv-podio.png` });
await phones[0].screenshot({ path: `${OUT}/telemovel-fim.png` });
await phones[2].click('#btn-again');
await wait(400);
ok(await tv.evaluate(() => __risca.phase === 'lobby'), 'JOGAR DE NOVO volta à sala de espera');

// sair a meio: com 2 jogadores, se quem desenha sai, volta à sala
await phones[0].click('#btn-start');
await wait(300);
const dIdx = await tv.evaluate(() => __risca.order.indexOf(__risca.turn.drawer));
await phones[dIdx].close();
await wait(800);
await tv.evaluate(() => { const p = __risca.players.get(__risca.turn.drawer); p.leftAt -= 20000; });
await wait(500);
ok(await tv.evaluate(() => __risca.phase === 'reveal' && __risca.online.length === 2), 'quem desenha sai: a vez acaba e mostra a palavra');

ok(!errs.length, 'sem erros de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
await b.close();
