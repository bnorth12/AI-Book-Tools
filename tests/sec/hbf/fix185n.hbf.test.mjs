// fix185n (PR #185 narrowed, Brian's call B'): only (b) from fix7.6. COOKIE_GAP* at COOKIE_SOURCE :830 and COOKIE_NL_SOURCE :833 is linear.
// Rows ported from fix76.hbf.test.mjs (b): 64k spaces, tabs and a=1;-mixed timing, now on redactAll and all 3 paths, plus the
// exact-output cookie control rows (matched set unchanged vs 7a1cd426). Red on 7a1cd426. Synthetic secret only.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHBF, PATHS } from './_hbf-load.mjs';

const H = loadHBF();
const ra = H.page.found.redactAll || H.ctx.redactAll;
const S = 'SYNTHaaaaBBBB1234cccc5678dddd';
const MARK = '[credential link removed]';
const run = (p, v) => { const o = H.paths[p](H.clone({ notes: v, title: 'keep' })); return o === undefined ? undefined : o.notes; };

const FORMS = [
  [':830 spaces', (n) => 'Cookie: ' + ' '.repeat(n) + 'x'], [':830 tabs', (n) => 'Cookie: ' + '\t'.repeat(n) + 'x'],
  [':830 a=1; mixed', (n) => 'Cookie: a=1;' + ' '.repeat(n) + 'x'],
  [':833 NL spaces', (n) => 'Cookie: a=1\n' + ' '.repeat(n) + 'x'], [':833 NL tabs', (n) => 'Cookie: a=1\n' + '\t'.repeat(n) + 'x'],
];
// Budget 2000 ms (Engineering fix7.6 condition 2), as in fix76.hbf.test.mjs; the 100 ms bar is checked by the evidence timing script.
const BUDGET_MS = 2000;
describe('HBF fix185n (b) COOKIE_GAP linear at :830 and :833 (red on 7a1cd426)', () => {
  for (const [n, g] of FORMS) for (const p of ['redactAll', ...PATHS]) test(`b/${p} ${n} 64k < ${BUDGET_MS} ms`, () => {
    const v = g(65536); const t0 = performance.now(); if (p === 'redactAll') ra(v); else H.paths[p](H.clone({ notes: v })); const ms = performance.now() - t0;
    assert.ok(ms < BUDGET_MS, `${p} ${n} 64k took ${ms.toFixed(0)} ms`); });
  // matched set unchanged: exact 7a1cd426 outputs on all 3 paths (undefined = field dropped)
  const same = [
    ['Cookie: sid=abcdef', undefined], ['Cookie:\tsid=abcdef', undefined], ['Cookie:   a=1; token=' + S, undefined],
    ['Set-Cookie: "session=' + S + '"', MARK + '"'],
    ['Cookie: a=1\n   ' + S + '9', 'Cookie: a=1\n   ' + MARK], ['Cookie: a=1\r\n\t' + S, 'Cookie: a=1\r\n\t' + MARK], ['Cookie: a=1\n\n' + S, 'Cookie: a=1\n\n' + MARK],
    ['Cookie: theme=dark', 'Cookie: theme=dark'], ['Cookie: a=1\n   hello world', 'Cookie: a=1\n   hello world'], ['cookies are tasty: yes', 'cookies are tasty: yes'],
    ['Cookie: a=1\n' + ' '.repeat(40) + 'shortword1', 'Cookie: a=1\n' + ' '.repeat(40) + 'shortword1'],
  ];
  for (const [v, want] of same) test('b/same ' + JSON.stringify(v).slice(0, 50), () => { for (const p of PATHS) assert.equal(run(p, v), want, p); });
});
