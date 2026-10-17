// #163 guards: GOV-TO-01 (per-step timeout-minutes on the qe5 / b2-lean smokes)
// and MUT-QE5 / MUT-B2 (each smoke must exit 1 when pointed at a broken HTML path).
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, '..');
const SMOKES = ['test:smoke:qe5', 'test:smoke:b2-lean'];
let failures = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

// GOV-TO-01: each named smoke step carries its own timeout-minutes. A job-level timeout does not count.
function govTimeout(source) {
  const workflow = load(source);
  for (const script of SMOKES) {
    const runLine = new RegExp(`^\\s*npm run ${script.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm');
    const steps = [];
    for (const job of Object.values(workflow.jobs || {})) {
      for (const step of job.steps || []) {
        if (typeof step.run === 'string' && runLine.test(step.run)) steps.push(step);
      }
    }
    assert.equal(steps.length, 1, `expected exactly one step running ${script}, found ${steps.length}`);
    const t = steps[0]['timeout-minutes'];
    assert.ok(Number.isFinite(t) && t > 0, `step "${steps[0].name}" (${script}) has no step-level timeout-minutes`);
  }
}

const fixtureOk = `jobs:
  test:
    steps:
      - name: qe5
        timeout-minutes: 5
        run: npm run test:smoke:qe5
      - name: b2
        timeout-minutes: 5
        run: npm run test:smoke:b2-lean
`;
const fixtureJobOnly = `jobs:
  test:
    timeout-minutes: 30
    steps:
      - name: qe5
        run: npm run test:smoke:qe5
      - name: b2
        timeout-minutes: 5
        run: npm run test:smoke:b2-lean
`;

check('GOV-TO-01 fixture: per-step timeouts accepted', () => govTimeout(fixtureOk));
check('GOV-TO-01 fixture: job-level timeout does not count', () =>
  assert.throws(() => govTimeout(fixtureJobOnly), /no step-level timeout-minutes/));
check('GOV-TO-01 fixture: missing step rejected', () =>
  assert.throws(() => govTimeout(fixtureOk.replace('test:smoke:b2-lean', 'test:smoke:other')), /exactly one step/));
check('GOV-TO-01 test.yml: qe5 and b2-lean smoke steps each have timeout-minutes', () =>
  govTimeout(readFileSync(path.join(REPO, '.github', 'workflows', 'test.yml'), 'utf8')));

// MUT-QE5 / MUT-B2: point each smoke at a broken HTML path; each must exit 1.
const tmp = mkdtempSync(path.join(tmpdir(), 'nw-mut-'));
const brokenHtml = path.join(tmp, 'broken.html');
writeFileSync(brokenHtml, '<!doctype html><html><head><title>broken</title></head><body>no NovelWriter here</body></html>');
const missingHtml = path.join(tmp, 'does-not-exist', 'NovelWriter.html');
const mutants = [
  ['MUT-QE5', 'scripts/_qe5_smoke.cjs'],
  ['MUT-B2', 'scripts/_smoke_b2_lean.mjs'],
];
for (const [id, script] of mutants) {
  for (const [label, html] of [['missing file', missingHtml], ['broken HTML', brokenHtml]]) {
    check(`${id} (${label}) exits 1`, () => {
      const r = spawnSync(process.execPath, [path.join(REPO, script)], {
        cwd: REPO,
        env: { ...process.env, NW_HTML: html },
        encoding: 'utf8',
        timeout: 120000,
      });
      assert.equal(r.status, 1, `${script} with NW_HTML=${label} exited ${r.status} (signal ${r.signal}); stderr: ${(r.stderr || '').slice(-300)}`);
    });
  }
}
rmSync(tmp, { recursive: true, force: true });

if (failures) {
  console.error(`#163 guards: ${failures} failing`);
  process.exitCode = 1;
} else {
  console.log('#163 guards: all passing');
}