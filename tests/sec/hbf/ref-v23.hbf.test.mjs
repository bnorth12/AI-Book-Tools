// SEC-SWEEP ref-v2.3 (plan REF-V2.3-N2 v1.1, §4), HerbalBookForge red-first rows. Tests only: on HBF v3 (4b4b911a, ref-v2.2
// block) every row with redOnV22 must be RED and every guard / near-miss / prose row GREEN; after the ref-v2.3 fix, all GREEN.
// Rows run through all three HBF strip paths (export, import, storage). Fake key only (<KEY>, built at runtime).
//   T1  tighten-only superset: every code unit ref-v2.2 removes (frozen spans, hbf-rows corpus + 5k seeded fuzz) is still
//       removed; every name v2.2 strips is still stripped; the only v2.2 keep rows that flip are REVERSED_V22_KEEP.
//   T2  no key literal: no file under tests/sec holds an xai- key shape (the fake key is assembled at runtime).
//   LOADNOTICE  loadProject() dropping a secret from saved data must surface a user notice naming the field path.
//   V2KP  standalone V2_KEYPARAM test (top-level page binding, regex positives and negatives).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadHBF, own, PATHS, MARK } from './_hbf-load.mjs';
import { loadHBFApp } from './_hbf-app.mjs';
import { runPage, readHBF } from './_hbf-env.mjs';
import { FAKE_KEY, fuzzCorpus, keptIndices } from './_v23-fuzz.mjs';
import { REVERSED_V22_KEEP } from './_v23-reversed.mjs';

const rd = (f) => JSON.parse(fs.readFileSync(new URL('./fixtures/' + f, import.meta.url), 'utf8'));
const REPIN = rd('ref-v23-repin-nel.json'); // ref-nel-fix7: 15 rows x 3 paths re-pinned to kept-NEL output (CoS 08:41)
const SDPIN = rd('ref-v23-repin-sd.json'); // ref-nel-fix7.3: 9 NS-Basic-word rows S -> SD (CoS ruling (a))
const FX = rd('ref-v23-rows.json'), SUP = rd('ref-v23-superset.json'), HR = rd('hbf-rows.json');
const H = loadHBF();
const TAIL = FAKE_KEY.slice(4);
const sub = (s) => s.split('<KEY>').join(FAKE_KEY).split('<KTAIL>').join(TAIL);
const deep = (o) => JSON.parse(sub(JSON.stringify(o)));
const show = (v) => JSON.stringify(v)?.split(FAKE_KEY).join('<KEY>').split(TAIL).join('<KTAIL>');

function check(run, r) {
  const inp = deep(r.obj); const o = run(H.clone(inp)); const f = r.field;
  const has = own(o, f), v = has ? o[f] : undefined; const secs = r.secrets.map(sub);
  const leak = has && secs.some((x) => JSON.stringify(v).includes(x));
  if (!own(o, 'ok')) assert.fail(`CLASS ${r.id}: sibling ok dropped`);
  const same = JSON.stringify(o) === JSON.stringify(inp);
  switch (r.expect) {
    case 'K': if (!same) assert.fail(`CLASS ${r.id}: want unchanged, got ${show(o)}`); return;
    case 'D': if (has) assert.fail(`CLASS ${r.id}: want ${f} dropped, got ${show(v)}`); return;
    case 'S': if (!has) assert.fail(`CLASS ${r.id}: want redacted, field dropped`); if (leak || !String(v).includes(MARK)) assert.fail(`CLASS ${r.id}: want redacted, got ${show(v)}`);
      if (Object.hasOwn(REPIN.rows, r.id)) { const rp = REPIN.rows[r.id], want = sub(rp.out).split('<MARK>').join(MARK), old = sub(rp.oldOut).split('<MARK>').join(MARK); // ref-nel-fix7 kept-NEL re-pin
        assert.equal(rp.oldOut, r.out, r.id + ' frozen old out'); const k = [...want].findIndex((c, i) => c !== [...old][i]);
        assert.ok(want.length === old.length + 1 && want[k] === '\x85' && want.slice(0, k) + want.slice(k + 1) === old, r.id + ' re-pin differs from frozen out by more than one inserted U+0085');
        if (secs.some((x) => String(v).includes(x))) assert.fail(`CLASS ${r.id}: secret byte survives`);
        if (v !== want) assert.fail(`EXACT ${r.id} (re-pinned): want ${show(want)}, got ${show(v)}`); return; }
      if (r.out !== undefined && v !== sub(r.out).split('<MARK>').join(MARK)) assert.fail(`EXACT ${r.id}: want ${show(sub(r.out).split('<MARK>').join(MARK))}, got ${show(v)}`); return;
    case 'SD': if (leak || same) assert.fail(`CLASS ${r.id}: want redacted or dropped, got ${show(o)}`); return;
    case 'N': if (!(has && Array.isArray(v) && v[0] === null)) assert.fail(`CLASS ${r.id}: want ${f}[0] === null, got ${show(v)}`); return;
  }
  assert.fail('bad expect ' + r.expect);
}

