// Risca e Arrisca — regras do jogo e ecrã da TV.
// A TV manda em tudo: escolhe quem desenha, guarda a palavra secreta, compara os palpites e dá os pontos.
import { RISCA, STATIC_MODE } from '../config.js';
import { Quadro, paint, W, H } from '../quadro.js';
import { escolher, comparar, padrao, parseCustom, norm, NIVEL, TEMA_LISTA } from '../palavras.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLORS = ['#e23b3b', '#2457d6', '#2f9e44', '#ff8a1f', '#8a3fd1', '#e8559a', '#14a3a3', '#c79a00', '#8a5a2b', '#5a6b7a'];
const CHOOSE_S = 15, REVEAL_S = 7, FINAL_S = 40;
const REACTS = ['👏', '😂', '🤯', '🔥', '🎨', '❤️', '🤔', '😱'];

export class Jogo {
  constructor(net, som) {
    this.net = net; this.som = som;
    this.players = new Map(); // id -> { id, name, color, score, guessed, gain }
    this.order = [];
    this.ghosts = new Map();  // nome -> pontos de quem saiu a meio (volta a entrar com os mesmos pontos)
    this.settings = { rounds: 3, time: 80, theme: 'misto', custom: [] };
    this.phase = 'lobby';
    this.round = 0; this.queue = []; this.turn = null;
    this.used = new Set(); this.gallery = [];
    this.quadro = new Quadro($('#board'));
    this.feed = [];
    this.lastTick = -1;
    net.on('join', (id, name) => this.join(id, name));
    net.on('leave', (id) => this.leave(id));
    net.on('msg', (id, m) => this.onMsg(id, m));
    net.on('room', (code) => this.hud.setRoom(code));
    this.hud = new Hud(this);
    setInterval(() => this.tick(), 200);
  }
  get leader() { return this.order[0] || null; }
  get list() { return this.order.map((id) => this.players.get(id)).filter(Boolean); }

  // ---------------- jogadores ----------------
  join(id, name) {
    if (!id) return;
    let p = this.players.get(id);
    if (!p) {
      if (this.players.size >= RISCA.MAX_PLAYERS) { this.net.send(id, { t: 'error', reason: `A sala está cheia (máx. ${RISCA.MAX_PLAYERS}).` }); return; }
      name = String(name || 'Jogador').trim().slice(0, 14) || 'Jogador';
      let n = name, k = 2;
      while (this.list.some((q) => q.name.toLowerCase() === n.toLowerCase())) n = `${name} ${k++}`;
      const used = new Set(this.list.map((q) => q.color));
      const color = COLORS.find((c) => !used.has(c)) || COLORS[this.players.size % COLORS.length];
      const back = this.phase !== 'lobby' ? this.ghosts.get(n.toLowerCase()) : undefined;
      p = { id, name: n, color, score: back || 0, guessed: false, gain: 0 };
      this.ghosts.delete(n.toLowerCase());
      this.players.set(id, p); this.order.push(id);
      this.som.play('join');
      if (this.phase !== 'lobby') this.addFeed('sys', `${n} entrou no jogo.`);
    }
    this.net.send(id, { t: 'welcome', id, name: p.name, color: p.color });
    this.lobbyChanged();
    this.sendState(id);
  }
  leave(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    this.order = this.order.filter((x) => x !== id);
    this.queue = this.queue.filter((x) => x !== id);
    if (this.phase !== 'lobby' && p.score) this.ghosts.set(p.name.toLowerCase(), p.score);
    if (this.phase !== 'lobby' && this.phase !== 'final') {
      this.addFeed('sys', `${p.name} saiu.`);
      if (this.players.size < RISCA.MIN_PLAYERS) { this.toLobby('Faltam jogadores: são precisos pelo menos 2.'); return; }
      if (this.turn && this.turn.drawer === id && (this.phase === 'choose' || this.phase === 'draw')) this.endTurn('left');
      else if (this.phase === 'draw' && this.allGuessed()) this.endTurn('all');
    }
    this.lobbyChanged();
  }

