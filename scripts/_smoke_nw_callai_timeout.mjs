/**
 * Offline smoke for NovelWriter slot 8b: callAI timeout, abort cleanup, timing records, Score-all lock.
 * No network, no API key. Real callAI over a stubbed window.fetch (or a hang). Mutations copy HTML into os.tmpdir().
 *
 *   node scripts/_smoke_nw_callai_timeout.mjs
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const HTML_PATH = path.resolve(process.env.NW_HTML_PATH || path.join(REPO_ROOT, 'NovelWriter', 'NovelWriter.html'));
const OUT_DIR = path.resolve(process.env.NW_OUT_DIR || path.join(REPO_ROOT, 'out', 'nw-smoke'));
const FIXTURE = path.join(REPO_ROOT, 'NovelWriter', 'fixtures', 'beat-gate-old-shape-v1', 'novelData.json');

for (const k of ['XAI_API_KEY', 'GROK_API_KEY', 'NW_E2E_LIVE']) delete process.env[k];

fs.mkdirSync(OUT_DIR, { recursive: true });
const checks = [];
const check = (id, name, ok, detail) => checks.push({ id, name, ok: !!ok, detail: ok ? '' : String(detail == null ? '' : detail).slice(0, 1400) });
const clone = (o) => JSON.parse(JSON.stringify(o));
const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
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

const browser = await chromium.launch({ headless: true });
const pageErrors = [];

async function installHarness(page) {
  await page.evaluate(() => {
    const h = window.__h = { fetchCalls: [], late: [], dialogs: [], toasts: [] };
    h.realCallAI = window.callAI;
    h.realFetch = window.fetch;
    const toastEl = document.getElementById('nwToast');
    if (toastEl) new MutationObserver(() => { if (toastEl.textContent) h.toasts.push(toastEl.textContent); }).observe(toastEl, { childList: true, characterData: true, subtree: true });
    ['alert', 'confirm', 'prompt'].forEach((k) => {
      window[k] = function (m) { h.dialogs.push(k + ': ' + String(m).slice(0, 200)); return k === 'confirm' ? true : (k === 'prompt' ? null : undefined); };
    });
    window.scoreObligationCoverage = function () {
      return { covered: 6, total: 6, ratio: 1, words: 200, passed: true, failures: [], misses: [] };
    };
    window.collectData = function () {
      const skip = document.getElementById('skipAutoRevision');
      if (skip) novelData.skipAutoRevision = !!skip.checked;
      const aud = document.getElementById('autoContinuityAudit');
      if (aud) novelData.autoContinuityAudit = !!aud.checked;
      const beat = document.getElementById('aiBeatCheck');
      if (beat) novelData.aiBeatCheck = !!beat.checked;
    };
    window.callAI = async function () {
      const cfg = h.cfg || {};
      const g = window.__lastGenerateChapterGate;
      const ch = g ? g.chapter : 0;
      const part = /Part 2/.test(String(requestLog.status)) ? 2 : 1;
      if (cfg.hangAt && cfg.hangAt === (ch + ':' + part)) { h.hanging = true; return new Promise(() => {}); }
      const usage = { prompt_tokens: 60, completion_tokens: 40, total_tokens: 100 };
      if (typeof recordBookTokenUsage === 'function') recordBookTokenUsage(Object.assign({ operationName: 'generateChapter', originTab: 'tab5', model: 'smoke-stub' }, usage));
      requestLog.returnedInfo = JSON.stringify({ usage });
      return { chapter: 'Chapter ' + ch + ' part ' + part + ' prose (smoke). The relay hums under failing lights.' };
    };
    h.useRealCallAI = function (cfg) {
      cfg = cfg || {};
      window.callAI = h.realCallAI;
      document.getElementById('apiKey').value = 'smoke-placeholder-not-a-key';
      const mk = (tag, delay) => ({
        ok: true,
        status: 200,
        text: async () => {
          if (delay) await new Promise((r) => setTimeout(r, delay));
          return JSON.stringify({
            id: 'smoke',
            choices: [{ message: { role: 'assistant', content: JSON.stringify({ chapter: tag + 'prose (smoke real callAI). The relay hums.' }) } }],
            usage: { prompt_tokens: 60, completion_tokens: 40, total_tokens: 100, completion_tokens_details: { reasoning_tokens: 5 } }
          });
        }
      });
      window.fetch = function (url, init) {
        if (!/api\.x\.ai/.test(String(url))) return h.realFetch.apply(window, arguments);
        const signal = init && init.signal;
        h.fetchCalls.push({ hasSignal: !!signal, url: String(url) });
        if (cfg.hang) {
          if (cfg.lateMs == null) return new Promise(() => {});
          return new Promise((res) => setTimeout(() => {
            h.late.push({ aborted: !!(signal && signal.aborted) });
            res(mk('LATE ', 0));
          }, cfg.lateMs));
        }
        return Promise.resolve(mk('', cfg.delayMs || 0));
      };
    };
    h.load = function (nd) {
      Object.keys(nd).forEach((k) => { novelData[k] = JSON.parse(JSON.stringify(nd[k])); });
      novelData.chapters = Array.from({ length: nd.numChapters }, () => '');
      novelData.chapterImprovements = Array.from({ length: nd.numChapters }, () => '');
      novelData.autoContinuityAudit = false;
      novelData.skipAutoRevision = true;
      novelData.aiBeatCheck = false;
      novelData.apiKey = 'smoke-placeholder-not-a-key';
      novelData.tokenUsage = null;
      ensureBookTokenUsage();
      delete novelData.batchRun;
      document.getElementById('numChapters').value = String(nd.numChapters);
      document.getElementById('autoContinuityAudit').checked = false;
      document.getElementById('skipAutoRevision').checked = true;
      document.getElementById('aiBeatCheck').checked = false;
      document.getElementById('apiKey').value = 'smoke-placeholder-not-a-key';
      document.getElementById('batchFrom').value = '1';
      document.getElementById('batchTo').value = '1';
      document.getElementById('maxTokens').value = '1000';
      h.cfg = {};
      h.hanging = false;
      updateChapterSubpages();
      if (typeof nwBatchRefreshEstimate === 'function') nwBatchRefreshEstimate();
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
  await page.waitForFunction(() => typeof callAI === 'function' && typeof generateAllChapters === 'function' && typeof nwScoreAllChapters === 'function', null, { timeout: 30000 });
  await installHarness(page);
  return page;
}

const FLAGS = {
  timeout: 'var NW_CALLAI_ENABLE_TIMEOUT = true;',
  abort: 'var NW_CALLAI_ENABLE_ABORT_CLEANUP = true;',
  record: 'var NW_TIMING_ENABLE_RECORD = true;',
  lock: 'var NW_TIMING_ENABLE_SCOREALL_LOCK = true;',
  perCall: 'var NW_CALLAI_ENABLE_PER_CALL_STATE = true;',
  awaitLoad: 'var NW_TIMING_ENABLE_AWAIT_LOAD = true;'
};

function mutateCopy(flagFrom) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-8b-'));
  const copy = path.join(dir, 'NovelWriter.html');
  if (HTML.indexOf(flagFrom) < 0) return { ok: false, copy: null, detail: 'flag not found: ' + flagFrom };
  fs.writeFileSync(copy, HTML.replace(flagFrom, flagFrom.replace('true', 'false')));
  return { ok: true, copy, dir };
}

// ---------------- Timeout firing ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async (nd) => {
    const h = window.__h; h.load(nd); h.useRealCallAI({ hang: true, lateMs: 1500 });
    document.getElementById('aiCallTimeoutSec').value = '1';
    const t0 = Date.now();
    let err = null;
    try { await callAI([{ role: 'system', content: 'sys' }, { role: 'user', content: 'Return JSON only: {"chapter":"x"}' }], document.getElementById('tab5'), { operationName: 'generateChapter', taskType: 'draft', chapter: 1 }); }
    catch (e) { err = String(e && e.message || e); }
    const ms = Date.now() - t0;
    await new Promise((res) => setTimeout(res, 800));
    const rec = window.__nwLastTimingRecord;
    return {
      err, ms, busy: activeAICallCount, req: requestLog.status, hud: document.getElementById('executionDetail').textContent,
      late: h.late.slice(), anyLate: JSON.stringify(novelData).includes('LATE prose'), usage: ensureBookTokenUsage().calls.length,
      recOutcome: rec && rec.outcome, recTask: rec && rec.taskType, dialogs: h.dialogs.slice()
    };
  }, ND);
  check('timeout', 'hung callAI aborts after 1 s with Timed out after 1 s', /^Timed out after 1 s \(/.test(r.err || '') && r.ms >= 900 && r.ms < 8000, JSON.stringify(r));
  check('timeout', 'late resolve ignored: no LATE prose, no usage row, activeAICallCount 0, request Failed, 0 dialogs', r.busy === 0 && r.usage === 0 && !r.anyLate && /^Failed/.test(r.req) && r.dialogs.length === 0, JSON.stringify(r));
  check('timeout', 'timing record outcome is timeout (not counted as success)', r.recOutcome === 'timeout' && r.recTask === 'draft', JSON.stringify(r));
  await page.close();
}

// ---------------- Abort / cleanup ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async (nd) => {
    const h = window.__h; h.load(nd); h.useRealCallAI({ hang: true, lateMs: 900 });
    document.getElementById('aiCallTimeoutSec').value = '30';
    let err = null;
    const p = callAI([{ role: 'system', content: 'sys' }, { role: 'user', content: 'Return JSON only: {"chapter":"x"}' }], document.getElementById('tab5'), { operationName: 'generateChapter', taskType: 'draft', chapter: 2 });
    for (let i = 0; i < 40 && !h.fetchCalls.length; i++) await new Promise((x) => setTimeout(x, 25));
    const aborted = nwCallAIAbort();
    try { await p; } catch (e) { err = String(e && e.message || e); }
    await new Promise((res) => setTimeout(res, 1100));
    const rec = window.__nwLastTimingRecord;
    return {
      aborted, err, busy: activeAICallCount, anyLate: JSON.stringify(novelData).includes('LATE prose'),
      usage: ensureBookTokenUsage().calls.length, recOutcome: rec && rec.outcome, late: h.late.slice(), dialogs: h.dialogs.slice()
    };
  }, ND);
  check('abort', 'nwCallAIAbort rejects the in-flight call (Aborted)', r.aborted === true && /^Aborted \(/.test(r.err || ''), JSON.stringify(r));
  check('abort', 'late resolve ignored after abort: no LATE prose, no usage, activeAICallCount 0', r.busy === 0 && r.usage === 0 && !r.anyLate, JSON.stringify(r));
  check('abort', 'timing record outcome is abort (excluded from average)', r.recOutcome === 'abort', JSON.stringify(r));
  await page.close();
}

// ---------------- Timing records ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async (nd) => {
    const h = window.__h; h.load(nd);
    document.getElementById('aiCallTimeoutSec').value = '20';
    document.getElementById('nwRunLabel').value = 'timing-T0';
    const delays = [40, 80, 120];
    const recs = [];
    for (let i = 0; i < delays.length; i++) {
      h.useRealCallAI({ delayMs: delays[i] });
      await callAI([{ role: 'system', content: 'sys-v' }, { role: 'user', content: 'Return JSON only: {"chapter":"ok"}' }], document.getElementById('tab5'), { operationName: 'generateChapter', taskType: 'draft', chapter: 1, targetWords: 2000 });
      recs.push(JSON.parse(JSON.stringify(window.__nwLastTimingRecord)));
    }
    const avgBefore = nwTimingAvgFor('draft');
    h.useRealCallAI({ hang: true, lateMs: 1500 });
    document.getElementById('aiCallTimeoutSec').value = '1';
    try { await callAI([{ role: 'system', content: 'sys-v' }, { role: 'user', content: 'Return JSON only: {"chapter":"x"}' }], document.getElementById('tab5'), { operationName: 'generateChapter', taskType: 'draft', chapter: 1 }); } catch (e) { /* timeout */ }
    const avgAfter = nwTimingAvgFor('draft');
    const stats = nwTimingStatsList();
    const row = stats.find((s) => s.taskType === 'draft') || null;
    const snap = nwTimingExportSnapshot();
    const blob = new Blob([JSON.stringify({ schemaVersion: '1.0', sourceTool: 'NovelWriter', novelData: { title: 'T', genre: 'scifi', chapters: [] }, nwTiming: snap }, null, 2)], { type: 'application/json' });
    const beforeStats = stats.length;
    await nwTimingResetStats();
    const afterReset = nwTimingStatsList().length;
    const imported = JSON.parse(JSON.stringify(snap));
    nwTimingState.imported = imported;
    nwRenderTimingPanel();
    const impEl = document.getElementById('nwTimingImported');
    const table = document.getElementById('nwTimingTable');
    const panel = document.getElementById('nwTimingPanel');
    return {
      recs, avgBefore, avgAfter, row, beforeStats, afterReset,
      snapHasLog: Array.isArray(snap.sessionLog) && snap.sessionLog.length >= 3,
      snapNotInNovel: !('nwTiming' in novelData),
      tokens: recs[0] && recs[0].totalTokens, reasoning: recs[0] && recs[0].reasoningTokens,
      runLabel: recs[0] && recs[0].runLabel, hash: recs[0] && recs[0].promptHash,
      complexity: recs[0] && recs[0].complexity, bucket: recs[0] && recs[0].bucket,
      importedShown: impEl && !impEl.hidden && /display only/i.test(impEl.textContent),
      panel: !!(panel && table), avgUnder3: (() => {
        // 2 samples: wipe and add two
        return true;
      })()
    };
  }, ND);
  check('timing', 'three ok samples: count 3, min<=avg<=max, timeouts 0 then 1 after a timeout (avg unchanged)', r.row && r.row.count === 3 && r.row.min <= r.row.avg && r.row.avg <= r.row.max && r.avgBefore.samples >= 3 && r.avgAfter.samples === r.avgBefore.samples && r.row.timeouts >= 1, JSON.stringify({ row: r.row, avgBefore: r.avgBefore, avgAfter: r.avgAfter }));
  check('timing', 'record carries tokens (incl. reasoning), runLabel, promptHash, complexity, word bucket 2000', r.tokens === 100 && r.reasoning === 5 && r.runLabel === 'timing-T0' && !!r.hash && r.complexity && r.complexity.targetWords === 2000 && r.bucket === 2000, JSON.stringify({ tokens: r.tokens, reasoning: r.reasoning, runLabel: r.runLabel, hash: r.hash, complexity: r.complexity, bucket: r.bucket }));
  check('timing', 'export snapshot has sessionLog; nwTiming is not inside novelData; Tab 6 panel exists; import is display-only; reset clears stats', r.snapHasLog && r.snapNotInNovel && r.panel && r.afterReset === 0 && r.importedShown, JSON.stringify({ snapHasLog: r.snapHasLog, panel: r.panel, afterReset: r.afterReset, importedShown: r.importedShown }));
  await page.close();
}

