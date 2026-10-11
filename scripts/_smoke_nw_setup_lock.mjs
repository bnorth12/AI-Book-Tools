/**
 * Offline smoke for REQ-SCH-08 / issue #159: mid-run Setup edit cannot change later prompts.
 * LOCK:setup-midrun + mutation LOCK:M1 (drop Setup inputs from nwBatchApplyLock).
 * No network, no API key. Prints each check id PASS/FAIL.
 *
 *   node scripts/_smoke_nw_setup_lock.mjs
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const HTML_PATH = path.resolve(process.env.NW_HTML_PATH || path.join(REPO_ROOT, 'NovelWriter', 'NovelWriter.html'));
const OUT_DIR = path.resolve(process.env.NW_OUT_DIR || path.join(REPO_ROOT, 'out', 'nw-smoke'));
const FIXTURE = path.join(REPO_ROOT, 'NovelWriter', 'fixtures', 'beat-gate-old-shape-v1', 'novelData.json');

for (const k of ['XAI_API_KEY', 'GROK_API_KEY', 'NW_E2E_LIVE']) delete process.env[k];

const checks = [];
const check = (id, name, ok, detail) => checks.push({ id, name, ok: !!ok, detail: ok ? '' : String(detail == null ? '' : detail).slice(0, 1400) });
const clone = (o) => JSON.parse(JSON.stringify(o));
const HTML = fs.readFileSync(HTML_PATH, 'utf8');
const FX = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
delete FX._fixture;

function enriched(base) {
  const nd = clone(base);
  nd.chapterBlueprints = nd.chapterBlueprints.map((bp, i) => {
    const n = i + 1;
    const who = (nd.characters[i % nd.characters.length] || {}).name || 'Lead';
    return Object.assign({}, bp, {
      sceneGoal: `Chapter ${n} scene goal: ${who} must decide which observation to commit before the telemetry window closes.`,
      castArcBeat: `${who} shifts from guarded procedure toward open doubt in chapter ${n}, paying a visible personal cost.`,
      subplotPressure: `Chapter ${n} subplot pressure: ${String(nd.subplots[i % nd.subplots.length] || '').slice(0, 240)}`,
      dialogueTurn: `Chapter ${n} dialogue turn: an argument over the readings flips who holds authority in the control room.`,
      sensoryWorldHook: `Chapter ${n} sensory hook: ozone tang and the hum of the hydroponic bays under failing lights.`,
      turnOrPayoff: `Chapter ${n} turn: the delayed consequence of an earlier choice lands and narrows the next options.`
    });
  });
  return nd;
}
const ND = enriched(FX);

function mutateCopy(from, to) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-s1-lock-'));
  const copy = path.join(dir, 'NovelWriter.html');
  if (HTML.indexOf(from) < 0) return { ok: false, copy: null, dir, detail: 'flag not found: ' + from };
  fs.writeFileSync(copy, HTML.replace(from, to));
  return { ok: true, copy, dir };
}

const browser = await chromium.launch({ headless: true });
const pageErrors = [];

async function install(page) {
  await page.evaluate(() => {
    const h = window.__h = { calls: [], prompts: [], dialogs: [] };
    ['alert', 'confirm', 'prompt'].forEach((k) => {
      window[k] = function (m) { h.dialogs.push(k + ': ' + String(m).slice(0, 200)); return k === 'confirm' ? true : (k === 'prompt' ? null : undefined); };
    });
    window.collectData = function () {};
    window.ensureQualityAfterGenerate = async function () {};
    window.scoreObligationCoverage = function () {
      return { covered: 6, total: 6, ratio: 1, words: 120, passed: true, failures: [], misses: [] };
    };
    const realGen = window.generateChapter;
    window.generateChapter = async function (n, opts) {
      if (h.cfg && h.cfg.holdBefore === n && !h.released) {
        h.hanging = true;
        await new Promise((resolve) => { h.release = resolve; });
      }
      return realGen.apply(this, arguments);
    };
    window.callAI = async function (messages) {
      const g = window.__lastGenerateChapterGate;
      const ch = g ? g.chapter : 0;
      const part = /Part 2/.test(String(requestLog.status)) ? 2 : 1;
      const user = messages && messages[1] && messages[1].content;
      h.calls.push({ ch, part });
      h.prompts.push({ ch, part, prompt: String(user || requestLog.lastPrompt || '') });
      const usage = { prompt_tokens: 600, completion_tokens: 400, total_tokens: 1000 };
      if (typeof recordBookTokenUsage === 'function') {
        recordBookTokenUsage(Object.assign({ operationName: 'generateChapter', originTab: 'tab5', model: 'smoke-stub' }, usage));
      }
      requestLog.returnedInfo = JSON.stringify({ usage });
      return { chapter: 'Chapter ' + ch + ' part ' + part + ' prose (smoke). The relay hums under failing lights.' };
    };
    h.load = function (nd) {
      Object.keys(nd).forEach((k) => { novelData[k] = JSON.parse(JSON.stringify(nd[k])); });
      novelData.chapters = Array.from({ length: nd.numChapters }, () => '');
      novelData.chapterImprovements = Array.from({ length: nd.numChapters }, () => '');
      novelData.chapterContinuityPackets = [];
      novelData.chapterFlags = [];
      novelData.continuityTracker = { chapters: [], characterArcProgress: [], storyArcProgress: {} };
      novelData.autoContinuityAudit = false;
      novelData.apiKey = 'smoke-placeholder-not-a-key';
      novelData.tokenUsage = null;
      if (typeof ensureBookTokenUsage === 'function') ensureBookTokenUsage();
      delete novelData.batchRun;
      document.getElementById('numChapters').value = String(nd.numChapters);
      document.getElementById('maxTokens').value = '1000';
      document.getElementById('autoContinuityAudit').checked = false;
      updateChapterSubpages();
      document.getElementById('batchFrom').value = '1';
      document.getElementById('batchTo').value = '3';
      document.getElementById('batchRegenerate').checked = false;
    };
  });
}

async function openPage(htmlPath) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (!/^https?:/i.test(url)) return route.continue();
    return route.abort('blockedbyclient');
  });
  await page.goto(pathToFileURL(htmlPath || HTML_PATH).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof generateAllChapters === 'function' && typeof scoreGenerateChapterGate === 'function' && window.__nwBatchRestoreCheck, null, { timeout: 30000 });
  await page.evaluate(() => window.__nwBatchRestoreCheck);
  await install(page);
  return page;
}

async function runCase(htmlPath, mutateUnlocked) {
  const page = await openPage(htmlPath);
  const out = await page.evaluate(async (nd) => {
    const h = window.__h;
    h.cfg = { holdBefore: 2 };
    h.load(nd);
    document.getElementById('setting').value = 'ORIGINAL SETTING: wet dock under failing lights, ozone and relay hum.';
    document.getElementById('generalPlot').value = 'ORIGINAL PLOT: Mira names the mismatch, then pays the delayed cost.';
    novelData.setting = 'ORIGINAL SETTING: wet dock under failing lights, ozone and relay hum.';
    novelData.generalPlot = 'ORIGINAL PLOT: Mira names the mismatch, then pays the delayed cost.';
    const pRun = generateAllChapters();
    await new Promise((resolve, reject) => {
      const t0 = Date.now();
      (function waitHang() {
        if (window.__h.hanging) return resolve();
        if (Date.now() - t0 > 25000) return reject(new Error('did not hang before ch2'));
        setTimeout(waitHang, 20);
      })();
    });
    const settingDisabled = document.getElementById('setting').disabled;
    const plotDisabled = document.getElementById('generalPlot').disabled;
    const suggestDisabled = Array.from(document.querySelectorAll('#tab1 button[onclick*="suggestSetting"]')).every((b) => b.disabled);
    const settingSnap = String(novelData.setting || '');
    const plotSnap = String(novelData.generalPlot || '');
    const pre2 = buildGenerateChapterUserContent(2, 1);
    let edited = false;
    if (!settingDisabled) {
      document.getElementById('setting').value = 'MUTATED SETTING SHOULD CHANGE PROMPTS: a different city of glass.';
      novelData.setting = 'MUTATED SETTING SHOULD CHANGE PROMPTS: a different city of glass.';
      edited = true;
    }
    if (!plotDisabled) {
      document.getElementById('generalPlot').value = 'MUTATED PLOT SHOULD CHANGE PROMPTS: a different rebellion.';
      novelData.generalPlot = 'MUTATED PLOT SHOULD CHANGE PROMPTS: a different rebellion.';
      edited = true;
    }
    h.prompts.length = 0;
    h.released = true;
    if (typeof h.release === 'function') h.release();
    const r2 = await pRun;
    const p2 = (h.prompts.find((p) => p.ch === 2 && p.part === 1) || {}).prompt || '';
    const p3 = (h.prompts.find((p) => p.ch === 3 && p.part === 1) || {}).prompt || '';
    function line(p, label) {
      const m = String(p || '').match(new RegExp('- \\*\\*' + label + ' \\(digest\\):\\*\\* (.*)'));
      return m ? m[1] : '';
    }
    const s2 = line(p2, 'Setting');
    const s3 = line(p3, 'Setting');
    const g2 = line(p2, 'Plot');
    const g3 = line(p3, 'Plot');
    return {
      r2: r2 && r2.reason, completed: (novelData.batchRun && novelData.batchRun.completed) || [],
      settingDisabled, plotDisabled, suggestDisabled, edited,
      eq2: p2 === pre2,
      setupSame: s2 && s2 === s3 && g2 && g2 === g3,
      mutated: /MUTATED SETTING/.test(p2 + p3) || /MUTATED PLOT/.test(p2 + p3),
      s2len: s2.length
    };
  }, ND);
  await page.close();
  return out;
}

const green = await runCase(HTML_PATH, false);
check('LOCK:setup-midrun', 'start 3-chapter stubbed run, after ch1 Setup #setting/#generalPlot disabled', green.settingDisabled === true && green.plotDisabled === true, JSON.stringify({ settingDisabled: green.settingDisabled, plotDisabled: green.plotDisabled, r2: green.r2 }));
check('LOCK:setup-midrun', 'Tab 1-4 AI suggest controls disabled mid-run', green.suggestDisabled === true, JSON.stringify({ suggestDisabled: green.suggestDisabled }));
check('LOCK:setup-midrun', 'ch2/ch3 prompts byte-equal to pre-edit prompts', green.eq2 === true && green.setupSame === true && !green.mutated, JSON.stringify(green));

const mut = mutateCopy('var NW_S1_LOCK_SETUP_INPUTS = true;', 'var NW_S1_LOCK_SETUP_INPUTS = false;');
check('LOCK:M1', 'mutation flag present', mut.ok, mut.detail);
if (mut.ok) {
  const red = await runCase(mut.copy, true);
  check('LOCK:M1', 'dropping Setup inputs from nwBatchApplyLock turns setup-midrun red (fields enabled, later prompts change)', red.settingDisabled === false && red.edited === true && red.mutated === true, JSON.stringify(red));
}

check('pageerror', 'no uncaught pageerror', pageErrors.length === 0, pageErrors.join(' | '));
await browser.close();

const failed = checks.filter((c) => !c.ok);
const report = { passed: checks.filter((c) => c.ok).length, failed: failed.length, checks, pageErrors };
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'SMOKE_NW_SETUP_LOCK.json'), JSON.stringify(report, null, 2));
console.log('NW setup-lock smoke: ' + report.passed + ' passed, ' + report.failed + ' failed');
for (const c of checks) {
  console.log((c.ok ? 'PASS' : 'FAIL') + ' [' + c.id + '] ' + c.name + (c.ok ? '' : ' :: ' + c.detail));
}
if (failed.length) process.exit(1);
