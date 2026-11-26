// Comando no telemóvel: joystick virtual + botões, envia input para a TV.
// Dois transportes: WebSocket (servidor de salas) ou canal Cast (Chromecast).
import { CONFIG, wsUrl, STATIC_MODE } from '../shared/config.js';
import { BTN, CHARACTERS } from '../shared/protocol.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

let transport = null;
let myChar = store.get('ecos.char', 'ana');
let lobby = [];
let phase = 'lobby';

// ---------------- Transportes ----------------
class WSTransport {
  constructor(code, name, char, onMsg, onClose) {
    this.onMsg = onMsg;
    this.ws = new WebSocket(wsUrl());
    this.ws.onopen = () => this.ws.send(JSON.stringify({ t: 'join', code, name, char }));
    this.ws.onmessage = (e) => { try { onMsg(JSON.parse(e.data)); } catch {} };
    this.ws.onclose = () => onClose?.();
  }
  send(m) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
}

class CastTransport {
  constructor(session, name, char, onMsg) {
    this.session = session;
    session.addMessageListener(CONFIG.CAST_NAMESPACE, (_ns, data) => {
      try { onMsg(typeof data === 'string' ? JSON.parse(data) : data); } catch {}
    });
    this.send({ t: 'join', name, char });
    // se a TV ainda estava a carregar e a resposta não chegou, voltar a pedir
    let tries = 0;
    this.retry = setInterval(() => {
      if (this.welcomed || ++tries > 10) { clearInterval(this.retry); return; }
      this.send({ t: 'join', name, char: myChar });
    }, 2000);
  }
  send(m) { this.session.sendMessage(CONFIG.CAST_NAMESPACE, m).catch(() => {}); }
}

function onMessage(m) {
  switch (m.t) {
    case 'joined': break;
    case 'welcome':
      if (transport) transport.welcomed = true;
      myChar = m.char; store.set('ecos.char', myChar);
      document.documentElement.style.setProperty('--c', m.color);
      $('#me').textContent = m.name;
      renderChars('#chars2', true);
      if (!$('#s-join').classList.contains('hidden')) show(phase === 'lobby' ? 's-lobby' : 's-pad');
      break;
    case 'lobby':
      lobby = m.players; phase = m.phase;
      $('#lobby-list').textContent = lobby.map((p) => p.name).join(' · ');
      renderChars('#chars2', true);
      if (phase === 'play' && !$('#s-lobby').classList.contains('hidden')) show('s-pad');
      break;
    case 'state': {
      const pct = Math.max(0, m.hp / (m.max || 100) * 100);
      $('#hpbar div').style.width = pct + '%';
      $('#hpbar div').classList.toggle('low', pct < 35);
      $('#rel').textContent = `◆ ${m.relics} (equipa ${m.team}/${m.total})  ✕ ${m.kills || 0}`;
      if (m.phase === 'win') { $('#btn-start').textContent = 'JOGAR DE NOVO'; show('s-lobby'); }
      else if (m.phase !== 'lobby') { $('#btn-start').textContent = 'COMEÇAR'; show('s-pad'); }
      break;
    }
    case 'buzz': navigator.vibrate?.(m.ms || 50); break;
    case 'pong': $('#lat').textContent = Math.round(performance.now() - m.ts) + ' ms'; break;
    case 'error': $('#join-err').textContent = m.reason; overlay(null); show('s-join'); break;
    case 'host-gone': overlay('A TV desligou-se. Volta a ler o código QR.'); break;
  }
}

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id);
  if (id === 's-pad') goFullscreen();
}
function overlay(text) { const o = $('#overlay'); o.textContent = text || ''; o.classList.toggle('hidden', !text); }

async function goFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    await screen.orientation?.lock?.('landscape');
  } catch {}
  try { await navigator.wakeLock?.request('screen'); } catch {}
}

// ---------------- Ecrã de entrada ----------------
function renderChars(sel, live) {
  const box = $(sel);
  box.innerHTML = '';
  for (const c of CHARACTERS) {
    const taken = live && lobby.some((p) => p.char === c.id && p.char !== myChar);
    const el = document.createElement('div');
    el.className = 'char' + (c.id === myChar ? ' sel' : '') + (taken ? ' taken' : '');
    el.style.setProperty('--c', c.color);
    el.innerHTML = `<div class="dot"></div><b>${c.name.split(' ')[0]}</b><span>${c.role}</span>`;
    el.onclick = () => {
      if (taken) return;
      myChar = c.id; store.set('ecos.char', myChar);
      if (live && transport) transport.send({ t: 'char', char: c.id });
      renderChars(sel, live);
    };
    box.appendChild(el);
  }
}