{
  const page = await openPage();
  const x = await page.evaluate(async (nd) => {
    const h = window.__h; h.load(nd); h.useRealCallAI({ delayMs: 20 });
    document.getElementById('apiKey').value = 'smoke-placeholder-not-a-key';
    await callAI([{ role: 'system', content: 's' }, { role: 'user', content: 'Return JSON only: {"chapter":"a"}' }], document.getElementById('tab5'), { operationName: 'generateChapter', taskType: 'draft' });
    await callAI([{ role: 'system', content: 's' }, { role: 'user', content: 'Return JSON only: {"chapter":"a"}' }], document.getElementById('tab5'), { operationName: 'generateChapter', taskType: 'draft' });
    const two = nwTimingAvgFor('draft');
    await callAI([{ role: 'system', content: 's' }, { role: 'user', content: 'Return JSON only: {"chapter":"a"}' }], document.getElementById('tab5'), { operationName: 'generateChapter', taskType: 'draft' });
    const three = nwTimingAvgFor('draft');
    return { two, three };
  }, ND);
  check('timing', 'estimate appears at 3 samples and is hidden under 3', x.two.source === 'none' && x.two.avg == null && x.three.avg != null && x.three.samples >= 3, JSON.stringify(x));
  await page.close();
}

// ---------------- Score-all lock ----------------
{
  const page = await openPage();
  await page.evaluate((nd) => {
    const h = window.__h; h.load(nd);
    h.cfg = { hangAt: '1:1' };
    window.__p = generateAllChapters();
  }, ND);
  const hung = await page.waitForFunction(() => window.__h && window.__h.hanging === true, null, { timeout: 15000 }).then(() => true, () => false);
  if (!hung) {
    const dump = await page.evaluate(async () => {
      const r = await Promise.race([window.__p, new Promise((res) => setTimeout(() => res({ timeoutWait: true }), 300))]);
      return { r, status: document.getElementById('batchRunStatus').textContent, running: nwBatchState.running, calls: (window.__h.cfg || {}), callAIName: String(window.callAI).slice(0, 80) };
    });
    check('lock', 'batch hung for score-all lock', false, JSON.stringify(dump));
  }
  const r = await page.evaluate(async () => {
    const btn = document.getElementById('scoreAllChaptersBtn');
    const res = await nwScoreAllChapters();
    return {
      disabled: btn && btn.disabled,
      res: res,
      toast: document.getElementById('nwToast').textContent,
      running: nwBatchState.running,
      dialogs: window.__h.dialogs.slice()
    };
  });
  check('lock', 'Score all chapters button disabled mid-batch', r.disabled === true && r.running === true, JSON.stringify(r));
  check('lock', 'nwScoreAllChapters refuses with reason locked and a toast; 0 dialogs', r.res && r.res.reason === 'locked' && /Score all chapters is locked/.test(r.toast || '') && r.dialogs.length === 0, JSON.stringify(r));
  await page.close();
}

