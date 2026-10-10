/**
 * Offline smoke for NW_GENERATE_ALL_SPEC (slot 8): optional "Generate All Chapters" on Tab 5.
 * No network, no API key: every http(s) request is aborted; window.callAI is replaced by a stub that returns chapter
 * text and records `usage` on novelData.tokenUsage (recordBookTokenUsage), like the real gateway. Nothing here needs
 * XAI_API_KEY. Each case gets a fresh browser context (own IndexedDB); E2 reloads its page.
 *
 * Fixture: the PR1 beat-gate session fixture (NovelWriter/fixtures/beat-gate-old-shape-v1) with all six beats dense
 * (same enriched() as _smoke_nw_beat_gate.mjs). Real per-chapter gate (scoreGenerateChapterGate), real readiness
 * (assertAdvanceToTab5ReadinessOrThrow), real assertObligationCoverageOrThrow (its scorer is stubbed), real IndexedDB.
 * alert/confirm/prompt are stubbed to RECORD and return normally (E4 amendment), so a remaining modal is counted.
 *
 *   PS  thin ch5: readiness assert not-ready, Generate All refuses (0 provider calls), single-chapter Generate hard-blocked
 *   G1  full run 1..4: completed [1,2,3,4], reason done, 0 session downloads (clean run: no auto-export), 0 per-chapter
 *       downloads; opt-in downloads
 *   G2  (a) thin ch3 before start: preflight blocks, names the Enrich button, 0 calls; outline floor (b) ch3 thinned
 *       mid-run (stub blanks ch3 dialogueTurn while serving ch2 Part 2): stop at 3, reason gate, ch4 never attempted
 *   G3  pause during ch2: ch2 finishes, reason paused, ch3 not started; Resume starts at 3 and finishes
 *   G4  cap below 2 chapters of stub usage: stops after the chapter that crossed it, text saved, reason budget
 *   G5  ch2 pre-filled: skipped, unchanged, not in completed; regenerate on + provider failure on ch2 restores old text
 *   G6  generateChapter(1) outside a batch: no batchRun, no checkpoint, gate unchanged (alerts once when thin)
 *   G7  ch2 fails twice (HTTP 503): exactly 2 attempts, reason provider, ch1 kept, 2 s backoff, 1 session export (stopped);
 *       one failure then recovers
 *   E1  IndexedDB put throws QuotaExceededError after ch1: run stops, "Checkpoint failed", ch2 callAI never invoked
 *   E2  during a run per-chapter controls are locked; reload mid-ch2 offers restore, ch2 not completed, inFlight null,
 *       Resume enabled and resumes at 2; provider calls per chapter prove no completed chapter is regenerated
 *   E3  real usage 3x the estimate: stop after ch1 by real usage (estimate under cap); no usage -> estimate + usageEstimated
 *   E4  zero alert/confirm/prompt in batches; quality-gate error -> status line, run continues; coverage and gate stop with
 *       reason; Part 1 parse failure on ch3 stops at 3 (reason parse, no retry) and Resume regenerates ch3 (same for a
 *       Part 2 parse stop on ch2); coverage resume needs a second click; coverage stop with regenerate on restores the old
 *       text and keeps batchRun.rejectedDraft {chapter,text,detail} in the session export but never in a checkpoint
 *   M1  must-fix 1: callAI's real malformed-JSON shape ({chapter, _jsonParseError} + valid HTTP envelope in returnedInfo)
 *       on Part 1 (ch3) and Part 2 (ch2): reason parse, no retry, Part 1 never continues to Part 2, nothing completed
 *   M2  must-fix 2: HTTP 400 / 401 / 403 / "API Key is missing" -> reason provider, 0 retries, no usageEstimated entry;
 *       401/403/missing key status says "Check your API key in Setup", 400 shows the provider message truncated (~160)
 *   M3  must-fix 3: (in G4) cap reached after ch2 -> Resume with the cap unchanged: 0 provider calls, status exactly
 *       "Token cap reached (4000/3000). Raise the cap to continue."; raising the cap resumes
 *   M4  must-fix 4: user cap 50000 survives reload + restore + Resume; an imported session's batchRun.cap is kept on Resume
 *   M5  must-fix 5: numChapters + Tab 7 Apply + Tab 8 Integrate disabled mid-run, direct handler calls refused, batch-owned
 *       qualityRevise updateChapter still works; activeAICallCount > 0 refuses start and resume with 0 calls, no dialog
 *   M6  must-fix 6: slow final checkpoint: running stays true, controls locked, second start/resume refused, then released
 *   M7  must-fix 7: all chapters complete, final checkpoint throws QuotaExceededError: result/status/export say checkpoint
 *   F1  #134 follow-up 1: a batch starts while importSession's FileReader is reading; onload rechecks the lock: toast
 *       "Import cancelled: a Generate All run is active. Import again after it stops.", novelData/requestLog unchanged, 0 dialogs
 *   F2  #134 follow-up 2: import without batchRun over a stopped run: no batchRun, interrupted cleared, old IndexedDB
 *       checkpoint deleted (gone at the success dialog; no race); after reload no restore prompt and Resume unavailable.
 *       An import WITH a batchRun keeps it. A stale custom cap / data-user-edited from the previous run is cleared and
 *       the field shows the fresh estimate; a new Generate All uses that estimate, not the old cap.
 *   F3  #134 follow-up 3: after restore, nwBatchRefreshEstimate (and a range change) keeps showing br.cap
 *   F4  #134 follow-up 4: Rebuild Continuity Packets / Run Continuity Audit (All) disabled mid-run; direct calls return
 *       with a toast (no throw, no console error, no dialog, no work); the batch's own audit still runs
 *   F5  #134 follow-up 5: batch continuity audit errors: 503 then OK -> only the audit is retried (Part 1/2 calls unchanged),
 *       run continues; 503 twice -> provider stop, drafted text kept, real usage (no usageEstimated), Resume regenerates
 *       the chapter; 401 -> no retry; real malformed audit JSON (callAI {chapter, _jsonParseError}) -> reason parse, draft
 *       kept, no retry (single-chapter audit keeps its fallback). keptDraft survives a failed Resume (Part 1 provider error)
 *       and a reload after the pre-chapter checkpoint: Resume still regenerates the chapter (#135 review)
 *   X1  CodeQL DOM-as-HTML: a session whose character name/backstory/arc and subplot are `<img src=x onerror=...>` (plus
 *       attribute/textarea break-out variants) is imported through the real #importFile input and restored through the
 *       IndexedDB "Restore interrupted batch run" path: window.__xss stays undefined, no <img> lands in the Tab 2 lists,
 *       and every field value round-trips exactly (DOM .value and novelData)
 *
 * Usage: node scripts/_smoke_nw_generate_all.mjs
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

for (const k of ['XAI_API_KEY', 'GROK_API_KEY', 'NW_E2E_LIVE']) delete process.env[k];

const checks = [];
const check = (id, name, ok, detail) => checks.push({ id, name, ok: !!ok, detail: ok ? '' : String(detail == null ? '' : detail).slice(0, 900) });
const clone = (o) => JSON.parse(JSON.stringify(o));
const HTML = fs.readFileSync(HTML_PATH, 'utf8');
const FX = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
delete FX._fixture;
const BUTTON = 'Enrich Chapter Blueprints';
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Same as _smoke_nw_beat_gate.mjs: all six beats dense (>= 40 chars) for every chapter; castArcBeat names a cast member. */
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
const thin = (nd, ch) => { const x = clone(nd); x.chapterBlueprints[ch - 1].sceneGoal = ''; x.chapterBlueprints[ch - 1].dialogueTurn = 'Too short.'; return x; };
const ND = enriched(FX);

const htmlLines = HTML.split(/\r?\n/);
const knownRace = (e) => {
  if (!/Cannot set properties of null/.test(String(e && e.message || e))) return false;
  const m = String(e && e.stack || '').match(/NovelWriter\.html:(\d+):\d+/);
  return !!m && /getElementById\(`chapter(?:GenContent|EditContent|EditImprovement)\$\{i\}`\)\.value = novelData\.(?:chapters|chapterImprovements)\[i-1\]/.test(htmlLines[parseInt(m[1], 10) - 1] || '');
};

const browser = await chromium.launch({ headless: true });
const pageErrors = [];
const networkSeen = [];

