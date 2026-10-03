/**
 * NovelWriter Tracked E2E runner (PR3 of the #117 split): drives this checkout's NovelWriter.html
 * stage by stage in headless Chromium, writes progress/status/JSON/Markdown under NW_OUT_DIR, then
 * builds the single-file report with scripts/build_unified_report.py.
 *
 * OFFLINE BY DEFAULT. Without NW_E2E_LIVE=1 every xAI request is answered by the vendored fixture
 * responder (scripts/_nw_e2e_offline_responder.mjs, seeded from scripts/fixtures/nw_slop/b3r_seed.json),
 * every other http(s) request is aborted, and no key file is read. Live mode needs NW_E2E_LIVE=1 plus
 * XAI_API_KEY (or GROK_API_KEY) and is refused when CI or GITHUB_ACTIONS is set to ANY non-empty value
 * (CI=false, CI=0 and CI=on all count as CI).
 *
 * Usage: node scripts/run-tracked-e2e.mjs   (see scripts/README.md for every NW_* variable)
 * Exit codes: 0 pass; 1 fatal; 2 one or more steps failed; 3 live mode refused / key missing;
 *             4 steps passed but the unified report build failed (run marked incomplete).
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright';
import { createOfflineResponder, promptTextFromBody, toXaiResponse } from './_nw_e2e_offline_responder.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const HTML_PATH = path.resolve(process.env.NW_HTML_PATH || path.join(REPO_ROOT, 'NovelWriter', 'NovelWriter.html'));
const HTML_URL = pathToFileURL(HTML_PATH).href;
const ENV = path.resolve(process.env.NW_ENV_FILE || path.join(REPO_ROOT, 'secrets', 'xai.local.env'));
const FIXTURES = path.resolve(process.env.NW_FIXTURES_DIR || path.join(SCRIPT_DIR, 'fixtures', 'nw_slop'));
const OUT_DIR = path.resolve(process.env.NW_OUT_DIR || path.join(REPO_ROOT, 'out', 'nw-e2e'));
const SPANS_DIR = path.join(FIXTURES, 'inject_spans');
const OFFLINE_SEED = path.resolve(process.env.NW_E2E_OFFLINE_SEED || path.join(FIXTURES, 'b3r_seed.json'));
const BUILDER = path.resolve(process.env.NW_E2E_REPORT_BUILDER || path.join(SCRIPT_DIR, 'build_unified_report.py'));
const REPORT_JSON = path.join(OUT_DIR, 'TRACKED_E2E_REPORT.json');
const REPORT_MD_LATEST = path.join(OUT_DIR, 'TRACKED_E2E_REPORT_LATEST.md');
const PROGRESS = path.join(OUT_DIR, 'TRACKED_E2E_PROGRESS.md');
const STATUS = path.join(OUT_DIR, 'TRACKED_E2E_STATUS.json');
const ANNEX_JSON = path.join(OUT_DIR, 'TRACKED_E2E_ANNEX_NOVELDATA.json');
const ANNEX_MD = path.join(OUT_DIR, 'TRACKED_E2E_ANNEXES.md');
const TOKENS_MD = path.join(OUT_DIR, 'TRACKED_E2E_TOKENS_BY_STAGE.md');

// Any non-empty CI / GITHUB_ACTIONS value means CI (CI=false, CI=0, CI=on included): fail safe, never parse it.
const isSet = (v) => v != null && String(v) !== '';
const LIVE = process.env.NW_E2E_LIVE === '1';
const IN_CI = isSet(process.env.CI) || isSet(process.env.GITHUB_ACTIONS);
const STRICT = process.env.NW_E2E_STRICT === '1';
const MODE = LIVE ? 'live' : 'offline';
// Placeholder so the page's "key present" checks pass; offline requests never leave the browser.
const OFFLINE_KEY = 'offline-fixture-not-a-key';

fs.mkdirSync(OUT_DIR, { recursive: true });

let apiKey = OFFLINE_KEY;
if (LIVE) {
  if (IN_CI) {
    console.error('run-tracked-e2e: NW_E2E_LIVE=1 is refused under CI (CI or GITHUB_ACTIONS is non-empty). CI runs offline fixtures only.');
    process.exit(3);
  }
  const dotenv = (await import('dotenv')).default;
  dotenv.config({ path: ENV, quiet: true });
  apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY || '';
  if (!apiKey) {
    console.error('run-tracked-e2e: live mode needs XAI_API_KEY (or GROK_API_KEY) in the environment or in NW_ENV_FILE (' + ENV + ').');
    process.exit(3);
  }
}

// Network-level call ledger. Works with or without the page's token rollup helpers (PR1).
const netCalls = [];
const blockedRequests = [];
let offline = null;

function netUsage() {
  const sum = (k) => netCalls.reduce((a, c) => a + (c[k] || 0), 0);
  return {
    source: 'network',
    prompt_tokens: sum('prompt_tokens'),
    completion_tokens: sum('completion_tokens'),
    total_tokens: sum('total_tokens'),
    calls: netCalls.slice()
  };
}

function normUsage(u) {
  u = u || {};
  return {
    prompt_tokens: u.prompt_tokens != null ? u.prompt_tokens : (u.input_tokens || 0),
    completion_tokens: u.completion_tokens != null ? u.completion_tokens : (u.output_tokens || 0),
    total_tokens: u.total_tokens || 0
  };
}

// Known pre-existing race on main (#130): updateChapterSubpages() queues requestAnimationFrame callbacks that write
// chapterGenContentN / chapterEditContentN / chapterEditImprovementN after the node was replaced. Only that exact error
// ('Cannot set properties of null' with its top NovelWriter.html frame on that line) is exempt; any other page error fails the run.
const KNOWN_RAF_RACE_LINE = /getElementById\(`chapter(?:GenContent|EditContent|EditImprovement)\$\{i\}`\)\.value = novelData\.(?:chapters|chapterImprovements)\[i-1\]/;
let htmlLinesCache = null;
function isKnownRafRace(e) {
  const msg = String(e && e.message ? e.message : e);
  if (!/Cannot set properties of null/.test(msg)) return false;
  const m = String(e && e.stack || '').match(/NovelWriter\.html:(\d+):\d+/);
  if (!m) return false;
  try { htmlLinesCache = htmlLinesCache || fs.readFileSync(HTML_PATH, 'utf8').split(/\r?\n/); } catch (_) { return false; }
  return KNOWN_RAF_RACE_LINE.test(htmlLinesCache[parseInt(m[1], 10) - 1] || '');
}

// Step rows carry status 'pass' | 'fail' | 'skip'. A skip has ok:null, so it never reads as ok:true, and only 'fail' fails the run.
const stepFailed = (s) => (s.status ? s.status === 'fail' : !s.ok);

function writeStatus(tab, step, status) {
  fs.writeFileSync(STATUS, JSON.stringify({ tab, step, status, updatedAt: new Date().toISOString() }, null, 2));
}

function appendProgress(block) {
  fs.appendFileSync(PROGRESS, '\n' + block.trim() + '\n');
}

async function bookSnap(page) {
  const snap = await page.evaluate(() => {
    const u = (typeof getSessionUsage === 'function') ? getSessionUsage() : null;
    const q = (novelData.qualitySamples || []).slice(-1)[0] || null;
    return {
      pageUsage: u ? { prompt_tokens: u.prompt_tokens || 0, completion_tokens: u.completion_tokens || 0, total_tokens: u.total_tokens || 0, calls: (u.calls || []).map(c => ({ operationName: c.operationName, prompt_tokens: c.prompt_tokens, completion_tokens: c.completion_tokens, total_tokens: c.total_tokens })) } : null,
      title: novelData.title || '',
      genre: novelData.genre || '',
      chars: (novelData.characters || []).length,
      subplots: (novelData.subplots || []).length,
      ch1Len: ((novelData.chapters && novelData.chapters[0]) || '').length,
      ch2Len: ((novelData.chapters && novelData.chapters[1]) || '').length,
      ch1Snippet: (((novelData.chapters && novelData.chapters[0]) || '').replace(/\s+/g, ' ').slice(0, 140)),
      ch2Snippet: (((novelData.chapters && novelData.chapters[1]) || '').replace(/\s+/g, ' ').slice(0, 140)),
      storyArcSnippet: ((novelData.storyArc || '').replace(/\s+/g, ' ').slice(0, 120)),
      quality: q
    };
  });
  // Prefer the page's book-scoped rollup (PR1) when it exists; otherwise count calls at the network layer.
  const u = snap.pageUsage || netUsage();
  const last = (u.calls && u.calls.length) ? u.calls[u.calls.length - 1] : null;
  delete snap.pageUsage;
  return Object.assign(snap, {
    usageSource: u.source || 'page',
    totals: {
      prompt_tokens: u.prompt_tokens || 0,
      completion_tokens: u.completion_tokens || 0,
      total_tokens: u.total_tokens || 0,
      calls: (u.calls || []).length
    },
    last: last ? { name: last.operationName, prompt: last.prompt_tokens, completion: last.completion_tokens, total: last.total_tokens } : null
  });
}


function assertApiStep(label, beforeCalls, after, opts) {
  opts = opts || {};
  const grew = after.totals.calls > beforeCalls;
  const minChars = opts.minChars || 0;
  const contentLen = opts.contentLen != null ? opts.contentLen : null;
  if (!grew && !opts.allowNoCall) {
    throw new Error(label + ': expected API call to increase book tokenUsage.calls (before=' + beforeCalls + ' after=' + after.totals.calls + ') - likely auth failure or silent no-op');
  }
  if (contentLen != null && contentLen < minChars) {
    throw new Error(label + ': expected content >= ' + minChars + ' chars, got ' + contentLen + ' (false pass / empty generation)');
  }
}

/** Fail-closed workflow gate: early stages must be dense + not sloppy before later stages multiply defects. */
function assertStageGate(label, checks) {
  const fails = [];
  (checks || []).forEach((c) => {
    if (!c) return;
    if (!c.ok) fails.push(c.msg || 'unspecified gate failure');
  });
  if (fails.length) {
    throw new Error('STAGE GATE FAIL-CLOSED [' + label + ']: ' + fails.join(' | '));
  }
}

function subplotRichness(subplots) {
  const rich = (subplots || []).filter((s) => {
    if (!s) return false;
    if (typeof s === 'string') return s.trim().length >= 40;
    return !!(s.title || s.name) && !!(s.summary || s.description || s.text);
  });
  return {
    count: rich.length,
    sample: rich[0]
      ? (typeof rich[0] === 'string'
        ? rich[0].slice(0, 80)
        : String((rich[0].title || '') + ': ' + (rich[0].summary || '')).slice(0, 80))
      : ''
  };
}

function outlineWordCount(text) {
  const t = String(text || '').trim();
  return t ? t.split(/\s+/).length : 0;
}

function tokLine(snap, beforeCalls) {
  const last = snap.last;
  const thisCall = last && snap.totals.calls > beforeCalls
    ? (last.prompt + '/' + last.completion + '/' + last.total)
    : '0/0/0 (no new call)';
  return thisCall + ' / book ' + snap.totals.prompt_tokens + '/' + snap.totals.completion_tokens + '/' + snap.totals.total_tokens + ' (' + snap.totals.calls + ' calls)';
}

async function runStep(page, tab, name, stepLabel, fn, evalFn) {
  writeStatus(tab, stepLabel, 'running');
  appendProgress('### Tab ' + tab + ' - ' + name + ' - ' + stepLabel + '\n- Status: running\n- Tokens: pending\n- Eval: starting...\n');
  const before = await bookSnap(page);
  const beforeCalls = before.totals.calls;
  let ok = true;
  let err = null;
  let result = null;
  try {
    result = await fn();
  } catch (e) {
    ok = false;
    err = e && e.message ? e.message : String(e);
  }
  const after = await bookSnap(page);
  const evalText = evalFn ? evalFn(after, result, ok, err) : (ok ? 'Step completed.' : ('Failed: ' + err));
  const status = ok ? 'pass' : 'fail';
  writeStatus(tab, stepLabel, status);
  appendProgress(
    '### Tab ' + tab + ' - ' + name + ' - ' + stepLabel + '\n' +
    '- Status: ' + status + (err ? (' - ' + String(err).replace(/\n/g, ' ').slice(0, 200)) : '') + '\n' +
    '- Tokens this call / book cumulative: ' + tokLine(after, beforeCalls) + '\n' +
    '- Eval: ' + evalText + '\n'
  );
  return { ok: ok, err: err, result: result, after: after, name: stepLabel };
}

