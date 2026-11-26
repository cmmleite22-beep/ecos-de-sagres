// Capítulo 1 — "O Templo das Marés"
// Nível linear ao longo de +Z:  acampamento → escadaria → pilares sobre a água → pátio das lanças
// → portão cooperativo → parede de trepadeiras → plataforma móvel → corredor da pedra rolante → altar.
import * as THREE from 'three';
import { Collider } from './physics.js';
import { boxGeo } from './textures.js';

// Mercenários do Consórcio (equipa avançada): [x, y do chão, z, direção]
export const ENEMY_SPOTS = [
  [-5, 3, 66.5], [5, 3, 62.5],          // pátio, atrás das lanças
  [-2.5, 9, 83],                        // topo da falésia
  [-3.5, 9, 102.5], [3.5, 9, 103],      // antes do corredor
  [-6, 3, 152], [6, 3, 156], [0, 3, 165.5], // câmara do altar
];

export const LINES = {
  intro:   [['Ana', 'O mapa do Infante aponta para aqui. O Templo das Marés... existe mesmo.'],
            ['Tito', 'Existe, e o Consórcio vem a caminho. Despachem-se.']],
  stairs:  [['Inês', 'Inscrições em tâmil antigo e... português do século XV? Isto não faz sentido.']],
  pillars: [['Rafa', 'Os pilares aguentam. Saltem com balanço — corram antes do salto!']],
  spikes:  [['Tito', 'Lanças na pedra. E aqueles ali ao fundo são do Consórcio — já cá estão!'],
            ['Ana', 'Equipa avançada. Abatam-nos e passem as lanças com ritmo.']],
  plates:  [['Inês', '"Dois devem pesar onde um não chega." As placas abrem o portão.']],
  vines:   [['Rafa', 'Trepadeiras! Empurrem para a frente para subir.']],
  bridge:  [['Ana', 'A plataforma move-se com a maré. Esperem por ela.']],
  boulder: [['Tito', 'Ouviram isto?!'], ['Ana', 'CORRAM!']],
  altar:   [['Tito', 'Mais mercenários na câmara! Cubram-se atrás das colunas.'],
            ['Ana', 'O Astrolábio de Âmbar... a primeira peça. Alguém que lhe pegue — botão AÇÃO.']],
  win:     [['Inês', 'Há coordenadas gravadas no anel. O próximo templo fica em Socotra.'],
            ['Tito', 'E o Consórcio acabou de aterrar. Saímos pelo rio. Agora!']],
};

export class Level1 {
  constructor(scene, world, mats, quality) {
    this.scene = scene; this.world = world; this.mats = mats; this.quality = quality;
    this.group = new THREE.Group(); scene.add(this.group);
    this.relics = []; this.spikes = []; this.plates = []; this.climbs = [];
    this.checkpoints = []; this.triggers = []; this.torches = []; this.lights = [];
    this.time = 0;
    this.totalRelics = 0;
    this.build();
  }