/** In-page harness (re-installed after a reload). */
async function installHarness(page) {
  await page.evaluate(() => {
    const h = window.__h = { calls: [], dialogs: [], downloads: [], puts: 0, putsWithRejected: 0, cfg: {}, hanging: false, statusSeen: [], lastExport: null, toasts: [], auditCalls: [], realAuditCalls: [] };
    const toastEl = document.getElementById('nwToast');
    if (toastEl) new MutationObserver(() => { if (toastEl.textContent) h.toasts.push(toastEl.textContent); }).observe(toastEl, { childList: true, characterData: true, subtree: true });
    // slot 8a: continuity audit stub (cfg.auditStub). cfg.auditErrs[n] = messages thrown on attempt 1, 2, ...; an OK attempt
    // records 100 tokens of real usage.
    const realAudit = window.runChapterContinuityAudit;
    window.runChapterContinuityAudit = async function (n, o) {
      if (!h.cfg.auditStub) return realAudit.apply(this, arguments);
      h.auditCalls.push(n);
      const k = h.auditCalls.filter((x) => x === n).length;
      const plan = (h.cfg.auditErrs || {})[n];
      if (plan && plan[k - 1]) throw new Error(plan[k - 1]);
      recordBookTokenUsage({ operationName: 'runChapterContinuityAudit_' + n, originTab: 'tab5', model: 'smoke-stub', prompt_tokens: 60, completion_tokens: 40, total_tokens: 100 });
      return { chapter: n };
    };
    h.idbKeys = function () {
      return nwBatchOpenDb().then((db) => new Promise((res, rej) => { const q = db.transaction('checkpoints', 'readonly').objectStore('checkpoints').getAllKeys(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }));
    };
    h.idbGet = function (key) {
      return nwBatchOpenDb().then((db) => new Promise((res, rej) => { const q = db.transaction('checkpoints', 'readonly').objectStore('checkpoints').get(key); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }));
    };
    const realCOU = URL.createObjectURL;
    URL.createObjectURL = function (b) { if (b && /json/.test(String(b.type))) h.lastExport = b; return realCOU.call(URL, b); };
    window.collectData = function () {};
    ['alert', 'confirm', 'prompt'].forEach((k) => {
      window[k] = function (m) { h.dialogs.push(k + ': ' + String(m).slice(0, 200)); return k === 'confirm' ? true : (k === 'prompt' ? null : undefined); };
    });
    HTMLAnchorElement.prototype.click = function () { if (this.download) h.downloads.push(this.download); };
    window.ensureQualityAfterGenerate = async function (n) {
      if (h.cfg.qualityThrow === n) throw new Error('smoke quality judge unavailable ch' + n);
      if (h.cfg.reviseAt === n) {
        // batch-owned quality revise: the real updateChapter with operationTag qualityRevise must still run in a batch
        novelData.chapterImprovements[n - 1] = 'smoke revise brief: tighten the relay scene';
        const imp = document.getElementById('chapterEditImprovement' + n); if (imp) imp.value = novelData.chapterImprovements[n - 1];
        try { await updateChapter(n, { requireImprovements: true, operationTag: 'qualityRevise' }); h.revise = 'ok:' + String(novelData.chapters[n - 1]).slice(0, 20); } catch (e) { h.revise = 'threw:' + String(e.message || e); }
        try { await updateChapter(n, { requireImprovements: true, operationTag: 'applyCritique' }); h.reviseManual = 'ran'; } catch (e) { h.reviseManual = 'threw:' + String(e.message || e); }
      }
    };
    const realIdbPut = window.nwBatchIdbPut;
    window.nwBatchIdbPut = function (rec, key) {
      if (h.cfg.slowFinal && rec && rec.active === false && rec.batchRun && rec.batchRun.reason) {
        return new Promise((resolve, reject) => { h.releaseFinal = () => realIdbPut(rec, key).then(resolve, reject); h.finalPending = true; });
      }
      return realIdbPut(rec, key);
    };
    window.scoreObligationCoverage = function (text, n) {
      const bad = h.cfg.coverageFail === n;
      return { covered: bad ? 0 : 6, total: 6, ratio: bad ? 0 : 1, words: 120, passed: !bad, failures: bad ? ['smoke: obligations not dramatized'] : [], misses: bad ? ['smoke-obligation'] : [] };
    };
    const realPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () {
      h.puts += 1;
      const rec0 = arguments[0];
      if (rec0 && ((rec0.batchRun && 'rejectedDraft' in rec0.batchRun) || (rec0.novelData && rec0.novelData.batchRun))) h.putsWithRejected += 1;
      if (h.cfg.putThrowAfter != null && h.puts > h.cfg.putThrowAfter) throw new DOMException('smoke: quota exceeded', 'QuotaExceededError');
      return realPut.apply(this, arguments);
    };
    const st = document.getElementById('batchRunStatus');
    if (st) new MutationObserver(() => h.statusSeen.push(st.textContent)).observe(st, { childList: true, characterData: true, subtree: true });
    window.callAI = async function () {
      const cfg = h.cfg;
      const opName = (arguments[2] && typeof arguments[2] === 'object' && arguments[2].operationName) || '';
      const am = /^runChapterContinuityAudit_(\d+)$/.exec(opName);
      if (am) {
        // real runChapterContinuityAudit -> stubbed provider: the response carries real usage; cfg.auditJsonErrAt returns the
        // real callAI shape for malformed model JSON ({ chapter, _jsonParseError }).
        const an = Number(am[1]);
        h.realAuditCalls.push(an);
        recordBookTokenUsage({ operationName: opName, originTab: 'tab5', model: 'smoke-stub', prompt_tokens: 60, completion_tokens: 40, total_tokens: 100 });
        if (cfg.auditJsonErrAt === an) {
          const content = '{"chapterSummary": "Chapter ' + an + ' audit truncated mid-str';
          requestLog.returnedInfo = JSON.stringify({ id: 'smoke', choices: [{ message: { role: 'assistant', content } }] });
          return { chapter: content, _jsonParseError: 'SyntaxError: Unterminated string in JSON at position 42' };
        }
        return { chapterSummary: 'smoke audit ok', unresolvedThreads: [], storyArcProgress: { currentBeat: 'b', nextBeat: 'n', riskLevel: 'low' }, characterArcProgress: [], continuityRisks: [], recommendedFixes: [] };
      }
      const g = window.__lastGenerateChapterGate;
      const ch = g ? g.chapter : 0;
      const part = /Part 2/.test(String(requestLog.status)) ? 2 : 1;
      const key = ch + ':' + part;
      const attempt = h.calls.filter((c) => c.ch === ch && c.part === part).length + 1;
      h.calls.push({ ch, part, attempt });
      if (cfg.pauseAt === key) { h.pauseBtnEnabled = !document.getElementById('batchPauseBtn').disabled; document.getElementById('batchPauseBtn').click(); }
      if (cfg.blankBeatAt === key) novelData.chapterBlueprints[cfg.blankBeatTarget - 1].dialogueTurn = '';
      if (cfg.hangAt === key) { h.hanging = true; return new Promise(() => {}); }
      if (part === 1 && cfg.failProvider && attempt <= (cfg.failProvider[ch] || 0)) throw new Error('HTTP error! Status: 503, Text: smoke upstream unavailable');
      if (cfg.throwAt && cfg.throwAt.key === key) throw new Error(cfg.throwAt.msg);
      if (cfg.jsonErrAt === key) {
        // real gateway shape: usage recorded from the HTTP body, returnedInfo = the valid HTTP envelope, content unparseable
        const u = { prompt_tokens: 600, completion_tokens: 400, total_tokens: 1000 };
        recordBookTokenUsage(Object.assign({ operationName: 'generateChapter', originTab: 'tab5', model: 'smoke-stub' }, u));
        const content = '{"chapter": "Chapter ' + ch + ' truncated mid-str';
        requestLog.returnedInfo = JSON.stringify({ id: 'smoke', choices: [{ message: { role: 'assistant', content } }], usage: u });
        return { chapter: content, _jsonParseError: 'SyntaxError: Unterminated string in JSON at position 33' };
      }
      if (cfg.parseFail === key) { requestLog.returnedInfo = 'smoke: truncated provider body {'; return { chapter: 'garbled' }; }
      const per = cfg.usagePerCall || 1000;
      const usage = cfg.noUsage ? null : { prompt_tokens: Math.round(per * 0.6), completion_tokens: per - Math.round(per * 0.6), total_tokens: per };
      if (usage) recordBookTokenUsage(Object.assign({ operationName: 'generateChapter', originTab: 'tab5', model: 'smoke-stub' }, usage));
      requestLog.returnedInfo = JSON.stringify(usage ? { usage } : {});
      return { chapter: 'Chapter ' + ch + ' part ' + part + ' prose (smoke). The relay hums under failing lights.' };
    };
    h.load = function (nd) {
      Object.keys(nd).forEach((k) => { novelData[k] = JSON.parse(JSON.stringify(nd[k])); });
      novelData.chapters = Array.from({ length: nd.numChapters }, () => '');
      novelData.chapterImprovements = Array.from({ length: nd.numChapters }, () => '');
      novelData.chapterContinuityPackets = [];
      novelData.continuityTracker = { chapters: [], characterArcProgress: [], storyArcProgress: {} };
      novelData.autoContinuityAudit = false;
      novelData.apiKey = 'smoke-placeholder-not-a-key';
      novelData.tokenUsage = null;
      ensureBookTokenUsage();
      delete novelData.batchRun;
      document.getElementById('numChapters').value = String(nd.numChapters);
      document.getElementById('maxTokens').value = '1000';
      document.getElementById('autoContinuityAudit').checked = false;
      updateChapterSubpages();
      document.getElementById('batchFrom').value = '1';
      document.getElementById('batchTo').value = '4';
      document.getElementById('batchRegenerate').checked = false;
      document.getElementById('batchPerChapterDownload').checked = false;
      const cap = document.getElementById('batchTokenCap');
      cap.dataset.userEdited = '';
      nwBatchRefreshEstimate();
    };
    h.setText = function (n, text) { nwBatchSetChapterText(n, text); };
    h.snap = function (r) {
      const el = (id) => document.getElementById(id);
      return {
        r: r || null,
        br: novelData.batchRun ? JSON.parse(JSON.stringify(novelData.batchRun)) : null,
        chapters: (novelData.chapters || []).slice(0, 6),
        genDom: [1, 2, 3, 4].map((n) => (el('chapterGenContent' + n) || {}).value || ''),
        calls: h.calls.slice(), dialogs: h.dialogs.slice(), downloads: h.downloads.slice(), puts: h.puts,
        status: el('batchRunStatus').textContent, state: el('batchRunStatus').dataset.state,
        statusRole: el('batchRunStatus').getAttribute('role'), statusTestId: el('batchRunStatus').getAttribute('data-testid'),
        pauseDisabled: el('batchPauseBtn').disabled, resumeDisabled: el('batchResumeBtn').disabled,
        goTab4: !el('batchGoTab4').hidden, exportNow: !el('batchExportNow').hidden, restoreBox: !el('batchRestoreBox').hidden,
        quiet: nwBatchState.quiet, running: nwBatchState.running, log: nwBatchState.log.slice(), statusSeen: h.statusSeen.slice(),
        estimate: nwBatchEstimate(1)
      };
    };
  });
}

async function openPage() {
  const page = await browser.newPage();
  page.on('pageerror', (e) => { if (!knownRace(e)) pageErrors.push(String(e && e.message || e)); });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (!/^https?:/i.test(url)) return route.continue();
    networkSeen.push(url);
    return route.abort('blockedbyclient');
  });
  await page.goto(pathToFileURL(HTML_PATH).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof generateAllChapters === 'function' && typeof scoreGenerateChapterGate === 'function' && window.__nwBatchRestoreCheck, null, { timeout: 30000 });
  await page.evaluate(() => window.__nwBatchRestoreCheck);
  await installHarness(page);
  return page;
}

/** Load the fixture, apply UI setup, set cfg, run Generate All (or resume) and return a snapshot. */
async function batch(page, opts) {
  return page.evaluate(async (o) => {
    const h = window.__h;
    if (o.nd) { h.load(o.nd); h.auditCalls.length = 0; h.realAuditCalls.length = 0; }
    if (o.audit) { novelData.autoContinuityAudit = true; document.getElementById('autoContinuityAudit').checked = true; }
    if (o.prefill) Object.keys(o.prefill).forEach((n) => h.setText(Number(n), o.prefill[n]));
    if (o.from) document.getElementById('batchFrom').value = String(o.from);
    if (o.to) document.getElementById('batchTo').value = String(o.to);
    if (o.regenerate != null) document.getElementById('batchRegenerate').checked = !!o.regenerate;
    if (o.perChapterDownload != null) document.getElementById('batchPerChapterDownload').checked = !!o.perChapterDownload;
    if (o.cap) { const c = document.getElementById('batchTokenCap'); c.value = String(o.cap); c.dispatchEvent(new Event('input')); }
    h.cfg = o.cfg || {};
    if (o.resetCounters) { h.calls.length = 0; h.dialogs.length = 0; h.downloads.length = 0; h.statusSeen.length = 0; h.lastExport = null; h.auditCalls.length = 0; }
    const t0 = Date.now();
    const r = o.resume ? await resumeBatchRun() : await generateAllChapters();
    const s = h.snap(r);
    s.ms = Date.now() - t0;
    return s;
  }, opts);
}
const callsFor = (s, ch) => s.calls.filter((c) => c.ch === ch).length;
const sessionDl = (s) => s.downloads.filter((d) => /\.json$/i.test(d)).length;
const chapterDl = (s) => s.downloads.filter((d) => /_ch\d+\.txt$/.test(d)).length;
const batchDialogTotals = [];

// ---------------- PS: pre-start (thin ch5) ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async (nd) => {
    const h = window.__h; h.load(nd);
    let readinessThrew = null;
    try { assertAdvanceToTab5ReadinessOrThrow(novelData); } catch (e) { readinessThrew = String(e.message || e); }
    const readinessAlerts = h.dialogs.length;
    h.dialogs.length = 0;
    const ga = await generateAllChapters();
    const s = h.snap(ga);
    h.dialogs.length = 0;
    let genThrew = null;
    try { await generateChapter(5); } catch (e) { genThrew = String(e.message || e); }
    return { readinessThrew, readinessAlerts, s, genThrew, genCalls: h.calls.length, genAlerts: h.dialogs.slice(), ch5: novelData.chapters[4] };
  }, thin(ND, 5));
  check('PS', 'thin ch5: assertAdvanceToTab5ReadinessOrThrow is not-ready (throws TAB5 READINESS FAIL-CLOSED)', r.readinessThrew && /^TAB5 READINESS FAIL-CLOSED/.test(r.readinessThrew) && /ch5/.test(r.readinessThrew), r.readinessThrew);
  check('PS', 'Generate All refuses to start: started=false reason=preflight, 0 provider calls, no batchRun, no checkpoint', r.s.r.started === false && r.s.r.reason === 'preflight' && r.s.calls.length === 0 && r.s.br === null && r.s.puts === 0, JSON.stringify(r.s.r));
  check('PS', 'refusal status names ch5 and the "' + BUTTON + '" button, Go to Tab 4 shown, 0 dialogs', /ch5: sceneGoal missing, dialogueTurn stub/.test(r.s.status) && r.s.status.includes(BUTTON) && r.s.goTab4 && r.s.dialogs.length === 0 && r.s.state === 'blocked', r.s.status + ' / ' + JSON.stringify(r.s.dialogs));
  check('PS', 'single-chapter Generate ch5 hard-blocked: gate throws, 0 provider calls, no text', r.genThrew && /^STAGE GATE FAIL-CLOSED \[generateChapter 5\]/.test(r.genThrew) && r.genCalls === 0 && !r.ch5, JSON.stringify([r.genThrew, r.genCalls]));
  check('PS', 'status line is role=status data-testid=nw-batch-status', r.s.statusRole === 'status' && r.s.statusTestId === 'nw-batch-status', JSON.stringify([r.s.statusRole, r.s.statusTestId]));
  await page.close();
}

