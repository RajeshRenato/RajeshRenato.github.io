'use strict';
// cars (player physics + AI), pedestrians

class Car {
  constructor(x, y, angle, color, kind = 'civ', model) {
    this.x = x; this.y = y; this.angle = angle;
    this.vx = 0; this.vy = 0;
    this.color = color; this.kind = kind;
    this.model = CAR_MODELS[model] ? model : kind === 'police' ? 'police' : 'sedan';
    this.hp = 100; this.wrecked = false;
    this.len = CAR_MODELS[this.model].len; this.wid = CAR_MODELS[this.model].wid;
    this.throttle = 0; this.steer = 0; this.hand = false; this.braking = false;
    this.hasDriver = false;
    this.ai = null;          // {dir, target} for traffic
    this.aiSpeed = 0;        // kinematic speed used by AI cars
    this.panic = 0;
    this.stuck = 0;
    this._px = x; this._py = y;
  }

  get speed() { return Math.hypot(this.vx, this.vy); }

  // full physics, used for the player's car and for
  // driverless cars still rolling after an exit or bump
  physics(dt) {
    const MAX = 330;
    const fx = Math.cos(this.angle), fy = Math.sin(this.angle);
    let f = this.vx * fx + this.vy * fy;
    let latx = this.vx - fx * f, laty = this.vy - fy * f;

    if (!this.wrecked) {
      if (this.throttle > 0 && f < MAX) f += 280 * this.throttle * dt;
      else if (this.throttle < 0) {
        f += (f > 10 ? 550 : 160) * this.throttle * dt;
        if (f < -130) f = -130;
      }
    }
    this.braking = this.throttle < 0 && f > 10;

    f -= f * 0.35 * dt;                                   // drag
    const grip = this.hand ? 1.6 : 6.5;                   // handbrake = drift
    const g = Math.max(0, 1 - grip * dt);
    latx *= g; laty *= g;

    const sr = (this.hand ? 3.3 : 2.5) * clamp(f / MAX, -1, 1);
    this.angle += this.steer * sr * dt;

    const nfx = Math.cos(this.angle), nfy = Math.sin(this.angle);
    this.vx = nfx * f + latx;
    this.vy = nfy * f + laty;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const impact = collideCarWorld(this);
    if (impact > 140) {
      this.damage((impact - 140) * 0.07);
      AudioMan.thud(impact / 800);
      Particles.sparks(this.x, this.y, 3);
    }
  }

  damage(d) {
    if (this.wrecked) return;
    this.hp -= d;
    if (this.hp <= 0) { this.hp = 0; this.wrecked = true; }
  }

  // top-down: the same model as the street view, seen from above
  draw(ctx, time) {
    const m = CAR_MODELS[this.model], L = m.len / 2, W = m.wid / 2;
    const paint = this.wrecked ? '#4a4a4f' : this.color;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    const outline = (secs, inset = 1) => {
      ctx.beginPath();
      secs.forEach(([a, w], i) => (i ? ctx.lineTo(a * L, -w * W * inset) : ctx.moveTo(a * L, -w * W * inset)));
      for (let i = secs.length - 1; i >= 0; i--) ctx.lineTo(secs[i][0] * L, secs[i][1] * W * inset);
      ctx.closePath();
    };
    ctx.lineJoin = 'round';
    // shadow and wheels
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    outline(m.body); ctx.save(); ctx.translate(3, 3); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#121318';
    for (const lo of [-L * m.track * 1.25, L * m.track * 1.25]) for (const s of [-1, 1]) ctx.fillRect(lo - 4.5, s * W - (s > 0 ? 3 : 0) - (s < 0 ? 1 : 0), 9, 4);
    // body, a little lighter down the middle
    const g = ctx.createLinearGradient(0, -W, 0, W);
    g.addColorStop(0, paint); g.addColorStop(0.5, this.wrecked ? paint : shadeHex(paint, 1.18)); g.addColorStop(1, paint);
    ctx.fillStyle = g;
    outline(m.body); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.2; ctx.stroke();
    if (m.bed) { ctx.fillStyle = '#1b1d23'; ctx.fillRect(-L * 0.94, -W * 0.8, L * 0.8, W * 1.6); }
    if (m.stripe && !this.wrecked) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(-L * 0.92, -2.3, L * 1.86, 1.5); ctx.fillRect(-L * 0.92, 0.9, L * 1.86, 1.5); }
    // cabin: glass where it slopes, roof where it's flat
    const cab = m.cabin;
    for (let i = 0; i < cab.length - 1; i++) {
      const [a0, w0, z0] = cab[i], [a1, w1, z1] = cab[i + 1];
      const slope = Math.abs(z1 - z0) / Math.max(0.01, Math.abs(a1 - a0) * L);
      ctx.fillStyle = slope > 0.35 ? 'rgba(14,24,42,0.92)' : this.model === 'police' && !this.wrecked ? '#eef1f5' : shadeHex(paint, 0.92);
      ctx.beginPath();
      ctx.moveTo(a0 * L, -w0 * W); ctx.lineTo(a1 * L, -w1 * W); ctx.lineTo(a1 * L, w1 * W); ctx.lineTo(a0 * L, w0 * W);
      ctx.closePath(); ctx.fill();
    }
    if (m.rails) { ctx.fillStyle = '#16181e'; ctx.fillRect(-L * 0.8, -W * 0.74, L, 1.6); ctx.fillRect(-L * 0.8, W * 0.74 - 1.6, L, 1.6); }
    if (this.kind === 'police' && !this.wrecked) {
      const ph = Math.floor(time * 6) % 2 === 0;
      ctx.fillStyle = ph ? '#ff4356' : '#3b6cff'; ctx.fillRect(-3, -W * 0.62, 6, W * 0.62);
      ctx.fillStyle = ph ? '#3b6cff' : '#ff4356'; ctx.fillRect(-3, 0, 6, W * 0.62);
    }
    // lights
    if (!this.wrecked) {
      ctx.fillStyle = '#fff1c9';
      const fw = m.body[m.body.length - 1][1] * W;
      ctx.fillRect(L - 2.2, -fw * 0.9, 2.2, fw * 0.45); ctx.fillRect(L - 2.2, fw * 0.45, 2.2, fw * 0.45);
    }
    ctx.fillStyle = this.braking ? '#ff2038' : '#8a1626';
    const rw = m.body[0][1] * W * 0.9;
    ctx.fillRect(-L, -rw, 1.8, rw * 2);
    if (this.wrecked) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-L * 0.2, -W * 0.7, L * 0.6, W * 1.4); }
    ctx.restore();
  }
}

