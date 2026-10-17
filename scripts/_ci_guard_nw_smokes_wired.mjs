// M-STAB WP0 G-WIRE: every `test:smoke:nw-*` script in package.json must run in CI.
// Each one needs exactly one step in .github/workflows/test.yml (found by the script name in
// its `npm run` line), and that step needs its own name, its own timeout-minutes, no `env:` and
// no secrets. Scripts that are deliberately kept out of CI go in DEFERRED, each with a follow-up
// issue URL; the guard also fails if a DEFERRED entry loses its issue, disappears from
// package.json, or gets wired (then it must come off the list).
//
//   node scripts/_ci_guard_nw_smokes_wired.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, '..');
const PREFIX = 'test:smoke:nw-';
const ISSUE_URL = /^https:\/\/github\.com\/bnorth12\/AI-Book-Tools\/issues\/\d+$/;

// Smokes deliberately kept out of CI (M-STAB plan WP0, Reviewer MF6). Every entry needs a
// follow-up issue URL; the guard fails on an empty `issue`. Empty since the CoS ruling of
// 2026-10-16 (~11:56 PM CT): nw-draft-only is wired in CI instead of deferred.
// Entry shape: { script: 'nw-<name>', issue: 'https://github.com/bnorth12/AI-Book-Tools/issues/<n>' }
export const DEFERRED = [];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function stepsRunning(workflow, script) {
  const runLine = new RegExp(`^\\s*npm run ${escapeRe(script)}(?:\\s+--\\s.*)?\\s*$`, 'm');
  const out = [];
  for (const job of Object.values(workflow.jobs || {})) {
    for (const step of job.steps || []) {
      if (typeof step.run === 'string' && runLine.test(step.run)) out.push(step);
    }
  }
  return out;
}

export function guard(pkgScripts, workflowSource, deferred = DEFERRED) {
  const workflow = load(workflowSource);
  const errors = [];
  const nwScripts = Object.keys(pkgScripts).filter((k) => k.startsWith(PREFIX));
  const deferredNames = new Set(deferred.map((d) => d.script));

  for (const d of deferred) {
    if (!ISSUE_URL.test(String(d.issue || ''))) errors.push(`DEFERRED ${d.script} has no follow-up issue URL`);
    if (!nwScripts.includes(PREFIX + d.script.replace(/^nw-/, ''))) errors.push(`DEFERRED ${d.script} no longer exists in package.json`);
    else if (stepsRunning(workflow, PREFIX + d.script.replace(/^nw-/, '')).length) errors.push(`DEFERRED ${d.script} is wired in test.yml; remove it from DEFERRED`);
  }

  for (const script of nwScripts) {
    const short = script.slice('test:smoke:'.length);
    if (deferredNames.has(short)) continue;
    const steps = stepsRunning(workflow, script);
    if (steps.length === 0) { errors.push(`${short} has no step`); continue; }
    if (steps.length > 1) { errors.push(`${short} has ${steps.length} steps, expected 1`); continue; }
    const s = steps[0];
    if (typeof s.name !== 'string' || !s.name.trim()) errors.push(`${short} step has no name`);
    const t = s['timeout-minutes'];
    if (!(Number.isFinite(t) && t > 0)) errors.push(`${short} step "${s.name}" has no step-level timeout-minutes`);
    if (s.env !== undefined) errors.push(`${short} step "${s.name}" declares env:`);
    if (/\bsecrets\s*[.[]/.test(JSON.stringify(s))) errors.push(`${short} step "${s.name}" references secrets`);
  }
  return errors;
}

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}: ${error.message}`); }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const URL1 = 'https://github.com/bnorth12/AI-Book-Tools/issues/1';
  const pkg = { 'test:smoke:nw-a': 'x', 'test:smoke:nw-b': 'x', 'test:smoke:nw-later': 'x', 'smoke:nw-other': 'x' };
  const PR_ON = 'on:\n  pull_request:\n    branches: [main]\n';
  const ok = `${PR_ON}jobs:
  test:
    steps:
      - name: A smoke
        timeout-minutes: 5
        run: npm run test:smoke:nw-a
      - name: B smoke
        timeout-minutes: 5
        run: npm run test:smoke:nw-b
