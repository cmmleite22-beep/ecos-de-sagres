// Motor do jogo: jogadores, fila, rondas, colisões, projéteis, câmara, desenho e HUD.
import { ROSTER, byId, P } from './lutadores.js';
import { Fighter, SCALE } from './lutador.js';
import { drawFighter, skeleton, updateTails, clonePose, lerpPose } from './desenho.js';
import { STAGES, WORLD_W, VIEW_W, VIEW_H, GROUND } from './cenarios.js';
import { Fx, drawProjectile } from './efeitos.js';
import { Som } from './som.js';
import { Cpu } from './ia.js';
import { BTN } from '../../config.js';

const FONT = '"Russo One", "Arial Black", Impact, sans-serif';
const ROUND_TIME = 99;
const STEP = 1000 / 60;

export class Motor {
  constructor(canvas, net, hud, quality) {
    this.canvas = canvas; this.net = net; this.hud = hud;
    this.scale = quality === 'high' ? 1.5 : 1;
    canvas.width = VIEW_W * this.scale; canvas.height = VIEW_H * this.scale;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.players = new Map(); // id -> { id, name, char, color, inp }
    this.queue = [];
    this.phase = 'lobby'; this.phaseT = 0;
    this.frame = 0; this.time = 0;
    this.stageIdx = 0; this.stages = {};
    this.fx = new Fx(); this.som = new Som();
    this.projectiles = [];
    this.fighters = null; this.slots = [null, null]; this.cpus = [null, null];
    this.hitstop = 0; this.freeze = 0; this.freezeBy = null; this.shakeAmt = 0;
    this.camX = (WORLD_W - VIEW_W) / 2;
    this.round = 1; this.timer = ROUND_TIME * 60;
    this.banner = null;
    this.stats = { hits: 0 };
    this.setStage(0);
    this.preview = [];
    this.bindNet();
  }

  // ------------------------------------------------------------ jogadores
  bindNet() {
    const n = this.net;
    n.on('join', (id, name, char) => this.addPlayer(id, name, char));
    n.on('leave', (id) => this.removePlayer(id));
    n.on('input', (id, m) => this.onInput(id, m));
    n.on('msg', (id, m) => {
      const p = this.players.get(id);
      if (m.t === 'ping') { n.send(id, { t: 'pong', ts: m.ts }); return; }
      if (!p) return;
      if (m.t === 'char' && ROSTER.some((r) => r.id === m.char)) { p.char = m.char; this.som.play('select'); this.lobbyChanged(); }
      if (m.t === 'start') this.requestStart();
      if (m.t === 'stage' && this.phase === 'lobby') { this.setStage(this.stageIdx + (m.dir < 0 ? -1 : 1)); this.lobbyChanged(); }
    });
    n.on('room', (code) => this.hud.setRoom(code));
  }

  addPlayer(id, name, char) {
    let p = this.players.get(id);
    if (!p) {
      if (this.players.size >= 4) { this.net.send(id, { t: 'error', reason: 'Sala cheia (máx. 4)' }); return; }
      p = { id, name: String(name || 'Jogador').slice(0, 12), char: byId(char).id, inp: { x: 0, y: 0, b: 0, presses: [] }, wins: 0 };
      this.players.set(id, p);
      this.queue.push(id);
      this.som.play('join');
    }
    p.color = byId(p.char).color;
    this.net.send(id, { t: 'welcome', id, name: p.name, char: p.char, color: p.color });
    this.lobbyChanged();
  }
  removePlayer(id) {
    if (!this.players.has(id)) return;
    this.players.delete(id);
    this.queue = this.queue.filter((q) => q !== id);
    // se estava a lutar, a máquina fica com o lugar
    this.slots.forEach((s, i) => { if (s === id) { this.slots[i] = 'cpu' + i; this.cpus[i] = this.cpus[i] || new Cpu(0.55); } });
    if (this.phase !== 'lobby' && this.slots.every((s) => String(s).startsWith('cpu'))) this.toLobby();
    this.lobbyChanged();
  }
  onInput(id, m) {
    const p = this.players.get(id); if (!p) return;
    const inp = p.inp;
    const newly = (m.b | 0) & ~inp.b;
    for (const bit of [1, 2, 4, 8, 16]) if (newly & bit) inp.presses.push({ bit, f: this.frame });
    if (inp.presses.length > 12) inp.presses.splice(0, inp.presses.length - 12);
    inp.x = +m.x || 0; inp.y = +m.y || 0; inp.b = m.b | 0;
  }
  inputOf(fighter) {
    const id = this.slots[fighter.slot];
    if (String(id).startsWith('cpu')) return this.cpus[fighter.slot].inp;
    return this.players.get(id)?.inp || { x: 0, y: 0, b: 0, presses: [] };
  }