// ---------------- Per-call scorecard cost ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async (nd) => {
    const h = window.__h; h.load(nd); h.useRealCallAI({ delayMs: 20 });
    document.getElementById('skipAutoRevision').checked = true;
    novelData.skipAutoRevision = true;
    let err = null;
    try { await generateChapter(1, { batch: false }); } catch (e) { err = String(e && e.message || e); }
    const card = (novelData.chapterScorecards || [])[0];
    return { cost: card && card.cost, err };
  }, ND);
  check('cost', 'scorecard cost.source is per-call after 8b timing records', r && r.cost && r.cost.source === 'per-call' && r.cost.elapsedMs > 0 && r.cost.calls >= 1, JSON.stringify(r));
  await page.close();
}

async function concurrentCancelEval(page) {
  return page.evaluate(async (nd) => {
    const h = window.__h; h.load(nd); h.useRealCallAI({ delayMs: 700 });
    document.getElementById('aiCallTimeoutSec').value = '30';
    const msgs = [{ role: 'system', content: 'sys' }, { role: 'user', content: 'Return JSON only: {"chapter":"ok"}' }];
    const tab = document.getElementById('tab5');
    const wrap = (p) => p.then((r) => ({ ok: true, r }), (e) => ({ ok: false, err: String(e && e.message || e) }));
    const p1 = wrap(callAI(msgs, tab, { operationName: 'opA', taskType: 'draft', chapter: 1 }));
    const p2 = wrap(callAI(msgs, tab, { operationName: 'opB', taskType: 'draft', chapter: 2 }));
    for (let i = 0; i < 80 && h.fetchCalls.length < 2; i++) await new Promise((x) => setTimeout(x, 25));
    const nBefore = (typeof nwActiveCallCount === 'function') ? nwActiveCallCount() : (nwActiveCalls ? nwActiveCalls.size : 0);
    const hudBefore = document.getElementById('executionDetail').textContent;
    const aborted = nwCallAIAbort();
    await new Promise((x) => setTimeout(x, 60));
    const nMid = (typeof nwActiveCallCount === 'function') ? nwActiveCallCount() : (nwActiveCalls ? nwActiveCalls.size : 0);
    const hudMid = document.getElementById('executionDetail').textContent;
    const r1 = await p1;
    const r2 = await p2;
    return {
      fetchN: h.fetchCalls.length, nBefore, nMid, aborted, hudBefore, hudMid,
      p1ok: !!(r1.ok && r1.r && r1.r.chapter), p1err: r1.ok ? null : r1.err,
      p2err: r2.ok ? null : r2.err, busy: activeAICallCount
    };
  }, ND);
}

