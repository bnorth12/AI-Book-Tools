/**
 * Offline smoke for NovelWriter slot 8d: in-app chapter scorecard + QCAT harness.
 * No network, no API key. callAI is stubbed. Mutations copy HTML into os.tmpdir().
 *
 *   node scripts/_smoke_qcat_harness.mjs
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright';
import { runQcatHarness } from './qcat_harness.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const HTML_PATH = path.resolve(process.env.NW_HTML_PATH || path.join(REPO_ROOT, 'NovelWriter', 'NovelWriter.html'));
const OUT_DIR = path.resolve(process.env.NW_OUT_DIR || path.join(REPO_ROOT, 'out', 'nw-smoke'));
const FIX = path.join(SCRIPT_DIR, 'fixtures', 'qcat');
const BEAT_FIX = path.join(REPO_ROOT, 'NovelWriter', 'fixtures', 'beat-gate-old-shape-v1', 'novelData.json');

for (const k of ['XAI_API_KEY', 'GROK_API_KEY', 'NW_E2E_LIVE', 'QCAT_LIVE_ACK']) delete process.env[k];

fs.mkdirSync(OUT_DIR, { recursive: true });
const checks = [];
const check = (id, name, ok, detail) => checks.push({ id, name, ok: !!ok, detail: ok ? '' : String(detail == null ? '' : detail).slice(0, 1400) });
const clone = (o) => JSON.parse(JSON.stringify(o));
const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const HTML = fs.readFileSync(HTML_PATH, 'utf8');

const BOOK3 = JSON.parse(fs.readFileSync(path.join(FIX, 'book-3ch.json'), 'utf8'));
const TICS = JSON.parse(fs.readFileSync(path.join(FIX, 'book-tics.json'), 'utf8'));
const EXPECT = JSON.parse(fs.readFileSync(path.join(FIX, 'expect.json'), 'utf8'));
const PHRASES = JSON.parse(fs.readFileSync(path.join(FIX, 'book-replay-phrases.json'), 'utf8'));
const CASTTITLES = JSON.parse(fs.readFileSync(path.join(FIX, 'book-cast-titles.json'), 'utf8'));
const FX = JSON.parse(fs.readFileSync(BEAT_FIX, 'utf8'));
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
  await page.waitForFunction(() => typeof nwScoreChapterVsBlueprint === 'function' && typeof generateChapter === 'function', null, { timeout: 30000 });
  await page.evaluate(() => {
    window.__h = { calls: [] };
    window.callAI = async function (messages, tab, opts) {
      const op = (opts && opts.operationName) || '';
      window.__h.calls.push({ operationName: op, status: String(requestLog.status || '') });
      const usage = { prompt_tokens: 40, completion_tokens: 40, total_tokens: 80 };
      if (typeof recordBookTokenUsage === 'function') {
        recordBookTokenUsage(Object.assign({ operationName: op || 'generateChapter', originTab: 'tab5', model: 'smoke-stub' }, usage));
      }
      requestLog.returnedInfo = JSON.stringify({ usage });
      if (op === 'beatCheck') return { beats: [{ field: 'sceneGoal', result: 'present', evidence: 'smoke' }] };
      const g = window.__lastGenerateChapterGate;
      const ch = g ? g.chapter : 1;
      const part = /Part 2/.test(String(requestLog.status)) ? 2 : 1;
      const body = 'Elena Voss stood on the lunar hub. Bastian Kane named the ice haul vector. Ozone on the cable tray. Chapter ' + ch + ' part ' + part + '. ' + ('Concrete sensory prose with a bolt on a wet dock plank. ').repeat(8);
      return { chapter: body };
    };
    window.scoreObligationCoverage = function () {
      return { covered: 6, total: 6, ratio: 1, words: 200, passed: true, failures: [], misses: [] };
    };
  });
  return page;
}

async function loadEnvelope(page, envelope) {
  return page.evaluate((raw) => {
    const r = normalizeImportedSessionData(raw);
    novelData = r.novelData;
    requestLog = r.requestLog;
    applySessionDataToUI();
    return { title: novelData.title, n: novelData.numChapters };
  }, envelope);
}

// ---------------- 0. In-app generate + Tab 6 + facts round-trip + AI beat check + harness parity ----------------
{
  const page = await openPage();
  const gen = await page.evaluate(async (nd) => {
    const env = { schemaVersion: '1.0', sourceTool: 'NovelWriter', novelData: nd };
    const imported = normalizeImportedSessionData(env);
    novelData = imported.novelData;
    novelData.chapters = Array.from({ length: nd.numChapters }, () => '');
    novelData.skipAutoRevision = true;
    novelData.autoContinuityAudit = false;
    novelData.aiBeatCheck = false;
    novelData.apiKey = 'smoke-placeholder-not-a-key';
    applySessionDataToUI();
    document.getElementById('skipAutoRevision').checked = true;
    document.getElementById('autoContinuityAudit').checked = false;
    document.getElementById('aiBeatCheck').checked = false;
    document.getElementById('apiKey').value = 'smoke-placeholder-not-a-key';
    novelData.skipAutoRevision = true;
    novelData.autoContinuityAudit = false;
    window.__h.calls.length = 0;
    let err = null;
    try { await generateChapter(1); } catch (e) { err = String(e && e.message || e); }
    const card = (novelData.chapterScorecards || [])[0];
    showTab(6);
    const table = document.getElementById('chapterScorecardTable');
    return {
      err: err,
      hasCard: !!(card && card.overall && card.length && card.worldImmersion === null && card.planCoverage),
      overallIgnoresPlan: card && card.planCoverage && card.overall !== undefined,
      planCoverageComputed: !!(card && card.planCoverage && typeof card.planCoverage.ratio === 'number'),
      worldImmersion: card ? card.worldImmersion : 'missing',
      tableText: table ? table.textContent : '',
      extraBeat: window.__h.calls.filter((c) => c.operationName === 'beatCheck').length,
      genCalls: window.__h.calls.length,
      calls: window.__h.calls.map((c) => c.operationName),
      textLen: String((novelData.chapters || [])[0] || '').length
    };
  }, ND);
  check('0', 'generating a chapter fills chapterScorecards[n]', gen.hasCard && !gen.err && gen.textLen > 40, JSON.stringify(gen));
  check('0', 'planCoverage is computed', gen.planCoverageComputed, JSON.stringify(gen));
  check('0', 'worldImmersion is null (placeholder)', gen.worldImmersion === null, JSON.stringify(gen.worldImmersion));
  check('0', 'Tab 6 renders the scorecard', /Overall|PASS|WARN|FAIL/.test(gen.tableText || ''), (gen.tableText || '').slice(0, 300));
  check('0', 'AI beat check off: 0 extra beatCheck calls', gen.extraBeat === 0, JSON.stringify(gen.calls));

  const on = await page.evaluate(async () => {
    novelData.chapters[1] = '';
    document.getElementById('aiBeatCheck').checked = true;
    novelData.aiBeatCheck = true;
    novelData.skipAutoRevision = true;
    document.getElementById('skipAutoRevision').checked = true;
    window.__h.calls.length = 0;
    let err = null;
    try { await generateChapter(2); } catch (e) { err = String(e && e.message || e); }
    return {
      err: err,
      beat: window.__h.calls.filter((c) => c.operationName === 'beatCheck').length,
      ops: window.__h.calls.map((c) => c.operationName),
      cardMode: ((novelData.chapterScorecards || [])[1] || {}).beats && (novelData.chapterScorecards || [])[1].beats.mode
    };
  });
  check('0', 'AI beat check on: exactly 1 extra beatCheck call', on.beat === 1, JSON.stringify(on));

  const round = await page.evaluate(async () => {
    novelData.factChecks = { entries: [{ id: 'f1', label: 'qubit', kind: 'include', match: 'regex', pattern: 'qubit' }], quirks: ['pebble'] };
    novelData.chapterFactChecks = [[{ id: 'c1', label: 'Elena', kind: 'include', match: 'phrase', pattern: 'Elena' }]];
    novelData.aiBeatCheck = true;
    document.getElementById('aiBeatCheck').checked = true;
    const factsBody = document.getElementById('planFactsBody1');
    if (factsBody) factsBody.textContent = '';
    if (typeof nwAddPlanFactRow === 'function') nwAddPlanFactRow(1, { id: 'c1', label: 'Elena', kind: 'include', match: 'phrase', pattern: 'Elena' });
    const orig = URL.createObjectURL;
    let blob = null;
    URL.createObjectURL = function (b) { blob = b; return orig.call(this, b); };
    HTMLAnchorElement.prototype.click = function () {};
    exportSession();
    URL.createObjectURL = orig;
    const exported = blob ? JSON.parse(await blob.text()) : null;
    const name = (function () {
      const a = document.querySelector('a[download]');
      return a ? a.download : (typeof nwExportSessionFilename === 'function' ? nwExportSessionFilename() : '');
    }());
    const fn = typeof nwExportSessionFilename === 'function' ? nwExportSessionFilename() : '';
    const imported = normalizeImportedSessionData(exported);
    return {
      exportedFacts: exported && exported.novelData && exported.novelData.factChecks,
      exportedCh: exported && exported.novelData && exported.novelData.chapterFactChecks,
      exportedAi: exported && exported.novelData && exported.novelData.aiBeatCheck,
      after: imported.novelData.factChecks,
      afterCh: imported.novelData.chapterFactChecks,
      afterAi: imported.novelData.aiBeatCheck,
      filename: fn,
      stage: typeof nwWorkflowStage === 'function' ? nwWorkflowStage(exported.novelData) : ''
    };
  });
  check('0', 'factChecks round-trip through export/import', !!(round.exportedFacts && round.exportedFacts.quirks && round.exportedFacts.quirks.indexOf('pebble') >= 0 && round.after && round.after.quirks && round.after.quirks.indexOf('pebble') >= 0), JSON.stringify(round));
  check('0', 'chapterFactChecks round-trip', Array.isArray(round.afterCh) && round.afterCh[0] && round.afterCh[0][0] && round.afterCh[0][0].pattern === 'Elena', JSON.stringify(round.afterCh));
  check('0', 'aiBeatCheck round-trips true', round.exportedAi === true && round.afterAi === true, JSON.stringify(round));
  check('0', 'export filename uses workflow stage', /_\d{2}-[a-z0-9-]+_\d{8}-\d{4}\.json$/i.test(round.filename), round.filename);

  const legacy = await page.evaluate(() => {
    // #145: this page already has skipAutoRevision checked (draft-only generate above).
    // An absent flag must preserve that checkbox; 8d fields still default empty/false.
    document.getElementById('skipAutoRevision').checked = true;
    const payload = { schemaVersion: '1.0', sourceTool: 'NovelWriter', novelData: { title: 'Legacy', genre: 'scifi', chapters: [] } };
    const imported = normalizeImportedSessionData(payload);
    return {
      facts: imported.novelData.factChecks,
      cards: imported.novelData.chapterScorecards,
      chFacts: imported.novelData.chapterFactChecks,
      ai: imported.novelData.aiBeatCheck,
      skip: imported.novelData.skipAutoRevision,
      checkbox: document.getElementById('skipAutoRevision').checked
    };
  });
  check('0', 'legacy import has empty factChecks / scorecards and aiBeatCheck false; absent skipAutoRevision preserves checkbox', Array.isArray(legacy.cards) && legacy.cards.length === 0 && legacy.ai === false && legacy.facts && Array.isArray(legacy.facts.entries) && legacy.skip === true && legacy.checkbox === true, JSON.stringify(legacy));
  await page.close();
}

{
  const page = await openPage();
  const inApp = await page.evaluate(async (book) => {
    const r = normalizeImportedSessionData(book);
    novelData = r.novelData;
    applySessionDataToUI();
    const scored = await nwScoreBook({ trigger: 'harness' });
    return JSON.parse(JSON.stringify({ chapters: scored.chapters, book: scored.book, cards: novelData.chapterScorecards }));
  }, BOOK3);
  const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), 'qcat-parity-'));
  const har = await runQcatHarness({ book: path.join(FIX, 'book-3ch.json'), out: tmpOut, label: 'parity', stubAi: true });
  const a = (inApp.chapters || []).map((c) => ({ ch: c.chapter, overall: c.overall, words: c.length.words, replay: c.replay.internal.shared, plan: c.planCoverage.ratio, world: c.worldImmersion }));
  const b = ((har.scoreJson && har.scoreJson.chapters) || []).map((c) => ({ ch: c.chapter, overall: c.overall, words: c.length.words, replay: c.replay.internal.shared, plan: c.planCoverage.ratio, world: c.worldImmersion }));
  check('0', 'harness JSON matches in-app scorecard for the same book', JSON.stringify(a) === JSON.stringify(b), JSON.stringify({ a, b }));
  await page.close();
}

// ---------------- 1. Synthetic 3-chapter book ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async (book) => {
    const n = normalizeImportedSessionData(book);
    novelData = n.novelData;
    applySessionDataToUI();
    const scored = await nwScoreBook({ trigger: 'scoreAll' });
    const chs = scored.chapters || [];
    function rec(n) { return chs.find((c) => c.chapter === n); }
    function worst(ss) { if (ss.indexOf('FAIL') >= 0) return 'FAIL'; if (ss.indexOf('WARN') >= 0) return 'WARN'; return 'PASS'; }
    return {
      c1: rec(1),
      c2: rec(2),
      c3: rec(3),
      overalls: chs.map((c) => c.overall),
      planInOverall: chs.map((c) => {
        const recomputed = worst([c.length, c.beats, c.cast, c.setting, c.replay, c.repetition, c.voice, c.noteLeak, c.facts].map((m) => m && m.status));
        return { overall: c.overall, plan: c.planCoverage && c.planCoverage.status, recomputed: recomputed, world: c.worldImmersion };
      })
    };
  }, BOOK3);
  check('1', 'ch1 length FAIL (short)', r.c1 && r.c1.length && r.c1.length.status === 'FAIL', JSON.stringify(r.c1 && r.c1.length));
  const c2int = r.c2 && r.c2.replay && r.c2.replay.internal;
  check('1', 'ch2 replay FAIL with restart span', r.c2 && r.c2.replay && r.c2.replay.status === 'FAIL' && c2int && c2int.restartAt != null && c2int.restartSpanWords >= 40, JSON.stringify(r.c2 && r.c2.replay));
  const words = (BOOK3.novelData.chapters[1] || '').trim().split(/\s+/).length;
  const restart = c2int && c2int.restartAt;
  check('1', 'ch2 restart offset within ±50 of the planted copy', restart != null && Math.abs(restart - 80) <= 50, JSON.stringify({ restart, words, span: c2int && c2int.restartSpanWords }));
  check('1', 'ch2 longestRepeatedRun is 40+ words', c2int && c2int.longestRepeatedRun && c2int.longestRepeatedRun.words >= 40, JSON.stringify(c2int && c2int.longestRepeatedRun));
  check('1', 'ch3 clean is not FAIL overall', r.c3 && r.c3.overall !== 'FAIL', JSON.stringify(r.c3 && { overall: r.c3.overall, length: r.c3.length, beats: r.c3.beats && r.c3.beats.status, cast: r.c3.cast, setting: r.c3.setting, replay: r.c3.replay && r.c3.replay.status, rep: r.c3.repetition && r.c3.repetition.status, voice: r.c3.voice, leak: r.c3.noteLeak, facts: r.c3.facts }));
  check('1', 'overall ignores planCoverage', (r.planInOverall || []).every((x) => x.recomputed === x.overall), JSON.stringify(r.planInOverall));
  await page.close();
}

// ---------------- 1b. Recurring phrases: WARN, not FAIL (no restart span) ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async (book) => {
    const n = normalizeImportedSessionData(book);
    novelData = n.novelData;
    applySessionDataToUI();
    const scored = await nwScoreBook({ trigger: 'scoreAll' });
    return scored.chapters[0];
  }, PHRASES);
  const intern = r && r.replay && r.replay.internal;
  check('1b', 'recurring 13-15 word phrases WARN internal replay (no restart)', intern && r.replay.status === 'WARN' && intern.shared >= 25 && intern.restartAt == null, JSON.stringify(r && r.replay));
  check('1b', 'phrases fixture reports longestRepeatedRun under 40', intern && intern.longestRepeatedRun && intern.longestRepeatedRun.words < 40, JSON.stringify(intern && intern.longestRepeatedRun));
  await page.close();
}

// ---------------- 1c. Cast titled names ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async (book) => {
    const n = normalizeImportedSessionData(book);
    novelData = n.novelData;
    applySessionDataToUI();
    const scored = await nwScoreBook({ trigger: 'scoreAll' });
    return scored.chapters[0] && scored.chapters[0].cast;
  }, CASTTITLES);
  const required = (r && r.required) || [];
  const missing = (r && r.missing) || [];
  const reqJoin = required.join('|');
  const bareTitle = (arr) => arr.some((n) => /^(Dr\.?|Doctor|Captain|Capt|Mr|Mrs|Ms|Prof|Professor|Commander|Lt|Sgt|Admiral|General|Colonel|Major)$/i.test(String(n).trim()));
  check('1c', 'titled and untitled forms merge to one person each', required.length === 2 && /Mara Quill/i.test(reqJoin) && /Nico Vellum/i.test(reqJoin) && required.filter((n) => /Mara Quill/i.test(n)).length === 1 && required.filter((n) => /Nico Vellum/i.test(n)).length === 1, JSON.stringify(r));
  check('1c', 'Dr never appears in required or missing', !bareTitle(required) && !bareTitle(missing) && !required.some((n) => n === 'Dr' || n === 'Dr.') && !missing.some((n) => n === 'Dr' || n === 'Dr.'), JSON.stringify(r));
  check('1c', 'Captain never appears as a bare required/missing name', !required.some((n) => /^Captain\.?$/i.test(n)) && !missing.some((n) => /^Captain\.?$/i.test(n)), JSON.stringify(r));
  await page.close();
}

// ---------------- 2. Tic fixture ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async (book) => {
    const n = normalizeImportedSessionData(book);
    novelData = n.novelData;
    applySessionDataToUI();
    const scored = await nwScoreBook({ trigger: 'scoreAll' });
    const c = scored.chapters[0];
    return {
      didNotPer1k: c.voice.didNotPer1k,
      didNotCount: c.voice.didNotCount,
      words: c.length.words,
      dup: c.voice.dupLines
    };
  }, TICS);
  const wantRate = Math.round((r.didNotCount * 1000 / Math.max(1, r.words)) * 10) / 10;
  check('2', 'did-not rate matches to 0.1', Math.abs(r.didNotPer1k - wantRate) < 0.05, JSON.stringify(r));
  check('2', 'verbatim line from two named speakers is listed', Array.isArray(r.dup) && r.dup.some((d) => /not blessing this shift/i.test(d.line) && (d.speakers || []).length >= 2), JSON.stringify(r.dup));
  await page.close();
}

// ---------------- 3. Expectations ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async ({ book, expect }) => {
    const n = normalizeImportedSessionData(book);
    novelData = n.novelData;
    applySessionDataToUI();
    nwMergeQcatExpect(expect);
    const scored = await nwScoreBook({ trigger: 'scoreAll' });
    function rec(n) { return scored.chapters.find((c) => c.chapter === n); }
    const c1 = rec(1);
    const c3 = rec(3);
    const probeMiss = (c1.beats.items || []).find((it) => it.via === 'probe' && it.result === 'missing');
    const probeHit = (c3.beats.items || []).find((it) => it.via === 'probe' && it.result === 'present');
    const excl = (c3.facts.exclude || []).find((x) => /sabotage|ease/i.test(x.label));
    return {
      probeMiss: !!(probeMiss),
      probeHit: !!(probeHit),
      excludeHit: !!(excl && excl.hit === true),
      quirks: c3.facts.quirks,
      includeElena: (c1.facts.include || []).some((x) => x.label === 'Elena present' && x.hit),
      bookExclude: (c1.facts.exclude || []).find((x) => x.label === 'three counts') || (c3.facts.exclude || []).find((x) => x.label === 'three counts')
    };
  }, { book: BOOK3, expect: EXPECT });
  check('3', 'probe miss reported', r.probeMiss, JSON.stringify(r));
  check('3', 'probe hit reported', r.probeHit, JSON.stringify(r));
  check('3', 'mustNotInclude hit reported', r.excludeHit, JSON.stringify(r));
  check('3', 'quirk counts reported', r.quirks && typeof r.quirks['gallery rail'] === 'number' && r.quirks['gallery rail'] >= 1, JSON.stringify(r.quirks));
  check('3', 'chapter mustInclude Elena present hits', r.includeElena === true, JSON.stringify(r));
  check('3', 'book-level mustNotInclude is evaluated', !!(r.bookExclude) && r.bookExclude.hit === false, JSON.stringify(r.bookExclude));
  await page.close();
}

// ---------------- 4. Live mode stubbed ----------------
{
  const liveEnv = { schemaVersion: '1.0', sourceTool: 'NovelWriter', novelData: Object.assign({}, ND, { numChapters: 2, chapters: ['', ''], editedChapters: ['', ''], chapterImprovements: ['', ''], chapterOutlines: ND.chapterOutlines.slice(0, 2), chapterArcs: (ND.chapterArcs || []).slice(0, 2), chapterBlueprints: ND.chapterBlueprints.slice(0, 2), skipAutoRevision: true, autoContinuityAudit: false, aiBeatCheck: false, title: 'QCAT Fixture Live' }) };
  const tmpLive = fs.mkdtempSync(path.join(os.tmpdir(), 'qcat-live-'));
  const liveBook = path.join(tmpLive, 'book-live.json');
  fs.writeFileSync(liveBook, JSON.stringify(liveEnv, null, 2));
  const refused = await runQcatHarness({ book: liveBook, live: true, regen: [1, 2], out: tmpLive, label: 'refuse', stubAi: true });
  check('4', 'live refuses without QCAT_LIVE_ACK', refused.exitCode === 2 && refused.refusedLive === true, JSON.stringify(refused.log));

  process.env.QCAT_LIVE_ACK = '1';
  const tmpOk = fs.mkdtempSync(path.join(os.tmpdir(), 'qcat-liveok-'));
  const liveCopy = path.join(tmpOk, 'book-live.json');
  fs.copyFileSync(liveBook, liveCopy);
  const ok = await runQcatHarness({ book: liveCopy, live: true, regen: [1, 2], out: tmpOk, label: 'stub-live', stubAi: true, maxTokens: 250000 });
  const progress = (ok.log || []).filter((l) => /Chapter \d+\/\d+:/.test(l));
  check('4', 'stub live: one generation progress pair per chapter in order', progress.length >= 4 && /Chapter 1\/2: drafting/.test(progress[0]) && /Chapter 1\/2: done/.test(progress[1]) && /Chapter 2\/2: drafting/.test(progress[2]), JSON.stringify(progress));
  const regenFiles = fs.readdirSync(tmpOk).filter((f) => /book-live\.regen_\d+\.json$/.test(f));
  check('4', 'export written after chapters (regen json next to book)', regenFiles.length >= 1, regenFiles.join(','));
  const sess = fs.existsSync(ok.runDir) ? fs.readdirSync(path.join(ok.runDir, 'sessions')) : [];
  check('4', 'stage-labelled session written', sess.length >= 1, JSON.stringify(sess));

  const tmpCap = fs.mkdtempSync(path.join(os.tmpdir(), 'qcat-cap-'));
  const capCopy = path.join(tmpCap, 'book-live.json');
  fs.copyFileSync(liveBook, capCopy);
  const cap = await runQcatHarness({ book: capCopy, live: true, regen: [1, 2], out: tmpCap, label: 'cap', stubAi: true, maxTokens: 90 });
  const capLog = (cap.log || []).join('\n');
  check('4', 'token cap stops between chapters', /Token cap reached/.test(capLog) || ((cap.log || []).filter((l) => /Chapter 2\/2: drafting/.test(l)).length === 0), capLog);
  delete process.env.QCAT_LIVE_ACK;
}

// ---------------- 5. Mutations (temp copy of HTML; restore proven via SHA-256) ----------------
{
  const before = sha256(HTML_PATH);
  check('5', 'SHA-256 before mutations recorded', /^[a-f0-9]{64}$/.test(before), before);
  async function mutatedFails(flag, expectFailName) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcat-mut-'));
    const copy = path.join(dir, 'NovelWriter.html');
    let html = fs.readFileSync(HTML_PATH, 'utf8');
    const from = 'var ' + flag + ' = true;';
    const to = 'var ' + flag + ' = false;';
    if (html.indexOf(from) < 0) return { ok: false, detail: 'flag not found ' + flag };
    html = html.replace(from, to);
    fs.writeFileSync(copy, html);
    const page = await openPage(copy);
    const r = await page.evaluate(async (book) => {
      const n = normalizeImportedSessionData(book);
      novelData = n.novelData;
      applySessionDataToUI();
      const scored = await nwScoreBook({ trigger: 'scoreAll' });
      return {
        replayStatus: (scored.chapters.find((c) => c.chapter === 2) || {}).replay,
        beats1: (scored.chapters.find((c) => c.chapter === 1) || {}).beats,
        cards: JSON.parse(JSON.stringify(novelData.chapterScorecards || []))
      };
    }, BOOK3);
    await page.close();
    if (flag === 'NW_QCAT_ENABLE_REPLAY') {
      const failedSelf = !(r.replayStatus && r.replayStatus.status === 'FAIL' && r.replayStatus.internal && r.replayStatus.internal.shared >= 25);
      return { ok: failedSelf, detail: JSON.stringify(r.replayStatus), expectFailName };
    }
    if (flag === 'NW_QCAT_ENABLE_PROBES') {
      const page2 = await openPage(copy);
      const p = await page2.evaluate(async ({ book, expect }) => {
        const n = normalizeImportedSessionData(book);
        novelData = n.novelData;
        applySessionDataToUI();
        nwMergeQcatExpect(expect);
        const scored = await nwScoreBook({ trigger: 'scoreAll' });
        const c1 = scored.chapters.find((c) => c.chapter === 1);
        return (c1.beats.items || []).some((it) => it.via === 'probe' && it.result === 'missing');
      }, { book: BOOK3, expect: EXPECT });
      await page2.close();
      return { ok: p === false, detail: 'probe miss still reported=' + p, expectFailName };
    }
    if (flag === 'NW_QCAT_ENABLE_WRITE') {
      const page3 = await openPage(copy);
      const w = await page3.evaluate(async (nd) => {
        const env = { schemaVersion: '1.0', sourceTool: 'NovelWriter', novelData: nd };
        const imported = normalizeImportedSessionData(env);
        novelData = imported.novelData;
        novelData.chapters = Array.from({ length: nd.numChapters }, () => '');
        novelData.skipAutoRevision = true;
        novelData.autoContinuityAudit = false;
        novelData.aiBeatCheck = false;
        applySessionDataToUI();
        document.getElementById('skipAutoRevision').checked = true;
        document.getElementById('autoContinuityAudit').checked = false;
        document.getElementById('apiKey').value = 'smoke-placeholder-not-a-key';
        let err = null;
        try { await generateChapter(1); } catch (e) { err = String(e && e.message || e); }
        return {
          err: err,
          textLen: String((novelData.chapters || [])[0] || '').length,
          wrote: !!((novelData.chapterScorecards || [])[0] && (novelData.chapterScorecards || [])[0].overall)
        };
      }, ND);
      await page3.close();
      return { ok: w.textLen > 40 && w.wrote === false, detail: JSON.stringify(w), expectFailName };
    }
    return { ok: false, detail: 'unknown flag' };
  }

  const m1 = await mutatedFails('NW_QCAT_ENABLE_REPLAY', 'replay');
  check('5', 'disabling replay check fails the self-test', m1.ok, m1.detail);
  const m2 = await mutatedFails('NW_QCAT_ENABLE_PROBES', 'probes');
  check('5', 'disabling probe check fails the self-test', m2.ok, m2.detail);
  const m3 = await mutatedFails('NW_QCAT_ENABLE_WRITE', 'write');
  check('5', 'disabling per-chapter scorecard write fails the self-test', m3.ok, m3.detail);

  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcat-mut-m4-'));
    const copy = path.join(dir, 'NovelWriter.html');
    let html = fs.readFileSync(HTML_PATH, 'utf8');
    const from = 'var NW_QCAT_REPLAY_REQUIRE_RESTART = true;';
    const to = 'var NW_QCAT_REPLAY_REQUIRE_RESTART = false;';
    check('5', 'M4 flag present in source', html.indexOf(from) >= 0, 'NW_QCAT_REPLAY_REQUIRE_RESTART not found');
    html = html.replace(from, to);
    fs.writeFileSync(copy, html);
    const page = await openPage(copy);
    const r = await page.evaluate(async (book) => {
      const n = normalizeImportedSessionData(book);
      novelData = n.novelData;
      applySessionDataToUI();
      const scored = await nwScoreBook({ trigger: 'scoreAll' });
      return scored.chapters[0] && scored.chapters[0].replay;
    }, PHRASES);
    await page.close();
    const failedSelf = r && r.status === 'FAIL' && r.internal && r.internal.shared >= 25 && r.internal.restartAt == null;
    check('5', 'M4 FAIL on shared count alone: no-restart fixture fails the self-test', failedSelf, JSON.stringify(r));
  }
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcat-mut-m5-'));
    const copy = path.join(dir, 'NovelWriter.html');
    let html = fs.readFileSync(HTML_PATH, 'utf8');
    const from = 'var NW_QCAT_FILTER_TITLE_FRAGMENTS = true;';
    const to = 'var NW_QCAT_FILTER_TITLE_FRAGMENTS = false;';
    check('5', 'M5 flag present in source', html.indexOf(from) >= 0, 'NW_QCAT_FILTER_TITLE_FRAGMENTS not found');
    html = html.replace(from, to);
    fs.writeFileSync(copy, html);
    const page = await openPage(copy);
    const r = await page.evaluate(async (book) => {
      const n = normalizeImportedSessionData(book);
      novelData = n.novelData;
      applySessionDataToUI();
      const scored = await nwScoreBook({ trigger: 'scoreAll' });
      return scored.chapters[0] && scored.chapters[0].cast;
    }, CASTTITLES);
    await page.close();
    const req = (r && r.required) || [];
    const miss = (r && r.missing) || [];
    const hasDr = req.concat(miss).some((n) => /^(Dr\.?|Doctor)$/i.test(String(n).trim()));
    check('5', 'M5 remove title-fragment filter: cast fixture fails the self-test', hasDr, JSON.stringify(r));
  }
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcat-mut-m6-'));
    const copy = path.join(dir, 'NovelWriter.html');
    let html = fs.readFileSync(HTML_PATH, 'utf8');
    const from = 'var NW_QCAT_PERSIST_FACTS_BEFORE_REBUILD = true;';
    const to = 'var NW_QCAT_PERSIST_FACTS_BEFORE_REBUILD = false;';
    check('5', 'M6 flag present in source', html.indexOf(from) >= 0, 'NW_QCAT_PERSIST_FACTS_BEFORE_REBUILD not found');
    html = html.replace(from, to);
    fs.writeFileSync(copy, html);
    const page = await openPage(copy);
    const r = await page.evaluate(async (book) => {
      const n = normalizeImportedSessionData(book);
      novelData = n.novelData;
      applySessionDataToUI();
      nwAddPlanFactRow(1, { label: 'survive-rebuild', kind: 'include', match: 'phrase', pattern: 'xyzzy-survive' });
      showTab(6);
      const stored = ((novelData.chapterFactChecks || [])[0] || []).some((e) => e && e.label === 'survive-rebuild');
      return { stored: stored, facts: JSON.parse(JSON.stringify((novelData.chapterFactChecks || [])[0] || [])) };
    }, BOOK3);
    await page.close();
    check('5', 'M6 skip persist-before-rebuild: Tab 6 rebuild drops Plan-fact edits (fails self-test)', r.stored === false, JSON.stringify(r));
  }
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcat-mut-m7-'));
    const copy = path.join(dir, 'NovelWriter.html');
    let html = fs.readFileSync(HTML_PATH, 'utf8');
    const from = 'var NW_QCAT_INVALID_REGEX_FAILS_FACTS = true;';
    const to = 'var NW_QCAT_INVALID_REGEX_FAILS_FACTS = false;';
    check('5', 'M7 flag present in source', html.indexOf(from) >= 0, 'NW_QCAT_INVALID_REGEX_FAILS_FACTS not found');
    html = html.replace(from, to);
    fs.writeFileSync(copy, html);
    const page = await openPage(copy);
    const r = await page.evaluate(async (book) => {
      const n = normalizeImportedSessionData(book);
      novelData = n.novelData;
      novelData.chapterFactChecks = [[{ id: 'bad', label: 'bad re', kind: 'include', match: 'regex', pattern: '[' }]];
      applySessionDataToUI();
      const scored = await nwScoreBook({ trigger: 'scoreAll' });
      const c1 = scored.chapters.find((c) => c.chapter === 1);
      return c1 && c1.facts;
    }, BOOK3);
    await page.close();
    check('5', 'M7 invalid regex does not fail Facts: self-test fails', r && r.status === 'PASS', JSON.stringify(r));
  }
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcat-mut-m8-'));
    const copy = path.join(dir, 'NovelWriter.html');
    let html = fs.readFileSync(HTML_PATH, 'utf8');
    const from = 'var NW_QCAT_SCORE_AFTER_COVERAGE = true;';
    const to = 'var NW_QCAT_SCORE_AFTER_COVERAGE = false;';
    check('5', 'M8 flag present in source', html.indexOf(from) >= 0, 'NW_QCAT_SCORE_AFTER_COVERAGE not found');
    html = html.replace(from, to);
    fs.writeFileSync(copy, html);
    const page = await openPage(copy);
    const r = await page.evaluate(async (nd) => {
      const env = { schemaVersion: '1.0', sourceTool: 'NovelWriter', novelData: nd };
      const imported = normalizeImportedSessionData(env);
      novelData = imported.novelData;
      novelData.chapters = Array.from({ length: nd.numChapters }, () => '');
      novelData.skipAutoRevision = true;
      novelData.autoContinuityAudit = false;
      novelData.aiBeatCheck = true;
      applySessionDataToUI();
      document.getElementById('skipAutoRevision').checked = true;
      document.getElementById('autoContinuityAudit').checked = false;
      document.getElementById('aiBeatCheck').checked = true;
      document.getElementById('apiKey').value = 'smoke-placeholder-not-a-key';
      novelData.chapterScorecards[0] = { overall: 'PASS', trigger: 'sentinel-prev', chapter: 1 };
      window.scoreObligationCoverage = function () {
        return { covered: 0, total: 6, ratio: 0, words: 40, passed: false, failures: ['smoke: coverage reject'], misses: ['smoke-obligation'] };
      };
      window.__h.calls.length = 0;
      let err = null;
      try { await generateChapter(1); } catch (e) { err = String(e && e.message || e); }
      const card = (novelData.chapterScorecards || [])[0];
      return {
        err: err,
        trigger: card && card.trigger,
        beat: window.__h.calls.filter((c) => c.operationName === 'beatCheck').length
      };
    }, ND);
    await page.close();
    const overwrote = r && r.trigger && r.trigger !== 'sentinel-prev';
    check('5', 'M8 score before coverage: rejected draft stores a scorecard (fails self-test)', overwrote === true, JSON.stringify(r));
  }
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcat-mut-m9-'));
    const copy = path.join(dir, 'NovelWriter.html');
    let html = fs.readFileSync(HTML_PATH, 'utf8');
    const from = 'var NW_QCAT_CLEAR_EMPTY_PLAN_FACTS = true;';
    const to = 'var NW_QCAT_CLEAR_EMPTY_PLAN_FACTS = false;';
    check('5', 'M9 flag present in source', html.indexOf(from) >= 0, 'NW_QCAT_CLEAR_EMPTY_PLAN_FACTS not found');
    html = html.replace(from, to);
    fs.writeFileSync(copy, html);
    const page = await openPage(copy);
    const r = await page.evaluate(async (book) => {
      const n = normalizeImportedSessionData(book);
      novelData = n.novelData;
      applySessionDataToUI();
      nwAddPlanFactRow(1, { label: 'keep-me', kind: 'include', match: 'phrase', pattern: 'keep-me' });
      nwCollectPlanFactsFromUi();
      const tbody = document.getElementById('planFactsBody1');
      if (tbody) Array.from(tbody.querySelectorAll('tr')).forEach((tr) => tr.parentNode.removeChild(tr));
      nwCollectPlanFactsFromUi();
      return JSON.parse(JSON.stringify((novelData.chapterFactChecks || [])[0] || []));
    }, BOOK3);
    await page.close();
    const stillThere = Array.isArray(r) && r.some((e) => e && e.label === 'keep-me');
    check('5', 'M9 skip clearing empty Plan facts: deleted rows remain stored (fails self-test)', stillThere === true, JSON.stringify(r));
  }
  const after = sha256(HTML_PATH);
  check('5', 'SHA-256 after mutations matches before (source restored / never edited)', after === before, before + ' vs ' + after);
}

// ---------------- nwWorkflowStage ----------------
{
  const page = await openPage();
  const r = await page.evaluate(() => {
    function st(nd) { return nwWorkflowStage(nd); }
    const plan = st({ title: 'X', numChapters: 3, chapters: [], chapterOutlines: [], chapterBlueprints: [] });
    const outlines = st({ numChapters: 3, chapterOutlines: ['word '.repeat(30), '', ''], chapterBlueprints: [], chapters: [] });
    const bps = st({ numChapters: 3, chapterOutlines: ['word '.repeat(30)], chapterBlueprints: [{ role: 'open' }], chapters: [] });
    const enriched = st({ numChapters: 3, chapterBlueprints: [{ sceneGoal: 'g', dialogueTurn: 'd', turnOrPayoff: 't' }], chapters: [] });
    const drafted = st({ numChapters: 3, chapters: ['draft text', '', ''], chapterBlueprints: [{ sceneGoal: 'g', dialogueTurn: 'd', turnOrPayoff: 't' }] });
    const complete = st({ numChapters: 2, chapters: ['a', 'b'], chapterScorecards: [{ overall: 'PASS' }, { overall: 'WARN' }], chapterBlueprints: [{ sceneGoal: 'g', dialogueTurn: 'd', turnOrPayoff: 't' }] });
    const holes = st({ numChapters: 3, chapters: ['a', '', 'c'], chapterScorecards: [{ overall: 'PASS' }, null, { overall: 'WARN' }], chapterBlueprints: [{ sceneGoal: 'g', dialogueTurn: 'd', turnOrPayoff: 't' }] });
    const lastOnly = st({ numChapters: 3, chapters: ['', '', 'c'], chapterScorecards: [null, null, { overall: 'PASS' }], chapterBlueprints: [{ sceneGoal: 'g', dialogueTurn: 'd', turnOrPayoff: 't' }] });
    return { plan, outlines, bps, enriched, drafted, complete, holes, lastOnly };
  });
  check('stage', 'plan-only is 01-plan', r.plan === '01-plan', JSON.stringify(r));
  check('stage', 'outlines is 02-outlines', r.outlines === '02-outlines', JSON.stringify(r));
  check('stage', 'blueprints is 03-blueprints', r.bps === '03-blueprints', JSON.stringify(r));
  check('stage', 'enriched is 04-enriched', r.enriched === '04-enriched', JSON.stringify(r));
  check('stage', 'ch1-drafted is 05-ch01-drafted', r.drafted === '05-ch01-drafted', JSON.stringify(r));
  check('stage', 'complete is 07-book-complete', r.complete === '07-book-complete', JSON.stringify(r));
  check('stage', 'blank earlier chapters are not 07-book-complete', r.holes !== '07-book-complete' && r.lastOnly !== '07-book-complete', JSON.stringify(r));
  await page.close();
}

// ---------------- 1d. Resize scorecards/facts with numChapters ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async (book) => {
    const n = normalizeImportedSessionData(book);
    novelData = n.novelData;
    novelData.chapterScorecards = [{ overall: 'PASS', chapter: 1 }, { overall: 'WARN', chapter: 2 }, { overall: 'FAIL', chapter: 3 }];
    novelData.chapterFactChecks = [[{ label: 'a' }], [{ label: 'b' }], [{ label: 'c' }]];
    applySessionDataToUI();
    document.getElementById('numChapters').value = '2';
    await updateChapterSubpages();
    return {
      n: novelData.numChapters,
      cards: (novelData.chapterScorecards || []).length,
      facts: (novelData.chapterFactChecks || []).length,
      droppedCard: (novelData.chapterScorecards || [])[2],
      droppedFact: (novelData.chapterFactChecks || [])[2]
    };
  }, BOOK3);
  check('1d', 'reducing numChapters resizes chapterScorecards and chapterFactChecks', r.n === 2 && r.cards === 2 && r.facts === 2 && r.droppedCard == null && r.droppedFact == null, JSON.stringify(r));
  await page.close();
}

// ---------------- 2. Plan-fact edits survive Tab 6 rebuild ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async (book) => {
    const n = normalizeImportedSessionData(book);
    novelData = n.novelData;
    applySessionDataToUI();
    nwAddPlanFactRow(1, { label: 'survive-rebuild', kind: 'include', match: 'phrase', pattern: 'xyzzy-survive' });
    showTab(6);
    const stored = ((novelData.chapterFactChecks || [])[0] || []).some((e) => e && e.label === 'survive-rebuild' && e.pattern === 'xyzzy-survive');
    const tbody = document.getElementById('planFactsBody1');
    const rendered = tbody ? Array.from(tbody.querySelectorAll('.pf-label')).some((el) => el.value === 'survive-rebuild') : false;
    return { stored: stored, rendered: rendered };
  }, BOOK3);
  check('2', 'Plan-fact edits survive a Tab 6 rebuild', r.stored === true && r.rendered === true, JSON.stringify(r));
  await page.close();
}

// ---------------- 4. AI beat check does not overwrite probe-backed items ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async ({ book, expect }) => {
    const n = normalizeImportedSessionData(book);
    novelData = n.novelData;
    applySessionDataToUI();
    nwMergeQcatExpect(expect);
    novelData.aiBeatCheck = true;
    const orig = window.callAI;
    window.callAI = async function (messages, tab, opts) {
      if (opts && opts.operationName === 'beatCheck') {
        return { beats: [{ field: 'turnOrPayoff', result: 'present', evidence: 'ai override should not win' }] };
      }
      return orig.apply(this, arguments);
    };
    const scored = await nwScoreBook({ trigger: 'scoreAll' });
    window.callAI = orig;
    const c1 = scored.chapters.find((c) => c.chapter === 1);
    const probe = (c1.beats.items || []).find((it) => it.via === 'probe' && /planted probe miss/i.test(it.label || ''));
    return { probe: probe, mode: c1.beats && c1.beats.mode };
  }, { book: BOOK3, expect: EXPECT });
  check('4', 'AI beat check preserves probe-backed miss', r.probe && r.probe.via === 'probe' && r.probe.result === 'missing', JSON.stringify(r));
  await page.close();
}

// ---------------- 5b. Scoring loops declare i; no global leak ----------------
{
  const start = HTML.indexOf('// ---- NW.T8d:');
  const end = HTML.indexOf('// ---- NW.T5: Chapter Generation');
  const block = (start >= 0 && end > start) ? HTML.slice(start, end) : HTML;
  check('5b', 'scoring code has no undeclared for-i', !/\bfor\s*\(\s*i\s*=/.test(block), 'found undeclared for (i =');
  const page = await openPage();
  const leaked = await page.evaluate(async (book) => {
    window.i = 'sentinel-qcat-i';
    const n = normalizeImportedSessionData(book);
    novelData = n.novelData;
    applySessionDataToUI();
    await nwScoreBook({ trigger: 'scoreAll' });
    return window.i;
  }, BOOK3);
  check('5b', 'scoring leaves no global i', leaked === 'sentinel-qcat-i', String(leaked));
  await page.close();
}

// ---------------- 6. Invalid regex makes Facts FAIL ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async (book) => {
    const n = normalizeImportedSessionData(book);
    novelData = n.novelData;
    novelData.chapterFactChecks = [[{ id: 'bad', label: 'bad re', kind: 'include', match: 'regex', pattern: '[' }]];
    applySessionDataToUI();
    const scored = await nwScoreBook({ trigger: 'scoreAll' });
    const c1 = scored.chapters.find((c) => c.chapter === 1);
    return c1 && c1.facts;
  }, BOOK3);
  check('6', 'invalid regex makes Facts FAIL', r && r.status === 'FAIL' && (r.include || []).some((x) => x.invalid), JSON.stringify(r));
  await page.close();
}

// ---------------- 12. Coverage reject does not store a scorecard ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async (nd) => {
    const env = { schemaVersion: '1.0', sourceTool: 'NovelWriter', novelData: nd };
    const imported = normalizeImportedSessionData(env);
    novelData = imported.novelData;
    novelData.chapters = Array.from({ length: nd.numChapters }, () => '');
    novelData.skipAutoRevision = true;
    novelData.autoContinuityAudit = false;
    novelData.aiBeatCheck = true;
    applySessionDataToUI();
    document.getElementById('skipAutoRevision').checked = true;
    document.getElementById('autoContinuityAudit').checked = false;
    document.getElementById('aiBeatCheck').checked = true;
    document.getElementById('apiKey').value = 'smoke-placeholder-not-a-key';
    novelData.chapterScorecards[0] = { overall: 'PASS', trigger: 'sentinel-prev', chapter: 1 };
    window.scoreObligationCoverage = function () {
      return { covered: 0, total: 6, ratio: 0, words: 40, passed: false, failures: ['smoke: coverage reject'], misses: ['smoke-obligation'] };
    };
    window.__h.calls.length = 0;
    let err = null;
    try { await generateChapter(1); } catch (e) { err = String(e && e.message || e); }
    const card = (novelData.chapterScorecards || [])[0];
    return {
      err: err,
      trigger: card && card.trigger,
      beat: window.__h.calls.filter((c) => c.operationName === 'beatCheck').length,
      coverage: /OBLIGATION COVERAGE FAIL-CLOSED/.test(err || '')
    };
  }, ND);
  check('12', 'coverage reject restores previous scorecard and skips beat-check', r.coverage && r.trigger === 'sentinel-prev' && r.beat === 0, JSON.stringify(r));
  await page.close();
}

// ---------------- 20. Score all chapters collects UI first ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async (book) => {
    const n = normalizeImportedSessionData(book);
    novelData = n.novelData;
    novelData.aiBeatCheck = false;
    applySessionDataToUI();
    document.getElementById('aiBeatCheck').checked = true;
    novelData.aiBeatCheck = false;
    nwAddPlanFactRow(1, { label: 'score-all-fact', kind: 'include', match: 'phrase', pattern: 'Elena' });
    await nwScoreAllChapters();
    const c1 = (novelData.chapterScorecards || [])[0];
    const factHit = c1 && c1.facts && (c1.facts.include || []).some((x) => x.label === 'score-all-fact' && x.hit);
    return { ai: novelData.aiBeatCheck, factHit: factHit };
  }, BOOK3);
  check('20', 'Score all chapters collectData uses current Plan facts and aiBeatCheck', r.ai === true && r.factHit === true, JSON.stringify(r));
  await page.close();
}

// ---------------- 21. Deleting every Plan fact row clears the stored array ----------------
{
  const page = await openPage();
  const r = await page.evaluate(async (book) => {
    const n = normalizeImportedSessionData(book);
    novelData = n.novelData;
    applySessionDataToUI();
    nwAddPlanFactRow(1, { label: 'gone', kind: 'include', match: 'phrase', pattern: 'gone' });
    nwCollectPlanFactsFromUi();
    const before = ((novelData.chapterFactChecks || [])[0] || []).length;
    const tbody = document.getElementById('planFactsBody1');
    if (tbody) Array.from(tbody.querySelectorAll('tr')).forEach((tr) => tr.parentNode.removeChild(tr));
    nwCollectPlanFactsFromUi();
    const after = (novelData.chapterFactChecks || [])[0];
    return { before: before, after: after };
  }, BOOK3);
  check('21', 'deleting every Plan fact row clears the stored array', r.before > 0 && Array.isArray(r.after) && r.after.length === 0, JSON.stringify(r));
  await page.close();
}

await browser.close();

// ---------------- 14. Harness bad input is exit 2 ----------------
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qcat-bad-'));
  fs.writeFileSync(path.join(tmp, 'bad-book.json'), '{not json');
  const badBook = await runQcatHarness({ book: path.join(tmp, 'bad-book.json'), out: tmp, label: 'bad-book', stubAi: true });
  check('14', 'malformed book JSON is exit 2', badBook.exitCode === 2 && /malformed book JSON/i.test((badBook.log || []).join('\n')), JSON.stringify(badBook.log));
  const missing = await runQcatHarness({ book: path.join(FIX, 'book-3ch.json'), expect: path.join(tmp, 'no-such-expect.json'), out: tmp, label: 'missing-expect', stubAi: true });
  check('14', 'missing --expect file is exit 2', missing.exitCode === 2 && /--expect file not found/i.test((missing.log || []).join('\n')), JSON.stringify(missing.log));
  fs.writeFileSync(path.join(tmp, 'bad-expect.json'), '{nope');
  const badExpect = await runQcatHarness({ book: path.join(FIX, 'book-3ch.json'), expect: path.join(tmp, 'bad-expect.json'), out: tmp, label: 'bad-expect', stubAi: true });
  check('14', 'malformed expect JSON is exit 2', badExpect.exitCode === 2 && /malformed expect JSON/i.test((badExpect.log || []).join('\n')), JSON.stringify(badExpect.log));
}

check('pageerror', 'no uncaught pageerror events', pageErrors.length === 0, pageErrors.join(' | '));

const failed = checks.filter((c) => !c.ok);
const report = { passed: checks.filter((c) => c.ok).length, failed: failed.length, checks, pageErrors };
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'SMOKE_QCAT_HARNESS.json'), JSON.stringify(report, null, 2));
console.log('QCAT harness smoke: ' + report.passed + ' passed, ' + report.failed + ' failed');
for (const c of checks) {
  console.log((c.ok ? 'PASS' : 'FAIL') + ' [' + c.id + '] ' + c.name + (c.ok ? '' : ' :: ' + c.detail));
}
if (failed.length) process.exit(1);
