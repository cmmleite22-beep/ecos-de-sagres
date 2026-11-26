// Desenho procedimental dos lutadores: esqueleto 2D com cinemática inversa (IK) e "pele" vetorial
// (cápsulas afiladas com contorno escuro, sombreado por gradiente e luz de recorte do cenário).
// Coordenadas locais: origem no chão por baixo da anca, y para cima, lutador virado para +x.
// Partilhado pela TV (jogo) e pelo telemóvel (retratos no ecrã de escolha).

export const BONES = { thigh: 60, shin: 58, foot: 24, torso: 78, neck: 10, head: 20, upper: 44, fore: 42 };

const D2R = Math.PI / 180;
const POSE_KEYS = ['t', 'h', 'rot'];
const PAIR_KEYS = ['hip', 'hf', 'hb', 'ff', 'fb'];

export function lerpPose(a, b, k) {
  const o = {};
  for (const n of POSE_KEYS) o[n] = (a[n] || 0) + ((b[n] || 0) - (a[n] || 0)) * k;
  for (const n of PAIR_KEYS) {
    const pa = a[n] || [0, 0], pb = b[n] || [0, 0];
    o[n] = [pa[0] + (pb[0] - pa[0]) * k, pa[1] + (pb[1] - pa[1]) * k];
  }
  return o;
}
export function clonePose(p) { return lerpPose(p, p, 0); }

// IK de dois ossos: devolve [articulação, ponta]. bend +1 = articulação para +x quando o membro aponta para baixo
function ik(rx, ry, tx, ty, l1, l2, bend) {
  let dx = tx - rx, dy = ty - ry;
  let d = Math.hypot(dx, dy) || 0.001;
  const max = (l1 + l2) * 0.999, min = Math.abs(l1 - l2) + 0.5;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; }
  if (d < min) { dx *= min / d; dy *= min / d; d = min; }
  const base = Math.atan2(dy, dx);
  const a = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const ang = base + bend * a;
  const jx = rx + Math.cos(ang) * l1, jy = ry + Math.sin(ang) * l1;
  return [[jx, jy], [rx + dx, ry + dy]];
}

// Calcula as articulações em coordenadas locais (y para cima)
export function skeleton(pose, size = 1) {
  const s = size;
  const hip = [pose.hip[0] * s, pose.hip[1] * s];
  const rot = (pose.rot || 0) * D2R;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  // tudo é calculado relativo à anca e depois rodado por "rot" em torno dela
  const R = (x, y) => [hip[0] + x * cr - y * sr, hip[1] + x * sr + y * cr];
  const t = (pose.t || 0) * D2R;
  const L = BONES.torso * s;
  const ux = Math.sin(t), uy = Math.cos(t);
  const neckL = [ux * L, uy * L];
  const hd = ((pose.h || 0) + (pose.t || 0) * 0.5) * D2R;
  const headL = [neckL[0] + Math.sin(hd) * (BONES.neck + BONES.head) * s, neckL[1] + Math.cos(hd) * (BONES.neck + BONES.head) * s];
  const shF = [neckL[0] - ux * 8 * s + 3 * s, neckL[1] - uy * 8 * s];
  const shB = [neckL[0] - ux * 8 * s - 4 * s, neckL[1] - uy * 8 * s];
  const [elF, haF] = ik(shF[0], shF[1], shF[0] + pose.hf[0] * s, shF[1] + pose.hf[1] * s, BONES.upper * s, BONES.fore * s, -1);
  const [elB, haB] = ik(shB[0], shB[1], shB[0] + pose.hb[0] * s, shB[1] + pose.hb[1] * s, BONES.upper * s, BONES.fore * s, -1);
  const hpF = [2 * s, -4 * s], hpB = [-3 * s, -4 * s];
  const [knF, anF] = ik(hpF[0], hpF[1], pose.ff[0] * s, pose.ff[1] * s, BONES.thigh * s, BONES.shin * s, 1);
  const [knB, anB] = ik(hpB[0], hpB[1], pose.fb[0] * s, pose.fb[1] * s, BONES.thigh * s, BONES.shin * s, 1);
  // pé: aponta para a frente, perpendicular à canela (com limite para não "partir" o tornozelo)
  const foot = (kn, an) => {
    const a = Math.atan2(an[1] - kn[1], an[0] - kn[0]) + Math.PI / 2;
    const fa = Math.max(-0.6, Math.min(0.6, a)) ;
    return [an[0] + Math.cos(fa) * BONES.foot * s, an[1] + Math.sin(fa) * BONES.foot * s];
  };
  const toeF = foot(knF, anF), toeB = foot(knB, anB);
  const J = { hip: R(0, 0), neck: R(...neckL), head: R(...headL), shF: R(...shF), shB: R(...shB),
    elF: R(...elF), hf: R(...haF), elB: R(...elB), hb: R(...haB),
    hpF: R(...hpF), hpB: R(...hpB), knF: R(...knF), ff: R(...anF), knB: R(...knB), fb: R(...anB),
    toeF: R(...toeF), toeB: R(...toeB) };
  J.torsoAng = t + rot; J.headAng = hd + rot; J.rot = rot;
  return J;
}