// fix7.3 (Engineering 11:58 (1)): no 2+ char fragment of the row's secret in output, error text, dropped/redacted record or export notice.
function allyCheck(p, r) { const w = r.secrets[0]; const frag = []; for (let i = 0; i < w.length; i++) for (let j = i + 2; j <= w.length; j++) frag.push(w.slice(i, j));
  let err = '', o; try { o = H.paths[p](H.clone(deep(r.obj))); } catch (e) { err = String(e && e.stack || e); }
  const rep = { dropped: [], redacted: [] }; let note = ''; try { H.stripSecretFields(deep(r.obj), '', rep); note = H.exportNotice(rep) || ''; } catch (e) { err += String(e); }
  const hay = [own(o ?? {}, r.field) ? String(o[r.field]) : '', err, JSON.stringify(rep), note].join('\u0000').split(MARK).join('\u0000').split('Credential links redacted in: ').join('\u0000'); // template text holds `al`
  assert.deepEqual(frag.filter((x) => hay.includes(x)), [], `ALLY ${r.id}: secret fragment survives`); }
describe('HBF v23 fix7.3 SD re-pin', () => {
  test('HBF-v23/fix7.3/frozen ref-v23-rows.json byte-identical (sha256)', async () => { const c = await import('node:crypto');
    assert.equal(c.createHash('sha256').update(fs.readFileSync(new URL('./fixtures/ref-v23-rows.json', import.meta.url))).digest('hex'), SDPIN.frozenSha256); });
  test('HBF-v23/fix7.3/re-pin is exactly the 3 NS-Basic-word rows (9 row x path), each frozen S', () => {
    assert.deepEqual(Object.keys(SDPIN.rows).sort(), ['NS-Basic-word-U0085', 'NS-Basic-word-U00AD', 'NS-Basic-word-U200B']);
    for (const [id, x] of Object.entries(SDPIN.rows)) { const f = FX.rows.find((r) => r.id === id); assert.equal(f.expect, 'S'); assert.equal(x.frozenExpect, 'S'); assert.equal(x.expect, 'SD'); assert.deepEqual(x.paths, PATHS); } });
});

for (const p of PATHS) {
  const groups = new Map(); for (const r of FX.rows) { if (!groups.has(r.grp)) groups.set(r.grp, []); groups.get(r.grp).push(r); }
  for (const [g, rows] of groups) describe(`HBF v23 ${p} ${g}`, () => {
    for (const r0 of rows) { const sd = Object.hasOwn(SDPIN.rows, r0.id), r = sd ? { ...r0, expect: 'SD' } : r0;
      test(`HBF-v23/${p}/${g}/${r.id} ${r.expect}${sd ? ' (re-pinned from S, fix7.3)' : ''}${r.redOnV22 ? ' red-first' : ' guard'}`, () => { check(H.paths[p], r); if (sd) allyCheck(p, r); }); }
  });
}