// ---------------- G1: full run ----------------
{
  const page = await openPage();
  const s = await batch(page, { nd: ND });
  batchDialogTotals.push(s.dialogs.length);
  check('G1', 'full run 1..4: completed [1,2,3,4], reason done, stoppedAt null, inFlight null', s.r.started && eq(s.br.completed, [1, 2, 3, 4]) && s.br.reason === 'done' && s.br.stoppedAt === null && s.br.inFlight === null, JSON.stringify(s.br));
  check('G1', 'clean run: 0 session downloads (auto-export only on stop), 0 per-chapter downloads', sessionDl(s) === 0 && chapterDl(s) === 0 && s.downloads.length === 0, JSON.stringify(s.downloads));
  check('G1', '8 provider calls (2 parts x 4), chapters 1-4 text in novelData and Tab 5 textareas, ch5 untouched', s.calls.length === 8 && s.chapters.slice(0, 4).every((t, i) => t.startsWith('Chapter ' + (i + 1) + ' part 1')) && s.genDom.every((t, i) => t === s.chapters[i]) && !s.chapters[4], JSON.stringify(s.calls));
  check('G1', 'tokensUsed = real recorded usage (8 x 1000), estimate source fallback = maxTokens 1000 x 4 passes, default cap = ceil(total x 1.25)', s.br.tokensUsed === 8000 && s.br.estimate.source === 'fallback' && s.br.estimate.perChapter === 4000 && s.br.cap === 20000 && eq(s.br.usageEstimated, []), JSON.stringify(s.br));
  check('G1', 'status "Done ... Completed: 1, 2, 3, 4", controls unlocked, Pause disabled, Resume disabled (done)', /^Done: ch1-4\. Completed: 1, 2, 3, 4\./.test(s.status) && s.pauseDisabled && s.resumeDisabled && !s.running && !s.quiet, s.status);
  check('G1', 'after a session-informed run the estimate source is "session" (mean real tokens per chapter = 2000)', s.estimate.source === 'session' && s.estimate.perChapter === 2000, JSON.stringify(s.estimate));
  const idb = await page.evaluate(() => new Promise((res) => {
    const q = indexedDB.open('novelwriter');
    q.onsuccess = () => { const g = q.result.transaction('checkpoints').objectStore('checkpoints').getAll(); g.onsuccess = () => res(g.result); };
    q.onerror = () => res(null);
  }));
  const rec = (idb || [])[0] || {};
  check('G1', 'IndexedDB novelwriter/checkpoints holds the run (key title|startedAt), inactive after done, novelData has no apiKey', (idb || []).length === 1 && rec.key === s.br.id && /\|\d{4}-/.test(rec.key) && rec.active === false && rec.batchRun.reason === 'done' && rec.novelData && !('apiKey' in rec.novelData) && rec.novelData.chapters[3].startsWith('Chapter 4'), JSON.stringify({ n: (idb || []).length, key: rec.key, active: rec.active, hasKey: rec.novelData && 'apiKey' in rec.novelData }));
  check('G1', 'checkpoint writes: inFlight + done per chapter (8) + final (1)', s.puts === 9, s.puts);
  const s2 = await batch(page, { nd: ND, perChapterDownload: true, resetCounters: true });
  check('G1', 'opt-in per-chapter download: 4 x <title>_ch<n>.txt, 0 session exports (clean run)', chapterDl(s2) === 4 && sessionDl(s2) === 0 && s2.downloads.length === 4 && s2.downloads.slice(0, 4).every((d, i) => d.endsWith('_ch' + (i + 1) + '.txt')), JSON.stringify(s2.downloads));
  await page.close();
}

// ---------------- G2: thin chapter ----------------
{
  const page = await openPage();
  const a = await batch(page, { nd: thin(ND, 3) });
  batchDialogTotals.push(a.dialogs.length);
  check('G2', '(a) ch3 thin before start: preflight blocks, status names ch3 and the Enrich button, callAI never called', a.r.reason === 'preflight' && a.calls.length === 0 && /ch3: sceneGoal missing, dialogueTurn stub/.test(a.status) && a.status.includes(BUTTON) && a.br === null && a.dialogs.length === 0, a.status);
  const shortOutline = clone(ND); shortOutline.chapterOutlines[1] = 'Two words.';
  const a2 = await batch(page, { nd: shortOutline, resetCounters: true });
  check('G2', '(a) chapter outline under 80 words in range blocks preflight (same floor as the single-chapter gate)', a2.r.reason === 'preflight' && /ch2: chapter outline stub-thin words=2/.test(a2.status) && a2.calls.length === 0, a2.status);
  const b = await batch(page, { nd: ND, cfg: { blankBeatAt: '2:2', blankBeatTarget: 3 }, resetCounters: true });
  batchDialogTotals.push(b.dialogs.length);
  check('G2', '(b) ch3 thinned mid-run: stops at 3 with reason gate (per-chapter gate, PR1 fix 4)', b.br.reason === 'gate' && b.br.stoppedAt === 3 && /^STAGE GATE FAIL-CLOSED \[generateChapter 3\]: ch3: dialogueTurn missing/.test(b.br.detail || ''), JSON.stringify(b.br));
  check('G2', '(b) ch1-2 text kept and completed, ch3 + ch4 never attempted (0 calls), ch3 empty', eq(b.br.completed, [1, 2]) && b.chapters[0] && b.chapters[1] && !b.chapters[2] && callsFor(b, 3) === 0 && callsFor(b, 4) === 0, JSON.stringify(b.calls));
  check('G2', '(b) status "Stopped at ch3 (gate): ... Completed: 1, 2.", 0 dialogs, one session download', /^Stopped at ch3 \(gate\): .*Completed: 1, 2\./.test(b.status) && b.dialogs.length === 0 && sessionDl(b) === 1, b.status);
  await page.close();
}

// ---------------- G3: pause / resume ----------------
{
  const page = await openPage();
  const s = await batch(page, { nd: ND, cfg: { pauseAt: '2:1' } });
  batchDialogTotals.push(s.dialogs.length);
  const pauseEnabled = await page.evaluate(() => window.__h.pauseBtnEnabled);
  check('G3', 'Pause button enabled while the run is active (clicked during ch2 Part 1)', pauseEnabled === true, pauseEnabled);
  check('G3', 'pause during ch2: ch2 finishes, reason paused, stoppedAt 3, ch3 not started', s.br.reason === 'paused' && s.br.stoppedAt === 3 && eq(s.br.completed, [1, 2]) && callsFor(s, 2) === 2 && callsFor(s, 3) === 0 && s.chapters[1] && !s.chapters[2], JSON.stringify(s.br));
  check('G3', 'Resume enabled after pause, Pause disabled, status "Paused before ch3"', !s.resumeDisabled && s.pauseDisabled && /^Paused before ch3\. Completed: 1, 2\./.test(s.status), s.status);
  const r = await batch(page, { resume: true, resetCounters: true });
  check('G3', 'resume starts at 3 (first call ch3) and finishes: completed [1,2,3,4], reason done', r.calls.length === 4 && r.calls[0].ch === 3 && callsFor(r, 1) === 0 && callsFor(r, 2) === 0 && eq(r.br.completed, [1, 2, 3, 4]) && r.br.reason === 'done' && r.br.id === s.br.id, JSON.stringify(r.calls));
  check('G3', 'tokensUsed carries across resume (8 x 1000)', r.br.tokensUsed === 8000, r.br.tokensUsed);
  check('G3', 'export only on stop: paused run 1 session export, clean resumed finish 0', sessionDl(s) === 1 && sessionDl(r) === 0, JSON.stringify([s.downloads, r.downloads]));
  await page.close();
}

// ---------------- G4: budget ----------------
{
  const page = await openPage();
  const s = await batch(page, { nd: ND, cap: 3000 });
  batchDialogTotals.push(s.dialogs.length);
  check('G4', 'cap 3000 < 2 chapters of usage (4000): stops after ch2 (the chapter that crossed it), reason budget', s.br.reason === 'budget' && s.br.stoppedAt === 2 && s.br.cap === 3000 && s.br.tokensUsed === 4000, JSON.stringify(s.br));
  check('G4', 'ch2 text saved and completed; ch3 never attempted', eq(s.br.completed, [1, 2]) && s.chapters[1].startsWith('Chapter 2') && callsFor(s, 3) === 0, JSON.stringify(s.calls));
  check('G4', 'status names budget and real usage; Resume enabled', /Stopped at ch2 \(budget\): real usage 4000 tokens reached the cap 3000/.test(s.status) && !s.resumeDisabled, s.status);
  const r0 = await batch(page, { resume: true, resetCounters: true });
  check('M3', 'cap pre-check: Resume with the cap unchanged makes 0 provider calls, reason budget at ch3, 0 dialogs', r0.calls.length === 0 && r0.br.reason === 'budget' && r0.br.stoppedAt === 3 && r0.br.cap === 3000 && eq(r0.br.completed, [1, 2]) && r0.dialogs.length === 0 && r0.r.started === true, JSON.stringify({ calls: r0.calls, br: r0.br }));
  check('M3', 'cap pre-check status is exactly "Token cap reached (4000/3000). Raise the cap to continue."', r0.status === 'Token cap reached (4000/3000). Raise the cap to continue.', r0.status);
  const r1 = await batch(page, { resume: true, cap: 20000, resetCounters: true });
  check('M3', 'raise the cap and Resume: proceeds from ch3 and finishes [1,2,3,4]', r1.calls[0] && r1.calls[0].ch === 3 && r1.br.cap === 20000 && eq(r1.br.completed, [1, 2, 3, 4]) && r1.br.reason === 'done', JSON.stringify({ calls: r1.calls, br: r1.br }));
  await page.close();
}

// ---------------- G5: no overwrite ----------------
{
  const page = await openPage();
  const OLD = 'Existing chapter two text written by hand. It must survive.';
  const s = await batch(page, { nd: ND, prefill: { 2: OLD } });
  batchDialogTotals.push(s.dialogs.length);
  check('G5', 'ch2 pre-filled: skipped, text unchanged, not in completed, 0 calls for ch2', eq(s.br.completed, [1, 3, 4]) && s.chapters[1] === OLD && s.genDom[1] === OLD && callsFor(s, 2) === 0 && s.br.reason === 'done', JSON.stringify(s.br));
  check('G5', 'skipped chapter listed in the status line', /Skipped \(existing text\): 2\./.test(s.status), s.status);
  const page2 = await openPage();
  const r = await batch(page2, { nd: ND, prefill: { 2: OLD }, regenerate: true, cfg: { failProvider: { 2: 2 } } });
  batchDialogTotals.push(r.dialogs.length);
  check('G5', 'regenerate on + provider failure on ch2: old text restored (novelData + Tab 5/6 textareas), reason provider', r.br.reason === 'provider' && r.br.stoppedAt === 2 && r.chapters[1] === OLD && r.genDom[1] === OLD && eq(r.br.completed, [1]), JSON.stringify({ br: r.br, ch2: r.chapters[1] }));
  await page.close();
  await page2.close();
}

// ---------------- G6: single chapter unchanged ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async (nd) => {
    const h = window.__h; h.load(nd);
    let threw = null;
    try { await generateChapter(1); } catch (e) { threw = String(e.message || e); }
    const ok = { threw, batchRun: novelData.batchRun === undefined ? 'absent' : 'present', calls: h.calls.length, puts: h.puts, dialogs: h.dialogs.slice(), text: novelData.chapters[0], quiet: nwBatchState.quiet };
    novelData.chapterBlueprints[1].dialogueTurn = '';
    h.calls.length = 0;
    const expected = scoreGenerateChapterGate(novelData, 1).message;
    let threw2 = null;
    try { await generateChapter(1); } catch (e) { threw2 = String(e.message || e); }
    return { ok, gate: { threw: threw2, expected, calls: h.calls.length, dialogs: h.dialogs.slice(), batchRun: novelData.batchRun === undefined ? 'absent' : 'present', puts: h.puts } };
  }, ND);
  check('G6', 'generateChapter(1) outside a batch: 2 calls, text stored, no batchRun created, no checkpoint write, 0 dialogs', !r.ok.threw && r.ok.calls === 2 && /^Chapter 1 part 1/.test(r.ok.text) && r.ok.batchRun === 'absent' && r.ok.puts === 0 && r.ok.dialogs.length === 0 && r.ok.quiet === false, JSON.stringify(r.ok));
  check('G6', 'gate unchanged outside a batch: throws the scoreGenerateChapterGate message, alerts it exactly once, 0 calls', r.gate.threw === r.gate.expected && /^STAGE GATE FAIL-CLOSED \[generateChapter 1\]: ch2: dialogueTurn missing/.test(r.gate.threw) && r.gate.dialogs.length === 1 && r.gate.dialogs[0] === 'alert: ' + r.gate.expected.slice(0, 200) && r.gate.calls === 0 && r.gate.batchRun === 'absent', JSON.stringify(r.gate));
  await page.close();
}

// ---------------- G7: provider error ----------------
{
  const page = await openPage();
  const s = await batch(page, { nd: ND, cfg: { failProvider: { 2: 2 } } });
  batchDialogTotals.push(s.dialogs.length);
  const ch2p1 = s.calls.filter((c) => c.ch === 2 && c.part === 1).length;
  check('G7', 'ch2 fails twice (HTTP 503): exactly 2 attempts (1 retry), reason provider, stoppedAt 2', ch2p1 === 2 && s.br.reason === 'provider' && s.br.stoppedAt === 2 && /after 1 retry: HTTP error! Status: 503/.test(s.br.detail || ''), JSON.stringify({ calls: s.calls, br: s.br }));
  check('G7', 'ch1 kept and completed, ch2 empty, ch3 never attempted', eq(s.br.completed, [1]) && s.chapters[0] && !s.chapters[1] && !s.genDom[1] && callsFor(s, 3) === 0, JSON.stringify(s.chapters));
  check('G7', 'single retry waits NW_BATCH.retryDelayMs = 2000 (no loop)', s.ms >= 1900 && s.ms < 15000, s.ms);
  check('G7', 'provider stop: status "(provider)" + provider hint (not parse); stopped run => exactly 1 session export', /^Stopped at ch2 \(provider\): .*Provider error \(retried once where retryable\); Resume regenerates ch2\./.test(s.status) && !/\(parse\)|could not be parsed/.test(s.status) && sessionDl(s) === 1, s.status + ' / ' + JSON.stringify(s.downloads));
  const r = await batch(page, { nd: ND, cfg: { failProvider: { 2: 1 } }, resetCounters: true });
  check('G7', 'one 503 on ch2 then success: retry recovers, run completes [1,2,3,4]', r.br.reason === 'done' && eq(r.br.completed, [1, 2, 3, 4]) && r.calls.filter((c) => c.ch === 2 && c.part === 1).length === 2, JSON.stringify(r.br));
  await page.close();
}

