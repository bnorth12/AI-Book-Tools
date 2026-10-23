// SEC-SWEEP #180 (LOCKED-RULE-v2.2 r2, 5236f45a), HerbalBookForge red-first rows. Every row in fixtures/hbf-rows.json
// (v2.2 r2 rows + HBF off-list rows) runs through all three HBF strip paths: export, import/load, storage (spec erratum E2).
// String rows: { f: input } must come back with f dropped (out null) or exactly `out`. cls noleak: SEKRIT must not survive.
// Name rows: { [name]: 'v', ok: 1 } must lose the key iff secret. Object rows: checks below (M1, N1, H25, H26).
// A failure message starts with CLASS (strip/keep or leak is wrong: the plan's red count) or EXACT (class right, text not
// the r2 output). gap F1 rows pin the v2.2 result (keep) and flip when SEC-SWEEP-F1 lands.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { loadHBF, own, PATHS, MARK } from './_hbf-load.mjs';
import { REVERSED_V22_KEEP } from './_v23-reversed.mjs'; // ref-v2.3 §4a: 3 keep rows reversed on purpose, replaced in ref-v23.hbf.test.mjs

const FX = JSON.parse(fs.readFileSync(new URL('./fixtures/hbf-rows.json', import.meta.url), 'utf8'));
const H = loadHBF();
const show = (v) => JSON.stringify(v);
const OWN = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);

// Object-row checks (rows.mjs :95-:104, hbf-offlist.mjs H25/H26), verbatim; OP is the vm realm's Object.prototype.
const OBJ = {
  M1a: (o, OP) => OWN(o, '__proto__') && Object.getPrototypeOf(o) === OP && JSON.stringify(Object.keys(o)) === '["__proto__","a"]' && o.__proto__ !== OP && JSON.stringify(Object.getOwnPropertyDescriptor(o, '__proto__').value) === '{"x":1}' && o.x === undefined,
  M1b: (o, OP) => OWN(o.b, '__proto__') && Object.getPrototypeOf(o.b) === OP && o.b.x === undefined && JSON.stringify(Object.getOwnPropertyDescriptor(o.b, '__proto__').value) === '{"x":1}',
  M1c: (o, OP) => OWN(o, '__proto__') && Object.getPrototypeOf(o) === OP && JSON.stringify(Object.getOwnPropertyDescriptor(o, '__proto__').value) === '{"n":1}',
  M1d: (o, OP) => OWN(o, 'constructor') && OWN(o, 'prototype') && o.prototype === 'p' && JSON.stringify(o.constructor) === '{"a":1}' && Object.getPrototypeOf(o) === OP,
  M1e: (o, OP) => !OWN(o, '__proto__') && Object.getPrototypeOf(o) === OP && o.a === 1,
  M1f: (o, OP) => Array.isArray(o) && OWN(o[0], '__proto__') && Object.getPrototypeOf(o[0]) === OP,
  M1g: (o, OP) => JSON.stringify(o) === '{"constructor":{"prototype":{"ok":1}}}' && Object.getPrototypeOf(o) === OP,
  // N1: a top-level string passes through unchanged. On the storage path HBF never saves a top-level string and a JSON
  // replacer drops it (fail closed, plan N1*): no output (or a throw) is accepted there, a changed or leaked string is not.
  N1a: (o, OP, p) => o === 'https://u:p@h/' || (p === 'storage' && o === undefined),
  H25: (o, OP) => Object.getPrototypeOf(o) === OP && o.isAdmin === undefined && OWN(o, '__proto__') && !JSON.stringify(o).includes('SEKRIT') && Object.getPrototypeOf(o.chapterOutlines[0]) === OP && o.chapterOutlines[0].x === undefined,
  H26: (o) => !JSON.stringify(o).includes('SEKRIT') && o.drafts[0].draftText === `see ${MARK} ok` && o.setup.preferredModel === 'grok-4.7' && o.drafts[0].sources[1] === 'https://doi.org/10.1/x',
};

