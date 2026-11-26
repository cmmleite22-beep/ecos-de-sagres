// Som sintetizado com Web Audio (sem ficheiros): efeitos e ambiente de selva.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
    this.ambient();
    return true;
  }
  tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0 } = {}) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, { vol = 0.3, freq = 400, q = 1, delay = 0 } = {}) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master); src.start(t);
  }
  play(name) {
    switch (name) {
      case 'jump': this.tone(320, 0.15, { type: 'triangle', vol: 0.12, slide: 200 }); break;
      case 'land': this.noise(0.08, { vol: 0.15, freq: 300 }); break;
      case 'relic': [880, 1175, 1568].forEach((f, i) => this.tone(f, 0.25, { vol: 0.15, delay: i * 0.07 })); break;
      case 'hurt': this.tone(180, 0.3, { type: 'sawtooth', vol: 0.15, slide: -120 }); break;
      case 'die': this.tone(260, 0.7, { type: 'sawtooth', vol: 0.15, slide: -220 }); break;
      case 'gate': this.noise(2.2, { vol: 0.4, freq: 120 }); this.tone(55, 2, { type: 'sawtooth', vol: 0.1 }); break;
      case 'rumble': this.noise(4, { vol: 0.6, freq: 90, q: 3 }); break;
      case 'join': this.tone(660, 0.12, { vol: 0.15 }); this.tone(990, 0.2, { vol: 0.15, delay: 0.1 }); break;
      case 'checkpoint': this.tone(523, 0.2, { vol: 0.1 }); this.tone(784, 0.3, { vol: 0.1, delay: 0.12 }); break;
      case 'shot': this.noise(0.12, { vol: 0.35, freq: 2200 }); this.tone(140, 0.1, { type: 'square', vol: 0.12, slide: -80 }); break;
      case 'enemyShot': this.noise(0.1, { vol: 0.18, freq: 1400 }); break;
      case 'enemyDown': this.tone(200, 0.4, { type: 'triangle', vol: 0.12, slide: -140 }); break;
      case 'win': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, 0.4, { type: 'triangle', vol: 0.15, delay: i * 0.15 })); break;
    }
  }
  ambient() {
    // vento/selva + pássaros aleatórios
    const loop = () => {
      if (!this.ctx) return;
      this.noise(3.2, { vol: 0.035, freq: 700, q: 0.5 });
      if (Math.random() < 0.7) {
        const base = 1800 + Math.random() * 1600;
        for (let i = 0; i < 2 + Math.random() * 3; i++) this.tone(base, 0.09, { vol: 0.025, slide: 500, delay: 0.4 + i * 0.13 });
      }
      setTimeout(loop, 3000);
    };
    loop();
  }
}
