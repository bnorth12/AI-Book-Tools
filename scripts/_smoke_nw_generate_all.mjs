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
    const h = window.__h = { calls: [], dialogs: [], downloads: [], puts: 0, putsWithRejected: 0, cfg: {}, hanging: false, statusSeen: [], lastExport: null };
    const realCOU = URL.createObjectURL;
    URL.createObjectURL = function (b) { if (b && /json/.test(String(b.type))) h.lastExport = b; return realCOU.call(URL, b); };
    window.collectData = function () {};
    ['alert', 'confirm', 'prompt'].forEach((k) => {
      window[k] = function (m) { h.dialogs.push(k + ': ' + String(m).slice(0, 200)); return k === 'confirm' ? true : (k === 'prompt' ? null : undefined); };
    });
    HTMLAnchorElement.prototype.click = function () { if (this.download) h.downloads.push(this.download); };
    window.ensureQualityAfterGenerate = async function (n) { if (h.cfg.qualityThrow === n) throw new Error('smoke quality judge unavailable ch' + n); };
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
    if (o.nd) h.load(o.nd);
    if (o.prefill) Object.keys(o.prefill).forEach((n) => h.setText(Number(n), o.prefill[n]));
    if (o.from) document.getElementById('batchFrom').value = String(o.from);
    if (o.to) document.getElementById('batchTo').value = String(o.to);
    if (o.regenerate != null) document.getElementById('batchRegenerate').checked = !!o.regenerate;
    if (o.perChapterDownload != null) document.getElementById('batchPerChapterDownload').checked = !!o.perChapterDownload;
    if (o.cap) { const c = document.getElementById('batchTokenCap'); c.value = String(o.cap); c.dispatchEvent(new Event('input')); }
    h.cfg = o.cfg || {};
    if (o.resetCounters) { h.calls.length = 0; h.dialogs.length = 0; h.downloads.length = 0; h.statusSeen.length = 0; h.lastExport = null; }
    const t0 = Date.now();
    const r = o.resume ? await resumeBatchRun() : await generateAllChapters();
    const s = h.snap(r);
    s.ms = Date.now() - t0;
    return s;
  }, opts);
}
const callsFor = (s, ch) => s.calls.filter((c) => c.ch === ch).length;
const sessionDl = (s) => s.downloads.filter((d) => /_session\.json$/.test(d)).length;
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
    const gen = all('#chapterGenContainer button');
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
  const pr = await batch(page, { resume: true, resetCounters: true });
  check('E4', 'Resume after the Part 1 parse stop on ch3 calls the provider for ch3 again (first call ch3, both parts) and completes it', pr.r.started && pr.calls[0] && pr.calls[0].ch === 3 && callsFor(pr, 3) === 2 && /^Chapter 3 part 1/.test(pr.chapters[2]) && eq(pr.br.completed, [1, 2, 3, 4]) && pr.br.reason === 'done' && pr.br.id === p.br.id, JSON.stringify({ r: pr.r, calls: pr.calls, br: pr.br }));
  const p2 = await batch(page, { nd: ND, cfg: { parseFail: '2:2' }, resetCounters: true });
  check('E4', 'Part 2 parse failure on ch2 also stops (reason parse, parse failure)', p2.br.reason === 'parse' && p2.br.stoppedAt === 2 && /^Part 2 parse failure/.test(p2.br.detail || '') && eq(p2.br.completed, [1]) && p2.dialogs.length === 0 && !p2.chapters[1], JSON.stringify(p2.br));
  const p2r = await batch(page, { resume: true, resetCounters: true });
  check('E4', 'Resume after the Part 2 parse stop on ch2 regenerates ch2 (provider called for ch2 Part 1 + Part 2) and completes it', p2r.r.started && p2r.calls[0] && p2r.calls[0].ch === 2 && p2r.calls[0].part === 1 && callsFor(p2r, 2) === 2 && /^Chapter 2 part 1/.test(p2r.chapters[1]) && eq(p2r.br.completed, [1, 2, 3, 4]) && p2r.br.reason === 'done', JSON.stringify({ r: p2r.r, calls: p2r.calls, br: p2r.br }));
  for (const x of [a, c, c1, c2, cr, g, p, pr, p2, p2r]) batchDialogTotals.push(x.dialogs.length);
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