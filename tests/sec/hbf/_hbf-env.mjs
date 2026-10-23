// SEC-SWEEP #180 HBF page runner. Runs every inline (non-src) <script> of HerbalBookForge.html, in page order, unmodified,
// in one node:vm context with a permissive stub browser, then reads named top-level bindings off the context. Only
// TOP-LEVEL bindings are visible: a function declared inside another function never becomes a context global, so a nested
// same-named function can't stand in for a missing top-level one, and indentation doesn't matter (no text matching).
//   - top-level function/var declarations: properties of the context global
//   - top-level let/const: read by an export shim run after the page scripts (same global lexical scope), each name in its
//     own try/typeof guard. It runs as its own script so a throwing startup statement can't stop it.
// Stubs: document and elements are Proxy stubs (unknown property -> callable no-op stub; getElementById/querySelector ->
// stub elements); the vm context/window/globalThis is a plain object, so an undefined global reads as undefined; addEventListener records the listener and never fires it; fetch throws; localStorage, Blob,
// URL.createObjectURL/revokeObjectURL, <a>.click, alert, confirm, prompt and fake setTimeout/clearTimeout/setInterval
// append to one ordered `log` (timers fire only via runTimers()). Page startup is `window.onload = initializeApp`, which
// is recorded and never called.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { types } from 'node:util';
import { inlineScriptBodies } from './_hbf-html.mjs';
import { REPO } from '../_load.mjs';

export const HBF_FILE = path.join(REPO, 'HerbalBookForge', 'HerbalBookForge.html');
export const readHBF = () => fs.readFileSync(HBF_FILE, 'utf8');

export class LoaderError extends Error { constructor(m) { super(m); this.name = 'LoaderError'; } }

// Inline scripts come from the HTML tokenizer (_hbf-html.mjs): a <script> inside a comment, a JS string or a <textarea>
// is not run, and a script with a src attribute is skipped.
export function inlineScripts(src) {
  const out = inlineScriptBodies(src);
  if (!out.length) throw new LoaderError('loader could not find an inline <script> in HerbalBookForge.html');
  return out;
}

const ELEMENT_DEFAULTS = { value: '', textContent: '', innerHTML: '', innerText: '', outerHTML: '', className: '', id: '', checked: false, disabled: false, hidden: false, scrollTop: 0, scrollHeight: 0, selectedIndex: -1 };
function stub(extra = {}) {
  const store = new Map(Object.entries(extra));
  return new Proxy(function stubFn() {}, {
    get(t, k) {
      if (store.has(k)) return store.get(k);
      if (k === Symbol.toPrimitive) return () => '';
      if (k === Symbol.iterator) return function* () {};
      if (typeof k === 'symbol' || k === 'then') return undefined;
      if (k === 'toString' || k === 'valueOf' || k === 'toJSON') return () => '';
      if (k === 'length') return 0;
      if (k === 'prototype') return t.prototype;
      const c = stub(); store.set(k, c); return c;
    },
    set(t, k, v) { store.set(k, v); return true; },
    apply() { return stub(); },
    construct() { return stub(); },
  });
}

