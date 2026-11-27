// Sons curtos feitos na hora (sem ficheiros): leves para a TV.
export class Som {
  constructor() {
    this.ac = null;
    const unlock = () => { this.ctx()?.resume?.(); };
    addEventListener('pointerdown', unlock, { once: true });
    addEventListener('keydown', unlock, { once: true });
  }
  ctx() {
    if (!this.ac) { try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    return this.ac;
  }
  tone(freq, t0, dur, type = 'sine', vol = 0.18) {
    const ac = this.ctx(); if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    const t = ac.currentTime + t0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  play(name) {
    switch (name) {
      case 'join': this.tone(660, 0, 0.12, 'triangle'); this.tone(990, 0.08, 0.16, 'triangle'); break;
      case 'turn': [523, 659, 784].forEach((f, i) => this.tone(f, i * 0.09, 0.2, 'triangle')); break;
      case 'right': this.tone(880, 0, 0.12, 'sine', 0.22); this.tone(1320, 0.1, 0.25, 'sine', 0.22); break;
      case 'close': this.tone(440, 0, 0.1, 'square', 0.06); break;
      case 'guess': this.tone(300, 0, 0.05, 'triangle', 0.05); break;
      case 'tick': this.tone(1200, 0, 0.04, 'square', 0.05); break;
      case 'hint': this.tone(740, 0, 0.1, 'sine', 0.1); break;
      case 'end': [392, 330, 262].forEach((f, i) => this.tone(f, i * 0.12, 0.22, 'triangle', 0.14)); break;
      case 'win': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, i * 0.12, 0.25, 'triangle', 0.16)); break;
      case 'pop': this.tone(600 + Math.random() * 400, 0, 0.08, 'sine', 0.08); break;
    }
  }
}
