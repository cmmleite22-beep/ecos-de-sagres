// Núcleo do jogo do lado da TV — primeira pessoa com ecrã dividido (1 a 4 jogadores).
// Cada jogador tem a sua câmara; a TV desenha 1, 2 ou 4 vistas no mesmo frame.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { PhysicsWorld, GRAVITY } from './physics.js';
import { createMaterials } from './textures.js';
import { buildCharacter, nameTag } from './character.js';
import { Level1, LINES, ENEMY_SPOTS } from './level1.js';
import { Enemies } from './enemies.js';
import { Sfx } from './audio.js';
import { BTN, CHARACTERS } from '../../shared/protocol.js';

const WALK = 4.6, SPRINT = 7.4, JUMP_V = 9.2, CLIMB_V = 3.4, EYE = 1.62;
const MAX_HP = 100, REGEN_DELAY = 4, REGEN_RATE = 14;
const FIRE_COOLDOWN = 0.22, LOOK_SENS = 0.0042, STICK_LOOK = 2.6;

// camadas: 0 = mundo; 1..4 = corpo do jogador i (escondido na própria vista); 5..8 = arma do jogador i
const BODY_LAYER = (i) => 1 + i, VIEW_LAYER = (i) => 5 + i;
const setLayer = (obj, l) => obj.traverse((o) => o.layers.set(l));

// Disposição das vistas (coordenadas normalizadas, origem em baixo à esquerda como no WebGL)
export function layoutFor(n) {
  if (n <= 1) return [[0, 0, 1, 1]];
  if (n === 2) return [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]];
  return [[0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5], [0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5]];
}

export class Game {
  constructor(canvas, hud, net, quality) {
    this.canvas = canvas; this.hud = hud; this.net = net; this.quality = quality;
    this.players = [];
    this.phase = 'lobby';
    this.cpZ = -10;
    this.relicsFound = 0;
    this.shakeAmt = 0;
    this.audio = new Sfx();
    this.clock = new THREE.Clock();
    this.initRenderer();
    this.world = new PhysicsWorld();
    this.mats = createMaterials(quality);
    this.level = new Level1(this.scene, this.world, this.mats, quality);
    this.enemies = new Enemies(this.scene, this.world, ENEMY_SPOTS);
    this.relicsTotal = this.level.totalRelics;
    // câmara de vista geral (lobby e 4.º quadrante com 3 jogadores)
    this.overCam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 600);
    this.overTarget = new THREE.Vector3(0, 2, 10);
    this.dialogQueue = [];
    this.fx = [];
    this.wireNet();
    this.hud.setRelics(0, this.relicsTotal);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  // ---------- renderização ----------
  initRenderer() {
    const high = this.quality === 'high';
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(high ? Math.min(window.devicePixelRatio, 1.5) : 1);
    r.shadowMap.enabled = true;
    r.shadowMap.autoUpdate = false; // calculada uma vez por frame, não uma vez por vista
    r.shadowMap.type = high ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.9;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.autoClear = false;
    this.renderer = r;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x9fb39a, high ? 0.0055 : 0.008);
    this.scene = scene;

