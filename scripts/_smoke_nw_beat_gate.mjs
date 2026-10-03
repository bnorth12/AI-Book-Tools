/**
 * Offline smoke for NW_GATE_FIX_SPEC fixes 1-5 and 7 (S1-S14 except S11, which is the existing smokes).
 * No network, no API key: every http(s) request is aborted except api.x.ai in the S9/S10 page, which is
 * answered by scripts/_nw_e2e_offline_responder.mjs. Nothing here needs XAI_API_KEY.
 *
 * Layer A (node vm, pure): the BEAT_COVERAGE and GATE_HELPERS blocks extracted from NovelWriter.html.
 *   S1 old-shape fixture, all chapters: 39 failures (sceneGoal x18, dialogueTurn x18, sensoryWorldHook stub ch4/12/17), 0 dupes
 *   S2 gate for Generate Chapter 1: covers ch1+ch2 only, 4 beat failures, no duplicate lines, names the button, `+N more`
 *   S3 gate for the last chapter (18): covers ch18 only
 *   S4 role no longer feeds sceneGoal; goal still maps
 *   S5 object worldHooks: no [object Object]
 * Layer B (Playwright file://, callAI / alert / enrichChapterBlueprints stubbed or spied, collectData stubbed so the
 * fixture set on novelData is not overwritten from empty form fields):
 *   S6 six-beat outline response: max_tokens >= 12000, hyphen ids requested, no auto-enrich, status OK, gate beats pass
 *   S7 old-shape outline response: auto-enrich called once and visible ("Running Enrich..."); a throwing enrich keeps outlines
 *   S8 thin ch5 only: Generate ch1/ch2/ch3 beats pass; Tab 4->5 readiness false with beat_*:ch5; Generate ch4 and ch5
 *      hard-block (0 provider calls); Generate All (slot 8) refuses to start (0 provider calls, status names ch5 + button)
 *   S12 Generate ch3 rebuilds only ch4's packet after generation (plus the pre-gen ch3 build), 0 alerts; after regenerating
 *       ch3, Generate ch5's packet carries the new ch3 audit threads, not the old ones
 *   S13 Generate the last chapter: no post-generation packet build, no error
 *   S14 Rebuild Continuity Packets button: rebuilds all N, alerts once
 * Layer C (Playwright file://, in-page runTrackedE2E with the offline responder):
 *   S9  autoEnrichChapterBlueprints row: skip for the six-beat b3r seed; fail for an old-shape copy of it
 *   S10 real runC1Smoke() === true and the c1Smoke row passes; runC1Smoke patched to return null fails the row
 *
 * Usage: node scripts/_smoke_nw_beat_gate.mjs
 * Env:   NW_HTML_PATH (default this checkout's NovelWriter/NovelWriter.html), NW_OUT_DIR (default out/nw-smoke)
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright';
import { createOfflineResponder, toXaiResponse } from './_nw_e2e_offline_responder.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const HTML_PATH = path.resolve(process.env.NW_HTML_PATH || path.join(REPO_ROOT, 'NovelWriter', 'NovelWriter.html'));
const OUT_DIR = path.resolve(process.env.NW_OUT_DIR || path.join(REPO_ROOT, 'out', 'nw-smoke'));
const FIXTURE = path.join(REPO_ROOT, 'NovelWriter', 'fixtures', 'beat-gate-old-shape-v1', 'novelData.json');
const B3R_SEED = path.join(SCRIPT_DIR, 'fixtures', 'nw_slop', 'b3r_seed.json');

for (const k of ['XAI_API_KEY', 'GROK_API_KEY', 'NW_E2E_LIVE']) delete process.env[k];

const checks = [];
const check = (id, name, ok, detail) => checks.push({ id, name, ok: !!ok, detail: ok ? '' : String(detail == null ? '' : detail).slice(0, 900) });
const clone = (o) => JSON.parse(JSON.stringify(o));
const HTML = fs.readFileSync(HTML_PATH, 'utf8');
const FX = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
delete FX._fixture;
const B3R = JSON.parse(fs.readFileSync(B3R_SEED, 'utf8'));
const BUTTON = 'Enrich Chapter Blueprints';

/** Fixture with all six beats dense (>= 40 chars) for every chapter; castArcBeat names a cast member. */
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

