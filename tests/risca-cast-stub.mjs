// Risca e Arrisca — simula o SDK do Cast Web Receiver para testar o caminho Chromecast sem TV:
// o telemóvel pede para entrar ANTES de o jogo carregar e tem de receber "welcome" e "lobby".
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8080';
const STUB = `
window.__sent = [];
window.cast = { framework: {
  system: { EventType: { SENDER_DISCONNECTED: 'sd' }, MessageType: { JSON: 'json' } },
  CastReceiverOptions: function () {},
  CastReceiverContext: { getInstance() { return window.__ctx ||= {
    l: {}, addCustomMessageListener(ns, f) { this.l.msg = f; }, addEventListener(t, f) { this.l[t] = f; },
    start() { this.l.msg({ senderId: 'tel1', data: { t: 'join', name: 'Ana' } }); },
    sendCustomMessage(ns, to, m) { window.__sent.push({ to, t: m.t }); },
  }; } },
} };`;
const b = await chromium.launch();
const p = await b.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.route('https://www.gstatic.com/**', (r) => r.fulfill({ contentType: 'text/javascript', body: STUB }));
await p.goto(BASE + '/risca/tv/?cast=1&static');
await p.waitForFunction(() => window.__risca, null, { timeout: 60000 });
await p.waitForTimeout(500);
let sent = await p.evaluate(() => window.__sent);
const ok1 = sent.some((m) => m.to === 'tel1' && m.t === 'welcome') && sent.some((m) => m.t === 'lobby');
console.log(ok1 ? 'OK ' : 'FALHOU', ' telemóvel que entra antes do jogo carregar recebe welcome e lobby', JSON.stringify(sent.slice(0, 4)));
// pedido repetido (resposta perdida) volta a receber welcome sem duplicar o jogador
await p.evaluate(() => { window.__sent.length = 0; window.__ctx.l.msg({ senderId: 'tel1', data: { t: 'join', name: 'Ana' } }); });
sent = await p.evaluate(() => window.__sent);
const n = await p.evaluate(() => window.__risca.players.size);
const ok2 = sent.some((m) => m.t === 'welcome') && n === 1;
console.log(ok2 ? 'OK ' : 'FALHOU', ' pedido repetido reenvia welcome sem duplicar o jogador', n);
await p.evaluate(() => { window.__ctx.l.msg({ senderId: 'tel2', data: { t: 'join', name: 'Rui' } }); window.__ctx.l.msg({ senderId: 'tel1', data: { t: 'start' } }); });
// sem resposta do servidor do anfitrião (aqui não há rede para ele), o jogo começa na mesma
await p.waitForFunction(() => window.__risca.phase !== 'lobby', null, { timeout: 10000 }).catch(() => {});
const phase = await p.evaluate(() => window.__risca.phase);
console.log(phase !== 'lobby' ? 'OK ' : 'FALHOU', ' COMEÇAR pelo canal Cast inicia o jogo', phase);
console.log(errs.length ? 'FALHOU  erros: ' + errs.join(' | ') : 'OK  sem erros de JavaScript');
await b.close();
process.exit(ok1 && ok2 && phase !== 'lobby' && !errs.length ? 0 : 1);