{
  const page = await openPage();
  const r = await concurrentCancelEval(page);
  check('concurrent', '2 concurrent stubbed calls: cancel one, the other completes', r.aborted === true && r.p1ok === true && /^Aborted \(/.test(r.p2err || '') && r.busy === 0, JSON.stringify(r));
  check('concurrent', 'HUD shows remaining active calls after cancelling one of two', r.nBefore === 2 && r.nMid === 1 && /2 active calls/.test(r.hudBefore || '') && /Waiting on LLM response/.test(r.hudMid || ''), JSON.stringify(r));
  await page.close();
}

async function timingAwaitLoadEval(page) {
  return page.evaluate(async () => {
    await nwTimingLoadStats();
    const recBase = {
      taskType: 'draft', model: 'await-load-smoke', bucket: 2000, bucketKind: 'words',
      skillId: 'tab5.generateChapter', skillVersion: '1', promptHash: 'aabbccdd',
      promptTokens: 10, completionTokens: 10, totalTokens: 20
    };
    const key = nwTimingStatKey(recBase);
    const seed = Object.assign(nwTimingEmptyStat(recBase), { count: 7, min: 11, max: 11, avg: 11, lastMs: 11, lastTokens: 20 });
    await nwTimingIdbPut(seed);
    nwTimingState.loaded = false;
    nwTimingState.stats = {};
    const orig = nwTimingLoadStats;
    let release;
    const gate = new Promise((r) => { release = r; });
    nwTimingLoadStats = function () { return gate.then(function () { return orig(); }); };
    const rec = Object.assign({}, recBase, { outcome: 'ok', ms: 22, chapter: 1, callIndex: 0 });
    const p = nwTimingRecordSettle(rec);
    const early = (nwTimingState.stats[key] && nwTimingState.stats[key].count) || 0;
    release();
    if (p && typeof p.then === 'function') await p;
    await new Promise((r) => setTimeout(r, 250));
    const finalCount = (nwTimingState.stats[key] && nwTimingState.stats[key].count) || 0;
    nwTimingLoadStats = orig;
    return { key, early, finalCount };
  });
}

{
  const page = await openPage();
  const r = await timingAwaitLoadEval(page);
  check('timing-load', 'record before load resolves keeps persisted count plus the new sample', r.finalCount === 8 && r.early === 0, JSON.stringify(r));
  await page.close();
}

{
  const page = await openPage();
  const r = await page.evaluate(async (nd) => {
    const h = window.__h; h.load(nd); h.useRealCallAI({ delayMs: 20 });
    document.getElementById('skipAutoRevision').checked = true;
    novelData.skipAutoRevision = true;
    document.getElementById('aiBeatCheck').checked = false;
    novelData.aiBeatCheck = false;
    await generateChapter(1, { batch: false });
    const cost1 = JSON.parse(JSON.stringify(((novelData.chapterScorecards || [])[0] || {}).cost || {}));
    await generateChapter(1, { batch: false });
    const cost2 = JSON.parse(JSON.stringify(((novelData.chapterScorecards || [])[0] || {}).cost || {}));
    const scored = await nwScoreAllChapters();
    const costAll = JSON.parse(JSON.stringify(((novelData.chapterScorecards || [])[0] || {}).cost || {}));
    return { cost1, cost2, costAll, scoredTrigger: scored && scored.trigger };
  }, ND);
  check('cost-bound', 'second run per-call cost excludes the first run\'s calls', r.cost1.source === 'per-call' && r.cost2.source === 'per-call' && r.cost1.calls >= 1 && r.cost2.calls === r.cost1.calls, JSON.stringify(r));
  check('cost-bound', 'Score all with AI off reports no per-call cost', r.costAll.source !== 'per-call' && r.costAll.calls === 0, JSON.stringify(r));
  await page.close();
}

{
  const page = await openPage();
  const r = await page.evaluate((nd) => {
    const h = window.__h; h.load(nd);
    document.getElementById('skipAutoRevision').checked = true;
    novelData.skipAutoRevision = true;
    novelData.autoContinuityAudit = false;
    novelData.aiBeatCheck = false;
    const skipOn = nwTimingChainSteps(3);
    document.getElementById('skipAutoRevision').checked = false;
    novelData.skipAutoRevision = false;
    const skipOff = nwTimingChainSteps(3);
    const maxP = (NW_QUALITY_REVISE && NW_QUALITY_REVISE.maxAutoPasses != null) ? NW_QUALITY_REVISE.maxAutoPasses : null;
    const revOn = skipOn.find((s) => s.taskType === 'revise');
    const revOff = skipOff.find((s) => s.taskType === 'revise');
    return { skipOnN: revOn ? revOn.n : 0, skipOffN: revOff ? revOff.n : 0, maxP, stepsOn: skipOn, stepsOff: skipOff };
  }, ND);
  check('chain', 'chain estimate counts revise as maxAutoPasses and 0 when skipAutoRevision is on', r.skipOnN === 0 && r.maxP === 2 && r.skipOffN === 3 * r.maxP, JSON.stringify(r));
  await page.close();
}

{
  const page = await openPage();
  const r = await page.evaluate(() => {
    const el = document.getElementById('nwSlowStepBanner');
    return { role: el && el.getAttribute('role'), live: el && el.getAttribute('aria-live') };
  });
  check('a11y', 'slow-step banner has role=alert and aria-live=assertive', r.role === 'alert' && r.live === 'assertive', JSON.stringify(r));
  await page.close();
}

const shaBefore = sha256(HTML_PATH);
check('mut', 'SHA-256 before mutations recorded', !!shaBefore, shaBefore);

{
  const m = mutateCopy(FLAGS.timeout);
  check('mut', 'timeout flag present in source', m.ok, m.detail);
  if (m.copy) {
    const page = await openPage(m.copy);
    const r = await page.evaluate(async (nd) => {
      const h = window.__h; h.load(nd); h.useRealCallAI({ hang: true, lateMs: 400 });
      document.getElementById('aiCallTimeoutSec').value = '1';
      let err = null;
      try { await callAI([{ role: 'system', content: 's' }, { role: 'user', content: 'Return JSON only: {"chapter":"x"}' }], document.getElementById('tab5'), { operationName: 'generateChapter', taskType: 'draft' }); }
      catch (e) { err = String(e && e.message || e); }
      return { err, anyLate: JSON.stringify(novelData).includes('LATE prose'), rec: window.__nwLastTimingRecord && window.__nwLastTimingRecord.outcome };
    }, ND);
    await page.close();
    const failedSelf = !(/^Timed out after 1 s \(/.test(r.err || ''));
    check('mut', 'disabling timeout fails the timeout self-test', failedSelf, JSON.stringify(r));
  }
}

{
  const m = mutateCopy(FLAGS.abort);
  check('mut', 'abort-cleanup flag present in source', m.ok, m.detail);
  if (m.copy) {
    const page = await openPage(m.copy);
    const r = await page.evaluate(async (nd) => {
      const h = window.__h; h.load(nd); h.useRealCallAI({ hang: true, lateMs: 500 });
      document.getElementById('aiCallTimeoutSec').value = '30';
      let err = null;
      const p = callAI([{ role: 'system', content: 's' }, { role: 'user', content: 'Return JSON only: {"chapter":"x"}' }], document.getElementById('tab5'), { operationName: 'generateChapter', taskType: 'draft', chapter: 1 });
      for (let i = 0; i < 40 && !h.fetchCalls.length; i++) await new Promise((x) => setTimeout(x, 25));
      nwCallAIAbort();
      try { await p; } catch (e) { err = String(e && e.message || e); }
      await new Promise((res) => setTimeout(res, 700));
      return { err, anyLate: JSON.stringify(novelData).includes('LATE prose'), usage: ensureBookTokenUsage().calls.length };
    }, ND);
    await page.close();
    const failedSelf = r.anyLate === true || r.usage > 0;
    check('mut', 'disabling abort cleanup fails the abort self-test (late resolve writes)', failedSelf, JSON.stringify(r));
  }
}

{
  const m = mutateCopy(FLAGS.record);
  check('mut', 'timing-record flag present in source', m.ok, m.detail);
  if (m.copy) {
    const page = await openPage(m.copy);
    const r = await page.evaluate(async (nd) => {
      const h = window.__h; h.load(nd); h.useRealCallAI({ delayMs: 20 });
      await callAI([{ role: 'system', content: 's' }, { role: 'user', content: 'Return JSON only: {"chapter":"ok"}' }], document.getElementById('tab5'), { operationName: 'generateChapter', taskType: 'draft' });
      return { rec: window.__nwLastTimingRecord, n: (nwTimingState.sessionLog || []).length };
    }, ND);
    await page.close();
    const failedSelf = !r.rec && r.n === 0;
    check('mut', 'disabling timing record fails the timing self-test', failedSelf, JSON.stringify(r));
  }
}

{
  const m = mutateCopy(FLAGS.perCall);
  check('mut', 'per-call state flag present in source', m.ok, m.detail);
  if (m.copy) {
    const page = await openPage(m.copy);
    const r = await concurrentCancelEval(page);
    await page.close();
    const failedSelf = !(r.aborted === true && r.p1ok === true && /^Aborted \(/.test(r.p2err || ''));
    check('mut', 'reverting to shared active-call state fails the concurrent-cancel self-test', failedSelf, JSON.stringify(r));
  }
}

{
  const m = mutateCopy(FLAGS.awaitLoad);
  check('mut', 'await-load flag present in source', m.ok, m.detail);
  if (m.copy) {
    const page = await openPage(m.copy);
    const r = await timingAwaitLoadEval(page);
    await page.close();
    const failedSelf = r.finalCount !== 8;
    check('mut', 'removing await/merge of timing load fails the persisted-stats self-test', failedSelf, JSON.stringify(r));
  }
}

{
  const m = mutateCopy(FLAGS.lock);
  check('mut', 'score-all lock flag present in source', m.ok, m.detail);
  if (m.copy) {
    const page = await openPage(m.copy);
    await page.evaluate((nd) => {
      const h = window.__h; h.load(nd);
      h.cfg = { hangAt: '1:1' };
      window.__p = generateAllChapters();
    }, ND);
    const hungMut = await page.waitForFunction(() => window.__h && window.__h.hanging === true, null, { timeout: 15000 }).then(() => true, () => false);
    if (!hungMut) {
      const dump = await page.evaluate(async () => {
        const r = await Promise.race([window.__p, new Promise((res) => setTimeout(() => res({ timeoutWait: true }), 300))]);
        return { r, status: document.getElementById('batchRunStatus').textContent };
      });
      check('mut', 'disabling Score-all lock fails the lock self-test', false, 'batch did not hang: ' + JSON.stringify(dump));
    } else {
      const r = await page.evaluate(async () => {
        const res = await nwScoreAllChapters();
        return { res, disabled: document.getElementById('scoreAllChaptersBtn').disabled };
      });
      const failedSelf = !(r.res && r.res.reason === 'locked');
      check('mut', 'disabling Score-all lock fails the lock self-test', failedSelf, JSON.stringify(r));
    }
    await page.close();
  }
}

const shaAfter = sha256(HTML_PATH);
check('mut', 'SHA-256 after mutations matches before (source restored / never edited)', shaAfter === shaBefore, shaBefore + ' vs ' + shaAfter);

check('pageerror', 'no uncaught pageerror events', pageErrors.length === 0, pageErrors.join(' | '));

await browser.close();

const failed = checks.filter((c) => !c.ok);
const report = { passed: checks.filter((c) => c.ok).length, failed: failed.length, checks, pageErrors, shaBefore, shaAfter };
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'SMOKE_NW_CALLAI_TIMEOUT.json'), JSON.stringify(report, null, 2));
console.log('NW CALLAI TIMEOUT SMOKE: ' + (failed.length ? 'FAIL' : 'PASS') + ' (' + (checks.length - failed.length) + '/' + checks.length + ')');
for (const c of checks) {
  console.log((c.ok ? 'PASS' : 'FAIL') + ' [' + c.id + '] ' + c.name + (c.ok ? '' : ' :: ' + c.detail));
}
process.exit(failed.length ? 1 : 0);
