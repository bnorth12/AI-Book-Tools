/**
 * B4-1A lean foul-inject prove-out (minimal LLM burn).
 * Loads B3R annex into live NovelWriter, arms NW inject span, runs ensureQualityAfterGenerate
 * on target chapter so detect→anti-slop nest is exercised without full Tab1–5 regen.
 *
 * LIVE: spends LLM tokens. Needs an xAI key in NW_ENV_FILE (default secrets/xai.local.env,
 * var XAI_API_KEY; GROK_API_KEY accepted). Writes evidence JSON only to NW_OUT_DIR.
 * Offline harness check (no key, no LLM): NW_B4_PRECHECK_ONLY=1 stops after the in-page preCheck.
 *
 * Env:
 *   NW_HTML_PATH             NovelWriter.html under test (default: this checkout's NovelWriter/NovelWriter.html)
 *   NW_ENV_FILE              dotenv file with XAI_API_KEY (default secrets/xai.local.env)
 *   NW_FIXTURES_DIR          fixtures (default scripts/fixtures/nw_slop: b3r_seed.json + inject_spans/)
 *   NW_OUT_DIR               evidence output (default out/nw-smoke, gitignored)
 *   NW_E2E_SLOP_INJECT_SPAN  basename or path (default span_b3r_ch2_overexplain.txt)
 *   NW_E2E_SLOP_INJECT_CHAPTER  default 2
 *   NW_E2E_SLOP_INJECT_AFTER_CONTINUITY  default 1 (set 0 to inject immediately)
 */
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { fileURLToPath, pathToFileURL } from 'url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const HTML_PATH = path.resolve(process.env.NW_HTML_PATH || path.join(REPO_ROOT, 'NovelWriter', 'NovelWriter.html'));
const HTML_URL = pathToFileURL(HTML_PATH).href;
const ENV = path.resolve(process.env.NW_ENV_FILE || path.join(REPO_ROOT, 'secrets', 'xai.local.env'));
const FIXTURES = path.resolve(process.env.NW_FIXTURES_DIR || path.join(SCRIPT_DIR, 'fixtures', 'nw_slop'));
const OUT_DIR = path.resolve(process.env.NW_OUT_DIR || path.join(REPO_ROOT, 'out', 'nw-smoke'));
const SPANS = path.join(FIXTURES, 'inject_spans');
const ANNEX = path.resolve(process.env.NW_E2E_SEED || path.join(FIXTURES, 'b3r_seed.json'));
const PRECHECK_ONLY = process.env.NW_B4_PRECHECK_ONLY === '1';
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT_JSON = path.join(OUT_DIR, PRECHECK_ONLY ? 'B4_1A_INJECT_PRECHECK.json' : 'B4_1A_INJECT_PROVE.json');
if (!fs.existsSync(HTML_PATH)) {
  console.error('NovelWriter.html not found:', HTML_PATH);
  process.exit(1);
}

let apiKey = '';
if (!PRECHECK_ONLY) {
  dotenv.config({ path: ENV });
  apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY || '';
  if (!apiKey) {
    console.error('XAI_API_KEY missing (env or', ENV + '). Set NW_B4_PRECHECK_ONLY=1 for the offline harness check.');
    process.exit(1);
  }
}

const spanEnv = (process.env.NW_E2E_SLOP_INJECT_SPAN || 'span_b3r_ch2_overexplain.txt').trim();
const spanPath = path.isAbsolute(spanEnv)
  ? spanEnv
  : (fs.existsSync(path.join(SPANS, spanEnv)) ? path.join(SPANS, spanEnv) : path.resolve(spanEnv));
if (!fs.existsSync(spanPath)) {
  console.error('span not found', spanPath);
  process.exit(1);
}
const spanText = fs.readFileSync(spanPath, 'utf8');
const spanName = path.basename(spanPath);
const targetChapter = parseInt(process.env.NW_E2E_SLOP_INJECT_CHAPTER || '2', 10) || 2;
const afterContinuity = process.env.NW_E2E_SLOP_INJECT_AFTER_CONTINUITY !== '0';

const annexRaw = JSON.parse(fs.readFileSync(ANNEX, 'utf8'));
// Annex may be novelData root or wrapped
const seed = annexRaw.novelData && typeof annexRaw.novelData === 'object' && !Array.isArray(annexRaw.chapters)
  ? annexRaw.novelData
  : annexRaw;

console.log(JSON.stringify({
  spanName, spanLen: spanText.length, targetChapter, afterContinuity,
  annexChapters: (seed.chapters || []).map(c => (c || '').length),
  annexTitle: seed.title || ''
}, null, 2));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(600000);
page.on('console', msg => {
  const t = msg.text();
  if (/B4-1A|anti-slop|QE5|QE2|slop inject|BOUNDED_REVISE/i.test(t)) console.log('[browser]', t);
});

await page.goto(HTML_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof ensureQualityAfterGenerate === 'function' && typeof scoreSlopTells === 'function' && typeof applyE2eSlopInject === 'function');