/** Old-shape copy of a six-beat seed: beats removed, legacy fields (role/arcStep/characterBeats/worldHooks/...) kept. */
function oldShape(seed) {
  const s = clone(seed);
  s.chapterBlueprints = (s.chapterBlueprints || []).map((bp) => {
    const o = Object.assign({}, bp);
    for (const k of ['sceneGoal', 'goal', 'castArcBeat', 'subplotPressure', 'dialogueTurn', 'sensoryWorldHook', 'turnOrPayoff', 'threads']) delete o[k];
    o.worldHooks = ['dock'];
    o.allowedPayoffs = [];
    return o;
  });
  return s;
}

// ---------------- Layer A: vm ----------------
function block(name) {
  const a = HTML.indexOf('// === ' + name + '_BEGIN ===');
  const b = HTML.indexOf('// === ' + name + '_END ===');
  if (a < 0 || b < a) throw new Error('block not found in HTML: ' + name);
  return HTML.slice(a, b);
}
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(block('BEAT_COVERAGE') + '\n' + block('GATE_HELPERS'), sandbox, { filename: 'NovelWriter.html#BEAT_COVERAGE+GATE_HELPERS' });
const A = (expr) => vm.runInContext(expr, sandbox);
sandbox.__fx = clone(FX);

{ // S1
  const r = A('scoreBeatCoverage(__fx, { chapterCap: 18 })');
  const f = r.failures;
  const count = (re) => f.filter((x) => re.test(x)).length;
  const stubs = f.filter((x) => /^beat_stub:sensoryWorldHook:/.test(x)).map((x) => Number(x.match(/:ch(\d+)/)[1]));
  check('S1', 'old-shape fixture: 39 beat failures over 18 chapters', f.length === 39 && r.perChapter.length === 18, 'len=' + f.length + ' ' + JSON.stringify(f));
  check('S1', 'no duplicate failure codes (Set size == array length)', new Set(f).size === f.length, f.length - new Set(f).size + ' dupes');
  check('S1', 'sceneGoal missing x18', count(/^beat_missing:sceneGoal:/) === 18, count(/^beat_missing:sceneGoal:/));
  check('S1', 'dialogueTurn missing x18', count(/^beat_missing:dialogueTurn:/) === 18, count(/^beat_missing:dialogueTurn:/));
  check('S1', 'sensoryWorldHook stub x3 on ch4/12/17', JSON.stringify(stubs) === '[4,12,17]', JSON.stringify(stubs));
  check('S1', 'exactly one failure per beat per chapter', Object.values(f.reduce((m, x) => { const k = x.replace(/:chars=.*$/, ''); m[k] = (m[k] || 0) + 1; return m; }, {})).every((v) => v === 1), '');
}
{ // S2
  const g = A('scoreGenerateChapterGate(__fx, 1)');
  const chs = g.beat.perChapter.map((r) => r.chapter);
  const beatFails = g.beat.failures;
  check('S2', 'gate for Generate Chapter 1 covers only ch1 and ch2', JSON.stringify(chs) === '[1,2]', JSON.stringify(chs));
  check('S2', '4 beat failures (sceneGoal + dialogueTurn on ch1 and ch2)', beatFails.length === 4, JSON.stringify(beatFails));
  check('S2', 'gate fails closed', g.passed === false && /^STAGE GATE FAIL-CLOSED \[generateChapter 1\]/.test(g.message), g.message);
  const parts = g.message.replace(/^STAGE GATE FAIL-CLOSED \[generateChapter 1\]: /, '').split(' | ');
  check('S2', 'message has no duplicate lines', new Set(parts).size === parts.length && new Set(g.failures).size === g.failures.length, g.message);
  check('S2', 'message groups beats per chapter (ch1: sceneGoal missing, dialogueTurn missing)', /ch1: sceneGoal missing, dialogueTurn missing/.test(g.message) && /ch2: sceneGoal missing, dialogueTurn missing/.test(g.message), g.message);
  check('S2', 'message names the "' + BUTTON + '" button', g.message.includes(BUTTON), g.message);
  const many = A('nwFormatGateFailures(' + JSON.stringify(Array.from({ length: 14 }, (_, i) => 'f' + i).concat(['f1', 'f2', 'f3'])) + ', 10)');
  check('S2', 'more than 10 failures: dedupe then first 10 + "… +4 more"', many.failures.length === 14 && many.shown.length === 10 && many.more === 4 && /\| … \+4 more$/.test(many.text), JSON.stringify(many));
  const tight = A('scoreGenerateChapterGate(__fx, 1, { maxShown: 1 })');
  check('S2', 'gate message ends the list with "+N more" when failures exceed the cap', /\| … \+1 more\. Click "/.test(tight.message) && tight.more === 1, tight.message);
  const all = A('nwFormatGateFailures(nwGroupBeatFailures(scoreBeatCoverage(__fx, { chapterCap: 18 }).failures), 10)');
  check('S2', 'all-chapter beat failures group to 18 lines: 10 shown, "+8 more"', all.failures.length === 18 && all.more === 8, JSON.stringify({ n: all.failures.length, more: all.more }));
}
{ // S3
  const g = A('scoreGenerateChapterGate(__fx, 18)');
  check('S3', 'gate for the last chapter (18) checks only ch18', JSON.stringify(g.beat.perChapter.map((r) => r.chapter)) === '[18]' && g.beat.failures.every((x) => /:ch18(\D|$)/.test(x)), JSON.stringify(g.beat.failures));
  const c = A('scoreBeatCoverage(__fx, { chapterCap: 18, chapters: [0, 18, 19, 18, 2.5, 17] })');
  check('S3', 'opts.chapters is clipped to [1, cap] and deduped', JSON.stringify(c.chapters) === '[17,18]', JSON.stringify(c.chapters));
}
{ // S4
  const r = A("normalizeChapterBeatPack({ role: 'x'.repeat(60) }, 1)");
  check('S4', 'role no longer feeds sceneGoal', r.sceneGoal === '' && r.role === 'x'.repeat(60), JSON.stringify(r.sceneGoal));
  const g = A("normalizeChapterBeatPack({ goal: 'g'.repeat(60) }, 1)");
  check('S4', '{goal: 60 chars} still maps to sceneGoal', g.sceneGoal === 'g'.repeat(60), JSON.stringify(g.sceneGoal));
  const a = A("normalizeChapterBeatPack({ arcStep: 'a'.repeat(60) }, 1)");
  check('S4', 'no arcStep fallback for sceneGoal / sensoryWorldHook / dialogueTurn', a.sceneGoal === '' && a.sensoryWorldHook === '' && a.dialogueTurn === '', JSON.stringify(a));
}
{ // S5
  const r = A("normalizeChapterBeatPack({ worldHooks: [{ name: 'Flux Archives', detail: 'ozone tang in the stacks.' }], allowedPayoffs: [{ name: 'Ledger', description: 'the forged entry surfaces.' }] }, 1)");
  check('S5', 'object worldHooks give no [object Object]', !/\[object Object\]/.test(r.sensoryWorldHook) && r.sensoryWorldHook === 'Flux Archives: ozone tang in the stacks.', r.sensoryWorldHook);
  check('S5', 'object allowedPayoffs give no [object Object]', !/\[object Object\]/.test(r.turnOrPayoff) && /Ledger: the forged entry surfaces\./.test(r.turnOrPayoff), r.turnOrPayoff);
}

// ---------------- Layer B: page with stubs ----------------
const htmlLines = HTML.split(/\r?\n/);
const knownRace = (e) => {
  if (!/Cannot set properties of null/.test(String(e && e.message || e))) return false;
  const m = String(e && e.stack || '').match(/NovelWriter\.html:(\d+):\d+/);
  return !!m && /getElementById\(`chapter(?:GenContent|EditContent|EditImprovement)\$\{i\}`\)\.value = novelData\.(?:chapters|chapterImprovements)\[i-1\]/.test(htmlLines[parseInt(m[1], 10) - 1] || '');
};
async function openPage(browser, onXai) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => { if (!knownRace(e)) errors.push(String(e && e.message || e)); });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (!/^https?:/i.test(url)) return route.continue();
    if (onXai && /^https:\/\/api\.x\.ai\//i.test(url)) return onXai(route);
    return route.abort('blockedbyclient');
  });
  await page.goto(pathToFileURL(HTML_PATH).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof scoreGenerateChapterGate === 'function' && typeof generateChapter === 'function', null, { timeout: 30000 });
  return { page, errors };
}