  lobbyChanged() {
    const players = this.queue.map((id, i) => { const p = this.players.get(id); return { id, name: p.name, char: p.char, slot: i < 2 ? i : -1 }; });
    this.net.send(null, { t: 'lobby', players, phase: this.phase, stage: STAGES[this.stageIdx].name });
    this.hud.setLobby(players.map((p) => ({ ...p, def: byId(p.char) })), STAGES[this.stageIdx].name, this.phase);
  }

  setStage(i) {
    this.stageIdx = (i + STAGES.length) % STAGES.length;
    const S = STAGES[this.stageIdx];
    this.stage = this.stages[S.id] ||= S.make(this.scale);
  }

  // ------------------------------------------------------------ fluxo da partida
  requestStart() {
    if (this.phase === 'lobby' && this.queue.length) this.startMatch();
  }

  startMatch() {
    this.som.ensure();
    const ids = this.queue.slice(0, 2);
    this.cpus = [null, null];
    if (ids.length < 2) {
      const mine = this.players.get(ids[0]).char;
      const others = ROSTER.filter((r) => r.id !== mine);
      this.cpuChar = others[Math.floor(Math.random() * others.length)].id;
      ids.push('cpu1');
      this.cpus[1] = new Cpu(0.55);
    }
    this.slots = ids;
    const chars = ids.map((id) => (String(id).startsWith('cpu') ? this.cpuChar : this.players.get(id).char));
    this.fighters = chars.map((c, i) => new Fighter(byId(c), i, this));
    this.round = 1;
    this.som.music(this.stage.music);
    this.startRound();
    this.lobbyChanged();
  }

  startRound() {
    const mid = WORLD_W / 2;
    this.fighters.forEach((f, i) => { f.reset(mid + (i ? 230 : -230)); f.state = 'intro'; });
    this.projectiles = []; this.fx.parts = [];
    this.camX = mid - VIEW_W / 2;
    this.timer = ROUND_TIME * 60;
    this.setPhase('intro');
    this.banner = null;
  }

  setPhase(p) { this.phase = p; this.phaseT = 0; this.sendStates(true); }
  get canFight() { return this.phase === 'fight'; }

  toLobby() {
    this.setPhase('lobby');
    this.fighters = null; this.slots = [null, null];
    this.som.stopMusic();
    this.lobbyChanged();
  }

  // ------------------------------------------------------------ simulação
  step() {
    this.frame++;
    this.phaseT++;
    this.fx.update();
    if (this.shakeAmt > 0) this.shakeAmt *= 0.86;
    if (this.phase === 'lobby') { this.updatePreview(); return; }
    const [a, b] = this.fighters;

    if (this.freeze > 0) { this.freeze--; return; }
    if (this.hitstop > 0) { this.hitstop--; return; }
    // câmara lenta no K.O.
    if (this.phase === 'roundEnd' && this.ko && this.phaseT < 70 && this.phaseT % 2) return;

    // entradas
    const ia = this.inputOf(a), ib = this.inputOf(b);
    if (this.cpus?.[0]) this.cpus[0].think(a, b, this);
    if (this.cpus?.[1]) this.cpus[1].think(b, a, this);
    a.update(ia, b); b.update(ib, a);
    this.separate(a, b);
    this.resolveHits(a, b); this.resolveHits(b, a);
    this.updateProjectiles();

    // câmara
    const target = Math.max(0, Math.min(WORLD_W - VIEW_W, (a.x + b.x) / 2 - VIEW_W / 2));
    this.camX += (target - this.camX) * 0.15;

    switch (this.phase) {
      case 'intro':
        if (this.phaseT === 1) { this.banner = { text: `RONDA ${this.round}`, t: 0 }; this.som.play('bell'); }
        if (this.phaseT === 70) { this.banner = { text: 'LUTEM!', t: 0, color: '#ffcf3a' }; this.som.play('fight'); }
        if (this.phaseT >= 100) { this.fighters.forEach((f) => { f.state = 'idle'; }); this.setPhase('fight'); }
        break;
      case 'fight':
        if (this.phaseT > 20 && this.banner && this.banner.text === 'LUTEM!') this.banner = null;
        this.timer--;
        if (a.hp <= 0 || b.hp <= 0 || this.timer <= 0) this.endRound();
        break;
      case 'roundEnd':
        if (this.phaseT === 110) {
          const w = this.roundWinner;
          this.fighters.forEach((f) => { if (f.hp > 0 && f.grounded && (f === w || !w)) { f.state = 'win'; f.t = 0; f.move = null; } });
          if (w) this.banner = { text: `${w.def.short} VENCE`, t: 0, color: w.def.color, small: true };
        }
        if (this.phaseT >= 230) {
          if (this.fighters.some((f) => f.roundsWon >= 2)) this.endMatch();
          else { this.round++; this.startRound(); }
        }
        break;
      case 'matchEnd':
        if (this.phaseT >= 420) this.finishMatch();
        break;
    }
    if (this.frame % 6 === 0) this.sendStates();
  }

