'use strict';
// game state, spawning, update loop, render loop

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0;
function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

const cam = { x: 0, y: 0 };

const Game = {
  state: 'menu',
  money: parseInt((typeof localStorage !== 'undefined' && localStorage.getItem('vc_money')) || '0', 10) || 0,
  wanted: 0, wantedTimer: 0,
  bustProgress: 0, bustedTimer: 0,
  cars: [], police: [], peds: [], activeCars: [],
  toasts: [],
  time: 0
};

const spawnPoint = { x: 44.5 * TILE, y: 39.5 * TILE };

function crime(n) {
  if (typeof Online !== 'undefined' && Online.active) return;
  Game.wanted = Math.min(5, Game.wanted + n);
  Game.wantedTimer = 0;
}

function saveMoney() {
  try { localStorage.setItem('vc_money', String(Game.money)); } catch (e) { }
}

// spawn helpers

function randomRoadTileNear(px, py, rmin, rmax) {
  for (let i = 0; i < 80; i++) {
    const a = Math.random() * Math.PI * 2, r = randRange(rmin, rmax);
    const tx = Math.floor((px + Math.cos(a) * r) / TILE);
    const ty = Math.floor((py + Math.sin(a) * r) / TILE);
    const d = laneDir(tx, ty);
    if (d) return { tx, ty, dir: d };
  }
  return null;
}

function randomTileNear(px, py, rmin, rmax, pred) {
  for (let i = 0; i < 80; i++) {
    const a = Math.random() * Math.PI * 2, r = randRange(rmin, rmax);
    const tx = Math.floor((px + Math.cos(a) * r) / TILE);
    const ty = Math.floor((py + Math.sin(a) * r) / TILE);
    if (pred(tileType(tx, ty))) return { tx, ty };
  }
  return null;
}

function randomRoadPointNear(px, py, rmin, rmax) {
  const t = randomRoadTileNear(px, py, rmin, rmax);
  return t ? { x: (t.tx + 0.5) * TILE, y: (t.ty + 0.5) * TILE } : null;
}

function randomParkSpot() {
  for (let i = 0; i < 60; i++) {
    const t = randomRoadTileNear(Player.x, Player.y, 200, 2200);
    if (!t) continue;
    const p = { x: -t.dir.y, y: t.dir.x };
    for (const s of [1, -1]) {
      if (tileType(t.tx + p.x * s, t.ty + p.y * s) === T_SIDEWALK) {
        return {
          x: (t.tx + 0.5 + p.x * s * 0.26) * TILE,
          y: (t.ty + 0.5 + p.y * s * 0.26) * TILE,
          angle: Math.atan2(t.dir.y, t.dir.x)
        };
      }
    }
  }
  return null;
}

function initGame() {
  buildMinimap();
  Player.x = spawnPoint.x;
  Player.y = spawnPoint.y;
  cam.x = spawnPoint.x - W / 2;
  cam.y = spawnPoint.y - H / 2;

  // starter car beside the spawn point
  const starter = new Car(44.5 * TILE, 40.5 * TILE, Math.PI, '#ff6fb0', 'civ', 'sports');
  Game.cars.push(starter);

  for (let i = 0; i < 26; i++) {
    const s = randomParkSpot();
    if (s) Game.cars.push(new Car(s.x, s.y, s.angle, pick(MODEL_PAINT), 'civ', pickTrafficModel(Math.random())));
  }
  for (let i = 0; i < 34; i++) {
    const t = randomRoadTileNear(Player.x, Player.y, 300, 1600);
    if (t) {
      const c = new Car((t.tx + 0.5) * TILE, (t.ty + 0.5) * TILE, Math.atan2(t.dir.y, t.dir.x), pick(MODEL_PAINT), 'civ', pickTrafficModel(Math.random()));
      c.hasDriver = true;
      c.ai = { dir: t.dir, target: null };
      Game.cars.push(c);
    }
  }
  for (let i = 0; i < 70; i++) {
    const t = randomTileNear(Player.x, Player.y, 150, 1500, tt => tt === T_SIDEWALK || tt === T_GRASS);
    if (t) Game.peds.push(new Ped((t.tx + 0.5) * TILE, (t.ty + 0.5) * TILE));
  }
}

// police