const browser = await chromium.launch({ headless: true });
const { page, errors: pageErrors } = await openPage(browser, null);

// Shared in-page harness: load a fixture into the live novelData, stub collectData/alert/callAI, spy on packets/enrich.
await page.evaluate(() => {
  const real = { buildChapterContinuityPacket: window.buildChapterContinuityPacket, runChapterContinuityAudit: window.runChapterContinuityAudit };
  window.__h = {
    real, alerts: [], ai: [], packets: [], enrichCalls: [], aiReply: null, chapterText: (n) => 'Chapter ' + n + ' prose.',
    load(nd) {
      Object.keys(nd).forEach((k) => { novelData[k] = JSON.parse(JSON.stringify(nd[k])); });
      novelData.chapters = Array.from({ length: nd.numChapters }, () => '');
      novelData.chapterContinuityPackets = [];
      novelData.continuityTracker = { chapters: [], characterArcProgress: [], storyArcProgress: {} };
      novelData.autoContinuityAudit = false;
    },
    reset() { this.alerts.length = 0; this.ai.length = 0; this.packets.length = 0; this.enrichCalls.length = 0; }
  };
  window.collectData = function () {};
  window.alert = function (m) { window.__h.alerts.push(String(m)); };
  window.callAI = async function (messages, el, opts) {
    const h = window.__h;
    h.ai.push({ opts: opts || {}, prompt: (messages || []).map((m) => m.content).join('\n') });
    const reply = typeof h.aiReply === 'function' ? h.aiReply(messages, opts) : h.aiReply;
    requestLog.returnedInfo = JSON.stringify({ usage: { total_tokens: 7 } });
    return reply;
  };
  window.buildChapterContinuityPacket = function (n) { window.__h.packets.push(n); return window.__h.real.buildChapterContinuityPacket(n); };
  window.ensureQualityAfterGenerate = async function () {};
  window.assertObligationCoverageOrThrow = function () {};
});

