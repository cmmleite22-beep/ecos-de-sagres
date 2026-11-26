// Partículas, faíscas de impacto e desenho dos projéteis (onda, tsunami, terramoto, vulcão).
import { GROUND } from './cenarios.js';

export class Fx {
  constructor() { this.parts = []; }
  add(p) { if (this.parts.length < 260) this.parts.push(p); }

  hitSpark(x, y, dir, strong, block) {
    const col = block ? ['#9fd8ff', '#ffffff'] : strong ? ['#ffd34a', '#ffffff', '#ff7a3a'] : ['#fff2a0', '#ffffff'];
    this.add({ kind: 'ring', x, y, life: 0, max: strong ? 16 : 11, r: strong ? 70 : 44, color: col[0] });
    this.add({ kind: 'star', x, y, life: 0, max: 8, r: strong ? 60 : 38, rot: Math.random() * 3, color: '#ffffff' });
    const n = strong ? 16 : 9;
    for (let i = 0; i < n; i++) {
      const a = (Math.random() - 0.5) * 2.4 + (dir > 0 ? 0 : Math.PI);
      const v = 5 + Math.random() * (strong ? 11 : 7);
      this.add({ kind: 'line', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 2, life: 0, max: 10 + Math.random() * 10, color: col[i % col.length], w: 3 });
    }
  }
  dust(x, y, n = 8) {
    for (let i = 0; i < n; i++) this.add({ kind: 'dust', x: x + (Math.random() - 0.5) * 40, y: y + 4, vx: (Math.random() - 0.5) * 5, vy: Math.random() * 2.5, life: 0, max: 26 + Math.random() * 20, r: 8 + Math.random() * 12 });
  }
  spark(x, y, color = '#ffe26a') {
    this.add({ kind: 'bolt', x, y, life: 0, max: 7, r: 22 + Math.random() * 18, seed: Math.random() * 99, color });
  }
  splash(x, y, n = 6) {
    for (let i = 0; i < n; i++) this.add({ kind: 'drop', x, y, vx: (Math.random() - 0.5) * 7, vy: 3 + Math.random() * 6, life: 0, max: 30, r: 3 + Math.random() * 4 });
  }
  embers(x, y, n = 6) {
    for (let i = 0; i < n; i++) this.add({ kind: 'ember', x: x + (Math.random() - 0.5) * 50, y, vx: (Math.random() - 0.5) * 4, vy: 6 + Math.random() * 9, life: 0, max: 40, r: 3 + Math.random() * 5 });
  }

  update() {
    for (const p of this.parts) {
      p.life++;
      if (p.vx !== undefined) { p.x += p.vx; p.y += p.vy; }
      if (p.kind === 'line') { p.vx *= 0.86; p.vy *= 0.86; }
      if (p.kind === 'dust') { p.vx *= 0.92; p.vy *= 0.95; p.r += 0.5; }
      if (p.kind === 'drop' || p.kind === 'ember') p.vy -= 0.45;
    }
    this.parts = this.parts.filter((p) => p.life < p.max);
  }

  draw(ctx, camX, below) {
    for (const p of this.parts) {
      if ((p.kind === 'dust') !== !!below) continue;
      const x = p.x - camX, y = GROUND - p.y, k = p.life / p.max;
      switch (p.kind) {
        case 'ring':
          ctx.strokeStyle = p.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 6 * (1 - k) + 1;
          ctx.beginPath(); ctx.arc(x, y, p.r * (0.3 + k), 0, Math.PI * 2); ctx.stroke(); break;
        case 'star': {
          ctx.fillStyle = p.color; ctx.globalAlpha = 1 - k;
          const r = p.r * (1 - k * 0.5);
          ctx.beginPath();
          for (let i = 0; i < 16; i++) { const a = p.rot + i * Math.PI / 8; const rr = i % 2 ? r * 0.18 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
          ctx.fill(); break;
        }
        case 'line':
          ctx.strokeStyle = p.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = p.w;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.vx * 2.2, y + p.vy * 2.2); ctx.stroke(); break;
        case 'dust':
          ctx.fillStyle = `rgba(210,190,170,${0.4 * (1 - k)})`;
          ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2); ctx.fill(); break;
        case 'bolt': {
          ctx.strokeStyle = p.color; ctx.lineWidth = 2.5; ctx.globalAlpha = 1 - k;
          let s = p.seed;
          for (let b = 0; b < 3; b++) {
            ctx.beginPath(); ctx.moveTo(x, y);
            let bx = x, by = y;
            for (let i = 0; i < 4; i++) { s = (s * 9301 + 49297) % 233280; const a = (s / 233280) * Math.PI * 2; bx += Math.cos(a) * p.r / 3; by += Math.sin(a) * p.r / 3; ctx.lineTo(bx, by); }
            ctx.stroke();
          }
          break;
        }
        case 'drop':
          ctx.fillStyle = `rgba(200,240,255,${1 - k})`; ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2); ctx.fill(); break;
        case 'ember':
          ctx.fillStyle = k < 0.5 ? '#ffe070' : '#ff6a2a'; ctx.globalAlpha = 1 - k;
          ctx.fillRect(x - p.r / 2, y - p.r / 2, p.r, p.r); break;
      }
      ctx.globalAlpha = 1;
    }
  }
}

