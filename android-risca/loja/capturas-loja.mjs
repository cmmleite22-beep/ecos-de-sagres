import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = 'http://localhost:8080';
const CFG = {
 en: { loc: 'en-US', names: ['Emma','Leo','Mia','Noah'], cat: 'Buildings', words: ['house','castle','tent'] },
 'pt-PT': { loc: 'pt-PT', names: ['Ana','Rui','Inês','Tiago'], cat: 'Edifícios', words: ['casa','castelo','tenda'] },
 'pt-BR': { loc: 'pt-BR', names: ['Ana','Lucas','Júlia','Pedro'], cat: 'Construções', words: ['casa','castelo','barraca'] },
 es: { loc: 'es-ES', names: ['Lucía','Pablo','Sara','Diego'], cat: 'Edificios', words: ['casa','castillo','tienda'] },
 fr: { loc: 'fr-FR', names: ['Léa','Hugo','Chloé','Louis'], cat: 'Bâtiments', words: ['maison','château','tente'] },
 de: { loc: 'de-DE', names: ['Lena','Paul','Mia','Jonas'], cat: 'Gebäude', words: ['Haus','Burg','Zelt'] },
 'zh-CN': { loc: 'zh-CN', names: ['小明','小红','小华','小丽'], cat: '建筑', words: ['房子','城堡','帐篷'] },
};
const LANG = process.argv[2] || 'en'; const C = CFG[LANG];
const OUT = process.cwd() + '/' + LANG;
const W = C.words, near = LANG === 'zh-CN' ? '房间' : W[0].slice(0, -1);
(await import('node:fs')).mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tv = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, locale: C.loc });
await tv.goto(`${BASE}/risca/tv/`);
await tv.waitForFunction(() => /^[A-Z]{4}$/.test(document.getElementById('room-code').textContent), null, { timeout: 30000 });
const code = await tv.$eval('#room-code', (e) => e.textContent);
const phones = [];
for (const name of C.names) {
  const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: C.loc });
  const ph = await ctx.newPage();
  await ph.goto(`${BASE}/risca/comando/?room=${code}`);
  await ph.fill('#name', name);
  await ph.click('#btn-join');
  await ph.waitForSelector('#s-lobby:not(.hidden)', { timeout: 10000 });
  phones.push(ph);
}
const L = phones[0];
await L.selectOption('#o-rounds', '1');
await L.selectOption('#o-time', '60');
await L.click('#cat-open');
await L.fill('#cat-name', C.cat);
await L.click('#cat-add');
await L.fill('#set-words', W.join(', '));
await L.click('#set-save');
await wait(300);
await L.click('#cat-open').catch(() => {});
await L.evaluate(() => window.scrollTo(0, 0));
await wait(700);
await tv.evaluate(() => document.fonts.ready);
await tv.screenshot({ path: `${OUT}/tv-1-lobby.png` });
await L.screenshot({ path: `${OUT}/phone-1-lobby.png` });
await phones[1].click('#btn-start');
await wait(600);
const di = await tv.evaluate(() => __risca.order.indexOf(__risca.turn.drawer));
const D = phones[di], G = phones.filter((_, i) => i !== di);
await D.waitForSelector('#s-choose:not(.hidden)');
await D.screenshot({ path: `${OUT}/phone-2-choose.png` });
const ch = await D.$$eval('#choices b', (els) => els.map((e) => e.textContent));
await D.click(`#choices button >> nth=${ch.indexOf(W[0])}`);
await D.waitForSelector('#s-draw:not(.hidden)');
const box = await (await D.$('#pad')).boundingBox();
const P = (x, y) => [box.x + box.width * x, box.y + box.height * y];
async function line(pts) { await D.mouse.move(...P(...pts[0])); await D.mouse.down(); for (const p of pts.slice(1)) await D.mouse.move(...P(...p), { steps: 8 }); await D.mouse.up(); }
await D.click('#colors button >> nth=9'); await D.click('#sizes button >> nth=1');
await line([[0.25, 0.85], [0.25, 0.45], [0.5, 0.2], [0.75, 0.45], [0.75, 0.85], [0.25, 0.85]]);
await D.click('#colors button >> nth=3');
await line([[0.42, 0.85], [0.42, 0.62], [0.55, 0.62], [0.55, 0.85]]);
await D.click('#colors button >> nth=5'); await D.click('.tool[data-tool=fill]'); await D.mouse.click(...P(0.35, 0.55));
await D.click('.tool[data-tool=pen]'); await D.click('#colors button >> nth=6'); await D.click('#sizes button >> nth=2');
await line([[0.05, 0.92], [0.95, 0.92]]);
await D.click('#colors button >> nth=4'); await D.click('#sizes button >> nth=3');
for (let r = 0.01; r <= 0.05; r += 0.015) { const pts = []; for (let a = 0; a <= 6.3; a += 0.4) pts.push([0.86 + r * Math.cos(a) * 0.75, 0.17 + r * Math.sin(a)]); await line(pts); }
await G[0].waitForSelector('#s-guess:not(.hidden)');
await G[0].fill('#g-input', W[2]); await G[0].press('#g-input', 'Enter'); await wait(250);
await G[1].fill('#g-input', W[1]); await G[1].press('#g-input', 'Enter'); await wait(250);
await G[0].fill('#g-input', near); await G[0].press('#g-input', 'Enter'); await wait(300);
await G[2].fill('#g-input', W[0]); await G[2].press('#g-input', 'Enter'); await wait(400);
await G[2].click('#reacts button >> nth=0').catch(() => {});
await wait(500);
await tv.screenshot({ path: `${OUT}/tv-2-drawing.png` });
await D.screenshot({ path: `${OUT}/phone-3-draw.png` });
await G[0].screenshot({ path: `${OUT}/phone-4-guess.png` });
await G[0].fill('#g-input', W[0]); await G[0].press('#g-input', 'Enter');
await G[1].fill('#g-input', W[0]); await G[1].press('#g-input', 'Enter');
await wait(1800);
await tv.screenshot({ path: `${OUT}/tv-3-reveal.png` });
for (let k = 0; k < 30 && (await tv.evaluate(() => __risca.phase)) !== 'final'; k++) { await tv.evaluate(() => { __risca.phaseEnd = performance.now(); }); await wait(500); }
await wait(800);
await tv.screenshot({ path: `${OUT}/tv-4-podium.png` });
await b.close();
