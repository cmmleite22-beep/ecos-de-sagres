// Física simples e determinística: personagens como caixas (AABB) contra caixas estáticas ou móveis.
// Suficiente para plataformas, degraus, escalada e armadilhas sem um motor de física pesado.

export const GRAVITY = 26;
export const STEP_HEIGHT = 0.45;

export class Collider {
  constructor(minX, minY, minZ, maxX, maxY, maxZ, opts = {}) {
    this.min = { x: minX, y: minY, z: minZ };
    this.max = { x: maxX, y: maxY, z: maxZ };
    this.delta = { x: 0, y: 0, z: 0 };  // deslocamento neste frame (plataformas móveis)
    this.solid = opts.solid !== false;
    this.tag = opts.tag || 'static';
    this.enabled = true;
  }
  static fromCenter(cx, cy, cz, w, h, d, opts) {
    return new Collider(cx - w / 2, cy - h / 2, cz - d / 2, cx + w / 2, cy + h / 2, cz + d / 2, opts);
  }
  moveBy(dx, dy, dz) {
    this.min.x += dx; this.max.x += dx;
    this.min.y += dy; this.max.y += dy;
    this.min.z += dz; this.max.z += dz;
    this.delta.x += dx; this.delta.y += dy; this.delta.z += dz;
  }
}

export class PhysicsWorld {
  constructor() { this.colliders = []; }
  add(c) { this.colliders.push(c); return c; }
  beginFrame() { for (const c of this.colliders) c.delta.x = c.delta.y = c.delta.z = 0; }

  overlaps(b, c) {
    return b.minX < c.max.x && b.maxX > c.min.x &&
           b.minY < c.max.y && b.maxY > c.min.y &&
           b.minZ < c.max.z && b.maxZ > c.min.z;
  }

  boxOf(body) {
    const r = body.radius;
    return {
      minX: body.pos.x - r, maxX: body.pos.x + r,
      minY: body.pos.y, maxY: body.pos.y + body.height,
      minZ: body.pos.z - r, maxZ: body.pos.z + r,
    };
  }

  // Move um corpo {pos, vel, radius, height} e resolve colisões eixo a eixo.
  moveBody(body, dt) {
    // transportado pela plataforma onde está de pé
    if (body.ground && body.ground.enabled) {
      body.pos.x += body.ground.delta.x;
      body.pos.y += body.ground.delta.y;
      body.pos.z += body.ground.delta.z;
    }
    const solids = this.colliders.filter((c) => c.solid && c.enabled);

    for (const axis of ['x', 'z']) {
      const d = body.vel[axis] * dt;
      if (!d) continue;
      body.pos[axis] += d;
      let box = this.boxOf(body);
      for (const c of solids) {
        if (!this.overlaps(box, c)) continue;
        // degrau: subir automaticamente obstáculos baixos
        const rise = c.max.y - body.pos.y;
        if (body.onGround && rise > 0 && rise <= STEP_HEIGHT && this.freeAt(body, solids, rise + 0.01)) {
          body.pos.y = c.max.y + 0.001;
          box = this.boxOf(body);
          continue;
        }
        if (d > 0) body.pos[axis] = c.min[axis] - body.radius - 0.001;
        else body.pos[axis] = c.max[axis] + body.radius + 0.001;
        body.vel[axis] = 0;
        body.hitWall = true;
        box = this.boxOf(body);
      }
    }

    body.pos.y += body.vel.y * dt;
    let box = this.boxOf(body);
    const wasGround = body.ground;
    body.onGround = false; body.ground = null;
    for (const c of solids) {
      if (!this.overlaps(box, c)) continue;
      if (body.vel.y <= 0 && body.pos.y - body.vel.y * dt >= c.max.y - 0.25 - Math.abs(c.delta.y)) {
        body.pos.y = c.max.y;
        body.vel.y = 0;
        body.onGround = true; body.ground = c;
      } else if (body.vel.y > 0) {
        body.pos.y = c.min.y - body.height - 0.001;
        body.vel.y = 0;
      } else {
        // sobreposição lateral residual: empurrar para fora pelo eixo mais curto
        const px = Math.min(box.maxX - c.min.x, c.max.x - box.minX);
        const pz = Math.min(box.maxZ - c.min.z, c.max.z - box.minZ);
        if (px < pz) body.pos.x += (body.pos.x < (c.min.x + c.max.x) / 2 ? -px : px);
        else body.pos.z += (body.pos.z < (c.min.z + c.max.z) / 2 ? -pz : pz);
      }
      box = this.boxOf(body);
    }
    // "colar" ao chão ao descer degraus/rampas pequenas
    if (!body.onGround && wasGround && body.vel.y <= 0) {
      const probe = { ...box, minY: box.minY - STEP_HEIGHT, maxY: box.minY };
      for (const c of solids) {
        if (this.overlaps(probe, c) && c.max.y <= body.pos.y + 0.01) {
          body.pos.y = c.max.y; body.vel.y = 0; body.onGround = true; body.ground = c; break;
        }
      }
    }
  }

  freeAt(body, solids, dy) {
    const b = this.boxOf(body);
    b.minY += dy; b.maxY += dy;
    return !solids.some((c) => this.overlaps(b, c));
  }

  // Volume de gatilho (não sólido) contém o ponto/corpo?
  bodyIn(body, c) { return this.overlaps(this.boxOf(body), c); }
}

// Raio contra caixas sólidas (método das "slabs"). Devolve a distância até ao primeiro impacto ou Infinity.
PhysicsWorld.prototype.raycast = function (o, d, maxDist = 200) {
  let best = maxDist;
  for (const c of this.colliders) {
    if (!c.solid || !c.enabled) continue;
    let tmin = 0, tmax = best, hit = true;
    for (const a of ['x', 'y', 'z']) {
      if (Math.abs(d[a]) < 1e-8) {
        if (o[a] < c.min[a] || o[a] > c.max[a]) { hit = false; break; }
      } else {
        let t1 = (c.min[a] - o[a]) / d[a], t2 = (c.max[a] - o[a]) / d[a];
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) { hit = false; break; }
      }
    }
    if (hit && tmin < best) best = tmin;
  }
  return best;
};
