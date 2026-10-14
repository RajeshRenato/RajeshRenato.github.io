'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage } = require('./helpers/browser');

const page = createPage('qr-studio/index.html');
const { run } = page;
const json = expr => JSON.parse(run(`JSON.stringify(${expr})`));

test('data capacities match the QR standard', () => {
  const cases = [[1, 0, 19], [1, 1, 16], [1, 2, 13], [1, 3, 9], [10, 1, 216], [25, 2, 718], [40, 0, 2956], [40, 3, 1276]];
  for (const [ver, lvl, want] of cases) assert.strictEqual(run(`dataCodewords(${ver}, ${lvl})`), want, `version ${ver} level ${lvl}`);
});

test('HELLO WORLD at 1-M gives the textbook data and error correction bytes', () => {
  const enc = json(`encodeData('HELLO WORLD', 1)`);
  assert.strictEqual(enc.ver, 1);
  assert.strictEqual(enc.mode, 'alnum');
  assert.deepStrictEqual(enc.bytes, [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17]);
  assert.deepStrictEqual(json(`rsRemainder(${JSON.stringify(enc.bytes)}, rsDivisor(10))`), [196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
});

test('format information matches the published table', () => {
  const table = { L: '111011111000100', M: '101010000010010', Q: '011010101011111', H: '001011010001001' };
  for (const [level, want] of Object.entries(table)) {
    const m = json(`makeQR('test', '${level}', { mask: 0 }).modules`);
    const bits = [];
    for (let i = 0; i <= 5; i++) bits.push(m[i][8]);
    bits.push(m[7][8], m[8][8], m[8][7]);
    for (let i = 9; i < 15; i++) bits.push(m[8][14 - i]);
    const got = bits.map(b => (b ? '1' : '0')).reverse().join('');
    assert.strictEqual(got, want, 'format bits for ' + level + ' mask 0');
  }
});

test('version information for version 7 matches the published pattern', () => {
  const qr = json(`makeQR('x'.repeat(130), 'L', { minVer: 7 })`);
  assert.strictEqual(qr.ver, 7);
  let bits = '';
  for (let i = 17; i >= 0; i--) bits += qr.modules[Math.floor(i / 3)][qr.size - 11 + i % 3] ? '1' : '0';
  assert.strictEqual(bits, '000111110010010100');
});

test('alignment patterns sit where the standard puts them', () => {
  assert.deepStrictEqual(json('alignmentPositions(1)'), []);
  assert.deepStrictEqual(json('alignmentPositions(7)'), [6, 22, 38]);
  assert.deepStrictEqual(json('alignmentPositions(32)'), [6, 34, 60, 86, 112, 138]);
  assert.deepStrictEqual(json('alignmentPositions(40)'), [6, 30, 58, 86, 114, 142, 170]);
});

test('the largest code holds exactly 2953 bytes', () => {
  assert.ok(run(`makeQR('a'.repeat(2953), 'L') !== null`));
  assert.strictEqual(run(`makeQR('a'.repeat(2954), 'L')`), null);
  assert.strictEqual(run(`makeQR('a'.repeat(2954), 'L')`), null);
  assert.strictEqual(run(`makeQR('7'.repeat(7089), 'L').ver`), 40, 'numeric mode packs 7089 digits');
});

test('content builders escape Wi-Fi fields and build contact cards', () => {
  run(`kind = 'wifi';
       document.getElementById('f-ssid').value = 'Cafe;Guest';
       document.getElementById('f-wpw').value = 'p:ss\\\\word';
       document.getElementById('f-sec').value = 'WPA';
       document.getElementById('f-hidden').checked = false;`);
  assert.strictEqual(run('payload()'), 'WIFI:T:WPA;S:Cafe\\;Guest;P:p\\:ss\\\\word;;');
  run(`kind = 'contact';
       for (const [id, v] of [['f-first', 'Asha'], ['f-last', 'Rao'], ['f-phone', '+91 98450 00000'], ['f-mail', 'asha@example.com'], ['f-org', ''], ['f-url', '']]) document.getElementById(id).value = v;`);
  assert.strictEqual(run('payload()'), 'BEGIN:VCARD\nVERSION:3.0\nN:Rao;Asha;;;\nFN:Asha Rao\nTEL:+91 98450 00000\nEMAIL:asha@example.com\nEND:VCARD');
});