  endRound() {
    const [a, b] = this.fighters;
    this.ko = a.hp <= 0 || b.hp <= 0;
    let w = null;
    if (a.hp > b.hp) w = a; else if (b.hp > a.hp) w = b;
    this.roundWinner = w;
    if (w) w.roundsWon++; else { a.roundsWon++; b.roundsWon++; }
    this.banner = { text: this.ko ? 'K.O.' : 'TEMPO!', t: 0, color: '#ff4a3a', big: true };
    this.som.play(this.ko ? 'ko' : 'bell');
    if (this.ko) this.shake(16);
    this.setPhase('roundEnd');
  }

  endMatch() {
    const [a, b] = this.fighters;
    const w = a.roundsWon > b.roundsWon ? a : b.roundsWon > a.roundsWon ? b : null;
    this.matchWinner = w;
    this.fighters.forEach((f) => { if (f === w || !w) { f.state = 'win'; f.t = 0; } else { f.state = f.hp > 0 ? 'lose' : 'ko'; } });
    const wid = w ? this.slots[w.slot] : null;
    const wp = this.players.get(wid);
    if (wp) wp.wins++;
    this.banner = { text: w ? 'VITÓRIA!' : 'EMPATE', t: 0, color: w ? w.def.color : '#ffffff', sub: w ? `${wp ? wp.name + ' · ' : ''}${w.def.name}` : '' };
    this.som.play('win');
    this.setPhase('matchEnd');
  }

  finishMatch() {
    // o vencedor fica; o vencido vai para o fim da fila
    const w = this.matchWinner;
    if (w) {
      const loserId = this.slots[1 - w.slot];
      if (this.players.has(loserId)) { this.queue = this.queue.filter((q) => q !== loserId); this.queue.push(loserId); }
    }
    this.toLobby();
  }

  // ------------------------------------------------------------ colisões
  separate(a, b) {
    const minD = 74 * ((a.size + b.size) / 2);
    const dx = b.x - a.x;
    if (Math.abs(dx) < minD && Math.abs(a.y - b.y) < 120) {
      const push = (minD - Math.abs(dx)) / 2, s = Math.sign(dx) || (a.slot ? -1 : 1);
      a.x -= s * push; b.x += s * push;
    }
    // limites do mundo e do ecrã (os dois têm de caber)
    const lo = Math.max(40, this.camX + 30), hi = Math.min(WORLD_W - 40, this.camX + VIEW_W - 30);
    for (const f of [a, b]) { f.atWall = f.x <= lo || f.x >= hi; f.x = Math.max(lo, Math.min(hi, f.x)); }
    const maxD = VIEW_W - 100;
    if (Math.abs(b.x - a.x) > maxD) {
      const c = (a.x + b.x) / 2, s = Math.sign(b.x - a.x);
      a.x = c - s * maxD / 2; b.x = c + s * maxD / 2;
    }
  }

