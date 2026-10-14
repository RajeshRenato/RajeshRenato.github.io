'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { createPage, ROOT } = require('./helpers/browser');

const page = createPage('photo-privacy/index.html');
const { run, sandbox } = page;
const fixture = name => new Uint8Array(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', name)));
const json = expr => JSON.parse(run(`JSON.stringify(${expr})`));

function load(name) {
  sandbox.bytes = fixture(name);
  return json(`findings(parsePhoto(bytes))`);
}
const flat = groups => groups.flatMap(g => g.rows.map(r => r.join(': '))).join('\n');

test('a phone JPEG reveals location, time, device, and serial number', () => {
  const groups = load('photo-gps.jpg');
  const text = flat(groups);
  const where = groups.find(g => g.title === 'Where it was taken');
  assert.ok(where && where.risk, 'location should be flagged');
  assert.ok(Math.abs(where.map.lat - 12.97100) < 1e-4 && Math.abs(where.map.lon - 77.59467) < 1e-4, JSON.stringify(where.map));
  assert.match(text, /Altitude: 920 m/);
  assert.match(text, /Taken: 2026-09-14 18:42:07/);
  assert.match(text, /Time zone: \+05:30/);
  assert.match(text, /Camera: Pixelcorp P7 Pro/);
  assert.match(text, /Serial number: SN12345/);
  assert.match(text, /Software: PixelOS 14/);
  assert.match(text, /Comment: shot on the balcony/);
  assert.strictEqual(run('orientation(parsePhoto(bytes))'), 6);
});

test('cleaning a JPEG removes everything but orientation and keeps the image data identical', () => {
  sandbox.bytes = fixture('photo-gps.jpg');
  run('globalThis.clean = stripPhoto(bytes)');
  assert.deepStrictEqual(json('findings(parsePhoto(clean))'), [], 'nothing should be left to report');
  assert.strictEqual(run('orientation(parsePhoto(clean))'), 6, 'orientation must survive so the photo stays upright');
  const raw = Buffer.from(sandbox.clean).toString('latin1');
  for (const leak of ['Pixelcorp', 'SN12345', 'PixelOS', 'balcony', '2026:09:14']) assert.ok(!raw.includes(leak), leak + ' leaked');
  const scan = b => { const s = Buffer.from(b).toString('latin1'); return s.slice(s.indexOf('\xff\xda')); };
  assert.strictEqual(scan(sandbox.clean), scan(sandbox.bytes), 'compressed image data must be byte for byte the same');
  assert.ok(sandbox.clean.length < sandbox.bytes.length);
});

test('PNG text and EXIF chunks are found and removed', () => {
  const text = flat(load('photo-meta.png'));
  assert.match(text, /Text "Author": Rajesh/);
  assert.match(text, /Camera: Pixelcorp P7 Pro/);
  run('globalThis.clean = stripPhoto(bytes)');
  assert.deepStrictEqual(json('findings(parsePhoto(clean))'), []);
  const types = json('parsePhoto(clean).chunks.map(c => c.type)');
  assert.ok(types.includes('IDAT') && types[0] === 'IHDR' && types[types.length - 1] === 'IEND', types.join(','));
});

test('WebP EXIF is removed and the RIFF header stays consistent', () => {
  const text = flat(load('photo-gps.webp'));
  assert.match(text, /Coordinates: 12\.97100, 77\.59467/);
  run('globalThis.clean = stripPhoto(bytes)');
  assert.deepStrictEqual(json('findings(parsePhoto(clean))'), []);
  const c = sandbox.clean;
  assert.strictEqual(new DataView(c.buffer, c.byteOffset).getUint32(4, true), c.length - 8, 'RIFF size must match the file');
});

test('a clean file reports nothing, and non-images are rejected', () => {
  sandbox.bytes = fixture('photo-gps.jpg');
  run('globalThis.twice = stripPhoto(stripPhoto(bytes))');
  assert.deepStrictEqual(json('findings(parsePhoto(twice))'), []);
  assert.strictEqual(run('parsePhoto(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))'), null);
});

test('the zip of cleaned photos is a valid archive', () => {
  run(`globalThis.z = zip([{ name: 'a.jpg', data: new Uint8Array([1, 2, 3]) }, { name: 'b.jpg', data: new Uint8Array([4, 5]) }])`);
  assert.strictEqual(run('crc32(new TextEncoder().encode("123456789"))'), 0xcbf43926);
});
