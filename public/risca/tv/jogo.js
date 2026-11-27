// Risca e Arrisca — regras do jogo e ecrã da TV.
// A TV manda em tudo: escolhe quem desenha, guarda a palavra secreta, compara os palpites e dá os pontos.
// Modos: clássico, equipas e "Passa o Risco" (desenho → palpite → desenho… em cadeia).
import { RISCA, STATIC_MODE } from '../config.js';
import { Quadro, paint, W, H } from '../quadro.js';
import { escolher, escolherVarias, opcoes, comparar, padrao, parseCustom, norm, NIVEL, TEMA_LISTA } from '../palavras.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLORS = ['#e23b3b', '#2457d6', '#2f9e44', '#ff8a1f', '#8a3fd1', '#e8559a', '#14a3a3', '#c79a00', '#8a5a2b', '#5a6b7a'];
export const TEAMS = [{ name: 'Vermelha', color: '#e23b3b' }, { name: 'Azul', color: '#2457d6' }, { name: 'Verde', color: '#2f9e44' }, { name: 'Amarela', color: '#d69a00' }];
const CHOOSE_S = 15, REVEAL_S = 7, FINAL_S = 60, VOTE_S = 25, PGUESS_S = 35, PSHOW_MS = 3200;
const OFFLINE_KEEP_S = 180;  // quem sai a meio tem 3 minutos para voltar com o mesmo lugar
const DRAWER_WAIT_S = 15;   // quem desenha e perde a ligação tem 15 s para voltar
const LOW_PLAYERS_S = 45;    // com menos de 2 ligados durante este tempo, volta à sala de espera
const REACTS = ['👏', '😂', '🤯', '🔥', '🎨', '❤️', '🤔', '😱'];
const MODES = ['classico', 'equipas', 'passa'];

export class Jogo {
  constructor(net, som) {
    this.net = net; this.som = som;
    this.players = new Map(); // id -> { id, key, name, color, score, guessed, gain, team, online }
    this.order = [];
    this.ghosts = new Map();  // nome -> pontos de quem saiu de vez a meio
    this.settings = { rounds: 3, time: 80, theme: 'misto', custom: [], mode: 'classico', teams: 2, kids: false };
    this.phase = 'lobby';
    this.round = 0; this.queue = []; this.turn = null;
    this.used = new Set(); this.gallery = [];
    this.votes = new Map(); this.golden = [];
    this.passa = null;
    this.quadro = new Quadro($('#board'));
    this.lastTick = -1;
    this.hud = new Hud(this);
    net.on('join', (id, name, key) => this.join(id, name, key));
    net.on('leave', (id) => this.leave(id));
    net.on('msg', (id, m) => this.onMsg(id, m));
    net.on('room', (code) => this.hud.setRoom(code));
    setInterval(() => this.tick(), 200);
  }
  get leader() { return this.list.find((p) => p.online)?.id || null; }
  get list() { return this.order.map((id) => this.players.get(id)).filter(Boolean); }
  get online() { return this.list.filter((p) => p.online); }
  get teamMode() { return this.settings.mode === 'equipas'; }
  get passaMode() { return this.settings.mode === 'passa'; }
  findKey(key) { return key ? this.list.find((p) => p.key === key) : null; }

