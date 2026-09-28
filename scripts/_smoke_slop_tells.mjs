/**
 * B1 offline smoke: scoreSlopTells detectors (no NovelWriter.html, no LLM).
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { scoreSlopTells, SLOP_TELLS } from './_nw_slop_tells_snippet.js';

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

function expectFail(label, text, tell) {
  const r = scoreSlopTells(text);
  assert(!r.tells[tell].ok, label + ' should foul ' + tell + ' score=' + r.tells[tell].score);
  assert(r.failures.some(f => f.includes(tell)), label + ' failures missing ' + tell);
}

expectFail('cadence', foulCadence, 'cadence');
expectFail('metaphor', foulMetaphor, 'stockMetaphor');
expectFail('hedge', foulHedge, 'hedgeStack');
expectFail('echo', foulEcho, 'nameEcho');
expectFail('emotion', foulEmotion, 'emotionLabel');
expectFail('over', foulOver, 'overExplain');

assert(SLOP_TELLS.length === 6, 'six tells');

const report = { ok: fails.length === 0, fails, cleanPassed: cleanR.passed, tells: SLOP_TELLS };
fs.mkdirSync(PLAN, { recursive: true });
fs.writeFileSync(path.join(PLAN, 'B1_SLOP_TELL_SMOKE_REPORT.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.ok) {
  console.error('B1 SLOP TELL SMOKE FAIL');
  process.exit(1);
}
console.log('B1 SLOP TELL SMOKE PASS');
