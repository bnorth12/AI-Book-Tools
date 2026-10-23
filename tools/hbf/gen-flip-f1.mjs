// tools/hbf/gen-flip-f1.mjs [REPO] [--write]: re-pin ONLY F1.out in tests/sec/hbf/fixtures/hbf-rows-flip.json from the shipped HBF (CoS (a), 21:39 CDT).
// Runs F1's hbf-rows.json input through all 3 strip paths. Refuses to write unless: 3 paths agree; every other flip row still gives its pinned out;
// new visible text (MARK removed) is a strict subsequence of the old visible text (nothing added, something removed); no '%2574oken' in the output.
// The edit replaces only F1's "out" value in place (other bytes kept).
import fs from 'node:fs'; import crypto from 'node:crypto'; import path from 'node:path';
const argRepo = process.argv.slice(2).find((a) => !a.startsWith('--'));
const REPO = argRepo ? path.resolve(argRepo) : path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
// Hard-coded spec (CoS, spec-asserting): F1 must come out as SPEC; PRIOR is the out pinned in flip file 870e70a6.
const SPEC = 'see [credential link removed] end', PRIOR = 'see https://e.com/?[credential link removed] end'; const W = process.argv.includes('--write');
const { loadHBF, MARK } = await import(path.join(REPO, 'tests/sec/hbf/_hbf-load.mjs'));
const FXP = path.join(REPO, 'tests/sec/hbf/fixtures/hbf-rows.json'), FP = path.join(REPO, 'tests/sec/hbf/fixtures/hbf-rows-flip.json');
const FX = JSON.parse(fs.readFileSync(FXP, 'utf8')); const raw = fs.readFileSync(FP, 'utf8'); const FL = JSON.parse(raw);
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex'); const H = loadHBF();
const run = (input) => Object.fromEntries(['export', 'import', 'storage'].map((p) => { const o = H.paths[p](H.clone({ f: input })); return [p, Object.hasOwn(o, 'f') ? o.f : null]; }));
const fail = (m) => { console.log('STOP: ' + m); process.exit(2); };
const rep = { oldFileSha: sha(raw), hbfRowsSha: sha(fs.readFileSync(FXP)), rows: {} };
for (const f of FL.rows) { const r = FX.rows.find((x) => x.id === f.id); const got = run(r.input); rep.rows[f.id] = { input: r.input, pinned: f.out, got };
  const vals = new Set(Object.values(got)); if (vals.size !== 1) fail(`${f.id}: paths disagree ${JSON.stringify(got)}`);
  if (f.id !== 'F1' && got.export !== f.out) fail(`${f.id} moved: ${JSON.stringify(f.out)} -> ${JSON.stringify(got.export)}`); }
const F1 = FL.rows.find((f) => f.id === 'F1'), neu = rep.rows.F1.got.export; if (neu === null) fail('F1 dropped (null)');
const vis = (s) => s.split(MARK).join('');
const isSubseq = (a, b) => { let i = 0; for (const c of b) if (i < a.length && a[i] === c) i++; return i === a.length; };
if (neu !== SPEC) fail('F1 output is not the spec: ' + JSON.stringify(neu));
if (F1.out !== PRIOR && F1.out !== SPEC) fail('F1 pinned out is neither PRIOR nor SPEC: ' + JSON.stringify(F1.out));
const ov = vis(PRIOR), nv = vis(neu); // compare to PRIOR, so a re-run at the re-pinned head checks the same thing
rep.check1_visibleStrictSubset = { oldVisible: ov, newVisible: nv, subsequence: isSubseq(nv, ov), shorter: nv.length < ov.length, pass: isSubseq(nv, ov) && nv.length < ov.length };
rep.check2_no_2574oken = { pass: !neu.includes('%2574oken') };
rep.F1 = { old: F1.out, new: neu };
if (!rep.check1_visibleStrictSubset.pass) fail('check1 failed ' + JSON.stringify(rep.check1_visibleStrictSubset));
if (!rep.check2_no_2574oken.pass) fail('check2 failed');
const oldFrag = '"id":"F1","frozenOut":' + JSON.stringify(F1.frozenOut) + ',"out":' + JSON.stringify(F1.out);
if (raw.split(oldFrag).length !== 2) fail('F1 fragment not found exactly once');
const out = raw.replace(oldFrag, '"id":"F1","frozenOut":' + JSON.stringify(F1.frozenOut) + ',"out":' + JSON.stringify(neu));
const chk = JSON.parse(out); if (JSON.stringify(chk.rows.filter((r) => r.id !== 'F1')) !== JSON.stringify(FL.rows.filter((r) => r.id !== 'F1')) || chk.fixtureSha256 !== FL.fixtureSha256 || chk._about !== FL._about) fail('non-F1 bytes moved');
rep.newFileSha = sha(out); rep.wrote = W; if (W) fs.writeFileSync(FP, out);
console.log(JSON.stringify(rep, null, 1));
