'use strict';
// HUD, viewmodel weapon, minimap, overlays
function drawWeapon(ctx, p) {
  const bobX = Math.sin(p.walkT) * 10;
  const bobY = Math.abs(Math.cos(p.walkT)) * 7;
  const kick = p.fireAnim * 14;
  const cx = SCREEN_W / 2 + bobX, cy = SCREEN_H - 62 + bobY + kick;
  ctx.save();
  ctx.translate(cx, cy);
  // muzzle flash
  if (p.fireAnim > 0.55) {
    ctx.fillStyle = 'rgba(255,240,160,' + (p.fireAnim - 0.4).toFixed(2) + ')';
    ctx.beginPath();
    ctx.arc(0, -34, 16 + Math.random() * 8, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, -34, 6, 0, 7); ctx.fill();
  }
  // blaster body
  ctx.fillStyle = '#1b1430';
  ctx.strokeStyle = '#6e5aff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-26, 70); ctx.lineTo(-18, -8); ctx.lineTo(-8, -30); ctx.lineTo(8, -30);
  ctx.lineTo(18, -8); ctx.lineTo(26, 70);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#28e0ff';
  ctx.fillRect(-5, -28, 10, 7);
  ctx.fillStyle = '#17122e';
  ctx.fillRect(-14, 6, 28, 30);
  ctx.fillStyle = '#ff2d95';
  for (let i = 0; i < 3; i++) ctx.fillRect(-10 + i * 8, 12, 4, 18);
  ctx.restore();
}

function drawHUD(ctx, game) {
  const p = game.player;
  // crosshair
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(SCREEN_W / 2 - 7, SCREEN_H / 2); ctx.lineTo(SCREEN_W / 2 - 2, SCREEN_H / 2);
  ctx.moveTo(SCREEN_W / 2 + 2, SCREEN_H / 2); ctx.lineTo(SCREEN_W / 2 + 7, SCREEN_H / 2);
  ctx.moveTo(SCREEN_W / 2, SCREEN_H / 2 - 7); ctx.lineTo(SCREEN_W / 2, SCREEN_H / 2 - 2);
  ctx.moveTo(SCREEN_W / 2, SCREEN_H / 2 + 2); ctx.lineTo(SCREEN_W / 2, SCREEN_H / 2 + 7);
  ctx.stroke();

  // hurt vignette
  if (p.hurtT > 0) {
    ctx.fillStyle = 'rgba(255,30,60,' + (p.hurtT * 0.45).toFixed(3) + ')';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  }

  // bottom bar
  ctx.fillStyle = 'rgba(8,6,18,0.75)';
  ctx.fillRect(0, SCREEN_H - 28, SCREEN_W, 28);
  ctx.font = 'bold 15px "Courier New",monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = p.hp > 30 ? '#39ff9c' : '#ff5a7a';
  ctx.fillText('♥ ' + p.hp, 12, SCREEN_H - 14);
  ctx.fillStyle = '#ffd166';
  ctx.fillText('⚡ ' + p.ammo, 100, SCREEN_H - 14);
  if (p.hasKey) {
    ctx.fillStyle = '#ff2d55';
    ctx.fillText('▮ KEYCARD', 185, SCREEN_H - 14);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = '#8a84ad';
  ctx.fillText(game.map.name + '  ·  kills ' + game.kills + '/' + game.enemies.length, SCREEN_W - 12, SCREEN_H - 14);

  // message
  if (game.msgT > 0) {
    ctx.textAlign = 'center';
    ctx.font = '14px "Courier New",monospace';
    ctx.globalAlpha = Math.min(1, game.msgT);
    ctx.fillStyle = '#28e0ff';
    ctx.fillText(game.msg, SCREEN_W / 2, SCREEN_H - 48);
    ctx.globalAlpha = 1;
  }

  if (game.showMap) drawMinimap(ctx, game);
}

function drawMinimap(ctx, game) {
  const map = game.map, p = game.player;
  const S = 6, mx = SCREEN_W - map.w * S - 10, my = 10;
  ctx.fillStyle = 'rgba(5,3,14,0.8)';
  ctx.fillRect(mx - 3, my - 3, map.w * S + 6, map.h * S + 6);
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const t = map.grid[y][x];
    if (!t) continue;
    ctx.fillStyle = t === 5 ? '#ff2d55' : '#3a2a6e';
    ctx.fillRect(mx + x * S, my + y * S, S - 1, S - 1);
  }
  if (game.exit) {
    ctx.fillStyle = '#64ffb4';
    ctx.fillRect(mx + (game.exit.x - 0.5) * S, my + (game.exit.y - 0.5) * S, S, S);
  }
  for (const e of game.enemies) {
    if (!e.alive) continue;
    ctx.fillStyle = '#ff5a7a';
    ctx.fillRect(mx + e.x * S - 2, my + e.y * S - 2, 4, 4);
  }
  ctx.fillStyle = '#fff';
  ctx.save();
  ctx.translate(mx + p.x * S, my + p.y * S);
  ctx.rotate(p.a);
  ctx.beginPath();
  ctx.moveTo(5, 0); ctx.lineTo(-3, -3); ctx.lineTo(-3, 3);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawOverlay(ctx, title, lines, color) {
  ctx.fillStyle = 'rgba(5,3,14,0.78)';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'italic bold 42px "Courier New",monospace';
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 22;
  ctx.fillText(title, SCREEN_W / 2, 150);
  ctx.shadowBlur = 0;
  ctx.font = '14px "Courier New",monospace';
  ctx.fillStyle = '#e8e6f5';
  lines.forEach((l, i) => ctx.fillText(l, SCREEN_W / 2, 196 + i * 24));
}
