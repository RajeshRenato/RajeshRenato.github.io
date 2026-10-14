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

// A small stand-in for a DOM element. Elements made with createElement keep real
// children and find descendants by class; elements fetched by id answer any lookup.
function element(tag = 'div', forgiving = false) {
  const el = {
    tagName: String(tag).toUpperCase(), children: [], parentNode: null,
    style: {}, dataset: {}, value: '', textContent: '', innerHTML: '', className: '', hidden: false,
    width: 300, height: 150, clientWidth: 900, clientHeight: 700,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, focus() {}, blur() {}, click() {}, select() {},
    getContext: () => ctx2d,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 700 }),
    get firstChild() { return el.children[0] || null; },
    append(...nodes) {
      for (const n of nodes) {
        if (n === null || n === undefined) continue;
        if (typeof n !== 'object') { el.textContent += String(n); continue; }
        el.children.push(n); n.parentNode = el;
      }
    },
    appendChild(n) { el.append(n); return n; },
    replaceChildren(...nodes) { el.children = []; el.append(...nodes); },
    remove() { if (el.parentNode) el.parentNode.children = el.parentNode.children.filter(c => c !== el); },
    querySelectorAll(sel) {
      if (!sel.startsWith('.')) return [];
      const cls = ' ' + sel.slice(1) + ' ', out = [];
      const walk = n => { for (const c of n.children || []) { if ((' ' + c.className + ' ').includes(cls)) out.push(c); walk(c); } };
      walk(el);
      return out;
    },
    querySelector(sel) { return el.querySelectorAll(sel)[0] || (forgiving ? element() : null); },
  };
  return el;
}

function install(g = globalThis) {
  const store = new Map();
  const ids = new Map();
  Object.assign(g, {
    window: g,
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    addEventListener() {}, removeEventListener() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    setInterval: () => 0, clearInterval() {},
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
        if (!ids.has(id)) ids.set(id, element('div', true));
        return ids.get(id);
      },
      createElement: tag => element(tag),
      querySelector: () => element('div', true),
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

// Loads a page into its own sandbox, so two copies (say a host and a guest) can run side by side.
function createPage(relPath, hash = '') {
  const sandbox = {
    console, setTimeout, clearTimeout, performance, btoa, atob,
    TextEncoder, TextDecoder, Blob, Response, CompressionStream, DecompressionStream, URL,
    crypto: require('crypto').webcrypto,
  };
  install(sandbox);
  sandbox.location.hash = hash;
  vm.createContext(sandbox);
  for (const s of pageScripts(relPath)) vm.runInContext(s.code, sandbox, { filename: s.filename });
  return { sandbox, run: code => vm.runInContext(code, sandbox) };
}

// Two in-memory ends of a data channel. Messages queue until pump() delivers them.
function channelPair() {
  const toA = [], toB = [];
  const a = { readyState: 'open', send: m => toB.push(m) };
  const b = { readyState: 'open', send: m => toA.push(m) };
  const close = () => {
    if (a.readyState === 'closed') return;
    a.readyState = b.readyState = 'closed';
    if (a.onclose) a.onclose();
    if (b.onclose) b.onclose();
  };
  a.close = b.close = close;
  return {
    a, b, close,
    pump() {
      while (toA.length || toB.length) {
        while (toB.length) b.onmessage({ data: toB.shift() });
        while (toA.length) a.onmessage({ data: toA.shift() });
      }
    },
  };
}

module.exports = { ROOT, ctx2d, load, run, pageScripts, createPage, channelPair };
