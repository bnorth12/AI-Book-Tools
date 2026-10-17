// M-STAB WP0 G-WIRE: every `test:smoke:nw-*` script in package.json must run in CI.
// Each one needs exactly one step in .github/workflows/test.yml that runs it on every
// pull_request to main with its failure failing the job (see `wiredScripts` for the policy), and
// that step needs its own name, its own timeout-minutes, no `env:` and no secrets. Scripts that
// are deliberately kept out of CI go in DEFERRED, each with a follow-up
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

// What counts as wired for pull requests. Conservative: anything the guard can't prove runs on
// every pull_request to main, with a failure that fails the job, is NOT wired.
//  - workflow `on:` includes pull_request; allowed filters are `branches:` (must contain main, no
//    `!` negations) and `types:` (must include opened and synchronize). No paths/paths-ignore/branches-ignore.
//  - job and step `if:` absent or one of always() / success() / true (with or without ${{ }}).
//  - job and step `continue-on-error` absent or false.
//  - step `shell:` and job/workflow `defaults.run.shell` absent or exactly `bash`; step
//    `working-directory:` and job/workflow `defaults.run.working-directory` absent or the repo root.
//  - every job in `needs:` exists and passes the same job rule (recursively).
//  - the step's whole `run` is exactly one `npm run <script>` (no args, `&&`, `;`, `||`, newlines,
//    echo or comments): one smoke per step, each with its own timeout-minutes (#178 round 2).
//  - the package.json body behind it exists and isn't hollow (`|| true`, `|| :`, `exit 0`, `echo`).
const ALWAYS_TRUE_IF = new Set(['always()', 'success()', 'true']);
const NPM_RUN = /^npm run ([A-Za-z0-9:._-]+)$/;
const HOLLOW_BODY = /\|\|\s*(?:true\b|:)|\bexit\s+0\b|\becho\b/;
const ROOT_DIRS = new Set(['.', './']);
const fmt = (v) => JSON.stringify(v);

function condAlwaysTrue(v) {
  if (v === undefined || v === true) return true;
  if (typeof v !== 'string') return false;
  let s = v.trim();
  const m = /^\$\{\{([\s\S]*)\}\}$/.exec(s);
  if (m) s = m[1].trim();
  return ALWAYS_TRUE_IF.has(s.replace(/\s+/g, ''));
}

function triggerReason(on) {
  const notPr = 'workflow does not run on pull_request';
  if (typeof on === 'string') return on === 'pull_request' ? null : notPr;
  if (Array.isArray(on)) return on.includes('pull_request') ? null : notPr;
  if (!on || typeof on !== 'object' || !Object.hasOwn(on, 'pull_request')) return notPr;
  const pr = on.pull_request;
  if (pr === null || pr === undefined) return null;
  if (typeof pr !== 'object' || Array.isArray(pr)) return `pull_request trigger has an unrecognised shape ${fmt(pr)}`;
  for (const k of Object.keys(pr)) if (k !== 'branches' && k !== 'types') return `pull_request trigger has a ${k}: filter`;
  if (pr.branches !== undefined) {
    const b = pr.branches;
    if (!Array.isArray(b) || b.some((x) => typeof x !== 'string' || x.startsWith('!')) || !b.some((x) => ['main', '*', '**'].includes(x))) {
      return `pull_request branches: ${fmt(b)} may exclude main (negations are not allowed)`;
    }
  }
  if (pr.types !== undefined && !(Array.isArray(pr.types) && pr.types.includes('opened') && pr.types.includes('synchronize'))) {
    return `pull_request types: ${fmt(pr.types)} does not include opened and synchronize`;
  }
  return null;
}

function jobReason(jobs, id, path = []) {
  const job = jobs[id];
  if (!job || typeof job !== 'object') return `needs missing job ${id}`;
  if (path.includes(id)) return `needs cycle at job ${id}`;
  if (!condAlwaysTrue(job.if)) return `job ${id} has if: ${fmt(job.if)}`;
  const needs = job.needs === undefined ? [] : Array.isArray(job.needs) ? job.needs : [job.needs];
  for (const n of needs) {
    if (typeof n !== 'string') return `job ${id} has needs: ${fmt(job.needs)}`;
    const r = jobReason(jobs, n, [...path, id]);
    if (r) return `job ${id} needs ${n}: ${r}`;
  }
  return null;
}

function runScripts(run) {
  const m = NPM_RUN.exec(run.trim());
  return m ? [m[1]] : null;
}

const runDefault = (scope, key) => (scope && scope.defaults && scope.defaults.run ? scope.defaults.run[key] : undefined);
const exactBash = (v) => v === undefined || v === 'bash';
const atRoot = (v) => v === undefined || ROOT_DIRS.has(v);

const coe = (v) => v !== undefined && v !== false;