  resolveHits(att, def) {
    const hb = att.activeHitbox();
    if (!hb) return;
    if (def.invuln > 0 || def.state === 'down' || def.state === 'getup' || def.state === 'ko' || (def.hp <= 0)) return;
    const hu = def.hurtbox();
    const cx = Math.max(hu.x0, Math.min(hb.x, hu.x1)), cy = Math.max(hu.y0, Math.min(hb.y, hu.y1));
    if ((cx - hb.x) ** 2 + (cy - hb.y) ** 2 > hb.r * hb.r) return;
    const h = att.move.hit;
    att.hits++;
    att.nextHit = att.mt + (att.move.rehit || 999);
    att.moveHit = true;
    this.applyHit(att, def, h, (hb.x + cx) / 2, (hb.y + cy) / 2, false);
  }

  applyHit(att, def, h, x, y, isProj) {
    const res = def.takeHit(h, att, isProj);
    const dir = Math.sign(def.x - att.x) || att.face;
    if (res === 'block') {
      this.fx.hitSpark(x, y, dir, false, true); this.som.play('block');
      this.hitstop = 5;
      if (def.atWall && !isProj) att.vx = -dir * h.push * 0.6;
      this.buzz(def, 25);
      return;
    }
    const big = h.dmg * att.def.dmg >= 80 || res === 'ko';
    this.fx.hitSpark(x, y, dir, big, false);
    if (att.def.id === 'trovao' && !isProj) for (let i = 0; i < 3; i++) this.fx.spark(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30);
    if (att.def.id === 'mare') this.fx.splash(x, y, 5);
    if (att.def.id === 'basalto') this.fx.embers(x, y, 4);
    this.som.play(big ? 'hitBig' : 'hit');
    this.hitstop = Math.min(14, 6 + Math.round(h.dmg / 14));
    if (big) this.shake(7);
    att.meter = Math.min(100, att.meter + h.dmg * att.def.dmg * 0.11 + 3);
    if (def.atWall && !isProj && res === 'hit') att.vx = -dir * h.push * 0.7;
    this.stats.hits++;
    this.buzz(def, big ? 140 : 70);
    this.buzz(att, 20);
    if (res === 'ko') { this.hitstop = 22; }
  }

  // ------------------------------------------------------------ projéteis
  spawnProjectile(owner, s) {
    const face = owner.face;
    if (s.kind === 'volcano') {
      [170, 320, 470].forEach((d, i) => this.projectiles.push({ owner, kind: 'pillar', x: owner.x + face * d, y: 0, w: s.w, h: s.h, dir: face, vx: 0,
        spec: s, hits: 1, t: -8 - i * 12, cool: 0 }));
      return;
    }
    this.projectiles.push({ owner, kind: s.kind, x: owner.x + face * 80, y: s.y, w: s.w, h: s.h, dir: face, vx: face * s.vx, spec: s, hits: s.hits || 1, t: 0, cool: 0 });
  }
  updateProjectiles() {
    const ps = this.projectiles;
    for (const p of ps) {
      if (p.dead) continue;
      p.t++; p.x += p.vx;
      if (p.cool > 0) p.cool--;
      if (p.kind === 'pillar') {
        if (p.t === 0) { this.shake(8); this.som.play('quake'); this.fx.embers(p.x, 0, 10); }
        if (p.t > 32) p.dead = true;
        if (p.t < 0) continue;
      }
      if (p.kind === 'quake' && p.t % 4 === 0) this.fx.dust(p.x, 0, 2);
      if (p.kind === 'tsunami' && p.t % 3 === 0) this.fx.splash(p.x + p.dir * 40, 200, 2);
      if (p.x < this.camX - 200 || p.x > this.camX + VIEW_W + 200) { p.dead = true; continue; }
      const def = this.fighters.find((f) => f !== p.owner);
      // choque entre projéteis
      for (const q of ps) {
        if (q === p || q.dead || q.owner === p.owner || q.kind === 'pillar' || p.kind === 'pillar') continue;
        if (Math.abs(q.x - p.x) < (q.w + p.w) / 2 && Math.abs(q.y - p.y) < (q.h + p.h) / 2) {
          p.hits--; q.hits--;
          this.fx.hitSpark((p.x + q.x) / 2, (p.y + q.y) / 2, 1, true, true); this.som.play('block');
          if (p.hits <= 0) p.dead = true; if (q.hits <= 0) q.dead = true;
        }
      }
      if (p.dead || p.cool > 0) continue;
      if (def.invuln > 0 || ['down', 'getup', 'ko'].includes(def.state) || def.hp <= 0) continue;
      const hu = def.hurtbox();
      const px0 = p.x - p.w / 2, px1 = p.x + p.w / 2, py0 = p.y - p.h / 2, py1 = p.y + p.h / 2;
      if (p.kind === 'pillar') { /* coluna desde o chão */ }
      const y0 = p.kind === 'pillar' ? 0 : py0, y1 = p.kind === 'pillar' ? p.h : py1;
      if (px1 < hu.x0 || px0 > hu.x1 || y1 < hu.y0 || y0 > hu.y1) continue;
      const s = p.spec;
      const h = { dmg: s.dmg, stun: s.stun, bstun: s.bstun, push: s.push, lvl: s.lvl || 'mid', launch: p.hits <= 1 ? s.launch : null, pt: 'proj' };
      this.applyHit(p.owner, def, h, (Math.max(px0, hu.x0) + Math.min(px1, hu.x1)) / 2, (Math.max(y0, hu.y0) + Math.min(y1, hu.y1)) / 2, true);
      p.hits--; p.cool = s.rehit || 0;
      if (p.hits <= 0) p.dead = true;
    }
    this.projectiles = ps.filter((p) => !p.dead);
  }

