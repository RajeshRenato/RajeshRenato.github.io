'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { load, run } = require('./helpers/browser');

load('daily/index.html');
const today = run('dayNumber()');
const text = id => String(run(`document.getElementById('${id}').textContent`));

function solveDay(d, { penta = 'won', sudoku = true, arrow = true } = {}) {
  if (penta) {
    const words = penta === 'won' ? ['crane', 'plant'] : ['a', 'b', 'c', 'd', 'e', 'f'];
    run(`localStorage.setItem('penta_day_${d}', JSON.stringify({ words: ${JSON.stringify(words)}, done: true, won: ${penta === 'won'} }))`);
  }
  if (sudoku) run(`localStorage.setItem('sud_day_${d}', '6:12')`);
  if (arrow) run(`localStorage.setItem('af_day_${d}', JSON.stringify({ mistakes: 1, secs: 107 }))`);
}

test('nothing played yet', () => {
  run('render()');
  assert.strictEqual(text('today'), '0/3');
  assert.strictEqual(text('cur'), '0');
  assert.strictEqual(run(`document.getElementById('share').disabled`), true);
});

test('each game reports its own result for today', () => {
  solveDay(today, { arrow: false });
  run('render()');
  assert.strictEqual(text('today'), '2/3');
  assert.strictEqual(run('penta(dayNumber()).text'), 'Solved in 2/6');
  assert.strictEqual(run('sudoku(dayNumber()).text'), 'Solved in 6:12');
  assert.strictEqual(run('arrow(dayNumber()).state'), 'todo');
  assert.strictEqual(run(`document.getElementById('share').disabled`), false);
});

test('a missed Penta does not count, and streaks only count days with all three solved', () => {
  solveDay(today - 1);
  solveDay(today - 2);
  solveDay(today - 3, { penta: 'lost' });
  solveDay(today - 6); solveDay(today - 7); solveDay(today - 8); solveDay(today - 9);
  run('render()');
  assert.strictEqual(run(`penta(${today - 3}).state`), 'missed');
  assert.strictEqual(text('cur'), '2', 'yesterday and the day before, today still open');
  assert.strictEqual(text('best'), '4');
  solveDay(today);
  run('render()');
  assert.strictEqual(text('cur'), '3');
  assert.strictEqual(text('today'), '3/3');
});

test('older Penta saves without a won flag still count wins', () => {
  run(`localStorage.setItem('penta_day_${today - 20}', JSON.stringify({ words: ['a', 'b', 'c'], done: true }))`);
  assert.strictEqual(run(`penta(${today - 20}).state`), 'done');
});

test('the share text lists all three results', () => {
  const t = run('shareText()');
  assert.match(t, /^Playground daily #\d+\nPenta 2\/6\nSudoku 6:12\nArrow Flux 1:47, 1 mistake\n/);
});