function stepReason(workflow, jobs, id, job, step, script, trig) {
  const scripts = runScripts(step.run);
  if (!scripts || !scripts.includes(script)) return 'run is not exactly one `npm run <script>` (combined, masked, echoed, commented or extra commands/args)';
  if (trig) return trig;
  const jr = jobReason(jobs, id);
  if (jr) return jr;
  if (coe(job['continue-on-error'])) return `job ${id} has continue-on-error: ${fmt(job['continue-on-error'])}`;
  if (!condAlwaysTrue(step.if)) return `has if: ${fmt(step.if)}`;
  if (coe(step['continue-on-error'])) return `has continue-on-error: ${fmt(step['continue-on-error'])}`;
  if (!exactBash(step.shell)) return `has shell: ${fmt(step.shell)}`;
  if (!exactBash(runDefault(job, 'shell'))) return `job ${id} has defaults.run.shell: ${fmt(runDefault(job, 'shell'))}`;
  if (!exactBash(runDefault(workflow, 'shell'))) return `workflow has defaults.run.shell: ${fmt(runDefault(workflow, 'shell'))}`;
  if (!atRoot(step['working-directory'])) return `has working-directory: ${fmt(step['working-directory'])}`;
  if (!atRoot(runDefault(job, 'working-directory'))) return `job ${id} has defaults.run.working-directory: ${fmt(runDefault(job, 'working-directory'))}`;
  if (!atRoot(runDefault(workflow, 'working-directory'))) return `workflow has defaults.run.working-directory: ${fmt(runDefault(workflow, 'working-directory'))}`;
  return null;
}

// For one package.json script: the steps that wire it, and why each other step mentioning it doesn't.
function wiredScripts(workflow, script) {
  const mention = new RegExp(`(?<![\\w:.-])${escapeRe(script)}(?![\\w:.-])`);
  const wired = [];
  const reasons = [];
  const jobs = workflow && typeof workflow.jobs === 'object' && workflow.jobs ? workflow.jobs : {};
  const trig = triggerReason(workflow ? workflow.on : undefined);
  for (const [id, job] of Object.entries(jobs)) {
    for (const step of (job && Array.isArray(job.steps) ? job.steps : [])) {
      if (!step || typeof step.run !== 'string' || !mention.test(step.run)) continue;
      const label = `step "${step.name ?? '(unnamed)'}"`;
      const r = stepReason(workflow, jobs, id, job, step, script, trig);
      if (r) reasons.push(`${label} ${r}`);
      else wired.push(step);
    }
  }
  return { wired, reasons };
}

function mentionedAnywhere(workflow, script) {
  const mention = new RegExp(`(?<![\\w:.-])${escapeRe(script)}(?![\\w:.-])`);
  return Object.values((workflow && workflow.jobs) || {}).some((job) =>
    (job && Array.isArray(job.steps) ? job.steps : []).some((st) => st && typeof st.run === 'string' && mention.test(st.run)));
}