  // ------------------------------------------------------------ chamadas dos lutadores
  sfx(n) { this.som.play(n); }
  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }
  dust(x, y, n) { this.fx.dust(x, y, n); }
  sparkTrail(f, pt) {
    const p = f.J?.[pt]; if (!p) return;
    this.fx.spark(f.x + f.face * p[0], f.y + p[1], f.def.id === 'trovao' ? '#ffe26a' : '#c9e8ff');
  }
  superFlash(f) {
    this.freeze = 46; this.freezeBy = f; this.freezeT = 0;
    this.som.play('super');
    this.cutin = { f, t: 0 };
  }
  buzz(f, ms) {
    const id = this.slots[f.slot];
    if (this.players.has(id)) this.net.send(id, { t: 'buzz', ms });
  }

  sendStates(force) {
    for (const [id, p] of this.players) {
      const slot = this.slots.indexOf(id);
      const f = slot >= 0 && this.fighters ? this.fighters[slot] : null;
      const foe = f ? this.fighters[1 - slot] : null;
      const st = { t: 'state', phase: this.phase, slot, char: p.char };
      if (f) Object.assign(st, { hp: Math.max(0, Math.round(f.hp)), max: f.def.hp, meter: Math.round(f.meter), rounds: f.roundsWon, foeRounds: foe.roundsWon,
        foe: String(this.slots[1 - slot]).startsWith('cpu') ? 'Máquina' : this.players.get(this.slots[1 - slot])?.name, timer: Math.ceil(this.timer / 60),
        result: this.phase === 'matchEnd' ? (this.matchWinner === f ? 'win' : this.matchWinner ? 'lose' : 'draw') : null });
      else st.queue = this.queue.indexOf(id);
      const key = JSON.stringify(st);
      if (!force && p.lastState === key) continue;
      p.lastState = key;
      this.net.send(id, st);
    }
  }

  // ------------------------------------------------------------ pré-visualização no ecrã de escolha
  updatePreview() {
    const ids = this.queue.slice(0, 2);
    ids.forEach((id, i) => {
      const p = this.players.get(id);
      let pv = this.preview[i];
      if (!pv || pv.char !== p.char) {
        const def = byId(p.char);
        pv = this.preview[i] = { char: p.char, def, look: def.look, size: (def.look.size || 1) * SCALE, x: i ? 1000 + 190 : 1000 - 190, y: 0, face: i ? -1 : 1, pose: clonePose(P.idle), vx: 0, vy: 0, t: 0 };
        pv.flash = 1;
      }
      pv.t++;
      if (pv.flash > 0) pv.flash -= 0.06;
      const k = (Math.sin(this.frame * 0.08 + i) + 1) / 2;
      pv.pose = pv.t < 30 ? lerpPose(P.win, P.idle, pv.t / 30) : lerpPose(P.idle, P.idle2, k);
      pv.J = skeleton(pv.pose, pv.size);
      updateTails(pv, pv.J, pv.size, this.stage.wind);
    });
    this.preview.length = ids.length;
    this.camX += ((WORLD_W - VIEW_W) / 2 - this.camX) * 0.1;
  }

  // ------------------------------------------------------------ desenho
  render() {
    const ctx = this.ctx, S = this.scale;
    const t = this.time;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    const sh = this.shakeAmt > 0.5 ? this.shakeAmt : 0;
    const ox = sh ? (Math.random() - 0.5) * sh : 0, oy = sh ? (Math.random() - 0.5) * sh : 0;
    ctx.save();
    ctx.translate(ox, oy);
    const camX = this.camX;
    this.stage.back(ctx, camX, t);
    const list = this.phase === 'lobby' ? this.preview : (this.fighters || []);
    // sombras
    for (const f of list) {
      const x = f.x - camX, k = Math.max(0.3, 1 - f.y / 300);
      ctx.fillStyle = this.stage.shadow;
      ctx.beginPath(); ctx.ellipse(x, GROUND + 4, 62 * k * (f.size || 1), 12 * k, 0, 0, Math.PI * 2); ctx.fill();
    }
    this.fx.draw(ctx, camX, true);
    // quem ataca fica por cima
    const order = [...list].sort((p, q) => (p.state === 'move' ? 1 : 0) - (q.state === 'move' ? 1 : 0));
    const dim = this.freeze > 0;
    for (const f of order) {
      drawFighter(ctx, { x: f.x - camX, y: f.y, size: f.size, face: f.face, pose: f.pose, look: f.look, tails: f.tails, flash: f.flash > 0 ? f.flash : 0, flashColor: f.flashColor,
        hurtFace: f.state === 'hit' || f.state === 'hitair' || f.state === 'down' || f.state === 'ko' }, { ground: GROUND, rim: this.stage.rim });
      if (f.meter >= 100 && this.phase === 'fight') this.aura(ctx, f, camX, t);
    }
    for (const p of this.projectiles) drawProjectile(ctx, p, camX, t * 10);
    this.fx.draw(ctx, camX, false);
    this.stage.front(ctx, camX, t);
    ctx.restore();
    if (dim) this.drawCutin(ctx);
    if (this.phase !== 'lobby') this.drawHud(ctx);
    else this.drawLobbyNames(ctx);
    if (this.banner) this.drawBanner(ctx);
  }

  aura(ctx, f, camX, t) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const x = f.x - camX, y = GROUND - f.y - 100;
    const g = ctx.createRadialGradient(x, y, 20, x, y, 120);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.7, hexA(f.def.color, 0.12 + Math.sin(t * 8) * 0.05)); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 130, y - 140, 260, 280);
    ctx.restore();
  }

  drawCutin(ctx) {
    const c = this.cutin; if (!c) return;
    const k = 46 - this.freeze;
    ctx.fillStyle = `rgba(5,5,15,${Math.min(0.65, k * 0.06)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const slide = Math.min(1, k / 8);
    const y = 250;
    ctx.save();
    ctx.fillStyle = c.f.def.color;
    ctx.beginPath(); ctx.moveTo(-100 + (1 - slide) * -1400, y); ctx.lineTo(VIEW_W + 100, y - 60); ctx.lineTo(VIEW_W + 100, y + 120); ctx.lineTo(-100 + (1 - slide) * -1400, y + 180); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 12; i++) ctx.fillRect(((i * 160 + k * 40) % 1600) - 200, y - 40 + i * 13, 120, 3);
    // retrato grande
    const k1 = c.f.def.specials.super.keys[1][1];
    const pose = typeof k1 === 'string' ? P[k1] : k1;
    drawFighter(ctx, { x: 300, y: 0, face: 1, pose, look: c.f.look, tails: null }, { ground: y + 330, rim: '#ffffff', scale: 1.5 });
    ctx.font = `64px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    outlineText(ctx, c.f.def.specials.super.name, 520, y + 40, '#ffffff', '#120c0a', 8);
    ctx.font = `30px ${FONT}`;
    outlineText(ctx, c.f.def.name, 524, y + 100, '#fff3c4', '#120c0a', 6);
    ctx.restore();
  }

  drawHud(ctx) {
    const [a, b] = this.fighters;
    const names = this.slots.map((id) => (String(id).startsWith('cpu') ? 'MÁQUINA' : (this.players.get(id)?.name || '').toUpperCase()));
    for (const f of [a, b]) {
      const right = f.slot === 1;
      const x0 = right ? 700 : 60, w = 520, y = 34, h = 28;
      // moldura
      ctx.fillStyle = 'rgba(10,8,12,0.75)'; roundRect(ctx, x0 - 6, y - 6, w + 12, h + 12, 8); ctx.fill();
      const pct = Math.max(0, f.shownHp / f.def.hp), red = Math.max(0, f.redHp / f.def.hp);
      const bx = (p) => (right ? x0 : x0 + w * (1 - p));
      ctx.fillStyle = '#c82a2a'; ctx.fillRect(bx(red), y, w * red, h);
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      const low = pct < 0.3;
      g.addColorStop(0, low ? '#ffb070' : '#fff27a'); g.addColorStop(0.5, low ? '#ff6a2a' : '#f2c219'); g.addColorStop(1, low ? '#b83a10' : '#c88a10');
      ctx.fillStyle = g; ctx.fillRect(bx(pct), y, w * pct, h);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(bx(pct), y + 3, w * pct, 4);
      ctx.strokeStyle = '#f5ead0'; ctx.lineWidth = 2; ctx.strokeRect(x0, y, w, h);
      // nomes
      ctx.font = `26px ${FONT}`; ctx.textBaseline = 'top'; ctx.textAlign = right ? 'right' : 'left';
      outlineText(ctx, f.def.short, right ? x0 + w : x0, y + h + 8, f.def.color, '#120c0a', 5);
      ctx.font = `16px ${FONT}`;
      const nw = ctx.measureText(f.def.short).width;
      ctx.font = `17px ${FONT}`;
      outlineText(ctx, names[f.slot], right ? x0 + w - 0 : x0, y + h + 40, '#f5ead0', '#120c0a', 4);
      // rondas ganhas
      for (let i = 0; i < 2; i++) {
        const cx = right ? x0 + 18 + i * 30 : x0 + w - 18 - i * 30, cy = y + h + 22;
        ctx.fillStyle = '#120c0a'; ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = i < f.roundsWon ? '#ffcf3a' : '#3a3036'; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
      }
      // barra de super
      const mx = right ? VIEW_W - 60 - 300 : 60, my = VIEW_H - 40, mw = 300;
      ctx.fillStyle = 'rgba(10,8,12,0.75)'; roundRect(ctx, mx - 4, my - 4, mw + 8, 22, 6); ctx.fill();
      const full = f.meter >= 100;
      const mp = f.meter / 100;
      ctx.fillStyle = full ? (Math.floor(this.frame / 6) % 2 ? '#ffffff' : f.def.color) : hexA(f.def.color, 0.85);
      ctx.fillRect(right ? mx + mw * (1 - mp) : mx, my, mw * mp, 14);
      ctx.font = `16px ${FONT}`; ctx.textBaseline = 'bottom'; ctx.textAlign = right ? 'right' : 'left';
      outlineText(ctx, full ? 'SUPER PRONTO!' : 'SUPER', right ? mx + mw : mx, my - 6, full ? '#ffffff' : '#d8ccb0', '#120c0a', 4);
      // combo
      if (f.combo >= 2 && (f.state === 'hit' || f.state === 'hitair')) {
        const ax = right ? 120 : VIEW_W - 120;
        ctx.font = `46px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        outlineText(ctx, `${f.combo}`, ax, 220, '#ffcf3a', '#120c0a', 7);
        ctx.font = `20px ${FONT}`;
        outlineText(ctx, 'GOLPES', ax, 256, '#ffffff', '#120c0a', 5);
      }
    }
    // relógio
    ctx.fillStyle = 'rgba(10,8,12,0.8)'; roundRect(ctx, 600, 22, 80, 62, 10); ctx.fill();
    ctx.font = `44px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const secs = Math.max(0, Math.ceil(this.timer / 60));
    outlineText(ctx, String(secs).padStart(2, '0'), 640, 55, secs <= 10 && this.phase === 'fight' ? '#ff6a4a' : '#ffffff', '#120c0a', 5);
  }

  drawLobbyNames(ctx) {
    this.preview.forEach((pv, i) => {
      const x = pv.x - this.camX;
      ctx.font = `30px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      outlineText(ctx, pv.def.short, x, GROUND + 18, pv.def.color, '#120c0a', 6);
    });
    if (this.preview.length === 2) {
      ctx.font = `60px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      outlineText(ctx, 'VS', 1000 - this.camX, GROUND - 130, '#ffcf3a', '#120c0a', 9);
    }
  }

  drawBanner(ctx) {
    const b = this.banner;
    b.t++;
    const k = Math.min(1, b.t / 10);
    const sc = b.big ? 1.6 - 0.6 * k : 1.25 - 0.25 * k;
    ctx.save();
    ctx.translate(VIEW_W / 2, VIEW_H / 2 - 40);
    ctx.scale(sc, sc);
    ctx.globalAlpha = k;
    ctx.font = `${b.big ? 150 : b.small ? 70 : 110}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const g = ctx.createLinearGradient(0, -70, 0, 70);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, b.color || '#ffe9a0'); g.addColorStop(1, shadeHex(b.color || '#ffcf3a'));
    outlineText(ctx, b.text, 0, 0, g, '#120c0a', 14);
    if (b.sub) { ctx.font = `34px ${FONT}`; outlineText(ctx, b.sub, 0, 90, '#ffffff', '#120c0a', 7); }
    ctx.restore();
  }

  // ------------------------------------------------------------ ciclo
  loop() {
    let last = performance.now(), acc = 0;
    const tick = (now) => {
      let dt = now - last; last = now;
      if (dt > 250) dt = 250;
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 5) { this.step(); acc -= STEP; n++; }
      if (n === 5) acc = 0;
      this.time += dt / 1000;
      this.render();
      this.hud.fps(dt / 1000);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------ teclado (PC)
  enableKeyboard() {
    const maps = [
      { id: 'kb1', name: 'Teclado 1', keys: { KeyA: 'L', KeyD: 'R', KeyW: 'U', KeyS: 'D', KeyJ: BTN.PUNCH, KeyK: BTN.KICK, KeyL: BTN.SPECIAL, KeyU: BTN.BLOCK, KeyI: BTN.SUPER } },
      { id: 'kb2', name: 'Teclado 2', keys: { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D', Numpad1: BTN.PUNCH, Numpad2: BTN.KICK, Numpad3: BTN.SPECIAL, Numpad0: BTN.BLOCK, Numpad5: BTN.SUPER } },
    ];
    const held = new Set();
    const apply = (m) => {
      let x = 0, y = 0, b = 0;
      for (const [code, v] of Object.entries(m.keys)) {
        if (!held.has(code)) continue;
        if (v === 'L') x -= 1; else if (v === 'R') x += 1; else if (v === 'U') y += 1; else if (v === 'D') y -= 1; else b |= v;
      }
      this.onInput(m.id, { x, y, b });
    };
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.som.ensure();
      if (e.code === 'Enter') { if (!this.players.size) this.addPlayer('kb1', 'Teclado 1', 'mare'); this.requestStart(); return; }
      const m = maps.find((mm) => e.code in mm.keys);
      if (!m) return;
      if (!this.players.has(m.id) && this.phase === 'lobby') this.addPlayer(m.id, m.name, m.id === 'kb1' ? 'mare' : 'trovao');
      // no ecrã de escolha: soco/pontapé trocam de lutador
      if (this.phase === 'lobby' && this.players.has(m.id) && (m.keys[e.code] === BTN.PUNCH || m.keys[e.code] === BTN.KICK)) {
        const p = this.players.get(m.id), i = ROSTER.findIndex((r) => r.id === p.char);
        p.char = ROSTER[(i + (m.keys[e.code] === BTN.PUNCH ? 1 : ROSTER.length - 1)) % ROSTER.length].id; this.som.play('select'); this.lobbyChanged();
      }
      held.add(e.code); apply(m); e.preventDefault();
    });
    addEventListener('keyup', (e) => { held.delete(e.code); const m = maps.find((mm) => e.code in mm.keys); if (m && this.players.has(m.id)) apply(m); });
  }
}

// ------------------------------------------------------------ utilitários de desenho
function outlineText(ctx, text, x, y, fill, stroke, w) {
  ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  ctx.strokeStyle = stroke; ctx.lineWidth = w; ctx.strokeText(text, x, y);
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function hexA(hex, a) { const h = hex.replace('#', ''); return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`; }
function shadeHex(hex) { const h = hex.replace('#', ''); const c = [0, 2, 4].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * 0.55)); return `rgb(${c.join(',')})`; }
