// fix702 (#187 TOP PRIORITY, PR #185 thread r4343556111; Brian option A). SEP_TRIM (HerbalBookForge.html:702) must be linear on a
// separator run that is followed by a non-separator: on b4f09b00 the `(?:SEP)+$` alternative retried from every position inside the
// run (quadratic; `Cookie: a=x`+64k spaces+`z` took ~22 s on export). Fix anchors that alternative to the start of a run.
// Rows: 64k shapes through export/import/storage (< 2000 ms each; 100 ms bar in the evidence script), every sep-codepoints.txt code point through SEP_TRIM itself,
// a seeded old-vs-new differential fuzz (SEP_TRIM and redactAll/3 paths with the b4f09b00 SEP_TRIM line swapped back in), and short
// controls that must match b4f09b00 byte for byte. Synthetic values only. Red on b4f09b00 except the rows marked `control`.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadHBF, readHBF, PATHS } from './_hbf-load.mjs';
import { runPage } from './_hbf-env.mjs';

// CI bound 2000 ms at 64k, like fix185n.hbf.test.mjs BUDGET_MS and redos-lt REDACTALL_BUDGET_MS (b4f09b00 takes 4-26 s on these rows, so they
// stay red). The CoS 100 ms bar (Node 20 and 22, every path) is checked by the evidence timing script, not here, to avoid CI flakes.
const BAR_MS = 2000;
const N = 65536;
const H = loadHBF();
const html = readHBF();
const NAMES = { names: ['REDACT_SEP', 'SEP_TRIM', 'redactAll'] };
const P = runPage(html, NAMES).found;
// b4f09b00 :702, verbatim. OLD_HTML is the shipped page with only the SEP_TRIM line swapped back to it (the differential reference).
const OLD_LINE = "const SEP_TRIM = new RegExp('^(?:' + REDACT_SEP + ')+|(?:' + REDACT_SEP + ')+$', 'gu');";
const LINE_RE = /^const SEP_TRIM = .*$/m;
assert.ok(LINE_RE.test(html), 'SEP_TRIM line not found');
const OLD_HTML = html.replace(LINE_RE, () => OLD_LINE);
const HO = loadHBF({ fresh: true, src: OLD_HTML });
const PO = runPage(OLD_HTML, NAMES).found;
const SEP = PO.REDACT_SEP; assert.equal(typeof SEP, 'string', 'REDACT_SEP ABSENT');
const OLD_TRIM = new RegExp('^(?:' + SEP + ')+|(?:' + SEP + ')+$', 'gu');
const NEW_TRIM = P.SEP_TRIM; assert.ok(NEW_TRIM && typeof NEW_TRIM.source === 'string', 'SEP_TRIM ABSENT');
const ra = P.redactAll, raOld = PO.redactAll; assert.equal(typeof ra, 'function', 'redactAll ABSENT'); assert.equal(typeof raOld, 'function', 'old redactAll ABSENT');
const CPS = fs.readFileSync(new URL('./fixtures/sep-codepoints.txt', import.meta.url), 'utf8').split('\n').filter((h) => /^[0-9A-F]{4,6}$/.test(h)).map((h) => String.fromCodePoint(parseInt(h, 16)));
const NON_LT = CPS.filter((c) => !/[\r\n\u2028\u2029]/.test(c));
const fit = (head, body, tail) => head + body.slice(0, N - head.length - tail.length) + tail; // exactly 64k
const rep = (s) => s.repeat(Math.ceil(N / s.length));
const timed = (fn) => { const t0 = performance.now(); fn(); return performance.now() - t0; };
const out = (Hx, p, v) => { const o = Hx.paths[p](Hx.clone({ notes: v, title: 'keep' })); return o === undefined ? undefined : o.notes; };

// [id, 64k string, red on b4f09b00?]
const SHAPES = [
  ['value + spaces + z (Copilot r4343556111)', fit('Cookie: a=x', rep(' '), 'z'), true],
  ['value + tabs + z', fit('Cookie: a=x', rep('\t'), 'z'), true],
  ['value + U+00A0 + z', fit('Cookie: a=x', rep('\u00a0'), 'z'), true],
  ['value + U+3000 + z', fit('Cookie: a=x', rep('\u3000'), 'z'), true],
  ['value + U+200B + z', fit('Cookie: a=x', rep('\u200b'), 'z'), true],
  ['value + mixed non-LT sep run + z', fit('Cookie: a=x', rep(NON_LT.join('')), 'z'), true],
  ['value + run, z partway, run + w', fit('Cookie: a=x', rep(' ').slice(0, N / 2) + 'z' + rep('\u00a0'), 'w'), true],
  ['run after ; mid-cookie: b=x + run + z; c=2', fit('Cookie: a=1; b=x', rep(' '), 'z; c=2'), true],
  ['name side: a + run + b=x', fit('Cookie: a', rep(' '), 'b=x'), true],
  ['control: name side a + run + =x (trailing run, one $ match)', fit('Cookie: a', rep(' '), '=x'), false],
  ['control: CRLF run (COOKIE_SOURCE value stops at CR)', fit('Cookie: a=x', rep('\r\n'), 'z'), false],
  ['control: run with no trailing z (one $ match)', fit('Cookie: a=x', rep(' '), ''), false],
];

