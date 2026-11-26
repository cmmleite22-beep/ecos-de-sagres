// Comando de luta no telemóvel: joystick + 4 botões + SUPER. Envia o input para a TV.
// Dois transportes, como no Ecos de Sagres: WebSocket (servidor de salas) ou canal Cast (Chromecast).
import { LUTA, BTN, wsUrl, STATIC_MODE } from '../config.js';
import { ROSTER, P } from '../tv/jogo/lutadores.js';
import { drawFighter, lerpPose, skeleton, updateTails } from '../tv/jogo/desenho.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

let transport = null;
let myChar = store.get('furia.char', 'mare');
let mySlot = -1, phase = 'lobby', lobby = [];

// ---------------- transportes ----------------
class WSTransport {
  constructor(code, name, char, onMsg, onClose) {
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
    session.addMessageListener(LUTA.CAST_NAMESPACE, (_ns, data) => { try { onMsg(typeof data === 'string' ? JSON.parse(data) : data); } catch {} });
    this.send({ t: 'join', name, char });
    let tries = 0;
    this.retry = setInterval(() => { // se a TV ainda estava a carregar, voltar a pedir
      if (this.welcomed || ++tries > 10) { clearInterval(this.retry); return; }
      this.send({ t: 'join', name, char: myChar });
    }, 2000);
  }
  send(m) { this.session.sendMessage(LUTA.CAST_NAMESPACE, m).catch(() => {}); }
}

// ---------------- mensagens da TV ----------------
function onMessage(m) {
  switch (m.t) {
    case 'welcome':
      if (transport) transport.welcomed = true;
      myChar = m.char; store.set('furia.char', myChar);
      setColor();
      $('#me').textContent = m.name;
      if (!$('#s-join').classList.contains('hidden')) show(phase === 'lobby' ? 's-select' : 's-pad');
      renderRoster();
      break;
    case 'lobby':
      lobby = m.players; phase = m.phase;
      $('#st-name').textContent = m.stage;
      $('#lobby-list').textContent = lobby.map((p) => p.name).join(' · ');
      break;
    case 'state': onState(m); break;
    case 'buzz': navigator.vibrate?.(m.ms || 40); break;
    case 'pong': $('#lat').textContent = Math.round(performance.now() - m.ts) + ' ms'; break;
    case 'error': $('#join-err').textContent = m.reason; overlay(null); show('s-join'); break;
    case 'host-gone': overlay('A TV desligou-se. Volta a ler o código QR.'); break;
  }
}

let resultShown = false;
function onState(m) {
  phase = m.phase; mySlot = m.slot;
  if (m.char && m.char !== myChar) { myChar = m.char; setColor(); }
  if (phase === 'lobby') {
    resultShown = false; $('#result').classList.add('hidden');
    if (!$('#s-pad').classList.contains('hidden')) show('s-select');
    const q = m.queue;
    $('#queue-info').textContent = q === undefined || q < 0 ? '' : q < 2 ? 'Vais lutar na próxima ronda.' : `Na fila: ${q - 1} à tua frente.`;
    return;
  }
  if (!$('#s-select').classList.contains('hidden')) show('s-pad');
  $('#watch').classList.toggle('hidden', mySlot >= 0);
  if (mySlot < 0) { $('#watch').textContent = m.queue >= 0 ? `A ver a luta… és o ${m.queue - 1}.º na fila. O vencedor fica, o vencido sai.` : 'A ver a luta…'; return; }
  const pct = Math.max(0, m.hp / (m.max || 1000) * 100);
  $('#hpbar div').style.width = pct + '%';
  $('#hpbar div').classList.toggle('low', pct < 30);
  $('#meterbar div').style.width = (m.meter || 0) + '%';
  $('.b-super').classList.toggle('ready', m.meter >= 100);
  $('#rounds').textContent = '●'.repeat(m.rounds || 0) + '○'.repeat(Math.max(0, 2 - (m.rounds || 0)));
  $('#vs').textContent = m.foe ? `vs ${m.foe} · ${m.timer}s` : '';
  if (m.result && !resultShown) {
    resultShown = true;
    $('#res-title').textContent = m.result === 'win' ? 'VITÓRIA!' : m.result === 'lose' ? 'DERROTA' : 'EMPATE';
    $('#res-sub').textContent = m.result === 'win' ? 'Ficas para a próxima luta.' : m.result === 'lose' ? 'Fica para a próxima! Podes trocar de lutador.' : '';
    $('#result').classList.remove('hidden');
    navigator.vibrate?.(m.result === 'win' ? [80, 60, 80, 60, 200] : 300);
  }
}

