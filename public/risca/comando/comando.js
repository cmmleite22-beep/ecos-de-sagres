// Comando do Risca e Arrisca: no telemóvel desenha-se (quando é a nossa vez) ou escrevem-se palpites.
// Dois transportes, como nos outros jogos: WebSocket (servidor de salas) ou canal Cast (Chromecast).
import { RISCA, wsUrl, STATIC_MODE } from '../config.js';
import { Quadro, CORES, TAMANHOS, BORRACHA, W, H } from '../quadro.js';
import { TEMA_LISTA, parseCustom } from '../palavras.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const params = new URLSearchParams(location.search);
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

let transport = null, myId = null, myName = '', st = null, lobby = null;

// ---------------- transportes ----------------
class WSTransport {
  constructor(code, name, onMsg, onClose) {
    this.ws = new WebSocket(wsUrl());
    this.ws.onopen = () => this.ws.send(JSON.stringify({ t: 'join', code, name }));
    this.ws.onmessage = (e) => { try { onMsg(JSON.parse(e.data)); } catch {} };
    this.ws.onclose = () => onClose?.();
  }
  send(m) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
}
class CastTransport {
  constructor(session, name, onMsg) {
    this.session = session;
    session.addMessageListener(RISCA.CAST_NAMESPACE, (_ns, data) => { try { onMsg(typeof data === 'string' ? JSON.parse(data) : data); } catch {} });
    this.send({ t: 'join', name });
    let tries = 0;
    this.retry = setInterval(() => { // se a TV ainda estava a carregar, voltar a pedir
      if (this.welcomed || ++tries > 10) { clearInterval(this.retry); return; }
      this.send({ t: 'join', name });
    }, 2000);
  }
  send(m) { this.session.sendMessage(RISCA.CAST_NAMESPACE, m).catch(() => {}); }
}
const send = (m) => transport?.send(m);

// ---------------- mensagens da TV ----------------
function onMessage(m) {
  switch (m.t) {
    case 'welcome':
      if (transport) transport.welcomed = true;
      myId = m.id; myName = m.name;
      document.documentElement.style.setProperty('--c', m.color);
      for (const el of $$('.me')) el.textContent = m.name;
      overlay(null);
      if (!st || st.phase === 'lobby') show('s-lobby');
      break;
    case 'lobby': lobby = m; renderLobby(); break;
    case 'st': onState(m); break;
    case 'res': onResult(m); break;
    case 'buzz': navigator.vibrate?.(m.ms || 40); break;
    case 'error': $('#join-err').textContent = m.reason; overlay(null); show('s-join'); break;
    case 'host-gone': overlay('A TV desligou-se. Volta a ler o código QR.'); break;
  }
}

function show(id) {
  for (const s of $$('.screen')) s.classList.toggle('hidden', s.id !== id);
  if (id === 's-draw') requestAnimationFrame(fitPad);
}
function overlay(text) { const o = $('#overlay'); o.textContent = text || ''; o.classList.toggle('hidden', !text); }

// relógio local (a TV diz quantos segundos faltam)
let clockEnd = 0;
setInterval(() => {
  const s = Math.max(0, Math.ceil((clockEnd - performance.now()) / 1000));
  for (const el of $$('.clock')) {
    el.textContent = clockEnd ? s + 's' : '';
    el.classList.toggle('low', st?.phase === 'draw' && s <= 10);
  }
}, 250);

