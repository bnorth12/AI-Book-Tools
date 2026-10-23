// SEC-SWEEP #180 HBF cache checks shared by cache.hbf.test.mjs and the loader probes (loader.hbf.test.mjs), so the probes
// prove the real CACHE test goes red on a mutated page.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { own } from '../_load.mjs';

export function need(H) {
  if (typeof H.makeProjectStorageSaver !== 'function') assert.fail('ABSENT makeProjectStorageSaver: HBF has no memoized save path (C2)');
  if (typeof H.secRuleId !== 'function') assert.fail('ABSENT secRuleId: the saver has no rule identity to key its cache on (C2)');
  return H.makeProjectStorageSaver();
}

// CACHE-04: the rule changes (the page's own sanitizeString is replaced by a stricter one; secRuleId is NOT touched by the
// test), so secRuleId() must change by itself and the saver must drop its cache: a string cached under the old rule may
// not survive. A constant or no-op secRuleId shadow therefore fails here.
export function cacheRuleChange(H) {
  const save = need(H);
  const live = (code) => vm.runInContext(code, H.ctx);
  const id0 = live('secRuleId()');
  if (typeof id0 !== 'string' || id0 === '') assert.fail(`secRuleId() is not a rule identity (got ${JSON.stringify(id0)})`);
  const p = { notes: 'see https://e.com/?zebra=1 ok', drafts: [{ draftText: 'zebra notes https://e.com/?zebra=2 end' }] };
  const before = H.JP(save(H.clone(p)));
  assert.equal(before.notes, p.notes);
  const orig = H.ctx.sanitizeString;
  if (typeof orig !== 'function') assert.fail('ABSENT sanitizeString in the HBF page');
  H.ctx.sanitizeString = function sanitizeStringStricterForTest(v) { const r = orig(v); return typeof r === 'string' ? r.replace(/https:\/\/e\.com\/\?zebra=\d/g, '[credential link removed]') : r; };
  const id1 = live('secRuleId()');
  if (id1 === id0) assert.fail('secRuleId() did not change when the rule changed');
  const after = save(H.clone(p));
  assert.equal(after, H.makeProjectStorageSaver()(H.clone(p)), 'cached save after rule change != fresh save under the new rule');
  assert.ok(!after.includes('zebra=1'), 'string cached under the old rule survived a rule change');
}

// CACHE-04b: secRuleId() is a stable identity of the RULE (not of the page load) and covers every rule input.
//  1. Two independent loads of the same page (>= 1 ms apart) give the same non-empty id (per-load random/time ids fail).
//  2. In the second load, saving the same unchanged project again HITS the cache. Hit signal: a call counter wrapped around
//     the page's sanitizeString before the saver is made (a hit calls it 0 times; a miss calls it again).
//  3. Each rule edit changes the id by itself and forces a miss (counter > 0) with output == a fresh saver's, then the next
//     unchanged save hits again: (a) one added denylist entry (SECRET_FIELD_DENYLIST.exact today, CRED_EXACT in the r2
//     block; edited in place, so the id must cover the data, not only function source), (b) an edited isSecretField,
//     (c) an edited isSensitiveUrl (isSensitiveWholeUrl in the r2 block). An id from sanitizeString source alone fails.
export function cacheRuleIdStable(load) {
  const ids = []; let H;
  for (let k = 0; k < 2; k++) {
    if (k) { const t = Date.now(); while (Date.now() === t) { /* let the clock tick */ } }
    H = load(); need(H);
    const id = vm.runInContext('secRuleId()', H.ctx);
    if (typeof id !== 'string' || id === '') assert.fail(`secRuleId() is not a rule identity (got ${JSON.stringify(id)})`);
    ids.push(id);
  }
  if (ids[0] !== ids[1]) assert.fail('secRuleId() differs between two loads of the same page (per-load random or time-based id)');
  const C = H.ctx; const live = () => vm.runInContext('secRuleId()', C);
  const orig = C.sanitizeString;
  if (typeof orig !== 'function') assert.fail('ABSENT sanitizeString in the HBF page');
  let calls = 0; C.sanitizeString = function sanitizeStringCounted(v) { calls++; return orig(v); };
  const save = H.makeProjectStorageSaver();
  const p = { notes: 'see https://e.com/?zebra=1 ok', zebraField: 'plain zebra value', zebraName: 'plain name value', drafts: [{ draftText: 'Dose 1-3 mL; see https://doi.org/10.1/x' }] };
  const step = (label) => { const c0 = calls; const out = save(H.clone(p)); return { n: calls - c0, out, label }; };
  if (!(step('first save').n > 0)) assert.fail('first save never called sanitizeString (no hit signal)');
  const hit = step('unchanged save');
  if (hit.n !== 0) assert.fail(`saving the same unchanged project missed the cache (${hit.n} sanitizeString calls, want 0)`);
  const deny = H.page.found.SECRET_FIELD_DENYLIST?.exact ?? H.page.found.CRED_EXACT;
  const urlName = typeof C.isSensitiveUrl === 'function' ? 'isSensitiveUrl' : typeof C.isSensitiveWholeUrl === 'function' ? 'isSensitiveWholeUrl' : null;
  if (!Array.isArray(deny)) assert.fail('ABSENT denylist rule input (SECRET_FIELD_DENYLIST.exact / CRED_EXACT)');
  if (!urlName) assert.fail('ABSENT URL rule input (isSensitiveUrl / isSensitiveWholeUrl)');
  const edits = [
    ['added denylist entry', () => deny.push(deny === H.page.found.CRED_EXACT ? 'zebrafield' : 'zebraField'), (o) => !own(o, 'zebraField')],
    ['edited isSecretField', () => { const f = C.isSecretField; C.isSecretField = function isSecretFieldEdited(k) { return k === 'zebraName' || f(k); }; }, (o) => !own(o, 'zebraName')],
    [`edited ${urlName}`, () => { const f = C[urlName]; C[urlName] = function urlRuleEdited(v) { return (typeof v === 'string' && v.includes('?zebra=')) || f(v); }; }, (o) => !String(o.notes ?? '').includes('zebra=1')],
  ];
  for (const [label, edit, effect] of edits) {
    const before = live(); edit(); const after = live();
    if (after === before) assert.fail(`secRuleId() did not change after the rule edit: ${label}`);
    const miss = step(label);
    if (!(miss.n > 0)) assert.fail(`${label}: the save after the rule edit hit the stale cache (0 sanitizeString calls)`);
    assert.equal(miss.out, H.makeProjectStorageSaver()(H.clone(p)), `${label}: save after the edit != fresh save`);
    if (!effect(H.JP(miss.out))) assert.fail(`${label}: the edited rule did not apply to the saved project`);
    const again = step(label + ' (again)');
    if (again.n !== 0) assert.fail(`${label}: the next unchanged save missed the cache (${again.n} calls)`);
  }
}