// ---------------------------------------------------------------- cores
const cache = new Map();
function rgb(hex) {
  if (cache.has(hex)) return cache.get(hex);
  const h = hex.replace('#', '');
  const v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  cache.set(hex, v);
  return v;
}
export function mix(a, b, k) {
  const A = rgb(a), B = rgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
const toHex = (s) => {
  const m = s.match(/\d+/g).map(Number);
  return '#' + m.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('');
};
export function shade(hex, k) { return k >= 0 ? mix(hex, '#ffffff', k) : mix(hex, '#000000', -k); }

// paleta por lutador e luz do cenário (cache)
const palCache = new Map();
function palette(look, rim) {
  const key = look.id + rim + (look.alt ? 1 : 0);
  if (palCache.has(key)) return palCache.get(key);
  const p = {};
  for (const [k, v] of Object.entries(look.colors)) {
    if (typeof v !== 'string' || v[0] !== '#') continue;
    p[k] = { base: v, lite: toHex(mix(toHex(shade(v, 0.18)), rim, 0.35)), dark: toHex(shade(v, -0.38)) };
  }
  palCache.set(key, p);
  return p;
}

// ---------------------------------------------------------------- primitivas
const OUT = '#120c0a';
function capsulePath(ctx, ax, ay, bx, by, ra, rb) {
  const a = Math.atan2(by - ay, bx - ax);
  ctx.beginPath();
  ctx.arc(ax, ay, ra, a + Math.PI / 2, a - Math.PI / 2);
  ctx.arc(bx, by, rb, a - Math.PI / 2, a + Math.PI / 2);
  ctx.closePath();
}
function grad(ctx, ax, ay, bx, by, r, c) {
  // gradiente perpendicular ao membro: lado de cima/frente mais claro
  const a = Math.atan2(by - ay, bx - ax);
  let nx = -Math.sin(a), ny = Math.cos(a);
  if (ny > 0) { nx = -nx; ny = -ny; } // lado claro = para cima no ecrã
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const g = ctx.createLinearGradient(mx + nx * r, my + ny * r, mx - nx * r, my - ny * r);
  g.addColorStop(0, c.lite); g.addColorStop(0.45, c.base); g.addColorStop(1, c.dark);
  return g;
}

// ---------------------------------------------------------------- lutador
// f = { x, y, face, pose, look, tails, flash, alpha }  ctx já em coordenadas de ecrã
// opts = { ground (y do chão no ecrã), rim (cor da luz), scale }
export function drawFighter(ctx, f, opts) {
  const look = f.look;
  const s = f.size || look.size || 1;
  const J = skeleton(f.pose, s);
  const pal = palette(look, opts.rim || '#ffffff');
  const sc = opts.scale || 1;
  const face = f.face;
  ctx.save();
  ctx.translate(f.x, opts.ground - (f.y || 0) * sc);
  ctx.scale(face * sc, -sc); // y para cima, virado para +x
  if (f.alpha !== undefined) ctx.globalAlpha = f.alpha;
  const B = look.build || {};
  const w = (n) => n * s * (B.limb || 1);
  const C = look.colors;
  const skin = pal.skin;
  const topC = pal.top, pantsC = pal.pants;
  const armUpperC = look.sleeves === 'long' || look.sleeves === 'short' ? topC : skin;
  const armForeC = look.sleeves === 'long' ? topC : (look.wraps ? pal.wraps : skin);
  const legUpperC = pantsC;
  const legLowerC = look.pants === 'shorts' ? skin : pantsC;

  const limb = (a, b, ra, rb, col, outline = true) => {
    if (outline) { ctx.fillStyle = OUT; capsulePath(ctx, a[0], a[1], b[0], b[1], ra + 2.6, rb + 2.6); ctx.fill(); }
    ctx.fillStyle = grad(ctx, a[0], a[1], b[0], b[1], Math.max(ra, rb), col);
    capsulePath(ctx, a[0], a[1], b[0], b[1], ra, rb); ctx.fill();
  };
  const ball = (p, r, col) => {
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(p[0], p[1], r + 2.6, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(p[0] - r * 0.3, p[1] + r * 0.35, r * 0.1, p[0], p[1], r);
    g.addColorStop(0, col.lite); g.addColorStop(0.6, col.base); g.addColorStop(1, col.dark);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.fill();
  };
  const legSet = (hp, kn, an, toe, dim) => {
    const k = dim ? 0.82 : 1;
    const lc = dim ? darker(legUpperC) : legUpperC, sc2 = dim ? darker(legLowerC) : legLowerC;
    const shoe = look.shoes ? (dim ? darker(pal.shoes) : pal.shoes) : (dim ? darker(skin) : skin);
    limb(kn, an, w(10.5) * k, w(7.5) * k, sc2);
    if (look.pants === 'shorts') { // calção até meio da coxa
      limb(hp, kn, w(13.5), w(11), dim ? darker(skin) : skin);
      const mid = [hp[0] + (kn[0] - hp[0]) * 0.62, hp[1] + (kn[1] - hp[1]) * 0.62];
      limb(hp, mid, w(15), w(13.5), lc);
      if (C.stripe) { ctx.strokeStyle = C.stripe; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(hp[0], hp[1]); ctx.lineTo(mid[0], mid[1]); ctx.stroke(); }
    } else {
      limb(hp, kn, w(14), w(11), lc);
      if (look.pants === 'cargo') { // bainha dobrada
        const c = [kn[0] + (an[0] - kn[0]) * 0.72, kn[1] + (an[1] - kn[1]) * 0.72];
        limb(c, [kn[0] + (an[0] - kn[0]) * 0.8, kn[1] + (an[1] - kn[1]) * 0.8], w(10), w(9.5), dim ? darker(pantsC) : pal.pants2 || pantsC);
      }
    }
    // pé
    limb(an, toe, w(7), w(5.5), shoe);
    if (look.shoes === 'boots') limb(an, [an[0] + (kn[0] - an[0]) * 0.25, an[1] + (kn[1] - an[1]) * 0.25], w(9), w(9), shoe);
  };
  const armSet = (sh, el, ha, dim, fist) => {
    const k = dim ? 0.9 : 1;
    const u = dim ? darker(armUpperC) : armUpperC, fo = dim ? darker(armForeC) : armForeC;
    limb(sh, el, w(9.5 * (B.arm || 1)) * k, w(7.8 * (B.arm || 1)) * k, u);
    limb(el, ha, w(7.8 * (B.arm || 1)) * k, w(6.5 * (B.arm || 1)) * k, fo);
    const g = look.gloves ? pal.gloves : skin;
    ball(ha, w(fist ? 9.5 : 8.5) * (look.gloves ? 1.25 : 1), dim ? darker(g) : g);
    if (look.gloves) { // punho da luva
      ctx.fillStyle = dim ? darker(pal.cuff || pal.gloves).base : (pal.cuff || pal.gloves).base;
      const cx = ha[0] + (el[0] - ha[0]) * 0.28, cy = ha[1] + (el[1] - ha[1]) * 0.28;
      ctx.beginPath(); ctx.arc(cx, cy, w(7.5), 0, Math.PI * 2); ctx.fill();
    }
  };

  // sombras/longe -> perto
  drawTails(ctx, f, J, s, pal, 'back');
  armSet(J.shB, J.elB, J.hb, true, true);
  legSet(J.hpB, J.knB, J.fb, J.toeB, true);
  drawTorso(ctx, J, s, look, pal, B);
  legSet(J.hpF, J.knF, J.ff, J.toeF, false);
  drawHead(ctx, J, s, look, pal, f);
  drawTails(ctx, f, J, s, pal, 'front');
  armSet(J.shF, J.elF, J.hf, false, true);

  // clarão branco quando é atingido / brilho de super
  if (f.flash) {
    ctx.globalCompositeOperation = 'lighter';
    const cy = J.hip[1] + 40 * s;
    const g = ctx.createRadialGradient(J.hip[0], cy, 10 * s, J.hip[0], cy, 90 * s);
    g.addColorStop(0, f.flashColor || '#ffffff'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = Math.min(1, f.flash) * 0.4;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(J.hip[0], cy, 90 * s, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  return J;
}

function darker(c) { return { base: c.dark, lite: c.base, dark: toHex(shade(c.dark, -0.3)) }; }

function drawTorso(ctx, J, s, look, pal, B) {
  const a = J.torsoAng;
  const ux = Math.sin(a), uy = Math.cos(a);
  const nx = Math.cos(a), ny = -Math.sin(a); // normal para a frente
  const L = BONES.torso * s;
  const [hx, hy] = J.hip;
  const bw = B.chest || 1, ww = B.waist || 1;
  const P = (along, side) => [hx + ux * L * along + nx * side * s, hy + uy * L * along + ny * side * s];
  const pts = [
    P(-0.16, 21 * ww), P(0.42, 18 * ww), P(0.78, 27 * bw), P(1.0, 18 * bw),
    P(1.05, -7), P(0.92, -24 * bw), P(0.5, -18 * ww), P(-0.14, -23 * ww),
  ];
  const path = (grow) => {
    ctx.beginPath();
    // contorno suave com curvas por pontos médios
    const n = pts.length;
    const g = (p, c) => [p[0] + (p[0] - c[0]) * grow, p[1] + (p[1] - c[1]) * grow];
    const cen = P(0.45, 0);
    const Q = pts.map((p) => g(p, cen));
    const m0 = [(Q[n - 1][0] + Q[0][0]) / 2, (Q[n - 1][1] + Q[0][1]) / 2];
    ctx.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) {
      const p = Q[i], q = Q[(i + 1) % n];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.closePath();
  };
  const top = pal.top;
  ctx.fillStyle = OUT; path(0.11); ctx.fill();
  const gx0 = P(0.6, 24), gx1 = P(0.6, -22);
  const g = ctx.createLinearGradient(gx0[0], gx0[1], gx1[0], gx1[1]);
  g.addColorStop(0, top.lite); g.addColorStop(0.5, top.base); g.addColorStop(1, top.dark);
  ctx.fillStyle = g; path(0); ctx.fill();
  ctx.save(); path(0); ctx.clip();
  // detalhes de roupa
  if (look.top === 'vest') { // colete aberto: tira de peito à mostra
    const c = pal.skin;
    ctx.fillStyle = c.base;
    ctx.beginPath();
    const p1 = P(1.0, 12), p2 = P(0.35, 16), p3 = P(0.35, 8), p4 = P(1.0, 0);
    ctx.moveTo(...p1); ctx.lineTo(...p2); ctx.lineTo(...p3); ctx.lineTo(...p4); ctx.fill();
  }
  if (look.top === 'tank' || look.top === 'tee') { // decote
    ctx.fillStyle = pal.skin.base;
    ctx.beginPath(); const c = P(1.0, 10); ctx.ellipse(c[0], c[1], 9 * s, 7 * s, a, 0, Math.PI * 2); ctx.fill();
  }
  if (look.chestMark) { // emblema/padrão
    ctx.fillStyle = look.chestMark;
    const c = P(0.68, 10);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) { // estrela de 4 pontas estilo rosa-dos-ventos
      const an = a + i * Math.PI / 2;
      ctx.lineTo(c[0] + Math.sin(an) * 9 * s, c[1] + Math.cos(an) * 9 * s);
      ctx.lineTo(c[0] + Math.sin(an + Math.PI / 4) * 3 * s, c[1] + Math.cos(an + Math.PI / 4) * 3 * s);
    }
    ctx.fill();
  }
  // calças/cinto na parte de baixo do tronco
  const pc = pal.pants;
  ctx.fillStyle = pc.base;
  ctx.beginPath(); const b1 = P(0.14, 30), b2 = P(0.14, -30), b3 = P(-0.4, -30), b4 = P(-0.4, 30);
  ctx.moveTo(...b1); ctx.lineTo(...b2); ctx.lineTo(...b3); ctx.lineTo(...b4); ctx.fill();
  if (pal.belt) {
    ctx.strokeStyle = pal.belt.base; ctx.lineWidth = 7 * s;
    ctx.beginPath(); ctx.moveTo(...P(0.14, 30)); ctx.lineTo(...P(0.14, -30)); ctx.stroke();
  }
  ctx.restore();
}

function drawHead(ctx, J, s, look, pal, f) {
  const [nx, ny] = J.neck, [hx, hy] = J.head;
  const skin = pal.skin;
  // pescoço
  ctx.fillStyle = OUT; capsulePath(ctx, nx, ny - 4 * s, hx, hy, 9.5 * s * (look.build?.neck || 1), 9 * s); ctx.fill();
  ctx.fillStyle = skin.dark; capsulePath(ctx, nx, ny - 4 * s, hx, hy, 7 * s * (look.build?.neck || 1), 6.5 * s); ctx.fill();
  const a = J.headAng;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(-a);
  const r = BONES.head * s;
  // cabelo atrás
  const hair = pal.hair;
  if (look.hair === 'ponytail' || look.hair === 'bob' || look.hair === 'curly') {
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.ellipse(-3 * s, 3 * s, r * 1.08 + 2.5, r * 1.1 + 2.5, 0, 0, Math.PI * 2); ctx.fill();
  }
  // cabeça
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.92 + 2.6, r + 2.6, 0, 0, Math.PI * 2); ctx.fill();
  // queixo/nariz
  ctx.beginPath(); ctx.moveTo(r * 0.55, -r * 0.2); ctx.lineTo(r * 1.06 + 2, -r * 0.05); ctx.lineTo(r * 0.7, -r * 0.55); ctx.closePath(); ctx.fill();
  const g = ctx.createRadialGradient(-r * 0.2, r * 0.35, r * 0.1, 0, 0, r * 1.05);
  g.addColorStop(0, skin.lite); g.addColorStop(0.65, skin.base); g.addColorStop(1, skin.dark);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.92, r, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.2); ctx.lineTo(r * 1.06, -r * 0.05); ctx.lineTo(r * 0.62, -r * 0.5); ctx.closePath(); ctx.fill();
  // barba
  if (look.beard) {
    ctx.fillStyle = hair.base;
    ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.1); ctx.quadraticCurveTo(-r * 0.3, -r * 1.15, r * 0.55, -r * 0.95);
    ctx.lineTo(r * 0.85, -r * 0.45); ctx.quadraticCurveTo(r * 0.3, -r * 0.55, r * 0.1, -r * 0.25); ctx.closePath(); ctx.fill();
  }
  // olho e sobrancelha (olhar determinado)
  const hurt = f.hurtFace;
  ctx.fillStyle = '#1a0f0c';
  if (hurt) { ctx.lineWidth = 2.4 * s; ctx.strokeStyle = '#1a0f0c'; ctx.beginPath(); ctx.moveTo(r * 0.38, r * 0.2); ctx.lineTo(r * 0.7, r * 0.05); ctx.stroke(); }
  else { ctx.beginPath(); ctx.ellipse(r * 0.55, r * 0.12, 2.6 * s, 3.4 * s, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.lineWidth = 3 * s; ctx.strokeStyle = look.beard || look.hair === 'bald' ? '#2a1a12' : hair.dark; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(r * 0.28, r * 0.38); ctx.lineTo(r * 0.78, r * 0.26); ctx.stroke();
  // boca
  ctx.lineWidth = 1.8 * s; ctx.strokeStyle = '#3a1c14';
  ctx.beginPath(); ctx.moveTo(r * 0.55, -r * 0.48); ctx.lineTo(r * 0.82, -r * 0.42); ctx.stroke();
  // orelha
  ctx.fillStyle = skin.dark; ctx.beginPath(); ctx.ellipse(-r * 0.12, 0, 3.5 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
  // cabelo à frente
  ctx.fillStyle = hair.base;
  if (look.hair === 'ponytail') {
    ctx.beginPath(); ctx.ellipse(-r * 0.1, r * 0.3, r * 0.98, r * 0.78, -0.15, -Math.PI * 0.08, Math.PI * 1.05); ctx.fill();
    ctx.fillStyle = hair.lite; ctx.beginPath(); ctx.ellipse(-r * 0.2, r * 0.68, r * 0.55, r * 0.16, -0.1, 0, Math.PI * 2); ctx.fill();
  } else if (look.hair === 'bob') {
    ctx.beginPath(); ctx.moveTo(r * 0.75, r * 0.55);
    ctx.quadraticCurveTo(r * 0.3, r * 1.25, -r * 0.6, r * 0.9);
    ctx.quadraticCurveTo(-r * 1.2, r * 0.3, -r * 0.95, -r * 0.75);
    ctx.lineTo(-r * 0.35, -r * 0.7); ctx.quadraticCurveTo(-r * 0.4, r * 0.15, r * 0.1, r * 0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = hair.lite; ctx.beginPath(); ctx.ellipse(-r * 0.25, r * 0.78, r * 0.45, r * 0.13, 0.2, 0, Math.PI * 2); ctx.fill();
  } else if (look.hair === 'curly') {
    for (const [x, y, rr] of [[-0.6, 0.6, 0.42], [-0.15, 0.85, 0.42], [0.35, 0.8, 0.38], [-0.85, 0.15, 0.38], [-0.7, -0.3, 0.32], [0.62, 0.55, 0.3]]) {
      ctx.beginPath(); ctx.arc(x * r, y * r, rr * r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = hair.lite; ctx.beginPath(); ctx.arc(-0.2 * r, 0.95 * r, 0.16 * r, 0, Math.PI * 2); ctx.fill();
  } else if (look.hair === 'bald') {
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.ellipse(-r * 0.15, r * 0.62, r * 0.35, r * 0.15, 0.3, 0, Math.PI * 2); ctx.fill();
  }
  // fita na testa
  if (pal.band) {
    ctx.fillStyle = pal.band.base;
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, r * 1.02, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillRect(-r * 1.2, r * 0.5, r * 2.4, r * 0.22); ctx.restore();
  }
  ctx.restore();
}

// Rabo-de-cavalo, pontas da fita e da faixa: cadeias de pontos com física simples (f.tails)
function drawTails(ctx, f, J, s, pal, layer) {
  if (!f.tails) return;
  for (const t of f.tails) {
    if (t.def.layer !== layer) continue;
    const col = pal[t.def.color];
    if (!col) continue;
    const pts = t.pts; // em coordenadas locais (y para cima)
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [lw, c] of [[t.def.w * s + 5, OUT], [t.def.w * s, col.base], [t.def.w * s * 0.35, col.lite]]) {
      ctx.strokeStyle = c; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      ctx.stroke();
    }
  }
}

// Âncora de cada cadeia, em coordenadas locais
export function tailAnchor(def, J, s) {
  const r = BONES.head * s;
  const a = J.headAng;
  const off = (dx, dy) => [J.head[0] + Math.cos(a) * dx * r + Math.sin(a) * dy * r, J.head[1] - Math.sin(a) * dx * r + Math.cos(a) * dy * r];
  if (def.at === 'head') return off(-0.9, 0.45);
  if (def.at === 'band') return off(-0.95, 0.68);
  if (def.at === 'waist') return [J.hip[0] - Math.cos(J.torsoAng) * 18 * s, J.hip[1] + 10 * s];
  return J.head;
}

// Física das cadeias: chamada pelo jogo a cada passo (wx = velocidade horizontal do lutador no mundo)
export function updateTails(f, J, s, wind = 0) {
  if (!f.look.tails) return;
  if (!f.tails) f.tails = f.look.tails.map((def) => ({ def, pts: null }));
  for (const t of f.tails) {
    const a = tailAnchor(t.def, J, s);
    const n = t.def.n, seg = t.def.len * s / n;
    if (!t.pts) { t.pts = Array.from({ length: n + 1 }, (_, i) => [a[0] - i * seg * 0.7, a[1] - i * seg * 0.7]); t.prev = t.pts.map((p) => [...p]); }
    // a velocidade do lutador entra como "vento" ao contrário (local: frente = +x)
    const vx = -(f.vx || 0) * f.face * 0.35 + wind * f.face, vy = -(f.vy || 0) * 0.25;
    for (let i = 1; i <= n; i++) {
      const p = t.pts[i], q = t.prev[i];
      const nx = p[0] + (p[0] - q[0]) * 0.86 + vx * 0.08, ny = p[1] + (p[1] - q[1]) * 0.86 - 0.55 + vy * 0.08;
      q[0] = p[0]; q[1] = p[1]; p[0] = nx; p[1] = ny;
    }
    t.pts[0] = a;
    for (let k = 0; k < 3; k++) {
      for (let i = 1; i <= n; i++) {
        const p = t.pts[i], q = t.pts[i - 1];
        const dx = p[0] - q[0], dy = p[1] - q[1], d = Math.hypot(dx, dy) || 0.01;
        const m = (d - seg) / d;
        p[0] -= dx * m; p[1] -= dy * m;
      }
    }
  }
}