// ---------------- E1: checkpoint failure ----------------
{
  const page = await openPage();
  const s = await batch(page, { nd: ND, cfg: { putThrowAfter: 2 } });
  batchDialogTotals.push(s.dialogs.length);
  check('E1', 'put throws QuotaExceededError after ch1: run stops with reason checkpoint at ch2', s.br.reason === 'checkpoint' && s.br.stoppedAt === 2 && /QuotaExceededError|quota exceeded/i.test(s.br.detail || ''), JSON.stringify(s.br));
  check('E1', 'ch2 callAI never invoked; ch1 completed and kept', callsFor(s, 2) === 0 && eq(s.br.completed, [1]) && s.chapters[0] && s.calls.length === 2, JSON.stringify(s.calls));
  check('E1', 'visible "Checkpoint failed: run stopped. Export your session now." + export button; session export downloaded', /^Checkpoint failed: run stopped\. Export your session now\./.test(s.status) && s.exportNow && sessionDl(s) === 1 && s.state === 'checkpoint', s.status);
  check('E1', 'controls unlocked after the stop (not running), 0 dialogs', !s.running && s.pauseDisabled && s.dialogs.length === 0, JSON.stringify(s.dialogs));
  await page.close();
}

// ---------------- E2: single writer + reload ----------------
{
  const page = await openPage();
  await page.evaluate((nd) => { const h = window.__h; h.load(nd); h.cfg = { hangAt: '2:1' }; window.__p = generateAllChapters(); }, ND);
  await page.waitForFunction(() => window.__h.hanging === true, null, { timeout: 20000 });
  const lock = await page.evaluate(async () => {
    const all = (sel) => Array.from(document.querySelectorAll(sel));
    const gen = all('#chapterGenContainer button').filter((b) => /Generate Chapter/.test(b.textContent || ''));
    const edits = all('textarea[id^="chapterEditContent"]');
    const editBtns = all('#chapterEditContainer button');
    const before = window.__h.calls.length;
    await generateChapter(3);
    let resetThrew = null;
    try { resetState(); } catch (e) { resetThrew = String(e.message || e); }
    return {
      gen: gen.length, genDisabled: gen.every((b) => b.disabled), edits: edits.length, editsLocked: edits.every((t) => t.disabled && t.readOnly),
      editBtns: editBtns.length, editBtnsDisabled: editBtns.every((b) => b.disabled), importDisabled: document.getElementById('importFile').disabled,
      genAllDisabled: document.getElementById('batchGenerateAllBtn').disabled, pauseEnabled: !document.getElementById('batchPauseBtn').disabled,
      directGenCalls: window.__h.calls.length - before, resetThrew, inFlight: novelData.batchRun.inFlight, title: novelData.title
    };
  });
  check('E2', 'during a run: all per-chapter Generate buttons disabled', lock.gen === 18 && lock.genDisabled, JSON.stringify(lock));
  check('E2', 'during a run: chapterEditContent* disabled + readonly; Update Chapter / Spelling disabled; importSession input disabled', lock.edits === 18 && lock.editsLocked && lock.editBtns === 36 && lock.editBtnsDisabled && lock.importDisabled, JSON.stringify(lock));
  check('E2', 'during a run: direct generateChapter(3) is refused (0 calls) and resetState throws; Pause enabled, Generate All disabled', lock.directGenCalls === 0 && /resetState locked/.test(lock.resetThrew || '') && lock.pauseEnabled && lock.genAllDisabled && lock.inFlight === 2, JSON.stringify(lock));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof generateAllChapters === 'function' && window.__nwBatchRestoreCheck, null, { timeout: 30000 });
  await page.evaluate(() => window.__nwBatchRestoreCheck);
  await installHarness(page);
  const after = await page.evaluate(() => {
    const gen = Array.from(document.querySelectorAll('#chapterGenContainer button'));
    return {
      restoreBox: !document.getElementById('batchRestoreBox').hidden, status: document.getElementById('batchRunStatus').textContent,
      genDisabled: gen.length > 0 && gen.every((b) => b.disabled), edits: Array.from(document.querySelectorAll('textarea[id^="chapterEditContent"]')).every((t) => t.disabled),
      importDisabled: document.getElementById('importFile').disabled, resumeDisabled: document.getElementById('batchResumeBtn').disabled,
      batchRunBefore: novelData.batchRun === undefined ? 'absent' : 'present'
    };
  });
  check('E2', 'after reload mid-ch2: "Restore interrupted batch run" offered; per-chapter controls stay locked until restore', after.restoreBox && /Interrupted batch run found \(ch2 was in flight\)\. Completed: 1\./.test(after.status) && after.genDisabled && after.edits && after.importDisabled && after.resumeDisabled, JSON.stringify(after));
  const restored = await page.evaluate(async () => {
    const ok = await restoreInterruptedBatchRun();
    const s = window.__h.snap(null);
    s.restoredOk = ok;
    s.title = novelData.title;
    s.genEnabled = Array.from(document.querySelectorAll('#chapterGenContainer button')).every((b) => !b.disabled);
    s.apiKeyInData = novelData.apiKey;
    return s;
  });
  check('E2', 'after restore: inFlight null, ch2 not in completed, reason user, stoppedAt 2', restored.restoredOk && restored.br.inFlight === null && eq(restored.br.completed, [1]) && restored.br.reason === 'user' && restored.br.stoppedAt === 2, JSON.stringify(restored.br));
  check('E2', 'after restore: ch1 text restored from the checkpoint, ch2 at its pre-chapter snapshot (empty), Resume enabled, controls unlocked', /^Chapter 1 part 1/.test(restored.chapters[0]) && restored.genDom[0] === restored.chapters[0] && !restored.chapters[1] && !restored.resumeDisabled && !restored.restoreBox && restored.genEnabled && restored.title === lock.title, JSON.stringify({ ch: restored.chapters.slice(0, 2), resumeDisabled: restored.resumeDisabled, genEnabled: restored.genEnabled }));
  const r = await batch(page, { resume: true, resetCounters: true });
  check('E2', 'Resume starts at 2 and finishes; completed [1,2,3,4], reason done, same run id', r.calls[0] && r.calls[0].ch === 2 && eq(r.br.completed, [1, 2, 3, 4]) && r.br.reason === 'done' && r.br.id === restored.br.id, JSON.stringify(r.br));
  check('E2', 'provider calls per chapter after reload: ch1 0 (not regenerated), ch2 2, ch3 2, ch4 2', callsFor(r, 1) === 0 && callsFor(r, 2) === 2 && callsFor(r, 3) === 2 && callsFor(r, 4) === 2, JSON.stringify(r.calls));
  batchDialogTotals.push(r.dialogs.length);
  await page.close();
}

// ---------------- E3: cap vs real usage ----------------
{
  const page = await openPage();
  const s = await batch(page, { nd: ND, cap: 8000, cfg: { usagePerCall: 6000 } });
  batchDialogTotals.push(s.dialogs.length);
  check('E3', 'estimate is under the cap (fallback 1000 x 4 passes = 4000 < 8000) while real usage is 3x (12000)', s.br.estimate.source === 'fallback' && s.br.estimate.perChapter === 4000 && s.br.estimate.perChapter < s.br.cap && s.br.tokensUsed === 12000, JSON.stringify(s.br));
  check('E3', 'stops after ch1 by real usage: reason budget, stoppedAt 1, ch2 never attempted, usageEstimated empty', s.br.reason === 'budget' && s.br.stoppedAt === 1 && eq(s.br.completed, [1]) && callsFor(s, 2) === 0 && eq(s.br.usageEstimated, []), JSON.stringify(s.br));
  const page2 = await openPage();
  const n = await batch(page2, { nd: ND, to: 2, cfg: { noUsage: true } });
  batchDialogTotals.push(n.dialogs.length);
  check('E3', 'provider returns no usage: estimate used (2 x 4000), chapters listed in usageEstimated, run completes', n.br.reason === 'done' && n.br.tokensUsed === 8000 && eq(n.br.usageEstimated, [1, 2]) && eq(n.br.completed, [1, 2]) && /Usage estimated \(no provider usage\) for: 1, 2\./.test(n.status), JSON.stringify(n.br));
  await page.close();
  await page2.close();
}

