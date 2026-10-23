// fix702 strict timing bar (LOCAL ONLY, never run by CI). CI runs `node --test "tests/sec/**/*.test.mjs"` (test.yml SEC-SWEEP step), which does
// not match this path or name, and no package.json script references it. CI rows (fix702.hbf.test.mjs, fix185n.hbf.test.mjs) use a 2000 ms bound
// so shared runners do not flake; this script holds the <= 100 ms bar at 64k.
// Usage: node tests/perf-local/hbf-702-timing.mjs   (exit 1 if any 64k cell is over 100 ms)
// Part A: fix702 shapes, best of 3 per cell after a warm-up. Part B: fix185n.hbf.test.mjs rows copied word for word (single shot, as in CI), bar 100 ms.
import { loadHBF, readHBF, PATHS } from '../sec/hbf/_hbf-load.mjs';
import { runPage } from '../sec/hbf/_hbf-env.mjs';

const BAR_MS = 100;
const P = runPage(readHBF(), { names: ['redactAll', 'SEP_TRIM'] }).found;
const out = []; const over = [];
const note = (grp, id, N, p, ms) => { out.push([grp, id, N, p, ms]); if (N === 65536 && ms > BAR_MS) over.push([grp, id, p, ms]); console.log([process.version, grp, id, N, p, ms.toFixed(1)].join('\t')); };

{ // Part A
  const H = loadHBF(); const ra = P.redactAll;
  const best = (fn) => { let b = Infinity; for (let r = 0; r < 3; r++) { const t = performance.now(); fn(); b = Math.min(b, performance.now() - t); } return b; };
  const run = (p, s) => p === 'redactAll' ? ra(s) : H.paths[p](H.clone({ notes: s }));
  ra('Cookie: a=x  z'); for (const p of PATHS) run(p, 'Cookie: a=x  z');
  const fit = (N, head, body, tail) => head + body.repeat(Math.ceil(N / body.length)).slice(0, N - head.length - tail.length) + tail;
  const NON_LT = '\t\v\f \u0085\u00a0\u00ad\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u200b\u200c\u200d\u202f\u205f\u2060\u3000\ufeff';
  const ALL = ['redactAll', ...PATHS];
  const row = (grp, id, N, mk, paths) => { const s = mk(N); for (const p of paths) note(grp, id, N, p, best(() => run(p, s))); };
  // Copilot r4343556111 shape
  for (const N of [32768, 65536]) row('copilot', '702 cookie sp', N, (n) => ('Cookie: a=x' + ' '.repeat(n)).slice(0, n - 1) + 'z', ['redactAll']);
  const SH = [
    ['spaces+z', (n) => fit(n, 'Cookie: a=x', ' ', 'z')], ['tabs+z', (n) => fit(n, 'Cookie: a=x', '\t', 'z')], ['U+00A0+z', (n) => fit(n, 'Cookie: a=x', '\u00a0', 'z')],
    ['U+3000+z', (n) => fit(n, 'Cookie: a=x', '\u3000', 'z')], ['U+200B+z', (n) => fit(n, 'Cookie: a=x', '\u200b', 'z')], ['mixed+z', (n) => fit(n, 'Cookie: a=x', NON_LT, 'z')],
    ['run,z partway,run+w', (n) => fit(n, 'Cookie: a=x', ' '.repeat(n / 2) + 'z' + '\u00a0'.repeat(n), 'w')], ['; mid-cookie b=x+run+z;c=2', (n) => fit(n, 'Cookie: a=1; b=x', ' ', 'z; c=2')],
    ['name a+run+b=x', (n) => fit(n, 'Cookie: a', ' ', 'b=x')], ['ctl name a+run+=x', (n) => fit(n, 'Cookie: a', ' ', '=x')],
    ['ctl CRLF run', (n) => fit(n, 'Cookie: a=x', '\r\n', 'z')], ['ctl no trailing z', (n) => fit(n, 'Cookie: a=x', ' ', '')],
  ];
  for (const N of [32768, 65536]) for (const [id, mk] of SH) row('702', id, N, mk, ALL);
  // SEP_TRIM itself, every REDACT_SEP code point
  const T = P.SEP_TRIM; const CPS = [...NON_LT, '\n', '\r', '\u2028', '\u2029', '%20'];
  for (const c of CPS) { const s = 'x' + c.repeat(65536) + 'z'; note('SEP_TRIM', 'U+' + (c === '%20' ? '%20' : c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')), 65536, 'SEP_TRIM', best(() => s.replace(T, ''))); }
}

{ // Part B: fix185n.hbf.test.mjs rows, word for word except BUDGET_MS = 100 and test()/assert -> note()
const H = loadHBF();
const ra = H.page.found.redactAll || H.ctx.redactAll;
const FORMS = [
  [':830 spaces', (n) => 'Cookie: ' + ' '.repeat(n) + 'x'], [':830 tabs', (n) => 'Cookie: ' + '\t'.repeat(n) + 'x'],
  [':830 a=1; mixed', (n) => 'Cookie: a=1;' + ' '.repeat(n) + 'x'],
  [':833 NL spaces', (n) => 'Cookie: a=1\n' + ' '.repeat(n) + 'x'], [':833 NL tabs', (n) => 'Cookie: a=1\n' + '\t'.repeat(n) + 'x'],
];
const BUDGET_MS = 100;
  for (const [n, g] of FORMS) for (const p of ['redactAll', ...PATHS]) {
    const v = g(65536); const t0 = performance.now(); if (p === 'redactAll') ra(v); else H.paths[p](H.clone({ notes: v })); const ms = performance.now() - t0;
    note('fix185n', n, 65536, p, ms); if (!(ms < BUDGET_MS)) console.log(`# OVER ${p} ${n} 64k took ${ms.toFixed(0)} ms`); }
}

const worst = out.filter((r) => r[2] === 65536).sort((a, b) => b[4] - a[4])[0];
console.log('WORST64k', worst.join(' | '), `over${BAR_MS}:`, over.length);
for (const o of over) console.log('# OVER', o.join(' | '));
process.exitCode = over.length ? 1 : 0;