{ // S6: six-beat outline response
  const r = await page.evaluate(async (nd) => {
    const h = window.__h; h.load(nd); h.reset();
    novelData.chapterBlueprints = [];
    renderBlueprintBeatStatus();
    const emptyStatus = document.getElementById('blueprintBeatStatus').textContent;
    window.enrichChapterBlueprints = async function () { h.enrichCalls.push(1); };
    h.aiReply = { novelOutline: nd.novelOutline, plotOutline: nd.plotOutline, storyArcOutline: nd.storyArcOutline, chapterBlueprints: nd.chapterBlueprints };
    await generateNovelOutlines();
    const el = document.getElementById('blueprintBeatStatus');
    const g1 = scoreGenerateChapterGate(novelData, 1);
    return {
      emptyStatus, calls: h.ai.length, opts: h.ai[0] && h.ai[0].opts, prompt: h.ai[0] ? h.ai[0].prompt : '',
      enrichCalls: h.enrichCalls.length, auto: window.__lastAutoBeatEnrich, status: el.textContent, state: el.dataset.state,
      testid: el.getAttribute('data-testid'), role: el.getAttribute('role'), alerts: h.alerts.slice(),
      bpView: document.getElementById('chapterBlueprints').value.slice(0, 400), gateBeatPassed: g1.beat.passed, gatePassed: g1.passed, stored: novelData.chapterBlueprints.length
    };
  }, enriched(FX));
  check('S6', 'one outline call, max_tokens >= 12000 (operationName generateNovelOutlines)', r.calls === 1 && r.opts.max_tokens >= 12000 && r.opts.operationName === 'generateNovelOutlines', JSON.stringify(r.opts));
  check('S6', 'outline prompt requests the six beats directly', ['sceneGoal', 'castArcBeat', 'subplotPressure', 'dialogueTurn', 'sensoryWorldHook', 'turnOrPayoff'].every((k) => r.prompt.includes(k)), r.prompt.slice(0, 300));
  check('S6', 'outline prompt asks for hyphen ids (subplot-1), not underscores', /subplot-1/.test(r.prompt) && !/subplot_1/.test(r.prompt), '');
  check('S6', 'enrichChapterBlueprints spy not called (beats already pass)', r.enrichCalls === 0, r.enrichCalls);
  check('S6', '__lastAutoBeatEnrich.ran === false, before.passed', r.auto && r.auto.ran === false && r.auto.before.passed === true, JSON.stringify(r.auto));
  check('S6', 'Tab 4 status line shows OK (#blueprintBeatStatus, role=status)', /OK/.test(r.status) && r.state === 'ok' && r.testid === 'nw-bp-beat-status' && r.role === 'status', r.status + ' / ' + r.state);
  check('S5/Fix5', 'status line before outlines says no chapter blueprints yet', /no chapter blueprints yet/.test(r.emptyStatus), r.emptyStatus);
  check('S6', 'Tab 4 blueprint view renders beats (no [object Object])', /Scene goal: Chapter 1 scene goal/.test(r.bpView) && !/\[object Object\]/.test(r.bpView), r.bpView);
  check('S6', 'gate for Generate Chapter 1 passes on beats (and overall)', r.gateBeatPassed === true && r.gatePassed === true && r.stored === 18, JSON.stringify(r));
  check('S6', 'no alert', r.alerts.length === 0, JSON.stringify(r.alerts));
}
{ // S7: old-shape outline response
  const r = await page.evaluate(async (nd) => {
    const h = window.__h; h.load(nd); h.reset();
    novelData.chapterBlueprints = [];
    const el = document.getElementById('blueprintBeatStatus');
    const during = [];
    window.enrichChapterBlueprints = async function () { h.enrichCalls.push(1); during.push(el.textContent + ' [' + el.dataset.state + ']'); };
    h.aiReply = { novelOutline: nd.novelOutline, plotOutline: nd.plotOutline, storyArcOutline: nd.storyArcOutline, chapterBlueprints: nd.chapterBlueprints };
    await generateNovelOutlines();
    const first = { enrichCalls: h.enrichCalls.length, during: during.slice(), auto: window.__lastAutoBeatEnrich, status: el.textContent, state: el.dataset.state };
    h.reset();
    window.enrichChapterBlueprints = async function () { h.enrichCalls.push(1); throw new Error('smoke: enrich provider down'); };
    novelData.novelOutline = ''; novelData.chapterBlueprints = [];
    await generateNovelOutlines();
    const second = {
      enrichCalls: h.enrichCalls.length, auto: window.__lastAutoBeatEnrich, status: el.textContent, state: el.dataset.state, alerts: h.alerts.slice(),
      outlineKept: novelData.novelOutline === nd.novelOutline && novelData.plotOutline === nd.plotOutline && novelData.chapterBlueprints.length === 18
    };
    return { first, second };
  }, FX);
  check('S7', 'old-shape outline: enrich spy called once', r.first.enrichCalls === 1 && r.first.auto.ran === true, JSON.stringify(r.first.auto));
  check('S7', 'status line shows "Running Enrich Chapter Blueprints…" while enrich runs', r.first.during.length === 1 && /Running Enrich Chapter Blueprints/.test(r.first.during[0]) && /\[running\]$/.test(r.first.during[0]), JSON.stringify(r.first.during));
  check('S7', 'still-thin after enrich: status names the button', /Beats still thin/.test(r.first.status) && r.first.status.includes(BUTTON) && r.first.state === 'thin', r.first.status);
  check('S7', 'throwing enrich: outlines and blueprints stay stored', r.second.outlineKept === true && r.second.enrichCalls === 1, JSON.stringify(r.second));
  check('S7', 'throwing enrich: error recorded, status names the button, no alert', r.second.auto.error === 'smoke: enrich provider down' && r.second.status.includes(BUTTON) && r.second.alerts.length === 0, JSON.stringify(r.second));
}
{ // S8 + Engineering's combined case
  const nd = enriched(FX);
  nd.chapterBlueprints[4].sceneGoal = '';
  nd.chapterBlueprints[4].dialogueTurn = 'Too short.';
  const r = await page.evaluate(async (nd) => {
    const h = window.__h; h.load(nd); h.reset();
    h.aiReply = { chapter: 'should never be requested' };
    const gate = (n) => { const g = scoreGenerateChapterGate(novelData, n); return { beatPassed: g.beat.passed, passed: g.passed, chapters: g.beat.perChapter.map((x) => x.chapter), failures: g.failures }; };
    const ready = scoreAdvanceToTab5Readiness(novelData);
    renderBlueprintBeatStatus();
    const status = document.getElementById('blueprintBeatStatus').textContent;
    const gen = async (n) => {
      h.reset();
      let threw = null;
      try { await generateChapter(n); } catch (e) { threw = String(e && e.message || e); }
      return { threw, aiCalls: h.ai.length, alerts: h.alerts.slice(), text: novelData.chapters[n - 1] };
    };
    return {
      g1: gate(1), g2: gate(2), g3: gate(3), g4: gate(4), g5: gate(5), g6: gate(6),
      ready: { passed: ready.passed, failures: ready.failures }, status,
      gen4: await gen(4), gen5: await gen(5),
      generateAll: await (async () => {
        h.reset();
        if (typeof generateAllChapters !== 'function') return { missing: true };
        const res = await generateAllChapters();
        return { res, aiCalls: h.ai.length, alerts: h.alerts.slice(), status: document.getElementById('batchRunStatus').textContent, batchRun: novelData.batchRun ? 'present' : 'absent' };
      })()
    };
  }, nd);
  check('S8', 'thin ch5 only: Generate ch1 / ch2 / ch3 pass on beats (and overall)', r.g1.beatPassed && r.g2.beatPassed && r.g3.beatPassed && r.g1.passed && r.g2.passed && r.g3.passed, JSON.stringify([r.g1, r.g2, r.g3]));
  check('S8', 'Tab 4->5 readiness is false with beat_*:ch5 (all chapters checked)', r.ready.passed === false && r.ready.failures.some((f) => /^beat_.*:ch5(\D|$)/.test(f)) && r.ready.failures.every((f) => !/^beat_/.test(f) || /:ch5(\D|$)/.test(f)), JSON.stringify(r.ready.failures));
  check('S8', 'Tab 4 status line names ch5 and the button', /1\/18 chapters thin/.test(r.status) && /ch5 /.test(r.status) && r.status.includes(BUTTON), r.status);
  check('S8', 'gate for ch4 (ch4+ch5) and ch5 (ch5+ch6) fail on ch5 beats; ch6 passes', !r.g4.beatPassed && !r.g5.beatPassed && r.g6.beatPassed && JSON.stringify(r.g4.chapters) === '[4,5]', JSON.stringify([r.g4, r.g5, r.g6]));
  for (const [n, g] of [[4, r.gen4], [5, r.gen5]]) {
    check('S8', 'Generate Chapter ' + n + ' hard-blocks: throws, 0 provider calls, one alert naming ch5 + the button, no text', g.threw && /STAGE GATE FAIL-CLOSED \[generateChapter /.test(g.threw) && g.aiCalls === 0 && g.alerts.length === 1 && /ch5: sceneGoal missing, dialogueTurn stub/.test(g.alerts[0]) && g.alerts[0].includes(BUTTON) && !g.text, JSON.stringify(g));
  }
  check('S8', 'Generate All (slot 8) refuses to start: preflight, 0 provider calls, 0 alerts, status names ch5 + the button', !r.generateAll.missing && r.generateAll.res && r.generateAll.res.started === false && r.generateAll.res.reason === 'preflight' && r.generateAll.aiCalls === 0 && r.generateAll.alerts.length === 0 && /ch5: sceneGoal missing, dialogueTurn stub/.test(r.generateAll.status) && r.generateAll.status.includes(BUTTON) && r.generateAll.batchRun === 'absent', JSON.stringify(r.generateAll));
}
{ // S12 / S13 / S14: Fix 7 continuity packets
  const r = await page.evaluate(async (nd) => {
    const h = window.__h; h.load(nd); h.reset();
    let version = 'v1';
    novelData.autoContinuityAudit = true;
    window.runChapterContinuityAudit = async function (n) {
      novelData.continuityTracker.chapters[n - 1] = { chapter: n, unresolvedThreads: ['ch' + n + '-thread-' + version], continuityRisks: [] };
    };
    h.aiReply = (messages) => {
      const m = String((messages[1] || {}).content || '').match(/Chapter\s+(\d+)/i);
      return { chapter: 'Generated chapter ' + (m ? m[1] : '?') + ' ' + version + ' part. The relay hums.' };
    };
    const gen = async (n) => {
      h.reset();
      let threw = null;
      try { await generateChapter(n); } catch (e) { threw = String(e && e.message || e); }
      return { threw, packets: h.packets.slice(), alerts: h.alerts.slice(), aiCalls: h.ai.length, text: novelData.chapters[n - 1] };
    };
    const ch3 = await gen(3);
    const p4 = JSON.parse(JSON.stringify(novelData.chapterContinuityPackets[3] || null));
    const ch4 = await gen(4);
    version = 'v2';
    const ch3b = await gen(3);
    const ch5 = await gen(5);
    const p5 = JSON.parse(JSON.stringify(novelData.chapterContinuityPackets[4] || null));
    const last = await gen(18);
    h.reset();
    window.runChapterContinuityAudit = h.real.runChapterContinuityAudit;
    rebuildContinuityPackets();
    return { ch3, p4, ch4, ch3b, ch5, p5, last, rebuild: { packets: h.packets.slice(), alerts: h.alerts.slice(), stored: novelData.chapterContinuityPackets.filter(Boolean).length } };
  }, enriched(FX));
  check('S12', 'Generate ch3 completes with the stubbed provider (2 parts)', !r.ch3.threw && r.ch3.aiCalls === 2 && /Generated chapter 3 v1/.test(r.ch3.text), JSON.stringify(r.ch3));
  check('S12', 'packets built: pre-gen ch3, then only ch4 after generation', JSON.stringify(r.ch3.packets) === '[3,4]', JSON.stringify(r.ch3.packets));
  check('S12', 'no alert from the continuity step', r.ch3.alerts.length === 0, JSON.stringify(r.ch3.alerts));
  check('S12', "ch4 packet's prevChapterSummary is the new ch3 text", r.p4 && /Generated chapter 3 v1/.test(r.p4.prevChapterSummary), JSON.stringify(r.p4 && r.p4.prevChapterSummary));
  check('S12', 'regenerate ch3 (v2) rebuilds ch4 only, 0 alerts', !r.ch3b.threw && JSON.stringify(r.ch3b.packets) === '[3,4]' && r.ch3b.alerts.length === 0, JSON.stringify(r.ch3b));
  check('S12', 'Generate ch5 after regenerating ch3: pre-gen ch5 packet, then ch6 only', !r.ch5.threw && JSON.stringify(r.ch5.packets) === '[5,6]' && r.ch5.alerts.length === 0, JSON.stringify(r.ch5));
  check('S12', 'ch5 packet carries the new ch3 audit threads (v2), not the old ones (v1)', r.p5 && r.p5.unresolvedThreads.includes('ch3-thread-v2') && !r.p5.unresolvedThreads.includes('ch3-thread-v1'), JSON.stringify(r.p5 && r.p5.unresolvedThreads));
  check('S13', 'Generate the last chapter (18): only the pre-gen packet, no post-generation build, no error, 0 alerts', !r.last.threw && JSON.stringify(r.last.packets) === '[18]' && r.last.alerts.length === 0 && /Generated chapter 18/.test(r.last.text), JSON.stringify(r.last));
  check('S14', 'Rebuild Continuity Packets button rebuilds all 18 and alerts once', JSON.stringify(r.rebuild.packets) === JSON.stringify(Array.from({ length: 18 }, (_, i) => i + 1)) && r.rebuild.stored === 18 && r.rebuild.alerts.length === 1 && /Rebuilt continuity packets for 18 chapters/.test(r.rebuild.alerts[0]), JSON.stringify(r.rebuild));
}
await page.close();
check('B', 'no unexpected page errors (Layer B)', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

// ---------------- Layer C: in-page runTrackedE2E with the offline responder ----------------
{
  let responder = createOfflineResponder(B3R);
  const { page: p2, errors: e2 } = await openPage(browser, async (route) => {
    let body = {};
    try { body = JSON.parse(route.request().postData() || '{}'); } catch (_) {}
    const answer = responder.respond(body);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(toXaiResponse(body, answer, route.request().url())) });
  });
  const run = (patchC1Null) => p2.evaluate(async (patchC1Null) => {
    window.confirm = () => true;
    document.getElementById('apiKey').value = 'offline-fixture-not-a-key';
    const sel = document.getElementById('model');
    const chat = Array.from(sel.options || []).find((o) => o.value && !/multi-agent/i.test(o.value));
    if (chat) sel.value = chat.value;
    let direct = null;
    const real = window.runC1Smoke;
    if (!patchC1Null && typeof real === 'function') direct = await real();
    if (patchC1Null) window.runC1Smoke = async () => null;
    let r;
    try { r = await runTrackedE2E(); } catch (e) { return { threw: String(e && e.message || e) }; } finally { window.runC1Smoke = real; }
    const row = (n) => { const s = r.steps.find((x) => x.name === n); return s ? { status: s.status, ok: s.ok, error: s.error || null, result: s.result || null } : null; };
    return { direct, autoEnrich: row('autoEnrichChapterBlueprints'), c1: row('c1Smoke'), outline: row('generateNovelOutlines') };
  }, patchC1Null);
  const six = await run(false);
  responder = createOfflineResponder(oldShape(B3R));
  const old = await run(true);
  await p2.close();
  check('S9', 'six-beat b3r seed: autoEnrichChapterBlueprints row is skip', !six.threw && six.autoEnrich && six.autoEnrich.status === 'skip' && six.autoEnrich.ok === null, JSON.stringify(six.autoEnrich || six.threw));
  check('S9', 'old-shape seed: autoEnrichChapterBlueprints row is fail (enrich ran, beats still thin)', !old.threw && old.autoEnrich && old.autoEnrich.status === 'fail' && /beats still thin after auto-enrich/.test(old.autoEnrich.error || ''), JSON.stringify(old.autoEnrich || old.threw));
  check('S9', 'outline step itself passes in both runs (auto-enrich never throws out of it)', six.outline && six.outline.status === 'pass' && old.outline && old.outline.status === 'pass', JSON.stringify([six.outline, old.outline]));
  check('S10', 'real runC1Smoke() returns true', six.direct === true, JSON.stringify(six.direct));
  check('S10', 'in-page runTrackedE2E c1Smoke row is pass with the real runC1Smoke', six.c1 && six.c1.status === 'pass' && six.c1.ok === true, JSON.stringify(six.c1));
  check('S10', 'runC1Smoke patched to return null: c1Smoke row is fail', old.c1 && old.c1.status === 'fail' && old.c1.ok === false, JSON.stringify(old.c1));
  check('C', 'no unexpected page errors (Layer C)', e2.length === 0, e2.slice(0, 3).join(' | '));
}
await browser.close();

fs.mkdirSync(OUT_DIR, { recursive: true });
const failed = checks.filter((c) => !c.ok);
fs.writeFileSync(path.join(OUT_DIR, 'SMOKE_NW_BEAT_GATE.json'), JSON.stringify({ ok: !failed.length, passed: checks.length - failed.length, total: checks.length, checks }, null, 2));
for (const c of checks) process.stdout.write((c.ok ? 'PASS ' : 'FAIL ') + '[' + c.id + '] ' + c.name + (c.ok ? '' : ' :: ' + c.detail) + '\n');
process.stdout.write('\nNW BEAT GATE SMOKE: ' + (failed.length ? 'FAIL' : 'PASS') + ' (' + (checks.length - failed.length) + '/' + checks.length + ')\n');
process.exit(failed.length ? 1 : 0);