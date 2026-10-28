#!/usr/bin/env node
// FIX3b MUT-BRID: puts back the title-based batch id in a PATCHED COPY (never the committed file) and shows the
// R7/R8 canary rows turn RED there and stay GREEN on the real code. Offline; fake key only. Usage: node scripts/_mut_nw_brid.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, NW_AUTOSAVE_ONLY: 'R7|R8' };
for (const k of Object.keys(env)) if (/xai|grok_api/i.test(k)) delete env[k];
const run = (cwd) => spawnSync(process.execPath, ['scripts/_smoke_nw_autosave.mjs'], { cwd, env, encoding: 'utf8', timeout: 300000 });
const summary = (r) => ((r.stdout || '').match(/SUMMARY nw-autosave: .*/) || ['no summary'])[0];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-mut-brid-'));
let ok = true;
try {
  for (const d of ['NovelWriter', 'scripts', 'tests', 'HerbalBookForge', 'package.json']) {
    if (fs.existsSync(path.join(ROOT, d))) fs.cpSync(path.join(ROOT, d), path.join(tmp, d), { recursive: true });
  }
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'));
  const f = path.join(tmp, 'NovelWriter', 'NovelWriter.html');
  let h = fs.readFileSync(f, 'utf8');
  const muts = [
    [/id: nwOpaqueId\('br_'\),[^\n]*/, "id: (novelData.title || 'Untitled') + '|' + now,"],
    [/function nwBatchIsOpaqueId\(id\) \{[^\n]*\}/, "function nwBatchIsOpaqueId(id) { return typeof id === 'string' && id.length > 0; }"],
  ];
  for (const [re, to] of muts) { if (!re.test(h)) { console.log('MUT-BRID: mutation site not found ' + re); process.exit(2); } h = h.replace(re, to); }
  fs.writeFileSync(f, h);
  const mut = run(tmp);
  const real = run(ROOT);
  const mutFails = ((mut.stdout || '').match(/^FAIL R7\.[^\s]+/gm) || []);
  console.log((mut.stdout || '').split('\n').filter((l) => /^(PASS|FAIL) R[78]/.test(l)).map((l) => 'MUTANT ' + l.slice(0, 160)).join('\n'));
  console.log('MUTANT ' + summary(mut) + ' rc=' + mut.status);
  console.log('REAL   ' + summary(real) + ' rc=' + real.status);
  const red = mut.status !== 0 && mutFails.some((l) => /batch-put/.test(l)) && mutFails.some((l) => /discard-writeback/.test(l));
  const green = real.status === 0;
  console.log(`MUT-BRID mutant-red=${red} real-green=${green}`);
  ok = red && green;
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(ok ? 'MUT-BRID PASS' : 'MUT-BRID FAIL');
process.exit(ok ? 0 : 1);
