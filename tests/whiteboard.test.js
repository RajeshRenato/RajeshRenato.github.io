'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));
const ev = (x, y) => `{ clientX: ${x}, clientY: ${y}, pointerId: 1 }`;

// the fake canvas is 900x700 on screen; the board is 1600x1000
test('drawing alone: pen, shapes, undo, eraser, clear', () => {
  const page = createPage('whiteboard/index.html');
  const fire = (type, e) => page.run(`for (const f of cv.listeners.${type}) f(${e})`);
  const down = (x, y) => fire('pointerdown', ev(x, y));
  const move = (x, y) => { page.run('lastSend = 0'); fire('pointermove', ev(x, y)); };
  const up = () => fire('pointerup', '{}');

  down(90, 70); move(180, 140); move(270, 210); up();
  assert.strictEqual(page.run('items.length'), 1);
  assert.deepStrictEqual(json(page, 'items[0].p'), [160, 100, 320, 200, 480, 300]);

  page.run(`tool.kind = 'rect'`);
  down(450, 350); move(630, 490); up();
  assert.strictEqual(page.run('items[1].kind'), 'rect');
  assert.deepStrictEqual(json(page, 'items[1].p'), [800, 500, 1120, 700]);

  page.run(`tool.kind = 'arrow'`);
  down(10, 10); move(11, 11); up();
  assert.strictEqual(page.run('items.length'), 2, 'a tiny shape is dropped');

  page.run('undo()');
  assert.deepStrictEqual(json(page, 'items.map(i => i.kind)'), ['pen']);

  page.run(`tool.kind = 'erase'`);
  down(180, 140); up();
  assert.strictEqual(page.run('items.length'), 0, 'the eraser removes the stroke it touches');

  page.run(`share({ t: 'add', item: { id: 'x', by: 0, kind: 'text', c: '#000', w: 7, p: [100, 100], text: 'hi' } }); share({ t: 'clear' })`);
  assert.strictEqual(page.run('items.length'), 0);
});

test('online: strokes reach everyone, late joiners get the board, guests can only undo their own', () => {
  const host = createPage('whiteboard/index.html');
  const g1 = createPage('whiteboard/index.html');
  const c1 = channelPair();
  host.sandbox.c1 = c1.a; g1.sandbox.ch = c1.b;
  host.run(`globalThis.r = Room.create('whiteboard', 'Ana'); r.addChannel(c1);`);
  g1.run(`attach(Room.joinChannel(ch, 'Bo'))`);
  c1.pump();
  host.run(`share({ t: 'add', item: { id: 'h1', by: 0, kind: 'line', c: '#000', w: 3, p: [0, 0, 100, 100] } }); attach(r);`);
  c1.pump();
  assert.deepStrictEqual(json(g1, 'items.map(i => i.id)'), ['h1'], 'the guest gets what was drawn before');

  g1.run(`share({ t: 'add', item: { id: 'g1', by: 1, kind: 'pen', c: '#000', w: 3, p: [5, 5] } })`);
  g1.run(`room.send({ t: 'pts', id: 'g1', p: [50, 50, 90, 60] })`);
  c1.pump();
  assert.deepStrictEqual(json(host, 'items.find(i => i.id === "g1").p'), [5, 5, 50, 50, 90, 60]);

  g1.run(`room.send({ t: 'del', ids: ['h1'] })`);
  c1.pump();
  assert.ok(host.run(`items.some(i => i.id === 'h1')`), "undo cannot remove someone else's item");
  g1.run(`room.send({ t: 'clear' })`);
  c1.pump();
  assert.strictEqual(host.run('items.length'), 2, 'only the host clears the board');

  const g2 = createPage('whiteboard/index.html');
  const c2 = channelPair();
  host.sandbox.c2 = c2.a; g2.sandbox.ch = c2.b;
  host.run('r.addChannel(c2)');
  g2.run(`attach(Room.joinChannel(ch, 'Cy'))`);
  for (let k = 0; k < 4; k++) { c1.pump(); c2.pump(); }
  assert.deepStrictEqual(json(g2, 'items.map(i => i.id).sort()'), ['g1', 'h1']);

  g2.run(`share({ t: 'del', ids: ['g1'], erase: true })`);
  for (let k = 0; k < 4; k++) { c1.pump(); c2.pump(); }
  assert.deepStrictEqual(json(g1, 'items.map(i => i.id)'), ['h1'], "the eraser works on anyone's strokes");

  host.run(`share({ t: 'clear' })`);
  for (let k = 0; k < 4; k++) { c1.pump(); c2.pump(); }
  assert.strictEqual(g2.run('items.length'), 0);
});
