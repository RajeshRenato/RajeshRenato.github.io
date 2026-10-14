'use strict';
// WebAudio: engine hum and collision thuds

const AudioMan = {
  ctx: null, engine: null, engineGain: null, muted: false, lastThud: 0,

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 70;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 480;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      osc.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
      osc.start();
      this.engine = osc;
      this.engineGain = gain;
    } catch (e) { /* audio is optional */ }
  },

  setEngine(on, speedRatio) {
    if (!this.ctx) return;
    const target = (on && !this.muted) ? 0.035 + speedRatio * 0.03 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engine.frequency.setTargetAtTime(65 + speedRatio * 180, this.ctx.currentTime, 0.05);
  },

  thud(strength) {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    if (now - this.lastThud < 90) return;
    this.lastThud = now;
    const dur = 0.12, sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, (sr * dur) | 0, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = Math.min(0.25, strength);
    src.connect(g); g.connect(this.ctx.destination);
    src.start();
  }
};
