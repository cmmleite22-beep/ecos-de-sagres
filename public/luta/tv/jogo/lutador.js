// Lógica de um lutador: estados, golpes, física. Corre a 60 passos por segundo (determinístico).
import { P, NORMALS, poseAt } from './lutadores.js';
import { skeleton, updateTails, lerpPose, clonePose } from './desenho.js';
import { BTN } from '../../config.js';

export const GRAV = 0.78;
export const SCALE = 1.14; // tamanho dos lutadores no ecrã
const BUFFER = 9; // quadros em que um botão carregado fica "guardado" à espera de poder agir

export class Fighter {
  constructor(def, slot, game) {
    this.def = def; this.slot = slot; this.game = game;
    this.look = def.look;
    this.size = (def.look.size || 1) * SCALE;
    this.reset(slot === 0 ? 700 : 1300);
    this.roundsWon = 0;
    this.meter = 0;
  }

  reset(x) {
    this.x = x; this.y = 0; this.vx = 0; this.vy = 0;
    this.face = this.slot === 0 ? 1 : -1;
    this.hp = this.def.hp; this.shownHp = this.hp; this.redHp = this.hp;
    this.state = 'idle'; this.t = 0;
    this.move = null; this.mt = 0;
    this.stun = 0; this.juggle = 0; this.combo = 0;
    this.flash = 0; this.invuln = 0;
    this.pose = clonePose(P.idle);
    this.walkPh = 0; this.airUsed = false;
    this.tails = null;
    this.lastHitBy = null;
  }

  get grounded() { return this.y <= 0 && this.vy <= 0; }
  get crouching() { return this.state === 'crouch' || this.state === 'cblock' || (this.move && this.move.crouch) || (this.state === 'hit' && this.hitPose === 'hitLo'); }
  get actionable() { return ['idle', 'walk', 'crouch', 'block', 'cblock'].includes(this.state) && this.stun <= 0; }
  get blocking() { return (this.state === 'block' || this.state === 'cblock'); }

  // -------- entrada --------
  pressed(inp, bit) {
    const f = this.game.frame;
    const i = inp.presses.findIndex((p) => p.bit === bit && f - p.f <= BUFFER);
    if (i < 0) return false;
    inp.presses.splice(i, 1);
    return true;
  }

  startMove(m, kind) {
    this.move = m; this.mt = 0; this.state = 'move'; this.moveKind = kind;
    this.hits = 0; this.nextHit = 0; this.moveHit = false; this.projDone = false;
    if (!m.air || this.grounded) this.vx = 0;
    if (m.snd) this.game.sfx(m.snd);
    if (kind === 'super') {
      this.meter = 0;
      this.game.superFlash(this);
    }
  }

  tryAttack(inp, foe) {
    const down = inp.y < -0.5;
    if (this.meter >= 100 && this.pressed(inp, BTN.SUPER)) { this.startMove(this.def.specials.super, 'super'); return true; }
    if (this.pressed(inp, BTN.SPECIAL)) {
      const m = down ? this.def.specials.b : this.def.specials.a;
      if (m.proj && this.game.projectiles.some((p) => p.owner === this && !p.dead && p.kind !== 'pillar')) return false;
      this.startMove(m, 'special'); return true;
    }
    if (this.pressed(inp, BTN.KICK)) { this.startMove(this.scaled(down ? NORMALS.sweep : NORMALS.kick), 'normal'); return true; }
    if (this.pressed(inp, BTN.PUNCH)) { this.startMove(this.scaled(down ? NORMALS.cjab : NORMALS.jab), 'normal'); return true; }
    return false;
  }

  // ajusta a velocidade dos golpes normais ao lutador (Basalto mais lento, Trovão mais rápido)
  scaled(m) {
    const sp = this.def.speed;
    if (sp === 1) return m;
    const key = '_s' + sp;
    if (m[key]) return m[key];
    const k = 1 / sp;
    const r = { ...m, frames: Math.round(m.frames * k), keys: m.keys.map(([f, p]) => [Math.round(f * k), p]),
      active: m.active && [Math.round(m.active[0] * k), Math.round(m.active[1] * k)] };
    m[key] = r;
    return r;
  }

