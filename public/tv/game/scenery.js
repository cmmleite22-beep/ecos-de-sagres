// Cenário envolvente do Capítulo 1: terreno com colinas, selva (palmeiras, árvores de copa, arbustos,
// erva, fetos), rochas, montanhas, nuvens, cascatas, ruínas ao longe e pássaros.
// Tudo instanciado (uma chamada de desenho por tipo) para caber no Chromecast.
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, boxGeo } from './textures.js';

// ---------- ruído de valor 2D/3D (não periódico) ----------
function hash(x, y, z = 0) {
  let h = (x * 374761393 + y * 668265263 + z * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0), b = hash(x0 + 1, y0), c = hash(x0, y0 + 1), d = hash(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function vnoise3(x, y, z) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const fx = x - x0, fy = y - y0, fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  const p = (dz) => l(l(hash(x0, y0, z0 + dz), hash(x0 + 1, y0, z0 + dz), sx), l(hash(x0, y0 + 1, z0 + dz), hash(x0 + 1, y0 + 1, z0 + dz), sx), sy);
  return l(p(0), p(1), sz);
}
export function fbm(x, y, oct = 4) {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; }
  return v / (1 - Math.pow(0.5, oct));
}
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// Altura do terreno fora do caminho do templo (|x| < 12 é rio)
export function terrainHeight(x, z) {
  const d = Math.abs(x);
  let h = -1.8 + 2.1 * smooth(11.5, 17, d);                              // margem do rio
  h += smooth(16, 45, d) * (1.5 + 7 * fbm(x * 0.025 + 7, z * 0.025));    // colinas
  h += smooth(45, 90, d) * 22 * fbm(x * 0.012 + 3, z * 0.012 + 9, 3);    // morros ao fundo
  h += smooth(15, 22, d) * (fbm(x * 0.2, z * 0.2, 2) - 0.5) * 0.8;       // irregularidade fina
  return h;
}

export class Scenery {
  constructor(group, mats, quality) {
    this.group = group; this.mats = mats; this.high = quality === 'high';
    this.r = rng(2024);
    this.anim = [];
  }

  build() {
    this.terrain();
    this.mountains();
    this.clouds();
    this.jungle();
    this.rocks();
    this.distantRuins();
    this.waterfall(23, 92, 15, 4.5, -Math.PI / 2);
    this.waterfall(-27, 46, 8, 3, Math.PI / 2 - 0.3);
    this.birds();
  }

