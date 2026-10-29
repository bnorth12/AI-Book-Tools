/**
 * Offline smoke for #167 gates that 4a and 4c need (REQ-TR-02, REQ-WP-01, REQ-WP-05).
 * #167 batch 1 adds TR02c (C2-1 dead dedupe) and W1 (C1-11 worldFrom captured before callAI).
 * No network, no API key. Mutations copy the HTML and substitute one real code anchor. Each must turn its named check red.
 *
 *   node scripts/_smoke_nw_167_gates.mjs
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const HTML_PATH = path.resolve(process.env.NW_HTML_PATH || path.join(REPO_ROOT, 'NovelWriter', 'NovelWriter.html'));
const HTML = fs.readFileSync(HTML_PATH, 'utf8');

for (const k of ['XAI_API_KEY', 'GROK_API_KEY', 'NW_E2E_LIVE']) delete process.env[k];

const checks = [];
const check = (id, name, ok, detail) => checks.push({ id, name, ok: !!ok, detail: ok ? '' : String(detail == null ? '' : detail).slice(0, 1800) });

function mutateCopy(from, to) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-167-gates-'));
  const copy = path.join(dir, 'NovelWriter.html');
  const src = HTML.replace(/\r\n/g, '\n');
  const fromN = String(from).replace(/\r\n/g, '\n');
  const toN = String(to).replace(/\r\n/g, '\n');
  if (src.indexOf(fromN) < 0) return { ok: false, copy: null, dir, detail: 'anchor not found: ' + fromN.slice(0, 140) };
  if (src.split(fromN).length !== 2) return { ok: false, copy: null, dir, detail: 'anchor not unique: ' + fromN.slice(0, 140) };
  fs.writeFileSync(copy, src.replace(fromN, toN));
  return { ok: true, copy, dir };
}

function smallBook() {
  return {
    title: 'Gates Novel',
    genre: 'mystery',
    numChapters: 2,
    chapterLength: 4000,
    storyArc: 'A short arc about a dock and a clock.',
    storyArcOutline: '',
    generalPlot: 'Plot text for the 167 gates smoke, long enough to be a plot and not a stub at all today.',
    plotOutline: 'Plot outline for the 167 gates smoke, long enough to be a plot outline and not a stub at all today.',
    setting: 'A wet dock.',
    styleGuide: 'Plain prose.',
    characters: [{ id: 'mira', name: 'Mira', arc: 'From certainty to doubt as the clocks disagree tonight.', backstory: 'Dock engineer.' }],
    subplots: ['The dock clock disagrees with the relay log.'],
    chapterOutlines: [
      'Mira opens the log. The clock is wrong. She says so aloud.',
      'The second chapter follows the same dock into morning.'
    ],
    chapterArcs: ['Doubt begins.', 'Doubt spreads.'],
    novelOutline: 'Two chapters on a dock.',
    chapters: ['', ''],
    chapterBlueprints: [
      {
        chapter: 1,
        sceneGoal: 'Mira must decide which observation to commit before the telemetry window closes.',
        castArcBeat: 'Mira shifts from guarded procedure toward open doubt.',
        subplotPressure: 'UNIQUE-WP01-SUBPLOT-PRESSURE-167 the dock clock forces a public choice before the window closes.',
        dialogueTurn: 'Mira argues with the archivist about the seal.',
        sensoryWorldHook: 'Ozone tang under failing lights.',
        turnOrPayoff: 'The delayed consequence lands.',
        characterBeats: [{ name: 'Mira', beat: 'She speaks the mismatch aloud.' }],
        worldHooks: ['Observation Guild chambers in the Martian arcologies']
      },
      {
        chapter: 2,
        sceneGoal: 'The morning shift must confirm the night reading.',
        subplotPressure: 'Chapter 2 subplot pressure stays on the dock clock.',
        characterBeats: [{ name: 'Mira', beat: 'Mira repeats the count for a witness.' }],
        worldHooks: ['the wet dock']
      }
    ],
    chapterRequirements: [
      { cast: ['Mira'], setting: ['Observation Guild chambers in the Martian arcologies'], mustNotInclude: ['pad quota'], derivedFrom: 'blueprint' },
      { cast: ['Mira'], setting: ['the wet dock'], mustNotInclude: [], derivedFrom: 'blueprint' }
    ],
    chapterRequiredFacts: [
      { items: [{ id: 'qubit', text: 'the dock clock disagrees', mustInclude: true }, { id: 'a-first', text: 'sorted later', mustInclude: false }] },
      { items: [] }
    ],
    chapterWritingPlans: [null, null],
    continuityStrictMode: false,
    kbEnabled: false,
    continuityTracker: { chapters: [], characterArcProgress: [], storyArcProgress: {} },
    storyWorld: { locations: [{ id: 'guild', name: 'Observation Guild chambers in the Martian arcologies' }] }
  };
}

const HARD_MS = 120000;
const EVAL_MS = 90000;
const argv = process.argv.slice(2);
const onlyIdx = argv.indexOf('--only');
const ONLY = (onlyIdx >= 0 ? argv[onlyIdx + 1] : argv.find((a) => a && !a.startsWith('-'))) || process.env.NW_SMOKE_ONLY || null;
let browser = null;
const pageErrors = [];
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

async function openPage(htmlPath) {
  const page = await browser.newPage();
  page.setDefaultTimeout(EVAL_MS);
  page.setDefaultNavigationTimeout(20000);
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (!/^https?:/i.test(url)) return route.continue();
    return route.abort('blockedbyclient');
  });
  await page.goto(pathToFileURL(htmlPath || HTML_PATH).href, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(() => typeof nwBuildHardRequirements === 'function' && typeof nwBuildWritingPlan === 'function' && typeof novelData !== 'undefined', null, { timeout: 20000 });
  return page;
}

async function runSuite(page, only) {
  return raceEval(page.evaluate(async ({ book, only }) => {
    const out = {};
    const fail = (id, detail) => { out[id] = { ok: false, detail: String(detail == null ? '' : detail).slice(0, 1500) }; };
    const pass = (id) => { out[id] = { ok: true, detail: '' }; };
    const want = (id) => !only || only === id;
    window.alert = function () {};
    window.__confirmYes = true;
    window.confirm = function () { window.__confirms = (window.__confirms || 0) + 1; return !!window.__confirmYes; };

    function applyBook(src) {
      Object.keys(novelData).forEach((k) => { if (k !== 'authors') delete novelData[k]; });
      Object.keys(src).forEach((k) => { novelData[k] = JSON.parse(JSON.stringify(src[k])); });
      novelData.kbEnabled = false;
      if (!Array.isArray(novelData.bookImprovementsWithStatus)) novelData.bookImprovementsWithStatus = [];
      window.__nwPlanConflicts = [];
      window.__nwPlanConflictNotified = false;
      if (typeof applySessionDataToUI === 'function') applySessionDataToUI();
    }

    function parseCast(hard) {
      const line = ((hard && hard.lines) || []).find((l) => String(l).indexOf('On-page cast:') >= 0) || '';
      const marker = 'On-page cast:';
      const at = line.indexOf(marker);
      if (at < 0) return [];
      let body = line.slice(at + marker.length);
      const tail = '; each speaks or acts';
      const tailAt = body.lastIndexOf(tail);
      if (tailAt >= 0) body = body.slice(0, tailAt);
      return body.split(';').map((s) => s.trim()).filter(Boolean);
    }

    function extraPlan() {
      return {
        items: [
          { kind: 'cast', label: 'Mira', detail: 'on page' },
          { kind: 'cast', label: 'Rask ExtraName167', detail: 'plan-only' },
          { kind: 'setting', label: 'Observation Guild chambers in the Martian arcologies', detail: '' }
        ],
        builtBy: 'user',
        builtFrom: 'old'
      };
    }

    if (want('TR02a') || want('TR02b')) {
      try {
        applyBook(book);
        novelData.chapterWritingPlans[0] = extraPlan();
        const bp = getChapterBlueprint(1);
        const required = nwRequiredCastNames(bp).required.slice();
        const hard = nwBuildHardRequirements(1);
        const names = parseCast(hard);
        if (!required.length) fail('TR02a', 'blueprint cast empty');
        else if (JSON.stringify(names) !== JSON.stringify(required)) fail('TR02a', 'cast=' + JSON.stringify(names) + ' blueprint=' + JSON.stringify(required));
        else pass('TR02a');

        const src = Function.prototype.toString.call(nwBuildHardRequirements);
        if (src.indexOf('var blueprintWins = true;') < 0) fail('TR02b', 'blueprintWins anchor missing');
        else {
          const patched = src.replace('var blueprintWins = true;', 'var blueprintWins = false;');
          const buildFalse = eval('(' + patched + ')');
          novelData.chapterWritingPlans[0] = extraPlan();
          window.__nwPlanConflicts = [];
          const hardFalse = buildFalse(1);
          const merged = parseCast(hardFalse);
          const lower = merged.map((n) => String(n).toLowerCase());
          const dups = lower.length !== new Set(lower).size;
          if (merged.indexOf('Rask ExtraName167') < 0) fail('TR02b', 'plan cast did not merge ' + JSON.stringify(merged));
          else if (dups) fail('TR02b', 'duplicates ' + JSON.stringify(merged));
          else pass('TR02b');
        }
      } catch (e) {
        if (want('TR02a') && !out.TR02a) fail('TR02a', e && e.stack || e);
        if (want('TR02b') && !out.TR02b) fail('TR02b', e && e.stack || e);
      }
    }

    if (want('TR02c')) {
      try {
        applyBook(book);
        const src = Function.prototype.toString.call(nwBuildHardRequirements);
        if (src.indexOf('var blueprintWins = true;') < 0) fail('TR02c', 'blueprintWins anchor missing');
        else {
          const buildFalse = eval('(' + src.replace('var blueprintWins = true;', 'var blueprintWins = false;') + ')');
          // Plan cast lacks the blueprint name 'Mira' (test-integrity: a name NOT already on the plan list).
          novelData.chapterWritingPlans[0] = {
            items: [
              { kind: 'cast', label: 'Rask ExtraName167', detail: 'plan-only' },
              { kind: 'setting', label: 'Observation Guild chambers in the Martian arcologies', detail: '' }
            ],
            builtBy: 'user',
            builtFrom: 'old'
          };
          window.__nwPlanConflicts = [];
          const merged = parseCast(buildFalse(1));
          const lower = merged.map((n) => String(n).toLowerCase());
          if (merged.indexOf('Mira') < 0) fail('TR02c', 'blueprint-only name dropped on the false path: ' + JSON.stringify(merged));
          else if (merged.indexOf('Rask ExtraName167') < 0) fail('TR02c', 'plan-only name missing: ' + JSON.stringify(merged));
          else if (lower.length !== new Set(lower).size) fail('TR02c', 'duplicates ' + JSON.stringify(merged));
          else if (merged.length !== 2) fail('TR02c', 'expected exactly Mira + Rask: ' + JSON.stringify(merged));
          else pass('TR02c');
        }
      } catch (e) { fail('TR02c', e && e.stack || e); }
    }

    if (want('W1')) {
      try {
        // (a) AI plan with a worldBeat stores the pre-call world fingerprint and is fresh.
        applyBook(book);
        window.callAI = async function () {
          return { items: [{ kind: 'worldBeat', label: 'W1 world beat from stub', detail: '' }, { kind: 'beat', label: 'W1 beat', detail: '' }] };
        };
        const wantWorld = nwComputeWorldFrom(1);
        const r1 = await nwBuildWritingPlan(1, { useAI: true });
        const p1 = novelData.chapterWritingPlans[0];
        let w1err = '';
        if (!wantWorld) w1err = 'fixture storyWorld gave no world fingerprint';
        else if (!r1 || !r1.ok || !p1) w1err = 'plan not saved ' + JSON.stringify(r1);
        else if (p1.worldFrom !== wantWorld) w1err = '(a) worldFrom=' + p1.worldFrom + ' want=' + wantWorld;
        else if (nwPlanIsStale(1)) w1err = '(a) fresh AI worldBeat plan reads stale';
        if (!w1err) {
          // (b) storyWorld edit while callAI is in flight: worldFrom is the pre-call value and the plan reads stale.
          applyBook(book);
          let release = null;
          window.callAI = function () {
            return new Promise((resolve) => {
              release = () => resolve({ items: [{ kind: 'worldBeat', label: 'W1 world beat late', detail: '' }] });
            });
          };
          const before = nwComputeWorldFrom(1);
          const pending = nwBuildWritingPlan(1, { useAI: true });
          const t0 = Date.now();
          while (typeof release !== 'function' && Date.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 10));
          if (typeof release !== 'function') w1err = '(b) callAI was not deferred';
          else {
            novelData.storyWorld = Object.assign({}, novelData.storyWorld, { immersionWeight: 0.77 });
            const after = nwComputeWorldFrom(1);
            release();
            await pending;
            const p2 = novelData.chapterWritingPlans[0];
            if (after === before) w1err = '(b) in-flight storyWorld edit did not change the world fingerprint';
            else if (!p2 || p2.worldFrom !== before) w1err = '(b) worldFrom=' + (p2 && p2.worldFrom) + ' before=' + before + ' after=' + after;
            else if (!nwPlanIsStale(1)) w1err = '(b) plan not stale after in-flight world edit';
          }
        }
        if (w1err) fail('W1', w1err); else pass('W1');
      } catch (e) { fail('W1', e && e.stack || e); }
    }

    if (want('WP01')) {
      try {
        applyBook(book);
        const PRESSURE = String(book.chapterBlueprints[0].subplotPressure);
        window.callAI = async function () { throw new Error('heuristic path called the API'); };
        const built = await nwBuildWritingPlan(1, { useAI: false });
        const plan = (built && built.plan) || novelData.chapterWritingPlans[0];
        const labels = ((plan && plan.items) || []).map((it) => String(it && it.label || ''));
        const hard = nwBuildHardRequirements(1);
        const blob = labels.join('\n') + '\n' + ((hard && hard.lines) || []).join('\n');
        const bpStill = getChapterBlueprint(1);
        void bpStill;
        if (!built || !built.ok) fail('WP01', JSON.stringify(built));
        else if (!PRESSURE || blob.indexOf(PRESSURE) < 0) fail('WP01', 'subplotPressure value dropped; plan labels=' + labels.join(' | '));
        else pass('WP01');
      } catch (e) { fail('WP01', e && e.stack || e); }
    }

    if (want('WP01b')) {
      try {
        applyBook(book);
        const raw = ['  A pressure.  ', '   ', 'B pressure.'];
        const wanted = ['A pressure.', 'B pressure.'];
        novelData.chapterBlueprints[0].subplotPressure = raw.slice();
        const bp = getChapterBlueprint(1);
        const lines = nwBlueprintBeatTexts(bp);
        const pressureLines = Array.isArray(lines) ? lines.filter((l) => wanted.indexOf(l) >= 0) : [];
        if (!bp || !Array.isArray(bp.subplotPressure)) fail('WP01b', 'subplotPressure was not an array on the blueprint');
        else if (!Array.isArray(lines)) fail('WP01b', 'nwBlueprintBeatTexts did not return an array');
        else if (lines.some((l) => !String(l).trim())) fail('WP01b', 'blank subplotPressure item became a beat line; lines=' + JSON.stringify(lines));
        else if (pressureLines.length !== wanted.length || pressureLines.join('\n') !== wanted.join('\n')) fail('WP01b', 'array subplotPressure did not yield one trimmed beat line per item; wanted=' + JSON.stringify(wanted) + ' lines=' + JSON.stringify(lines));
        else pass('WP01b');
      } catch (e) { fail('WP01b', e && e.stack || e); }
    }

    if (want('WP05')) {
      try {
        applyBook(book);
        let release = null;
        let inFlight = false;
        window.callAI = function () {
          inFlight = true;
          return new Promise((resolve) => {
            release = function () {
              resolve({ items: [{ kind: 'beat', label: 'AI beat from stub', detail: '' }] });
            };
          });
        };
        const beforeFrom = nwComputeBuiltFrom(1);
        const pending = nwBuildWritingPlan(1, { useAI: true });
        const t0 = Date.now();
        while (!inFlight && Date.now() - t0 < 5000) {
          await new Promise((r) => setTimeout(r, 10));
        }
        if (!inFlight || typeof release !== 'function') fail('WP05', 'callAI was not deferred');
        else {
          novelData.chapterBlueprints[0] = Object.assign({}, novelData.chapterBlueprints[0], {
            sceneGoal: 'IN-FLIGHT-EDIT-167 a different scene goal that changes the blueprint hash.'
          });
          const afterFrom = nwComputeBuiltFrom(1);
          if (afterFrom === beforeFrom) fail('WP05', 'in-flight edit did not change fingerprint');
          else {
            release();
            const result = await pending;
            const plan = novelData.chapterWritingPlans[0];
            if (!result || !result.ok || !plan) fail('WP05', 'plan was not saved ' + JSON.stringify(result));
            else if (plan.builtFrom !== beforeFrom) fail('WP05', 'builtFrom=' + plan.builtFrom + ' before=' + beforeFrom + ' after=' + afterFrom);
            else if (!nwPlanIsStale(1)) fail('WP05', 'nwPlanIsStale was false after in-flight edit');
            else pass('WP05');
          }
        }
      } catch (e) { fail('WP05', e && e.stack || e); }
    }

    if (want('REFUSE01')) {
      try {
        applyBook(book);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const marker = 'UNSAVED-EDITOR-TEXT-174';
        const unsaved = marker + ' Mira left this paragraph in the editor and did not save the chapter.';
        novelData.chapters[0] = '';
        const gen = document.getElementById('chapterGenContent1');
        if (!gen) fail('REFUSE01', 'chapterGenContent1 missing');
        else {
          gen.value = unsaved;
          // collectData copies chapterGenContent into novelData.chapters. This gate is the
          // empty-saved fallback at the audit, so the copy must not run.
          const realCollect = window.collectData;
          window.collectData = function () {};
          const alerts = [];
          const prevAlert = window.alert;
          window.alert = function (msg) { alerts.push(String(msg)); };
          const toast = document.getElementById('nwToast');
          if (toast) { toast.textContent = ''; toast.hidden = true; }
          let prompted = '';
          window.callAI = async function (messages) {
            prompted = JSON.stringify(messages || '');
            return {
              chapterSummary: 'stub audit',
              unresolvedThreads: [],
              storyArcProgress: { currentBeat: 'a', nextBeat: 'b', riskLevel: 'low' },
              characterArcProgress: [],
              continuityRisks: [],
              recommendedFixes: []
            };
          };
          let result = null;
          let threw = '';
          try {
            result = await runChapterContinuityAudit(1);
          } catch (err) {
            threw = String(err && err.stack || err);
          } finally {
            window.collectData = realCollect;
            window.alert = prevAlert;
          }
          const toastText = toast ? String(toast.textContent || '') : '';
          const toastVisible = !!(toast && toast.hidden === false);
          const notice = (toastVisible ? toastText : '') + '\n' + alerts.join('\n');
          const usedUnsaved = prompted.indexOf(marker) >= 0;
          if (threw) fail('REFUSE01', threw);
          else if (gen.value !== unsaved) fail('REFUSE01', 'editor content changed before the audit read it');
          else if (String((novelData.chapters || [])[0] || '').indexOf(marker) >= 0) fail('REFUSE01', 'saved chapter text became the unsaved editor text');
          else if (usedUnsaved || (result && typeof result === 'object')) fail('REFUSE01', 'audit used the unsaved editor text');
          else if (notice.indexOf('Save the chapter first') < 0) fail('REFUSE01', 'missing visible message; toast=' + JSON.stringify(toastText) + ' hidden=' + (toast ? toast.hidden : 'none') + ' alerts=' + JSON.stringify(alerts));
          else pass('REFUSE01');
        }
      } catch (e) { fail('REFUSE01', e && e.stack || e); }
    }

    return out;
  }, { book: smallBook(), only: only || null }), EVAL_MS, '167-gates runSuite');
}

try {
browser = await chromium.launch({ headless: true });
console.log('167-gates: green suite' + (ONLY ? ' only=' + ONLY : ''));
const page = await openPage(HTML_PATH);
let green = {};
try { green = await runSuite(page, ONLY); }
catch (e) { check('BOOT', 'suite threw', false, e && e.stack || e); }
await page.close();

const names = {
  TR02a: 'when blueprintWins is set, chapter cast exactly equals the blueprint cast',
  TR02b: 'when blueprintWins is false, the plan cast merges in with no duplicates',
  TR02c: 'when blueprintWins is false, blueprint-only names survive and plan-only names merge, no duplicates',
  W1: 'AI worldBeat plan stores the pre-call worldFrom; fresh unless storyWorld changed during the call',
  WP01: 'subplotPressure value survives the writing-plan round-trip',
  WP01b: 'array subplotPressure yields one trimmed beat line per item from nwBlueprintBeatTexts',
  WP05: 'builtFrom is the pre-call fingerprint and nwPlanIsStale is true after an in-flight edit',
  REFUSE01: 'empty saved chapter text refuses unsaved chapterGenContent and tells the user to save first'
};
Object.keys(names).forEach((id) => {
  if (ONLY && ONLY !== id) return;
  const row = green[id];
  check(id, names[id], row && row.ok, row ? row.detail : 'missing result');
});

const mutations = [
  ['MUT-TR02-reappend',
    "\t\t\t\tif (castOut.length) add('cast', '- On-page cast: ' + castOut.join('; ') + '; each speaks or acts');",
    "\t\t\t\tplanCast.forEach(function (p) {\n\t\t\t\t\tvar pl = p.toLowerCase();\n\t\t\t\t\tvar have = castOut.some(function (c) { return String(c).toLowerCase() === pl || pl.indexOf(String(c).toLowerCase()) >= 0; });\n\t\t\t\t\tif (!have) castOut.push(p);\n\t\t\t\t});\n\t\t\t\tif (castOut.length) add('cast', '- On-page cast: ' + castOut.join('; ') + '; each speaks or acts');",
    'TR02a'],
  ['MUT-TR02c',
    "\t\t\t\tif (castOut.length) add('cast', '- On-page cast: ' + castOut.join('; ') + '; each speaks or acts');",
    "\t\t\t\tif (!blueprintWins) castOut = planCast.slice();\n\t\t\t\tif (castOut.length) add('cast', '- On-page cast: ' + castOut.join('; ') + '; each speaks or acts');",
    'TR02c'],
  ['MUT-W1',
    "return nwStoreWritingPlan(n, items, 'ai', capturedFrom, capturedWorld);",
    "return nwStoreWritingPlan(n, items, 'ai', capturedFrom, nwComputeWorldFrom(n));",
    'W1'],
  ['MUT-WP01-drop',
    "function nwBlueprintBeatTexts(bp) {\n\t\t\tvar lines = [];\n\t\t\tif (!bp || typeof bp !== 'object') return lines;",
    "function nwBlueprintBeatTexts(bp) {\n\t\t\tvar lines = [];\n\t\t\tif (!bp || typeof bp !== 'object') return lines;\n\t\t\tbp = Object.assign({}, bp);\n\t\t\tdelete bp.subplotPressure;",
    'WP01'],
  ['MUT-WP05-late-builtFrom',
    'plan.builtFrom = nwComputeBuiltFrom(n);',
    'plan.builtFrom = nwComputeBuiltFrom(n);\n\t\t\tbuiltFrom = null;',
    'WP05'],
  ['MUT-REFUSE01-fallback',
    "if (!String(savedChapterText).trim()) {\n\t\t\t\tnwToast('Save the chapter first');\n\t\t\t\treturn null;\n\t\t\t}\n\t\t\tconst chapterText = savedChapterText;",
    "const chapterText = String(savedChapterText).trim() ? savedChapterText : (document.getElementById(`chapterGenContent${chapterNum}`)?.value || '');\n\t\t\tif (!chapterText.trim()) {\n\t\t\t\tif (!options.silent) alert(`Chapter ${chapterNum} has no content to audit.`);\n\t\t\t\treturn null;\n\t\t\t}",
    'REFUSE01']
];

for (const [id, from, to, kills] of mutations) {
  if (ONLY) break;
  console.log('167-gates: mutation ' + id);
  const mut = mutateCopy(from, to);
  if (!mut.ok) { check(id, 'mutation turns ' + kills + ' red', false, mut.detail); continue; }
  const mp = await openPage(mut.copy);
  let result;
  try { result = await runSuite(mp, kills); }
  catch (e) { result = { [kills]: { ok: true, detail: String(e && e.message || e) } }; }
  await mp.close();
  const turnedRed = result && result[kills] && result[kills].ok === false;
  check(id, 'mutation turns ' + kills + ' red', turnedRed, turnedRed ? '' : ('still green: ' + JSON.stringify(result && result[kills])));
}

if (pageErrors.length) check('PAGE', 'no uncaught pageerror events', false, pageErrors.join(' | '));

let failed = 0;
checks.forEach((c) => {
  if (!c.ok) failed += 1;
  console.log((c.ok ? 'PASS' : 'FAIL') + ' [' + c.id + '] ' + c.name + (c.ok ? '' : ' :: ' + c.detail));
});
console.log('GATES ' + (checks.length - failed) + '/' + checks.length + ' passed');
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
