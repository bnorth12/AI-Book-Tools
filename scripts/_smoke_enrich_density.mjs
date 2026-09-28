/**
 * Lean offline smoke: density/obligation helpers + Tab5 readiness fail-closed.
 * No chapter API burn. Uses Playwright against live site HTML + fixture stubs.
 */
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const LIVE = 'file:///C:/NovelWriterSite/NovelWriter/NovelWriter.html';
const FIXTURE = path.resolve('NovelWriter/fixtures/rich-scifi-v1/novelData.seed.json');
const PLAN = 'C:/Users/brian/grok-build-queue/plans/ai-book-tools-2026-09-27/novelwriter';
const OUT = path.join(PLAN, 'SMOKE_ENRICH_DENSITY_REPORT.json');

const seed = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(LIVE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof scoreCastDensity === 'function' && typeof scoreAdvanceToTab5Readiness === 'function', null, { timeout: 30000 });

const result = await page.evaluate(async (data) => {
  const keys = ['title','genre','storyArc','generalPlot','setting','characters','subplots','world','authorStyle','styleGuide','numChapters','chapterLength','novelOutline','plotOutline','storyArcOutline','chapterBlueprints','chapterOutlines'];
  keys.forEach((k) => { if (data[k] != null) novelData[k] = data[k]; });

  const thinCast = scoreCastDensity(novelData.characters || [], { novelData });
  const thinSubs = scoreSubplotDensity(novelData.subplots || [], { novelData });
  const thinReady = scoreAdvanceToTab5Readiness(novelData);

  // Synthetic rich cast/subplots for pass path
  const richChars = (novelData.characters || []).slice(0, 3).map((c, i) => ({
    name: c.name || ('Hero' + i),
    backstory: Array(90).fill('word').map((w, n) => w + n).join(' ') + ' motive wound relationship subplot pressure location faction.',
    arc: Array(70).fill('arc').map((w, n) => w + n).join(' ') + ' starting flaw subplot events sensory end-state resolution.'
  }));
  const richSubs = [
    Array(130).fill('thread').map((w, n) => w + n).join(' ') + ' named cast chapter span sensory docks faction stakes resolution.',
    Array(130).fill('thread').map((w, n) => w + n).join(' ') + ' rival arc Lofoten blocks conflict payoff foreshadow.'
  ];
  const richCast = scoreCastDensity(richChars, { novelData });
  const richSub = scoreSubplotDensity(richSubs, { novelData });

  // Outline obligations: seed macros with named cast + conflict language
  novelData.characters = richChars;
  novelData.subplots = richSubs;
  novelData.novelOutline = 'Opening stakes at the Philippine Sea. ' + richChars.map(c => c.name).join(', ') +
    ' face a crisis. Midpoint confrontation. Climactic resolution of the primary conflict and subplot payoffs across docks and Lofoten.';
  novelData.plotOutline = novelData.novelOutline + ' Plot beats escalate threat, clash, and resolution with world hooks.';
  novelData.storyArcOutline = 'Emotional journey from denial through confrontation to hard-won resolution.';
  novelData.setting = (novelData.setting || 'Orbital docks, Philippine Sea freighters, Lofoten clean blocks, Bridge Lock NOTAM.');
  novelData.chapterBlueprints = [{
    chapter: 1, role: 'opening', arcStep: 'seed pressure at docks',
    characterBeats: richChars.slice(0, 2).map(c => ({ name: c.name, beat: 'establish wound' })),
    subplotPressure: ['Twelve-Millisecond Freighter latency'],
    worldHooks: ['Philippine Sea', 'Bridge Lock'],
    allowedPayoffs: [], deferredThreads: ['freighter latency']
  }];
  novelData.chapterOutlines = [Array(100).fill('beat').join(' ') + ' docks confrontation'];
  const obl = scoreOutlineObligations(novelData);
  const ready = scoreAdvanceToTab5Readiness(novelData);

  let gateBlocked = false;
  let gateMsg = '';
  try {
    assertAdvanceToTab5ReadinessOrThrow({ characters: [{ name: 'X', backstory: 'short', arc: 'x' }], subplots: ['tiny stub'], novelOutline: '', plotOutline: '' });
  } catch (e) {
    gateBlocked = true;
    gateMsg = String(e && e.message || e).slice(0, 200);
  }

  // generateChapter should fail-closed on thin readiness (without calling API): invoke gate only
  let genBlocked = false;
  let genMsg = '';
  try {
    // Restore thin fixture-like spine
    novelData.characters = data.characters;
    novelData.subplots = data.subplots;
    novelData.novelOutline = '';
    novelData.plotOutline = '';
    novelData.chapterBlueprints = [];
    novelData.chapterOutlines = ['short'];
    // Call internal gate by attempting generateChapter — will throw before API if wired
    // Avoid network: monkey-patch callAI
    const prev = callAI;
    callAI = async () => { throw new Error('callAI should not run'); };
    try {
      await generateChapter(1);
    } catch (e) {
      genBlocked = /FAIL-CLOSED|READINESS|STAGE GATE/i.test(String(e && e.message || e));
      genMsg = String(e && e.message || e).slice(0, 240);
    }
    callAI = prev;
  } catch (e) {
    genMsg = 'outer ' + String(e && e.message || e);
  }

  return {
    helpers: {
      scoreCastDensity: typeof scoreCastDensity === 'function',
      enrichCharacters: typeof enrichCharacters === 'function',
      enrichSubplots: typeof enrichSubplots === 'function',
      runEnrichLoopPass: typeof runEnrichLoopPass === 'function',
      assertAdvanceToTab5ReadinessOrThrow: typeof assertAdvanceToTab5ReadinessOrThrow === 'function'
    },
    fixtureThin: {
      castPassed: thinCast.passed,
      castFailuresSample: (thinCast.failures || []).slice(0, 4),
      subplotPassed: thinSubs.passed,
      subplotFailuresSample: (thinSubs.failures || []).slice(0, 4),
      readyPassed: thinReady.passed
    },
    syntheticRich: {
      castPassed: richCast.passed,
      subplotPassed: richSub.passed,
      outlinePassed: obl.passed,
      outlineFailures: obl.failures,
      readyPassed: ready.passed,
      readyFailures: ready.failures
    },
    assertThrowsOnThin: gateBlocked,
    gateMsg,
    generateChapterBlockedOnThin: genBlocked,
    genMsg
  };
}, seed);

await browser.close();
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

let fail = false;
const h = result.helpers || {};
Object.entries(h).forEach(([k, v]) => { if (!v) { console.error('FAIL helper', k); fail = true; } });
if (result.fixtureThin.castPassed) { console.error('FAIL fixture cast should be thin'); fail = true; }
if (result.fixtureThin.subplotPassed) { console.error('FAIL fixture subplots should be thin'); fail = true; }
if (!result.syntheticRich.castPassed) { console.error('FAIL rich cast should pass'); fail = true; }
if (!result.syntheticRich.subplotPassed) { console.error('FAIL rich subplots should pass'); fail = true; }
if (!result.syntheticRich.outlinePassed) { console.error('FAIL outline obligations', result.syntheticRich.outlineFailures); fail = true; }
if (!result.syntheticRich.readyPassed) { console.error('FAIL readiness', result.syntheticRich.readyFailures); fail = true; }
if (!result.assertThrowsOnThin) { console.error('FAIL assert should throw on thin'); fail = true; }
if (!result.generateChapterBlockedOnThin) { console.error('FAIL generateChapter should block', result.genMsg); fail = true; }
if (fail) process.exit(1);
console.log('SMOKE_ENRICH_DENSITY PASS');
