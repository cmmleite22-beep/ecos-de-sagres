// Comando do Risca e Arrisca: no telemóvel desenha-se (quando é a nossa vez) ou escrevem-se palpites.
// Dois transportes, como nos outros jogos: WebSocket (servidor de salas) ou canal Cast (Chromecast).
// Se a ligação cair (ecrã bloqueado, rede…), o telemóvel volta a entrar sozinho com o mesmo lugar.
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
// identificador deste telemóvel: é o que permite voltar ao mesmo lugar depois de perder a ligação
let KEY = store.get('risca.key', '');
if (!KEY) { KEY = Math.random().toString(36).slice(2) + Date.now().toString(36); store.set('risca.key', KEY); }

let transport = null, myId = null, myName = '', st = null, lobby = null;

// ---------------- transportes ----------------
class WSTransport {
  constructor(code, name, onMsg) {
    this.code = code; this.name = name; this.onMsg = onMsg; this.tries = 0; this.dead = false;
    this.connect();
  }
  connect() {
    const ws = this.ws = new WebSocket(wsUrl());
    ws.onopen = () => { this.tries = 0; ws.send(JSON.stringify({ t: 'join', code: this.code, name: this.name, key: KEY })); };
    ws.onmessage = (e) => { try { this.onMsg(JSON.parse(e.data)); } catch {} };
    ws.onclose = () => {
      if (this.dead || this.ws !== ws) return;
      overlay('Ligação perdida. A voltar a entrar…');
      setTimeout(() => this.reconnect(), Math.min(5000, 800 * ++this.tries));
    };
  }
  reconnect() { if (!this.dead && (!this.ws || this.ws.readyState > 1)) this.connect(); }
  send(m) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  stop() { this.dead = true; try { this.ws.close(); } catch {} }
}
class CastTransport {
  constructor(session, name, onMsg) {
    this.session = session;
    session.addMessageListener(RISCA.CAST_NAMESPACE, (_ns, data) => { try { onMsg(typeof data === 'string' ? JSON.parse(data) : data); } catch {} });
    this.send({ t: 'join', name, key: KEY });
    let tries = 0;
    this.retry = setInterval(() => { // se a TV ainda estava a carregar, voltar a pedir
      if (this.welcomed || ++tries > 10) { clearInterval(this.retry); return; }
      this.send({ t: 'join', name, key: KEY });
    }, 2000);
  }
  send(m) { this.session.sendMessage(RISCA.CAST_NAMESPACE, m).catch(() => {}); }
  reconnect() { this.send({ t: 'join', name: myName, key: KEY }); }
  stop() { clearInterval(this.retry); }
}
const send = (m) => transport?.send(m);

// ao voltar ao ecrã (depois de bloquear o telemóvel), confirmar que continuamos ligados
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !transport) return;
  keepAwake();
  transport.reconnect();
});

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
    case 'sync': // desenho que já estava feito antes de perdermos a ligação
      if (m.first) quadro.reset();
      for (const op of m.ops) { if (op.k === 's') quadro.pen(op.s, op.c, op.w, op.p); else if (op.k === 'f') quadro.fill(op.x, op.y, op.c); }
      quadro.cur = null;
      break;
    case 'pimg': $('#pg-img').src = m.url; break;
    case 'pic': savePic(m.url, m.word); break;
    case 'buzz': navigator.vibrate?.(m.ms || 40); break;
    case 'error': $('#join-err').textContent = m.reason; overlay(null); transport?.stop?.(); transport = null; show('s-join'); break;
    case 'host-gone': transport?.stop?.(); overlay('A TV desligou-se. Volta a ler o código QR.'); break;
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
    el.classList.toggle('low', /draw|pguess/.test(st?.phase) && s <= 10);
  }
}, 250);

