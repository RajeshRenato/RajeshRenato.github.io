'use strict';
// Minimal browser stand-ins so the games can run headless in Node.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

// A 2D context that accepts any call or property and returns itself.
const ctx2d = new Proxy(function () {}, {
  get(target, key) {
    if (key === 'measureText') return () => ({ width: 50 });
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
    if (key === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    if (key === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    return ctx2d;
  },
  set() { return true; },
  apply() { return ctx2d; },
});

function element() {
  return {
    style: {}, dataset: {}, value: '', textContent: '', innerHTML: '',
    width: 300, height: 150, clientWidth: 900, clientHeight: 700,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, appendChild(c) { return c; }, remove() {},
    setAttribute() {}, focus() {}, blur() {},
    getContext: () => ctx2d,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 700 }),
    querySelector: () => element(),
    querySelectorAll: () => [],
  };
}

function install() {
  const store = new Map();
  const ids = new Map();
  const g = globalThis;
  Object.assign(g, {
    window: g,
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    addEventListener() {}, removeEventListener() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: k => { store.delete(k); },
    },
    history: { replaceState() {}, pushState() {} },
    location: { hash: '', href: 'http://localhost/', search: '' },
    document: {
      getElementById: id => {
        if (!ids.has(id)) ids.set(id, element());
        return ids.get(id);
      },
      createElement: () => element(),
      querySelector: () => element(),
      querySelectorAll: () => [],
      documentElement: element(),
      body: element(),
      addEventListener() {},
    },
  });
  Object.defineProperty(g, 'navigator', {
    value: { clipboard: { writeText: async () => {} }, userAgent: 'node' },
    configurable: true, writable: true,
  });
}

// Scripts of a page in document order: [{ code, filename }]
function pageScripts(relPath) {
  const file = path.join(ROOT, relPath);
  const html = fs.readFileSync(file, 'utf8');
  const out = [];
  const re = /<script(?:\s+src="([^"]+)")?\s*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) {
      const src = path.join(path.dirname(file), m[1]);
      out.push({ code: fs.readFileSync(src, 'utf8'), filename: src });
    } else {
      out.push({ code: m[2], filename: file });
    }
  }
  return out;
}

// Runs a page's scripts in this process's global scope, as a browser would.
function load(relPath) {
  install();
  for (const s of pageScripts(relPath)) vm.runInThisContext(s.code, { filename: s.filename });
}

// Evaluates code in the same global scope, so top-level let/const are reachable.
function run(code) {
  return vm.runInThisContext(code);
}

module.exports = { ROOT, ctx2d, load, run, pageScripts };