const report = {
  ok: false,
  mode: MODE,
  steps: [],
  startedAt: new Date().toISOString(),
  config: { numChapters: 2, chapterLength: 500, numCharacters: 3, minSubplots: 2, maxTokens: 6000, genre: 'scifi', htmlPath: path.relative(REPO_ROOT, HTML_PATH) || HTML_PATH }
};

// Page helpers the full flow uses. Several arrive with split PR1 (token rollup, enrich, readiness, blueprint
// pack); when absent the runner records them and skips only the steps that need them (NW_E2E_STRICT=1 fails instead).
const PAGE_HELPERS = ['getSessionUsage', 'getSessionQuality', 'resetBookTokenUsage', 'runC1Smoke', 'scoreAdvanceToTab5Readiness',
  'buildGenerateChapterUserContent', 'scoreObligationCoverage', 'getPlotDigestText', 'getSettingDigestText', 'getChapterBlueprint',
  'enrichCharacters', 'enrichSubplots', 'enrichChapterBlueprints', 'scoreBeatCoverage', 'scoreOutlineObligations', 'buildPromptContextPack',
  'digestWorldBible', 'applyStagedChapterImprovements', 'reviseChapterForQuality', 'applyTopBookCritiques', 'applyE2eSlopInject', 'runTrackedE2E'];

// The lean LATEST.md is written before the builder runs; if the build fails, it must not keep saying OK: true.
function markLatestIncomplete(error) {
  try {
    const md = fs.readFileSync(REPORT_MD_LATEST, 'utf8');
    const note = '- OK: false (INCOMPLETE - unified report build failed: ' + String(error || 'unknown').replace(/\s+/g, ' ').slice(0, 300) + ')';
    fs.writeFileSync(REPORT_MD_LATEST, /^- OK: .*$/m.test(md) ? md.replace(/^- OK: .*$/m, note) : (note + '\n' + md));
  } catch (_) {}
}

function buildUnifiedReport() {
  if (!fs.existsSync(BUILDER)) return { ok: false, error: 'report builder not found: ' + BUILDER };
  const py = process.env.NW_PYTHON ? [process.env.NW_PYTHON] : (process.platform === 'win32' ? ['py', '-3'] : ['python3']);
  const r = spawnSync(py[0], py.slice(1).concat([BUILDER]), {
    encoding: 'utf-8',
    env: Object.assign({}, process.env, { NW_OUT_DIR: OUT_DIR, PYTHONDONTWRITEBYTECODE: '1' })
  });
  if (r.error) return { ok: false, error: 'report builder could not start (' + py.join(' ') + '): ' + r.error.message };
  if (r.status !== 0) return { ok: false, error: 'report builder exited ' + r.status + ': ' + String(r.stderr || r.stdout || '').trim().slice(-600) };
  const m = String(r.stdout || '').match(/^wrote (.+?) bytes/m);
  return { ok: true, report: m ? path.basename(m[1].trim()) : null };
}

let browser = null;
(async () => {
  appendProgress('### Phase - tracked E2E - launching\n- Status: running\n- Tokens: n/a\n- Eval: mode=' + MODE + ' html=' + report.config.htmlPath + (LIVE ? '; injecting API key (not logged)' : '; offline fixture responder, all other network blocked') + '; lean config 2ch/500w/3chars/2subplots.\n');
  writeStatus(0, 'e2e-launch', 'running');

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(LIVE ? 600000 : 60000);
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  const pageErrors = [];
  const knownPageErrors = [];
  page.on('pageerror', (e) => (isKnownRafRace(e) ? knownPageErrors : pageErrors).push(String(e && e.message ? e.message : e).slice(0, 300)));
  report.pageErrors = pageErrors;
  report.knownPageErrors = knownPageErrors;
  if (!LIVE) {
    const seed = JSON.parse(fs.readFileSync(OFFLINE_SEED, 'utf8'));
    offline = createOfflineResponder(seed);
    report.offline = { seed: path.relative(REPO_ROOT, OFFLINE_SEED) || OFFLINE_SEED };
    await page.route('**/*', async (route) => {
      const req = route.request();
      const url = req.url();
      if (!/^https?:/i.test(url)) return route.continue();
      if (/^https:\/\/api\.x\.ai\//i.test(url)) {
        let body = {};
        try { body = JSON.parse(req.postData() || '{}'); } catch (_) { body = {}; }
        const result = offline.respond(body);
        netCalls.push(Object.assign({ operationName: result.rule, originTab: 'offline', model: body.model || '', ts: new Date().toISOString(), contextPackChars: promptTextFromBody(body).length }, result.usage));
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(toXaiResponse(body, result, url)) });
      }
      blockedRequests.push(url);
      return route.abort('blockedbyclient');
    });
  } else {
    page.on('response', async (resp) => {
      if (!/^https:\/\/api\.x\.ai\//i.test(resp.url())) return;
      let usage = {};
      let model = '';
      try { const j = await resp.json(); usage = normUsage(j.usage); model = j.model || ''; } catch (_) {}
      netCalls.push(Object.assign({ operationName: 'unknown', originTab: '', model, ts: new Date().toISOString(), status: resp.status() }, usage));
    });
  }
  await page.goto(HTML_URL);
  await page.waitForFunction(() => typeof callAI === 'function' && typeof generateChapter === 'function');
  report.config.pageCapabilities = await page.evaluate((names) => Object.fromEntries(names.map((n) => [n, typeof window[n] === 'function' || (function () { try { return typeof eval(n) === 'function'; } catch (_) { return false; } })()])), PAGE_HELPERS);
  const missingHelpers = Object.keys(report.config.pageCapabilities).filter((k) => !report.config.pageCapabilities[k]);
  report.config.missingHelpers = missingHelpers;
  if (missingHelpers.length) {
    appendProgress('### Phase - page capabilities\n- Status: ' + (STRICT ? 'fail (NW_E2E_STRICT=1)' : 'partial') + '\n- Eval: helpers absent from this HTML (steps needing them are skipped): ' + missingHelpers.join(', ') + '\n');
    if (STRICT) throw new Error('NW_E2E_STRICT=1 and page helpers missing: ' + missingHelpers.join(', '));
  }
  const hasHelper = (n) => !!report.config.pageCapabilities[n];
  // World Bible packing (digestWorldBible) arrives with PR1; without it the world-bible gates are recorded as skipped.
  const worldGate = hasHelper('digestWorldBible');
  report.config.worldBibleGate = worldGate ? 'enforced' : 'skipped (digestWorldBible absent; arrives with PR1)';

  await page.evaluate(({ key, cfg, live }) => {
    document.getElementById('apiKey').value = key;
    const modelSel = document.getElementById('model');
    if (modelSel && !live) {
      // Offline: any chat-completions model; the responder answers every request.
      const opts = Array.from(modelSel.options || []);
      const chat = opts.find(o => o.value && !/multi-agent/i.test(o.value));
      if (chat) modelSel.value = chat.value;
    } else if (modelSel) {
      const opts = Array.from(modelSel.options || []);
      const g47 = opts.find(o => /grok-4\.7/i.test(o.value) || /grok-4\.7/i.test(o.textContent || ''));
      const fast = opts.find(o => /fast-non-reasoning/i.test(o.value));
      if (g47) modelSel.value = g47.value;
      else if (fast) modelSel.value = fast.value;
      else if (!modelSel.value && opts[0]) modelSel.value = opts[0].value;
    }
    if (typeof resetBookTokenUsage === 'function') resetBookTokenUsage();
    novelData.qualitySamples = [];
    document.getElementById('genre').value = cfg.genre;
    document.getElementById('title').value = cfg.title;
    document.getElementById('numChapters').value = String(cfg.numChapters);
    document.getElementById('chapterLength').value = String(cfg.chapterLength);
    document.getElementById('numCharacters').value = String(cfg.numCharacters);
    document.getElementById('minSubplots').value = String(cfg.minSubplots);
    document.getElementById('maxTokens').value = String(cfg.maxTokens);
    if (typeof updateChapterSubpages === 'function') updateChapterSubpages();
    if (typeof syncCharacterEntries === 'function') syncCharacterEntries();
    if (typeof syncSubplotEntries === 'function') syncSubplotEntries();
    if (typeof collectData === 'function') collectData();
  }, { key: apiKey, live: LIVE, cfg: Object.assign({}, report.config, { title: 'Tracked E2E Lean ' + new Date().toISOString().slice(0, 16) }) });


  // Track B: optional rich fixture seed (skip bible regen unless NW_E2E_REGEN_BIBLE=1)
  const fixturePath = process.env.NW_E2E_FIXTURE || '';
  const regenBible = process.env.NW_E2E_REGEN_BIBLE === '1';
  const enrichMode = process.env.NW_E2E_ENRICH === '1' || regenBible;
  report.config.enrichMode = enrichMode;
  report.config.fixture = fixturePath ? (path.isAbsolute(fixturePath) ? path.relative(REPO_ROOT, fixturePath) : fixturePath) : null;

  // B4-1A foul-inject prove-out (detect -> anti-slop nest). Span from catalog or basename under b4_inject_spans.
  const slopInjectOn = process.env.NW_E2E_SLOP_INJECT === '1';
  const slopInjectSpanEnv = (process.env.NW_E2E_SLOP_INJECT_SPAN || 'span_b3r_ch2_overexplain.txt').trim();
  let slopInjectSpanPath = '';
  let slopInjectSpanText = '';
  let slopInjectSpanName = '';
  if (slopInjectOn) {
    slopInjectSpanPath = path.isAbsolute(slopInjectSpanEnv)
      ? slopInjectSpanEnv
      : (fs.existsSync(path.join(SPANS_DIR, slopInjectSpanEnv))
          ? path.join(SPANS_DIR, slopInjectSpanEnv)
          : (fs.existsSync(slopInjectSpanEnv) ? path.resolve(slopInjectSpanEnv) : path.join(SPANS_DIR, slopInjectSpanEnv)));
    if (!fs.existsSync(slopInjectSpanPath)) {
      console.error('NW_E2E_SLOP_INJECT=1 but span not found:', slopInjectSpanPath);
      process.exit(1);
    }
    slopInjectSpanText = fs.readFileSync(slopInjectSpanPath, 'utf8');
    slopInjectSpanName = path.basename(slopInjectSpanPath);
  }
  const slopInjectChapter = parseInt(process.env.NW_E2E_SLOP_INJECT_CHAPTER || '2', 10) || 2;
  report.config.slopInject = slopInjectOn ? {
    enabled: true,
    span: slopInjectSpanName,
    spanPath: path.relative(REPO_ROOT, slopInjectSpanPath) || slopInjectSpanPath,
    targetChapter: slopInjectChapter,
    afterContinuity: process.env.NW_E2E_SLOP_INJECT_AFTER_CONTINUITY !== '0'
  } : { enabled: false };
  if (fixturePath) {
    const absFix = path.isAbsolute(fixturePath) ? fixturePath : path.join(REPO_ROOT, fixturePath);
    const seed = JSON.parse(fs.readFileSync(absFix, 'utf8'));
    appendProgress('### Phase - fixture seed\n- Status: loading\n- Eval: ' + absFix + '\n');
    await page.evaluate(({ seedObj, doRegen }) => {
      const keep = ['apiKey'];
      Object.keys(seedObj).forEach((k) => {
        if (k === 'notes' || k === 'fixtureId' || k === 'schemaHint' || k === 'world' || k === 'motifs') return;
        novelData[k] = seedObj[k];
      });
      novelData.worldBible = seedObj.world || novelData.worldBible;
      novelData.motifs = seedObj.motifs || novelData.motifs;
      novelData.kbEnabled = seedObj.kbEnabled !== false;
      const kb = document.getElementById('kbEnabled');
      if (kb) kb.checked = !!novelData.kbEnabled;
      const set = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
      set('title', novelData.title);
      set('genre', novelData.genre);
      set('numChapters', novelData.numChapters);
      set('storyArc', novelData.storyArc);
      set('styleGuide', novelData.styleGuide);
      // Map fixture targetWordsPerChapter onto product chapterLength (words) when present
      if (seedObj.targetWordsPerChapter != null || seedObj.chapterLength != null) {
        const tw = parseInt(seedObj.targetWordsPerChapter || seedObj.chapterLength, 10);
        if (Number.isFinite(tw) && tw >= 500) {
          novelData.chapterLength = tw;
          set('chapterLength', tw);
        }
      }
      set('maxTokens', Math.max(parseInt(novelData.maxTokens || '0', 10) || 0, 6000));
      novelData.maxTokens = Math.max(parseInt(novelData.maxTokens || '0', 10) || 0, 6000);
      if (typeof updateChapterSubpages === 'function') updateChapterSubpages();
      // populate character UI from novelData (names/roles must survive collectData)
      if (Array.isArray(novelData.characters) && novelData.characters.length) {
        const n = document.getElementById('numCharacters');
        if (n) n.value = String(novelData.characters.length);
      }
      if (typeof renderCharacters === 'function') {
        renderCharacters();
      } else if (Array.isArray(novelData.characters)) {
        // fallback: expand slots then fill .charName/.charBackstory/.charArc
        if (typeof syncCharacterEntries === 'function') syncCharacterEntries();
        const cards = document.querySelectorAll('#characterList .character');
        novelData.characters.forEach((c, i) => {
          const card = cards[i];
          if (!card) return;
          const nameEl = card.querySelector('.charName');
          const backEl = card.querySelector('.charBackstory');
          const arcEl = card.querySelector('.charArc');
          if (nameEl) nameEl.value = c.name || '';
          if (backEl) backEl.value = c.backstory || '';
          if (arcEl) arcEl.value = c.arc || '';
        });
      }
      // populate subplot UI from novelData so collectData does not wipe object/string subplots
      if (Array.isArray(novelData.subplots) && novelData.subplots.length) {
        const ms = document.getElementById('minSubplots');
        if (ms) ms.value = String(Math.max(2, novelData.subplots.length));
      }
      if (typeof renderSubplots === 'function') {
        renderSubplots();
      } else if (typeof syncSubplotEntries === 'function') {
        syncSubplotEntries();
        const areas = document.querySelectorAll('#subplotList .subplot');
        (novelData.subplots || []).forEach((s, i) => {
          if (!areas[i]) return;
          if (typeof s === 'string') areas[i].value = s;
          else if (s && typeof s === 'object') {
            const title = s.title || s.name || '';
            const summary = s.summary || s.description || '';
            areas[i].value = title && summary ? (title + ': ' + summary) : (title || summary || '');
          }
        });
      }
      window.__NW_FIXTURE_LOADED = {
        id: seedObj.fixtureId,
        regenBible: doRegen,
        chars: (novelData.characters || []).length,
        subplots: (novelData.subplots || []).length
      };
    }, { seedObj: seed, doRegen: regenBible });
    report.config.lean = false;
    report.config.numChapters = seed.numChapters || report.config.numChapters;
    appendProgress('### Phase - fixture seed\n- Status: loaded\n- Eval: fixtureId=' + (seed.fixtureId || '?') + ' chars=' + ((seed.characters || []).length) + ' chapters=' + (seed.numChapters || '?') + ' kbEnabled=' + !!seed.kbEnabled + '\n');
  }


  // Item 3/4: chapter count + optional force multipass
  // NW_E2E_CHAPTERS overrides; fixture stress defaults to min(fixture numChapters, NW_E2E_CHAPTER_CAP||4)
  {
    const envCh = parseInt(process.env.NW_E2E_CHAPTERS || '', 10);
    const cap = parseInt(process.env.NW_E2E_CHAPTER_CAP || '4', 10) || 4;
    let n = report.config.numChapters || 2;
    if (Number.isFinite(envCh) && envCh > 0) n = envCh;
    else if (fixturePath) n = Math.min(Math.max(1, n), cap);
    else n = Math.min(Math.max(1, n), 2); // lean stays 2
    report.config.numChapters = n;
    report.config.chaptersToGenerate = n;
    report.config.forceMultipass = process.env.NW_E2E_FORCE_MULTIPASS === '1';
    // Realistic chapter length knobs (product UI chapterLength + maxTokens). Prefer env; else fixture targetWordsPerChapter; else keep lean defaults.
    {
      const envLen = parseInt(process.env.NW_E2E_CHAPTER_LENGTH || '', 10);
      const envMax = parseInt(process.env.NW_E2E_MAX_TOKENS || '', 10);
      let chLen = report.config.chapterLength || 500;
      let maxTok = report.config.maxTokens || 6000;
      if (Number.isFinite(envLen) && envLen >= 500) chLen = envLen;
      else if (fixturePath) {
        try {
          const absFix2 = path.isAbsolute(fixturePath) ? fixturePath : path.join(REPO_ROOT, fixturePath);
          const seed2 = JSON.parse(fs.readFileSync(absFix2, 'utf8'));
          const tw = parseInt(seed2.targetWordsPerChapter || seed2.chapterLength || '', 10);
          if (Number.isFinite(tw) && tw >= 500) chLen = tw;
        } catch (_) {}
      }
      if (Number.isFinite(envMax) && envMax >= 1000) maxTok = envMax;
      else if (fixturePath && chLen >= 2000) maxTok = Math.max(maxTok, 12000);
      report.config.chapterLength = chLen;
      report.config.maxTokens = maxTok;
      await page.evaluate(({ chLen, maxTok }) => {
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = String(val); };
        set('chapterLength', chLen);
        set('maxTokens', maxTok);
        novelData.chapterLength = chLen;
        novelData.maxTokens = maxTok;
      }, { chLen, maxTok });
    }
    appendProgress('### Phase - chapter plan\n- Status: ready\n- Eval: chaptersToGenerate=' + n + ' forceMultipass=' + report.config.forceMultipass + ' chapterLength=' + report.config.chapterLength + ' maxTokens=' + report.config.maxTokens + ' fixture=' + (fixturePath || 'none') + '\n');
  }