let lastPhaseKey = '';
function onState(m) {
  const prev = st; st = m;
  clockEnd = ['lobby', 'final', 'pshow'].includes(m.phase) || !m.left ? 0 : performance.now() + m.left * 1000;
  const pts = m.mode === 'passa' ? '' : m.team ? `Equipa ${m.team.name}: ${m.team.score} pts` : `${m.score} pts · ${m.rank}.º`;
  for (const el of $$('.pts')) el.textContent = pts;
  const key = `${m.phase}|${m.round}|${m.drawer}|${m.step}`;
  const newPhase = key !== lastPhaseKey; lastPhaseKey = key;
  $('#msg-save').classList.add('hidden');
  $('#msg-next').classList.add('hidden');

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
        if (newPhase && prev?.phase !== 'draw') { quadro.reset(); strokeId++; }
        drawMode('turn');
        $('#d-word').textContent = m.word;
        $('#d-right').textContent = `${m.right}/${m.guessers} acertaram`;
        show('s-draw');
      } else {
        if (newPhase) { $('#g-list').innerHTML = ''; $('#g-fb').textContent = ''; $('#g-input').value = ''; renderOptions(m.options); }
        $('#g-who').innerHTML = `<b style="color:${m.drawerColor}">${esc(m.drawer)}</b> está a desenhar na TV`;
        $('#g-pattern').innerHTML = [...(m.guessed ? m.word : m.pattern)].map((ch) => ch === ' ' ? '<i></i>' : `<u>${ch === '_' ? '' : esc(ch.toUpperCase())}</u>`).join('');
        const kids = !!m.options && !m.guessed;
        $('#g-form').classList.toggle('hidden', m.guessed || kids);
        $('#g-options').classList.toggle('hidden', !kids);
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
      if (m.isDrawer && quadro.ops.length) { $('#msg-save').classList.remove('hidden'); lastWord = m.word; }
      break;
    }
    case 'vote': {
      $('#v-list').innerHTML = m.gallery.map((g) => `<button data-i="${g.i}" class="${m.voted === g.i ? 'sel' : ''}" ${g.mine ? 'disabled' : ''}>
        <span class="n">${g.i + 1}</span><span><b>${esc(g.word)}</b> · ${g.mine ? 'é teu' : 'por ' + esc(g.name)}</span></button>`).join('');
      for (const b of $$('#v-list button')) b.onclick = () => { send({ t: 'vote', i: +b.dataset.i }); navigator.vibrate?.(15); };
      show('s-vote');
      break;
    }
    case 'final': {
      const passa = m.mode === 'passa';
      const medal = ['🥇', '🥈', '🥉'];
      if (passa) { $('#f-emoji').textContent = '🔄'; $('#f-title').textContent = 'Fim do Passa o Risco!'; $('#f-top').innerHTML = ''; }
      else if (m.teams) {
        const pos = m.teams.findIndex((t) => t.name === m.team?.name);
        $('#f-emoji').textContent = medal[pos] || '🎨';
        $('#f-title').textContent = pos === 0 ? 'A tua equipa ganhou!' : `A tua equipa ficou em ${pos + 1}.º`;
        $('#f-top').innerHTML = m.teams.map((t) => `<li><b style="color:${t.color}">Equipa ${esc(t.name)}</b> <span>${t.score} pts</span></li>`).join('');
      } else {
        $('#f-emoji').textContent = medal[m.rank - 1] || '🎨';
        $('#f-title').textContent = m.rank === 1 ? 'Ganhaste!' : `Ficaste em ${m.rank}.º lugar`;
        $('#f-top').innerHTML = (m.top || []).map((p) => `<li><b style="color:${p.color}">${esc(p.name)}</b> <span>${p.score} pts</span></li>`).join('');
      }
      $('#f-gal-t').classList.toggle('hidden', !m.gallery?.length);
      $('#f-gal').innerHTML = (m.gallery || []).map((g) => `<button data-i="${g.i}">${g.gold ? '🏅' : '🖼️'}<span><b>${esc(g.word)}</b> · ${g.mine ? 'teu' : esc(g.name)}</span>💾</button>`).join('');
      for (const b of $$('#f-gal button')) b.onclick = () => { send({ t: 'pic', i: +b.dataset.i }); b.lastChild.textContent = '⏳'; };
      show('s-final');
      if (prev?.phase !== 'final') navigator.vibrate?.(m.rank === 1 ? [80, 60, 80, 60, 200] : 200);
      break;
    }
    // ----- Passa o Risco -----
    case 'pdraw':
      if (!m.active) { msg('⏳', 'Espera pela próxima', 'Entraste a meio: vais jogar na próxima partida.'); break; }
      if (m.submitted) { msg('✅', 'Desenho entregue!', `Já estão prontos ${m.ready} de ${m.total}. Espera pelos outros…`); break; }
      if (newPhase) { quadro.reset(); strokeId++; navigator.vibrate?.([40, 30, 40]); }
      drawMode('passa');
      $('#d-word').textContent = m.prompt;
      $('#d-right').textContent = `passo ${m.step}/${m.steps}`;
      show('s-draw');
      break;
    case 'pguess':
      if (!m.active) { msg('⏳', 'Espera pela próxima', 'Entraste a meio: vais jogar na próxima partida.'); break; }
      if (newPhase) { $('#pg-input').value = ''; $('#pg-img').removeAttribute('src'); navigator.vibrate?.(40); }
      $('#pg-step').textContent = `passo ${m.step}/${m.steps}`;
      $('#pg-form').classList.toggle('hidden', m.submitted);
      $('#pg-done').classList.toggle('hidden', !m.submitted);
      show('s-pguess');
      break;
    case 'pshow':
      msg('📺', 'Olhem para a TV!', 'Vejam como cada palavra se foi transformando.');
      if (m.leader) $('#msg-next').classList.remove('hidden');
      break;
  }
}
function msg(emoji, title, text) {
  $('#msg-emoji').textContent = emoji; $('#msg-title').textContent = title; $('#msg-text').textContent = text;
  show('s-msg');
}
$('#msg-next').onclick = () => send({ t: 'pnext' });