// a color made lighter (k > 1) or darker (k < 1)
function shadeHex(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.max(0, Math.min(255, Math.round(v * k)));
  return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
}

function drawHeadlights(ctx, car) {
  if (car.wrecked) return;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,240,180,0.07)';
  for (const side of [-6, 6]) {
    ctx.beginPath();
    ctx.moveTo(car.len / 2 - 2, side);
    ctx.lineTo(car.len / 2 + 85, side - 20);
    ctx.lineTo(car.len / 2 + 85, side + 20);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// traffic AI: lane-following over the road grid

function nextAITarget(car) {
  const tx = Math.floor(car.x / TILE), ty = Math.floor(car.y / TILE);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const cur = car.ai.dir;
  const cands = [];
  for (const [dx, dy] of dirs) {
    if (cur && dx === -cur.x && dy === -cur.y) continue;      // no U-turns
    const nx = tx + dx, ny = ty + dy;
    if (!isRoad(nx, ny)) continue;
    const ld = laneDir(nx, ny);
    if (ld && (ld.x !== dx || ld.y !== dy)) continue;          // stay in lane
    cands.push({ dx, dy, w: (cur && dx === cur.x && dy === cur.y) ? 4 : 1 });
  }
  if (!cands.length) {
    if (cur) {
      const nx = tx - cur.x, ny = ty - cur.y;                  // dead end: turn back
      if (isRoad(nx, ny)) {
        car.ai.dir = { x: -cur.x, y: -cur.y };
        return { x: (nx + 0.5) * TILE, y: (ny + 0.5) * TILE };
      }
    }
    return null;
  }
  let tot = 0;
  for (const c of cands) tot += c.w;
  let r = Math.random() * tot, sel = cands[0];
  for (const c of cands) { r -= c.w; if (r <= 0) { sel = c; break; } }
  car.ai.dir = { x: sel.dx, y: sel.dy };
  return { x: (tx + sel.dx + 0.5) * TILE, y: (ty + sel.dy + 0.5) * TILE };
}

// AI cars use simplified kinematics (reliable cornering); world collision still applies
function aiMove(car, dt, allCars, player) {
  if (car.wrecked) { car.vx = 0; car.vy = 0; return; }
  const ai = car.ai;
  if (!ai.target) { ai.target = nextAITarget(car); if (!ai.target) return; }
  let dx = ai.target.x - car.x, dy = ai.target.y - car.y;
  if (dx * dx + dy * dy < (TILE * 0.3) * (TILE * 0.3)) {
    const t = nextAITarget(car);
    if (!t) return;
    ai.target = t;
    dx = ai.target.x - car.x; dy = ai.target.y - car.y;
  }
  const ta = Math.atan2(dy, dx);
  const ad = angleNorm(ta - car.angle);
  const mt = 3.0 * dt;
  car.angle += clamp(ad, -mt, mt);

  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  const ax = car.x + fx * 52, ay = car.y + fy * 52;
  let blocked = false;
  for (const o of allCars) {
    if (o === car) continue;
    if (dist2(o.x, o.y, ax, ay) < 36 * 36) { blocked = true; break; }
  }
  if (!blocked && !player.inCar && dist2(player.x, player.y, ax, ay) < 30 * 30) blocked = true;
  if (car.panic > 0) { car.panic -= dt; blocked = true; }

  const want = blocked ? 0 : (Math.abs(ad) > 0.5 ? 42 : 118);
  car.aiSpeed += clamp(want - car.aiSpeed, -320 * dt, 95 * dt);
  car.vx = fx * car.aiSpeed;
  car.vy = fy * car.aiSpeed;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  collideCarWorld(car);
  car.braking = blocked && car.aiSpeed > 5;
}

// police pursuit

function policeMove(cop, dt, player) {
  if (cop.wrecked) { cop.vx = 0; cop.vy = 0; return; }
  const tx = player.fx(), ty = player.fy();
  const dx = tx - cop.x, dy = ty - cop.y;
  const d = Math.hypot(dx, dy);
  const ta = Math.atan2(dy, dx);
  const ad = angleNorm(ta - cop.angle);
  const mt = 2.6 * dt;
  cop.angle += clamp(ad, -mt, mt);

  let want;
  if (Math.abs(ad) > 1.6 && d < 160) want = -70;   // back up to turn around
  else if (d > 400) want = 300;
  else if (d > 120) want = 250;
  else want = 170;
  cop.aiSpeed += clamp(want - cop.aiSpeed, -380 * dt, 160 * dt);

  const fx = Math.cos(cop.angle), fy = Math.sin(cop.angle);
  cop.vx = fx * cop.aiSpeed;
  cop.vy = fy * cop.aiSpeed;
  cop.x += cop.vx * dt;
  cop.y += cop.vy * dt;
  collideCarWorld(cop);

  const moved = distp(cop.x, cop.y, cop._px, cop._py);
  if (Math.abs(cop.aiSpeed) > 40 && moved / dt < 30) cop.stuck += dt;
  else cop.stuck = Math.max(0, cop.stuck - dt);
  cop._px = cop.x; cop._py = cop.y;
}

// car vs car (circle approximation)

function collideCars(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d2 = dx * dx + dy * dy, R = 30;
  if (d2 >= R * R || d2 === 0) return 0;
  const d = Math.sqrt(d2);
  const nx = dx / d, ny = dy / d;
  const overlap = R - d;
  a.x -= nx * overlap / 2; a.y -= ny * overlap / 2;
  b.x += nx * overlap / 2; b.y += ny * overlap / 2;
  const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    const j = -vn * 0.6;
    a.vx -= nx * j; a.vy -= ny * j;
    b.vx += nx * j; b.vy += ny * j;
    return -vn;
  }
  return 0;
}

