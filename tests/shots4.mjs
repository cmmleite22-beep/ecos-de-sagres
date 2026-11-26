// Capturas: 1 jogador (qualidade alta) e 3 jogadores (ecrã em 4 com vista geral)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errs = [];
async function run(q, n, shots) {
  const tv = await b.newPage({ viewport: { width: 1280, height: 720 } });
  tv.on('pageerror', (e) => errs.push(e.message));
  await tv.goto(`http://localhost:8080/tv/?q=${q}`);
  await tv.waitForFunction(() => window.__game && /^[A-Z]{4}$/.test(document.getElementById('room-code').textContent), null, { timeout: 90000 });
  await tv.evaluate((n) => { const names = ['Joana', 'Miguel', 'Rita', 'Duarte']; for (let i = 0; i < n; i++) __game.addPlayer('t' + i, names[i]); __game.startGame(); }, n);
  for (const [name, z, y, yaw, pitch] of shots) {
    await tv.evaluate(([z, y, yaw, pitch]) => { __game.cpZ = z; __game.dialogQueue.length = 0; __game.players.forEach((p, i) => { p.pos.set(i * 1.3 - 1.3, y, z + (i ? -2 - i : 0)); p.vel.set(0,0,0); p.yaw = yaw + (i ? (i - 1.5) * 0.2 : 0); p.pitch = pitch; p.hp = 100; }); }, [z, y, yaw, pitch]);
    const t0 = await tv.evaluate(() => __game.simTime || 0);
    await tv.waitForFunction((t) => (__game.simTime || 0) > t + 1.2, t0, { timeout: 120000 });
    await tv.screenshot({ path: `shots/${name}.png` });
  }
  await tv.close();
}
await run('high', 1, [['hq-temple', 24, 0.1, 0, 0.12], ['hq-altar', 147, 3.1, 0, 0.05], ['hq-camp', 3, 0.1, 0.4, 0.05]]);
await run('cast', 3, [['split3-courtyard', 49, 3.1, 0, 0]]);
console.log(errs.length ? errs.join('\n') : 'sem erros');
await b.close();
