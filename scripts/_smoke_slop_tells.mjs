/**
 * B1/B4 offline smoke: scoreSlopTells detectors (no NovelWriter.html, no LLM).
 * Usage: node scripts/_smoke_slop_tells.mjs   (see scripts/README.md)
 */
import fs from 'fs';
import path from 'path';
import { scoreSlopTells, SLOP_TELLS, scoreChapterEcho } from './_nw_slop_tells_snippet.mjs';
import { fileURLToPath } from 'url';

// Paths resolve from this checkout (no machine-specific defaults). Optional overrides:
//   NW_FIXTURES_DIR  input fixtures (default scripts/fixtures/nw_slop)
//   NW_OUT_DIR       report output (default out/nw-smoke, gitignored)
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const FIXTURES = path.resolve(process.env.NW_FIXTURES_DIR || path.join(SCRIPT_DIR, 'fixtures', 'nw_slop'));
const OUT_DIR = path.resolve(process.env.NW_OUT_DIR || path.join(REPO_ROOT, 'out', 'nw-smoke'));
function annexChapters(id) {
  const fp = path.join(FIXTURES, 'annex_chapters', id + '.json');
  if (!fs.existsSync(fp)) return null;
  return (JSON.parse(fs.readFileSync(fp, 'utf8')).chapters || []).map(t => String(t || '').trim());
}
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

// B4-0b-widen: delayed paraphrase (gap ~8 filler) must foul overExplain via +/-40 window
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

// B4-0d: delayed paraphrase beyond prior +/-32 window (A3 Ch2 class, d~39) must foul via +/-40
const beyond32Restate = `She left one interval key intact, the same key that could still trace the spike back to its origin.
Radar bloomed once over Bridge Lock.
Salt air hit the freighter lane.
A courier sealed a ceramic shard.
Orbital debris drifted past the Faraday mesh.
The terminal hummed without a buyer.
Herring brine clung to the pressure lock.
Twelve milliseconds waited on the uplink.
The fjord rain filled no silence.
Coolant pumps shifted pitch in the cage.
A receipt queued for transmission three blocks away.
Municipal SLA priced the thermos telemetry.
Faraday nostalgia carried a price on every shelf.
Buyers refreshed the Lofoten auction blocks.
Clean intervals remembered something they were never sold.
The spike rippled through three ledger rows.
Cassian watched the desync without speaking.
Rook sealed the sleeve and waited for the next ping.
Aoi pocketed the drive with two reads remaining.
Theo coffee ring dried on the console printout.
Container traffic warmed the ceramic post crown.
Guild voices billed manual interventions at microcredits.
Evacuation drills stopped pretending along lane three.
The Unlogged Child flickered between posts seventeen and eighteen.
Harbor chaplaincy ledgers refused Triad seizure pricing.
Sinta shard request sat beside the minting stylus.
Park escrow release stamped the offline map.
Okafor override key remained unused above the switch.
Kwan refusal packet joined the clean block treaty table.
Nakamura private cubesat failure ledger stayed locked.
Bitung parasol docks smelled of wet graphene at dawn.
The Conduit Consensus Triad broadcast uptime demands.
Blind-spot clauses typed themselves under amber crowns.
Typhoon warnings scrolled while dark posts reported nothing.
Mireya rain-soaked ledger waited without a price.
The interval key cooled against Rook palm one last time.
Rook left the interval key intact, the same key that could still trace the spike back to its origin.`;
expectFail('beyond32-restate', beyond32Restate, 'overExplain');
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

// B3R regression anchors from vendored fixtures (scripts/fixtures/nw_slop/annex_chapters/B3R.json)
const b3r = annexChapters('B3R');
assert(b3r && b3r.length >= 4, 'missing fixture annex_chapters/B3R.json (need >=4 chapters)');
let ch2OverExplain = null;
let ch4ChapterEcho = null;
if (b3r && b3r[1]) {
  const ch2 = b3r[1];
  const ch2R = scoreSlopTells(ch2);
  ch2OverExplain = { score: ch2R.tells.overExplain.score, ok: ch2R.tells.overExplain.ok, hits: ch2R.tells.overExplain.hits, failsTell: !ch2R.tells.overExplain.ok };
  console.log('B3R Ch2 overExplain:', JSON.stringify(ch2OverExplain));
}
if (b3r && b3r[2] && b3r[3]) {
  const ch3 = b3r[2];
  const ch4 = b3r[3];
  const ch4R = scoreSlopTells(ch4, { priorChapters: [ch3] });
  ch4ChapterEcho = { score: ch4R.tells.chapterEcho.score, ok: ch4R.tells.chapterEcho.ok, hits: ch4R.tells.chapterEcho.hits, failsTell: !ch4R.tells.chapterEcho.ok };
  console.log('B3R Ch4 chapterEcho (prior=Ch3):', JSON.stringify(ch4ChapterEcho));
}

assert(ch2OverExplain && ch2OverExplain.failsTell, 'B3R Ch2 overExplain must FAIL');
assert(ch4ChapterEcho && ch4ChapterEcho.failsTell, 'B3R Ch4 chapterEcho (prior=Ch3) must FAIL');
// B4-0d corpus file: delayed paraphrase at d~39
const d39Path = path.join(SCRIPT_DIR, 'fixtures', 'slop_corpus', 'a3_ch2_overexplain_d39.txt');
if (fs.existsSync(d39Path)) {
  const d39 = scoreSlopTells(fs.readFileSync(d39Path, 'utf8'));
  console.log('slop_corpus a3_ch2_overexplain_d39 overExplain:', JSON.stringify({ score: d39.tells.overExplain.score, ok: d39.tells.overExplain.ok }));
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
  chapterEchoFixture: { foulOk: !echoFoul.tells.chapterEcho.ok, passOk: echoPass.tells.chapterEcho.ok },
  beyond32: (() => { const r = scoreSlopTells(beyond32Restate); return { ok: !r.tells.overExplain.ok, score: r.tells.overExplain.score }; })()
};
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'B1_SLOP_TELL_SMOKE_REPORT.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.ok) {
  console.error('B1 SLOP TELL SMOKE FAIL');
  process.exit(1);
}
console.log('B1 SLOP TELL SMOKE PASS');

