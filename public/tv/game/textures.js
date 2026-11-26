// Texturas procedurais (geradas no arranque) — não há ficheiros de imagem para descarregar,
// o que mantém o receiver leve para o Chromecast. Cada material de pedra/terra tem cor + mapa de
// normais derivado de um mapa de alturas, o que dá relevo real à luz (juntas, fendas, musgo).
import * as THREE from 'three';

export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Ruído de valor 2D com várias oitavas, periódico (tileable). Valores em [0,1].
export function makeNoise(size, seed, octaves = 5, baseCells = 4) {
  const r = rng(seed);
  const out = new Float32Array(size * size);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const cells = baseCells << o;
    if (cells > size) break;
    const grid = new Float32Array(cells * cells);
    for (let i = 0; i < grid.length; i++) grid[i] = r();
    const step = size / cells;
    for (let y = 0; y < size; y++) {
      const gy = y / step, y0 = gy | 0, fy = gy - y0, sy = fy * fy * (3 - 2 * fy);
      const r0 = (y0 % cells) * cells, r1 = ((y0 + 1) % cells) * cells;
      for (let x = 0; x < size; x++) {
        const gx = x / step, x0 = gx | 0, fx = gx - x0, sx = fx * fx * (3 - 2 * fx);
        const c0 = x0 % cells, c1 = (x0 + 1) % cells;
        const a = grid[r0 + c0], b = grid[r0 + c1], c = grid[r1 + c0], d = grid[r1 + c1];
        const top = a + (b - a) * sx, bot = c + (d - c) * sx;
        out[y * size + x] += amp * (top + (bot - top) * sy);
      }
    }
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

function dataTex(data, size, { srgb = true, repeat = 1 } = {}) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// Mapa de normais (espaço tangente) a partir de alturas periódicas
function normalTex(h, size, strength) {
  const d = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const ym = ((y - 1 + size) % size) * size, yp = ((y + 1) % size) * size, yc = y * size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size, xp = (x + 1) % size;
      const dx = (h[yc + xp] - h[yc + xm]) * strength;
      const dy = (h[yp + x] - h[ym + x]) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (yc + x) * 4;
      d[i] = (-dx / l * 0.5 + 0.5) * 255;
      d[i + 1] = (dy / l * 0.5 + 0.5) * 255; // textura de canvas/DataTexture: v cresce para cima
      d[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  return dataTex(d, size, { srgb: false });
}

function surface(size, fn, normalStrength) {
  const col = new Uint8Array(size * size * 4), h = new Float32Array(size * size);
  const c = [0, 0, 0];
  for (let i = 0; i < size * size; i++) {
    h[i] = fn(i, c);
    col[i * 4] = c[0]; col[i * 4 + 1] = c[1]; col[i * 4 + 2] = c[2]; col[i * 4 + 3] = 255;
  }
  return { map: dataTex(col, size), normalMap: normalTex(h, size, normalStrength * size / 256) };
}

// Pedra de templo: blocos aparelhados com bisel, variação de tom por bloco, fendas, líquenes e musgo nas juntas
function stoneSurface(size, seed, mossAmt) {
  const n = makeNoise(size, seed, 7, 4);
  const fine = makeNoise(size, seed + 1, 3, 32);
  const crack = makeNoise(size, seed + 2, 3, 3);
  const moss = makeNoise(size, seed + 3, 5, 3);
  const r = rng(seed + 9);
  const rows = 4, cols = 2;
  const tint = Array.from({ length: rows * cols * 2 }, () => [r() * 0.22 - 0.11, r() * 0.25]);
  const bevel = size / 40;
  return surface(size, (i, c) => {
    const x = i % size, y = (i / size) | 0;
    const rh = size / rows, row = (y / rh) | 0;
    const off = (row % 2) * size / (cols * 2);
    const bw = size / cols;
    const xs = (x + off) % size, colI = (xs / bw) | 0;
    const ex = Math.min(xs - colI * bw, (colI + 1) * bw - xs), ey = Math.min(y - row * rh, (row + 1) * rh - y);
    // bordas ligeiramente irregulares
    const edge = Math.min(ex, ey) + (n[i] - 0.5) * bevel * 1.4;
    const bev = smooth(0, bevel, edge);
    const [tn, th] = tint[row * cols * 2 + colI];
    const cr = 1 - Math.abs(crack[i] * 2 - 1);
    const crackG = smooth(0.988, 0.997, cr) * bev * smooth(0.55, 0.7, n[i]);
    let height = bev * (0.75 + th * 0.2) + (n[i] - 0.5) * 0.35 + (fine[i] - 0.5) * 0.12 - crackG * 0.5;
    // cor: arenito acinzentado com manchas, escurecido nas juntas e fendas
    const v = n[i] * 0.7 + fine[i] * 0.3 + tn;
    let R = mix(96, 172, v), G = mix(90, 160, v), B = mix(78, 136, v);
    const ao = 0.45 + 0.55 * bev;
    R *= ao; G *= ao; B *= ao;
    R *= 1 - crackG * 0.45; G *= 1 - crackG * 0.45; B *= 1 - crackG * 0.45;
    // líquenes claros
    if (fine[i] > 0.78 && n[i] > 0.55) { const l = smooth(0.78, 0.86, fine[i]) * 0.5; R = mix(R, 190, l); G = mix(G, 188, l); B = mix(B, 160, l); }
    // musgo: manchas grandes + juntas
    if (mossAmt > 0) {
      const m = smooth(0.52, 0.66, moss[i] + (1 - bev) * 0.25 + (fine[i] - 0.5) * 0.15) * mossAmt;
      if (m > 0) {
        const mv = fine[i];
        R = mix(R, mix(38, 84, mv), m); G = mix(G, mix(62, 112, mv), m); B = mix(B, mix(22, 42, mv), m);
        height += m * (0.15 + fine[i] * 0.2);
      }
    }
    c[0] = R; c[1] = G; c[2] = B;
    return height;
  }, 3.2);
}

// Areia com ondulações, grãos e pequenas conchas/pedrinhas
function sandSurface(size, seed) {
  const n = makeNoise(size, seed, 6, 4), fine = makeNoise(size, seed + 1, 2, 64), warp = makeNoise(size, seed + 2, 3, 2);
  return surface(size, (i, c) => {
    const x = i % size, y = (i / size) | 0;
    const rip = Math.sin((y / size) * Math.PI * 2 * 14 + warp[i] * 9 + (x / size) * Math.PI * 2 * 2) * 0.5 + 0.5;
    const v = n[i] * 0.6 + fine[i] * 0.4;
    c[0] = mix(158, 222, v) - rip * 10; c[1] = mix(128, 194, v) - rip * 10; c[2] = mix(88, 146, v) - rip * 8;
    return rip * 0.35 + n[i] * 0.3 + fine[i] * 0.2;
  }, 2.0);
}

// Chão de selva: terra húmida, folhas caídas e erva
function groundSurface(size, seed) {
  const n = makeNoise(size, seed, 6, 4), fine = makeNoise(size, seed + 1, 3, 32), patch = makeNoise(size, seed + 2, 4, 3);
  const r = rng(seed + 5);
  const col = new Uint8Array(size * size * 4), h = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const g = smooth(0.42, 0.6, patch[i]);
    const v = n[i] * 0.6 + fine[i] * 0.4;
    const R = mix(mix(70, 104, v), mix(48, 96, v), g), G = mix(mix(52, 78, v), mix(72, 120, v), g), B = mix(mix(32, 48, v), mix(26, 44, v), g);
    col[i * 4] = R; col[i * 4 + 1] = G; col[i * 4 + 2] = B; col[i * 4 + 3] = 255;
    h[i] = n[i] * 0.5 + fine[i] * 0.3 + g * fine[i] * 0.3;
  }
  // folhas caídas: elipses com tons quentes, ligeiramente em relevo
  const leaves = size * size / 1600;
  for (let k = 0; k < leaves; k++) {
    const cx = r() * size, cy = r() * size, a = r() * Math.PI, L = size / 64 * (0.6 + r()), W = L * 0.4;
    const tone = r(), lr = mix(70, 112, tone), lg = mix(60, 92, tone), lb = mix(28, 40, tone);
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let dy = -L; dy <= L; dy++) for (let dx = -L; dx <= L; dx++) {
      const u = (dx * ca + dy * sa) / L, w = (-dx * sa + dy * ca) / W;
      if (u * u + w * w > 1) continue;
      const px = ((cx + dx) % size + size) % size | 0, py = ((cy + dy) % size + size) % size | 0;
      const j = py * size + px;
      col[j * 4] = lr; col[j * 4 + 1] = lg; col[j * 4 + 2] = lb;
      h[j] += 0.12;
    }
  }
  return { map: dataTex(col, size), normalMap: normalTex(h, size, 2.4 * size / 256) };
}