describe('HBF v23 T1 tighten-only superset over ref-v2.2', () => {
  const corpus = [...HR.rows.filter((r) => r.kind === 'str').map((r) => r.input), ...fuzzCorpus(SUP.fuzzN, SUP.fuzzSeed)];
  test('HBF-v23/T1/corpus shape matches the frozen fixture', () => { assert.equal(SUP.strRows, HR.rows.filter((r) => r.kind === 'str').length); assert.equal(corpus.length, SUP.strRows + SUP.fuzzN); });
  for (const p of PATHS) test(`HBF-v23/T1/${p} every code unit ref-v2.2 removes is still removed (${SUP.removed.length} inputs)`, () => {
    const bad = [];
    for (const [i, rm] of SUP.removed) { const s = corpus[i]; const o = H.paths[p](H.clone({ f: s })); const kept = keptIndices(s, own(o, 'f') ? o.f : null, MARK);
      if (kept === null) { bad.push(`#${i} unaligned ${show(o.f)}`); continue; }
      if (rm.some(([a, b]) => { for (let j = a; j < b; j++) if (kept.has(j)) return true; return false; })) bad.push(`#${i} ${show(s)} -> ${show(o.f)}`);
      if (bad.length > 5) break; }
    assert.deepEqual(bad, []);
  });
  test('HBF-v23/T1/names every name ref-v2.2 strips is still stripped', () => { assert.deepEqual(SUP.v22StrippedNames.filter((n) => !H.isSecretField(n)), []); });
  test('HBF-v23/T1/reversals are exactly the deliberate list and each has a RED replacement row', () => {
    const ids = Object.keys(REVERSED_V22_KEEP).sort(); assert.deepEqual(ids, ['RV-N08', 'RV-N09', 'RV-N15']);
    for (const [o, n] of Object.entries(REVERSED_V22_KEEP)) { const old = HR.rows.find((r) => r.id === o); assert.equal(old?.secret, false, o + ' was a v2.2 keep row');
      const rep = FX.rows.find((r) => r.id === n); assert.ok(rep && rep.expect === 'D' && rep.redOnV22 && rep.field === old.input, n + ' replaces ' + o); }
    const flipped = HR.rows.filter((r) => r.kind === 'name' && !r.secret && !r.gap && H.isSecretField(r.input)).map((r) => r.id);
    assert.deepEqual(flipped.filter((id) => !Object.hasOwn(REVERSED_V22_KEEP, id)), [], 'an undeclared v2.2 keep row flipped');
  });
});

describe('HBF v23 T2 no key literal in tests', () => {
  test('HBF-v23/T2 no xai- key shape in any file under tests/sec', () => {
    const root = path.dirname(path.dirname(new URL(import.meta.url).pathname)); const hits = [];
    const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f); else if (/xai(?:-|%2[dD]|\\u002[dD])[A-Za-z0-9]{20,}/i.test(fs.readFileSync(f, 'utf8'))) hits.push(path.relative(root, f)); } };
    walk(root); assert.deepEqual(hits, []);
  });
});

describe('HBF v23 LOADNOTICE load-path report', () => {
  test('HBF-v23/LOADNOTICE loadProject() from saved data that holds a secret shows a notice naming the field path', () => {
    const app = loadHBFApp();
    const saved = { meta: { name: 'B', version: '1.0.0' }, setup: { collectionIds: [], preferredModel: 'grok-4.7', xaiKey: FAKE_KEY }, goals: { mainGoal: 'see https://e.com/?token=abc123 ok', chatHistory: [] }, chapterOutlines: [], drafts: [] };
    app.store.set('herbalBookForgeProject_v1.0.0', JSON.stringify(saved));
    assert.ok(app.has('loadProject'), 'loadProject ABSENT'); const m = app.mark();
    try { app.call('loadProject'); } catch (e) { assert.fail('loadProject threw ' + e.message); }
    assert.ok(!JSON.stringify(app.getProject()).includes(TAIL), 'secret survived load');
    const notes = app.log.slice(m).filter((x) => x.ev === 'alert').map((x) => x.text);
    assert.ok(notes.some((t) => t.includes('setup.xaiKey')), `load-path report discarded: no notice naming setup.xaiKey (got ${show(notes)})`);
    assert.ok(!notes.some((t) => t.includes(TAIL) || t.includes('abc123')), 'notice leaked a value');
  });
});

