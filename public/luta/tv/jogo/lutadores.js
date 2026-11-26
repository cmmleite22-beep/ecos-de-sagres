// Elenco, poses e golpes. Tudo original: personagens açorianas e lisboetas criadas para este jogo.

// ---------------------------------------------------------------- poses base (virado para +x)
// hip = anca (rel. chão), t = inclinação do tronco (graus, + para a frente), h = cabeça,
// hf/hb = mão da frente/de trás (rel. ombro), ff/fb = pé da frente/de trás (rel. anca), rot = rodar o corpo todo
export const P = {
  idle:   { hip: [0, 106], t: 10, h: -6, hf: [30, -6], hb: [18, -14], ff: [28, -106], fb: [-30, -104] },
  idle2:  { hip: [0, 102], t: 12, h: -4, hf: [31, -11], hb: [19, -19], ff: [29, -102], fb: [-31, -100] },
  crouch: { hip: [0, 62], t: 22, h: -14, hf: [34, -2], hb: [22, -10], ff: [40, -62], fb: [-30, -60] },
  jump:   { hip: [0, 106], t: 4, h: -4, hf: [28, 10], hb: [14, 4], ff: [22, -72], fb: [-18, -88] },
  tuck:   { hip: [0, 106], t: 20, h: -8, hf: [30, -4], hb: [20, -6], ff: [30, -52], fb: [-6, -58] },
  block:  { hip: [-6, 104], t: -4, h: 6, hf: [20, 16], hb: [15, 7], ff: [26, -104], fb: [-34, -100] },
  cblock: { hip: [-4, 60], t: 14, h: 4, hf: [24, 12], hb: [17, 5], ff: [38, -60], fb: [-32, -58] },
  hitHi:  { hip: [-10, 104], t: -22, h: -28, hf: [6, -40], hb: [-14, -34], ff: [30, -104], fb: [-34, -102] },
  hitMid: { hip: [-6, 96], t: 34, h: 16, hf: [20, -46], hb: [6, -50], ff: [24, -96], fb: [-36, -92] },
  hitLo:  { hip: [-6, 64], t: 30, h: 14, hf: [26, -30], hb: [10, -34], ff: [40, -64], fb: [-30, -62] },
  hitAir: { hip: [0, 80], rot: 40, t: -10, h: -20, hf: [-20, -20], hb: [-30, -10], ff: [40, -90], fb: [10, -100] },
  down:   { hip: [-10, 16], rot: 86, t: 0, h: -10, hf: [-24, -50], hb: [-48, -24], ff: [16, -112], fb: [4, -114] },
  getup:  { hip: [0, 50], t: 40, h: -10, hf: [40, -40], hb: [30, -46], ff: [34, -50], fb: [-30, -46] },
  win:    { hip: [0, 110], t: -4, h: -12, hf: [12, 84], hb: [14, -46], ff: [30, -110], fb: [-26, -108] },
  win2:   { hip: [0, 108], t: -2, h: -16, hf: [6, 86], hb: [16, -48], ff: [30, -108], fb: [-26, -106] },
  walk:   null, // procedimental
};
const mod = (base, o) => ({ ...P[base], ...o });

// ---- golpes normais (partilhados; cada lutador aplica multiplicadores) ----
const jabX   = mod('idle', { hip: [4, 106], t: 16, hf: [84, 6], hb: [16, -14] });
const kickC  = mod('idle', { hip: [-2, 108], t: -6, hf: [24, 0], hb: [10, -10], ff: [42, -48], fb: [-6, -108] });
const kickX  = mod('idle', { hip: [-8, 110], t: -16, h: 4, hf: [26, -4], hb: [4, -20], ff: [106, -4], fb: [-4, -110] });
const cjabX  = mod('crouch', { t: 26, hf: [82, -8] });
const sweepX = mod('crouch', { hip: [-6, 48], t: 34, h: -10, hf: [40, -34], hb: [30, -42], ff: [114, -44], fb: [-36, -48] });
const jpX    = mod('tuck', { t: 26, hf: [64, -48], hb: [14, -8] });
const jkX    = mod('jump', { t: -6, hf: [20, 10], hb: [6, 0], ff: [82, -64], fb: [-14, -70] });