// ---------------------------------------------------------------- projéteis
export function drawProjectile(ctx, p, camX, t) {
  const x = p.x - camX, y = GROUND - p.y, d = p.dir;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(d, 1);
  switch (p.kind) {
    case 'wave': {
      const w = 1 + Math.sin(t * 0.6) * 0.06;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = ['rgba(40,140,220,0.55)', 'rgba(80,200,240,0.6)', 'rgba(220,250,255,0.85)'][i];
        ctx.beginPath();
        const r = (46 - i * 10) * w;
        ctx.ellipse(-i * 6, 0, r * 0.7, r, 0, -Math.PI / 2, Math.PI / 2);
        ctx.ellipse(-i * 6 - 18, 0, r * 0.45, r * 0.85, 0, Math.PI / 2, -Math.PI / 2, true);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(200,240,255,0.5)';
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-30 - i * 12 + Math.sin(t + i) * 4, Math.sin(t * 0.8 + i * 2) * 26, 6 - i * 0.7, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'tsunami': {
      const g = ctx.createLinearGradient(0, -230, 0, 0);
      g.addColorStop(0, '#e8fbff'); g.addColorStop(0.3, '#5cc8ec'); g.addColorStop(1, '#1a5a9a');
      ctx.fillStyle = g; ctx.globalAlpha = 0.92;
      ctx.beginPath(); ctx.moveTo(-160, y > 0 ? 115 : 115);
      ctx.moveTo(-170, 115); ctx.quadraticCurveTo(-60, 100, 40, 40);
      ctx.quadraticCurveTo(110, -60, 70, -120); ctx.quadraticCurveTo(30, -150, -10, -110);
      ctx.quadraticCurveTo(10, -90, 40, -95); ctx.quadraticCurveTo(10, -10, -80, 30);
      ctx.quadraticCurveTo(-140, 60, -170, 70); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 9; i++) { const a = i / 8; ctx.beginPath(); ctx.arc(70 - a * 90 + Math.sin(t + i) * 5, -118 + a * 70 + Math.cos(t * 1.3 + i) * 4, 10 - a * 4, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'quake': {
      ctx.fillStyle = '#4a3a34';
      for (let i = 0; i < 5; i++) {
        const h = 18 + ((i * 37 + Math.floor(p.t / 3)) % 5) * 7, xx = -i * 18;
        ctx.beginPath(); ctx.moveTo(xx - 12, 22); ctx.lineTo(xx - 3, 22 - h); ctx.lineTo(xx + 6, 22 - h * 0.6); ctx.lineTo(xx + 12, 22); ctx.fill();
        ctx.fillStyle = i % 2 ? '#6a5048' : '#2e2420';
      }
      ctx.fillStyle = 'rgba(255,140,60,0.7)'; ctx.fillRect(-80, 18, 90, 4);
      break;
    }
    case 'pillar': {
      if (p.t < 0) { // aviso: chão a rachar
        ctx.fillStyle = 'rgba(255,120,40,0.8)'; ctx.fillRect(-40, -2, 80, 5);
        break;
      }
      const k = Math.min(1, p.t / 6), h = 260 * k * (p.t > 22 ? Math.max(0, 1 - (p.t - 22) / 10) : 1);
      const g = ctx.createLinearGradient(0, -h, 0, 0);
      g.addColorStop(0, 'rgba(255,240,140,0.9)'); g.addColorStop(0.4, 'rgba(255,120,30,0.95)'); g.addColorStop(1, 'rgba(140,20,10,0.95)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-46, 0); ctx.quadraticCurveTo(-30 + Math.sin(t) * 6, -h * 0.5, -18, -h); ctx.lineTo(18, -h); ctx.quadraticCurveTo(30 + Math.cos(t) * 6, -h * 0.5, 46, 0); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,160,60,0.35)'; ctx.beginPath(); ctx.ellipse(0, -h * 0.5, 80, h * 0.6 + 20, 0, 0, Math.PI * 2); ctx.fill();
      break;
    }
  }
  ctx.restore();
}
