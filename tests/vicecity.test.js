'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { load, run } = require('./helpers/browser');

load('vicecity/index.html');
const step = (n, each = '') => run(`for (let i = 0; i < ${n}; i++) { ${each}; update(0.016); render(0.016); }`);

test('on foot in street view, W walks along the facing direction', () => {
  run(`Game.state = 'play'; viewMode = 'street';`);
  const before = run('[Player.x, Player.y, Player.angle]');
  run(`Input.keys['w'] = true;`); step(60); run(`Input.keys['w'] = false;`);
  const after = run('[Player.x, Player.y]');
  const moved = Math.hypot(after[0] - before[0], after[1] - before[1]);
  assert.ok(moved > 1, 'player did not move');
  const heading = Math.atan2(after[1] - before[1], after[0] - before[0]);
  assert.ok(Math.abs(Math.atan2(Math.sin(heading - before[2]), Math.cos(heading - before[2]))) < 0.2, 'moved off the facing direction');
});

test('A and D turn the player in street view', () => {
  const a0 = run('Player.angle');
  run(`Input.keys['d'] = true;`); step(20); run(`Input.keys['d'] = false;`);
  assert.ok(run('Player.angle') !== a0);
});

test('driving, police pursuit, and both camera modes render', () => {
  run(`Player.car = Game.cars[0]; Player.inCar = true; Game.cars[0].hasDriver = false; Game.cars[0].ai = null;
       Input.keys['w'] = true; Input.keys['d'] = true;`);
  step(300);
  assert.ok(run('Player.car.speed') > 0);
  run('Game.wanted = 3;');
  step(120);
  assert.ok(run('Game.police.length') > 0);
  run(`viewMode = 'top';`); step(40);
  run(`viewMode = 'street'; Player.exitCar(); Input.keys['w'] = false; Input.keys['d'] = false;`); step(40);
  assert.strictEqual(run('Player.inCar'), false);
});

test('the touch joystick maps to driving keys', () => {
  run(`TouchPad.on = true; Player.car = Game.cars[0]; Player.inCar = true;
       TouchPad.joy = { active: true, id: 1, ax: 100, ay: 300, dx: 0, dy: -56 };`);
  step(5);
  assert.ok(run(`Input.keys['w']`));
  run('TouchPad.joy = { active: true, id: 1, ax: 100, ay: 300, dx: 56, dy: 0 };');
  step(1);
  assert.ok(run(`Input.keys['d'] && !Input.keys['w']`));
  run('TouchPad.on = false; TouchPad.joy.active = false;');
});
