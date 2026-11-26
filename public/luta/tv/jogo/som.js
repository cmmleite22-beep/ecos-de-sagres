// Som sintetizado com Web Audio (sem ficheiros): golpes, especiais e música original por cenário.
export class Som {
  constructor() { this.ctx = null; this.master = null; this.musicOn = false; this.noiseBuf = null; }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { this.ctx = new AC(); } catch { return false; }
    this.master = this.ctx.createGain(); this.master.gain.value = 0.55; this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0.32; this.musicBus.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0, bus } = {}) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(bus || this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, { vol = 0.3, freq = 800, q = 1, type = 'lowpass', delay = 0, bus } = {}) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(bus || this.master); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }
  play(name) {
    switch (name) {
      case 'whoosh1': this.noise(0.12, { vol: 0.12, freq: 1800, type: 'bandpass', q: 0.8 }); break;
      case 'whoosh2': this.noise(0.2, { vol: 0.16, freq: 1100, type: 'bandpass', q: 0.7 }); break;
      case 'hit': this.noise(0.1, { vol: 0.5, freq: 1600 }); this.tone(150, 0.12, { type: 'square', vol: 0.22, slide: -90 }); break;
      case 'hitBig': this.noise(0.22, { vol: 0.65, freq: 1000 }); this.tone(110, 0.25, { type: 'square', vol: 0.3, slide: -70 }); this.tone(60, 0.3, { vol: 0.4 }); break;
      case 'block': this.noise(0.07, { vol: 0.35, freq: 3500, type: 'highpass' }); this.tone(900, 0.06, { type: 'triangle', vol: 0.12 }); break;
      case 'jump': this.noise(0.08, { vol: 0.08, freq: 600 }); break;
      case 'land': this.noise(0.06, { vol: 0.12, freq: 300 }); break;
      case 'thud': this.tone(70, 0.3, { vol: 0.5, slide: -30 }); this.noise(0.25, { vol: 0.35, freq: 400 }); break;
      case 'water': this.noise(0.5, { vol: 0.25, freq: 900, type: 'bandpass', q: 0.6 }); this.tone(500, 0.4, { vol: 0.08, slide: -300 }); break;
      case 'quake': this.noise(0.8, { vol: 0.6, freq: 160, q: 2 }); this.tone(48, 0.7, { type: 'sawtooth', vol: 0.18 }); break;
      case 'zap': this.tone(1400, 0.15, { type: 'sawtooth', vol: 0.12, slide: -1100 }); this.noise(0.12, { vol: 0.2, freq: 5000, type: 'highpass' }); break;
      case 'super': [262, 392, 523, 784].forEach((f, i) => this.tone(f, 0.5, { type: 'sawtooth', vol: 0.1, delay: i * 0.05 })); this.noise(0.6, { vol: 0.25, freq: 2500, type: 'bandpass' }); break;
      case 'ko': this.tone(220, 1.2, { type: 'sawtooth', vol: 0.2, slide: -170 }); this.noise(0.9, { vol: 0.4, freq: 500 }); break;
      case 'bell': [880, 1320].forEach((f, i) => this.tone(f, 1.4, { type: 'triangle', vol: 0.18, delay: i * 0.02 })); break;
      case 'fight': this.tone(330, 0.15, { type: 'square', vol: 0.15 }); this.tone(660, 0.4, { type: 'square', vol: 0.15, delay: 0.12 }); break;
      case 'select': this.tone(880, 0.08, { type: 'triangle', vol: 0.12 }); break;
      case 'join': this.tone(660, 0.1, { vol: 0.15 }); this.tone(990, 0.18, { vol: 0.15, delay: 0.09 }); break;
      case 'win': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.14, delay: i * 0.13 })); break;
    }
  }

  // ---------------- música: sequenciador simples (bateria, baixo, melodia) ----------------
  music(which) {
    if (!this.ensure()) return;
    this.track = SONGS[which % SONGS.length];
    this.step = 0;
    this.nextT = this.ctx.currentTime + 0.1;
    if (this.timer) return;
    this.timer = setInterval(() => this.schedule(), 50);
  }
  stopMusic() { clearInterval(this.timer); this.timer = null; }
  schedule() {
    const T = this.track; if (!T || !this.ctx) return;
    const stepDur = 60 / T.bpm / 4;
    while (this.nextT < this.ctx.currentTime + 0.2) {
      const s = this.step % 64, d = this.nextT - this.ctx.currentTime;
      const bar = Math.floor(s / 16), i = s % 16;
      const B = this.musicBus;
      if (T.kick[i] === 'x') { this.tone(110, 0.18, { vol: 0.5, slide: -70, delay: d, bus: B }); }
      if (T.snare[i] === 'x') this.noise(0.14, { vol: 0.28, freq: 2200, type: 'bandpass', q: 0.6, delay: d, bus: B });
      if (T.hat[i] === 'x') this.noise(0.04, { vol: 0.08, freq: 7000, type: 'highpass', delay: d, bus: B });
      const root = T.prog[bar];
      const bn = T.bass[i];
      if (bn !== '.') this.tone(midi(root + (+bn === 0 ? 0 : T.scale[+bn % T.scale.length]) - 24), stepDur * 1.8, { type: 'triangle', vol: 0.32, delay: d, bus: B });
      const ln = T.lead[(bar % 2) * 16 + i];
      if (ln !== '.') this.tone(midi(root + T.scale[parseInt(ln, 36) % T.scale.length] + (parseInt(ln, 36) >= T.scale.length ? 12 : 0)), stepDur * 1.6, { type: T.leadType, vol: 0.08, delay: d, bus: B });
      this.nextT += stepDur; this.step++;
    }
  }
}
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
// Temas originais (escalas modais, padrões de 16 passos)
const SONGS = [
  { bpm: 132, leadType: 'square', scale: [0, 2, 3, 5, 7, 8, 10], prog: [57, 53, 55, 52],
    kick: 'x...x...x...x.x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xx',
    bass: '0.0.4.0.0.3.4.0.', lead: '0.2.3.4...3.2.0.4.4.6.7...6.4.3.' },
  { bpm: 120, leadType: 'triangle', scale: [0, 2, 4, 7, 9], prog: [60, 57, 53, 55],
    kick: 'x.....x.x.......', snare: '....x.......x..x', hat: '..x...x...x...x.',
    bass: '0...2.0...3.4...', lead: '4.3.2...0.2.3...5.4.2.0...2.4...' },
  { bpm: 140, leadType: 'sawtooth', scale: [0, 1, 4, 5, 7, 8, 10], prog: [52, 52, 53, 52],
    kick: 'x..x..x...x..x..', snare: '....x.......x...', hat: 'xxx.xxx.xxx.xxx.',
    bass: '0.0..0.1.0..4.3.', lead: '0..1.2.3..2.1.0.4..5.4.2..1.2..' },
];