  onMsg(id, m) {
    const p = this.players.get(id);
    if (m.t === 'ping') { this.net.send(id, { t: 'pong', ts: m.ts }); return; }
    if (!p) return;
    const drawer = this.turn && this.turn.drawer === id;
    switch (m.t) {
      case 'settings':
        if (this.phase !== 'lobby' || id !== this.leader) return;
        this.setSettings(m); break;
      case 'start':
        if (this.phase === 'lobby') this.startGame(); break;
      case 'again':
        if (this.phase === 'final') this.toLobby(); break;
      case 'pick':
        if (this.phase === 'choose' && drawer) this.pick(+m.i); break;
      case 'pen': case 'fill': case 'undo': case 'clear':
        if (this.phase === 'draw' && drawer) this.quadro.apply(m); break;
      case 'giveup':
        if (this.phase === 'draw' && drawer) { this.addFeed('sys', `${p.name} desistiu deste desenho.`); this.endTurn('giveup'); }
        break;
      case 'guess':
        if (this.phase === 'draw' && !drawer && !p.guessed) this.guess(p, String(m.text || '').slice(0, 40)); break;
      case 'react':
        if (REACTS.includes(m.e) && this.phase !== 'lobby') this.hud.react(m.e, p.color); break;
    }
  }

  setSettings(m) {
    const s = this.settings;
    if ([1, 2, 3, 4, 5].includes(+m.rounds)) s.rounds = +m.rounds;
    if ([45, 60, 80, 100, 120].includes(+m.time)) s.time = +m.time;
    if (m.custom !== undefined) s.custom = parseCustom(Array.isArray(m.custom) ? m.custom.join(',') : m.custom);
    if (TEMA_LISTA.some(([k]) => k === m.theme)) s.theme = m.theme;
    if (s.theme === 'nossas' && s.custom.length < 3) s.theme = 'misto';
    this.lobbyChanged();
  }

  // ---------------- fluxo do jogo ----------------
  startGame() {
    if (this.players.size < RISCA.MIN_PLAYERS) return;
    for (const p of this.players.values()) { p.score = 0; p.gain = 0; p.guessed = false; }
    this.ghosts.clear(); this.used.clear(); this.gallery = []; this.feed = [];
    this.round = 0; this.queue = [];
    this.hud.clearFeed();
    this.nextTurn();
  }
  nextTurn() {
    if (this.players.size < RISCA.MIN_PLAYERS) { this.toLobby('Faltam jogadores: são precisos pelo menos 2.'); return; }
    while (!this.queue.length) {
      this.round++;
      if (this.round > this.settings.rounds) { this.final(); return; }
      this.queue = this.order.slice();
    }
    const drawer = this.queue.shift();
    if (!this.players.has(drawer)) { this.nextTurn(); return; }
    for (const p of this.players.values()) { p.guessed = false; p.gain = 0; }
    this.turn = {
      drawer, choices: escolher(this.settings.theme, this.settings.custom, this.used),
      word: null, lvl: 1, revealed: new Set(), hints: [], order: [], start: 0, dur: this.settings.time,
    };
    this.quadro.reset();
    this.setPhase('choose', CHOOSE_S);
    this.som.play('turn');
  }
  pick(i) {
    const t = this.turn;
    const c = t.choices[Math.max(0, Math.min(2, i | 0))] || t.choices[0];
    t.word = c.w; t.lvl = c.lvl;
    this.used.add(norm(c.w));
    // pistas: algumas letras aparecem ao longo do tempo (nunca mais de um terço)
    const letters = [...t.word].map((ch, k) => (/[\p{L}\p{N}]/u.test(ch) ? k : -1)).filter((k) => k >= 0);
    const n = Math.min(3, Math.floor(letters.length / 3));
    t.hints = Array.from({ length: n }, (_, k) => 0.45 + (0.4 * k) / Math.max(1, n - 1 || 1));
    t.letters = letters;
    this.setPhase('draw', t.dur);
  }
  setPhase(phase, secs) {
    this.phase = phase;
    this.phaseEnd = performance.now() + secs * 1000;
    this.phaseDur = secs;
    this.lastTick = -1;
    this.hud.render();
    this.sendAll();
  }
  get left() { return Math.max(0, Math.ceil((this.phaseEnd - performance.now()) / 1000)); }