// ---------------- E4: no modals; stop reasons ----------------
{
  const page = await openPage();
  const a = await batch(page, { nd: ND, cfg: { qualityThrow: 2 } });
  check('E4', 'full stubbed batch completes with zero alert/confirm/prompt calls', a.br.reason === 'done' && eq(a.br.completed, [1, 2, 3, 4]) && a.dialogs.length === 0, JSON.stringify(a.dialogs));
  check('E4', 'quality-gate error goes to the status line (Note: ...) and the run continues', a.statusSeen.some((t) => /Note: Chapter 2 quality gate\/revise error \(run continues\): smoke quality judge unavailable ch2/.test(t)) && a.log.some((x) => x.level === 'warn' && /quality gate/.test(x.msg)), JSON.stringify(a.statusSeen.slice(0, 6)));
  check('E4', 'nwNotify is quiet only during the batch (quiet=false after)', a.quiet === false, a.quiet);
  const c = await batch(page, { nd: ND, cfg: { coverageFail: 2 }, resetCounters: true });
  check('E4', 'coverage failure on ch2 stops: reason coverage, stoppedAt 2, ch2 text kept, not completed, 0 dialogs', c.br.reason === 'coverage' && c.br.stoppedAt === 2 && /^OBLIGATION COVERAGE FAIL-CLOSED \[chapter 2\]/.test(c.br.detail || '') && /^Chapter 2 part 1/.test(c.chapters[1]) && eq(c.br.completed, [1]) && c.dialogs.length === 0 && callsFor(c, 3) === 0, JSON.stringify(c.br));
  const c1 = await batch(page, { resume: true, resetCounters: true });
  check('E4', 'coverage resume: first Resume asks for confirmation on the status line (no modal, no calls)', c1.r.started === false && c1.r.reason === 'confirm-coverage' && /ch2 failed obligation coverage and needs review/.test(c1.status) && c1.calls.length === 0 && c1.dialogs.length === 0, JSON.stringify(c1.r));
  const c2 = await batch(page, { resume: true, resetCounters: true });
  check('E4', 'coverage resume: second Resume continues from ch3; ch2 text kept and still not completed', c2.r.started && c2.calls[0].ch === 3 && callsFor(c2, 2) === 0 && eq(c2.br.completed, [1, 3, 4]) && /^Chapter 2 part 1/.test(c2.chapters[1]) && c2.br.reason === 'done', JSON.stringify(c2.br));
  // coverage stop with regenerate on: old text restored, rejected draft kept aside (export only, never checkpointed)
  const OLD2 = 'Hand-written chapter two that must be restored after a coverage failure.';
  const putsRejBefore = await page.evaluate(() => window.__h.putsWithRejected);
  const cr = await batch(page, { nd: ND, prefill: { 2: OLD2 }, regenerate: true, cfg: { coverageFail: 2 }, resetCounters: true });
  const crx = await page.evaluate(async (id) => {
    const h = window.__h;
    const exp = h.lastExport ? JSON.parse(await h.lastExport.text()) : null;
    const recs = await new Promise((res) => {
      const q = indexedDB.open('novelwriter');
      q.onsuccess = () => { const g = q.result.transaction('checkpoints').objectStore('checkpoints').getAll(); g.onsuccess = () => res(g.result); };
      q.onerror = () => res([]);
    });
    const rec = recs.find((x) => x.key === id) || null;
    return { exp: exp && exp.novelData && exp.novelData.batchRun ? exp.novelData.batchRun.rejectedDraft || null : 'no-export', recBr: rec ? rec.batchRun : null, recNdHasBr: !!(rec && rec.novelData && rec.novelData.batchRun), putsWithRejected: h.putsWithRejected };
  }, cr.br.id);
  const rd = cr.br.rejectedDraft || {};
  check('E4', 'coverage stop (regenerate on): reason coverage at ch2, OLD ch2 text restored in novelData + Tab 5', cr.br.reason === 'coverage' && cr.br.stoppedAt === 2 && cr.chapters[1] === OLD2 && cr.genDom[1] === OLD2 && eq(cr.br.completed, [1]), JSON.stringify({ br: cr.br, ch2: cr.chapters[1] }));
  check('E4', 'coverage stop (regenerate on): batchRun.rejectedDraft = {chapter 2, rejected new text, coverage detail}', rd.chapter === 2 && /^Chapter 2 part 1/.test(rd.text || '') && /^OBLIGATION COVERAGE FAIL-CLOSED \[chapter 2\]/.test(rd.detail || '') && eq(Object.keys(rd).sort(), ['chapter', 'detail', 'text']), JSON.stringify(rd));
  check('E4', 'coverage stop status says the rejected draft was kept aside in the session export', /Stopped at ch2 \(coverage\): .*Old ch2 text restored; rejected draft kept aside in session export/.test(cr.status), cr.status);
  check('E4', 'rejectedDraft is never written to an IndexedDB checkpoint (no put carried it; stored record has none)', crx.putsWithRejected === putsRejBefore && crx.recBr && !('rejectedDraft' in crx.recBr) && !crx.recNdHasBr, JSON.stringify({ before: putsRejBefore, after: crx.putsWithRejected, recBrKeys: crx.recBr && Object.keys(crx.recBr) }));
  check('E4', 'session export (1 download) contains batchRun.rejectedDraft for ch2', sessionDl(cr) === 1 && crx.exp && crx.exp.chapter === 2 && crx.exp.text === rd.text && crx.exp.detail === rd.detail, JSON.stringify({ dl: cr.downloads, exp: crx.exp }));
  const g = await batch(page, { nd: ND, cfg: { blankBeatAt: '1:2', blankBeatTarget: 2 }, resetCounters: true });
  check('E4', 'gate failure stops with reason gate recorded in batchRun.stoppedAt/reason, 0 dialogs', g.br.reason === 'gate' && g.br.stoppedAt === 2 && g.dialogs.length === 0 && eq(g.br.completed, [1]), JSON.stringify(g.br));
  const p = await batch(page, { nd: ND, cfg: { parseFail: '3:1' }, resetCounters: true });
  check('E4', 'Part 1 parse failure on ch3 stops the batch at 3 (reason parse, detail parse failure, no retry)', p.br.reason === 'parse' && p.br.stoppedAt === 3 && /^Part 1 parse failure \(no retry\)/.test(p.br.detail || '') && p.calls.filter((x) => x.ch === 3).length === 1, JSON.stringify({ br: p.br, calls: p.calls }));
  check('E4', 'parse failure: ch1-2 kept, ch3 empty, ch4 never attempted, 0 dialogs', eq(p.br.completed, [1, 2]) && p.chapters[0] && p.chapters[1] && !p.chapters[2] && callsFor(p, 4) === 0 && p.dialogs.length === 0, JSON.stringify(p.chapters));
  check('E4', 'parse stop status: "(parse)" + parse hint, not the provider wording; Resume enabled', /^Stopped at ch3 \(parse\): Part 1 parse failure \(no retry\).*Response could not be parsed \(no retry\); Resume regenerates ch3\./.test(p.status) && !/\(provider\)|Provider error/.test(p.status) && !p.resumeDisabled, p.status);
  // explicit cap edit: Resume now keeps the saved run cap (must-fix 4), which this 4-chapter run would reach exactly at ch4
  const pr = await batch(page, { resume: true, cap: 50000, resetCounters: true });
  check('E4', 'Resume after the Part 1 parse stop on ch3 calls the provider for ch3 again (first call ch3, both parts) and completes it', pr.r.started && pr.calls[0] && pr.calls[0].ch === 3 && callsFor(pr, 3) === 2 && /^Chapter 3 part 1/.test(pr.chapters[2]) && eq(pr.br.completed, [1, 2, 3, 4]) && pr.br.reason === 'done' && pr.br.id === p.br.id, JSON.stringify({ r: pr.r, calls: pr.calls, br: pr.br }));
  const p2 = await batch(page, { nd: ND, cfg: { parseFail: '2:2' }, resetCounters: true });
  check('E4', 'Part 2 parse failure on ch2 also stops (reason parse, parse failure)', p2.br.reason === 'parse' && p2.br.stoppedAt === 2 && /^Part 2 parse failure/.test(p2.br.detail || '') && eq(p2.br.completed, [1]) && p2.dialogs.length === 0 && !p2.chapters[1], JSON.stringify(p2.br));
  const p2r = await batch(page, { resume: true, resetCounters: true });
  check('E4', 'Resume after the Part 2 parse stop on ch2 regenerates ch2 (provider called for ch2 Part 1 + Part 2) and completes it', p2r.r.started && p2r.calls[0] && p2r.calls[0].ch === 2 && p2r.calls[0].part === 1 && callsFor(p2r, 2) === 2 && /^Chapter 2 part 1/.test(p2r.chapters[1]) && eq(p2r.br.completed, [1, 2, 3, 4]) && p2r.br.reason === 'done', JSON.stringify({ r: p2r.r, calls: p2r.calls, br: p2r.br }));
  for (const x of [a, c, c1, c2, cr, g, p, pr, p2, p2r]) batchDialogTotals.push(x.dialogs.length);
  await page.close();
}

// ---------------- M1: _jsonParseError marker (real gateway shape) ----------------
{
  const page = await openPage();
  const a = await batch(page, { nd: ND, cfg: { jsonErrAt: '3:1' } });
  check('M1', 'Part 1 _jsonParseError on ch3: reason parse, stoppedAt 3, detail names the marker, exactly 1 call for ch3 (no retry, no Part 2)', a.br.reason === 'parse' && a.br.stoppedAt === 3 && /^Part 1 parse failure \(no retry\): model JSON parse error \(_jsonParseError\)/.test(a.br.detail || '') && callsFor(a, 3) === 1 && !a.calls.some((c) => c.ch === 3 && c.part === 2), JSON.stringify({ br: a.br, calls: a.calls }));
  check('M1', 'Part 1 _jsonParseError: malformed text never stored or completed (ch3 empty, completed [1,2]), ch4 not attempted', !a.chapters[2] && !a.genDom[2] && eq(a.br.completed, [1, 2]) && callsFor(a, 4) === 0 && /\(parse\)/.test(a.status), JSON.stringify({ ch3: a.chapters[2], completed: a.br.completed }));
  const b = await batch(page, { nd: ND, cfg: { jsonErrAt: '2:2' }, resetCounters: true });
  check('M1', 'Part 2 _jsonParseError on ch2: reason parse, no retry (2 calls: Part 1 + Part 2), ch2 empty, completed [1]', b.br.reason === 'parse' && b.br.stoppedAt === 2 && /^Part 2 parse failure \(no retry\): model JSON parse error/.test(b.br.detail || '') && callsFor(b, 2) === 2 && !b.chapters[1] && eq(b.br.completed, [1]) && b.dialogs.length === 0, JSON.stringify({ br: b.br, calls: b.calls }));
  batchDialogTotals.push(a.dialogs.length, b.dialogs.length);
  await page.close();
}

// ---------------- M2: error classification (no retry for 400/401/403/missing key) ----------------
{
  const page = await openPage();
  const long = 'Bad request: max_tokens exceeds the model limit. ' + 'detail '.repeat(60);
  const cases = [
    { label: 'HTTP 400', msg: 'HTTP error! Status: 400, Text: ' + long, want: (st) => /HTTP 400, not retried\): Bad request: max_tokens exceeds the model limit\./.test(st) && !st.includes(long.trim()) && !/Check your API key/.test(st) },
    { label: 'HTTP 401', msg: 'HTTP error! Status: 401, Text: {"error":"Incorrect API key provided"}', want: (st) => /HTTP 401, not retried\): Check your API key in Setup/.test(st) },
    { label: 'HTTP 403', msg: 'HTTP error! Status: 403, Text: {"error":"forbidden"}', want: (st) => /HTTP 403, not retried\): Check your API key in Setup/.test(st) },
    { label: 'missing key', msg: 'API Key is missing', want: (st) => /API key missing, not retried\): Check your API key in Setup/.test(st) }
  ];
  for (const c of cases) {
    const s = await batch(page, { nd: ND, cfg: { throwAt: { key: '2:1', msg: c.msg } }, resetCounters: true });
    batchDialogTotals.push(s.dialogs.length);
    check('M2', c.label + ': reason provider at ch2, 0 retries (1 call for ch2), no usageEstimated entry, tokens = ch1 real usage only', s.br.reason === 'provider' && s.br.stoppedAt === 2 && callsFor(s, 2) === 1 && eq(s.br.usageEstimated, []) && s.br.tokensUsed === 2000 && eq(s.br.completed, [1]) && s.dialogs.length === 0, JSON.stringify({ br: s.br, calls: s.calls }));
    check('M2', c.label + ': status line wording (' + (c.label === 'HTTP 400' ? 'provider message, truncated' : 'Check your API key in Setup') + '), "Not retried", not the parse wording', /^Stopped at ch2 \(provider\): /.test(s.status) && c.want(s.status) && /Not retried; Resume regenerates ch2\./.test(s.status) && !/could not be parsed/.test(s.status), s.status);
  }
  await page.close();
}

