'use strict';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const Game = {
  state: 'menu',          // menu | play | dead | levelDone | win
  levelIndex: 0,
  map: null, enemies: [], items: [], exit: null,
  player: Player,
  kills: 0,
  msg: '', msgT: 0,
  showMap: false,
  overlayT: 0,
  time: 0,

  loadLevel(i) {
    this.levelIndex = i;
    const data = parseMap(LEVELS[i].rows);
    data.name = LEVELS[i].name;
    this.map = data;
    this.enemies = data.enemies.map(e => new Enemy(e.x, e.y));
    this.items = data.items;
    this.exit = data.exit;
    this.kills = 0;
    this.msg = ''; this.msgT = 0;
    Player.reset(data.player);
  },

  message(m) { this.msg = m; this.msgT = 2.2; },

  hurtPlayer(d) {
    Player.takeDamage(d);
    if (Player.hp <= 0) this.state = 'dead';
  },

  levelComplete() {
    if (this.state !== 'play') return;
    AudioMan.exitSnd();
    this.state = this.levelIndex + 1 >= LEVELS.length ? 'win' : 'levelDone';
    this.overlayT = 0;
  },
};

function sceneSprites() {
  const out = [];
  for (const e of Game.enemies) {
    const s = e.sprite();
    out.push({ x: e.x, y: e.y, img: s.img, scale: s.scale, vOff: s.vOff });
  }
  for (const it of Game.items) {
    out.push({ x: it.x, y: it.y, img: Textures.sprites[it.type], scale: 0.55, vOff: 0.25 });
  }
  if (Game.exit) {
    out.push({ x: Game.exit.x, y: Game.exit.y, img: Textures.sprites.exit, scale: 0.9, vOff: 0.05 });
  }
  return out;
}

function update(dt) {
  Game.time += dt;
  Game.msgT = Math.max(0, Game.msgT - dt);

  if (keyPressed('m')) Game.showMap = !Game.showMap;

  if (Game.state === 'menu') {
    if (keyPressed('Enter', 'Mouse0')) {
      Game.loadLevel(0);
      Game.state = 'play';
    }
  } else if (Game.state === 'play') {
    Player.update(dt, Game);
    for (const e of Game.enemies) e.update(dt, Game);
  } else if (Game.state === 'dead') {
    if (keyPressed('r', 'Enter', 'Mouse0')) {
      Game.loadLevel(Game.levelIndex);
      Game.state = 'play';
    }
  } else if (Game.state === 'levelDone') {
    Game.overlayT += dt;
    if (Game.overlayT > 0.8 && keyPressed('Enter', 'Mouse0', ' ')) {
      Game.loadLevel(Game.levelIndex + 1);
      Game.state = 'play';
    }
  } else if (Game.state === 'win') {
    if (keyPressed('Enter', 'Mouse0')) {
      Game.state = 'menu';
    }
  }
  clearFrameInput();
}

function render() {
  if (Game.state === 'menu') {
    ctx.fillStyle = '#07050f';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    // animated backdrop: slow spin inside level 1
    const demo = Game.map || (Game.loadLevel(0), Game.map);
    renderWalls(ctx, demo, { x: demo.player.x, y: demo.player.y, a: Game.time * 0.3 });
    drawOverlay(ctx, 'BREACH', [
      'a raycast shooter. Every wall, sprite and sound is generated in code.',
      '',
      'WASD move · mouse or ←→ look · click/F fire · E open doors',
      'M minimap · SHIFT run',
      '',
      'clear all three sectors. find the keycards. reach the portals.',
      '',
      'click or press ENTER to start'
    ], '#9f7bff');
    return;
  }

  renderWalls(ctx, Game.map, Player);
  renderSprites(ctx, Game.map, Player, sceneSprites());
  drawWeapon(ctx, Player);
  drawHUD(ctx, Game);

  if (Game.state === 'dead') {
    drawOverlay(ctx, 'YOU DIED', ['the sentinels got you', '', 'press R to retry ' + Game.map.name], '#ff2d55');
  } else if (Game.state === 'levelDone') {
    drawOverlay(ctx, 'SECTOR CLEAR', [
      'kills: ' + Game.kills + ' / ' + Game.enemies.length,
      '', 'press ENTER for the next sector'
    ], '#64ffb4');
  } else if (Game.state === 'win') {
    drawOverlay(ctx, 'BREACH COMPLETE', [
      'all three sectors cleared. the core is yours.',
      '', 'press ENTER for the title screen'
    ], '#ffd166');
  }
}

let last = 0;
function frame(t) {
  const dt = Math.min(0.033, (t - last) / 1000);
  last = t;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

initTextures();
initPointer(canvas);
window.addEventListener('keydown', () => AudioMan.init());
requestAnimationFrame(frame);
