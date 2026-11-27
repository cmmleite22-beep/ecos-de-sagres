// Risca e Arrisca — línguas: o telemóvel do chefe escolhe a língua do jogo, a TV muda, as palavras são dessa língua
// e os palpites com acentos, artigos e caracteres chineses são aceites. Uso: npm start  &&  node tests/risca-linguas.mjs
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

async function room(locale) {
  const tv = await b.newPage({ viewport: { width: 1280, height: 720 }, locale: 'pt-PT' });
  tv.on('pageerror', (e) => errs.push('TV ' + e.message));
  await tv.goto(`${BASE}/risca/tv/`);
  await tv.waitForFunction(() => /^[A-Z]{4}$/.test(document.getElementById('room-code').textContent), null, { timeout: 30000 });
  const code = await tv.$eval('#room-code', (e) => e.textContent);
  const phone = async (name, loc) => {
    const ctx = await b.newContext({ ...devices['Pixel 7'], locale: loc });
    const ph = await ctx.newPage();
    ph.on('pageerror', (e) => errs.push('PH ' + e.message));
    await ph.goto(`${BASE}/risca/comando/?room=${code}`);
    await ph.fill('#name', name);
    await ph.click('#btn-join');
    await ph.waitForSelector('#s-lobby:not(.hidden)', { timeout: 10000 });
    return ph;
  };
  const A = await phone('Ana', locale), B = await phone('Bo', 'pt-PT');
  await wait(500);
  return { tv, A, B };
}

const EXPECT = {
  'pt-BR': ['Toquem em COMEÇAR em um celular!', 'COMEÇAR'],
  en: ['Tap START on a phone!', 'START'],
  es: ['¡Tocad EMPEZAR en un móvil!', 'EMPEZAR'],
  fr: ['Touchez COMMENCER sur un téléphone !', 'COMMENCER'],
  de: ['Tippt auf einem Handy auf STARTEN!', 'STARTEN'],
  zh: ['在任意手机上点击「开始」！', '开始'],
};
for (const [lang, [tvHint, btn]] of Object.entries(EXPECT)) {
  const { tv, A, B } = await room(lang);
  const s = await tv.evaluate(() => __risca.settings);
  ok(s.lang === lang, `${lang}: o telemóvel do chefe põe o jogo na sua língua`);
  ok((await tv.$eval('#start-hint', (e) => e.textContent)) === tvHint, `${lang}: a TV fala ${lang}`);
  ok((await A.$eval('#btn-start', (e) => e.textContent)) === btn, `${lang}: o comando do chefe fala ${lang}`);
  ok((await B.$eval('#btn-start', (e) => e.textContent)) === 'COMEÇAR', `${lang}: o outro telemóvel continua em português`);
  if (lang === 'zh' || lang === 'de') {
    await tv.screenshot({ path: `${OUT}/tv-lobby-${lang}.png` });
    await A.screenshot({ path: `${OUT}/telemovel-sala-${lang}.png` });
  }
  // uma vez a sério: escolher, desenhar, adivinhar
  await A.selectOption('#o-rounds', '1');
  await A.selectOption('#o-theme', 'animais');
  await wait(300);
  await B.click('#btn-start');
  await wait(500);
  const drawer = await tv.evaluate(() => __risca.order.indexOf(__risca.turn.drawer));
  const D = drawer === 0 ? A : B, G = drawer === 0 ? B : A;
  await D.waitForSelector('#s-choose:not(.hidden)');
  const ch = await D.$$eval('#choices b', (els) => els.map((e) => e.textContent));
  const pool = await tv.evaluate((l) => import('/risca/palavras.js').then((P) => P.PALAVRAS[l].animais.n.flat()), lang);
  ok(ch.length === 3 && ch.every((w) => pool.includes(w)), `${lang}: palavras de animais em ${lang} (${ch})`);
  await D.click('#choices button >> nth=0');
  await wait(400);
  const word = await tv.evaluate(() => __risca.turn.word);
  const guess = lang === 'de' ? `die ${word.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')}` : lang === 'zh' ? word : word.toUpperCase();
  await G.waitForSelector('#s-guess:not(.hidden)');
  if (lang === 'zh') await tv.screenshot({ path: `${OUT}/tv-desenhar-zh.png` });
  await G.fill('#g-input', guess);
  await G.click('#g-form button');
  await wait(500);
  ok(await tv.evaluate(() => __risca.list.some((p) => p.guessed) || __risca.phase === 'reveal'), `${lang}: palpite «${guess}» aceite para «${word}»`);
  await Promise.all([tv, A, B].map((p) => p.context().close()));
}

// gestor de categorias no telemóvel (captura)
{
  const { tv, A } = await room('pt-PT');
  await A.click('#cat-open');
  await A.fill('#cat-name', 'Ciências');
  await A.click('#cat-add');
  await A.fill('#set-name', '5.º ano');
  await A.fill('#set-words', 'célula, planta, raiz, folha, flor, caule');
  await A.click('#set-save');
  await wait(300);
  await A.click('#set-new');
  await A.fill('#set-name', 'Corpo humano');
  await A.fill('#set-words', 'coração, pulmão, esqueleto');
  await A.click('#set-save');
  await wait(400);
  ok((await tv.evaluate(() => __risca.settings.custom.length)) === 9, 'dois conjuntos na mesma categoria somam as palavras (9)');
  await A.evaluate(() => document.querySelector('#cat-open').scrollIntoView());
  await A.screenshot({ path: `${OUT}/telemovel-categorias.png`, fullPage: true });
  await tv.screenshot({ path: `${OUT}/tv-lobby-categoria.png` });
  // conjuntos de outra língua não entram
  await A.selectOption('#o-lang', 'en');
  await wait(300);
  const opt = await A.$$eval('#o-theme option', (o) => o.map((x) => x.textContent).find((t) => t.startsWith('★ Ciências')));
  ok(opt === '★ Ciências (0)', `em inglês, os conjuntos em português não contam (${opt})`);
}

ok(!errs.length, 'sem erros de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
await b.close();