  // ---------------- jogadores ----------------
  join(id, name, key) {
    if (!id) return;
    key = key ? String(key).slice(0, 40) : '';
    let p = this.players.get(id);
    let back = false;
    if (!p && key) {
      p = this.findKey(key);
      if (p) {
        this.rebind(p, id); back = !p.online; p.online = true; p.leftAt = 0;
        if (back && this.phase !== 'lobby') { this.addFeed('sys', `${p.name} voltou.`); this.som.play('join'); }
      }
    }
    if (!p) {
      if (this.players.size >= RISCA.MAX_PLAYERS) { this.net.send(id, { t: 'error', reason: `A sala está cheia (máx. ${RISCA.MAX_PLAYERS}).` }); return; }
      name = String(name || 'Jogador').trim().slice(0, 14) || 'Jogador';
      let n = name, k = 2;
      while (this.list.some((q) => q.name.toLowerCase() === n.toLowerCase())) n = `${name} ${k++}`;
      const used = new Set(this.list.map((q) => q.color));
      const color = COLORS.find((c) => !used.has(c)) || COLORS[this.players.size % COLORS.length];
      const ghost = this.phase !== 'lobby' ? this.ghosts.get(n.toLowerCase()) : undefined;
      p = { id, key, name: n, color, score: ghost || 0, guessed: false, gain: 0, team: this.pickTeam(), online: true, leftAt: 0 };
      this.ghosts.delete(n.toLowerCase());
      this.players.set(id, p); this.order.push(id);
      this.som.play('join');
      if (this.phase !== 'lobby') this.addFeed('sys', `${n} entrou no jogo.`);
    }
    this.net.send(id, { t: 'welcome', id, name: p.name, color: p.color });
    this.lobbyChanged();
    this.sendState(id);
    this.resync(p);
  }
  // quem volta a entrar recebe o que estava a fazer (desenho em curso, imagem para adivinhar…)
  resync(p) {
    const t = this.turn;
    if (this.phase === 'draw' && t && t.drawer === p.id) this.sendOps(p.id, this.quadro.ops);
    if (this.passa && this.phase === 'pdraw') { const q = this.passa.quadros.get(p.id); if (q) this.sendOps(p.id, q.ops); }
    if (this.passa && this.phase === 'pguess') this.sendPassaImage(p.id);
  }
  rebind(p, id) {
    const old = p.id;
    if (old === id) return;
    const sw = (x) => (x === old ? id : x);
    this.players.delete(old); p.id = id; this.players.set(id, p);
    this.order = this.order.map(sw); this.queue = this.queue.map(sw);
    if (this.turn) { this.turn.drawer = sw(this.turn.drawer); this.turn.order = this.turn.order.map(sw); }
    if (this.votes.has(old)) { this.votes.set(id, this.votes.get(old)); this.votes.delete(old); }
    const P = this.passa;
    if (P) {
      P.ids = P.ids.map(sw);
      for (const m of [P.quadros, P.assign, P.texts]) if (m.has(old)) { m.set(id, m.get(old)); m.delete(old); }
      if (P.sub.delete(old)) P.sub.add(id);
    }
  }
  pickTeam() {
    const n = this.settings.teams;
    const count = Array(n).fill(0);
    for (const p of this.list) if (p.team < n) count[p.team]++;
    return count.indexOf(Math.min(...count));
  }
  leave(id) {
    const p = this.players.get(id);
    if (!p) return;
    if (!p.online) return;
    p.online = false; p.leftAt = performance.now();
    if (this.phase === 'lobby') { this.lobbyChanged(); return; } // fica à espera uns segundos, caso volte
    this.addFeed('sys', `${p.name} perdeu a ligação.`);
    // quem desenha tem uns segundos para voltar antes de a vez acabar
    if (this.turn && this.turn.drawer === id && (this.phase === 'choose' || this.phase === 'draw')) {}
    else if (this.phase === 'draw' && this.allGuessed()) this.endTurn('all');
    else if (this.passa && (this.phase === 'pdraw' || this.phase === 'pguess')) this.checkPassaDone();
    else if (this.phase === 'vote') this.checkVotes();
    this.lobbyChanged();
  }
  remove(p) {
    this.players.delete(p.id);
    this.order = this.order.filter((x) => x !== p.id);
    this.queue = this.queue.filter((x) => x !== p.id);
    if (this.phase !== 'lobby' && p.score) this.ghosts.set(p.name.toLowerCase(), p.score);
  }

  onMsg(id, m) {
    const p = this.players.get(id);
    if (m.t === 'ping') { this.net.send(id, { t: 'pong', ts: m.ts }); return; }
    if (!p) return;
    if (!p.online) { p.online = true; p.leftAt = 0; this.lobbyChanged(); }
    const drawer = this.turn && this.turn.drawer === id;
    const P = this.passa;
    switch (m.t) {
      case 'settings':
        if (this.phase !== 'lobby' || id !== this.leader) return;
        this.setSettings(m); break;
      case 'team':
        if (this.phase === 'lobby' && this.teamMode && m.team >= 0 && m.team < this.settings.teams) { p.team = m.team | 0; this.lobbyChanged(); }
        break;
      case 'start':
        if (this.phase === 'lobby') this.startGame(); break;
      case 'again':
        if (this.phase === 'final') this.toLobby(); break;
      case 'pick':
        if (this.phase === 'choose' && drawer) this.pick(+m.i); break;
      case 'pen': case 'fill': case 'undo': case 'clear':
        if (this.phase === 'draw' && drawer) this.quadro.apply(m);
        else if (this.phase === 'pdraw' && P && !P.sub.has(id)) P.quadros.get(id)?.apply(m);
        break;
      case 'giveup':
        if (this.phase === 'draw' && drawer) { this.addFeed('sys', `${p.name} desistiu deste desenho.`); this.endTurn('giveup'); }
        break;
      case 'guess':
        if (this.phase === 'draw' && !drawer && !p.guessed) this.guess(p, String(m.text || '').slice(0, 40)); break;
      case 'react':
        if (REACTS.includes(m.e) && this.phase !== 'lobby') this.hud.react(m.e, p.color); break;
      case 'vote':
        if (this.phase === 'vote') this.vote(p, m.i | 0); break;
      case 'pic':
        this.sendPic(id, m.i | 0); break;
      case 'pdone':
        if (this.phase === 'pdraw' && P?.assign.has(id)) { P.sub.add(id); this.passaChanged(); } break;
      case 'ptext':
        if (this.phase === 'pguess' && P?.assign.has(id)) {
          P.texts.set(id, String(m.text || '').trim().slice(0, 40)); P.sub.add(id); this.passaChanged();
        }
        break;
      case 'pnext':
        if (this.phase === 'pshow' && id === this.leader) this.passaShowNext(); break;
    }
  }

