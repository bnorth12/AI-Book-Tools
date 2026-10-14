/**
 * Offline smoke for Q1-Q3 + Q5 trust (REQ-TR-01..09).
 * No network, no API key. Prints each check id PASS/FAIL.
 * Mutations copy the HTML and substitute one real code anchor. Each must turn its named check red.
 *
 *   node scripts/_smoke_nw_trust_q1q3.mjs
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const HTML_PATH = path.resolve(process.env.NW_HTML_PATH || path.join(REPO_ROOT, 'NovelWriter', 'NovelWriter.html'));
const SNAP_PATH = path.join(REPO_ROOT, 'scripts', 'fixtures', 'nw-trust', 'pre-slot-no-blueprint.json');
const BP_SNAP_PATH = path.join(REPO_ROOT, 'scripts', 'fixtures', 'nw-trust', 'blueprint-ch1.json');
const FIXTURE = path.join(REPO_ROOT, 'NovelWriter', 'fixtures', 'beat-gate-old-shape-v1', 'novelData.json');

for (const k of ['XAI_API_KEY', 'GROK_API_KEY', 'NW_E2E_LIVE']) delete process.env[k];

const checks = [];
const check = (id, name, ok, detail) => checks.push({ id, name, ok: !!ok, detail: ok ? '' : String(detail == null ? '' : detail).slice(0, 1800) });
const HTML = fs.readFileSync(HTML_PATH, 'utf8');
const PRE = JSON.parse(fs.readFileSync(SNAP_PATH, 'utf8'));
const FX = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
delete FX._fixture;

const REVISED = [
  'The habitat ring groaned under simulated gravity as Dr. Yeva Sorin pulled herself through the docking umbilical.',
  'Pressure seals hissed behind her. Through the viewport, the red dwarf bled its dull light across the accretion belt.',
  '"They are already arguing about quorum," said Rask, appearing at her shoulder.',
  'Yeva exhaled. The revised seal on the guild ledger read MIDNIGHT-REVISION-TOKEN and nobody spoke the number twice.',
  '"There are no yours anymore," she said. "Only ours. And we are running out of time."'
].join('\n\n');

function enriched(base) {
  const nd = JSON.parse(JSON.stringify(base));
  nd.numChapters = 2;
  nd.chapterBlueprints = (nd.chapterBlueprints || []).slice(0, 2).map((bp, i) => {
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
  nd.chapterOutlines = (nd.chapterOutlines || []).slice(0, 2);
  nd.chapterArcs = (nd.chapterArcs || []).slice(0, 2);
  nd.chapters = ['', ''];
  nd.autoContinuityAudit = true;
  nd.skipAutoRevision = false;
  nd.aiBeatCheck = false;
  nd.kbEnabled = false;
  nd.apiKey = '';
  return nd;
}

function byteBook() {
  return {
    title: 'Byte Novel',
    genre: 'mystery',
    numChapters: 2,
    chapterLength: 4000,
    storyArc: 'Arc text for the byte snapshot.',
    storyArcOutline: '',
    generalPlot: 'Plot text for the byte snapshot.',
    plotOutline: '',
    setting: 'Setting text for the byte snapshot.',
    styleGuide: 'Style text for the byte snapshot.',
    authorStyle: '',
    characters: [{ name: 'Mira', arc: 'From certainty to doubt as the clocks disagree tonight.', backstory: 'Dock engineer with a long memory of failed relays and wet planks.' }],
    subplots: ['The dock clock disagrees with the relay log and someone is hiding the delta from the night crew.'],
    chapterOutlines: [
      'Outline one with enough words to be a real outline for chapter one of the byte snapshot novel and more words here so it is not a stub at all.',
      'Outline two similarly long enough to stand as a chapter outline for the second chapter of the snapshot novel today.'
    ],
    chapterArcs: ['Arc one advances the doubt about the clocks.', ''],
    novelOutline: '',
    chapters: ['', ''],
    chapterBlueprints: [null, null],
    chapterRequirements: [],
    chapterRequiredFacts: [],
    chapterWritingPlans: [],
    continuityStrictMode: false,
    kbEnabled: false,
    continuityTracker: { chapters: [], characterArcProgress: [], storyArcProgress: {} }
  };
}

function fixedBlueprintBook() {
  const nd = byteBook();
  const bp = {
    chapter: 1,
    role: 'opening',
    arcStep: 'Mira names the clock mismatch.',
    sceneGoal: 'Mira must decide which observation to commit before the telemetry window closes.',
    castArcBeat: 'Mira shifts from guarded procedure toward open doubt.',
    subplotPressure: 'The dock clock subplot forces a public choice.',
    dialogueTurn: 'Mira argues with the archivist about the seal.',
    sensoryWorldHook: 'Ozone tang and the hum of the hydroponic bays.',
    turnOrPayoff: 'The delayed consequence of an earlier choice lands.',
    characterBeats: [{ name: 'Mira', beat: 'She speaks the mismatch aloud.' }],
    worldHooks: ['Observation Guild chambers in the Martian arcologies'],
    allowedPayoffs: ['the seal can wait'],
    deferredThreads: ['the missing log']
  };
  nd.chapterBlueprints = [bp, Object.assign({}, JSON.parse(JSON.stringify(bp)), { chapter: 2, role: 'continuation' })];
  nd.chapterRequirements = [{ cast: ['Mira'], setting: ['Observation Guild chambers in the Martian arcologies'], mustNotInclude: ['qubit'], derivedFrom: 'blueprint' }];
  nd.chapterRequiredFacts = [{ items: [{ id: 'f1', text: 'the dock clock disagrees', mustInclude: true }] }];
  nd.chapters[0] = 'Earlier the night crew argued about the delta.\n\nThe last lamp on the wet dock went dark, and Mira kept the count.';
  return nd;
}

function mutateCopy(from, to) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-q-trust-'));
  const copy = path.join(dir, 'NovelWriter.html');
  const src = HTML.replace(/\r\n/g, '\n');
  const fromN = String(from).replace(/\r\n/g, '\n');
  const toN = String(to).replace(/\r\n/g, '\n');
  if (src.indexOf(fromN) < 0) return { ok: false, copy: null, dir, detail: 'anchor not found: ' + fromN.slice(0, 140) };
  if (src.split(fromN).length !== 2) return { ok: false, copy: null, dir, detail: 'anchor not unique: ' + fromN.slice(0, 140) };
  fs.writeFileSync(copy, src.replace(fromN, toN));
  return { ok: true, copy, dir };
}

const HARD_MS = 120000;
const EVAL_MS = 90000;
const argv = process.argv.slice(2);
const onlyIdx = argv.indexOf('--only');
const ONLY = (onlyIdx >= 0 ? argv[onlyIdx + 1] : argv.find((a) => a && !a.startsWith('-'))) || process.env.NW_SMOKE_ONLY || null;
let browser = null;
const hardTimer = setTimeout(() => {
  console.error('HARD TIMEOUT after ' + HARD_MS + ' ms; closing the browser');
  const closing = browser ? browser.close().catch(() => {}) : Promise.resolve();
  closing.finally(() => process.exit(1));
}, HARD_MS);

function raceEval(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label + ' exceeded ' + ms + ' ms')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const pageErrors = [];

async function openPage(htmlPath) {
  const page = await browser.newPage();
  page.setDefaultTimeout(EVAL_MS);
  page.setDefaultNavigationTimeout(20000);
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (!/^https?:/i.test(url)) return route.continue();
    return route.abort('blockedbyclient');
  });
  await page.goto(pathToFileURL(htmlPath || HTML_PATH).href, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(() => typeof buildGenerateChapterUserContent === 'function' && typeof runChapterContinuityAudit === 'function' && typeof nwTextHash === 'function', null, { timeout: 20000 });
  return page;
}

async function runSuite(page, only) {
  return raceEval(page.evaluate(async ({ pre, book, fixed, gateBook, revised, only }) => {
    const out = {};
    const fail = (id, detail) => { out[id] = { ok: false, detail: String(detail == null ? '' : detail).slice(0, 1500) }; };
    const pass = (id) => { out[id] = { ok: true, detail: '' }; };
    const want = (id) => !only || only === id || (Array.isArray(only) && only.indexOf(id) >= 0);
    window.alert = function () {};
    window.confirm = function () { return true; };
    window.prompt = function () { return null; };
    window.__lastSkillPack = null;

    function applyBook(src) {
      Object.keys(src).forEach((k) => { novelData[k] = JSON.parse(JSON.stringify(src[k])); });
      novelData.kbEnabled = false;
      window.__lastSkillPack = null;
      window.__nwPlanConflicts = [];
      window.__nwPlanConflictNotified = false;
    }

    function diffAt(a, b) {
      a = String(a); b = String(b);
      if (a === b) return '';
      const n = Math.min(a.length, b.length);
      for (let i = 0; i < n; i++) {
        if (a[i] !== b[i]) return 'at ' + i + ' got ' + JSON.stringify(a.slice(Math.max(0, i - 50), i + 70)) + ' exp ' + JSON.stringify(b.slice(Math.max(0, i - 50), i + 70)) + ' lens ' + a.length + '/' + b.length;
      }
      return 'lens ' + a.length + '/' + b.length;
    }

    if (want('T3')) {
      try {
        const cases = [];
        applyBook(book);
        cases.push(['nulls', buildGenerateChapterUserContent(1, 1, {}), buildGenerateChapterUserContent(1, 2, { firstHalf: 'FIRST_HALF_MARKER' })]);
        novelData.chapterBlueprints = [];
        cases.push(['empty', buildGenerateChapterUserContent(1, 1, {}), buildGenerateChapterUserContent(1, 2, { firstHalf: 'FIRST_HALF_MARKER' })]);
        delete novelData.chapterBlueprints;
        cases.push(['missing', buildGenerateChapterUserContent(1, 1, {}), buildGenerateChapterUserContent(1, 2, { firstHalf: 'FIRST_HALF_MARKER' })]);
        novelData.chapterBlueprints = [null, null];
        novelData.chapterWritingPlans = [{ items: [{ kind: 'setting', label: 'Lunar hubs', detail: '' }], builtBy: 'user' }];
        cases.push(['plan-only', buildGenerateChapterUserContent(1, 1, {}), buildGenerateChapterUserContent(1, 2, { firstHalf: 'FIRST_HALF_MARKER' })]);
        const bad = [];
        cases.forEach((row) => {
          const d1 = diffAt(row[1], pre.p1);
          const d2 = diffAt(row[2], pre.p2);
          const sys = getSkillSystemPrompt('tab5.generateChapter', 'fallback-unused', 1);
          const ds = diffAt(sys, pre.system);
          if (d1 || d2) bad.push(row[0] + ' p1 ' + d1 + ' p2 ' + d2);
          if (ds) bad.push(row[0] + ' system ' + ds);
          if ((row[1] + row[2]).indexOf('HARD REQUIREMENTS') >= 0) bad.push(row[0] + ' emitted a section');
          if (sys.indexOf('The HARD REQUIREMENTS section is the authority') >= 0) bad.push(row[0] + ' system sentence without a section');
        });
        if (bad.length) fail('T3', bad.join(' || '));
        else pass('T3');
      } catch (e) { fail('T3', e && e.stack || e); }
    }

    if (want('T1') || want('T2') || want('T4')) {
      try {
        applyBook(fixed);
        const p1 = buildGenerateChapterUserContent(1, 1, {});
        const p2 = buildGenerateChapterUserContent(2, 2, { firstHalf: 'FIRST_HALF_MARKER' });
        const header = 'HARD REQUIREMENTS (must be on the page; these override everything below):';
        const orderLine = 'If sources disagree: this list > chapter outline > story bible / digests.';
        function sectionOk(text, part) {
          const lines = text.split('\n');
          if (lines[1] !== header) return 'header not immediately after task: ' + JSON.stringify(lines.slice(0, 4));
          if ((text.match(/HARD REQUIREMENTS/g) || []).length !== 1) return 'section count ' + (text.match(/HARD REQUIREMENTS/g) || []).length;
          if (text.indexOf('WRITING PLAN') >= 0) return 'second plan section';
          if (text.indexOf(orderLine) < 0) return 'missing conflict order';
          if (text.indexOf('- **Chapter plan (reference):**') < 0) return 'digest label not de-jargoned';
          if (text.indexOf('Chapter Blueprint (obligations JSON)') >= 0) return 'old blueprint label remains';
          if (text.indexOf('- **Cover every hard requirement in scene:**') < 0) return 'execute line not renamed';
          if (text.indexOf('- **Execute obligations:**') >= 0) return 'old execute line remains';
          if (text.indexOf('- **Cast / world bound:**') < 0) return 'cast bound missing';
          const built = window.__nwLastHardRequirements;
          const body = (built.lines || []).join('\n');
          if ((built.lines || []).length > 15) return 'over 15 lines';
          if (body.length > 1200) return 'over 1200 chars';
          if (part === 2) {
            if (text.indexOf('Items not yet on the page in the first half come first.') < 0) return 'part2 priority missing';
            if (text.indexOf('Do not restate or replay the first half; continue forward from its last line.') < 0) return 'part2 replay line missing';
          }
          return '';
        }
        const e1 = sectionOk(p1, 1);
        const e2 = sectionOk(p2, 2);
        const sys = getSkillSystemPrompt('tab5.generateChapter', 'fallback', 1);
        const ver = (getAgentSkill('tab5.generateChapter') || {}).version;
        if (e1 || e2) fail('T1', e1 + ' | ' + e2);
        else if (sys.indexOf('The HARD REQUIREMENTS section is the authority for setting, cast, beats and facts.') < 0) fail('T1', 'system sentence missing');
        else if (ver !== 'q1.1') fail('T1', 'skill version ' + ver);
        else {
          out.T1 = { ok: true, detail: '', p1: p1, p2: p2 };
        }
        const ch6 = {
          chapter: 6,
          worldHooks: ['Observation Guild chambers in the Martian arcologies'],
          sceneGoal: 'File the Martian reading before the guild seal closes.',
          characterBeats: [{ name: 'Mira', beat: 'Mira chooses the guild record.' }],
          dialogueTurn: 'Mira argues with the archivist.'
        };
        const ch7 = {
          chapter: 7,
          worldHooks: ['lunar dock'],
          characterBeats: [{ name: 'Bastian Kane', beat: 'Kane arrives with the stolen key.' }],
          dialogueTurn: 'Bastian Kane tells Mira the key is already spent.'
        };
        novelData.numChapters = 7;
        novelData.chapterBlueprints[5] = ch6;
        novelData.chapterBlueprints[6] = ch7;
        const s6 = nwBuildHardRequirements(6);
        const s7 = nwBuildHardRequirements(7);
        const cast6 = (s6.lines || []).join('\n');
        const cast7 = (s7.lines || []).join('\n');
        if (cast6.indexOf('Observation Guild') < 0 || cast6.indexOf('Martian arcologies') < 0) fail('T2', cast6.slice(0, 500));
        else if (cast7.indexOf('Bastian Kane') < 0 || cast7.indexOf('On-page cast') < 0) fail('T2', cast7.slice(0, 500));
        else pass('T2');

        const forbid = (p1.split('\n').find((line) => line.indexOf('- Never use planning words in the prose:') === 0)) || '';
        const terms = NW_NOTE_LEAK_TERMS.slice();
        const missingTerms = terms.filter((t) => forbid.indexOf(t) < 0);
        const elsewhere = p1.replace(forbid, '');
        const camel = ['sceneGoal', 'castArcBeat', 'subplotPressure', 'dialogueTurn', 'sensoryWorldHook', 'turnOrPayoff', 'characterBeats', 'worldHooks', 'allowedPayoffs', 'deferredThreads', 'arcStep'];
        const leaked = camel.filter((k) => new RegExp('\\b' + k + '\\b').test(elsewhere));
        if (!forbid) fail('T4', 'forbid line missing');
        else if (missingTerms.length) fail('T4', 'missing terms ' + missingTerms.join(','));
        else if (forbid.indexOf('qubit') < 0) fail('T4', 'mustNotInclude missing');
        else if (leaked.length) fail('T4', 'camelCase elsewhere ' + leaked.join(','));
        else if (p1.indexOf('Previous chapter ended with') >= 0) fail('T4', 'chapter 1 should not have a previous tail');
        else pass('T4');

        applyBook(fixed);
        novelData.chapters[0] = 'The opening argument filled the guild hall with shouted readings and cold coffee.\n\nThe last lamp on the wet dock went dark, and Mira kept the count.';
        const prev = buildGenerateChapterUserContent(2, 1, {});
        const tailMarker = 'Previous chapter ended with (do not repeat, do not reopen with it): ';
        const tailAt = prev.indexOf(tailMarker);
        const tailBody = tailAt < 0 ? '' : prev.slice(tailAt + tailMarker.length, tailAt + tailMarker.length + 400);
        if (tailAt < 0) fail('T4b', prev.slice(prev.indexOf('HARD REQUIREMENTS'), prev.indexOf('HARD REQUIREMENTS') + 800));
        else if (tailBody.indexOf('The last lamp on the wet dock went dark, and Mira kept the count.') < 0) fail('T4b', tailBody);
        else if (tailBody.indexOf('The opening argument filled the guild hall with shouted readings and cold coffee.') < 0) fail('T4b', 'earlier paragraph under 250 words was dropped: ' + tailBody);
        else if ((prev.match(/HARD REQUIREMENTS/g) || []).length !== 1) fail('T4b', 'section count');
        else pass('T4b');

        applyBook(fixed);
        novelData.chapterBlueprints[0].characterBeats = Array.from({ length: 20 }, (_, i) => ({ name: 'Mira', beat: 'Beat number ' + i + ' runs long before the clause cut. The rest of this sentence should drop when the cap is exceeded and must not survive as a second clause in the requirement list.' }));
        const capped = nwBuildHardRequirements(1);
        const joined = (capped.lines || []).join('\n');
        const kept = (capped.lines || []).some((l) => l.indexOf('Setting:') === 0 || l.indexOf('- Setting:') === 0);
        const factsKept = (capped.lines || []).some((l) => l.indexOf('Facts:') >= 0);
        if ((capped.lines || []).length > 15 || joined.length > 1200 || !kept || !factsKept) fail('T1cap', 'lines=' + (capped.lines || []).length + ' chars=' + joined.length + ' setting=' + kept + ' facts=' + factsKept);
        else pass('T1cap');
      } catch (e) {
        if (!out.T1) fail('T1', e && e.stack || e);
        if (!out.T2) fail('T2', e && e.message || e);
        if (!out.T4) fail('T4', e && e.message || e);
      }
    }

    if (want('T5')) {
      try {
        applyBook(book);
        novelData.chapters = ['The opening stays. UNIQUE-MIDDLE-SENTENCE sits in the center of the chapter where a trim would cut it. The ending stays too.'];
        novelData.continuityTracker = { chapters: [], characterArcProgress: [], storyArcProgress: {} };
        novelData.autoContinuityAudit = true;
        const seen = [];
        window.callAI = async function (messages) {
          const user = messages && messages[1] && messages[1].content;
          seen.push(String(user || ''));
          return { chapterSummary: 'Short audit.', unresolvedThreads: [], storyArcProgress: { currentBeat: 'a', nextBeat: 'b', riskLevel: 'low' }, characterArcProgress: [], continuityRisks: ['none'], recommendedFixes: [] };
        };
        await runChapterContinuityAudit(1, { silent: true });
        const msg = seen[0] || '';
        const fences = (msg.match(/<<<CHAPTER/g) || []).length;
        if (seen.length !== 1) fail('T5', 'calls ' + seen.length);
        else if (msg.indexOf('UNIQUE-MIDDLE-SENTENCE') < 0) fail('T5', 'middle missing');
        else if (msg.indexOf(' ... ') >= 0) fail('T5', 'ellipsis splice');
        else if (msg.indexOf('Chapter text (trimmed)') >= 0) fail('T5', 'trimmed label');
        else if (msg.indexOf('chapterTextDigest') >= 0) fail('T5', 'digest field');
        else if (fences !== 1) fail('T5', 'fences ' + fences);
        else if (msg.indexOf('Report findings as plain observations. Do not quote this prompt\'s field names.') < 0) fail('T5', 'observation line missing');
        else pass('T5');

        const maxEl = document.getElementById('maxTokens');
        if (maxEl) maxEl.value = '100';
        const left = 'A'.repeat(4000) + 'SPLIT-LEFT-EDGE';
        const right = 'SPLIT-RIGHT-EDGE' + 'B'.repeat(4000);
        const whole = left + 'MIDDLE-CUT-MARK' + right;
        novelData.chapters[0] = whole;
        seen.length = 0;
        await runChapterContinuityAudit(1, { silent: true });
        const long = seen[0] || '';
        const bodies = [];
        const re = /<<<CHAPTER\n([\s\S]*?)\nCHAPTER>>>/g;
        let m;
        while ((m = re.exec(long))) bodies.push(m[1]);
        if (seen.length !== 1) fail('T5b', 'calls ' + seen.length);
        else if (bodies.length !== 2) fail('T5b', 'halves ' + bodies.length);
        else if (bodies.join('') !== whole) fail('T5b', 'middle cut or reorder');
        else if (long.indexOf(' ... ') >= 0) fail('T5b', 'splice');
        else pass('T5b');
      } catch (e) { fail('T5', e && e.stack || e); if (!out.T5b) fail('T5b', e && e.message || e); }
    }

    if (want('T6') || want('T6b') || want('T8lock')) {
      try {
        applyBook(book);
        novelData.numChapters = 3;
        novelData.chapterFlags = [];
        const opening = 'The dock clock struck midnight while Mira counted the missing minutes again today under failing lamps.';
        novelData.chapters[0] = opening + ' The night crew hid the delta.';
        novelData.chapters[1] = opening + ' Then the relay answered with a new tone.';
        novelData.chapters[2] = 'A clean chapter about a different harbor and a different argument over bread.';
        const flagged = nwCheckChapterReplay(2, {});
        const clean = nwCheckChapterReplay(3, {});
        const flag = (novelData.chapterFlags || [])[1];
        const badge = document.getElementById('chapterGenFlag2');
        if (!flagged || !flagged.flagged) fail('T6', 'opening copy did not flag ' + JSON.stringify(flagged));
        else if (!flag || !flag.replay) fail('T6', 'no replay key');
        else if (clean && clean.flagged) fail('T6', 'clean chapter flagged');
        else if ((novelData.chapterFlags || [])[2]) fail('T6', 'clean chapter wrote a flag');
        else if (JSON.stringify(flag).indexOf('replayFail') >= 0) fail('T6', 'replayFail key');
        else pass('T6');

        applyBook(book);
        novelData.numChapters = 2;
        novelData.chapterFlags = [];
        novelData.chapterFlags[1] = { coverageFailed: true, missing: ['qubit'], at: '2020-01-01T00:00:00.000Z' };
        novelData.chapters[0] = opening + ' Prior text stays.';
        novelData.chapters[1] = opening + ' Copy of the opening continues here.';
        nwCheckChapterReplay(2, {});
        const merged = novelData.chapterFlags[1];
        if (!merged || merged.coverageFailed !== true) fail('T6b', 'coverage dropped ' + JSON.stringify(merged));
        else if (!Array.isArray(merged.missing) || merged.missing[0] !== 'qubit') fail('T6b', 'missing dropped');
        else if (merged.at !== '2020-01-01T00:00:00.000Z') fail('T6b', 'top-level at changed ' + merged.at);
        else if (!merged.replay || typeof merged.replay.at !== 'string') fail('T6b', 'replay.at missing');
        else if (Object.prototype.hasOwnProperty.call(merged, 'replayFail')) fail('T6b', 'replayFail');
        else pass('T6b');

        if (badge) {
          /* badge may belong to a rebuilt DOM; re-render and read */
        }
        if (typeof nwRenderChapterFlag === 'function') nwRenderChapterFlag(2);
        const shown = (document.getElementById('chapterGenFlag2') || {}).textContent || '';
        if (shown.indexOf('Replay check flagged this chapter.') < 0) fail('T6c', 'badge ' + shown);
        else pass('T6c');

        applyBook(book);
        novelData.chapterFlags = [];
        novelData.chapters[1] = opening + ' copied opening again for the lock case.';
        novelData.chapters[0] = opening + ' previous.';
        nwBatchState.running = true;
        const refused = nwCheckChapterReplay(2, {});
        nwBatchState.running = false;
        const wrote = novelData.chapterFlags && novelData.chapterFlags[1] && novelData.chapterFlags[1].replay;
        if (wrote) fail('T8lock', 'flag written while batch locked');
        else if (!refused || !refused.refused) fail('T8lock', JSON.stringify(refused));
        else pass('T8lock');

        nwBatchState.running = true;
        nwBatchState.lastStatus = 'Generating.';
        novelData.chapterFlags = [];
        const inside = nwCheckChapterReplay(2, { batch: true });
        const status = (nwBatchState.lastStatus || '');
        nwBatchState.running = false;
        if (!inside || !inside.flagged) fail('T6d', 'batch path did not flag');
        else if (status.indexOf('Replay flagged ch2') < 0) fail('T6d', status);
        else pass('T6d');
      } catch (e) {
        ['T6', 'T6b', 'T6c', 'T6d', 'T8lock'].forEach((id) => { if (!out[id]) fail(id, e && e.message || e); });
        nwBatchState.running = false;
      }
    }

    if (want('T7') || want('T6draft')) {
      try {
        Object.keys(gateBook).forEach((k) => { novelData[k] = JSON.parse(JSON.stringify(gateBook[k])); });
        novelData.autoContinuityAudit = false;
        novelData.skipAutoRevision = true;
        novelData.aiBeatCheck = false;
        novelData.kbEnabled = false;
        if (typeof applySessionDataToUI === 'function') applySessionDataToUI();
        const order = [];
        window.scoreProseQuality = function () {
          return { aiSlopRisk: 10, humanLikeness: 80, interest: 80, readability: 80, consistency: 80, flow: 80, pacing: 80 };
        };
        window.scoreSlopTells = function () { return { passed: true, failures: [], tells: {} }; };
        window.getChapterContinuityFindings = function () { return { hasAny: false, findings: [] }; };
        window.scoreObligationCoverage = function () { return { covered: 6, total: 6, ratio: 1, words: 120, passed: true, failures: [], misses: [] }; };
        window.callAI = async function (messages, tab, opts) {
          const user = String((messages && messages[1] && messages[1].content) || '');
          const task = opts && opts.taskType;
          let kind = task || 'other';
          if (task === 'audit' || user.indexOf('Audit continuity') >= 0) kind = 'audit';
          else if (task === 'revise' || user.indexOf('Current Chapter Content') >= 0) kind = 'revise';
          else if (task === 'draft' || user.indexOf('Generate the first half of Chapter') >= 0 || (user.indexOf('Continue Chapter') >= 0 && user.indexOf('second half') >= 0)) kind = 'draft';
          order.push(kind);
          requestLog.returnedInfo = JSON.stringify({ usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 } });
          if (kind === 'revise') return { chapter: revised };
          if (kind === 'audit') return { chapterSummary: 'audited', unresolvedThreads: [], storyArcProgress: { currentBeat: 'c', nextBeat: 'd', riskLevel: 'low' }, characterArcProgress: [], continuityRisks: [], recommendedFixes: [] };
          return { chapter: 'Hi.' };
        };
        let err = '';
        try { await generateChapter(2); } catch (e) { err = String(e && e.message || e); }
        const reviseCalls = order.filter((k) => k === 'revise').length;
        if (reviseCalls !== 0) fail('T6draft', 'revise calls ' + reviseCalls + ' order ' + order.join(',') + ' ' + err);
        else if (order.filter((k) => k === 'draft').length < 2) fail('T6draft', 'drafts ' + order.join(',') + ' ' + err);
        else pass('T6draft');

        if (want('T7')) {
          novelData.skipAutoRevision = false;
          novelData.autoContinuityAudit = true;
          const skipEl = document.getElementById('skipAutoRevision');
          const audEl = document.getElementById('autoContinuityAudit');
          if (skipEl) skipEl.checked = false;
          if (audEl) audEl.checked = true;
          order.length = 0;
          novelData.chapters[1] = '';
          err = '';
          try { await generateChapter(2); } catch (e) { err = String(e && e.message || e); }
          const text = String((novelData.chapters || [])[1] || '');
          const row = (novelData.continuityTracker && novelData.continuityTracker.chapters || [])[1];
          const hash = row && row.auditedTextHash;
          const expect = ['draft', 'draft', 'revise', 'audit'];
          const auditMsgOk = true;
          if (order.join(',') !== expect.join(',')) fail('T7', 'order ' + order.join(',') + ' err ' + err + ' text ' + text.slice(0, 80));
          else if (text.indexOf('MIDNIGHT-REVISION-TOKEN') < 0) fail('T7', 'tracker did not keep revised text');
          else if (hash !== nwTextHash(text)) fail('T7', 'hash ' + hash + ' vs ' + nwTextHash(text));
          else if (!auditMsgOk) fail('T7', 'audit');
          else pass('T7');
        }
      } catch (e) {
        if (!out.T6draft) fail('T6draft', e && e.stack || e);
        if (want('T7') && !out.T7) fail('T7', e && e.stack || e);
      }
    }

    if (want('T8')) {
      try {
        Object.keys(gateBook).forEach((k) => { novelData[k] = JSON.parse(JSON.stringify(gateBook[k])); });
        novelData.chapters = ['C'.repeat(7000), 'D'.repeat(100)];
        novelData.autoContinuityAudit = true;
        novelData.skipAutoRevision = true;
        if (typeof applySessionDataToUI === 'function') applySessionDataToUI();
        const regen = document.getElementById('batchRegenerate');
        if (regen) regen.checked = true;
        const fromEl = document.getElementById('batchFrom');
        const toEl = document.getElementById('batchTo');
        const numEl = document.getElementById('numChapters');
        if (fromEl) fromEl.value = '1';
        if (toEl) toEl.value = '2';
        if (numEl) numEl.value = '2';
        const est = nwBatchEstimate(2);
        const sum = novelData.chapters.reduce((n, c) => n + String(c || '').length, 0);
        if (est.auditInputChars !== sum) fail('T8', 'audit chars ' + est.auditInputChars + ' vs ' + sum);
        else if (!(sum > 6000)) fail('T8', 'fixture text not longer than a 6000 trim');
        let calls = 0;
        let early = null;
        let hungOnce = false;
        window.callAI = async function () {
          calls += 1;
          if (!hungOnce) {
            hungOnce = true;
            window.__hHang = true;
            await new Promise((resolve) => { window.__hRelease = resolve; });
          }
          requestLog.returnedInfo = JSON.stringify({ usage: { total_tokens: 1 } });
          return { chapter: 'Hi there from the hanging draft that is long enough to be stored.' };
        };
        const p = generateAllChapters().then((r) => { early = r; return r; }, (e) => { early = { error: String(e && e.message || e) }; throw e; });
        await new Promise((resolve, reject) => {
          const t0 = Date.now();
          (function wait() {
            if (window.__hHang) return resolve();
            if (Date.now() - t0 > 20000) {
              const br = novelData.batchRun || {};
              return reject(new Error('batch did not hang ' + JSON.stringify({ early: early, reason: br.reason, detail: br.detail })));
            }
            setTimeout(wait, 20);
          })();
        });
        const before = calls;
        await generateChapter(2);
        const genBtn = document.querySelector('#chapterGenContainer button');
        if (out.T8 && out.T8.ok === false) {
          /* estimate already failed */
        } else if (calls !== before) fail('T8', 'per-chapter generate was not locked, calls ' + calls);
        else if (!genBtn || genBtn.disabled !== true) fail('T8', 'generate button not disabled');
        else pass('T8');
        if (window.__hRelease) window.__hRelease();
        nwBatchState.running = false;
        await p.catch(() => {});
      } catch (e) {
        fail('T8', e && e.stack || e);
        nwBatchState.running = false;
        if (window.__hRelease) window.__hRelease();
      }
    }

    if (want('T9') || want('T9b') || want('T9c')) {
      try {
        applyBook(book);
        const saved = 'SAVED chapter before the textarea edit';
        const edited = 'alpha  beta\n\ngamma';
        const emptyChapter = 'chapter two had no saved text';
        novelData.chapters = [saved, ''];
        novelData.numChapters = 2;
        novelData.continuityTracker = { chapters: [], characterArcProgress: [], storyArcProgress: {} };
        if (typeof applySessionDataToUI === 'function') applySessionDataToUI();
        const numIn = document.getElementById('numChapters');
        if (numIn) numIn.value = '2';
        const gen1 = document.getElementById('chapterGenContent1');
        const edit1 = document.getElementById('chapterEditContent1');
        const gen2 = document.getElementById('chapterGenContent2');
        const edit2 = document.getElementById('chapterEditContent2');
        if (gen1) gen1.value = edited;
        if (edit1) edit1.value = edited;
        if (gen2) gen2.value = '';
        if (edit2) edit2.value = '';
        window.callAI = async function () {
          return { chapterSummary: 'kept', unresolvedThreads: [], storyArcProgress: { currentBeat: 'a', nextBeat: 'b', riskLevel: 'low' }, characterArcProgress: [], continuityRisks: [], recommendedFixes: [] };
        };
        await runChapterContinuityAudit(1, { silent: true });
        const row = novelData.continuityTracker.chapters[0];
        const hash = row && row.auditedTextHash;
        const expected = nwTextHash(edited);
        if (!hash || hash !== expected) fail('T9', 'hash ' + hash + ' expected ' + expected);
        else if (novelData.chapters[0] !== edited) fail('T9', 'chapter held ' + JSON.stringify(novelData.chapters[0]));
        else if (typeof nwTrackerAuditState !== 'function') fail('T9', 'nwTrackerAuditState missing');
        else {
          const fresh = nwTrackerAuditState(1);
          novelData.chapters[0] = 'alpha beta gamma';
          const collapsed = nwTrackerAuditState(1);
          novelData.chapters[0] = 'alpha beta gamma EXTRA';
          const stale = nwTrackerAuditState(1);
          if (typeof renderContinuityStatusPanel === 'function') renderContinuityStatusPanel();
          const panel = (document.getElementById('continuityStatusPanel') || {}).value || '';
          novelData.chapters[0] = edited;
          const absentBefore = nwTrackerAuditState(2);
          if (fresh !== 'audited') fail('T9', 'tracker stale right after audit: ' + fresh);
          else if (collapsed !== 'audited') fail('T9', 'whitespace collapse showed ' + collapsed);
          else if (stale !== 'tracker stale') fail('T9', 'edit showed ' + stale);
          else if (absentBefore !== 'not audited') fail('T9', 'absent showed ' + absentBefore);
          else if (panel.indexOf('Chapter 2: not audited') < 0) fail('T9', 'panel ' + panel.slice(panel.indexOf('Tracker audit')));
          else if (panel.indexOf('Chapter 2: tracker stale') >= 0) fail('T9', 'absent rendered stale');
          else {
            novelData.chapters[1] = '';
            if (gen2) gen2.value = emptyChapter;
            if (edit2) edit2.value = emptyChapter;
            await runChapterContinuityAudit(2, { silent: true });
            const row2 = novelData.continuityTracker.chapters[1];
            const hash2 = row2 && row2.auditedTextHash;
            if (novelData.chapters[1] !== emptyChapter) fail('T9', 'empty chapter held ' + JSON.stringify(novelData.chapters[1]));
            else if (hash2 !== nwTextHash(emptyChapter)) fail('T9', 'empty chapter hash ' + hash2 + ' expected ' + nwTextHash(emptyChapter));
            else pass('T9');
          }
        }

        novelData.chapters[0] = edited;
        const exported = stripSecretFields(JSON.parse(JSON.stringify(novelData)));
        const removed = findRemovedSecretFields(novelData);
        const imported = normalizeImportedSessionData({ schemaVersion: '1.0', novelData: JSON.parse(JSON.stringify(exported)) });
        const back = imported.novelData.continuityTracker.chapters[0].auditedTextHash;
        const warns = [];
        const origWarn = console.warn;
        console.warn = function () { warns.push(Array.from(arguments).join(' ')); return origWarn.apply(console, arguments); };
        const dirty = JSON.parse(JSON.stringify(exported));
        dirty.continuityTracker.chapters[0].auditedTextHash = 5;
        const kept = normalizeImportedSessionData({ schemaVersion: '1.0', novelData: dirty });
        console.warn = origWarn;
        const keptHash = kept.novelData.continuityTracker.chapters[0].auditedTextHash;
        if (back !== hash) fail('T9b', 'round trip ' + back + ' vs ' + hash);
        else if (removed.indexOf('auditedTextHash') >= 0) fail('T9b', 'stripped as secret');
        else if (keptHash !== 5) fail('T9b', 'non-string not kept ' + keptHash);
        else if (!warns.some((w) => w.indexOf('not a string') >= 0)) fail('T9b', 'no keep-and-warn');
        else pass('T9b');

        // Regression guard: base never wrote auditedTextHash, so T9c stays green. MUT-invent-hash is the proof.
        const bare = { title: 'Byte Novel', genre: 'mystery', numChapters: 1, chapters: ['alpha'], continuityTracker: { chapters: [{ chapter: 1, chapterSummary: 'kept' }], characterArcProgress: [], storyArcProgress: {} }, chapterBlueprints: [null] };
        const migrated = nwMigrateSession(JSON.parse(JSON.stringify(bare)));
        const migRow = migrated.continuityTracker.chapters[0] || {};
        const normed = normalizeImportedSessionData({ schemaVersion: '1.0', novelData: JSON.parse(JSON.stringify(bare)) });
        const normRow = normed.novelData.continuityTracker.chapters[0] || {};
        applyBook(book);
        novelData.numChapters = 1;
        novelData.continuityTracker = { chapters: [{ chapter: 1, chapterSummary: 'kept' }], characterArcProgress: [], storyArcProgress: {} };
        novelData.chapters = ['alpha'];
        if (typeof applySessionDataToUI === 'function') applySessionDataToUI();
        const resized = (novelData.continuityTracker.chapters[0] || {}).auditedTextHash;
        if (Object.prototype.hasOwnProperty.call(migRow, 'auditedTextHash')) fail('T9c', 'migrate wrote ' + migRow.auditedTextHash);
        else if (Object.prototype.hasOwnProperty.call(normRow, 'auditedTextHash')) fail('T9c', 'normalize wrote ' + normRow.auditedTextHash);
        else if (resized) fail('T9c', 'resize wrote ' + resized);
        else pass('T9c');
      } catch (e) {
        ['T9', 'T9b', 'T9c'].forEach((id) => { if (!out[id]) fail(id, e && e.stack || e); });
      }
    }

    return out;
  }, { pre: PRE, book: byteBook(), fixed: fixedBlueprintBook(), gateBook: enriched(FX), revised: REVISED, only: only || null }), EVAL_MS, 'trust runSuite');
}

