// Teste da app nativa (Godot) com dois comandos reais: entrar, escolher personagem, começar e jogar.
// Uso: godot --headless --path godot-tv &  node tests/native-tv.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8080';
const info = await (await fetch(BASE + '/api/info')).json();
console.log('sala', info.room, 'nativo', info.native);
const b = await chromium.launch();
const phones = [];
for (const name of ['Ana', 'Tito']) {
  const pg = await b.newPage({ viewport: { width: 800, height: 400 }, hasTouch: true });
  await pg.goto(`${BASE}/controller/?room=${info.room}&native=1`);
  await pg.fill('#name', name);
  await pg.click('#btn-join');
  await pg.waitForSelector('#s-lobby:not(.hidden)', { timeout: 5000 });
  phones.push(pg);
}
const list = await phones[0].textContent('#lobby-list');
console.log('lobby:', list);
if (!/Ana/.test(list) || !/Tito/.test(list)) throw new Error('lobby sem os dois jogadores');
await phones[1].click('#chars2 .char:nth-child(3)'); // Tito escolhe a Inês
await phones[0].waitForTimeout(500);
await phones[0].click('#btn-start');
await phones[0].waitForSelector('#s-pad:not(.hidden)', { timeout: 5000 });
await phones[1].waitForSelector('#s-pad:not(.hidden)', { timeout: 5000 });
console.log('ambos no comando de jogo');
await phones[0].evaluate(() => { window.__ctrl.input.y = 1; window.__ctrl.sendInput(true); });
await phones[0].waitForTimeout(1500);
const rel = await phones[0].textContent('#rel');
console.log('estado no telemóvel:', rel, '| latência', await phones[0].textContent('#lat'));
await b.close();
console.log('OK');
