'use strict';
// the raycasting core: DDA grid traversal + textured column rendering
const SCREEN_W = 640, SCREEN_H = 400;
const COLS = 320, COLW = SCREEN_W / COLS;
const FOV_PLANE = 0.66;        // tan(fov/2), ~66°
const MAX_FOG = 14;            // distance where fog is fully dark

// cast one ray with DDA; returns perpendicular distance (fisheye-free) + texture info
function castRay(map, px, py, dirX, dirY) {
  let mapX = Math.floor(px), mapY = Math.floor(py);
  const deltaX = dirX === 0 ? 1e30 : Math.abs(1 / dirX);
  const deltaY = dirY === 0 ? 1e30 : Math.abs(1 / dirY);
  let stepX, stepY, sideX, sideY;
  if (dirX < 0) { stepX = -1; sideX = (px - mapX) * deltaX; }
  else { stepX = 1; sideX = (mapX + 1 - px) * deltaX; }
  if (dirY < 0) { stepY = -1; sideY = (py - mapY) * deltaY; }
  else { stepY = 1; sideY = (mapY + 1 - py) * deltaY; }

  let side = 0;
  for (let i = 0; i < 128; i++) {
    if (sideX < sideY) { sideX += deltaX; mapX += stepX; side = 0; }
    else { sideY += deltaY; mapY += stepY; side = 1; }
    const t = tileAt(map, mapX, mapY);
    if (t > 0) {
      const dist = side === 0 ? sideX - deltaX : sideY - deltaY;
      let wallX = side === 0 ? py + dist * dirY : px + dist * dirX;
      wallX -= Math.floor(wallX);
      return { dist: Math.max(0.0001, dist), side, tile: t, wallX, mapX, mapY };
    }
  }
  return { dist: 128, side: 0, tile: 1, wallX: 0, mapX, mapY };
}

// straight-line visibility between two points (for AI + hitscan)
function hasLOS(map, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const d = Math.hypot(dx, dy);
  if (d < 0.001) return true;
  const hit = castRay(map, x1, y1, dx / d, dy / d);
  return hit.dist >= d - 0.05;
}

const zBuffer = new Float64Array(COLS);

function renderWalls(ctx, map, p) {
  // ceiling + floor
  const ceil = ctx.createLinearGradient(0, 0, 0, SCREEN_H / 2);
  ceil.addColorStop(0, '#171033');
  ceil.addColorStop(1, '#07050f');
  ctx.fillStyle = ceil;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H / 2);
  const floor = ctx.createLinearGradient(0, SCREEN_H / 2, 0, SCREEN_H);
  floor.addColorStop(0, '#0a0814');
  floor.addColorStop(1, '#201a38');
  ctx.fillStyle = floor;
  ctx.fillRect(0, SCREEN_H / 2, SCREEN_W, SCREEN_H / 2);

  const dirX = Math.cos(p.a), dirY = Math.sin(p.a);
  const planeX = -dirY * FOV_PLANE, planeY = dirX * FOV_PLANE;

  for (let col = 0; col < COLS; col++) {
    const camX = 2 * col / COLS - 1;
    const rx = dirX + planeX * camX;
    const ry = dirY + planeY * camX;
    const hit = castRay(map, p.x, p.y, rx, ry);
    zBuffer[col] = hit.dist;

    const lineH = Math.min(SCREEN_H * 3, SCREEN_H / hit.dist);
    const y0 = (SCREEN_H - lineH) / 2;
    const tex = Textures.walls[hit.tile] || Textures.walls[1];
    let texX = Math.floor(hit.wallX * TEX);
    if ((hit.side === 0 && rx > 0) || (hit.side === 1 && ry < 0)) texX = TEX - texX - 1;

    ctx.drawImage(tex, texX, 0, 1, TEX, col * COLW, y0, COLW, lineH);

    // side shading + distance fog in one pass
    const fog = clamp(hit.dist / MAX_FOG, 0, 0.92) + (hit.side === 1 ? 0.18 : 0);
    if (fog > 0.02) {
      ctx.fillStyle = 'rgba(5,3,14,' + Math.min(0.94, fog).toFixed(3) + ')';
      ctx.fillRect(col * COLW, y0, COLW, lineH);
    }
  }
}

// billboard sprites with z-buffer clipping (lodev-style camera transform)
function renderSprites(ctx, map, p, sprites) {
  const dirX = Math.cos(p.a), dirY = Math.sin(p.a);
  const planeX = -dirY * FOV_PLANE, planeY = dirX * FOV_PLANE;
  const invDet = 1 / (planeX * dirY - dirX * planeY);

  const list = sprites
    .map(s => {
      const dx = s.x - p.x, dy = s.y - p.y;
      return { s, depth: dx * dx + dy * dy };
    })
    .sort((a, b) => b.depth - a.depth);

  for (const { s } of list) {
    const dx = s.x - p.x, dy = s.y - p.y;
    const transX = invDet * (dirY * dx - dirX * dy);
    const transY = invDet * (-planeY * dx + planeX * dy);
    if (transY <= 0.15) continue;

    const screenX = (COLS / 2) * (1 + transX / transY);
    const size = Math.abs(SCREEN_H / transY) * (s.scale || 1);
    const top = SCREEN_H / 2 - size / 2 + (s.vOff || 0) * (SCREEN_H / transY);
    const colStart = Math.floor(screenX - size / (2 * COLW));
    const colEnd = Math.ceil(screenX + size / (2 * COLW));
    const img = s.img;
    if (!img) continue;

    for (let col = Math.max(0, colStart); col < Math.min(COLS, colEnd); col++) {
      if (zBuffer[col] <= transY) continue;
      const tx = Math.floor(((col - colStart) / (colEnd - colStart)) * TEX);
      ctx.drawImage(img, tx, 0, 1, TEX, col * COLW, top, COLW, size);
    }
    // distance fog on sprite
    const fog = clamp(transY / MAX_FOG, 0, 0.8);
    if (fog > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.restore();
    }
  }
}