let lastPhaseKey = '';
function onState(m) {
  const prev = st; st = m;
  clockEnd = m.phase === 'lobby' || m.phase === 'final' ? 0 : performance.now() + m.left * 1000;
  for (const el of $$('.pts')) el.textContent = `${m.score} pts · ${m.rank}.º`;
  const key = `${m.phase}|${m.round}|${m.drawer}`;
  const newPhase = key !== lastPhaseKey; lastPhaseKey = key;

  switch (m.phase) {
    case 'lobby': show('s-lobby'); renderLobby(); break;
    case 'choose':
      if (m.isDrawer) {
        if (newPhase) navigator.vibrate?.([60, 40, 60]);
        $('#choices').innerHTML = m.choices.map((c, i) => `
          <button class="l${c.lvl}" data-i="${i}"><b>${esc(c.w)}</b><span>${['', 'fácil', 'média', 'difícil'][c.lvl]}<br>${c.mult === 1 ? 'pontos normais' : '×' + String(c.mult).replace('.', ',') + ' pontos'}</span></button>`).join('');
        for (const b of $$('#choices button')) b.onclick = () => { send({ t: 'pick', i: +b.dataset.i }); navigator.vibrate?.(20); };
        show('s-choose');
      } else {
        msg('🤔', `${m.drawer} vai desenhar`, 'Está a escolher a palavra. Prepara-te para adivinhar!');
      }
      break;
    case 'draw':
      if (m.isDrawer) {
        if (newPhase) { quadro.reset(); strokeId++; }
        $('#d-word').textContent = m.word;
        $('#d-right').textContent = `${m.right}/${m.guessers} acertaram`;
        show('s-draw');
      } else {
        if (newPhase) { $('#g-list').innerHTML = ''; $('#g-fb').textContent = ''; $('#g-input').value = ''; }
        $('#g-who').innerHTML = `<b style="color:${m.drawerColor}">${esc(m.drawer)}</b> está a desenhar na TV`;
        $('#g-pattern').innerHTML = [...(m.guessed ? m.word : m.pattern)].map((ch) => ch === ' ' ? '<i></i>' : `<u>${ch === '_' ? '' : esc(ch.toUpperCase())}</u>`).join('');
        $('#g-form').classList.toggle('hidden', m.guessed);
        $('#g-fb').classList.toggle('hidden', m.guessed);
        $('#g-done').classList.toggle('hidden', !m.guessed);
        $('#g-gain').textContent = m.guessed ? `+${m.gain} pontos` : '';
        const wasHidden = $('#s-guess').classList.contains('hidden');
        show('s-guess');
        if (newPhase || wasHidden) navigator.vibrate?.(30);
      }
      break;
    case 'reveal': {
      const gain = m.gain ? `Ganhaste ${m.gain} pontos.` : m.isDrawer ? 'Desta vez ninguém acertou.' : 'Desta vez não deu.';
      msg(m.gain ? '⭐' : m.isDrawer ? '🎨' : '🙈', `A palavra era «${m.word}»`, gain);
      break;
    }
    case 'final': {
      const medal = ['🥇', '🥈', '🥉'][m.rank - 1];
      $('#f-emoji').textContent = medal || '🎨';
      $('#f-title').textContent = m.rank === 1 ? 'Ganhaste!' : `Ficaste em ${m.rank}.º lugar`;
      $('#f-top').innerHTML = (m.top || []).map((p) => `<li><b style="color:${p.color}">${esc(p.name)}</b> <span>${p.score} pts</span></li>`).join('');
      show('s-final');
      if (prev?.phase !== 'final') navigator.vibrate?.(m.rank === 1 ? [80, 60, 80, 60, 200] : 200);
      break;
    }
  }
}
function msg(emoji, title, text) {
  $('#msg-emoji').textContent = emoji; $('#msg-title').textContent = title; $('#msg-text').textContent = text;
  show('s-msg');
}

// ---------------- sala de espera ----------------
$('#o-theme').innerHTML = TEMA_LISTA.map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('');
function renderLobby() {
  if (!lobby) return;
  const me = lobby.leader === myId;
  $('#lp').innerHTML = lobby.players.map((p) => `<li class="${p.id === myId ? 'me' : ''}" style="--pc:${p.color}">${esc(p.name)}</li>`).join('');
  const s = lobby.settings;
  $('#opts').classList.toggle('ro', !me);
  $('#opts-who').textContent = me ? 'És o chefe da sala: escolhe as regras.' : 'Quem entrou primeiro escolhe as regras.';
  for (const [sel, v] of [['#o-rounds', s.rounds], ['#o-time', s.time], ['#o-theme', s.theme]]) {
    if (document.activeElement !== $(sel)) $(sel).value = String(v);
  }
  if (document.activeElement !== $('#o-custom')) $('#o-custom').value = s.custom || '';
  $('#custom-l').classList.toggle('hidden', !me && !s.custom);
  const n = lobby.players.length;
  $('#btn-start').disabled = n < RISCA.MIN_PLAYERS;
  $('#lobby-hint').textContent = n < RISCA.MIN_PLAYERS ? 'Espera por mais um jogador (são precisos pelo menos 2).' : `${n} jogadores prontos. Qualquer um pode começar.`;
}
function sendSettings() {
  if (!lobby || lobby.leader !== myId) return;
  let theme = $('#o-theme').value;
  const custom = $('#o-custom').value;
  if (theme === 'nossas' && parseCustom(custom).length < 3) {
    $('#lobby-hint').textContent = 'Escreve pelo menos 3 palavras para usar «As nossas palavras».';
  }
  send({ t: 'settings', rounds: +$('#o-rounds').value, time: +$('#o-time').value, theme, custom });
}
for (const id of ['#o-rounds', '#o-time', '#o-theme']) $(id).onchange = sendSettings;
$('#o-custom').onchange = sendSettings;
$('#o-custom').onblur = sendSettings;
$('#btn-start').onclick = () => { sendSettings(); send({ t: 'start' }); navigator.vibrate?.(30); };
$('#btn-again').onclick = () => send({ t: 'again' });