export function runPage(src, { names = [] } = {}) {
  const log = []; const listeners = []; const store = new Map(); const timers = new Map(); let tid = 0;
  const blobs = new Map(); let oid = 0;
  class Blob { constructor(parts = [], opts) { this.text = parts.map(String).join(''); this.type = opts?.type; this.size = this.text.length; log.push({ ev: 'blob', size: this.size }); } }
  class StubURL extends URL {
    static createObjectURL(b) { const u = 'blob:hbf/' + ++oid; blobs.set(u, b); log.push({ ev: 'createObjectURL', url: u }); return u; }
    static revokeObjectURL(u) { log.push({ ev: 'revokeObjectURL', url: u }); }
  }
  const on = (where) => (type, fn) => { listeners.push({ where, type: String(type), fn }); };
  const element = (tag) => stub({ ...ELEMENT_DEFAULTS, tagName: String(tag || 'div').toUpperCase(), style: stub(), dataset: {}, children: [], childNodes: [], options: [], files: [],
    addEventListener: on(`element:${tag}`), removeEventListener() {}, querySelectorAll: () => [], getElementsByTagName: () => [], getElementsByClassName: () => [] });
  const anchor = () => { const a = element('a'); a.click = () => { const b = blobs.get(a.href); log.push({ ev: 'download', name: a.download, text: b ? b.text : null }); }; return a; };
  const byId = new Map();
  const document = stub({ getElementById: (id) => { if (!byId.has(id)) byId.set(id, element(`#${id}`)); return byId.get(id); },
    querySelector: (q) => element(q), querySelectorAll: () => [], getElementsByClassName: () => [], getElementsByTagName: () => [],
    createElement: (t) => (String(t).toLowerCase() === 'a' ? anchor() : element(t)), createTextNode: () => element('#text'),
    addEventListener: on('document'), removeEventListener() {}, body: element('body'), head: element('head'), documentElement: element('html'), visibilityState: 'visible', readyState: 'loading' });
  const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); log.push({ ev: 'setItem', key: k, value: String(v) }); },
    removeItem: (k) => { store.delete(k); log.push({ ev: 'removeItem', key: k }); }, clear: () => store.clear(), key: () => null, get length() { return store.size; } };
  const setTimeout = (fn, ms = 0) => { const id = ++tid; timers.set(id, { fn, ms }); log.push({ ev: 'setTimeout', id, ms }); return id; };
  const clearTimeout = (id) => { if (timers.delete(id)) log.push({ ev: 'clearTimeout', id }); };
  const env = { URL: StubURL, URLSearchParams, Blob, document, localStorage, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, setTimeout, clearTimeout,
    setInterval: (fn, ms) => { log.push({ ev: 'setInterval', ms }); return ++tid; }, clearInterval() {}, requestAnimationFrame: (f) => setTimeout(f, 16), cancelAnimationFrame() {},
    console: { log() {}, info() {}, warn() {}, error() {}, debug() {} }, alert: (m) => log.push({ ev: 'alert', text: String(m) }), confirm: (m) => { log.push({ ev: 'confirm', text: String(m) }); return true; }, prompt: () => null,
    fetch: () => { throw new Error('fetch called in the HBF test harness'); },
    navigator: { userAgent: 'node-test', clipboard: { writeText: async () => {} } }, location: { href: 'file:///HerbalBookForge.html', search: '', hash: '', reload() {} }, history: { pushState() {}, replaceState() {} },
    FileReader: function FileReader() { return { readAsText() {}, onload: null }; }, MutationObserver: function () { return { observe() {}, disconnect() {} }; },
    IntersectionObserver: function () { return { observe() {}, disconnect() {} }; }, ResizeObserver: function () { return { observe() {}, disconnect() {} }; },
    getComputedStyle: () => element('style'), Event: function (type) { return { type }; }, CustomEvent: function (type, init) { return { type, detail: init?.detail }; }, performance, TextEncoder, TextDecoder, structuredClone, queueMicrotask: () => {} };
  // The context and window/globalThis are a PLAIN object: an undefined global reads as undefined (never a stub). Proxies
  // are only the document and element stubs.
  const ctx = vm.createContext({ ...env });
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx; ctx.addEventListener = on('window'); ctx.removeEventListener = () => {};
  const stubNames = new Set(Object.keys(ctx));
  const startupErrors = [];
  inlineScripts(src).forEach((code, i) => { try { vm.runInContext(code, ctx, { filename: `HerbalBookForge.html#script${i}` }); } catch (e) { startupErrors.push(`script${i}: ${e && e.message}`); } });
  const want = [...new Set(names)].filter((n) => /^[A-Za-z_$][\w$]*$/.test(n));
  vm.runInContext(`globalThis.__hbfx = {};\n${want.map((n) => `try { if (typeof ${n} !== 'undefined') __hbfx[${JSON.stringify(n)}] = ${n}; } catch (e) {}`).join('\n')}\n`
    + `try { globalThis.__hbfProject = { get: () => project, set: (v) => { project = v; } }; } catch (e) {}`, ctx, { filename: 'HBF-export-shim' });
  // A stub (Proxy) value is never a page binding: a page that sets e.g. `var secRuleId = document.getElementById('x')`
  // must read as ABSENT / LoaderError, not as a callable function.
  const found = {}; const rejected = [];
  for (const [k, v] of Object.entries(ctx.__hbfx)) { if (types.isProxy(v)) rejected.push(k); else found[k] = v; }
  // Top-level functions the page declared (context globals that are functions and were not part of the stub env).
  const declared = Object.keys(ctx).filter((k) => !stubNames.has(k) && !k.startsWith('__hbf') && typeof ctx[k] === 'function').sort();
  const runTimers = () => { for (const [id, t] of [...timers]) { timers.delete(id); log.push({ ev: 'timerFired', id, ms: t.ms }); t.fn(); } };
  return { ctx, found, rejected, declared, log, listeners, store, timers, runTimers, startupErrors, project: ctx.__hbfProject,
    OP: vm.runInContext('Object.prototype', ctx), JP: vm.runInContext('JSON.parse', ctx), JS: vm.runInContext('JSON.stringify', ctx) };
}

// Required FUNCTION names: each entry (or one of its a|b alternatives) must be a real function (typeof 'function', not a
// stub Proxy, which runPage already dropped). Non-function bindings (project) are checked explicitly by the caller.
export function requireNames(found, names) {
  for (const n of names) {
    const alts = n.split('|');
    if (!alts.some((a) => typeof found[a] === 'function' && !types.isProxy(found[a]))) throw new LoaderError(`loader could not find ${alts.join(' or ')}`);
  }
}
// An optional feature function: the function, or undefined when absent / not a function (test-level ABSENT).
export const featureFn = (found, n) => (typeof found[n] === 'function' && !types.isProxy(found[n]) ? found[n] : undefined);
