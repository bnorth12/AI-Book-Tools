/**
 * B5-0 offline smoke: nameEcho stopword fix (sentence-initial `The` FP).
 * Pure offline: scores existing annex prose + B4 inject spans. No LLM, no NovelWriter.html.
 * Before = legacy nameEcho regex (pre-B5-0), After = scripts/_nw_slop_tells_snippet.mjs.
 * Inputs: vendored fixtures under scripts/fixtures/nw_slop (annex chapter excerpts + B4 inject spans).
 * Usage: node scripts/_smoke_b5_0_name_echo.mjs   (see scripts/README.md)
 */
import fs from 'fs';
import path from 'path';
import { scoreSlopTells, SLOP_TELLS, SLOP_TELL_FLOORS, scoreNameEcho, NAME_ECHO_STOPWORDS } from './_nw_slop_tells_snippet.mjs';
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
const SPANS = path.join(FIXTURES, 'inject_spans');
const fails = [];
function assert(c, m) { if (!c) fails.push(m); }

// ---- legacy (pre-B5-0) nameEcho, verbatim logic ----
function legacyNameEcho(text) {
  const strip = String(text || '')
    .replace(/"([^"\\]|\\.)*"/g, ' ')
    .replace(/\u201C([^\u201D]*)\u201D/g, ' ')
    .replace(/'([^'\\]|\\.)*'/g, ' ');
  const w = strip.split(/\s+/).filter(Boolean);
  let worst = 0, worstName = '';
  for (let i = 0; i < w.length; i++) {
    const counts = {};
    w.slice(i, i + 25).forEach(tok => { if (/^[A-Z][a-z]{2,}$/.test(tok)) counts[tok] = (counts[tok] || 0) + 1; });
    Object.entries(counts).forEach(([n, c]) => { if (c > worst) { worst = c; worstName = n; } });
  }
  const score = Math.max(0, Math.min(100, Math.round(worst >= 3 ? 35 + worst * 18 : 0)));
  return { score, hits: worst >= 3 ? ['nameEcho:' + worstName + 'x' + worst] : [] };
}

function scoreBoth(text, opts) {
  const after = scoreSlopTells(text, opts);
  const leg = legacyNameEcho(text);
  const afterFailed = SLOP_TELLS.filter(k => !after.tells[k].ok);
  const beforeFailed = SLOP_TELLS.filter(k => k === 'nameEcho' ? leg.score >= SLOP_TELL_FLOORS.nameEcho : !after.tells[k].ok);
  return {
    beforeFailed, afterFailed,
    nameEcho: { before: { score: leg.score, hits: leg.hits }, after: { score: after.tells.nameEcho.score, hits: after.tells.nameEcho.hits } },
    scores: Object.fromEntries(SLOP_TELLS.map(k => [k, after.tells[k].score]))
  };
}

function chapterText(ch) {
  if (typeof ch === 'string') return ch;
  if (!ch || typeof ch !== 'object') return '';
  return ch.text || ch.content || ch.prose || ch.body || ch.chapterText || '';
}
function loadAnnex(id) {
  return annexChapters(id);
}

// ---- 1. unit cases ----
const theFP = 'The door opened onto the quay. The lamp above it flickered twice. The rain kept falling on ceramic posts. The wind carried brine.';
const theB = scoreBoth(theFP);
assert(theB.beforeFailed.includes('nameEcho'), 'legacy should foul `The` FP fixture (repro)');
assert(!theB.afterFailed.includes('nameEcho'), '`The` FP must be gone after fix: ' + JSON.stringify(theB.nameEcho.after));