// ---------------- adivinhar ----------------
$('#g-form').onsubmit = (e) => {
  e.preventDefault();
  const v = $('#g-input').value.trim();
  if (!v) return;
  send({ t: 'guess', text: v });
  $('#g-input').value = '';
  $('#g-input').focus();
};
function onResult(m) {
  const fb = $('#g-fb');
  if (m.ok === 'yes') { fb.className = 'fb yes'; fb.textContent = 'Acertaste!'; return; }
  const li = document.createElement('li');
  li.textContent = m.text;
  if (m.ok === 'close') { li.className = 'close'; fb.className = 'fb close'; fb.textContent = `«${m.text}» — estás quase!`; navigator.vibrate?.([20, 30, 20]); }
  else { fb.className = 'fb no'; fb.textContent = `«${m.text}» não é.`; }
  const ul = $('#g-list'); ul.appendChild(li);
  while (ul.children.length > 6) ul.firstChild.remove();
}
let lastReact = 0;
$('#reacts').innerHTML = ['👏', '😂', '🤯', '🔥', '🎨', '❤️', '🤔', '😱'].map((e) => `<button>${e}</button>`).join('');
for (const b of $$('#reacts button')) {
  b.onclick = () => {
    const now = performance.now();
    if (now - lastReact < 700) return;
    lastReact = now; send({ t: 'react', e: b.textContent }); navigator.vibrate?.(8);
  };
}

// ---------------- desenhar ----------------
const pad = $('#pad');
const quadro = new Quadro(pad);
let color = CORES[0], size = TAMANHOS[1], tool = 'pen', strokeId = Math.floor(Math.random() * 1e6);
$('#colors').innerHTML = CORES.filter((c) => c !== BORRACHA).concat(['#ffffff']).map((c) => `<button style="background:${c}" data-c="${c}"></button>`).join('');
$('#sizes').innerHTML = TAMANHOS.map((s) => `<button data-s="${s}"><i style="width:${Math.min(34, s * 0.55 + 4)}px;height:${Math.min(34, s * 0.55 + 4)}px"></i></button>`).join('');
const selColor = () => { for (const b of $$('#colors button')) b.classList.toggle('sel', b.dataset.c === color && tool !== 'eraser'); };
const selSize = () => { for (const b of $$('#sizes button')) b.classList.toggle('sel', +b.dataset.s === size); };
const selTool = () => { for (const b of $$('.tool[data-tool]')) b.classList.toggle('sel', b.dataset.tool === tool); selColor(); };
for (const b of $$('#colors button')) b.onclick = () => { color = b.dataset.c; if (tool === 'eraser') tool = 'pen'; selTool(); };
for (const b of $$('#sizes button')) b.onclick = () => { size = +b.dataset.s; selSize(); };
for (const b of $$('.tool[data-tool]')) b.onclick = () => { tool = b.dataset.tool; selTool(); };
$('#t-undo').onclick = () => { flush(); quadro.undo(); send({ t: 'undo' }); };
$('#t-clear').onclick = () => { flush(); quadro.reset(); send({ t: 'clear' }); navigator.vibrate?.(20); };
$('#t-giveup').onclick = () => { if (confirmGiveup()) send({ t: 'giveup' }); };
let giveupAt = 0;
function confirmGiveup() { // carregar duas vezes (evita janelas de confirmação)
  const now = performance.now();
  if (now - giveupAt < 2500) return true;
  giveupAt = now; $('#t-giveup').textContent = 'Toca outra vez para desistir';
  setTimeout(() => { $('#t-giveup').textContent = 'Desistir deste desenho'; }, 2500);
  return false;
}
selTool(); selSize();

function fitPad() {
  const wrap = $('#pad-wrap'), body = $('#draw-body');
  const land = matchMedia('(orientation: landscape)').matches;
  const w = wrap.clientWidth, h = land ? wrap.clientHeight : body.clientHeight - $('#tools').offsetHeight - 10;
  if (!w || !h) return;
  const k = Math.min(w / W, h / H);
  pad.style.width = Math.floor(W * k - 6) + 'px';
  pad.style.height = Math.floor(H * k - 6) + 'px';
}
addEventListener('resize', fitPad);
screen.orientation?.addEventListener?.('change', () => setTimeout(fitPad, 200));

