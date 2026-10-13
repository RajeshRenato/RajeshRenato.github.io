'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { load, run } = require('./helpers/browser');

load('arrow-flux/index.html');
const generate = run('generate');
const mulberry32 = run('mulberry32');
const DX = run('DX'), DY = run('DY');

const SHAPES = [[4, 5], [6, 8], [8, 11], [12, 17], [16, 23], [20, 29], [26, 37], [9, 9], [30, 12]];

function solveGreedy(cols, rows, arrows) {
  const occ = new Int16Array(cols * rows).fill(-1);
  arrows.forEach((a, i) => a.cells.forEach(c => { occ[c] = i; }));
  const gone = new Uint8Array(arrows.length);
  let left = arrows.length, progress = true;
  while (left && progress) {
    progress = false;
    arrows.forEach((a, i) => {
      if (gone[i]) return;
      const h = a.cells[a.cells.length - 1];
      let x = h % cols + DX[a.dir], y = ((h / cols) | 0) + DY[a.dir];
      while (x >= 0 && y >= 0 && x < cols && y < rows) {
        if (occ[y * cols + x] >= 0) return;
        x += DX[a.dir]; y += DY[a.dir];
      }
      gone[i] = 1; left--; progress = true;
      a.cells.forEach(c => { occ[c] = -1; });
    });
  }
  return left;
}

test('generated boards cover every cell with connected arrows', () => {
  for (const [cols, rows] of SHAPES) {
    for (let seed = 1; seed <= 20; seed++) {
      const arrows = generate(cols, rows, mulberry32(seed * 2654435761 + cols * 97 + rows), Math.max(4, Math.round(Math.max(cols, rows) * 0.45)));
      const owner = new Int16Array(cols * rows).fill(-1);
      arrows.forEach((a, i) => {
        a.cells.forEach((c, j) => {
          assert.strictEqual(owner[c], -1, `cell ${c} used twice on ${cols}x${rows} seed ${seed}`);
          owner[c] = i;
          if (j > 0) {
            const p = a.cells[j - 1];
            const step = Math.abs(c % cols - p % cols) + Math.abs(((c / cols) | 0) - ((p / cols) | 0));
            assert.strictEqual(step, 1, 'arrow body is not connected');
          }
        });
        if (a.cells.length > 1) {
          const h = a.cells[a.cells.length - 1], p = a.cells[a.cells.length - 2];
          assert.strictEqual(h % cols - p % cols, DX[a.dir], 'head direction must follow the last segment');
          assert.strictEqual(((h / cols) | 0) - ((p / cols) | 0), DY[a.dir], 'head direction must follow the last segment');
        }
      });
      assert.ok(owner.every(o => o >= 0), `${cols}x${rows} seed ${seed} left a cell empty`);
    }
  }
});

test('every generated board is solvable', () => {
  for (const [cols, rows] of SHAPES) {
    for (let seed = 1; seed <= 20; seed++) {
      const arrows = generate(cols, rows, mulberry32(seed * 7919 + cols), Math.max(4, Math.round(Math.max(cols, rows) * 0.45)));
      assert.strictEqual(solveGreedy(cols, rows, arrows), 0, `${cols}x${rows} seed ${seed} got stuck`);
    }
  }
});

test('a blocked tap costs a heart and bumps the arrow', () => {
  run(`sizeMode = 'm'; level = 3; loadLevel();`);
  const id = run('arrows.find(a => blockerOf(a)).id');
  const before = run('hearts');
  run(`tap(${id})`);
  assert.strictEqual(run('hearts'), before - 1);
  assert.ok(run(`bumps.has(${id})`));
});

test('tapping free arrows clears the board, undo restores one, and the win fires', () => {
  run(`sizeMode = 'm'; level = 3; loadLevel(); hearts = 99;`);
  let taps = 0;
  while (run('alive') > 0 && taps < 2000) {
    run('showHint()');
    assert.ok(run('hint'), 'hint found nothing with arrows left');
    run('tap(hint.id)');
    taps++;
  }
  assert.strictEqual(run('alive'), 0);
  run('undo()');
  assert.strictEqual(run('alive'), 1);
  run('showHint(); tap(hint.id); flying = []; bumps.clear(); frame(16); frame(32);');
  assert.strictEqual(run('done'), true);
});