if (STATIC_MODE) {
  // alojamento sem servidor: só o Chromecast
  document.querySelector('#s-join .row').classList.add('hidden');
  if (CONFIG.CAST_APP_ID === 'CHANGE_ME') $('#join-err').textContent = 'Falta configurar o ID da aplicação Cast (CAST_APP_ID).';
}
$('#name').value = store.get('ecos.name', '');
$('#code').value = (params.get('room') || '').toUpperCase();
renderChars('#chars', false);

$('#btn-join').onclick = () => {
  const code = $('#code').value.trim().toUpperCase();
  const name = $('#name').value.trim() || 'Jogador';
  if (code.length !== 4) { $('#join-err').textContent = 'O código tem 4 letras (está na TV).'; return; }
  store.set('ecos.name', name);
  $('#join-err').textContent = '';
  overlay('A ligar…');
  transport = new WSTransport(code, name, myChar, (m) => { overlay(null); onMessage(m); },
    () => overlay('Ligação perdida. Recarrega a página para voltar a entrar.'));
  goFullscreen();
};
$('#btn-start').onclick = () => transport?.send({ t: 'start' });

// ---------------- Chromecast (Web Sender) ----------------
function castErrorText(code) {
  switch (code) {
    case 'cancel': return 'A ligação foi cancelada (ou não apareceu nenhuma TV para escolher).';
    case 'receiver_unavailable': return 'Nenhuma TV desta rede aceita o jogo. Desliga a TV da corrente 1 minuto e tenta outra vez.';
    case 'timeout': return 'A TV não respondeu a tempo. Tenta outra vez.';
    case 'session_error': return 'A TV não conseguiu abrir o jogo.';
    case 'extension_missing': case 'api_not_initialized': return 'Este browser não suporta Chromecast. Abre no Google Chrome.';
    default: return 'Não foi possível ligar ao Chromecast.';
  }
}
{
  const standalone = matchMedia('(display-mode: standalone)').matches;
  const isChrome = /Chrome\//.test(navigator.userAgent) && !/EdgA|SamsungBrowser|OPR|Firefox|FxiOS|CriOS/.test(navigator.userAgent);
  if (STATIC_MODE && standalone) { window.__envWarn = true; $('#cast-state').textContent = 'Abriste o atalho do ecrã inicial: abre antes o endereço no Chrome.'; }
  else if (STATIC_MODE && !isChrome) { window.__envWarn = true; $('#cast-state').textContent = 'Para o Chromecast, abre esta página no Google Chrome.'; }
}
if (CONFIG.CAST_APP_ID !== 'CHANGE_ME') {
  window.__onGCastApiAvailable = (ok) => {
    if (!ok) return;
    const ctx = cast.framework.CastContext.getInstance();
    ctx.setOptions({
      receiverApplicationId: CONFIG.CAST_APP_ID,
      autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED, // o 2.º telemóvel junta-se à mesma sessão
    });
    $('#btn-cast').classList.remove('hidden');
    // Mostra se o telemóvel está a ver algum aparelho Cast na rede
    const castInfo = () => {
      if (window.__envWarn) return;
      const st = ctx.getCastState();
      $('#cast-state').textContent = st === cast.framework.CastState.NO_DEVICES_AVAILABLE
        ? 'O telemóvel ainda não encontrou nenhum Chromecast nesta rede.'
        : st === cast.framework.CastState.CONNECTED ? 'Ligado ao Chromecast.' : 'Chromecast encontrado na rede.';
    };
    ctx.addEventListener(cast.framework.CastContextEventType.CAST_STATE_CHANGED, castInfo);
    castInfo();
    $('#btn-cast').onclick = async () => {
      $('#join-err').textContent = '';
      let step = 'pedido';
      try {
        const err = await ctx.requestSession(); // devolve um código de erro (ou nada) em vez de lançar, nalgumas versões
        if (err) throw err;
        step = 'sessão';
        const session = ctx.getCurrentSession();
        if (!session) throw 'sem sessão';
        const name = $('#name').value.trim() || 'Jogador';
        store.set('ecos.name', name);
        transport = new CastTransport(session, name, myChar, onMessage);
        show('s-lobby'); // não ficar no ecrã de entrada à espera da resposta da TV
        goFullscreen();
      } catch (e) {
        const code = String(e?.code || e?.message || e);
        $('#join-err').textContent = castErrorText(code) + ` (código: ${code}, passo: ${step})`;
      }
    };
  };
  const s = document.createElement('script');
  s.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
  document.head.appendChild(s);
}

