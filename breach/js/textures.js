'use strict';
// wall textures and sprites are drawn to canvases at startup; no image files
const TEX = 64;
const Textures = { walls: [], sprites: {} };

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function genWallTextures() {
  // 1: neon brick
  let c = makeCanvas(TEX, TEX), g = c.getContext('2d');
  g.fillStyle = '#241028'; g.fillRect(0, 0, TEX, TEX);
  for (let row = 0; row < 8; row++) {
    const off = (row % 2) * 8;
    for (let col = -1; col < 4; col++) {
      g.fillStyle = 'hsl(' + (320 + ((row * 7 + col * 13) % 14)) + ',45%,' + (22 + ((row * 5 + col * 11) % 8)) + '%)';
      g.fillRect(col * 16 + off + 1, row * 8 + 1, 14, 6);
    }
  }
  g.fillStyle = 'rgba(255,45,149,0.25)';
  g.fillRect(0, 30, TEX, 2);
  Textures.walls[1] = c;

  // 2: tech panel
  c = makeCanvas(TEX, TEX); g = c.getContext('2d');
  g.fillStyle = '#131b33'; g.fillRect(0, 0, TEX, TEX);
  g.strokeStyle = '#223058'; g.lineWidth = 2;
  g.strokeRect(3, 3, 58, 58); g.strokeRect(10, 10, 44, 44);
  for (let i = 0; i < 6; i++) {
    g.fillStyle = i % 2 ? '#28e0ff' : '#1a7a8c';
    g.fillRect(16 + i * 6, 52, 3, 3);
  }
  g.fillStyle = 'rgba(40,224,255,0.5)';
  g.fillRect(14, 20, 36, 2);
  g.fillRect(14, 28, 24, 2);
  Textures.walls[2] = c;

  // 3: stone blocks
  c = makeCanvas(TEX, TEX); g = c.getContext('2d');
  g.fillStyle = '#1c1830'; g.fillRect(0, 0, TEX, TEX);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    g.fillStyle = 'hsl(255,25%,' + (16 + ((x * 7 + y * 5) % 9)) + '%)';
    g.fillRect(x * 16 + 1, y * 16 + 1, 14, 14);
  }
  Textures.walls[3] = c;

  // 4: hazard stripes
  c = makeCanvas(TEX, TEX); g = c.getContext('2d');
  g.fillStyle = '#17122e'; g.fillRect(0, 0, TEX, TEX);
  g.fillStyle = '#ffd166';
  for (let i = -4; i < 8; i++) {
    g.save();
    g.translate(i * 16, 0);
    g.beginPath();
    g.moveTo(0, TEX); g.lineTo(8, TEX); g.lineTo(TEX / 4 + 8, 0); g.lineTo(TEX / 4, 0);
    g.closePath(); g.fill();
    g.restore();
  }
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.fillRect(0, 0, TEX, 6); g.fillRect(0, 58, TEX, 6);
  Textures.walls[4] = c;

  // 5: locked door
  c = makeCanvas(TEX, TEX); g = c.getContext('2d');
  g.fillStyle = '#262b3a'; g.fillRect(0, 0, TEX, TEX);
  g.fillStyle = '#343b50'; g.fillRect(4, 2, 56, 60);
  g.fillStyle = '#10131d'; g.fillRect(30, 2, 4, 60);
  g.fillStyle = '#86909f';
  for (const y of [8, 24, 40, 56]) { g.fillRect(9, y, 3, 3); g.fillRect(52, y, 3, 3); }
  g.fillStyle = '#ff2d55';
  g.fillRect(40, 28, 8, 8);
  g.fillStyle = 'rgba(255,45,85,0.4)';
  g.fillRect(38, 26, 12, 12);
  Textures.walls[5] = c;
}

function genSprites() {
  // sentinel enemy frames: idle, attack, dead
  function sentinel(mode) {
    const c = makeCanvas(TEX, TEX), g = c.getContext('2d');
    if (mode === 'dead') {
      g.fillStyle = '#1b1430';
      g.beginPath(); g.ellipse(32, 56, 22, 6, 0, 0, 7); g.fill();
      g.fillStyle = '#51407a';
      g.beginPath(); g.ellipse(32, 52, 14, 7, 0, 0, 7); g.fill();
      g.fillStyle = '#5a1025';
      g.beginPath(); g.arc(32, 52, 3, 0, 7); g.fill();
      return c;
    }
    g.fillStyle = '#231b3f';
    g.beginPath();
    g.moveTo(32, 6); g.lineTo(54, 26); g.lineTo(46, 56); g.lineTo(18, 56); g.lineTo(10, 26);
    g.closePath(); g.fill();
    g.strokeStyle = '#6e5aff'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#191330';
    g.beginPath(); g.moveTo(10, 26); g.lineTo(0, 38); g.lineTo(14, 44); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(54, 26); g.lineTo(64, 38); g.lineTo(50, 44); g.closePath(); g.fill();
    const eye = mode === 'attack' ? '#ff5a7a' : '#ff2d55';
    g.fillStyle = eye;
    g.shadowColor = eye; g.shadowBlur = mode === 'attack' ? 16 : 8;
    g.beginPath(); g.arc(32, 30, mode === 'attack' ? 9 : 6, 0, 7); g.fill();
    g.shadowBlur = 0;
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(30, 28, 2, 0, 7); g.fill();
    g.fillStyle = '#6e5aff';
    for (let i = 0; i < 3; i++) g.fillRect(24 + i * 6, 46, 3, 5);
    return c;
  }
  Textures.sprites.enemy = sentinel('idle');
  Textures.sprites.enemyAttack = sentinel('attack');
  Textures.sprites.enemyDead = sentinel('dead');

  // medkit
  let c = makeCanvas(TEX, TEX), g = c.getContext('2d');
  g.fillStyle = '#e8e6f5'; g.fillRect(14, 28, 36, 26);
  g.fillStyle = '#c9c6dd'; g.fillRect(14, 28, 36, 6);
  g.fillStyle = '#ff2d55';
  g.fillRect(28, 32, 8, 18); g.fillRect(23, 37, 18, 8);
  Textures.sprites.health = c;

  // ammo cell
  c = makeCanvas(TEX, TEX); g = c.getContext('2d');
  g.fillStyle = '#17304a'; g.fillRect(16, 30, 32, 24);
  g.strokeStyle = '#28e0ff'; g.lineWidth = 2; g.strokeRect(16, 30, 32, 24);
  g.fillStyle = '#ffd166';
  for (let i = 0; i < 3; i++) g.fillRect(21 + i * 9, 35, 5, 14);
  Textures.sprites.ammo = c;

  // keycard
  c = makeCanvas(TEX, TEX); g = c.getContext('2d');
  g.fillStyle = '#ff2d55'; g.fillRect(20, 34, 24, 16);
  g.fillStyle = '#fff'; g.fillRect(23, 38, 8, 8);
  g.fillStyle = 'rgba(255,45,85,0.4)'; g.fillRect(17, 31, 30, 22);
  Textures.sprites.key = c;

  // exit portal
  c = makeCanvas(TEX, TEX); g = c.getContext('2d');
  for (let r = 26; r > 4; r -= 5) {
    g.strokeStyle = 'rgba(100,255,180,' + (0.25 + (26 - r) / 40) + ')';
    g.lineWidth = 3;
    g.beginPath(); g.arc(32, 36, r, 0, 7); g.stroke();
  }
  g.fillStyle = '#64ffb4';
  g.beginPath(); g.arc(32, 36, 5, 0, 7); g.fill();
  Textures.sprites.exit = c;
}

function initTextures() {
  genWallTextures();
  genSprites();
}