function checkStr(run, input, out, cls, label) {
  const o = run(H.clone({ f: input }));
  const dropped = !own(o, 'f'); const got = dropped ? null : o.f;
  const changed = dropped || got !== input;
  const bad = cls === 'keep' ? changed : cls === 'noleak' ? (!dropped && String(got).includes('SEKRIT')) : !changed;
  if (bad) assert.fail(`CLASS ${label}: want ${cls === 'keep' ? 'keep' : cls === 'noleak' ? 'no SEKRIT' : 'strip'} ${show(out)}, got ${show(got)}`);
  if (got !== out) assert.fail(`EXACT ${label}: want ${show(out)}, got ${show(got)}`);
}

assert.equal(FX.marker, MARK);
// ref-nel-fix5 options flip (CoS 06:57): superseded keep rows run as expected-redacted rows; hbf-rows.json stays frozen (sha + old out pinned).
const FLIP = JSON.parse(fs.readFileSync(new URL('./fixtures/hbf-rows-flip.json', import.meta.url), 'utf8'));
const FLIP_IDS = new Set(FLIP.rows.map((r) => r.id));
test('HBF/FLIP frozen: hbf-rows.json sha and each superseded row\'s old expectation are unchanged', () => {
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('./fixtures/hbf-rows.json', import.meta.url))).digest('hex'), FLIP.fixtureSha256);
  // fix7.5-D3 (CoS (a)): pin the flip file itself; regenerate only with tools/hbf/gen-flip-f1.mjs.
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('./fixtures/hbf-rows-flip.json', import.meta.url))).digest('hex'), '241bdd4931a7a79e4fdecb7a235e4d43d68e727657eff514e3b960d1709bbda7', 'hbf-rows-flip.json sha');
  for (const f of FLIP.rows) { const r = FX.rows.find((x) => x.id === f.id); assert.ok(r, f.id); assert.equal(r.out, f.frozenOut, f.id + ' frozen out'); assert.equal(r.cls, 'keep', f.id); } });
for (const p of PATHS) for (const f of FLIP.rows) test(`HBF/${p}/FLIP/${f.id} redact (was keep)`, () => { const r = FX.rows.find((x) => x.id === f.id); checkStr(H.paths[p], r.input, f.out, 'strip', f.id + ' flip'); });
for (const p of PATHS) {
  const run = H.paths[p];
  const groups = new Map();
  for (const r of FX.rows) { if (Object.hasOwn(REVERSED_V22_KEEP, r.id) || FLIP_IDS.has(r.id)) continue; const g = r.gap ? `${r.grp} gap ${r.gap}` : r.grp; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(r); }
  for (const [g, rows] of groups) {
    describe(`HBF ${p} ${g}`, () => {
      for (const r of rows) {
        const what = r.kind === 'name' ? (r.secret ? 'secret' : 'keep') : r.kind === 'obj' ? 'object' : r.cls === 'noleak' ? 'noleak' : r.out === null ? 'drop' : r.out === r.input ? 'keep' : 'redact';
        test(`HBF/${p}/${g}/${r.id} ${what}`, () => {
          if (r.kind === 'name') {
            const o = run(H.clone({ [r.input]: 'v', ok: 1 }));
            const stripped = !own(o, r.input);
            if (stripped !== r.secret) assert.fail(`CLASS ${r.id}: key ${show(r.input)} want ${r.secret ? 'stripped' : 'kept'}, got ${stripped ? 'stripped' : 'kept'}`);
            if (!own(o, 'ok')) assert.fail(`CLASS ${r.id}: sibling key ok was dropped`);
            return;
          }
          if (r.kind === 'obj') {
            let o; try { o = run(H.JP(r.input)); } catch (e) { if (!(r.id === 'N1a' && p === 'storage')) assert.fail(`CLASS ${r.id}: threw ${e.message}`); o = undefined; } // N1 storage: a throw saves nothing (fail closed)
            if (!OBJ[r.id](o, H.OP, p)) assert.fail(`CLASS ${r.id}: got ${show(o)}`);
            return;
          }
          checkStr(run, r.input, r.out, r.cls, r.id);
          if (r.also) checkStr(run, r.also[0], r.also[1], 'strip', r.id + ' (prose form)');
        });
      }
    });
  }
}
