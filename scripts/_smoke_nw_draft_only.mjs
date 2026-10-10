/**
 * Offline smoke for NovelWriter slot 8c: draft-only mode + revision shrink guard.
 * No network, no API key: every http(s) request is aborted; window.callAI is replaced by a stub.
 * Does not stub ensureQualityAfterGenerate (the real gate + skip/revise path is under test).
 *
 *   D1  draft-only on, single Generate Chapter: 0 revise/multipass calls, saved text === stubbed draft,
 *       qualityMultiPassLog skipped:'draftOnly', status wording
 *   D2  draft-only on, Generate All over 2 chapters: same per chapter; estimate excludes auto passes;
 *       checkbox disabled while running
 *   D3  draft-only on + auto audit on: audit call happens, no continuity revise, text unchanged
 *   D4  draft-only on, explicit Apply: one applyChapterImprovements call, no follow-up auto passes
 *   D5  draft-only off: auto revision still runs (regression)
 *   D6  shrink guard at qualityRevise, qualityMultiPass, applyStaged: 50% stub restored, reason + word
 *       counts logged, pass marked reverted, gate re-run
 *   D7  boundaries: 19% accepted, 21% rejected, before.length <= 400 not guarded
 *   D8  session: flag survives export/import; legacy import without the flag is false
 *   D9  Copilot 4174871747/4174871730: draft-only batch fills windows; toggling skip OFF
 *       clears those samples, falls back to the full-pass estimate, refreshes the prefilled
 *       cap, and a follow-up full-pass batch is not stopped early by a stale draft-only cap
 *
 * Usage: node scripts/_smoke_nw_draft_only.mjs
 * Env:   NW_HTML_PATH (default this checkout's NovelWriter/NovelWriter.html), NW_OUT_DIR (default out/nw-smoke)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const HTML_PATH = path.resolve(process.env.NW_HTML_PATH || path.join(REPO_ROOT, 'NovelWriter', 'NovelWriter.html'));
const OUT_DIR = path.resolve(process.env.NW_OUT_DIR || path.join(REPO_ROOT, 'out', 'nw-smoke'));
const FIXTURE = path.join(REPO_ROOT, 'NovelWriter', 'fixtures', 'beat-gate-old-shape-v1', 'novelData.json');
const HELP = 'Writes each chapter from your outline and blueprint with no automatic rewrite passes. Use it when you want to revise by hand; quality scores are still shown.';
const LABEL = 'Skip automatic revision passes (draft only)';
const STATUS_N = (n) => 'Chapter ' + n + ' drafted (draft only: automatic revision skipped)';

for (const k of ['XAI_API_KEY', 'GROK_API_KEY', 'NW_E2E_LIVE']) delete process.env[k];

const checks = [];
const check = (id, name, ok, detail) => checks.push({ id, name, ok: !!ok, detail: ok ? '' : String(detail == null ? '' : detail).slice(0, 1200) });
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

const SLOP = "In today's world, we must delve into the rich tapestry of life. Moreover, furthermore, it is important to note a pivotal role. ";
function draftPart(ch, part) {
  return 'Chapter ' + ch + ' part ' + part + ' draft. ' + SLOP.repeat(6);
}
function expectedChapter(ch) {
  return draftPart(ch, 1) + '\n\n' + draftPart(ch, 2);
}

const PARA = 'Mira planted a bolt on the wet dock plank and counted the relay clicks under failing lights. Ozone drifted off the cable tray.';
function longProse(n) {
  const block = PARA + ' ' + PARA;
  return Array.from({ length: n }, () => block).join('\n\n');
}
const LONG = longProse(6);

const isReviseOp = (name) => /qualityRevise|qualityMultiPass|reviseChapterForQuality|runTargetedQualityPass/i.test(String(name || ''));
const isApplyOp = (name) => /applyChapterImprovements/i.test(String(name || ''));
const isAuditOp = (name) => /runChapterContinuityAudit_/i.test(String(name || ''));
const isGenOp = (name) => /generateChapter/i.test(String(name || ''));

const browser = await chromium.launch({ headless: true });
const pageErrors = [];
const networkSeen = [];

async function installHarness(page) {
  await page.evaluate(({ draftPart1, draftPart2, long }) => {
    const h = window.__h = { calls: [], dialogs: [], downloads: [], statusSeen: [], lastExport: null, toasts: [], cfg: {}, hanging: false };
    const toastEl = document.getElementById('nwToast');
    if (toastEl) new MutationObserver(() => { if (toastEl.textContent) h.toasts.push(toastEl.textContent); }).observe(toastEl, { childList: true, characterData: true, subtree: true });
    const st = document.getElementById('batchRunStatus');
    if (st) new MutationObserver(() => h.statusSeen.push(st.textContent)).observe(st, { childList: true, characterData: true, subtree: true });
    const realCOU = URL.createObjectURL;
    URL.createObjectURL = function (b) { if (b && /json/.test(String(b.type))) h.lastExport = b; return realCOU.call(this, b); };
    ['alert', 'confirm', 'prompt'].forEach((k) => {
      window[k] = function (m) { h.dialogs.push(k + ': ' + String(m).slice(0, 200)); return k === 'confirm' ? true : (k === 'prompt' ? null : undefined); };
    });
    HTMLAnchorElement.prototype.click = function () { if (this.download) h.downloads.push(this.download); };
    window.scoreObligationCoverage = function () {
      return { covered: 6, total: 6, ratio: 1, words: 200, passed: true, failures: [], misses: [] };
    };
    window.collectData = function () {
      const skip = document.getElementById('skipAutoRevision');
      if (skip) novelData.skipAutoRevision = !!skip.checked;
      const aud = document.getElementById('autoContinuityAudit');
      if (aud) novelData.autoContinuityAudit = !!aud.checked;
    };
    window.callAI = async function () {
      const cfg = h.cfg;
      const opName = (arguments[2] && typeof arguments[2] === 'object' && arguments[2].operationName) || '';
      const g = window.__lastGenerateChapterGate;
      const ch = g ? g.chapter : 1;
      const part = /Part 2/.test(String(requestLog.status)) ? 2 : 1;
      h.calls.push({ operationName: opName, ch: ch, part: part, status: String(requestLog.status || '') });
      if (cfg.hangAt && cfg.hangAt === (ch + ':' + part)) { h.hanging = true; return new Promise(() => {}); }
      if (/runChapterContinuityAudit_/.test(opName)) {
        recordBookTokenUsage({ operationName: opName, originTab: 'tab5', model: 'smoke-stub', prompt_tokens: 60, completion_tokens: 40, total_tokens: 100 });
        return {
          chapterSummary: 'smoke audit ok',
          unresolvedThreads: ['the dock clock still disagrees with the relay log'],
          storyArcProgress: { currentBeat: 'b', nextBeat: 'n', riskLevel: 'medium' },
          characterArcProgress: [],
          continuityRisks: ['timeline drift on dock clocks'],
          recommendedFixes: ['keep the clock consistent']
        };
      }
      if (cfg.shrink != null && /qualityRevise|qualityMultiPass|applyChapterImprovements/.test(opName)) {
        const cur = String(novelData.chapters[ch - 1] || '');
        const n = Math.max(1, Math.floor(cur.length * cfg.shrink));
        recordBookTokenUsage({ operationName: opName, originTab: 'tab6', model: 'smoke-stub', prompt_tokens: 40, completion_tokens: 40, total_tokens: 80 });
        requestLog.returnedInfo = JSON.stringify({ usage: { total_tokens: 80 } });
        return { chapter: cur.slice(0, n) };
      }
      if (/qualityRevise|qualityMultiPass|applyChapterImprovements/.test(opName)) {
        const cur = String(novelData.chapters[ch - 1] || 'revised');
        const tok = Number(cfg.reviseTokens) > 0 ? Number(cfg.reviseTokens) : 80;
        recordBookTokenUsage({ operationName: opName, originTab: 'tab6', model: 'smoke-stub', prompt_tokens: 40, completion_tokens: tok - 40, total_tokens: tok });
        requestLog.returnedInfo = JSON.stringify({ usage: { total_tokens: tok } });
        return { chapter: cur };
      }
      const usage = { prompt_tokens: 600, completion_tokens: 400, total_tokens: 1000 };
      recordBookTokenUsage(Object.assign({ operationName: opName || 'generateChapter', originTab: 'tab5', model: 'smoke-stub' }, usage));
      requestLog.returnedInfo = JSON.stringify({ usage });
      const text = part === 2 ? draftPart2(ch) : draftPart1(ch);
      return { chapter: text };
    };
    function draftPart1(ch) { return 'Chapter ' + ch + ' part 1 draft. ' + "In today's world, we must delve into the rich tapestry of life. Moreover, furthermore, it is important to note a pivotal role. ".repeat(6); }
    function draftPart2(ch) { return 'Chapter ' + ch + ' part 2 draft. ' + "In today's world, we must delve into the rich tapestry of life. Moreover, furthermore, it is important to note a pivotal role. ".repeat(6); }
    h.draftPart = function (ch, part) { return part === 2 ? draftPart2(ch) : draftPart1(ch); };
    h.longProse = long;
    h.load = function (nd) {
      Object.keys(nd).forEach((k) => { novelData[k] = JSON.parse(JSON.stringify(nd[k])); });
      novelData.chapters = Array.from({ length: nd.numChapters }, () => '');
      novelData.chapterImprovements = Array.from({ length: nd.numChapters }, () => '');
      novelData.chapterContinuityPackets = [];
      novelData.continuityTracker = { chapters: [], characterArcProgress: [], storyArcProgress: {} };
      novelData.continuityFindings = [];
      novelData.autoContinuityAudit = false;
      novelData.skipAutoRevision = false;
      novelData.apiKey = 'smoke-placeholder-not-a-key';
      novelData.tokenUsage = null;
      novelData.qualityMultiPassLog = [];
      novelData.qualityReviseLog = [];
      novelData.boundedReviseLog = [];
      ensureBookTokenUsage();
      delete novelData.batchRun;
      document.getElementById('numChapters').value = String(nd.numChapters);
      document.getElementById('maxTokens').value = '1000';
      document.getElementById('autoContinuityAudit').checked = false;
      document.getElementById('skipAutoRevision').checked = false;
      document.getElementById('apiKey').value = '';
      updateChapterSubpages();
      document.getElementById('batchFrom').value = '1';
      document.getElementById('batchTo').value = '2';
      document.getElementById('batchRegenerate').checked = false;
      document.getElementById('batchPerChapterDownload').checked = false;
      const cap = document.getElementById('batchTokenCap');
      cap.dataset.userEdited = '';
      nwBatchRefreshEstimate();
    };
    h.setSkip = function (on) {
      document.getElementById('skipAutoRevision').checked = !!on;
      novelData.skipAutoRevision = !!on;
    };
    h.setAudit = function (on) {
      document.getElementById('autoContinuityAudit').checked = !!on;
      novelData.autoContinuityAudit = !!on;
    };
  }, { draftPart1: draftPart(1, 1), draftPart2: draftPart(1, 2), long: LONG });
}

async function openPage() {
  const page = await browser.newPage();
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (!/^https?:/i.test(url)) return route.continue();
    networkSeen.push(url);
    return route.abort('blockedbyclient');
  });
  await page.goto(pathToFileURL(HTML_PATH).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof generateChapter === 'function' && typeof ensureQualityAfterGenerate === 'function' && typeof guardChapterReviseGrowth === 'function', null, { timeout: 30000 });
  await installHarness(page);
  return page;
}

function ops(calls) { return (calls || []).map((c) => c.operationName); }

// ---------------- UI / Help ----------------
{
  const page = await openPage();
  const ui = await page.evaluate(() => {
    const el = document.getElementById('skipAutoRevision');
    const label = el && el.closest('label');
    return {
      exists: !!el,
      checked: !!(el && el.checked),
      disabled: !!(el && el.disabled),
      label: label ? label.textContent.trim() : '',
      title: (label && label.getAttribute('title')) || (el && el.getAttribute('title')) || '',
      maxShrink: (typeof NW_QUALITY_REVISE !== 'undefined' && NW_QUALITY_REVISE) ? NW_QUALITY_REVISE.maxShrinkRatio : null,
      skipDefault: novelData.skipAutoRevision
    };
  });
  check('UI', 'checkbox exists next to Auto Continuity Audit, default unchecked', ui.exists && ui.checked === false && ui.disabled === false && ui.skipDefault === false, JSON.stringify(ui));
  check('UI', 'exact label: ' + LABEL, ui.label === LABEL, ui.label);
  check('UI', 'Help line is the title on the control', ui.title === HELP, ui.title);
  check('UI', 'NW_QUALITY_REVISE.maxShrinkRatio is 0.20', ui.maxShrink === 0.20, ui.maxShrink);
  const helpInHtml = HTML.includes(HELP) && HTML.includes(LABEL);
  check('UI', 'Help line and label present in NovelWriter.html', helpInHtml, 'missing help/label in HTML');
  const UG_PATH = path.join(REPO_ROOT, 'NovelWriter', 'user_guide.html');
  const ug = fs.existsSync(UG_PATH) ? fs.readFileSync(UG_PATH, 'utf8') : '';
  check('UI', 'Help line present in NovelWriter/user_guide.html', ug.includes(HELP) && ug.includes(LABEL), 'missing help/label in user_guide');
  await page.close();
}

// ---------------- D1: draft-only single Generate Chapter ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async (nd) => {
    const h = window.__h;
    h.load(nd);
    h.setSkip(true);
    h.setAudit(false);
    h.calls.length = 0;
    h.statusSeen.length = 0;
    await generateChapter(1);
    return {
      text: novelData.chapters[0],
      genDom: (document.getElementById('chapterGenContent1') || {}).value || '',
      calls: h.calls.slice(),
      log: (novelData.qualityMultiPassLog || []).slice(),
      status: document.getElementById('batchRunStatus').textContent,
      statusSeen: h.statusSeen.slice(),
      lastGate: novelData.lastQualityGate ? { passed: novelData.lastQualityGate.passed, scores: novelData.lastQualityGate.scores, label: novelData.lastQualityGate.label } : null
    };
  }, ND);
  const want = expectedChapter(1);
  const reviseCalls = (r.calls || []).filter((c) => isReviseOp(c.operationName));
  const genCalls = (r.calls || []).filter((c) => isGenOp(c.operationName) || c.operationName === '');
  check('D1', 'saved text === stubbed draft (byte-for-byte) and Tab 5 textarea matches', r.text === want && r.genDom === want, JSON.stringify({ len: (r.text || '').length, want: want.length, head: String(r.text || '').slice(0, 80) }));
  check('D1', 'zero calls match revise or multipass', reviseCalls.length === 0, JSON.stringify(ops(r.calls)));
  check('D1', 'two generate parts were stubbed (Part 1 + Part 2)', (r.calls || []).filter((c) => !isReviseOp(c.operationName) && !isAuditOp(c.operationName) && !isApplyOp(c.operationName)).length === 2, JSON.stringify(ops(r.calls)));
  const skipEnt = (r.log || []).find((e) => e && e.skipped === 'draftOnly' && e.chapter === 1);
  check('D1', "qualityMultiPassLog entry { chapter:1, skipped:'draftOnly', gate }", !!(skipEnt && skipEnt.gate), JSON.stringify(r.log));
  check('D1', 'status line is "Chapter 1 drafted (draft only: automatic revision skipped)"', r.status === STATUS_N(1) || (r.statusSeen || []).indexOf(STATUS_N(1)) >= 0, JSON.stringify({ status: r.status, seen: r.statusSeen }));
  check('D1', 'heuristic quality gate still ran and recorded scores', !!(r.lastGate && r.lastGate.scores), JSON.stringify(r.lastGate));
  await page.close();
}

// ---------------- D2: draft-only Generate All over 2 chapters ----------------
{
  const page = await openPage();
  const est = await page.evaluate((nd) => {
    const h = window.__h;
    h.load(nd);
    h.setSkip(true);
    h.setAudit(false);
    const on = nwBatchEstimate(2);
    nwBatchRefreshEstimate();
    const hintOn = document.getElementById('batchEstimateHint').textContent;
    h.setSkip(false);
    const off = nwBatchEstimate(2);
    h.setAudit(true);
    const offAudit = nwBatchEstimate(2);
    h.setSkip(true);
    h.setAudit(false);
    return { on: on, off: off, offAudit: offAudit, hintOn: hintOn, passesOn: nwBatchPasses(), passesOff: (h.setSkip(false), nwBatchPasses()) };
  }, ND);
  // re-set skip for the actual run
  await page.evaluate(() => { window.__h.setSkip(true); window.__h.setAudit(false); });
  check('D2', 'fallback estimate counts draft parts, continuity audit, and max auto passes (2 parts: draft-only 2, full 4, with audit 5)', est.on.perChapter === 2000 && est.off.perChapter === 4000 && est.offAudit.perChapter === 5000 && est.passesOn === 2, JSON.stringify(est));
  check('D2', 'fallback estimate is labeled rough in the UI', est.hintOn.startsWith('Rough estimate:'), est.hintOn);

  await page.evaluate((nd) => {
    const h = window.__h;
    h.load(nd);
    h.setSkip(true);
    h.setAudit(false);
    h.cfg = { hangAt: '1:1' };
    window.__p = generateAllChapters();
  }, ND);
  await page.waitForFunction(() => window.__h.hanging === true, null, { timeout: 20000 });
  const locked = await page.evaluate(() => ({
    skipDisabled: document.getElementById('skipAutoRevision').disabled,
    running: nwBatchState.running
  }));
  check('D2', 'checkbox is disabled while Generate All is running', locked.skipDisabled === true && locked.running === true, JSON.stringify(locked));
  await page.close();

  const page2 = await openPage();
  const run = await page2.evaluate(async (nd) => {
    const h = window.__h;
    h.load(nd);
    h.setSkip(true);
    h.setAudit(false);
    h.calls.length = 0;
    h.statusSeen.length = 0;
    const r = await generateAllChapters();
    return {
      r: r,
      br: novelData.batchRun ? JSON.parse(JSON.stringify(novelData.batchRun)) : null,
      chapters: (novelData.chapters || []).slice(0, 2),
      calls: h.calls.slice(),
      log: (novelData.qualityMultiPassLog || []).slice(),
      statusSeen: h.statusSeen.slice(),
      skipDisabledAfter: document.getElementById('skipAutoRevision').disabled,
      estimate: novelData.batchRun && novelData.batchRun.estimate
    };
  }, ND);
  const want1 = expectedChapter(1);
  const want2 = expectedChapter(2);
  const revise2 = (run.calls || []).filter((c) => isReviseOp(c.operationName));
  check('D2', 'Generate All 2 chapters completes; each saved text === stubbed draft', run.br && run.br.reason === 'done' && run.chapters[0] === want1 && run.chapters[1] === want2, JSON.stringify({ reason: run.br && run.br.reason, lens: (run.chapters || []).map((t) => (t || '').length) }));
  check('D2', 'zero revise/multipass calls across both chapters', revise2.length === 0, JSON.stringify(ops(run.calls)));
  check('D2', "each chapter has skipped:'draftOnly' log entry", (run.log || []).filter((e) => e && e.skipped === 'draftOnly').length === 2, JSON.stringify(run.log));
  check('D2', 'per-chapter status wording for ch1 and ch2', (run.statusSeen || []).indexOf(STATUS_N(1)) >= 0 && (run.statusSeen || []).indexOf(STATUS_N(2)) >= 0, JSON.stringify(run.statusSeen));
  check('D2', 'checkbox unlocked after the run', run.skipDisabledAfter === false, run.skipDisabledAfter);
  check('D2', 'batch estimate used 0 auto passes (perChapter 2000 = maxTokens 1000 × 2)', run.estimate && run.estimate.perChapter === 2000, JSON.stringify(run.estimate));
  await page2.close();
}

// ---------------- D3: draft-only + auto audit ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async (nd) => {
    const h = window.__h;
    h.load(nd);
    h.setSkip(true);
    h.setAudit(true);
    h.calls.length = 0;
    await generateChapter(1);
    return {
      text: novelData.chapters[0],
      calls: h.calls.slice(),
      findings: (novelData.continuityFindings || []).slice(),
      risks: (novelData.continuityTracker && novelData.continuityTracker.chapters && novelData.continuityTracker.chapters[0] && novelData.continuityTracker.chapters[0].continuityRisks) || [],
      log: (novelData.qualityMultiPassLog || []).slice()
    };
  }, ND);
  const want = expectedChapter(1);
  check('D3', 'audit call happened (runChapterContinuityAudit_1)', (r.calls || []).some((c) => isAuditOp(c.operationName)), JSON.stringify(ops(r.calls)));
  check('D3', 'no continuity revise / qualityRevise / qualityMultiPass calls', (r.calls || []).filter((c) => isReviseOp(c.operationName)).length === 0, JSON.stringify(ops(r.calls)));
  check('D3', 'chapter text unchanged from stubbed draft', r.text === want, (r.text || '').slice(0, 80));
  check('D3', 'audit findings were recorded (and did not trigger a rewrite)', (r.risks || []).length > 0 || (r.findings || []).length > 0, JSON.stringify({ risks: r.risks, findings: r.findings }));
  check('D3', "log still skipped:'draftOnly'", (r.log || []).some((e) => e && e.skipped === 'draftOnly'), JSON.stringify(r.log));
  await page.close();
}

// ---------------- D4: draft-only explicit Apply ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async (nd) => {
    const h = window.__h;
    h.load(nd);
    h.setSkip(true);
    const before = h.longProse;
    novelData.chapters[0] = before;
    document.getElementById('chapterGenContent1').value = before;
    document.getElementById('chapterEditContent1').value = before;
    novelData.continuityFindings = ['Chapter 1: timeline drift on dock clocks'];
    novelData.continuityTracker.chapters[0] = { chapter: 1, continuityRisks: ['timeline drift on dock clocks'] };
    novelData.chapterImprovements[0] = 'Tighten the dock scene: add one concrete sound.';
    document.getElementById('chapterEditImprovement1').value = novelData.chapterImprovements[0];
    h.calls.length = 0;
    h.cfg = {};
    const result = await applyStagedChapterImprovements(1);
    return {
      calls: h.calls.slice(),
      log: (novelData.qualityMultiPassLog || []).slice(),
      result: { reverted: result && result.reverted, hasMulti: !!result.multi }
    };
  }, ND);
  const applyCalls = (r.calls || []).filter((c) => isApplyOp(c.operationName));
  const follow = (r.calls || []).filter((c) => isReviseOp(c.operationName));
  check('D4', 'explicit Apply makes exactly one applyChapterImprovements call', applyCalls.length === 1, JSON.stringify(ops(r.calls)));
  check('D4', 'no follow-up auto passes (0 qualityMultiPass / qualityRevise)', follow.length === 0, JSON.stringify(ops(r.calls)));
  check('D4', 'apply-staged log present; no continuity/anti-slop follow-up kinds', (r.log || []).some((e) => e && e.kind === 'apply-staged') && !(r.log || []).some((e) => e && (e.kind === 'continuity' || e.kind === 'anti-slop' || e.kind === 'gate-fail')), JSON.stringify(r.log));
  await page.close();
}

// ---------------- D5: draft-only off (regression) ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async (nd) => {
    const h = window.__h;
    h.load(nd);
    h.setSkip(false);
    h.setAudit(false);
    h.calls.length = 0;
    await generateChapter(1);
    return {
      text: novelData.chapters[0],
      calls: h.calls.slice(),
      log: (novelData.qualityMultiPassLog || []).slice(),
      reviseLog: (novelData.qualityReviseLog || []).slice()
    };
  }, ND);
  const want = expectedChapter(1);
  const reviseCalls = (r.calls || []).filter((c) => isReviseOp(c.operationName));
  check('D5', 'draft-only off: at least one revise or multipass call (auto revision still runs)', reviseCalls.length >= 1, JSON.stringify(ops(r.calls)));
  check('D5', 'draft-only off: no skipped:draftOnly log entry', !(r.log || []).some((e) => e && e.skipped === 'draftOnly'), JSON.stringify(r.log));
  check('D5', 'draft-only off: generate still produced chapter text', !!(r.text && r.text.length > 40), (r.text || '').slice(0, 80));
  await page.close();
}

// ---------------- D6: shrink guard at 3 sources ----------------
{
  const page = await openPage();
  const sources = ['qualityRevise', 'qualityMultiPass', 'applyStaged'];
  for (const source of sources) {
    const r = await page.evaluate(async ({ nd, source, long }) => {
      const h = window.__h;
      h.load(nd);
      h.setSkip(false);
      const before = long;
      novelData.chapters[0] = before;
      document.getElementById('chapterGenContent1').value = before;
      document.getElementById('chapterEditContent1').value = before;
      novelData.qualityMultiPassLog = [];
      novelData.qualityReviseLog = [];
      novelData.boundedReviseLog = [];
      h.cfg = { shrink: 0.5 };
      h.calls.length = 0;
      const inBatch = source !== 'applyStaged';
      if (inBatch) {
        nwBatchState.running = true;
        nwBatchState.chapterInFlight = 1;
        nwBatchState.quiet = true;
      }
      let result = null;
      if (source === 'qualityRevise') {
        result = await reviseChapterForQuality(1, { passed: false, failures: ['smoke-shrink'], scores: {} }, { maxAttempts: 1 });
      } else if (source === 'qualityMultiPass') {
        novelData.continuityFindings = ['Chapter 1: timeline drift on dock clocks'];
        result = await runTargetedQualityPass(1, { passed: true, failures: [], scores: {} }, { pass: 2, kind: 'continuity' });
      } else {
        novelData.chapterImprovements[0] = 'Tighten the dock scene: add one concrete sound.';
        document.getElementById('chapterEditImprovement1').value = novelData.chapterImprovements[0];
        result = await applyStagedChapterImprovements(1);
      }
      nwBatchState.running = false;
      nwBatchState.chapterInFlight = null;
      nwBatchState.quiet = false;
      return {
        text: novelData.chapters[0],
        beforeLen: before.length,
        bounded: (novelData.boundedReviseLog || []).slice(),
        reviseLog: (novelData.qualityReviseLog || []).slice(),
        multiLog: (novelData.qualityMultiPassLog || []).slice(),
        result: result && { reverted: result.reverted, reasons: result.reasons, passedAfter: result.gateAfter && result.gateAfter.passed },
        lastGate: novelData.lastQualityGate ? { passed: novelData.lastQualityGate.passed, label: novelData.lastQualityGate.label } : null,
        status: document.getElementById('batchRunStatus').textContent,
        toasts: h.toasts.slice()
      };
    }, { nd: ND, source, long: LONG });
    const reasons = ((r.bounded || [])[0] && (r.bounded || [])[0].reasons) || [];
    const shrinkReason = reasons.find((x) => /shrink_ratio>0\.2/.test(x));
    const logEntry = (r.reviseLog || []).concat(r.multiLog || []).find((e) => e && e.reverted);
    check('D6', source + ': text restored to original', r.text === LONG, JSON.stringify({ got: (r.text || '').length, want: LONG.length }));
    check('D6', source + ': shrink_ratio>0.2 reason logged with beforeWords/afterWords', !!(shrinkReason && r.bounded[0] && r.bounded[0].beforeWords > 0 && r.bounded[0].afterWords > 0 && r.bounded[0].afterWords < r.bounded[0].beforeWords), JSON.stringify(r.bounded));
    check('D6', source + ': pass marked reverted', !!(r.result && r.result.reverted === true) || !!logEntry, JSON.stringify({ result: r.result, logEntry }));
    check('D6', source + ': gate re-run on restored text (lastQualityGate present)', !!(r.lastGate && r.lastGate.label), JSON.stringify(r.lastGate));
    if (source !== 'applyStaged') {
      check('D6', source + ': batch warn "Chapter 1 revision rejected: it cut the chapter by 50%; original kept."', /Chapter 1 revision rejected: it cut the chapter by 50%; original kept/.test(r.status || ''), r.status);
    }
  }
  await page.close();
}

// ---------------- D7: boundaries ----------------
{
  const page = await openPage();
  const r = await page.evaluate((long) => {
    const before = long;
    const n19 = Math.floor(before.length * 0.81);
    const n21 = Math.floor(before.length * 0.79);
    novelData.chapters[0] = before;
    const a19 = guardChapterReviseGrowth(1, before, before.slice(0, n19), { source: 'smoke-19' });
    novelData.chapters[0] = before;
    const a21 = guardChapterReviseGrowth(1, before, before.slice(0, n21), { source: 'smoke-21' });
    const short = ('Short prose. ').repeat(18);
    const shortAfter = short.slice(0, Math.floor(short.length * 0.4));
    novelData.chapters[0] = short;
    const aShort = guardChapterReviseGrowth(1, short, shortAfter, { source: 'smoke-short' });
    return {
      beforeLen: before.length,
      n19, n21,
      a19: { ok: a19.ok, reverted: !!a19.reverted, reasons: a19.reasons, textLen: (novelData.chapters[0] || '').length },
      savedAfter19: null,
      a21: { ok: a21.ok, reverted: !!a21.reverted, reasons: a21.reasons },
      shortLen: short.length,
      aShort: { ok: aShort.ok, reverted: !!aShort.reverted, reasons: aShort.reasons },
      maxShrink: NW_QUALITY_REVISE.maxShrinkRatio
    };
  }, LONG);
  check('D7', '19% shrink is accepted', r.a19.ok === true && !r.a19.reverted, JSON.stringify(r.a19));
  check('D7', '21% shrink is rejected with shrink_ratio>0.2', r.a21.ok === false && r.a21.reverted === true && (r.a21.reasons || []).some((x) => /shrink_ratio>0\.2/.test(x)), JSON.stringify(r.a21));
  check('D7', 'before.length <= 400 is not guarded (50%+ shrink of short text accepted)', r.shortLen <= 400 && r.aShort.ok === true, JSON.stringify({ shortLen: r.shortLen, aShort: r.aShort }));
  await page.close();
}

// ---------------- D8: session export/import ----------------
{
  const page = await openPage();
  const round = await page.evaluate(async (nd) => {
    const h = window.__h;
    h.load(nd);
    h.setSkip(true);
    collectData();
    h.lastExport = null;
    exportSession();
    const blob = h.lastExport;
    const exported = blob ? JSON.parse(await blob.text()) : null;
    h.setSkip(false);
    novelData.skipAutoRevision = false;
    document.getElementById('skipAutoRevision').checked = false;
    const imported = normalizeImportedSessionData(exported);
    novelData = imported.novelData;
    applySessionDataToUI();
    return {
      exportedFlag: exported && exported.novelData && exported.novelData.skipAutoRevision,
      afterImport: novelData.skipAutoRevision,
      checkbox: document.getElementById('skipAutoRevision').checked
    };
  }, ND);
  check('D8', 'export/import round-trips skipAutoRevision true', round.exportedFlag === true && round.afterImport === true && round.checkbox === true, JSON.stringify(round));

  const legacy = await page.evaluate((nd) => {
    const payload = { schemaVersion: '1.0', sourceTool: 'NovelWriter', novelData: { title: nd.title, genre: nd.genre, chapters: [], skipAutoRevision: undefined } };
    delete payload.novelData.skipAutoRevision;
    const imported = normalizeImportedSessionData(payload);
    novelData = imported.novelData;
    applySessionDataToUI();
    return { flag: novelData.skipAutoRevision, checkbox: document.getElementById('skipAutoRevision').checked, hasKey: Object.prototype.hasOwnProperty.call(novelData, 'skipAutoRevision') };
  }, ND);
  check('D8', 'legacy import without the flag gives false', legacy.flag === false && legacy.checkbox === false, JSON.stringify(legacy));
  await page.close();
}

// ---------------- D9: toggle draft-only clears windows + refreshes cap ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async (nd) => {
    const h = window.__h;
    h.load(nd);
    h.setSkip(true);
    h.setAudit(false);
    document.getElementById('batchFrom').value = '1';
    document.getElementById('batchTo').value = '2';
    h.calls.length = 0;
    const first = await generateAllChapters();
    const windowsAfterDraft = (nwBatchState.windows || []).map((w) => ({ chapter: w.chapter, tokens: w.tokens }));
    const capAfterDraft = document.getElementById('batchTokenCap').value;
    const estAfterDraft = nwBatchEstimate(2);

    document.getElementById('batchFrom').value = '3';
    document.getElementById('batchTo').value = '4';

    const origRefresh = nwBatchRefreshEstimate;
    let refreshCalls = 0;
    const wrapped = function () {
      refreshCalls += 1;
      return origRefresh.apply(this, arguments);
    };
    nwBatchRefreshEstimate = wrapped;
    window.nwBatchRefreshEstimate = wrapped;

    const el = document.getElementById('skipAutoRevision');
    el.click();

    const windowsAfterToggle = (nwBatchState.windows || []).map((w) => ({ chapter: w.chapter, tokens: w.tokens }));
    const capAfterToggle = document.getElementById('batchTokenCap').value;
    const estAfterToggle = nwBatchEstimate(2);
    const fallbackPer = nwBatchMaxTokens() * nwBatchPasses();
    const expectedCap = String(Math.ceil(estAfterToggle.total * NW_BATCH.capFactor));

    nwBatchRefreshEstimate = origRefresh;
    window.nwBatchRefreshEstimate = origRefresh;

    h.cfg = { reviseTokens: 2000 };
    h.calls.length = 0;
    const second = await generateAllChapters();
    const br2 = novelData.batchRun;
    return {
      firstReason: first && first.reason,
      windowsAfterDraft,
      capAfterDraft,
      estAfterDraft,
      refreshCalls,
      windowsAfterToggle,
      capAfterToggle,
      estAfterToggle,
      fallbackPer,
      expectedCap,
      skipChecked: el.checked,
      skipFlag: novelData.skipAutoRevision,
      secondReason: second && second.reason,
      secondCompleted: (second && second.completed) || (br2 && br2.completed) || [],
      secondCap: br2 && br2.cap,
      secondStoppedAt: second && second.stoppedAt,
      secondEstimate: br2 && br2.estimate,
      secondRevise: h.calls.filter((c) => /qualityRevise|qualityMultiPass|reviseChapterForQuality|runTargetedQualityPass/i.test(String(c.operationName || ''))).length
    };
  }, ND);
  check('D9', 'draft-only batch filled windows with session samples', Array.isArray(r.windowsAfterDraft) && r.windowsAfterDraft.length === 2 && r.windowsAfterDraft.every((w) => w && w.tokens > 0) && r.firstReason === 'done', JSON.stringify({ firstReason: r.firstReason, windows: r.windowsAfterDraft, est: r.estAfterDraft, cap: r.capAfterDraft }));
  check('D9', 'toggling draft-only OFF clears nwBatchState.windows', Array.isArray(r.windowsAfterToggle) && r.windowsAfterToggle.length === 0, JSON.stringify(r.windowsAfterToggle));
  check('D9', 'next estimate does not reuse draft-only samples (fallback full-pass)', r.estAfterToggle && r.estAfterToggle.source === 'fallback' && r.estAfterToggle.perChapter === r.fallbackPer && r.fallbackPer === 4000 && !(r.estAfterDraft && r.estAfterDraft.source === 'session' && r.estAfterToggle.perChapter === r.estAfterDraft.perChapter && r.windowsAfterDraft && r.windowsAfterDraft.length > 0 && r.estAfterToggle.source === 'session'), JSON.stringify({ afterDraft: r.estAfterDraft, afterToggle: r.estAfterToggle, fallbackPer: r.fallbackPer }));
  check('D9', 'nwBatchRefreshEstimate ran on toggle and prefilled cap matches full-pass estimate', r.refreshCalls >= 1 && r.capAfterToggle === r.expectedCap && r.expectedCap !== r.capAfterDraft, JSON.stringify({ refreshCalls: r.refreshCalls, capAfterDraft: r.capAfterDraft, capAfterToggle: r.capAfterToggle, expectedCap: r.expectedCap }));
  check('D9', 'follow-up full-pass batch is not stopped early by a too-low draft-only cap', Array.isArray(r.secondCompleted) && r.secondCompleted.indexOf(3) >= 0 && r.secondCompleted.indexOf(4) >= 0 && r.secondStoppedAt !== 3 && r.secondCap === 10000, JSON.stringify({ reason: r.secondReason, completed: r.secondCompleted, cap: r.secondCap, stoppedAt: r.secondStoppedAt, estimate: r.secondEstimate, reviseCalls: r.secondRevise, skipChecked: r.skipChecked, skipFlag: r.skipFlag }));
  await page.close();
}

check('ALL', 'no unexpected page errors', pageErrors.length === 0, pageErrors.slice(0, 5).join(' | '));
check('ALL', 'no live provider calls (api.x.ai aborted / unused)', networkSeen.filter((u) => /api\.x\.ai/i.test(u)).length === 0, networkSeen.slice(0, 5).join(' | '));
await browser.close();

fs.mkdirSync(OUT_DIR, { recursive: true });
const failed = checks.filter((c) => !c.ok);
fs.writeFileSync(path.join(OUT_DIR, 'SMOKE_NW_DRAFT_ONLY.json'), JSON.stringify({ ok: !failed.length, passed: checks.length - failed.length, total: checks.length, checks }, null, 2));
for (const c of checks) process.stdout.write((c.ok ? 'PASS ' : 'FAIL ') + '[' + c.id + '] ' + c.name + (c.ok ? '' : ' :: ' + c.detail) + '\n');
process.stdout.write('\nNW DRAFT ONLY SMOKE: ' + (failed.length ? 'FAIL' : 'PASS') + ' (' + (checks.length - failed.length) + '/' + checks.length + ')\n');
process.exit(failed.length ? 1 : 0);
