// Adversário controlado pelo computador (quando só há um jogador). Produz o mesmo input que um telemóvel.
import { BTN } from '../../config.js';

export class Cpu {
  constructor(level = 0.6) {
    this.level = level; // 0..1
    this.inp = { x: 0, y: 0, b: 0, presses: [] };
    this.next = 0; this.hold = 0; this.plan = null;
  }
  press(bit, frame) { this.inp.presses.push({ bit, f: frame }); }

  think(me, foe, game) {
    const f = game.frame, inp = this.inp;
    inp.presses = inp.presses.filter((p) => f - p.f < 10);
    if (!game.canFight || me.state === 'ko') { inp.x = 0; inp.y = 0; inp.b = 0; return inp; }
    const dx = foe.x - me.x, dist = Math.abs(dx), dir = Math.sign(dx) || 1;
    const L = this.level;
    const foeAtk = foe.state === 'move' && foe.move && foe.move.active && foe.mt < foe.move.active[1];
    const proj = game.projectiles.find((p) => p.owner === foe && !p.dead && Math.abs(p.x - me.x) < 340 && Math.sign(me.x - p.x) === p.dir);

    // reações defensivas (com tempo de reação)
    if (f >= this.next) {
      if (proj && Math.random() < 0.5 + L * 0.3) {
        this.plan = Math.random() < 0.45 ? { x: dir * 0.8, y: 1, t: 6 } : { b: BTN.BLOCK, y: proj.kind === 'quake' ? -1 : 0, t: 30 };
        this.next = f + 14;
      } else if (foeAtk && dist < 260 && Math.random() < 0.25 + L * 0.45) {
        const low = foe.move.hit?.lvl === 'low';
        this.plan = { b: BTN.BLOCK, y: low ? -1 : 0, t: 18 + Math.random() * 12 };
        this.next = f + 12;
      } else if (foe.y > 40 && foe.vy < 2 && dist < 220 && Math.random() < 0.3 + L * 0.3) {
        this.plan = { press: BTN.SPECIAL, y: -1, t: 4 }; // anti-aéreo
        this.next = f + 30;
      } else {
        this.decide(me, foe, dist, dir, game);
      }
    }
    const p = this.plan;
    inp.x = 0; inp.y = 0; inp.b = 0;
    if (p) {
      inp.x = p.x || 0; inp.y = p.y || 0; inp.b = p.b || 0;
      if (p.press) { this.press(p.press, f); if (p.press2) this.plan = { ...p, press: p.press2, press2: null, delay: 10 }; else p.press = 0; }
      if (--p.t <= 0) this.plan = null;
    }
    return inp;
  }

  decide(me, foe, dist, dir, game) {
    const r = Math.random(), L = this.level, f = game.frame, id = me.def.id;
    const wait = Math.round(26 - L * 14 + Math.random() * 14);
    this.next = f + wait;
    if (me.meter >= 100 && dist < 380 && r < 0.35) { this.plan = { press: BTN.SUPER, t: 2 }; return; }
    if (dist > 430) {
      if ((id === 'mare' || id === 'basalto') && r < 0.32) { this.plan = { press: BTN.SPECIAL, t: 3 }; return; }
      if (id === 'lua' && r < 0.12) { this.plan = { press: BTN.SPECIAL, t: 3 }; return; }
      this.plan = { x: dir, t: 20 + Math.random() * 20 }; return;
    }
    if (dist > 150) {
      if (r < 0.1) { this.plan = { x: dir, y: 1, t: 5 }; return; } // salto para a frente
      if ((id === 'trovao' || id === 'basalto') && r < 0.2 && dist < 330) { this.plan = { press: BTN.SPECIAL, y: id === 'basalto' ? -1 : 0, t: 3 }; return; }
      if ((id === 'mare' || id === 'basalto') && r < 0.24) { this.plan = { press: BTN.SPECIAL, t: 3 }; return; }
      this.plan = { x: dir, t: 12 + Math.random() * 18 }; return;
    }
    // perto
    if (r < 0.28) { this.plan = { press: BTN.PUNCH, t: 3 }; this.combo(me); return; }
    if (r < 0.48) { this.plan = { press: BTN.KICK, t: 3 }; return; }
    if (r < 0.6) { this.plan = { press: BTN.KICK, y: -1, t: 10 }; return; }
    if (r < 0.7) { this.plan = { press: BTN.PUNCH, y: -1, t: 6 }; return; }
    if (r < 0.8) { this.plan = { b: BTN.BLOCK, t: 20 }; return; }
    if (r < 0.9) { this.plan = { x: -dir, t: 14 }; return; }
    this.plan = { x: -dir * 0.5, y: 1, t: 5 };
  }
  combo(me) {
    if (Math.random() < this.level * 0.6) this.plan.press2 = BTN.SPECIAL;
  }
}