`;
  const D = [{ script: 'nw-later', issue: URL1 }];
  check('G-WIRE fixture: wired scripts + deferred entry with issue accepted', () => assert.deepEqual(guard(pkg, ok, D), []));
  check('G-WIRE fixture: unwired script rejected', () =>
    assert.deepEqual(guard(pkg, ok.replace('test:smoke:nw-b', 'test:smoke:nw-zzz'), D), ['b has no step'].map((s) => 'nw-' + s)));
  check('G-WIRE fixture: job-level timeout does not count', () =>
    assert.match(guard(pkg, ok.replace('    steps:', '    timeout-minutes: 30\n    steps:').replace(/      - name: B smoke\n        timeout-minutes: 5\n/, '      - name: B smoke\n'), D).join('|'), /nw-b step "B smoke" has no step-level timeout-minutes/));
  check('G-WIRE fixture: step env and secrets rejected', () => {
    const e = guard(pkg, ok.replace('        run: npm run test:smoke:nw-b', "        env:\n          K: '${{ secrets.XAI_API_KEY }}'\n        run: npm run test:smoke:nw-b"), D).join('|');
    assert.match(e, /declares env:/); assert.match(e, /references secrets/);
  });
  check('G-WIRE fixture: unnamed step rejected', () =>
    assert.match(guard(pkg, ok.replace('      - name: B smoke\n        timeout-minutes: 5\n', '      - timeout-minutes: 5\n'), D).join('|'), /nw-b step has no name/));
  check('G-WIRE fixture: duplicate step rejected', () =>
    assert.match(guard(pkg, ok + '      - name: B again\n        timeout-minutes: 5\n        run: npm run test:smoke:nw-b\n', D).join('|'), /nw-b has 2 steps/));
  check('G-WIRE fixture: DEFERRED entry without issue URL rejected', () =>
    assert.deepEqual(guard(pkg, ok, [{ script: 'nw-later', issue: '' }]), ['DEFERRED nw-later has no follow-up issue URL']));
  check('G-WIRE fixture: DEFERRED entry missing from package.json rejected', () =>
    assert.match(guard(pkg, ok, [...D, { script: 'nw-gone', issue: URL1 }]).join('|'), /DEFERRED nw-gone no longer exists in package.json/));
  check('G-WIRE fixture: DEFERRED entry that is wired rejected', () =>
    assert.match(guard(pkg, ok + '      - name: L\n        timeout-minutes: 5\n        run: npm run test:smoke:nw-later\n', D).join('|'), /DEFERRED nw-later is wired/));
  check('G-WIRE fixture: non-nw / non-test:smoke scripts ignored', () =>
    assert.deepEqual(guard({ 'smoke:nw-167': 'x', 'test:smoke:qe5': 'x' }, 'jobs: {}\n', []), []));

  check('G-WIRE DEFERRED list is empty (nw-draft-only wired, CoS ruling)', () =>
    assert.deepEqual(DEFERRED.map((d) => d.script), []));
  check('G-WIRE fixture: empty DEFERRED list passes when everything is wired', () =>
    assert.deepEqual(guard({ 'test:smoke:nw-a': 'x', 'test:smoke:nw-b': 'x' }, ok, []), []));
  check('G-WIRE fixture: with DEFERRED empty, an unwired script is required', () =>
    assert.deepEqual(guard(pkg, ok, []), ['nw-later has no step']));

  // Copilot r:33 / r:57 + Engineering scope (2026-10-17): a smoke counts as wired only if it runs,
  // and its failure fails the job, on every pull_request to main. `run` is always a block literal
  // so `#`, `;`, `||` and `${{ }}` reach the guard verbatim.
  const P2 = { 'test:smoke:nw-a': 'x', 'test:smoke:nw-b': 'x' };
  const RA = 'npm run test:smoke:nw-a';
  const RB = 'npm run test:smoke:nw-b';
  const block = (text, ind) => text.split('\n').map((l) => ind + l).join('\n');
  const step = (name, run, extra = '') =>
    `      - name: ${name}\n        timeout-minutes: 5\n${extra}        run: |-\n${block(run, '          ')}\n`;
  const job = (id, steps, extra = '') => `  ${id}:\n    runs-on: ubuntu-latest\n${extra}    steps:\n${steps}`;
  const wf = (jobs, on = PR_ON) => `${on}jobs:\n${jobs}`;
  const stepB = step('B smoke', RB);
  const wfStepA = (run, extra = '') => wf(job('test', step('A smoke', run, extra) + stepB));
  const wfJobA = (extra) => wf(job('test', stepB) + job('a', step('A smoke', RA), extra));
  const wfOnA = (on) => wf(job('test', step('A smoke', RA) + stepB), on);
  const notWired = (errs, short) => errs.some((e) => e === `${short} has no step` || e.startsWith(`${short} is not wired`));
  const NOT_WIRED = [
    // step level
    ['step if: false', wfStepA(RA, '        if: false\n')],
    ['step if: ${{ false }}', wfStepA(RA, '        if: ${{ false }}\n')],
    ["step if: github.event_name == 'workflow_dispatch'", wfStepA(RA, "        if: github.event_name == 'workflow_dispatch'\n")],
    ["step if: github.ref == 'refs/heads/main' (never true on pull_request)", wfStepA(RA, "        if: github.ref == 'refs/heads/main'\n")],
    ['step continue-on-error: true', wfStepA(RA, '        continue-on-error: true\n')],
    ['run ends || true', wfStepA(`${RA} || true`)],
    ['run ends ; exit 0', wfStepA(`${RA}; exit 0`)],
    ['smoke only inside a multi-line echo', wfStepA(`echo "\n${RA}\n"`)],
    ['smoke only in a single-line echo', wfStepA(`echo ${RA}`)],
    ['smoke only in a shell comment', wfStepA(`# ${RA}\necho skipped`)],
    ['smoke only in a YAML comment', wf(job('test', `      # - name: A smoke\n      #   run: ${RA}\n` + stepB))],
    ['r:57 a; b in one step (a masked without set -e)', wf(job('test', step('A+B', `${RA}; ${RB}`)))],
    ['r:57 a || true && b in one step', wf(job('test', step('A+B', `${RA} || true && ${RB}`)))],
    ['r:57 a and b on separate lines in one step', wf(job('test', step('A+B', `${RA}\n${RB}`)))],
    // job level
    ['job if: false', wfJobA('    if: false\n')],
    ['job if: ${{ false }}', wfJobA('    if: ${{ false }}\n')],
    ["job if: github.event_name == 'workflow_dispatch'", wfJobA("    if: github.event_name == 'workflow_dispatch'\n")],
    ['job continue-on-error: true', wfJobA('    continue-on-error: true\n')],
    ['job needs a dispatch-only job', wf(job('test', stepB) + job('gate', step('noop', 'npm run lint'), "    if: github.event_name == 'workflow_dispatch'\n") + job('a', step('A smoke', RA), '    needs: gate\n'))],
    ['job needs [plain, gated-off] jobs', wf(job('test', stepB) + job('gate', step('noop', 'npm run lint'), '    if: false\n') + job('a', step('A smoke', RA), '    needs: [test, gate]\n'))],
    ['job needs a missing job', wf(job('test', stepB) + job('a', step('A smoke', RA), '    needs: nope\n'))],
    // workflow triggers
    ['on: workflow_dispatch only', wfOnA('on: workflow_dispatch\n')],
    ['on: [push, workflow_dispatch]', wfOnA('on: [push, workflow_dispatch]\n')],
    ['on: pull_request with paths: filter', wfOnA("on:\n  pull_request:\n    paths: ['docs/**']\n")],
    ['on: pull_request with paths-ignore: filter', wfOnA("on:\n  pull_request:\n    paths-ignore: ['scripts/**']\n")],
    ['on: pull_request branches: excludes main', wfOnA('on:\n  pull_request:\n    branches: [release]\n')],
  ];
  for (const [label, yml] of NOT_WIRED) {
    check(`G-WIRE not wired: ${label}`, () => {
      const errs = guard(P2, yml, []);
      assert.ok(notWired(errs, 'nw-a'), `nw-a counted as wired; errors: ${JSON.stringify(errs)}`);
    });
  }
  const WIRED = [
    ['step if: always()', wfStepA(RA, '        if: always()\n')],
    ['step if: ${{ always() }}', wfStepA(RA, '        if: ${{ always() }}\n')],
    ['step with no if', wfStepA(RA)],
    ['step continue-on-error: false', wfStepA(RA, '        continue-on-error: false\n')],
    ['a && b in one step wires both (Engineering ruling)', wf(job('test', step('A+B', `${RA} && ${RB}`)))],
    ['job if: always()', wfJobA('    if: always()\n')],
    ['job needs a plain job', wfJobA('    needs: test\n')],
    ['on: pull_request (string)', wfOnA('on: pull_request\n')],
    ['on: [push, pull_request]', wfOnA('on: [push, pull_request]\n')],
  ];
  for (const [label, yml] of WIRED) {
    check(`G-WIRE still wired: ${label}`, () => assert.deepEqual(guard(P2, yml, []), []));
  }
  check('G-WIRE fixture: a && b plus a separate a step is 2 steps for a', () =>
    assert.match(guard(P2, wf(job('test', step('A+B', `${RA} && ${RB}`) + step('A again', RA))), []).join('|'), /nw-a has 2 steps/));

  const pkgScripts = JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8')).scripts || {};
  const yml = readFileSync(path.join(REPO, '.github', 'workflows', 'test.yml'), 'utf8');
  const errors = guard(pkgScripts, yml);
  const wiring = errors.filter((e) => !e.startsWith('DEFERRED '));
  const deferredErrors = errors.filter((e) => e.startsWith('DEFERRED '));
  check('G-WIRE test.yml: every test:smoke:nw-* script has its own named, timed step (DEFERRED excepted)', () =>
    assert.deepEqual(wiring, [], wiring.join('; ')));
  check('G-WIRE DEFERRED entries: issue URL present, still in package.json, not wired', () =>
    assert.deepEqual(deferredErrors, [], deferredErrors.join('; ')));

  if (failures) { console.error(`G-WIRE guard: ${failures} failing`); process.exitCode = 1; }
  else console.log('G-WIRE guard: all passing');
}