// ---------------- sala de espera ----------------
const MODE_HELP = {
  classico: 'À vez, um desenha e os outros adivinham. Ganha quem tiver mais pontos.',
  equipas: 'Igual ao clássico, mas os pontos somam por equipa. Cada equipa pode ter um ou vários telemóveis.',
  passa: 'Todos desenham ao mesmo tempo e os desenhos vão passando: desenho → palpite → desenho… No fim vê-se na TV como cada palavra mudou.',
};
$('#o-theme').innerHTML = TEMA_LISTA.map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('');
function renderLobby() {
  if (!lobby) return;
  const me = lobby.leader === myId;
  const s = lobby.settings;
  const teams = s.mode === 'equipas';
  $('#lp').innerHTML = lobby.players.map((p) => `<li class="${p.id === myId ? 'me' : ''} ${p.online ? '' : 'off'}" style="--pc:${p.color}">${esc(p.name)}${teams ? `<span class="tm" style="--t:${lobby.teams[p.team]?.color}"></span>` : ''}</li>`).join('');
  $('#opts').classList.toggle('ro', !me);
  $('#opts-who').textContent = me ? 'És o chefe da sala: escolhe as regras.' : 'Quem entrou primeiro escolhe as regras.';
  for (const [sel, v] of [['#o-rounds', s.rounds], ['#o-time', s.time], ['#o-theme', s.theme], ['#o-mode', s.mode], ['#o-teams', s.teams]]) {
    if (document.activeElement !== $(sel)) $(sel).value = String(v);
  }
  $('#o-kids').checked = !!s.kids;
  if (document.activeElement !== $('#o-custom')) $('#o-custom').value = s.custom || '';
  $('#mode-help').textContent = MODE_HELP[s.mode] || '';
  $('#teams-l').classList.toggle('hidden', !teams);
  $('#rounds-l').classList.toggle('hidden', s.mode === 'passa');
  $('#kids-l').classList.toggle('hidden', s.mode === 'passa');
  $('#custom-l').classList.toggle('hidden', !me && !s.custom);
  $('#o-lists').parentElement.querySelector('.list-row').classList.toggle('hidden', !me);
  $('#o-lists').classList.toggle('hidden', !me);
  // escolher equipa
  $('#team-pick').classList.toggle('hidden', !teams);
  if (teams) {
    const mine = lobby.players.find((p) => p.id === myId)?.team;
    $('#team-btns').innerHTML = lobby.teams.map((t, i) => `<button data-t="${i}" style="--t:${t.color}" class="${i === mine ? 'sel' : ''}">${esc(t.name)}<br><small>${lobby.players.filter((p) => p.team === i).length}</small></button>`).join('');
    for (const b of $$('#team-btns button')) b.onclick = () => { send({ t: 'team', team: +b.dataset.t }); navigator.vibrate?.(10); };
  }
  const n = lobby.players.filter((p) => p.online).length;
  $('#btn-start').disabled = n < RISCA.MIN_PLAYERS;
  $('#lobby-hint').textContent = n < RISCA.MIN_PLAYERS ? 'Espera por mais um jogador (são precisos pelo menos 2).'
    : s.mode === 'passa' && n < 3 ? 'O Passa o Risco fica mais divertido com 3 ou mais pessoas.' : `${n} jogadores prontos. Qualquer um pode começar.`;
}
function sendSettings() {
  if (!lobby || lobby.leader !== myId) return;
  const theme = $('#o-theme').value;
  const custom = $('#o-custom').value;
  if (theme === 'nossas' && parseCustom(custom).length < 3) $('#lobby-hint').textContent = 'Escreve pelo menos 3 palavras para usar «As nossas palavras».';
  send({ t: 'settings', rounds: +$('#o-rounds').value, time: +$('#o-time').value, theme, custom, mode: $('#o-mode').value, teams: +$('#o-teams').value, kids: $('#o-kids').checked });
}
for (const id of ['#o-rounds', '#o-time', '#o-theme', '#o-mode', '#o-teams', '#o-kids']) $(id).onchange = sendSettings;
$('#o-custom').onchange = sendSettings;
$('#o-custom').onblur = sendSettings;
$('#btn-start').onclick = () => { sendSettings(); send({ t: 'start' }); navigator.vibrate?.(30); };
$('#btn-again').onclick = () => send({ t: 'again' });