  // -------- passo de simulação --------
  update(inp, foe) {
    const g = this.game;
    this.t++;
    if (this.flash > 0) this.flash -= 0.12;
    if (this.invuln > 0) this.invuln--;
    // barra de vida "a escorrer"
    this.shownHp += (this.hp - this.shownHp) * 0.35;
    if (this.stun <= 0 && this.state !== 'hitair') this.redHp += (this.hp - this.redHp) * 0.06;

    const toFoe = Math.sign(foe.x - this.x) || this.face;
    const fwd = inp.x * toFoe; // >0 = para o adversário

    switch (this.state) {
      case 'intro': case 'win': case 'lose': case 'ko':
        break;
      case 'idle': case 'walk': case 'crouch': case 'block': case 'cblock': {
        if (this.grounded) this.face = toFoe;
        if (g.canFight && this.tryAttack(inp, foe)) break;
        const blockHeld = g.canFight && (inp.b & BTN.BLOCK);
        const down = inp.y < -0.5;
        if (blockHeld) { this.state = down ? 'cblock' : 'block'; this.vx = 0; break; }
        if (g.canFight && inp.y > 0.55) { this.state = 'prejump'; this.t = 0; this.jumpDir = Math.abs(inp.x) > 0.35 ? Math.sign(inp.x) : 0; this.vx = 0; break; }
        if (down) { this.state = 'crouch'; this.vx = 0; break; }
        if (g.canFight && Math.abs(inp.x) > 0.3) {
          this.state = 'walk';
          this.vx = Math.sign(inp.x) * (fwd > 0 ? this.def.walk : this.def.back);
          this.walkPh += (fwd > 0 ? 1 : -1) * 0.2 * (this.def.walk / 4);
        } else { this.state = 'idle'; this.vx = 0; }
        break;
      }
      case 'prejump':
        if (this.t >= 3) {
          this.state = 'air'; this.t = 0; this.airUsed = false;
          this.vy = this.def.jump; this.vx = this.jumpDir * 4.6;
          g.sfx('jump');
        }
        break;
      case 'air':
        if (!this.airUsed && g.canFight) {
          if (this.pressed(inp, BTN.KICK)) { this.airUsed = true; this.startMove(NORMALS.jkick, 'normal'); }
          else if (this.pressed(inp, BTN.PUNCH)) { this.airUsed = true; this.startMove(NORMALS.jpunch, 'normal'); }
        }
        break;
      case 'move': this.updateMove(inp, foe); break;
      case 'land':
        if (this.t >= this.landT) this.state = 'idle';
        break;
      case 'hit':
        this.vx *= 0.86;
        if (--this.stun <= 0) { this.state = 'idle'; this.combo = 0; }
        break;
      case 'bstun':
        this.vx *= 0.84;
        if (--this.stun <= 0) this.state = this.bstunCrouch ? 'cblock' : 'block';
        break;
      case 'hitair':
        break;
      case 'down':
        this.vx *= 0.8;
        if (this.hp <= 0) { this.state = 'ko'; break; }
        if (this.t >= 46) { this.state = 'getup'; this.t = 0; this.invuln = 24; }
        break;
      case 'getup':
        if (this.t >= 22) { this.state = 'idle'; this.combo = 0; this.juggle = 0; }
        break;
    }

    // física
    const airborne = this.y > 0 || this.vy > 0;
    if (airborne) {
      this.vy -= GRAV;
      this.y += this.vy;
      if (this.y <= 0) { this.y = 0; this.land(); }
    }
    this.x += this.vx;
    this.computePose(inp);
    const J = skeleton(this.pose, this.size);
    this.J = J;
    updateTails(this, J, this.size, g.stage?.wind || 0);
  }

  land() {
    const g = this.game;
    this.vy = 0;
    if (this.state === 'hitair') {
      this.state = 'down'; this.t = 0; this.vx *= 0.4;
      g.sfx('thud'); g.shake(6); g.dust(this.x, 0, 14);
      return;
    }
    if (this.state === 'move' && this.move.air) {
      this.move = null; this.state = 'land'; this.t = 0; this.landT = this.lastLandRec || 4; this.vx = 0;
      g.dust(this.x, 0, 6);
      return;
    }
    if (this.state === 'air' || this.state === 'move') { this.state = 'land'; this.t = 0; this.landT = 4; this.vx = 0; g.dust(this.x, 0, 6); g.sfx('land'); }
  }

