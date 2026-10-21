'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));

function party(n = 2) {
  const host = createPage('watch-party/index.html');
  host.run(`globalThis.r = Room.create('watch-party', 'Ana'); startParty(r);`);
  const guests = [], chans = [];
  for (let i = 1; i < n; i++) {
    const g = createPage('watch-party/index.html');
    const c = channelPair();
    host.sandbox.c = c.a; host.run('r.addChannel(c)');
    g.sandbox.ch = c.b; g.run(`startParty(Room.joinChannel(ch, ${JSON.stringify(['Bo', 'Cy'][i - 1])}))`);
    guests.push(g); chans.push(c);
  }
  const pump = () => { for (let k = 0; k < 4; k++) for (const c of chans) c.pump(); };
  pump();
  return { host, guests, pump };
}

test('drift correction: small gaps speed up or slow down, big gaps seek, paused videos snap', () => {
  const { run } = createPage('watch-party/index.html');
  assert.deepStrictEqual(json({ run }, 'correction(10, 10.01, true, 1)'), { seek: null, rate: 1 }, 'close enough');
  const ahead = json({ run }, 'correction(10, 10.3, true, 1)');
  assert.strictEqual(ahead.seek, null);
  assert.ok(ahead.rate > 1 && ahead.rate <= 1.12, 'behind by 0.3 s speeds up gently');
  const behind = json({ run }, 'correction(10.3, 10, true, 1.5)');
  assert.ok(behind.rate < 1.5 && behind.rate >= 1.5 * 0.88, 'ahead slows down, relative to the chosen speed');
  assert.deepStrictEqual(json({ run }, 'correction(10, 12, true, 1)'), { seek: 12, rate: 1 }, 'more than half a second away seeks');
  assert.deepStrictEqual(json({ run }, 'correction(10, 10.2, false, 1)'), { seek: 10.2, rate: 1 }, 'paused: jump to the exact frame');
  assert.deepStrictEqual(json({ run }, 'correction(10, 10.02, false, 1)'), { seek: null, rate: 1 });
  assert.strictEqual(run('clockAt({ playing: true, time: 5, rate: 2, at: 1000 }, 4000)'), 11);
  assert.strictEqual(run('clockAt({ playing: false, time: 5, rate: 2, at: 1000 }, 4000)'), 5);
});

test('play, seek, speed, and pause from a guest go through the host and reach everyone', () => {
  const { host, guests, pump } = party(3);
  const [bo, cy] = guests;
  bo.run(`act('play')`);
  pump();
  assert.strictEqual(host.run('clock.playing'), true);
  assert.strictEqual(cy.run('clock.playing'), true, 'the other guest follows');
  bo.run(`act('seek', { time: 42 })`);
  pump();
  for (const p of [host, cy]) assert.ok(Math.abs(p.run('clockAt(clock, performance.now())') - 42) < 0.2);
  cy.run(`act('rate', { rate: 1.5 })`);
  pump();
  assert.strictEqual(bo.run('clock.rate'), 1.5);
  host.run(`act('pause')`);
  pump();
  assert.strictEqual(bo.run('clock.playing'), false);
  assert.strictEqual(cy.run('clock.playing'), false);
  bo.run(`room.send({ t: 'cmd', action: 'rate', rate: 99 })`);
  pump();
  assert.strictEqual(host.run('clock.rate'), 1.5, 'odd speeds are ignored');
});

test('the local video is steered toward the shared clock', () => {
  const { host } = party(1);
  host.run(`globalThis.v = $('video'); v.currentTime = 0; v.paused = true; v.playbackRate = 1;
    v.play = () => { v.paused = false; }; v.pause = () => { v.paused = true; };
    myStatus.duration = 120;`);
  host.run(`act('seek', { time: 30 }); act('play'); steer()`);
  assert.ok(Math.abs(host.run('v.currentTime') - 30) < 0.2, 'seeks to the shared position');
  assert.strictEqual(host.run('v.paused'), false);
  host.run(`v.currentTime -= 0.25; steer()`);
  assert.ok(host.run('v.playbackRate') > 1, 'catches up by playing a little faster');
  host.run(`act('pause'); steer()`);
  assert.strictEqual(host.run('v.paused'), true);
});

test('everyone sees each other\'s file and state, and different lengths are flagged', () => {
  const { host, guests, pump } = party(2);
  const [bo] = guests;
  host.run(`setStatus({ file: 'movie.mp4', duration: 5400, state: 'ready' })`);
  bo.run(`setStatus({ file: 'movie (1).mp4', duration: 5400.4, state: 'buffering' })`);
  pump();
  assert.deepStrictEqual(json(bo, 'people[1]'), { file: 'movie (1).mp4', duration: 5400.4, state: 'buffering', mic: false });
  assert.strictEqual(json(bo, 'mismatches()').length, 0, 'a fraction of a second is fine');
  bo.run(`setStatus({ duration: 5520 })`);
  pump();
  const mm = json(host, 'mismatches()');
  assert.strictEqual(mm.length, 1);
  assert.strictEqual(mm[0].name, "Bo's");
  assert.strictEqual(Math.round(mm[0].diff), 120);
  assert.match(host.run(`$('warn').textContent`), /120 seconds longer/);
});

test('chat and reactions go to everyone, and chat text is never treated as HTML', () => {
  const { host, guests, pump } = party(3);
  const [bo, cy] = guests;
  bo.run(`sendChat('<b>hi</b> everyone')`);
  pump();
  for (const p of [host, bo, cy]) {
    const last = p.run(`$('chat').children[$('chat').children.length - 1].children.map(x => x.textContent || x).join('')`);
    assert.match(String(last), /<b>hi<\/b> everyone/);
  }
  cy.run(`react('😂')`);
  pump();
  for (const p of [host, bo, cy]) assert.strictEqual(p.run(`$('floats').children.length`), 1);
});

test('the host stops the shared clock at the end of the longest video', () => {
  const { host, guests, pump } = party(2);
  host.run(`setStatus({ file: 'a.mp4', duration: 60, state: 'ready' })`);
  guests[0].run(`setStatus({ file: 'a.mp4', duration: 61, state: 'ready' })`);
  pump();
  host.run(`act('seek', { time: 60.9 }); act('play'); clock.at -= 500; endCheck()`);
  pump();
  assert.strictEqual(host.run('clock.playing'), false);
  assert.strictEqual(guests[0].run('clock.playing'), false);
  assert.strictEqual(guests[0].run('clock.time'), 61);
});
