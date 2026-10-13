'use strict';
// sentinel AI: idle until they see the player or hear gunfire, then chase
class Enemy {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.hp = 30;
    this.state = 'idle';       // idle | chase | dead
    this.attackCool = 0;
    this.hitT = 0;             // flash timer when shot
    this.deadT = 0;
    this.bob = Math.random() * 7;
    this.speed = 1.6 + Math.random() * 0.5;
  }

  get alive() { return this.state !== 'dead'; }

  damage(d, game) {
    if (!this.alive) return;
    this.hp -= d;
    this.hitT = 0.12;
    this.state = 'chase';
    if (this.hp <= 0) {
      this.state = 'dead';
      this.deadT = 0;
      game.kills++;
      AudioMan.enemyDie();
    } else {
      AudioMan.hitEnemy();
    }
  }

  update(dt, game) {
    if (!this.alive) { this.deadT += dt; return; }
    const p = game.player;
    this.bob += dt * 4;
    this.hitT = Math.max(0, this.hitT - dt);
    this.attackCool = Math.max(0, this.attackCool - dt);

    const d = Math.hypot(p.x - this.x, p.y - this.y);
    if (this.state === 'idle') {
      if (d < 9 && hasLOS(game.map, this.x, this.y, p.x, p.y)) this.state = 'chase';
      return;
    }
    // chase
    if (d > 1.05) {
      const ux = (p.x - this.x) / d, uy = (p.y - this.y) / d;
      // slight separation from other sentinels
      let sx = 0, sy = 0;
      for (const o of game.enemies) {
        if (o === this || !o.alive) continue;
        const od = Math.hypot(o.x - this.x, o.y - this.y);
        if (od < 0.9 && od > 0.01) { sx += (this.x - o.x) / od; sy += (this.y - o.y) / od; }
      }
      const nx = this.x + (ux + sx * 0.6) * this.speed * dt;
      const ny = this.y + (uy + sy * 0.6) * this.speed * dt;
      const m = tryMove(game.map, this.x, this.y, nx, ny, 0.3);
      this.x = m.x; this.y = m.y;
    } else if (this.attackCool <= 0 && hasLOS(game.map, this.x, this.y, p.x, p.y)) {
      this.attackCool = 1.0;
      game.hurtPlayer(8 + (Math.random() * 7 | 0));
    }
  }

  sprite() {
    if (!this.alive) return { img: Textures.sprites.enemyDead, scale: 0.9, vOff: 0.28 };
    const attacking = this.attackCool > 0.7;
    return {
      img: this.hitT > 0 || attacking ? Textures.sprites.enemyAttack : Textures.sprites.enemy,
      scale: 0.95,
      vOff: 0.05 + Math.sin(this.bob) * 0.02
    };
  }
}

function alertNearby(game, radius) {
  for (const e of game.enemies) {
    if (!e.alive || e.state === 'chase') continue;
    const d = Math.hypot(e.x - game.player.x, e.y - game.player.y);
    if (d < radius && hasLOS(game.map, e.x, e.y, game.player.x, game.player.y)) e.state = 'chase';
  }
}