// CACHE-04c (Reviewer N1 on 19463ac3, condition 2 + NO-GO on 1e897af1): secRuleId() covers EVERY top-level binding of the
// SEC-SWEEP #180 shared copy, not only the names its own list happens to carry. The binding set comes from the page text
// (blockBindings, _block-bindings.mjs), never from secRuleId. exportNotice is excluded: it only formats a finished report
// for the D7 notice and does not feed the strip (UI_ONLY). For each remaining binding a page copy is built whose definition
// of that one binding changes source or value (functions: a comment in the source; regexes: `|(?!)`; strings: `|(?!)`, else
// a same-length swap inside the first character class; arrays: the first entry repeated; objects: an extra never-used
// key; numbers: +1), loaded fresh, and secRuleId() must differ from the unmutated page's id. In every copy the
// `tail prefix drift` load guard is neutralized so a mutated URL_START/URL_SCAN still loads (the guard is not under test
// here). All failing bindings are collected and reported together.
import { blockBindings, UI_ONLY } from './_block-bindings.mjs';
const GUARD = "throw new Error('tail prefix drift')";
const neutral = (src) => src.split(GUARD).join('void 0');
const SWAP = "((s) => { const m = /\\[\\^?/.exec(s); if (!m) return s + ' '; const j = m.index + m[0].length; return s[j] !== s[j + 1] && s[j] !== '\\\\' && s[j + 1] !== '\\\\' && s[j + 1] !== ']' ? s.slice(0, j) + s[j + 1] + s[j] + s.slice(j + 2) : s + ' '; })";
function candidates(b, src, kind) {
  const splice = (at, text) => src.slice(0, at) + text + src.slice(at);
  const repl = (v) => src.slice(0, b.valueStart) + v + src.slice(b.valueEnd);
  const V = src.slice(b.valueStart, b.valueEnd);
  if (b.kind === 'function') return [splice(b.at, '/* CACHE-04c mutation */')];
  if (kind === 'function') return b.arrowAt >= 0 ? [splice(b.arrowAt, ' /* CACHE-04c mutation */')] : [];
  if (kind === 'regexp') return [repl(`new RegExp((${V}).source + '|(?!)', (${V}).flags)`)];
  if (kind === 'string') return [repl(`(${V}) + '|(?!)'`), repl(`${SWAP}(${V})`)];
  if (kind === 'array') return [repl(`[...(${V}), (${V})[0]]`)];
  if (kind === 'number') return [repl(`(${V}) + 1`)];
  if (kind === 'object') return [repl(`({ ...(${V}), '\\uFFFF__cache04c': '\\uFFFF' })`)];
  return [];
}
const kindIn = (H, name) => vm.runInContext(`(() => { const x = ${name}; return typeof x === 'function' ? 'function' : x instanceof RegExp ? 'regexp' : Array.isArray(x) ? 'array' : x === null ? 'null' : typeof x; })()`, H.ctx);
const loads = (load, src) => { try { const H = load(src); if (H.page.startupErrors.length || typeof H.secRuleId !== 'function') return null; vm.runInContext('secRuleId()', H.ctx); return H; } catch { return null; } };
export function coveredBindings(src) { return blockBindings(src).bindings.map((b) => b.name).filter((n) => !UI_ONLY.includes(n)); }
export function cacheRuleIdBindings(src, load) {
  const { bindings, other } = blockBindings(src);
  for (const o of other) if (!o.includes(GUARD)) assert.fail(`CACHE-04c: unclassified top-level statement in the shared copy: ${o.slice(0, 80)}`);
  const H0 = load(neutral(src)); need(H0);
  const id0 = vm.runInContext('secRuleId()', H0.ctx);
  if (id0 !== vm.runInContext('secRuleId()', load(src).ctx)) assert.fail('CACHE-04c: neutralizing the load guard changed secRuleId()');
  const missed = [], unbuildable = [];
  for (const b of bindings) {
    if (UI_ONLY.includes(b.name)) continue;
    const kind = kindIn(H0, b.name);
    let H = null;
    for (const c of candidates(b, src, kind)) { H = loads(load, neutral(c)); if (H) break; }
    if (!H) { unbuildable.push(`${b.name}(${kind})`); continue; }
    if (vm.runInContext('secRuleId()', H.ctx) === id0) missed.push(b.name);
  }
  if (unbuildable.length) assert.fail(`CACHE-04c: no loadable mutation for: ${unbuildable.join(', ')}`);
  if (missed.length) assert.fail(`secRuleId() did not change after mutating: ${missed.join(', ')}`);
  return bindings.length;
}