await page.evaluate(({ key, seedObj, spanText, spanName, targetChapter, afterContinuity }) => {
  document.getElementById('apiKey').value = key;
  const modelSel = document.getElementById('model');
  if (modelSel) {
    const opts = Array.from(modelSel.options || []);
    const g47 = opts.find(o => /grok-4\.7/i.test(o.value) || /grok-4\.7/i.test(o.textContent || ''));
    const fast = opts.find(o => /fast-non-reasoning/i.test(o.value));
    if (g47) modelSel.value = g47.value;
    else if (fast) modelSel.value = fast.value;
  }
  if (typeof resetBookTokenUsage === 'function') resetBookTokenUsage();

  // Seed annex fields (skip secrets / notes)
  Object.keys(seedObj).forEach((k) => {
    if (k === 'notes' || k === 'fixtureId' || k === 'apiKey' || k === 'GROK_API_KEY') return;
    novelData[k] = seedObj[k];
  });
  // Clear prior multipass / inject state for clean prove-out
  novelData.qualityMultiPassLog = [];
  novelData.qualityReviseLog = [];
  novelData.lastSlopInject = null;
  novelData.qualityJudgeEveryChapter = false;
  // Clear continuity findings so inject can land pre-nest and anti-slop gets budget under maxAutoPasses=2
  if (novelData.continuityFindings && typeof novelData.continuityFindings === 'object') {
    novelData.continuityFindings = {};
  }
  if (novelData.continuityTracker && novelData.continuityTracker.chapters) {
    novelData.continuityTracker.chapters = {};
  }
  novelData.autoContinuityAudit = false;

  const set = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
  set('title', novelData.title);
  set('genre', novelData.genre || 'scifi');
  set('numChapters', Math.max(Number(novelData.numChapters) || 5, (novelData.chapters || []).filter(Boolean).length, targetChapter));
  set('chapterLength', novelData.chapterLength || 900);
  set('maxTokens', Math.max(parseInt(novelData.maxTokens || '0', 10) || 0, 8000));
  novelData.numChapters = parseInt(document.getElementById('numChapters').value, 10);
  novelData.maxTokens = parseInt(document.getElementById('maxTokens').value, 10);

  if (typeof updateChapterSubpages === 'function') updateChapterSubpages();
  // Push chapter texts into edit DOM
  (novelData.chapters || []).forEach((ch, i) => {
    const n = i + 1;
    const edit = document.getElementById('chapterEditContent' + n);
    const gen = document.getElementById('chapterGenContent' + n);
    if (edit) edit.value = ch || '';
    if (gen) gen.value = ch || '';
  });
  if (typeof renderCharacters === 'function') renderCharacters();
  else if (typeof syncCharacterEntries === 'function') syncCharacterEntries();
  if (typeof renderSubplots === 'function') renderSubplots();
  else if (typeof syncSubplotEntries === 'function') syncSubplotEntries();
  if (typeof collectData === 'function') collectData();

  window.__NW_E2E_SLOP_INJECT = {
    enabled: true,
    spanText: spanText,
    spanName: spanName,
    targetChapter: targetChapter,
    afterContinuity: !!afterContinuity,
    applied: false
  };
}, { key: apiKey, seedObj: seed, spanText, spanName, targetChapter, afterContinuity });

// Offline-equivalent pre-check inside page (base + foul, before nest)
const preCheck = await page.evaluate(({ targetChapter, spanText }) => {
  const idx = targetChapter - 1;
  const base = (novelData.chapters && novelData.chapters[idx]) || '';
  const combined = base ? (base.replace(/\s+$/, '') + '\n\n' + spanText) : spanText;
  const prior = (targetChapter >= 2 && Array.isArray(novelData.chapters))
    ? novelData.chapters.slice(0, idx).filter(t => String(t || '').trim())
    : [];
  const tell = scoreSlopTells(combined, prior.length ? { priorChapters: prior } : undefined);
  const cont = (typeof getChapterContinuityFindings === 'function')
    ? getChapterContinuityFindings(targetChapter)
    : null;
  return {
    baseLen: base.length,
    combinedLen: combined.length,
    tellPassed: !!tell.passed,
    failures: (tell.failures || []).slice(),
    tellScores: Object.fromEntries(Object.entries(tell.tells || {}).map(([k, v]) => [k, { ok: v.ok, score: v.score }])),
    continuityHasAny: !!(cont && cont.hasAny),
    helpers: {
      applyE2eSlopInject: typeof applyE2eSlopInject === 'function',
      ensureQualityAfterGenerate: typeof ensureQualityAfterGenerate === 'function',
      scoreSlopTells: typeof scoreSlopTells === 'function'
    }
  };
}, { targetChapter, spanText });
console.log('preCheck', JSON.stringify(preCheck, null, 2));
if (preCheck.tellPassed) {
  console.error('FAIL: injected span+base did not foul detectors pre-nest');
  fs.writeFileSync(OUT_JSON, JSON.stringify({ ok: false, reason: 'detectors-miss-span', preCheck, spanName }, null, 2));
  await browser.close();
  process.exit(1);
}
if (PRECHECK_ONLY) {
  const ok = !preCheck.tellPassed && preCheck.helpers.applyE2eSlopInject && preCheck.helpers.ensureQualityAfterGenerate && preCheck.helpers.scoreSlopTells;
  fs.writeFileSync(OUT_JSON, JSON.stringify({ ok, mode: 'precheck-only', spanName, targetChapter, preCheck }, null, 2));
  console.log(ok ? 'B4-1A PRECHECK PASS (offline; no LLM call made)' : 'B4-1A PRECHECK FAIL');
  await browser.close();
  process.exit(ok ? 0 : 1);
}

