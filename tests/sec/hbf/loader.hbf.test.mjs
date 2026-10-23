// SEC-SWEEP #180 HBF loader fixtures (Engineering + Reviewer probes on 31eb082a). The loaders (_hbf-env.mjs, used by
// _hbf-load.mjs and _hbf-app.mjs) run the page and read TOP-LEVEL bindings only, so:
//   L1  re-indenting the page script (original 8/4, 4-space from column 0, 2-space) loads the same function set and the
//       rule functions behave identically;
//   L2-L4  a NESTED function (declared inside another function, here at 8 spaces, and placed BEFORE the real ones so a
//       first-match text extractor would take it) never stands in for a missing top-level one: required names give a
//       LoaderError, feature names (scheduleProjectSave) stay ABSENT;
//   L5  when both exist, the top-level one is loaded.
//   L6  a <script> inside a comment or a <textarea> never runs (HTML tokenizer, _hbf-html.mjs).
//   L7  the vm context is a plain object: window === globalThis === the context, not a Proxy; undefined globals read undefined.
//   L8  Reviewer's secRuleId probes on a C2-contract base page (the shipped page when it has secRuleId, else today's page
//       plus the test-only C2 stand-in below): deleted, nested-only, non-function, stub, and no-op shadows all give a
//       LoaderError or turn the real CACHE-04 check red; the base itself passes CACHE-04 and CACHE-04b. L8.5: a per-load
//       random or Date.now-based secRuleId passes CACHE-04 but turns CACHE-04b red. L8.6: an id from sanitizeString source
//       only, from function sources without the denylist data, or a constant fails CACHE-04b.
// Green on today's HBF and on the fixed page; fixture pages are built in memory from the shipped file, nothing is written.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHBF, readHBF, LoaderError } from './_hbf-load.mjs';
import { loadHBFApp } from './_hbf-app.mjs';
import { runPage, requireNames } from './_hbf-env.mjs';
import { cacheRuleChange, cacheRuleIdStable, cacheRuleIdBindings } from './_cache-checks.mjs';
const loadSrc = (src) => loadHBF({ fresh: true, src });
import vm from 'node:vm';
import { types } from 'node:util';
import { extractFn } from '../_load.mjs';