  setSettings(m) {
    const s = this.settings;
    if ([1, 2, 3, 4, 5].includes(+m.rounds)) s.rounds = +m.rounds;
    if ([45, 60, 80, 100, 120].includes(+m.time)) s.time = +m.time;
    if (m.custom !== undefined) s.custom = parseCustom(Array.isArray(m.custom) ? m.custom.join(',') : m.custom);
    if (TEMA_LISTA.some(([k]) => k === m.theme)) s.theme = m.theme;
    if (s.theme === 'nossas' && s.custom.length < 3) s.theme = 'misto';
    if (MODES.includes(m.mode)) s.mode = m.mode;
    if ([2, 3, 4].includes(+m.teams) && +m.teams !== s.teams) {
      s.teams = +m.teams;
      this.list.forEach((p, i) => { p.team = i % s.teams; });
    }
    if (m.kids !== undefined) s.kids = !!m.kids;
    this.lobbyChanged();
  }

  // ---------------- fluxo do jogo ----------------
  startGame() {
    // quem está desligado na sala de espera sai; os outros começam do zero
    for (const p of this.list) if (!p.online) this.remove(p);
    if (this.players.size < RISCA.MIN_PLAYERS) return;
    for (const p of this.players.values()) { p.score = 0; p.gain = 0; p.guessed = false; }
    if (this.teamMode) for (const p of this.list) if (p.team >= this.settings.teams) p.team = this.pickTeam();
    this.ghosts.clear(); this.used.clear(); this.gallery = []; this.votes.clear(); this.golden = [];
    this.round = 0; this.queue = []; this.passa = null;
    this.hud.clearFeed();
    if (this.passaMode) this.startPassa(); else this.nextTurn();
  }
  drawOrder() {
    const ids = this.online.map((p) => p.id);
    if (!this.teamMode) return ids;
    // equipas à vez: um da Vermelha, um da Azul, …
    const byTeam = Array.from({ length: this.settings.teams }, (_, t) => ids.filter((id) => this.players.get(id).team === t));
    const out = [];
    for (let k = 0; byTeam.some((l) => l.length > k); k++) for (const l of byTeam) if (l[k]) out.push(l[k]);
    return out;
  }
  nextTurn() {
    if (this.online.length < RISCA.MIN_PLAYERS && !this.lowSince) this.lowSince = performance.now();
    let drawer = null;
    while (!drawer) {
      while (!this.queue.length) {
        this.round++;
        if (this.round > this.settings.rounds) { this.afterTurns(); return; }
        this.queue = this.drawOrder();
        if (!this.queue.length) { this.toLobby('Faltam jogadores.'); return; }
      }
      const id = this.queue.shift();
      if (this.players.get(id)?.online) drawer = id;
    }
    for (const p of this.players.values()) { p.guessed = false; p.gain = 0; }
    this.turn = {
      drawer, choices: escolher(this.settings.theme, this.settings.custom, this.used),
      word: null, lvl: 1, revealed: new Set(), hints: [], order: [], dur: this.settings.time, options: null,
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
    const letters = [...t.word].map((ch, k) => (/[\p{L}\p{N}]/u.test(ch) ? k : -1)).filter((k) => k >= 0);
    const n = Math.min(3, Math.floor(letters.length / 3));
    t.hints = Array.from({ length: n }, (_, k) => 0.45 + (0.4 * k) / Math.max(1, n - 1));
    t.letters = letters;
    if (this.settings.kids) t.options = opcoes(this.settings.theme, this.settings.custom, t.word);
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
    const now = performance.now();
    // quem saiu há muito tempo perde o lugar
    const keep = (this.phase === 'lobby' ? 60 : OFFLINE_KEEP_S) * 1000;
    for (const p of this.list) {
      if (!p.online && p.leftAt && now - p.leftAt > keep) { this.remove(p); this.lobbyChanged(); }
    }
    if (this.phase === 'lobby') return;
    if (this.phase !== 'final') {
      if (this.online.length < RISCA.MIN_PLAYERS) {
        this.lowSince ||= now;
        if (now - this.lowSince > LOW_PLAYERS_S * 1000) { this.lowSince = 0; this.toLobby('O jogo parou: faltam jogadores ligados.'); return; }
      } else this.lowSince = 0;
    }
    const t0 = this.turn, dp = t0 && this.players.get(t0.drawer);
    if (dp && !dp.online && (this.phase === 'choose' || this.phase === 'draw') && now - dp.leftAt > DRAWER_WAIT_S * 1000) { this.endTurn('left'); return; }
    if (this.phase === 'pshow') { if (now >= this.showNext) this.passaShowNext(); return; }
    const left = (this.phaseEnd - now) / 1000;
    this.hud.timer(Math.max(0, left), this.phaseDur);
    if (this.phase === 'draw') {
      const t = this.turn, frac = 1 - left / t.dur;
      if (t.hints.length && frac >= t.hints[0]) { t.hints.shift(); this.revealLetter(); }
    }
    if (this.phase === 'draw' || this.phase === 'pdraw' || this.phase === 'pguess') {
      const s = Math.ceil(left);
      if (s <= 10 && s > 0 && s !== this.lastTick) { this.lastTick = s; this.som.play('tick'); }
    }
    if (left > 0) return;
    if (this.phase === 'choose') this.pick(Math.floor(Math.random() * 3));
    else if (this.phase === 'draw') this.endTurn('time');
    else if (this.phase === 'reveal') this.nextTurn();
    else if (this.phase === 'vote') this.endVote();
    else if (this.phase === 'pdraw' || this.phase === 'pguess') this.passaFinishStep();
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
        clearTimeout(this.allT);
        this.allT = setTimeout(() => { if (this.phase === 'draw' && this.turn === t) this.endTurn('all'); }, 1200);
      }
      this.hud.render(); this.sendAll();
    } else if (r === 'close' && !this.settings.kids) {
      this.addFeed('close', `${p.name} está quase!`, p.color);
      this.som.play('close');
      this.net.send(p.id, { t: 'res', ok: 'close', text });
    } else {
      if (this.settings.kids) this.addFeed('sys', `${p.name} errou.`);
      else this.addFeed('g', text, p.color, p.name);
      this.som.play('guess');
      this.net.send(p.id, { t: 'res', ok: 'no', text });
    }
  }
  allGuessed() {
    const t = this.turn; if (!t) return false;
    const guessers = this.online.filter((p) => p.id !== t.drawer);
    return guessers.length > 0 && guessers.every((p) => p.guessed);
  }
  endTurn(why) {
    const t = this.turn;
    if (!t) return;
    clearTimeout(this.allT);
    if (!t.word) { t.word = t.choices[0].w; t.lvl = t.choices[0].lvl; }
    t.why = why;
    const d = this.players.get(t.drawer);
    if (this.quadro.ops.length && d) this.gallery.push({ word: t.word, p: d, ops: this.quadro.ops.slice() });
    this.addFeed('word', `A palavra era: ${t.word}`);
    this.som.play(t.order.length ? 'right' : 'end');
    this.setPhase('reveal', REVEAL_S);
  }
  afterTurns() {
    this.turn = null;
    if (this.gallery.length >= 2) { this.votes.clear(); this.setPhase('vote', VOTE_S); this.som.play('turn'); }
    else this.final();
  }
  final() {
    this.turn = null;
    this.setPhase('final', FINAL_S);
    this.som.play('win');
  }
  toLobby(msg) {
    clearTimeout(this.allT);
    this.phase = 'lobby'; this.turn = null; this.round = 0; this.queue = []; this.passa = null;
    for (const p of this.list) if (!p.online) this.remove(p);
    for (const p of this.players.values()) { p.score = 0; p.gain = 0; p.guessed = false; }
    this.ghosts.clear();
    this.quadro.reset();
    this.hud.render();
    if (msg) this.hud.toast(msg);
    this.lobbyChanged();
    this.sendAll();
  }

  // ---------------- Lápis de Ouro (votação do melhor desenho) ----------------
  vote(p, i) {
    const g = this.gallery[i];
    if (!g || g.p === p) return;
    this.votes.set(p.id, i);
    this.hud.render();
    this.sendState(p.id);
    this.checkVotes();
  }
  canVote(p) { return this.gallery.some((g) => g.p !== p); }
  checkVotes() {
    if (this.phase !== 'vote') return;
    const voters = this.online.filter((p) => this.canVote(p));
    if (voters.every((p) => this.votes.has(p.id))) { clearTimeout(this.voteT); this.voteT = setTimeout(() => { if (this.phase === 'vote') this.endVote(); }, 900); }
  }
  endVote() {
    const count = new Map();
    for (const i of this.votes.values()) count.set(i, (count.get(i) || 0) + 1);
    const max = Math.max(0, ...count.values());
    this.golden = max ? [...count.entries()].filter(([, n]) => n === max).map(([i]) => i) : [];
    for (const i of this.golden) { const g = this.gallery[i]; g.p.score += 60; g.p.gain = 60; }
    this.goldenVotes = max;
    this.final();
  }

  // ---------------- Passa o Risco ----------------
  startPassa() {
    const ids = this.online.map((p) => p.id);
    const words = escolherVarias(this.settings.theme, this.settings.custom, ids.length, this.used);
    words.forEach((w) => this.used.add(norm(w)));
    this.passa = {
      ids, n: ids.length, step: 0,
      chains: ids.map((id, c) => ({ owner: this.players.get(id), items: [{ k: 'word', text: words[c], p: null }] })),
      quadros: new Map(), assign: new Map(), texts: new Map(), sub: new Set(), show: { c: 0, i: 0 },
    };
    this.passaStep();
  }
  passaStep() {
    const P = this.passa;
    P.step++;
    if (P.step > P.n) { this.passaShowStart(); return; }
    P.assign.clear(); P.sub.clear(); P.texts.clear(); P.quadros.clear();
    P.ids.forEach((id, pi) => P.assign.set(id, ((pi - (P.step - 1)) % P.n + P.n) % P.n));
    const draw = P.step % 2 === 1;
    if (draw) {
      const canvases = this.hud.passaGrid(P.ids);
      P.ids.forEach((id, k) => P.quadros.set(id, new Quadro(canvases[k])));
      this.setPhase('pdraw', this.settings.time);
    } else {
      this.hud.passaGrid(P.ids, true);
      this.setPhase('pguess', PGUESS_S);
      for (const id of P.ids) this.sendPassaImage(id);
    }
    this.som.play('turn');
  }
  passaPrompt(id) { // o que este jogador tem de desenhar neste passo
    const P = this.passa, c = P.assign.get(id);
    if (c === undefined) return '';
    const it = P.chains[c].items[P.step - 1];
    return it?.text || '';
  }
  sendPassaImage(id) {
    const P = this.passa, c = P.assign.get(id);
    if (c === undefined) return;
    const it = P.chains[c].items[P.step - 1];
    if (it?.k === 'draw') this.net.send(id, { t: 'pimg', url: this.hud.jpeg(it.ops, 480, 360) });
  }
  passaChanged() {
    this.hud.passaStatus();
    this.sendAll();
    this.checkPassaDone();
  }
  checkPassaDone() {
    const P = this.passa;
    const need = P.ids.filter((id) => this.players.get(id)?.online);
    if (need.length && need.every((id) => P.sub.has(id))) {
      clearTimeout(this.passaT);
      const step = P.step;
      this.passaT = setTimeout(() => { if (this.passa === P && P.step === step && this.phase.startsWith('p')) this.passaFinishStep(); }, 800);
    }
  }
  passaFinishStep() {
    const P = this.passa;
    clearTimeout(this.passaT);
    const draw = this.phase === 'pdraw';
    for (const id of P.ids) {
      const c = P.assign.get(id), p = this.players.get(id) || { name: '?', color: '#888' };
      if (draw) {
        const ops = P.quadros.get(id)?.ops.slice() || [];
        P.chains[c].items.push({ k: 'draw', ops, p });
        if (ops.length) this.gallery.push({ word: P.chains[c].items[P.step - 1].text, p, ops });
      } else {
        P.chains[c].items.push({ k: 'text', text: P.texts.get(id) || '…', p });
      }
    }
    this.passaStep();
  }
  passaShowStart() {
    const P = this.passa;
    P.show = { c: 0, i: 0 };
    this.phase = 'pshow'; this.phaseDur = 0;
    this.showNext = performance.now() + PSHOW_MS;
    this.hud.render(); this.sendAll();
    this.som.play('win');
  }
  passaShowNext() {
    const P = this.passa, s = P.show, chain = P.chains[s.c];
    if (s.i < chain.items.length - 1) s.i++;
    else if (s.c < P.n - 1) { s.c++; s.i = 0; }
    else { this.final(); return; }
    const last = s.i === P.chains[s.c].items.length - 1;
    this.showNext = performance.now() + (last ? PSHOW_MS * 2 : PSHOW_MS);
    this.som.play(last ? 'right' : 'pop');
    this.hud.render();
    if (s.i === 0) this.sendAll();
  }

  // ---------------- mensagens para os telemóveis ----------------
  lobbyChanged() {
    this.hud.render();
    this.net.send(null, {
      t: 'lobby', phase: this.phase, leader: this.leader,
      players: this.list.map((p) => ({ id: p.id, name: p.name, color: p.color, score: p.score, team: p.team, online: p.online })),
      settings: { ...this.settings, custom: this.settings.custom.join(', ') },
      teams: TEAMS.slice(0, this.settings.teams),
    });
  }
  ranking() { return this.list.slice().sort((a, b) => b.score - a.score); }
  teamRanking() {
    return TEAMS.slice(0, this.settings.teams).map((t, i) => ({ ...t, i, score: this.list.filter((p) => p.team === i).reduce((a, p) => a + p.score, 0) }))
      .sort((a, b) => b.score - a.score);
  }
  sendAll() { for (const p of this.online) this.sendState(p.id); }
  sendState(id) {
    const p = this.players.get(id);
    if (!p) return;
    const t = this.turn, P = this.passa;
    const isDrawer = !!t && t.drawer === id;
    const rank = this.ranking().findIndex((q) => q.id === id) + 1;
    const m = {
      t: 'st', phase: this.phase, round: this.round, rounds: this.settings.rounds, mode: this.settings.mode,
      left: this.phase === 'lobby' || this.phase === 'pshow' ? 0 : this.left, dur: this.phaseDur || 0,
      score: p.score, rank, n: this.players.size, gain: p.gain, guessed: p.guessed, isDrawer,
      leader: this.leader === id, kids: this.settings.kids,
    };
    if (this.teamMode) {
      const tr = this.teamRanking();
      m.team = { ...TEAMS[p.team], score: tr.find((x) => x.i === p.team)?.score || 0, rank: tr.findIndex((x) => x.i === p.team) + 1 };
    }
    if (t) {
      const d = this.players.get(t.drawer);
      m.drawer = d ? d.name : '?'; m.drawerColor = d ? d.color : '#888';
      if (this.phase === 'choose' && isDrawer) m.choices = t.choices.map((c) => ({ w: c.w, lvl: c.lvl, mult: NIVEL[c.lvl].mult }));
      if (this.phase === 'draw') {
        m.pattern = padrao(t.word, t.revealed);
        m.lvl = t.lvl;
        m.right = t.order.length; m.guessers = this.online.length - 1;
        if (isDrawer || p.guessed) m.word = t.word;
        if (t.options && !isDrawer) m.options = t.options;
      }
      if (this.phase === 'reveal') { m.word = t.word; m.why = t.why; m.right = t.order.length; }
    }
    if (this.phase === 'vote') {
      m.gallery = this.gallery.map((g, i) => ({ i, word: g.word, name: g.p.name, mine: g.p === p }));
      m.voted = this.votes.has(id) ? this.votes.get(id) : -1;
    }
    if (this.phase === 'final') {
      m.top = this.ranking().slice(0, 3).map((q) => ({ name: q.name, score: q.score, color: q.color }));
      if (this.teamMode) m.teams = this.teamRanking().map((x) => ({ name: x.name, color: x.color, score: x.score }));
      m.gallery = this.gallery.map((g, i) => ({ i, word: g.word, name: g.p.name, mine: g.p === p, gold: this.golden.includes(i) }));
    }
    if (P && (this.phase === 'pdraw' || this.phase === 'pguess')) {
      m.step = P.step; m.steps = P.n;
      m.submitted = P.sub.has(id); m.ready = P.sub.size; m.total = P.ids.length;
      m.active = P.assign.has(id);
      if (this.phase === 'pdraw') m.prompt = this.passaPrompt(id);
    }
    this.net.send(id, m);
  }
  // envia um desenho inteiro (quem volta a entrar a meio) em pedaços pequenos
  sendOps(id, ops) {
    let chunk = [], size = 0, first = true;
    const flush = (last) => { this.net.send(id, { t: 'sync', first, last, ops: chunk }); first = false; chunk = []; size = 0; };
    for (const op of ops) {
      const s = op.p ? op.p.length * 4 + 40 : 40;
      if (chunk.length && size + s > 24000) flush(false);
      chunk.push(op); size += s;
    }
    flush(true);
  }
  sendPic(id, i) {
    const g = this.gallery[i];
    if (!g) return;
    this.net.send(id, { t: 'pic', i, word: g.word, url: this.hud.jpeg(g.ops, 560, 420) });
  }
  addFeed(kind, text, color, name) { this.hud.feedAdd({ kind, text, color, name }); }
}

