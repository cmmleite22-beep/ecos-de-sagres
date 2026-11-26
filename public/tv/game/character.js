// Personagem jogável: modelo procedural (sem ficheiros) com animação de andar, correr, saltar e escalar.
import * as THREE from 'three';

export function buildCharacter(colorHex, variant = 0) {
  const color = new THREE.Color(colorHex);
  const skinTones = [0xc68e5f, 0xe2b48a, 0xd9a77e, 0x7a4a2e];
  const hairColors = [0x3a2414, 0x1a1a1a, 0x101010, 0x2a1a10];
  const skin = new THREE.MeshStandardMaterial({ color: skinTones[variant % 4], roughness: 0.6 });
  const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x4b4a3c, roughness: 0.9 });
  const boots = new THREE.MeshStandardMaterial({ color: 0x2b1d12, roughness: 0.7 });
  const hair = new THREE.MeshStandardMaterial({ color: hairColors[variant % 4], roughness: 0.8 });
  const gear = new THREE.MeshStandardMaterial({ color: 0x5a4630, roughness: 0.8 });

  const root = new THREE.Group();
  const body = new THREE.Group(); // roda para a direção de movimento
  root.add(body);

  const cap = (r, l, m) => {
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 4, 10), m);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  };
  const limb = (r, l, m, x, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = cap(r, l, m);
    mesh.position.y = -l / 2 - r;
    pivot.add(mesh);
    body.add(pivot);
    return pivot;
  };

  const torso = cap(0.24, 0.42, shirt);
  torso.position.y = 1.12; torso.scale.set(1, 1, 0.75);
  body.add(torso);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.08, 14), gear);
  belt.position.y = 0.88; belt.scale.z = 0.78; body.add(belt);

  const head = new THREE.Group();
  head.position.y = 1.62; body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14), skin);
  skull.castShadow = true; head.add(skull);
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.18, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  hairM.position.set(0, 0.02, -0.01); head.add(hairM);
  if (variant === 0 || variant === 2) { // rabo de cavalo
    const tail = cap(0.05, 0.22, hair); tail.position.set(0, -0.05, -0.2); tail.rotation.x = 0.5; head.add(tail);
  }
  if (variant === 1) { // chapéu de explorador
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 20), gear);
    brim.position.y = 0.1; head.add(brim);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.14, 16), gear);
    top.position.y = 0.17; head.add(top);
  }
  for (const s of [-1, 1]) { // olhos
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    eye.position.set(0.06 * s, 0.02, 0.155); head.add(eye);
  }

  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.18), gear);
  pack.position.set(0, 1.15, -0.24); pack.castShadow = true; body.add(pack);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.38, 10), new THREE.MeshStandardMaterial({ color: 0x6b7a4a }));
  roll.rotation.z = Math.PI / 2; roll.position.set(0, 1.4, -0.26); body.add(roll);

  const armL = limb(0.07, 0.42, shirt, -0.32, 1.38);
  const armR = limb(0.07, 0.42, shirt, 0.32, 1.38);
  for (const a of [armL, armR]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), skin);
    hand.position.y = -0.62; a.add(hand);
  }
  const legL = limb(0.095, 0.48, pants, -0.12, 0.88);
  const legR = limb(0.095, 0.48, pants, 0.12, 0.88);
  for (const l of [legL, legR]) {
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.26), boots);
    boot.position.set(0, -0.76, 0.04); boot.castShadow = true; l.add(boot);
  }

  // anel de cor no chão para identificar o jogador
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.52, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
  root.add(ring);

  let phase = 0;
  const anim = {
    root, body, ring,
    update(dt, st) {
      // st: { speed, onGround, climbing, vy, hurt }
      const k = Math.min(1, st.speed / 7.5);
      phase += dt * (4 + st.speed * 1.6);
      const sw = Math.sin(phase);
      let aL = 0, aR = 0, lL = 0, lR = 0, lean = 0, bob = 0;
      if (st.climbing) {
        const c = Math.sin(phase * 0.8) * (st.speed > 0.1 ? 1 : 0.2);
        aL = -2.6 + c * 0.4; aR = -2.6 - c * 0.4; lL = -0.4 - c * 0.4; lR = -0.4 + c * 0.4;
      } else if (!st.onGround) {
        aL = aR = -2.2 + Math.max(-0.6, Math.min(0.6, st.vy * 0.06));
        lL = -0.6; lR = 0.3;
      } else {
        aL = sw * 0.9 * k; aR = -sw * 0.9 * k;
        lL = -sw * 0.8 * k; lR = sw * 0.8 * k;
        lean = 0.18 * k;
        bob = Math.abs(Math.cos(phase)) * 0.06 * k;
        if (k < 0.05) { const br = Math.sin(performance.now() / 600) * 0.02; aL = br; aR = -br; }
      }
      const lerp = 1 - Math.exp(-dt * 18);
      armL.rotation.x += (aL - armL.rotation.x) * lerp;
      armR.rotation.x += (aR - armR.rotation.x) * lerp;
      legL.rotation.x += (lL - legL.rotation.x) * lerp;
      legR.rotation.x += (lR - legR.rotation.x) * lerp;
      body.rotation.x += (lean - body.rotation.x) * lerp;
      body.position.y = bob;
      // piscar a vermelho quando leva dano
      const flash = st.hurt > 0 && Math.floor(st.hurt * 12) % 2 === 0;
      body.visible = !flash;
    },
  };
  return anim;
}

// Etiqueta com o nome por cima da cabeça
export function nameTag(text, colorHex) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.strokeText(text, 128, 32);
  ctx.fillStyle = colorHex; ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(1.6, 0.4, 1); s.position.y = 2.2; s.renderOrder = 10;
  return s;
}