function updatePolice(dt) {
  const fx = Player.fx(), fy = Player.fy();
  while (Game.police.length < Game.wanted) {
    const t = randomRoadTileNear(fx, fy, 650, 1000);
    if (!t) break;
    const cop = new Car((t.tx + 0.5) * TILE, (t.ty + 0.5) * TILE, Math.atan2(t.dir.y, t.dir.x), '#e9edf2', 'police');
    cop.hasDriver = true;
    Game.police.push(cop);
  }
  if (Game.police.length > Game.wanted) Game.police.length = Game.wanted;

  let arresting = false;
  for (const cop of Game.police) {
    policeMove(cop, dt, Player);
    if (cop.stuck > 3.5) {
      const t = randomRoadTileNear(fx, fy, 500, 900);
      if (t) {
        cop.x = (t.tx + 0.5) * TILE; cop.y = (t.ty + 0.5) * TILE;
        cop.vx = 0; cop.vy = 0; cop.aiSpeed = 0;
        cop.angle = Math.atan2(t.dir.y, t.dir.x);
        cop.stuck = 0; cop.hp = 100; cop.wrecked = false;
      }
    }
    if (cop.wrecked) continue;
    const d = distp(cop.x, cop.y, fx, fy);
    const range = Player.inCar ? 62 : 45;
    const slow = Player.inCar ? Player.car.speed < 45 : true;
    if (d < range && slow) arresting = true;
  }

  if (arresting) {
    Game.bustProgress += dt;
    if (Game.bustProgress > 1.5) doBusted();
  } else {
    Game.bustProgress = Math.max(0, Game.bustProgress - dt * 1.5);
  }
}

function doBusted() {
  Game.state = 'busted';
  Game.bustedTimer = 3;
  Game.money = Math.max(0, Game.money - 150);
  saveMoney();
}

function respawn() {
  Player.inCar = false;
  Player.car = null;
  Player.x = spawnPoint.x;
  Player.y = spawnPoint.y;
  Game.wanted = 0;
  Game.police.length = 0;
  Game.bustProgress = 0;
  toast('Busted. They took $150.', '#ff6b6b');
}

// recycle far-away entities back near the player

function recycle() {
  const fx = Player.fx(), fy = Player.fy();
  for (const c of Game.cars) {
    if (c === Player.car) continue;
    if (c.ai && dist2(c.x, c.y, fx, fy) > 2300 * 2300) {
      const t = randomRoadTileNear(fx, fy, 900, 1600);
      if (t) {
        c.x = (t.tx + 0.5) * TILE; c.y = (t.ty + 0.5) * TILE;
        c.vx = 0; c.vy = 0; c.aiSpeed = 0;
        c.hp = 100; c.wrecked = false; c.panic = 0;
        c.angle = Math.atan2(t.dir.y, t.dir.x);
        c.ai = { dir: t.dir, target: null };
      }
    }
  }
  for (const p of Game.peds) {
    if (p.state !== 'dead' && dist2(p.x, p.y, fx, fy) > 2000 * 2000) {
      const t = randomTileNear(fx, fy, 500, 1200, tt => tt === T_SIDEWALK);
      if (t) { p.x = (t.tx + 0.5) * TILE; p.y = (t.ty + 0.5) * TILE; p.target = null; }
    } else if (p.state === 'dead' && p.deadTime > 25) {
      const t = randomTileNear(fx, fy, 600, 1400, tt => tt === T_SIDEWALK);
      if (t) {
        p.x = (t.tx + 0.5) * TILE; p.y = (t.ty + 0.5) * TILE;
        p.state = 'walk'; p.deadTime = 0; p.target = null;
      }
    }
  }
}

// per-frame update

function playUpdate(dt) {
  Player.update(dt);
  const fx = Player.fx(), fy = Player.fy();

  Game.activeCars = Game.cars.filter(c => c === Player.car || dist2(c.x, c.y, fx, fy) < 1600 * 1600);
  const allActive = Game.activeCars.concat(Game.police);

  for (const c of Game.activeCars) {
    if (c.remote) continue;
    if (c === Player.car && Player.inCar) c.physics(dt);
    else if (c.ai) aiMove(c, dt, allActive, Player);
    else if (c.speed > 2) { c.throttle = 0; c.steer = 0; c.hand = false; c.physics(dt); }
  }

  const online = typeof Online !== 'undefined' && Online.active;
  if (!online) updatePolice(dt);

  // car vs car
  for (let i = 0; i < allActive.length; i++) {
    for (let j = i + 1; j < allActive.length; j++) {
      const a = allActive[i], b = allActive[j];
      if (dist2(a.x, a.y, b.x, b.y) > 60 * 60) continue;
      const imp = collideCars(a, b);
      if (imp > 150) {
        a.damage((imp - 150) * 0.05);
        b.damage((imp - 150) * 0.05);
        AudioMan.thud(imp / 900);
        Particles.sparks((a.x + b.x) / 2, (a.y + b.y) / 2, 4);
        if (Player.inCar && (a === Player.car || b === Player.car)) {
          const other = a === Player.car ? b : a;
          if (other.kind === 'police') crime(1);
          if (other.ai) other.panic = 1.5;
        }
      }
    }
  }

  // pedestrians
  for (const p of Game.peds) {
    if (dist2(p.x, p.y, fx, fy) > 1500 * 1500) continue;
    p.update(dt, allActive, Player);
    if (p.state !== 'dead') {
      for (const c of allActive) {
        if (c.speed > 130 && dist2(c.x, c.y, p.x, p.y) < 23 * 23) {
          p.state = 'dead';
          p.deadTime = 0;
          Particles.stain(p.x, p.y);
          AudioMan.thud(0.2);
          if (Player.inCar && c === Player.car) crime(1);
          break;
        }
      }
    }
  }

  recycle();

  if (Game.wanted > 0) {
    Game.wantedTimer += dt;
    if (Game.wantedTimer > 16) { Game.wanted--; Game.wantedTimer = 0; }
  }

  if (online) Online.update(dt);
  else Mission.update(dt);
  Particles.update(dt);

  AudioMan.setEngine(
    Player.inCar && !Player.car.wrecked,
    Player.inCar ? clamp(Player.car.speed / 330, 0, 1) : 0
  );

  // camera: follow with a bit of velocity lookahead
  let lookx = 0, looky = 0;
  if (Player.inCar) {
    lookx = clamp(Player.car.vx * 0.35, -150, 150);
    looky = clamp(Player.car.vy * 0.35, -150, 150);
  }
  const tcx = Player.fx() + lookx - W / 2;
  const tcy = Player.fy() + looky - H / 2;
  const s = 1 - Math.exp(-4 * dt);
  cam.x += (tcx - cam.x) * s;
  cam.y += (tcy - cam.y) * s;
}

