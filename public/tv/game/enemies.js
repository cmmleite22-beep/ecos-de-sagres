// Mercenários do Consórcio Meridiano: patrulham, veem os jogadores e disparam.
import * as THREE from 'three';
import { buildCharacter } from './character.js';

const SIGHT = 26, FIRE_EVERY = 1.5, DMG = 12;

export class Enemies {
  constructor(scene, world, spots) {
    this.scene = scene; this.world = world;
    this.list = spots.map(([x, y, z, yaw = Math.PI]) => this.spawn(x, y, z, yaw));
    this.tracers = [];
  }

  spawn(x, y, z, yaw) {
    const m = buildCharacter('#2a2a2a', 1);
    // visor vermelho para se distinguirem dos heróis
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.05), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    visor.position.set(0, 1.64, 0.16); m.body.add(visor);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.55), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.4 }));
    gun.position.set(0.22, 1.2, 0.35); m.body.add(gun);
    m.ring.material.color.set(0xff2a2a);
    m.bake();
    m.root.position.set(x, y, z);
    this.scene.add(m.root);
    return {
      model: m, home: new THREE.Vector3(x, y, z), pos: new THREE.Vector3(x, y, z), yaw,
      hp: 3, dead: false, deadT: 0, cool: 1 + Math.random(), alert: false, t: Math.random() * 10, flash: 0,
      radius: 0.45, height: 1.8,
    };
  }

  // devolve o inimigo atingido por um raio (origem o, direção d) antes da distância maxDist
  rayHit(o, d, maxDist) {
    let best = null, bestT = maxDist;
    const c = new THREE.Vector3();
    for (const e of this.list) {
      if (e.dead) continue;
      // dois "círculos" de colisão: tronco e cabeça (tiro na cabeça = morte imediata)
      for (const [h, r, head] of [[1.1, 0.45, false], [1.62, 0.22, true]]) {
        c.set(e.pos.x, e.pos.y + h, e.pos.z).sub(o);
        const t = c.dot(d);
        if (t < 0 || t > bestT) continue;
        const dist2 = c.lengthSq() - t * t;
        if (dist2 < r * r) { bestT = t; best = { e, t, head }; }
      }
    }
    return best;
  }

  hit(e, head, game) {
    e.hp -= head ? 3 : 1; e.alert = true; e.flash = 0.12;
    if (e.hp <= 0) {
      e.dead = true; e.deadT = 0;
      game.sfx('enemyDown');
      game.hud.toast(head ? 'Tiro na cabeça!' : 'Mercenário abatido', 1000);
    }
  }

  update(dt, game) {
    for (const e of this.list) {
      const m = e.model;
      if (e.dead) {
        e.deadT += dt;
        m.body.rotation.x = Math.max(-Math.PI / 2, m.body.rotation.x - dt * 4);
        m.root.position.y = e.pos.y - Math.min(0.3, e.deadT * 0.2);
        if (e.deadT > 6) m.root.visible = false;
        continue;
      }
      e.t += dt; e.flash = Math.max(0, e.flash - dt);
      // alvo mais próximo visível
      let target = null, td = SIGHT;
      for (const p of game.players) {
        if (p.dead) continue;
        const d = p.pos.distanceTo(e.pos);
        if (d < td && this.canSee(e, p)) { target = p; td = d; }
      }
      let speed = 0;
      if (target && game.phase === 'play') {
        e.alert = true;
        const want = Math.atan2(target.pos.x - e.pos.x, target.pos.z - e.pos.z);
        let dy = want - e.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        e.yaw += dy * Math.min(1, dt * 5);
        // desvia-se de lado enquanto dispara
        const side = Math.sin(e.t * 0.9) * 1.6;
        const nx = e.home.x + Math.cos(e.yaw) * side, nz = e.home.z - Math.sin(e.yaw) * side;
        speed = Math.hypot(nx - e.pos.x, nz - e.pos.z) / dt;
        e.pos.x = nx; e.pos.z = nz;
        e.cool -= dt;
        if (e.cool <= 0 && Math.abs(dy) < 0.3) {
          e.cool = FIRE_EVERY * (0.8 + Math.random() * 0.5);
          this.fire(e, target, td, game);
        }
      } else {
        e.yaw += Math.sin(e.t * 0.4) * dt * 0.5; // olha à volta
      }
      m.body.rotation.y = e.yaw;
      m.root.position.copy(e.pos);
      m.update(dt, { speed: Math.min(speed, 3), onGround: true, climbing: false, vy: 0, hurt: e.flash });
    }
    // traçantes
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= dt;
      tr.line.material.opacity = Math.max(0, tr.life / 0.12);
      if (tr.life <= 0) { this.scene.remove(tr.line); tr.line.geometry.dispose(); this.tracers.splice(i, 1); }
    }
  }

  canSee(e, p) {
    const o = new THREE.Vector3(e.pos.x, e.pos.y + 1.6, e.pos.z);
    const t = new THREE.Vector3(p.pos.x, p.pos.y + 1.4, p.pos.z);
    const d = t.clone().sub(o); const len = d.length(); d.divideScalar(len);
    return this.world.raycast(o, d, len) >= len - 0.3;
  }

  fire(e, p, dist, game) {
    const o = new THREE.Vector3(e.pos.x, e.pos.y + 1.25, e.pos.z);
    const t = new THREE.Vector3(p.pos.x, p.pos.y + 1.3, p.pos.z);
    // precisão cai com a distância e se o jogador estiver a correr
    const moving = Math.hypot(p.vel.x, p.vel.z) > 5 ? 0.25 : 0;
    const hitChance = Math.max(0.2, 0.85 - dist * 0.025 - moving);
    const hit = Math.random() < hitChance;
    if (!hit) t.add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random(), (Math.random() - 0.5) * 2));
    this.tracer(o, t, 0xff5040);
    game.sfx('enemyShot');
    if (hit) game.damage(p, DMG, e.pos);
  }

  tracer(a, b, color) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.12 });
  }

  // empurra jogadores para fora dos inimigos vivos
  pushOut(p) {
    for (const e of this.list) {
      if (e.dead) continue;
      const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.75 && d > 0.001 && Math.abs(p.pos.y - e.pos.y) < 1.5) {
        p.pos.x = e.pos.x + (dx / d) * 0.75; p.pos.z = e.pos.z + (dz / d) * 0.75;
      }
    }
  }

  get aliveCount() { return this.list.filter((e) => !e.dead).length; }
}