const dialogueOnly = '"Kwan, listen," Rook said. "Kwan, the ledger. Kwan, please. Kwan!" He waited by the lock.';
const dlg = scoreBoth(dialogueOnly);
assert(!dlg.beforeFailed.includes('nameEcho') && !dlg.afterFailed.includes('nameEcho'), 'dialogue-address names must stay allowlisted before+after: ' + JSON.stringify(dlg.nameEcho));
const curlyDialogue = '\u201CSinta. Sinta. Sinta, answer me.\u201D The uplink stayed dark.';
const cdl = scoreBoth(curlyDialogue);
assert(!cdl.afterFailed.includes('nameEcho'), 'curly-quote dialogue names must stay allowlisted: ' + JSON.stringify(cdl.nameEcho));
const narrEcho = 'Kwan told Kwan that Kwan would not sign what Kwan had refused yesterday when Kwan arrived.';
const nar = scoreBoth(narrEcho);
assert(nar.afterFailed.includes('nameEcho'), 'narration name echo must still foul: ' + JSON.stringify(nar.nameEcho));
const mixed = 'Rook checked the lock. Rook checked it again. "Kwan," he said. Rook sealed the sleeve.';
const mix = scoreBoth(mixed);
assert(mix.afterFailed.includes('nameEcho') && /Rook/.test(mix.nameEcho.after.hits.join()), 'narration Rook x3 next to dialogue must foul on Rook: ' + JSON.stringify(mix.nameEcho));
assert(scoreNameEcho('Algorithm Two voted. Algorithm One demanded. Algorithm Three abstained.').score >= 55, 'Algorithm x3 must foul');

// ---- 2. corpus (B4 Phase 2 annex + B4-0d primary corpus) ----
// fixture ids = annex_chapters/<id>.json (B4 Phase 2, B3R, B3, A3R, A3, pre-A3 5ch baseline)
const ANNEXES = ['B4', 'B3R', 'B3', 'A3R', 'A3', 'PREV5CH'];
const rows = [];
const annexCache = {};
for (const a of ANNEXES) {
  const chs = loadAnnex(a);
  annexCache[a] = chs;
  if (!chs) { fails.push('missing annex ' + a); continue; }
  const prior = [];
  chs.forEach((t, i) => {
    if (t.length < 400) return;
    const r = scoreBoth(t, prior.length ? { priorChapters: [...prior] } : undefined);
    rows.push({ kind: 'corpus', unit: a + ' Ch' + (i + 1), ...r });
    prior.push(t);
  });
}

// ---- 3. six inject spans (1A harness shape: base chapter + span, priors = earlier chapters) ----
const ANNEX_OF = { B3R: 'B3R', B3: 'B3', A3R: 'A3R', A3: 'A3' };
const meta = JSON.parse(fs.readFileSync(path.join(SPANS, '_spans_meta.json'), 'utf8'));
const spanRows = [];
for (const m of meta) {
  const span = fs.readFileSync(path.join(SPANS, m.file), 'utf8');
  const chs = annexCache[ANNEX_OF[m.annex]] || loadAnnex(ANNEX_OF[m.annex]) || [];
  const base = chs[m.ch - 1] || '';
  const priors = chs.slice(0, m.ch - 1).filter(t => t.length >= 400);
  const opts = priors.length ? { priorChapters: priors } : undefined;
  const expected = m.tell.split('+');
  const combined = scoreBoth(base.replace(/\s+$/, '') + '\n\n' + span, opts);
  const alone = scoreBoth(span, opts);
  // a nameEcho drop whose legacy token is a function word (e.g. base-chapter `The`x3) is an FP removed, not a miss
  const legacyTok = (combined.nameEcho.before.hits[0] || '').replace(/^nameEcho:/, '').replace(/x\d+$/, '');
  const fpRemoved = combined.beforeFailed.includes('nameEcho') && !combined.afterFailed.includes('nameEcho') && NAME_ECHO_STOPWORDS.has(legacyTok.toLowerCase());
  const newMisses = combined.beforeFailed.filter(k => !combined.afterFailed.includes(k) && !(k === 'nameEcho' && fpRemoved));
  const expectedMissAfter = expected.filter(k => !combined.afterFailed.includes(k));
  assert(newMisses.length === 0, 'span ' + m.file + ' new misses: ' + newMisses.join(','));
  assert(expectedMissAfter.length === 0, 'span ' + m.file + ' expected tell(s) not firing after: ' + expectedMissAfter.join(','));
  spanRows.push({ kind: 'span', unit: m.file, expected, newMisses, fpRemoved: fpRemoved ? legacyTok : null, expectedMissAfter, combined, alone: { beforeFailed: alone.beforeFailed, afterFailed: alone.afterFailed, nameEcho: alone.nameEcho } });
  rows.push({ kind: 'span', unit: m.file, beforeFailed: combined.beforeFailed, afterFailed: combined.afterFailed, nameEcho: combined.nameEcho, scores: combined.scores });
}