// Casca: fibras verticais (madeira) ou anéis (palmeira)
function barkSurface(size, seed, rings) {
  const n = makeNoise(size, seed, 5, 4), fine = makeNoise(size, seed + 1, 3, 16);
  return surface(size, (i, c) => {
    const x = i % size, y = (i / size) | 0;
    let hgt;
    if (rings) {
      const ring = (y / size * 10 + n[i] * 0.8) % 1;
      hgt = smooth(0, 0.25, ring) * (1 - smooth(0.75, 1, ring)) * 0.6 + fine[i] * 0.3;
    } else {
      const f = Math.sin((x / size) * Math.PI * 2 * 9 + n[i] * 10) * 0.5 + 0.5;
      hgt = f * 0.55 + fine[i] * 0.35;
    }
    const v = hgt * 0.7 + n[i] * 0.3;
    c[0] = mix(58, 128, v); c[1] = mix(44, 102, v); c[2] = mix(32, 74, v);
    return hgt;
  }, 3.0);
}

// Tábuas de madeira (caixotes)
function woodSurface(size, seed) {
  const n = makeNoise(size, seed, 4, 4), fine = makeNoise(size, seed + 1, 3, 32);
  return surface(size, (i, c) => {
    const x = i % size, y = (i / size) | 0;
    const plank = (y / (size / 4)) | 0, py = (y % (size / 4)) / (size / 4);
    const gap = smooth(0, 0.04, py) * smooth(0, 0.04, 1 - py);
    const grain = Math.sin((y / size) * 90 + n[i] * 14 + plank * 3) * 0.5 + 0.5;
    const v = grain * 0.55 + fine[i] * 0.25 + (plank % 2) * 0.12;
    c[0] = mix(74, 150, v) * (0.5 + 0.5 * gap); c[1] = mix(48, 104, v) * (0.5 + 0.5 * gap); c[2] = mix(26, 60, v) * (0.5 + 0.5 * gap);
    return gap * 0.7 + grain * 0.15;
  }, 2.5);
}