// pedestrians

class Ped {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.state = 'walk';
    this.dir = Math.random() * 7;
    this.walkSpeed = 28 + Math.random() * 20;
    this.timer = 0;
    this.deadTime = 0;
    this.shirt = pick(['#ff8ab0', '#7fd8ff', '#ffe08a', '#9effc0', '#d6a4ff', '#ffffff', '#ffb37f']);
    this.target = null;
  }

  update(dt, cars, player) {
    if (this.state === 'dead') { this.deadTime += dt; return; }
    let threat = null;
    for (const c of cars) {
      if (c.speed > 150 && dist2(c.x, c.y, this.x, this.y) < 160 * 160) { threat = c; break; }
    }
    if (threat) {
      this.state = 'flee';
      this.timer = 1.2;
      this.dir = Math.atan2(this.y - threat.y, this.x - threat.x) + (Math.random() - 0.5);
    } else if (this.state === 'flee') {
      this.timer -= dt;
      if (this.timer <= 0) this.state = 'walk';
    }
    if (this.state === 'walk') {
      if (!this.target || dist2(this.x, this.y, this.target.x, this.target.y) < 16) {
        this.target = this.pickTarget();
      }
      if (this.target) this.dir = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    }
    const sp = this.state === 'flee' ? 110 : this.walkSpeed;
    const nx = this.x + Math.cos(this.dir) * sp * dt;
    const ny = this.y + Math.sin(this.dir) * sp * dt;
    if (!isSolid(Math.floor(nx / TILE), Math.floor(ny / TILE))) { this.x = nx; this.y = ny; }
    else this.target = null;
  }

  pickTarget() {
    const tx = Math.floor(this.x / TILE), ty = Math.floor(this.y / TILE);
    const opts = [];
    for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const t = tileType(tx + d[0], ty + d[1]);
      if (t === T_SIDEWALK || t === T_GRASS || t === T_SAND) opts.push(d);
    }
    if (!opts.length) {
      for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        if (!isSolid(tx + d[0], ty + d[1])) opts.push(d);
    }
    if (!opts.length) return null;
    const d = pick(opts);
    return { x: (tx + d[0] + 0.5) * TILE, y: (ty + d[1] + 0.5) * TILE };
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.dir);
    if (this.state === 'dead') {
      ctx.fillStyle = this.shirt;
      ctx.fillRect(-7, -3, 12, 6);
      ctx.fillStyle = '#d9a06b';
      ctx.beginPath(); ctx.arc(8, 0, 3.4, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(1, 1, 5.5, 0, 7); ctx.fill();
      ctx.fillStyle = this.shirt;
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#d9a06b';
      ctx.beginPath(); ctx.arc(1.5, 0, 3, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
}
