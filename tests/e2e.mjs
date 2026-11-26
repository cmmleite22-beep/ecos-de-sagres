// Teste ponta-a-ponta: TV + 2 telemóveis (Playwright). Uso: npm start  &&  node tests/e2e.mjs
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8080';
const Q = process.env.Q || 'cast';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const tv = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
tv.on('pageerror', (e) => errs.push('TV ' + e.message));
tv.on('console', (m) => { if (m.type() === 'error') errs.push('TVc ' + m.text()); });
await tv.goto(`${BASE}/tv/?q=${Q}`);
await tv.waitForFunction(() => /^[A-Z]{4}$/.test(document.getElementById('room-code').textContent), null, { timeout: 90000 });
const code = await tv.$eval('#room-code', (e) => e.textContent);
console.log('sala', code);
const phoneCtx = await b.newContext({ ...devices['Pixel 7 landscape'] });
const phones = [];
for (const [name, ch] of [['Joana', 'Ana'], ['Miguel', 'Tito']]) {
  const ph = await phoneCtx.newPage();
  ph.on('pageerror', (e) => errs.push('PH ' + e.message));
  await ph.goto(`${BASE}/controller/?room=${code}`);
  await ph.fill('#name', name);
  await ph.click(`#chars .char:has-text("${ch}")`);
  if (!phones.length) await ph.screenshot({ path: 'shots/phone-join.png' });
  await ph.click('#btn-join');
  phones.push(ph);
}
await phones[1].waitForSelector('#s-lobby:not(.hidden)', { timeout: 10000 });
await phones[1].screenshot({ path: 'shots/phone-lobby.png' });
await tv.waitForTimeout(2000);
await tv.screenshot({ path: 'shots/tv-lobby-2p.png' });
await phones[0].click('#btn-start');
await phones[0].waitForSelector('#s-pad:not(.hidden)', { timeout: 10000 });
const G = (fn, arg) => tv.evaluate(fn, arg);
const state = () => G(() => __game.players.map((p) => ({ n: p.name, x: +p.pos.x.toFixed(1), y: +p.pos.y.toFixed(1), z: +p.pos.z.toFixed(1), yaw: +p.yaw.toFixed(2), hp: Math.round(p.hp) })));
// espera por N segundos de tempo de jogo (num PC sem GPU o jogo pode correr mais devagar que o relógio)
const waitSim = async (sec) => { const t0 = await G(() => __game.simTime || 0); await tv.waitForFunction((t) => (__game.simTime || 0) >= t, t0 + sec, { timeout: 120000, polling: 100 }); };
const ok = (cond, msg) => { console.log((cond ? 'OK  ' : 'FALHOU ') + msg); if (!cond) process.exitCode = 1; };

