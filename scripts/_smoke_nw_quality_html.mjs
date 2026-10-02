/**
 * PR2 offline in-page smoke (no LLM, no API key): loads THIS checkout's NovelWriter.html in headless
 * Chromium and runs the C3 / QE1-6 smokes plus the anti-slop helpers. Asserts every smoke PASSes and
 * that the smokes leave novelData (chapters, characters, continuity, quality logs) unchanged.
 * Usage: node scripts/_smoke_nw_quality_html.mjs   (see scripts/README.md)
 * Env: NW_HTML_PATH (default NovelWriter/NovelWriter.html), NW_OUT_DIR (default out/nw-smoke)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const HTML_PATH = path.resolve(process.env.NW_HTML_PATH || path.join(REPO_ROOT, 'NovelWriter', 'NovelWriter.html'));
const OUT_DIR = path.resolve(process.env.NW_OUT_DIR || path.join(REPO_ROOT, 'out', 'nw-smoke'));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e && e.message ? e.message : e)));
page.on('dialog', d => d.dismiss().catch(() => {}));
await page.goto(pathToFileURL(HTML_PATH).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof runQe6Smoke === 'function' && typeof scoreSlopTells === 'function');

const result = await page.evaluate(async () => {
  // Seed a "user" book so state-clobbering is detectable.
  novelData.numChapters = 2;
  novelData.chapters = ['User chapter one prose that must survive.', 'User chapter two.'];
  novelData.chapterImprovements = ['user note 1', ''];
  novelData.characters = [{ name: 'Real User Lead', role: 'lead', backstory: 'kept', arc: 'kept' }];
  novelData.continuityFindings = ['user finding'];
  novelData.continuityTracker = { chapters: [{ chapter: 1, continuityRisks: ['user risk'] }], characterArcProgress: [], storyArcProgress: {} };
  if (typeof updateChapterSubpages === 'function') updateChapterSubpages();
  const snap = () => JSON.stringify({
    chapters: novelData.chapters, chapterImprovements: novelData.chapterImprovements, characters: novelData.characters,
    continuityFindings: novelData.continuityFindings, continuityTracker: novelData.continuityTracker,
    qualitySamples: novelData.qualitySamples, qualityMultiPassLog: novelData.qualityMultiPassLog,
    lastQualityGate: novelData.lastQualityGate
  });
  const before = snap();
  const out = {};
  for (const fn of ['runC3Smoke', 'runQe123Smoke', 'runQe4Smoke', 'runQe5Smoke', 'runQe6Smoke']) {
    try { out[fn] = await window[fn](); } catch (e) { out[fn] = 'THREW ' + (e && e.message ? e.message : e); }
  }
  const after = snap();
  const helpers = ['scoreProseQuality', 'runQualityGate', 'scoreSlopTells', 'buildAntiSlopReviseBrief', 'needsQualityMultiPass',
    'runTargetedQualityPass', 'reviseChapterForQuality', 'guardChapterReviseGrowth', 'applyE2eSlopInject', 'ensureQualityAfterGenerate',
    'applyBookCritiqueItem', 'applyTopBookCritiques', 'applyStagedChapterImprovements'].filter(n => typeof window[n] !== 'function' && typeof eval(n) !== 'function');
  // B5-0 offline scorer is the snippet; the HTML nameEcho mirror is PR5, so only check detector shape here.
  const tell = scoreSlopTells('Kwan told Kwan that Kwan would not sign what Kwan had refused.');
  // growth guard reverts runaway growth
  const base = Array(10).fill('A paragraph of ordinary prose that is long enough to count here.').join('\n\n');
  novelData.chapters[0] = base + ' x'.repeat(4000);
  const g = guardChapterReviseGrowth(1, base, novelData.chapters[0], { source: 'smoke' });
  const reverted = g.reverted === true && novelData.chapters[0] === base;
  return { out, unchanged: before === after, missingHelpers: helpers, nameEchoFoul: !tell.tells.nameEcho.ok, tells: Object.keys(tell.tells), guardReverted: reverted };
});
await browser.close();

const fails = [];
for (const [k, v] of Object.entries(result.out)) if (v !== true) fails.push(k + ' -> ' + v);
if (!result.unchanged) fails.push('smokes mutated novelData (state not restored)');
if (result.missingHelpers.length) fails.push('missing helpers: ' + result.missingHelpers.join(','));
if (!result.nameEchoFoul) fails.push('nameEcho narration should foul');
if (result.tells.length !== 7) fails.push('expected 7 tells, got ' + result.tells.join(','));
if (!result.guardReverted) fails.push('guardChapterReviseGrowth did not revert runaway growth');
if (pageErrors.length) fails.push('page errors: ' + pageErrors.join(' | '));
const report = { ok: fails.length === 0, fails, html: path.relative(REPO_ROOT, HTML_PATH).split(path.sep).join('/'), ...result };
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'NW_QUALITY_HTML_SMOKE.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.ok) { console.error('NW QUALITY HTML SMOKE FAIL'); process.exit(1); }
console.log('NW QUALITY HTML SMOKE PASS');