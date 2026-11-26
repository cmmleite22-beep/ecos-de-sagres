// Cenários com várias camadas de profundidade (parallax). As camadas fixas são pintadas uma vez
// em canvases fora do ecrã; por cima anima-se mar, nuvens, aves, nevoeiro, elétrico, luzes…
// Mundo: 2000 px de largura; ecrã lógico: 1280×720; chão (pés) em y = 640.

export const WORLD_W = 2000, VIEW_W = 1280, VIEW_H = 720, GROUND = 640;

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function layer(factor, scale, h = VIEW_H) {
  const w = Math.ceil(VIEW_W + (WORLD_W - VIEW_W) * factor) + 4;
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * scale); c.height = Math.ceil(h * scale);
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  return { c, ctx, w, h, factor };
}
const lg = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
const rg = (ctx, x, y, r0, r1, stops) => { const g = ctx.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };

class Stage {
  constructor(scale) { this.scale = scale; this.layers = []; this.t = 0; }
  blit(ctx, L, camX, y = 0) { ctx.drawImage(L.c, -camX * L.factor, y, L.w, L.h); }
}

// ======================================================================= 1. Cais ao pôr do sol
class Cais extends Stage {
  constructor(scale) {
    super(scale);
    this.name = 'Cais de Ponta Delgada'; this.rim = '#ffb070'; this.wind = 0.6; this.music = 0;
    this.shadow = 'rgba(40,10,30,0.45)';
    const R = rng(7);
    // céu
    const sky = layer(0, scale); const c = sky.ctx;
    c.fillStyle = lg(c, 0, 0, 0, 440, [[0, '#231a46'], [0.35, '#6b2f6a'], [0.65, '#c8566a'], [0.85, '#f38b4e'], [1, '#ffd27a']]);
    c.fillRect(0, 0, VIEW_W, VIEW_H);
    c.fillStyle = rg(c, 760, 420, 10, 420, [[0, 'rgba(255,240,180,0.9)'], [0.15, 'rgba(255,190,110,0.45)'], [1, 'rgba(255,150,90,0)']]);
    c.fillRect(0, 0, VIEW_W, VIEW_H);
    c.fillStyle = '#fff1c2'; c.beginPath(); c.arc(760, 418, 54, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 70; i++) { // estrelas a aparecer no topo
      c.fillStyle = `rgba(255,255,255,${0.2 + R() * 0.5})`; c.fillRect(R() * VIEW_W, R() * 140, 1.6, 1.6);
    }
    this.sky = sky;
    // nuvens (camada lenta animada)
    this.clouds = Array.from({ length: 9 }, (_, i) => ({ x: R() * 1500, y: 90 + R() * 230, w: 160 + R() * 260, h: 14 + R() * 16, s: 0.05 + R() * 0.12, a: 0.35 + R() * 0.4, hue: i % 3 }));
    // ilha distante com vulcão e farol
    const far = layer(0.12, scale); const f = far.ctx;
    f.fillStyle = '#6a3a72';
    f.beginPath(); f.moveTo(0, 440); f.lineTo(120, 420); f.lineTo(330, 340); f.lineTo(420, 332); f.lineTo(560, 410); f.lineTo(700, 430);
    f.lineTo(980, 436); f.lineTo(1150, 400); f.lineTo(1280, 380); f.lineTo(1374, 400); f.lineTo(1374, 440); f.closePath(); f.fill();
    f.fillStyle = 'rgba(255,170,140,0.25)'; f.fillRect(0, 425, far.w, 15);
    f.fillStyle = '#4c2a58'; f.beginPath(); f.moveTo(1150, 440); f.lineTo(1200, 392); f.lineTo(1290, 384); f.lineTo(1374, 410); f.lineTo(1374, 440); f.fill();
    f.fillStyle = '#efe6dc'; f.fillRect(1238, 344, 12, 44); f.fillStyle = '#c33a32'; f.fillRect(1238, 356, 12, 8); f.fillRect(1238, 374, 12, 6);
    f.fillStyle = '#3b2030'; f.fillRect(1235, 340, 18, 6);
    this.light = { x: 1244, y: 348, f: 0.12 };
    this.far = far;
    // barcos (sprites)
    this.boats = [0, 1, 2].map((i) => ({ spr: boat(scale, ['#2f6fb5', '#c8402e', '#2a9a62'][i], i), x: 300 + i * 520 + R() * 120, y: 500 + i * 10, f: 0.22 + i * 0.04, ph: R() * 6 }));
    // vila (casas brancas com cantos de basalto, igreja)
    const mid = layer(0.42, scale); const m = mid.ctx;
    m.fillStyle = '#3c2a3a'; m.fillRect(0, 548, mid.w, 30); // muralha do porto
    m.fillStyle = 'rgba(255,190,120,0.25)'; m.fillRect(0, 548, mid.w, 3);
    let x = 0;
    while (x < mid.w) {
      const w = 70 + R() * 70, h = 60 + R() * 70, y0 = 548 - h;
      if (R() < 0.12 && x > 200) { church(m, x, 548, scale); x += 150; continue; }
      const wall = ['#f2e6da', '#efd9c8', '#f6eee4', '#e9d2c0', '#f1e2b8'][Math.floor(R() * 5)];
      m.fillStyle = lg(m, x, 0, x + w, 0, [[0, wall], [1, '#c9a9a0']]); m.fillRect(x, y0, w, h);
      m.fillStyle = '#2a2026'; m.fillRect(x, y0, 5, h); m.fillRect(x + w - 5, y0, 5, h); m.fillRect(x, y0, w, 4); // cunhais de basalto
      m.fillStyle = '#b5523a'; m.beginPath(); m.moveTo(x - 6, y0); m.lineTo(x + w / 2, y0 - 22 - R() * 10); m.lineTo(x + w + 6, y0); m.fill();
      m.fillStyle = 'rgba(0,0,0,0.25)'; m.fillRect(x - 6, y0, w + 12, 3);
      for (let wy = y0 + 14; wy < 530; wy += 30) for (let wx = x + 14; wx < x + w - 20; wx += 26) {
        const lit = R() < 0.4;
        m.fillStyle = '#2a2026'; m.fillRect(wx - 2, wy - 2, 16, 22);
        m.fillStyle = lit ? '#ffd27a' : ['#3a6ea8', '#2f7f5f', '#7a3a3a'][Math.floor(R() * 3)]; m.fillRect(wx, wy, 12, 18);
      }
      x += w + 4 + R() * 10;
    }
    for (let i = 0; i < 6; i++) palm(m, 120 + i * 260 + R() * 80, 552, 70 + R() * 30, R);
    this.mid = mid;
    // chão do cais: calçada portuguesa em ondas preto e branco + pedras de borda
    const near = layer(1, scale); const n = near.ctx;
    n.fillStyle = '#2a2224'; n.fillRect(0, 578, near.w, 20);
    n.fillStyle = lg(n, 0, 590, 0, 720, [[0, '#cfc6bb'], [1, '#9f978e']]); n.fillRect(0, 590, near.w, 130);
    n.save(); n.beginPath(); n.rect(0, 596, near.w, 124); n.clip();
    n.strokeStyle = '#2d2a2c'; n.lineWidth = 9;
    for (let row = 0; row < 7; row++) { // ondas do "mar largo" da calçada
      const yb = 612 + row * 22;
      n.beginPath();
      for (let xx = -40; xx < near.w + 40; xx += 8) n.lineTo(xx, yb + Math.sin(xx / 70 + row) * 8 * (1 + row * 0.15));
      n.stroke();
    }
    for (let i = 0; i < 2600; i++) { n.fillStyle = `rgba(0,0,0,${R() * 0.12})`; n.fillRect(R() * near.w, 596 + R() * 124, 3, 3); }
    n.restore();
    n.fillStyle = lg(n, 0, 586, 0, 600, [[0, '#7c726c'], [1, '#4a403c']]); n.fillRect(0, 586, near.w, 12); // lancil
    for (let bx = 60; bx < near.w; bx += 340 + R() * 160) bollard(n, bx, 600);
    for (let bx = 230; bx < near.w; bx += 520 + R() * 200) { crates(n, bx, 600, R); }
    nets(n, 980, 600); nets(n, 1720, 600);
    this.lamps = [];
    for (let lx = 160; lx < near.w; lx += 600) { lamp(n, lx, 600); this.lamps.push(lx); }
    this.near = near;
    this.gulls = Array.from({ length: 4 }, () => ({ x: R() * 1280, y: 120 + R() * 180, v: 0.6 + R() * 0.8, ph: R() * 6, s: 0.6 + R() * 0.6 }));
  }
  back(ctx, camX, t) {
    ctx.drawImage(this.sky.c, 0, 0, VIEW_W, VIEW_H);
    for (const cl of this.clouds) {
      const x = ((cl.x + t * cl.s * 10 - camX * 0.05) % 1700) - 220;
      ctx.fillStyle = ['rgba(255,170,150,', 'rgba(250,120,130,', 'rgba(255,210,160,'][cl.hue] + cl.a + ')';
      ctx.beginPath(); ctx.ellipse(x, cl.y, cl.w / 2, cl.h / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + cl.w * 0.2, cl.y - cl.h * 0.4, cl.w / 3, cl.h / 2.4, 0, 0, Math.PI * 2); ctx.fill();
    }
    // feixe do farol
    const L = this.light, lx = L.x - camX * L.f, a = t * 0.9;
    const reach = 420 * Math.abs(Math.cos(a));
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,240,190,0.16)';
    ctx.beginPath(); ctx.moveTo(lx, L.y); ctx.lineTo(lx + Math.sign(Math.cos(a)) * reach, L.y - 18); ctx.lineTo(lx + Math.sign(Math.cos(a)) * reach, L.y + 14); ctx.fill();
    ctx.fillStyle = rg(ctx, lx, L.y, 0, 18, [[0, 'rgba(255,250,210,0.9)'], [1, 'rgba(255,240,190,0)']]);
    ctx.fillRect(lx - 18, L.y - 18, 36, 36);
    ctx.restore();
    this.blit(ctx, this.far, camX);
    // mar
    ctx.fillStyle = lg(ctx, 0, 438, 0, 580, [[0, '#d97c6a'], [0.25, '#8a4a6e'], [1, '#2e2a52']]);
    ctx.fillRect(0, 438, VIEW_W, 142);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) { // reflexo do sol a cintilar
      const y = 444 + i * 5;
      const w = (60 - i * 1.4) * (0.7 + 0.3 * Math.sin(t * 3 + i * 1.7));
      ctx.fillStyle = `rgba(255,220,150,${0.5 - i * 0.017})`;
      ctx.fillRect(760 - camX * 0.1 - w / 2 + Math.sin(t * 2 + i) * 6, y, w, 2.2);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,200,180,0.18)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 9; i++) {
      const y = 460 + i * 13, off = (t * (8 + i * 2) - camX * (0.15 + i * 0.03)) % 90;
      ctx.beginPath();
      for (let x = -90 + off; x < VIEW_W; x += 90) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 22, y - 3, x + 44, y); }
      ctx.stroke();
    }
    for (const b of this.boats) {
      const x = b.x - camX * b.f, y = b.y + Math.sin(t * 1.4 + b.ph) * 3;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.1 + b.ph) * 0.05);
      ctx.drawImage(b.spr, -60, -70, 120, 80); ctx.restore();
    }
    for (const g of this.gulls) gull(ctx, ((g.x + t * g.v * 30) % 1500) - 100, g.y + Math.sin(t + g.ph) * 10, t * 8 + g.ph, g.s);
    this.blit(ctx, this.mid, camX);
    this.blit(ctx, this.near, camX);
    // halo dos candeeiros
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const lx of this.lamps) {
      const x = lx - camX, fl = 0.85 + Math.sin(t * 13 + lx) * 0.05;
      ctx.fillStyle = rg(ctx, x, 470, 0, 90, [[0, `rgba(255,210,140,${0.5 * fl})`], [1, 'rgba(255,180,100,0)']]);
      ctx.fillRect(x - 90, 380, 180, 180);
    }
    ctx.restore();
  }
  front(ctx, camX, t) {
    // poste de amarração com corda em primeiro plano
    ctx.fillStyle = '#1a1214';
    for (let px = 260; px < WORLD_W * 1.25; px += 900) {
      const x = px - camX * 1.25;
      if (x < -80 || x > VIEW_W + 80) continue;
      ctx.fillRect(x - 14, 694, 28, 30); ctx.beginPath(); ctx.ellipse(x, 695, 18, 6, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function boat(scale, stripe, i) {
  const c = document.createElement('canvas'); c.width = 120 * scale; c.height = 80 * scale;
  const x = c.getContext('2d'); x.scale(scale, scale);
  x.fillStyle = '#f4efe6'; x.beginPath(); x.moveTo(6, 52); x.lineTo(114, 52); x.lineTo(100, 72); x.lineTo(20, 72); x.closePath(); x.fill();
  x.fillStyle = stripe; x.fillRect(12, 56, 96, 6);
  x.fillStyle = '#20233a'; x.fillRect(20, 68, 80, 4);
  x.fillStyle = '#e8d7b4'; x.fillRect(48, 34, 26, 18); x.fillStyle = '#2a3550'; x.fillRect(52, 38, 7, 6); x.fillRect(63, 38, 7, 6);
  x.strokeStyle = '#3a2a2a'; x.lineWidth = 2; x.beginPath(); x.moveTo(30, 52); x.lineTo(30, 10 + i * 4); x.lineTo(92, 50); x.stroke();
  x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(0, 74, 120, 2);
  return c;
}
function church(m, x, base, scale) {
  m.fillStyle = '#f4ece2'; m.fillRect(x + 20, base - 120, 110, 120);
  m.fillStyle = '#2a2026';
  m.fillRect(x + 20, base - 120, 8, 120); m.fillRect(x + 122, base - 120, 8, 120); m.fillRect(x + 20, base - 124, 110, 8);
  m.beginPath(); m.moveTo(x + 14, base - 120); m.quadraticCurveTo(x + 75, base - 170, x + 136, base - 120); m.lineTo(x + 126, base - 120); m.quadraticCurveTo(x + 75, base - 158, x + 24, base - 120); m.fill();
  m.fillStyle = '#f4ece2'; m.fillRect(x + 56, base - 210, 38, 90);
  m.fillStyle = '#2a2026'; m.fillRect(x + 56, base - 210, 6, 90); m.fillRect(x + 88, base - 210, 6, 90);
  m.beginPath(); m.moveTo(x + 52, base - 210); m.lineTo(x + 75, base - 240); m.lineTo(x + 98, base - 210); m.fill();
  m.fillStyle = '#ffd27a'; m.beginPath(); m.arc(x + 75, base - 186, 8, 0, Math.PI * 2); m.fill();
  m.fillStyle = '#2a2026'; m.beginPath(); m.arc(x + 75, base - 60, 18, Math.PI, 0); m.fillRect(x + 57, base - 60, 36, 60); m.fill();
}
function palm(m, x, base, h, R) {
  m.strokeStyle = '#3a2620'; m.lineWidth = 7; m.beginPath(); m.moveTo(x, base); m.quadraticCurveTo(x + 10, base - h / 2, x + 4, base - h); m.stroke();
  m.fillStyle = '#2a4a3a';
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.5 + (R() - 0.5) * 0.2;
    m.beginPath(); m.moveTo(x + 4, base - h);
    m.quadraticCurveTo(x + 4 + Math.cos(a) * 30, base - h + Math.sin(a) * 30 - 10, x + 4 + Math.cos(a) * 50, base - h + Math.sin(a) * 40 + 10);
    m.quadraticCurveTo(x + 4 + Math.cos(a) * 26, base - h + Math.sin(a) * 26, x + 4, base - h); m.fill();
  }
}
function bollard(n, x, y) {
  n.fillStyle = 'rgba(0,0,0,0.3)'; n.beginPath(); n.ellipse(x, y + 2, 24, 6, 0, 0, Math.PI * 2); n.fill();
  n.fillStyle = lg(n, x - 14, 0, x + 14, 0, [[0, '#5a5f66'], [0.4, '#2a2d33'], [1, '#121418']]);
  n.fillRect(x - 13, y - 34, 26, 34); n.beginPath(); n.ellipse(x, y - 34, 19, 7, 0, 0, Math.PI * 2); n.fill();
}
function crates(n, x, y, R) {
  for (let i = 0; i < 3; i++) {
    const w = 46, cx = x + (i === 2 ? 23 : i * 50), cy = y - (i === 2 ? 92 : 46);
    n.fillStyle = '#8a5a32'; n.fillRect(cx, cy, w, 46);
    n.strokeStyle = '#4a2c18'; n.lineWidth = 3; n.strokeRect(cx + 1.5, cy + 1.5, w - 3, 43);
    n.beginPath(); n.moveTo(cx, cy); n.lineTo(cx + w, cy + 46); n.stroke();
    n.fillStyle = 'rgba(255,200,140,0.18)'; n.fillRect(cx, cy, w, 5);
  }
  n.fillStyle = '#e04a2a'; n.beginPath(); n.arc(x + 140, y - 18, 18, 0, Math.PI * 2); n.fill(); // boia
  n.fillStyle = '#f4efe6'; n.fillRect(x + 122, y - 22, 36, 8);
}
function nets(n, x, y) {
  n.fillStyle = '#2f5a5a'; n.beginPath(); n.ellipse(x, y - 14, 70, 22, 0, Math.PI, 0); n.fill();
  n.strokeStyle = 'rgba(180,230,220,0.35)'; n.lineWidth = 1;
  for (let i = -60; i < 60; i += 8) { n.beginPath(); n.moveTo(x + i, y - 2); n.lineTo(x + i + 10, y - 30); n.stroke(); }
  n.fillStyle = '#d8b04a'; for (let i = 0; i < 5; i++) { n.beginPath(); n.arc(x - 50 + i * 25, y - 22 - (i % 2) * 8, 5, 0, Math.PI * 2); n.fill(); }
}
function lamp(n, x, y) {
  n.fillStyle = '#16120f'; n.fillRect(x - 4, y - 140, 8, 140); n.fillRect(x - 12, y - 8, 24, 8);
  n.beginPath(); n.moveTo(x - 14, y - 140); n.lineTo(x + 14, y - 140); n.lineTo(x + 8, y - 166); n.lineTo(x - 8, y - 166); n.fill();
  n.fillStyle = '#ffe2a0'; n.fillRect(x - 9, y - 160, 18, 18);
}
function gull(ctx, x, y, ph, s) {
  const w = Math.sin(ph) * 6 * s;
  ctx.strokeStyle = '#2a1e2a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 12 * s, y - w); ctx.quadraticCurveTo(x - 5 * s, y - 4 * s, x, y); ctx.quadraticCurveTo(x + 5 * s, y - 4 * s, x + 12 * s, y - w); ctx.stroke();
}

// ======================================================================= 2. Lagoa das Sete Cidades
class Lagoa extends Stage {
  constructor(scale) {
    super(scale);
    this.name = 'Miradouro das Sete Cidades'; this.rim = '#fff1cf'; this.wind = 0.9; this.music = 1;
    this.shadow = 'rgba(20,40,30,0.38)';
    const R = rng(21);
    const sky = layer(0, scale); const c = sky.ctx;
    c.fillStyle = lg(c, 0, 0, 0, 400, [[0, '#4f8fd0'], [0.6, '#9fc9ea'], [1, '#e4f0ee']]); c.fillRect(0, 0, VIEW_W, VIEW_H);
    c.fillStyle = rg(c, 1080, 70, 5, 300, [[0, 'rgba(255,255,230,0.95)'], [0.12, 'rgba(255,250,210,0.5)'], [1, 'rgba(255,250,210,0)']]); c.fillRect(0, 0, VIEW_W, VIEW_H);
    this.sky = sky;
    this.clouds = Array.from({ length: 7 }, () => ({ x: R() * 1600, y: 60 + R() * 170, r: 30 + R() * 30, n: 4 + Math.floor(R() * 4), s: 0.1 + R() * 0.15 }));
    // cratera distante
    const far = layer(0.1, scale); const f = far.ctx;
    f.fillStyle = '#7da3a8';
    f.beginPath(); f.moveTo(0, 360); for (let x = 0; x <= far.w; x += 40) f.lineTo(x, 300 + Math.sin(x / 160) * 30 + Math.sin(x / 47) * 8); f.lineTo(far.w, 420); f.lineTo(0, 420); f.fill();
    f.fillStyle = '#5f8c80';
    f.beginPath(); f.moveTo(0, 400); for (let x = 0; x <= far.w; x += 30) f.lineTo(x, 350 + Math.sin(x / 120 + 2) * 26); f.lineTo(far.w, 440); f.lineTo(0, 440); f.fill();
    this.far = far;
    // lagoas azul e verde
    const lake = layer(0.2, scale); const l = lake.ctx;
    l.fillStyle = '#4a7a4a'; l.fillRect(0, 400, lake.w, 120);
    l.fillStyle = lg(l, 0, 410, 0, 470, [[0, '#4d8fc2'], [1, '#2c6a9a']]);
    l.beginPath(); l.ellipse(380, 440, 420, 34, 0, 0, Math.PI * 2); l.fill();
    l.fillStyle = lg(l, 0, 410, 0, 470, [[0, '#5aa080'], [1, '#2e7a58']]);
    l.beginPath(); l.ellipse(1080, 446, 380, 30, 0, 0, Math.PI * 2); l.fill();
    l.fillStyle = '#c9b89a'; l.fillRect(770, 438, 60, 6); l.fillStyle = '#7a6a5a'; for (let i = 0; i < 4; i++) l.fillRect(776 + i * 15, 444, 4, 6);
    for (let i = 0; i < 40; i++) { l.fillStyle = `rgba(30,70,40,${0.3 + R() * 0.3})`; l.beginPath(); l.arc(R() * lake.w, 470 + R() * 40, 12 + R() * 20, 0, Math.PI * 2); l.fill(); }
    // pequena aldeia na margem
    for (let i = 0; i < 18; i++) { const hx = 560 + R() * 380, hy = 470 + R() * 16; l.fillStyle = '#f2ece0'; l.fillRect(hx, hy, 10, 7); l.fillStyle = '#b5523a'; l.fillRect(hx - 1, hy - 3, 12, 3); }
    this.lake = lake;
    // colinas com criptomérias e muros de pedra
    const mid = layer(0.45, scale); const m = mid.ctx;
    m.fillStyle = '#3f7a3a';
    m.beginPath(); m.moveTo(0, 520); for (let x = 0; x <= mid.w; x += 30) m.lineTo(x, 500 + Math.sin(x / 210) * 22 + Math.sin(x / 70) * 6); m.lineTo(mid.w, 620); m.lineTo(0, 620); m.fill();
    m.strokeStyle = 'rgba(40,40,40,0.5)'; m.lineWidth = 2;
    for (let i = 0; i < 9; i++) { const x0 = R() * mid.w; m.beginPath(); m.moveTo(x0, 520 + R() * 20); m.lineTo(x0 + 80 + R() * 120, 560 + R() * 30); m.stroke(); }
    for (let i = 0; i < 46; i++) cedar(m, R() * mid.w, 512 + R() * 40, 40 + R() * 50, R);
    this.mid = mid;
    // planalto do miradouro: relva, lajes de basalto, hortênsias e grade
    const near = layer(1, scale); const n = near.ctx;
    n.fillStyle = lg(n, 0, 560, 0, 720, [[0, '#5c9a40'], [1, '#2f5e24']]); n.fillRect(0, 560, near.w, 160);
    for (let i = 0; i < 70; i++) hydrangea(n, R() * near.w, 566 + R() * 14, 22 + R() * 16, R);
    // grade de pedra e ferro do miradouro
    for (let x = 0; x < near.w; x += 130) {
      n.fillStyle = '#3a3a3e'; n.fillRect(x, 548, 16, 48); n.fillStyle = '#5a5a60'; n.fillRect(x - 3, 544, 22, 8);
    }
    n.strokeStyle = '#2a2a2e'; n.lineWidth = 4; n.beginPath(); n.moveTo(0, 560); n.lineTo(near.w, 560); n.moveTo(0, 578); n.lineTo(near.w, 578); n.stroke();
    // lajes
    n.fillStyle = '#3c3a3e'; n.fillRect(0, 600, near.w, 120);
    let sx = 0;
    while (sx < near.w) {
      const w = 60 + R() * 60;
      for (let row = 0; row < 3; row++) {
        const y0 = 604 + row * 40 + (row ? 0 : 0), ox = row % 2 ? w / 2 : 0;
        n.fillStyle = `rgb(${70 + R() * 25},${68 + R() * 20},${72 + R() * 20})`;
        n.beginPath(); n.roundRect ? n.roundRect(sx + ox + 2, y0 + 2, w - 4, 36, 6) : n.rect(sx + ox + 2, y0 + 2, w - 4, 36); n.fill();
        n.fillStyle = 'rgba(255,255,255,0.08)'; n.fillRect(sx + ox + 4, y0 + 3, w - 8, 3);
      }
      sx += w;
    }
    for (let i = 0; i < 300; i++) { n.fillStyle = `rgba(110,170,70,${0.5 + R() * 0.5})`; const gx = R() * near.w; n.fillRect(gx, 598 + R() * 6, 2, -6 - R() * 10); }
    this.near = near;
    this.mist = Array.from({ length: 6 }, () => ({ x: R() * 1800, y: 380 + R() * 140, w: 300 + R() * 300, s: 3 + R() * 6, a: 0.12 + R() * 0.12 }));
    this.birds = Array.from({ length: 2 }, () => ({ x: R() * 1280, y: 110 + R() * 120, v: 0.3 + R() * 0.4, r: 60 + R() * 60, ph: R() * 6 }));
    this.petals = Array.from({ length: 22 }, () => ({ x: R() * 1280, y: R() * 720, v: 0.4 + R(), c: R() < 0.5 ? '#8fa8ff' : '#d79be8' }));
  }
  back(ctx, camX, t) {
    ctx.drawImage(this.sky.c, 0, 0, VIEW_W, VIEW_H);
    for (const cl of this.clouds) {
      const x = ((cl.x + t * cl.s * 10 - camX * 0.04) % 1800) - 250;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < cl.n; i++) { ctx.beginPath(); ctx.arc(x + i * cl.r * 0.8, cl.y - Math.sin(i / (cl.n - 1) * Math.PI) * cl.r * 0.6, cl.r * (0.7 + Math.sin(i * 2.1) * 0.2), 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(180,200,220,0.4)'; ctx.fillRect(x - cl.r * 0.6, cl.y + cl.r * 0.2, cl.n * cl.r * 0.8 + cl.r * 0.6, 6);
    }
    for (const b of this.birds) { // açores a planar em círculos
      const a = t * b.v + b.ph, x = b.x + Math.cos(a) * b.r - camX * 0.08, y = b.y + Math.sin(a) * b.r * 0.35;
      ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x - 16, y - 4); ctx.quadraticCurveTo(x - 6, y - 7, x, y); ctx.quadraticCurveTo(x + 6, y - 7, x + 16, y - 4); ctx.stroke();
    }
    this.blit(ctx, this.far, camX);
    this.blit(ctx, this.lake, camX);
    // brilhos na água
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 18; i++) {
      const x = ((i * 137) % 1300) - camX * 0.2 + Math.sin(t + i) * 4, y = 420 + (i * 31) % 44;
      if (Math.sin(t * 3 + i * 2.3) > 0.6) ctx.fillRect(x, y, 10, 1.5);
    }
    for (const m of this.mist.slice(0, 3)) this.mistBand(ctx, m, camX, t, 0.2);
    this.blit(ctx, this.mid, camX);
    for (const m of this.mist.slice(3)) this.mistBand(ctx, m, camX, t, 0.5);
    this.blit(ctx, this.near, camX);
  }
  mistBand(ctx, m, camX, t, f) {
    const x = ((m.x + t * m.s - camX * f) % 2000) - 400;
    ctx.fillStyle = rg(ctx, x, m.y, 0, m.w / 2, [[0, `rgba(255,255,255,${m.a})`], [1, 'rgba(255,255,255,0)']]);
    ctx.save(); ctx.translate(x, m.y); ctx.scale(1, 0.18); ctx.translate(-x, -m.y);
    ctx.fillRect(x - m.w / 2, m.y - m.w / 2, m.w, m.w); ctx.restore();
  }
  front(ctx, camX, t) {
    for (const p of this.petals) {
      p.x -= p.v * 0.8; p.y += Math.sin(t * 2 + p.v * 10) * 0.6 + 0.25;
      if (p.x < -10) p.x += 1300; if (p.y > 720) p.y -= 720;
      ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(p.x, p.y, 3.5, 2, t + p.v * 5, 0, Math.PI * 2); ctx.fill();
    }
  }
}
function cedar(m, x, base, h, R) {
  m.fillStyle = `rgb(${20 + R() * 15},${55 + R() * 25},${35 + R() * 15})`;
  m.beginPath(); m.moveTo(x, base - h); m.lineTo(x + h * 0.22, base); m.lineTo(x - h * 0.22, base); m.fill();
  m.fillStyle = 'rgba(255,255,220,0.12)'; m.beginPath(); m.moveTo(x, base - h); m.lineTo(x - h * 0.22, base); m.lineTo(x - h * 0.05, base); m.fill();
}
function hydrangea(n, x, y, r, R) {
  n.fillStyle = '#2f5a26'; n.beginPath(); n.ellipse(x, y + r * 0.3, r * 1.3, r * 0.7, 0, 0, Math.PI * 2); n.fill();
  const cols = R() < 0.5 ? ['#6f8cf0', '#8fa8ff', '#4f6ad0'] : ['#b57ee0', '#d79be8', '#8c58c0'];
  for (let i = 0; i < 4; i++) {
    const cx = x + (R() - 0.5) * r * 1.6, cy = y - R() * r * 0.4, rr = r * (0.35 + R() * 0.2);
    n.fillStyle = cols[2]; n.beginPath(); n.arc(cx, cy, rr, 0, Math.PI * 2); n.fill();
    n.fillStyle = cols[0]; n.beginPath(); n.arc(cx - rr * 0.15, cy - rr * 0.15, rr * 0.8, 0, Math.PI * 2); n.fill();
    for (let k = 0; k < 6; k++) { n.fillStyle = cols[1]; n.fillRect(cx + (R() - 0.6) * rr, cy + (R() - 0.7) * rr, 3, 3); }
  }
}

// ======================================================================= 3. Telhados de Lisboa à noite
class Telhados extends Stage {
  constructor(scale) {
    super(scale);
    this.name = 'Telhados de Alfama'; this.rim = '#9fb8ff'; this.wind = 0.4; this.music = 2;
    this.shadow = 'rgba(5,5,25,0.55)';
    const R = rng(33);
    const sky = layer(0, scale); const c = sky.ctx;
    c.fillStyle = lg(c, 0, 0, 0, 460, [[0, '#070a22'], [0.6, '#1c1d4a'], [1, '#4a2f5e']]); c.fillRect(0, 0, VIEW_W, VIEW_H);
    this.stars = Array.from({ length: 140 }, () => ({ x: R() * VIEW_W, y: R() * 330, s: 0.8 + R() * 1.6, ph: R() * 6 }));
    c.fillStyle = rg(c, 260, 120, 10, 200, [[0, 'rgba(230,235,255,0.55)'], [1, 'rgba(200,210,255,0)']]); c.fillRect(0, 0, 600, 400);
    c.fillStyle = '#f2f0e4'; c.beginPath(); c.arc(260, 120, 42, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(180,175,160,0.35)'; for (const [dx, dy, r] of [[-12, -8, 9], [10, 6, 12], [-4, 16, 6], [16, -14, 5]]) { c.beginPath(); c.arc(260 + dx, 120 + dy, r, 0, Math.PI * 2); c.fill(); }
    this.sky = sky;
    // rio com ponte suspensa e margem sul
    const far = layer(0.1, scale); const f = far.ctx;
    f.fillStyle = lg(f, 0, 400, 0, 470, [[0, '#24224a'], [1, '#0f1230']]); f.fillRect(0, 400, far.w, 70);
    f.fillStyle = '#151634'; f.beginPath(); f.moveTo(0, 404); for (let x = 0; x <= far.w; x += 40) f.lineTo(x, 392 + Math.sin(x / 90) * 6); f.lineTo(far.w, 406); f.fill();
    for (let i = 0; i < 90; i++) { f.fillStyle = R() < 0.7 ? '#ffcf7a' : '#ffffff'; f.fillRect(R() * far.w, 394 + R() * 10, 2, 2); }
    // ponte
    const bx0 = 700, bx1 = 1300;
    f.strokeStyle = '#a8342c'; f.lineWidth = 6;
    for (const px of [bx0 + 120, bx1 - 120]) { f.beginPath(); f.moveTo(px, 418); f.lineTo(px, 300); f.stroke(); f.beginPath(); f.moveTo(px - 8, 300); f.lineTo(px + 8, 300); f.stroke(); }
    f.lineWidth = 2.5; f.beginPath(); f.moveTo(bx0, 410); f.quadraticCurveTo(bx0 + 60, 360, bx0 + 120, 302); f.quadraticCurveTo((bx0 + bx1) / 2, 400, bx1 - 120, 302); f.quadraticCurveTo(bx1 - 60, 360, bx1, 410); f.stroke();
    f.lineWidth = 1; for (let x = bx0 + 130; x < bx1 - 120; x += 14) { const y = 302 + 96 * (1 - Math.pow((x - (bx0 + bx1) / 2) / ((bx1 - bx0 - 240) / 2), 2)) * 0.95; f.beginPath(); f.moveTo(x, Math.min(410, 302 + (410 - 302) - (410 - y))); f.lineTo(x, 410); f.stroke(); }
    f.fillStyle = '#5a1e1a'; f.fillRect(bx0 - 20, 408, bx1 - bx0 + 40, 6);
    this.bridge = { x0: bx0 - 20, x1: bx1 + 20, y: 409, f: 0.1 };
    this.far = far;
    // colina com castelo iluminado e casario
    const hill = layer(0.28, scale); const h = hill.ctx;
    h.fillStyle = '#1b1a3a'; h.beginPath(); h.moveTo(0, 470); h.quadraticCurveTo(420, 330, 900, 400); h.quadraticCurveTo(1200, 430, hill.w, 440); h.lineTo(hill.w, 560); h.lineTo(0, 560); h.fill();
    h.fillStyle = '#e0a860'; // muralhas do castelo, iluminadas
    const cx = 380, cy = 356;
    h.fillRect(cx - 120, cy, 240, 30);
    for (let i = 0; i < 4; i++) h.fillRect(cx - 120 + i * 76, cy - 30, 32, 36);
    for (let i = 0; i < 16; i++) h.fillRect(cx - 120 + i * 15, cy - 6, 9, 8);
    h.fillStyle = 'rgba(255,190,110,0.18)'; h.beginPath(); h.ellipse(cx, cy + 10, 220, 60, 0, 0, Math.PI * 2); h.fill();
    for (let i = 0; i < 260; i++) { const x = R() * hill.w, y = 400 + R() * 150; if (y < 470 - Math.sin(x / hill.w * Math.PI) * 60) continue; h.fillStyle = R() < 0.6 ? 'rgba(255,200,120,0.85)' : 'rgba(150,170,255,0.6)'; h.fillRect(x, y, 3, 3); }
    this.hill = hill;
    // casario com fachadas coloridas e azulejos
    const mid = layer(0.55, scale); const m = mid.ctx;
    this.windows = [];
    let x = 0;
    while (x < mid.w) {
      const w = 80 + R() * 70, hh = 120 + R() * 110, y0 = 600 - hh;
      const col = ['#c9705a', '#d9b45a', '#6a8fb8', '#e8dccb', '#b85a6a', '#7aa08a'][Math.floor(R() * 6)];
      m.fillStyle = col; m.fillRect(x, y0, w, hh);
      m.fillStyle = 'rgba(10,10,40,0.55)'; m.fillRect(x, y0, w, hh); // noite
      if (R() < 0.4) { m.fillStyle = 'rgba(120,160,220,0.25)'; for (let yy = y0 + 8; yy < 600; yy += 8) for (let xx = x + 2; xx < x + w - 2; xx += 8) if ((xx + yy) % 16 < 8) m.fillRect(xx, yy, 6, 6); }
      m.fillStyle = '#5a2a22'; m.beginPath(); m.moveTo(x - 5, y0); m.lineTo(x + w * 0.3, y0 - 18); m.lineTo(x + w * 0.7, y0 - 18); m.lineTo(x + w + 5, y0); m.fill();
      for (let wy = y0 + 18; wy < 580; wy += 36) for (let wx = x + 12; wx < x + w - 20; wx += 28) {
        m.fillStyle = '#0c0c1e'; m.fillRect(wx - 2, wy - 2, 16, 24);
        this.windows.push({ x: wx, y: wy, on: R() < 0.45, ph: R() * 100, warm: R() < 0.8 });
        m.fillStyle = '#e8e2d0'; m.fillRect(wx - 3, wy + 22, 18, 2);
      }
      if (R() < 0.3) { m.strokeStyle = 'rgba(230,230,230,0.6)'; m.lineWidth = 1; m.beginPath(); m.moveTo(x + 6, y0 + 40); m.quadraticCurveTo(x + w / 2, y0 + 52, x + w - 6, y0 + 40); m.stroke(); for (let i = 0; i < 4; i++) { m.fillStyle = ['#e8e8f0', '#d05a5a', '#5a8ad0', '#f0d060'][i]; m.fillRect(x + 14 + i * (w - 30) / 4, y0 + 44, 8, 12); } }
      x += w + 2;
    }
    this.mid = mid;
    this.tram = { x: -400 };
    // terraço: telha e mosaico, muro com azulejos, chaminés, manjericos
    const near = layer(1, scale); const n = near.ctx;
    // muro com azulejos azuis
    n.fillStyle = '#e8e4dc'; n.fillRect(0, 548, near.w, 52);
    for (let ax = 0; ax < near.w; ax += 26) for (let ay = 552; ay < 596; ay += 22) {
      n.fillStyle = '#f4f2ec'; n.fillRect(ax + 1, ay, 24, 20);
      n.strokeStyle = '#2c5aa8'; n.lineWidth = 2; n.beginPath(); n.arc(ax + 13, ay + 10, 6, 0, Math.PI * 2); n.stroke();
      n.beginPath(); n.moveTo(ax + 1, ay); n.lineTo(ax + 6, ay + 5); n.moveTo(ax + 25, ay); n.lineTo(ax + 20, ay + 5); n.moveTo(ax + 1, ay + 20); n.lineTo(ax + 6, ay + 15); n.moveTo(ax + 25, ay + 20); n.lineTo(ax + 20, ay + 15); n.stroke();
    }
    n.fillStyle = 'rgba(10,10,40,0.45)'; n.fillRect(0, 548, near.w, 52);
    n.fillStyle = '#6a5a52'; n.fillRect(0, 540, near.w, 10);
    for (let px = 90; px < near.w; px += 230 + R() * 140) pot(n, px, 540, R);
    for (let cx2 = 400; cx2 < near.w; cx2 += 700) chimney(n, cx2, 540);
    // chão de tijoleira
    n.fillStyle = lg(n, 0, 598, 0, 720, [[0, '#9a4a32'], [1, '#5a2618']]); n.fillRect(0, 598, near.w, 122);
    for (let row = 0; row < 6; row++) {
      const y = 600 + row * 21, hgt = 20;
      for (let tx = (row % 2) * 24; tx < near.w; tx += 48) {
        n.fillStyle = `rgba(${150 + R() * 40},${70 + R() * 25},${45 + R() * 15},1)`;
        n.fillRect(tx + 1, y, 46, hgt - 1);
        n.fillStyle = 'rgba(255,200,170,0.08)'; n.fillRect(tx + 1, y, 46, 3);
      }
    }
    n.fillStyle = 'rgba(10,10,40,0.35)'; n.fillRect(0, 598, near.w, 122);
    this.near = near;
    this.bulbs = [];
    for (let i = 0; i < 14; i++) this.bulbs.push({ k: i / 13, c: ['#ffd27a', '#ff8a7a', '#9ae0a0', '#8ac0ff'][i % 4] });
  }
  back(ctx, camX, t) {
    ctx.drawImage(this.sky.c, 0, 0, VIEW_W, VIEW_H);
    for (const s of this.stars) { ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.35 * Math.sin(t * 2 + s.ph)})`; ctx.fillRect(s.x, s.y, s.s, s.s); }
    this.blit(ctx, this.far, camX);
    // carros na ponte
    const B = this.bridge;
    for (let i = 0; i < 6; i++) {
      const k = ((t * 0.05 + i / 6) % 1), x = B.x0 + (B.x1 - B.x0) * (i % 2 ? k : 1 - k) - camX * B.f;
      ctx.fillStyle = i % 2 ? '#ffffff' : '#ff4a3a'; ctx.fillRect(x, B.y - 1, 3, 2);
    }
    // reflexo da lua no rio
    ctx.fillStyle = 'rgba(230,235,255,0.35)';
    for (let i = 0; i < 8; i++) ctx.fillRect(250 - camX * 0.1 + Math.sin(t * 2 + i) * 8 - (14 - i), 416 + i * 6, 28 - i * 2, 1.5);
    this.blit(ctx, this.hill, camX);
    // elétrico amarelo a passar numa rua entre a colina e o casario
    this.tram.x += 1.6; if (this.tram.x > WORLD_W + 600) this.tram.x = -600;
    tram(ctx, this.tram.x - camX * 0.42, 548, t);
    this.blit(ctx, this.mid, camX);
    // janelas acendem e apagam
    const ox = -camX * 0.55;
    for (const w of this.windows) {
      const on = w.on !== (Math.sin(t * 0.07 + w.ph) > 0.93);
      if (!on) continue;
      const x = w.x + ox; if (x < -20 || x > VIEW_W) continue;
      ctx.fillStyle = w.warm ? '#ffcf7a' : '#bcd0ff'; ctx.fillRect(x, w.y, 12, 20);
    }
    this.blit(ctx, this.near, camX);
  }
  front(ctx, camX, t) {
    // fio de lâmpadas de festa a baloiçar (arraial)
    const x0 = 120 - camX * 1.1, x1 = 1900 - camX * 1.1, sag = 70 + Math.sin(t * 1.3) * 6;
    ctx.strokeStyle = '#141018'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, 140); ctx.quadraticCurveTo((x0 + x1) / 2, 140 + sag * 2, x1, 140); ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const b of this.bulbs) {
      const k = b.k, x = x0 + (x1 - x0) * k, y = 140 + 2 * sag * 2 * k * (1 - k) + 8;
      if (x < -40 || x > VIEW_W + 40) continue;
      ctx.fillStyle = rg(ctx, x, y, 0, 26, [[0, b.c], [1, 'rgba(0,0,0,0)']]); ctx.globalAlpha = 0.55; ctx.fillRect(x - 26, y - 26, 52, 52);
      ctx.globalAlpha = 1; ctx.fillStyle = b.c; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}
function pot(n, x, y, R) {
  n.fillStyle = '#a0502e'; n.beginPath(); n.moveTo(x - 14, y - 26); n.lineTo(x + 14, y - 26); n.lineTo(x + 10, y); n.lineTo(x - 10, y); n.fill();
  n.fillStyle = '#2f6a2a'; n.beginPath(); n.arc(x, y - 34, 16, 0, Math.PI * 2); n.fill();
  n.fillStyle = '#4a8a3a'; for (let i = 0; i < 8; i++) { n.beginPath(); n.arc(x + (R() - 0.5) * 22, y - 34 + (R() - 0.5) * 20, 4, 0, Math.PI * 2); n.fill(); }
  n.fillStyle = '#e04a4a'; n.fillRect(x - 2, y - 52, 4, 6); // cravo de papel
}
function chimney(n, x, y) {
  n.fillStyle = '#e8e2d8'; n.fillRect(x - 22, y - 90, 44, 90);
  n.fillStyle = 'rgba(10,10,40,0.45)'; n.fillRect(x - 22, y - 90, 44, 90);
  n.fillStyle = '#7a3a2a'; n.fillRect(x - 28, y - 98, 56, 10);
  n.fillStyle = '#2a1a1a'; n.fillRect(x - 10, y - 110, 20, 14);
}
function tram(ctx, x, y, t) {
  if (x < -260 || x > VIEW_W + 60) return;
  ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y - 74); ctx.lineTo(VIEW_W, y - 74); ctx.stroke();
  ctx.fillStyle = '#f2c230'; ctx.fillRect(x, y - 52, 190, 46);
  ctx.fillStyle = '#e8e2d0'; ctx.fillRect(x, y - 58, 190, 8);
  ctx.fillStyle = '#ffe9a8'; for (let i = 0; i < 6; i++) ctx.fillRect(x + 10 + i * 30, y - 44, 22, 18);
  ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x, y - 8, 190, 6); ctx.beginPath(); ctx.arc(x + 40, y - 2, 7, 0, Math.PI * 2); ctx.arc(x + 150, y - 2, 7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 95, y - 58); ctx.lineTo(x + 120, y - 74); ctx.stroke();
  ctx.fillStyle = 'rgba(255,230,150,0.25)'; ctx.beginPath(); ctx.ellipse(x + 95, y - 30, 140, 40, 0, 0, Math.PI * 2); ctx.fill();
}

export const STAGES = [
  { id: 'cais', name: 'Cais de Ponta Delgada', make: (s) => new Cais(s) },
  { id: 'lagoa', name: 'Miradouro das Sete Cidades', make: (s) => new Lagoa(s) },
  { id: 'telhados', name: 'Telhados de Alfama', make: (s) => new Telhados(s) },
];
