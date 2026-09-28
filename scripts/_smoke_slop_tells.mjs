/**
 * B1/B4 offline smoke: scoreSlopTells detectors (no NovelWriter.html, no LLM).
 */
import fs from 'fs';
import path from 'path';
import { scoreSlopTells, SLOP_TELLS, scoreChapterEcho } from './_nw_slop_tells_snippet.js';

const PLAN = 'C:/Users/brian/grok-build-queue/plans/ai-book-tools-2026-09-27/novelwriter';
const fails = [];
function assert(c, m) { if (!c) fails.push(m); }

const clean = `Kwan checked the twelve-millisecond spike against the freighter log.
Rook priced the fork once, then waited.
"If this deletes Sinta's uplink," she said, "the ledger becomes evidence."
Salt air hit Bridge Lock. Radar bloomed once and went dark.`;

const foulCadence = `Moreover the system worked. Furthermore the system worked. Additionally the system worked. Therefore the system worked. Meanwhile the system worked.`;
const foulMetaphor = `It was a double-edged sword and a blessing in disguise, the calm before the storm at the tip of the iceberg with a heart of gold.`;
const foulHedge = `Maybe she perhaps seemed as if she almost kind of might sort of appeared to hesitate at the door.`;
const foulEcho = `Kwan told Kwan that Kwan would not sign what Kwan had refused yesterday when Kwan arrived.`;
const foulEmotion = `She felt sad. He was angry. They seemed afraid of the ledger.`;
const foulOver = `The container vanished into the fog at dawn. The container vanished into the fog at dawn again as they watched.`;

const cleanR = scoreSlopTells(clean);
assert(cleanR.passed, 'clean should pass: ' + cleanR.failures.join('|'));
assert(cleanR.tells.chapterEcho && cleanR.tells.chapterEcho.ok && cleanR.tells.chapterEcho.score === 0, 'chapterEcho absent prior should be 0/ok');

function expectFail(label, text, tell, opts) {
  const r = scoreSlopTells(text, opts);
  assert(!r.tells[tell].ok, label + ' should foul ' + tell + ' score=' + r.tells[tell].score);
  assert(r.failures.some(f => f.includes(tell)), label + ' failures missing ' + tell);
}

expectFail('cadence', foulCadence, 'cadence');
expectFail('metaphor', foulMetaphor, 'stockMetaphor');
expectFail('hedge', foulHedge, 'hedgeStack');
expectFail('echo', foulEcho, 'nameEcho');
expectFail('emotion', foulEmotion, 'emotionLabel');
expectFail('over', foulOver, 'overExplain');

// B4-0b-widen: delayed paraphrase (gap ~8 filler) must foul overExplain via +/-32 window
const delayedRestate = `Rook priced the fork once. Selling the clean block would clear his mother's ledger but expose the chaplaincy network to Triad seizure; withholding it would mark him as complicit in opacity. The clean block was no longer currency. It was evidence.
Radar bloomed once over Bridge Lock.
Salt air hit the freighter lane.
A courier sealed a ceramic shard.
Orbital debris drifted past the Faraday mesh.
The terminal hummed without a buyer.
Herring brine clung to the pressure lock.
Twelve milliseconds waited on the uplink.
The fjord rain filled no silence.
Rook studied the minting stylus again. Selling the clean block clears his mother's ledger but hands the chaplaincy network to seizure; withholding it marks him as complicit in opacity. The clean block had been currency. Kwan's refusal turned it into evidence.`;
expectFail('delayed-restate', delayedRestate, 'overExplain');

// B4-0c: chapterEcho — Ch2 near-copy of Ch1 paragraph must FAIL; distinct Ch2 PASS
const ch1Para = `Rook priced the fork once at Bridge Lock. Selling the clean block would clear his mother's ledger but expose the chaplaincy network to Triad seizure; withholding it would mark him as complicit in opacity. The clean block was no longer currency. It was evidence that could sink the convoy.`;
const ch2NearCopy = `Morning traffic clogged the Faraday mesh.
Rook priced the fork once at Bridge Lock. Selling the clean block would clear his mother's ledger but expose the chaplaincy network to Triad seizure; withholding it would mark him as complicit in opacity. The clean block was no longer currency. It was evidence that could sink the convoy.
A gull wheeled over the pressure seal.`;
const ch2Distinct = `Morning traffic clogged the Faraday mesh.
Sinta rerouted the uplink through a dead courier lane and waited for the spike to clear.
A gull wheeled over the pressure seal while Kwan sealed the ceramic shard.`;