console.log('Running ensureQualityAfterGenerate(', targetChapter, ') …');
const nestResult = await page.evaluate(async (chapterNum) => {
  const beforeMulti = (novelData.qualityMultiPassLog || []).length;
  let result = null;
  let err = null;
  try {
    result = await ensureQualityAfterGenerate(chapterNum);
  } catch (e) {
    err = String(e && e.message ? e.message : e);
  }
  const inj = novelData.lastSlopInject || null;
  const multi = (novelData.qualityMultiPassLog || []).slice(beforeMulti);
  const anti = multi.filter(e => e && e.kind === 'anti-slop');
  const usage = (typeof getSessionUsage === 'function') ? getSessionUsage() : (novelData.tokenUsage || {});
  return {
    err,
    result: result ? {
      passesDone: result.passesDone,
      multiPass: result.multiPass,
      gatePassed: result.gate && result.gate.passed
    } : null,
    inject: inj,
    multiPassLog: multi,
    antiSlopCount: anti.length,
    antiSlopEntries: anti,
    usage: {
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      total_tokens: usage.total_tokens || 0,
      calls: (usage.calls || []).length
    },
    cfg: window.__NW_E2E_SLOP_INJECT ? {
      applied: !!window.__NW_E2E_SLOP_INJECT.applied,
      appliedPhase: window.__NW_E2E_SLOP_INJECT.appliedPhase,
      preInjectLen: window.__NW_E2E_SLOP_INJECT.preInjectLen,
      postInjectLen: window.__NW_E2E_SLOP_INJECT.postInjectLen
    } : null
  };
}, targetChapter);

const evidence = {
  ok: false,
  when: new Date().toISOString(),
  spanName,
  spanFile: spanName,
  targetChapter,
  afterContinuity,
  preCheck,
  nest: nestResult,
  criteria: {
    detectorsFoulPre: !preCheck.tellPassed,
    injectApplied: !!(nestResult.cfg && nestResult.cfg.applied) || !!(nestResult.inject && nestResult.inject.phase),
    antiSlopGe1: (nestResult.antiSlopCount || 0) >= 1,
    postImprovedOrDocumented: false
  }
};

const preFails = (nestResult.inject && nestResult.inject.preTellFailures) || preCheck.failures || [];
const postFails = (nestResult.inject && nestResult.inject.postTellFailures) || null;
const preScores = (nestResult.inject && nestResult.inject.preTellScores) || preCheck.tellScores;
const postScores = (nestResult.inject && nestResult.inject.postTellScores) || null;

function worstTellScore(scores) {
  if (!scores) return null;
  let worst = 0;
  for (const k of Object.keys(scores)) {
    const s = scores[k];
    if (s && s.ok === false && typeof s.score === 'number') worst = Math.max(worst, s.score);
  }
  return worst;
}
const preWorst = worstTellScore(preScores);
const postWorst = worstTellScore(postScores);
const improved = (postWorst != null && preWorst != null && postWorst < preWorst)
  || (postFails && preFails && postFails.length < preFails.length)
  || (nestResult.inject && nestResult.inject.postTellPassed === true && nestResult.inject.preTellPassed === false);
const residualDocumented = (nestResult.antiSlopCount || 0) >= 1 && postFails && postFails.length > 0
  && (nestResult.result && nestResult.result.passesDone >= 1);
evidence.criteria.postImprovedOrDocumented = !!(improved || residualDocumented);
evidence.scoreCompare = { preWorst, postWorst, preFails, postFails, improved, residualDocumented };

evidence.ok = evidence.criteria.detectorsFoulPre
  && evidence.criteria.injectApplied
  && evidence.criteria.antiSlopGe1
  && evidence.criteria.postImprovedOrDocumented;

fs.writeFileSync(OUT_JSON, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({
  ok: evidence.ok,
  criteria: evidence.criteria,
  scoreCompare: evidence.scoreCompare,
  antiSlopCount: nestResult.antiSlopCount,
  multiKinds: (nestResult.multiPassLog || []).map(e => e.kind),
  injectPhase: nestResult.inject && nestResult.inject.phase,
  usage: nestResult.usage,
  err: nestResult.err
}, null, 2));

await browser.close();
process.exit(evidence.ok ? 0 : 1);
