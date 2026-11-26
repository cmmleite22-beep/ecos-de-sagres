// Fúria Atlântica — teste ponta-a-ponta: TV + 2 telemóveis (Playwright).
// Uso: npm start  &&  node tests/luta-e2e.mjs      (BASE=http://localhost:8080 por omissão)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8080';
const OUT = process.env.OUT || 'shots/luta';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const errs = [];
const ok = (cond, msg) => { console.log((cond ? 'OK      ' : 'FALHOU  ') + msg); if (!cond) process.exitCode = 1; };

const tv = await b.newPage({ viewport: { width: 1280, height: 720 } });
tv.on('pageerror', (e) => errs.push('TV ' + e.message));
tv.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errs.push('TVc ' + m.text()); });
await tv.goto(`${BASE}/luta/tv/?q=cast`);
await tv.waitForFunction(() => /^[A-Z]{4}$/.test(document.getElementById('room-code').textContent), null, { timeout: 30000 });
const code = await tv.$eval('#room-code', (e) => e.textContent);
console.log('sala', code);

const phoneCtx = await b.newContext({ ...devices['Pixel 7 landscape'] });
const phones = [];
for (const [name, ch] of [['Joana', 'MARÉ'], ['Miguel', 'BASALTO']]) {
  const ph = await phoneCtx.newPage();
  ph.on('pageerror', (e) => errs.push('PH ' + e.message));
  await ph.goto(`${BASE}/luta/comando/?room=${code}`);
  await ph.fill('#name', name);
  if (!phones.length) await ph.screenshot({ path: `${OUT}/telemovel-entrar.png` });
  await ph.click('#btn-join');
  await ph.waitForSelector('#s-select:not(.hidden)', { timeout: 10000 });
  await ph.click(`.card:has-text("${ch}")`);
  phones.push(ph);
}
await tv.waitForTimeout(800);
await phones[1].screenshot({ path: `${OUT}/telemovel-escolha.png` });
const lobby = await tv.evaluate(() => __luta.queue.map((id) => __luta.players.get(id).char));
ok(lobby.join() === 'mare,basalto', `dois telemóveis entram e escolhem lutadores (${lobby})`);
await phones[0].click('#st-next');
await tv.waitForTimeout(300);
ok(await tv.evaluate(() => __luta.stageIdx === 1), 'o telemóvel muda de cenário');
await tv.screenshot({ path: `${OUT}/tv-escolha.png` });

await phones[0].click('#btn-fight');
await phones[0].waitForSelector('#s-pad:not(.hidden)', { timeout: 10000 });
await tv.waitForFunction(() => __luta.phase === 'fight', null, { timeout: 15000 });
ok(true, 'LUTAR inicia a partida e os telemóveis passam a comando');
const G = (fn, arg) => tv.evaluate(fn, arg);
const F = () => G(() => __luta.fighters.map((f) => ({ x: Math.round(f.x), y: Math.round(f.y), hp: Math.round(f.hp), st: f.state, m: Math.round(f.meter) })));
const sim = async (frames) => { const f0 = await G(() => __luta.frame); await tv.waitForFunction((t) => __luta.frame >= t, f0 + frames, { timeout: 60000, polling: 50 }); };
const stick = (i, x, y) => phones[i].evaluate(([x, y]) => { __ctrl.input.x = x; __ctrl.input.y = y; __ctrl.sendInput(true); }, [x, y]);
const tap = async (i, sel) => { const bx = await phones[i].$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }); await phones[i].touchscreen.tap(bx.x, bx.y); };