// Rocha natural (falésias, rochedos)
function rockSurface(size, seed) {
  const n = makeNoise(size, seed, 7, 3), fine = makeNoise(size, seed + 1, 3, 32), strata = makeNoise(size, seed + 2, 3, 2);
  return surface(size, (i, c) => {
    const y = (i / size) | 0;
    const s = Math.sin((y / size) * Math.PI * 2 * 6 + strata[i] * 8) * 0.5 + 0.5;
    const ridge = 1 - Math.abs(n[i] * 2 - 1);
    const v = n[i] * 0.5 + fine[i] * 0.25 + s * 0.25;
    c[0] = mix(78, 150, v); c[1] = mix(76, 142, v); c[2] = mix(70, 128, v);
    return ridge * 0.6 + s * 0.2 + fine[i] * 0.2;
  }, 3.5);
}

// Pedra gravada (lintéis, portão): frisos com glifos em baixo-relevo
function carvedSurface(size, seed) {
  const base = makeNoise(size, seed, 6, 4), fine = makeNoise(size, seed + 1, 3, 32);
  const r = rng(seed + 3);
  // máscara de glifos desenhada numa grelha
  const glyph = new Float32Array(size * size);
  const cells = 6, cs = size / cells;
  for (let gy = 0; gy < cells; gy++) for (let gx = 0; gx < cells; gx++) {
    const strokes = 3 + (r() * 4 | 0);
    for (let k = 0; k < strokes; k++) {
      const horiz = r() < 0.5, a = 0.2 + r() * 0.6, b0 = 0.15 + r() * 0.3, b1 = b0 + 0.2 + r() * 0.4;
      for (let t = b0 * cs; t < Math.min(b1, 0.85) * cs; t++) for (let w = -cs * 0.05; w <= cs * 0.05; w++) {
        const px = gx * cs + (horiz ? t : a * cs + w), py = gy * cs + (horiz ? a * cs + w : t);
        glyph[((py | 0) % size) * size + ((px | 0) % size)] = 1;
      }
    }
    if (r() < 0.5) { // círculo
      const cx = gx * cs + cs / 2, cy = gy * cs + cs / 2, R = cs * 0.25;
      for (let a = 0; a < 6.3; a += 0.02) for (let w = -cs * 0.04; w <= cs * 0.04; w++) {
        const px = cx + Math.cos(a) * (R + w), py = cy + Math.sin(a) * (R + w);
        glyph[((py | 0) % size) * size + ((px | 0) % size)] = 1;
      }
    }
  }
  return surface(size, (i, c) => {
    const y = (i / size) | 0, x = i % size;
    const border = (y % cs) < cs * 0.06 || (x % cs) < cs * 0.04 ? 1 : 0;
    const g = glyph[i] * (1 - border);
    const v = base[i] * 0.7 + fine[i] * 0.3;
    const ao = 1 - g * 0.35 - border * 0.25;
    c[0] = mix(104, 176, v) * ao; c[1] = mix(96, 162, v) * ao; c[2] = mix(80, 136, v) * ao;
    return (base[i] - 0.5) * 0.3 + fine[i] * 0.1 - g * 0.6 - border * 0.4;
  }, 3.0);
}

