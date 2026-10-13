'use strict';
// delivery missions

const Mission = {
  state: 'wait',          // wait | pickup | deliver
  waitTimer: 2.5,
  pickup: null, dropoff: null,
  timeLeft: 0, reward: 0,

  update(dt) {
    if (this.state === 'wait') {
      this.waitTimer -= dt;
      if (this.waitTimer <= 0) this.spawn();
      return;
    }
    const fx = Player.fx(), fy = Player.fy();
    if (this.state === 'pickup' && this.pickup) {
      if (dist2(fx, fy, this.pickup.x, this.pickup.y) < 55 * 55) {
        this.state = 'deliver';
        const d = distp(this.pickup.x, this.pickup.y, this.dropoff.x, this.dropoff.y);
        this.timeLeft = 10 + d / 110;
        this.reward = Math.round((40 + d / 25) / 5) * 5;
        toast('Package picked up — deliver it!', '#ffd166');
      }
    } else if (this.state === 'deliver') {
      this.timeLeft -= dt;
      if (dist2(fx, fy, this.dropoff.x, this.dropoff.y) < 55 * 55) {
        Game.money += this.reward;
        saveMoney();
        toast('DELIVERED  +$' + this.reward, '#7dffc9');
        this.state = 'wait';
        this.waitTimer = 4;
      } else if (this.timeLeft <= 0) {
        toast('Too late — package gone cold', '#ff6b6b');
        this.state = 'wait';
        this.waitTimer = 6;
      }
    }
  },

  spawn() {
    const p = randomRoadPointNear(Player.fx(), Player.fy(), 450, 1100);
    if (!p) { this.waitTimer = 2; return; }
    const q = randomRoadPointNear(p.x, p.y, 800, 1800);
    if (!q) { this.waitTimer = 2; return; }
    this.pickup = p;
    this.dropoff = q;
    this.state = 'pickup';
    toast('New gig: pick up the package', '#28e0ff');
  },

  objectivePoint() {
    if (this.state === 'pickup') return this.pickup;
    if (this.state === 'deliver') return this.dropoff;
    return null;
  },

  text() {
    if (this.state === 'pickup') return 'Pick up the package';
    if (this.state === 'deliver') return 'Deliver the package — ' + Math.ceil(this.timeLeft) + 's';
    return '';
  }
};

function drawMarker(ctx, pt, time, color) {
  const r = 22 + Math.sin(time * 4) * 4;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, 7); ctx.stroke();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
}
