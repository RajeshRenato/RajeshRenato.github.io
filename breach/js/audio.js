'use strict';
// synthesized sound effects; no audio files
const AudioMan = {
  ctx: null, muted: false,

  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }
  },

  tone(freq, endFreq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.05);
  },

  noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, (sr * dur) | 0, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1200;
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.15;
    s.connect(f); f.connect(g); g.connect(this.ctx.destination);
    s.start();
  },

  shoot() { this.tone(900, 110, 0.14, 'sawtooth', 0.1); this.noise(0.07, 0.07, 4000); },
  empty() { this.tone(300, 240, 0.06, 'square', 0.06); },
  hitEnemy() { this.tone(500, 180, 0.1, 'square', 0.09); },
  enemyDie() { this.tone(260, 40, 0.5, 'sawtooth', 0.13); this.noise(0.3, 0.12, 900); },
  hurt() { this.tone(140, 60, 0.25, 'triangle', 0.18); this.noise(0.15, 0.1, 500); },
  pickup() { this.tone(660, 1320, 0.15, 'sine', 0.12); },
  door() { this.noise(0.4, 0.1, 700); this.tone(120, 90, 0.35, 'triangle', 0.07); },
  denied() { this.tone(220, 180, 0.12, 'square', 0.08); this.tone(180, 150, 0.12, 'square', 0.08); },
  exitSnd() { [440, 554, 659, 880].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.18, 'sine', 0.1), i * 110)); },
};
