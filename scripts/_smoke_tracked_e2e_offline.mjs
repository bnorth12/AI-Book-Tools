/**
 * PR3 offline smoke for the Tracked E2E runner and unified report (no API key, no paid calls).
 *
 *  1. Runs scripts/run-tracked-e2e.mjs in its default offline mode against this checkout's HTML:
 *     exit 0, every xAI request answered by the fixture responder (0 unmatched prompts), artifacts
 *     only under NW_OUT_DIR, dated + LATEST report built with Annex E prose, git status unchanged.
 *  2. Live-mode guards: NW_E2E_LIVE=1 under CI exits 3; NW_E2E_LIVE=1 without a key exits 3
 *     (key vars scrubbed, NW_ENV_FILE pointed at a missing file) - both before a browser starts.
 *  3. A failing report build marks the run incomplete and exits 4 (Copilot #117 high).
 *  4. build_unified_report.py on structured plot values + an unknown NW_REPORT_TZ still builds.
 *  5. In-page runTrackedE2E() with callAI answered by the same responder: completes, no throw on
 *     an HTML without the PR1 token rollup, usage read from the session ledger (Copilot #117 high).
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
const rCi = runRunner({ NW_OUT_DIR: path.join(OUT_DIR, 'live-ci'), NW_E2E_LIVE: '1', CI: 'true' }, 60000);
check('NW_E2E_LIVE=1 under CI refused (exit 3)', rCi.status === 3 && /refused under CI/.test(rCi.stderr), 'status=' + rCi.status);
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
}

// ---- 5. in-page runTrackedE2E with the offline responder ----
{
  const responder = createOfflineResponder(JSON.parse(fs.readFileSync(SEED, 'utf8')));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const blocked = [];
  const pageErrors = [];
  // Known pre-existing race on main (not PR3): updateChapterSubpages() queues requestAnimationFrame callbacks that write
  // chapterGenContentN / chapterEditContentN / chapterEditImprovementN after a second rebuild (resetState + reconfigure) has already replaced that node. Ignore only
  // errors whose top frame is that exact rAF line; anything else still fails the check.
  const htmlLines = fs.readFileSync(HTML_PATH, 'utf8').split(/\r?\n/);
  const knownRace = (e) => {
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
      let body = {};
      try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(toXaiResponse(body, responder.respond(body), url)) });
    }
    blocked.push(url);
    return route.abort('blockedbyclient');
  });
  await page.goto(pathToFileURL(HTML_PATH).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof runTrackedE2E === 'function');
  const res = await page.evaluate(async () => {
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
      ok: r.ok, steps: r.steps.map((s) => s.name + ':' + (s.ok ? 'ok' : 'FAIL ' + s.error)),
      fatal: (r.errors || []).filter((e) => e.step === 'fatal'),
      summary: r.summary,
      usageMatchesLedger: hasRollup ? r.summary.callCount === (getSessionUsage().calls || []).length : (r.summary.usageAvailable === false && r.summary.callCount === 0),
      resultText: ((document.getElementById('trackedE2EResult') || {}).textContent || '').slice(0, 60)
    };
  });
  await browser.close();
  check('in-page: Tracked E2E button present', res.btn, '');
  check('in-page: runTrackedE2E did not throw', !res.threw, res.threw || '');
  check('in-page: no fatal error', res.fatal && res.fatal.length === 0, JSON.stringify(res.fatal));
  check('in-page: all steps ok', res.ok === true, JSON.stringify(res.steps));
  check('in-page: usage read from session ledger (or marked unavailable without PR1 rollup)', res.usageMatchesLedger === true, JSON.stringify(res.summary));
  check('in-page: no unmatched prompts', responder.unmatched.length === 0, JSON.stringify(responder.unmatched).slice(0, 300));
  check('in-page: no page errors (besides the known updateChapterSubpages rAF race: ' + knownPageErrors.length + ')', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
}

const gitAfter = gitStatus();
check('git status unchanged by the smoke (artifacts only under gitignored out/)', gitBefore !== null && gitBefore === gitAfter, gitBefore === gitAfter ? '' : 'before:\n' + gitBefore + '\nafter:\n' + gitAfter);

const failed = checks.filter((c) => !c.ok);
const summary = { ok: failed.length === 0, passed: checks.length - failed.length, total: checks.length, failed, checks };
fs.writeFileSync(path.join(OUT_DIR, 'SMOKE_TRACKED_E2E_OFFLINE.json'), JSON.stringify(summary, null, 2));
for (const c of checks) process.stdout.write((c.ok ? 'PASS ' : 'FAIL ') + c.name + (c.ok || !c.detail ? '' : ' :: ' + c.detail) + '\n');
process.stdout.write('\nTRACKED E2E OFFLINE SMOKE: ' + (summary.ok ? 'PASS' : 'FAIL') + ' (' + summary.passed + '/' + summary.total + ')\n');
process.exit(summary.ok ? 0 : 1);