// ---------------- ecrã da TV (HTML) ----------------
class Hud {
  constructor(jogo) {
    this.j = jogo; this.origin = null; this.staticMode = false; this.lastSec = -1;
    this.big = document.createElement('canvas'); this.big.width = W; this.big.height = H;
    this.bctx = this.big.getContext('2d', { willReadFrequently: true });
  }

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
    if (code) this.qr(url); else $('#qr').innerHTML = '';
    $('#ws-status').textContent = code ? '' : 'A ligar ao servidor…';
  }
  setCastMode(staticMode) {
    this.staticMode = !!staticMode;
    if (!staticMode) return;
    document.body.classList.add('static');
    $('#ws-status').textContent = '';
    this.qr(this.controllerUrl(null));
  }

  // desenho → imagem (galeria, Passa o Risco, guardar no telemóvel)
  thumb(ops, w, h) {
    paint(this.bctx, ops);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(this.big, 0, 0, w, h);
    return c;
  }
  jpeg(ops, w, h) {
    const c = this.thumb(ops, w, h);
    let url = c.toDataURL('image/jpeg', 0.72);
    if (url.length > 50000) url = c.toDataURL('image/jpeg', 0.45);
    return url;
  }

  render() {
    const j = this.j, ph = j.phase, t = j.turn;
    document.body.dataset.phase = ph;
    document.body.classList.toggle('teams', j.teamMode);
    if (ph === 'lobby') { this.lobby(); return; }
    $('#round').textContent = ph === 'final' ? 'Fim do jogo' : ph === 'vote' ? 'Lápis de Ouro'
      : j.passa ? `Passa o Risco · passo ${Math.min(j.passa.step, j.passa.n)} de ${j.passa.n}` : `Volta ${j.round} de ${j.settings.rounds}`;
    this.players();
    if (ph.startsWith('p')) { this.passaRender(); return; }
    const msg = $('#board-msg');
    const d = t && j.players.get(t.drawer);
    const dn = d ? `<b style="color:${d.color}">${esc(d.name)}</b>` : 'Alguém';
    if (ph === 'choose') {
      $('#word').innerHTML = '<span class="wait">A escolher a palavra…</span>';
      msg.innerHTML = `<div class="pencil">✏️</div><p>${dn} vai desenhar${j.teamMode && d ? ` <span class="small">(equipa ${TEAMS[d.team].name})</span>` : ''}.</p><p class="small">Está a escolher a palavra no telemóvel…</p>`;
      msg.className = 'show';
    } else if (ph === 'draw') {
      this.word(padrao(t.word, t.revealed), t.lvl);
      msg.className = ''; msg.innerHTML = '';
      $('#opts').innerHTML = t.options ? t.options.map((o) => `<span>${esc(o)}</span>`).join('') : '';
    } else if (ph === 'reveal') {
      this.word(t.word, t.lvl, true);
      $('#opts').innerHTML = '';
      const n = t.order.length;
      const why = t.why === 'left' ? 'Quem desenhava perdeu a ligação.' : t.why === 'giveup' ? 'Quem desenhava desistiu.'
        : t.why === 'all' ? 'Toda a gente acertou! 🎉' : n ? `${n} ${n === 1 ? 'pessoa acertou' : 'pessoas acertaram'}.` : 'Ninguém acertou desta vez.';
      msg.innerHTML = `<p class="small">A palavra era</p><h2>${esc(t.word)}</h2><p class="small">${why}</p>`;
      msg.className = 'show reveal';
    } else if (ph === 'vote') {
      this.voteScreen();
    } else if (ph === 'final') {
      this.finalScreen();
    }
  }
  lobby() {
    const j = this.j, list = j.list, s = j.settings;
    const team = (p) => (j.teamMode ? `<span class="tm" style="--t:${TEAMS[p.team].color}">${TEAMS[p.team].name}</span>` : '');
    $('#lplayers').innerHTML = list.length ? list.map((p) => `
      <li style="--c:${p.color}" class="${p.online ? '' : 'off'}"><i>${esc(p.name[0].toUpperCase())}</i><b>${esc(p.name)}</b>${team(p)}${p.id === j.leader ? '<em>chefe da sala</em>' : ''}</li>`).join('')
      : '<li class="empty">Ainda ninguém… lê o código QR com o telemóvel.</li>';
    const tema = TEMA_LISTA.find(([k]) => k === s.theme)?.[1] || '';
    const mode = s.mode === 'equipas' ? `👥 ${s.teams} equipas` : s.mode === 'passa' ? '🔄 Passa o Risco' : '✏️ Clássico';
    $('#lsettings').innerHTML = `<span>${mode}</span>${s.mode === 'passa' ? '' : `<span>🔁 ${s.rounds} ${s.rounds === 1 ? 'volta' : 'voltas'}</span>`}<span>⏱ ${s.time} s</span><span>🏷 ${esc(tema)}${s.theme === 'nossas' ? ` (${s.custom.length})` : ''}</span>${s.kids && s.mode !== 'passa' ? '<span>🧒 modo pequenos</span>' : ''}`;
    $('#rules-classic').hidden = s.mode === 'passa';
    $('#rules-passa').hidden = s.mode !== 'passa';
    $('#start-hint').textContent = !list.length ? '' : j.online.length < RISCA.MIN_PLAYERS
      ? 'Falta mais um jogador: são precisos pelo menos 2.' : 'Toquem em COMEÇAR num telemóvel!';
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
    const row = (p) => {
      const pos = rank.indexOf(p) + 1;
      const draw = t && t.drawer === p.id && j.phase !== 'final';
      const P = j.passa;
      const st = !p.online ? '<span class="tag">💤 a voltar…</span>' : draw ? '<span class="tag">✏️ desenha</span>'
        : p.guessed ? '<span class="tag ok">✔ acertou</span>'
        : P && P.sub.has(p.id) && (j.phase === 'pdraw' || j.phase === 'pguess') ? '<span class="tag ok">✔ pronto</span>'
        : j.phase === 'vote' && j.votes.has(p.id) ? '<span class="tag ok">✔ votou</span>' : '';
      const gain = p.gain && (j.phase === 'reveal' || p.guessed || draw || j.phase === 'final') ? `<span class="gain">+${p.gain}</span>` : '';
      return `<li class="${draw ? 'draw' : ''} ${p.guessed ? 'ok' : ''} ${p.online ? '' : 'off'}" style="--c:${p.color}">
        <span class="pos">${j.passaMode ? '' : pos}</span><i>${esc(p.name[0].toUpperCase())}</i>
        <div><b>${esc(p.name)}</b>${j.passaMode ? '' : `<span class="pts">${p.score} pts</span>`}</div>${st}${gain}</li>`;
    };
    if (j.teamMode) {
      $('#players').innerHTML = j.teamRanking().map((tm) => `
        <li class="team" style="--c:${tm.color}"><b>Equipa ${tm.name}</b><span class="pts">${tm.score} pts</span></li>
        ${j.list.filter((p) => p.team === tm.i).map(row).join('')}`).join('');
    } else $('#players').innerHTML = j.list.map(row).join('');
  }
  timer(left, dur) {
    const s = Math.ceil(left);
    const el = $('#timer');
    el.style.setProperty('--p', dur ? (left / dur) : 0);
    if (s !== this.lastSec) { this.lastSec = s; el.querySelector('b').textContent = s; el.classList.toggle('low', /draw|pguess/.test(this.j.phase) && s <= 10); }
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

  // ---------- Passa o Risco ----------
  passaGrid(ids, writing) {
    const grid = $('#pgrid');
    grid.innerHTML = '';
    grid.style.setProperty('--cols', ids.length <= 3 ? Math.max(2, ids.length) : ids.length <= 6 ? 3 : 4);
    const canvases = [];
    for (const id of ids) {
      const p = this.j.players.get(id);
      const fig = document.createElement('figure');
      fig.dataset.id = id;
      fig.style.setProperty('--c', p?.color || '#888');
      if (writing) fig.innerHTML = '<div class="writing">✍️</div>';
      else { const c = document.createElement('canvas'); fig.appendChild(c); canvases.push(c); }
      fig.insertAdjacentHTML('beforeend', `<figcaption><b>${esc(p?.name || '?')}</b><span class="ok">✔ pronto</span></figcaption>`);
      grid.appendChild(fig);
    }
    return canvases;
  }
  passaStatus() {
    const P = this.j.passa;
    for (const fig of document.querySelectorAll('#pgrid figure')) {
      const id = P.ids[[...fig.parentNode.children].indexOf(fig)];
      fig.classList.toggle('done', P.sub.has(id));
    }
    this.players();
  }
  passaRender() {
    const j = this.j, P = j.passa, ph = j.phase;
    if (ph === 'pdraw') $('#word').innerHTML = '<span class="wait">Todos a desenhar a sua palavra…</span>';
    if (ph === 'pguess') $('#word').innerHTML = '<span class="wait">Todos a adivinhar o desenho que receberam…</span>';
    if (ph === 'pdraw' || ph === 'pguess') { this.passaStatus(); return; }
    // pshow: mostra a cadeia atual, uma peça de cada vez
    const s = P.show, chain = P.chains[s.c];
    $('#word').innerHTML = `<span class="wait">A cadeia de <b style="color:${chain.owner.color}">${esc(chain.owner.name)}</b> (${s.c + 1} de ${P.n})</span>`;
    const box = $('#pshow');
    box.innerHTML = '';
    chain.items.slice(0, s.i + 1).forEach((it, k) => {
      const card = document.createElement('div');
      card.className = 'card ' + it.k + (k === s.i ? ' new' : '');
      if (it.k === 'draw') {
        card.appendChild(this.thumb(it.ops, 320, 240));
        card.insertAdjacentHTML('beforeend', `<span>desenhou <b style="color:${it.p.color}">${esc(it.p.name)}</b></span>`);
      } else {
        card.innerHTML = `<b class="txt">${esc(it.text)}</b><span>${it.k === 'word' ? 'palavra secreta' : `escreveu <b style="color:${it.p.color}">${esc(it.p.name)}</b>`}</span>`;
      }
      if (k > 0) box.insertAdjacentHTML('beforeend', '<i class="arrow">➜</i>');
      box.appendChild(card);
    });
    const last = s.i === chain.items.length - 1;
    const ok = last && norm(chain.items[s.i].text || '') === norm(chain.items[0].text);
    $('#pshow-end').textContent = !last ? '' : chain.items[s.i].k === 'text' ? (ok ? 'Chegou intacta! 🎉' : `Começou em «${chain.items[0].text}»… 😂`) : '';
  }

  // ---------- votação e fim ----------
  galleryInto(box, opts = {}) {
    box.innerHTML = '';
    this.j.gallery.forEach((g, i) => {
      if (opts.limit && i < this.j.gallery.length - opts.limit) return;
      const fig = document.createElement('figure');
      if (this.j.golden.includes(i)) fig.classList.add('gold');
      fig.appendChild(this.thumb(g.ops, 240, 180));
      fig.insertAdjacentHTML('beforeend', `${opts.numbers ? `<span class="num">${i + 1}</span>` : ''}<figcaption><b>${esc(g.word)}</b><span style="color:${g.p.color}">por ${esc(g.p.name)}</span></figcaption>`);
      box.appendChild(fig);
    });
  }
  voteScreen() {
    if (this.votedFor !== this.j.gallery.length) { this.galleryInto($('#vgallery'), { numbers: true }); this.votedFor = this.j.gallery.length; }
    const voters = this.j.online.filter((p) => this.j.canVote(p)).length;
    $('#vcount').textContent = `${this.j.votes.size} de ${voters} já votaram`;
  }
  finalScreen() {
    this.votedFor = -1;
    const j = this.j, medal = ['🥇', '🥈', '🥉'];
    const items = j.passaMode ? [] : j.teamMode ? j.teamRanking().map((t) => ({ name: `Equipa ${t.name}`, score: t.score, color: t.color }))
      : j.ranking().map((p) => ({ name: p.name, score: p.score, color: p.color }));
    $('#final h1').textContent = j.passaMode ? 'Fim do Passa o Risco!' : 'Pódio';
    $('#podium').innerHTML = items.slice(0, 3).map((p, i) => `
      <div class="step s${i + 1}" style="--c:${p.color}"><span class="m">${medal[i]}</span><i>${esc(p.name.replace('Equipa ', '')[0].toUpperCase())}</i><b>${esc(p.name)}</b><span>${p.score} pts</span><div class="block">${i + 1}</div></div>`).join('')
      + (items.length > 3 ? `<p class="rest">${items.slice(3).map((p, i) => `${i + 4}.º ${esc(p.name)} (${p.score})`).join(' · ')}</p>` : '');
    const g = j.golden.map((i) => j.gallery[i]).filter(Boolean);
    $('#golden').innerHTML = g.length ? `🏅 Lápis de Ouro: ${g.map((x) => `<b>${esc(x.word)}</b> por <b style="color:${x.p.color}">${esc(x.p.name)}</b>`).join(' e ')} (+60 pontos)` : '';
    this.galleryInto($('#gallery'), { limit: 8 });
    $('#gallery-t').style.display = j.gallery.length ? '' : 'none';
  }
}

export { STATIC_MODE };