  tick() {
    if (this.phase === 'lobby') return;
    const left = (this.phaseEnd - performance.now()) / 1000;
    this.hud.timer(Math.max(0, left), this.phaseDur);
    if (this.phase === 'draw') {
      const t = this.turn, frac = 1 - left / t.dur;
      if (t.hints.length && frac >= t.hints[0]) { t.hints.shift(); this.revealLetter(); }
      const s = Math.ceil(left);
      if (s <= 10 && s > 0 && s !== this.lastTick) { this.lastTick = s; this.som.play('tick'); }
    }
    if (left > 0) return;
    if (this.phase === 'choose') this.pick(Math.floor(Math.random() * 3));
    else if (this.phase === 'draw') this.endTurn('time');
    else if (this.phase === 'reveal') this.nextTurn();
    else if (this.phase === 'final') this.toLobby();
  }
  revealLetter() {
    const t = this.turn;
    const hidden = t.letters.filter((k) => !t.revealed.has(k));
    if (hidden.length <= 1) return;
    t.revealed.add(hidden[Math.floor(Math.random() * hidden.length)]);
    this.som.play('hint');
    this.hud.render();
    this.sendAll();
  }

  guess(p, text) {
    const t = this.turn;
    if (!text.trim()) return;
    const r = comparar(text, t.word);
    if (r === 'yes') {
      const left = Math.max(0, (this.phaseEnd - performance.now()) / 1000);
      const mult = NIVEL[t.lvl].mult;
      const first = t.order.length === 0;
      const gain = Math.round(((40 + 110 * left / t.dur) + (first ? 20 : 0)) * mult / 5) * 5;
      p.guessed = true; p.gain = gain; p.score += gain;
      t.order.push(p.id);
      const d = this.players.get(t.drawer);
      if (d) { const dg = Math.round(25 * mult / 5) * 5; d.gain += dg; d.score += dg; }
      this.addFeed('ok', `${p.name} acertou!`, p.color);
      this.som.play('right');
      this.net.send(p.id, { t: 'res', ok: 'yes', text, gain });
      this.net.send(p.id, { t: 'buzz', ms: 120 });
      if (this.allGuessed()) {
        if (d) { const bonus = Math.round(20 * mult / 5) * 5; d.gain += bonus; d.score += bonus; }
        this.hud.render(); this.sendAll();
        clearTimeout(this.allT);
        this.allT = setTimeout(() => { if (this.phase === 'draw' && this.turn === t) this.endTurn('all'); }, 1200);
      } else { this.hud.render(); this.sendAll(); }
    } else if (r === 'close') {
      this.addFeed('close', `${p.name} está quase!`, p.color);
      this.som.play('close');
      this.net.send(p.id, { t: 'res', ok: 'close', text });
    } else {
      this.addFeed('g', text, p.color, p.name);
      this.som.play('guess');
      this.net.send(p.id, { t: 'res', ok: 'no', text });
    }
  }
  allGuessed() {
    const t = this.turn; if (!t) return false;
    const guessers = this.list.filter((p) => p.id !== t.drawer);
    return guessers.length > 0 && guessers.every((p) => p.guessed);
  }
  endTurn(why) {
    const t = this.turn;
    if (!t) return;
    clearTimeout(this.allT);
    if (!t.word) { t.word = t.choices[0].w; t.lvl = t.choices[0].lvl; }
    t.why = why;
    const d = this.players.get(t.drawer);
    if (this.quadro.ops.length) this.gallery.push({ word: t.word, name: d ? d.name : '?', color: d ? d.color : '#888', ops: this.quadro.ops.slice() });
    this.addFeed('word', `A palavra era: ${t.word}`);
    this.som.play(t.order.length ? 'right' : 'end');
    this.setPhase('reveal', REVEAL_S);
  }
  final() {
    this.turn = null;
    this.setPhase('final', FINAL_S);
    this.som.play('win');
  }
  toLobby(msg) {
    clearTimeout(this.allT);
    this.phase = 'lobby'; this.turn = null; this.round = 0; this.queue = [];
    for (const p of this.players.values()) { p.score = 0; p.gain = 0; p.guessed = false; }
    this.ghosts.clear();
    this.quadro.reset();
    this.hud.render();
    if (msg) this.hud.toast(msg);
    this.lobbyChanged();
    this.sendAll();
  }

