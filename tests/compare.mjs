// Capturas para comparar antes/depois: mesmas posições de câmara, perfil escolhido por argumento.
// Uso: node tests/compare.mjs <prefixo> [qualidade]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const prefix = process.argv[2] || 'shot', q = process.argv[3] || 'high';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errs = [];
const tv = await b.newPage({ viewport: { width: 1280, height: 720 } });
tv.on('pageerror', (e) => errs.push(e.message));
await tv.goto(`http://localhost:8080/tv/?q=${q}&static`);
await tv.waitForFunction(() => window.__game, null, { timeout: 120000 });
await tv.evaluate(() => { __game.addPlayer('t0', 'Joana'); __game.startGame(); });
const shots = [
  ['acampamento', 2, 0.1, 0.35, 0.02],
  ['templo', 18, 0.1, 0, 0.1],
  ['pilares', 30.5, 3.1, 0, -0.12],
  ['patio', 47.5, 3.1, 0.15, 0.02],
  ['falesia', 99, 9.1, 3.14, -0.05],
  ['altar', 146, 3.1, 0, 0.05],
];
for (const [name, z, y, yaw, pitch] of shots) {
  await tv.evaluate(([z, y, yaw, pitch]) => {
    __game.cpZ = z; __game.dialogQueue.length = 0; __game.hud.dialog(null);
    const p = __game.players[0]; p.pos.set(0, y, z); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = pitch; p.hp = 100;
    __game.enemies.list.forEach((e) => { e.dead = true; e.deadT = 10; });
  }, [z, y, yaw, pitch]);
  const t0 = await tv.evaluate(() => __game.simTime || 0);
  await tv.waitForFunction((t) => (__game.simTime || 0) > t + 0.8, t0, { timeout: 180000 });
  await tv.screenshot({ path: `shots/${prefix}-${name}.png` });
}
console.log(errs.length ? errs.join('\n') : 'sem erros');
await b.close();