  updateMove(inp, foe) {
    const m = this.move, g = this.game;
    this.mt++;
    this.lastLandRec = m.landRecovery || 4;
    if (m.vel && m.vel[this.mt]) { const [vx, vy] = m.vel[this.mt]; this.vx = vx * this.face; if (vy) this.vy = vy; }
    if (m.invuln && this.mt >= m.invuln[0] && this.mt <= m.invuln[1]) this.invuln = Math.max(this.invuln, 1);
    if (m.proj && this.mt === m.proj.f && !this.projDone) { this.projDone = true; g.spawnProjectile(this, m.proj); }
    if (m.shake && this.mt === m.shake.f) { g.shake(m.shake.amt); g.dust(this.x + this.face * 60, 0, 18); }
    if (m.spark && this.mt % 2 === 0 && this.J) g.sparkTrail(this, m.hit.pt);
    // cancelar um golpe normal que acertou num especial ou super
    if (this.moveKind === 'normal' && this.moveHit && !m.air) {
      if (this.meter >= 100 && this.pressed(inp, BTN.SUPER)) { this.startMove(this.def.specials.super, 'super'); return; }
      if (this.pressed(inp, BTN.SPECIAL)) { this.startMove(inp.y < -0.5 ? this.def.specials.b : this.def.specials.a, 'special'); return; }
    }
    if (this.mt >= m.frames && !(m.air && !this.grounded)) {
      this.move = null;
      if (this.y > 0) { this.state = 'air'; this.airUsed = true; }
      else this.state = m.crouch ? 'crouch' : 'idle';
    }
  }

  // hitbox ativa (em coordenadas de mundo, y para cima) ou null
  activeHitbox() {
    const m = this.move;
    if (this.state !== 'move' || !m || !m.hit || !m.active) return null;
    if (this.mt < m.active[0] || this.mt > m.active[1]) return null;
    if (this.hits >= (m.maxHits || 1)) return null;
    if (this.mt < this.nextHit) return null;
    const J = this.J; if (!J) return null;
    const p = J[m.hit.pt];
    const off = m.hit.off || [0, 0];
    return { x: this.x + this.face * (p[0] + off[0] * this.size), y: this.y + p[1] + off[1] * this.size, r: m.hit.r * this.size };
  }