  // ---------- utilitários de construção ----------
  block(cx, y0, cz, w, h, d, mat, opts = {}) {
    let mesh = null;
    if (mat) {
      mesh = new THREE.Mesh(boxGeo(w, h, d, opts.uv || 0.5), mat);
      mesh.position.set(cx, y0 + h / 2, cz);
      mesh.castShadow = opts.cast !== false; mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    let col = null;
    if (opts.collide !== false) col = this.world.add(Collider.fromCenter(cx, y0 + h / 2, cz, w, h, d, opts));
    return { mesh, col };
  }
  wall(cx, y0, cz, w, h, d) { return this.block(cx, y0, cz, w, h, d, null); } // invisível

  torch(x, y, z, light = true) {
    const g = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.1, 8), this.mats.wood);
    stick.position.y = 0.55; g.add(stick);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.1, 0.18, 10), this.mats.bronze);
    bowl.position.y = 1.15; g.add(bowl);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 8), this.mats.flame);
    flame.position.y = 1.4; g.add(flame);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTex(), color: 0xff9a40, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(1.6, 1.6, 1); glow.position.y = 1.4; g.add(glow);
    g.position.set(x, y, z);
    this.group.add(g);
    const maxLights = this.quality === 'high' ? 10 : 4;
    let pl = null;
    if (light && this.lights.length < maxLights) {
      pl = new THREE.PointLight(0xff8a3a, 6, 9, 1.6);
      pl.position.set(x, y + 1.6, z);
      this.group.add(pl); this.lights.push(pl);
    }
    this.torches.push({ flame, glow, pl, seed: Math.random() * 10 });
  }
  glowTex() {
    if (this._glow) return this._glow;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,200,120,0.5)'); gr.addColorStop(1, 'rgba(255,120,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 64, 64);
    this._glow = new THREE.CanvasTexture(c);
    return this._glow;
  }

  relic(x, y, z) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.12, 12), this.mats.gold);
    const bodyM = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), this.mats.gold);
    bodyM.scale.set(1, 1.3, 0.9); bodyM.position.y = 0.25;
    const headM = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), this.mats.gold);
    headM.position.y = 0.5;
    g.add(base, bodyM, headM);
    for (const m of g.children) m.castShadow = true;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTex(), color: 0xffd060, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6,
    }));
    glow.scale.set(1.3, 1.3, 1); glow.position.y = 0.3; g.add(glow);
    g.position.set(x, y + 0.3, z);
    this.group.add(g);
    this.relics.push({ g, pos: new THREE.Vector3(x, y + 0.5, z), taken: false, baseY: y + 0.3 });
    this.totalRelics++;
  }

  checkpoint(z, spawn) { this.checkpoints.push({ z, spawn: new THREE.Vector3(...spawn) }); }
  say(z, key) { this.triggers.push({ z, key, done: false }); }

  // ---------- construção ----------
  build() {
    const M = this.mats, Q = this.quality;

    // ===== Envolvente: água, selva, montanhas =====
    const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), M.water);
    water.rotation.x = -Math.PI / 2; water.position.set(0, -0.4, 80);
    water.receiveShadow = true;
    this.group.add(water); this.water = water;

    const mountainMat = new THREE.MeshStandardMaterial({ color: 0x3d5a3a, roughness: 1, flatShading: true });
    for (let i = 0; i < 14; i++) {
      const h = 40 + Math.random() * 50;
      const m = new THREE.Mesh(new THREE.ConeGeometry(25 + Math.random() * 20, h, 7), mountainMat);
      const side = i % 2 ? 1 : -1;
      m.position.set(side * (70 + Math.random() * 60), h / 2 - 5, -20 + i * 18 + Math.random() * 10);
      this.group.add(m);
    }
    this.buildJungle();

    // ===== Secção 0: acampamento (z -10..22) =====
    this.block(0, -3, 6, 30, 3, 32, M.sand);
    this.wall(-11, 0, 6, 1, 10, 32); this.wall(11, 0, 6, 1, 10, 32); this.wall(0, 0, -9.5, 24, 10, 1);
    this.tent(-5, 0, 4, 0.4); this.tent(5.5, 0, 6, -0.5);
    this.block(-3, 0, 10, 1, 1, 1, M.wood); this.block(-2.1, 0, 10.2, 0.8, 0.8, 0.8, M.wood);
    this.block(-2.6, 1, 10.1, 0.8, 0.8, 0.8, M.wood);
    this.block(4, 0, 12, 1.2, 0.9, 0.9, M.wood);
    this.campfire(0, 0, 8);
    this.relic(-2.6, 1.8, 10.1);
    this.relic(7, 0, 14);
    this.checkpoint(-10, [0, 0, 2]);
    this.say(-100, 'intro');

    // ===== Secção 1: escadaria do templo (z 22..34) até y=3 =====
    for (let i = 0; i < 8; i++) {
      this.block(0, 0, 22.375 + i * 0.75, 8, 0.375 * (i + 1), 0.75, M.stone, { cast: false });
    }
    this.block(0, -3, 31, 16, 6, 6, M.mossStone); // plataforma superior y=3
    this.block(-6, 0, 25, 4, 3, 6, M.mossStone);  // muros laterais da escadaria
    this.block(6, 0, 25, 4, 3, 6, M.mossStone);
    for (const x of [-3.5, 3.5]) this.column(x, 3, 33.3, 7);
    this.block(0, 10, 33.3, 9, 1.2, 1.4, M.mossStone, { collide: false }); // lintel
    this.torch(-5, 3, 30.5); this.torch(5, 3, 30.5);
    this.wall(-8.5, 3, 31, 1, 8, 6); this.wall(8.5, 3, 31, 1, 8, 6);
    this.relic(6, 3, 29);
    this.checkpoint(28.5, [0, 3, 30]);
    this.say(26, 'stairs');

    // ===== Pilares sobre a água (z 34..46) =====
    this.block(0, -8, 41, 2, 1, 2, null, { collide: false });
    const pillars = [[0, 37], [-1.6, 40.2], [1.2, 43.4]];
    for (const [x, z] of pillars) this.block(x, -6, z, 1.8, 9, 1.8, M.mossStone);
    this.relic(-1.6, 3, 40.2);
    this.wall(-8.5, -6, 40, 1, 20, 12); this.wall(8.5, -6, 40, 1, 20, 12);
    this.say(33.5, 'pillars');

    // ===== Secção 2: pátio das lanças (z 46..72), chão y=3 =====
    this.block(0, -3, 59, 16, 6, 26, M.stone);
    this.block(-7.5, 3, 59, 1, 5, 26, M.mossStone); this.block(7.5, 3, 59, 1, 5, 26, M.mossStone);
    const rowsZ = [52, 55, 58];
    rowsZ.forEach((z, r) => {
      for (let c = 0; c < 6; c++) this.spikePlate(-5 + c * 2, 3, z, r * 0.9 + (c % 2) * 0.45);
    });
    this.relic(-6, 3, 48.5); this.relic(6, 3, 61);
    this.relic(0, 3, 56.5);
    this.plate(-4.5, 3, 64.5); this.plate(4.5, 3, 64.5);
    // portão com dois muros laterais
    this.block(-4.75, 3, 70, 4.5, 6, 1, M.mossStone); this.block(4.75, 3, 70, 4.5, 6, 1, M.mossStone);
    this.gate = this.block(0, 3, 70, 5, 6, 1.1, M.stone);
    this.gate.closedY = this.gate.mesh.position.y;
    this.block(0, 9, 70, 14, 1.4, 1.6, M.mossStone, { collide: false });
    this.torch(-6.3, 3, 66); this.torch(6.3, 3, 66);
    this.checkpoint(47, [0, 3, 47.5]);
    this.say(49, 'spikes'); this.say(61, 'plates');

    // ===== Secção 3: parede de trepadeiras e abismo (z 70..104) =====
    this.block(0, -3, 74.3, 16, 6, 7.6, M.stone);                   // chão y=3 até z=78
    this.wall(-8.5, 3, 74, 1, 12, 8); this.wall(8.5, 3, 74, 1, 12, 8);
    this.block(0, -3, 81, 16, 12, 6, M.mossStone);                  // falésia: topo y=9, z 78..84
    this.vines(0, 3, 77.95, 4, 6.4);
    this.climbs.push(new Collider(-2.2, 3, 77.1, 2.2, 9.7, 78.2, { solid: false }));
    this.block(-6, 9, 81, 4, 3, 6, M.mossStone); this.block(6, 9, 81, 4, 3, 6, M.mossStone);
    this.relic(2.5, 9, 82.5);
    this.checkpoint(79, [0, 9, 81]);
    this.say(72, 'vines');
    // plataforma móvel sobre o abismo (z 84..98)
    this.mover = this.block(0, 8.4, 87, 3, 0.6, 3, M.stone);
    this.mover.range = [87, 95.5];
    this.relic(0, 10.6, 91.5); // no ar — salta a partir da plataforma
    this.block(0, -3, 101, 12, 12, 6, M.mossStone);                 // aterragem y=9, z 98..104
    this.wall(-6.5, 9, 92, 1, 10, 24); this.wall(6.5, 9, 92, 1, 10, 24);
    this.torch(-4.5, 9, 99.5); this.torch(4.5, 9, 99.5);
    this.checkpoint(98.5, [0, 9, 100]);
    this.say(83, 'bridge');

    // ===== Secção 4: corredor da pedra rolante (z 104..141) — desce de y=9 a y=3 =====
    this.floorAt = (z) => {
      if (z < 110) return 9;
      if (z >= 140) return 3;
      return 9 - Math.floor((z - 110) / 1.5) * 0.3;
    };
    this.block(0, -3, 107, 6, 12, 6, M.stone);
    for (let i = 0; i < 20; i++) {
      const z0 = 110 + i * 1.5, top = 9 - i * 0.3;
      this.block(0, -3, z0 + 0.75, 6, top + 3, 1.5, M.stone, { cast: false });
    }
    this.block(0, -3, 140.5, 6, 6, 1, M.stone);
    for (const s of [-1, 1]) {
      for (let z = 104; z < 141; z += 6) {
        const top = this.floorAt(z + 6);
        this.block(s * 3.5, top, z + 3, 1, 4 + (this.floorAt(z) - top), 6, M.mossStone);
      }
    }
    this.torch(-2.5, 9, 105); this.torch(2.5, 9, 105);
    this.torch(-2.5, 6, 125, false); this.torch(2.5, 4.5, 133, false);
    this.relic(-2, 7.8, 117); this.relic(2, 4.5, 132);
    this.boulder = this.makeBoulder();
    this.checkpoint(104.5, [0, 9, 105]);
    this.say(108.5, 'boulder');
    // fosso onde a pedra cai: z 141..143.6

    // ===== Secção 5: câmara do altar (z 143.6..168) =====
    this.block(0, -3, 156, 22, 6, 24.8, M.stone);
    this.block(-11.5, 3, 156, 1, 9, 25, M.mossStone); this.block(11.5, 3, 156, 1, 9, 25, M.mossStone);
    this.block(0, 3, 168.5, 24, 9, 1, M.mossStone);
    this.block(-7.5, 3, 143.6, 7, 9, 1, M.mossStone); this.block(7.5, 3, 143.6, 7, 9, 1, M.mossStone); // pórtico de entrada
    this.block(0, 12, 156, 24, 1, 6, M.stone, { collide: false });                                    // vigas do teto
    this.block(0, 12, 146, 24, 1, 3, M.stone, { collide: false });
    this.block(0, -12, 142.3, 6, 6, 2.6, M.stone, { cast: false }); // fundo do fosso
    for (const z of [148, 154, 160]) for (const x of [-7, 7]) this.column(x, 3, z, 9);
    this.block(0, 3, 160, 4, 0.4, 4, M.mossStone);
    this.block(0, 3.4, 160, 3, 0.4, 3, M.mossStone);
    this.block(0, 3.8, 160, 1.2, 1, 1.2, M.stone);
    this.altarPos = new THREE.Vector3(0, 5.2, 160);
    this.astrolabe = this.makeAstrolabe(); this.astrolabe.position.copy(this.altarPos);
    this.torch(-4, 3, 150); this.torch(4, 3, 150); this.torch(-4, 3, 164); this.torch(4, 3, 164);
    this.relic(-9, 3, 165);
    this.checkpoint(144, [0, 3, 145.5]);
    this.say(150, 'altar');

    this.finalZ = 160;
  }

  column(x, y0, z, h) {
    const M = this.mats;
    this.block(x, y0, z, 1.4, 0.4, 1.4, M.stone);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, h - 0.8, 12), M.mossStone);
    shaft.position.set(x, y0 + 0.4 + (h - 0.8) / 2, z); shaft.castShadow = shaft.receiveShadow = true;
    this.group.add(shaft);
    this.world.add(Collider.fromCenter(x, y0 + h / 2, z, 1, h, 1));
    this.block(x, y0 + h - 0.4, z, 1.4, 0.4, 1.4, M.stone, { collide: false });
  }

  tent(x, y, z, rot) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2.2, 4, 1, true), this.mats.canvas);
    t.position.set(x, y + 1.1, z); t.rotation.y = rot + Math.PI / 4; t.castShadow = t.receiveShadow = true;
    this.group.add(t);
    this.world.add(Collider.fromCenter(x, y + 0.8, z, 2.2, 1.6, 2.2));
  }

  campfire(x, y, z) {
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18), this.mats.stone);
      const a = (i / 7) * Math.PI * 2;
      s.position.set(x + Math.cos(a) * 0.5, y + 0.1, z + Math.sin(a) * 0.5); this.group.add(s);
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 8), this.mats.flame);
    flame.position.set(x, y + 0.4, z); this.group.add(flame);
    const pl = new THREE.PointLight(0xff7a2a, 10, 12, 1.5); pl.position.set(x, y + 1, z);
    this.group.add(pl); this.lights.push(pl);
    this.torches.push({ flame, glow: null, pl, seed: 3 });
  }

  spikePlate(x, y, z, offset) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(boxGeo(1.9, 0.06, 1.9), this.mats.stone);
    base.position.y = 0.03; base.receiveShadow = true; g.add(base);
    const spikes = new THREE.Group();
    const cone = new THREE.ConeGeometry(0.09, 0.8, 6);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const s = new THREE.Mesh(cone, this.mats.spike);
      s.position.set(-0.7 + i * 0.47, 0.4, -0.7 + j * 0.47); s.castShadow = true; spikes.add(s);
    }
    g.add(spikes);
    g.position.set(x, y, z); this.group.add(g);
    this.spikes.push({ spikes, x, y, z, offset, up: false });
  }

  plate(x, y, z) {
    const mat = this.mats.plate.clone();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.05, 0.15, 24), mat);
    m.position.set(x, y + 0.075, z); m.receiveShadow = true; this.group.add(m);
    const sym = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 6, 24), this.mats.bronze);
    sym.rotation.x = -Math.PI / 2; sym.position.set(x, y + 0.16, z); this.group.add(sym);
    this.plates.push({ m, mat, x, z, y, pressed: false });
  }

  vines(cx, y0, z, w, h) {
    const geo = new THREE.PlaneGeometry(0.22, h, 1, 8);
    for (let i = 0; i < 16; i++) {
      const v = new THREE.Mesh(geo, this.mats.vine);
      v.position.set(cx - w / 2 + (i / 15) * w, y0 + h / 2 + Math.random() * 0.3, z - 0.05 - Math.random() * 0.1);
      v.rotation.z = (Math.random() - 0.5) * 0.15;
      this.group.add(v);
    }
    const leafGeo = new THREE.IcosahedronGeometry(0.16, 0);
    const leaves = new THREE.InstancedMesh(leafGeo, this.mats.leaves, 120);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 120; i++) {
      m4.makeTranslation(cx - w / 2 + Math.random() * w, y0 + Math.random() * h, z - 0.12);
      leaves.setMatrixAt(i, m4);
    }
    this.group.add(leaves);
  }

  buildJungle() {
    const Q = this.quality;
    const nTrees = Q === 'high' ? 160 : 70;
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 1, 7);
    trunkGeo.translate(0, 0.5, 0);
    const crownGeo = new THREE.IcosahedronGeometry(1, 1);
    const trunks = new THREE.InstancedMesh(trunkGeo, this.mats.trunk, nTrees);
    const crowns = new THREE.InstancedMesh(crownGeo, this.mats.leaves, nTrees * 3);
    const crowns2 = new THREE.InstancedMesh(crownGeo, this.mats.leavesDark, nTrees * 2);
    trunks.castShadow = crowns.castShadow = crowns2.castShadow = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let ci = 0, ci2 = 0;
    for (let i = 0; i < nTrees; i++) {
      const side = i % 2 ? 1 : -1;
      const z = -15 + Math.random() * 190;
      const x = side * (12 + Math.random() * 40);
      const h = 6 + Math.random() * 9;
      const gy = this.groundYOutside(z);
      p.set(x, gy, z); s.set(1, h, 1); q.setFromEuler(new THREE.Euler(0, Math.random() * 6, (Math.random() - 0.5) * 0.15));
      trunks.setMatrixAt(i, m4.compose(p, q, s));
      for (let k = 0; k < 3; k++) {
        const r = 1.8 + Math.random() * 1.6;
        p.set(x + (Math.random() - 0.5) * 2.5, gy + h + (Math.random() - 0.3) * 1.5, z + (Math.random() - 0.5) * 2.5);
        s.set(r, r * 0.7, r);
        crowns.setMatrixAt(ci++, m4.compose(p, q, s));
      }
      for (let k = 0; k < 2; k++) {
        const r = 1.4 + Math.random();
        p.set(x + (Math.random() - 0.5) * 3, gy + h * 0.75, z + (Math.random() - 0.5) * 3);
        s.set(r, r * 0.6, r);
        crowns2.setMatrixAt(ci2++, m4.compose(p, q, s));
      }
    }
    this.group.add(trunks, crowns, crowns2);

    // ilhas de selva dos dois lados
    for (const side of [-1, 1]) {
      const isle = new THREE.Mesh(boxGeo(46, 2, 200, 0.25), this.mats.ground);
      isle.position.set(side * 34, -1.0, 80); isle.receiveShadow = true;
      this.group.add(isle);
    }
    // fetos
    const nF = Q === 'high' ? 500 : 180;
    const fernGeo = new THREE.PlaneGeometry(1.4, 1.4); fernGeo.translate(0, 0.7, 0);
    const ferns = new THREE.InstancedMesh(fernGeo, this.mats.fern, nF);
    for (let i = 0; i < nF; i++) {
      const side = i % 2 ? 1 : -1;
      const z = -10 + Math.random() * 180, x = side * (11.5 + Math.random() * 25);
      p.set(x, this.groundYOutside(z), z);
      q.setFromEuler(new THREE.Euler(-0.3 + Math.random() * 0.6, Math.random() * 6, 0));
      const sc = 0.7 + Math.random() * 0.9; s.set(sc, sc, sc);
      ferns.setMatrixAt(i, m4.compose(p, q, s));
    }
    this.group.add(ferns);
  }
  groundYOutside() { return 0; }

  makeBoulder() {
    const geo = new THREE.IcosahedronGeometry(2.3, 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      v.multiplyScalar(1 + (Math.sin(v.x * 3) * Math.cos(v.y * 2.7) * 0.06));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.mats.mossStone);
    mesh.castShadow = true; mesh.visible = false;
    this.group.add(mesh);
    return { mesh, r: 2.3, active: false, z: 0, y: 0, vy: 0, speed: 0, falling: false, armed: true };
  }

  makeAstrolabe() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 10, 40), this.mats.bronze);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 36), this.mats.gold);
    ring2.rotation.y = Math.PI / 2;
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), this.mats.amber);
    g.add(ring, ring2, core);
    const pl = new THREE.PointLight(0xffa030, 14, 14, 1.4); g.add(pl);
    // feixe de luz vindo do teto
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 2.4, 14, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    beam.position.y = 5; g.add(beam);
    this.group.add(g);
    g.userData = { ring, ring2, core };
    return g;
  }

  // ---------- lógica por frame ----------
  update(dt, game) {
    this.time += dt;
    const t = this.time;
    this.water.material.normalMap.offset.set(t * 0.01, t * 0.02);

    for (const tc of this.torches) {
      const f = 0.85 + Math.sin(t * 13 + tc.seed) * 0.08 + Math.sin(t * 29 + tc.seed * 2) * 0.07;
      tc.flame.scale.set(1, f, 1);
      if (tc.pl) tc.pl.intensity = (tc.glow ? 6 : 10) * f;
      if (tc.glow) tc.glow.material.opacity = 0.7 * f;
    }
    for (const r of this.relics) {
      if (r.taken) continue;
      r.g.rotation.y += dt * 1.8;
      r.g.position.y = r.baseY + Math.sin(t * 2.5 + r.pos.x) * 0.12;
    }

    // lanças: ciclo de 2,7 s, ativas durante ~1 s
    for (const sp of this.spikes) {
      const c = ((t + sp.offset) % 2.7) / 2.7;
      const target = c > 0.55 && c < 0.92 ? 0 : -0.85;
      sp.spikes.position.y += (target - sp.spikes.position.y) * Math.min(1, dt * (target === 0 ? 30 : 6));
      sp.up = sp.spikes.position.y > -0.35;
    }

    // placas de pressão + portão
    const alive = game.players.filter((p) => !p.dead);
    let pressed = 0;
    for (const pl of this.plates) {
      pl.pressed = alive.some((p) => Math.hypot(p.pos.x - pl.x, p.pos.z - pl.z) < 1.05 && Math.abs(p.pos.y - pl.y) < 0.5);
      pl.mat.emissive.setHex(pl.pressed ? 0x6a4a00 : 0x000000);
      pl.m.position.y = pl.y + (pl.pressed ? 0.02 : 0.075);
      if (pl.pressed) pressed++;
    }
    const need = Math.min(2, Math.max(1, game.players.length));
    const open = pressed >= need || this.gateLatched;
    if (pressed >= need && !this.gateLatched) { this.gateLatched = true; game.sfx('gate'); }
    const gm = this.gate.mesh, gc = this.gate.col;
    const targetY = open ? this.gate.closedY - 6.2 : this.gate.closedY;
    const ny = gm.position.y + Math.sign(targetY - gm.position.y) * Math.min(Math.abs(targetY - gm.position.y), dt * 2.2);
    gc.moveBy(0, ny - gm.position.y, 0);
    gm.position.y = ny;

    // plataforma móvel
    const mv = this.mover;
    const [a, b] = mv.range;
    const mz = a + (b - a) * (0.5 - 0.5 * Math.cos(t * 0.75));
    mv.col.moveBy(0, 0, mz - mv.mesh.position.z);
    mv.mesh.position.z = mz;

    // astrolábio
    const ud = this.astrolabe.userData;
    if (!this.astrolabeTaken) {
      ud.ring.rotation.y += dt * 0.8; ud.ring2.rotation.x += dt * 1.1; ud.core.rotation.y -= dt;
      this.astrolabe.position.y = this.altarPos.y + Math.sin(t * 1.5) * 0.1;
    }

    this.updateBoulder(dt, game);
  }

  updateBoulder(dt, game) {
    const B = this.boulder;
    if (!B.active) {
      if (B.armed && game.players.some((p) => !p.dead && p.pos.z > 108.5 && p.pos.z < 140 && p.pos.y > 2)) {
        B.active = true; B.armed = false; B.z = 101.5; B.y = 14; B.vy = 0; B.speed = 3.5; B.falling = false;
        B.mesh.visible = true; game.sfx('rumble'); game.shake(0.6);
      }
      return;
    }
    B.speed = Math.min(7.2, B.speed + dt * 2.2);
    B.z += B.speed * dt;
    const floor = B.z < 141 || B.z > 143.6 ? this.floorAt(B.z) : -20;
    const restY = (B.z >= 141 && B.z <= 143.6 + B.r) ? -6 : floor;
    B.vy -= 26 * dt;
    B.y += B.vy * dt;
    if (B.y - B.r < restY && restY > -10) {
      if (B.vy < -6) game.shake(0.35);
      B.y = restY + B.r; B.vy = 0;
    }
    if (B.z > 141.6) { B.z = Math.min(B.z, 142.3); B.falling = true; }
    if (B.falling && B.y < -2) { B.active = false; B.mesh.visible = false; B.armed = true; game.shake(0.8); return; }
    B.mesh.position.set(0, B.y, B.z);
    B.mesh.rotation.x += (B.speed * dt) / B.r;
    // atropelamento
    for (const p of game.players) {
      if (p.dead) continue;
      const dy = (p.pos.y + 0.9) - B.y, dz = p.pos.z - B.z, dx = p.pos.x;
      if (Math.abs(dx) < 2.6 && Math.hypot(dy, dz) < B.r + 0.35) game.kill(p, 'esmagado');
    }
  }

  // jogador sobre lanças levantadas?
  hazardAt(p) {
    for (const sp of this.spikes) {
      if (!sp.up) continue;
      if (Math.abs(p.pos.x - sp.x) < 0.95 && Math.abs(p.pos.z - sp.z) < 0.95 && p.pos.y < sp.y + 0.6) return true;
    }
    return false;
  }

  climbAt(p) {
    return this.climbs.some((c) => this.world.bodyIn(p, c));
  }

  checkpointFor(maxZ) {
    let best = this.checkpoints[0];
    for (const c of this.checkpoints) if (maxZ >= c.z && c.z >= best.z) best = c;
    return best;
  }
}
