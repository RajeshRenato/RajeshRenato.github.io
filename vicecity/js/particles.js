'use strict';
// sparks + persistent stains

const Particles = {
  list: [],
  stains: [],

  sparks(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.list.push({
        x, y,
        vx: randRange(-120, 120), vy: randRange(-120, 120),
        life: randRange(0.2, 0.45),
        c: pick(['#ffd166', '#ffb15c', '#fff2b0']),
        r: randRange(1.5, 3)
      });
    }
  },

  stain(x, y) {
    this.stains.push({ x, y, r: randRange(10, 16), a: Math.random() * Math.PI });
    if (this.stains.length > 80) this.stains.shift();
  },

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.9; p.vy *= 0.9;
    }
  },

  drawStains(ctx) {
    for (const s of this.stains) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.a);
      ctx.fillStyle = 'rgba(110,12,28,0.5)';
      ctx.beginPath(); ctx.ellipse(0, 0, s.r, s.r * 0.7, 0, 0, 7); ctx.fill();
      ctx.restore();
    }
  },

  draw(ctx) {
    for (const p of this.list) {
      ctx.globalAlpha = clamp(p.life * 3, 0, 1);
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
    }
    ctx.globalAlpha = 1;
  }
};
