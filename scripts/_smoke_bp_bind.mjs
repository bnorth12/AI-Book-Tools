/**
 * Lean smoke: blueprint bind + digests + coverage gate (no chapter API burn).
 * Uses rich annex fixture seeded into novelData.
 */
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import dotenv from 'dotenv';

const PLAN = 'C:/Users/brian/grok-build-queue/plans/ai-book-tools-2026-09-27/novelwriter';
const LIVE = 'file:///C:/NovelWriterSite/NovelWriter/NovelWriter.html';
const ENV = 'C:/NovelWriterSite/.env';
const ANNEX = path.join(PLAN, 'TRACKED_E2E_ANNEX_NOVELDATA.json');

dotenv.config({ path: ENV });

const annex = JSON.parse(fs.readFileSync(ANNEX, 'utf8'));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(LIVE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof generateChapter === 'function' && typeof buildGenerateChapterUserContent === 'function', null, { timeout: 30000 });

const result = await page.evaluate((data) => {
  // Seed spine fields from annex (no API)
  const keys = ['title','genre','storyArc','generalPlot','setting','plotOutline','novelOutline','storyArcOutline',
    'chapterOutlines','chapterArcs','chapterBlueprints','characters','subplots','worldBible','authorStyle','styleGuide',
    'numChapters','chapterLength','continuityStrictMode'];
  keys.forEach((k) => { if (data[k] != null) novelData[k] = data[k]; });
  if (!Array.isArray(novelData.chapters)) novelData.chapters = [];
  const pack = buildGenerateChapterUserContent(1, 1, {});
  const need = ['Chapter Blueprint (obligations JSON)','OBLIGATION CHECKLIST','characterBeats','subplotPressure','worldHooks','ObligationRetrieve','arcStep'];
  const missing = need.filter((k) => pack.indexOf(k) < 0);
  const plotDig = getPlotDigestText(320);
  const setDig = getSettingDigestText(280);
  const emptyCov = scoreObligationCoverage('', 1);
  const bp = getChapterBlueprint(1);
  const names = ((bp && bp.characterBeats) || []).map((b) => b && b.name).filter(Boolean);
  const hooks = (bp && bp.worldHooks) || [];
  const synth = ['Latency spike at the docks.', ...names, ...hooks, String(bp && bp.arcStep || ''), String(((bp && bp.subplotPressure) || [])[0] || '')].join(' ');
  const synthCov = scoreObligationCoverage(synth + ' ' + synth + ' ' + synth, 1);
  return {
    missing,
    packChars: pack.length,
    plotDigPreview: (plotDig || '').slice(0, 120),
    setDigPreview: (setDig || '').slice(0, 120),
    emptyPassed: emptyCov.passed,
    emptyFailures: emptyCov.failures,
    synth: { passed: synthCov.passed, ratio: synthCov.ratio, hits: synthCov.hits, misses: synthCov.misses, failures: synthCov.failures },
    hasPadQuota: /~700-900 words/.test(pack) || /atmospheric hook/.test(pack),
    helpersOk: typeof getChapterBlueprint === 'function' && typeof assertObligationCoverageOrThrow === 'function'
  };
}, annex);

await browser.close();

const out = path.join(PLAN, 'SMOKE_BP_BIND_REPORT.json');
fs.writeFileSync(out, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

let fail = false;
if (result.missing.length) { console.error('FAIL missing pack fields', result.missing); fail = true; }
if (result.emptyPassed) { console.error('FAIL empty coverage passed'); fail = true; }
if (result.hasPadQuota) { console.error('FAIL pad quotas still present'); fail = true; }
if (!result.helpersOk) { console.error('FAIL helpers missing'); fail = true; }
if (!(result.plotDigPreview && result.plotDigPreview.length > 40)) { console.error('FAIL plot digest thin'); fail = true; }
if (!(result.setDigPreview && result.setDigPreview.length > 20)) { console.error('FAIL setting digest thin'); fail = true; }
if (fail) process.exit(1);
console.log('SMOKE_BP_BIND PASS');