  // caixa de dano: envolve as articulações (com margem)
  hurtbox() {
    const J = this.J;
    if (!J) return { x0: this.x - 30, x1: this.x + 30, y0: 0, y1: 200 };
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const k of ['head', 'neck', 'hip', 'shF', 'shB', 'elF', 'knF', 'knB', 'ff', 'fb', 'hf', 'hb']) {
      const p = J[k];
      const wx = this.x + this.face * p[0], wy = this.y + p[1];
      if (wx < x0) x0 = wx; if (wx > x1) x1 = wx; if (wy < y0) y0 = wy; if (wy > y1) y1 = wy;
    }
    const m = 14 * this.size;
    return { x0: x0 - m, x1: x1 + m, y0: y0 - m, y1: y1 + 26 * this.size };
  }

  // -------- receber golpes --------
  takeHit(h, attacker, isProj) {
    const g = this.game;
    const fromDir = Math.sign(this.x - attacker.x) || -attacker.face;
    const canBlock = (this.blocking || this.state === 'bstun' || ((this.game.inputOf(this).b & BTN.BLOCK) && this.actionable)) && this.grounded;
    const isCrouchBlock = this.state === 'cblock' || (this.state === 'bstun' && this.bstunCrouch) || this.game.inputOf(this).y < -0.5;
    const blockOk = canBlock && !(h.lvl === 'low' && !isCrouchBlock) && !(h.lvl === 'high' && isCrouchBlock);
    if (blockOk) {
      const chip = attacker.moveKind === 'normal' && !isProj ? 0 : Math.round(h.dmg * attacker.def.dmg * 0.18);
      this.hp = Math.max(1, this.hp - chip);
      this.state = 'bstun'; this.stun = h.bstun; this.bstunCrouch = isCrouchBlock; this.t = 0;
      this.vx = fromDir * h.push * 0.9; this.face = -fromDir;
      this.meter = Math.min(100, this.meter + 3);
      return 'block';
    }
    // armadura (Avalanche): aguenta o golpe sem recuar
    const m = this.move;
    if (m && m.armor && this.mt >= m.armor[0] && this.mt <= m.armor[1] && attacker.moveKind !== 'super') {
      this.hp -= Math.round(h.dmg * attacker.def.dmg * 0.6);
      this.flash = 1; this.flashColor = '#ffb070';
      if (this.hp <= 0) this.ko(fromDir);
      return 'armor';
    }
    const scale = Math.max(0.35, 1 - this.combo * 0.12);
    const dmg = Math.round(h.dmg * attacker.def.dmg * scale);
    this.hp -= dmg;
    this.combo++;
    this.flash = 1; this.flashColor = '#ffffff';
    this.move = null;
    this.meter = Math.min(100, this.meter + dmg * 0.07 + 2);
    this.face = -fromDir;
    if (this.hp <= 0) { this.hp = 0; this.ko(fromDir); return 'ko'; }
    const launch = h.launch || (h.lastLaunch && attacker.hits + 1 >= (attacker.move?.maxHits || 1) ? h.lastLaunch : null);
    if (launch || h.knock || this.y > 0 || this.state === 'hitair') {
      const [lx, ly] = launch || (h.knock ? [3.5, 6] : [3, 5]);
      this.state = 'hitair'; this.juggle++; this.t = 0;
      this.vx = fromDir * lx; this.vy = Math.max(ly - this.juggle * 1.5, 3);
      if (this.y <= 0) this.y = 0.1;
      return 'hit';
    }
    this.state = 'hit'; this.stun = h.stun; this.t = 0;
    this.hitPose = this.crouchingBefore ? 'hitLo' : (h.pt === 'ff' && h.lvl !== 'high' ? 'hitMid' : 'hitHi');
    this.vx = fromDir * h.push;
    return 'hit';
  }

  ko(dir) {
    this.hp = 0;
    this.state = 'hitair'; this.t = 0;
    this.vx = dir * 5; this.vy = 9;
    if (this.y <= 0) this.y = 0.1;
    this.move = null;
  }

  // -------- pose --------
  computePose(inp) {
    let p;
    switch (this.state) {
      case 'idle': case 'intro': case 'lose': {
        const k = (Math.sin(this.game.frame * 0.08 + this.slot) + 1) / 2;
        p = lerpPose(P.idle, P.idle2, k);
        break;
      }
      case 'walk': {
        p = clonePose(P.idle);
        const s = Math.sin(this.walkPh), c = Math.cos(this.walkPh);
        p.ff[0] += s * 20; p.ff[1] += Math.max(0, c) * 12;
        p.fb[0] -= s * 20; p.fb[1] += Math.max(0, -c) * 12;
        p.hip[1] -= Math.abs(c) * 3;
        p.hf[1] += s * 3;
        break;
      }
      case 'crouch': p = P.crouch; break;
      case 'block': p = P.block; break;
      case 'cblock': p = P.cblock; break;
      case 'bstun': p = this.bstunCrouch ? P.cblock : P.block; break;
      case 'prejump': p = lerpPose(P.idle, P.crouch, 0.5); break;
      case 'land': p = lerpPose(P.crouch, P.idle, Math.min(1, this.t / (this.landT || 4))); break;
      case 'air': {
        const k = Math.min(1, Math.max(0, (this.def.jump - this.vy) / (this.def.jump * 1.2)));
        p = lerpPose(P.jump, P.tuck, Math.sin(k * Math.PI));
        if (this.jumpDir && this.vx) p = { ...p, rot: -Math.sign(this.vx * this.face) * Math.sin(k * Math.PI) * 30 };
        break;
      }
      case 'move': p = poseAt(this.move.keys, this.mt); break;
      case 'hit': p = lerpPose(P[this.hitPose || 'hitHi'], P.idle, Math.max(0, 1 - this.stun / 10) * 0.6); break;
      case 'hitair': {
        p = clonePose(P.hitAir);
        p.rot = Math.min(110, 30 + (this.t || 0) * 2);
        break;
      }
      case 'down': case 'ko': p = P.down; break;
      case 'getup': p = this.t < 10 ? lerpPose(P.down, P.getup, this.t / 10) : lerpPose(P.getup, P.idle, Math.min(1, (this.t - 10) / 12)); break;
      case 'win': {
        const k = Math.min(1, this.t / 20);
        p = lerpPose(P.idle, (this.t >> 4) % 2 ? P.win : P.win2, k);
        break;
      }
      default: p = P.idle;
    }
    // suavizar transições de estado
    this.pose = lerpPose(this.pose, p, this.state === 'move' || this.state === 'hit' || this.state === 'hitair' ? 0.75 : 0.45);
    this.crouchingBefore = this.state === 'crouch' || this.state === 'cblock' || (this.move && this.move.crouch);
  }
}
