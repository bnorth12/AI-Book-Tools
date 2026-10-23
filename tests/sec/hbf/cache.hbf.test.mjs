// SEC-SWEEP #180 (LOCKED-RULE-v2.2 r2, 5236f45a), HerbalBookForge C2 save path: memoized changed-field-only stripping
// (plan "Save-path timing"), with Reviewer's cache conditions. Red today: HBF 0eac64f has no memoized saver.
// Contract these tests pin for C2 (proposed in the plan; the C2 diff must match it or the tests change before C2, not in it):
//   makeProjectStorageSaver() -> save(project): string   the localStorage payload, one saver per page session
//   - cache key is the exact string value; field names are checked fresh on every save (never cached)
//   - secRuleId() returns the rule identity (a non-empty string derived from the live rule functions, so it changes when
//     the rule does, and the same on every load of the same page: CACHE-04b); save() calls it on every save and drops its
//     cache when it changes (CACHE-04, _cache-checks.mjs)
//   - sanitizeString / isSecretField are the shared top-level rule functions the saver calls
//   - scheduleProjectSave() queues a >= 1 s trailing-debounced save; exportProject() flushes it to storage before the
//     download starts (CACHE-07 is a behavior test, see _hbf-app.mjs)
// "fresh" = a new saver (empty cache); "full strip" = JSON.stringify(stripSecretFields(project)), the export path.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHBF, own } from './_hbf-load.mjs';
import { loadHBFApp } from './_hbf-app.mjs';
import { project } from './_project.mjs';
import { need, cacheRuleChange, cacheRuleIdStable, cacheRuleIdBindings, cacheOffListMiss } from './_cache-checks.mjs';
import { readHBF } from './_hbf-load.mjs';
const loadSrc = (src) => loadHBF({ fresh: true, src });

const fresh = (H, p) => H.makeProjectStorageSaver()(H.clone(p));
const fullStrip = (H, p) => H.JS(H.stripSecretFields(H.clone(p)));
function equiv(H, save, p, label) {
  const s = save(H.clone(p));
  assert.equal(s, fresh(H, p), `${label}: cached save != fresh save`);
  assert.equal(H.JS(H.JP(s)), fullStrip(H, p), `${label}: cached save != fresh full strip`);
  return s;
}

