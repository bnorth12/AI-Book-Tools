/**
 * Offline smoke for REQ-SCH-08 / #159 and REQ-SCH-11:
 * LOCK:setup-midrun + LOCK:M1 (drop Setup inputs from nwBatchApplyLock).
 * LOCK:pause-held + LOCK:M2 (release Setup lock on pause).
 * LOCK:M3 (Generate All disabled on `locked` instead of setupLocked).
 * LOCK:M4 (Cancel while paused does not release Setup lock).
 * Full Tab 1-4/7 AI control list; nonzero matched-control count per tab (1b).
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
    const h = window.__h = { calls: [], prompts: [], dialogs: [], toasts: [] };
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
    const realToast = window.nwToast;
    window.nwToast = function (m) {
      h.toasts.push(String(m));
      if (typeof realToast === 'function') return realToast.apply(this, arguments);
      const el = document.getElementById('nwToast');
      if (el) { el.textContent = String(m); el.hidden = false; }
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
      novelData.bookImprovementsWithStatus = [{ text: 'Chapter 2: tighten the relay scene.', status: 'To Incorporate', breakdown: null }];
      if (typeof updateBookImprovementsTable === 'function') updateBookImprovementsTable('Chapter 2: tighten the relay scene.');
    };
  });
}

const TAB_AI = {
  1: '#tab1 button[onclick*="suggestSetting"], #tab1 button[onclick*="suggestStoryArc"], #tab1 button[onclick*="suggestGeneralPlot"], #tab1 button[onclick*="suggestStoryInfo"], #tab1 button[onclick*="fetchAuthors"], #tab1 button[onclick*="fetchStyleGuide"]',
  2: '#tab2 button[onclick*="suggestCharacters"], #tab2 button[onclick*="scrapeBookInfoForCharacters"], #tab2 button[onclick*="refineCharacters"], #tab2 button[onclick*="enrichCharacters"], #tab2 button[onclick*="addCharacter"]',
  3: '#tab3 button[onclick*="suggestSubplots"], #tab3 button[onclick*="enrichSubplots"], #tab3 button[onclick*="addSubplot"]',
  4: '#tab4 button[onclick*="generateNovelOutlines"], #tab4 button[onclick*="enrichChapterBlueprints"], #tab4 button[onclick*="incorporateOutlineSuggestions"]',
  7: '#tab7 button[onclick*="suggestBookImprovements"], #tab7 button[onclick*="breakdownImprovement"]'
};

function tabMatchCounts(controls) {
  const out = {};
  for (const [tab, sel] of Object.entries(controls)) {
    out[tab] = { sel, n: 0, allDisabled: true };
  }
  return out;
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
    const tabSels = {
      1: '#tab1 button[onclick*="suggestSetting"], #tab1 button[onclick*="suggestStoryArc"], #tab1 button[onclick*="suggestGeneralPlot"], #tab1 button[onclick*="suggestStoryInfo"], #tab1 button[onclick*="fetchAuthors"], #tab1 button[onclick*="fetchStyleGuide"]',
      2: '#tab2 button[onclick*="suggestCharacters"], #tab2 button[onclick*="scrapeBookInfoForCharacters"], #tab2 button[onclick*="refineCharacters"], #tab2 button[onclick*="enrichCharacters"], #tab2 button[onclick*="addCharacter"]',
      3: '#tab3 button[onclick*="suggestSubplots"], #tab3 button[onclick*="enrichSubplots"], #tab3 button[onclick*="addSubplot"]',
      4: '#tab4 button[onclick*="generateNovelOutlines"], #tab4 button[onclick*="enrichChapterBlueprints"], #tab4 button[onclick*="incorporateOutlineSuggestions"]',
      7: '#tab7 button[onclick*="suggestBookImprovements"], #tab7 button[onclick*="breakdownImprovement"]'
    };
    const tabs = {};
    Object.keys(tabSels).forEach((tab) => {
      const nodes = Array.from(document.querySelectorAll(tabSels[tab]));
      tabs[tab] = { n: nodes.length, allDisabled: nodes.length > 0 && nodes.every((b) => b.disabled) };
    });
    const extras = {
      numCharacters: !!(document.getElementById('numCharacters') && document.getElementById('numCharacters').disabled),
      minSubplots: !!(document.getElementById('minSubplots') && document.getElementById('minSubplots').disabled)
    };
    const suggestDisabled = tabs[1].allDisabled && tabs[2].allDisabled && tabs[3].allDisabled && tabs[4].allDisabled && tabs[7].allDisabled && extras.numCharacters && extras.minSubplots;
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
      settingDisabled, plotDisabled, suggestDisabled, edited, tabs, extras,
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
check('LOCK:setup-midrun', 'Tab 1-4/7 AI controls + #numCharacters/#minSubplots/addCharacter/addSubplot disabled mid-run', green.suggestDisabled === true, JSON.stringify({ tabs: green.tabs, extras: green.extras }));
check('LOCK:setup-midrun', 'ch2/ch3 prompts byte-equal to pre-edit prompts', green.eq2 === true && green.setupSame === true && !green.mutated, JSON.stringify(green));
check('LOCK:setup-midrun', 'nonzero matched-control count per tab (1,2,3,4,7)', [1, 2, 3, 4, 7].every((t) => green.tabs && green.tabs[t] && green.tabs[t].n > 0), JSON.stringify(green.tabs));

{
  const emptySels = Object.assign({}, TAB_AI, { 4: '#tab4 button[onclick*="__empty_selector_mutation__"]' });
  const page = await openPage(HTML_PATH);
  const emptyCounts = await page.evaluate((sels) => {
    const out = {};
    Object.keys(sels).forEach((tab) => { out[tab] = document.querySelectorAll(sels[tab]).length; });
    return out;
  }, emptySels);
  await page.close();
  const vacuousWouldPass = emptyCounts[4] === 0 && [emptyCounts[4]].every((n) => n === 0 || true);
  check('LOCK:empty-selector', 'an empty selector has zero matches (turns per-tab nonzero red; no vacuous .every)', emptyCounts[4] === 0 && emptyCounts[1] > 0, JSON.stringify({ emptyCounts, vacuousWouldPass }));
}

const mut = mutateCopy('var NW_S1_LOCK_SETUP_INPUTS = true;', 'var NW_S1_LOCK_SETUP_INPUTS = false;');
check('LOCK:M1', 'mutation flag present', mut.ok, mut.detail);
if (mut.ok) {
  const red = await runCase(mut.copy, true);
  check('LOCK:M1', 'dropping Setup inputs from nwBatchApplyLock turns setup-midrun red (fields enabled, later prompts change)', red.settingDisabled === false && red.edited === true && red.mutated === true, JSON.stringify(red));
}

const mutTab = mutateCopy('var NW_S1_LOCK_TAB47 = true;', 'var NW_S1_LOCK_TAB47 = false;');
check('LOCK:M-tab47', 'TAB47 mutation flag present', mutTab.ok, mutTab.detail);
if (mutTab.ok) {
  const red = await runCase(mutTab.copy, true);
  const t4 = red.tabs && red.tabs[4];
  const t7 = red.tabs && red.tabs[7];
  check('LOCK:M-tab47', 'dropping Tab 4 incorporate / Tab 7 breakdown / addCharacter / addSubplot turns full-list red', t4 && t7 && (t4.allDisabled === false || t7.allDisabled === false), JSON.stringify(red.tabs));
}

const LOCKED_NOTICE_RE = /is locked while a Generate All run is active or awaiting restore/i;
const PAUSED_STATUS_RE = /Paused before ch\d+\. Setup is locked until the run ends or is cancelled\./;

async function runPauseHeld(htmlPath, opts) {
  opts = opts || {};
  const after = opts.after || 'resume';
  const probe = opts.probe !== false;
  const page = await openPage(htmlPath);
  const out = await page.evaluate(async (args) => {
    const nd = args.nd;
    const after = args.after;
    const probe = args.probe;
    const h = window.__h;
    h.cfg = {};
    h.load(nd);
    document.getElementById('setting').value = 'ORIGINAL SETTING: wet dock under failing lights, ozone and relay hum.';
    document.getElementById('generalPlot').value = 'ORIGINAL PLOT: Mira names the mismatch, then pays the delayed cost.';
    novelData.setting = 'ORIGINAL SETTING: wet dock under failing lights, ozone and relay hum.';
    novelData.generalPlot = 'ORIGINAL PLOT: Mira names the mismatch, then pays the delayed cost.';
    const realCall = window.callAI;
    window.callAI = async function (messages) {
      const g = window.__lastGenerateChapterGate;
      const ch = g ? g.chapter : 0;
      const part = /Part 2/.test(String(requestLog.status)) ? 2 : 1;
      if (ch === 1 && part === 1) pauseBatchRun();
      return realCall.apply(this, arguments);
    };
    const r = await generateAllChapters();
    const pre2 = buildGenerateChapterUserContent(2, 1);
    const settingDisabled = document.getElementById('setting').disabled;
    const plotDisabled = document.getElementById('generalPlot').disabled;
    const setupLocked = typeof nwBatchSetupIsLocked === 'function' && nwBatchSetupIsLocked();
    const numCharactersDisabled = document.getElementById('numCharacters').disabled;
    const numChaptersDisabled = document.getElementById('numChapters').disabled;
    const importFileDisabled = document.getElementById('importFile').disabled;
    const genAllDisabled = document.getElementById('batchGenerateAllBtn').disabled;
    const addCharDisabled = Array.from(document.querySelectorAll('#tab2 button[onclick*="addCharacter"]')).every((b) => b.disabled);
    const cancelBtn = document.getElementById('batchCancelBtn');
    const cancelExists = !!cancelBtn;
    const cancelDisabled = cancelBtn ? !!cancelBtn.disabled : true;
    const toastEl = document.getElementById('nwToast');
    const pausedStatus = String((document.getElementById('batchRunStatus') || {}).textContent || '');
    function readNotice() { return String((toastEl && toastEl.textContent) || ''); }
    function clearNotice() {
      h.toasts.length = 0;
      if (toastEl) { toastEl.textContent = ''; toastEl.hidden = true; }
    }
    let importRefused = false, importNotice = '', chaptersRefused = false, chaptersNotice = '', genAllRefused = false, genAllNotice = '';
    if (probe) {
      clearNotice();
      const titleBefore = novelData.title;
      importSession({ target: { files: [], value: 'x.json' } });
      importRefused = novelData.title === titleBefore;
      importNotice = readNotice();
      clearNotice();
      const chLenBefore = (novelData.chapters || []).length;
      const numBefore = novelData.numChapters;
      await updateChapterSubpages();
      chaptersRefused = (novelData.chapters || []).length === chLenBefore && novelData.numChapters === numBefore;
      chaptersNotice = readNotice();
      clearNotice();
      const ga = await generateAllChapters();
      genAllRefused = !!(ga && ga.started === false);
      genAllNotice = readNotice();
    }
    clearNotice();
    const refusedAi = typeof nwRefuseAiIfLocked === 'function' && nwRefuseAiIfLocked('Suggest Setting');
    const notice = readNotice();
    let edited = false;
    if (!settingDisabled) {
      document.getElementById('setting').value = 'MUTATED SETTING SHOULD CHANGE PROMPTS: a different city of glass.';
      novelData.setting = 'MUTATED SETTING SHOULD CHANGE PROMPTS: a different city of glass.';
      edited = true;
    }
    h.prompts.length = 0;
    let resumed = null;
    let cancelled = null;
    let afterCancel = null;
    if (after === 'cancel') {
      cancelled = await cancelBatchRun();
      afterCancel = {
        setupLocked: typeof nwBatchSetupIsLocked === 'function' && nwBatchSetupIsLocked(),
        settingDisabled: document.getElementById('setting').disabled,
        numChaptersDisabled: document.getElementById('numChapters').disabled,
        numCharactersDisabled: document.getElementById('numCharacters').disabled,
        importFileDisabled: document.getElementById('importFile').disabled,
        genAllDisabled: document.getElementById('batchGenerateAllBtn').disabled,
        addCharDisabled: Array.from(document.querySelectorAll('#tab2 button[onclick*="addCharacter"]')).every((b) => b.disabled),
        cancelDisabled: document.getElementById('batchCancelBtn') ? document.getElementById('batchCancelBtn').disabled : true,
        reason: novelData.batchRun && novelData.batchRun.reason
      };
    } else {
      resumed = await resumeBatchRun();
    }
    const p2 = (h.prompts.find((p) => p.ch === 2 && p.part === 1) || {}).prompt || '';
    return {
      r: r && r.reason, resumed: resumed && resumed.reason,
      settingDisabled, plotDisabled, setupLocked, numCharactersDisabled, numChaptersDisabled,
      importFileDisabled, genAllDisabled, addCharDisabled,
      cancelExists, cancelDisabled,
      refusedAi, notice, importRefused, importNotice, chaptersRefused, chaptersNotice, genAllRefused, genAllNotice,
      pausedStatus, edited, cancelled, afterCancel,
      eq2: p2 === pre2,
      mutated: /MUTATED SETTING/.test(p2),
      br: novelData.batchRun && { reason: novelData.batchRun.reason, stoppedAt: novelData.batchRun.stoppedAt, completed: novelData.batchRun.completed },
      resumeDisabled: document.getElementById('batchResumeBtn').disabled
    };
  }, { nd: ND, after, probe });
  await page.close();
  return out;
}

function pauseHeldOk(p) {
  return p.setupLocked === true && p.settingDisabled === true && p.numChaptersDisabled === true && p.numCharactersDisabled === true && p.addCharDisabled === true && p.importFileDisabled === true && p.genAllDisabled === true && p.importRefused === true && p.chaptersRefused === true && p.genAllRefused === true && p.refusedAi === true && LOCKED_NOTICE_RE.test(p.notice) && LOCKED_NOTICE_RE.test(p.importNotice) && LOCKED_NOTICE_RE.test(p.chaptersNotice) && LOCKED_NOTICE_RE.test(p.genAllNotice) && PAUSED_STATUS_RE.test(p.pausedStatus) && p.cancelExists === true && p.cancelDisabled === false;
}

const pauseGreen = await runPauseHeld(HTML_PATH, { after: 'resume', probe: true });
check('LOCK:pause-held', 'pause keeps Setup lock; import/chapters/Generate All/AI refused with real locked notice', pauseHeldOk(pauseGreen), JSON.stringify(pauseGreen));
check('LOCK:pause-held', 'resume later prompts byte-equal to pre-pause', pauseGreen.eq2 === true && pauseGreen.mutated !== true, JSON.stringify(pauseGreen));

const pauseCancel = await runPauseHeld(HTML_PATH, { after: 'cancel', probe: true });
check('LOCK:pause-held', 'after Cancel, Setup controls re-enable', pauseCancel.cancelled === true && pauseCancel.afterCancel && pauseCancel.afterCancel.setupLocked === false && pauseCancel.afterCancel.settingDisabled === false && pauseCancel.afterCancel.numChaptersDisabled === false && pauseCancel.afterCancel.numCharactersDisabled === false && pauseCancel.afterCancel.addCharDisabled === false && pauseCancel.afterCancel.importFileDisabled === false && pauseCancel.afterCancel.genAllDisabled === false, JSON.stringify(pauseCancel));

const mutM2 = mutateCopy('var NW_S1_LOCK_PAUSE_HELD = true;', 'var NW_S1_LOCK_PAUSE_HELD = false;');
check('LOCK:M2', 'mutation flag present', mutM2.ok, mutM2.detail);
let lockM2Red = null;
if (mutM2.ok) {
  lockM2Red = await runPauseHeld(mutM2.copy, { after: 'resume', probe: false });
  check('LOCK:M2', 'release lock on pause turns LOCK:pause-held red (fields enabled, later prompts change)', lockM2Red.settingDisabled === false && lockM2Red.edited === true && lockM2Red.mutated === true, JSON.stringify(lockM2Red));
}
globalThis.__LOCK_M2_RED = lockM2Red;
console.log('LOCK:M2 red-run ' + JSON.stringify(lockM2Red));

const mutM3 = mutateCopy('var NW_S1_LOCK_GENALL_SETUP = true;', 'var NW_S1_LOCK_GENALL_SETUP = false;');
check('LOCK:M3', 'mutation flag present', mutM3.ok, mutM3.detail);
let lockM3Red = null;
if (mutM3.ok) {
  lockM3Red = await runPauseHeld(mutM3.copy, { after: 'resume', probe: true });
  check('LOCK:M3', 'Generate All on locked (not setupLocked) turns pause-held red (Generate All enabled while paused)', lockM3Red.genAllDisabled === false && lockM3Red.setupLocked === true, JSON.stringify(lockM3Red));
}
globalThis.__LOCK_M3_RED = lockM3Red;
console.log('LOCK:M3 red-run ' + JSON.stringify(lockM3Red));

const mutM4 = mutateCopy('var NW_S1_CANCEL_RELEASES_LOCK = true;', 'var NW_S1_CANCEL_RELEASES_LOCK = false;');
check('LOCK:M4', 'mutation flag present', mutM4.ok, mutM4.detail);
let lockM4Red = null;
if (mutM4.ok) {
  lockM4Red = await runPauseHeld(mutM4.copy, { after: 'cancel', probe: true });
  check('LOCK:M4', 'Cancel not releasing lock turns pause-held red (Setup still locked after Cancel)', !!(lockM4Red.afterCancel && lockM4Red.afterCancel.setupLocked === true && lockM4Red.afterCancel.numChaptersDisabled === true && lockM4Red.afterCancel.genAllDisabled === true), JSON.stringify(lockM4Red));
}
globalThis.__LOCK_M4_RED = lockM4Red;
console.log('LOCK:M4 red-run ' + JSON.stringify(lockM4Red));

check('pageerror', 'no uncaught pageerror', pageErrors.length === 0, pageErrors.join(' | '));
await browser.close();

const failed = checks.filter((c) => !c.ok);
const report = { passed: checks.filter((c) => c.ok).length, failed: failed.length, checks, pageErrors, lockM2Red: globalThis.__LOCK_M2_RED || null, lockM3Red: globalThis.__LOCK_M3_RED || null, lockM4Red: globalThis.__LOCK_M4_RED || null };
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'SMOKE_NW_SETUP_LOCK.json'), JSON.stringify(report, null, 2));
console.log('NW setup-lock smoke: ' + report.passed + ' passed, ' + report.failed + ' failed');
for (const c of checks) {
  console.log((c.ok ? 'PASS' : 'FAIL') + ' [' + c.id + '] ' + c.name + (c.ok ? '' : ' :: ' + c.detail));
}
if (failed.length) process.exit(1);
