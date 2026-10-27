/**
 * Offline smoke for slot 4p writing plans (REQ-WP-01..07 + WP:P12).
 * #167 batch 1 adds OUTL (C1-6), EST (C1-7), KAW (B3/C1-10) and PAGEERR (C1-8, meta-check).
 * NW_SMOKE_INJECT_PAGEERR=1 throws one uncaught error per page (used by the PAGEERR meta-check only).
 * No network, no API key. Mutations copy the HTML and substitute one real code anchor. Each must turn its named check red.
 *
 *   node scripts/_smoke_nw_writing_plans.mjs
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { spawnSync } from 'child_process';
import { chromium } from 'playwright';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const HTML_PATH = path.resolve(process.env.NW_HTML_PATH || path.join(REPO_ROOT, 'NovelWriter', 'NovelWriter.html'));
const FIXTURE = path.join(REPO_ROOT, 'NovelWriter', 'fixtures', 'beat-gate-old-shape-v1', 'novelData.json');
const HTML = fs.readFileSync(HTML_PATH, 'utf8');

for (const k of ['XAI_API_KEY', 'GROK_API_KEY', 'NW_E2E_LIVE']) delete process.env[k];

const checks = [];
const check = (id, name, ok, detail) => checks.push({ id, name, ok: !!ok, detail: ok ? '' : String(detail == null ? '' : detail).slice(0, 1800) });

function storeSlice(html) {
  const a = html.indexOf('function nwStoreWritingPlan');
  const b = html.indexOf('function nwBuildWritingPlanAI');
  return a >= 0 && b > a ? html.slice(a, b) : '';
}
function staleSlice(html) {
  const a = html.indexOf('function nwWritingPlanIsStale');
  const b = html.indexOf('function nwRefreshPlanBuiltFrom');
  return a >= 0 && b > a ? html.slice(a, b) : '';
}
const store = storeSlice(HTML);
const stale = staleSlice(HTML);
const planFn = HTML.slice(HTML.indexOf('function nwSetPlanText'), HTML.indexOf('function nwAppendPlanRow'));

const FX = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
delete FX._fixture;

function enriched(base) {
  const nd = JSON.parse(JSON.stringify(base));
  nd.numChapters = 2;
  nd.chapterBlueprints = (nd.chapterBlueprints || []).slice(0, 2).map((bp, i) => {
    const n = i + 1;
    const who = (nd.characters[i % nd.characters.length] || {}).name || 'Lead';
    return Object.assign({}, bp, {
      sceneGoal: `Chapter ${n} scene goal: ${who} must decide which observation to commit before the telemetry window closes.`,
      castArcBeat: `${who} shifts from guarded procedure toward open doubt in chapter ${n}, paying a visible personal cost.`,
      subplotPressure: `Chapter ${n} subplot pressure forces a visible choice in the control room before the window closes.`,
      dialogueTurn: `Chapter ${n} dialogue turn: an argument over the readings flips who holds authority in the control room.`,
      sensoryWorldHook: `Chapter ${n} sensory hook: ozone tang and the hum of the hydroponic bays under failing lights.`,
      turnOrPayoff: `Chapter ${n} turn: the delayed consequence of an earlier choice lands and narrows the next options.`
    });
  });
  nd.chapterOutlines = (nd.chapterOutlines || []).slice(0, 2);
  nd.chapterArcs = (nd.chapterArcs || []).slice(0, 2);
  nd.chapters = ['', ''];
  nd.kbEnabled = false;
  nd.apiKey = '';
  nd.autoContinuityAudit = false;
  nd.skipAutoRevision = true;
  nd.aiBeatCheck = false;
  return nd;
}

function smallBook() {
  return {
    title: 'Plan Novel',
    genre: 'mystery',
    numChapters: 2,
    chapterLength: 4000,
    storyArc: 'A short arc about a dock and a clock.',
    storyArcOutline: '',
    generalPlot: 'Plot text for the plan smoke, long enough to be a plot and not a stub at all today.',
    plotOutline: 'Plot outline for the plan smoke, long enough to be a plot outline and not a stub at all today.',
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
        dialogueTurn: 'Mira argues with the archivist about the seal.',
        sensoryWorldHook: 'Ozone tang under failing lights.',
        turnOrPayoff: 'The delayed consequence lands.',
        characterBeats: [{ name: 'Mira', beat: 'She speaks the mismatch aloud.' }],
        worldHooks: ['Observation Guild chambers in the Martian arcologies']
      },
      {
        chapter: 2,
        sceneGoal: 'The morning shift must confirm the night reading.',
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

function mutateCopy(from, to) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-q-plans-'));
  const copy = path.join(dir, 'NovelWriter.html');
  const src = HTML.replace(/\r\n/g, '\n');
  const fromN = String(from).replace(/\r\n/g, '\n');
  const toN = String(to).replace(/\r\n/g, '\n');
  if (src.indexOf(fromN) < 0 || src.split(fromN).length !== 2) return { ok: false, copy: null, detail: 'anchor not unique: ' + fromN.slice(0, 140) };
  fs.writeFileSync(copy, src.replace(fromN, toN));
  return { ok: true, copy, dir };
}

const SELF_PATH = fileURLToPath(import.meta.url);
const INJECT_PAGEERR = process.env.NW_SMOKE_INJECT_PAGEERR === '1';
const pageErrors = [];
const HARD_MS = 120000;
const EVAL_MS = 90000;
const argv = process.argv.slice(2);
const onlyIdx = argv.indexOf('--only');
const ONLY = (onlyIdx >= 0 ? argv[onlyIdx + 1] : argv.find((a) => a && !a.startsWith('-'))) || process.env.NW_SMOKE_ONLY || null;
if (!ONLY || ONLY === 'P10src') {
  check('P10src', 'plan saves call nwComputeBuiltFrom and do not recompute either hash',
    store.indexOf('nwComputeBuiltFrom(') >= 0 && store.indexOf('0x811c9dc5') < 0 && store.indexOf('nwComputeWorldFrom(') < 0 && /nwPlanIsStale\(/.test(stale),
    'store or stale helper drifted');
}
if (!ONLY || ONLY === 'P7src') {
  check('P7src', 'plan text uses textContent only',
    /el\.textContent =/.test(planFn) && !/innerHTML/.test(planFn),
    'renderer shape changed');
}
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

async function openPage(htmlPath) {
  const page = await browser.newPage();
  page.setDefaultTimeout(EVAL_MS);
  page.setDefaultNavigationTimeout(20000);
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (!/^https?:/i.test(url)) return route.continue();
    return route.abort('blockedbyclient');
  });
  await page.goto(pathToFileURL(htmlPath || HTML_PATH).href, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(() => typeof nwBatchApplyLock === 'function' && typeof novelData !== 'undefined', null, { timeout: 20000 });
  if (INJECT_PAGEERR) {
    await page.evaluate(() => { setTimeout(() => { throw new Error('pe167'); }, 0); });
    await page.waitForTimeout(200);
  }
  return page;
}

async function runSuite(page, only) {
  return raceEval(page.evaluate(async ({ book, gateBook, only, estCallerPassesList }) => {
    const out = {};
    const fail = (id, detail) => { out[id] = { ok: false, detail: String(detail == null ? '' : detail).slice(0, 1500) }; };
    const pass = (id) => { out[id] = { ok: true, detail: '' }; };
    const want = (id) => !only || only === id;
    window.alert = function () {};
    window.__confirmYes = true;
    window.confirm = function () { window.__confirms = (window.__confirms || 0) + 1; return !!window.__confirmYes; };
    window.__lastSkillPack = null;
    const realCallAI = window.callAI;

    function applyBook(src) {
      Object.keys(novelData).forEach((k) => { if (k !== 'authors') delete novelData[k]; });
      Object.keys(src).forEach((k) => { novelData[k] = JSON.parse(JSON.stringify(src[k])); });
      novelData.kbEnabled = false;
      if (!Array.isArray(novelData.bookImprovementsWithStatus)) novelData.bookImprovementsWithStatus = [];
      window.__nwPlanConflicts = [];
      window.__nwPlanConflictNotified = false;
      window.__nwPlanPhaseLog = [];
      window.__confirms = 0;
      if (typeof applySessionDataToUI === 'function') applySessionDataToUI();
    }

    if (want('P1') || want('P3') || want('P10') || want('P10a') || want('P10b') || want('P10c') || want('P10d') || want('P10e') || want('P11') || want('P4') || want('P7')) {
      try {
        applyBook(book);
        let calls = 0;
        window.callAI = async function () { calls += 1; throw new Error('heuristic path called the API'); };
        const built = await nwBuildWritingPlan(1, { useAI: false });
        const items = (built.plan && built.plan.items) || [];
        const kinds = items.map((it) => it.kind);
        const cast = items.find((it) => it.kind === 'cast');
        const fact = items.find((it) => it.kind === 'fact');
        const setting = items.find((it) => it.kind === 'setting');
        if (!built.ok) fail('P1', JSON.stringify(built));
        else if (calls !== 0) fail('P1', 'api calls ' + calls);
        else if (kinds.indexOf('beat') < 0 || kinds.indexOf('cast') < 0 || kinds.indexOf('setting') < 0 || kinds.indexOf('fact') < 0) fail('P1', kinds.join(','));
        else if (!cast || cast.charId !== 'mira') fail('P1', 'charId ' + JSON.stringify(cast));
        else if (!fact || fact.factId !== 'qubit') fail('P1', 'factId ' + JSON.stringify(fact));
        else if (!setting || setting.locationId !== 'guild') fail('P1', 'locationId ' + JSON.stringify(setting));
        else if (built.plan.builtBy !== 'heuristic') fail('P1', built.plan.builtBy);
        else if (built.plan.builtFrom !== nwComputeBuiltFrom(1)) fail('P1', 'builtFrom mismatch');
        else if (built.plan.worldFrom) fail('P1', 'wrote worldFrom');
        else pass('P1');

        const beforeFrom = built.plan.builtFrom;
        if (typeof collectData === 'function') collectData();
        const afterCollect = novelData.chapterWritingPlans[0];
        if (!afterCollect || afterCollect.builtBy !== 'heuristic' || afterCollect.builtFrom !== beforeFrom) fail('P3', 'collectData flipped the plan ' + (afterCollect && afterCollect.builtBy));
        else {
          const label = document.querySelector('#writingPlanPanel1 .wp-label');
          label.value = 'Mira on the page';
          label.dispatchEvent(new Event('input', { bubbles: true }));
          const edited = novelData.chapterWritingPlans[0];
          const row2 = document.querySelectorAll('#writingPlanPanel1 .nw-plan-row')[1];
          const up = row2 && Array.from(row2.querySelectorAll('button')).find((b) => b.textContent === 'Up');
          if (up) up.click();
          const del = document.querySelector('#writingPlanPanel1 .nw-plan-row button');
          const add = Array.from(document.querySelectorAll('#writingPlanPanel1 button')).find((b) => b.textContent === 'Add');
          if (add) add.click();
          const again = novelData.chapterWritingPlans[0];
          const labels = (again.items || []).map((it) => it.label);
          if (edited.builtBy !== 'user' || !edited.editedAt) fail('P3', 'edit did not mark user');
          else if (edited.builtFrom !== beforeFrom) fail('P3', 'user edit refreshed builtFrom');
          else if (labels.indexOf('Mira on the page') < 0) fail('P3', 'label not stored');
          else if (!again.items.some((it) => it.kind === 'keyPoint' && it.label === '')) fail('P3', 'add did not append');
          else if (cast.charId && !(again.items.some((it) => it.charId === 'mira'))) fail('P3', 'charId dropped');
          else pass('P3');
          void del;
        }

        applyBook(book);
        await nwBuildWritingPlan(1, { useAI: false });
        const fresh = novelData.chapterWritingPlans[0].builtFrom;
        novelData.chapterBlueprints[0] = Object.assign({}, novelData.chapterBlueprints[0], { sceneGoal: 'A different scene goal that changes the blueprint hash.' });
        const panel = nwRenderWritingPlanPanel(1);
        const old = document.getElementById('writingPlanPanel1');
        if (old && old.parentNode) old.parentNode.replaceChild(panel, old);
        const staleText = (panel.querySelector('.wp-stale') || {}).textContent || '';
        if (!nwWritingPlanIsStale(1) || staleText !== 'plan stale: blueprint changed') fail('P10a', 'blueprint stale ' + staleText + ' ' + nwWritingPlanIsStale(1));
        else {
          await nwBuildWritingPlan(1, { useAI: false });
          if (nwWritingPlanIsStale(1) || novelData.chapterWritingPlans[0].builtFrom === fresh) fail('P10a', 'rebuild did not clear blueprint stale');
          else pass('P10a');
        }
        const mid = novelData.chapterWritingPlans[0].builtFrom;
        novelData.chapterRequiredFacts[0].items[0].text = 'the photon disagrees';
        if (!nwPlanIsStale(1) || !nwWritingPlanIsStale(1)) fail('P10b', 'fact edit was not stale');
        else {
          await nwBuildWritingPlan(1, { useAI: false });
          novelData.chapterRequirements[0].mustNotInclude = ['pad quota', 'checklist word'];
          if (!nwWritingPlanIsStale(1)) fail('P10b', 'mustNotInclude edit was not stale');
          else if (novelData.chapterWritingPlans[0].builtFrom === mid && nwPlanIsStale(1) === false) fail('P10b', 'hash did not move');
          else pass('P10b');
        }
        const keptFrom = novelData.chapterWritingPlans[0].builtFrom;
        const lab = document.querySelector('#writingPlanPanel1 .wp-label');
        if (lab) {
          lab.value = 'user kept this line';
          lab.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (novelData.chapterWritingPlans[0].builtFrom !== keptFrom) fail('P10c', 'user edit changed builtFrom');
        else if (novelData.chapterWritingPlans[0].builtBy !== 'user') fail('P10c', 'builtBy ' + novelData.chapterWritingPlans[0].builtBy);
        else pass('P10c');
        window.__confirmYes = false;
        const refused = await nwBuildWritingPlan(1, { useAI: false });
        window.__confirmYes = true;
        const accepted = await nwBuildWritingPlan(1, { useAI: false });
        if (!refused || refused.reason !== 'cancelled') fail('P10d', 'confirm did not refuse ' + JSON.stringify(refused));
        else if (!accepted.ok || nwWritingPlanIsStale(1)) fail('P10d', 'confirmed rebuild failed');
        else pass('P10d');

        const mig = JSON.parse(JSON.stringify(novelData));
        mig.chapterWritingPlans[0] = { items: [{ kind: 'beat', label: 'old', detail: '' }], builtBy: 'heuristic' };
        delete mig.chapterWritingPlans[0].builtFrom;
        const afterMig = nwMigrateSession(JSON.parse(JSON.stringify(mig)));
        const migPlan = afterMig.chapterWritingPlans[0];
        if (migPlan.builtFrom) fail('P10e', 'migration wrote builtFrom');
        else if (!nwPlanIsStale(1, afterMig)) fail('P10e', 'plan without builtFrom was not stale');
        else pass('P10e');

        applyBook(book);
        novelData.chapterWritingPlans[0] = {
          items: [{ kind: 'setting', label: 'Lunar hubs', detail: '' }, { kind: 'cast', label: 'Someone Else', detail: '' }],
          builtBy: 'user',
          builtFrom: 'old'
        };
        window.__nwPlanConflicts = [];
        window.__nwPlanConflictNotified = false;
        const hard = nwBuildHardRequirements(1);
        const lines = (hard.lines || []).join('\n');
        const warns = (window.__nwPlanConflicts || []).filter((c) => c && c.chapter === 1);
        if (hard.source !== 'writingPlan') fail('P11', 'source ' + hard.source);
        else if (lines.indexOf('Martian arcologies') < 0 || lines.indexOf('Lunar hubs') >= 0) fail('P11', lines);
        else if (warns.length !== 1) fail('P11', 'warnings ' + warns.length);
        else pass('P11');

        applyBook(book);
        const noPlan = nwBuildHardRequirements(1);
        const prompt = buildGenerateChapterUserContent(1, 1, {});
        if (noPlan.source !== 'blueprint') fail('P4', 'no-plan source ' + noPlan.source);
        else if ((prompt.match(/HARD REQUIREMENTS/g) || []).length !== 1) fail('P4', 'section count');
        else if (prompt.indexOf('WRITING PLAN') >= 0) fail('P4', 'extra section');
        else {
          await nwBuildWritingPlan(1, { useAI: false });
          const withPlan = nwBuildHardRequirements(1);
          const prompt2 = buildGenerateChapterUserContent(1, 1, {});
          const itemLabels = (novelData.chapterWritingPlans[0].items || []).map((it) => it.label).filter(Boolean);
          const missing = itemLabels.filter((label) => prompt2.indexOf(label) < 0);
          if (withPlan.source !== 'writingPlan') fail('P4', 'plan source ' + withPlan.source);
          else if ((prompt2.match(/HARD REQUIREMENTS/g) || []).length !== 1 || prompt2.indexOf('WRITING PLAN') >= 0) fail('P4', 'section shape');
          else if (missing.length > 3) fail('P4', 'items missing ' + missing.slice(0, 4).join(' | '));
          else pass('P4');
        }

        applyBook(book);
        novelData.chapterWritingPlans[0] = { items: [{ kind: 'beat', label: '<b class="wp-xss">plan</b>', detail: '' }], builtBy: 'user', builtFrom: nwComputeBuiltFrom(1) };
        const rendered = nwRenderWritingPlanPanel(1);
        document.body.appendChild(rendered);
        const shown = rendered.querySelector('.wp-shown');
        if (rendered.querySelector('.wp-xss') || rendered.querySelector('b')) fail('P7', 'plan text became HTML');
        else if (!shown || shown.textContent.indexOf('<b class="wp-xss">') < 0) fail('P7', 'textContent ' + (shown && shown.textContent));
        else pass('P7');
      } catch (e) {
        ['P1', 'P3', 'P4', 'P7', 'P10', 'P10a', 'P10b', 'P10c', 'P10d', 'P10e', 'P11'].forEach((id) => { if (!out[id]) fail(id, e && e.stack || e); });
      }
    }

    if (want('P2') || want('P8est')) {
      try {
        applyBook(book);
        const calls = [];
        window.callAI = async function (messages, tab, opts) {
          calls.push({
            op: opts && opts.operationName,
            chapter: opts && opts.chapter,
            chapters: opts && opts.chapters,
            max: opts && opts.max_tokens,
            skill: opts && opts.skillId,
            task: opts && opts.taskType,
            user: String(messages && messages[1] && messages[1].content || '')
          });
          if (typeof recordBookTokenUsage === 'function') {
            recordBookTokenUsage({ operationName: opts.operationName, originTab: 'tab5', model: 'smoke-stub', prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 });
          }
          if (opts && opts.chapter === 2) return { nope: true };
          return { items: [{ kind: 'beat', label: 'AI beat ' + opts.chapter, detail: 'from the model' }] };
        };
        document.getElementById('batchBuildPlansFirst').checked = true;
        document.getElementById('batchBuildPlansUseAI').checked = true;
        const est = nwBatchEstimate(2);
        const a = await nwBuildWritingPlan(1, { useAI: true });
        const b = await nwBuildWritingPlan(2, { useAI: true });
        const ledger = ensureBookTokenUsage().calls.map((c) => c.operationName);
        const notices = [];
        const real = window.nwNotify;
        window.nwNotify = function (m) { notices.push(String(m)); if (typeof real === 'function') return real.apply(this, arguments); };
        if (calls.length !== 2) fail('P2', 'calls ' + calls.length);
        else if (calls[0].op !== 'buildWritingPlan_1' || calls[1].op !== 'buildWritingPlan_2') fail('P2', calls.map((c) => c.op).join(','));
        else if (calls.some((c) => !c.chapters || c.chapters.length !== 1)) fail('P2', JSON.stringify(calls.map((c) => c.chapters)));
        else if (calls.some((c) => c.max !== 1500 || c.skill !== 'tab5.buildWritingPlan' || c.task !== 'other')) fail('P2', JSON.stringify(calls[0]));
        else if (a.plan.builtBy !== 'ai') fail('P2', 'builtBy ' + a.plan.builtBy);
        else if (ledger.indexOf('buildWritingPlan_1') < 0) fail('P2', 'ledger ' + ledger.join(','));
        else if (est.planBuildCalls !== 2 || est.total < 3000) fail('P2', JSON.stringify(est));
        else pass('P2');
        if (!b.ok || b.plan.builtBy !== 'heuristic') fail('P2b', JSON.stringify(b && b.plan && b.plan.builtBy));
        else pass('P2b');
        const off = document.getElementById('batchBuildPlansUseAI');
        off.checked = false;
        const estOff = nwBatchEstimate(2);
        if (estOff.planBuildCalls !== 0) fail('P2c', JSON.stringify(estOff));
        else pass('P2c');
      } catch (e) { if (!out.P2) fail('P2', e && e.stack || e); }
    }

    if (want('P5') || want('P6') || want('P8') || want('P9') || want('P12')) {
      try {
        Object.keys(gateBook).forEach((k) => { novelData[k] = JSON.parse(JSON.stringify(gateBook[k])); });
        novelData.chapterRequirements = [{ cast: ['Mira'], setting: ['dock'], mustNotInclude: [], derivedFrom: 'blueprint' }];
        novelData.chapterRequiredFacts = [{ items: [{ id: 'f', text: 'the relay hums', mustInclude: true }] }];
        novelData.skipAutoRevision = true;
        novelData.autoContinuityAudit = false;
        novelData.aiBeatCheck = false;
        novelData.kbEnabled = false;
        if (typeof applySessionDataToUI === 'function') applySessionDataToUI();
        await nwBuildWritingPlan(1, { useAI: false });
        const planLabel = (novelData.chapterWritingPlans[0].items || []).map((it) => it.label).find(Boolean) || '';
        const seen = [];
        window.scoreProseQuality = function () { return { aiSlopRisk: 1, humanLikeness: 90, interest: 90, readability: 90, consistency: 90, flow: 90, pacing: 90 }; };
        window.scoreSlopTells = function () { return { passed: true, failures: [], tells: {} }; };
        window.getChapterContinuityFindings = function () { return { hasAny: false }; };
        window.scoreObligationCoverage = function () { return { covered: 4, total: 4, ratio: 1, words: 80, passed: true, failures: [], misses: [] }; };
        window.callAI = async function (messages, tab, opts) {
          const user = String((messages && messages[1] && messages[1].content) || '');
          seen.push({ task: opts && opts.taskType, user: user });
          requestLog.returnedInfo = JSON.stringify({ usage: { total_tokens: 5 } });
          return { chapter: 'The dock stayed quiet.\n\nMira counted the lamps and said nothing else at all tonight.' };
        };
        let genErr = '';
        try { await generateChapter(1); } catch (e) { genErr = String(e && e.message || e); }
        const draft = seen.find((c) => c.task === 'draft');
        const revise = seen.filter((c) => c.task === 'revise');
        if (!draft || draft.user.indexOf('HARD REQUIREMENTS') < 0) fail('P5', 'no requirements in draft ' + genErr);
        else if (planLabel && draft.user.indexOf(planLabel) < 0) fail('P5', 'plan label missing ' + planLabel);
        else if (revise.length) fail('P5', 'revise calls ' + revise.length);
        else if ((draft.user.match(/HARD REQUIREMENTS/g) || []).length !== 1) fail('P5', 'section count');
        else pass('P5');

        const prose = 'Mira stood on the dock and counted the lamps while the relay hummed under the ozone tang.';
        novelData.chapters[0] = prose;
        const rec = await nwScoreChapterVsBlueprint(prose, 1, null, { skipAi: true });
        const worst = nwQcatWorst([rec.length.status, rec.beats.status, rec.cast.status, rec.setting.status, rec.replay.status, rec.repetition.status, rec.voice.status, rec.noteLeak.status, rec.facts.status]);
        if (!rec.planCoverage || rec.planCoverage.source !== 'writingPlan') fail('P6', JSON.stringify(rec.planCoverage));
        else if (rec.overall !== worst) fail('P6', 'overall ' + rec.overall + ' vs ' + worst + ' plan ' + rec.planCoverage.status);
        else pass('P6');
      } catch (e) {
        if (!out.P5) fail('P5', e && e.stack || e);
        if (!out.P6) fail('P6', e && e.message || e);
      }
    }

    if (want('P8') || want('P9')) {
      try {
        Object.keys(gateBook).forEach((k) => { novelData[k] = JSON.parse(JSON.stringify(gateBook[k])); });
        novelData.skipAutoRevision = true;
        novelData.autoContinuityAudit = false;
        novelData.aiBeatCheck = false;
        novelData.kbEnabled = false;
        novelData.chapterWritingPlans = [null, null];
        if (typeof applySessionDataToUI === 'function') applySessionDataToUI();
        document.getElementById('batchBuildPlansFirst').checked = false;
        let hungOnce = false;
        window.callAI = async function () {
          if (!hungOnce) {
            hungOnce = true;
            window.__hHang = true;
            await new Promise((resolve) => { window.__hRelease = resolve; });
          }
          requestLog.returnedInfo = JSON.stringify({ usage: { total_tokens: 1 } });
          return { chapter: 'Hanging draft text that is long enough to store in the chapter array for the lock test.' };
        };
        const run = generateAllChapters();
        await new Promise((resolve, reject) => {
          const t0 = Date.now();
          (function wait() {
            if (window.__hHang && nwBatchState.running) return resolve();
            if (Date.now() - t0 > 20000) return reject(new Error('did not lock'));
            setTimeout(wait, 20);
          })();
        });
        const before = JSON.stringify(novelData.chapterWritingPlans || []);
        const buildBtn = Array.from(document.querySelectorAll('.nw-plan-panel button')).find((b) => b.textContent === 'Build');
        const refused = await nwBuildWritingPlan(1, { useAI: false });
        const edit = nwApplyPlanUserEdit(1);
        const refresh = nwRefreshPlanBuiltFrom(1);
        const after = JSON.stringify(novelData.chapterWritingPlans || []);
        if (!buildBtn || buildBtn.disabled !== true) fail('P8', 'build button not locked');
        else pass('P8');
        if (!refused || refused.reason !== 'locked') fail('P9', 'build ' + JSON.stringify(refused));
        else if (!edit || edit.reason !== 'locked') fail('P9', 'edit ' + JSON.stringify(edit));
        else if (!refresh || refresh.reason !== 'locked') fail('P9', 'refresh ' + JSON.stringify(refresh));
        else if (before !== after) fail('P9', 'plans changed while locked');
        else pass('P9');
        if (window.__hRelease) window.__hRelease();
        nwBatchState.running = false;
        await run.catch(() => {});
      } catch (e) {
        if (!out.P8) fail('P8', e && e.stack || e);
        if (!out.P9) fail('P9', e && e.message || e);
        nwBatchState.running = false;
        if (window.__hRelease) window.__hRelease();
      }
    }

    if (want('P9order')) {
      try {
        applyBook(book);
        document.getElementById('batchBuildPlansFirst').checked = true;
        document.getElementById('batchBuildPlansUseAI').checked = false;
        window.callAI = async function () {
          requestLog.returnedInfo = JSON.stringify({ usage: { total_tokens: 1 } });
          return { chapter: 'x' };
        };
        await generateAllChapters();
        const log = (window.__nwPlanPhaseLog || []).slice();
        const plansAt = log.indexOf('plans');
        const batchAt = log.indexOf('batch-start');
        if (plansAt < 0 || batchAt < 0 || plansAt > batchAt) fail('P9order', log.join(','));
        else if (!novelData.chapterWritingPlans[0] || !novelData.chapterWritingPlans[0].items) fail('P9order', 'plans were not built');
        else pass('P9order');
      } catch (e) { fail('P9order', e && e.stack || e); }
    }

    if (want('P8par')) {
      try {
        applyBook(book);
        window.callAI = realCallAI;
        document.getElementById('apiKey').value = 'smoke-not-a-real-key';
        let saw = false;
        const origFetch = window.fetch;
        window.fetch = function (url, opts) {
          return new Promise((resolve) => {
            setTimeout(() => {
              const chapters = [];
              if (typeof nwActiveCalls !== 'undefined' && nwActiveCalls && nwActiveCalls.forEach) {
                nwActiveCalls.forEach((c) => chapters.push(c && c.chapter));
              }
              const ids = chapters.filter((n) => n != null);
              if (new Set(ids).size >= 2) saw = true;
              window.__nwActiveSample = ids;
              const body = JSON.stringify({
                choices: [{ message: { content: JSON.stringify({ items: [{ kind: 'beat', label: 'parallel beat', detail: '' }] }) } }],
                usage: { prompt_tokens: 4, completion_tokens: 4, total_tokens: 8 }
              });
              resolve(new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }));
            }, 200);
          });
        };
        const both = await Promise.all([
          nwBuildWritingPlan(1, { useAI: true }),
          nwBuildWritingPlan(2, { useAI: true })
        ]);
        window.fetch = origFetch;
        if (!saw) fail('P8par', 'active calls ' + JSON.stringify(window.__nwActiveSample));
        else if (!both[0] || !both[0].ok || !both[1] || !both[1].ok) fail('P8par', 'plans did not both persist');
        else if (novelData.chapterWritingPlans[0].items[0].label !== 'parallel beat' || novelData.chapterWritingPlans[1].items[0].label !== 'parallel beat') fail('P8par', 'plans mixed');
        else pass('P8par');
      } catch (e) { fail('P8par', e && e.stack || e); }
    }

    if (want('P12')) {
      try {
        applyBook(book);
        if (typeof nwBuildWritingPlan !== 'function') {
          window.nwBuildWritingPlan = async function () {
            if (!Array.isArray(novelData.chapterWritingPlans)) novelData.chapterWritingPlans = [];
            var plan = novelData.chapterWritingPlans[0];
            if (!plan || !Array.isArray(plan.items)) {
              plan = { items: [], builtBy: 'heuristic' };
              novelData.chapterWritingPlans[0] = plan;
            }
            return { ok: true, plan: plan };
          };
        }
        if (typeof nwApplyPlanUserEdit !== 'function') {
          window.nwApplyPlanUserEdit = function () { return { ok: true }; };
        }
        await nwBuildWritingPlan(1, { useAI: false });
        const before = JSON.stringify(novelData.chapterWritingPlans[0]);
        novelData.batchRun = { id: 'pause-1', reason: 'paused', range: { from: 1, to: 2 }, completed: [], startedAt: '2026-10-12T00:00:00.000Z' };
        nwBatchState.running = false;
        nwBatchApplyLock();
        const btn = Array.from(document.querySelectorAll('#writingPlanPanel1 button')).find((b) => b.textContent === 'Build');
        const edit = nwApplyPlanUserEdit(1);
        const build = await nwBuildWritingPlan(1, { useAI: false });
        const after = JSON.stringify(novelData.chapterWritingPlans[0]);
        if (!btn || btn.disabled !== true) fail('P12', 'button not disabled during pause');
        else if (!edit || edit.reason !== 'locked') fail('P12', 'edit ' + JSON.stringify(edit));
        else if (!build || build.reason !== 'locked') fail('P12', 'build ' + JSON.stringify(build));
        else if (before !== after) fail('P12', 'plan changed during pause');
        else pass('P12');
        novelData.batchRun.reason = 'cancelled';
        nwBatchApplyLock();
      } catch (e) { fail('P12', e && e.stack || e); }
    }

    if (want('OUTL')) {
      try {
        applyBook(book);
        const head = 'OUTL-CH1-MARKER-167';
        const tail = 'OUTL-CH1-TAIL-167';
        novelData.chapterOutlines = [head + ' ' + 'dock clock '.repeat(150) + tail, 'OUTL-CH2-MARKER-167 the morning shift.'];
        let sentUser = '';
        window.callAI = async function (messages) {
          const u = (messages || []).find((m) => m && m.role === 'user');
          sentUser = String(u && u.content || '');
          return { items: [{ kind: 'beat', label: 'OUTL beat', detail: '' }] };
        };
        await nwBuildWritingPlan(1, { useAI: true });
        if (sentUser.indexOf(head) < 0) fail('OUTL', 'chapter-1 outline missing from the plan request');
        else if (sentUser.indexOf('OUTL-CH2-MARKER-167') >= 0) fail('OUTL', 'chapter-2 outline leaked into the chapter-1 request');
        else if (sentUser.indexOf(tail) >= 0) fail('OUTL', 'outline not capped at 1000 chars');
        else pass('OUTL');
      } catch (e) { fail('OUTL', e && e.stack || e); }
    }

    if (want('EST')) {
      try {
        applyBook(book);
        novelData.numChapters = 3;
        novelData.chapters = ['', '', ''];
        novelData.chapterOutlines = novelData.chapterOutlines.concat(['Chapter three outline.']);
        novelData.chapterWritingPlans = [null, null, null];
        const fresh = await nwBuildWritingPlan(1, { useAI: false });
        novelData.chapterWritingPlans[1] = { items: [{ kind: 'beat', label: 'stale beat', detail: '' }], builtBy: 'heuristic', builtFrom: 'stale-167' };
        document.getElementById('batchBuildPlansFirst').checked = true;
        document.getElementById('batchBuildPlansUseAI').checked = true;
        const est = nwBatchEstimate([1, 2, 3]);
        if (!fresh || !fresh.ok || nwPlanIsStale(1)) fail('EST', 'ch1 plan is not fresh: ' + JSON.stringify(fresh && fresh.ok));
        else if (!nwPlanIsStale(2)) fail('EST', 'ch2 plan is not stale');
        else if (!est || est.planBuildCalls !== 2) fail('EST', 'planBuildCalls want 2 (ch2 stale + ch3 missing), got ' + JSON.stringify(est && est.planBuildCalls));
        else if (!estCallerPassesList) fail('EST', 'Generate All callers still pass plan.planned.length');
        else pass('EST');
      } catch (e) { fail('EST', e && e.stack || e); }
    }

    if (want('KAW')) {
      try {
        const VALUE = 'KAW-VALUE-167-do-not-show';
        const file = {
          genre: 'mystery',
          title: 'KAW import',
          numChapters: 2,
          chapters: ['', ''],
          chapterRequirements: VALUE + '-req',
          storyWorld: { locations: [], systems: VALUE + '-sys' }
        };
        const toast = document.getElementById('nwToast');
        if (toast) { toast.textContent = ''; toast.hidden = true; }
        const input = document.getElementById('importFile');
        const dt = new DataTransfer();
        dt.items.add(new File([JSON.stringify(file)], 'kaw167.json', { type: 'application/json' }));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        const t0 = Date.now();
        while (Date.now() - t0 < 5000 && !(toast && !toast.hidden && /wrong type/.test(toast.textContent || ''))) await new Promise((r) => setTimeout(r, 25));
        const text = toast ? String(toast.textContent || '') : '';
        if (!toast || toast.hidden || !/wrong type/.test(text)) fail('KAW', 'no visible keep-and-warn notice; toast=' + JSON.stringify(text));
        else if (text.indexOf('chapterRequirements') < 0 || text.indexOf('storyWorld.systems') < 0) fail('KAW', 'notice does not name both fields: ' + JSON.stringify(text));
        else if (text.indexOf(VALUE) >= 0) fail('KAW', 'notice leaked a field value');
        else pass('KAW');
      } catch (e) { fail('KAW', e && e.stack || e); }
    }

    return out;
  }, { book: smallBook(), gateBook: enriched(FX), only: only || null, estCallerPassesList: HTML.indexOf('nwBatchEstimate(plan.planned.length)') < 0 && HTML.indexOf('nwBatchEstimate(plan.planned)') >= 0 }), EVAL_MS, 'plans runSuite');
}

try {
browser = await chromium.launch({ headless: true });
console.log('plans: green suite' + (ONLY ? ' only=' + ONLY : ''));
const page = await openPage(HTML_PATH);
let green = {};
try { green = await runSuite(page, ONLY); }
catch (e) { check('BOOT', 'suite threw', false, e && e.stack || e); }
await page.close();

const names = {
  P1: 'heuristic build yields beat, cast, setting, and fact items and makes no API call',
  P2: 'AI build is one call per chapter and is in the ledger and the estimate',
  P2b: 'bad JSON falls back to the heuristic',
  P2c: 'unchecked AI box does not add estimate calls',
  P3: 'Tab 5 edits round-trip and a user edit does not refresh builtFrom',
  P4: 'a plan supplies the one HARD REQUIREMENTS section; no plan uses the blueprint',
  P5: 'draft-only keeps the plan in the prompt and makes no revise call',
  P6: 'planCoverage reads writingPlan and stays out of overall',
  P7: 'plan text is rendered as text, not HTML',
  P8: 'build buttons are locked during Generate All',
  P8par: 'two parallel builds keep separate active calls and both plans persist',
  P9: 'while the batch is locked, build, edit, and builtFrom refresh are refused',
  P9order: 'Build plans first runs before the batch start',
  P10: 'stale helper still calls nwPlanIsStale',
  P10a: 'editing the blueprint shows plan stale and rebuild clears it',
  P10b: 'editing a required fact or mustNotInclude shows stale',
  P10c: 'a user edit does not change builtFrom',
  P10d: 'rebuilding a user plan asks for a confirm',
  P10e: 'migration does not write builtFrom, so the plan stays stale',
  P11: 'a conflicting plan setting loses to the blueprint and raises one warning',
  P12: 'a plan edit during pause is refused',
  OUTL: 'AI plan request carries this chapter outline only, capped at 1000 chars',
  EST: 'estimate counts plan builds only for missing or stale plans',
  KAW: 'import keep-and-warn shows one on-screen notice naming the fields, no values'
};
if (!ONLY && !green.P10) {
  const parts = ['P10a', 'P10b', 'P10c', 'P10d', 'P10e'].filter((id) => green[id] && green[id].ok);
  if (parts.length === 5) green.P10 = { ok: true, detail: '' };
  else green.P10 = { ok: false, detail: ['P10a', 'P10b', 'P10c', 'P10d', 'P10e'].filter((id) => !green[id] || !green[id].ok).map((id) => id + ': ' + ((green[id] && green[id].detail) || 'missing')).join(' || ') };
}
Object.keys(names).forEach((id) => {
  if (ONLY && ONLY !== id) return;
  const row = green[id];
  check(id, names[id], row && row.ok, row ? row.detail : 'missing result');
});

const mutations = [
  ['MUT-plans-inside-loop', "window.__nwPlanPhaseLog = [];\n            var buildEl = nwBatchEl('batchBuildPlansFirst');", "window.__nwPlanPhaseLog = [];\n            window.__nwPlanPhaseLog.push('batch-start');\n            var buildEl = nwBatchEl('batchBuildPlansFirst');", 'P9order'],
  ['MUT-skip-builtFrom', 'function nwWritingPlanIsStale(n) {\n\t\t\treturn nwPlanIsStale(n);\n\t\t}', 'function nwWritingPlanIsStale(n) {\n\t\t\treturn false;\n\t\t}', 'P10a'],
  ['MUT-plan-beats-blueprint', 'var blueprintWins = true;', 'var blueprintWins = false;', 'P11'],
  ['MUT-ignore-plan', 'var usePlan = !!(bp && planItems.length);', 'var usePlan = false;', 'P4'],
  ['MUT-second-section', "else lines.push(forbid);\n\t\t\treturn lines.join('\\n');", "else lines.push(forbid);\n\t\t\tlines.push('WRITING PLAN');\n\t\t\t(built.items || []).forEach(function (it) { lines.push('- ' + (it.text || '')); });\n\t\t\treturn lines.join('\\n');", 'P4'],
  ['MUT-build-while-locked', 'return nwBatchSetupIsLocked();', 'return false;', 'P9'],
  ['MUT-two-chapters-one-call', 'var sent = [n];', 'var sent = [n, n + 1];', 'P2'],
  ['MUT-estimate-omits-ai', 'if (buildEl && buildEl.checked && aiEl && aiEl.checked) {\n                planBuildCalls = count;', 'if (false && buildEl && buildEl.checked && aiEl && aiEl.checked) {\n                planBuildCalls = count;', 'P2'],
  ['MUT-innerHTML', "el.textContent = String(text == null ? '' : text);", "el.innerHTML = String(text == null ? '' : text);", 'P7'],
  ['WP:P12', 'return nwBatchSetupIsLocked();', 'return nwBatchIsLocked();', 'P12'],
  ['MUT-OUTL', " + ' Chapter outline: ' + JSON.stringify(digestText(String((novelData.chapterOutlines || [])[n - 1] || ''), 1000)) }", ' }', 'OUTL'],
  ['MUT-EST', '                if (plannedList) planBuildCalls = plannedList.filter(nwBatchPlanNeedsBuild).length;\n', '', 'EST'],
  ['MUT-KAW', "nwNotify('Import kept fields with the wrong type: ' + nwImportWrongTypeSink.join(', ') + '. Check them before generating.', { level: 'warn', visible: true });", 'void 0;', 'KAW']
];

for (const [id, from, to, kills] of mutations) {
  if (ONLY) break;
  console.log('plans: mutation ' + id);
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

// PAGEERR meta-check: the suite must exit 1 when a page throws. MUT-PAGEERR removes the listener and expects exit 0.
function runSelf(scriptPath) {
  const env = Object.assign({}, process.env, { NW_SMOKE_INJECT_PAGEERR: '1' });
  for (const k of ['XAI_API_KEY', 'GROK_API_KEY', 'NW_E2E_LIVE', 'NW_SMOKE_ONLY']) delete env[k];
  const r = spawnSync(process.execPath, [scriptPath, '--only', 'P7'], { env, encoding: 'utf8', timeout: 60000 });
  return { status: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
}
if (!ONLY && !INJECT_PAGEERR) {
  console.log('plans: meta PAGEERR');
  const r = runSelf(SELF_PATH);
  check('PAGEERR', 'an uncaught page error makes the suite exit 1', r.status === 1 && r.out.indexOf('pe167') >= 0, 'rc=' + r.status + ' ' + r.out.slice(-400));
  console.log('plans: mutation MUT-PAGEERR');
  const listener = "  page.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));\n";
  const selfSrc = fs.readFileSync(SELF_PATH, 'utf8').replace(/\r\n/g, '\n');
  if (selfSrc.split(listener).length !== 2) check('MUT-PAGEERR', 'mutation turns PAGEERR red', false, 'anchor not unique: pageerror listener');
  else {
    const mutPath = path.join(SCRIPT_DIR, '.tmp-mut-pageerr-' + process.pid + '.mjs');
    try {
      fs.writeFileSync(mutPath, selfSrc.replace(listener, ''));
      const m = runSelf(mutPath);
      check('MUT-PAGEERR', 'mutation turns PAGEERR red', m.status === 0, 'still green: rc=' + m.status + ' ' + m.out.slice(-300));
    } finally { try { fs.unlinkSync(mutPath); } catch (_) {} }
  }
}

if (pageErrors.length) check('PAGE', 'no uncaught pageerror events', false, pageErrors.join(' | '));

let failed = 0;
checks.forEach((c) => {
  if (!c.ok) failed += 1;
  console.log((c.ok ? 'PASS' : 'FAIL') + ' [' + c.id + '] ' + c.name + (c.ok ? '' : ' :: ' + c.detail));
});
console.log('PLANS ' + (checks.length - failed) + '/' + checks.length + ' passed');
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
