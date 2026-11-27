// Comando do Risca e Arrisca: no telemóvel desenha-se (quando é a nossa vez) ou escrevem-se palpites.
// Dois transportes, como nos outros jogos: WebSocket (servidor de salas) ou canal Cast (Chromecast).
// Se a ligação cair (ecrã bloqueado, rede…), o telemóvel volta a entrar sozinho com o mesmo lugar.
import { RISCA, wsUrl, STATIC_MODE } from '../config.js';
import { Quadro, CORES, TAMANHOS, BORRACHA, W, H } from '../quadro.js';
import { temaLista, temasDe, parseCustom } from '../palavras.js';
import { LINGUAS, tr, traduzirPagina, detectarLingua, linguaValida, nomeLingua } from '../i18n.js';

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
// língua deste telemóvel (textos do comando); a língua do jogo (palavras e TV) escolhe-a o chefe da sala
let LANG = store.get('risca.lang', '');
if (!linguaValida(LANG)) LANG = detectarLingua();
const T = (k, v) => tr(LANG, k, v);

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
      overlay(T('c.lost'));
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
    case 'error': $('#join-err').textContent = m.code === 'full' ? T('c.full', { n: m.n }) : m.reason; overlay(null); transport?.stop?.(); transport = null; show('s-join'); break;
    case 'host-gone': transport?.stop?.(); overlay(T('c.tvGone')); break;
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
  const pts = m.mode === 'passa' ? '' : m.team ? `${T('team', { t: T('team' + m.team.i) })}: ${T('pts', { n: m.team.score })}` : T('c.ptsRank', { s: m.score, n: m.rank });
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
          <button class="l${c.lvl}" data-i="${i}"><b>${esc(c.w)}</b><span>${T('lvl' + c.lvl)}<br>${c.mult === 1 ? T('c.normalPts') : T('c.xPts', { m: /^pt|es|fr|de/.test(LANG) ? String(c.mult).replace('.', ',') : c.mult })}</span></button>`).join('');
        for (const b of $$('#choices button')) b.onclick = () => { send({ t: 'pick', i: +b.dataset.i }); navigator.vibrate?.(20); };
        show('s-choose');
      } else {
        msg('🤔', T('c.willDraw', { name: m.drawer }), T('c.choosingHint'));
      }
      break;
    case 'draw':
      if (m.isDrawer) {
        if (newPhase && prev?.phase !== 'draw') { quadro.reset(); strokeId++; }
        drawMode('turn');
        $('#d-word').textContent = m.word;
        $('#d-right').textContent = T('c.rightOf', { a: m.right, b: m.guessers });
        show('s-draw');
      } else {
        if (newPhase) { $('#g-list').innerHTML = ''; $('#g-fb').textContent = ''; $('#g-input').value = ''; renderOptions(m.options); }
        $('#g-who').innerHTML = T('c.isDrawing', { name: `<b style="color:${m.drawerColor}">${esc(m.drawer)}</b>` });
        $('#g-pattern').innerHTML = [...(m.guessed ? m.word : m.pattern)].map((ch) => ch === ' ' ? '<i></i>' : `<u>${ch === '_' ? '' : esc(ch.toUpperCase())}</u>`).join('');
        const kids = !!m.options && !m.guessed;
        $('#g-form').classList.toggle('hidden', m.guessed || kids);
        $('#g-options').classList.toggle('hidden', !kids);
        $('#g-fb').classList.toggle('hidden', m.guessed);
        $('#g-done').classList.toggle('hidden', !m.guessed);
        $('#g-gain').textContent = m.guessed ? T('c.plusPts', { n: m.gain }) : '';
        const wasHidden = $('#s-guess').classList.contains('hidden');
        show('s-guess');
        if (newPhase || wasHidden) navigator.vibrate?.(30);
      }
      break;
    case 'reveal': {
      const gain = m.gain ? T('c.gained', { n: m.gain }) : m.isDrawer ? T('c.nobodyGot') : T('c.notThisTime');
      msg(m.gain ? '⭐' : m.isDrawer ? '🎨' : '🙈', T('c.wordWas', { w: m.word }), gain);
      if (m.isDrawer && quadro.ops.length) { $('#msg-save').classList.remove('hidden'); lastWord = m.word; }
      break;
    }
    case 'vote': {
      $('#v-list').innerHTML = m.gallery.map((g) => `<button data-i="${g.i}" class="${m.voted === g.i ? 'sel' : ''}" ${g.mine ? 'disabled' : ''}>
        <span class="n">${g.i + 1}</span><span><b>${esc(g.word)}</b> · ${g.mine ? T('c.yours') : esc(T('c.by', { name: g.name }))}</span></button>`).join('');
      for (const b of $$('#v-list button')) b.onclick = () => { send({ t: 'vote', i: +b.dataset.i }); navigator.vibrate?.(15); };
      show('s-vote');
      break;
    }
    case 'final': {
      const passa = m.mode === 'passa';
      const medal = ['🥇', '🥈', '🥉'];
      if (passa) { $('#f-emoji').textContent = '🔄'; $('#f-title').textContent = T('passaEnd'); $('#f-top').innerHTML = ''; }
      else if (m.teams) {
        const pos = m.teams.findIndex((t) => t.i === m.team?.i);
        $('#f-emoji').textContent = medal[pos] || '🎨';
        $('#f-title').textContent = pos === 0 ? T('c.teamWon') : T('c.teamPlace', { n: pos + 1 });
        $('#f-top').innerHTML = m.teams.map((t) => `<li><b style="color:${t.color}">${esc(T('team', { t: T('team' + t.i) }))}</b> <span>${T('pts', { n: t.score })}</span></li>`).join('');
      } else {
        $('#f-emoji').textContent = medal[m.rank - 1] || '🎨';
        $('#f-title').textContent = m.rank === 1 ? T('c.won') : T('c.place', { n: m.rank });
        $('#f-top').innerHTML = (m.top || []).map((p) => `<li><b style="color:${p.color}">${esc(p.name)}</b> <span>${T('pts', { n: p.score })}</span></li>`).join('');
      }
      $('#f-gal-t').classList.toggle('hidden', !m.gallery?.length);
      $('#f-gal').innerHTML = (m.gallery || []).map((g) => `<button data-i="${g.i}">${g.gold ? '🏅' : '🖼️'}<span><b>${esc(g.word)}</b> · ${g.mine ? T('c.yoursShort') : esc(g.name)}</span>💾</button>`).join('');
      for (const b of $$('#f-gal button')) b.onclick = () => { send({ t: 'pic', i: +b.dataset.i }); b.lastChild.textContent = '⏳'; };
      show('s-final');
      if (prev?.phase !== 'final') navigator.vibrate?.(m.rank === 1 ? [80, 60, 80, 60, 200] : 200);
      break;
    }
    // ----- Passa o Risco -----
    case 'pdraw':
      if (!m.active) { msg('⏳', T('c.waitNext'), T('c.joinedMid')); break; }
      if (m.submitted) { msg('✅', T('c.delivered'), T('c.readyOf', { a: m.ready, b: m.total })); break; }
      if (newPhase) { quadro.reset(); strokeId++; navigator.vibrate?.([40, 30, 40]); }
      drawMode('passa');
      $('#d-word').textContent = m.prompt;
      $('#d-right').textContent = T('c.step', { a: m.step, b: m.steps });
      show('s-draw');
      break;
    case 'pguess':
      if (!m.active) { msg('⏳', T('c.waitNext'), T('c.joinedMid')); break; }
      if (newPhase) { $('#pg-input').value = ''; $('#pg-img').removeAttribute('src'); navigator.vibrate?.(40); }
      $('#pg-step').textContent = T('c.step', { a: m.step, b: m.steps });
      $('#pg-form').classList.toggle('hidden', m.submitted);
      $('#pg-done').classList.toggle('hidden', !m.submitted);
      show('s-pguess');
      break;
    case 'pshow':
      msg('📺', T('c.lookTV'), T('c.lookTVText'));
      if (m.leader) $('#msg-next').classList.remove('hidden');
      break;
  }
}
function msg(emoji, title, text) {
  $('#msg-emoji').textContent = emoji; $('#msg-title').textContent = title; $('#msg-text').textContent = text;
  show('s-msg');
}
$('#msg-next').onclick = () => send({ t: 'pnext' });

// ---------------- língua ----------------
$('#ui-lang').innerHTML = LINGUAS.map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join('');
$('#o-lang').innerHTML = LINGUAS.map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join('');
$('#ui-lang').value = LANG;
function applyLang() {
  traduzirPagina(LANG);
  $('#name').placeholder = T('c.player');
  renderThemes();
  renderLobby();
  renderSets();
  if (st && st.phase !== 'lobby') onState(st);
}
$('#ui-lang').onchange = () => { LANG = $('#ui-lang').value; store.set('risca.lang', LANG); applyLang(); };

// ---------------- categorias e conjuntos de palavras (guardados neste telemóvel) ----------------
// cats: categorias criadas aqui; sets: conjuntos de palavras, cada um ligado a um tema do jogo (ex.: 'animais')
// ou a uma categoria própria ('c:<id>'), e a uma língua.
const words = {
  load() {
    let d;
    try { d = JSON.parse(store.get('risca.cats', 'null')); } catch {}
    if (!d || !Array.isArray(d.cats) || !Array.isArray(d.sets)) {
      d = { cats: [], sets: [] };
      // listas guardadas pela versão anterior: passam a conjuntos de uma categoria «As minhas listas»
      try {
        const old = JSON.parse(store.get('risca.lists', '[]')) || [];
        if (old.length) {
          const id = 'm' + Date.now().toString(36);
          d.cats.push({ id, name: T('c.oldLists') });
          old.forEach((l, i) => d.sets.push({ id: id + i, cat: 'c:' + id, name: l.name, lang: 'pt', words: l.words }));
        }
      } catch {}
      this.save(d);
    }
    return d;
  },
  save(d) { store.set('risca.cats', JSON.stringify(d)); },
  newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },
  // palavras de um tema/categoria numa língua (juntando todos os conjuntos)
  of(cat, lang) { return parseCustom(this.load().sets.filter((x) => x.cat === cat && x.lang === lang).map((x) => x.words).join(',')); },
};

const gameLang = () => (linguaValida($('#o-lang').value) ? $('#o-lang').value : lobby?.settings?.lang || LANG);
const amLeader = () => !!lobby && lobby.leader === myId;
function renderThemes() {
  const lang = gameLang(), sel = $('#o-theme'), keep = sel.value;
  const d = words.load();
  const mine = amLeader() ? d.cats.map((c) => [`c:${c.id}`, `★ ${c.name} (${words.of('c:' + c.id, lang).length})`]) : [];
  const s = lobby?.settings;
  if (!amLeader() && s?.theme === 'propria') mine.push(['propria', `★ ${s.themeName || ''}`]);
  sel.innerHTML = `<optgroup label="${esc(T('c.gameThemes'))}"><option value="misto">${esc(tr(lang, 'misto'))}</option>`
    + temaLista(lang).map(([k, n]) => {
      const extra = amLeader() ? words.of(k, lang).length : 0;
      return `<option value="${k}">${esc(n)}${extra ? ` (+${extra})` : ''}</option>`;
    }).join('') + '</optgroup>'
    + (mine.length ? `<optgroup label="${esc(T('c.myCats'))}">${mine.map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</optgroup>` : '');
  if ([...sel.options].some((o) => o.value === keep)) sel.value = keep;
}

let autoLang = false;
function renderLobby() {
  if (!lobby) return;
  const me = amLeader();
  const s = lobby.settings;
  const teams = s.mode === 'equipas';
  // o chefe da sala joga na língua do seu telemóvel, a não ser que escolha outra
  if (me && !autoLang) {
    autoLang = true;
    if (s.lang !== LANG) { $('#o-lang').value = LANG; renderThemes(); sendSettings(); return; }
  }
  $('#lp').innerHTML = lobby.players.map((p) => `<li class="${p.id === myId ? 'me' : ''} ${p.online ? '' : 'off'}" style="--pc:${p.color}">${esc(p.name)}${teams ? `<span class="tm" style="--t:${lobby.teams[p.team]?.color}"></span>` : ''}</li>`).join('');
  $('#opts').classList.toggle('ro', !me);
  $('#opts-who').textContent = me ? T('c.youLead') : T('c.firstLeads');
  if (document.activeElement !== $('#o-lang')) $('#o-lang').value = s.lang;
  renderThemes();
  for (const [sel, v] of [['#o-rounds', s.rounds], ['#o-time', s.time], ['#o-mode', s.mode], ['#o-teams', s.teams]]) {
    if (document.activeElement !== $(sel)) $(sel).value = String(v);
  }
  // a categoria própria do chefe aparece na TV como 'propria'; no telemóvel do chefe fica a que ele escolheu aqui
  const th = $('#o-theme');
  if (document.activeElement !== th && !(me && th.dataset.mine)) th.value = s.theme;
  $('#o-kids').checked = !!s.kids;
  $('#mode-help').textContent = T('c.help.' + s.mode);
  $('#teams-l').classList.toggle('hidden', !teams);
  $('#rounds-l').classList.toggle('hidden', s.mode === 'passa');
  $('#kids-l').classList.toggle('hidden', s.mode === 'passa');
  $('#cat-open').classList.toggle('hidden', !me);
  if (!me) $('#cats').classList.add('hidden');
  themeInfo();
  // escolher equipa
  $('#team-pick').classList.toggle('hidden', !teams);
  if (teams) {
    const mine = lobby.players.find((p) => p.id === myId)?.team;
    $('#team-btns').innerHTML = lobby.teams.map((t, i) => `<button data-t="${i}" style="--t:${t.color}" class="${i === mine ? 'sel' : ''}">${esc(T('team' + i))}<br><small>${lobby.players.filter((p) => p.team === i).length}</small></button>`).join('');
    for (const b of $$('#team-btns button')) b.onclick = () => { send({ t: 'team', team: +b.dataset.t }); navigator.vibrate?.(10); };
  }
  const n = lobby.players.filter((p) => p.online).length;
  $('#btn-start').disabled = n < RISCA.MIN_PLAYERS;
  $('#lobby-hint').textContent = n < RISCA.MIN_PLAYERS ? T('c.waitOne') : s.mode === 'passa' && n < 3 ? T('c.passa3') : T('c.nReady', { n });
}
// por baixo do tema: quantas palavras próprias entram
function themeInfo() {
  const v = $('#o-theme').value, lang = gameLang();
  let txt = '';
  if (amLeader() && v.startsWith('c:')) {
    const c = words.load().cats.find((x) => 'c:' + x.id === v), n = words.of(v, lang).length;
    txt = n < 3 ? T('c.catNeeds3', { n: c?.name || '', lang: nomeLingua(lang) }) : T('c.nWords', { n });
  } else if (amLeader() && v !== 'misto') {
    const n = words.of(v, lang).length;
    if (n) txt = '+ ' + T('c.nWords', { n });
  } else if (!amLeader() && lobby?.settings?.custom) {
    const n = parseCustom(lobby.settings.custom).length;
    if (n) txt = (lobby.settings.theme === 'propria' ? '' : '+ ') + T('c.nWords', { n });
  }
  $('#theme-info').textContent = txt;
}
function sendSettings() {
  if (!amLeader()) return;
  const v = $('#o-theme').value, lang = gameLang();
  let theme = v, themeName = '', custom = [];
  if (v.startsWith('c:')) {
    theme = 'propria';
    themeName = words.load().cats.find((x) => 'c:' + x.id === v)?.name || '';
    custom = words.of(v, lang);
  } else if (v !== 'misto' && v !== 'propria') custom = words.of(v, lang);
  if (theme !== 'propria' && theme !== 'misto' && !temasDe(lang)[theme]) theme = 'misto';
  themeInfo();
  send({ t: 'settings', lang, rounds: +$('#o-rounds').value, time: +$('#o-time').value, theme, themeName, custom, mode: $('#o-mode').value, teams: +$('#o-teams').value, kids: $('#o-kids').checked });
}
for (const id of ['#o-rounds', '#o-time', '#o-mode', '#o-teams', '#o-kids']) $(id).onchange = sendSettings;
$('#o-theme').onchange = () => { $('#o-theme').dataset.mine = '1'; editing = null; sendSettings(); renderSets(); };
$('#o-lang').onchange = () => { renderThemes(); sendSettings(); renderSets(); };
$('#btn-start').onclick = () => { sendSettings(); send({ t: 'start' }); navigator.vibrate?.(30); };
$('#btn-again').onclick = () => send({ t: 'again' });

// gestor de categorias e conjuntos
let editing = null; // id do conjunto a editar, ou 'new'
$('#cat-open').onclick = () => { $('#cats').classList.toggle('hidden'); renderSets(); };
function renderSets() {
  if ($('#cats').classList.contains('hidden')) return;
  const v = $('#o-theme').value, lang = gameLang(), d = words.load();
  const own = v.startsWith('c:'), builtin = !!temasDe(lang)[v];
  const name = own ? d.cats.find((x) => 'c:' + x.id === v)?.name : builtin ? temasDe(lang)[v].nome : '';
  const usable = own || builtin;
  $('#sets-title').textContent = usable ? T('c.setsOf', { cat: name }) : '';
  $('#sets-info').textContent = !usable ? T('c.pickTheme')
    : (builtin ? T('c.builtIn', { n: temasDe(lang)[v].n.flat().length }) + ' ' : '') + T('c.inLang', { lang: nomeLingua(lang) });
  const sets = usable ? d.sets.filter((x) => x.cat === v && x.lang === lang) : [];
  $('#sets').innerHTML = usable && !sets.length ? `<li class="empty"><span>${esc(T('c.noSets'))}</span></li>`
    : sets.map((x) => `<li data-id="${x.id}"><span><b>${esc(x.name)}</b> <small>${esc(T('c.nWords', { n: parseCustom(x.words).length }))}</small></span>
      <button type="button" class="mini" data-act="edit">${esc(T('c.edit'))}</button><button type="button" class="mini danger" data-act="del">${esc(T('c.del'))}</button></li>`).join('');
  for (const b of $$('#sets button')) b.onclick = () => setAction(b.closest('li').dataset.id, b.dataset.act, b);
  $('#set-new').classList.toggle('hidden', !usable || editing !== null);
  $('#cat-del').classList.toggle('hidden', !own);
  $('#set-edit').classList.toggle('hidden', editing === null || !usable);
}
let delArm = null;
function armed(key, btn) { // carregar duas vezes para apagar (evita janelas de confirmação)
  if (delArm === key) { delArm = null; return true; }
  delArm = key; const old = btn.textContent; btn.textContent = T('c.delAgain');
  setTimeout(() => { if (delArm === key) delArm = null; if (btn.isConnected) btn.textContent = old; }, 2500);
  return false;
}
function setAction(id, act, btn) {
  const d = words.load(), x = d.sets.find((y) => y.id === id);
  if (!x) return;
  if (act === 'edit') {
    editing = id; $('#set-name').value = x.name; $('#set-words').value = x.words; renderSets(); $('#set-words').focus();
  } else if (act === 'del' && armed('set' + id, btn)) {
    d.sets = d.sets.filter((y) => y.id !== id); words.save(d);
    $('#lobby-hint').textContent = T('c.setDeleted', { n: x.name });
    renderThemes(); renderSets(); sendSettings();
  }
}
$('#set-new').onclick = () => { editing = 'new'; $('#set-name').value = ''; $('#set-words').value = ''; renderSets(); $('#set-name').focus(); };
$('#set-cancel').onclick = () => { editing = null; renderSets(); };
$('#set-save').onclick = () => {
  const text = $('#set-words').value.trim(), v = $('#o-theme').value, lang = gameLang();
  if (parseCustom(text).length < 3) { $('#lobby-hint').textContent = T('c.need3'); return; }
  const d = words.load();
  const name = $('#set-name').value.trim() || T('c.set', { n: d.sets.filter((x) => x.cat === v).length + 1 });
  const x = editing !== 'new' && d.sets.find((y) => y.id === editing);
  if (x) Object.assign(x, { name, words: text });
  else d.sets.push({ id: words.newId(), cat: v, name, lang, words: text });
  words.save(d); editing = null;
  $('#lobby-hint').textContent = T('c.setSaved', { n: name });
  renderThemes(); renderSets(); sendSettings();
};
$('#cat-add').onclick = () => {
  const name = $('#cat-name').value.trim();
  if (!name) { $('#cat-name').focus(); return; }
  const d = words.load(), id = words.newId();
  d.cats.push({ id, name }); words.save(d);
  $('#cat-name').value = '';
  renderThemes(); $('#o-theme').value = 'c:' + id; $('#o-theme').dataset.mine = '1';
  editing = 'new'; $('#set-name').value = ''; $('#set-words').value = '';
  renderSets(); sendSettings();
  $('#lobby-hint').textContent = T('c.catCreated', { n: name });
  $('#set-words').focus();
};
$('#cat-del').onclick = () => {
  const v = $('#o-theme').value;
  if (!v.startsWith('c:') || !armed('cat' + v, $('#cat-del'))) return;
  const d = words.load(), c = d.cats.find((x) => 'c:' + x.id === v);
  d.cats = d.cats.filter((x) => 'c:' + x.id !== v); d.sets = d.sets.filter((x) => x.cat !== v); words.save(d);
  $('#lobby-hint').textContent = T('c.catDeleted', { n: c?.name || '' });
  editing = null; renderThemes(); $('#o-theme').value = 'misto'; renderSets(); sendSettings();
};
words.load(); // migra listas antigas logo ao abrir
renderThemes();

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
  if (m.ok === 'yes') { fb.className = 'fb yes'; fb.textContent = T('c.gotIt'); return; }
  if (st?.options) { // modo pequenos: risca a opção errada e espera 3 segundos
    for (const b of $$('#g-options button')) if (b.textContent === m.text) b.disabled = true;
    lockUntil = performance.now() + 3000;
    fb.className = 'fb no'; fb.textContent = T('c.notIt');
    navigator.vibrate?.(200);
    setTimeout(() => { if (fb.textContent === T('c.notIt')) fb.textContent = T('c.tryAnother'); }, 3000);
    return;
  }
  const li = document.createElement('li');
  li.textContent = m.text;
  if (m.ok === 'close') { li.className = 'close'; fb.className = 'fb close'; fb.textContent = T('c.almost', { w: m.text }); navigator.vibrate?.([20, 30, 20]); }
  else { fb.className = 'fb no'; fb.textContent = T('c.no', { w: m.text }); }
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
$('#msg-save').onclick = () => { savePic(pad.toDataURL('image/png'), lastWord); $('#msg-save').textContent = T('c.saved'); };

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
  giveupAt = now; $('#t-giveup').textContent = T('c.giveup2');
  setTimeout(() => { $('#t-giveup').textContent = T('c.giveup'); }, 2500);
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
applyLang();
if (STATIC_MODE) {
  $('#code-row').classList.add('hidden');
  if (RISCA.CAST_APP_ID === 'CHANGE_ME') $('#join-err').textContent = T('c.noCastApp');
}
$('#name').value = store.get('risca.name', store.get('furia.name', store.get('ecos.name', '')));
$('#code').value = (params.get('room') || '').toUpperCase();

let wakeLock = null;
async function keepAwake() { try { if (!wakeLock || wakeLock.released) wakeLock = await navigator.wakeLock?.request('screen'); } catch {} }

function joinWS(code, name) {
  store.set('risca.name', name);
  store.set('risca.last', JSON.stringify({ code, t: Date.now() }));
  $('#join-err').textContent = '';
  overlay(T('c.connecting'));
  keepAwake();
  transport = new WSTransport(code, name, onMessage);
}
$('#btn-join').onclick = () => {
  const code = $('#code').value.trim().toUpperCase();
  const name = $('#name').value.trim() || T('c.player');
  if (code.length !== 4) { $('#join-err').textContent = T('c.codeLen'); return; }
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
    case 'cancel': return T('c.castCancel');
    case 'receiver_unavailable': return T('c.castUnavailable');
    case 'timeout': return T('c.castTimeout');
    case 'session_error': return T('c.castSession');
    case 'extension_missing': case 'api_not_initialized': return T('c.castBrowser');
    default: return T('c.castFail');
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
      $('#cast-state').textContent = s === cast.framework.CastState.NO_DEVICES_AVAILABLE ? T('c.castNone')
        : s === cast.framework.CastState.CONNECTED ? T('c.castOn') : T('c.castFound');
    };
    ctx.addEventListener(cast.framework.CastContextEventType.CAST_STATE_CHANGED, castInfo);
    castInfo();
    const startCast = (session) => {
      const name = $('#name').value.trim() || store.get('risca.name', '') || T('c.player');
      store.set('risca.name', name);
      keepAwake();
      transport?.stop?.();
      transport = new CastTransport(session, name, onMessage);
      overlay(T('c.connectingTV'));
    };
    // página recarregada com a sessão Cast ainda aberta: volta a entrar sozinho
    ctx.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, (e) => {
      if (e.sessionState === cast.framework.SessionState.SESSION_RESUMED && !transport) startCast(ctx.getCurrentSession());
      if (e.sessionState === cast.framework.SessionState.SESSION_ENDED && transport instanceof CastTransport) {
        transport = null; overlay(null); show('s-join'); $('#join-err').textContent = T('c.castEnded');
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
        $('#join-err').textContent = castErrorText(code) + ' ' + T('c.castCode', { c: code });
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
