/**
 * A2 lean smoke: live site HTML has scoreBeatCoverage + readiness.beats + enrichChapterBlueprints.
 * No live LLM burn — synthetic thin/dense blueprints only.
 */
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const LIVE = 'file:///C:/NovelWriterSite/NovelWriter/NovelWriter.html';
const PLAN = 'C:/Users/brian/grok-build-queue/plans/ai-book-tools-2026-09-27/novelwriter';
const FIXTURE = path.resolve('NovelWriter/fixtures/rich-scifi-v1/novelData.seed.json');
const seed = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

function denseBeat(ch, name) {
  return {
    chapter: ch,
    sceneGoal: `Chapter ${ch} forces a public choice about opacity windows at the docks under NOTAM pressure and timed freight delay.`,
    castArcBeat: `${name} must authorize or refuse a dark window while subplot pressure from the RFID spike exposes a wound in their duty.`,
    subplotPressure: `Philippine-Sea RFID delay thread advances: ${name} sees the twelve-millisecond spike become treaty evidence.`,
    dialogueTurn: `${name} argues with a counterpart about whether the unlogged child clause is mercy or erasure — spoken lines required.`,
    sensoryWorldHook: `Salt air on Bridge Lock, freighter radar bloom, Lofoten clean-block hum, badge reader chirp under yellow NOTAM lights.`,
    turnOrPayoff: `Midpoint turn: a priced loyalty offer is refused; payoff is a recorded refusal that becomes treaty language later.`
  };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(LIVE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof scoreBeatCoverage === 'function' && typeof enrichChapterBlueprints === 'function' && typeof scoreAdvanceToTab5Readiness === 'function', null, { timeout: 30000 });

const result = await page.evaluate(({ seed, denseBeatSrc }) => {
  // eslint-disable-next-line no-new-func
  const denseBeat = eval('(' + denseBeatSrc + ')');
  const fails = [];
  function assert(c, m) { if (!c) fails.push(m); }

  assert(typeof scoreBeatCoverage === 'function', 'scoreBeatCoverage missing');
  assert(typeof enrichChapterBlueprints === 'function', 'enrichChapterBlueprints missing');
  assert(typeof normalizeChapterBeatPack === 'function', 'normalizeChapterBeatPack missing');

  // seed load
  Object.keys(seed).forEach((k) => { novelData[k] = seed[k]; });
  novelData.numChapters = 5;

  const thin = scoreBeatCoverage(novelData, { chapterCap: 5 });
  assert(!thin.passed, 'seed blueprints should fail six-beat floors');

  // synthetic rich cast/subplots/outlines so readiness isolates beats
  novelData.characters = (novelData.characters || []).slice(0, 4).map((c, i) => ({
    name: c.name,
    backstory: Array(90).fill('word').map((w, n) => w + n).join(' ') + ' motive wound relationship.',
    arc: Array(70).fill('arc').map((w, n) => w + n).join(' ') + ' start pressure choice end-state.'
  }));
  novelData.subplots = [
    Array(130).fill('thread').map((w, n) => w + n).join(' ') + ' RFID docks treaty stakes resolution.',
    Array(130).fill('thread').map((w, n) => w + n).join(' ') + ' rival Lofoten conflict payoff.'
  ];
  novelData.novelOutline = 'Opening stakes. ' + novelData.characters.map(c => c.name).join(', ') + ' face crisis, confrontation, resolution with subplot payoffs.';
  novelData.plotOutline = novelData.novelOutline + ' Plot escalates threat clash resolution.';
  novelData.storyArcOutline = 'Denial through confrontation to resolution across the cast.';
  novelData.setting = (novelData.setting || '') + ' Orbital docks Philippine Sea Bridge Lock NOTAM.';

  novelData.chapterBlueprints = [1,2,3,4,5].map((ch) => denseBeat(ch, novelData.characters[(ch - 1) % novelData.characters.length].name));
  const richBeats = scoreBeatCoverage(novelData, { chapterCap: 5 });
  assert(richBeats.passed, 'dense beats should pass: ' + (richBeats.failures || []).join(' | '));

  const ready = scoreAdvanceToTab5Readiness(novelData);
  assert(ready.beats && ready.beats.passed, 'readiness.beats should pass');
  // cast/subplots/outline may still drive readiness; we only assert beats section
  assert(Array.isArray(ready.failures), 'readiness has failures array');

  // strip one beat -> fail-closed
  novelData.chapterBlueprints[2].dialogueTurn = 'talk';
  const stripped = scoreBeatCoverage(novelData, { chapterCap: 5 });
  assert(!stripped.passed && stripped.failures.some(f => f.includes('beat_stub:dialogueTurn:ch3') || f.includes('beat_missing:dialogueTurn:ch3') || f.includes('dialogueTurn')), 'stripped dialogue should fail');

  return { ok: fails.length === 0, fails, thinFail: thin.failures.length, richPassed: richBeats.passed, readinessBeats: !!(ready.beats && ready.beats.passed) };
}, { seed, denseBeatSrc: denseBeat.toString() });

await browser.close();
fs.mkdirSync(PLAN, { recursive: true });
fs.writeFileSync(path.join(PLAN, 'A2_BEAT_LEAN_SMOKE_REPORT.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (!result.ok) {
  console.error('A2 LEAN SMOKE FAIL');
  process.exit(1);
}
console.log('A2 LEAN SMOKE PASS');