  // ---------------- mensagens para os telemóveis ----------------
  lobbyChanged() {
    this.hud.render();
    this.net.send(null, {
      t: 'lobby', phase: this.phase, leader: this.leader,
      players: this.list.map((p) => ({ id: p.id, name: p.name, color: p.color, score: p.score })),
      settings: { ...this.settings, custom: this.settings.custom.join(', ') },
    });
  }
  ranking() { return this.list.slice().sort((a, b) => b.score - a.score); }
  sendAll() { for (const id of this.order) this.sendState(id); }
  sendState(id) {
    const p = this.players.get(id);
    if (!p) return;
    const t = this.turn;
    const isDrawer = !!t && t.drawer === id;
    const rank = this.ranking().findIndex((q) => q.id === id) + 1;
    const m = {
      t: 'st', phase: this.phase, round: this.round, rounds: this.settings.rounds,
      left: this.phase === 'lobby' ? 0 : this.left, dur: this.phaseDur || 0,
      score: p.score, rank, n: this.players.size, gain: p.gain, guessed: p.guessed, isDrawer,
      leader: this.leader === id,
    };
    if (t) {
      const d = this.players.get(t.drawer);
      m.drawer = d ? d.name : '?'; m.drawerColor = d ? d.color : '#888';
      if (this.phase === 'choose' && isDrawer) m.choices = t.choices.map((c) => ({ w: c.w, lvl: c.lvl, mult: NIVEL[c.lvl].mult }));
      if (this.phase === 'draw') {
        m.pattern = padrao(t.word, t.revealed);
        m.lvl = t.lvl;
        m.right = t.order.length; m.guessers = this.players.size - 1;
        if (isDrawer || p.guessed) m.word = t.word;
      }
      if (this.phase === 'reveal') { m.word = t.word; m.why = t.why; m.right = t.order.length; }
    }
    if (this.phase === 'final') m.top = this.ranking().slice(0, 3).map((q) => ({ name: q.name, score: q.score, color: q.color }));
    this.net.send(id, m);
  }
  addFeed(kind, text, color, name) {
    this.feed.push({ kind, text, color, name });
    if (this.feed.length > 40) this.feed.shift();
    this.hud.feedAdd({ kind, text, color, name });
  }
}

// ---------------- ecrã da TV (HTML) ----------------
class Hud {
  constructor(jogo) { this.j = jogo; this.origin = null; this.staticMode = false; this.lastSec = -1; }