// 1) andar para a frente com o joystick
let s = await F();
await stick(0, 1, 0); await sim(40); await stick(0, 0, 0);
let s2 = await F();
ok(s2[0].x > s[0].x + 80, `joystick anda para a frente (x ${s[0].x} → ${s2[0].x})`);
// aproximar até à distância de soco
await G(() => { __luta.fighters[0].x = 900; __luta.fighters[1].x = 1050; });
await sim(5);
// 2) soco tocando no botão do ecrã
const hp0 = (await F())[1].hp;
await tap(0, '.b-punch'); await sim(30);
let hp1 = (await F())[1].hp;
ok(hp1 < hp0, `SOCO acerta e tira vida (${hp0} → ${hp1})`);
await tv.screenshot({ path: `${OUT}/tv-soco.png` });
// 3) defesa: o jogador 2 segura DEFESA e o pontapé do 1 não tira vida
await sim(30);
await phones[1].evaluate(() => __ctrl.press(8, true));
await sim(4);
const hpB = (await F())[1].hp;
await phones[0].evaluate(() => __ctrl.press(2, true)); await sim(3); await phones[0].evaluate(() => __ctrl.press(2, false));
await sim(30);
const hpB2 = (await F())[1].hp;
await phones[1].evaluate(() => __ctrl.press(8, false));
ok(hpB2 === hpB, `DEFESA bloqueia o pontapé (${hpB} → ${hpB2})`);
// 4) especial (Onda da Maré) à distância
await G(() => { __luta.fighters[0].x = 760; __luta.fighters[1].x = 1180; });
await sim(20);
const hpC = (await F())[1].hp;
await phones[0].evaluate(() => __ctrl.press(4, true)); await sim(2); await phones[0].evaluate(() => __ctrl.press(4, false));
await sim(20);
await tv.screenshot({ path: `${OUT}/tv-onda.png` });
await sim(50);
const hpC2 = (await F())[1].hp;
ok(hpC2 < hpC - 50, `ESPECIAL (Onda) atravessa o ecrã e acerta (${hpC} → ${hpC2})`);
// 5) salto
await sim(30);
await stick(1, 0, 1); await sim(14);
const yj = (await F())[1].y; await stick(1, 0, 0);
ok(yj > 60, `joystick para cima salta (altura ${yj})`);
await sim(60);
// 6) super quando a barra enche
await G(() => { __luta.fighters[1].meter = 100; __luta.fighters[0].x = 900; __luta.fighters[1].x = 1120; });
await sim(10);
const ready = await phones[1].$eval('.b-super', (e) => e.classList.contains('ready'));
ok(ready, 'o botão SUPER acende no telemóvel quando a barra está cheia');
const hpD = (await F())[0].hp;
await phones[1].evaluate(() => __ctrl.press(16, true)); await sim(2); await phones[1].evaluate(() => __ctrl.press(16, false));
await sim(20);
await tv.screenshot({ path: `${OUT}/tv-super-anuncio.png` });
await phones[1].screenshot({ path: `${OUT}/telemovel-comando.png` });
await sim(62);
await tv.screenshot({ path: `${OUT}/tv-vulcao.png` });
await sim(90);
const hpD2 = (await F())[0].hp;
ok(hpD2 < hpD - 100, `SUPER (Vulcão) tira muita vida (${hpD} → ${hpD2})`);
// 7) K.O. e rondas
await sim(80);
await G(() => { __luta.fighters[0].hp = 20; __luta.fighters[1].x = __luta.fighters[0].x + 140 * Math.sign(__luta.fighters[1].x - __luta.fighters[0].x || 1); });
await sim(5);
await phones[1].evaluate(() => __ctrl.press(2, true)); await sim(3); await phones[1].evaluate(() => __ctrl.press(2, false));
await tv.waitForFunction(() => __luta.phase === 'roundEnd', null, { timeout: 15000 });
await sim(30);
await tv.screenshot({ path: `${OUT}/tv-ko.png` });
await tv.waitForFunction(() => __luta.phase === 'intro' || __luta.phase === 'matchEnd', null, { timeout: 20000 });
const r = await G(() => ({ round: __luta.round, won: __luta.fighters.map((f) => f.roundsWon) }));
ok(r.round === 2 && r.won[1] === 1, `K.O. dá a ronda ao jogador 2 e começa a ronda 2 (${JSON.stringify(r)})`);
// 8) terminar a partida
await tv.waitForFunction(() => __luta.phase === 'fight', null, { timeout: 15000 });
await G(() => { __luta.fighters[0].hp = 0; });
await tv.waitForFunction(() => __luta.phase === 'matchEnd', null, { timeout: 20000 });
await sim(120);
await tv.screenshot({ path: `${OUT}/tv-vitoria.png` });
const res = await phones[1].$eval('#res-title', (e) => e.textContent);
ok(res === 'VITÓRIA!', `o telemóvel do vencedor mostra ${res}`);
await phones[1].screenshot({ path: `${OUT}/telemovel-vitoria.png` });
await tv.waitForFunction(() => __luta.phase === 'lobby', null, { timeout: 20000 });
await phones[0].waitForSelector('#s-select:not(.hidden)', { timeout: 5000 });
const q = await G(() => __luta.queue.map((id) => __luta.players.get(id).name));
ok(q[0] === 'Miguel', `no fim volta ao ecrã de escolha e o vencedor fica em 1.º (${q})`);
// 9) um só jogador luta contra a máquina
await phones[0].close();
await sim(10);
await phones[1].click('#btn-fight');
await tv.waitForFunction(() => __luta.phase === 'fight', null, { timeout: 15000 });
await sim(600);
const cpu = await G(() => ({ slots: __luta.slots, hp: __luta.fighters.map((f) => Math.round(f.hp)), x: __luta.fighters.map((f) => Math.round(f.x)) }));
ok(cpu.slots[1] === 'cpu1', `com um só jogador, a máquina luta (${JSON.stringify(cpu)})`);
await tv.screenshot({ path: `${OUT}/tv-contra-maquina.png` });

ok(!errs.length, 'sem erros de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
const fps = await tv.$eval('#fps', (e) => e.textContent);
console.log('fps (sem GPU):', fps);
await b.close();