// ---------------- M4: user cap kept through reload + restore + Resume, and after import ----------------
{
  const page = await openPage();
  await page.evaluate((nd) => {
    const h = window.__h; h.load(nd);
    const c = document.getElementById('batchTokenCap'); c.value = '50000'; c.dispatchEvent(new Event('input'));
    h.cfg = { hangAt: '2:1' }; window.__p = generateAllChapters();
  }, ND);
  await page.waitForFunction(() => window.__h.hanging === true, null, { timeout: 20000 });
  const capMid = await page.evaluate(() => novelData.batchRun.cap);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof generateAllChapters === 'function' && window.__nwBatchRestoreCheck, null, { timeout: 30000 });
  await page.evaluate(() => window.__nwBatchRestoreCheck);
  await installHarness(page);
  const rest = await page.evaluate(async () => { await restoreInterruptedBatchRun(); const c = document.getElementById('batchTokenCap'); return { cap: novelData.batchRun.cap, input: c.value, edited: c.dataset.userEdited || '' }; });
  check('M4', 'after reload + restore: br.cap 50000 kept and shown in the cap input (userEdited cleared)', capMid === 50000 && rest.cap === 50000 && rest.input === '50000' && rest.edited === '', JSON.stringify({ capMid, rest }));
  const r = await batch(page, { resume: true, resetCounters: true });
  check('M4', 'Resume after restore keeps the user cap 50000 (not a fresh estimate) and finishes', r.br.cap === 50000 && r.br.reason === 'done' && eq(r.br.completed, [1, 2, 3, 4]) && r.calls[0].ch === 2, JSON.stringify(r.br));
  await page.close();
  // import path: a session with a paused batchRun (cap 54321); a stale userEdited cap from before the import is ignored
  const page2 = await openPage();
  await page2.evaluate(() => { const c = document.getElementById('batchTokenCap'); c.value = '999'; c.dataset.userEdited = '1'; });
  const sess = clone(ND); sess.chapters = ['Chapter 1 imported text.', 'Chapter 2 imported text.', '', '', ''].slice(0, sess.numChapters || 5);
  sess.batchRun = { id: 'import|2026-10-03T00:00:00.000Z', startedAt: '2026-10-03T00:00:00.000Z', updatedAt: '2026-10-03T00:00:00.000Z', range: { from: 1, to: 4 }, regenerateExisting: false, perChapterDownload: false, completed: [1, 2], inFlight: null, stoppedAt: 3, reason: 'paused', detail: 'paused before ch3', tokensUsed: 4000, estimate: { perChapter: 4000, total: 16000, source: 'fallback' }, cap: 54321, usageEstimated: [] };
  await page2.locator('#importFile').setInputFiles({ name: 'cap_session.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ schemaVersion: '1.0', sourceTool: 'NovelWriter', novelData: sess })) });
  await page2.waitForFunction(() => window.__h.dialogs.some((d) => /Session imported/.test(d)), null, { timeout: 15000 });
  const imp = await page2.evaluate(() => { const c = document.getElementById('batchTokenCap'); return { input: c.value, edited: c.dataset.userEdited || '' }; });
  const ri = await batch(page2, { resume: true, resetCounters: true });
  check('M4', 'imported session: cap input shows batchRun.cap 54321, Resume keeps cap 54321 and continues at ch3', imp.input === '54321' && imp.edited === '' && ri.br.cap === 54321 && ri.calls[0] && ri.calls[0].ch === 3 && ri.br.reason === 'done', JSON.stringify({ imp, br: ri.br, calls: ri.calls.slice(0, 2) }));
  await page2.close();
}

// ---------------- M5: lock scope ----------------
{
  const page = await openPage();
  await page.evaluate((nd) => {
    const h = window.__h; h.load(nd);
    novelData.bookImprovementsWithStatus = [{ text: 'Chapter 2: tighten the relay scene.', status: 'To Incorporate', breakdown: 'Chapter 2: cut the second lab tour.' }];
    updateBookImprovementsTable('Chapter 2: tighten the relay scene.');
    h.cfg = { hangAt: '2:1' }; window.__p = generateAllChapters();
  }, ND);
  await page.waitForFunction(() => window.__h.hanging === true, null, { timeout: 20000 });
  const lk = await page.evaluate(async () => {
    const race = (p) => Promise.race([Promise.resolve().then(p), new Promise((r) => setTimeout(() => r('timeout: handler ran and did not return'), 3000))]);
    const q = (sel) => Array.from(document.querySelectorAll(sel));
    const top = q('#tab7 button[onclick*="applyTopBookCritiques"]'), row = q('#improvementsTableBody button[onclick*="applyBookCritiqueItem"]'), integ = q('#tab8 button[onclick*="integrateBreakdownSuggestions"]');
    const before = window.__h.calls.length;
    const impBefore = JSON.stringify(novelData.chapterImprovements);
    const res = {};
    for (const [k, fn] of [['applyTop', () => applyTopBookCritiques(1)], ['applyItem', () => applyBookCritiqueItem(0)], ['updateChapter', () => updateChapter(3, { requireImprovements: false })]]) {
      try { const v = await race(fn); res[k] = typeof v === 'string' && /^timeout/.test(v) ? v : 'ran'; } catch (e) { res[k] = String(e.message || e); }
    }
    try { res.integrate = await race(() => integrateBreakdownSuggestions()); } catch (e) { res.integrate = 'threw: ' + String(e.message || e); }
    return {
      numChaptersDisabled: document.getElementById('numChapters').disabled, top: top.length, topDisabled: top.every((b) => b.disabled), row: row.length, rowDisabled: row.every((b) => b.disabled),
      integ: integ.length, integDisabled: integ.every((b) => b.disabled), res, calls: window.__h.calls.length - before, impSame: impBefore === JSON.stringify(novelData.chapterImprovements), dialogs: window.__h.dialogs.slice()
    };
  }).catch((e) => ({ error: String(e && e.message || e), res: {} }));
  check('M5', 'mid-run: numChapters control disabled', lk.numChaptersDisabled === true, JSON.stringify(lk));
  check('M5', 'mid-run: Tab 7 Apply Top Critique + row Apply buttons and Tab 8 Integrate Suggestions disabled', lk.top === 1 && lk.topDisabled && lk.row === 1 && lk.rowDisabled && lk.integ === 1 && lk.integDisabled, JSON.stringify(lk));
  check('M5', 'mid-run: direct applyTopBookCritiques / applyBookCritiqueItem / updateChapter / integrateBreakdownSuggestions refused (0 calls, no staged notes, 0 dialogs)', /applyTopBookCritiques locked/.test(lk.res.applyTop) && /applyBookCritiqueItem locked/.test(lk.res.applyItem) && /updateChapter locked/.test(lk.res.updateChapter) && lk.res.integrate === false && lk.calls === 0 && lk.impSame && lk.dialogs.length === 0, JSON.stringify(lk));
  await page.close();
  const page2 = await openPage();
  const rv = await batch(page2, { nd: ND, to: 2, cfg: { reviseAt: 2 } });
  const probe = await page2.evaluate(() => ({ revise: window.__h.revise, manual: window.__h.reviseManual }));
  batchDialogTotals.push(rv.dialogs.length);
  check('M5', 'batch-owned qualityRevise updateChapter still runs inside the batch; a manual-tag updateChapter in the same window is refused', /^ok:Chapter 2 part 1/.test(probe.revise || '') && /^threw:updateChapter locked/.test(probe.manual || '') && rv.br.reason === 'done' && eq(rv.br.completed, [1, 2]), JSON.stringify({ probe, br: rv.br }));
  const busy = await page2.evaluate(async (nd) => {
    const h = window.__h; h.load(nd); h.calls.length = 0; h.dialogs.length = 0; h.cfg = {};
    activeAICallCount = 1;
    const a = await generateAllChapters(); const sa = document.getElementById('batchRunStatus').textContent;
    const b = await resumeBatchRun(); const sb = document.getElementById('batchRunStatus').textContent;
    activeAICallCount = 0;
    return { a, b, sa, sb, calls: h.calls.length, dialogs: h.dialogs.slice(), br: novelData.batchRun === undefined ? 'absent' : 'present', running: nwBatchState.running, quiet: nwBatchState.quiet };
  }, ND);
  check('M5', 'activeAICallCount > 0: start and Resume refused (reason ai-busy), 0 calls, status message, no dialog, no batchRun', busy.a.started === false && busy.a.reason === 'ai-busy' && busy.b.reason === 'ai-busy' && busy.calls === 0 && busy.dialogs.length === 0 && busy.br === 'absent' && /^Another AI request is still running \(1 in flight\)\. Wait for it to finish, then start Generate All\./.test(busy.sa) && /then Resume\./.test(busy.sb) && !busy.running && !busy.quiet, JSON.stringify(busy));
  await page2.close();
}

// ---------------- M6: lock kept through finalization ----------------
{
  const page = await openPage();
  await page.evaluate((nd) => { const h = window.__h; h.load(nd); h.cfg = { slowFinal: true }; window.__p1 = generateAllChapters(); }, ND);
  await page.waitForFunction(() => window.__h.finalPending === true, null, { timeout: 30000 });
  const mid = await page.evaluate(async () => {
    const h = window.__h; const before = h.calls.length;
    const second = await generateAllChapters(); const third = await resumeBatchRun();
    return {
      running: nwBatchState.running, reasonSoFar: novelData.batchRun.reason, second, third, calls: h.calls.length - before,
      genAllDisabled: document.getElementById('batchGenerateAllBtn').disabled, genBtnsDisabled: Array.from(document.querySelectorAll('#chapterGenContainer button')).every((b) => b.disabled),
      importDisabled: document.getElementById('importFile').disabled, numChaptersDisabled: document.getElementById('numChapters').disabled, pauseEnabled: !document.getElementById('batchPauseBtn').disabled
    };
  });
  check('M6', 'during the slow final checkpoint: running true, controls locked (Generate All, per-chapter Generate, import, numChapters)', mid.running === true && mid.genAllDisabled && mid.genBtnsDisabled && mid.importDisabled && mid.numChaptersDisabled, JSON.stringify(mid));
  check('M6', 'during finalization a second start and a Resume are refused (already-running), 0 provider calls', mid.second.started === false && mid.second.reason === 'already-running' && mid.third.reason === 'already-running' && mid.calls === 0, JSON.stringify(mid));
  const fin = await page.evaluate(async () => { window.__h.releaseFinal(); const r = await window.__p1; return { r, running: nwBatchState.running, owner: nwBatchState.owner, quiet: nwBatchState.quiet, genAllDisabled: document.getElementById('batchGenerateAllBtn').disabled, state: document.getElementById('batchRunStatus').dataset.state }; });
  check('M6', 'after the final checkpoint resolves: run done, lock released by its own finally (running false, owner null), controls unlocked', fin.r.reason === 'done' && fin.running === false && fin.owner === null && fin.quiet === false && fin.genAllDisabled === false && fin.state === 'done', JSON.stringify(fin));
  await page.close();
}

// ---------------- M7: final checkpoint failure ----------------
{
  const page = await openPage();
  const s = await batch(page, { nd: ND, cfg: { putThrowAfter: 8 } });
  const exp = await page.evaluate(async () => { const b = window.__h.lastExport; if (!b) return null; const j = JSON.parse(await b.text()); return j.novelData.batchRun; });
  batchDialogTotals.push(s.dialogs.length);
  check('M7', 'all 4 chapters complete, the final checkpoint throws QuotaExceededError: result + batchRun reason checkpoint (not done)', eq(s.br.completed, [1, 2, 3, 4]) && s.r.reason === 'checkpoint' && s.br.reason === 'checkpoint' && s.br.stoppedAt === 4 && /final checkpoint write failed after ch4: .*quota exceeded/i.test(s.br.detail || '') && s.puts === 9, JSON.stringify({ r: s.r, br: s.br, puts: s.puts }));
  check('M7', 'status state checkpoint, "Checkpoint failed: run stopped. Export your session now." + Export button', s.state === 'checkpoint' && /^Checkpoint failed: run stopped\. Export your session now\. Stopped at ch4 \(checkpoint\): final checkpoint write failed/.test(s.status) && s.exportNow, s.status);
  check('M7', 'auto-export fired once and the exported batchRun.reason is checkpoint', sessionDl(s) === 1 && exp && exp.reason === 'checkpoint' && exp.stoppedAt === 4, JSON.stringify({ dl: s.downloads, exp: exp && { reason: exp.reason, stoppedAt: exp.stoppedAt } }));
  await page.close();
}

// ---------------- F1: import race (batch starts during the file read) ----------------
const IMPORT_CANCELLED = 'Import cancelled: a Generate All run is active. Import again after it stops.';
{
  const page = await openPage();
  const f1 = await page.evaluate(async (nd) => {
    const h = window.__h; h.load(nd);
    let reader = null;
    const realRead = FileReader.prototype.readAsText;
    FileReader.prototype.readAsText = function () { reader = this; }; // the read "takes a while"
    const payload = JSON.stringify({ schemaVersion: '1.0', sourceTool: 'NovelWriter', novelData: Object.assign({}, nd, { title: 'IMPORTED BOOK', chapters: ['IMPORTED TEXT'] }) });
    const target = { files: [new File([payload], 'race.json', { type: 'application/json' })], value: 'race.json' };
    importSession({ target });
    const readStarted = !!reader;
    h.cfg = { hangAt: '1:1' }; window.__p = generateAllChapters();
    for (let i = 0; i < 400 && !h.hanging; i++) await new Promise((r) => setTimeout(r, 25));
    const before = JSON.stringify(novelData); const reqBefore = JSON.stringify(requestLog);
    let threw = null;
    try { reader.onload({ target: { result: payload } }); } catch (e) { threw = String(e.message || e); }
    FileReader.prototype.readAsText = realRead;
    const toast = document.getElementById('nwToast');
    return { readStarted, running: nwBatchState.running, same: before === JSON.stringify(novelData), reqSame: reqBefore === JSON.stringify(requestLog), title: novelData.title, ch1: (novelData.chapters || [])[0] || '', toast: toast.textContent, toastShown: !toast.hidden, toastRole: toast.getAttribute('role'), dialogs: h.dialogs.slice(), inputCleared: target.value === '', threw };
  }, ND);
  check('F1', 'batch started during the read: onload cancels the import; novelData + requestLog unchanged (title, chapters), input cleared, no throw', f1.readStarted && f1.running && f1.same && f1.reqSame && f1.title !== 'IMPORTED BOOK' && f1.ch1 !== 'IMPORTED TEXT' && f1.inputCleared && f1.threw === null, JSON.stringify(f1));
  check('F1', 'toast (role=status) says exactly "' + IMPORT_CANCELLED + '"; 0 dialogs', f1.toastShown && f1.toastRole === 'status' && f1.toast === IMPORT_CANCELLED && f1.dialogs.length === 0, JSON.stringify({ toast: f1.toast, shown: f1.toastShown, dialogs: f1.dialogs }));
  await page.close();
}

// ---------------- F2: imported book does not inherit the previous run ----------------
{
  const page = await openPage();
  const st = await batch(page, { nd: ND, cfg: { throwAt: { key: '2:1', msg: 'HTTP error! Status: 401, Text: {"error":"Incorrect API key provided"}' } } });
  const f2 = await page.evaluate(async () => {
    const h = window.__h; const oldId = novelData.batchRun.id;
    // the old run's checkpoint is still active (e.g. the tab died during the final write): without cleanup a reload would offer it
    const rec = await h.idbGet(oldId); rec.active = true; await nwBatchIdbPut(rec, oldId);
    const resumableBefore = nwBatchIsResumable();
    const cap = document.getElementById('batchTokenCap');
    cap.value = '50000'; cap.dataset.userEdited = '1';
    const nd2 = JSON.parse(JSON.stringify(novelData)); delete nd2.batchRun; delete nd2.apiKey; nd2.title = 'Other Book';
    const realRead = FileReader.prototype.readAsText;
    FileReader.prototype.readAsText = function (f) { const r = this; f.text().then((t) => r.onload({ target: { result: t } })); };
    // Delay the actual IDB delete so a success-before-await race is visible at the success dialog.
    const origDel = nwBatchIdbDelete;
    nwBatchIdbDelete = function (key) {
      return new Promise(function (resolve, reject) {
        setTimeout(function () { origDel(key).then(resolve, reject); }, 250);
      });
    };
    h.dialogs.length = 0;
    importSession({ target: { files: [new File([JSON.stringify({ schemaVersion: '1.0', sourceTool: 'NovelWriter', novelData: nd2 })], 'other.json')], value: 'other.json' } });
    for (let i = 0; i < 200 && !h.dialogs.some((d) => /Session imported/.test(d)); i++) await new Promise((r) => setTimeout(r, 25));
    const keysAtSuccess = await h.idbKeys();
    const capEl = document.getElementById('batchTokenCap');
    const o = nwBatchReadOptions();
    const plan = nwBatchPlan({ from: o.from, to: o.to }, o.regenerateExisting, [], null);
    const estCap = String(Math.ceil(nwBatchEstimate(plan.planned.length).total * NW_BATCH.capFactor));
    const out = {
      oldId, resumableBefore, title: novelData.title, hasRun: 'batchRun' in novelData, interrupted: nwBatchState.interrupted,
      resumeDisabled: document.getElementById('batchResumeBtn').disabled, resumable: nwBatchIsResumable(),
      oldRecLeft: keysAtSuccess.includes(oldId), imported: h.dialogs.some((d) => /Session imported/.test(d)),
      capValue: capEl.value, capHasAttr: capEl.hasAttribute('data-user-edited'), capEdited: capEl.dataset.userEdited || '', estCap
    };
    nwBatchIdbDelete = origDel;
    h.cfg = {};
    h.calls.length = 0;
    const ga = await generateAllChapters();
    out.newRunCap = novelData.batchRun && novelData.batchRun.cap;
    out.newRunReason = ga && ga.reason;
    // an import that carries a batchRun keeps it
    const nd3 = JSON.parse(JSON.stringify(nd2)); nd3.title = 'Third Book';
    nd3.batchRun = { id: 'third|2026-10-03T00:00:00.000Z', startedAt: '2026-10-03T00:00:00.000Z', updatedAt: '2026-10-03T00:00:00.000Z', range: { from: 1, to: 4 }, regenerateExisting: false, perChapterDownload: false, completed: [1], inFlight: null, stoppedAt: 2, reason: 'provider', detail: 'smoke', tokensUsed: 2000, estimate: { perChapter: 2000, total: 8000, source: 'fallback' }, cap: 43210, usageEstimated: [] };
    h.dialogs.length = 0;
    importSession({ target: { files: [new File([JSON.stringify({ schemaVersion: '1.0', sourceTool: 'NovelWriter', novelData: nd3 })], 'third.json')], value: 'third.json' } });
    for (let i = 0; i < 200 && !h.dialogs.some((d) => /Session imported/.test(d)); i++) await new Promise((r) => setTimeout(r, 25));
    const keepCap = document.getElementById('batchTokenCap');
    out.keep = { id: novelData.batchRun && novelData.batchRun.id, cap: novelData.batchRun && novelData.batchRun.cap, input: keepCap.value, edited: keepCap.dataset.userEdited || '' };
    // back to the run-less book for the reload check
    h.dialogs.length = 0;
    importSession({ target: { files: [new File([JSON.stringify({ schemaVersion: '1.0', sourceTool: 'NovelWriter', novelData: nd2 })], 'other.json')], value: 'other.json' } });
    for (let i = 0; i < 200 && !h.dialogs.some((d) => /Session imported/.test(d)); i++) await new Promise((r) => setTimeout(r, 25));
    await nwBatchState.lastForget;
    out.hasRunAgain = 'batchRun' in novelData;
    FileReader.prototype.readAsText = realRead;
    return out;
  });
  check('F2', 'import without batchRun over a stopped run: no batchRun, interrupted null, Resume disabled/not resumable, old IndexedDB checkpoint deleted', st.br && st.br.reason === 'provider' && f2.resumableBefore && f2.imported && f2.title === 'Other Book' && !f2.hasRun && f2.interrupted === null && f2.resumeDisabled && !f2.resumable && !f2.oldRecLeft, JSON.stringify(f2));
  check('F2', 'run-less import: stale cap 50000/user-edited cleared; field shows the fresh estimate', !f2.capHasAttr && f2.capEdited !== '1' && f2.capValue !== '50000' && f2.capValue === f2.estCap && f2.estCap !== '50000', JSON.stringify({ capValue: f2.capValue, capHasAttr: f2.capHasAttr, capEdited: f2.capEdited, estCap: f2.estCap }));
  check('F2', 'run-less import: old checkpoint is gone at the moment the import reports success (no race)', f2.imported && !f2.oldRecLeft, JSON.stringify({ imported: f2.imported, oldRecLeft: f2.oldRecLeft, oldId: f2.oldId }));
  check('F2', 'run-less import: a new Generate All uses the estimate-based cap, not 50000', f2.newRunCap === Number(f2.estCap) && f2.newRunCap !== 50000, JSON.stringify({ newRunCap: f2.newRunCap, estCap: f2.estCap, reason: f2.newRunReason }));
  check('F2', 'an import that carries a batchRun keeps it (id + cap shown); a later run-less import drops it again', f2.keep.id === 'third|2026-10-03T00:00:00.000Z' && f2.keep.cap === 43210 && f2.keep.input === '43210' && !f2.hasRunAgain, JSON.stringify({ keep: f2.keep, hasRunAgain: f2.hasRunAgain }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof restoreInterruptedBatchRun === 'function' && window.__nwBatchRestoreCheck, null, { timeout: 30000 });
  await page.evaluate(() => window.__nwBatchRestoreCheck);
  const rl = await page.evaluate(() => ({ interrupted: !!nwBatchState.interrupted, restoreBoxHidden: document.getElementById('batchRestoreBox').hidden, resumeDisabled: document.getElementById('batchResumeBtn').disabled, resumable: nwBatchIsResumable(), status: document.getElementById('batchRunStatus').textContent }));
  check('F2', 'after reload: no restore prompt (no interrupted run, restore box hidden), Resume unavailable', !rl.interrupted && rl.restoreBoxHidden && rl.resumeDisabled && !rl.resumable && !/Interrupted batch run found/.test(rl.status), JSON.stringify(rl));
  batchDialogTotals.push(st.dialogs.length);
  await page.close();
}

// ---------------- F3: cap display after restore ----------------
{
  const page = await openPage();
  const st = await batch(page, { nd: ND, cap: 50000, cfg: { throwAt: { key: '2:1', msg: 'HTTP error! Status: 503, Text: down' }, failProvider: { 2: 2 } } });
  await page.evaluate(async () => { const id = novelData.batchRun.id; const rec = await window.__h.idbGet(id); rec.active = true; await nwBatchIdbPut(rec, id); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof restoreInterruptedBatchRun === 'function' && window.__nwBatchRestoreCheck, null, { timeout: 30000 });
  await page.evaluate(() => window.__nwBatchRestoreCheck);
  await installHarness(page);
  const f3 = await page.evaluate(async () => {
    const ok = await restoreInterruptedBatchRun();
    const c = document.getElementById('batchTokenCap');
    const afterRestore = c.value;
    nwBatchRefreshEstimate();
    const afterRefresh = c.value;
    const reg = document.getElementById('batchRegenerate'); reg.dispatchEvent(new Event('change'));
    const afterChange = c.value;
    const estCap = String(Math.ceil(nwBatchEstimate(4).total * NW_BATCH.capFactor));
    // the user's own edit still wins
    c.value = '777'; c.dispatchEvent(new Event('input')); nwBatchRefreshEstimate();
    const userEdit = c.value;
    return { ok, brCap: novelData.batchRun.cap, resumable: nwBatchIsResumable(), afterRestore, afterRefresh, afterChange, estCap, userEdit };
  });
  check('F3', 'after restore: nwBatchRefreshEstimate and a range change keep showing br.cap (not the fresh estimate); a user edit still wins', st.br.cap === 50000 && f3.ok && f3.resumable && f3.brCap === 50000 && f3.afterRestore === '50000' && f3.afterRefresh === '50000' && f3.afterChange === '50000' && f3.estCap !== '50000' && f3.userEdit === '777', JSON.stringify(f3));
  batchDialogTotals.push(st.dialogs.length);
  await page.close();
}

// ---------------- F4: continuity controls locked mid-run ----------------
{
  const page = await openPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.evaluate((nd) => {
    const h = window.__h; h.load(nd); h.auditCalls.length = 0;
    novelData.autoContinuityAudit = true; document.getElementById('autoContinuityAudit').checked = true;
    h.cfg = { auditStub: true, hangAt: '2:1' }; window.__p = generateAllChapters();
  }, ND);
  await page.waitForFunction(() => window.__h.hanging === true, null, { timeout: 20000 });
  const errBefore = consoleErrors.length;
  const errPageBefore = pageErrors.length;
  const f4 = await page.evaluate(async () => {
    const h = window.__h;
    const q = (sel) => Array.from(document.querySelectorAll(sel));
    const rb = q('#tab5 button[onclick*="rebuildContinuityPackets"]'), ra = q('#tab5 button[onclick*="runContinuityAuditAll"]');
    const packets = JSON.stringify(novelData.chapterContinuityPackets);
    const audits = h.auditCalls.length;
    const toasts = [];
    let r1, r2, threw = null;
    try { r1 = rebuildContinuityPackets(); toasts.push(document.getElementById('nwToast').textContent); r2 = await runContinuityAuditAll(); toasts.push(document.getElementById('nwToast').textContent); } catch (e) { threw = String(e.message || e); }
    return { rb: rb.length, rbDisabled: rb.every((b) => b.disabled), ra: ra.length, raDisabled: ra.every((b) => b.disabled), r1, r2, threw, toasts, packetsSame: packets === JSON.stringify(novelData.chapterContinuityPackets), auditDelta: h.auditCalls.length - audits, batchAudited: h.auditCalls.slice(), dialogs: h.dialogs.slice() };
  });
  await page.waitForTimeout(200);
  const newErrs = consoleErrors.slice(errBefore);
  check('F4', 'mid-run: Rebuild Continuity Packets and Run Continuity Audit (All) buttons disabled', f4.rb === 1 && f4.rbDisabled && f4.ra === 1 && f4.raDisabled, JSON.stringify(f4));
  check('F4', 'mid-run: direct handler calls return false with a toast (no throw, no console error, no page error, no dialog, no packets rebuilt, no audit run)', f4.r1 === false && f4.r2 === false && f4.threw === null && /^Rebuild Continuity Packets is locked while a Generate All run is active/.test(f4.toasts[0] || '') && /^Run Continuity Audit \(All\) is locked while a Generate All run is active/.test(f4.toasts[1] || '') && newErrs.length === 0 && pageErrors.length === errPageBefore && f4.dialogs.length === 0 && f4.packetsSame && f4.auditDelta === 0, JSON.stringify({ f4, newErrs }));
  check('F4', "the batch's own continuity audit still ran for ch1 while the user entry points were locked", f4.batchAudited.length === 1 && f4.batchAudited[0] === 1, JSON.stringify(f4.batchAudited));
  await page.close();
}

// ---------------- F5: batch continuity audit retry (audit call only) ----------------
{
  const page = await openPage();
  const E503 = 'HTTP error! Status: 503, Text: smoke audit upstream unavailable';
  const partCalls = (s, ch) => [1, 2].map((p) => s.calls.filter((c) => c.ch === ch && c.part === p).length);
  const auditCalls = () => page.evaluate(() => window.__h.auditCalls.slice());
  // (a) 503 then OK
  const a = await batch(page, { nd: ND, audit: true, resetCounters: true, cfg: { auditStub: true, auditErrs: { 2: [E503] } } });
  const aAud = await auditCalls();
  check('F5', '503 then OK: only the audit is retried (ch2 Part 1/2 calls stay 1/1, ch2 audit 2 calls), run done, all 4 complete', a.br.reason === 'done' && eq(partCalls(a, 2), [1, 1]) && aAud.filter((n) => n === 2).length === 2 && eq(a.br.completed, [1, 2, 3, 4]) && a.statusSeen.some((x) => /^ch2 continuity audit provider error; retrying the audit once in 2 s: HTTP error! Status: 503/.test(x)), JSON.stringify({ br: a.br, parts: partCalls(a, 2), aAud }));
  check('F5', '503 then OK: usage is real (4 x 2000 parts + 4 x 100 audit = 8400), nothing estimated', a.br.tokensUsed === 8400 && eq(a.br.usageEstimated, []), JSON.stringify(a.br));
  // (b) 503 twice -> provider stop, draft kept, Resume regenerates ch2
  const b = await batch(page, { nd: ND, audit: true, resetCounters: true, cfg: { auditStub: true, auditErrs: { 2: [E503, E503] } } });
  const bAud = await auditCalls();
  check('F5', '503 twice: stop reason provider at ch2 after 1 audit retry (2 audit calls, Part 1/2 calls 1/1), detail names the audit', b.br.reason === 'provider' && b.br.stoppedAt === 2 && /^continuity audit provider error after 1 retry: HTTP error! Status: 503/.test(b.br.detail) && bAud.filter((n) => n === 2).length === 2 && eq(partCalls(b, 2), [1, 1]) && eq(b.br.completed, [1]), JSON.stringify({ br: b.br, bAud, parts: partCalls(b, 2) }));
  check('F5', '503 twice: drafted ch2 text kept (novelData + Tab 5 field), status says it, Resume regenerates ch2; usage real (2100 + 2000), no usageEstimated entry', /^Chapter 2 part 1 prose/.test(b.chapters[1]) && /Chapter 2 part 2 prose/.test(b.chapters[1]) && b.genDom[1] === b.chapters[1] && /Drafted ch2 text kept\./.test(b.status) && /Resume regenerates ch2\./.test(b.status) && b.br.keptDraft === 2 && !b.resumeDisabled && b.br.tokensUsed === 4100 && eq(b.br.usageEstimated, []), JSON.stringify({ status: b.status, br: b.br, ch2: b.chapters[1].slice(0, 60) }));
  // #135 review: Resume whose forced ch2 fails in Part 1 (provider) keeps the keptDraft marker and the draft text
  const r1 = await batch(page, { resume: true, resetCounters: true, cfg: { auditStub: true, throwAt: { key: '2:1', msg: 'HTTP error! Status: 401, Text: {"error":"Incorrect API key provided"}' } } });
  check('F5', 'Resume -> ch2 Part 1 provider failure: stop provider at ch2, keptDraft still 2, drafted ch2 text still there, still resumable', r1.br.reason === 'provider' && r1.br.stoppedAt === 2 && eq(partCalls(r1, 2), [1, 0]) && r1.br.keptDraft === 2 && /^Chapter 2 part 1 prose/.test(r1.chapters[1]) && !r1.resumeDisabled, JSON.stringify({ br: r1.br, parts: partCalls(r1, 2), ch2: String(r1.chapters[1]).slice(0, 40) }));
  const br2 = await batch(page, { resume: true, resetCounters: true, cfg: { auditStub: true } });
  const rAud = await auditCalls();
  check('F5', 'Resume again (after the failed Resume) still regenerates ch2 (Part 1 + Part 2 called again though ch2 has text), then ch3-4; done; keptDraft cleared only now', br2.br.reason === 'done' && eq(partCalls(br2, 2), [1, 1]) && eq(partCalls(br2, 1), [0, 0]) && eq(br2.br.completed, [1, 2, 3, 4]) && rAud.filter((n) => n === 2).length === 1 && br2.br.keptDraft == null, JSON.stringify({ br: br2.br, parts: partCalls(br2, 2), rAud }));
  // (c) 401 -> no retry
  const c = await batch(page, { nd: ND, audit: true, resetCounters: true, cfg: { auditStub: true, auditErrs: { 2: ['HTTP error! Status: 401, Text: {"error":"Incorrect API key provided"}'] } } });
  const cAud = await auditCalls();
  check('F5', '401 from the audit: no retry (1 audit call), stop provider, detail "continuity audit provider error (HTTP 401, not retried): Check your API key in Setup.", draft kept', c.br.reason === 'provider' && c.br.stoppedAt === 2 && c.br.detail === 'continuity audit provider error (HTTP 401, not retried): Check your API key in Setup.' && cAud.filter((n) => n === 2).length === 1 && /^Chapter 2 part 1 prose/.test(c.chapters[1]) && eq(c.br.usageEstimated, []), JSON.stringify({ br: c.br, cAud }));
  // (d) parse stays parse
  // (#135 review) real runChapterContinuityAudit; the provider stub returns callAI's malformed-JSON shape { chapter, _jsonParseError }
  const d = await batch(page, { nd: ND, audit: true, resetCounters: true, cfg: { auditJsonErrAt: 2 } });
  const dAud = await page.evaluate(() => window.__h.realAuditCalls.slice());
  check('F5', 'real malformed audit JSON (_jsonParseError) in a batch: reason parse at ch2 (not completed), no retry (1 audit call), draft kept, keptDraft 2, real usage (2 x 2100), nothing estimated', d.br.reason === 'parse' && d.br.stoppedAt === 2 && eq(d.br.completed, [1]) && /^continuity audit parse failure \(no retry\): continuity audit model JSON parse error \(_jsonParseError\): SyntaxError/.test(d.br.detail) && eq(dAud, [1, 2]) && /^Chapter 2 part 1 prose/.test(d.chapters[1]) && d.br.keptDraft === 2 && eq(d.br.usageEstimated, []) && d.br.tokensUsed === 4200 && /Drafted ch2 text kept\./.test(d.status), JSON.stringify({ br: d.br, dAud, status: d.status }));
  const single = await page.evaluate(async () => {
    try { const r = await runChapterContinuityAudit(2, { silent: true }); return { ok: true, risks: r && r.continuityRisks, dialogs: window.__h.dialogs.length }; } catch (e) { return { ok: false, err: String(e.message || e) }; }
  });
  check('F5', 'single-chapter audit (no batch) keeps its old fallback for _jsonParseError: no throw, risk "Unable to parse continuity audit output."', single.ok && eq(single.risks, ['Unable to parse continuity audit output.']), JSON.stringify(single));
  for (const x of [a, b, r1, br2, c, d]) batchDialogTotals.push(x.dialogs.length);
  await page.close();
}

// ---------------- F5 (#135 review): keptDraft survives a reload after the Resume's pre-chapter checkpoint ----------------
{
  const page = await openPage();
  const s0 = await batch(page, { nd: ND, audit: true, resetCounters: true, cfg: { auditStub: true, auditErrs: { 2: ['HTTP error! Status: 503, Text: x', 'HTTP error! Status: 503, Text: x'] } } });
  await page.evaluate(() => { const h = window.__h; h.calls.length = 0; h.hanging = false; h.cfg = { auditStub: true, hangAt: '2:1' }; window.__p = resumeBatchRun(); });
  const hung = await page.waitForFunction(() => window.__h.hanging === true, null, { timeout: 20000 }).then(() => true, () => false);
  check('F5', 'Resume after the audit stop starts with the kept-draft ch2 (its Part 1 is the call in flight)', hung, 'ch2 Part 1 never called (Resume skipped ch2)');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof restoreInterruptedBatchRun === 'function' && window.__nwBatchRestoreCheck, null, { timeout: 30000 });
  await page.evaluate(() => window.__nwBatchRestoreCheck);
  await installHarness(page);
  const rs = await page.evaluate(async () => {
    const found = !!nwBatchState.interrupted; const ok = await restoreInterruptedBatchRun();
    if (!novelData.batchRun) return { found, ok, noRun: true };
    return { found, ok, stoppedAt: novelData.batchRun.stoppedAt, keptDraft: novelData.batchRun.keptDraft, ch2: String(novelData.chapters[1] || ''), resumable: nwBatchIsResumable() };
  });
  check('F5', 'reload after the Resume pre-chapter checkpoint: restore shows ch2 in flight, keptDraft 2 kept, drafted ch2 text present, resumable', s0.br.keptDraft === 2 && rs.found && rs.ok && rs.stoppedAt === 2 && rs.keptDraft === 2 && /^Chapter 2 part 1 prose/.test(rs.ch2) && rs.resumable, JSON.stringify(rs));
  const r = await batch(page, { resume: true, resetCounters: true, cfg: { auditStub: true } });
  check('F5', 'Resume after reload + restore still regenerates ch2 (Part 1 + Part 2 called), then done; keptDraft cleared', !!r.br && r.br.reason === 'done' && r.calls.filter((c) => c.ch === 2).length === 2 && eq(r.br.completed, [1, 2, 3, 4]) && r.br.keptDraft == null, JSON.stringify({ br: r.br, calls: r.calls }));
  batchDialogTotals.push(s0.dialogs.length, r.dialogs.length);
  await page.close();
}

// ---------------- X1: session data never reinterpreted as HTML (import + restore) ----------------
{
  const XSS = '<img src=x onerror=window.__xss=1>';
  const CHARS = [
    { name: XSS, role: 'protagonist', backstory: XSS, arc: XSS },
    { name: '"><img src=x onerror=window.__xss=2>', role: 'foil', backstory: '</textarea><img src=x onerror=window.__xss=3>', arc: '</textarea><img src=x onerror=window.__xss=4> &amp; &lt;b&gt;' }
  ];
  const SUBS = [XSS, '</textarea><img src=x onerror=window.__xss=5>'];
  const xssNd = clone(ND); xssNd.characters = clone(CHARS); xssNd.subplots = clone(SUBS);
  const readBack = () => ({
    xss: window.__xss,
    imgs: document.querySelectorAll('#characterList img, #subplotList img').length,
    dom: Array.from(document.querySelectorAll('#characterList .character')).map((d) => ({ name: d.querySelector('.charName').value, backstory: d.querySelector('.charBackstory').value, arc: d.querySelector('.charArc').value, role: d.dataset.role || null })),
    domSubs: Array.from(document.querySelectorAll('#subplotList .subplot')).map((t) => t.value),
    nd: (novelData.characters || []).map((c) => ({ name: c.name, backstory: c.backstory, arc: c.arc, role: c.role })),
    ndSubs: (novelData.subplots || []).slice(),
    numCharacters: document.getElementById('numCharacters').value, minSubplots: document.getElementById('minSubplots').value
  });
  const expectDom = CHARS.map((c) => ({ name: c.name, backstory: c.backstory, arc: c.arc, role: c.role }));
  const okRound = (x) => x.xss === undefined && x.imgs === 0 && eq(x.dom, expectDom) && eq(x.domSubs, SUBS) && eq(x.nd, expectDom) && eq(x.ndSubs, SUBS) && x.numCharacters === '2' && x.minSubplots === '2';
  // (a) real importSession through the #importFile input
  const page = await openPage();
  await page.locator('#importFile').setInputFiles({ name: 'xss_session.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ schemaVersion: '1.0', sourceTool: 'NovelWriter', novelData: xssNd })) });
  await page.waitForFunction(() => window.__h.dialogs.some((d) => /Session imported/.test(d)), null, { timeout: 15000 });
  await page.waitForTimeout(600); // give any injected <img onerror> time to fire
  const imp = await page.evaluate(readBack);
  check('X1', 'import: XSS payloads in character name/backstory/arc + subplot do not execute (window.__xss undefined, no <img> in Tab 2)', imp.xss === undefined && imp.imgs === 0, JSON.stringify({ xss: imp.xss, imgs: imp.imgs }));
  check('X1', 'import: character and subplot values round-trip exactly (DOM .value + novelData; role kept as data-role)', okRound(imp), JSON.stringify(imp));
  // (b) IndexedDB restore path: checkpoint written with the same payloads, page reloaded, restore applied
  await page.evaluate(async (nd) => {
    const h = window.__h; h.load(nd);
    const snap = JSON.parse(JSON.stringify(novelData)); delete snap.apiKey; delete snap.batchRun;
    const t = new Date().toISOString();
    const br = { id: 'xss|' + t, startedAt: t, updatedAt: t, range: { from: 1, to: 4 }, regenerateExisting: false, perChapterDownload: false, completed: [], inFlight: 1, stoppedAt: null, reason: null, detail: null, tokensUsed: 0, estimate: { perChapter: 1, total: 4, source: 'fallback' }, cap: 10, usageEstimated: [] };
    await nwBatchIdbPut({ key: br.id, savedAt: t, active: true, novelData: snap, batchRun: br }, br.id);
  }, xssNd);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof restoreInterruptedBatchRun === 'function' && window.__nwBatchRestoreCheck, null, { timeout: 30000 });
  await page.evaluate(() => window.__nwBatchRestoreCheck);
  await installHarness(page);
  const restoredOk = await page.evaluate(async () => { window.__xss = undefined; const found = !!nwBatchState.interrupted; const ok = await restoreInterruptedBatchRun(); return found && ok; });
  await page.waitForTimeout(600);
  const res = await page.evaluate(readBack);
  check('X1', 'restore path: interrupted checkpoint found and restored; payloads do not execute (window.__xss undefined, no <img>)', restoredOk && res.xss === undefined && res.imgs === 0, JSON.stringify({ restoredOk, xss: res.xss, imgs: res.imgs }));
  check('X1', 'restore path: character and subplot values round-trip exactly', okRound(res), JSON.stringify(res));
  await page.close();
}

check('E4', 'zero dialogs across every batch run in this smoke (' + batchDialogTotals.length + ' runs)', batchDialogTotals.every((n) => n === 0), JSON.stringify(batchDialogTotals));
check('ALL', 'no unexpected page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
check('ALL', 'no http(s) request left the page (all aborted; none attempted by the stubbed flow)', networkSeen.filter((u) => /api\.x\.ai/i.test(u)).length === 0, networkSeen.slice(0, 5).join(' | '));
await browser.close();

fs.mkdirSync(OUT_DIR, { recursive: true });
const failed = checks.filter((c) => !c.ok);
fs.writeFileSync(path.join(OUT_DIR, 'SMOKE_NW_GENERATE_ALL.json'), JSON.stringify({ ok: !failed.length, passed: checks.length - failed.length, total: checks.length, checks }, null, 2));
for (const c of checks) process.stdout.write((c.ok ? 'PASS ' : 'FAIL ') + '[' + c.id + '] ' + c.name + (c.ok ? '' : ' :: ' + c.detail) + '\n');
process.stdout.write('\nNW GENERATE ALL SMOKE: ' + (failed.length ? 'FAIL' : 'PASS') + ' (' + (checks.length - failed.length) + '/' + checks.length + ')\n');
process.exit(failed.length ? 1 : 0);