// listas de palavras guardadas neste telemóvel
const lists = {
  all() { try { return JSON.parse(store.get('risca.lists', '[]')) || []; } catch { return []; } },
  save(arr) { store.set('risca.lists', JSON.stringify(arr)); },
};
function renderLists(sel = '') {
  $('#o-lists').innerHTML = '<option value="">— listas guardadas neste telemóvel —</option>'
    + lists.all().map((l, i) => `<option value="${i}" ${String(i) === sel ? 'selected' : ''}>${esc(l.name)} (${parseCustom(l.words).length})</option>`).join('');
}
renderLists();
$('#o-lists').onchange = () => {
  const l = lists.all()[+$('#o-lists').value];
  if (!l) return;
  $('#o-custom').value = l.words; $('#o-listname').value = l.name;
  $('#o-theme').value = 'nossas';
  sendSettings();
};
$('#list-save').onclick = () => {
  const words = $('#o-custom').value.trim();
  const name = $('#o-listname').value.trim() || `Lista ${lists.all().length + 1}`;
  if (parseCustom(words).length < 3) { $('#lobby-hint').textContent = 'A lista precisa de pelo menos 3 palavras.'; return; }
  const all = lists.all();
  const i = all.findIndex((l) => l.name.toLowerCase() === name.toLowerCase());
  if (i >= 0) all[i] = { name, words }; else all.push({ name, words });
  lists.save(all); renderLists(String(i >= 0 ? i : all.length - 1));
  $('#lobby-hint').textContent = `Lista «${name}» guardada neste telemóvel.`;
};
$('#list-del').onclick = () => {
  const i = +$('#o-lists').value;
  if ($('#o-lists').value === '') return;
  const all = lists.all(); const [gone] = all.splice(i, 1); lists.save(all); renderLists();
  $('#lobby-hint').textContent = `Lista «${gone.name}» apagada.`;
};