describe('HBF fix702 SEP_TRIM linear at :702 (red on b4f09b00)', () => {
  out(H, 'export', 'Cookie: a=x   z'); // warm-up
  for (const [id, s] of SHAPES) for (const p of PATHS) test(`702/${p} ${id} 64k < ${BAR_MS} ms`, () => {
    assert.equal(s.length, N); const ms = timed(() => H.paths[p](H.clone({ notes: s })));
    console.log(`# TIMING 702 | ${p} | ${id} | ${ms.toFixed(1)} ms`);
    assert.ok(ms < BAR_MS, `${p} ${id} 64k took ${ms.toFixed(0)} ms`); });
  for (const c of CPS) { const cp = 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
    test(`702/SEP_TRIM x+${cp}*64k+z < ${BAR_MS} ms and trims like b4f09b00`, () => {
      const s = fit('x', rep(c), 'z'), e = c + c + 'x' + c + c; NEW_TRIM.lastIndex = 0;
      const ms = timed(() => s.replace(NEW_TRIM, ''));
      console.log(`# TIMING 702 | SEP_TRIM | ${cp} | ${ms.toFixed(1)} ms`);
      assert.ok(ms < BAR_MS, `${cp} 64k took ${ms.toFixed(0)} ms`);
      assert.equal(e.replace(NEW_TRIM, ''), e.replace(OLD_TRIM, '')); assert.equal(s.slice(0, 50).replace(NEW_TRIM, ''), s.slice(0, 50).replace(OLD_TRIM, '')); }); }
});

describe('HBF fix702 output identical to b4f09b00 (seeded differential)', () => {
  let seed = 702702; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  test('702/fuzz SEP_TRIM old vs new: 300000 strings over every sep code point + non-seps, 0 diffs', () => {
    const A = [...CPS, ...CPS, 'a', 'z', '=', ';', '%20', '\u2061', '\u200e', '\ud83d\ude00', '\ud800', 'x y'];
    let d = 0, first = null;
    for (let i = 0; i < 300000; i++) { let s = ''; const L = Math.floor(rnd() * 14); for (let j = 0; j < L; j++) s += pick(A);
      const a = s.replace(OLD_TRIM, ''), b = s.replace(NEW_TRIM, ''); if (a !== b) { d++; first = first || JSON.stringify(s); } }
    console.log(`# FUZZ SEP_TRIM 300000 cases, diffs ${d}`); assert.equal(d, 0, 'first diff ' + first);
  });
  test('702/fuzz redactAll + export/import/storage old vs new: 6000 cookie-shaped strings, 0 diffs', () => {
    const A = ['Cookie: ', 'Set-Cookie:', 'cookie\u00a0: ', 'a=', 'sid=', 'token=', 'theme=dark', 'SYNTHaaaaBBBB1234cccc5678dddd', 'x', 'z', ';', '; ', '=', '"', '%20', '\r\n', '\n', ...CPS];
    let d = 0, first = null;
    for (let i = 0; i < 6000; i++) { let s = ''; const L = 1 + Math.floor(rnd() * 12); for (let j = 0; j < L; j++) s += pick(A);
      const bad = raOld(s) !== ra(s) || (i % 3 === 0 && PATHS.some((p) => out(HO, p, s) !== out(H, p, s)));
      if (bad) { d++; first = first || JSON.stringify(s); } }
    console.log(`# FUZZ redactAll/paths 6000 cases, diffs ${d}`); assert.equal(d, 0, 'first diff ' + first);
  });
  const S = 'SYNTHaaaaBBBB1234cccc5678dddd';
  const CONTROLS = ['Cookie: a=x   z', 'Cookie: sid=abc ', 'Cookie:  sid =  abc  ', 'Cookie: token\u00a0=\u3000' + S + '\u200b', 'Cookie: theme=dark ; lang=en\t',
    'Cookie: a=1; b=x \u2060 z; c=2', 'Set-Cookie: session=' + S + ' ; Path=/', 'Cookie: api%4Bey = abcdef ', 'Cookie: \ufeffsid\ufeff=v', 'cookies are tasty: yes '];
  for (const v of CONTROLS) test('702/same ' + JSON.stringify(v).slice(0, 48), () => {
    assert.equal(ra(v), raOld(v), 'redactAll'); for (const p of PATHS) assert.equal(out(H, p, v), out(HO, p, v), p); });
});