// ---------------- Joystick e botões ----------------
const input = { x: 0, y: 0, b: 0 };
const zone = $('#stick-zone'), base = $('#stick-base'), knob = $('#stick-knob');
let stickId = null, origin = null;
const R = 60;

zone.addEventListener('pointerdown', (e) => {
  if (stickId !== null) return;
  stickId = e.pointerId; zone.setPointerCapture(e.pointerId);
  const zr = zone.getBoundingClientRect();
  origin = { x: e.clientX, y: e.clientY };
  base.style.left = (e.clientX - zr.left) + 'px'; base.style.top = (e.clientY - zr.top) + 'px';
  moveStick(e);
});
zone.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) moveStick(e); });
const endStick = (e) => {
  if (e.pointerId !== stickId) return;
  stickId = null; input.x = input.y = 0;
  knob.style.transform = 'translate(-50%, -50%)';
  sendInput(true);
};
zone.addEventListener('pointerup', endStick);
zone.addEventListener('pointercancel', endStick);

function moveStick(e) {
  let dx = e.clientX - origin.x, dy = e.clientY - origin.y;
  const d = Math.hypot(dx, dy);
  if (d > R) { dx *= R / d; dy *= R / d; }
  knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  input.x = +(dx / R).toFixed(2);
  input.y = +(-dy / R).toFixed(2); // cima = positivo
  sendInput();
}

for (const btn of document.querySelectorAll('.pad')) {
  const bit = +btn.dataset.b;
  const down = (e) => { e.preventDefault(); btn.setPointerCapture?.(e.pointerId); input.b |= bit; btn.classList.add('down'); navigator.vibrate?.(8); sendInput(true); };
  const up = (e) => { e.preventDefault(); input.b &= ~bit; btn.classList.remove('down'); sendInput(true); };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---- zona de mira: arrastar o dedo roda a câmara (como um rato) ----
const look = { dx: 0, dy: 0 };
const lookZone = $('#look-zone');
const lookPtrs = new Map();
function lookStart(e) { lookPtrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); }
function lookMove(e) {
  const l = lookPtrs.get(e.pointerId); if (!l) return;
  look.dx += e.clientX - l.x; look.dy += e.clientY - l.y;
  l.x = e.clientX; l.y = e.clientY;
  sendInput();
}
function lookEnd(e) { lookPtrs.delete(e.pointerId); }
lookZone.addEventListener('pointerdown', (e) => { lookZone.setPointerCapture(e.pointerId); lookStart(e); });
lookZone.addEventListener('pointermove', lookMove);
lookZone.addEventListener('pointerup', lookEnd);
lookZone.addEventListener('pointercancel', lookEnd);
// o botão FOGO também aponta: carregar e arrastar
const fireBtn = document.querySelector('.b-fire');
fireBtn.addEventListener('pointerdown', lookStart);
fireBtn.addEventListener('pointermove', lookMove);
fireBtn.addEventListener('pointerup', lookEnd);
fireBtn.addEventListener('pointercancel', lookEnd);

const SENS = [0.6, 1, 1.5, 2.2];
let sensIdx = Math.max(0, SENS.indexOf(+store.get('ecos.sens', 1)));
const sensBtn = $('#btn-sens');
const showSens = () => { sensBtn.textContent = `Mira ${SENS[sensIdx]}×`; };
showSens();
sensBtn.addEventListener('click', () => { sensIdx = (sensIdx + 1) % SENS.length; store.set('ecos.sens', SENS[sensIdx]); showSens(); sendInput(true); });

// envia quando muda, limitado a ~30 Hz, e reenvia periodicamente (se uma mensagem se perder)
let last = '', lastT = 0, seq = 0, pendingLook = false;
function sendInput(force) {
  if (!transport) return;
  const now = performance.now();
  const key = `${input.x},${input.y},${input.b}`;
  const looking = look.dx || look.dy;
  if (!force && ((key === last && !looking) || now - lastT < 33)) {
    if (looking && !pendingLook) { pendingLook = true; setTimeout(() => { pendingLook = false; sendInput(); }, 34); }
    return;
  }
  last = key; lastT = now;
  transport.send({ t: 'in', x: input.x, y: input.y, b: input.b, lx: Math.round(look.dx), ly: Math.round(look.dy), sens: SENS[sensIdx], s: seq++ });
  look.dx = 0; look.dy = 0;
}
setInterval(() => { last = ''; sendInput(true); }, 250);
setInterval(() => transport?.send({ t: 'ping', ts: performance.now() }), 2000);

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

// testes automáticos
window.__ctrl = { input, look, sendInput, press: (bit, on) => { if (on) input.b |= bit; else input.b &= ~bit; sendInput(true); } };