// ---------------- adivinhar ----------------
$('#g-form').onsubmit = (e) => {
  e.preventDefault();
  const v = $('#g-input').value.trim();
  if (!v) return;
  send({ t: 'guess', text: v });
  $('#g-input').value = '';
  $('#g-input').focus();
};
let lockUntil = 0;
function renderOptions(opts) {
  $('#g-options').innerHTML = (opts || []).map((o) => `<button>${esc(o)}</button>`).join('');
  for (const b of $$('#g-options button')) {
    b.onclick = () => {
      if (performance.now() < lockUntil) return;
      send({ t: 'guess', text: b.textContent }); navigator.vibrate?.(15);
    };
  }
}
function onResult(m) {
  const fb = $('#g-fb');
  if (m.ok === 'yes') { fb.className = 'fb yes'; fb.textContent = 'Acertaste!'; return; }
  if (st?.options) { // modo pequenos: risca a opção errada e espera 3 segundos
    for (const b of $$('#g-options button')) if (b.textContent === m.text) b.disabled = true;
    lockUntil = performance.now() + 3000;
    fb.className = 'fb no'; fb.textContent = 'Não é essa! Espera um bocadinho…';
    navigator.vibrate?.(200);
    setTimeout(() => { if (fb.textContent.startsWith('Não é essa')) fb.textContent = 'Tenta outra!'; }, 3000);
    return;
  }
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

// Passa o Risco: palpite sobre o desenho recebido
$('#pg-form').onsubmit = (e) => {
  e.preventDefault();
  const v = $('#pg-input').value.trim();
  if (!v) return;
  send({ t: 'ptext', text: v });
  $('#pg-input').blur();
};

// ---------------- guardar desenhos ----------------
let lastWord = '';
function savePic(url, word) {
  const [head, b64] = url.split(',');
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blobUrl = URL.createObjectURL(new Blob([bytes], { type: head.slice(5, head.indexOf(';')) }));
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = `risca-e-arrisca-${String(word || 'desenho').replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.${url.startsWith('data:image/png') ? 'png' : 'jpg'}`;
  document.body.appendChild(a); a.click(); a.remove();
  for (const b of $$('#f-gal button')) if (b.lastChild.textContent === '⏳') b.lastChild.textContent = '✅';
}
$('#msg-save').onclick = () => { savePic(pad.toDataURL('image/png'), lastWord); $('#msg-save').textContent = '✅ Guardado'; };

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
$('#t-done').onclick = () => { flush(); send({ t: 'pdone' }); navigator.vibrate?.(30); };
let giveupAt = 0;
function confirmGiveup() { // carregar duas vezes (evita janelas de confirmação)
  const now = performance.now();
  if (now - giveupAt < 2500) return true;
  giveupAt = now; $('#t-giveup').textContent = 'Toca outra vez para desistir';
  setTimeout(() => { $('#t-giveup').textContent = 'Desistir deste desenho'; }, 2500);
  return false;
}
function drawMode(kind) { // 'turn' = vez normal; 'passa' = Passa o Risco
  $('#t-giveup').classList.toggle('hidden', kind !== 'turn');
  $('#t-done').classList.toggle('hidden', kind !== 'passa');
}
const canDraw = () => (st?.phase === 'draw' && st.isDrawer) || (st?.phase === 'pdraw' && st.active && !st.submitted);
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
  if (drawing !== null || !canDraw()) return;
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

let wakeLock = null;
async function keepAwake() { try { if (!wakeLock || wakeLock.released) wakeLock = await navigator.wakeLock?.request('screen'); } catch {} }

function joinWS(code, name) {
  store.set('risca.name', name);
  store.set('risca.last', JSON.stringify({ code, t: Date.now() }));
  $('#join-err').textContent = '';
  overlay('A ligar…');
  keepAwake();
  transport = new WSTransport(code, name, onMessage);
}
$('#btn-join').onclick = () => {
  const code = $('#code').value.trim().toUpperCase();
  const name = $('#name').value.trim() || 'Jogador';
  if (code.length !== 4) { $('#join-err').textContent = 'O código tem 4 letras (está na TV).'; return; }
  joinWS(code, name);
};
// página recarregada a meio de um jogo (mesma sala, há menos de 15 minutos): volta a entrar sozinho
try {
  const last = JSON.parse(store.get('risca.last', 'null'));
  const code = $('#code').value.trim().toUpperCase();
  if (!STATIC_MODE && last && code && last.code === code && Date.now() - last.t < 15 * 60 * 1000 && store.get('risca.name', '')) joinWS(code, store.get('risca.name', ''));
} catch {}

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
    const startCast = (session) => {
      const name = $('#name').value.trim() || store.get('risca.name', '') || 'Jogador';
      store.set('risca.name', name);
      keepAwake();
      transport?.stop?.();
      transport = new CastTransport(session, name, onMessage);
      overlay('A ligar à TV…');
    };
    // página recarregada com a sessão Cast ainda aberta: volta a entrar sozinho
    ctx.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, (e) => {
      if (e.sessionState === cast.framework.SessionState.SESSION_RESUMED && !transport) startCast(ctx.getCurrentSession());
      if (e.sessionState === cast.framework.SessionState.SESSION_ENDED && transport instanceof CastTransport) {
        transport = null; overlay(null); show('s-join'); $('#join-err').textContent = 'A ligação ao Chromecast terminou. Toca em Ligar ao Chromecast para voltar.';
      }
    });
    $('#btn-cast').onclick = async () => {
      $('#join-err').textContent = '';
      try {
        const err = await ctx.requestSession();
        if (err) throw err;
        const session = ctx.getCurrentSession();
        if (!session) throw 'sem sessão';
        startCast(session);
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

window.__ctrl = { quadro, get st() { return st; }, get lobby() { return lobby; }, get transport() { return transport; } }; // testes automáticos
