// Texturas procedurais (geradas em canvas) — não há ficheiros de imagem para descarregar,
// o que mantém o receiver leve para o Chromecast.
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Ruído de valor 2D com várias oitavas, periódico (tileable)
function makeNoise(size, seed, octaves = 5) {
  const r = rng(seed);
  const out = new Float32Array(size * size);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const cells = 4 << o;
    const grid = new Float32Array(cells * cells).map(() => r());
    const step = size / cells;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const gx = x / step, gy = y / step;
      const x0 = Math.floor(gx), y0 = Math.floor(gy);
      const fx = gx - x0, fy = gy - y0;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const g = (i, j) => grid[((j % cells) * cells) + (i % cells)];
      const a = g(x0, y0), b = g(x0 + 1, y0), c = g(x0, y0 + 1), d = g(x0 + 1, y0 + 1);
      out[y * size + x] += amp * ((a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy);
    }
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
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

function fromField(ctx, size, field, colorFn) {
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const [r, g, b] = colorFn(field[i], i);
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

const mix = (a, b, t) => a + (b - a) * t;
const mixc = (c1, c2, t) => [mix(c1[0], c2[0], t), mix(c1[1], c2[1], t), mix(c1[2], c2[2], t)];

// Pedra de templo com blocos, fendas e musgo
function stonePainter(seed, moss) {
  return (ctx, size) => {
    const n = makeNoise(size, seed, 6);
    const m = makeNoise(size, seed + 7, 4);
    fromField(ctx, size, n, (v, i) => {
      let c = mixc([92, 86, 74], [168, 158, 136], v);
      const mv = m[i];
      if (moss && mv > 0.55) c = mixc(c, [62, 92, 40], Math.min(1, (mv - 0.55) * 4));
      return c;
    });
    // juntas entre blocos
    ctx.strokeStyle = 'rgba(30,26,20,0.75)';
    ctx.lineWidth = size / 128;
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      const y = (r / rows) * size;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
      const off = (r % 2) * size / 4;
      for (let k = 0; k < 2; k++) {
        const x = off + k * size / 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + size / rows); ctx.stroke();
      }
    }
  };
}

function bumpFrom(painter, size) {
  // versão em tons de cinzento para bumpMap
  return canvasTex(size, (ctx, s) => {
    painter(ctx, s);
    const img = ctx.getImageData(0, 0, s, s);
    for (let i = 0; i < img.data.length; i += 4) {
      const l = (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = l;
    }
    ctx.putImageData(img, 0, 0);
  }, { srgb: false });
}

export function createMaterials(quality) {
  const S = quality === 'high' ? 512 : 256;
  const mats = {};

  const stoneP = stonePainter(11, false);
  mats.stone = new THREE.MeshStandardMaterial({
    map: canvasTex(S, stoneP), bumpMap: bumpFrom(stoneP, S), bumpScale: 2.2, roughness: 0.92,
  });
  const mossP = stonePainter(23, true);
  mats.mossStone = new THREE.MeshStandardMaterial({
    map: canvasTex(S, mossP), bumpMap: bumpFrom(mossP, S), bumpScale: 2.2, roughness: 0.95,
  });

  const sandN = makeNoise(S, 5, 6);
  mats.sand = new THREE.MeshStandardMaterial({
    map: canvasTex(S, (ctx, s) => fromField(ctx, s, sandN, (v) => mixc([170, 140, 95], [222, 196, 150], v))),
    roughness: 1,
  });
  const grassN = makeNoise(S, 9, 6);
  mats.ground = new THREE.MeshStandardMaterial({
    map: canvasTex(S, (ctx, s) => fromField(ctx, s, grassN, (v) => mixc([40, 58, 26], [96, 112, 52], v))),
    roughness: 1,
  });
  const woodN = makeNoise(S, 31, 4);
  mats.wood = new THREE.MeshStandardMaterial({
    map: canvasTex(S, (ctx, s) => fromField(ctx, s, woodN, (v, i) => {
      const y = Math.floor(i / s);
      const grain = 0.5 + 0.5 * Math.sin(y * 0.15 + v * 12);
      return mixc([70, 44, 24], [138, 94, 56], grain * 0.7 + v * 0.3);
    })), roughness: 0.8,
  });
  mats.canvas = new THREE.MeshStandardMaterial({ color: 0xb8a77f, roughness: 0.9, side: THREE.DoubleSide });
  mats.gold = new THREE.MeshStandardMaterial({ color: 0xffc94a, metalness: 1, roughness: 0.25, emissive: 0x3a2400 });
  mats.bronze = new THREE.MeshStandardMaterial({ color: 0x9a6b3a, metalness: 0.9, roughness: 0.4 });
  mats.amber = new THREE.MeshPhysicalMaterial({
    color: 0xffa21f, emissive: 0xff7a00, emissiveIntensity: 1.6, roughness: 0.1, metalness: 0.2,
    transmission: quality === 'high' ? 0.4 : 0, thickness: 0.5,
  });
  mats.spike = new THREE.MeshStandardMaterial({ color: 0x5c5650, metalness: 0.8, roughness: 0.35 });
  mats.trunk = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 });
  mats.leaves = new THREE.MeshStandardMaterial({ color: 0x2f6b2a, roughness: 0.9, flatShading: true });
  mats.leavesDark = new THREE.MeshStandardMaterial({ color: 0x1f4d22, roughness: 0.9, flatShading: true });
  mats.vine = new THREE.MeshStandardMaterial({ color: 0x3d7a2e, roughness: 0.9, side: THREE.DoubleSide });
  mats.plate = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.7, emissive: 0x000000 });
  mats.flame = new THREE.MeshBasicMaterial({ color: 0xffb040 });

  // Fetos: plano com folha desenhada e transparência
  mats.fern = new THREE.MeshStandardMaterial({
    map: canvasTex(128, (ctx, s) => {
      ctx.clearRect(0, 0, s, s);
      ctx.strokeStyle = '#3c7a2c'; ctx.fillStyle = '#4f9a38'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(s / 2, s); ctx.quadraticCurveTo(s * 0.55, s * 0.4, s / 2, 4); ctx.stroke();
      for (let i = 0; i < 14; i++) {
        const y = s - i * (s / 15);
        const w = (s * 0.45) * (1 - i / 16);
        ctx.beginPath(); ctx.ellipse(s / 2 - w / 2, y, w / 2, 4, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(s / 2 + w / 2, y, w / 2, 4, 0.4, 0, Math.PI * 2); ctx.fill();
      }
    }), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9,
  });

  // Água: normal map procedural animado no loop
  const waterN = makeNoise(256, 77, 5);
  const waterNormal = canvasTex(256, (ctx, s) => {
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const h = (xx, yy) => waterN[((yy + s) % s) * s + ((xx + s) % s)];
      const dx = (h(x + 1, y) - h(x - 1, y)) * 6, dy = (h(x, y + 1) - h(x, y - 1)) * 6;
      const i = (y * s + x) * 4;
      img.data[i] = 128 + dx * 127; img.data[i + 1] = 128 + dy * 127; img.data[i + 2] = 255; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, { repeat: 12, srgb: false });
  mats.water = new THREE.MeshStandardMaterial({
    color: 0x1d5f6b, roughness: 0.08, metalness: 0.1, normalMap: waterNormal,
    normalScale: new THREE.Vector2(0.6, 0.6), transparent: true, opacity: 0.86,
  });
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