report.config.model = await page.evaluate(() => document.getElementById('model').value);

  async function doStep(tab, name, stepLabel, fn, evalFn, assertOpts) {
    const beforeSnap = await bookSnap(page);
    const beforeCalls = beforeSnap.totals.calls;
    const r = await runStep(page, tab, name, stepLabel, fn, evalFn);
    // HARD_STOP_ENRICH_STEP: enrich evaluate/throw must abort before outlines
    if (enrichMode && !r.ok && /enrichCharacters|enrichSubplots|enrichChapterBlueprints/.test(stepLabel)) {
      report.steps.push({ name: stepLabel, ok: false, status: 'fail', error: r.err });
      fs.writeFileSync(REPORT_JSON, JSON.stringify(Object.assign({}, report, { partial: true }), null, 2));
      throw new Error('ENRICH HARD-STOP [' + stepLabel + ']: ' + (r.err || 'failed'));
    }

    if (r.ok && assertOpts) {
      try {
        const contentLen = assertOpts.contentFromResult
          ? (r.result && (r.result.textLen != null ? r.result.textLen : r.result.len != null ? r.result.len : r.result.count))
          : (assertOpts.contentLen != null ? assertOpts.contentLen : null);
        assertApiStep(stepLabel, beforeCalls, r.after, {
          minChars: assertOpts.minChars || 0,
          contentLen: contentLen,
          allowNoCall: !!assertOpts.allowNoCall
        });
        if (typeof assertOpts.stageGate === 'function') {
          assertOpts.stageGate(r.result, r.after);
        }
      } catch (assertErr) {
        r.ok = false;
        r.err = assertErr.message;
        appendProgress('### Tab ' + tab + ' - ' + name + ' - ' + stepLabel + ' (assert)\n- Status: fail - ' + assertErr.message + '\n- Tokens this call / book cumulative: ' + tokLine(r.after, beforeCalls) + '\n- Eval: FAIL-CLOSED stage gate (empty/stub-thin/sloppy early input must not multiply into later stages).\n');
        writeStatus(tab, stepLabel, 'fail');
        // HARD_STOP_ENRICH_GATE: densify failures must not leak into outlines/chapters
        if (enrichMode && /enrichCharacters|enrichSubplots|enrichChapterBlueprints/.test(stepLabel)) {
          throw assertErr;
        }
      }
    }
    const skipped = r.ok && !!(r.result && r.result.skipped);
    const status = !r.ok ? 'fail' : (skipped ? 'skip' : 'pass');
    if (skipped) writeStatus(tab, stepLabel, 'skip');
    report.steps.push({ name: stepLabel, ok: skipped ? null : r.ok, status: status, error: r.err, reason: skipped ? (r.result.reason || null) : undefined });
    fs.writeFileSync(REPORT_JSON, JSON.stringify(Object.assign({}, report, {
      partial: true,
      bookTokenUsage: await page.evaluate(() => (typeof getSessionUsage === 'function' ? getSessionUsage() : null)),
      qualitySamples: await page.evaluate(() => (novelData.qualitySamples || []).slice())
    }), null, 2));
    return r;
  }

  const useFixture = !!fixturePath && !regenBible;

  await doStep(1, 'API & Story Info', 'c1Smoke', async () => {
    // Missing helper = skip (arrives with PR1). A false / passed:false result is a FAIL, never a pass.
    const c1 = await page.evaluate(async () => (typeof runC1Smoke === 'function' ? { present: true, value: await runC1Smoke() } : { present: false }));
    if (!c1.present) return { skipped: true, reason: 'runC1Smoke absent from this HTML (arrives with PR1)' };
    const v = c1.value;
    if (v === false || v == null || (typeof v === 'object' && v.passed === false)) {
      throw new Error('runC1Smoke returned ' + (v && typeof v === 'object' ? JSON.stringify(v).slice(0, 200) : String(v)));
    }
    return { passed: true };
  }, (a, r, ok, err) => (r && r.skipped)
    ? 'Skipped: ' + r.reason
    : (ok ? 'Local digest asserts passed (no full-manuscript dump). Packing path looks healthy for lean run.' : ('C1 smoke FAILED: ' + err)));

  await doStep(1, 'API & Story Info', 'fetchAuthors', async () => {
    return page.evaluate(async () => {
      await fetchAuthors();
      const sel = document.getElementById('authorStyle');
      const options = Array.from(sel.options || []).filter(o => o.value);
      if (options.length) {
        sel.value = options[0].value;
        if (typeof updateStyleGuide === 'function') updateStyleGuide();
      }
      return { author: sel.value, n: options.length };
    });
  }, (a, r) => 'Author pick: ' + ((r && r.author) || 'none') + ' (' + ((r && r.n) || 0) + ' options). Dropdown populated for genre=' + a.genre + '.');

  await doStep(1, 'API & Story Info', 'fetchStyleGuide', async () => {
    return page.evaluate(async () => {
      const author = (document.getElementById('authorStyle') || {}).value || '';
      if (!author) return { skipped: true };
      await fetchStyleGuide();
      return { author: author, len: ((document.getElementById('styleGuide') || {}).value || '').length };
    });
  }, (a, r) => (r && r.skipped) ? 'Skipped - no author set.' : ('Style guide length ' + ((r && r.len) || 0) + '. Prefer concrete craft notes over vague cheerleading.'));

  await doStep(1, 'API & Story Info', 'suggestStoryInfo', async () => {
    if (useFixture) return page.evaluate(() => ({ title: novelData.title || '', skipped: true, reason: 'fixture' }));
    return page.evaluate(async () => {
      await suggestStoryInfo();
      return { title: document.getElementById('title').value };
    });
  }, (a, r) => (r && r.skipped) ? ('Fixture title/arc reused: "' + (a.storyArcSnippet || a.title || '...') + '".') : ('Title/arc filled. Snippet: "' + (a.storyArcSnippet || '...') + '". Looking for concrete stakes vs stock openers.'), { minChars: 0, allowNoCall: true });

  await doStep(2, 'Characters', 'suggestCharacters', async () => {
    if (useFixture) return page.evaluate(() => ({ count: (novelData.characters || []).length, skipped: true }));
    return page.evaluate(async () => {
      await suggestCharacters();
      return { count: (novelData.characters || []).length };
    });
  }, (a, r) => (r && r.skipped) ? ('Fixture cast reused: ' + ((r && r.count) || a.chars) + ' characters.') : ('Got ' + ((r && r.count) || a.chars) + ' characters (target 3). Prefer named agents with concrete backstory.'), { allowNoCall: true });

  await doStep(3, 'Subplots', 'suggestSubplots', async () => {
    if (useFixture) {
      return page.evaluate(() => {
        const subs = novelData.subplots || [];
        const joined = subs.map((s) => {
          if (!s) return '';
          if (typeof s === 'string') return s;
          return String((s.title || s.name || '') + ': ' + (s.summary || s.description || ''));
        }).filter(Boolean).join('\n');
        const slop = (typeof scoreProseQuality === 'function' && joined.length >= 40)
          ? scoreProseQuality(joined)
          : { aiSlopRisk: joined.length ? 0 : 100, consistency: joined.length ? 50 : 0, notes: ['no-text'] };
        return { count: subs.length, skipped: true, joinedLen: joined.length, aiSlopRisk: slop.aiSlopRisk, consistency: slop.consistency, slopNotes: (slop.notes || []).slice(0, 4) };
      });
    }
    return page.evaluate(async () => {
      await suggestSubplots();
      const subs = novelData.subplots || [];
      const joined = subs.map((s) => typeof s === 'string' ? s : String((s && s.title) || '') + ': ' + String((s && s.summary) || '')).filter(Boolean).join('\n');
      const slop = (typeof scoreProseQuality === 'function' && joined.length >= 40)
        ? scoreProseQuality(joined)
        : { aiSlopRisk: 100, consistency: 0, notes: ['empty'] };
      return { count: subs.length, skipped: false, joinedLen: joined.length, aiSlopRisk: slop.aiSlopRisk, consistency: slop.consistency, slopNotes: (slop.notes || []).slice(0, 4) };
    });
  }, (a, r) => {
    const base = (r && r.skipped)
      ? ('Fixture subplots reused: ' + ((r && r.count) || a.subplots) + '.')
      : ('Subplots: ' + ((r && r.count) || a.subplots) + ' (target >=2).');
    return base + ' joinedLen=' + ((r && r.joinedLen) || 0) + ' slopRisk=' + ((r && r.aiSlopRisk) != null ? r.aiSlopRisk : '?') + ' consistency=' + ((r && r.consistency) != null ? r.consistency : '?') + '. Empty/stub/sloppy subplots fail-closed (they multiply into outlines/chapters).';
  }, {
    allowNoCall: true,
    stageGate: (res) => {
      assertStageGate('Tab3-subplots', [
        { ok: !!res && (res.count || 0) >= 2, msg: 'need >=2 subplots, got ' + ((res && res.count) || 0) },
        { ok: !!res && (res.joinedLen || 0) >= 80, msg: 'subplot text stub-thin joinedLen=' + ((res && res.joinedLen) || 0) + ' (empty/[object Object] wipe not allowed)' },
        { ok: !!res && (res.aiSlopRisk == null || res.aiSlopRisk <= 70), msg: 'subplot AI-slop risk too high: ' + ((res && res.aiSlopRisk)) + ' notes=' + ((res && res.slopNotes) || []).join(';') }
      ]);
    }
  });

  // Pass1 densify: when NW_E2E_ENRICH=1 or REGEN_BIBLE=1, run cast+subplot enrich (even on fixture).
  await doStep(2, 'Characters', 'enrichCharacters', async () => {
    if (!enrichMode) return page.evaluate(() => ({ skipped: true, reason: 'NW_E2E_ENRICH not set' }));
    return page.evaluate(async () => {
      if (typeof enrichCharacters !== 'function') return { error: 'enrichCharacters missing' };
      await enrichCharacters();
      const dens = scoreCastDensity(novelData.characters || [], { novelData });
      return { skipped: false, passed: dens.passed, failures: dens.failures, perChar: dens.perChar, floors: dens.floors };
    });
  }, (a, r) => (r && r.skipped)
    ? 'Enrich cast skipped (set NW_E2E_ENRICH=1 to densify).'
    : ('Cast enrich passed=' + !!(r && r.passed) + ' failures=' + ((r && r.failures) || []).slice(0, 4).join(';')), {
    allowNoCall: true,
    stageGate: (res) => {
      if (!enrichMode) return;
      assertStageGate('Tab2-enrich-cast', [
        { ok: !!res && !res.error, msg: 'enrichCharacters missing/error' },
        { ok: !!res && res.passed, msg: 'cast density fail-closed: ' + ((res && res.failures) || []).join(' | ') }
      ]);
    }
  });

  await doStep(3, 'Subplots', 'enrichSubplots', async () => {
    if (!enrichMode) return page.evaluate(() => ({ skipped: true, reason: 'NW_E2E_ENRICH not set' }));
    return page.evaluate(async () => {
      if (typeof enrichSubplots !== 'function') return { error: 'enrichSubplots missing' };
      await enrichSubplots();
      const dens = scoreSubplotDensity(novelData.subplots || [], { novelData });
      return { skipped: false, passed: dens.passed, failures: dens.failures, richCount: dens.richCount, floors: dens.floors, perSubplot: dens.perSubplot };
    });
  }, (a, r) => (r && r.skipped)
    ? 'Enrich subplots skipped (set NW_E2E_ENRICH=1 to densify).'
    : ('Subplot enrich passed=' + !!(r && r.passed) + ' rich=' + ((r && r.richCount) || 0) + ' failures=' + ((r && r.failures) || []).slice(0, 4).join(';')), {
    allowNoCall: true,
    stageGate: (res) => {
      if (!enrichMode) return;
      assertStageGate('Tab3-enrich-subplots', [
        { ok: !!res && !res.error, msg: 'enrichSubplots missing/error' },
        { ok: !!res && res.passed, msg: 'subplot density fail-closed (40-char stubs not rich): ' + ((res && res.failures) || []).join(' | ') },
        { ok: !!res && (res.perSubplot || []).every((p) => (p.words || 0) === 0 || (p.chars || 0) >= 40), msg: 'subplot still has <40-char stubs' }
      ]);
    }
  });

  await doStep(4, 'Outlines', 'generateNovelOutlines', async () => {
    // Always run macro outline agent (fixture previously skipped -> empty novelOutline/plotOutline/blueprints).
    return page.evaluate(async () => {
      await generateNovelOutlines();
      const richSubs = (novelData.subplots || []).filter((s) => {
        if (!s) return false;
        if (typeof s === 'string') return s.trim().length > 0;
        return !!(s.title || s.summary || s.description);
      });
      const novel = novelData.novelOutline || '';
      const plot = novelData.plotOutline || '';
      const arc = novelData.storyArcOutline || '';
      const pack = [novel, plot, arc].filter(Boolean).join('\n\n');
      const slop = (typeof scoreProseQuality === 'function' && pack.length >= 40)
        ? scoreProseQuality(pack)
        : { aiSlopRisk: 100, consistency: 0, notes: ['empty-macros'] };
      return {
        novel: novel.length,
        plot: plot.length,
        arc: arc.length,
        novelWords: novel.trim() ? novel.trim().split(/\s+/).length : 0,
        plotWords: plot.trim() ? plot.trim().split(/\s+/).length : 0,
        blueprints: Array.isArray(novelData.chapterBlueprints) ? novelData.chapterBlueprints.length : 0,
        subplots: richSubs.length,
        worldPacked: !!(novelData.worldBible || novelData.world),
        aiSlopRisk: slop.aiSlopRisk,
        consistency: slop.consistency,
        slopNotes: (slop.notes || []).slice(0, 5)
      };
    });
  }, (a, r) => 'Tab4 macros: novel/plot/arc lens ' + ((r && r.novel) || 0) + '/' + ((r && r.plot) || 0) + '/' + ((r && r.arc) || 0) + ' words~' + ((r && r.novelWords) || 0) + '/' + ((r && r.plotWords) || 0) + '; blueprints=' + ((r && r.blueprints) || 0) + '; subplots=' + ((r && r.subplots) || 0) + '; world=' + !!(r && r.worldPacked) + '; slopRisk=' + ((r && r.aiSlopRisk) != null ? r.aiSlopRisk : '?') + ' consistency=' + ((r && r.consistency) != null ? r.consistency : '?') + '. Empty/stub macros fail-closed.', {
    stageGate: (res) => {
      assertStageGate('Tab4-generateNovelOutlines', [
        { ok: !!res && (res.novel || 0) >= 400, msg: 'novelOutline stub-thin len=' + ((res && res.novel) || 0) },
        { ok: !!res && (res.plot || 0) >= 400, msg: 'plotOutline stub-thin/empty len=' + ((res && res.plot) || 0) + ' (must not proceed to chapters with empty plot)' },
        { ok: !!res && (res.arc || 0) >= 300, msg: 'storyArcOutline stub-thin len=' + ((res && res.arc) || 0) },
        { ok: !!res && (res.subplots || 0) >= 2, msg: 'subplots missing at macro stage count=' + ((res && res.subplots) || 0) },
        { ok: !!res && (res.blueprints || 0) >= 1, msg: 'chapterBlueprints missing (macro spine incomplete)' },
        { ok: !worldGate || (!!res && res.worldPacked === true), msg: 'worldBible not packed/present for macro stage' },
        { ok: !!res && (res.aiSlopRisk == null || res.aiSlopRisk <= 65), msg: 'macro outline AI-slop risk too high: ' + (res && res.aiSlopRisk) + ' notes=' + ((res && res.slopNotes) || []).join(';') },
        { ok: !!res && (res.consistency == null || res.consistency >= 35), msg: 'macro outline consistency too low: ' + (res && res.consistency) }
      ]);
    }
  });

  await doStep(4, 'Outlines', 'generateChapterOutline1', async () => {
    return page.evaluate(async () => {
      await generateChapterOutline(1);
      const outline = novelData.chapterOutlines[0] || '';
      const arc = (novelData.chapterArcs && novelData.chapterArcs[0]) || '';
      const words = outline.trim() ? outline.trim().split(/\s+/).length : 0;
      const pack = (outline + '\n' + arc).trim();
      const slop = (typeof scoreProseQuality === 'function' && pack.length >= 40)
        ? scoreProseQuality(pack)
        : { aiSlopRisk: 100, consistency: 0, notes: ['empty-ch-outline'] };
      return {
        len: outline.length,
        words,
        arcLen: arc.length,
        hasWorldHookHint: /Bitung|Conduit|Lofoten|Seattle|bridge|faction|dock|location|world/i.test(outline + ' ' + arc),
        hasNamedBeat: /\b(Kwan|Rook|Sinta|Okafor|Yen|Theo|Cassian|Mireya|Aoi)\b/i.test(outline + ' ' + arc) || /\b[A-Z][a-z]+\b.*\b(beat|realiz|confront|decid|discover)/i.test(outline),
        aiSlopRisk: slop.aiSlopRisk,
        consistency: slop.consistency,
        slopNotes: (slop.notes || []).slice(0, 5)
      };
    });
  }, (a, r) => 'Tab4 Ch1 outline: len=' + ((r && r.len) || 0) + ' words~' + ((r && r.words) || 0) + ' arcLen=' + ((r && r.arcLen) || 0) + ' worldHint=' + !!(r && r.hasWorldHookHint) + ' namedBeat=' + !!(r && r.hasNamedBeat) + ' slopRisk=' + ((r && r.aiSlopRisk) != null ? r.aiSlopRisk : '?') + ' consistency=' + ((r && r.consistency) != null ? r.consistency : '?') + '. Target >=300w; fail-closed if stub/sloppy.', {
    stageGate: (res) => {
      assertStageGate('Tab4-generateChapterOutline1', [
        { ok: !!res && (res.words || 0) >= 180, msg: 'Ch1 outline stub-thin words=' + ((res && res.words) || 0) + ' (floor 180; target 300)' },
        { ok: !!res && (res.arcLen || 0) >= 200, msg: 'Ch1 arc stub-thin len=' + ((res && res.arcLen) || 0) },
        { ok: !!res && !!res.hasWorldHookHint, msg: 'Ch1 outline missing world/location hooks (world packing not reflected)' },
        { ok: !!res && (res.aiSlopRisk == null || res.aiSlopRisk <= 65), msg: 'Ch1 outline AI-slop risk too high: ' + (res && res.aiSlopRisk) + ' notes=' + ((res && res.slopNotes) || []).join(';') },
        { ok: !!res && (res.consistency == null || res.consistency >= 35), msg: 'Ch1 outline consistency too low: ' + (res && res.consistency) }
      ]);
    }
  });

  // Pass3: outline refine / incorporate (obligations) when enrich mode on - once after macros / ch1
  await doStep(4, 'Outlines', 'outlineRefine', async () => {
    if (!enrichMode) return page.evaluate(() => ({ skipped: true }));
    return page.evaluate(async () => {
      const notes = [
        'Name cast members and active subplots in novel/plot/arc outlines.',
        'Ensure world/location hooks and conflict->resolution beats are explicit.',
        'Preserve chapterBlueprints subplotPressure and characterBeats.'
      ].join(' ');
      const box = document.getElementById('outlineImprovements');
      if (box) box.value = notes;
      if (typeof incorporateOutlineSuggestions === 'function') {
        await incorporateOutlineSuggestions();
      } else if (typeof updateChapterOutline === 'function') {
        await updateChapterOutline(1);
      }
      const obl = scoreOutlineObligations(novelData);
      const ready = scoreAdvanceToTab5Readiness(novelData);
      return { skipped: false, obligations: obl, readiness: { passed: ready.passed, failures: ready.failures.slice(0, 8) } };
    });
  }, (a, r) => (r && r.skipped)
    ? 'Outline refine skipped (enrich mode off).'
    : ('Outline refine obligations passed=' + !!(r && r.obligations && r.obligations.passed) + ' readiness=' + !!(r && r.readiness && r.readiness.passed)), {
    allowNoCall: true,
    stageGate: (res) => {
      if (!enrichMode) return;
      assertStageGate('Tab4-outline-refine', [
        { ok: !!res && res.obligations && res.obligations.passed, msg: 'outline obligations missing: ' + (((res && res.obligations && res.obligations.failures) || []).join(' | ')) },
      ]);
    }
  });

  // Outlines + generates for chapters 2..N (ch1 outline already done above when present)
  const chaptersToGenerate = report.config.chaptersToGenerate || report.config.numChapters || 2;

  // Ensure ch1 outline exists (lean path already ran generateChapterOutline1)
  for (let ch = 2; ch <= chaptersToGenerate; ch++) {
  await doStep(4, 'Outlines', 'generateChapterOutline' + ch, async () => {
      return page.evaluate(async (chapterNum) => {
        await generateChapterOutline(chapterNum);
        const outline = novelData.chapterOutlines[chapterNum - 1] || '';
        const words = outline.trim() ? outline.trim().split(/\s+/).length : 0;
        const slop = (typeof scoreProseQuality === 'function' && outline.length >= 40)
          ? scoreProseQuality(outline)
          : { aiSlopRisk: 100, consistency: 0, notes: ['empty'] };
        return { len: outline.length, words, chapter: chapterNum, aiSlopRisk: slop.aiSlopRisk, consistency: slop.consistency, slopNotes: (slop.notes || []).slice(0, 4) };
      }, ch);
    }, (a, r) => 'Tab4 Ch' + ch + ' outline: len=' + ((r && r.len) || 0) + ' words~' + ((r && r.words) || 0) + ' slopRisk=' + ((r && r.aiSlopRisk) != null ? r.aiSlopRisk : '?') + '.', {
      stageGate: (res) => {
        assertStageGate('Tab4-generateChapterOutline' + ch, [
          { ok: !!res && (res.words || 0) >= 150, msg: 'Ch' + ch + ' outline stub-thin words=' + ((res && res.words) || 0) },
          { ok: !!res && (res.aiSlopRisk == null || res.aiSlopRisk <= 70), msg: 'Ch' + ch + ' outline AI-slop risk too high: ' + (res && res.aiSlopRisk) }
        ]);
      }
    });
  }

  // A3-fix: densify chapter blueprint beats (six obligations) before Tab5 readiness when enrich mode on
  await doStep(4, 'Outlines', 'enrichChapterBlueprints', async () => {
    if (!enrichMode) return page.evaluate(() => ({ skipped: true, reason: 'NW_E2E_ENRICH not set' }));
    return page.evaluate(async () => {
      if (typeof enrichChapterBlueprints !== 'function') return { error: 'enrichChapterBlueprints missing' };
      const cap = Number(novelData.numChapters) || Math.max((novelData.chapterBlueprints || []).length, 1);
      const before = (typeof scoreBeatCoverage === 'function') ? scoreBeatCoverage(novelData, { chapterCap: cap }) : null;
      try {
        const after = await enrichChapterBlueprints();
        return {
          skipped: false,
          beforePassed: !!(before && before.passed),
          afterPassed: !!(after && after.passed),
          failures: (after && after.failures || []).slice(0, 8),
          perChapter: (after && after.perChapter || []).slice(0, 8)
        };
      } catch (e) {
        const mid = (typeof scoreBeatCoverage === 'function') ? scoreBeatCoverage(novelData, { chapterCap: cap }) : null;
        return {
          error: String(e && e.message || e),
          beforePassed: !!(before && before.passed),
          afterPassed: !!(mid && mid.passed),
          failures: (mid && mid.failures || []).slice(0, 8)
        };
      }
    });
  }, (a, r) => (r && r.skipped)
    ? 'Blueprint beat enrich skipped (enrich mode off).'
    : ('Blueprint beat enrich passed=' + !!(r && r.afterPassed) + ' fails=' + (((r && r.failures) || []).join(' | ') || 'none')), {
    allowNoCall: true,
    stageGate: (res) => {
      if (!enrichMode) return;
      assertStageGate('Tab4-enrichChapterBlueprints', [
        { ok: !!res && !res.error && res.afterPassed, msg: 'enrichChapterBlueprints failed: ' + ((res && res.error) || ((res && res.failures) || []).join(' | ')) }
      ]);
    }
  });

  // Fail-closed readiness before Tab5 burn: fixture stubs (~6-7% of floors) need NW_E2E_ENRICH=1 or REGEN_BIBLE=1.
  {
    const readySnap = hasHelper('scoreAdvanceToTab5Readiness')
      ? await page.evaluate(() => scoreAdvanceToTab5Readiness(novelData))
      : { passed: true, skipped: true, failures: [], reason: 'scoreAdvanceToTab5Readiness absent from this HTML (arrives with PR1)' };
    report.config.tab5Readiness = readySnap;
    appendProgress('### Tab5 readiness\n- passed: ' + !!readySnap.passed + (readySnap.skipped ? ' (skipped: ' + readySnap.reason + ')' : '') + '\n- failures: ' + ((readySnap.failures || []).slice(0, 8).join(' | ') || 'none') + '\n- enrichMode: ' + enrichMode + '\n');
    if (!readySnap.passed && process.env.NW_E2E_OUTLINE_ONLY !== '1') {
      const msg = 'TAB5 READINESS FAIL-CLOSED before chapter burn: ' + (readySnap.failures || []).slice(0, 8).join(' | ') +
        '. Re-run with NW_E2E_ENRICH=1 (or NW_E2E_REGEN_BIBLE=1) so densify path runs; do not accept stub cast/subplots.';
      if (enrichMode) {
        throw new Error(msg + ' (enrichMode was on but readiness still red)');
      }
      throw new Error(msg);
    }
  }

  if (process.env.NW_E2E_OUTLINE_ONLY === '1') {
    report.config.outlineOnly = true;
    const outlineProof = await page.evaluate(() => {
      const richSubs = (novelData.subplots || []).filter((s) => {
        if (!s) return false;
        if (typeof s === 'string') return s.trim().length > 0;
        return !!(s.title || s.summary || s.description);
      });
      const ch1 = (novelData.chapterOutlines || [])[0] || '';
      return {
        novelOutlineLen: (novelData.novelOutline || '').length,
        plotOutlineLen: (novelData.plotOutline || '').length,
        storyArcOutlineLen: (novelData.storyArcOutline || '').length,
        blueprints: Array.isArray(novelData.chapterBlueprints) ? novelData.chapterBlueprints.length : 0,
        subplots: richSubs.length,
        subplot0: richSubs[0] ? (typeof richSubs[0] === 'string' ? richSubs[0].slice(0, 100) : ((richSubs[0].title || '') + ': ' + (richSubs[0].summary || '')).slice(0, 100)) : '',
        ch1OutlineLen: ch1.length,
        ch1Words: ch1.trim() ? ch1.trim().split(/\s+/).length : 0,
        worldBible: !!(novelData.worldBible || novelData.world),
        lastPromptHasWorld: String(requestLog && requestLog.lastPrompt || '').includes('World Bible')
      };
    });
    report.outlineProof = outlineProof;
    // Also score early-spine slop for outline-only runs (stop multiplication even without prose).
    const earlyPack = await page.evaluate(() => {
      const pack = [novelData.novelOutline || '', novelData.plotOutline || '', (novelData.chapterOutlines || [])[0] || ''].join('\n\n');
      const slop = (typeof scoreProseQuality === 'function' && pack.trim().length >= 40)
        ? scoreProseQuality(pack)
        : { aiSlopRisk: 100, consistency: 0, notes: ['empty'] };
      return { aiSlopRisk: slop.aiSlopRisk, consistency: slop.consistency, slopNotes: (slop.notes || []).slice(0, 5) };
    });
    outlineProof.aiSlopRisk = earlyPack.aiSlopRisk;
    outlineProof.consistency = earlyPack.consistency;
    outlineProof.slopNotes = earlyPack.slopNotes;
    let outlineOnlyOk = true;
    let outlineOnlyErr = null;
    try {
      assertStageGate('outline-only-proof', [
        { ok: outlineProof.novelOutlineLen >= 400, msg: 'novelOutline stub-thin ' + outlineProof.novelOutlineLen },
        { ok: outlineProof.plotOutlineLen >= 400, msg: 'plotOutline stub-thin/empty ' + outlineProof.plotOutlineLen },
        { ok: outlineProof.subplots >= 2, msg: 'subplots empty ' + outlineProof.subplots },
        { ok: outlineProof.ch1Words >= 180, msg: 'ch1 outline stub-thin words=' + outlineProof.ch1Words },
        { ok: !worldGate || outlineProof.worldBible, msg: 'worldBible missing' },
        { ok: outlineProof.blueprints >= 1, msg: 'chapterBlueprints missing' },
        { ok: !worldGate || outlineProof.lastPromptHasWorld, msg: 'chapter outline prompt missing World Bible packing' },
        { ok: earlyPack.aiSlopRisk == null || earlyPack.aiSlopRisk <= 65, msg: 'early outline AI-slop risk too high: ' + earlyPack.aiSlopRisk + ' notes=' + (earlyPack.slopNotes || []).join(';') }
      ]);
    } catch (e) {
      outlineOnlyOk = false;
      outlineOnlyErr = e.message;
    }
    appendProgress('### Phase - outline-only proof\n- Status: ' + (outlineOnlyOk ? 'ok' : 'fail') + (outlineOnlyErr ? (' - ' + outlineOnlyErr) : '') + '\n- Eval: novel=' + outlineProof.novelOutlineLen + ' plot=' + outlineProof.plotOutlineLen + ' arc=' + outlineProof.storyArcOutlineLen + ' bp=' + outlineProof.blueprints + ' subplots=' + outlineProof.subplots + ' ch1words=' + outlineProof.ch1Words + ' world=' + outlineProof.worldBible + ' promptWorld=' + outlineProof.lastPromptHasWorld + ' slopRisk=' + outlineProof.aiSlopRisk + ' consistency=' + outlineProof.consistency + ' sample=\"' + String(outlineProof.subplot0 || '').replace(/\n/g, ' ') + '\"\n');
    report.steps.push({ tab: 5, name: 'outline-only-skip', stage: 'Chapters', ok: outlineOnlyOk, status: outlineOnlyOk ? 'pass' : 'fail', error: outlineOnlyErr, eval: outlineOnlyOk ? 'Skipped prose generation (outline-only); early-stage gates passed.' : ('outline-only gates failed: ' + outlineOnlyErr) });
    if (!outlineOnlyOk) throw new Error(outlineOnlyErr || 'outline-only stage gates failed');
  }

  // Item 3: optionally seed continuity + raise gate bar so pass1 gate-fail + pass2 continuity fire
  if (report.config.forceMultipass) {
    await page.evaluate(() => {
      novelData.continuityFindings = novelData.continuityFindings || [];
      if (!novelData.continuityFindings.length) {
        novelData.continuityFindings.push('Chapter 1: timeline drift on dock clocks (E2E force multipass)');
      }
      if (!novelData.continuityTracker) novelData.continuityTracker = { chapters: [], characterArcProgress: [], storyArcProgress: {} };
      novelData.continuityTracker.chapters = novelData.continuityTracker.chapters || [];
      novelData.continuityTracker.chapters[0] = {
        chapter: 1,
        continuityRisks: ['Unnamed child status restated without update (E2E force multipass)']
      };
      if (typeof NW_QUALITY_GATE === 'object' && NW_QUALITY_GATE) {
        window.__NW_GATE_BACKUP = Object.assign({}, NW_QUALITY_GATE);
        // High bar so first draft fails closed -> pass1 revise; continuity still open -> pass2
        NW_QUALITY_GATE.minInterest = Math.max(NW_QUALITY_GATE.minInterest || 0, 92);
        NW_QUALITY_GATE.minHumanLikeness = Math.max(NW_QUALITY_GATE.minHumanLikeness || 0, 90);
      }
      window.__NW_FORCE_MULTIPASS = true;
    });
    appendProgress('### Phase - force multipass\n- Status: seeded\n- Eval: continuity findings + raised gate thresholds for Ch1\n');
  }

  // Hard product rule: never write chapters on empty/stub/sloppy early spine (plot/subplots/outlines/world).
  {
    const spine = await page.evaluate(() => {
      const richSubs = (novelData.subplots || []).filter((s) => {
        if (!s) return false;
        if (typeof s === 'string') return s.trim().length >= 40;
        return !!(s.title || s.name) && !!(s.summary || s.description);
      });
      const novel = novelData.novelOutline || '';
      const plot = novelData.plotOutline || '';
      const ch1 = (novelData.chapterOutlines || [])[0] || '';
      const pack = [novel, plot, ch1].filter(Boolean).join('\n\n');
      const slop = (typeof scoreProseQuality === 'function' && pack.length >= 40)
        ? scoreProseQuality(pack)
        : { aiSlopRisk: 100, consistency: 0, notes: ['empty-spine'] };
      return {
        subplots: richSubs.length,
        novelLen: novel.length,
        plotLen: plot.length,
        ch1Words: ch1.trim() ? ch1.trim().split(/\s+/).length : 0,
        world: !!(novelData.worldBible || novelData.world),
        blueprints: Array.isArray(novelData.chapterBlueprints) ? novelData.chapterBlueprints.length : 0,
        aiSlopRisk: slop.aiSlopRisk,
        consistency: slop.consistency,
        slopNotes: (slop.notes || []).slice(0, 5)
      };
    });
    try {
      assertStageGate('pre-prose-spine', [
        { ok: spine.subplots >= 2, msg: 'subplots empty/stub before prose count=' + spine.subplots },
        { ok: spine.plotLen >= 400, msg: 'plotOutline empty/stub before prose len=' + spine.plotLen },
        { ok: spine.novelLen >= 400, msg: 'novelOutline empty/stub before prose len=' + spine.novelLen },
        { ok: spine.ch1Words >= 180, msg: 'Ch1 outline stub-thin before prose words=' + spine.ch1Words },
        { ok: !worldGate || spine.world, msg: 'worldBible missing before prose' },
        { ok: (spine.blueprints || 0) >= 1, msg: 'chapterBlueprints missing before prose bp=' + spine.blueprints },
        { ok: spine.aiSlopRisk == null || spine.aiSlopRisk <= 65, msg: 'early-spine AI-slop risk too high before prose: ' + spine.aiSlopRisk + ' notes=' + (spine.slopNotes || []).join(';') }
      ]);
      appendProgress('### Phase - pre-prose spine gate\n- Status: ok\n- Eval: subplots=' + spine.subplots + ' plot=' + spine.plotLen + ' novel=' + spine.novelLen + ' ch1words=' + spine.ch1Words + ' bp=' + spine.blueprints + ' world=' + spine.world + ' slopRisk=' + spine.aiSlopRisk + ' consistency=' + spine.consistency + '. Early inputs dense enough to avoid multiplying slop into chapters.\n');
      report.preProseSpine = spine;
    } catch (gateErr) {
      appendProgress('### Phase - pre-prose spine gate\n- Status: fail\n- Eval: ' + gateErr.message + '\n');
      report.steps.push({ tab: 5, name: 'pre-prose-spine-gate', stage: 'Chapters', ok: false, status: 'fail', error: gateErr.message });
      report.preProseSpine = spine;
      throw gateErr;
    }
  }

  if (!report.config.outlineOnly) {
  // Prove Tab5 Draft pack binds chapterBlueprints + digests (no API burn).
  const draftPackHelpers = ['buildGenerateChapterUserContent', 'scoreObligationCoverage', 'getPlotDigestText', 'getSettingDigestText'];
  const draftPackMissing = draftPackHelpers.filter((n) => !hasHelper(n));
  await doStep(5, 'Generate Chapters', 'draftPack-blueprint-bind', async () => {
    if (draftPackMissing.length) return { skipped: true, reason: 'helpers absent (PR1): ' + draftPackMissing.join(', ') };
    return page.evaluate(() => {
      if (typeof buildGenerateChapterUserContent !== 'function') {
        throw new Error('buildGenerateChapterUserContent missing');
      }
      if (typeof scoreObligationCoverage !== 'function') {
        throw new Error('scoreObligationCoverage missing');
      }
      if (typeof getPlotDigestText !== 'function' || typeof getSettingDigestText !== 'function') {
        throw new Error('plot/setting digest helpers missing');
      }
      const pack = buildGenerateChapterUserContent(1, 1, {});
      const need = [
        'Chapter Blueprint (obligations JSON)',
        'OBLIGATION CHECKLIST',
        'arcStep',
        'characterBeats',
        'subplotPressure',
        'worldHooks',
        'allowedPayoffs',
        'deferredThreads',
        'ObligationRetrieve'
      ];
      const missing = need.filter((k) => pack.indexOf(k) < 0);
      if (missing.length) throw new Error('Draft pack missing blueprint fields: ' + missing.join(','));
      if (/~700-900 words/.test(pack) || /~400-word atmospheric/.test(pack)) {
        throw new Error('Draft pack still has pad-style word quotas');
      }
      // Digests must not prefer empty generalPlot/setting when plotOutline/worldBible exist
      const plotDig = getPlotDigestText(320);
      const setDig = getSettingDigestText(280);
      const plotSrc = String(novelData.plotOutline || novelData.generalPlot || '');
      const hasWb = !!(novelData.worldBible || novelData.world);
      if (plotSrc.length >= 80 && (!plotDig || plotDig === 'No plot provided' || plotDig.length < 40)) {
        throw new Error('plot digest empty despite plotOutline/generalPlot');
      }
      if (!String(novelData.setting || '').trim() && hasWb && (!setDig || setDig === 'No setting provided')) {
        throw new Error('setting digest empty despite worldBible');
      }
      // Coverage gate exists: score a deliberately empty text -> must fail
      const emptyCov = scoreObligationCoverage('', 1);
      if (emptyCov.passed) throw new Error('coverage gate false-passed on empty prose');
      // Score against blueprint with synthetic prose containing beat names
      const bp = (typeof getChapterBlueprint === 'function') ? getChapterBlueprint(1) : null;
      const names = ((bp && bp.characterBeats) || []).map((b) => (b && b.name) || '').filter(Boolean);
      const hooks = (bp && bp.worldHooks) || [];
      const synth = ['The arc unfolds.', ...names, ...hooks, String((bp && bp.arcStep) || ''), String(((bp && bp.subplotPressure) || [])[0] || '')].join(' ');
      const synthCov = scoreObligationCoverage(synth + ' ' + synth, 1);
      return {
        packChars: pack.length,
        plotDigChars: (plotDig || '').length,
        setDigChars: (setDig || '').length,
        emptyPassed: !!emptyCov.passed,
        emptyFailures: (emptyCov.failures || []).slice(0, 6),
        synthRatio: synthCov.ratio,
        synthPassed: !!synthCov.passed,
        synthHits: (synthCov.hits || []).slice(0, 8),
        hasBlueprint: !!bp,
        helpers: ['buildGenerateChapterUserContent', 'scoreObligationCoverage', 'getPlotDigestText', 'getSettingDigestText']
      };
    });
  }, (a, r) => {
    // runStep calls evalFn(after, result) - result is 2nd arg
    if (r && r.skipped) return 'Skipped: ' + r.reason;
    if (!r || !r.hasBlueprint) return 'FAIL: no chapter blueprint for Ch1';
    if (r.emptyPassed) return 'FAIL: empty coverage must fail-closed';
    return 'packChars=' + r.packChars + ' plotDig=' + r.plotDigChars + ' setDig=' + r.setDigChars +
      ' emptyFail=' + (r.emptyFailures || []).join(',') + ' synthRatio=' + r.synthRatio +
      ' synthHits=' + (r.synthHits || []).join('|');
  }, {
    allowNoCall: true,
    stageGate: (result) => {
      if (result && result.skipped) return;
      if (!result || !result.hasBlueprint) throw new Error('draftPack-blueprint-bind: no chapter blueprint for Ch1');
      if (result.emptyPassed) throw new Error('draftPack-blueprint-bind: empty coverage must fail-closed');
    }
  });

  // B4-1A: arm foul-inject before Tab5 generate so ensureQualityAfterGenerate nest sees foul text
  if (slopInjectOn) {
    appendProgress('### Phase - B4-1A slop inject armed\n- Status: ready\n- Eval: span=' + slopInjectSpanName + ' targetCh=' + slopInjectChapter + ' afterContinuity=' + (report.config.slopInject.afterContinuity) + ' chars=' + slopInjectSpanText.length + '\n');
    await page.evaluate(({ spanText, spanName, targetChapter, afterContinuity }) => {
      window.__NW_E2E_SLOP_INJECT = {
        enabled: true,
        spanText: spanText,
        spanName: spanName,
        targetChapter: targetChapter,
        afterContinuity: afterContinuity !== false,
        applied: false
      };
    }, {
      spanText: slopInjectSpanText,
      spanName: slopInjectSpanName,
      targetChapter: slopInjectChapter,
      afterContinuity: report.config.slopInject.afterContinuity
    });
  }

  await doStep(5, 'Generate Chapters', 'generateChapter1+quality', async () => {
    return page.evaluate(async () => {
      await generateChapter(1);
      const text = novelData.chapters[0] || '';
      if (!text || text.trim().length < 50) throw new Error('generateChapter(1) produced empty/short text len=' + text.length);
      const heur = scoreProseQuality(text);
      pushQualitySample('chapter1-heuristics', heur, text.length);
      let judged = null;
      const align = novelData.lastJudgeGateAlignment || null;
      if (align && align.judgeScores) {
        judged = align.judgeScores;
      } else if (typeof judgeProseQualityLLM === 'function') {
        judged = await judgeProseQualityLLM(text, document.getElementById('tab5') || document.getElementById('tab1'));
        pushQualitySample('chapter1-llmJudge', judged, text.length);
        if (typeof alignJudgeWithGate === 'function' && novelData.lastQualityGate) {
          alignJudgeWithGate(novelData.lastQualityGate, judged, { label: 'chapter1-generate-e2e' });
        }
      }
      const gate = novelData.lastQualityGate || null;
      const reviseLog = (novelData.qualityReviseLog || []).slice();
      const multi = (novelData.qualityMultiPassLog || []).slice();
      const alignNow = novelData.lastJudgeGateAlignment || align;
      // restore gate thresholds after Ch1 multipass attempt
      if (window.__NW_GATE_BACKUP && typeof NW_QUALITY_GATE === 'object') {
        Object.assign(NW_QUALITY_GATE, window.__NW_GATE_BACKUP);
        window.__NW_GATE_BACKUP = null;
      }
      const cov = novelData.lastObligationCoverage || null;
      return {
        textLen: text.length,
        heur: heur,
        judged: judged ? {
          interest: judged.interest,
          readability: judged.readability,
          aiSlopRisk: judged.aiSlopRisk,
          humanLikeness: judged.humanLikeness,
          source: judged.source,
          rationale: (judged.rationale || '').slice(0, 180)
        } : null,
        gatePassed: gate ? !!gate.passed : null,
        gateFailures: gate && gate.failures ? gate.failures.slice(0, 6) : [],
        reviseAttempts: reviseLog.length,
        multiPassLog: multi,
        multiPassCount: multi.length,
        judgeAligned: alignNow ? alignNow.aligned : null,
        judgeDivergences: alignNow && alignNow.divergences ? alignNow.divergences.slice() : [],
        gateDriver: gate && gate.driver,
        obligationCoverage: cov ? {
          passed: !!cov.passed,
          ratio: cov.ratio,
          covered: cov.covered,
          total: cov.total,
          words: cov.words,
          failures: (cov.failures || []).slice(0, 6),
          misses: (cov.misses || []).slice(0, 8)
        } : null
      };
    });
  }, (a, r) => {
    const j = r && r.judged;
    const h = r && r.heur;
    const hs = h ? [h.interest, h.readability, h.aiSlopRisk, h.humanLikeness].join('/') : '?';
    const js = j ? [j.interest, j.readability, j.aiSlopRisk, j.humanLikeness].join('/') + ' (' + j.source + ')' : 'n/a';
    const gp = r && r.gatePassed;
    const ra = r && r.reviseAttempts;
    const mc = r && r.multiPassCount;
    const al = r && r.judgeAligned;
    const div = (r && r.judgeDivergences && r.judgeDivergences.length) ? r.judgeDivergences.join(',') : 'none';
    const kinds = (r && r.multiPassLog) ? r.multiPassLog.map(x => 'p' + x.pass + ':' + x.kind).join(',') : '';
    return 'Ch1 ' + ((r && r.textLen) || a.ch1Len) + ' chars. Heuristics interest/read/slop/human=' + hs + '. LLM judge=' + js + '. Gate=' + gp + ' driver=' + (r && r.gateDriver) + ' reviseLog=' + ra + ' multiPass=' + mc + '(' + kinds + ') judgeAlign=' + al + ' diverge=' + div + '.';
  }, { minChars: 200, contentFromResult: true });

  for (let ch = 2; ch <= chaptersToGenerate; ch++) {
    await doStep(5, 'Generate Chapters', 'generateChapter' + ch + '+quality', async () => {
      return page.evaluate(async (chapterNum) => {
        await generateChapter(chapterNum);
        const text = novelData.chapters[chapterNum - 1] || '';
        if (!text || text.trim().length < 50) throw new Error('generateChapter(' + chapterNum + ') produced empty/short text len=' + text.length);
        const heur = scoreProseQuality(text);
        pushQualitySample('chapter' + chapterNum + '-heuristics', heur, text.length);
        const multi = (novelData.qualityMultiPassLog || []).filter(e => e && e.chapter === chapterNum);
        return { textLen: text.length, heur: heur, chapter: chapterNum, multiPassCount: multi.length };
      }, ch);
    }, (a, r) => {
      const h = r && r.heur;
      const hs = h ? [h.interest, h.readability, h.aiSlopRisk, h.humanLikeness].join('/') : '?';
      return 'Ch' + ch + ' ' + ((r && r.textLen) || 0) + ' chars. Heuristics ' + hs + '. multiPassCh=' + ((r && r.multiPassCount) || 0) + '.';
    }, { minChars: 200, contentFromResult: true });
  }

  // B4-1A: harvest inject / anti-slop evidence from live nest
  if (slopInjectOn) {
    const injEv = await page.evaluate(() => {
      const inj = novelData.lastSlopInject || null;
      const cfg = window.__NW_E2E_SLOP_INJECT || null;
      const multi = (novelData.qualityMultiPassLog || []).slice();
      const anti = multi.filter(e => e && e.kind === 'anti-slop');
      return {
        inject: inj,
        cfgApplied: !!(cfg && cfg.applied),
        cfgPhase: cfg && cfg.appliedPhase,
        multiPassLog: multi,
        antiSlopCount: anti.length,
        antiSlopEntries: anti
      };
    });
    report.slopInjectEvidence = injEv;
    appendProgress('### Phase - B4-1A slop inject evidence\n- Status: ' + (injEv.cfgApplied ? 'applied' : 'NOT-applied') + '\n- Eval: anti-slop=' + injEv.antiSlopCount + ' phase=' + (injEv.cfgPhase || '?') + ' preFail=' + ((injEv.inject && injEv.inject.preTellFailures) || []).join('|') + ' postFail=' + ((injEv.inject && injEv.inject.postTellFailures) || []).join('|') + '\n');
  }

  await doStep(6, 'Edit Chapters', 'applyStagedChapterImprovements1', async () => {
    return page.evaluate(async () => {
      if (typeof showTab === 'function') showTab(6);
      if (typeof applyStagedChapterImprovements !== 'function') throw new Error('applyStagedChapterImprovements missing - refresh live HTML');
      const editEl = document.getElementById('chapterEditContent1');
      if (!editEl) throw new Error('chapterEditContent1 missing');
      if (!editEl.value && novelData.chapters[0]) editEl.value = novelData.chapters[0];
      if (typeof stageChapterImprovement === 'function') {
        stageChapterImprovement(1, 'Tighten opening; add one concrete sensory detail; keep near target length.', { mode: 'replace', source: 'e2e-staged' });
      } else {
        const improvEl = document.getElementById('chapterEditImprovement1');
        if (improvEl) improvEl.value = 'Tighten opening; add one concrete sensory detail; keep near target length.';
      }
      const before = scoreProseQuality(novelData.chapters[0] || '');
      const out = await applyStagedChapterImprovements(1);
      const text = novelData.chapters[0] || '';
      const heur = (out && out.afterScores) || scoreProseQuality(text);
      return { textLen: text.length, heur: heur, before: before, delta: out && out.afterScores ? {
        interest: out.afterScores.interest - before.interest,
        readability: out.afterScores.readability - before.readability,
        aiSlopRisk: out.afterScores.aiSlopRisk - before.aiSlopRisk,
        humanLikeness: out.afterScores.humanLikeness - before.humanLikeness
      } : null };
    });
  }, (a, r) => {
    const h = r && r.heur;
    const hs = h ? [h.interest, h.readability, h.aiSlopRisk, h.humanLikeness].join('/') : '?';
    const d = r && r.delta;
    const ds = d ? (' delta i/r/s/h=' + [d.interest, d.readability, d.aiSlopRisk, d.humanLikeness].join('/')) : '';
    return 'Applied staged Ch1 improvements (' + a.ch1Len + ' chars). Scores ' + hs + ds + '.';
  }, { minChars: 200, contentFromResult: true });

  await doStep(6, 'Edit Chapters', 'reviseChapterForQuality1', async () => {
    return page.evaluate(async () => {
      if (typeof reviseChapterForQuality !== 'function') throw new Error('reviseChapterForQuality missing - refresh live HTML');
      const prior = (novelData.qualityReviseLog || []).slice();
      const autoRevise = prior.length > 0;
      let result;
      if (autoRevise) {
        const gate = runQualityGate(novelData.chapters[0] || '', { label: 'chapter1-e2e-postAutoRevise' });
        result = { revised: false, skipped: true, reason: 'auto-revise already ran during generate', attempts: prior.length, gateAfter: gate, gateBefore: prior[prior.length - 1] };
      } else {
        const scores = scoreProseQuality(novelData.chapters[0] || '');
        const fakeFail = { passed: false, failures: ['e2e-forced-revise-exercise', 'aiSlopRisk>=55'], scores: Object.assign({}, scores, { aiSlopRisk: Math.max(60, scores.aiSlopRisk || 0) }) };
        result = await reviseChapterForQuality(1, fakeFail, { maxAttempts: 1 });
        result.skipped = false;
        result.reason = 'forced revise to exercise QE2 path';
      }
      return {
        skipped: !!result.skipped,
        reason: result.reason || '',
        attempts: result.attempts || 0,
        passedBefore: result.gateBefore ? !!result.gateBefore.passed : null,
        passedAfter: result.gateAfter ? !!result.gateAfter.passed : null,
        reviseLogLen: (novelData.qualityReviseLog || []).length,
        textLen: (novelData.chapters[0] || '').length
      };
    });
  }, (a, r) => {
    return 'QE2 revise: skipped=' + (r && r.skipped) + ' reason=' + ((r && r.reason) || '') + ' attempts=' + ((r && r.attempts) || 0) + ' gate ' + (r && r.passedBefore) + '->' + (r && r.passedAfter) + ' log=' + (r && r.reviseLogLen) + '.';
  }, { minChars: 200, contentFromResult: true, allowNoCall: true });

  await doStep(7, 'Book', 'suggestBookImprovements', async () => {
    return page.evaluate(async () => {
      if (typeof showTab === 'function') showTab(7);
      const pack = typeof buildPromptContextPack === 'function' ? buildPromptContextPack({ includePacket: false }) : null;
      const packChars = pack ? ((pack._approxChars) || JSON.stringify(pack).length) : null;
      requestLog.contextPackChars = packChars;
      await suggestBookImprovements();
      return { packChars: packChars, improvements: (novelData.bookImprovements || []).length, withStatus: (novelData.bookImprovementsWithStatus || []).length };
    });
  }, (a, r) => 'Book critique returned ' + ((r && r.improvements) || 0) + ' items; packChars=' + (r && r.packChars) + '. Should use digests (not full dump).', { minChars: 0 });

  await doStep(7, 'Book', 'applyTopBookCritique', async () => {
    return page.evaluate(async () => {
      if (typeof applyTopBookCritiques !== 'function') throw new Error('applyTopBookCritiques missing - refresh live HTML');
      const pending = (novelData.bookImprovementsWithStatus || []).filter(x => x && x.status === 'To Incorporate' && String(x.text || '').trim());
      if (!pending.length) throw new Error('No To Incorporate critique items to apply');
      const before = scoreProseQuality(novelData.chapters[0] || '');
      const out = await applyTopBookCritiques(1);
      const applied = (out && out.applied) || [];
      if (!applied.length) throw new Error('applyTopBookCritiques returned zero applied');
      const a0 = applied[0];
      return {
        appliedCount: applied.length,
        chapter: a0.chapter,
        before: before,
        after: a0.afterScores,
        delta: a0.item && a0.item.applyDelta,
        status: a0.item && a0.item.status,
        critiqueApplyLog: (novelData.critiqueApplyLog || []).length
      };
    });
  }, (a, r) => {
    const d = r && r.delta;
    const ds = d ? [d.interest, d.readability, d.aiSlopRisk, d.humanLikeness].join('/') : '?';
    return 'Applied top critique to Ch.' + (r && r.chapter) + ' status=' + (r && r.status) + ' delta i/r/s/h=' + ds + ' log=' + (r && r.critiqueApplyLog) + '.';
  }, { minChars: 200, contentFromResult: true });

  } // end outlineOnly skip of chapter generation

  const pageUsage = await page.evaluate(() => (typeof getSessionUsage === 'function' ? getSessionUsage() : null));
  const finalUsage = pageUsage || netUsage();
  const finalQuality = await page.evaluate(() => (typeof getSessionQuality === 'function'
    ? getSessionQuality()
    : { source: 'novelData.qualitySamples', samples: (novelData.qualitySamples || []).slice() }));
  // Unexpected page errors fail the run; only the exact #130 rAF race is exempt (counted in report.knownPageErrors).
  if (pageErrors.length) {
    report.steps.push({ name: 'pageErrors', ok: false, status: 'fail', error: pageErrors.length + ' unexpected page error(s): ' + pageErrors.slice(0, 3).join(' | ') });
  }
  report.ok = !report.steps.some(stepFailed);
  report.finishedAt = new Date().toISOString();
  report.bookTokenUsage = finalUsage;
  report.sessionUsage = finalUsage;
  report.sessionQuality = finalQuality;
  report.qualitySamples = finalQuality.samples || [];
  report.summary = {
    callCount: (finalUsage.calls || []).length,
    totals: {
      prompt_tokens: finalUsage.prompt_tokens,
      completion_tokens: finalUsage.completion_tokens,
      total_tokens: finalUsage.total_tokens
    },
    contextPackCharsSum: finalUsage.contextPackCharsSum,
    failedSteps: report.steps.filter(stepFailed).map(s => s.name),
    skippedSteps: report.steps.filter(s => s.status === 'skip').map(s => s.name),
    leanConfig: report.config
  };
  report.network = {
    calls: netCalls.length,
    blockedRequests: blockedRequests.slice(0, 50),
    blockedCount: blockedRequests.length
  };
  if (offline) {
    report.offline.rules = offline.log.map((l) => l.rule);
    report.offline.unmatched = offline.unmatched.slice();
  }
  delete report.partial;

  // Snapshot sanitized novelData for Annex E
  const annexNovel = await page.evaluate(() => {
    const nd = (typeof novelData !== 'undefined' && novelData) ? novelData : {};
    const clone = JSON.parse(JSON.stringify(nd));
    // strip secrets / huge binary-ish if any; keep story content
    if (clone.apiKey) delete clone.apiKey;
    if (clone.GROK_API_KEY) delete clone.GROK_API_KEY;
    if (clone.XAI_API_KEY) delete clone.XAI_API_KEY;
    return clone;
  });
  report.annexNovelDataMeta = {
    title: annexNovel.title || '',
    genre: annexNovel.genre || '',
    characters: (annexNovel.characters || []).length,
    subplots: (annexNovel.subplots || []).length,
    subplotSample: (function () {
      const s = (annexNovel.subplots || [])[0];
      if (!s) return '';
      if (typeof s === 'string') return s.slice(0, 80);
      return String((s.title || '') + ': ' + (s.summary || '')).slice(0, 80);
    })(),
    novelOutlineLen: (annexNovel.novelOutline || '').length,
    plotOutlineLen: (annexNovel.plotOutline || '').length,
    storyArcOutlineLen: (annexNovel.storyArcOutline || '').length,
    chapterBlueprintCount: Array.isArray(annexNovel.chapterBlueprints) ? annexNovel.chapterBlueprints.length : 0,
    ch1OutlineLen: ((annexNovel.chapterOutlines || [])[0] || '').length,
    chapters: (annexNovel.chapters || []).map(c => (c || '').length),
    hasTokenUsage: !!(annexNovel.tokenUsage && annexNovel.tokenUsage.calls),
    hasQuality: !!(annexNovel.qualitySamples && annexNovel.qualitySamples.length)
  };
  fs.writeFileSync(ANNEX_JSON, JSON.stringify(annexNovel, null, 2));

  const calls = (finalUsage && finalUsage.calls) ? finalUsage.calls : [];
  // Per-stage rollup (by originTab + operationName)
  const byStage = {};
  for (const c of calls) {
    const stage = (c.originTab || 'unknown') + ' / ' + (c.operationName || 'unnamed');
    if (!byStage[stage]) {
      byStage[stage] = { stage: stage, originTab: c.originTab || '', operationName: c.operationName || '', count: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    }
    byStage[stage].count += 1;
    byStage[stage].prompt_tokens += (c.prompt_tokens || 0);
    byStage[stage].completion_tokens += (c.completion_tokens || 0);
    byStage[stage].total_tokens += (c.total_tokens || 0);
  }
  report.tokensByStage = Object.values(byStage);
  report.tokensByPrompt = calls.map((c, i) => ({
    i: i + 1,
    operationName: c.operationName || '',
    originTab: c.originTab || '',
    model: c.model || '',
    prompt_tokens: c.prompt_tokens || 0,
    completion_tokens: c.completion_tokens || 0,
    total_tokens: c.total_tokens || 0,
    contextPackChars: c.contextPackChars == null ? null : c.contextPackChars,
    ts: c.ts || null
  }));

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));

  const mdLines = [
    '# Tracked E2E Report (lean)',
    '',
    '- Finished: ' + report.finishedAt,
    '- OK: ' + report.ok,
    '- Mode: ' + MODE + (MODE === 'offline' ? ' (fixture responder; no paid calls)' : ''),
    '- Config: ' + report.config.numChapters + ' chapters / ' + report.config.chapterLength + ' words / ' + report.config.numCharacters + ' chars / ' + report.config.minSubplots + ' subplots / model=' + report.config.model,
    '- Calls: ' + report.summary.callCount,
    '- Book tokens prompt/comp/total: ' + report.summary.totals.prompt_tokens + '/' + report.summary.totals.completion_tokens + '/' + report.summary.totals.total_tokens,
    '- Failed steps: ' + (report.summary.failedSteps.join(', ') || 'none'),
    '- Skipped steps: ' + (report.summary.skippedSteps.join(', ') || 'none'),
    '',
    '## Cost / efficiency (tokens) - not quality',
    '',
    'Token usage is a cost/efficiency product metric. Quality scores are separate (below).',
    '',
    '### Per prompt (each LLM call)',
    '',
    '| # | Stage (tab) | Operation / prompt | Prompt | Completion | Total | Pack chars |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: |'
  ];
  for (const c of report.tokensByPrompt) {
    mdLines.push('| ' + c.i + ' | ' + c.originTab + ' | ' + c.operationName + ' | ' + c.prompt_tokens + ' | ' + c.completion_tokens + ' | ' + c.total_tokens + ' | ' + (c.contextPackChars == null ? '-' : c.contextPackChars) + ' |');
  }
  mdLines.push('');
  mdLines.push('### Per stage rollup');
  mdLines.push('');
  mdLines.push('| Stage | Calls | Prompt | Completion | Total |');
  mdLines.push('| --- | ---: | ---: | ---: | ---: |');
  for (const s of report.tokensByStage) {
    mdLines.push('| ' + s.stage + ' | ' + s.count + ' | ' + s.prompt_tokens + ' | ' + s.completion_tokens + ' | ' + s.total_tokens + ' |');
  }
  mdLines.push('');
  mdLines.push('### Book rollup');
  mdLines.push('');
  mdLines.push('- prompt/comp/total: **' + report.summary.totals.prompt_tokens + ' / ' + report.summary.totals.completion_tokens + ' / ' + report.summary.totals.total_tokens + '**');
  mdLines.push('- calls: **' + report.summary.callCount + '**');
  mdLines.push('');
  mdLines.push('## Quality samples (prose - separate from tokens)');
  for (const s of report.qualitySamples) {
    mdLines.push('- ' + s.label + ': interest=' + s.interest + ' readability=' + s.readability + ' aiSlopRisk=' + s.aiSlopRisk + ' humanLikeness=' + s.humanLikeness + ' (' + s.source + ')');
  }
  mdLines.push('');
  mdLines.push('## Annexes');
  mdLines.push('');
  mdLines.push('- Canonical human deliverable after builder: `TRACKED_E2E_REPORT_YYYY-MM-DD_HHMMSS.md` (+ `TRACKED_E2E_REPORT_LATEST.md` copy)');
  mdLines.push('- Optional sidecar: `TRACKED_E2E_ANNEX_NOVELDATA.json`');
  mdLines.push('- `TRACKED_E2E_TOKENS_BY_STAGE.md` - tokens-only view');
  mdLines.push('- `TRACKED_E2E_REPORT.json` - machine-readable (includes tokensByPrompt / tokensByStage)');
  fs.writeFileSync(REPORT_MD_LATEST, mdLines.join('\n') + '\n');

  // Tokens-only companion
  const tokMd = [
    '# Tracked E2E - tokens by stage / prompt',
    '',
    'Cost/efficiency only. Not quality.',
    '',
    'Book: ' + report.summary.totals.prompt_tokens + '/' + report.summary.totals.completion_tokens + '/' + report.summary.totals.total_tokens + ' (' + report.summary.callCount + ' calls)',
    '',
    '## Per prompt',
    ''
  ];
  for (const c of report.tokensByPrompt) {
    tokMd.push('- #' + c.i + ' [' + c.originTab + '] ' + c.operationName + ': ' + c.prompt_tokens + '/' + c.completion_tokens + '/' + c.total_tokens);
  }
  tokMd.push('');
  tokMd.push('## Per stage rollup');
  tokMd.push('');
  for (const s of report.tokensByStage) {
    tokMd.push('- ' + s.stage + ' (x' + s.count + '): ' + s.prompt_tokens + '/' + s.completion_tokens + '/' + s.total_tokens);
  }
  fs.writeFileSync(TOKENS_MD, tokMd.join('\n') + '\n');

  // Do not write TRACKED_E2E_ANNEXES.md - book annexes live only in the dated TRACKED_E2E_REPORT_<stamp>.md (+ LATEST copy).
  if (fs.existsSync(ANNEX_MD)) {
    fs.unlinkSync(ANNEX_MD);
  }


  appendProgress(
    '### Phase - lean E2E - final\n' +
    '- Status: ' + (report.ok ? 'pass' : 'partial/fail') + '\n' +
    '- Tokens this call / book cumulative: - / book ' + report.summary.totals.prompt_tokens + '/' + report.summary.totals.completion_tokens + '/' + report.summary.totals.total_tokens + ' (' + report.summary.callCount + ' calls)\n' +
    '- Eval: Lean run finished. Failed=[' + (report.summary.failedSteps.join(', ') || 'none') + ']. Dated report via builder (TRACKED_E2E_REPORT_<stamp>.md).\n'
  );

  // Build the single-file dated report. A failed build marks the run incomplete (exit 4), never a silent pass.
  report.reportBuild = buildUnifiedReport();
  if (!report.reportBuild.ok) {
    report.incomplete = true;
    report.ok = false;
    fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
    markLatestIncomplete(report.reportBuild.error);
    appendProgress('### Phase - unified report\n- Status: FAIL\n- Eval: ' + report.reportBuild.error + '\n');
  } else {
    // The builder rewrote REPORT_JSON (adds cost); merge the build result into that file instead of overwriting it.
    try {
      const built = JSON.parse(fs.readFileSync(REPORT_JSON, 'utf8'));
      built.reportBuild = report.reportBuild;
      fs.writeFileSync(REPORT_JSON, JSON.stringify(built, null, 2));
    } catch (e) {
      report.reportBuild = { ok: false, error: 'report JSON unreadable after build: ' + e.message };
      report.incomplete = true;
      report.ok = false;
      fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
      markLatestIncomplete(report.reportBuild.error);
    }
  }
  if (report.reportBuild.ok) {
    appendProgress('### Phase - unified report\n- Status: pass\n- Eval: Dated TRACKED_E2E_REPORT_<stamp>.md (+ LATEST copy) regenerated as single-file deliverable.\n');
  }

  writeStatus(7, 'final', report.ok ? 'pass' : 'fail');

  await browser.close();
  browser = null;
  console.log(JSON.stringify({
    ok: report.ok,
    mode: MODE,
    calls: report.summary.callCount,
    totals: report.summary.totals,
    failed: report.summary.failedSteps,
    reportBuild: report.reportBuild,
    outDir: OUT_DIR
  }, null, 2));
  const stepsOk = !report.steps.some(stepFailed);
  process.exit(!stepsOk ? 2 : (!report.reportBuild.ok ? 4 : 0));
})().catch(async (err) => {
  // Close the browser on the fatal path too, so a thrown gate never leaves Chromium running.
  if (browser) { try { await browser.close(); } catch (_) {} browser = null; }
  appendProgress('### Phase - tracked E2E - fatal\n- Status: fail\n- Eval: ' + String(err && err.message || err).slice(0, 300) + '\n');
  try {
    fs.writeFileSync(REPORT_JSON, JSON.stringify(Object.assign({}, report, { ok: false, fatal: String(err && err.message || err), network: { calls: netCalls.length, blockedRequests: blockedRequests.slice(0, 50) }, offline: offline ? Object.assign({}, report.offline, { unmatched: offline.unmatched.slice() }) : undefined }), null, 2));
  } catch (_) {}
  writeStatus(0, 'fatal', 'fail');
  console.error(err);
  process.exit(1);
});
