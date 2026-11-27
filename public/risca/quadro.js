// Quadro de desenho partilhado pela TV e pelo telemóvel de quem desenha.
// Os dois desenham as mesmas operações numa tela de 800×600, por isso o resultado é igual.
export const W = 800, H = 600;
export const CORES = ['#1d1b22', '#7a7680', '#ffffff', '#e23b3b', '#ff8a1f', '#ffd21f', '#3fbf4a', '#1f8a4c',
  '#3ec6f0', '#2457d6', '#8a3fd1', '#ff6fb1', '#8a5a2b', '#f2c79b'];
export const TAMANHOS = [4, 10, 22, 44];
export const BORRACHA = '#ffffff';

export class Quadro {
  constructor(canvas) {
    this.cv = canvas; canvas.width = W; canvas.height = H;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.ops = []; this.cur = null;
    this.redraw();
  }
  reset() { this.ops = []; this.cur = null; this.redraw(); }

  // aplica uma mensagem do protocolo (pen / fill / undo / clear)
  apply(m) {
    switch (m.t) {
      case 'pen': this.pen(m.s, m.c, m.w, m.p); break;
      case 'fill': this.fill(m.x, m.y, m.c); break;
      case 'undo': this.undo(); break;
      case 'clear': this.reset(); break;
    }
  }
  pen(s, c, w, p) {
    if (!Array.isArray(p) || p.length < 2) return;
    c = safeColor(c); w = Math.max(1, Math.min(60, +w || 4));
    let op = this.cur;
    if (!op || op.s !== s) {
      op = this.cur = { k: 's', s, c, w, p: [] };
      this.ops.push(op);
      if (this.ops.length > 1500) this.ops.splice(0, this.ops.length - 1500);
    }
    const from = op.p.length;
    for (let i = 0; i + 1 < p.length; i += 2) op.p.push(clamp(p[i], W), clamp(p[i + 1], H));
    drawStroke(this.ctx, op, from);
  }
  fill(x, y, c) {
    const op = { k: 'f', x: clamp(x, W - 1), y: clamp(y, H - 1), c: safeColor(c) };
    this.ops.push(op); this.cur = null;
    floodFill(this.ctx, op.x, op.y, op.c);
  }
  undo() {
    this.ops.pop(); this.cur = null;
    this.redraw();
  }
  redraw() { paint(this.ctx, this.ops); }
}

export function paint(ctx, ops) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  for (const op of ops) {
    if (op.k === 's') drawStroke(ctx, op, 0);
    else if (op.k === 'f') floodFill(ctx, op.x, op.y, op.c);
  }
}

// desenha o traço a partir do ponto `from` (para ir acrescentando sem redesenhar tudo)
function drawStroke(ctx, op, from) {
  const p = op.p;
  ctx.strokeStyle = op.c; ctx.fillStyle = op.c;
  ctx.lineWidth = op.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (from === 0) {
    ctx.beginPath(); ctx.arc(p[0], p[1], op.w / 2, 0, Math.PI * 2); ctx.fill();
  }
  const start = Math.max(2, from);
  if (start >= p.length) return;
  ctx.beginPath();
  ctx.moveTo(p[start - 2], p[start - 1]);
  for (let i = start; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
  ctx.stroke();
}

// balde de tinta: pinta a zona da mesma cor (com tolerância para as bordas suavizadas)
function floodFill(ctx, x, y, color) {
  const img = ctx.getImageData(0, 0, W, H), d = img.data;
  const [r, g, b] = hexRgb(color);
  const i0 = (y * W + x) * 4;
  const r0 = d[i0], g0 = d[i0 + 1], b0 = d[i0 + 2];
  if (Math.abs(r0 - r) + Math.abs(g0 - g) + Math.abs(b0 - b) < 6) return;
  const TOL = 90;
  const same = (i) => Math.abs(d[i] - r0) + Math.abs(d[i + 1] - g0) + Math.abs(d[i + 2] - b0) <= TOL;
  const mark = new Uint8Array(W * H);
  const stack = [x, y];
  while (stack.length) {
    const sy = stack.pop(); let sx = stack.pop();
    let p = sy * W + sx;
    while (sx >= 0 && !mark[p] && same(p * 4)) { sx--; p--; }
    sx++; p++;
    let up = false, down = false;
    while (sx < W && !mark[p] && same(p * 4)) {
      mark[p] = 1;
      if (sy > 0) { const q = p - W; const ok = !mark[q] && same(q * 4); if (ok && !up) { stack.push(sx, sy - 1); up = true; } else if (!ok) up = false; }
      if (sy < H - 1) { const q = p + W; const ok = !mark[q] && same(q * 4); if (ok && !down) { stack.push(sx, sy + 1); down = true; } else if (!ok) down = false; }
      sx++; p++;
    }
  }
  // pinta a zona e mais 1 píxel à volta, para não ficar uma linha clara junto ao contorno
  for (let p = 0; p < W * H; p++) {
    let on = mark[p];
    if (!on) {
      const px = p % W;
      on = (px > 0 && mark[p - 1]) || (px < W - 1 && mark[p + 1]) || (p >= W && mark[p - W]) || (p < W * (H - 1) && mark[p + W]);
    }
    if (on) { const i = p * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
  }
  ctx.putImageData(img, 0, 0);
}

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function safeColor(c) { return /^#[0-9a-f]{6}$/i.test(c) ? c : '#1d1b22'; }
function clamp(v, max) { v = Math.round(+v || 0); return v < 0 ? 0 : v > max ? max : v; }
