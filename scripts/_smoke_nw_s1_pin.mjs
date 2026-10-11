/**
 * REQ-SCH-10: re-run the nw-s1 Step 0 fixture (pinned to #153) against this S1 head.
 * Seeded nwOpaqueId ids must match expected.json exactly. Prints PASS/FAIL per check id.
 *
 *   node scripts/_smoke_nw_s1_pin.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const HTML_PATH = path.resolve(process.env.NW_HTML_PATH || path.join(REPO_ROOT, 'NovelWriter', 'NovelWriter.html'));
const OUT_DIR = path.resolve(process.env.NW_OUT_DIR || path.join(REPO_ROOT, 'out', 'nw-smoke'));
const PIN_DIR = path.join(REPO_ROOT, 'NovelWriter', 'fixtures', 'nw-s1');

for (const k of ['XAI_API_KEY', 'GROK_API_KEY', 'NW_E2E_LIVE']) delete process.env[k];

const checks = [];
const check = (id, name, ok, detail) => checks.push({ id, name, ok: !!ok, detail: ok ? '' : String(detail == null ? '' : detail).slice(0, 1400) });
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const session = JSON.parse(fs.readFileSync(path.join(PIN_DIR, 'session.json'), 'utf8'));
const expected = JSON.parse(fs.readFileSync(path.join(PIN_DIR, 'expected.json'), 'utf8'));

const browser = await chromium.launch({ headless: true });
const pageErrors = [];
const page = await browser.newPage();
page.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));
page.on('dialog', (d) => d.dismiss().catch(() => {}));
await page.route('**/*', async (route) => {
  const url = route.request().url();
  if (!/^https?:/i.test(url)) return route.continue();
  return route.abort('blockedbyclient');
});
await page.goto(pathToFileURL(HTML_PATH).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof nwMigrateSession === 'function', null, { timeout: 30000 });
await page.evaluate(() => { window.callAI = async function () { throw new Error('nw-s1 pin: no AI'); }; });

const r = await page.evaluate(({ session, seed }) => {
  nwSetOpaqueRng(nwSeededRng(seed));
  const n = normalizeImportedSessionData(session);
  const nd = nwMigrateSession(n.novelData);
  const sc = nd.chapterScenes || [];
  const sceneMigratedBy = [];
  (sc || []).forEach((rec) => (rec && rec.scenes || []).forEach((s) => { if (s && 'migratedBy' in s) sceneMigratedBy.push(s.id); }));
  return {
    nwSchemaVersion: nd.nwSchemaVersion,
    chapterIds: nd.chapterIds,
    sceneIds: (sc || []).filter(Boolean).map((rec) => rec.scenes && rec.scenes[0] && rec.scenes[0].id),
    sources: (sc || []).filter(Boolean).map((rec) => rec.scenes && rec.scenes[0] && rec.scenes[0].source),
    approved: (sc || []).filter(Boolean).map((rec) => rec.scenes && rec.scenes[0] && rec.scenes[0].breakApproved),
    spans: (sc || []).filter(Boolean).map((rec) => rec.scenes && rec.scenes[0] && rec.scenes[0].span),
    migratedBy: nd.ext && nd.ext.novelWriter && nd.ext.novelWriter.migratedBy,
    sceneMigratedBy,
    core: (sc[0] && sc[0].scenes && sc[0].scenes[0]) ? ['id', 'chapterId', 'order', 'breakApproved'].every((k) => k in sc[0].scenes[0]) : false
  };
}, { session, seed: expected.seed });

check('nw-s1', 'nwSchemaVersion 1', r.nwSchemaVersion === expected.nwSchemaVersion, JSON.stringify(r.nwSchemaVersion));
check('nw-s1', 'exact seeded chapterIds', eq(r.chapterIds, expected.chapterIds), JSON.stringify({ got: r.chapterIds, expected: expected.chapterIds }));
check('nw-s1', 'exact seeded sceneIds', eq(r.sceneIds, expected.sceneIds), JSON.stringify({ got: r.sceneIds, expected: expected.sceneIds }));
check('nw-s1', 'source import, breakApproved false, no span', r.sources.every((s) => s === expected.source) && r.approved.every((a) => a === expected.breakApproved) && r.spans.every((s) => s == null), JSON.stringify({ sources: r.sources, approved: r.approved, spans: r.spans }));
check('nw-s1', 'session-level migratedBy S1; no scene-level migratedBy', r.migratedBy === expected.migratedBy && r.sceneMigratedBy.length === 0, JSON.stringify({ migratedBy: r.migratedBy, sceneMigratedBy: r.sceneMigratedBy }));
check('nw-s1', 'scene core fields present', r.core === true, JSON.stringify(r.core));
check('pageerror', 'no uncaught pageerror', pageErrors.length === 0, pageErrors.join(' | '));

await browser.close();
const failed = checks.filter((c) => !c.ok);
const report = { passed: checks.filter((c) => c.ok).length, failed: failed.length, checks, pageErrors };
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'SMOKE_NW_S1_PIN.json'), JSON.stringify(report, null, 2));
console.log('NW s1 pin smoke: ' + report.passed + ' passed, ' + report.failed + ' failed');
for (const c of checks) {
  console.log((c.ok ? 'PASS' : 'FAIL') + ' [' + c.id + '] ' + c.name + (c.ok ? '' : ' :: ' + c.detail));
}
if (failed.length) process.exit(1);