const echoFoul = scoreSlopTells(ch2NearCopy, { priorChapters: [ch1Para] });
assert(!echoFoul.tells.chapterEcho.ok, 'ch2-near-copy should foul chapterEcho score=' + echoFoul.tells.chapterEcho.score);
assert(echoFoul.failures.some(f => f.includes('chapterEcho')), 'ch2-near-copy failures missing chapterEcho');

const echoPass = scoreSlopTells(ch2Distinct, { priorChapters: [ch1Para] });
assert(echoPass.tells.chapterEcho.ok, 'distinct ch2 should pass chapterEcho score=' + echoPass.tells.chapterEcho.score + ' hits=' + JSON.stringify(echoPass.tells.chapterEcho.hits));

const motifOnly = scoreChapterEcho(
  'Kwan sealed the shard. Rook watched the fjord rain.',
  ['Sinta priced the ledger. The convoy left Bridge Lock.']
);
assert(motifOnly.score < 55 && motifOnly.hits.length === 0, 'motif-only must not foul: ' + JSON.stringify(motifOnly));

const ch2Path = 'C:/Users/brian/grok-build-queue/plans/ai-book-tools-2026-09-27/novelwriter/_b3r_ch_texts/ch2.txt';
const ch3Path = 'C:/Users/brian/grok-build-queue/plans/ai-book-tools-2026-09-27/novelwriter/_b3r_ch_texts/ch3.txt';
const ch4Path = 'C:/Users/brian/grok-build-queue/plans/ai-book-tools-2026-09-27/novelwriter/_b3r_ch_texts/ch4.txt';
let ch2OverExplain = null;
let ch4ChapterEcho = null;
if (fs.existsSync(ch2Path)) {
  const ch2 = fs.readFileSync(ch2Path, 'utf8');
  const ch2R = scoreSlopTells(ch2);
  ch2OverExplain = { score: ch2R.tells.overExplain.score, ok: ch2R.tells.overExplain.ok, hits: ch2R.tells.overExplain.hits, failsTell: !ch2R.tells.overExplain.ok };
  console.log('B3R Ch2 overExplain:', JSON.stringify(ch2OverExplain));
}
if (fs.existsSync(ch3Path) && fs.existsSync(ch4Path)) {
  const ch3 = fs.readFileSync(ch3Path, 'utf8');
  const ch4 = fs.readFileSync(ch4Path, 'utf8');
  const ch4R = scoreSlopTells(ch4, { priorChapters: [ch3] });
  ch4ChapterEcho = { score: ch4R.tells.chapterEcho.score, ok: ch4R.tells.chapterEcho.ok, hits: ch4R.tells.chapterEcho.hits, failsTell: !ch4R.tells.chapterEcho.ok };
  console.log('B3R Ch4 chapterEcho (prior=Ch3):', JSON.stringify(ch4ChapterEcho));
}

assert(SLOP_TELLS.length === 7, 'seven tells');
assert(SLOP_TELLS.includes('chapterEcho'), 'chapterEcho in SLOP_TELLS');

const report = {
  ok: fails.length === 0,
  fails,
  cleanPassed: cleanR.passed,
  tells: SLOP_TELLS,
  ch2OverExplain,
  ch4ChapterEcho,
  chapterEchoFixture: { foulOk: !echoFoul.tells.chapterEcho.ok, passOk: echoPass.tells.chapterEcho.ok }
};
fs.mkdirSync(PLAN, { recursive: true });
fs.writeFileSync(path.join(PLAN, 'B1_SLOP_TELL_SMOKE_REPORT.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.ok) {
  console.error('B1 SLOP TELL SMOKE FAIL');
  process.exit(1);
}
console.log('B1 SLOP TELL SMOKE PASS');