  // ---------- terreno ----------
  terrain() {
    const segX = this.high ? 70 : 40, segZ = this.high ? 150 : 80;
    for (const side of [-1, 1]) {
      const W = 110, D = 280;
      const geo = new THREE.PlaneGeometry(W, D, segX, segZ);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position, uv = geo.attributes.uv;
      const col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        // concentra vértices perto do rio (onde se vê de perto)
        const u = pos.getX(i) / W + 0.5;
        const x = side * (11 + Math.pow(u, 1.6) * W);
        const z = pos.getZ(i) + 90;
        const y = terrainHeight(x, z);
        pos.setXYZ(i, x, y, z);
        uv.setXY(i, x * 0.14, z * 0.14);
        // cor: areia molhada/seca junto à água, terra/erva no resto, rocha nas encostas fortes
        const shore = 1 - smooth(-0.2, 1.0, y);
        const n = fbm(x * 0.08, z * 0.08, 2);
        let r = 0.9 + n * 0.25, g = 1.0 + n * 0.2, b = 0.85 + n * 0.15;
        r += shore * 0.75; g += shore * 0.45; b += shore * 0.25;
        if (y < -0.3) { r *= 0.7; g *= 0.72; b *= 0.75; } // areia molhada
        col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.computeVertexNormals();
      // rocha nas encostas (usa a normal)
      const nrm = geo.attributes.normal;
      for (let i = 0; i < pos.count; i++) {
        const steep = smooth(0.85, 0.65, nrm.getY(i));
        if (steep > 0) { col[i * 3] = col[i * 3] * (1 - steep) + 1.25 * steep; col[i * 3 + 1] = col[i * 3 + 1] * (1 - steep) + 1.05 * steep; col[i * 3 + 2] = col[i * 3 + 2] * (1 - steep) + 0.9 * steep; }
      }
      if (side < 0) { // mantém as faces viradas para cima depois do espelho
        const idx = geo.index.array;
        for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 2]; idx[i + 2] = t; }
        geo.computeVertexNormals();
      }
      const m = new THREE.Mesh(geo, this.mats.ground);
      m.receiveShadow = true;
      this.group.add(m);
    }
  }

  // ---------- montanhas ao longe ----------
  mountains() {
    const geo = new THREE.ConeGeometry(1, 1, 28, 10, true);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i) + 0.5, z = pos.getZ(i);
      const a = Math.atan2(z, x);
      const n = fbm(a * 1.6 + 5, y * 3, 4);
      const k = 0.75 + n * 0.55;
      pos.setXYZ(i, x * k, y * (0.85 + n * 0.3), z * k);
    }
    geo.computeVertexNormals();
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), n = fbm(i * 0.37, y * 4, 2);
      const rock = smooth(0.45, 0.8, y + (n - 0.5) * 0.3);
      col[i * 3] = 0.2 + rock * 0.32; col[i * 3 + 1] = 0.32 + rock * 0.18; col[i * 3 + 2] = 0.18 + rock * 0.27;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    const n = 16;
    const inst = new THREE.InstancedMesh(geo, mat, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, h = 55 + this.r() * 60, rad = 40 + this.r() * 35;
      p.set(side * (120 + this.r() * 70), -6, -40 + i * 18 + this.r() * 12);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.r() * 6);
      s.set(rad, h, rad * (0.8 + this.r() * 0.4));
      inst.setMatrixAt(i, m4.compose(p, q, s));
    }
    this.group.add(inst);
  }

  // ---------- nuvens: cúpula com textura, a desvanecer no horizonte ----------
  clouds() {
    const geo = new THREE.SphereGeometry(520, 32, 10, 0, Math.PI * 2, 0, Math.PI * 0.42);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    const col = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      uv.setXY(i, x / 520 + 0.5, z / 520 + 0.5);
      const a = smooth(60, 240, y);
      col.set([1, 1, 1, a], i * 4);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    const mat = this.mats.clouds;
    mat.vertexColors = true; mat.side = THREE.BackSide;
    const dome = new THREE.Mesh(geo, mat);
    dome.position.set(0, -40, 80);
    dome.renderOrder = -1;
    this.group.add(dome);
    this.anim.push((t) => { mat.map.offset.set(t * 0.0025, t * 0.0012); });
  }

  // ---------- geometrias de vegetação ----------
  palmGeometries(lean) {
    const segs = 9, radial = 7, H = 1;
    const pts = [];
    for (let i = 0; i <= segs; i++) { const t = i / segs; pts.push(new THREE.Vector3(lean * Math.pow(t, 1.8), t * H, 0)); }
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, c = pts[i], rad = 0.045 * (1.25 - t * 0.5) * (i === 0 ? 1.4 : 1);
      for (let k = 0; k <= radial; k++) {
        const a = (k / radial) * Math.PI * 2;
        pos.push(c.x + Math.cos(a) * rad, c.y, c.z + Math.sin(a) * rad);
        uv.push(k / radial, t * 2.2);
      }
    }
    for (let i = 0; i < segs; i++) for (let k = 0; k < radial; k++) {
      const a = i * (radial + 1) + k, b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const trunk = new THREE.BufferGeometry();
    trunk.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    trunk.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    trunk.setIndex(idx); trunk.computeVertexNormals();

    // folhas: tiras dobradas que caem a partir do topo
    const top = pts[segs];
    const fronds = [];
    const n = 9;
    for (let f = 0; f < n; f++) {
      const g = new THREE.PlaneGeometry(0.34, 0.62, 1, 6);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i) + 0.31; // 0..0.62 ao longo da folha
        const s = y / 0.62;
        p.setXYZ(i, x, -0.22 * s * s - Math.abs(x) * 0.25 + 0.06 * s, -y); // cai e dobra em V
      }
      g.rotateX(0.35 + (f % 3) * 0.12);
      g.rotateY((f / n) * Math.PI * 2 + (f % 2) * 0.2);
      g.translate(top.x, top.y, top.z);
      fronds.push(g);
    }
    const crown = BufferGeometryUtils.mergeGeometries(fronds);
    crown.computeVertexNormals();
    bendNormalsUp(crown, 0.6);
    return { trunk, crown };
  }

  // nuvem de cartões com folhas, normais esféricas (sombra suave como uma copa real)
  cardCluster(count, rx, ry, size, cy = 0) {
    const cards = [];
    for (let i = 0; i < count; i++) {
      const g = new THREE.PlaneGeometry(size, size);
      const dir = new THREE.Vector3(this.r() - 0.5, (this.r() - 0.35) * 0.9, this.r() - 0.5).normalize();
      g.lookAt(dir);
      g.rotateOnAxis?.(dir, this.r() * 6);
      g.translate(dir.x * rx * 0.7, cy + dir.y * ry * 0.7, dir.z * rx * 0.7);
      cards.push(g);
    }
    const geo = BufferGeometryUtils.mergeGeometries(cards);
    const pos = geo.attributes.position, nrm = geo.attributes.normal, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i) / rx, (pos.getY(i) - cy) / ry + 0.35, pos.getZ(i) / rx).normalize();
      nrm.setXYZ(i, v.x, v.y, v.z);
    }
    return geo;
  }

  canopyTree(h, crownR) {
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.16, 0.32, h, 8, 4); trunk.translate(0, h / 2, 0);
    const p = trunk.attributes.position; // ligeira curvatura
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + Math.sin(p.getY(i) * 0.4) * 0.25);
    parts.push(trunk);
    for (let b = 0; b < 3; b++) {
      const br = new THREE.CylinderGeometry(0.05, 0.11, crownR * 1.1, 5);
      br.translate(0, crownR * 0.55, 0);
      br.rotateZ(0.7 + this.r() * 0.3); br.rotateY(b * 2.1 + this.r());
      br.translate(0, h * 0.82, 0);
      parts.push(br);
    }
    const wood = BufferGeometryUtils.mergeGeometries(parts.map((g) => g.toNonIndexed()));
    wood.computeVertexNormals();
    const leaves = this.cardCluster(this.high ? 18 : 12, crownR, crownR * 0.65, crownR * 1.05, h + crownR * 0.2);
    return { wood, leaves };
  }

  // ---------- selva ----------
  jungle() {
    const M = this.mats, Q = this.high;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const e = new THREE.Euler();
    const place = (dMin, dMax, zMin = -30, zMax = 200) => {
      const side = this.r() < 0.5 ? -1 : 1;
      const x = side * (dMin + Math.pow(this.r(), 1.3) * (dMax - dMin)), z = zMin + this.r() * (zMax - zMin);
      return [x, terrainHeight(x, z), z];
    };

    // palmeiras (2 variantes de inclinação), sobretudo junto à água
    for (const lean of [0.12, 0.28]) {
      const { trunk, crown } = this.palmGeometries(lean);
      const n = Q ? 36 : 18;
      const ti = new THREE.InstancedMesh(trunk, M.palmTrunk, n), ci = new THREE.InstancedMesh(crown, M.palmFrond, n);
      for (let i = 0; i < n; i++) {
        const [x, y, z] = place(13.5, 30);
        const h = 7 + this.r() * 5;
        e.set(0, Math.atan2(-x, 1) * 0 + (x > 0 ? Math.PI : 0) + (this.r() - 0.5) * 1.6, 0); // inclina para o rio
        q.setFromEuler(e); p.set(x, y - 0.2, z); s.set(h, h, h);
        m4.compose(p, q, s); ti.setMatrixAt(i, m4); ci.setMatrixAt(i, m4);
      }
      ti.castShadow = ci.castShadow = true; ti.receiveShadow = true;
      this.group.add(ti, ci);
    }

    // árvores de copa (2 variantes com tons diferentes)
    [[11, 3.2, M.leaves], [15, 4.2, M.leavesDark]].forEach(([h, cr, leafMat], vi) => {
      const { wood, leaves } = this.canopyTree(h, cr);
      const n = Q ? 70 : 32;
      const ti = new THREE.InstancedMesh(wood, M.trunk, n), li = new THREE.InstancedMesh(leaves, leafMat, n);
      for (let i = 0; i < n; i++) {
        const [x, y, z] = place(vi ? 24 : 17, 75);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.r() * 6.28);
        const sc = 0.75 + this.r() * 0.6; p.set(x, y - 0.3, z); s.set(sc, sc * (0.85 + this.r() * 0.3), sc);
        m4.compose(p, q, s); ti.setMatrixAt(i, m4); li.setMatrixAt(i, m4);
      }
      ti.castShadow = li.castShadow = true;
      this.group.add(ti, li);
    });

    // arbustos
    const bushGeo = this.cardCluster(9, 1.1, 0.8, 1.3, 0.6);
    const nb = Q ? 260 : 110;
    const bi = new THREE.InstancedMesh(bushGeo, M.bush, nb);
    for (let i = 0; i < nb; i++) {
      const [x, y, z] = place(13, 50);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.r() * 6.28);
      const sc = 0.6 + this.r() * 0.9; p.set(x, y - 0.1, z); s.set(sc, sc, sc);
      bi.setMatrixAt(i, m4.compose(p, q, s));
    }
    bi.castShadow = Q;
    this.group.add(bi);

    // erva: 3 planos cruzados por tufo
    const grassParts = [0, 1, 2].map((k) => { const g = new THREE.PlaneGeometry(0.9, 0.6); g.translate(0, 0.3, 0); g.rotateY(k * Math.PI / 3); return g; });
    const grassGeo = BufferGeometryUtils.mergeGeometries(grassParts);
    bendNormalsUp(grassGeo, 1);
    const ng = Q ? 3200 : 1100;
    const gi = new THREE.InstancedMesh(grassGeo, M.grass, ng);
    let gk = 0;
    for (let i = 0; i < ng; i++) {
      const [x, y, z] = place(12.8, 34);
      if (y < -0.25) { continue; }
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.r() * 6.28);
      const sc = 0.7 + this.r() * 0.9; p.set(x, y - 0.05, z); s.set(sc, sc * (0.8 + this.r() * 0.6), sc);
      gi.setMatrixAt(gk++, m4.compose(p, q, s));
    }
    gi.count = gk;
    this.group.add(gi);

    // fetos: 5 frondes curvas
    const fernParts = [];
    for (let k = 0; k < 5; k++) {
      const g = new THREE.PlaneGeometry(0.55, 1.2, 1, 4);
      const pp = g.attributes.position;
      for (let i = 0; i < pp.count; i++) { const y = pp.getY(i) + 0.6; pp.setXYZ(i, pp.getX(i), y * 0.75 - y * y * 0.32, -y * 0.55); }
      g.rotateY(k * Math.PI * 2 / 5);
      fernParts.push(g);
    }
    const fernGeo = BufferGeometryUtils.mergeGeometries(fernParts);
    bendNormalsUp(fernGeo, 0.8);
    const nf = Q ? 700 : 260;
    const fi = new THREE.InstancedMesh(fernGeo, M.fern, nf);
    let fk = 0;
    for (let i = 0; i < nf; i++) {
      const [x, y, z] = place(13, 45);
      if (y < -0.2) continue;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.r() * 6.28);
      const sc = 0.7 + this.r() * 0.8; p.set(x, y - 0.05, z); s.set(sc, sc, sc);
      fi.setMatrixAt(fk++, m4.compose(p, q, s));
    }
    fi.count = fk;
    this.group.add(fi);
  }

  // ---------- rochas ----------
  rockGeometry(seed, detail = 2) {
    const geo = new THREE.IcosahedronGeometry(1, detail);
    const pos = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n = vnoise3(v.x * 1.6 + seed, v.y * 1.6, v.z * 1.6) * 0.5 + vnoise3(v.x * 4 + seed, v.y * 4, v.z * 4) * 0.18;
      v.multiplyScalar(0.75 + n);
      if (v.y < -0.2) v.y = -0.2 + (v.y + 0.2) * 0.3; // base achatada
      pos.setXYZ(i, v.x, v.y * 0.7, v.z);
    }
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const moss = smooth(0.45, 0.85, nrm.getY(i));
      col[i * 3] = 1 - moss * 0.55; col[i * 3 + 1] = 1 - moss * 0.15; col[i * 3 + 2] = 1 - moss * 0.65;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  }

  rocks() {
    const Q = this.high;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    this.rockGeos = [this.rockGeometry(1.3), this.rockGeometry(7.9)];
    this.rockGeos.forEach((geo, vi) => {
      const n = Q ? 90 : 40;
      const inst = new THREE.InstancedMesh(geo, this.mats.rock, n);
      for (let i = 0; i < n; i++) {
        const side = this.r() < 0.5 ? -1 : 1;
        const x = side * (11.5 + Math.pow(this.r(), 2) * 45), z = -25 + this.r() * 220;
        const y = terrainHeight(x, z);
        q.setFromEuler(new THREE.Euler((this.r() - 0.5) * 0.4, this.r() * 6.28, (this.r() - 0.5) * 0.4));
        const big = this.r() < 0.15 ? 2.6 : 1;
        const sc = (0.4 + this.r() * 1.2) * big;
        p.set(x, y - sc * 0.15, z); s.set(sc * (0.8 + this.r() * 0.6), sc, sc * (0.8 + this.r() * 0.6));
        inst.setMatrixAt(i, m4.compose(p, q, s));
      }
      inst.castShadow = inst.receiveShadow = true;
      this.group.add(inst);
      void vi;
    });
  }

  // rochas soltas e entulho junto a muros (lista de [x,y,z,escala])
  rubble(list) {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const inst = new THREE.InstancedMesh(this.rockGeos[0], this.mats.rock, list.length);
    list.forEach(([x, y, z, sc], i) => {
      q.setFromEuler(new THREE.Euler(this.r(), this.r() * 6, this.r()));
      p.set(x, y + sc * 0.15, z); s.set(sc, sc * 0.8, sc);
      inst.setMatrixAt(i, m4.compose(p, q, s));
    });
    inst.castShadow = true; inst.receiveShadow = true;
    this.group.add(inst);
  }

  // ---------- ruínas ao longe: pirâmides em degraus cobertas de selva ----------
  distantRuins() {
    const M = this.mats;
    const pyramid = (x, z, tiers, base, tierH, rot, broken = false) => {
      const g = new THREE.Group();
      const y0 = terrainHeight(x, z) - 1;
      for (let i = 0; i < tiers; i++) {
        const w = base * (1 - i / (tiers + 1.5));
        const m = new THREE.Mesh(boxGeo(w, tierH, w, 0.25), i % 2 ? M.stone : M.mossStone);
        m.position.y = y0 + tierH * (i + 0.5);
        if (broken && i === tiers - 1) { m.scale.x = 0.6; m.position.x = w * 0.15; }
        m.castShadow = i < 2; m.receiveShadow = true;
        g.add(m);
      }
      // escadaria frontal
      const st = new THREE.Mesh(boxGeo(base * 0.18, tierH * tiers, base * 0.55, 0.25), M.stone);
      st.position.set(0, y0 + tierH * tiers / 2, base * 0.38); st.rotation.x = 0.0;
      g.add(st);
      // santuário no topo
      if (!broken) {
        const tw = base * (1 - tiers / (tiers + 1.5)) * 0.7;
        const shrine = new THREE.Mesh(boxGeo(tw, tierH * 1.3, tw, 0.3), M.carved);
        shrine.position.y = y0 + tierH * (tiers + 0.65);
        g.add(shrine);
      }
      // vegetação a crescer nos degraus
      const bushes = new THREE.InstancedMesh(this.cardCluster(7, 1.4, 1, 1.6, 0.6), M.bush, tiers * 6);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
      let k = 0;
      for (let i = 0; i < tiers; i++) for (let j = 0; j < 6; j++) {
        const w = base * (1 - i / (tiers + 1.5)) / 2, a = this.r() * 6.28;
        p.set(Math.cos(a) * w * 0.9, y0 + tierH * (i + 1), Math.sin(a) * w * 0.9);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a); const sc = 0.8 + this.r() * 1.4; s.set(sc, sc, sc);
        bushes.setMatrixAt(k++, m4.compose(p, q, s));
      }
      g.add(bushes);
      g.position.set(x, 0, z); g.rotation.y = rot;
      this.group.add(g);
      bakeGroup(g);
    };
    pyramid(-52, 132, 6, 30, 4, 0.3);
    pyramid(62, 38, 5, 24, 3.6, -0.5, true);
    pyramid(-70, 20, 4, 18, 3.4, 0.9);
    // muros e colunas partidas espalhados pela selva
    for (let i = 0; i < (this.high ? 18 : 10); i++) {
      const side = this.r() < 0.5 ? -1 : 1, x = side * (16 + this.r() * 30), z = -10 + this.r() * 180;
      const y = terrainHeight(x, z);
      if (this.r() < 0.5) {
        const h = 1 + this.r() * 3, w = 2 + this.r() * 5;
        const m = new THREE.Mesh(boxGeo(w, h, 0.9), M.mossStone);
        m.position.set(x, y + h / 2 - 0.4, z); m.rotation.set(0, this.r() * 3, (this.r() - 0.5) * 0.15);
        m.castShadow = m.receiveShadow = true; this.group.add(m);
      } else {
        const h = 1.5 + this.r() * 4;
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, h, 12), M.mossStone);
        c.position.set(x, y + h / 2 - 0.3, z); c.rotation.z = this.r() < 0.3 ? 1.45 : (this.r() - 0.5) * 0.2;
        if (c.rotation.z > 1) c.position.y = y + 0.3;
        c.castShadow = c.receiveShadow = true; this.group.add(c);
      }
    }
  }

  // ---------- cascata com espuma e névoa ----------
  waterfall(x, z, h, w, rotY) {
    const M = this.mats;
    const g = new THREE.Group();
    const base = -0.4;
    // falésia de rocha atrás da água
    const cliffGeo = new THREE.BoxGeometry(w + 7, h + 4, 7, 10, 12, 6);
    const pp = cliffGeo.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      const vx = pp.getX(i), vy = pp.getY(i), vz = pp.getZ(i);
      const n = vnoise3(vx * 0.35 + x, vy * 0.35, vz * 0.35) - 0.5 + (vnoise3(vx, vy, vz + x) - 0.5) * 0.4;
      const top = vy > (h + 4) / 2 - 0.5 ? -1.5 * vnoise3(vx * 0.5, x, vz * 0.5) : 0;
      pp.setXYZ(i, vx + n * 3, vy + n * 1.2 + top, vz + n * 3);
    }
    cliffGeo.computeVertexNormals();
    // UV a partir da posição (a textura não estica nas faces grandes)
    const cuv = cliffGeo.attributes.uv, cn = cliffGeo.attributes.normal;
    for (let i = 0; i < pp.count; i++) {
      const ax = Math.abs(cn.getX(i)), ay = Math.abs(cn.getY(i));
      const u = ax > ay ? pp.getZ(i) : pp.getX(i), v = ay > 0.7 ? pp.getZ(i) : pp.getY(i);
      cuv.setXY(i, u * 0.25, v * 0.25);
    }
    const cliff = new THREE.Mesh(cliffGeo, M.cliff);
    cliff.position.set(0, base + (h + 4) / 2 - 2, -3.2);
    cliff.castShadow = cliff.receiveShadow = true;
    g.add(cliff);
    // lençol de água a cair (ligeiramente curvo)
    const fall = new THREE.PlaneGeometry(w, h, 1, 8);
    const fp = fall.attributes.position;
    for (let i = 0; i < fp.count; i++) { const t = 1 - (fp.getY(i) / h + 0.5); fp.setZ(i, t * t * 1.4); }
    const mat = M.waterfall.clone(); mat.map = M.waterfall.map.clone(); mat.map.needsUpdate = true;
    const sheet = new THREE.Mesh(fall, mat);
    sheet.position.set(0, base + h / 2, -0.1);
    g.add(sheet);
    // espuma na base
    const foamMat = M.foam.clone(); foamMat.map = M.foam.map.clone(); foamMat.map.repeat.set(2, 2); foamMat.map.needsUpdate = true;
    const foam = new THREE.Mesh(new THREE.CircleGeometry(w * 0.9, 24), foamMat);
    foam.rotation.x = -Math.PI / 2; foam.position.set(0, base + 0.06, 1.2);
    g.add(foam);
    // névoa
    const mist = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex(), color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
    mist.scale.set(w * 2.6, w * 1.4, 1); mist.position.set(0, base + w * 0.5, 1.5);
    g.add(mist);
    g.position.set(x, 0, z); g.rotation.y = rotY;
    this.group.add(g);
    this.anim.push((t) => {
      mat.map.offset.y = t * 0.9; foamMat.map.offset.set(t * 0.05, t * 0.08); foamMat.map.rotation = t * 0.05;
      mist.material.opacity = 0.3 + Math.sin(t * 1.3 + x) * 0.06;
    });
  }

  // anéis de espuma à volta de pilares na água
  foamRing(x, z, r) {
    const mat = this.mats.foam.clone(); mat.map = this.mats.foam.map.clone(); mat.map.repeat.set(3, 1); mat.map.needsUpdate = true;
    mat.opacity = 0.55;
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.7, 24, 1), mat);
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, -0.36, z);
    this.group.add(ring);
    this.anim.push((t) => { mat.map.offset.x = t * 0.04 + x; mat.opacity = 0.45 + Math.sin(t * 2 + z) * 0.12; });
  }

  // trepadeiras penduradas do topo de muros: lista de [x, yTopo, z, comprimento, rotY]
  hangingVines(list) {
    const geo = new THREE.PlaneGeometry(0.55, 1, 1, 3); geo.translate(0, -0.5, 0);
    const inst = new THREE.InstancedMesh(geo, this.mats.vine, list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    list.forEach(([x, y, z, len, rot], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot); p.set(x, y, z); s.set(1, len, 1);
      inst.setMatrixAt(i, m4.compose(p, q, s));
    });
    this.group.add(inst);
  }

  // ---------- pássaros a planar ----------
  birds() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0.15, -0.9, 0.1, -0.1, 0, 0, -0.2,
      0, 0, 0.15, 0, 0, -0.2, 0.9, 0.1, -0.1,
    ], 3));
    geo.computeVertexNormals();
    const n = 14;
    const inst = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0x202020, side: THREE.DoubleSide }), n);
    const birds = Array.from({ length: n }, (_, i) => ({
      cx: (this.r() - 0.5) * 60, cz: 40 + this.r() * 120, r: 15 + this.r() * 25, y: 30 + this.r() * 25,
      sp: (0.15 + this.r() * 0.15) * (i % 2 ? 1 : -1), ph: this.r() * 6, flap: 5 + this.r() * 3,
    }));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    this.group.add(inst);
    this.anim.push((t) => {
      birds.forEach((b, i) => {
        const a = b.ph + t * b.sp;
        p.set(b.cx + Math.cos(a) * b.r, b.y + Math.sin(t * 0.5 + i) * 1.5, b.cz + Math.sin(a) * b.r);
        e.set(0, -a + (b.sp > 0 ? Math.PI : 0), Math.sin(t * 0.7 + i) * 0.2); q.setFromEuler(e);
        const f = Math.sin(t * b.flap + i) > 0.3 ? 1 : 0.35; s.set(1.2, f * 1.2, 1.2);
        inst.setMatrixAt(i, m4.compose(p, q, s));
      });
      inst.instanceMatrix.needsUpdate = true;
    });
  }

  update(t) { for (const f of this.anim) f(t); }
}

function bendNormalsUp(geo, k) {
  const n = geo.attributes.normal;
  for (let i = 0; i < n.count; i++) {
    const x = n.getX(i) * (1 - k), y = n.getY(i) * (1 - k) + k, z = n.getZ(i) * (1 - k);
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(i, x / l, y / l, z / l);
  }
}

let _mist;
function mistTex() {
  if (_mist) return _mist;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  _mist = new THREE.CanvasTexture(c);
  return _mist;
}

// Junta as malhas de um grupo com o mesmo material numa só (menos chamadas de desenho).
// As malhas em `keep` (animadas, transparentes) ficam como estão.
export function bakeGroup(group, keep = []) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map(), victims = [];
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || keep.includes(o) || o.material.transparent || o.material.vertexColors || o.parent !== group && keep.includes(o.parent)) return;
    const key = o.material.uuid + (o.castShadow ? 'c' : '');
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, list: [] });
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    buckets.get(key).list.push(g);
    victims.push(o);
  });
  for (const o of victims) o.parent.remove(o);
  for (const { mat, cast, list } of buckets.values()) {
    const m = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(list), mat);
    m.castShadow = cast; m.receiveShadow = true;
    group.add(m);
  }
  return group;
}