// CACHE-04d behavioral miss on an off-list binding (V2_KEYPARAM, a regex-source const): a page copy whose V2_KEYPARAM also
// matches a `?zqkey=` param has a different secRuleId(), and its saver strips the new param exactly like a fresh saver and
// the full export strip of that page, while the unmutated page keeps it. The cache is per page session, so this is the
// cross-page form of "new id => the new rule applies": the id, not a stale entry, decides.
export function cacheOffListMiss(src, load) {
  const b = blockBindings(src).bindings.find((x) => x.name === 'V2_KEYPARAM');
  if (!b) assert.fail('CACHE-04d: V2_KEYPARAM is not a top-level binding of the shared copy');
  const V = src.slice(b.valueStart, b.valueEnd);
  const msrc = src.slice(0, b.valueStart) + `(${V}) + '|' + URL_START + URL_SCAN + '[?&#]zqkey(?=[=&#]|\\\\s|$)'` + src.slice(b.valueEnd);
  const H0 = load(src), H1 = load(msrc); need(H0); need(H1);
  if (H1.page.startupErrors.length) assert.fail(`CACHE-04d: mutated page did not load: ${H1.page.startupErrors.join('; ')}`);
  const id0 = vm.runInContext('secRuleId()', H0.ctx), id1 = vm.runInContext('secRuleId()', H1.ctx);
  if (id0 === id1) assert.fail('secRuleId() is the same after the V2_KEYPARAM edit');
  const p = { notes: 'see https://e.com/a?zqkey=SEKRIT ok', drafts: [{ draftText: 'plain https://doi.org/10.1/x' }] };
  const s0 = H0.makeProjectStorageSaver(); s0(H0.clone(p)); const out0 = s0(H0.clone(p));
  assert.ok(out0.includes('zqkey=SEKRIT'), 'fixture: the unmutated page already strips ?zqkey=');
  const s1 = H1.makeProjectStorageSaver(); const first = s1(H1.clone(p)); const again = s1(H1.clone(p));
  assert.equal(first, H1.makeProjectStorageSaver()(H1.clone(p)), 'V2_KEYPARAM page: save != fresh saver');
  assert.equal(again, first, 'V2_KEYPARAM page: second save != first');
  assert.equal(H1.JS(H1.JP(first)), H1.JS(H1.stripSecretFields(H1.clone(p))), 'V2_KEYPARAM page: save != full strip');
  assert.ok(!first.includes('SEKRIT'), 'V2_KEYPARAM page: the new param survived the save');
}