function canvasTex(size, paint, { repeat = 1, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  paint(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---- texturas com transparência para vegetação ----
function leafColor(r, light = 0) {
  const g = 90 + r() * 60 + light, rr = 40 + r() * 40 + light * 0.5, b = 20 + r() * 30;
  return `rgb(${rr | 0},${g | 0},${b | 0})`;
}

// Folha de palmeira: ráquis central com folíolos finos
function palmFrondTex(size) {
  const r = rng(41);
  return canvasTex(size, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const n = 24;
    for (let i = 0; i < n; i++) {
      const t = i / n, y = s * (0.02 + t * 0.96);
      const len = s * 0.48 * Math.sin(Math.PI * (0.12 + t * 0.85)) * (0.85 + r() * 0.2);
      for (const side of [-1, 1]) {
        ctx.strokeStyle = leafColor(r, 10); ctx.lineWidth = s / 55; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s / 2, y);
        ctx.quadraticCurveTo(s / 2 + side * len * 0.5, y + s * 0.02, s / 2 + side * len, y + s * 0.06 + r() * s * 0.02);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = '#6b6a2a'; ctx.lineWidth = s / 40;
    ctx.beginPath(); ctx.moveTo(s / 2, 0); ctx.lineTo(s / 2, s); ctx.stroke();
  });
}

// Cacho de folhas largas (copas e arbustos)
function leafClusterTex(size, seed, light = 0) {
  const r = rng(seed);
  return canvasTex(size, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * s * 0.38;
      const x = s / 2 + Math.cos(a) * d, y = s / 2 + Math.sin(a) * d;
      const L = s * (0.07 + r() * 0.06), W = L * 0.45, rot = r() * Math.PI * 2;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      const shade = d / (s * 0.38);
      ctx.fillStyle = leafColor(r, light - shade * 25);
      ctx.beginPath(); ctx.moveTo(-L, 0); ctx.quadraticCurveTo(0, -W, L, 0); ctx.quadraticCurveTo(0, W, -L, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(20,40,10,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, 0); ctx.stroke();
      ctx.restore();
    }
  });
}

// Tufos de erva
function grassTex(size) {
  const r = rng(77);
  return canvasTex(size, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    for (let i = 0; i < 60; i++) {
      const x = s * (0.1 + r() * 0.8), h = s * (0.45 + r() * 0.53), lean = (r() - 0.5) * s * 0.35, w = s * (0.012 + r() * 0.014);
      const g = ctx.createLinearGradient(0, s, 0, s - h);
      const c1 = leafColor(r, -20), c2 = leafColor(r, 30);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - w, s); ctx.quadraticCurveTo(x + lean * 0.3, s - h * 0.6, x + lean, s - h);
      ctx.quadraticCurveTo(x + lean * 0.3 + w, s - h * 0.6, x + w, s); ctx.fill();
    }
  });
}

