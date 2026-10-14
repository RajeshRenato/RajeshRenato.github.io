'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage } = require('./helpers/browser');

const { run, sandbox } = createPage('screen-recorder/index.html');

const ascii = s => [...s].map(c => c.charCodeAt(0));
// a minimal WebM in the shape MediaRecorder writes: EBML header, Segment, Info (no Duration), Tracks, Cluster
function webm({ knownSegmentSize = false } = {}) {
  const ebml = [0x1a, 0x45, 0xdf, 0xa3, 0x87, 0x42, 0x82, 0x84, ...ascii('webm')];
  const info = [0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40, 0x4d, 0x80, 0x86, ...ascii('Chrome')];
  const infoEl = [0x15, 0x49, 0xa9, 0x66, 0x80 | info.length, ...info];
  const tracks = [0x16, 0x54, 0xae, 0x6b, 0x83, 0xae, 0x81, 0x00];
  const cluster = [0x1f, 0x43, 0xb6, 0x75, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xe7, 0x81, 0x00];
  const body = [...infoEl, ...tracks, ...cluster];
  const segSize = knownSegmentSize ? [0x10, 0x00, 0x00, body.length] : [0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
  return Uint8Array.from([...ebml, 0x18, 0x53, 0x80, 0x67, ...segSize, ...body]);
}

function findDuration(b) {
  for (let i = 0; i + 11 <= b.length; i++) {
    if (b[i] === 0x44 && b[i + 1] === 0x89 && b[i + 2] === 0x88) return new DataView(b.buffer, b.byteOffset + i + 3, 8).getFloat64(0);
  }
  return null;
}

test('a missing WebM duration is written into Segment Info', () => {
  sandbox.file = webm();
  assert.strictEqual(findDuration(sandbox.file), null);
  const out = run('setWebmDuration(file, 83456)');
  assert.strictEqual(findDuration(out), 83456);
  const infoSize = f => run(`(() => { const b = ${f}; const p = b.indexOf(0x15); return readVint(b, p + 4).value; })()`);
  assert.strictEqual(infoSize('setWebmDuration(file, 83456)'), infoSize('file') + 11, 'Info grows by exactly the new Duration element');
  assert.deepStrictEqual(Array.from(out.slice(out.length - 15)), Array.from(sandbox.file.slice(sandbox.file.length - 15)), 'the cluster is untouched');
});

test('a known Segment size grows by the inserted bytes', () => {
  sandbox.file = webm({ knownSegmentSize: true });
  const segSizeAt = 12 + 4;
  const before = run(`readVint(file, ${segSizeAt}).value`);
  const out = run('setWebmDuration(file, 1500)');
  sandbox.out = out;
  assert.strictEqual(run(`readVint(out, ${segSizeAt}).value`), before + (out.length - sandbox.file.length));
  assert.strictEqual(findDuration(out), 1500);
});

test('files that already have a duration are updated in place, and non-WebM is left alone', () => {
  sandbox.file = webm();
  sandbox.once = run('setWebmDuration(file, 1000)');
  const twice = run('setWebmDuration(once, 2500)');
  assert.strictEqual(twice.length, sandbox.once.length, 'no second Duration element');
  assert.strictEqual(findDuration(twice), 2500);
  sandbox.junk = Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]);
  assert.strictEqual(run('setWebmDuration(junk, 10)'), sandbox.junk);
});

test('MP4 is preferred when the browser can record it, otherwise WebM', () => {
  assert.deepStrictEqual(JSON.parse(run(`JSON.stringify(pickFormat(m => m.startsWith('video/mp4')))`)), { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' });
  assert.strictEqual(JSON.parse(run(`JSON.stringify(pickFormat(m => m === 'video/webm;codecs=vp9,opus'))`)).ext, 'webm');
  assert.strictEqual(run('pickFormat(() => false)'), null);
});

test('times and file names read naturally', () => {
  assert.strictEqual(run('fmtTime(0)'), '0:00');
  assert.strictEqual(run('fmtTime(83456)'), '1:23');
  assert.strictEqual(run('fmtTime(3725000)'), '1:02:05');
  assert.strictEqual(run(`fileName(new Date(2026, 9, 14, 9, 5), 'webm')`), 'screen-recording-2026-10-14-0905.webm');
});

test('without screen capture support the page says so instead of failing', () => {
  assert.strictEqual(run(`document.getElementById('unsupported').hidden`), false);
  assert.strictEqual(run(`document.getElementById('startBtn').disabled`), true);
});
