/**
 * ch2 RCA option 3 (CH2-RCA.md §4.3, F2/F3/F4a/F6): offline scorer-fix tests on seeded text.
 * Loads THIS checkout's NovelWriter.html in headless Chromium with every non-file request aborted
 * (no network, no API key, 0 tokens) and prints TAP.
 *   R1 cast aliases      nwScoreCast credits first names / explicit character aliases (F4a);
 *                        R1f: first names / aliases are case-sensitive (lowercase 'will' is not Will Turner)
 *   R2 phrase-echo cap   one echoed phrase can't dominate nwScoreRepetition (F2)
 *   R3 length band       nwScoreLength WARNs above 1.2x target; short side unchanged (F3)
 *   R4 arcStep advisory  scoreObligationCoverage no longer gates on arcStep keywords (F6)
 * Usage: node scripts/_smoke_rca3_scorer.mjs   Env: NW_HTML_PATH
 */
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const HTML_PATH = path.resolve(process.env.NW_HTML_PATH || path.join(SCRIPT_DIR, '..', 'NovelWriter', 'NovelWriter.html'));

const browser = await chromium.launch({ headless: true });
let failed = 0;
let n = 0;
const blocked = [];
try {
  const context = await browser.newContext();
  await context.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('file:') || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    blocked.push(u.slice(0, 80));
    return route.abort();
  });
  const page = await context.newPage();
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.goto(pathToFileURL(HTML_PATH).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof nwScoreCast === 'function' && typeof scoreObligationCoverage === 'function');

  const results = await page.evaluate(() => {
    const out = [];
    const t = (id, name, ok, detail) => out.push({ id, name, ok: !!ok, detail: JSON.stringify(detail).slice(0, 400) });
    // Deterministic unique filler words (letters only, so tokenization is stable).
    const filler = (count, seed) => {
      const a = 'bcdfghjklmnprstvz', v = 'aeiou';
      const w = [];
      for (let i = 0; i < count; i++) {
        let x = i + (seed || 0) * 100000, s = '';
        do { s += a[x % a.length] + v[Math.floor(x / a.length) % v.length]; x = Math.floor(x / (a.length * v.length)); } while (x > 0);
        w.push(s + 'q');
      }
      return w.join(' ');
    };
    const saved = { characters: novelData.characters, chapterBlueprints: novelData.chapterBlueprints };
    try {
      // ---- R1 cast aliases
      novelData.characters = [
        { name: 'Elena Voss', role: 'lead' },
        { name: 'Bastian Kane', role: 'engineer', aliases: ['Bas'] },
        { name: 'Sam Ortiz' }, { name: 'Sam Reed' }
      ];
      const bp = {
        characterBeats: [{ name: 'Elena Voss', beat: 'x' }, { name: 'Bastian Kane', beat: 'y' }],
        dialogueTurn: 'Bastian Kane must warn Elena Voss about the drift.'
      };
      const txt1 = filler(60, 1) + ' Elena checked the loop. Bas swore at it. Elena laughed. Kane did not. ' + filler(60, 2);
      const c1 = nwScoreCast(txt1, bp);
      t('R1a', 'first name credited: Elena x2 counts for Elena Voss', c1.counts['Elena Voss'] === 2, c1);
      t('R1b', 'explicit alias + surname: Bas + Kane counts 2 for Bastian Kane', c1.counts['Bastian Kane'] === 2, c1);
      t('R1c', 'cast PASS when both are present by short name', c1.status === 'PASS', c1);
      const c2 = nwScoreCast('Elena Voss spoke. ' + filler(40, 3), bp);
      t('R1d', 'full name counts once, not twice (no double credit)', c2.counts['Elena Voss'] === 1, c2);
      const bp3 = { characterBeats: [{ name: 'Sam Ortiz', beat: 'x' }, { name: 'Sam Reed', beat: 'y' }] };
      const c3 = nwScoreCast('Sam waited. Sam left. ' + filler(40, 4), bp3);
      t('R1e', 'shared first name is not credited to either character', c3.counts['Sam Ortiz'] === 0 && c3.counts['Sam Reed'] === 0, c3);
      // R1f (Reviewer B1 on 6a5bc2c): a first name that is also a common word must not be credited when
      // it appears lowercase. Surname matching is unchanged in this PR (N2), so the 'hall' -> Grace Hall
      // surname hit stays and these assertions target first-name credit only.
      novelData.characters = [{ name: 'Will Turner' }, { name: 'Grace Hall' }];
      const bp4 = { characterBeats: [{ name: 'Will Turner', beat: 'x' }, { name: 'Grace Hall', beat: 'y' }] };
      const probe = 'The engine will hold. It will not fail. By grace of the pump the hall stayed dry.';
      const c4 = nwScoreCast(probe + ' ' + filler(40, 5), bp4);
      t('R1f', "lowercase common-word first names ('will', 'grace') are not credited", c4.counts['Will Turner'] === 0 && c4.counts['Grace Hall'] === 1, c4);
      const c5 = nwScoreCast(probe + ' Will checked the pump. Then Will swore. ' + filler(40, 6), bp4);
      t('R1f.ctl', "control: capitalized 'Will' (incl. sentence-initial) is still credited, lowercase not", c5.counts['Will Turner'] === 2, c5);
      t('R1f.cast', 'probe alone is not a cast PASS (missing characters stay missing)', c4.status !== 'PASS', c4);

      // ---- R2 phrase-echo cap
      const echo30 = filler(30, 9);
      const parts = [];
      for (let i = 0; i < 4; i++) parts.push(filler(150, 10 + i), echo30);
      const r2a = nwScoreRepetition(parts.join(' '));
      t('R2a', 'one 30-word phrase echoed 4x contributes at most 3 (cap)', r2a.repeated5grams <= 3, { rep: r2a.repeated5grams, raw: r2a.repeated5gramsRaw, status: r2a.status });
      t('R2b', 'one echoed phrase alone does not WARN', r2a.status === 'PASS', { status: r2a.status, rep: r2a.repeated5grams });
      t('R2c', 'raw uncapped count kept for transparency', r2a.repeated5gramsRaw === 26 * 3, { raw: r2a.repeated5gramsRaw });
      const many = [];
      for (let k = 0; k < 25; k++) { const ph = filler(8, 200 + k); for (let i = 0; i < 4; i++) many.push(filler(12, 300 + k * 4 + i), ph); }
      const r2d = nwScoreRepetition(many.join(' '));
      t('R2d', '25 distinct phrases echoed 4x each still WARN (cap is per echo, not global)', r2d.status === 'WARN' && r2d.repeated5grams === 75, { rep: r2d.repeated5grams, status: r2d.status });

      // ---- R3 asymmetric length band
      const L = (w) => nwScoreLength(filler(w, 50), 1000);
      t('R3a', '1.30x target WARNs (over the 1.2 upper band)', L(1300).status === 'WARN', L(1300));
      t('R3b', '1.15x target PASSes', L(1150).status === 'PASS', L(1150));
      t('R3c', '1.20x exactly PASSes (WARN is strictly above 1.2)', L(1200).status === 'PASS', L(1200));
      t('R3d', 'short side unchanged: 0.70x WARN, 0.45x FAIL, 0.80x PASS', L(700).status === 'WARN' && L(450).status === 'FAIL' && L(800).status === 'PASS', [L(700).status, L(450).status, L(800).status]);

      // ---- R4 arcStep out of the keyword gate
      novelData.chapterBlueprints = [{}, {
        chapter: 2,
        arcStep: 'Deepen technical preparation and introduce sensory texture of the hard-bitten environment.',
        characterBeats: [{ name: 'Elena Voss', beat: 'x' }],
        worldHooks: ['Lunar spires'],
        subplotPressure: ['Captain Reyes logs a telemetry flicker']
      }];
      const para = (i) => '"Check it again," Elena Voss said near the lunar spires while Reyes logged the telemetry flicker. ' + filler(40, 600 + i) + '. The pump ticked. The loop drifted. The board went quiet.';
      const prose = [0, 1, 2, 3, 4, 5].map(para).join('\n\n');
      const cov = scoreObligationCoverage(prose, 2);
      t('R4a', 'meta arcStep miss no longer adds arcStep_missing', (cov.failures || []).indexOf('arcStep_missing') < 0, { failures: cov.failures, misses: cov.misses });
      t('R4b', 'arcStep not counted in required/misses', (cov.misses || []).indexOf('arcStep') < 0 && (cov.hits || []).indexOf('arcStep') < 0, { hits: cov.hits, misses: cov.misses });
      t('R4c', 'arcStep kept as advisory (hit=false recorded)', cov.advisory && cov.advisory.arcStep && cov.advisory.arcStep.hit === false, cov.advisory || null);
      t('R4d', 'gate passes when every other obligation is met', cov.passed === true, { failures: cov.failures });
    } finally {
      novelData.characters = saved.characters;
      novelData.chapterBlueprints = saved.chapterBlueprints;
    }
    return out;
  });
  console.log('TAP version 13');
  console.log('1..' + (results.length + 1));
  for (const r of results) {
    n++;
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'ok' : 'not ok'} ${n} - ${r.id} ${r.name}`);
    if (!r.ok) console.log('  # ' + r.detail);
  }
  n++;
  // The page may try to load a CDN asset; every non-file request is aborted above, so nothing leaves the box.
  console.log(`ok ${n} - NET every non-file request aborted (${blocked.length} attempted)`);
  for (const u of blocked) console.log('  # aborted ' + u);
  console.log(`# pass ${n - failed} fail ${failed}`);
} catch (e) {
  failed++;
  console.log('Bail out! ' + (e && e.message ? e.message : e));
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