// Feto: fronde com folíolos recortados
function fernTex(size) {
  const r = rng(13);
  return canvasTex(size, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.strokeStyle = '#3c6a24'; ctx.lineWidth = s / 90;
    ctx.beginPath(); ctx.moveTo(s / 2, s); ctx.quadraticCurveTo(s * 0.53, s * 0.45, s / 2, s * 0.02); ctx.stroke();
    for (let i = 0; i < 26; i++) {
      const t = i / 26, y = s * (0.98 - t * 0.95), w = s * 0.44 * Math.sin(Math.PI * (0.08 + t * 0.9)) * (1 - t * 0.35);
      for (const side of [-1, 1]) {
        ctx.fillStyle = leafColor(r, 5);
        ctx.save(); ctx.translate(s / 2, y); ctx.rotate(side * (1.15 - t * 0.3));
        for (let k = 0; k < 7; k++) {
          const u = (k / 7) * w;
          ctx.beginPath(); ctx.ellipse(u + w * 0.07, 0, w * 0.075, s * 0.012, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
    }
  });
}

// Trepadeira (folhas em cordão)
function vineTex(size) {
  const r = rng(91);
  return canvasTex(size, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.strokeStyle = '#4a3a20'; ctx.lineWidth = s / 24;
    ctx.beginPath(); ctx.moveTo(s / 2, 0);
    for (let y = 0; y <= s; y += s / 8) ctx.lineTo(s / 2 + Math.sin(y * 0.05) * s * 0.08, y);
    ctx.stroke();
    for (let i = 0; i < 26; i++) {
      const y = r() * s, side = r() < 0.5 ? -1 : 1, L = s * (0.16 + r() * 0.12);
      ctx.save(); ctx.translate(s / 2, y); ctx.rotate(side * (0.6 + r() * 0.8));
      ctx.fillStyle = leafColor(r, 0);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(L * 0.5, -L * 0.35, L, 0); ctx.quadraticCurveTo(L * 0.5, L * 0.35, 0, 0); ctx.fill();
      ctx.restore();
    }
  });
}

// Nuvens (camada a grande altitude)
function cloudTex(size) {
  const n = makeNoise(size, 101, 7, 3);
  const d = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const a = smooth(0.5, 0.78, n[i]);
    const shade = 200 + n[i] * 55;
    d[i * 4] = shade; d[i * 4 + 1] = shade; d[i * 4 + 2] = shade + 6; d[i * 4 + 3] = a * 235;
  }
  return dataTex(d, size);
}

// Espuma (cascata e anéis na água): ruído esticado na vertical, como água a correr
function foamTex(size) {
  const n = makeNoise(size, 55, 5, 4);
  const d = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const fy = y / 6, y0 = fy | 0, t = fy - y0;
    const ra = (y0 % size) * size, rb = ((y0 + 1) % size) * size;
    for (let x = 0; x < size; x++) {
      const v = n[ra + x] * (1 - t) + n[rb + x] * t;
      const a = smooth(0.38, 0.72, v * 0.7 + n[y * size + x] * 0.3);
      const i = (y * size + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 230 + v * 25; d[i + 3] = (0.25 + a * 0.75) * 255;
    }
  }
  return dataTex(d, size);
}

const clone = (t, rep) => { const c = t.clone(); c.repeat.set(rep, rep); c.needsUpdate = true; return c; };

