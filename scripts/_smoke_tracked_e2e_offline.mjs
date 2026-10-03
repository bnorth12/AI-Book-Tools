/**
 * PR3 offline smoke for the Tracked E2E runner and unified report (no API key, no paid calls).
 *
 *  1. Runs scripts/run-tracked-e2e.mjs in its default offline mode against this checkout's HTML:
 *     exit 0, every xAI request answered by the fixture responder (0 unmatched prompts), artifacts
 *     only under NW_OUT_DIR, dated + LATEST report built with Annex E prose, git status unchanged.
 *     c1Smoke: with PR1's real runC1Smoke() it is a pass (gate fix carry-in, Reviewer note (a): the runner must not
 *     false-fail on it); on an HTML without runC1Smoke it is a skip (status 'skip', ok null).
 *     autoEnrichChapterBlueprints (gate fix 1) is a skip: the six-beat seed's outline already passes the beats.
 *  2. Live-mode guards: NW_E2E_LIVE=1 under CI (CI=true, CI=false, CI=on) exits 3; NW_E2E_LIVE=1 without
 *     a key exits 3 (key vars scrubbed, NW_ENV_FILE pointed at a missing file) - all before a browser starts.
 *  3. A failing report build marks the run incomplete and exits 4 (Copilot #117 high); LATEST.md says so.
 *  3b. Patched HTML copies under NW_OUT_DIR: runC1Smoke() returning false fails c1Smoke (exit 2); an
 *     unexpected page error fails the run (exit 2, step pageErrors).
 *  4. build_unified_report.py on structured plot values + an unknown NW_REPORT_TZ still builds; a Windows
 *     zone name is mapped; the rate card follows the requested model (unknown when there is no card).
 *  5. In-page runTrackedE2E() with callAI answered by the same responder: completes, no throw on
 *     an HTML without the PR1 token rollup, usage read from the session ledger (Copilot #117 high).
 *     A cancelled window.confirm() returns before resetState(): novelData unchanged, 0 api.x.ai requests.
 *     HTTP 500 on the chapter calls makes both chapter steps FAIL; runC1Smoke() === false makes c1Smoke FAIL.
 *
 * Usage: node scripts/_smoke_tracked_e2e_offline.mjs   (see scripts/README.md)
 * Env:   NW_HTML_PATH, NW_OUT_DIR (default out/nw-e2e-smoke), NW_PYTHON
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright';
import { createOfflineResponder, toXaiResponse } from './_nw_e2e_offline_responder.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const HTML_PATH = path.resolve(process.env.NW_HTML_PATH || path.join(REPO_ROOT, 'NovelWriter', 'NovelWriter.html'));
const OUT_DIR = path.resolve(process.env.NW_OUT_DIR || path.join(REPO_ROOT, 'out', 'nw-e2e-smoke'));
const RUNNER = path.join(SCRIPT_DIR, 'run-tracked-e2e.mjs');
const BUILDER = path.join(SCRIPT_DIR, 'build_unified_report.py');
const SEED = path.join(SCRIPT_DIR, 'fixtures', 'nw_slop', 'b3r_seed.json');
const PY = process.env.NW_PYTHON ? [process.env.NW_PYTHON] : (process.platform === 'win32' ? ['py', '-3'] : ['python3']);

const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail: detail == null ? '' : String(detail) }); };

// Child env: never carry a key or a live flag into the smoke's runs.
function childEnv(extra) {
  const env = Object.assign({}, process.env);
  for (const k of ['XAI_API_KEY', 'GROK_API_KEY', 'NW_E2E_LIVE', 'NW_E2E_FIXTURE', 'NW_E2E_ENRICH', 'NW_E2E_REGEN_BIBLE',
    'NW_E2E_SLOP_INJECT', 'NW_E2E_OUTLINE_ONLY', 'NW_E2E_CHAPTERS', 'NW_E2E_STRICT', 'NW_E2E_REPORT_BUILDER', 'NW_E2E_FORCE_MULTIPASS']) delete env[k];
  env.NW_ENV_FILE = path.join(OUT_DIR, 'no-such-env-file.env');
  env.NW_HTML_PATH = HTML_PATH;
  return Object.assign(env, extra || {});
}

function runRunner(extra, timeoutMs) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [RUNNER], { cwd: REPO_ROOT, env: childEnv(extra), encoding: 'utf-8', timeout: timeoutMs || 300000 });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', ms: Date.now() - t0, error: r.error };
}

function gitStatus() {
  const r = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: REPO_ROOT, encoding: 'utf-8' });
  return r.status === 0 ? r.stdout : null;
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? listFiles(path.join(dir, d.name)) : [path.join(dir, d.name)]);
}

// PR1 HTML (merged into feat/nw-token-packing) defines runC1Smoke and the gate-fix auto-enrich helper.
const HTML_SRC = fs.readFileSync(HTML_PATH, 'utf8');
const HAS_C1 = /async function runC1Smoke\s*\(/.test(HTML_SRC);
const HAS_AUTO_ENRICH = /async function maybeAutoEnrichBlueprints\s*\(/.test(HTML_SRC);

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
const gitBefore = gitStatus();

// ---- 1. default offline run ----
const run1Dir = path.join(OUT_DIR, 'run1');
const r1 = runRunner({ NW_OUT_DIR: run1Dir });
check('offline run exits 0', r1.status === 0, 'status=' + r1.status + ' ms=' + r1.ms + (r1.status !== 0 ? ' stderr=' + r1.stderr.slice(-800) : ''));
let rep1 = null;
try { rep1 = JSON.parse(fs.readFileSync(path.join(run1Dir, 'TRACKED_E2E_REPORT.json'), 'utf8')); } catch (e) { check('report JSON readable', false, e.message); }
if (rep1) {
  check('mode is offline', rep1.mode === 'offline', rep1.mode);
  check('report.ok true', rep1.ok === true, 'failed=' + JSON.stringify((rep1.summary || {}).failedSteps));
  check('fixture responder answered every prompt (0 unmatched)', rep1.offline && Array.isArray(rep1.offline.unmatched) && rep1.offline.unmatched.length === 0, JSON.stringify((rep1.offline || {}).unmatched || null).slice(0, 400));
  check('LLM calls happened (all offline)', (rep1.summary || {}).callCount > 0 && (rep1.network || {}).calls === (rep1.offline.rules || []).length, 'calls=' + (rep1.summary || {}).callCount + ' net=' + (rep1.network || {}).calls);
  check('no key value in report JSON', !/xai-[A-Za-z0-9]{10,}/.test(JSON.stringify(rep1)), '');
  check('report build ok', rep1.reportBuild && rep1.reportBuild.ok === true, JSON.stringify(rep1.reportBuild));
  const c1Row = (rep1.steps || []).find((s) => s.name === 'c1Smoke');
  if (HAS_C1) {
    check('c1Smoke: real runC1Smoke() is a pass in the runner (status pass, ok true)', !!c1Row && c1Row.status === 'pass' && c1Row.ok === true, JSON.stringify(c1Row));
  } else {
    check('c1Smoke absent helper recorded as skip (status skip, ok not true)', !!c1Row && c1Row.status === 'skip' && c1Row.ok !== true && ((rep1.summary || {}).skippedSteps || []).includes('c1Smoke'), JSON.stringify(c1Row));
  }
  if (HAS_AUTO_ENRICH) {
    const aeRow = (rep1.steps || []).find((s) => s.name === 'autoEnrichChapterBlueprints');
    check('autoEnrichChapterBlueprints row is skip for the six-beat seed (runner)', !!aeRow && aeRow.status === 'skip' && aeRow.ok === null, JSON.stringify(aeRow));
  }
  check('every step row has a pass/fail/skip status', (rep1.steps || []).length > 0 && (rep1.steps || []).every((s) => ['pass', 'fail', 'skip'].includes(s.status)), JSON.stringify((rep1.steps || []).filter((s) => !['pass', 'fail', 'skip'].includes(s.status)).map((s) => s.name)));
  check('no unexpected page errors in the offline run', Array.isArray(rep1.pageErrors) && rep1.pageErrors.length === 0 && !(rep1.steps || []).some((s) => s.name === 'pageErrors'), JSON.stringify(rep1.pageErrors).slice(0, 300));
  check('rate card follows requested model (unknown for ' + (rep1.config || {}).model + ')', rep1.cost && (/^grok-4\.3$/.test((rep1.config || {}).model) ? rep1.cost.billing_model === 'grok-4.3' : (rep1.cost.billing_model === 'unknown' && rep1.cost.total_cost_usd === null)), JSON.stringify(rep1.cost && { m: rep1.cost.billing_model, c: rep1.cost.total_cost_usd }));
  const stepNames = (rep1.steps || []).map((s) => s.name);
  for (const need of ['fetchAuthors', 'suggestStoryInfo', 'suggestCharacters', 'suggestSubplots', 'generateNovelOutlines', 'generateChapterOutline1',
    'generateChapterOutline2', 'generateChapter1+quality', 'generateChapter2+quality', 'applyStagedChapterImprovements1', 'reviseChapterForQuality1',
    'suggestBookImprovements', 'applyTopBookCritique']) {
    check('step ran: ' + need, stepNames.includes(need), '');
  }
}
const files1 = listFiles(run1Dir).map((f) => path.basename(f));
const dated = files1.find((f) => /^TRACKED_E2E_REPORT_\d{4}-\d{2}-\d{2}_\d{6}\.md$/.test(f));
check('dated report written in NW_OUT_DIR', !!dated, files1.join(','));
check('LATEST report written in NW_OUT_DIR', files1.includes('TRACKED_E2E_REPORT_LATEST.md'), '');
if (dated) {
  const md = fs.readFileSync(path.join(run1Dir, dated), 'utf8');
  check('report marks offline mode', /\*\*Mode:\*\* `offline`/.test(md), '');
  check('report has Annex E with chapter prose', /### Annex E/.test(md) && /#### Chapter 1 .*full text/.test(md), '');
}
check('no __pycache__ left by the builder', !listFiles(SCRIPT_DIR).some((f) => /__pycache__/.test(f)), '');

// ---- 2. live-mode guards (exit before any browser/network) ----
// Any non-empty CI value is CI. Exit 3 before a browser/network: no progress log is ever written.
for (const ciVal of ['true', 'false', 'on']) {
  const ciDir = path.join(OUT_DIR, 'live-ci-' + ciVal);
  const rCi = runRunner({ NW_OUT_DIR: ciDir, NW_E2E_LIVE: '1', CI: ciVal, GITHUB_ACTIONS: '' }, 60000);
  check('NW_E2E_LIVE=1 with CI=' + ciVal + ' refused (exit 3, before browser/network)', rCi.status === 3 && /refused under CI/.test(rCi.stderr) && !fs.existsSync(path.join(ciDir, 'TRACKED_E2E_PROGRESS.md')), 'status=' + rCi.status + ' ' + rCi.stderr.slice(-200));
}
const rGha = runRunner({ NW_OUT_DIR: path.join(OUT_DIR, 'live-gha'), NW_E2E_LIVE: '1', CI: '', GITHUB_ACTIONS: 'false' }, 60000);
check('NW_E2E_LIVE=1 with GITHUB_ACTIONS=false refused (exit 3)', rGha.status === 3 && /refused under CI/.test(rGha.stderr), 'status=' + rGha.status);
const rNoKey = runRunner({ NW_OUT_DIR: path.join(OUT_DIR, 'live-nokey'), NW_E2E_LIVE: '1', CI: '', GITHUB_ACTIONS: '' }, 60000);
check('NW_E2E_LIVE=1 without key refused (exit 3)', rNoKey.status === 3 && /needs XAI_API_KEY/.test(rNoKey.stderr), 'status=' + rNoKey.status);

// ---- 3. failing report build -> incomplete, exit 4 ----
const failDir = path.join(OUT_DIR, 'build-fail');
fs.mkdirSync(failDir, { recursive: true });
const failBuilder = path.join(failDir, 'failing_builder.py');
fs.writeFileSync(failBuilder, 'import sys\nsys.stderr.write("deliberate smoke failure\\n")\nsys.exit(7)\n');
const r3 = runRunner({ NW_OUT_DIR: failDir, NW_E2E_REPORT_BUILDER: failBuilder });
let rep3 = null;
try { rep3 = JSON.parse(fs.readFileSync(path.join(failDir, 'TRACKED_E2E_REPORT.json'), 'utf8')); } catch (_) {}
check('report build failure exits 4', r3.status === 4, 'status=' + r3.status);
check('report build failure marks run incomplete', !!rep3 && rep3.incomplete === true && rep3.ok === false && rep3.reportBuild && rep3.reportBuild.ok === false, rep3 ? JSON.stringify(rep3.reportBuild) : 'no report');
{
  let latest3 = '';
  try { latest3 = fs.readFileSync(path.join(failDir, 'TRACKED_E2E_REPORT_LATEST.md'), 'utf8'); } catch (_) {}
  check('report build failure: LATEST.md says OK: false (INCOMPLETE), not OK: true', /^- OK: false \(INCOMPLETE/m.test(latest3) && !/^- OK: true/m.test(latest3), (latest3.match(/^- OK: .*$/m) || ['no OK line'])[0].slice(0, 160));
}

// ---- 3b. patched HTML copies (under gitignored NW_OUT_DIR): C1 false, unexpected page error ----
function patchedHtml(dir, script) {
  fs.mkdirSync(dir, { recursive: true });
  const src = fs.readFileSync(HTML_PATH, 'utf8');
  const i = src.lastIndexOf('</body>');
  const out = path.join(dir, 'NovelWriter.html');
  fs.writeFileSync(out, src.slice(0, i) + '<script>' + script + '</script>\n' + src.slice(i));
  return out;
}
{
  const dir = path.join(OUT_DIR, 'c1-false');
  const html = patchedHtml(dir, 'window.runC1Smoke = async function () { return false; };');
  const r = runRunner({ NW_OUT_DIR: dir, NW_HTML_PATH: html });
  let rep = null;
  try { rep = JSON.parse(fs.readFileSync(path.join(dir, 'TRACKED_E2E_REPORT.json'), 'utf8')); } catch (_) {}
  const row = rep && (rep.steps || []).find((s) => s.name === 'c1Smoke');
  check('runner: runC1Smoke() === false is a FAIL (status fail, exit 2)', r.status === 2 && !!row && row.status === 'fail' && row.ok === false && rep.ok === false && (rep.summary.failedSteps || []).includes('c1Smoke'), 'status=' + r.status + ' row=' + JSON.stringify(row));
}
{
  const dir = path.join(OUT_DIR, 'page-error');
  const html = patchedHtml(dir, "window.addEventListener('load', function () { setTimeout(function () { throw new Error('smoke: injected unexpected page error'); }, 0); });");
  const r = runRunner({ NW_OUT_DIR: dir, NW_HTML_PATH: html });
  let rep = null;
  try { rep = JSON.parse(fs.readFileSync(path.join(dir, 'TRACKED_E2E_REPORT.json'), 'utf8')); } catch (_) {}
  const row = rep && (rep.steps || []).find((s) => s.name === 'pageErrors');
  check('runner: unexpected page error fails the run (step pageErrors, exit 2)', r.status === 2 && !!row && row.status === 'fail' && rep.ok === false && (rep.pageErrors || []).some((m) => /injected unexpected page error/.test(m)), 'status=' + r.status + ' row=' + JSON.stringify(row));
}

// ---- 4. builder: structured plot values + unknown zone ----
if (rep1) {
  const bDir = path.join(OUT_DIR, 'builder');
  fs.mkdirSync(bDir, { recursive: true });
  fs.copyFileSync(path.join(run1Dir, 'TRACKED_E2E_REPORT.json'), path.join(bDir, 'TRACKED_E2E_REPORT.json'));
  const nd = JSON.parse(fs.readFileSync(path.join(run1Dir, 'TRACKED_E2E_ANNEX_NOVELDATA.json'), 'utf8'));
  nd.generalPlot = { acts: ['spike', 'fork', 'rollback'], stakes: 'cargo AI certification' };
  nd.storyArc = ['begin', 'middle', 'end'];
  fs.writeFileSync(path.join(bDir, 'TRACKED_E2E_ANNEX_NOVELDATA.json'), JSON.stringify(nd));
  const rb = spawnSync(PY[0], PY.slice(1).concat([BUILDER]), { cwd: REPO_ROOT, encoding: 'utf-8', env: Object.assign({}, process.env, { NW_OUT_DIR: bDir, NW_REPORT_TZ: 'Not/AZone', PYTHONDONTWRITEBYTECODE: '1' }) });
  check('builder handles structured plot + unknown zone (exit 0)', rb.status === 0, 'status=' + rb.status + ' ' + String(rb.stderr || '').slice(-400));
  check('builder reports zone fallback', /stamp_tz local/.test(rb.stdout || ''), String(rb.stdout || '').split('\n').filter((l) => /stamp_tz/.test(l)).join(''));
  const bMd = listFiles(bDir).find((f) => /TRACKED_E2E_REPORT_LATEST\.md$/.test(f));
  check('builder synopsis renders structured plot', !!bMd && /\*\*Plot\.\*\* \{"acts"/.test(fs.readFileSync(bMd, 'utf8')), '');
  const rMissing = spawnSync(PY[0], PY.slice(1).concat([BUILDER]), { cwd: REPO_ROOT, encoding: 'utf-8', env: Object.assign({}, process.env, { NW_OUT_DIR: path.join(OUT_DIR, 'empty'), PYTHONDONTWRITEBYTECODE: '1' }) });
  check('builder exits non-zero on missing inputs', rMissing.status !== 0 && /missing input/.test(rMissing.stderr || ''), 'status=' + rMissing.status);
  const wDir = path.join(OUT_DIR, 'builder-win');
  fs.mkdirSync(wDir, { recursive: true });
  const wRep = JSON.parse(fs.readFileSync(path.join(run1Dir, 'TRACKED_E2E_REPORT.json'), 'utf8'));
  wRep.config = Object.assign({}, wRep.config, { model: 'grok-4.3' });
  fs.writeFileSync(path.join(wDir, 'TRACKED_E2E_REPORT.json'), JSON.stringify(wRep));
  fs.copyFileSync(path.join(run1Dir, 'TRACKED_E2E_ANNEX_NOVELDATA.json'), path.join(wDir, 'TRACKED_E2E_ANNEX_NOVELDATA.json'));
  const rw = spawnSync(PY[0], PY.slice(1).concat([BUILDER]), { cwd: REPO_ROOT, encoding: 'utf-8', env: Object.assign({}, process.env, { NW_OUT_DIR: wDir, NW_REPORT_TZ: 'Central Standard Time', PYTHONDONTWRITEBYTECODE: '1' }) });
  const wOut = String(rw.stdout || '');
  check('builder maps Windows zone name (Central Standard Time -> America/Chicago, or local fallback with note)', rw.status === 0 && /stamp_tz (America\/Chicago \(mapped from Windows zone 'Central Standard Time'\)|local .*America\/Chicago)/.test(wOut), wOut.split('\n').filter((l) => /stamp_tz/.test(l)).join('') + ' ' + String(rw.stderr || '').slice(-300));
  check('builder picks grok-4.3 rate card for a grok-4.3 run', /rate_card grok-4\.3 for grok-4\.3/.test(wOut) && /total_cost_usd \d/.test(wOut), wOut.split('\n').filter((l) => /rate_card|total_cost/.test(l)).join(' | '));
}

// ---- 5. in-page runTrackedE2E with the offline responder ----
{
  const responder = createOfflineResponder(JSON.parse(fs.readFileSync(SEED, 'utf8')));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const blocked = [];
  const pageErrors = [];
  let xaiRequests = 0;
  let chapter500 = false;
  let chapter500Count = 0;
  // Known pre-existing race on main (not PR3): updateChapterSubpages() queues requestAnimationFrame callbacks that write
  // chapterGenContentN / chapterEditContentN / chapterEditImprovementN after a second rebuild (resetState + reconfigure) has already replaced that node. Ignore only
  // errors whose top frame is that exact rAF line; anything else still fails the check.
  const htmlLines = fs.readFileSync(HTML_PATH, 'utf8').split(/\r?\n/);
  const knownRace = (e) => {
    if (!/Cannot set properties of null/.test(String(e && e.message || e))) return false;
    const m = String(e && e.stack || '').match(/NovelWriter\.html:(\d+):\d+/);
    return !!m && /getElementById\(`chapter(?:GenContent|EditContent|EditImprovement)\$\{i\}`\)\.value = novelData\.(?:chapters|chapterImprovements)\[i-1\]/.test(htmlLines[parseInt(m[1], 10) - 1] || '');
  };
  const knownPageErrors = [];
  page.on('pageerror', (e) => (knownRace(e) ? knownPageErrors : pageErrors).push(String(e && e.message ? e.message : e) + (process.env.NW_SMOKE_DEBUG ? ' @ ' + String(e && e.stack || '').split('\n').slice(1, 4).join(' <- ') : '')));
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.route('**/*', async (route) => {
    const req = route.request();
    const url = req.url();
    if (!/^https?:/i.test(url)) return route.continue();
    if (/^https:\/\/api\.x\.ai\//i.test(url)) {
      xaiRequests++;
      let body = {};
      try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
      const answer = responder.respond(body);
      if (chapter500 && /^generateChapter/.test(answer.rule)) {
        chapter500Count++;
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'smoke: simulated HTTP 500 on chapter generation' }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(toXaiResponse(body, answer, url)) });
    }
    blocked.push(url);
    return route.abort('blockedbyclient');
  });
  await page.goto(pathToFileURL(HTML_PATH).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof runTrackedE2E === 'function');
  // 5a. Engineering gate: cancelling the confirm must return before resetState(), any fetch, or any state mutation.
  const xaiBeforeCancel = xaiRequests;
  const cancel = await page.evaluate(async () => {
    document.getElementById('apiKey').value = 'offline-fixture-not-a-key';
    const asked = [];
    window.confirm = (msg) => { asked.push(String(msg)); return false; };
    const before = JSON.stringify(novelData);
    let r, threw = null;
    try { r = await runTrackedE2E(); } catch (e) { threw = String(e && e.message || e); }
    return {
      asked, threw, returned: r === undefined ? 'undefined' : r,
      same: before === JSON.stringify(novelData),
      noReport: typeof window.__lastTrackedE2EReport === 'undefined',
      resultText: ((document.getElementById('trackedE2EResult') || {}).textContent || '')
    };
  });
  const xaiDuringCancel = xaiRequests - xaiBeforeCancel;
  check('in-page cancel: confirm asked once before reset', cancel.asked.length === 1 && /resets the current novel/.test(cancel.asked[0]), JSON.stringify(cancel.asked));
  check('in-page cancel: returned without throwing', !cancel.threw && cancel.returned === null, cancel.threw || JSON.stringify(cancel.returned));
  check('in-page cancel: novelData deep-equal before/after', cancel.same === true, '');
  check('in-page cancel: zero requests to api.x.ai', xaiDuringCancel === 0, 'requests=' + xaiDuringCancel);
  check('in-page cancel: no report published, output says cancelled', cancel.noReport && /cancelled/i.test(cancel.resultText), cancel.resultText.slice(0, 120));
  // 5b. Happy path: confirm accepted.
  const res = await page.evaluate(async () => {
    window.confirm = () => true;
    document.getElementById('apiKey').value = 'offline-fixture-not-a-key';
    const sel = document.getElementById('model');
    const chat = Array.from(sel.options || []).find((o) => o.value && !/multi-agent/i.test(o.value));
    if (chat) sel.value = chat.value;
    const btn = !!document.getElementById('trackedE2EBtn');
    let r;
    try { r = await runTrackedE2E(); } catch (e) { return { threw: String(e && e.message || e), btn }; }
    const hasRollup = typeof getSessionUsage === 'function';
    return {
      btn, hasRollup,
      ok: r.ok, steps: r.steps.map((s) => s.name + ':' + s.status + (s.status === 'fail' ? ' ' + s.error : '')),
      c1: r.steps.find((s) => s.name === 'c1Smoke') || null,
      autoEnrich: r.steps.find((s) => s.name === 'autoEnrichChapterBlueprints') || null,
      judgeLabels: (r.qualitySamples || []).map((s) => s.label).filter((l) => /^chapter1-.*llmJudge$/.test(l)),
      fatal: (r.errors || []).filter((e) => e.step === 'fatal'),
      summary: r.summary,
      usageMatchesLedger: hasRollup ? r.summary.callCount === (getSessionUsage().calls || []).length : (r.summary.usageAvailable === false && r.summary.callCount === 0),
      resultText: ((document.getElementById('trackedE2EResult') || {}).textContent || '').slice(0, 60)
    };
  });
  const pageErrorsHappy = pageErrors.slice();
  // 5b'. runC1Smoke() returning null must FAIL too (the runner treats null, false and {passed:false} as FAIL).
  const resNull = HAS_C1 ? await page.evaluate(async () => {
    window.confirm = () => true;
    const real = window.runC1Smoke;
    window.runC1Smoke = async () => null;
    document.getElementById('apiKey').value = 'offline-fixture-not-a-key';
    let r;
    try { r = await runTrackedE2E(); } catch (e) { return { threw: String(e && e.message || e) }; } finally { window.runC1Smoke = real; }
    const s = r.steps.find((x) => x.name === 'c1Smoke');
    return { c1: s ? { status: s.status, ok: s.ok, error: s.error } : null };
  }) : null;
  // 5c. HTTP 500 on every chapter-generation call + runC1Smoke() returning false: both must FAIL, not pass.
  chapter500 = true;
  const res500 = await page.evaluate(async () => {
    window.confirm = () => true;
    window.runC1Smoke = async () => false;
    document.getElementById('apiKey').value = 'offline-fixture-not-a-key';
    let r;
    try { r = await runTrackedE2E(); } catch (e) { return { threw: String(e && e.message || e) }; }
    delete window.runC1Smoke;
    const row = (n) => { const s = r.steps.find((x) => x.name === n); return s ? { status: s.status, ok: s.ok, error: s.error, textLen: s.result && s.result.textLen } : null; };
    return { ok: r.ok, failed: r.summary.failedSteps, c1: row('c1Smoke'), ch1: row('generateChapter1+quality'), ch2: row('generateChapter2+quality') };
  });
  chapter500 = false;
  await browser.close();
  check('in-page 500: chapter calls answered with HTTP 500', chapter500Count > 0, 'count=' + chapter500Count);
  check('in-page 500: generateChapter1+quality is FAIL (ok:false)', !res500.threw && res500.ch1 && res500.ch1.status === 'fail' && res500.ch1.ok === false, res500.threw || JSON.stringify(res500.ch1));
  check('in-page 500: generateChapter2+quality is FAIL (ok:false)', !res500.threw && res500.ch2 && res500.ch2.status === 'fail' && res500.ch2.ok === false, res500.threw || JSON.stringify(res500.ch2));
  check('in-page 500: report ok:false', res500.ok === false, JSON.stringify(res500.failed));
  check('in-page: runC1Smoke() === false makes c1Smoke FAIL', res500.c1 && res500.c1.status === 'fail' && res500.c1.ok === false, JSON.stringify(res500.c1));
  if (HAS_C1) {
    check('in-page: real runC1Smoke() makes c1Smoke PASS (no false-fail)', res.c1 && res.c1.status === 'pass' && res.c1.ok === true, JSON.stringify(res.c1));
    check('in-page: runC1Smoke() === null makes c1Smoke FAIL', resNull && !resNull.threw && resNull.c1 && resNull.c1.status === 'fail' && resNull.c1.ok === false, JSON.stringify(resNull));
  } else {
    check('in-page: absent runC1Smoke is a skip (status skip, ok not true)', res.c1 && res.c1.status === 'skip' && res.c1.ok !== true, JSON.stringify(res.c1));
  }
  if (HAS_AUTO_ENRICH) {
    check('in-page: autoEnrichChapterBlueprints row is skip for the six-beat seed', res.autoEnrich && res.autoEnrich.status === 'skip' && res.autoEnrich.ok === null, JSON.stringify(res.autoEnrich));
  }
  check('in-page: Ch1 judged once (reuses the generateChapter advisory judge, no duplicate call)', Array.isArray(res.judgeLabels) && res.judgeLabels.length === 1, JSON.stringify(res.judgeLabels));
  check('in-page: Tracked E2E button present', res.btn, '');
  check('in-page: runTrackedE2E did not throw', !res.threw, res.threw || '');
  check('in-page: no fatal error', res.fatal && res.fatal.length === 0, JSON.stringify(res.fatal));
  check('in-page: all steps ok', res.ok === true, JSON.stringify(res.steps));
  check('in-page: usage read from session ledger (or marked unavailable without PR1 rollup)', res.usageMatchesLedger === true, JSON.stringify(res.summary));
  check('in-page: no unmatched prompts', responder.unmatched.length === 0, JSON.stringify(responder.unmatched).slice(0, 300));
  check('in-page: no page errors (besides the known updateChapterSubpages rAF race #130: ' + knownPageErrors.length + ')', pageErrorsHappy.length === 0, pageErrorsHappy.slice(0, 3).join(' | '));
  check('in-page 500: no unexpected page errors', pageErrors.length === pageErrorsHappy.length, pageErrors.slice(pageErrorsHappy.length, pageErrorsHappy.length + 3).join(' | '));
}

const gitAfter = gitStatus();
check('git status unchanged by the smoke (artifacts only under gitignored out/)', gitBefore !== null && gitBefore === gitAfter, gitBefore === gitAfter ? '' : 'before:\n' + gitBefore + '\nafter:\n' + gitAfter);

const failed = checks.filter((c) => !c.ok);
const summary = { ok: failed.length === 0, passed: checks.length - failed.length, total: checks.length, failed, checks };
fs.writeFileSync(path.join(OUT_DIR, 'SMOKE_TRACKED_E2E_OFFLINE.json'), JSON.stringify(summary, null, 2));
for (const c of checks) process.stdout.write((c.ok ? 'PASS ' : 'FAIL ') + c.name + (c.ok || !c.detail ? '' : ' :: ' + c.detail) + '\n');
process.stdout.write('\nTRACKED E2E OFFLINE SMOKE: ' + (summary.ok ? 'PASS' : 'FAIL') + ' (' + summary.passed + '/' + summary.total + ')\n');
process.exit(summary.ok ? 0 : 1);
