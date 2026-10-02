/**
 * PR2 offline in-page smoke (no LLM, no API key): loads THIS checkout's NovelWriter.html in headless
 * Chromium and runs the C3 / QE1-6 smokes plus the anti-slop helpers. Asserts every smoke PASSes and
 * that the smokes leave novelData (chapters, characters, continuity, quality logs) unchanged.
 * Also (#129 review): one Update Chapter with staged notes makes exactly 1 LLM call (callAI stubbed and
 * counted, never live), notes staged during the run still trigger the residual pass, and
 * syncChapterTextToDom writes only the gen/edit prose textareas.
 * Usage: node scripts/_smoke_nw_quality_html.mjs   (see scripts/README.md)
 * Env: NW_HTML_PATH (default NovelWriter/NovelWriter.html), NW_OUT_DIR (default out/nw-smoke)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright';
import { scoreNameEcho } from './_nw_slop_tells_snippet.mjs';

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
  // Full novelData snapshot (Copilot r4170466061): every top-level key must survive the smokes unchanged.
  const snapObj = () => Object.fromEntries(Object.keys(novelData).sort().map(k => [k, JSON.stringify(novelData[k])]));
  const snap = () => JSON.stringify(snapObj());
  const before = snap();
  const beforeObj = snapObj();
  const out = {};
  for (const fn of ['runC3Smoke', 'runQe123Smoke', 'runQe4Smoke', 'runQe5Smoke', 'runQe6Smoke']) {
    try { out[fn] = await window[fn](); } catch (e) { out[fn] = 'THREW ' + (e && e.message ? e.message : e); }
  }
  const after = snap();
  const afterObj = snapObj();
  const changedKeys = [...new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)])].filter(k => beforeObj[k] !== afterObj[k]);
  const helpers = ['scoreProseQuality', 'runQualityGate', 'scoreSlopTells', 'buildAntiSlopReviseBrief', 'needsQualityMultiPass',
    'runTargetedQualityPass', 'reviseChapterForQuality', 'guardChapterReviseGrowth', 'applyE2eSlopInject', 'ensureQualityAfterGenerate',
    'applyBookCritiqueItem', 'applyTopBookCritiques', 'applyStagedChapterImprovements'].filter(n => typeof window[n] !== 'function' && typeof eval(n) !== 'function');
  // Detector shape; the B5-0 nameEcho port is exercised directly against the in-page _scoreNameEchoTell below.
  const tell = scoreSlopTells('Kwan told Kwan that Kwan would not sign what Kwan had refused.');
  // growth guard reverts runaway growth
  const base = Array(10).fill('A paragraph of ordinary prose that is long enough to count here.').join('\n\n');
  novelData.chapters[0] = base + ' x'.repeat(4000);
  const g = guardChapterReviseGrowth(1, base, novelData.chapters[0], { source: 'smoke' });
  const reverted = g.reverted === true && novelData.chapters[0] === base;
  return { out, unchanged: before === after, changedKeys, missingHelpers: helpers, nameEchoFoul: !tell.tells.nameEcho.ok, tells: Object.keys(tell.tells), guardReverted: reverted };
});

// ---- B5-0 nameEcho port: run the HTML's own _scoreNameEchoTell (in-page) ----
const FIX = path.join(SCRIPT_DIR, 'fixtures');
const neCases = {
  theX3: 'The door opened onto the quay. The room beyond it was cold. The lamp above the desk flickered twice.',
  theFP: 'The door opened onto the quay. The room was cold. The lamp above it flickered twice. The rain kept falling on ceramic posts.',
  algorithm: 'Algorithm Two voted. Algorithm One demanded. Algorithm Three abstained.',
  truePositive: 'Kwan told Kwan that Kwan would not sign what Kwan had refused yesterday when Kwan arrived.'
};
// parity corpus: every nw_slop annex chapter, inject span (alone + appended to its base chapter), slop_corpus txt
const parity = {};
const annex = {};
for (const f of fs.readdirSync(path.join(FIX, 'nw_slop', 'annex_chapters')).filter(f => f.endsWith('.json'))) {
  const id = f.replace(/\.json$/, '');
  annex[id] = (JSON.parse(fs.readFileSync(path.join(FIX, 'nw_slop', 'annex_chapters', f), 'utf8')).chapters || []).map(t => String(t || '').trim());
  annex[id].forEach((t, i) => { parity[id + ' Ch' + (i + 1)] = t; });
}
for (const m of JSON.parse(fs.readFileSync(path.join(FIX, 'nw_slop', 'inject_spans', '_spans_meta.json'), 'utf8'))) {
  const span = fs.readFileSync(path.join(FIX, 'nw_slop', 'inject_spans', m.file), 'utf8');
  parity['span ' + m.file] = span;
  const base = (annex[m.annex] || [])[m.ch - 1] || '';
  parity['span+base ' + m.file] = base.replace(/\s+$/, '') + '\n\n' + span;
}
for (const f of fs.readdirSync(path.join(FIX, 'slop_corpus')).filter(f => f.endsWith('.txt'))) parity['slop_corpus ' + f] = fs.readFileSync(path.join(FIX, 'slop_corpus', f), 'utf8');
// every file under scripts/fixtures (all 16): raw file text, plus each chapter of any JSON with a chapters[] array
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const fixtureFiles = walk(FIX).map(f => path.relative(FIX, f).split(path.sep).join('/')).sort();
for (const rel of fixtureFiles) {
  const raw = fs.readFileSync(path.join(FIX, rel), 'utf8');
  parity['file ' + rel] = raw;
  if (rel.endsWith('.json')) {
    const j = JSON.parse(raw.replace(/^\uFEFF/, ''));
    if (j && Array.isArray(j.chapters)) j.chapters.forEach((t, i) => { parity['file ' + rel + ' Ch' + (i + 1)] = String(t || ''); });
  }
}
const all = { ...Object.fromEntries(Object.entries(neCases).map(([k, v]) => ['case ' + k, v])), ...parity };
const htmlNe = await page.evaluate(texts => {
  const o = {};
  for (const [k, t] of Object.entries(texts)) o[k] = _scoreNameEchoTell(t);
  return o;
}, all);
const neFails = [];
if (htmlNe['case theX3'].score !== 0) neFails.push('theX3 (The x3 sentence-initial) must score 0: ' + JSON.stringify(htmlNe['case theX3']));
if (htmlNe['case theFP'].score !== 0) neFails.push('theFP (The x4 sentence-initial) must score 0: ' + JSON.stringify(htmlNe['case theFP']));
const algSnip = scoreNameEcho(neCases.algorithm);
if (!(htmlNe['case algorithm'].score >= 55) || htmlNe['case algorithm'].score !== algSnip.score) neFails.push('Algorithm x3 must foul like snippet: ' + JSON.stringify({ html: htmlNe['case algorithm'], snippet: algSnip }));
if (!(htmlNe['case truePositive'].score >= 55) || !/Kwan/.test(htmlNe['case truePositive'].hits.join())) neFails.push('true-positive Kwan echo must foul: ' + JSON.stringify(htmlNe['case truePositive']));
const parityMismatch = [];
for (const k of Object.keys(all)) {
  const sn = scoreNameEcho(all[k]);
  if (sn.score !== htmlNe[k].score || JSON.stringify(sn.hits) !== JSON.stringify(htmlNe[k].hits)) parityMismatch.push({ unit: k, html: htmlNe[k], snippet: sn });
}
if (fixtureFiles.length !== 16) neFails.push('expected 16 fixture files under scripts/fixtures, found ' + fixtureFiles.length);
if (parityMismatch.length) neFails.push('HTML vs snippet nameEcho parity mismatch on ' + parityMismatch.length + ' unit(s)');
const watch = ['A3R Ch5', 'B4 Ch4', 'B4 Ch5', 'span+base span_a3r_ch5_chapterecho.txt'];
watch.forEach(u => { if (!htmlNe[u] || htmlNe[u].score >= 55) neFails.push(u + ' nameEcho must not false-fail in HTML: ' + JSON.stringify(htmlNe[u])); });
result.nameEchoPort = {
  cases: Object.fromEntries(Object.keys(neCases).map(k => [k, htmlNe['case ' + k]])),
  parity: { units: Object.keys(all).length, fixtureFiles, mismatches: parityMismatch },
  fixtures: Object.fromEntries(watch.map(u => [u, htmlNe[u]])),
  fails: neFails
};
// ---- #129 review MUST-FIX 1: Update Chapter with notes = exactly 1 LLM call (callAI stubbed + counted) ----
// Clean prose (gate pass, all 7 tells pass, same length before/after so the growth guard is idle).
const cleanProse = JSON.parse(fs.readFileSync(path.join(FIX, 'nw_slop', 'annex_chapters', 'B3.json'), 'utf8').replace(/^\uFEFF/, '')).chapters[0];
result.updateChapterCalls = await page.evaluate(async prose => {
  const domIds = ['numChapters', 'chapterEditImprovement1', 'chapterEditContent1', 'chapterGenContent1', 'chapterContent1'];
  const domVal = () => Object.fromEntries(domIds.map(id => { const el = document.getElementById(id); return [id, el ? el.value : null]; }));
  const ndBefore = JSON.stringify(novelData);
  const nd0 = JSON.parse(ndBefore);
  const dom0 = domVal();
  const rl0 = JSON.stringify(requestLog);
  const realCallAI = window.callAI;
  const realAlert = window.alert;
  const r = { errors: [] };
  let calls = 0;
  let onCall = null;
  const NOTES = 'Tighten the dock scene: cut one stock gesture and add one concrete sound.';
  const setup = async () => {
    const numEl = document.getElementById('numChapters');
    if (numEl && !(parseInt(numEl.value, 10) >= 1)) numEl.value = '2';
    novelData.numChapters = 2;
    novelData.continuityFindings = [];
    novelData.continuityTracker = { chapters: [], characterArcProgress: [], storyArcProgress: {} };
    novelData.chapters = [prose, ''];
    novelData.chapterImprovements = [NOTES, ''];
    if (!document.getElementById('chapterEditImprovement1') && typeof updateChapterSubpages === 'function') await updateChapterSubpages();
    document.getElementById('chapterEditContent1').value = prose;
    document.getElementById('chapterGenContent1').value = prose; // collectData reads chapter prose from the DOM
    document.getElementById('chapterEditImprovement1').value = NOTES;
    calls = 0;
    onCall = null;
  };
  const kindsSince = n => (novelData.qualityMultiPassLog || []).slice(n).map(e => e.kind);
  window.alert = () => {};
  window.callAI = async () => { calls++; if (onCall) onCall(calls); return { chapter: prose }; };
  try {
    // A) one Update Chapter click with notes: pass 1 consumes the notes, no residual second call
    await setup();
    r.continuityClear = !getChapterContinuityFindings(1).hasAny;
    let mp0 = (novelData.qualityMultiPassLog || []).length;
    await applyStagedChapterImprovements(1);
    r.consumedNotes = { calls, kinds: kindsSince(mp0) };
    // B) genuinely new notes staged while pass 1 runs must still trigger the residual pass
    await setup();
    onCall = n => { if (n === 1) novelData.chapterImprovements[0] = 'NEW note staged during pass 1: give the harbourmaster one line of dialogue.'; };
    mp0 = (novelData.qualityMultiPassLog || []).length;
    await applyStagedChapterImprovements(1);
    r.newNotes = { calls, kinds: kindsSince(mp0) };
    // C) needsQualityMultiPass directly: consumed notes skip, unapplied notes trigger, legacy ctx unchanged
    await setup();
    const pass = { passed: true, failures: [] };
    const base = { passesDone: 1, didContinuityPass: false, didAntiSlopPass: false, afterApplyStaged: true };
    r.needConsumed = needsQualityMultiPass(1, pass, Object.assign({}, base, { consumedStagedNotes: NOTES })).reason;
    r.needUnapplied = needsQualityMultiPass(1, pass, Object.assign({}, base, { consumedStagedNotes: 'some older notes' })).reason;
    r.needLegacy = needsQualityMultiPass(1, pass, base).reason;
    // D) textarea sync (652a459): prose goes to chapterGenContent1/chapterEditContent1, never the Tab 4 outline box
    const outlineBefore = document.getElementById('chapterContent1').value;
    syncChapterTextToDom(1, 'SYNC-PROBE prose');
    r.textareaSync = document.getElementById('chapterGenContent1').value === 'SYNC-PROBE prose'
      && document.getElementById('chapterEditContent1').value === 'SYNC-PROBE prose'
      && document.getElementById('chapterContent1').value === outlineBefore;
  } catch (e) {
    r.errors.push(String(e && e.message ? e.message : e));
  } finally {
    window.callAI = realCallAI;
    window.alert = realAlert;
    Object.keys(novelData).forEach(k => { if (!(k in nd0)) delete novelData[k]; });
    Object.assign(novelData, nd0);
    Object.entries(dom0).forEach(([id, v]) => { const el = document.getElementById(id); if (el && v != null) el.value = v; });
    Object.assign(requestLog, JSON.parse(rl0));
    if (typeof updateRequestLog === 'function') updateRequestLog();
  }
  r.restored = JSON.stringify(novelData) === ndBefore && JSON.stringify(domVal()) === JSON.stringify(dom0)
    && JSON.stringify(requestLog) === rl0 && window.callAI === realCallAI && window.alert === realAlert;
  return r;
}, cleanProse);
{
  const u = result.updateChapterCalls;
  const f = [];
  if (u.errors.length) f.push('updateChapter call-count smoke threw: ' + u.errors.join(' | '));
  if (!u.continuityClear) f.push('call-count smoke setup: continuity findings not clear');
  if (!u.consumedNotes || u.consumedNotes.calls !== 1) f.push('one Update Chapter with notes must make exactly 1 LLM call, made ' + (u.consumedNotes && u.consumedNotes.calls) + ' (kinds ' + JSON.stringify(u.consumedNotes && u.consumedNotes.kinds) + ')');
  if (!u.newNotes || u.newNotes.calls !== 2 || u.newNotes.kinds.indexOf('residual-staged') < 0) f.push('notes staged during pass 1 must trigger residual-staged pass 2: ' + JSON.stringify(u.newNotes));
  if (u.needConsumed === 'residual-staged-notes') f.push('needsQualityMultiPass: consumed notes must not be residual');
  if (u.needUnapplied !== 'residual-staged-notes') f.push('needsQualityMultiPass: unapplied notes must be residual, got ' + u.needUnapplied);
  if (u.needLegacy !== 'residual-staged-notes') f.push('needsQualityMultiPass: ctx without consumedStagedNotes must stay residual, got ' + u.needLegacy);
  if (!u.textareaSync) f.push('syncChapterTextToDom must write chapterGenContent1 + chapterEditContent1 and leave chapterContent1');
  if (!u.restored) f.push('call-count smoke did not restore novelData / DOM / requestLog / callAI');
  u.fails = f;
}
await browser.close();

const fails = [];
for (const [k, v] of Object.entries(result.out)) if (v !== true) fails.push(k + ' -> ' + v);
if (!result.unchanged) fails.push('smokes mutated novelData (state not restored): ' + result.changedKeys.join(','));
if (result.missingHelpers.length) fails.push('missing helpers: ' + result.missingHelpers.join(','));
if (!result.nameEchoFoul) fails.push('nameEcho narration should foul');
if (result.tells.length !== 7) fails.push('expected 7 tells, got ' + result.tells.join(','));
if (!result.guardReverted) fails.push('guardChapterReviseGrowth did not revert runaway growth');
fails.push(...result.nameEchoPort.fails);
fails.push(...result.updateChapterCalls.fails);
if (pageErrors.length) fails.push('page errors: ' + pageErrors.join(' | '));
const report = { ok: fails.length === 0, fails, html: path.relative(REPO_ROOT, HTML_PATH).split(path.sep).join('/'), ...result };
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'NW_QUALITY_HTML_SMOKE.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.ok) { console.error('NW QUALITY HTML SMOKE FAIL'); process.exit(1); }
console.log('NW QUALITY HTML SMOKE PASS');