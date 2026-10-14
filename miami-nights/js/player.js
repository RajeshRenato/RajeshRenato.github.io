'use strict';
// player, on foot or driving

const Player = {
  x: 0, y: 0, angle: 0,
  inCar: false, car: null,

  fx() { return this.inCar ? this.car.x : this.x; },
  fy() { return this.inCar ? this.car.y : this.y; },

  update(dt) {
    if (this.inCar) {
      const c = this.car;
      c.throttle = (keyDown('w', 'ArrowUp') ? 1 : 0) + (keyDown('s', 'ArrowDown') ? -1 : 0);
      c.steer = (keyDown('d', 'ArrowRight') ? 1 : 0) - (keyDown('a', 'ArrowLeft') ? 1 : 0);
      c.hand = keyDown(' ');
      if (keyPressed('e')) this.exitCar();
    } else {
      // street view: A/D turn, W/S move along facing; top-down: world-relative WASD
      const street = typeof viewMode !== 'undefined' && viewMode === 'street';
      let dx = 0, dy = 0, spMul = 1;
      if (street) {
        const turn = (keyDown('d', 'ArrowRight') ? 1 : 0) - (keyDown('a', 'ArrowLeft') ? 1 : 0);
        this.angle = angleNorm(this.angle + turn * 3.4 * dt);
        const fwd = (keyDown('w', 'ArrowUp') ? 1 : 0) - (keyDown('s', 'ArrowDown') ? 1 : 0);
        if (fwd) {
          dx = Math.cos(this.angle) * Math.sign(fwd);
          dy = Math.sin(this.angle) * Math.sign(fwd);
          spMul = fwd > 0 ? 1 : 0.6;   // backpedal slower, keep facing
        }
      } else {
        dx = (keyDown('d', 'ArrowRight') ? 1 : 0) - (keyDown('a', 'ArrowLeft') ? 1 : 0);
        dy = (keyDown('s', 'ArrowDown') ? 1 : 0) - (keyDown('w', 'ArrowUp') ? 1 : 0);
      }
      if (dx || dy) {
        const l = Math.hypot(dx, dy);
        dx /= l; dy /= l;
        if (!street) this.angle = Math.atan2(dy, dx);
        const sp = (keyDown('Shift') ? 235 : 150) * spMul;
        const p = { x: this.x + dx * sp * dt, y: this.y + dy * sp * dt, vx: 0, vy: 0 };
        circleVsSolid(p, 7, 0);
        this.x = p.x; this.y = p.y;
        // don't walk through cars
        for (const c of Game.activeCars) {
          const d = distp(this.x, this.y, c.x, c.y);
          if (d < 20 && d > 0.01) {
            this.x = c.x + (this.x - c.x) / d * 20;
            this.y = c.y + (this.y - c.y) / d * 20;
          }
        }
      }
      if (keyPressed('e')) this.tryEnterCar();
    }
  },

  tryEnterCar() {
    let best = null, bd = 55 * 55;
    const all = Game.cars.concat(Game.police);
    for (const c of all) {
      const d = dist2(this.x, this.y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    if (!best) return;
    const pi = Game.police.indexOf(best);
    if (pi >= 0) {
      Game.police.splice(pi, 1);
      Game.cars.push(best);
      crime(2);
      toast('You stole a POLICE car?!', '#ff4fa3');
    } else if (best.hasDriver) {
      crime(1);
      toast('Carjacked!', '#ff4fa3');
    }
    best.hasDriver = false;
    best.ai = null;
    best.throttle = 0; best.steer = 0; best.hand = false;
    this.car = best;
    this.inCar = true;
  },

  exitCar() {
    const c = this.car;
    let placed = false;
    for (const s of [-1, 1]) {
      const px = c.x + Math.cos(c.angle + s * Math.PI / 2) * 26;
      const py = c.y + Math.sin(c.angle + s * Math.PI / 2) * 26;
      if (!isSolid(Math.floor(px / TILE), Math.floor(py / TILE))) {
        this.x = px; this.y = py;
        placed = true;
        break;
      }
    }
    if (!placed) { this.x = c.x; this.y = c.y - 30; }
    this.angle = c.angle;          // inherit the car's heading so the camera stays put
    c.throttle = 0; c.steer = 0; c.hand = false;
    this.inCar = false;
    this.car = null;
  },

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.arc(1, 1, 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#f2ecdf';
    ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff6fb0';
    ctx.fillRect(-2, -3, 4, 6);
    ctx.fillStyle = '#e0b08a';
    ctx.beginPath(); ctx.arc(2, 0, 3.6, 0, 7); ctx.fill();
    ctx.restore();
  }
};