let drawing = null, buf = [], flushT = null;
const toXY = (e) => {
  const r = pad.getBoundingClientRect();
  return [Math.round((e.clientX - r.left) / r.width * W), Math.round((e.clientY - r.top) / r.height * H)];
};
pad.addEventListener('pointerdown', (e) => {
  if (drawing !== null || st?.phase !== 'draw' || !st.isDrawer) return;
  e.preventDefault();
  const [x, y] = toXY(e);
  if (tool === 'fill') { quadro.fill(x, y, color); send({ t: 'fill', x, y, c: color }); navigator.vibrate?.(15); return; }
  pad.setPointerCapture(e.pointerId);
  drawing = e.pointerId; strokeId++;
  addPoint(x, y);
});
pad.addEventListener('pointermove', (e) => {
  if (e.pointerId !== drawing) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of (evs.length ? evs : [e])) { const [x, y] = toXY(ev); addPoint(x, y); }
});
const endDraw = (e) => { if (e.pointerId !== drawing) return; drawing = null; flush(); };
pad.addEventListener('pointerup', endDraw);
pad.addEventListener('pointercancel', endDraw);
let lastPt = null;
function addPoint(x, y) {
  if (lastPt && buf.length && Math.abs(lastPt[0] - x) + Math.abs(lastPt[1] - y) < 2) return;
  lastPt = [x, y];
  const c = tool === 'eraser' ? BORRACHA : color, w = tool === 'eraser' ? Math.max(size, 22) : size;
  quadro.pen(strokeId, c, w, [x, y]);
  buf.push(x, y);
  if (!flushT) flushT = setTimeout(flush, 45);
}
function flush() {
  clearTimeout(flushT); flushT = null;
  if (!buf.length) return;
  const c = tool === 'eraser' ? BORRACHA : color, w = tool === 'eraser' ? Math.max(size, 22) : size;
  send({ t: 'pen', s: strokeId, c, w, p: buf });
  buf = [];
}

// ---------------- entrar ----------------
if (STATIC_MODE) {
  $('#code-row').classList.add('hidden');
  if (RISCA.CAST_APP_ID === 'CHANGE_ME') $('#join-err').textContent = 'Este jogo ainda não tem a aplicação Chromecast registada (RISCA.CAST_APP_ID).';
}
$('#name').value = store.get('risca.name', store.get('furia.name', store.get('ecos.name', '')));
$('#code').value = (params.get('room') || '').toUpperCase();

async function keepAwake() { try { await navigator.wakeLock?.request('screen'); } catch {} }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && transport) keepAwake(); });

$('#btn-join').onclick = () => {
  const code = $('#code').value.trim().toUpperCase();
  const name = $('#name').value.trim() || 'Jogador';
  if (code.length !== 4) { $('#join-err').textContent = 'O código tem 4 letras (está na TV).'; return; }
  store.set('risca.name', name);
  $('#join-err').textContent = '';
  overlay('A ligar…');
  keepAwake();
  transport = new WSTransport(code, name, onMessage, () => overlay('Ligação perdida. Recarrega a página para voltar a entrar.'));
};

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
if (RISCA.CAST_APP_ID !== 'CHANGE_ME') {
  window.__onGCastApiAvailable = (ok) => {
    if (!ok) return;
    const ctx = cast.framework.CastContext.getInstance();
    ctx.setOptions({ receiverApplicationId: RISCA.CAST_APP_ID, autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED });
    $('#btn-cast').classList.remove('hidden');
    const castInfo = () => {
      const s = ctx.getCastState();
      $('#cast-state').textContent = s === cast.framework.CastState.NO_DEVICES_AVAILABLE ? 'O telemóvel ainda não encontrou nenhum Chromecast nesta rede.'
        : s === cast.framework.CastState.CONNECTED ? 'Ligado ao Chromecast.' : 'Chromecast encontrado na rede.';
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
        store.set('risca.name', name);
        keepAwake();
        transport = new CastTransport(session, name, onMessage);
        overlay('A ligar à TV…');
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

setInterval(() => send({ t: 'ping', ts: performance.now() }), 4000);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

window.__ctrl = { quadro, get st() { return st; }, get lobby() { return lobby; } }; // testes automáticos