try {
browser = await chromium.launch({ headless: true });
console.log('trust: green suite' + (ONLY ? ' only=' + ONLY : ''));
const page = await openPage(HTML_PATH);
let green = {};
try {
  green = await runSuite(page, ONLY);
} catch (e) {
  check('BOOT', 'suite threw', false, e && e.stack || e);
}
await page.close();

const wantId = (id) => !ONLY || ONLY === id;
const bpSnap = green.T1 && green.T1.p1 ? { p1: green.T1.p1, p2: green.T1.p2 } : null;
if (wantId('T1') && bpSnap && green.T1 && green.T1.ok) {
  if (!fs.existsSync(BP_SNAP_PATH)) {
    fs.writeFileSync(BP_SNAP_PATH, JSON.stringify({ p1: bpSnap.p1, p2: bpSnap.p2 }, null, 2));
    check('T1', 'prompt snapshot written from a structurally valid prompt', true);
  } else {
    const prev = JSON.parse(fs.readFileSync(BP_SNAP_PATH, 'utf8'));
    const same = prev.p1 === bpSnap.p1 && prev.p2 === bpSnap.p2;
    check('T1', 'part 1 and part 2 match the checked-in snapshot; one HARD REQUIREMENTS section after the task line', same && green.T1.ok, same ? '' : 'snapshot drifted');
  }
} else if (wantId('T1') && green.T1) {
  check('T1', 'prompt assembly', green.T1.ok, green.T1.detail);
}

const names = {
  T1cap: 'cap keeps setting and facts and stays within 15 lines / 1200 characters',
  T2: 'ch6 names Martian arcologies; ch7 names Bastian Kane',
  T3: 'no-blueprint user and system prompts are byte-identical to the 3259d1e snapshot, including a plan with no blueprint',
  T4: 'forbid line lists every leak term plus mustNotInclude, and blueprint keys are not camelCase elsewhere',
  T4b: 'part 1 carries the previous chapter tail',
  T5: 'audit sends the full chapter in one fenced block with no middle splice',
  T5b: 'over headroom the same call carries both halves',
  T6: 'opening copy flags replay; a clean chapter does not',
  T6b: 'replay merges into the 6b flag and keeps top-level at',
  T6c: 'Tab 5 badge names the replay check',
  T6d: 'Generate All records the replay flag on the batch status line',
  T6draft: 'draft-only makes no revise call',
  T7: 'call order is draft, draft, revise, audit and the hash is of the revised text',
  T8: 'Generate All locks per-chapter actions and the estimate uses full chapter length',
  T8lock: 'replay flag is not written while the batch lock is held',
  T9: 'audit keeps the edited textarea as the chapter and hashes that text; tracker is audited; a real edit is stale; whitespace is not; absent is not audited; an empty chapter keeps its edited text and hash',
  T9b: 'export then import keeps the hash; a non-string is kept with a warning',
  T9c: 'regression guard: migrate, normalize, and resize do not invent auditedTextHash'
};
Object.keys(names).forEach((id) => {
  if (id === 'T1') return;
  if (ONLY && ONLY !== id) return;
  const row = green[id];
  check(id, names[id], row && row.ok, row ? row.detail : 'missing result');
});
if (!ONLY && pageErrors.length) check('PAGE', 'no page errors during the green run', false, pageErrors.join(' | '));

const mutations = [
  ['MUT-drop-section', 'if (!bp) {\n\t\t\t\treturn nwLegacyDraftUserContent(chapterNum, part, opts);\n\t\t\t}', 'if (true) {\n\t\t\t\treturn nwLegacyDraftUserContent(chapterNum, part, opts);\n\t\t\t}', 'T1'],
  ['MUT-after-digests', "var chunk = block.slice();\n\t\t\tif (firstHalf) chunk.push(firstHalf);\n\t\t\tlines.splice(1, 0, chunk.join('\\n'));", "if (firstHalf) lines.splice(1, 0, firstHalf);\n\t\t\tvar reqAt = -1;\n\t\t\tfor (var ri = 0; ri < lines.length; ri++) if (lines[ri] === 'Requirements:') { reqAt = ri; break; }\n\t\t\tif (reqAt < 0) reqAt = lines.length;\n\t\t\tlines.splice(reqAt, 0, block.join('\\n'));", 'T1'],
  ['MUT-trim-audit', '`Context pack: ${JSON.stringify(buildPromptContextPack({ chapterNum, includePacket: false, extra: { continuityPacket: packet } }))}`,\n\t\t\t\t\t\tnwAuditFencedChapter(chapterText),', "`Context pack: ${JSON.stringify(buildPromptContextPack({ chapterNum, includePacket: false, extra: { continuityPacket: packet, chapterTextDigest: getTrimmedContext(chapterText, 4000) } }))}`,\n\t\t\t\t\t\t'Chapter text (trimmed): ' + getTrimmedContext(chapterText, 6000),", 'T5'],
  ['MUT-direct-flag', 'nwSetChapterFlag(n, { replay: replay });', "if (!Array.isArray(novelData.chapterFlags)) novelData.chapterFlags = [];\n\t\t\tnovelData.chapterFlags[n - 1] = { replay: replay };\n\t\t\tif (typeof nwRenderChapterFlag === 'function') nwRenderChapterFlag(n);", 'T6b'],
  ['MUT-toplevel-at', 'nwSetChapterFlag(n, { replay: replay });', 'nwSetChapterFlag(n, { replay: { internal: internal, prev: prevScore, openingCopy: replay.openingCopy }, at: at });', 'T6b'],
  ['MUT-copy-replay', 'var internal = nwScoreReplayInternal(text);\n\t\t\tvar prevScore = nwScoreReplayPrev(text, prevText);', "var internal = { status: 'PASS', internal: { shared: 0, restartAt: null } };\n\t\t\tvar prevScore = { status: 'PASS', shared: 0, openingCopyWords: 0 };", 'T6'],
  ['MUT-audit-before-revise', "\t\t    try {\n\t\t        // SLOT8C: draft-only skip lives in ensureQualityAfterGenerate (novelData.skipAutoRevision)\n\t\t        await ensureQualityAfterGenerate(chapterNum);\n\t\t    } catch (qgErr) {\n\t\t        console.warn('qualityGate/revise after generateChapter', qgErr);\n\t\t        // In a batch this goes to the status line and does not stop the run.\n\t\t        if (opts.batch && typeof nwNotify === 'function') nwNotify('Chapter ' + chapterNum + ' quality gate/revise error (run continues): ' + String((qgErr && qgErr.message) || qgErr), { level: 'warn' });\n\t\t    }\n\t\t    await nwRunChapterAuditNow();", "\t\t    await nwRunChapterAuditNow();\n\t\t    try {\n\t\t        // SLOT8C: draft-only skip lives in ensureQualityAfterGenerate (novelData.skipAutoRevision)\n\t\t        await ensureQualityAfterGenerate(chapterNum);\n\t\t    } catch (qgErr) {\n\t\t        console.warn('qualityGate/revise after generateChapter', qgErr);\n\t\t        // In a batch this goes to the status line and does not stop the run.\n\t\t        if (opts.batch && typeof nwNotify === 'function') nwNotify('Chapter ' + chapterNum + ' quality gate/revise error (run continues): ' + String((qgErr && qgErr.message) || qgErr), { level: 'warn' });\n\t\t    }", 'T7'],
  ['MUT-flag-outside-lock', 'var allowed = !!opts.batch || !locked;\n\t\t\tif (!allowed) return { refused: true };', 'var allowed = true;\n\t\t\tif (!allowed) return { refused: true };', 'T8lock'],
  ['MUT-audit-restore-old', "collectData();\n\t\t\tconst savedChapterText = (novelData.chapters && novelData.chapters[chapterNum - 1] == null) ? '' : String((novelData.chapters || [])[chapterNum - 1] || '');", "const savedChapterText = (novelData.chapters && novelData.chapters[chapterNum - 1] == null) ? '' : String((novelData.chapters || [])[chapterNum - 1] || '');\n\t\t\tcollectData();\n\t\t\tif (Array.isArray(novelData.chapters) && chapterNum >= 1) novelData.chapters[chapterNum - 1] = savedChapterText;", 'T9'],
  ['MUT-drop-hash', 'chapterAudit.auditedTextHash = nwAuditedTextHash(savedChapterText);', '', 'T9'],
  ['MUT-raw-hash', 'function nwAuditedTextHash(text) {\n\t\t\treturn nwTextHash(text);\n\t\t}', "function nwAuditedTextHash(text) {\n\t\t\tvar str = String(text == null ? '' : text);\n\t\t\tvar h = 0x811c9dc5;\n\t\t\tfor (var i = 0; i < str.length; i++) {\n\t\t\t\th ^= str.charCodeAt(i);\n\t\t\t\th = Math.imul(h, 0x01000193);\n\t\t\t}\n\t\t\treturn (h >>> 0).toString(16).padStart(8, '0');\n\t\t}", 'T9'],
  ['MUT-strip-hash', '.filter(([name, nested]) => !isSecretField(name) && !isSensitiveUrl(nested))', ".filter(([name, nested]) => name !== 'auditedTextHash' && !isSecretField(name) && !isSensitiveUrl(nested))", 'T9b'],
  ['MUT-invent-hash', 'if (!keepWrongVersion) nd.nwSchemaVersion = NW_S1_SCHEMA_VERSION;', "if (!keepWrongVersion) nd.nwSchemaVersion = NW_S1_SCHEMA_VERSION;\n\t\t\t\t(function () {\n\t\t\t\t\tvar chapters = nd && nd.continuityTracker && nd.continuityTracker.chapters;\n\t\t\t\t\tif (!Array.isArray(chapters)) return;\n\t\t\t\t\tchapters.forEach(function (row) {\n\t\t\t\t\t\tif (!row || typeof row !== 'object') return;\n\t\t\t\t\t\tif (!Object.prototype.hasOwnProperty.call(row, 'auditedTextHash')) row.auditedTextHash = 'invented-by-migrate';\n\t\t\t\t\t});\n\t\t\t\t})();", 'T9c']
];

for (const [id, from, to, kills] of mutations) {
  if (ONLY) break;
  console.log('trust: mutation ' + id);
  const mut = mutateCopy(from, to);
  if (!mut.ok) {
    check(id, 'mutation turns ' + kills + ' red', false, mut.detail);
    continue;
  }
  const mp = await openPage(mut.copy);
  let result;
  try {
    result = await runSuite(mp, kills);
  } catch (e) {
    result = { [kills]: { ok: true, detail: 'mutated page threw ' + (e && e.message || e) } };
  }
  await mp.close();
  const turnedRed = result && result[kills] && result[kills].ok === false;
  check(id, 'mutation turns ' + kills + ' red', turnedRed, turnedRed ? '' : ('still green or missing: ' + JSON.stringify(result && result[kills])));
}

let failed = 0;
checks.forEach((c) => {
  if (!c.ok) failed += 1;
  console.log((c.ok ? 'PASS' : 'FAIL') + ' [' + c.id + '] ' + c.name + (c.ok ? '' : ' :: ' + c.detail));
});
console.log('TRUST ' + (checks.length - failed) + '/' + checks.length + ' passed');
if (failed) process.exitCode = 1;
} catch (err) {
  console.error(err && err.stack || err);
  process.exitCode = 1;
} finally {
  clearTimeout(hardTimer);
  if (browser) {
    try { await browser.close(); } catch (closeErr) { console.error('browser.close ' + (closeErr && closeErr.message || closeErr)); }
  }
}
