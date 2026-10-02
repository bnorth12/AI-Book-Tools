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
const all = { ...Object.fromEntries(Object.entries(neCases).map(([k, v]) => ['case ' + k, v])), ...parity };
const htmlNe = await page.evaluate(texts => {
  const o = {};
  for (const [k, t] of Object.entries(texts)) o[k] = _scoreNameEchoTell(t);
  return o;
}, all);
const neFails = [];
if (htmlNe['case theFP'].score !== 0) neFails.push('theFP (The x4 sentence-initial) must score 0: ' + JSON.stringify(htmlNe['case theFP']));
const algSnip = scoreNameEcho(neCases.algorithm);
if (!(htmlNe['case algorithm'].score >= 55) || htmlNe['case algorithm'].score !== algSnip.score) neFails.push('Algorithm x3 must foul like snippet: ' + JSON.stringify({ html: htmlNe['case algorithm'], snippet: algSnip }));
if (!(htmlNe['case truePositive'].score >= 55) || !/Kwan/.test(htmlNe['case truePositive'].hits.join())) neFails.push('true-positive Kwan echo must foul: ' + JSON.stringify(htmlNe['case truePositive']));
const parityMismatch = [];
for (const k of Object.keys(all)) {
  const sn = scoreNameEcho(all[k]);
  if (sn.score !== htmlNe[k].score || JSON.stringify(sn.hits) !== JSON.stringify(htmlNe[k].hits)) parityMismatch.push({ unit: k, html: htmlNe[k], snippet: sn });
}
if (parityMismatch.length) neFails.push('HTML vs snippet nameEcho parity mismatch on ' + parityMismatch.length + ' unit(s)');
const watch = ['A3R Ch5', 'B4 Ch4', 'B4 Ch5', 'span+base span_a3r_ch5_chapterecho.txt'];
watch.forEach(u => { if (!htmlNe[u] || htmlNe[u].score >= 55) neFails.push(u + ' nameEcho must not false-fail in HTML: ' + JSON.stringify(htmlNe[u])); });
result.nameEchoPort = {
  cases: Object.fromEntries(Object.keys(neCases).map(k => [k, htmlNe['case ' + k]])),
  parity: { units: Object.keys(all).length, mismatches: parityMismatch },
  fixtures: Object.fromEntries(watch.map(u => [u, htmlNe[u]])),
  fails: neFails
};
await browser.close();

const fails = [];
for (const [k, v] of Object.entries(result.out)) if (v !== true) fails.push(k + ' -> ' + v);
if (!result.unchanged) fails.push('smokes mutated novelData (state not restored): ' + result.changedKeys.join(','));
if (result.missingHelpers.length) fails.push('missing helpers: ' + result.missingHelpers.join(','));
if (!result.nameEchoFoul) fails.push('nameEcho narration should foul');
if (result.tells.length !== 7) fails.push('expected 7 tells, got ' + result.tells.join(','));
if (!result.guardReverted) fails.push('guardChapterReviseGrowth did not revert runaway growth');
fails.push(...result.nameEchoPort.fails);
if (pageErrors.length) fails.push('page errors: ' + pageErrors.join(' | '));
const report = { ok: fails.length === 0, fails, html: path.relative(REPO_ROOT, HTML_PATH).split(path.sep).join('/'), ...result };
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'NW_QUALITY_HTML_SMOKE.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.ok) { console.error('NW QUALITY HTML SMOKE FAIL'); process.exit(1); }
console.log('NW QUALITY HTML SMOKE PASS');