const SRC = readHBF();
// Test-only C2 contract stand-in (same shape as the green reference saver): used only when the page has no secRuleId.
const C2_STANDIN = `
if (typeof sanitizeString === 'undefined') globalThis.sanitizeString = function sanitizeString(v) { return isSensitiveUrl(v) ? undefined : v; };
function secRuleId() { return [JSON.stringify(SECRET_FIELD_DENYLIST, (k, v) => (v instanceof RegExp ? String(v) : v)), String(isSecretField), String(isSensitiveUrl), String(sanitizeString)].join('\\n'); }
function makeProjectStorageSaver() { let prev = new Map(), rule = null;
  return (proj) => { const id = secRuleId(); if (id !== rule) { prev = new Map(); rule = id; } const next = new Map();
    const rep = (name, value) => { if (name !== '' && isSecretField(name)) return undefined; if (typeof value !== 'string') return value;
      const r = prev.has(value) ? prev.get(value) : (next.has(value) ? next.get(value) : sanitizeString(value)); next.set(value, r); return r; };
    const out = JSON.stringify(proj, rep); prev = next; return out; }; }
`;
const addScript = (src, code) => `${src}\n<script>\n${code}\n</script>\n`;
const BASE = SRC.includes('function secRuleId(') ? SRC : addScript(SRC, C2_STANDIN);
// Re-indent only inside inline <script> bodies. f maps a line's leading-space count to the new count.
function reindent(src, f) {
  return src.replace(/(<script\b(?![^>]*\bsrc\s*=)[^>]*>)([\s\S]*?)(<\/script\s*>)/gi, (m, a, body, z) =>
    a + body.split('\n').map((l) => { const n = l.match(/^ */)[0].length; return ' '.repeat(f(n)) + l.slice(n); }).join('\n') + z);
}
const VARIANTS = { original: SRC, 'four-space': reindent(SRC, (n) => Math.max(0, n - 8)), 'two-space': reindent(SRC, (n) => Math.floor(n / 2)) };
const NESTED_HOST = `    function __hbfNestedHost() {
        function isSecretField(name) { return 'NESTED'; }
        function stripSecretFields(value) { return 'NESTED'; }
        function exportProject() { return 'NESTED'; }
        function scheduleProjectSave() { return 'NESTED'; }
        function secRuleId() { return 'NESTED'; }
        return [isSecretField, stripSecretFields, exportProject, scheduleProjectSave, secRuleId];
    }
`;
// Put the nested host at the very start of the first inline script, before every real declaration.
const withNested = (src) => src.replace(/(<script\b(?![^>]*\bsrc\s*=)[^>]*>)/i, `$1\n${NESTED_HOST}`);
function dropTopLevel(src, name) {
  const sig = `function ${name}(`; const n = src.split(sig).length - 1;
  assert.equal(n, 1, `fixture: expected exactly one ${sig} in the page, found ${n}`);
  return src.replace(sig, `function ${name}__removedForFixture(`);
}
const NAMES = ['apiKey', 'Api-Key', 'xaiKey2', 'clientSecret', 'tokenCount', 'keyboard', 'password', 'title'];
const SAMPLE = { setup: { apiKey: 'x', preferredModel: 'grok-4.7' }, notes: 'see https://e.com/?token=1 ok', links: ['https://u:p@h/', 'https://doi.org/10.1/x'], clientSecret: 's', n: { url: 'https://e.com/?key=1', ok: 'https://e.com/?page=2' } };
const behavior = (H) => JSON.stringify({
  names: NAMES.map((k) => H.isSecretField(k)),
  paths: Object.fromEntries(Object.entries(H.paths).map(([p, run]) => { try { return [p, H.JS(run(H.clone(SAMPLE)))]; } catch (e) { return [p, 'throw ' + e.message]; } })),
  removed: typeof H.findRemovedSecretFields === 'function' ? H.findRemovedSecretFields(H.clone(SAMPLE)) : null,
});

