'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const fix = (lat, lng, extra = {}) => JSON.stringify({ t: 'pos', lat, lng, acc: 12, spd: null, hd: null, bat: 80, ts: Date.now(), ...extra });

test('everyone sees everyone: the host passes each location on, tagged with who sent it', () => {
  const host = createPage('live-location/index.html'), g1 = createPage('live-location/index.html'), g2 = createPage('live-location/index.html');
  const c1 = channelPair(), c2 = channelPair();
  host.sandbox.c1 = c1.a; host.sandbox.c2 = c2.a; g1.sandbox.ch = c1.b; g2.sandbox.ch = c2.b;
  const pump = () => { for (let i = 0; i < 3; i++) { c1.pump(); c2.pump(); } };
  host.run(`globalThis.r = Room.create('live-location', 'Amma'); r.addChannel(c1); r.addChannel(c2); attach(r);`);
  g1.run(`attach(Room.joinChannel(ch, 'Rohan'))`);
  g2.run(`attach(Room.joinChannel(ch, 'Asha'))`);
  pump();

  host.run(`(() => { const f = ${fix(12.93, 77.62)}; gotFix(myId(), f); send(f); })()`);
  g1.run(`(() => { const f = ${fix(12.96, 77.64, { spd: 8 })}; gotFix(myId(), f); send(f); })()`);
  pump();
  const seen = pg => JSON.parse(pg.run(`JSON.stringify([...people.entries()].filter(([, p]) => p.fix).map(([id, p]) => [id, p.name, p.fix.lat]).sort((a, b) => a[0] - b[0]))`));
  assert.deepStrictEqual(seen(host), [[0, 'You', 12.93], [1, 'Rohan', 12.96]]);
  assert.deepStrictEqual(seen(g1), [[0, 'Amma', 12.93], [1, 'You', 12.96]]);
  assert.deepStrictEqual(seen(g2), [[0, 'Amma', 12.93], [1, 'Rohan', 12.96]]);

  g1.run(`send({ t: 'stop' })`);
  pump();
  assert.strictEqual(g2.run('people.get(1).stopped'), true, 'stopping shows as stopped for the others');
  assert.match(g2.run(`document.getElementById('people').innerHTML`), /Stopped sharing|stopped sharing/);
});

test('someone joining late gets everyone\'s last location straight away', () => {
  const host = createPage('live-location/index.html'), late = createPage('live-location/index.html');
  const c = channelPair();
  host.sandbox.c = c.a; late.sandbox.ch = c.b;
  host.run(`globalThis.r = Room.create('live-location', 'Amma'); attach(r); gotFix(0, ${fix(12.93, 77.62)});`);
  host.run('r.addChannel(c)');
  late.run(`attach(Room.joinChannel(ch, 'Kabir'))`);
  for (let i = 0; i < 3; i++) c.pump();
  assert.strictEqual(late.run('people.get(0) && people.get(0).fix.lat'), 12.93);
});

test('bad positions are ignored, and a phone sitting still doesn\'t keep sending', () => {
  const p = createPage('live-location/index.html');
  const o = JSON.parse(p.run(`JSON.stringify({
    bad: [validFix({ lat: 95, lng: 0, ts: 1 }), validFix({ lat: '1', lng: 2, ts: 1 }), validFix({ lat: 12, lng: 77, ts: 1 })],
    still: worthSending({ lat: 12.9, lng: 77.6, sent: 1000 }, { lat: 12.90001, lng: 77.60001, acc: 10 }, 5000),
    moved: worthSending({ lat: 12.9, lng: 77.6, sent: 1000 }, { lat: 12.9003, lng: 77.6, acc: 10 }, 5000),
    later: worthSending({ lat: 12.9, lng: 77.6, sent: 1000 }, { lat: 12.9, lng: 77.6, acc: 10 }, 17000),
    packed: packFix({ coords: { latitude: 12.97159876, longitude: 77.59456, accuracy: 18.4, speed: 2.345, heading: NaN }, timestamp: 5 }, 55),
  })`));
  assert.deepStrictEqual(o.bad, [false, false, true]);
  assert.strictEqual(o.still, false);
  assert.strictEqual(o.moved, true);
  assert.strictEqual(o.later, true);
  assert.deepStrictEqual(o.packed, { t: 'pos', lat: 12.971599, lng: 77.59456, acc: 18, spd: 2.3, hd: null, bat: 55, ts: 5 });
});