describe('HBF cache', () => {
  test('HBF/CACHE-01 cache key is the exact string value (near-miss strings are not hits)', () => {
    const H = loadHBF(); const save = need(H);
    const pairs = [['see https://e.com/?tokens=5 ok', 'see https://e.com/?token=5 ok'], ['see https://e.com/?KEYWORDS=1 ok', 'see https://e.com/?KEY=1 ok'],
      ['see https://e.com/?token ok', 'see https://e.com/?token=SEKRIT ok'], ['see https://e.com/?api_key=1 ok', 'see https://e.com/?api_key=1 ok '],
      ['see https://e.com/?k\u0065y=1 ok'.replace('key', 'kez'), 'see https://e.com/?\u212Aey=1 ok']];
    for (const [warm, hit] of pairs) {
      equiv(H, save, { notes: warm }, `warm ${JSON.stringify(warm)}`);
      const s = equiv(H, save, { notes: hit }, `after warm, ${JSON.stringify(hit)}`);
      assert.ok(!s.includes('SEKRIT'));
    }
  });

  test('HBF/CACHE-02 field names are checked fresh on every save (cached value moved under a secret name)', () => {
    const H = loadHBF(); const save = need(H);
    for (const name of ['apiKey', 'xaiKey2', 'clientSecret', 'refreshToken', 'pwd']) {
      const v = 'plain value ' + name;
      const a = H.JP(equiv(H, save, { notes: v }, 'warm'));
      assert.equal(a.notes, v);
      const b = H.JP(equiv(H, save, { [name]: v }, `renamed to ${name}`));
      assert.ok(!own(b, name), `${name}: cached value kept under a secret-named key`);
    }
  });

  test('HBF/CACHE-03 same value under a safe key and a secret-named key in one save', () => {
    const H = loadHBF(); const save = need(H);
    const v = 'xai-SEKRIT-but-looks-plain';
    for (let k = 0; k < 2; k++) {
      const o = H.JP(equiv(H, save, { notes: v, apiKey: v, setup: { xaiKey2: v, title: v } }, `save ${k}`));
      assert.equal(o.notes, v); assert.equal(o.setup.title, v);
      assert.ok(!own(o, 'apiKey') && !own(o.setup, 'xaiKey2'), 'secret-named key kept on a cache hit');
    }
  });

  test('HBF/CACHE-04 cache is dropped on rule change (secRuleId() follows the rule by itself, new rule applies to cached strings)', () => {
    cacheRuleChange(loadHBF({ fresh: true }));
  });

  test('HBF/CACHE-04b secRuleId() is stable across loads, an unchanged save hits the cache, and each rule input edit (denylist, isSecretField, URL rule) changes the id and forces a miss', () => {
    cacheRuleIdStable(() => loadHBF({ fresh: true }));
  });

  test('HBF/CACHE-04c secRuleId() covers every top-level binding of the shared copy (set read from the page text, not from secRuleId): mutating any one changes the id', () => {
    cacheRuleIdBindings(readHBF(), loadSrc);
  });

  test('HBF/CACHE-04d off-list binding V2_KEYPARAM: an edited page has a new secRuleId() and its saver applies the new rule (== fresh saver == full strip)', () => {
    cacheOffListMiss(readHBF(), loadSrc);
  });

  test('HBF/CACHE-05 cached save == fresh full strip on every save, including a secret added to a cached field', () => {
    const H = loadHBF(); const save = need(H);
    const p = project(120e3);
    equiv(H, save, p, 'cold');
    for (let k = 0; k < 5; k++) {
      p.drafts[k].draftText += ` edit ${k} see https://e.com/?token=SEKRIT${k} now.`;
      p.chapterOutlines[k].annotation = p.drafts[k + 1].draftText; // a value that is already cached, moved to another field
      const s = equiv(H, save, p, `edit ${k}`);
      assert.ok(!s.includes('SEKRIT') && !s.includes('SEK.'), `edit ${k}: secret survived the save`);
    }
    equiv(H, save, p, 'no-change save');
  });

  test('HBF/CACHE-06 __proto__ keys: cached save == fresh, no secret, no prototype change', () => {
    const H = loadHBF(); const save = need(H);
    const raw = '{"__proto__":{"apiKey":"SEKRIT","x":"see https://e.com/?token=SEKRIT ok"},"a":"see https://e.com/?token=SEKRIT ok","b":[{"__proto__":{"isAdmin":true}}]}';
    for (let k = 0; k < 2; k++) {
      const s = save(H.JP(raw));
      assert.equal(s, H.makeProjectStorageSaver()(H.JP(raw)), `save ${k}: cached != fresh`);
      assert.ok(!s.includes('SEKRIT'), `save ${k}: secret survived`);
      const o = H.JP(s);
      assert.ok(own(o, '__proto__') && Object.getPrototypeOf(o) === H.OP, `save ${k}: __proto__ not an own key`);
      assert.equal(H.OP.apiKey, undefined); assert.equal(H.OP.isAdmin, undefined); assert.equal({}.isAdmin, undefined);
    }
  });

  test('HBF/CACHE-07 export flushes the pending debounced save to storage before the download, and exports no secret', () => {
    // Behavior, not source order: the whole HBF page runs in node:vm (_hbf-app.mjs) with stubbed storage, Blob/URL/<a>.click,
    // alert and fake timers. A missing exportProject/saveProject/getStoredProject is a LoaderError thrown by the loader.
    const A = loadHBFApp({
      meta: { name: 'Valerian', version: '1.0.0' },
      setup: { apiKey: 'xai-SEKRIT-1', clientSecret: 'SEKRIT-2', preferredModel: 'grok-4.7', collectionIds: ['c1'] },
      goals: { mainGoal: 'calm', chatHistory: [] }, outline: '', chapterOutlines: [],
      drafts: [{ chapterId: 'c1', draftText: 'Dose 1-3 mL; see https://e.com/a.pdf?token=SEKRIT-3 for the chart.', sources: ['https://user:SEKRIT-4@e.com/x', 'https://doi.org/10.1/x'] }],
    });
    const errs = [];
    const fn = (n) => { if (!A.has(n)) { errs.push(`ABSENT ${n}()`); return false; } return true; };
    let pending = false;
    const m0 = A.mark();
    if (fn('scheduleProjectSave')) {
      A.call('scheduleProjectSave');
      const t = A.log.slice(m0).filter((e) => e.ev === 'setTimeout');
      if (A.log.slice(m0).some((e) => e.ev === 'setItem')) errs.push('scheduleProjectSave() wrote to storage at once: no pending debounced save');
      else if (!t.some((e) => e.ms >= 1000)) errs.push(`scheduleProjectSave() set no >= 1 s debounce timer (timers: ${JSON.stringify(t.map((e) => e.ms))})`);
      else pending = true;
    } else errs.push('no debounced autosave (plan: 1 s trailing debounce, flushed before export)');
    A.getProject().drafts[0].notes = 'edited after the save was scheduled';
    const mark = A.log.length;
    try { A.call('exportProject'); } catch (e) { errs.push(`exportProject() threw: ${e.message}`); }
    const after = A.log.slice(mark);
    const dl = after.findIndex((e) => e.ev === 'download');
    const wr = after.findIndex((e) => e.ev === 'setItem');
    if (dl < 0) errs.push('exportProject() started no download');
    if (pending) {
      if (wr < 0) errs.push('(a) the pending save was not written to storage by exportProject()');
      else if (dl >= 0 && wr > dl) errs.push('(a) the pending save was written to storage after the download started');
      else if (!after[wr].value.includes('edited after the save was scheduled')) errs.push('(a) the flushed save does not hold the latest project state');
      else if (/SEKRIT|"apiKey"|"clientSecret"/.test(after[wr].value)) errs.push('(a) the flushed save holds a secret');
      const ours = new Set(A.log.slice(m0).filter((e) => e.ev === 'setTimeout').map((e) => e.id));
      const left = [...A.timers.keys()].filter((id) => ours.has(id)).length;
      if (left) errs.push(`(a) ${left} save timer(s) still pending after export (a later fire would re-save)`);
    }
    if (dl >= 0) {
      const text = after[dl].text;
      let o = null; try { o = A.JP(text); } catch (e) { errs.push(`(b) exported file is not JSON: ${e.message}`); }
      if (o) {
        const keys = []; (function walk(v) { if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { keys.push(k); walk(x); } })(o);
        const bad = keys.filter((k) => /^(apiKey|clientSecret)$/.test(k));
        if (bad.length) errs.push(`(b) exported JSON keeps secret field(s): ${bad.join(', ')}`);
        if (/SEKRIT/.test(text)) errs.push(`(b) exported JSON keeps a credential: ${(text.match(/.{0,40}SEKRIT.{0,10}/) || [''])[0]}`);
        if (o.drafts?.[0]?.sources?.[1] !== 'https://doi.org/10.1/x') errs.push('(b) a safe citation link was not kept');
      }
    }
    if (errs.length) assert.fail('CACHE-07: ' + errs.join('; '));
  });
});
