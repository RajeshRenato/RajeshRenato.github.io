'use strict';
const Player = {
  x: 1.5, y: 1.5, a: 0,
  hp: 100, ammo: 24, hasKey: false,
  fireCool: 0, fireAnim: 0, walkT: 0, hurtT: 0,

  reset(start) {
    this.x = start.x; this.y = start.y; this.a = start.a;
    this.hp = 100; this.ammo = 24; this.hasKey = false;
    this.fireCool = 0; this.fireAnim = 0; this.hurtT = 0;
  },

  update(dt, game) {
    // look
    this.a += Input.mouseDX * 0.0022;
    if (keyDown('ArrowLeft')) this.a -= 2.6 * dt;
    if (keyDown('ArrowRight')) this.a += 2.6 * dt;
    this.a = angleNorm(this.a);

    // move
    const run = keyDown('Shift') ? 1.5 : 1;
    const sp = 3.1 * run;
    const dirX = Math.cos(this.a), dirY = Math.sin(this.a);
    let mx = 0, my = 0;
    if (keyDown('w', 'ArrowUp')) { mx += dirX; my += dirY; }
    if (keyDown('s', 'ArrowDown')) { mx -= dirX; my -= dirY; }
    if (keyDown('a')) { mx += dirY; my -= dirX; }
    if (keyDown('d')) { mx -= dirY; my += dirX; }
    const ml = Math.hypot(mx, my);
    if (ml > 0.01) {
      this.walkT += dt * 9 * run;
      const m = tryMove(game.map, this.x, this.y, this.x + mx / ml * sp * dt, this.y + my / ml * sp * dt, 0.25);
      this.x = m.x; this.y = m.y;
    }

    // use door
    if (keyPressed('e', ' ')) this.useDoor(game);

    // fire
    this.fireCool = Math.max(0, this.fireCool - dt);
    this.fireAnim = Math.max(0, this.fireAnim - dt * 4);
    this.hurtT = Math.max(0, this.hurtT - dt);
    if ((Input.fired || keyDown('Control') || keyDown('f')) && this.fireCool <= 0) this.shoot(game);

    // pickups
    for (let i = game.items.length - 1; i >= 0; i--) {
      const it = game.items[i];
      if (dist2(this.x, this.y, it.x, it.y) > 0.36) continue;
      if (it.type === 'health') {
        if (this.hp >= 100) continue;
        this.hp = Math.min(100, this.hp + 25);
        game.message('medkit +25');
      } else if (it.type === 'ammo') {
        this.ammo += 12;
        game.message('energy cells +12');
      } else if (it.type === 'key') {
        this.hasKey = true;
        game.message('RED KEYCARD acquired');
      }
      AudioMan.pickup();
      game.items.splice(i, 1);
    }

    // exit
    if (game.exit && dist2(this.x, this.y, game.exit.x, game.exit.y) < 0.3) game.levelComplete();
  },

  useDoor(game) {
    const tx = Math.floor(this.x + Math.cos(this.a) * 1.0);
    const ty = Math.floor(this.y + Math.sin(this.a) * 1.0);
    if (tileAt(game.map, tx, ty) !== 5) return;
    if (this.hasKey) {
      game.map.grid[ty][tx] = 0;
      AudioMan.door();
      game.message('door unlocked');
    } else {
      AudioMan.denied();
      game.message('this door needs the RED KEYCARD');
    }
  },

  shoot(game) {
    if (this.ammo <= 0) {
      AudioMan.empty();
      this.fireCool = 0.3;
      game.message('out of cells — find ammo');
      return;
    }
    this.ammo--;
    this.fireCool = 0.34;
    this.fireAnim = 1;
    AudioMan.shoot();
    alertNearby(game, 11);

    // hitscan: nearest alive enemy within a narrow cone and not behind a wall
    const wall = castRay(game.map, this.x, this.y, Math.cos(this.a), Math.sin(this.a));
    let best = null, bestD = Infinity;
    for (const e of game.enemies) {
      if (!e.alive) continue;
      const dx = e.x - this.x, dy = e.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d > bestD || d > wall.dist + 0.3) continue;
      const diff = Math.abs(angleNorm(Math.atan2(dy, dx) - this.a));
      if (diff < 0.11 && hasLOS(game.map, this.x, this.y, e.x, e.y)) { best = e; bestD = d; }
    }
    if (best) best.damage(12 + (Math.random() * 7 | 0), game);
  },

  takeDamage(d) {
    this.hp = Math.max(0, this.hp - d);
    this.hurtT = 0.5;
    AudioMan.hurt();
  }
};
