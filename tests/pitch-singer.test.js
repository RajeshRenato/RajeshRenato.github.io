'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage } = require('./helpers/browser');

const page = createPage('pitch-singer/index.html');
const json = expr => JSON.parse(page.run(`JSON.stringify(${expr})`));
const SR = 48000;

// A 2048-sample frame of a test signal at f Hz.
function frame(f, kind, seed = 1) {
  const out = new Float32Array(2048);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) - 0.5;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR, ph = (f * t) % 1;
    if (kind === 'sine') out[i] = 0.5 * Math.sin(2 * Math.PI * f * t);
    else if (kind === 'saw') out[i] = 0.4 * (2 * ph - 1);
    // a voice-like tone: strong second and third harmonics, a little breath noise
    else out[i] = 0.3 * Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t + 0.7) + 0.2 * Math.sin(6 * Math.PI * f * t + 1.9) + 0.03 * rnd();
  }
  return out;
}
const detect = (f, kind) => { page.sandbox.buf = frame(f, kind); return json(`yin(buf, ${SR})`); };
const cents = (a, b) => 1200 * Math.log2(a / b);

test('YIN finds the pitch within a few cents across the singing range', () => {
  for (const kind of ['sine', 'saw', 'voice']) {
    for (const f of [82.41, 110, 146.83, 196, 261.63, 329.63, 440, 587.33, 880]) {
      const r = detect(f, kind);
      assert.ok(r, kind + ' ' + f + ' Hz detected');
      assert.ok(Math.abs(cents(r.freq, f)) < 6, kind + ' ' + f + ' Hz read as ' + r.freq.toFixed(2));
    }
  }
});

test('silence and noise give no pitch', () => {
  page.sandbox.buf = new Float32Array(2048);
  assert.strictEqual(page.run(`yin(buf, ${SR})`), null);
  let s = 7;
  page.sandbox.buf = Float32Array.from({ length: 2048 }, () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5) * 0.6);
  assert.strictEqual(page.run(`yin(buf, ${SR})`), null);
});

test('note names, octaves, and folding', () => {
  assert.strictEqual(page.run('midiName(60)'), 'C4');
  assert.strictEqual(page.run('midiName(69)'), 'A4');
  assert.strictEqual(page.run('midiName(61)'), 'C♯4');
  assert.strictEqual(page.run(`parseNote('E2')`), 40);
  assert.strictEqual(page.run(`parseNote('G4')`), 67);
  assert.strictEqual(page.run('Math.round(freqToMidi(440) * 1000)'), 69000);
  assert.strictEqual(page.run('foldDiff(48, 60) === 0'), true, 'an octave down is the same note');
  assert.strictEqual(page.run('foldDiff(73, 60)'), 1);
  assert.strictEqual(page.run('foldDiff(59.5, 72)'), -0.5);
});

test('every song is well formed', () => {
  const songs = json('SONGS.map(s => ({ id: s.id, bpm: s.bpm, notes: s.notes }))');
  assert.ok(songs.length >= 7);
  for (const s of songs) {
    assert.ok(s.bpm >= 60 && s.bpm <= 160, s.id);
    for (const [m, len, word] of s.notes) {
      assert.ok(m >= 48 && m <= 84, s.id + ' note in a singable range: ' + m);
      assert.ok(len > 0 && len <= 4, s.id);
      assert.match(word, /^[A-Za-z']+[-,.!?]?$/, s.id + ' syllable ' + word);
    }
    assert.match(s.notes[s.notes.length - 1][2], /[.!?]$/, s.id + ' ends a sentence');
  }
});

test('scoring: right notes in any octave score full, wrong notes and silence do not', () => {
  // sing a song by feeding the run 30 readings per beat
  const sing = (pitch, id = 'twinkle') => page.run(`(() => {
    const s = SONGS.find(x => x.id === '${id}'), r = newRun(s), tl = timeline(s), end = tl[tl.length - 1].end;
    for (let b = 0; b < end; b += 1 / 30) { const n = tl.find(k => b >= k.start && b < k.end); r.feed(b, (${pitch})(n.m, b)); }
    return r.score();
  })()`);
  assert.strictEqual(sing('m => m'), 100);
  assert.strictEqual(sing('m => m - 12'), 100, 'an octave lower');
  assert.strictEqual(sing('m => m + 24', 'birthday'), 100, 'two octaves higher');
  assert.strictEqual(sing('m => m + 0.15'), 100, 'slightly sharp is still on it');
  assert.strictEqual(sing('m => m + 0.45'), 60);
  assert.strictEqual(sing('m => m + 1'), 25);
  assert.strictEqual(sing('m => m + 2'), 0);
  assert.strictEqual(sing('m => null'), 0);
  const half = sing('(m, b) => (Math.floor(b / 4) % 2 ? m : m + 3)');
  assert.ok(half > 35 && half < 65, 'right half the time scores about half: ' + half);
  assert.strictEqual(json('[starsFor(90), starsFor(72), starsFor(55), starsFor(20)]').join(), '3,2,1,0');
});

test('the tuner picks the nearest string', () => {
  page.run(`$('inst').value = 'E2 A2 D3 G3 B3 E4'`);
  assert.deepStrictEqual(json('strings()'), [40, 45, 50, 55, 59, 64]);
  assert.strictEqual(page.run('nearestString(44.4, strings())'), 45);
  assert.strictEqual(page.run('nearestString(39.2, strings())'), 40);
  assert.strictEqual(page.run('nearestString(62, [])'), null);
});