describe('HBF v23 V2KP standalone V2_KEYPARAM', () => {
  const P = runPage(readHBF(), { names: ['V2_KEYPARAM'] });
  const src = P.found.V2_KEYPARAM;
  test('HBF-v23/V2KP top-level V2_KEYPARAM binding, matches key params and nothing else', () => {
    assert.equal(typeof src, 'string', 'V2_KEYPARAM ABSENT as a top-level binding');
    const m = (s) => new RegExp(src, 'u').test(s);
    for (const s of ['https://e.com/?key=1', 'https://e.com/?KEY=1', 'https://e.com/?k_e_y=1', 'https://e.com/?\u212Aey=1', 'https://e.com/x#key=1', 'e.com/?a=1&key', 'https://e.com/?-key-=1']) assert.ok(m(s), 'want match ' + s);
    for (const s of ['https://e.com/?keyboard=1', 'https://e.com/?monkey=1', 'https://e.com/?apikey=1', 'https://e.com/#section-key', 'the key=1 in prose', 'https://e.com/key?x=1']) assert.ok(!m(s), 'want no match ' + s);
  });
});

// r5 SEP static rows (CoS NEL ruling). SEP1/SEP3 expected RED on 8f1f9993 until Nonfiction's fix (ref-nel-fix/); SEP2 is the cross-language pin.
describe('HBF r5 SEP explicit separator class', () => {
  const FXD = new URL('./fixtures/', import.meta.url);
  const CLS_SRC = fs.readFileSync(new URL('sep-class.mjs', FXD), 'utf8');
  const SEP_CLASS = /export const SEP_CLASS = '((?:[^'\\]|\\.)*)';/.exec(CLS_SRC)[1].replace(/\\\\/g, '\\');
  const page = readHBF();
  const REDACT_NAMES = ['SRC306', 'V1_USERINFO', 'V2_USERINFO', 'URL_SCAN', 'V2_KEYPARAM', 'BEARER_SOURCE', 'HEADER_SOURCE', 'COOKIE_SOURCE', 'JSON_PAIR_SOURCE'];
  test('HBF-r5/SEP1 no \\s or \\p{White_Space} in any redaction source (expected RED until fix)', () => {
    const lines = page.split('\n'); const hits = [];
    lines.forEach((l, i) => { const decl = REDACT_NAMES.some((n) => new RegExp(`^\\s*const ${n} =`).test(l)); const basic = /basic\(\?:/.test(l) && /\/giu/.test(l);
      if ((decl || basic) && /\\\\?s(?![a-z])|\\\\?p\{White_Space\}/.test(l.replace(/^\s*const [A-Z0-9_]+ =/, ''))) hits.push(`:${i + 1} ${l.trim().slice(0, 60)}`); });
    assert.deepEqual(hits, []);
  });
  test('HBF-r5/SEP2 SEP_CLASS code-point set equals sep-codepoints.txt', () => {
    const re = new RegExp('^' + SEP_CLASS + '$', 'u'); const got = [];
    for (let c = 0; c <= 0x10ffff; c++) if (re.test(String.fromCodePoint(c))) got.push(c.toString(16).toUpperCase().padStart(4, '0'));
    const want = fs.readFileSync(new URL('sep-codepoints.txt', FXD), 'utf8').trim().split('\n');
    assert.deepEqual([...got, '%20'], want);
    assert.ok(/\\s|\\p\{/.test(SEP_CLASS) === false, 'class itself uses \\s');
  });
  test('HBF-r5/SEP3 page carries the SEP_CLASS bytes (expected RED until fix)', () => {
    assert.ok(page.includes(SEP_CLASS) || page.includes(SEP_CLASS.replace(/\\/g, '\\\\')), 'SEP_CLASS literal not found in page');
  });
});