export const NORMALS = {
  jab:   { keys: [[0, 'idle'], [3, jabX], [7, jabX], [16, 'idle']], frames: 16, active: [3, 6],
           hit: { pt: 'hf', r: 18, dmg: 45, stun: 15, bstun: 11, push: 5, lvl: 'mid' }, cancel: true, snd: 'whoosh1' },
  kick:  { keys: [[0, 'idle'], [5, kickC], [8, kickX], [13, kickX], [26, 'idle']], frames: 26, active: [8, 12],
           hit: { pt: 'ff', r: 22, dmg: 72, stun: 19, bstun: 14, push: 8, lvl: 'mid' }, cancel: true, snd: 'whoosh2' },
  cjab:  { keys: [[0, 'crouch'], [3, cjabX], [7, cjabX], [15, 'crouch']], frames: 15, active: [3, 6], crouch: true,
           hit: { pt: 'hf', r: 18, dmg: 38, stun: 14, bstun: 10, push: 5, lvl: 'mid' }, cancel: true, snd: 'whoosh1' },
  sweep: { keys: [[0, 'crouch'], [6, sweepX], [12, sweepX], [30, 'crouch']], frames: 30, active: [6, 11], crouch: true,
           hit: { pt: 'ff', r: 22, dmg: 62, stun: 20, bstun: 16, push: 6, lvl: 'low', knock: true }, cancel: true, snd: 'whoosh2' },
  jpunch:{ keys: [[0, 'tuck'], [4, jpX]], frames: 60, active: [4, 16], air: true,
           hit: { pt: 'hf', r: 20, dmg: 62, stun: 18, bstun: 13, push: 4, lvl: 'high' }, snd: 'whoosh1' },
  jkick: { keys: [[0, 'tuck'], [5, jkX]], frames: 60, active: [5, 20], air: true,
           hit: { pt: 'ff', r: 23, dmg: 78, stun: 20, bstun: 14, push: 5, lvl: 'high' }, snd: 'whoosh2' },
};