export function createMaterials(quality) {
  const high = quality === 'high';
  const S = high ? 512 : 256;   // texturas de superfície (mosaico)
  const L = high ? 256 : 128;   // texturas de folhagem
  const mats = {};
  const pbr = (surf, extra = {}) => new THREE.MeshStandardMaterial({
    map: surf.map, normalMap: surf.normalMap, normalScale: new THREE.Vector2(1, 1), ...extra,
  });

  mats.stone = pbr(stoneSurface(S, 11, 0.25), { roughness: 0.9 });
  mats.mossStone = pbr(stoneSurface(S, 23, 1), { roughness: 0.95 });
  mats.sand = pbr(sandSurface(S, 5), { roughness: 1 });
  const ground = groundSurface(S, 9);
  mats.ground = pbr(ground, { roughness: 1, vertexColors: true });
  mats.wood = pbr(woodSurface(S, 31), { roughness: 0.8 });
  const rock = rockSurface(S, 63);
  mats.rock = pbr(rock, { roughness: 0.92, vertexColors: true });
  mats.cliff = pbr(rock, { roughness: 0.95 });
  mats.carved = pbr(carvedSurface(S, 71), { roughness: 0.9 });
  const bark = barkSurface(S / 2, 17, false);
  mats.trunk = pbr(bark, { roughness: 1 });
  const palmBark = barkSurface(S / 2, 19, true);
  mats.palmTrunk = pbr(palmBark, { roughness: 1 });

  mats.canvas = new THREE.MeshStandardMaterial({ color: 0xcdbb8e, roughness: 0.95, side: THREE.DoubleSide, normalMap: ground.normalMap });
  mats.gold = new THREE.MeshStandardMaterial({ color: 0xffc94a, metalness: 1, roughness: 0.25, emissive: 0x3a2400 });
  mats.bronze = new THREE.MeshStandardMaterial({ color: 0x9a6b3a, metalness: 0.9, roughness: 0.4 });
  mats.amber = new THREE.MeshPhysicalMaterial({
    color: 0xffa21f, emissive: 0xff7a00, emissiveIntensity: 1.6, roughness: 0.1, metalness: 0.2,
    transmission: high ? 0.4 : 0, thickness: 0.5,
  });
  mats.spike = new THREE.MeshStandardMaterial({ color: 0x5c5650, metalness: 0.8, roughness: 0.35 });
  mats.plate = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.7, emissive: 0x000000, map: mats.carved.map, normalMap: mats.carved.normalMap });
  mats.flame = new THREE.MeshBasicMaterial({ color: 0xffb040 });

  // folhagem: alpha-test (barato e projeta sombra recortada)
  const foliage = (map, extra = {}) => new THREE.MeshStandardMaterial({
    map, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, ...extra,
  });
  mats.palmFrond = foliage(palmFrondTex(L));
  mats.leaves = foliage(leafClusterTex(L, 3, 10));
  mats.leavesDark = foliage(leafClusterTex(L, 4, -15));
  mats.bush = foliage(leafClusterTex(L, 5, 20));
  mats.grass = foliage(grassTex(L));
  mats.fern = foliage(fernTex(L));
  mats.vine = foliage(vineTex(L / 2));

  mats.clouds = new THREE.MeshBasicMaterial({ map: cloudTex(high ? 512 : 256), transparent: true, depthWrite: false, fog: false });
  mats.clouds.map.repeat.set(3, 3);
  const foam = foamTex(128);
  mats.foam = new THREE.MeshBasicMaterial({ map: foam, transparent: true, depthWrite: false, color: 0xffffff, opacity: 0.85 });
  mats.waterfall = new THREE.MeshBasicMaterial({ map: foam.clone(), transparent: true, depthWrite: false, color: 0xdff4f2, side: THREE.DoubleSide });
  mats.waterfall.map.repeat.set(2, 3); mats.waterfall.map.needsUpdate = true;

  // Água: duas camadas de normais a deslizar em sentidos diferentes, reflexo do céu (environment)
  const wn = makeNoise(256, 77, 6, 4);
  const waterNormal = normalTex(wn, 256, 7);
  waterNormal.repeat.set(14, 14);
  mats.water = new THREE.MeshStandardMaterial({
    color: 0x15434c, roughness: 0.1, metalness: 0.1, normalMap: waterNormal,
    normalScale: new THREE.Vector2(0.55, 0.55), transparent: true, opacity: 0.9, envMapIntensity: 0.9,
  });
  mats.water.userData.time = { value: 0 };
  mats.water.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = mats.water.userData.time;
    sh.fragmentShader = 'uniform float uTime;\n' + sh.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `vec2 uvA = vNormalMapUv + vec2(uTime * 0.012, uTime * 0.02);
       vec2 uvB = vNormalMapUv * 0.37 + vec2(-uTime * 0.017, uTime * 0.006);
       vec3 nA = texture2D(normalMap, uvA).xyz * 2.0 - 1.0;
       vec3 nB = texture2D(normalMap, uvB).xyz * 2.0 - 1.0;
       vec3 mapN = normalize(vec3(nA.xy + nB.xy, nA.z * nB.z));
       mapN.xy *= normalScale;
       normal = normalize(tbn * mapN);`,
    );
  };
  return mats;
}

// Ajusta a repetição de UV de uma BoxGeometry ao tamanho real, para a textura não esticar
export function boxGeo(w, h, d, scale = 0.5) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, pos = g.attributes.position, nrm = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i));
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let u, v;
    if (nx > 0.5) { u = z; v = y; } else if (ny > 0.5) { u = x; v = z; } else { u = x; v = y; }
    uv.setXY(i, u * scale, v * scale);
  }
  return g;
}