// 1) andar para a frente
const z0 = (await state())[0].z;
await phones[0].evaluate(() => { __ctrl.input.y = 1; __ctrl.sendInput(true); });
await waitSim(1.5);
await phones[0].evaluate(() => { __ctrl.input.y = 0; __ctrl.sendInput(true); });
let s = await state();
ok(s[0].z > z0 + 2, `jogador anda para a frente (z ${z0} → ${s[0].z})`);
// 2) olhar: arrastar o dedo na zona de mira
const yaw0 = s[1].yaw;
const box = await phones[1].$eval('#look-zone', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await phones[1].mouse.move(box.x, box.y); await phones[1].mouse.down();
await phones[1].mouse.move(box.x + 120, box.y, { steps: 6 }); await phones[1].mouse.up();
await waitSim(0.3);
s = await state();
ok(s[1].yaw < yaw0 - 0.2, `arrastar para a direita roda a câmara (yaw ${yaw0} → ${s[1].yaw})`);
await phones[0].screenshot({ path: 'shots/phone-pad.png' });
await tv.screenshot({ path: 'shots/tv-play-camp.png' });

async function tp(z, y, name, wait = 1500) {
  await G(([z, y]) => { __game.cpZ = Math.max(__game.cpZ, z - 0.5); __game.players.forEach((p, i) => { p.pos.set(i * 1.4 - 0.7, y, z); p.vel.set(0, 0, 0); p.yaw = 0; p.pitch = -0.05; p.hp = 100; }); }, [z, y]);
  await tv.waitForTimeout(wait);
  if (name) await tv.screenshot({ path: `shots/tv-${name}.png` });
}
await tp(30, 3.1, 'temple');
await tp(47.5, 3.1, 'courtyard', 2500);
// 3) disparar contra um mercenário: apontar ao inimigo em (5, 3, 62.5)
const before = await G(() => __game.enemies.list[1].hp);
await G(() => { const p = __game.players[0]; p.pos.set(5, 3.05, 57); p.vel.set(0,0,0); p.yaw = 0; p.pitch = -0.03; });
await tv.waitForTimeout(300);
// mira automática do teste: aponta ao peito do inimigo enquanto dispara
const aim = setInterval(() => G(() => { const p = __game.players[0], e = __game.enemies.list[1];
  const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, dy = (e.pos.y + 1.1) - (p.pos.y + 1.62);
  p.yaw = Math.atan2(dx, dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }).catch(() => {}), 50);
await phones[0].evaluate(() => __ctrl.press(8, true));
await waitSim(1.2);
clearInterval(aim);
await phones[0].evaluate(() => __ctrl.press(8, false));
const after = await G(() => ({ hp: __game.enemies.list[1].hp, dead: __game.enemies.list[1].dead, kills: __game.players[0].kills }));
ok(after.hp < before || after.dead, `tiro acerta no mercenário (hp ${before} → ${after.hp}, abatido=${after.dead})`);
// 3b) mira automática do jogo: apontar ~5° ao lado do inimigo e disparar — o tiro tem de acertar
const aa0 = await G(() => { const p = __game.players[0], e = __game.enemies.list[0];
  e.hp = 3; e.dead = false; p.hp = 100; p.pos.set(-3.5, 3.05, 59); p.vel.set(0, 0, 0);
  const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z; p.yaw = Math.atan2(dx, dz) + 0.09; p.pitch = 0; return e.hp; });
await phones[0].evaluate(() => __ctrl.press(8, true));
await waitSim(0.8);
await phones[0].evaluate(() => __ctrl.press(8, false));
const aa1 = await G(() => ({ hp: __game.enemies.list[0].hp, dead: __game.enemies.list[0].dead }));
ok(aa1.hp < aa0 || aa1.dead, `mira automática corrige o tiro (hp ${aa0} → ${aa1.hp})`);
await tv.screenshot({ path: 'shots/tv-shooting.png' });
// 4) os mercenários disparam de volta
await tp(60, 3.1, null, 300);
await waitSim(5);
s = await state();
ok(s.some((p) => p.hp < 100) || (await G(() => __game.enemies.list.slice(0,2).every(e => e.dead))), `mercenários causam dano (hp ${s.map((p) => p.hp)})`);
// 5) portão cooperativo
await G(() => { __game.enemies.list.forEach(e => { if (e.pos.z < 70) { e.dead = true; } }); const g = __game; g.players[0].pos.set(-4.5, 3.1, 64.5); g.players[1].pos.set(4.5, 3.1, 64.5); g.players.forEach(p => p.hp = 100); });
await tv.waitForTimeout(3000);
ok(await G(() => __game.level.gateLatched), 'duas placas abrem o portão');
await tv.screenshot({ path: 'shots/tv-gate-open.png' });
// 6) escalar trepadeiras
await tp(76.8, 3.1, null, 300);
// a andar (com o joystick até ao fim o jogador corre e passaria do topo antes de largar)
for (const ph of phones) await ph.evaluate(() => { __ctrl.input.y = 0.6; __ctrl.sendInput(true); });
await waitSim(0.8);
await tv.screenshot({ path: 'shots/tv-climbing.png' });
await tv.waitForFunction(() => __game.players.every((p) => p.pos.y > 8.9 && p.onGround), null, { timeout: 120000, polling: 50 }).catch(async () => {
  console.log('escalada (diagnóstico):', await G(() => JSON.stringify(__game.players.map((p) => ({ pos: p.pos.toArray().map((v) => +v.toFixed(2)), climbing: p.climbing, ground: p.onGround, input: p.input, dead: p.dead, hp: p.hp, phase: __game.phase })))));
});
for (const ph of phones) await ph.evaluate(() => { __ctrl.input.y = 0; __ctrl.sendInput(true); });
s = await state();
ok(s.every((p) => p.y > 8.9), `escalada até ao topo da falésia (y ${s.map((p) => p.y)})`);
// 7) pedra rolante
await G(() => __game.enemies.list.forEach(e => { if (e.pos.z < 110) e.dead = true; }));
await tp(109.2, 9.1, null, 800);
ok(await G(() => __game.level.boulder.active), 'pedra rolante é ativada');
await G(() => { __game.players.forEach(p => p.yaw = Math.PI); });
await tv.waitForTimeout(700);
await tv.screenshot({ path: 'shots/tv-boulder.png' });
// 8) altar e vitória
await G(() => __game.enemies.list.forEach(e => e.dead = true));
await tp(152, 3.1, 'altar', 1500);
await G(() => { const p = __game.players[0]; p.pos.set(0, 3.9, 157.8); });
await tv.waitForTimeout(400);
await phones[0].evaluate(() => __ctrl.press(4, true));
await tv.waitForTimeout(400);
await phones[0].evaluate(() => __ctrl.press(4, false));
await tv.waitForTimeout(3500);
ok((await G(() => __game.phase)) === 'win', 'AÇÃO no altar termina o capítulo');
await tv.screenshot({ path: 'shots/tv-win.png' });
console.log('fps (swiftshader, sem GPU):', await tv.$eval('#fps', (e) => e.textContent));
ok(errs.length === 0, 'sem erros de JavaScript' + (errs.length ? ':\n' + errs.join('\n') : ''));
await b.close();