describe('HBF loader', () => {
  test('HBF/LOADER-L1a re-indented page (original, 4-space, 2-space) loads the same top-level function set', () => {
    const sets = Object.fromEntries(Object.entries(VARIANTS).map(([k, s]) => [k, runPage(s)]));
    assert.notEqual(VARIANTS['two-space'], SRC); assert.notEqual(VARIANTS['four-space'], SRC);
    for (const [k, P] of Object.entries(sets)) assert.deepEqual(P.startupErrors, [], `${k}: page startup threw`);
    const base = sets.original.declared;
    assert.ok(base.includes('isSecretField') && base.includes('exportProject') && base.length > 50, `original loaded only ${base.length} functions`);
    for (const k of ['four-space', 'two-space']) assert.deepEqual(sets[k].declared, base, `${k}: function set differs`);
  });

  test('HBF/LOADER-L1b re-indented page: rule functions behave identically on every path', () => {
    const out = Object.fromEntries(Object.entries(VARIANTS).map(([k, s]) => [k, behavior(loadHBF({ fresh: true, src: s }))]));
    assert.equal(out['four-space'], out.original); assert.equal(out['two-space'], out.original);
    assert.equal(behavior(loadHBF()), out.original, 'fixture loader != shipped-file loader');
  });

  test('HBF/LOADER-L2 nested isSecretField / stripSecretFields never replace a missing top-level one (LoaderError)', () => {
    for (const name of ['isSecretField', 'stripSecretFields']) {
      const src = withNested(dropTopLevel(SRC, name));
      assert.match(extractFn(src, name), /NESTED/, 'fixture: a first-match text extractor would take the nested function');
      assert.throws(() => loadHBF({ fresh: true, src }), (e) => e instanceof LoaderError && e.message === `loader could not find ${name}`);
    }
  });

  test('HBF/LOADER-L3 nested exportProject never replaces a missing top-level one (LoaderError)', () => {
    const src = withNested(dropTopLevel(SRC, 'exportProject'));
    assert.match(extractFn(src, 'exportProject'), /NESTED/);
    assert.throws(() => loadHBFApp({ meta: {}, setup: {} }, { src }), (e) => e instanceof LoaderError && e.message === 'loader could not find exportProject');
  });

  test('HBF/LOADER-L4 nested scheduleProjectSave is not loaded when there is no top-level one (stays ABSENT)', () => {
    const base = SRC.includes('function scheduleProjectSave(') ? dropTopLevel(SRC, 'scheduleProjectSave') : SRC;
    const A = loadHBFApp({ meta: {}, setup: {} }, { src: withNested(base) });
    assert.equal(A.has('scheduleProjectSave'), false, 'a nested scheduleProjectSave was loaded');
  });

  test('HBF/LOADER-L5 when nested and top-level both exist, the top-level one is loaded', () => {
    const src = withNested(SRC);
    const H = loadHBF({ fresh: true, src });
    assert.equal(H.isSecretField('apiKey'), true); assert.equal(H.isSecretField('title'), false);
    assert.equal(behavior(H), behavior(loadHBF()), 'rule behavior changed when a nested copy was added');
    const A = loadHBFApp({ meta: { name: 'x' }, setup: { apiKey: 'k' }, drafts: [] }, { src });
    for (const n of ['exportProject', 'isSecretField', 'stripSecretFields', 'scheduleProjectSave']) {
      if (A.found[n] !== undefined) assert.doesNotMatch(String(A.found[n]), /'NESTED'/, `${n}: nested copy loaded`);
    }
    const m = A.mark(); assert.notEqual(A.call('exportProject'), 'NESTED');
    assert.ok(A.log.slice(m).some((e) => e.ev === 'download'), 'top-level exportProject did not run');
  });

  test('HBF/LOADER-L6 a <script> inside a comment or a <textarea> is never run', () => {
    const P = runPage(addScript(SRC.replace(/(<body\b[^>]*>)/i, `$1\n<!-- <script>var __decoyComment = 1;</script> -->\n<textarea><script>var __decoyTextarea = 1;</script></textarea>\n`), 'var __realScriptRan = 1;'));
    assert.equal(P.ctx.__realScriptRan, 1, 'fixture: the appended real script did not run');
    assert.equal(P.ctx.__decoyComment, undefined, 'a script inside an HTML comment ran');
    assert.equal(P.ctx.__decoyTextarea, undefined, 'a script inside a <textarea> ran');
  });

  test('HBF/LOADER-L7 the vm context is a plain object: window === globalThis === context, no Proxy, undefined globals are undefined', () => {
    const P = runPage(SRC);
    assert.equal(types.isProxy(P.ctx), false); assert.equal(Object.getPrototypeOf(P.ctx), Object.prototype);
    assert.equal(P.ctx.window, P.ctx); assert.equal(P.ctx.globalThis, P.ctx); assert.equal(P.ctx.self, P.ctx);
    assert.equal(vm.runInContext('window === globalThis && globalThis === this && !!window.document', P.ctx), true);
    for (const w of ['window', 'globalThis', 'self']) assert.equal(types.isProxy(vm.runInContext(w, P.ctx)), false, `${w} is a Proxy`);
    assert.equal(types.isProxy(P.ctx.localStorage), false);
    assert.equal(types.isProxy(P.ctx.document), true, 'document is expected to be the stub Proxy');
    for (const n of ['__hbfDefinitelyUndefined', 'secRuleIdNotHere']) {
      assert.equal(P.ctx[n], undefined); assert.equal(vm.runInContext(`window.${n}`, P.ctx), undefined);
      assert.equal(vm.runInContext(`globalThis.${n}`, P.ctx), undefined); assert.equal(vm.runInContext(`typeof ${n}`, P.ctx), 'undefined');
    }
    if (!SRC.includes('function secRuleId(')) { assert.equal(P.ctx.secRuleId, undefined); assert.equal(vm.runInContext('typeof secRuleId', P.ctx), 'undefined'); }
  });

  describe('HBF/LOADER-L8 secRuleId probes (Reviewer)', () => {
    const contract = (H) => requireNames(H.page.found, ['secRuleId', 'makeProjectStorageSaver']);
    const isLoaderErr = (e) => e instanceof LoaderError && e.message === 'loader could not find secRuleId';
    test('HBF/LOADER-L8.0 base page has a real secRuleId and passes CACHE-04', () => {
      const H = loadHBF({ fresh: true, src: BASE });
      contract(H); cacheRuleChange(H);
    });
    test('HBF/LOADER-L8.1 secRuleId deleted: undefined on every access path, LoaderError, CACHE-04 red', () => {
      const H = loadHBF({ fresh: true, src: dropTopLevel(BASE, 'secRuleId') });
      for (const c of ['secRuleId', 'window.secRuleId', 'globalThis.secRuleId', 'self.secRuleId']) assert.equal(vm.runInContext(`typeof ${c}`, H.ctx), 'undefined', c);
      assert.equal(H.ctx.secRuleId, undefined); assert.equal(H.secRuleId, undefined);
      assert.throws(() => contract(H), isLoaderErr);
      assert.throws(() => cacheRuleChange(H), /ABSENT secRuleId/);
    });
    test('HBF/LOADER-L8.2 nested secRuleId only (top-level removed): LoaderError, CACHE-04 red', () => {
      const src = withNested(dropTopLevel(BASE, 'secRuleId'));
      assert.match(extractFn(src, 'secRuleId'), /NESTED/, 'fixture: a first-match text extractor would take the nested function');
      const H = loadHBF({ fresh: true, src });
      assert.equal(vm.runInContext('typeof secRuleId', H.ctx), 'undefined');
      assert.throws(() => contract(H), isLoaderErr);
      assert.throws(() => cacheRuleChange(H), /ABSENT secRuleId/);
    });
    for (const [label, code] of [['non-function var secRuleId = 1', 'var secRuleId = 1;'], ['non-function object', 'var secRuleId = { toString() { return "x"; } };'],
      ['stub Proxy value (document.getElementById)', "var secRuleId = document.getElementById('x');"], ['window.notDefined (plain context gives undefined)', 'var secRuleId = window.notDefinedAnywhere;']]) {
      test(`HBF/LOADER-L8.3 secRuleId shadowed by ${label}: LoaderError, CACHE-04 red`, () => {
        const H = loadHBF({ fresh: true, src: addScript(dropTopLevel(BASE, 'secRuleId'), code) });
        assert.throws(() => contract(H), isLoaderErr);
        assert.throws(() => cacheRuleChange(H), /ABSENT secRuleId/);
      });
    }
    for (const [label, code] of [['() => {}', 'var secRuleId = () => {};'], ["() => 'v2.2'", "var secRuleId = () => 'v2.2';"], ['a function that ignores the rule', "function secRuleId() { return 'LOCKED-RULE-v2.2'; }"]]) {
      test(`HBF/LOADER-L8.4 no-op secRuleId shadow ${label}: passes the loader (it is a function) but CACHE-04 goes red`, () => {
        const H = loadHBF({ fresh: true, src: addScript(dropTopLevel(BASE, 'secRuleId'), code) });
        contract(H);
        assert.throws(() => cacheRuleChange(H), /secRuleId\(\) (is not a rule identity|did not change when the rule changed)/);
      });
    }
    test('HBF/LOADER-L8.5a base page passes CACHE-04b (two loads, same secRuleId)', () => {
      cacheRuleIdStable(() => loadHBF({ fresh: true, src: BASE }));
    });
    for (const [label, code] of [['Math.random() per call', 'function secRuleId() { return String(sanitizeString) + String(isSecretField) + Math.random(); }'],
      ['Date.now() at load', 'var __hbfLoadStamp = Date.now(); function secRuleId() { return String(sanitizeString) + String(isSecretField) + __hbfLoadStamp; }']]) {
      test(`HBF/LOADER-L8.5 secRuleId from ${label}: passes CACHE-04 but CACHE-04b goes red`, () => {
        const src = addScript(dropTopLevel(BASE, 'secRuleId'), code);
        cacheRuleChange(loadHBF({ fresh: true, src }));
        assert.throws(() => cacheRuleIdStable(() => loadHBF({ fresh: true, src })), /differs between two loads/);
      });
    }
    for (const [label, code, re] of [
      ['sanitizeString source only', 'function secRuleId() { return String(sanitizeString); }', /did not change after the rule edit: added denylist entry/],
      ['function sources without the denylist data', 'function secRuleId() { return String(sanitizeString) + String(isSecretField) + String(typeof isSensitiveUrl === "function" ? isSensitiveUrl : isSensitiveWholeUrl); }', /did not change after the rule edit: added denylist entry/],
      ['a constant', "function secRuleId() { return 'LOCKED-RULE-v2.2'; }", /did not change after the rule edit/]]) {
      test(`HBF/LOADER-L8.6 secRuleId from ${label}: CACHE-04b goes red`, () => {
        const src = addScript(dropTopLevel(BASE, 'secRuleId'), code);
        assert.throws(() => cacheRuleIdStable(() => loadHBF({ fresh: true, src })), re);
      });
    }
    test('HBF/LOADER-L8.7a base page passes CACHE-04c (every shared-copy binding in secRuleId)', () => {
      cacheRuleIdBindings(BASE, loadSrc);
    });
    test('HBF/LOADER-L8.7 secRuleId over the 4 rule entry points + denylist only (no helpers): passes CACHE-04b, CACHE-04c goes red', () => {
      const code = 'function secRuleId() { return JSON.stringify(typeof CRED_EXACT !== "undefined" ? CRED_EXACT : SECRET_FIELD_DENYLIST) + String(sanitizeString) + String(isSecretField) + String(typeof isSensitiveUrl === "function" ? isSensitiveUrl : isSensitiveWholeUrl); }';
      const src = addScript(dropTopLevel(BASE, 'secRuleId'), code);
      cacheRuleIdStable(() => loadHBF({ fresh: true, src }));
      assert.throws(() => cacheRuleIdBindings(src, loadSrc), /did not change after mutating: .*\bredactAll\b/);
    });
    // Reviewer mutation survivors M02/M03/M14/M18 on 1e897af1: dropping one binding from the page's secRuleId list must turn
    // CACHE-04c red, naming that binding. The entry form is the fix's `['NAME', () => NAME]`.
    for (const name of ['redactAll', 'normalizeName', 'STEM_MAX', 'nameSpans']) {
      test(`HBF/LOADER-L8.8 secRuleId without ${name}: CACHE-04c goes red naming it`, () => {
        const entry = new RegExp(`\\s*\\['${name}', \\(\\) => ${name}\\],?`);
        assert.match(BASE, entry, `fixture: no ['${name}', () => ${name}] entry in the page's secRuleId`);
        const src = BASE.replace(entry, '');
        assert.throws(() => cacheRuleIdBindings(src, loadSrc), new RegExp(`did not change after mutating: .*\\b${name}\\b`));
      });
    }
    test('HBF/LOADER-L8.9 a shared-copy binding renamed away: secRuleId() throws naming it (never hashes it as null)', () => {
      const decl = 'const IMPORT_CLAUSE =';
      assert.ok(BASE.includes(decl), 'fixture: no IMPORT_CLAUSE declaration');
      const H = loadHBF({ fresh: true, src: BASE.replace(decl, 'const IMPORT_CLAUSE__renamedForFixture =') });
      assert.throws(() => vm.runInContext('secRuleId()', H.ctx), /IMPORT_CLAUSE/);
    });
  });

});