export function guard(pkgScripts, workflowSource, deferred = DEFERRED) {
  const workflow = load(workflowSource);
  const errors = [];
  const nwScripts = Object.keys(pkgScripts).filter((k) => k.startsWith(PREFIX));
  const deferredNames = new Set(deferred.map((d) => d.script));

  for (const d of deferred) {
    if (!ISSUE_URL.test(String(d.issue || ''))) errors.push(`DEFERRED ${d.script} has no follow-up issue URL`);
    if (!nwScripts.includes(PREFIX + d.script.replace(/^nw-/, ''))) errors.push(`DEFERRED ${d.script} no longer exists in package.json`);
    else if (mentionedAnywhere(workflow, PREFIX + d.script.replace(/^nw-/, ''))) errors.push(`DEFERRED ${d.script} is wired in test.yml; remove it from DEFERRED`);
  }

  // A step running an nw smoke that package.json doesn't define runs nothing.
  for (const job of Object.values((workflow && workflow.jobs) || {})) {
    for (const st of (job && Array.isArray(job.steps) ? job.steps : [])) {
      const ran = st && typeof st.run === 'string' ? runScripts(st.run) : null;
      if (ran && ran[0].startsWith(PREFIX) && !Object.hasOwn(pkgScripts, ran[0])) {
        errors.push(`${ran[0].slice('test:smoke:'.length)} step "${st.name ?? '(unnamed)'}" runs a script missing from package.json`);
      }
    }
  }

  for (const script of nwScripts) {
    const short = script.slice('test:smoke:'.length);
    if (deferredNames.has(short)) continue;
    const body = pkgScripts[script];
    if (typeof body !== 'string' || !body.trim() || HOLLOW_BODY.test(body)) {
      errors.push(`${short} is not wired for pull_request: package.json body ${fmt(body)} is hollow`);
      continue;
    }
    const { wired: steps, reasons } = wiredScripts(workflow, script);
    if (steps.length === 0) {
      errors.push(reasons.length ? `${short} is not wired for pull_request: ${reasons.join('; ')}` : `${short} has no step`);
      continue;
    }
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
  const pkg = { 'test:smoke:nw-a': 'node scripts/a.mjs', 'test:smoke:nw-b': 'node scripts/b.mjs', 'test:smoke:nw-later': 'node scripts/later.mjs', 'smoke:nw-other': 'node scripts/other.mjs' };
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
    assert.deepEqual(guard(pkg, ok.replace('test:smoke:nw-b', 'test:ci:zzz'), D), ['b has no step'].map((s) => 'nw-' + s)));
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
    assert.deepEqual(guard({ 'test:smoke:nw-a': 'node scripts/a.mjs', 'test:smoke:nw-b': 'node scripts/b.mjs' }, ok, []), []));
  check('G-WIRE fixture: with DEFERRED empty, an unwired script is required', () =>
    assert.deepEqual(guard(pkg, ok, []), ['nw-later has no step']));

  // Copilot r:33 / r:57 + Engineering scope (2026-10-17): a smoke counts as wired only if it runs,
  // and its failure fails the job, on every pull_request to main. `run` is always a block literal
  // so `#`, `;`, `||` and `${{ }}` reach the guard verbatim.
  const P2 = { 'test:smoke:nw-a': 'node scripts/a.mjs', 'test:smoke:nw-b': 'node scripts/b.mjs' };
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
    ['job if: always()', wfJobA('    if: always()\n')],
    ['job needs a plain job', wfJobA('    needs: test\n')],
    ['on: pull_request (string)', wfOnA('on: pull_request\n')],
    ['on: [push, pull_request]', wfOnA('on: [push, pull_request]\n')],
  ];
  for (const [label, yml] of WIRED) {
    check(`G-WIRE still wired: ${label}`, () => assert.deepEqual(guard(P2, yml, []), []));
  }

  // #178 round 2 (CoS final round, 2026-10-17 12:41 AM CT). Item 1 reverses round 1: a step's run
  // must be exactly one `npm run test:smoke:nw-*`, so `a && b` no longer wires either smoke.
  const PB = (body) => ({ 'test:smoke:nw-a': body, 'test:smoke:nw-b': 'node scripts/b.mjs' });
  const onPr = (filter) => `on:\n  pull_request:\n${filter}`;
  const jobDefaults = (k, v) => `    defaults:\n      run:\n        ${k}: ${v}\n`;
  const wfDefaults = (k, v) => `${PR_ON}defaults:\n  run:\n    ${k}: ${v}\n`;
  const R2_NOT_WIRED = [
    // [item, label, yml, pkg, subject]
    [1, 'a && b in one step does not wire a', wf(job('test', step('A+B', `${RA} && ${RB}`))), P2, 'nw-a'],
    [1, 'a && b in one step does not wire b', wf(job('test', step('A+B', `${RA} && ${RB}`))), P2, 'nw-b'],
    [1, 'a && b plus a separate a step does not wire b', wf(job('test', step('A+B', `${RA} && ${RB}`) + step('A again', RA))), P2, 'nw-b'],
    [1, 'npm run a -- --grep x (extra args)', wfStepA(`${RA} -- --grep x`), P2, 'nw-a'],
    [2, "branches: [main, '!main']", wfOnA(onPr("    branches: [main, '!main']\n")), P2, 'nw-a'],
    [2, "branches: ['**', '!main']", wfOnA(onPr("    branches: ['**', '!main']\n")), P2, 'nw-a'],
    [2, "branches: ['!main']", wfOnA(onPr("    branches: ['!main']\n")), P2, 'nw-a'],
    [2, 'branches-ignore: [main]', wfOnA(onPr('    branches-ignore: [main]\n')), P2, 'nw-a'],
    [3, "step shell: bash -c 'true' {0}", wfStepA(RA, "        shell: bash -c 'true' {0}\n"), P2, 'nw-a'],
    [3, 'step shell: bash {0}', wfStepA(RA, "        shell: 'bash {0}'\n"), P2, 'nw-a'],
    [3, 'step shell: sh', wfStepA(RA, '        shell: sh\n'), P2, 'nw-a'],
    [3, "job defaults.run.shell: 'echo {0}'", wf(job('test', step('A smoke', RA) + stepB, jobDefaults('shell', "'echo {0}'"))), P2, 'nw-a'],
    [3, 'job defaults.run.shell: pwsh', wf(job('test', step('A smoke', RA) + stepB, jobDefaults('shell', 'pwsh'))), P2, 'nw-a'],
    [3, "workflow defaults.run.shell: 'echo {0}'", wf(job('test', step('A smoke', RA) + stepB), wfDefaults('shell', "'echo {0}'")), P2, 'nw-a'],
    [4, 'types: [labeled]', wfOnA(onPr('    types: [labeled]\n')), P2, 'nw-a'],
    [4, 'types: [closed]', wfOnA(onPr('    types: [closed]\n')), P2, 'nw-a'],
    [4, 'types: [opened] (no synchronize)', wfOnA(onPr('    types: [opened]\n')), P2, 'nw-a'],
    [5, 'script body ends || true', wfStepA(RA), PB('node scripts/a.mjs || true'), 'nw-a'],
    [5, 'script body ends ; exit 0', wfStepA(RA), PB('node scripts/a.mjs; exit 0'), 'nw-a'],
    [5, 'script body is echo', wfStepA(RA), PB('echo skipped'), 'nw-a'],
    [5, 'script body is bare exit 0', wfStepA(RA), PB('exit 0'), 'nw-a'],
    [5, 'script body is empty', wfStepA(RA), PB(''), 'nw-a'],
    [5, 'script body ends ; true', wfStepA(RA), PB('node scripts/a.mjs; true'), 'nw-a'],
    [5, 'script body ends ; :', wfStepA(RA), PB('node scripts/a.mjs; :'), 'nw-a'],
    [5, 'script body is bare true', wfStepA(RA), PB('true'), 'nw-a'],
    [5, 'script body is bare :', wfStepA(RA), PB(':'), 'nw-a'],
    [5, 'script body pipes into | cat', wfStepA(RA), PB('node scripts/a.mjs | cat'), 'nw-a'],
    [5, 'script body ends with a trailing &', wfStepA(RA), PB('node scripts/a.mjs &'), 'nw-a'],
    [5, 'script body ends || node -e 0', wfStepA(RA), PB('node scripts/a.mjs || node -e 0'), 'nw-a'],
    [5, 'script body is node -e ""', wfStepA(RA), PB('node -e ""'), 'nw-a'],
    [5, 'script body is npm run noop (not followed; noop is defined)', wfStepA(RA), { ...PB('npm run noop'), noop: 'node scripts/noop.mjs' }, 'nw-a'],
    [5, 'script body ends ;true', wfStepA(RA), PB('node scripts/a.mjs;true'), 'nw-a'],
    [5, 'script body ends |true', wfStepA(RA), PB('node scripts/a.mjs |true'), 'nw-a'],
    [5, 'script body has true on its own line after the smoke', wfStepA(RA), PB('node scripts/a.mjs\ntrue'), 'nw-a'],
    [5, 'script body is printf ok', wfStepA(RA), PB('printf ok'), 'nw-a'],
    [5, 'script body is node -e 0', wfStepA(RA), PB('node -e 0'), 'nw-a'],
    [5, 'step runs an nw smoke missing from package.json', wf(job('test', step('A smoke', RA) + stepB + step('Ghost', 'npm run test:smoke:nw-ghost'))), P2, 'nw-ghost'],
    [6, 'step working-directory: NovelWriter', wfStepA(RA, '        working-directory: NovelWriter\n'), P2, 'nw-a'],
    [6, 'job defaults.run.working-directory: sub', wf(job('test', step('A smoke', RA) + stepB, jobDefaults('working-directory', 'sub'))), P2, 'nw-a'],
    [6, 'workflow defaults.run.working-directory: sub', wf(job('test', step('A smoke', RA) + stepB), wfDefaults('working-directory', 'sub')), P2, 'nw-a'],
  ];
  for (const [item, label, yml, pk, subject] of R2_NOT_WIRED) {
    check(`[R2 item ${item}] not wired: ${label}`, () => {
      const errs = guard(pk, yml, []);
      const hit = subject === 'nw-ghost' ? errs.some((e) => e.startsWith('nw-ghost ')) : notWired(errs, subject);
      assert.ok(hit, `${subject} counted as wired; errors: ${JSON.stringify(errs)}`);
    });
  }
  const R2_WIRED = [
    [3, 'step shell: bash', wfStepA(RA, '        shell: bash\n')],
    [3, 'job defaults.run.shell: bash', wf(job('test', step('A smoke', RA) + stepB, jobDefaults('shell', 'bash')))],
    [4, 'types: [opened, synchronize]', wfOnA(onPr('    types: [opened, synchronize]\n'))],
    [4, 'types: [opened, synchronize, reopened] with branches: [main]', wfOnA(onPr('    branches: [main]\n    types: [opened, synchronize, reopened]\n'))],
    [6, 'step working-directory: .', wfStepA(RA, "        working-directory: '.'\n")],
  ];
  for (const [item, label, yml] of R2_WIRED) {
    check(`[R2 item ${item}] still wired: ${label}`, () => assert.deepEqual(guard(P2, yml, []), []));
  }

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