// ---------------------------------------------------------------- elenco
export const ROSTER = [
  {
    id: 'mare', name: 'Marta "Maré"', short: 'MARÉ', from: 'Rabo de Peixe, São Miguel',
    bio: 'Pescadora que aprendeu a lutar contra o mar bravo. Rápida e difícil de apanhar.',
    color: '#2bb7b3',
    hp: 1000, walk: 4.3, back: 3.4, jump: 15.5, dmg: 1, speed: 1,
    look: {
      id: 'mare', size: 1, hair: 'ponytail', top: 'tank', sleeves: 'none', pants: 'cargo', shoes: null,
      build: { limb: 0.95, chest: 0.92, waist: 0.9 },
      colors: { skin: '#d9a07a', hair: '#2a1a14', top: '#2bb7b3', pants: '#24345a', pants2: '#33467a', band: '#e2453a', belt: '#8a5a2c' },
      chestMark: '#f3e6c4',
      tails: [{ at: 'head', n: 5, len: 54, w: 11, color: 'hair', layer: 'back' }, { at: 'band', n: 4, len: 34, w: 5, color: 'band', layer: 'back' }],
    },
    specials: {
      a: { name: 'Onda', keys: [[0, 'idle'], [8, mod('idle', { t: -6, hf: [-10, 10], hb: [-16, 6] })], [12, mod('idle', { t: 14, hip: [6, 104], hf: [84, -2], hb: [80, 6] })], [30, mod('idle', { t: 12, hf: [80, -2], hb: [76, 6] })], [40, 'idle']],
           frames: 40, proj: { f: 12, kind: 'wave', vx: 8.5, dmg: 85, w: 60, h: 80, y: 118, stun: 20, bstun: 16, push: 6 }, snd: 'water' },
      b: { name: 'Remoinho', keys: [[0, 'crouch'], [3, mod('crouch', { hf: [20, 30] })], [8, mod('idle', { t: -8, hf: [26, 86], hb: [10, -20], ff: [20, -80], fb: [-20, -96] })], [22, mod('tuck', { hf: [26, 70] })], [44, 'tuck']],
           frames: 44, vel: { 3: [2.5, 14] }, active: [3, 16], invuln: [0, 7], air: true, landRecovery: 14, rehit: 6, maxHits: 2,
           hit: { pt: 'hf', r: 30, dmg: 60, stun: 24, bstun: 18, push: 3, lvl: 'mid', launch: [2, 11] }, snd: 'water' },
      super: { name: 'TSUNAMI', keys: [[0, 'crouch'], [20, mod('idle', { t: -14, hf: [10, 84], hb: [0, 86] })], [34, mod('idle', { t: 20, hip: [8, 100], hf: [86, 0], hb: [82, 8] })], [70, 'idle']],
           frames: 70, proj: { f: 34, kind: 'tsunami', vx: 9, dmg: 60, w: 150, h: 230, y: 115, stun: 22, bstun: 18, push: 4, hits: 5, rehit: 7 }, snd: 'water' },
    },
  },
  {
    id: 'basalto', name: 'Bruno "Basalto"', short: 'BASALTO', from: 'Pico, Açores',
    bio: 'Calceteiro gigante, duro como a pedra vulcânica da sua ilha. Lento, mas cada golpe conta.',
    color: '#d0742c',
    hp: 1150, walk: 2.9, back: 2.4, jump: 14, dmg: 1.25, speed: 0.88,
    look: {
      id: 'basalto', size: 1.1, hair: 'bald', beard: true, top: 'vest', sleeves: 'none', pants: 'long', shoes: 'boots', wraps: true,
      build: { limb: 1.22, chest: 1.3, waist: 1.25, arm: 1.12, neck: 1.4 },
      colors: { skin: '#b97a52', hair: '#3b2416', top: '#3d3f45', pants: '#6a4a2e', shoes: '#2b1d14', wraps: '#d8cdb4', belt: '#1c1c1c' },
      tails: [],
    },
    specials: {
      a: { name: 'Terramoto', keys: [[0, 'idle'], [12, mod('idle', { t: -10, hip: [0, 112], hf: [8, 84], hb: [-2, 84] })], [17, mod('crouch', { t: 46, hip: [4, 56], hf: [70, -66], hb: [60, -64] })], [44, mod('crouch', { t: 40, hf: [64, -60], hb: [56, -60] })], [52, 'idle']],
           frames: 52, proj: { f: 17, kind: 'quake', vx: 7, dmg: 95, w: 70, h: 46, y: 22, stun: 22, bstun: 16, push: 6, lvl: 'low' }, shake: { f: 17, amt: 9 }, snd: 'quake' },
      b: { name: 'Avalanche', keys: [[0, 'idle'], [8, mod('idle', { t: 36, hip: [-6, 96], hf: [24, -30], hb: [10, -34] })], [12, mod('idle', { t: 42, hip: [10, 94], hf: [34, -26], hb: [16, -30], ff: [36, -94], fb: [-44, -86] })], [30, mod('idle', { t: 42, hip: [10, 94], hf: [34, -26], hb: [16, -30], ff: [36, -94], fb: [-44, -86] })], [46, 'idle']],
           frames: 46, vel: { 10: [10, 0], 30: [0, 0] }, active: [11, 29], armor: [3, 26],
           hit: { pt: 'neck', r: 34, off: [16, -14], dmg: 105, stun: 22, bstun: 18, push: 10, lvl: 'mid', knock: true }, snd: 'whoosh2' },
      super: { name: 'VULCÃO', keys: [[0, 'idle'], [18, mod('idle', { t: -14, hf: [6, 84], hb: [-4, 84] })], [26, mod('crouch', { t: 50, hip: [4, 52], hf: [70, -66], hb: [60, -62] })], [80, mod('crouch', { t: 44, hf: [64, -60], hb: [58, -60] })], [92, 'idle']],
           frames: 92, proj: { f: 26, kind: 'volcano', vx: 0, dmg: 75, w: 90, h: 260, y: 0, stun: 26, bstun: 18, push: 3, hits: 3, rehit: 9, launch: [1, 10] }, shake: { f: 26, amt: 14 }, snd: 'quake' },
    },
  },
  {
    id: 'lua', name: 'Leonor "Lua"', short: 'LUA', from: 'Mindelo, Cabo Verde · Lisboa',
    bio: 'Acrobata de circo com saltos impossíveis. Ataca do ar quando menos se espera.',
    color: '#a46be0',
    hp: 950, walk: 4.0, back: 3.3, jump: 16.5, dmg: 0.95, speed: 1.05,
    look: {
      id: 'lua', size: 1.03, hair: 'bob', top: 'suit', sleeves: 'long', pants: 'long', shoes: '#e9e3f2',
      build: { limb: 0.9, chest: 0.88, waist: 0.82 },
      colors: { skin: '#7a4b33', hair: '#e8e4ee', top: '#6a3fb0', pants: '#4a2a86', shoes: '#e9e3f2', belt: '#d9b84a', sash: '#d9b84a' },
      chestMark: '#e9d38a',
      tails: [{ at: 'waist', n: 5, len: 62, w: 7, color: 'sash', layer: 'back' }],
    },
    specials: {
      a: { name: 'Voo da Garça', keys: [[0, 'crouch'], [6, mod('crouch', { hip: [0, 54] })], [10, mod('jump', { t: -10, hf: [16, 20], hb: [-6, 14], ff: [86, -60], fb: [-16, -60] })]],
           frames: 90, vel: { 6: [8.5, 10] }, active: [10, 60], air: true, landRecovery: 12,
           hit: { pt: 'ff', r: 26, dmg: 85, stun: 22, bstun: 16, push: 7, lvl: 'high' }, snd: 'whoosh2' },
      b: { name: 'Crescente', keys: [[0, 'crouch'], [4, mod('crouch', { rot: 0 })], [10, mod('tuck', { rot: -120, ff: [70, 60], fb: [0, -60] })], [18, mod('tuck', { rot: -250, ff: [60, 40] })], [26, mod('tuck', { rot: -360 })], [50, mod('tuck', { rot: -360 })]],
           frames: 50, vel: { 4: [-1.5, 14.5] }, active: [6, 18], invuln: [0, 8], air: true, landRecovery: 14,
           hit: { pt: 'ff', r: 30, dmg: 95, stun: 24, bstun: 18, push: 4, lvl: 'mid', launch: [3, 12] }, snd: 'whoosh2' },
      super: { name: 'ECLIPSE', keys: [[0, 'crouch'], [16, mod('crouch', { hip: [0, 52] })], [20, kickX], [28, jabX], [36, kickX], [44, mod('idle', { t: -10, ff: [80, 40], fb: [-10, -100] })], [52, kickX], [60, mod('idle', { hf: [20, 86] })], [80, 'idle']],
           frames: 80, vel: { 16: [13, 0], 24: [4, 0], 60: [0, 0] }, active: [18, 62], rehit: 8, maxHits: 6,
           hit: { pt: 'ff', r: 34, dmg: 55, stun: 26, bstun: 14, push: 2, lvl: 'mid', lastLaunch: [4, 12] }, snd: 'whoosh2' },
    },
  },
  {
    id: 'trovao', name: 'Tomás "Trovão"', short: 'TROVÃO', from: 'Alfama, Lisboa',
    bio: 'Pugilista de bairro com punhos elétricos. Golpes curtos, rápidos e cheios de faíscas.',
    color: '#f0c419',
    hp: 1000, walk: 3.7, back: 3.0, jump: 15, dmg: 1.05, speed: 1.08,
    look: {
      id: 'trovao', size: 1.02, hair: 'curly', top: 'tee', sleeves: 'short', pants: 'shorts', shoes: '#c8302c', gloves: true,
      build: { limb: 1.02, chest: 1.08, waist: 0.98, arm: 1.05 },
      colors: { skin: '#e2b08c', hair: '#3a2214', top: '#f2efe6', pants: '#1d1d24', shoes: '#c8302c', gloves: '#f0c419', cuff: '#c8302c', stripe: '#f0c419', belt: '#f0c419' },
      tails: [],
    },
    specials: {
      a: { name: 'Relâmpago', keys: [[0, 'idle'], [5, mod('idle', { t: 4, hip: [-8, 104], hf: [-4, -6] })], [8, mod('idle', { t: 22, hip: [10, 102], hf: [88, 6], hb: [10, -20], ff: [40, -102], fb: [-46, -92] })], [24, mod('idle', { t: 22, hip: [10, 102], hf: [88, 6], hb: [10, -20], ff: [40, -102], fb: [-46, -92] })], [36, 'idle']],
           frames: 36, vel: { 6: [13, 0], 20: [0, 0] }, active: [7, 20], spark: true,
           hit: { pt: 'hf', r: 24, dmg: 90, stun: 22, bstun: 16, push: 9, lvl: 'mid' }, snd: 'zap' },
      b: { name: 'Trovoada', keys: [[0, 'crouch'], [4, mod('crouch', { hf: [30, -20] })], [9, mod('idle', { t: -6, hf: [24, 88], hb: [10, -24], ff: [24, -86], fb: [-24, -98] })], [24, mod('tuck', { hf: [24, 74] })], [44, 'tuck']],
           frames: 44, vel: { 4: [3, 13] }, active: [4, 16], invuln: [0, 6], air: true, landRecovery: 14, rehit: 5, maxHits: 3, spark: true,
           hit: { pt: 'hf', r: 28, dmg: 42, stun: 24, bstun: 16, push: 2, lvl: 'mid', launch: [2, 10] }, snd: 'zap' },
      super: { name: 'TEMPESTADE', keys: [[0, 'idle'], [14, mod('idle', { hip: [-6, 100], hf: [-6, -6], t: 2 })], [18, jabX], [22, mod('idle', { t: 18, hb: [84, 10], hf: [16, -10] })], [26, jabX], [30, mod('idle', { t: 18, hb: [84, 10], hf: [16, -10] })], [34, jabX], [38, mod('idle', { t: 18, hb: [84, 10], hf: [16, -10] })], [46, mod('idle', { t: -8, hf: [24, 88] })], [76, 'idle']],
           frames: 76, vel: { 14: [12, 0], 22: [3, 0], 46: [0, 0] }, active: [16, 48], rehit: 5, maxHits: 7, spark: true,
           hit: { pt: 'hf', r: 34, dmg: 40, stun: 26, bstun: 12, push: 1, lvl: 'mid', lastLaunch: [3, 13] }, snd: 'zap' },
    },
  },
];

export const byId = (id) => ROSTER.find((r) => r.id === id) || ROSTER[0];

// Resolve um quadro de animação: keys = [[frame, pose|nome], ...]
export function poseAt(keys, frame) {
  const get = (p) => (typeof p === 'string' ? P[p] : p);
  if (frame <= keys[0][0]) return get(keys[0][1]);
  for (let i = 1; i < keys.length; i++) {
    if (frame <= keys[i][0]) {
      const [f0, p0] = keys[i - 1], [f1, p1] = keys[i];
      const k = (frame - f0) / Math.max(1, f1 - f0);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // ease in-out
      return lerp(get(p0), get(p1), e);
    }
  }
  return get(keys[keys.length - 1][1]);
}
import { lerpPose as lerp } from './desenho.js';