  async lanOrigin() {
    if (!/^(localhost|127\.)/.test(location.hostname)) return location.origin;
    try {
      const info = await (await fetch('/api/info')).json();
      if (info.ips?.length) return `${location.protocol}//${info.ips[0]}:${location.port || info.port}`;
    } catch {}
    return location.origin;
  }
  controllerUrl(code) {
    const base = (this.origin || location.origin) + location.pathname.replace(/\/tv\/?(index\.html)?$/, '/comando/');
    return code ? `${base}?room=${code}` : base;
  }
  qr(url) {
    const box = $('#qr'); box.innerHTML = '';
    if (!window.qrcode) return;
    const q = window.qrcode(0, 'M'); q.addData(url); q.make();
    box.innerHTML = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
  }
  async setRoom(code) {
    if (this.staticMode) return;
    if (!this.origin) this.origin = await this.lanOrigin();
    $('#room-code').textContent = code || '····';
    const url = this.controllerUrl(code);
    $('#join-url').textContent = url.replace(/^https?:\/\//, '');
    if (code) this.qr(url); else $('#qr').innerHTML = '';
    $('#ws-status').textContent = code ? '' : 'A ligar ao servidor…';
  }
  setCastMode(staticMode) {
    this.staticMode = !!staticMode;
    if (!staticMode) return;
    document.body.classList.add('static');
    const url = this.controllerUrl(null);
    $('#join-url').textContent = url.replace(/^https?:\/\//, '');
    $('#ws-status').textContent = '';
    this.qr(url);
  }

  render() {
    const j = this.j, ph = j.phase, t = j.turn;
    document.body.dataset.phase = ph;
    // lobby
    if (ph === 'lobby') {
      const list = j.list;
      $('#lplayers').innerHTML = list.length ? list.map((p, i) => `
        <li style="--c:${p.color}"><i>${esc(p.name[0].toUpperCase())}</i><b>${esc(p.name)}</b>${i === 0 ? '<em>chefe da sala</em>' : ''}</li>`).join('')
        : '<li class="empty">Ainda ninguém… lê o código QR com o telemóvel.</li>';
      const s = j.settings;
      const tema = TEMA_LISTA.find(([k]) => k === s.theme)?.[1] || '';
      $('#lsettings').innerHTML = `<span>🔁 ${s.rounds} ${s.rounds === 1 ? 'volta' : 'voltas'}</span><span>⏱ ${s.time} s por desenho</span><span>🏷 ${esc(tema)}${s.theme === 'nossas' ? ` (${s.custom.length})` : ''}</span>`;
      $('#start-hint').textContent = !list.length ? '' : list.length < RISCA.MIN_PLAYERS
        ? 'Falta mais um jogador: são precisos pelo menos 2.'
        : 'Toquem em COMEÇAR num telemóvel!';
      return;
    }
    // jogo
    $('#round').textContent = ph === 'final' ? 'Fim do jogo' : `Volta ${j.round} de ${j.settings.rounds}`;
    this.players();
    const msg = $('#board-msg');
    const d = t && j.players.get(t.drawer);
    const dn = d ? `<b style="color:${d.color}">${esc(d.name)}</b>` : 'Alguém';
    if (ph === 'choose') {
      $('#word').innerHTML = '<span class="wait">A escolher a palavra…</span>';
      msg.innerHTML = `<div class="pencil">✏️</div><p>${dn} vai desenhar.</p><p class="small">Está a escolher a palavra no telemóvel…</p>`;
      msg.className = 'show';
    } else if (ph === 'draw') {
      this.word(padrao(t.word, t.revealed), t.lvl);
      msg.className = ''; msg.innerHTML = '';
    } else if (ph === 'reveal') {
      this.word(t.word, t.lvl, true);
      const n = t.order.length;
      const why = t.why === 'left' ? 'Quem desenhava saiu do jogo.' : t.why === 'giveup' ? 'Quem desenhava desistiu.'
        : t.why === 'all' ? 'Toda a gente acertou! 🎉' : n ? `${n} ${n === 1 ? 'pessoa acertou' : 'pessoas acertaram'}.` : 'Ninguém acertou desta vez.';
      msg.innerHTML = `<p class="small">A palavra era</p><h2>${esc(t.word)}</h2><p class="small">${why}</p>`;
      msg.className = 'show reveal';
    } else if (ph === 'final') {
      this.finalScreen();
    }
  }
  word(text, lvl, open) {
    const chars = [...text].map((ch) => ch === ' ' ? '<i class="sp"></i>'
      : ch === '_' ? '<u></u>' : `<u class="${open ? 'open' : 'hint'}">${esc(ch.toUpperCase())}</u>`).join('');
    const letters = [...text].filter((c) => c !== ' ' && c !== '-').length;
    $('#word').innerHTML = `<span class="letters">${chars}</span><span class="meta">${letters} letras · ${NIVEL[lvl].nome}</span>`;
  }
  players() {
    const j = this.j, t = j.turn;
    const rank = j.ranking();
    $('#players').innerHTML = j.list.map((p) => {
      const pos = rank.indexOf(p) + 1;
      const draw = t && t.drawer === p.id && j.phase !== 'final';
      const st = draw ? '<span class="tag">✏️ desenha</span>' : p.guessed ? '<span class="tag ok">✔ acertou</span>' : '';
      const gain = p.gain && (j.phase === 'reveal' || p.guessed || draw) ? `<span class="gain">+${p.gain}</span>` : '';
      return `<li class="${draw ? 'draw' : ''} ${p.guessed ? 'ok' : ''}" style="--c:${p.color}">
        <span class="pos">${pos}</span><i>${esc(p.name[0].toUpperCase())}</i>
        <div><b>${esc(p.name)}</b><span class="pts">${p.score} pts</span></div>${st}${gain}</li>`;
    }).join('');
  }
  timer(left, dur) {
    const s = Math.ceil(left);
    const el = $('#timer');
    el.style.setProperty('--p', dur ? (left / dur) : 0);
    if (s !== this.lastSec) { this.lastSec = s; el.querySelector('b').textContent = s; el.classList.toggle('low', this.j.phase === 'draw' && s <= 10); }
  }
  clearFeed() { $('#feed').innerHTML = ''; }
  feedAdd(f) {
    const ul = $('#feed');
    const li = document.createElement('li');
    li.className = f.kind;
    if (f.color) li.style.setProperty('--c', f.color);
    li.innerHTML = f.kind === 'g' ? `<b>${esc(f.name)}</b> ${esc(f.text)}` : esc(f.text);
    ul.appendChild(li);
    while (ul.children.length > 14) ul.firstChild.remove();
  }
  react(e, color) {
    const layer = $('#reacts');
    if (layer.children.length > 12) return;
    const el = document.createElement('span');
    el.textContent = e;
    el.style.left = (10 + Math.random() * 70) + '%';
    el.style.setProperty('--c', color);
    layer.appendChild(el);
    this.j.som.play('pop');
    setTimeout(() => el.remove(), 2600);
  }
  toast(text) {
    const el = $('#toast'); el.textContent = text; el.classList.add('show');
    clearTimeout(this.toastT); this.toastT = setTimeout(() => el.classList.remove('show'), 5000);
  }
  finalScreen() {
    const r = this.j.ranking();
    const medal = ['🥇', '🥈', '🥉'];
    $('#podium').innerHTML = r.slice(0, 3).map((p, i) => `
      <div class="step s${i + 1}" style="--c:${p.color}"><span class="m">${medal[i]}</span><i>${esc(p.name[0].toUpperCase())}</i><b>${esc(p.name)}</b><span>${p.score} pts</span><div class="block">${i + 1}</div></div>`).join('')
      + (r.length > 3 ? `<p class="rest">${r.slice(3).map((p, i) => `${i + 4}.º ${esc(p.name)} (${p.score})`).join(' · ')}</p>` : '');
    // galeria com os desenhos do jogo
    const gal = $('#gallery'); gal.innerHTML = '';
    const big = document.createElement('canvas'); big.width = W; big.height = H;
    const bctx = big.getContext('2d', { willReadFrequently: true });
    for (const g of this.j.gallery.slice(-8)) {
      paint(bctx, g.ops);
      const fig = document.createElement('figure');
      const c = document.createElement('canvas'); c.width = 240; c.height = 180;
      c.getContext('2d').drawImage(big, 0, 0, 240, 180);
      fig.appendChild(c);
      fig.insertAdjacentHTML('beforeend', `<figcaption><b>${esc(g.word)}</b><span style="color:${g.color}">por ${esc(g.name)}</span></figcaption>`);
      gal.appendChild(fig);
    }
    $('#gallery-t').style.display = this.j.gallery.length ? '' : 'none';
  }
}

export { STATIC_MODE };