function update(dt) {
  Game.time += dt;
  applyTouchPad();
  for (let i = Game.toasts.length - 1; i >= 0; i--) {
    Game.toasts[i].t -= dt;
    if (Game.toasts[i].t <= 0) Game.toasts.splice(i, 1);
  }
  if (keyPressed('m')) {
    AudioMan.muted = !AudioMan.muted;
    toast(AudioMan.muted ? 'muted' : 'sound on', '#fff');
  }
  if (keyPressed('v')) {
    viewMode = viewMode === 'street' ? 'top' : 'street';
    try { localStorage.setItem('vc_view', viewMode); } catch (e) { }
    toast(viewMode === 'street' ? 'street cam' : 'top-down cam', '#28e0ff');
  }
  if (typeof syncOnlineButton === 'function') syncOnlineButton();
  if (Game.state === 'menu') {
    if (keyPressed('o') && typeof openOnlineLobby === 'function') openOnlineLobby();
    else if (keyPressed('Enter', 'Mouse0')) {
      Game.state = 'play';
      toast('Your pink ride is right there. Press E.', '#28e0ff');
    }
  } else if (Game.state === 'busted') {
    Game.bustedTimer -= dt;
    if (Game.bustedTimer <= 0) {
      respawn();
      Game.state = 'play';
    }
  } else {
    playUpdate(dt);
  }
  clearPressed();
}

// render

function onScreen(x, y) {
  return x > cam.x - 80 && x < cam.x + W + 80 && y > cam.y - 80 && y < cam.y + H + 80;
}

function render(dt) {
  if (viewMode === 'street') {
    render3D(Game.time, dt);
    drawHUD(ctx);
    return;
  }
  ctx.fillStyle = '#0c2e44';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(-Math.round(cam.x), -Math.round(cam.y));

  drawWorld(ctx, cam.x, cam.y, W, H, Game.time);
  Particles.drawStains(ctx);

  const o = Mission.objectivePoint();
  if (o && Game.state !== 'menu') {
    drawMarker(ctx, o, Game.time, Mission.state === 'deliver' ? '#ffd166' : '#28e0ff');
  }

  for (const p of Game.peds) if (p.state === 'dead' && onScreen(p.x, p.y)) p.draw(ctx);
  for (const c of Game.cars) if (onScreen(c.x, c.y)) c.draw(ctx, Game.time);
  for (const c of Game.police) if (onScreen(c.x, c.y)) c.draw(ctx, Game.time);
  for (const p of Game.peds) if (p.state !== 'dead' && onScreen(p.x, p.y)) p.draw(ctx);
  if (!Player.inCar && Game.state !== 'menu') Player.draw(ctx);

  for (const c of Game.activeCars) if (onScreen(c.x, c.y)) drawHeadlights(ctx, c);
  for (const c of Game.police) if (onScreen(c.x, c.y)) drawHeadlights(ctx, c);
  Particles.draw(ctx);

  ctx.restore();
  drawHUD(ctx);
}

// boot

let last = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(0.033, (now - last) / 1000));
  last = now;
  update(dt);
  render(dt);
  requestAnimationFrame(frame);
}

window.addEventListener('pointerdown', () => {
  AudioMan.init();
  Input.pressed['Mouse0'] = true;
});
window.addEventListener('keydown', () => AudioMan.init());

initGame();
requestAnimationFrame(frame);