    const sky = new Sky();
    sky.scale.setScalar(1000);
    const u = sky.material.uniforms;
    u.turbidity.value = 6; u.rayleigh.value = 1.6; u.mieCoefficient.value = 0.006; u.mieDirectionalG.value = 0.85;
    const sun = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(58), THREE.MathUtils.degToRad(150));
    u.sunPosition.value.copy(sun);
    scene.add(sky);
    const pmrem = new THREE.PMREMGenerator(r);
    const envScene = new THREE.Scene(); envScene.add(sky.clone());
    scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    scene.environmentIntensity = 0.55;

    scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x3a4a22, 0.5));
    const dir = new THREE.DirectionalLight(0xfff0d6, 2.6);
    dir.castShadow = true;
    const sm = high ? 2048 : 1024;
    dir.shadow.mapSize.set(sm, sm);
    const ext = high ? 36 : 26;
    const sc = dir.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 180;
    dir.shadow.bias = -0.0004; dir.shadow.normalBias = 0.03;
    scene.add(dir); scene.add(dir.target);
    this.sun = dir; this.sunOffset = sun.clone().multiplyScalar(70);

    const n = high ? 600 : 200;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 30; pos[i * 3 + 1] = Math.random() * 12; pos[i * 3 + 2] = Math.random() * 180 - 10; }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffe9a0, size: 0.06, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(this.motes);

    // bloom só em ecrã inteiro (1 jogador) e qualidade alta
    if (high) {
      this.composer = new EffectComposer(r);
      this.renderPass = new RenderPass(scene, null);
      this.composer.addPass(this.renderPass);
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.5, 0.9));
      this.composer.addPass(new OutputPass());
    }
  }

  resize() {
    let w = window.innerWidth, h = window.innerHeight;
    if (this.quality === 'cast') { // Chromecast: 720p, o hardware escala para o ecrã
      const s = Math.min(1, 1280 / w); w = Math.round(w * s); h = Math.round(h * s);
      this.renderer.setSize(w, h, false);
      this.canvas.style.width = '100vw'; this.canvas.style.height = '100vh';
    } else this.renderer.setSize(w, h);
    this.size = { w, h };
    this.composer?.setSize(w, h);
    this.relayout();
  }

  relayout() {
    const rects = layoutFor(this.players.length);
    this.players.forEach((p, i) => {
      const [, , rw, rh] = rects[i];
      p.cam.aspect = (rw * this.size.w) / (rh * this.size.h);
      p.cam.updateProjectionMatrix();
    });
    this.overCam.aspect = this.players.length === 3 ? this.size.w / this.size.h : this.size.w / this.size.h;
    this.overCam.updateProjectionMatrix();
    this.hud.layout(rects, this.players);
  }

  // ---------- rede / jogadores ----------
  wireNet() {
    const net = this.net;
    net.on('room', (code) => this.hud.setRoom(code));
    net.on('join', (id, name, char) => this.addPlayer(id, name, char));
    net.on('leave', (id) => this.removePlayer(id));
    net.on('input', (id, m) => {
      const p = this.players.find((q) => q.id === id);
      if (!p) return;
      p.input.x = clamp(+m.x || 0, -1, 1);
      p.input.y = clamp(+m.y || 0, -1, 1);
      p.input.b = m.b | 0;
      // olhar: deltas do dedo (lx/ly, em px) e/ou velocidade contínua do 2.º joystick (rx/ry)
      p.lookDX += clamp(+m.lx || 0, -400, 400);
      p.lookDY += clamp(+m.ly || 0, -400, 400);
      p.input.rx = clamp(+m.rx || 0, -1, 1);
      p.input.ry = clamp(+m.ry || 0, -1, 1);
      if (m.sens) p.sens = clamp(+m.sens, 0.3, 3);
    });
    net.on('msg', (id, m) => {
      const p = this.players.find((q) => q.id === id);
      if (m.t === 'start') this.startGame();
      if (m.t === 'char' && p && this.phase === 'lobby') this.setChar(p, m.char);
      if (m.t === 'ping') net.send(id, { t: 'pong', ts: m.ts });
    });
  }

  freeChar(pref, except) {
    const used = new Set(this.players.filter((p) => p !== except).map((p) => p.char.id));
    return CHARACTERS.find((c) => c.id === pref && !used.has(c.id)) || CHARACTERS.find((c) => !used.has(c.id)) || CHARACTERS[0];
  }

  makeBody(p) {
    const idx = CHARACTERS.indexOf(p.char);
    p.model = buildCharacter(p.char.color, idx);
    p.tag = nameTag(p.name, p.char.color); p.model.root.add(p.tag);
    this.scene.add(p.model.root);
    p.view = this.buildViewModel(p.char.color);
    p.cam.add(p.view);
  }

  addPlayer(id, name, charId) {
    const known = this.players.find((p) => p.id === id);
    if (known) { // o telemóvel voltou a pedir para entrar (resposta perdida): reenviar o estado
      if (name && name !== known.name) known.name = name;
      this.net.send(id, { t: 'welcome', id, char: known.char.id, color: known.char.color, name: known.name });
      this.syncLobby(); this.sendState(known);
      return;
    }
    if (this.players.length >= 4) { this.net.send(id, { t: 'error', reason: 'Sala cheia' }); return; }
    const char = this.freeChar(charId);
    const cam = new THREE.PerspectiveCamera(72, 1, 0.05, 600);
    this.scene.add(cam);
    const p = {
      id, name: name || char.name.split(' ')[0], char, cam,
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), radius: 0.33, height: 1.75,
      yaw: 0, pitch: 0, lookDX: 0, lookDY: 0, sens: 1,
      onGround: false, ground: null, coyote: 0, jumpBuf: 0, prevB: 0,
      input: { x: 0, y: 0, b: 0, rx: 0, ry: 0 }, hp: MAX_HP, sinceHurt: 99, relics: 0, kills: 0,
      dead: false, deadT: 0, hurt: 0, fireCool: 0, recoil: 0, bob: 0, climbing: false,
    };
    this.makeBody(p);
    this.players.push(p);
    this.assignLayers();
    this.respawn(p);
    this.audio.play('join');
    this.net.send(id, { t: 'welcome', id, char: char.id, color: char.color, name: p.name });
    this.relayout();
    this.syncLobby();
    this.sendState(p);
  }

  assignLayers() {
    this.players.forEach((p, i) => {
      setLayer(p.model.root, BODY_LAYER(i));
      setLayer(p.view, VIEW_LAYER(i));
      p.cam.layers.set(0);
      for (let j = 0; j < 4; j++) if (j !== i) p.cam.layers.enable(BODY_LAYER(j));
      p.cam.layers.enable(VIEW_LAYER(i));
    });
    this.overCam.layers.set(0);
    for (let j = 0; j < 4; j++) this.overCam.layers.enable(BODY_LAYER(j));
  }

  setChar(p, charId) {
    const char = this.freeChar(charId, p);
    if (char === p.char) return;
    this.scene.remove(p.model.root); p.cam.remove(p.view);
    p.char = char;
    this.makeBody(p);
    this.assignLayers();
    this.net.send(p.id, { t: 'welcome', id: p.id, char: char.id, color: char.color, name: p.name });
    this.relayout();
    this.syncLobby();
  }

  removePlayer(id) {
    const i = this.players.findIndex((p) => p.id === id);
    if (i < 0) return;
    const p = this.players[i];
    this.scene.remove(p.model.root); this.scene.remove(p.cam);
    this.players.splice(i, 1);
    this.assignLayers();
    this.relayout();
    this.syncLobby();
  }

  // arma e mão na primeira pessoa
  buildViewModel(colorHex) {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x2a2b2e, metalness: 0.85, roughness: 0.35 });
    const grip = new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 0.8 });
    const sleeve = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc89470, roughness: 0.6 });
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.26), metal); slide.position.set(0, 0.03, -0.08);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 8), metal);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.035, -0.23);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.13, 0.06), grip); handle.position.set(0, -0.05, 0.02); handle.rotation.x = 0.25;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skin); hand.scale.set(1, 1.2, 1.3); hand.position.set(0.01, -0.05, 0.04);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.45, 10), sleeve);
    arm.rotation.x = Math.PI / 2 - 0.25; arm.position.set(0.03, -0.1, 0.27);
    const flash = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 8), new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0 }));
    flash.rotation.x = -Math.PI / 2; flash.position.set(0, 0.035, -0.33);
    g.add(slide, barrel, handle, hand, arm, flash);
    g.position.set(0.19, -0.17, -0.4); g.scale.setScalar(0.75);
    g.userData = { flash, base: g.position.clone() };
    g.traverse((o) => { if (o.material) o.material.depthTest = true; });
    return g;
  }

  syncLobby() {
    const list = this.players.map((p) => ({ id: p.id, name: p.name, char: p.char.id, color: p.char.color, hp: Math.ceil(p.hp), relics: p.relics, kills: p.kills, dead: p.dead }));
    this.hud.setPlayers(list);
    this.net.send(null, { t: 'lobby', players: list, phase: this.phase });
  }

  sendState(p) {
    this.net.send(p.id, { t: 'state', hp: Math.ceil(p.hp), max: MAX_HP, relics: p.relics, kills: p.kills, team: this.relicsFound, total: this.relicsTotal, phase: this.phase });
  }

  startGame() {
    if (this.phase !== 'lobby' || this.players.length === 0) return;
    this.phase = 'play';
    this.audio.ensure();
    this.hud.showLobby(false);
    this.hud.toast('CAPÍTULO 1 — O TEMPLO DAS MARÉS', 3500);
    this.queueLines('intro');
    for (const p of this.players) this.sendState(p);
    this.syncLobby();
  }

  // ---------- regras ----------
  respawn(p) {
    const cp = this.level.checkpointFor(this.cpZ);
    const i = this.players.indexOf(p);
    p.pos.copy(cp.spawn).add(new THREE.Vector3((i - 1.5) * 1.1, 0.05, 0));
    p.vel.set(0, 0, 0);
    p.yaw = 0; p.pitch = -0.05;
    p.dead = false; p.hp = MAX_HP; p.hurt = 1.0; p.ground = null; p.onGround = false;
    p.model.root.visible = true; p.view.visible = true;
    p.model.root.position.copy(p.pos);
  }

  damage(p, amt, from) {
    if (p.dead || p.hurt > 0) return;
    p.hp -= amt; p.sinceHurt = 0;
    if (amt >= 25) p.hurt = 0.8;
    this.audio.play('hurt');
    this.net.send(p.id, { t: 'buzz', ms: amt >= 25 ? 160 : 70 });
    this.hud.hurt(this.players.indexOf(p), from ? this.dirTo(p, from) : null);
    if (p.hp <= 0) this.kill(p, 'ferido');
    else this.sendState(p);
    this.hudDirty = true;
  }

  dirTo(p, from) { // ângulo do atacante relativo ao olhar do jogador (para o indicador de dano)
    const a = Math.atan2(from.x - p.pos.x, from.z - p.pos.z);
    return Math.atan2(Math.sin(a - p.yaw), Math.cos(a - p.yaw));
  }

  kill(p, why) {
    if (p.dead) return;
    p.dead = true; p.deadT = 2.5; p.hp = 0;
    p.model.root.visible = false; p.view.visible = false;
    this.audio.play('die');
    this.net.send(p.id, { t: 'buzz', ms: 400 });
    const msg = { caiu: 'caiu', esmagado: 'foi esmagado(a)!', ferido: 'foi abatido(a)!' }[why] || 'caiu';
    this.hud.toast(`${p.name} ${msg}`, 1600);
    this.sendState(p); this.syncLobby();
  }

  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }
  sfx(n) { this.audio.play(n); }

  queueLines(key) {
    for (const [who, text] of LINES[key] || []) this.dialogQueue.push({ who, text });
    if (!this.dialogBusy) this.nextLine();
  }
  nextLine() {
    const l = this.dialogQueue.shift();
    if (!l) { this.dialogBusy = false; this.hud.dialog(null); return; }
    this.dialogBusy = true;
    const c = CHARACTERS.find((k) => k.name.startsWith(l.who));
    this.hud.dialog(l.who, l.text, c?.color);
    setTimeout(() => this.nextLine(), 1800 + l.text.length * 45);
  }

  win() {
    if (this.phase !== 'play') return;
    this.phase = 'win';
    this.level.astrolabeTaken = true;
    this.level.astrolabe.visible = false;
    this.audio.play('win');
    this.queueLines('win');
    for (const p of this.players) { this.net.send(p.id, { t: 'buzz', ms: 300 }); this.sendState(p); }
    setTimeout(() => this.hud.showWin(this.players, this.relicsFound, this.relicsTotal, this.elapsed), 2500);
  }

  shoot(p) {
    p.fireCool = FIRE_COOLDOWN; p.recoil = 1;
    this.audio.play('shot');
    const o = new THREE.Vector3(); p.cam.getWorldPosition(o);
    const d = new THREE.Vector3(); p.cam.getWorldDirection(d);
    const wallT = this.world.raycast(o, d, 120);
    const hit = this.enemies.rayHit(o, d, wallT);
    const muzzle = new THREE.Vector3(); p.view.userData.flash.getWorldPosition(muzzle);
    const end = o.clone().addScaledVector(d, hit ? hit.t : Math.min(wallT, 120));
    this.enemies.tracer(muzzle, end, 0xffe0a0);
    if (hit) {
      this.enemies.hit(hit.e, hit.head, this);
      if (hit.e.dead) { p.kills++; this.sendState(p); this.hudDirty = true; }
      this.hud.hitmarker(this.players.indexOf(p), hit.head);
      this.net.send(p.id, { t: 'buzz', ms: 25 });
    } else if (wallT < 120) this.spark(end);
  }

  spark(at) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true }));
    m.position.copy(at); this.scene.add(m);
    this.fx.push({ m, life: 0.2 });
  }

  updatePlayer(p, dt) {
    if (p.dead) {
      p.deadT -= dt;
      if (p.deadT <= 0) { this.respawn(p); this.sendState(p); this.syncLobby(); }
      return;
    }
    const inp = p.input;
    const pressed = inp.b & ~p.prevB;
    p.prevB = inp.b;
    if (pressed & BTN.JUMP) p.jumpBuf = 0.15;
    p.jumpBuf -= dt; p.hurt = Math.max(0, p.hurt - dt);
    p.fireCool -= dt;
    p.sinceHurt += dt;
    if (p.sinceHurt > REGEN_DELAY && p.hp < MAX_HP) {
      p.hp = Math.min(MAX_HP, p.hp + REGEN_RATE * dt);
      if (Math.floor(p.hp) % 10 === 0) this.hudDirty = true;
    }

    // olhar
    p.yaw -= (p.lookDX * LOOK_SENS * p.sens) + inp.rx * STICK_LOOK * p.sens * dt;
    p.pitch -= (p.lookDY * LOOK_SENS * p.sens) - inp.ry * STICK_LOOK * 0.7 * p.sens * dt;
    p.pitch = clamp(p.pitch, -1.35, 1.35);
    p.lookDX = 0; p.lookDY = 0;

    // movimento relativo ao olhar (frente = (sin yaw, cos yaw))
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    const rx = -fz, rz = fx; // direita
    let mx = fx * inp.y + rx * inp.x, mz = fz * inp.y + rz * inp.x;
    const mag = Math.hypot(inp.x, inp.y);
    const dead = mag < 0.12;
    if (mag > 1) { mx /= mag; mz /= mag; }
    const speed = (inp.b & BTN.SPRINT) && inp.y > 0.3 ? SPRINT : WALK;
    const tx = dead ? 0 : mx * speed, tz = dead ? 0 : mz * speed;
    const acc = p.onGround ? 40 : 14;
    p.vel.x += clamp(tx - p.vel.x, -acc * dt, acc * dt);
    p.vel.z += clamp(tz - p.vel.z, -acc * dt, acc * dt);

    // escalada: dentro das trepadeiras e a empurrar para a frente
    const inClimb = this.level.climbAt(p);
    p.climbing = inClimb && (inp.y > 0.3 || (p.climbing && !p.onGround));
    if (p.climbing) {
      p.vel.y = inp.y > 0.3 ? CLIMB_V : inp.y < -0.3 ? -CLIMB_V : 0;
      if (p.jumpBuf > 0) { p.climbing = false; p.vel.y = 6; p.vel.x = -fx * 3; p.vel.z = -fz * 3; p.jumpBuf = 0; }
    } else {
      p.vel.y = Math.max(-30, p.vel.y - GRAVITY * dt);
    }

    p.coyote = p.onGround ? 0.12 : p.coyote - dt;
    if (p.jumpBuf > 0 && p.coyote > 0 && !p.climbing) {
      p.vel.y = JUMP_V; p.coyote = 0; p.jumpBuf = 0; p.ground = null;
      this.audio.play('jump');
    }
    this.world.moveBody(p, dt);
    this.enemies.pushOut(p);

    if (p.onGround && this.phase === 'play' && p.pos.z > this.cpZ) {
      const before = this.level.checkpointFor(this.cpZ);
      this.cpZ = p.pos.z;
      if (this.level.checkpointFor(this.cpZ) !== before) { this.audio.play('checkpoint'); this.hud.toast('Ponto de controlo', 1200); }
    }

    if (p.pos.y < -1.5) { this.kill(p, 'caiu'); return; }
    if (this.level.hazardAt(p)) { this.damage(p, 34); p.vel.y = 6; }

    // disparar (mantém o botão para disparo contínuo)
    if ((inp.b & BTN.FIRE) && p.fireCool <= 0 && this.phase !== 'win') this.shoot(p);

    const chest = new THREE.Vector3(p.pos.x, p.pos.y + 0.9, p.pos.z);
    for (const r of this.level.relics) {
      if (!r.taken && r.pos.distanceTo(chest) < 1.1) {
        r.taken = true; r.g.visible = false;
        p.relics++; this.relicsFound++;
        this.audio.play('relic');
        this.net.send(p.id, { t: 'buzz', ms: 40 });
        this.hud.setRelics(this.relicsFound, this.relicsTotal);
        this.sendState(p); this.hudDirty = true;
      }
    }
    if ((pressed & BTN.ACTION) && this.phase === 'play' && p.pos.distanceTo(this.level.altarPos) < 3.2) this.win();

    // corpo (visto pelos outros)
    const hs = Math.hypot(p.vel.x, p.vel.z);
    p.model.body.rotation.y = p.yaw;
    p.model.root.position.copy(p.pos);
    p.model.update(dt, { speed: hs, onGround: p.onGround, climbing: p.climbing, vy: p.vel.y, hurt: p.hurt });

    // câmara na cabeça, com balanço ao andar
    p.bob += dt * hs * 1.9;
    const bobY = p.onGround ? Math.sin(p.bob * 2) * 0.04 * Math.min(1, hs / 5) : 0;
    p.cam.position.set(p.pos.x, p.pos.y + EYE + bobY, p.pos.z);
    p.cam.rotation.set(p.pitch, p.yaw + Math.PI, 0, 'YXZ');
    // arma: recuo e balanço
    p.recoil = Math.max(0, p.recoil - dt * 8);
    const v = p.view, b = v.userData.base;
    v.position.set(b.x + Math.sin(p.bob) * 0.012, b.y + bobY * 0.4 - (p.climbing ? 0.3 : 0), b.z + p.recoil * 0.06);
    v.rotation.x = p.recoil * 0.25;
    v.userData.flash.material.opacity = p.recoil > 0.75 ? 1 : 0;
  }

  // quem fica muito para trás é trazido para junto do grupo
  catchUp() {
    const alive = this.players.filter((p) => !p.dead && p.onGround);
    if (alive.length < 2) return;
    const lead = alive.reduce((a, b) => (b.pos.z > a.pos.z ? b : a));
    for (const p of alive) {
      if (lead.pos.z - p.pos.z > 28 || (lead.pos.z - p.pos.z > 10 && lead.pos.y - p.pos.y > 5)) {
        p.pos.copy(lead.pos).add(new THREE.Vector3(p.pos.x > lead.pos.x ? 0.8 : -0.8, 0.1, -0.8));
        p.vel.set(0, 0, 0); p.hurt = 1;
        this.hud.toast(`${p.name} juntou-se ao grupo`, 1200);
      }
    }
  }

  updateOverview(dt) {
    const alive = this.players.filter((p) => !p.dead);
    const target = new THREE.Vector3();
    if (alive.length) { for (const p of alive) target.add(p.pos); target.divideScalar(alive.length); }
    else {
      const t = performance.now() / 1000;
      target.set(Math.sin(t * 0.1) * 4, 2, 12 + Math.sin(t * 0.07) * 10);
    }
    this.overTarget.lerp(target, 1 - Math.exp(-dt * 2));
    const t = performance.now() / 1000;
    const want = this.overTarget.clone().add(new THREE.Vector3(Math.sin(t * 0.05) * 10, 12, -14));
    this.overCam.position.lerp(want, 1 - Math.exp(-dt * 2));
    this.overCam.lookAt(this.overTarget.clone().add(new THREE.Vector3(0, 1, 4)));
  }

  render() {
    const r = this.renderer, { w, h } = this.size;
    // sol e sombras centrados no grupo
    this.sun.target.position.copy(this.overTarget);
    this.sun.position.copy(this.overTarget).add(this.sunOffset);
    r.shadowMap.needsUpdate = true;
    const n = this.players.length;
    const shake = this.shakeAmt > 0 ? this.shakeAmt : 0;
    if (n === 1 && this.composer && this.phase !== 'lobby') {
      const cam = this.players[0].cam;
      if (shake) cam.position.add(new THREE.Vector3((Math.random() - 0.5) * shake * 0.3, (Math.random() - 0.5) * shake * 0.3, 0));
      this.renderPass.camera = cam;
      r.setScissorTest(false); r.setViewport(0, 0, w, h);
      this.composer.render();
      return;
    }
    r.setScissorTest(false); r.clear();
    if (n === 0 || this.phase === 'lobby' && n === 0) {
      r.setViewport(0, 0, w, h); r.render(this.scene, this.overCam); return;
    }
    const rects = layoutFor(n);
    r.setScissorTest(true);
    rects.forEach(([x, y, rw, rh], i) => {
      const vx = Math.floor(x * w), vy = Math.floor(y * h), vw = Math.ceil(rw * w), vh = Math.ceil(rh * h);
      r.setViewport(vx, vy, vw, vh); r.setScissor(vx, vy, vw, vh);
      const p = this.players[i];
      if (p) {
        if (shake) p.cam.position.add(new THREE.Vector3((Math.random() - 0.5) * shake * 0.3, (Math.random() - 0.5) * shake * 0.3, 0));
        r.render(this.scene, p.cam);
      } else {
        this.overCam.aspect = vw / vh; this.overCam.updateProjectionMatrix();
        r.render(this.scene, this.overCam);
      }
    });
    r.setScissorTest(false);
  }

  loop() {
    // tempo de jogo = tempo real (até 0,25 s por frame) com passos fixos de física a 120 Hz
    const dt = Math.min(0.25, this.clock.getDelta());
    if (this.phase === 'play') this.elapsed = (this.elapsed || 0) + dt;
    this.acc = (this.acc || 0) + dt;
    const STEP = 1 / 120;
    let n = 0;
    while (this.acc >= STEP && n < 32) {
      this.world.beginFrame();
      this.level.update(STEP, this);
      this.enemies.update(STEP, this);
      for (const p of this.players) this.updatePlayer(p, STEP);
      this.acc -= STEP; n++;
      this.simTime = (this.simTime || 0) + STEP;
    }
    if (n === 32) this.acc = 0;
    this.catchUp();
    for (const tr of this.level.triggers) {
      if (!tr.done && this.phase === 'play' && this.players.some((p) => p.pos.z > tr.z && !p.dead)) {
        tr.done = true; if (tr.key !== 'intro') this.queueLines(tr.key);
      }
    }
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i]; f.life -= dt; f.m.material.opacity = f.life / 0.2; f.m.scale.setScalar(1 + (0.2 - f.life) * 6);
      if (f.life <= 0) { this.scene.remove(f.m); this.fx.splice(i, 1); }
    }
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.5);
    this.motes.position.y = Math.sin(performance.now() / 3000) * 0.3;
    this.updateOverview(dt);
    this.render();
    if (this.hudDirty) { this.hudDirty = false; this.syncLobby(); }
    this.hud.frame(this.players, dt, MAX_HP);
    requestAnimationFrame(() => this.loop());
  }

  // atalho de desenvolvimento: jogar com teclado e rato no PC (WASD + rato, clique = disparar)
  enableKeyboard() {
    const keys = new Set();
    const id = 'kb';
    let mouseDown = false;
    const ensure = () => { if (!this.players.find((p) => p.id === id)) this.addPlayer(id, 'Teclado', 'ana'); };
    window.addEventListener('keydown', (e) => {
      keys.add(e.code);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) ensure();
      if (e.code === 'Enter') this.startGame();
      this.audio.ensure();
    });
    window.addEventListener('keyup', (e) => keys.delete(e.code));
    this.canvas.addEventListener('click', () => { if (this.players.find((p) => p.id === id)) this.canvas.requestPointerLock?.(); });
    window.addEventListener('mousedown', () => { mouseDown = true; });
    window.addEventListener('mouseup', () => { mouseDown = false; });
    window.addEventListener('mousemove', (e) => {
      const p = this.players.find((q) => q.id === id);
      if (p && document.pointerLockElement === this.canvas) { p.lookDX += e.movementX * 0.6; p.lookDY += e.movementY * 0.6; }
    });
    setInterval(() => {
      const p = this.players.find((q) => q.id === id);
      if (!p) return;
      p.input.x = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
      p.input.y = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
      p.input.rx = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
      p.input.ry = (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0);
      p.input.b = (keys.has('Space') ? BTN.JUMP : 0) | (keys.has('ShiftLeft') ? BTN.SPRINT : 0) |
        (keys.has('KeyE') ? BTN.ACTION : 0) | (mouseDown && document.pointerLockElement ? BTN.FIRE : 0) | (keys.has('KeyF') ? BTN.FIRE : 0);
    }, 16);
  }
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