function setColor() {
  const c = ROSTER.find((r) => r.id === myChar)?.color || '#ffcf3a';
  document.documentElement.style.setProperty('--c', c);
}
function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id);
  if (id === 's-pad') goFullscreen();
  if (id === 's-select') { $('#result').classList.add('hidden'); animRoster(); }
}
function overlay(text) { const o = $('#overlay'); o.textContent = text || ''; o.classList.toggle('hidden', !text); }
async function goFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    await screen.orientation?.lock?.('landscape');
  } catch {}
  try { await navigator.wakeLock?.request('screen'); } catch {}
}

// ---------------- escolha de lutador (retratos desenhados com o mesmo código da TV) ----------------
const cards = [];
function renderRoster() {
  const box = $('#roster');
  if (!cards.length) {
    for (const r of ROSTER) {
      const el = document.createElement('div');
      el.className = 'card'; el.style.setProperty('--c', r.color);
      const cv = document.createElement('canvas'); cv.width = 220; cv.height = 230;
      el.appendChild(cv);
      el.insertAdjacentHTML('beforeend', `<b>${r.short}</b><span>${r.from}</span><span class="bio">${r.bio}</span>`);
      el.onclick = () => {
        myChar = r.id; store.set('furia.char', myChar); setColor();
        transport?.send({ t: 'char', char: r.id });
        navigator.vibrate?.(15);
        renderRoster();
      };
      box.appendChild(el);
      cards.push({ el, cv, r, f: { look: r.look, face: 1, x: 110, y: 0, pose: P.idle, vx: 0, vy: 0 } });
    }
  }
  for (const c of cards) c.el.classList.toggle('sel', c.r.id === myChar);
}
let animOn = false;
function animRoster() {
  if (animOn) return; animOn = true;
  let t = 0;
  const tick = () => {
    if ($('#s-select').classList.contains('hidden')) { animOn = false; return; }
    t++;
    for (const c of cards) {
      const sel = c.r.id === myChar;
      const k = (Math.sin(t * 0.08 + c.r.hp) + 1) / 2;
      c.f.pose = sel ? lerpPose(P.win, P.win2, (Math.sin(t * 0.15) + 1) / 2) : lerpPose(P.idle, P.idle2, k);
      const s = (c.r.look.size || 1) * 0.62;
      const J = skeleton(c.f.pose, s);
      updateTails(c.f, J, s, 0.5);
      const ctx = c.cv.getContext('2d');
      ctx.clearRect(0, 0, 220, 230);
      const g = ctx.createRadialGradient(110, 200, 10, 110, 200, 110);
      g.addColorStop(0, sel ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 220, 230);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(110, 218, 50, 8, 0, 0, Math.PI * 2); ctx.fill();
      drawFighter(ctx, { ...c.f, size: s }, { ground: 216, rim: '#ffffff' });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------------- entrar ----------------
if (STATIC_MODE) {
  $('#code-row').classList.add('hidden');
  if (LUTA.CAST_APP_ID === 'CHANGE_ME') $('#join-err').textContent = 'Este jogo ainda não tem a aplicação Chromecast registada (LUTA.CAST_APP_ID).';
}
$('#name').value = store.get('furia.name', store.get('ecos.name', ''));
$('#code').value = (params.get('room') || '').toUpperCase();
setColor();
renderRoster();

$('#btn-join').onclick = () => {
  const code = $('#code').value.trim().toUpperCase();
  const name = $('#name').value.trim() || 'Jogador';
  if (code.length !== 4) { $('#join-err').textContent = 'O código tem 4 letras (está na TV).'; return; }
  store.set('furia.name', name);
  $('#join-err').textContent = '';
  overlay('A ligar…');
  transport = new WSTransport(code, name, myChar, (m) => { overlay(null); onMessage(m); },
    () => overlay('Ligação perdida. Recarrega a página para voltar a entrar.'));
};
$('#btn-fight').onclick = () => { transport?.send({ t: 'start' }); navigator.vibrate?.(30); };
$('#st-prev').onclick = () => transport?.send({ t: 'stage', dir: -1 });
$('#st-next').onclick = () => transport?.send({ t: 'stage', dir: 1 });
$('#result').onclick = () => show('s-select');

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
if (LUTA.CAST_APP_ID !== 'CHANGE_ME') {
  window.__onGCastApiAvailable = (ok) => {
    if (!ok) return;
    const ctx = cast.framework.CastContext.getInstance();
    ctx.setOptions({ receiverApplicationId: LUTA.CAST_APP_ID, autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED });
    $('#btn-cast').classList.remove('hidden');
    const castInfo = () => {
      const st = ctx.getCastState();
      $('#cast-state').textContent = st === cast.framework.CastState.NO_DEVICES_AVAILABLE ? 'O telemóvel ainda não encontrou nenhum Chromecast nesta rede.'
        : st === cast.framework.CastState.CONNECTED ? 'Ligado ao Chromecast.' : 'Chromecast encontrado na rede.';
    };
    ctx.addEventListener(cast.framework.CastContextEventType.CAST_STATE_CHANGED, castInfo);
    castInfo();
    $('#btn-cast').onclick = async () => {
      $('#join-err').textContent = '';
      try {
        const err = await ctx.requestSession();
        if (err) throw err;
        const session = ctx.getCurrentSession();
        if (!session) throw 'sem sessão';
        const name = $('#name').value.trim() || 'Jogador';
        store.set('furia.name', name);
        transport = new CastTransport(session, name, myChar, onMessage);
        show('s-select');
      } catch (e) {
        const code = String(e?.code || e?.message || e);
        $('#join-err').textContent = castErrorText(code) + ` (código: ${code})`;
      }
    };
  };
  const s = document.createElement('script');
  s.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
  document.head.appendChild(s);
}

// ---------------- joystick e botões ----------------
const input = { x: 0, y: 0, b: 0 };
const zone = $('#stick-zone'), base = $('#stick-base'), knob = $('#stick-knob');
let stickId = null, origin = null;
const R = 62;
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
let lastDir = '';
function moveStick(e) {
  let dx = e.clientX - origin.x, dy = e.clientY - origin.y;
  const d = Math.hypot(dx, dy);
  if (d > R) { dx *= R / d; dy *= R / d; }
  knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  input.x = +(dx / R).toFixed(2);
  input.y = +(-dy / R).toFixed(2);
  // pequena vibração ao mudar de direção (ajuda a sentir o comando sem olhar)
  const dir = (input.y > 0.55 ? 'U' : input.y < -0.5 ? 'D' : '') + (input.x > 0.3 ? 'R' : input.x < -0.3 ? 'L' : '');
  if (dir !== lastDir) { lastDir = dir; if (dir) navigator.vibrate?.(6); }
  sendInput();
}
for (const btn of document.querySelectorAll('.pad')) {
  const bit = +btn.dataset.b;
  const down = (e) => { e.preventDefault(); btn.setPointerCapture?.(e.pointerId); input.b |= bit; btn.classList.add('down'); navigator.vibrate?.(10); sendInput(true); };
  const up = (e) => { e.preventDefault(); input.b &= ~bit; btn.classList.remove('down'); sendInput(true); };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

// envia quando muda (máx. ~60/s) e reenvia de 250 em 250 ms caso uma mensagem se perca
let last = '', lastT = 0, seq = 0, pending = false;
function sendInput(force) {
  if (!transport) return;
  const now = performance.now();
  const key = `${input.x},${input.y},${input.b}`;
  if (!force && (key === last || now - lastT < 16)) {
    if (key !== last && !pending) { pending = true; setTimeout(() => { pending = false; sendInput(); }, 17); }
    return;
  }
  last = key; lastT = now;
  transport.send({ t: 'in', x: input.x, y: input.y, b: input.b, s: seq++ });
}
setInterval(() => { last = ''; sendInput(true); }, 250);
setInterval(() => transport?.send({ t: 'ping', ts: performance.now() }), 2000);

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

// testes automáticos
window.__ctrl = { input, sendInput, press: (bit, on) => { if (on) input.b |= bit; else input.b &= ~bit; sendInput(true); } };
