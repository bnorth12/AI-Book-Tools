/**
 * A1 offline smoke: beat coverage contract (six obligations, fail-closed).
 * No NovelWriter.html product patch. Run: node scripts/_smoke_beat_coverage.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snippet = fs.readFileSync(path.join(__dirname, '_nw_beat_coverage_snippet.js'), 'utf8');
const PLAN = 'C:/Users/brian/grok-build-queue/plans/ai-book-tools-2026-09-27/novelwriter';

const sandbox = {
  console,
  NW_DENSITY: { stubCharLimit: 40 },
  alert: undefined
};
vm.createContext(sandbox);
vm.runInContext(snippet, sandbox);

const { scoreBeatCoverage, normalizeChapterBeatPack, NW_BEAT_REQUIRED } = sandbox;
let fails = [];
function assert(cond, msg) { if (!cond) fails.push(msg); }

assert(Array.isArray(NW_BEAT_REQUIRED) && NW_BEAT_REQUIRED.length === 6, 'six required keys');

const denseBeat = (ch, name) => ({
  chapter: ch,
  sceneGoal: `Chapter ${ch} forces a public choice about opacity windows at the docks under NOTAM pressure and timed freight delay.`,
  castArcBeat: `${name} must authorize or refuse a dark window while subplot pressure from the RFID spike exposes a wound in their duty.`,
  subplotPressure: `Philippine-Sea RFID delay thread advances: ${name} sees the twelve-millisecond spike become treaty evidence.`,
  dialogueTurn: `${name} argues with a counterpart about whether the unlogged child clause is mercy or erasure — spoken lines required.`,
  sensoryWorldHook: `Salt air on Bridge Lock, freighter radar bloom, Lofoten clean-block hum, badge reader chirp under yellow NOTAM lights.`,
  turnOrPayoff: `Midpoint turn: a priced loyalty offer is refused; payoff is a recorded refusal that becomes treaty language later.`
});

const chars = [
  { name: 'Dr. Lumen Kwan', backstory: 'x', arc: 'y' },
  { name: 'Marshal Ife Okafor', backstory: 'x', arc: 'y' }
];
const subs = ['RFID delay throughline across chapters with named cast and docks.'];

// Thin: empty blueprints
const thin = scoreBeatCoverage({ characters: chars, subplots: subs, chapterBlueprints: [], numChapters: 5 }, { chapterCap: 5 });
assert(!thin.passed, 'thin empty should fail');
assert(thin.failures.some(f => f.includes('beat_missing_blueprint')), 'missing blueprint failures');

// Thin stubs (arrow taglines)
const stubBp = Array.from({ length: 5 }, (_, i) => ({
  chapter: i + 1,
  sceneGoal: 'go',
  castArcBeat: 'Kwan arc',
  subplotPressure: 'RFID',
  dialogueTurn: 'talk',
  sensoryWorldHook: 'dock',
  turnOrPayoff: 'turn'
}));
const stub = scoreBeatCoverage({ characters: chars, subplots: subs, chapterBlueprints: stubBp, numChapters: 5 }, { chapterCap: 5 });
assert(!stub.passed, 'stubs should fail');
assert(stub.failures.some(f => f.startsWith('beat_stub:')), 'stub failures present');

// Dense pass
const denseBp = [
  denseBeat(1, 'Dr. Lumen Kwan'),
  denseBeat(2, 'Marshal Ife Okafor'),
  denseBeat(3, 'Dr. Lumen Kwan'),
  denseBeat(4, 'Marshal Ife Okafor'),
  denseBeat(5, 'Dr. Lumen Kwan')
];
const rich = scoreBeatCoverage({ characters: chars, subplots: subs, chapterBlueprints: denseBp, numChapters: 5 }, { chapterCap: 5 });
assert(rich.passed, 'dense should pass: ' + (rich.failures || []).join(' | '));

// Alias path: legacy blueprint fields map into six
const legacy = normalizeChapterBeatPack({
  chapter: 1,
  role: 'Inciting audit at docks under NOTAM with freight delay stakes for the crew.',
  characterBeats: [{ name: 'Dr. Lumen Kwan', beat: 'Must choose opacity vs duty when the RFID spike hits the ledger.' }],
  subplotPressure: ['RFID delay becomes evidence in the treaty thread across coastal towns.'],
  dialogueTurn: 'Kwan tells Okafor the dark window is intentional and names the cost aloud.',
  worldHooks: ['Philippine Sea freighter, Bridge Lock badge chirp, salt and yellow NOTAM wash.'],
  allowedPayoffs: ['Refusal is logged and later becomes clause language in the opacity treaty.']
}, 1);
assert(legacy.sceneGoal.length >= 40, 'legacy role -> sceneGoal');
assert(legacy.castArcBeat.toLowerCase().includes('kwan'), 'legacy characterBeats -> castArcBeat');
assert(legacy.sensoryWorldHook.length >= 40, 'legacy worldHooks');
assert(legacy.turnOrPayoff.length >= 40, 'legacy allowedPayoffs');

const legacyScore = scoreBeatCoverage({
  characters: chars,
  subplots: subs,
  chapterBlueprints: [legacy, denseBeat(2, 'Marshal Ife Okafor'), denseBeat(3, 'Dr. Lumen Kwan'), denseBeat(4, 'Marshal Ife Okafor'), denseBeat(5, 'Dr. Lumen Kwan')],
  numChapters: 5
}, { chapterCap: 5 });
assert(legacyScore.passed, 'legacy-mapped dense should pass');

// Cast unnamed fail
const badCast = denseBeat(1, 'Nobody Important');
badCast.castArcBeat = 'A stranger must decide something vague about windows without naming the cast from the book roster at all.';
const bad = scoreBeatCoverage({
  characters: chars,
  subplots: subs,
  chapterBlueprints: [badCast, denseBeat(2, 'Marshal Ife Okafor'), denseBeat(3, 'Dr. Lumen Kwan'), denseBeat(4, 'Marshal Ife Okafor'), denseBeat(5, 'Dr. Lumen Kwan')],
  numChapters: 5
}, { chapterCap: 5 });
assert(!bad.passed && bad.failures.some(f => f.includes('beat_cast_unnamed')), 'cast unnamed fail');

const report = {
  ok: fails.length === 0,
  fails,
  thinFailCount: thin.failures.length,
  stubFailCount: stub.failures.length,
  richPassed: rich.passed,
  legacyPassed: legacyScore.passed,
  required: NW_BEAT_REQUIRED
};
fs.mkdirSync(PLAN, { recursive: true });
fs.writeFileSync(path.join(PLAN, 'A1_BEAT_SMOKE_REPORT.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (fails.length) {
  console.error('A1 SMOKE FAIL', fails);
  process.exit(1);
}
console.log('A1 SMOKE PASS');