// ---- 4. B3R regression anchors (Ch2 overExplain FAIL, Ch4 chapterEcho FAIL vs Ch3) ----
const b3rChs = annexCache.B3R || loadAnnex('B3R') || [];
const b3r = n => b3rChs[n - 1] || '';
const b3rCh2 = scoreSlopTells(b3r(2));
const b3rCh4 = scoreSlopTells(b3r(4), { priorChapters: [b3r(3)] });
const anchors = {
  b3rCh2OverExplain: { score: b3rCh2.tells.overExplain.score, fires: !b3rCh2.tells.overExplain.ok, hits: b3rCh2.tells.overExplain.hits },
  b3rCh4ChapterEcho: { score: b3rCh4.tells.chapterEcho.score, fires: !b3rCh4.tells.chapterEcho.ok, hits: b3rCh4.tells.chapterEcho.hits }
};
assert(anchors.b3rCh2OverExplain.fires, 'B3R Ch2 overExplain must still FAIL');
assert(anchors.b3rCh4ChapterEcho.fires, 'B3R Ch4 chapterEcho must still FAIL');

// ---- 5. B4 Phase 2 Ch4/Ch5 `The` FP gone ----
const b4 = rows.filter(r => r.unit.startsWith('B4 '));
['B4 Ch4', 'B4 Ch5'].forEach(u => {
  const r = b4.find(x => x.unit === u);
  assert(r && r.beforeFailed.includes('nameEcho') && /The/.test(r.nameEcho.before.hits.join()), u + ' legacy should show `The` nameEcho (repro)');
  assert(r && !r.afterFailed.includes('nameEcho'), u + ' nameEcho must clear after fix: ' + JSON.stringify(r && r.nameEcho.after));
});

// ---- table ----
const table = {};
SLOP_TELLS.forEach(k => {
  const t = { corpusBefore: 0, corpusAfter: 0, spansBefore: 0, spansAfter: 0 };
  rows.forEach(r => {
    const pre = r.kind === 'corpus' ? 'corpus' : 'spans';
    if (r.beforeFailed.includes(k)) t[pre + 'Before']++;
    if (r.afterFailed.includes(k)) t[pre + 'After']++;
  });
  table[k] = t;
});
const nameEchoChanges = rows.filter(r => r.beforeFailed.includes('nameEcho') !== r.afterFailed.includes('nameEcho'))
  .map(r => ({ unit: r.unit, before: r.nameEcho.before, after: r.nameEcho.after }));
const nameEchoStill = rows.filter(r => r.afterFailed.includes('nameEcho')).map(r => ({ unit: r.unit, after: r.nameEcho.after }));
// any lost hit that is NOT a stopword token is a real miss
nameEchoChanges.forEach(c => {
  const tok = (c.before.hits[0] || '').replace(/^nameEcho:/, '').replace(/x\d+$/, '');
  assert(NAME_ECHO_STOPWORDS.has(tok.toLowerCase()) || c.after.score >= 55, 'nameEcho dropped on non-stopword token ' + tok + ' @ ' + c.unit);
});

const report = {
  ok: fails.length === 0, fails,
  units: { corpus: rows.filter(r => r.kind === 'corpus').length, spans: spanRows.length },
  table, nameEchoChanges, nameEchoStill, anchors,
  unitCases: { theFP: theB.nameEcho, dialogueOnly: dlg.nameEcho, curlyDialogue: cdl.nameEcho, narrEcho: nar.nameEcho, mixed: mix.nameEcho },
  spans: spanRows.map(s => ({ unit: s.unit, expected: s.expected, beforeFailed: s.combined.beforeFailed, afterFailed: s.combined.afterFailed, newMisses: s.newMisses, nameEchoFpRemoved: s.fpRemoved, aloneAfterFailed: s.alone.afterFailed })),
  corpusRows: rows.filter(r => r.kind === 'corpus').map(r => ({ unit: r.unit, beforeFailed: r.beforeFailed, afterFailed: r.afterFailed, nameEcho: r.nameEcho }))
};
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'B5_0_NAMEECHO_SMOKE.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: report.ok, fails, units: report.units, table, nameEchoChanges, nameEchoStill, anchors, spans: report.spans, unitCases: report.unitCases }, null, 2));
if (!report.ok) { console.error('B5-0 NAMEECHO SMOKE FAIL'); process.exit(1); }
console.log('B5-0 NAMEECHO SMOKE PASS');
