'use strict';
// level layout legend:
//   1-4 wall textures   D locked door (needs keycard)   . floor
//   P player start      E enemy      K keycard   H medkit   A ammo   X exit portal
const LEVELS = [
  {
    name: 'SECTOR 1: PERIMETER',
    rows: [
      '1111111111111111',
      '1P.....2.......1',
      '1..11..2..E....1',
      '1..1A..2....11.1',
      '1..1...2....1X.1',
      '1..1112211..1..1',
      '1......E....1..1',
      '1.H..........E.1',
      '1...11...11....1',
      '1...1..A..1..H.1',
      '1...1.....1....1',
      '1111111111111111',
    ],
  },
  {
    name: 'SECTOR 2: STORAGE VAULTS',
    rows: [
      '22222222222222222222',
      '2P...2.........2...2',
      '2....2..E......2.X.2',
      '2.A..2....33...2...2',
      '2....2....3....2D222',
      '2..E.2....3..E.2...2',
      '2....222223....D.E.2',
      '2........23....2...2',
      '2.H......23.A..22222',
      '2..333...2.....2...2',
      '2..3.....2..E..2.K.2',
      '2..3..E..2.....D...2',
      '2........2.H...2...2',
      '22222222222222222222',
    ],
  },
  {
    name: 'SECTOR 3: THE CORE',
    rows: [
      '3333333333333333333333',
      '3P...3.......4...3...3',
      '3....3..E....4.E.3.X.3',
      '3.A..3.......4...3...3',
      '3....3..444..4...3D333',
      '3.E..3..4.......E....3',
      '3....D..4..E.........3',
      '3....3..4....44444...3',
      '3.H..3..4....4...3.A.3',
      '3....3.......4.K.3...3',
      '3..E.333333..4...3.E.3',
      '3.........3..4...3...3',
      '3....E....3..D...3.H.3',
      '3.A.......3..4...D...3',
      '3.........3..4.E.3...3',
      '3333333333333333333333',
    ],
  },
];

function parseMap(rows) {
  const h = rows.length, w = rows[0].length;
  const out = {
    w, h, grid: [],
    enemies: [], items: [],
    player: { x: 1.5, y: 1.5, a: 0 },
    exit: null, name: ''
  };
  for (let y = 0; y < h; y++) {
    out.grid.push([]);
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      let t = 0;
      if (ch >= '1' && ch <= '4') t = +ch;
      else if (ch === 'D') t = 5;
      else if (ch === 'P') out.player = { x: x + 0.5, y: y + 0.5, a: 0 };
      else if (ch === 'E') out.enemies.push({ x: x + 0.5, y: y + 0.5 });
      else if (ch === 'K') out.items.push({ x: x + 0.5, y: y + 0.5, type: 'key' });
      else if (ch === 'H') out.items.push({ x: x + 0.5, y: y + 0.5, type: 'health' });
      else if (ch === 'A') out.items.push({ x: x + 0.5, y: y + 0.5, type: 'ammo' });
      else if (ch === 'X') out.exit = { x: x + 0.5, y: y + 0.5 };
      out.grid[y].push(t);
    }
  }
  return out;
}

function tileAt(map, x, y) {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return 1;
  return map.grid[y][x];
}

function solidCircle(map, x, y, r) {
  for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++) {
    for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
      if (tileAt(map, tx, ty) === 0) continue;
      const nx = clamp(x, tx, tx + 1), ny = clamp(y, ty, ty + 1);
      if (dist2(x, y, nx, ny) < r * r) return true;
    }
  }
  return false;
}

// per-axis slide movement
function tryMove(map, x, y, nx, ny, r) {
  let fx = nx, fy = y;
  if (solidCircle(map, fx, fy, r)) fx = x;
  fy = ny;
  if (solidCircle(map, fx, fy, r)) fy = y;
  return { x: fx, y: fy };
}
