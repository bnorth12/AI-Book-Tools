/**
 * Offline smoke for NW_SLOT_6B_INTEGRATE_SPEC Part 2 (failed-chapter retention): R1-R8.
 * No network, no API key: every http(s) request is aborted; window.callAI is replaced by a stub.
 * Nothing here needs XAI_API_KEY.
 *
 *   R1  coverage fail keeps text and sets novelData.chapterFlags[n-1] {coverageFailed, missing, at}
 *       R1 regenerate-on: same keep+flag with batchRegenerate checked (new draft stays in chapters[n-1])
 *       R1 regenerate-on two coverage fails in a row: original text survives in priorDrafts + checkpoint; Skip restores it
 *       R1 two chapters failing in one run each keep their own prior text
 *       R1 clean run leaves no chapterFlags at all
 *   R2  continuity packet and tracker rolled back so unaccepted text never feeds n+1
 *   R3  Accept rebuilds packet/tracker from the kept text
 *   R4  acknowledged skip survives checkpoint, reload and Resume (no second confirm)
 *   R5  revise cap = max(6000, 2 x target)
 *   R6  #139 (a) import-in-progress writer lock: nwBatchIsLocked() true during applySessionDataToUI
 *   R7  #139 (b) regression: stoppedAt/reason/detail are in the checkpoint written after a coverage stop
 *       plus: failing the final inactive checkpoint write still restores stop fields from the preceding active checkpoint
 *   R8  #139 (c) nwBatchForgetRun toast when nwBatchIdbDelete fails
 *   R9  chapterFlags import pass-through: absent stays absent; object entries keep unknown keys
 *       (round-trip through import AND checkpoint restore); key name is replay (not replayFail)
 *   R10 chapter fails then passes: nwSetChapterFlag merge {coverageFailed:false}; Tab 5/6 do not render
 *   R11 v0-pre6b-no-flags: after load, import, and checkpoint restore, novelData has NO chapterFlags key
 *   R12 Skip with prior restores it into later packets; Skip with no prior keeps the failed draft
 *       but excludes it from buildChapterContinuityPacket
 *   R13 coverage decide in-progress guard: buttons disabled; double-click makes no extra audit/checkpoint
 *   R14 Accept: failing continuity audit leaves the decision pending (no complete / prior clear / ack)
 *   R15 restoreInterruptedBatchRun keeps reason coverage + coverageAck; decision box shows again
 *   R16 nwBatchStart refuses while importing (zero provider calls)
 *   R17 last planned chapter Accept/Skip finalizes the run (no Click Resume)
 *
 * Mutations (TEMP copy, flags flipped false; each must turn a core assertion red):
 *   M3  drop packet rollback -> R2 red
 *   M4  drop coverageAck from checkpoint -> R4 red
 *   M5  move stoppedAt after the checkpoint write -> R7 red
 *   M6  strip chapterFlags on import -> R9 extraKey red
 *   M7  skip clear-flag-on-pass -> R10 still rendered
 *   M8  restore old regenerate-on coverage path -> R1 regenerate-on keeps old text
 *   M9  default-fill chapterFlags on load -> R11 red
 *   M10 overwrite priorDraft on 2nd coverage fail -> original does not survive
 *   M11 unconditional clear-on-pass -> clean run creates chapterFlags
 *   M12 skip does not exclude failed draft from later packets -> R12 red
 *   M13 no decide-in-progress guard -> double Accept extra audit/checkpoint
 *   M14 Accept still completes after audit fail -> R14 red
 *   M15 restore forces reason user on coverage stop -> R15 red
 *   M16 Start during import is not refused -> R16 red
 *
 * Usage: node scripts/_smoke_nw_retention.mjs
 * Env:   NW_HTML_PATH (default this checkout's NovelWriter/NovelWriter.html), NW_OUT_DIR (default out/nw-smoke)
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
const PRE6B_PATH = path.join(REPO_ROOT, 'NovelWriter', 'fixtures', 'v0-pre6b-no-flags', 'session.json');

for (const k of ['XAI_API_KEY', 'GROK_API_KEY', 'NW_E2E_LIVE']) delete process.env[k];

const checks = [];
const check = (id, name, ok, detail) => checks.push({ id, name, ok: !!ok, detail: ok ? '' : String(detail == null ? '' : detail).slice(0, 1200) });
const clone = (o) => JSON.parse(JSON.stringify(o));
const HTML = fs.readFileSync(HTML_PATH, 'utf8');
const FX = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
delete FX._fixture;
const PRE6B = JSON.parse(fs.readFileSync(PRE6B_PATH, 'utf8'));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

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

const FLAGS = {
  packet: 'var NW_6B_PACKET_ROLLBACK = true;',
  ack: 'var NW_6B_CHECKPOINT_COVERAGE_ACK = true;',
  stopped: 'var NW_6B_STOPPEDAT_BEFORE_CHECKPOINT = true;',
  passthrough: 'var NW_6B_FLAGS_PASSTHROUGH = true;',
  clearOnPass: 'var NW_6B_CLEAR_FLAG_ON_PASS = true;',
  keepNewDraft: 'var NW_6B_KEEP_NEW_DRAFT_BOTH_MODES = true;',
  lazyFlags: 'var NW_6B_LAZY_CHAPTER_FLAGS = true;',
  priorWriteOnce: 'var NW_6B_PRIOR_DRAFT_WRITE_ONCE = true;',
  clearOnlyIfFailed: 'var NW_6B_CLEAR_FLAG_ONLY_IF_FAILED = true;',
  skipExclude: 'var NW_6B_SKIP_EXCLUDE_CONTINUITY = true;',
  decideGuard: 'var NW_6B_COVERAGE_DECIDE_GUARD = true;',
  acceptAudit: 'var NW_6B_ACCEPT_AUDIT_ABORT = true;',
  restoreCoverage: 'var NW_6B_RESTORE_KEEP_COVERAGE = true;',
  startLock: 'var NW_6B_START_REFUSES_LOCK = true;'
};
function mutateCopy(flagFrom) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-6b-ret-'));
  const copy = path.join(dir, 'NovelWriter.html');
  if (HTML.indexOf(flagFrom) < 0) return { ok: false, copy: null, dir, detail: 'flag not found: ' + flagFrom };
  fs.writeFileSync(copy, HTML.replace(flagFrom, flagFrom.replace('true', 'false')));
  return { ok: true, copy, dir };
}

const browser = await chromium.launch({ headless: true });
const pageErrors = [];
const networkSeen = [];

async function installHarness(page) {
  await page.evaluate(() => {
    const h = window.__h = { calls: [], dialogs: [], toasts: [], downloads: [], puts: 0, lastExport: null };
    const toastEl = document.getElementById('nwToast');
    if (toastEl) new MutationObserver(() => { if (toastEl.textContent) h.toasts.push(toastEl.textContent); }).observe(toastEl, { childList: true, characterData: true, subtree: true });
    ['alert', 'confirm', 'prompt'].forEach((k) => {
      window[k] = function (m) { h.dialogs.push(k + ': ' + String(m).slice(0, 200)); return k === 'confirm' ? true : (k === 'prompt' ? null : undefined); };
    });
    const realCOU = URL.createObjectURL;
    URL.createObjectURL = function (b) { if (b && /json/.test(String(b.type))) h.lastExport = b; return realCOU.call(URL, b); };
    HTMLAnchorElement.prototype.click = function () { if (this.download) h.downloads.push(this.download); };
    window.collectData = function () {};
    window.ensureQualityAfterGenerate = async function () {};
    window.scoreObligationCoverage = function (text, n) {
      const failAt = h.cfg && h.cfg.coverageFail;
      const bad = failAt === n || (Array.isArray(failAt) && failAt.indexOf(n) >= 0);
      return { covered: bad ? 0 : 6, total: 6, ratio: bad ? 0 : 1, words: 120, passed: !bad, failures: bad ? ['smoke: obligations not dramatized'] : [], misses: bad ? ['smoke-obligation'] : [] };
    };
    h.idbGet = function (key) {
      return nwBatchOpenDb().then((db) => new Promise((res, rej) => {
        const q = db.transaction('checkpoints', 'readonly').objectStore('checkpoints').get(key);
        q.onsuccess = () => res(q.result);
        q.onerror = () => rej(q.error);
      }));
    };
    window.callAI = async function () {
      const cfg = h.cfg || {};
      const opName = (arguments[2] && typeof arguments[2] === 'object' && arguments[2].operationName) || '';
      const am = /^runChapterContinuityAudit_(\d+)$/.exec(opName);
      if (am) {
        const an = Number(am[1]);
        h.calls.push({ kind: 'audit', ch: an });
        if (cfg.auditDelayMs) await new Promise((r) => setTimeout(r, cfg.auditDelayMs));
        if (cfg.auditFail) throw new Error('smoke: audit fail');
        recordBookTokenUsage({ operationName: opName, originTab: 'tab5', model: 'smoke-stub', prompt_tokens: 60, completion_tokens: 40, total_tokens: 100 });
        return {
          chapterSummary: 'smoke audit ch' + an,
          unresolvedThreads: ['smoke-thread-ch' + an],
          storyArcProgress: { currentBeat: 'b' + an, nextBeat: 'n', riskLevel: 'low' },
          characterArcProgress: [],
          continuityRisks: [],
          recommendedFixes: []
        };
      }
      const g = window.__lastGenerateChapterGate;
      const ch = g ? g.chapter : 0;
      const part = /Part 2/.test(String(requestLog.status)) ? 2 : 1;
      h.calls.push({ kind: 'draft', ch, part, max_tokens: (arguments[2] && arguments[2].max_tokens) || null, operationName: opName });
      const per = 1000;
      const usage = { prompt_tokens: 600, completion_tokens: 400, total_tokens: per };
      recordBookTokenUsage(Object.assign({ operationName: 'generateChapter', originTab: 'tab5', model: 'smoke-stub' }, usage));
      requestLog.returnedInfo = JSON.stringify({ usage });
      return { chapter: 'Chapter ' + ch + ' part ' + part + ' prose (smoke). The relay hums under failing lights. KEPT-DRAFT-CH' + ch };
    };
    h.load = function (nd) {
      Object.keys(nd).forEach((k) => { novelData[k] = JSON.parse(JSON.stringify(nd[k])); });
      novelData.chapters = Array.from({ length: nd.numChapters }, () => '');
      novelData.chapterImprovements = Array.from({ length: nd.numChapters }, () => '');
      novelData.chapterContinuityPackets = [];
      novelData.chapterFlags = [];
      novelData.continuityTracker = { chapters: [], characterArcProgress: [], storyArcProgress: {} };
      novelData.autoContinuityAudit = true;
      novelData.apiKey = 'smoke-placeholder-not-a-key';
      novelData.tokenUsage = null;
      ensureBookTokenUsage();
      delete novelData.batchRun;
      document.getElementById('numChapters').value = String(nd.numChapters);
      document.getElementById('maxTokens').value = '1000';
      document.getElementById('autoContinuityAudit').checked = true;
      updateChapterSubpages();
      document.getElementById('batchFrom').value = '1';
      document.getElementById('batchTo').value = '4';
      document.getElementById('batchRegenerate').checked = false;
      document.getElementById('batchPerChapterDownload').checked = false;
      const cap = document.getElementById('batchTokenCap');
      cap.dataset.userEdited = '';
      nwBatchRefreshEstimate();
    };
    h.seedContinuity = function () {
      if (!Array.isArray(novelData.chapterContinuityPackets)) novelData.chapterContinuityPackets = [];
      novelData.chapterContinuityPackets[1] = { chapter: 2, marker: 'PRE-CH2' };
      novelData.chapterContinuityPackets[2] = { chapter: 3, marker: 'PRE-CH3' };
      if (!novelData.continuityTracker) novelData.continuityTracker = { chapters: [], characterArcProgress: [], storyArcProgress: {} };
      novelData.continuityTracker.chapters[1] = { chapter: 2, marker: 'TRACK-PRE', unresolvedThreads: ['pre'] };
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
    networkSeen.push(url);
    return route.abort('blockedbyclient');
  });
  await page.goto(pathToFileURL(htmlPath || HTML_PATH).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof generateAllChapters === 'function' && typeof nwBatchCoverageDecide === 'function' && window.__nwBatchRestoreCheck, null, { timeout: 30000 });
  await page.evaluate(() => window.__nwBatchRestoreCheck);
  await installHarness(page);
  return page;
}

async function coverageStop(page, extra) {
  return page.evaluate(async (o) => {
    const h = window.__h;
    if (o.nd) h.load(o.nd);
    if (o.prefill) Object.keys(o.prefill).forEach((n) => nwBatchSetChapterText(Number(n), o.prefill[n]));
    if (o.regenerate != null) document.getElementById('batchRegenerate').checked = !!o.regenerate;
    h.seedContinuity();
    if (o.to != null) document.getElementById('batchTo').value = String(o.to);
    h.cfg = { coverageFail: o.coverageFail != null ? o.coverageFail : 2 };
    const t0 = Date.now();
    const r = await generateAllChapters();
    const flag = (novelData.chapterFlags || [])[1];
    const packets = JSON.parse(JSON.stringify(novelData.chapterContinuityPackets || []));
    const tracker = JSON.parse(JSON.stringify((novelData.continuityTracker && novelData.continuityTracker.chapters) || []));
    const rec = novelData.batchRun ? await h.idbGet(novelData.batchRun.id) : null;
    const elG = document.getElementById('chapterGenFlag2');
    const elE = document.getElementById('chapterEditFlag2');
    const exp = h.lastExport ? JSON.parse(await h.lastExport.text()) : null;
    const expBr = exp && exp.novelData && exp.novelData.batchRun ? exp.novelData.batchRun : null;
    return {
      r, ms: Date.now() - t0,
      br: novelData.batchRun ? JSON.parse(JSON.stringify(novelData.batchRun)) : null,
      chapters: (novelData.chapters || []).slice(),
      flag,
      flagDomGen: (elG || {}).textContent || '',
      flagDomEdit: (elE || {}).textContent || '',
      flagHiddenGen: elG ? !!elG.hidden : null,
      flagHiddenEdit: elE ? !!elE.hidden : null,
      packets,
      tracker,
      recBr: rec && rec.batchRun ? JSON.parse(JSON.stringify(rec.batchRun)) : null,
      recActive: rec ? rec.active : null,
      recNdFlags: rec && rec.novelData ? rec.novelData.chapterFlags : null,
      recCh2: rec && rec.novelData && rec.novelData.chapters ? rec.novelData.chapters[1] : null,
      chapterUsage: (novelData.batchRun && novelData.batchRun.chapterUsage) || [],
      windows: (nwBatchState.windows || []).slice(),
      coverageBox: !document.getElementById('batchCoverageBox').hidden,
      coverageMsg: (document.getElementById('batchCoverageMsg') || {}).textContent || '',
      dialogs: h.dialogs.slice(),
      toasts: h.toasts.slice(),
      priorDrafts: novelData.batchRun && Array.isArray(novelData.batchRun.priorDrafts) ? JSON.parse(JSON.stringify(novelData.batchRun.priorDrafts)) : null,
      recPrior: rec && rec.batchRun && rec.batchRun.priorDrafts ? JSON.parse(JSON.stringify(rec.batchRun.priorDrafts)) : null,
      expPrior: expBr && expBr.priorDrafts ? JSON.parse(JSON.stringify(expBr.priorDrafts)) : null
    };
  }, extra || { nd: ND });
}

// ---------------- R1 keep and flag ----------------
{
  const page = await openPage();
  const s = await coverageStop(page);
  const kept = /^Chapter 2 part 1/.test(s.chapters[1] || '') && /KEPT-DRAFT-CH2/.test(s.chapters[1] || '');
  check('R1', 'coverage fail keeps ch2 text (not discarded) and stops at 2', s.br && s.br.reason === 'coverage' && s.br.stoppedAt === 2 && kept && (s.br.completed || []).indexOf(2) < 0, JSON.stringify({ br: s.br, ch2: s.chapters[1] }));
  check('R1', 'chapterFlags[1] = {coverageFailed, missing, at}', !!(s.flag && s.flag.coverageFailed === true && eq(s.flag.missing, ['smoke-obligation']) && typeof s.flag.at === 'string' && s.flag.at), JSON.stringify(s.flag));
  check('R1', 'Tab 5 and Tab 6 show the coverage-failed flag via textContent', /Coverage failed/.test(s.flagDomGen) && /smoke-obligation/.test(s.flagDomGen) && s.flagDomEdit === s.flagDomGen, JSON.stringify({ gen: s.flagDomGen, edit: s.flagDomEdit }));
  check('R1', 'coverage-failed chapter does not push chapterUsage or nwBatchState.windows', (s.chapterUsage || []).every((x) => x.chapter !== 2) && (s.windows || []).every((x) => x.chapter !== 2), JSON.stringify({ chapterUsage: s.chapterUsage, windows: s.windows }));
  check('R1', 'Accept/Regenerate/Skip box is shown; 0 dialogs', s.coverageBox === true && s.dialogs.length === 0, JSON.stringify({ box: s.coverageBox, dialogs: s.dialogs }));
  check('R1', 'coverage box wording: is missing required story points', /is missing required story points/.test(s.coverageMsg || ''), s.coverageMsg);
  await page.close();
}

// ---------------- R1 regenerate-on: keep NEW draft in both modes ----------------
{
  const page = await openPage();
  const OLD2 = 'Hand-written chapter two that must not remain after a coverage failure.';
  const s = await coverageStop(page, { nd: ND, regenerate: true, prefill: { 2: OLD2 } });
  const keptNew = /^Chapter 2 part 1/.test(s.chapters[1] || '') && /KEPT-DRAFT-CH2/.test(s.chapters[1] || '');
  check('R1', 'batchRegenerate on: coverage fail keeps NEW ch2 draft (not old text) and stops at 2', s.br && s.br.reason === 'coverage' && s.br.stoppedAt === 2 && keptNew && s.chapters[1] !== OLD2 && (s.br.completed || []).indexOf(2) < 0, JSON.stringify({ br: s.br, ch2: s.chapters[1], old: OLD2 }));
  check('R1', 'batchRegenerate on: chapterFlags[1] coverageFailed and Tab 5/6 render the flag', !!(s.flag && s.flag.coverageFailed === true && /Coverage failed/.test(s.flagDomGen) && s.flagDomEdit === s.flagDomGen && s.flagHiddenGen === false), JSON.stringify({ flag: s.flag, gen: s.flagDomGen, hidden: s.flagHiddenGen }));
  check('R1', 'batchRegenerate on: checkpoint has the NEW draft (not parked-only in rejectedDraft)', /KEPT-DRAFT-CH2/.test(s.recCh2 || '') && !(s.br && s.br.rejectedDraft), JSON.stringify({ recCh2: s.recCh2, rejectedDraft: s.br && s.br.rejectedDraft }));
  const prior1 = s.priorDrafts && s.priorDrafts[1];
  const recPrior1 = s.recPrior && s.recPrior[1];
  const expPrior1 = s.expPrior && s.expPrior[1];
  check('R1', 'batchRegenerate on: priorDrafts[1] = {text: original, at} (new draft kept separately)', !!(prior1 && prior1.text === OLD2 && typeof prior1.at === 'string' && prior1.at && s.chapters[1] !== OLD2), JSON.stringify({ prior: prior1, ch2: s.chapters[1] }));
  check('R1', 'batchRegenerate on: checkpoint and export include priorDrafts original text', !!(recPrior1 && recPrior1.text === OLD2 && expPrior1 && expPrior1.text === OLD2), JSON.stringify({ recPrior: recPrior1, expPrior: expPrior1 }));
  check('R1', 'batchRegenerate on: coverage box shows "Your previous text is saved; Skip restores it."', (s.coverageMsg || '').indexOf('Your previous text is saved; Skip restores it.') >= 0, s.coverageMsg);
  await page.close();
}

// ---------------- R1 regenerate-on: two coverage failures in a row; Skip restores original ----------------
{
  const page = await openPage();
  const OLD2 = 'Hand-written chapter two ORIGINAL prior text that must survive two coverage failures.';
  const s1 = await coverageStop(page, { nd: ND, regenerate: true, prefill: { 2: OLD2 } });
  const firstPrior = s1.priorDrafts && s1.priorDrafts[1];
  check('R1', 'two-fail: first coverage fail stores original in priorDrafts and checkpoint', !!(firstPrior && firstPrior.text === OLD2 && s1.recPrior && s1.recPrior[1] && s1.recPrior[1].text === OLD2 && /KEPT-DRAFT-CH2/.test(s1.chapters[1] || '')), JSON.stringify({ prior: firstPrior, recPrior: s1.recPrior && s1.recPrior[1], ch2: s1.chapters[1] }));
  const s2 = await page.evaluate(async () => {
    await nwBatchCoverageDecide('regenerate');
    window.__h.cfg = { coverageFail: 2 };
    const r = await resumeBatchRun();
    const rec = novelData.batchRun ? await window.__h.idbGet(novelData.batchRun.id) : null;
    const exp = window.__h.lastExport ? JSON.parse(await window.__h.lastExport.text()) : null;
    const prior = novelData.batchRun && novelData.batchRun.priorDrafts ? novelData.batchRun.priorDrafts[1] : null;
    const recPrior = rec && rec.batchRun && rec.batchRun.priorDrafts ? rec.batchRun.priorDrafts[1] : null;
    const expPrior = exp && exp.novelData && exp.novelData.batchRun && exp.novelData.batchRun.priorDrafts ? exp.novelData.batchRun.priorDrafts[1] : null;
    nwBatchState.interrupted = rec;
    const restoredOk = rec ? await restoreInterruptedBatchRun() : false;
    const restoredPrior = novelData.batchRun && novelData.batchRun.priorDrafts ? novelData.batchRun.priorDrafts[1] : null;
    return {
      r,
      ch2: (novelData.chapters || [])[1] || '',
      prior,
      recPrior,
      expPrior,
      restoredOk,
      restoredPrior,
      coverageMsg: (document.getElementById('batchCoverageMsg') || {}).textContent || '',
      reason: novelData.batchRun && novelData.batchRun.reason,
      stoppedAt: novelData.batchRun && novelData.batchRun.stoppedAt
    };
  });
  check('R1', 'two-fail: second coverage fail does not overwrite original in priorDrafts', !!(s2.prior && s2.prior.text === OLD2 && /KEPT-DRAFT-CH2/.test(s2.ch2) && s2.ch2 !== OLD2), JSON.stringify({ prior: s2.prior, ch2: s2.ch2 }));
  check('R1', 'two-fail: original survives in checkpoint and export after 2nd fail', !!(s2.recPrior && s2.recPrior.text === OLD2 && s2.expPrior && s2.expPrior.text === OLD2), JSON.stringify({ recPrior: s2.recPrior, expPrior: s2.expPrior }));
  check('R1', 'two-fail: restore from checkpoint keeps original priorDrafts', !!(s2.restoredOk === true && s2.restoredPrior && s2.restoredPrior.text === OLD2), JSON.stringify({ restoredOk: s2.restoredOk, restoredPrior: s2.restoredPrior }));
  const skipped = await page.evaluate(async () => {
    const ok = await nwBatchCoverageDecide('skip');
    const p3 = typeof buildChapterContinuityPacket === 'function' ? buildChapterContinuityPacket(3) : null;
    return {
      ok,
      ch2: (novelData.chapters || [])[1] || '',
      gen: (document.getElementById('chapterGenContent2') || {}).value || '',
      edit: (document.getElementById('chapterEditContent2') || {}).value || '',
      prior: novelData.batchRun && novelData.batchRun.priorDrafts ? novelData.batchRun.priorDrafts[1] : null,
      reason: novelData.batchRun && novelData.batchRun.reason,
      p3: p3 ? JSON.parse(JSON.stringify(p3)) : null,
      skipList: novelData.batchRun && novelData.batchRun.continuitySkip
    };
  });
  check('R1', 'two-fail: Skip restores original text and clears priorDrafts slot', !!(skipped.ok === true && skipped.ch2 === OLD2 && skipped.gen === OLD2 && skipped.edit === OLD2 && !skipped.prior), JSON.stringify(skipped));
  check('R12', 'Skip with prior: restored original is fed to later packets (not the failed draft)', !!(skipped.p3 && JSON.stringify(skipped.p3).indexOf(OLD2) >= 0 && JSON.stringify(skipped.p3).indexOf('KEPT-DRAFT-CH2') < 0 && !(skipped.skipList || []).includes(2)), JSON.stringify({ p3: skipped.p3, skipList: skipped.skipList, reason: skipped.reason }));
  await page.close();
}

// ---------------- R1 two chapters failing in one run each keep their own prior text ----------------
{
  const page = await openPage();
  const OLD2 = 'Chapter two ORIGINAL prior text unique to ch2.';
  const OLD3 = 'Chapter three ORIGINAL prior text unique to ch3.';
  const s1 = await coverageStop(page, { nd: ND, regenerate: true, prefill: { 2: OLD2, 3: OLD3 }, coverageFail: [2, 3] });
  check('R1', 'two-ch: ch2 fail stores only ch2 original in priorDrafts[1]', !!(s1.priorDrafts && s1.priorDrafts[1] && s1.priorDrafts[1].text === OLD2 && !s1.priorDrafts[2] && s1.chapters[1] !== OLD2), JSON.stringify({ prior: s1.priorDrafts, ch2: s1.chapters[1] }));
  const s2 = await page.evaluate(async (olds) => {
    const okSkip = await nwBatchCoverageDecide('skip');
    window.__h.cfg = { coverageFail: [2, 3] };
    const r = await resumeBatchRun();
    const rec = novelData.batchRun ? await window.__h.idbGet(novelData.batchRun.id) : null;
    return {
      okSkip,
      r,
      ch2: (novelData.chapters || [])[1] || '',
      ch3: (novelData.chapters || [])[2] || '',
      prior2: novelData.batchRun && novelData.batchRun.priorDrafts ? novelData.batchRun.priorDrafts[1] : null,
      prior3: novelData.batchRun && novelData.batchRun.priorDrafts ? novelData.batchRun.priorDrafts[2] : null,
      recPrior2: rec && rec.batchRun && rec.batchRun.priorDrafts ? rec.batchRun.priorDrafts[1] : null,
      recPrior3: rec && rec.batchRun && rec.batchRun.priorDrafts ? rec.batchRun.priorDrafts[2] : null,
      reason: novelData.batchRun && novelData.batchRun.reason,
      stoppedAt: novelData.batchRun && novelData.batchRun.stoppedAt
    };
  }, { OLD2, OLD3 });
  check('R1', 'two-ch: after Skip ch2 + fail ch3, ch2 keeps its original and ch3 has its own prior', !!(s2.okSkip === true && s2.ch2 === OLD2 && s2.prior3 && s2.prior3.text === OLD3 && !s2.prior2 && s2.ch3 !== OLD3 && /KEPT-DRAFT-CH3/.test(s2.ch3 || '') && s2.stoppedAt === 3), JSON.stringify(s2));
  check('R1', 'two-ch: checkpoint has ch3 original in priorDrafts[2] (not ch2 text)', !!(s2.recPrior3 && s2.recPrior3.text === OLD3 && s2.recPrior3.text !== OLD2 && !s2.recPrior2), JSON.stringify({ recPrior2: s2.recPrior2, recPrior3: s2.recPrior3 }));
  const skipped3 = await page.evaluate(async () => {
    const ok = await nwBatchCoverageDecide('skip');
    return {
      ok,
      ch3: (novelData.chapters || [])[2] || '',
      prior3: novelData.batchRun && novelData.batchRun.priorDrafts ? novelData.batchRun.priorDrafts[2] : null
    };
  });
  check('R1', 'two-ch: Skip restores ch3 original (independent of ch2)', !!(skipped3.ok === true && skipped3.ch3 === OLD3 && !skipped3.prior3), JSON.stringify(skipped3));
  await page.close();
}

// ---------------- R1 clean run leaves no chapterFlags at all ----------------
{
  const page = await openPage();
  const clean = await page.evaluate(async (nd) => {
    const h = window.__h;
    h.load(nd);
    delete novelData.chapterFlags;
    h.cfg = {};
    const r = await generateAllChapters();
    return {
      r,
      reason: novelData.batchRun && novelData.batchRun.reason,
      completed: (novelData.batchRun && novelData.batchRun.completed) || [],
      hasFlags: Object.prototype.hasOwnProperty.call(novelData, 'chapterFlags'),
      flags: novelData.chapterFlags,
      rec: novelData.batchRun ? await h.idbGet(novelData.batchRun.id) : null
    };
  }, ND);
  const recHas = !!(clean.rec && clean.rec.novelData && Object.prototype.hasOwnProperty.call(clean.rec.novelData, 'chapterFlags'));
  check('R1', 'clean run creates no chapterFlags entries (key absent)', clean.reason === 'done' && (clean.completed || []).length === 4 && clean.hasFlags === false && recHas === false, JSON.stringify({ reason: clean.reason, completed: clean.completed, hasFlags: clean.hasFlags, flags: clean.flags, recHas }));
  await page.close();
}

// ---------------- R2 packet/tracker rollback ----------------
{
  const page = await openPage();
  const s = await coverageStop(page);
  const p2 = s.packets[1];
  const p3 = s.packets[2];
  const t2 = s.tracker[1];
  check('R2', 'ch2 packet rolled back (no unaccepted ch2 text, no ch2 audit threads)', !!(p2 && JSON.stringify(p2).indexOf('KEPT-DRAFT-CH2') < 0 && JSON.stringify(p2).indexOf('smoke-thread-ch2') < 0), JSON.stringify(p2 && { chapter: p2.chapter, marker: p2.marker, prev: p2.prevChapterSummary, threads: p2.unresolvedThreads }));
  check('R2', 'ch3 packet rolled back so unaccepted ch2 text never feeds n+1', p3 && p3.marker === 'PRE-CH3' && JSON.stringify(p3).indexOf('KEPT-DRAFT-CH2') < 0, JSON.stringify(p3));
  check('R2', 'tracker entry for ch2 rolled back to pre-chapter', t2 && t2.marker === 'TRACK-PRE', JSON.stringify(t2));
  await page.close();
}

// ---------------- R3 Accept rebuilds packet/tracker ----------------
{
  const page = await openPage();
  await coverageStop(page);
  const a = await page.evaluate(async () => {
    const beforeP2 = JSON.parse(JSON.stringify((novelData.chapterContinuityPackets || [])[1] || null));
    const beforeP3 = JSON.parse(JSON.stringify((novelData.chapterContinuityPackets || [])[2] || null));
    const beforeT = JSON.parse(JSON.stringify((novelData.continuityTracker && novelData.continuityTracker.chapters || [])[1] || null));
    const ok = await nwBatchCoverageDecide('accept');
    const rec = novelData.batchRun ? await window.__h.idbGet(novelData.batchRun.id) : null;
    return {
      ok,
      beforeP2, beforeP3, beforeT,
      afterP2: JSON.parse(JSON.stringify((novelData.chapterContinuityPackets || [])[1] || null)),
      afterP3: JSON.parse(JSON.stringify((novelData.chapterContinuityPackets || [])[2] || null)),
      afterT: JSON.parse(JSON.stringify((novelData.continuityTracker && novelData.continuityTracker.chapters || [])[1] || null)),
      ack: novelData.batchRun && novelData.batchRun.coverageAck,
      completed: (novelData.batchRun && novelData.batchRun.completed) || [],
      recAck: rec && rec.batchRun && rec.batchRun.coverageAck,
      ch2: (novelData.chapters || [])[1] || ''
    };
  });
  check('R3', 'Accept returns true, persists coverageAck accept, adds ch2 to completed', a.ok === true && a.ack && a.ack.decision === 'accept' && a.ack.chapter === 2 && (a.completed || []).indexOf(2) >= 0, JSON.stringify({ ack: a.ack, completed: a.completed }));
  check('R3', 'Accept rebuilds ch2 packet from kept text', a.afterP2 && a.afterP2.chapter === 2, JSON.stringify({ before: a.beforeP2 && { chapter: a.beforeP2.chapter, marker: a.beforeP2.marker }, after: a.afterP2 && { chapter: a.afterP2.chapter, marker: a.afterP2.marker, prev: a.afterP2.prevChapterSummary } }));
  check('R3', 'Accept rebuilds ch3 packet so n+1 sees the kept ch2 text', a.beforeP3 && a.beforeP3.marker === 'PRE-CH3' && a.afterP3 && JSON.stringify(a.afterP3).indexOf('KEPT-DRAFT-CH2') >= 0, JSON.stringify({ before: a.beforeP3, after: a.afterP3 }));
  check('R3', 'Accept rebuilds tracker entry for ch2 (audit from kept text)', a.beforeT && a.beforeT.marker === 'TRACK-PRE' && a.afterT && a.afterT.chapter === 2 && a.afterT.marker !== 'TRACK-PRE', JSON.stringify({ before: a.beforeT, after: a.afterT }));
  check('R3', 'coverageAck accept is in the checkpoint', a.recAck && a.recAck.decision === 'accept' && a.recAck.chapter === 2, JSON.stringify(a.recAck));
  await page.close();
}

// ---------------- R4 skip survives checkpoint, reload, Resume ----------------
{
  const page = await openPage();
  await coverageStop(page);
  const skipped = await page.evaluate(async () => {
    const ok = await nwBatchCoverageDecide('skip');
    const rec = novelData.batchRun ? await window.__h.idbGet(novelData.batchRun.id) : null;
    const p3 = typeof buildChapterContinuityPacket === 'function' ? buildChapterContinuityPacket(3) : null;
    return {
      ok,
      ack: novelData.batchRun && novelData.batchRun.coverageAck,
      recAck: rec && rec.batchRun && rec.batchRun.coverageAck,
      recBr: rec && rec.batchRun ? { reason: rec.batchRun.reason, stoppedAt: rec.batchRun.stoppedAt, coverageAck: rec.batchRun.coverageAck } : null,
      id: novelData.batchRun && novelData.batchRun.id,
      ch2: (novelData.chapters || [])[1] || '',
      p3: p3 ? JSON.parse(JSON.stringify(p3)) : null,
      skipList: (novelData.batchRun && novelData.batchRun.continuitySkip) || [],
      recSkip: rec && rec.batchRun && rec.batchRun.continuitySkip
    };
  });
  check('R4', 'Skip persists coverageAck skip on batchRun and checkpoint', skipped.ok === true && skipped.ack && skipped.ack.decision === 'skip' && skipped.ack.chapter === 2 && skipped.recAck && skipped.recAck.decision === 'skip', JSON.stringify(skipped));
  check('R12', 'Skip with no prior: failed draft kept but excluded from later continuity packets', !!(/KEPT-DRAFT-CH2/.test(skipped.ch2 || '') && skipped.p3 && JSON.stringify(skipped.p3).indexOf('KEPT-DRAFT-CH2') < 0 && (skipped.skipList || []).indexOf(2) >= 0 && (skipped.recSkip || []).indexOf(2) >= 0), JSON.stringify({ ch2: skipped.ch2, p3: skipped.p3, skipList: skipped.skipList, recSkip: skipped.recSkip }));

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof generateAllChapters === 'function' && window.__nwBatchRestoreCheck, null, { timeout: 30000 });
  await page.evaluate(() => window.__nwBatchRestoreCheck);
  await installHarness(page);
  const resumed = await page.evaluate(async (id) => {
    const rec = await window.__h.idbGet(id);
    const apiKey = document.getElementById('apiKey').value;
    novelData = normalizeImportedSessionData({ schemaVersion: '1.0', novelData: JSON.parse(JSON.stringify(rec.novelData)) }).novelData;
    novelData.apiKey = apiKey || 'smoke-placeholder-not-a-key';
    novelData.batchRun = JSON.parse(JSON.stringify(rec.batchRun));
    applySessionDataToUI();
    nwBatchState.coverageAck = null;
    window.__h.cfg = {};
    window.__h.calls.length = 0;
    const r = await resumeBatchRun();
    return {
      r,
      calls: window.__h.calls.filter((c) => c.kind === 'draft').map((c) => c.ch),
      br: novelData.batchRun ? { reason: novelData.batchRun.reason, completed: novelData.batchRun.completed.slice(), coverageAck: novelData.batchRun.coverageAck } : null,
      ch2: (novelData.chapters || [])[1] || '',
      dialogs: window.__h.dialogs.slice()
    };
  }, skipped.id);
  check('R4', 'after reload, Resume honours skip (no confirm-coverage) and continues from ch3', resumed.r && resumed.r.started === true && resumed.r.reason !== 'confirm-coverage' && resumed.calls[0] === 3 && resumed.calls.indexOf(2) < 0, JSON.stringify({ r: resumed.r, calls: resumed.calls, br: resumed.br }));
  check('R4', 'skipped ch2 text still kept after Resume; 0 dialogs', /KEPT-DRAFT-CH2/.test(resumed.ch2) && resumed.dialogs.length === 0, JSON.stringify({ ch2: resumed.ch2, dialogs: resumed.dialogs }));
  await page.close();
}

// ---------------- R5 revise cap ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async (nd) => {
    const h = window.__h;
    h.load(nd);
    const caps = {};
    for (const target of [2000, 4000, 5000]) {
      novelData.chapterLength = target;
      document.getElementById('chapterLength').value = String(target);
      caps[target] = typeof nwReviseMaxTokens === 'function' ? nwReviseMaxTokens() : null;
    }
    novelData.chapterLength = 5000;
    document.getElementById('chapterLength').value = '5000';
    nwBatchSetChapterText(1, 'Chapter 1 existing prose for a revise-cap smoke. The relay hums.');
    const imp = document.getElementById('chapterEditImprovement1');
    if (imp) imp.value = 'Tighten the relay beat.';
    novelData.chapterImprovements[0] = 'Tighten the relay beat.';
    let seen = null;
    const orig = window.callAI;
    window.callAI = async function (messages, tab, callbackOrOptions, options) {
      const isCb = typeof callbackOrOptions === 'function';
      const opts = isCb ? (options || {}) : (callbackOrOptions || {});
      seen = opts.max_tokens;
      const resp = { chapter: 'Revised chapter for cap smoke.' };
      if (isCb) callbackOrOptions(resp);
      return resp;
    };
    try { await updateChapter(1, { requireImprovements: true, operationTag: 'qualityRevise' }); } catch (e) { seen = { error: String(e && e.message || e), seen }; }
    window.callAI = orig;
    return { caps, seen, expected5000: Math.max(6000, 2 * 5000), expected2000: Math.max(6000, 2 * 2000) };
  }, ND);
  check('R5', 'nwReviseMaxTokens(2000) = 6000 (minimum)', r.caps[2000] === 6000 && r.expected2000 === 6000, JSON.stringify(r.caps));
  check('R5', 'nwReviseMaxTokens(5000) = 10000 (2 x target)', r.caps[5000] === 10000, JSON.stringify(r.caps));
  check('R5', 'qualityRevise callAI max_tokens uses that cap', r.seen === 10000, JSON.stringify({ seen: r.seen, caps: r.caps }));
  await page.close();
}

// ---------------- R6 #139 (a) import writer lock ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async (nd) => {
    const h = window.__h;
    h.load(nd);
    let lockedDuring = false;
    let integrateP = null;
    let startP = null;
    window.__h.calls.length = 0;
    const orig = applySessionDataToUI;
    let startStatus = '';
    applySessionDataToUI = function () {
      lockedDuring = typeof nwBatchIsLocked === 'function' && nwBatchIsLocked();
      try { integrateP = Promise.resolve(integrateBreakdownSuggestions()); } catch (e) { integrateP = Promise.resolve(String(e && e.message || e)); }
      try {
        startP = Promise.resolve(generateAllChapters()).then(function (r) {
          startStatus = (document.getElementById('batchRunStatus') || {}).textContent || '';
          return r;
        });
      } catch (e) { startP = Promise.resolve(String(e && e.message || e)); }
      return orig.apply(this, arguments);
    };
    const payload = JSON.stringify({ schemaVersion: '1.0', sourceTool: 'NovelWriter', novelData: Object.assign({}, nd, { title: 'Imported Lock Book', chapters: ['x'] }) });
    const realRead = FileReader.prototype.readAsText;
    FileReader.prototype.readAsText = function (f) { const reader = this; f.text().then((t) => reader.onload({ target: { result: t } })); };
    h.dialogs.length = 0;
    importSession({ target: { files: [new File([payload], 'lock.json')], value: 'lock.json' } });
    for (let i = 0; i < 80 && document.getElementById('title').value !== 'Imported Lock Book'; i++) await new Promise((x) => setTimeout(x, 25));
    FileReader.prototype.readAsText = realRead;
    applySessionDataToUI = orig;
    const integrateDuring = integrateP ? await integrateP : null;
    const startDuring = startP ? await startP : null;
    return {
      lockedDuring,
      integrateDuring,
      startDuring,
      startCalls: window.__h.calls.slice(),
      status: startStatus,
      importingAfter: !!(nwBatchState && nwBatchState.importing),
      lockedAfter: nwBatchIsLocked(),
      title: document.getElementById('title').value
    };
  }, ND);
  check('R6', 'import-in-progress lock is held during applySessionDataToUI', r.lockedDuring === true && r.title === 'Imported Lock Book', JSON.stringify(r));
  check('R6', 'Integrate during import returns false; lock released after apply', r.integrateDuring === false && r.importingAfter === false && r.lockedAfter === false, JSON.stringify(r));
  check('R16', 'Start during pending import refuses with status and makes zero provider calls', !!(r.startDuring && r.startDuring.started === false && r.startDuring.reason === 'importing' && (r.startCalls || []).length === 0 && /locked \(importing\)/.test(r.status || '')), JSON.stringify({ startDuring: r.startDuring, calls: r.startCalls, status: r.status }));
  await page.close();
}

// ---------------- R7 #139 (b) stoppedAt before checkpoint (regression, no code change) ----------------
{
  const page = await openPage();
  const s = await coverageStop(page);
  check('R7', 'coverage stop writes stoppedAt/reason/detail before the checkpoint (record has them)', !!(s.recBr && s.recBr.stoppedAt === 2 && s.recBr.reason === 'coverage' && s.recBr.detail), JSON.stringify(s.recBr));
  check('R7', 'in-memory batchRun matches the checkpointed stop fields', s.br && s.br.stoppedAt === 2 && s.br.reason === 'coverage' && s.recBr && s.recBr.stoppedAt === s.br.stoppedAt && s.recBr.reason === s.br.reason, JSON.stringify({ br: s.br, rec: s.recBr }));
  await page.close();
}

// ---------------- R7 #139 (b) inactive final checkpoint write fails; restore preceding active ----------------
{
  const page = await openPage();
  const s = await page.evaluate(async (nd) => {
    const h = window.__h;
    h.load(nd);
    h.seedContinuity();
    h.cfg = { coverageFail: 2 };
    const orig = nwBatchCheckpoint;
    nwBatchCheckpoint = function (active) {
      if (active === false) return Promise.reject(new Error('smoke: inactive checkpoint write fail'));
      return orig.apply(this, arguments);
    };
    let r;
    try {
      r = await generateAllChapters();
    } finally {
      nwBatchCheckpoint = orig;
    }
    const rec = novelData.batchRun ? await h.idbGet(novelData.batchRun.id) : null;
    nwBatchState.interrupted = rec;
    const restoredOk = rec ? await restoreInterruptedBatchRun() : false;
    const box = document.getElementById('batchCoverageBox');
    const acceptBtn = document.getElementById('batchCoverageAcceptBtn');
    return {
      r,
      recActive: rec ? rec.active : null,
      recBr: rec && rec.batchRun ? JSON.parse(JSON.stringify(rec.batchRun)) : null,
      restoredOk,
      restoredBr: novelData.batchRun ? JSON.parse(JSON.stringify({
        stoppedAt: novelData.batchRun.stoppedAt,
        reason: novelData.batchRun.reason,
        detail: novelData.batchRun.detail,
        coverageAck: novelData.batchRun.coverageAck
      })) : null,
      coverageBox: box ? !box.hidden : null,
      acceptDisabled: acceptBtn ? !!acceptBtn.disabled : null,
      status: (document.getElementById('batchRunStatus') || {}).textContent || ''
    };
  }, ND);
  check('R7', 'inactive checkpoint write fail: preceding active record still has stop fields', !!(s.recActive === true && s.recBr && s.recBr.stoppedAt === 2 && s.recBr.reason === 'coverage' && s.recBr.detail), JSON.stringify({ recActive: s.recActive, recBr: s.recBr, r: s.r }));
  check('R7', 'reload/restore from that active checkpoint keeps stoppedAt', !!(s.restoredOk === true && s.restoredBr && s.restoredBr.stoppedAt === 2), JSON.stringify({ restoredOk: s.restoredOk, restoredBr: s.restoredBr }));
  check('R15', 'restore of coverage stop keeps reason coverage and saved coverageAck; decision box shows again', !!(s.restoredOk === true && s.restoredBr && s.restoredBr.reason === 'coverage' && s.restoredBr.stoppedAt === 2 && s.restoredBr.coverageAck == null && s.coverageBox === true && /coverage/.test(s.status || '') && !/stopped at ch2, user/.test(s.status || '')), JSON.stringify({ restoredBr: s.restoredBr, box: s.coverageBox, status: s.status }));
  await page.close();
}

// ---------------- R8 #139 (c) forget-run toast on delete fail ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async () => {
    const h = window.__h;
    h.toasts.length = 0;
    const orig = nwBatchIdbDelete;
    nwBatchIdbDelete = function () { return Promise.reject(new Error('smoke delete fail')); };
    await nwBatchForgetRun('smoke-prior-run');
    nwBatchIdbDelete = orig;
    const toast = document.getElementById('nwToast');
    return {
      toasts: h.toasts.slice(),
      toastText: toast ? toast.textContent : '',
      toastShown: toast ? !toast.hidden : false
    };
  });
  check('R8', 'failed nwBatchIdbDelete shows a non-blocking nwToast (not only console.warn)', r.toastShown && /Could not delete the previous batch checkpoint/.test(r.toastText || r.toasts.join(' ')), JSON.stringify(r));
  await page.close();
}

// ---------------- R9 chapterFlags import pass-through + checkpoint restore ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async (nd) => {
    const warns = [];
    const orig = console.warn;
    console.warn = function () {
      warns.push(Array.from(arguments).map(String).join(' '));
      return orig.apply(console, arguments);
    };
    const base = JSON.parse(JSON.stringify(nd));
    delete base.chapterFlags;
    const absent = normalizeImportedSessionData({ schemaVersion: '1.0', novelData: base });
    const wrong = normalizeImportedSessionData({ schemaVersion: '1.0', novelData: Object.assign({}, base, { chapterFlags: 'not-an-array' }) });
    const flagObj = { coverageFailed: false, missing: ['kept-miss'], at: 12345, extraKey: 'keep-me', replay: true };
    const withUnknown = normalizeImportedSessionData({
      schemaVersion: '1.0',
      novelData: Object.assign({}, base, { chapterFlags: [null, flagObj, 'skip-me'] })
    });
    novelData = JSON.parse(JSON.stringify(withUnknown.novelData));
    novelData.apiKey = 'smoke-placeholder-not-a-key';
    novelData.batchRun = {
      id: 'flags-rt|2026-10-10T00:00:00.000Z',
      startedAt: '2026-10-10T00:00:00.000Z',
      updatedAt: '2026-10-10T00:00:00.000Z',
      range: { from: 1, to: 4 },
      regenerateExisting: false,
      perChapterDownload: false,
      completed: [],
      inFlight: null,
      stoppedAt: null,
      reason: 'paused',
      detail: 'smoke flags round-trip',
      tokensUsed: 0,
      estimate: { perChapter: 1, total: 4, source: 'fallback' },
      cap: 10,
      usageEstimated: []
    };
    await nwBatchCheckpoint(false);
    const rec = await window.__h.idbGet(novelData.batchRun.id);
    const restored = normalizeImportedSessionData({ schemaVersion: '1.0', novelData: JSON.parse(JSON.stringify(rec.novelData)) });
    console.warn = orig;
    return {
      absentHas: Object.prototype.hasOwnProperty.call(absent.novelData, 'chapterFlags'),
      wrongType: wrong.novelData.chapterFlags,
      warns: warns.slice(),
      imported: withUnknown.novelData.chapterFlags,
      restored: restored.novelData.chapterFlags,
      recFlags: rec && rec.novelData ? rec.novelData.chapterFlags : null
    };
  }, ND);
  const fImp = (r.imported || [])[1] || {};
  const fRest = (r.restored || [])[1] || {};
  const fRec = (r.recFlags || [])[1] || {};
  check('R9', 'absent chapterFlags stays absent (do not create [])', r.absentHas === false, JSON.stringify({ absentHas: r.absentHas }));
  check('R9', 'wrong-type chapterFlags kept as-is with console.warn', r.wrongType === 'not-an-array' && (r.warns || []).some((w) => /chapterFlags is not an array/.test(w)), JSON.stringify({ wrongType: r.wrongType, warns: r.warns }));
  check('R9', 'object entry passes through whole (unknown key, coverageFailed:false, non-string at, replay)', fImp.extraKey === 'keep-me' && fImp.coverageFailed === false && fImp.at === 12345 && eq(fImp.missing, ['kept-miss']) && fImp.replay === true && !Object.prototype.hasOwnProperty.call(fImp, 'replayFail') && (r.imported || [])[0] === null && (r.imported || [])[2] === null, JSON.stringify(r.imported));
  check('R9', 'unknown key round-trips through import AND checkpoint restore', fImp.extraKey === 'keep-me' && fRec.extraKey === 'keep-me' && fRest.extraKey === 'keep-me' && fRest.coverageFailed === false && fRest.at === 12345, JSON.stringify({ imported: fImp, rec: fRec, restored: fRest }));
  await page.close();
}

// ---------------- R10 fail then pass: flag clears and is not rendered ----------------
{
  const page = await openPage();
  const s = await coverageStop(page);
  check('R10', 'after fail: coverageFailed===true and Tab 5/6 render the flag', !!(s.flag && s.flag.coverageFailed === true && /Coverage failed/.test(s.flagDomGen) && s.flagHiddenGen === false && s.flagDomEdit === s.flagDomGen), JSON.stringify({ flag: s.flag, gen: s.flagDomGen, hidden: s.flagHiddenGen }));
  const pass = await page.evaluate(async () => {
    const ok = await nwBatchCoverageDecide('regenerate');
    window.__h.cfg = {};
    const r = await resumeBatchRun();
    const flag = (novelData.chapterFlags || [])[1];
    const elG = document.getElementById('chapterGenFlag2');
    const elE = document.getElementById('chapterEditFlag2');
    return {
      ok, r,
      flag,
      genText: elG ? elG.textContent : '',
      genHidden: elG ? !!elG.hidden : null,
      editText: elE ? elE.textContent : '',
      editHidden: elE ? !!elE.hidden : null,
      ch2: (novelData.chapters || [])[1] || '',
      completed: (novelData.batchRun && novelData.batchRun.completed) || [],
      reason: novelData.batchRun && novelData.batchRun.reason
    };
  });
  check('R10', 'after pass: merge {coverageFailed:false, missing:[], at:ISO} and Tab 5/6 do not render', !!(pass.flag && pass.flag.coverageFailed === false && eq(pass.flag.missing, []) && typeof pass.flag.at === 'string' && pass.flag.at && pass.genHidden === true && !/Coverage failed/.test(pass.genText || '') && pass.editHidden === true && pass.editText === pass.genText), JSON.stringify(pass));
  await page.close();
}

async function runPre6bNoFlags(page, raw) {
  return page.evaluate(async (session) => {
    const has = (nd) => !!(nd && Object.prototype.hasOwnProperty.call(nd, 'chapterFlags'));
    const loaded = normalizeImportedSessionData(session);
    novelData = loaded.novelData;
    novelData.apiKey = 'smoke-placeholder-not-a-key';
    applySessionDataToUI();
    const afterLoad = has(novelData);
    document.getElementById('title').value = 'WAITING-IMPORT';
    novelData.title = 'WAITING-IMPORT';
    const payload = JSON.stringify(session);
    const realRead = FileReader.prototype.readAsText;
    FileReader.prototype.readAsText = function (f) {
      const reader = this;
      f.text().then((t) => reader.onload({ target: { result: t } }));
    };
    importSession({ target: { files: [new File([payload], 'pre6b.json')], value: 'pre6b.json' } });
    for (let i = 0; i < 80 && (document.getElementById('title').value !== 'Pre-6b No Flags' || !!(nwBatchState && nwBatchState.importing)); i++) await new Promise((x) => setTimeout(x, 25));
    FileReader.prototype.readAsText = realRead;
    const afterImport = has(novelData);
    novelData.batchRun = {
      id: 'pre6b-rt|2026-10-10T00:00:00.000Z',
      startedAt: '2026-10-10T00:00:00.000Z',
      updatedAt: '2026-10-10T00:00:00.000Z',
      range: { from: 1, to: 2 },
      regenerateExisting: false,
      perChapterDownload: false,
      completed: [],
      inFlight: null,
      stoppedAt: 1,
      reason: 'paused',
      detail: 'pre6b',
      tokensUsed: 0,
      estimate: { perChapter: 1, total: 2, source: 'fallback' },
      cap: 10,
      usageEstimated: []
    };
    await nwBatchCheckpoint(true);
    const rec = await window.__h.idbGet(novelData.batchRun.id);
    const recHas = !!(rec && rec.novelData && has(rec.novelData));
    nwBatchState.interrupted = rec;
    const restoredOk = rec ? await restoreInterruptedBatchRun() : false;
    const afterRestore = has(novelData);
    return {
      afterLoad,
      afterImport,
      recHas,
      afterRestore,
      restoredOk,
      title: document.getElementById('title').value,
      flagsType: !has(novelData) ? 'absent' : (Array.isArray(novelData.chapterFlags) ? 'array:' + novelData.chapterFlags.length : typeof novelData.chapterFlags)
    };
  }, raw);
}

// ---------------- R11 v0-pre6b-no-flags: no chapterFlags after load/import/restore ----------------
{
  check('R11', 'fixture v0-pre6b-no-flags has no chapterFlags key', !!(PRE6B && PRE6B.novelData && !Object.prototype.hasOwnProperty.call(PRE6B.novelData, 'chapterFlags')), JSON.stringify({ keys: PRE6B && PRE6B.novelData ? Object.keys(PRE6B.novelData) : null }));
  const page = await openPage();
  const r = await runPre6bNoFlags(page, PRE6B);
  const absent = r.afterLoad === false && r.afterImport === false && r.recHas === false && r.afterRestore === false;
  check('R11', 'after load/import/checkpoint-restore, novelData has NO chapterFlags key', absent && r.title === 'Pre-6b No Flags' && r.restoredOk === true, JSON.stringify(r));
  await page.close();
}

// ---------------- R13 coverage decide in-progress guard (double-click) ----------------
{
  const page = await openPage();
  await coverageStop(page);
  const d = await page.evaluate(async () => {
    const h = window.__h;
    h.cfg = { auditDelayMs: 150 };
    h.calls.length = 0;
    let ck = 0;
    const origCk = nwBatchCheckpoint;
    nwBatchCheckpoint = function () { ck += 1; return origCk.apply(this, arguments); };
    const p1 = nwBatchCoverageDecide('accept');
    await new Promise((r) => setTimeout(r, 30));
    const mid = {
      acceptDisabled: !!(document.getElementById('batchCoverageAcceptBtn') || {}).disabled,
      skipDisabled: !!(document.getElementById('batchCoverageSkipBtn') || {}).disabled,
      regenDisabled: !!(document.getElementById('batchCoverageRegenerateBtn') || {}).disabled,
      owner: !!(nwBatchState && nwBatchState.coverageDecideOwner)
    };
    const second = await nwBatchCoverageDecide('accept');
    const first = await p1;
    nwBatchCheckpoint = origCk;
    return {
      first,
      second,
      mid,
      audits: h.calls.filter((c) => c.kind === 'audit').length,
      ck,
      ack: novelData.batchRun && novelData.batchRun.coverageAck,
      completed: (novelData.batchRun && novelData.batchRun.completed) || []
    };
  });
  check('R13', 'coverage decide in-progress disables Accept/Skip/Regenerate', !!(d.mid && d.mid.acceptDisabled && d.mid.skipDisabled && d.mid.regenDisabled && d.mid.owner), JSON.stringify(d.mid));
  check('R13', 'double-click Accept: second call is refused; one audit and one coverage checkpoint', !!(d.first === true && d.second === false && d.audits === 1 && d.ck === 1 && d.ack && d.ack.decision === 'accept' && (d.completed || []).indexOf(2) >= 0), JSON.stringify(d));
  await page.close();
}

// ---------------- R14 Accept aborts when continuity audit fails ----------------
{
  const page = await openPage();
  const OLD2 = 'Hand-written chapter two ORIGINAL prior text kept while accept is pending.';
  await coverageStop(page, { nd: ND, regenerate: true, prefill: { 2: OLD2 } });
  const a = await page.evaluate(async () => {
    window.__h.cfg = { auditFail: true };
    const before = {
      completed: ((novelData.batchRun && novelData.batchRun.completed) || []).slice(),
      ack: novelData.batchRun && novelData.batchRun.coverageAck,
      prior: novelData.batchRun && novelData.batchRun.priorDrafts ? JSON.parse(JSON.stringify(novelData.batchRun.priorDrafts[1] || null)) : null,
      reason: novelData.batchRun && novelData.batchRun.reason,
      stoppedAt: novelData.batchRun && novelData.batchRun.stoppedAt
    };
    const recBefore = novelData.batchRun ? await window.__h.idbGet(novelData.batchRun.id) : null;
    const ok = await nwBatchCoverageDecide('accept');
    const recAfter = novelData.batchRun ? await window.__h.idbGet(novelData.batchRun.id) : null;
    const box = document.getElementById('batchCoverageBox');
    return {
      ok,
      before,
      after: {
        completed: ((novelData.batchRun && novelData.batchRun.completed) || []).slice(),
        ack: novelData.batchRun && novelData.batchRun.coverageAck,
        prior: novelData.batchRun && novelData.batchRun.priorDrafts ? JSON.parse(JSON.stringify(novelData.batchRun.priorDrafts[1] || null)) : null,
        reason: novelData.batchRun && novelData.batchRun.reason,
        stoppedAt: novelData.batchRun && novelData.batchRun.stoppedAt
      },
      recAckAfter: recAfter && recAfter.batchRun && recAfter.batchRun.coverageAck,
      recAckBefore: recBefore && recBefore.batchRun && recBefore.batchRun.coverageAck,
      box: box ? !box.hidden : null,
      status: (document.getElementById('batchRunStatus') || {}).textContent || ''
    };
  });
  const pending = a.ok === false
    && JSON.stringify(a.after.completed) === JSON.stringify(a.before.completed)
    && (a.after.completed || []).indexOf(2) < 0
    && !a.after.ack
    && a.after.prior && a.after.prior.text === OLD2
    && a.after.reason === 'coverage'
    && a.after.stoppedAt === 2
    && !a.recAckAfter
    && a.box === true
    && /Decision still pending/.test(a.status || '');
  check('R14', 'Accept with failing audit does not complete/clear prior/checkpoint ack; decision stays pending', pending, JSON.stringify(a));
  const retry = await page.evaluate(async () => {
    window.__h.cfg = {};
    const ok = await nwBatchCoverageDecide('accept');
    return {
      ok,
      ack: novelData.batchRun && novelData.batchRun.coverageAck,
      completed: (novelData.batchRun && novelData.batchRun.completed) || [],
      prior: novelData.batchRun && novelData.batchRun.priorDrafts ? novelData.batchRun.priorDrafts[1] : null
    };
  });
  check('R14', 'Accept retry after audit works (decision was left pending)', !!(retry.ok === true && retry.ack && retry.ack.decision === 'accept' && (retry.completed || []).indexOf(2) >= 0 && !retry.prior), JSON.stringify(retry));
  await page.close();
}

// ---------------- R17 last planned chapter Accept/Skip finalizes (no Click Resume) ----------------
{
  const page = await openPage();
  await coverageStop(page, { nd: ND, to: 2, coverageFail: 2 });
  const acc = await page.evaluate(async () => {
    const ok = await nwBatchCoverageDecide('accept');
    const resume = document.getElementById('batchResumeBtn');
    return {
      ok,
      reason: novelData.batchRun && novelData.batchRun.reason,
      stoppedAt: novelData.batchRun && novelData.batchRun.stoppedAt,
      completed: (novelData.batchRun && novelData.batchRun.completed) || [],
      status: (document.getElementById('batchRunStatus') || {}).textContent || '',
      resumeDisabled: resume ? !!resume.disabled : null,
      box: !document.getElementById('batchCoverageBox').hidden
    };
  });
  check('R17', 'Accept on last planned chapter finalizes: reason done, no Click Resume', !!(acc.ok === true && acc.reason === 'done' && acc.stoppedAt == null && (acc.completed || []).indexOf(2) >= 0 && /Coverage accept recorded for ch2/.test(acc.status || '') && !/Click Resume/.test(acc.status || '') && acc.resumeDisabled === true && acc.box === false), JSON.stringify(acc));
  await page.close();
  const page2 = await openPage();
  await coverageStop(page2, { nd: ND, to: 2, coverageFail: 2 });
  const sk = await page2.evaluate(async () => {
    const ok = await nwBatchCoverageDecide('skip');
    const resume = document.getElementById('batchResumeBtn');
    return {
      ok,
      reason: novelData.batchRun && novelData.batchRun.reason,
      stoppedAt: novelData.batchRun && novelData.batchRun.stoppedAt,
      completed: (novelData.batchRun && novelData.batchRun.completed) || [],
      status: (document.getElementById('batchRunStatus') || {}).textContent || '',
      resumeDisabled: resume ? !!resume.disabled : null
    };
  });
  check('R17', 'Skip on last planned chapter finalizes: reason done, no Click Resume', !!(sk.ok === true && sk.reason === 'done' && sk.stoppedAt == null && (sk.completed || []).indexOf(2) < 0 && /Coverage skip recorded for ch2/.test(sk.status || '') && !/Click Resume/.test(sk.status || '') && sk.resumeDisabled === true), JSON.stringify(sk));
  await page2.close();
}

// ---------------- Mutations ----------------
{
  const m3 = mutateCopy(FLAGS.packet);
  check('M3', 'flag NW_6B_PACKET_ROLLBACK present', m3.ok, m3.detail);
  if (m3.ok) {
    const page = await openPage(m3.copy);
    const s = await coverageStop(page);
    const rolled = s.packets[2] && s.packets[2].marker === 'PRE-CH3' && JSON.stringify(s.packets[2]).indexOf('KEPT-DRAFT-CH2') < 0 && s.tracker[1] && s.tracker[1].marker === 'TRACK-PRE';
    check('M3', 'dropping packet rollback turns R2 red', rolled === false, JSON.stringify({ packets: s.packets.slice(1, 3), tracker: s.tracker[1] }));
    await page.close();
    try { fs.rmSync(m3.dir, { recursive: true, force: true }); } catch (_) { /* temp */ }
  }
  const m4 = mutateCopy(FLAGS.ack);
  check('M4', 'flag NW_6B_CHECKPOINT_COVERAGE_ACK present', m4.ok, m4.detail);
  if (m4.ok) {
    const page = await openPage(m4.copy);
    await coverageStop(page);
    const skipped = await page.evaluate(async () => {
      await nwBatchCoverageDecide('skip');
      const rec = novelData.batchRun ? await window.__h.idbGet(novelData.batchRun.id) : null;
      return { recAck: rec && rec.batchRun && rec.batchRun.coverageAck, memAck: novelData.batchRun && novelData.batchRun.coverageAck };
    });
    check('M4', 'dropping coverageAck from checkpoint turns R4 red', !skipped.recAck && !!(skipped.memAck && skipped.memAck.decision === 'skip'), JSON.stringify(skipped));
    await page.close();
    try { fs.rmSync(m4.dir, { recursive: true, force: true }); } catch (_) { /* temp */ }
  }
  const m5 = mutateCopy(FLAGS.stopped);
  check('M5', 'flag NW_6B_STOPPEDAT_BEFORE_CHECKPOINT present', m5.ok, m5.detail);
  if (m5.ok) {
    const page = await openPage(m5.copy);
    const s = await coverageStop(page);
    const inRec = s.recBr && s.recBr.stoppedAt === 2 && s.recBr.reason === 'coverage';
    check('M5', 'moving stoppedAt after the checkpoint write turns R7 red', inRec === false, JSON.stringify({ recBr: s.recBr, br: s.br && { stoppedAt: s.br.stoppedAt, reason: s.br.reason } }));
    await page.close();
    try { fs.rmSync(m5.dir, { recursive: true, force: true }); } catch (_) { /* temp */ }
  }
  const m6 = mutateCopy(FLAGS.passthrough);
  check('M6', 'flag NW_6B_FLAGS_PASSTHROUGH present', m6.ok, m6.detail);
  if (m6.ok) {
    const page = await openPage(m6.copy);
    const r = await page.evaluate(async (nd) => {
      const base = JSON.parse(JSON.stringify(nd));
      delete base.chapterFlags;
      const withUnknown = normalizeImportedSessionData({
        schemaVersion: '1.0',
        novelData: Object.assign({}, base, { chapterFlags: [{ coverageFailed: false, extraKey: 'keep-me', at: 12345 }] })
      });
      novelData = JSON.parse(JSON.stringify(withUnknown.novelData));
      novelData.apiKey = 'smoke-placeholder-not-a-key';
      novelData.batchRun = {
        id: 'flags-m6|2026-10-10T00:00:00.000Z',
        startedAt: '2026-10-10T00:00:00.000Z',
        updatedAt: '2026-10-10T00:00:00.000Z',
        range: { from: 1, to: 4 },
        regenerateExisting: false,
        perChapterDownload: false,
        completed: [],
        inFlight: null,
        stoppedAt: null,
        reason: 'paused',
        detail: 'm6',
        tokensUsed: 0,
        estimate: { perChapter: 1, total: 4, source: 'fallback' },
        cap: 10,
        usageEstimated: []
      };
      await nwBatchCheckpoint(false);
      const rec = await window.__h.idbGet(novelData.batchRun.id);
      const restored = normalizeImportedSessionData({ schemaVersion: '1.0', novelData: JSON.parse(JSON.stringify(rec.novelData)) });
      return {
        imported: (withUnknown.novelData.chapterFlags || [])[0] || null,
        restored: (restored.novelData.chapterFlags || [])[0] || null
      };
    }, ND);
    const kept = !!(r.imported && r.imported.extraKey === 'keep-me' && r.restored && r.restored.extraKey === 'keep-me');
    check('M6', 'dropping FLAGS_PASSTHROUGH strips unknown key (R9 red)', kept === false, JSON.stringify(r));
    await page.close();
    try { fs.rmSync(m6.dir, { recursive: true, force: true }); } catch (_) { /* temp */ }
  }
  const m7 = mutateCopy(FLAGS.clearOnPass);
  check('M7', 'flag NW_6B_CLEAR_FLAG_ON_PASS present', m7.ok, m7.detail);
  if (m7.ok) {
    const page = await openPage(m7.copy);
    await coverageStop(page);
    const pass = await page.evaluate(async () => {
      await nwBatchCoverageDecide('regenerate');
      window.__h.cfg = {};
      await resumeBatchRun();
      const flag = (novelData.chapterFlags || [])[1];
      const elG = document.getElementById('chapterGenFlag2');
      return {
        coverageFailed: flag && flag.coverageFailed,
        genText: elG ? elG.textContent : '',
        genHidden: elG ? !!elG.hidden : null
      };
    });
    const cleared = pass.coverageFailed === false && pass.genHidden === true && !/Coverage failed/.test(pass.genText || '');
    check('M7', 'dropping CLEAR_FLAG_ON_PASS leaves fail flag rendered (R10 red)', cleared === false, JSON.stringify(pass));
    await page.close();
    try { fs.rmSync(m7.dir, { recursive: true, force: true }); } catch (_) { /* temp */ }
  }
  const m8 = mutateCopy(FLAGS.keepNewDraft);
  check('M8', 'flag NW_6B_KEEP_NEW_DRAFT_BOTH_MODES present', m8.ok, m8.detail);
  if (m8.ok) {
    const page = await openPage(m8.copy);
    const OLD2 = 'Hand-written chapter two that must not remain after a coverage failure.';
    const s = await coverageStop(page, { nd: ND, regenerate: true, prefill: { 2: OLD2 } });
    const keptNew = /^Chapter 2 part 1/.test(s.chapters[1] || '') && /KEPT-DRAFT-CH2/.test(s.chapters[1] || '') && s.chapters[1] !== OLD2;
    check('M8', 'dropping KEEP_NEW_DRAFT_BOTH_MODES restores old text on regenerate-on (R1 regen red)', keptNew === false, JSON.stringify({ ch2: s.chapters[1], old: OLD2, rejectedDraft: s.br && s.br.rejectedDraft }));
    await page.close();
    try { fs.rmSync(m8.dir, { recursive: true, force: true }); } catch (_) { /* temp */ }
  }
  const m9 = mutateCopy(FLAGS.lazyFlags);
  check('M9', 'flag NW_6B_LAZY_CHAPTER_FLAGS present', m9.ok, m9.detail);
  if (m9.ok) {
    const page = await openPage(m9.copy);
    const r = await runPre6bNoFlags(page, PRE6B);
    const absent = r.afterLoad === false && r.afterImport === false && r.recHas === false && r.afterRestore === false;
    check('M9', 'default-fill on load turns R11 red (chapterFlags created without a write)', absent === false, JSON.stringify(r));
    await page.close();
    try { fs.rmSync(m9.dir, { recursive: true, force: true }); } catch (_) { /* temp */ }
  }
  const m10 = mutateCopy(FLAGS.priorWriteOnce);
  check('M10', 'flag NW_6B_PRIOR_DRAFT_WRITE_ONCE present', m10.ok, m10.detail);
  if (m10.ok) {
    const page = await openPage(m10.copy);
    const OLD2 = 'Hand-written chapter two ORIGINAL prior text that must survive two coverage failures.';
    await coverageStop(page, { nd: ND, regenerate: true, prefill: { 2: OLD2 } });
    const s2 = await page.evaluate(async () => {
      await nwBatchCoverageDecide('regenerate');
      window.__h.cfg = { coverageFail: 2 };
      await resumeBatchRun();
      const prior = novelData.batchRun && novelData.batchRun.priorDrafts ? novelData.batchRun.priorDrafts[1] : null;
      return { prior, ch2: (novelData.chapters || [])[1] || '' };
    });
    const originalSurvives = !!(s2.prior && s2.prior.text === OLD2);
    check('M10', 'overwriting priorDraft on 2nd failure turns two-fail original-survives red', originalSurvives === false, JSON.stringify(s2));
    await page.close();
    try { fs.rmSync(m10.dir, { recursive: true, force: true }); } catch (_) { /* temp */ }
  }
  const m11 = mutateCopy(FLAGS.clearOnlyIfFailed);
  check('M11', 'flag NW_6B_CLEAR_FLAG_ONLY_IF_FAILED present', m11.ok, m11.detail);
  if (m11.ok) {
    const page = await openPage(m11.copy);
    const clean = await page.evaluate(async (nd) => {
      const h = window.__h;
      h.load(nd);
      delete novelData.chapterFlags;
      h.cfg = {};
      await generateAllChapters();
      return {
        reason: novelData.batchRun && novelData.batchRun.reason,
        hasFlags: Object.prototype.hasOwnProperty.call(novelData, 'chapterFlags'),
        flags: novelData.chapterFlags
      };
    }, ND);
    const absent = clean.hasFlags === false;
    check('M11', 'unconditional clear-on-pass turns clean-run no-chapterFlags red', absent === false, JSON.stringify(clean));
    await page.close();
    try { fs.rmSync(m11.dir, { recursive: true, force: true }); } catch (_) { /* temp */ }
  }
  const m12 = mutateCopy(FLAGS.skipExclude);
  check('M12', 'flag NW_6B_SKIP_EXCLUDE_CONTINUITY present', m12.ok, m12.detail);
  if (m12.ok) {
    const page = await openPage(m12.copy);
    await coverageStop(page);
    const skipped = await page.evaluate(async () => {
      await nwBatchCoverageDecide('skip');
      const p3 = typeof buildChapterContinuityPacket === 'function' ? buildChapterContinuityPacket(3) : null;
      return { ch2: (novelData.chapters || [])[1] || '', p3, skipList: (novelData.batchRun && novelData.batchRun.continuitySkip) || [] };
    });
    const excluded = /KEPT-DRAFT-CH2/.test(skipped.ch2 || '') && skipped.p3 && JSON.stringify(skipped.p3).indexOf('KEPT-DRAFT-CH2') < 0;
    check('M12', 'dropping SKIP_EXCLUDE_CONTINUITY feeds skipped failed draft into later packets (R12 red)', excluded === false, JSON.stringify(skipped));
    await page.close();
    try { fs.rmSync(m12.dir, { recursive: true, force: true }); } catch (_) { /* temp */ }
  }
  const m13 = mutateCopy(FLAGS.decideGuard);
  check('M13', 'flag NW_6B_COVERAGE_DECIDE_GUARD present', m13.ok, m13.detail);
  if (m13.ok) {
    const page = await openPage(m13.copy);
    await coverageStop(page);
    const d = await page.evaluate(async () => {
      const h = window.__h;
      h.cfg = { auditDelayMs: 150 };
      h.calls.length = 0;
      let ck = 0;
      const origCk = nwBatchCheckpoint;
      nwBatchCheckpoint = function () { ck += 1; return origCk.apply(this, arguments); };
      const p1 = nwBatchCoverageDecide('accept');
      await new Promise((r) => setTimeout(r, 30));
      const second = await nwBatchCoverageDecide('accept');
      const first = await p1;
      nwBatchCheckpoint = origCk;
      return { first, second, audits: h.calls.filter((c) => c.kind === 'audit').length, ck };
    });
    const guarded = d.first === true && d.second === false && d.audits === 1 && d.ck === 1;
    check('M13', 'dropping COVERAGE_DECIDE_GUARD allows double Accept (R13 red)', guarded === false, JSON.stringify(d));
    await page.close();
    try { fs.rmSync(m13.dir, { recursive: true, force: true }); } catch (_) { /* temp */ }
  }
  const m14 = mutateCopy(FLAGS.acceptAudit);
  check('M14', 'flag NW_6B_ACCEPT_AUDIT_ABORT present', m14.ok, m14.detail);
  if (m14.ok) {
    const page = await openPage(m14.copy);
    const OLD2 = 'Hand-written chapter two ORIGINAL prior text kept while accept is pending.';
    await coverageStop(page, { nd: ND, regenerate: true, prefill: { 2: OLD2 } });
    const a = await page.evaluate(async () => {
      window.__h.cfg = { auditFail: true };
      const ok = await nwBatchCoverageDecide('accept');
      return {
        ok,
        completed: (novelData.batchRun && novelData.batchRun.completed) || [],
        ack: novelData.batchRun && novelData.batchRun.coverageAck,
        prior: novelData.batchRun && novelData.batchRun.priorDrafts ? novelData.batchRun.priorDrafts[1] : null
      };
    });
    const aborted = a.ok === false && (a.completed || []).indexOf(2) < 0 && !a.ack && a.prior && a.prior.text === OLD2;
    check('M14', 'dropping ACCEPT_AUDIT_ABORT still accepts after audit fail (R14 red)', aborted === false, JSON.stringify(a));
    await page.close();
    try { fs.rmSync(m14.dir, { recursive: true, force: true }); } catch (_) { /* temp */ }
  }
  const m15 = mutateCopy(FLAGS.restoreCoverage);
  check('M15', 'flag NW_6B_RESTORE_KEEP_COVERAGE present', m15.ok, m15.detail);
  if (m15.ok) {
    const page = await openPage(m15.copy);
    const s = await page.evaluate(async (nd) => {
      const h = window.__h;
      h.load(nd);
      h.seedContinuity();
      h.cfg = { coverageFail: 2 };
      const orig = nwBatchCheckpoint;
      nwBatchCheckpoint = function (active) {
        if (active === false) return Promise.reject(new Error('smoke: inactive checkpoint write fail'));
        return orig.apply(this, arguments);
      };
      try { await generateAllChapters(); } finally { nwBatchCheckpoint = orig; }
      const rec = novelData.batchRun ? await h.idbGet(novelData.batchRun.id) : null;
      nwBatchState.interrupted = rec;
      const restoredOk = rec ? await restoreInterruptedBatchRun() : false;
      const box = document.getElementById('batchCoverageBox');
      return {
        restoredOk,
        reason: novelData.batchRun && novelData.batchRun.reason,
        coverageBox: box ? !box.hidden : null
      };
    }, ND);
    const kept = s.restoredOk === true && s.reason === 'coverage' && s.coverageBox === true;
    check('M15', 'dropping RESTORE_KEEP_COVERAGE forces reason user (R15 red)', kept === false, JSON.stringify(s));
    await page.close();
    try { fs.rmSync(m15.dir, { recursive: true, force: true }); } catch (_) { /* temp */ }
  }
  const m16 = mutateCopy(FLAGS.startLock);
  check('M16', 'flag NW_6B_START_REFUSES_LOCK present', m16.ok, m16.detail);
  if (m16.ok) {
    const page = await openPage(m16.copy);
    const r = await page.evaluate(async (nd) => {
      const h = window.__h;
      h.load(nd);
      h.calls.length = 0;
      nwBatchState.importing = true;
      const start = await generateAllChapters();
      nwBatchState.importing = false;
      return { start, calls: h.calls.slice(), status: (document.getElementById('batchRunStatus') || {}).textContent || '' };
    }, ND);
    const refused = r.start && r.start.started === false && r.start.reason === 'importing' && (r.calls || []).length === 0;
    check('M16', 'dropping START_REFUSES_LOCK lets Start run during import (R16 red)', refused === false, JSON.stringify(r));
    await page.close();
    try { fs.rmSync(m16.dir, { recursive: true, force: true }); } catch (_) { /* temp */ }
  }
}

check('ALL', 'no unexpected page errors', pageErrors.length === 0, pageErrors.slice(0, 5).join(' | '));
check('ALL', 'no live provider calls (api.x.ai aborted / unused)', networkSeen.filter((u) => /api\.x\.ai/i.test(u)).length === 0, networkSeen.slice(0, 5).join(' | '));
await browser.close();

fs.mkdirSync(OUT_DIR, { recursive: true });
const failed = checks.filter((c) => !c.ok);
fs.writeFileSync(path.join(OUT_DIR, 'SMOKE_NW_RETENTION.json'), JSON.stringify({ ok: !failed.length, passed: checks.length - failed.length, total: checks.length, checks }, null, 2));
for (const c of checks) process.stdout.write((c.ok ? 'PASS ' : 'FAIL ') + '[' + c.id + '] ' + c.name + (c.ok ? '' : ' :: ' + c.detail) + '\n');
process.stdout.write('\nNW RETENTION SMOKE: ' + (failed.length ? 'FAIL' : 'PASS') + ' (' + (checks.length - failed.length) + '/' + checks.length + ')\n');
process.exit(failed.length ? 1 : 0);
