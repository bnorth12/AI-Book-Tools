/**
 * Offline smoke (PR1 carry-in 1): EvidencePack producers in NovelWriter.html validate against
 * schema/evidence-pack-0.1.json (ajv, draft-07). No network: every http(s) request is aborted.
 *
 *   - buildEvidencePack(query)                      (_meta.source 'novelData-local')
 *   - retrieveChapterContextEvidence(chapter, hint) (_meta.source 'chapterBlueprints-local')
 * Both with kb ON and OFF. _meta.estimatedTokens must be an integer; readers trust _meta.kbEnabled
 * (the optional top-level kbEnabled is only an echo).
 *
 * Usage: node scripts/_smoke_evidence_pack_schema.mjs   Env: NW_HTML_PATH (default this checkout)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright';
import Ajv from 'ajv';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const HTML_PATH = path.resolve(process.env.NW_HTML_PATH || path.join(REPO_ROOT, 'NovelWriter', 'NovelWriter.html'));
const SCHEMA = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'schema', 'evidence-pack-0.1.json'), 'utf8'));
const SEED = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'NovelWriter', 'fixtures', 'rich-scifi-v1', 'novelData.seed.json'), 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(SCHEMA);
const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: ok ? '' : String(detail || '') });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.route('**/*', (route) => (/^https?:/i.test(route.request().url()) ? route.abort('blockedbyclient') : route.continue()));
page.on('dialog', (d) => d.dismiss().catch(() => {}));
await page.goto(pathToFileURL(HTML_PATH).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof buildEvidencePack === 'function' && typeof retrieveChapterContextEvidence === 'function', null, { timeout: 30000 });

const packs = await page.evaluate((seed) => {
  const keys = ['title', 'genre', 'storyArc', 'generalPlot', 'setting', 'characters', 'subplots', 'world', 'worldBible', 'authorStyle', 'styleGuide',
    'numChapters', 'chapterLength', 'novelOutline', 'plotOutline', 'storyArcOutline', 'chapterBlueprints', 'chapterOutlines', 'motifs'];
  keys.forEach((k) => { if (seed[k] != null) novelData[k] = JSON.parse(JSON.stringify(seed[k])); });
  if (!novelData.worldBible && seed.world) novelData.worldBible = seed.world;
  const out = {};
  for (const kb of [true, false]) {
    setKbEnabled(kb);
    out['buildEvidencePack kb=' + kb] = buildEvidencePack({ goal: 'schema-smoke', chapter: 1, tokenBudgetHint: 1500 });
    out['retrieveChapterContextEvidence kb=' + kb] = retrieveChapterContextEvidence(1, 1200);
  }
  return out;
}, SEED);
await browser.close();

for (const [name, pack] of Object.entries(packs)) {
  const ok = validate(pack);
  check(name + ': valid against schema/evidence-pack-0.1.json', ok, JSON.stringify(validate.errors || []).slice(0, 600));
  const meta = pack && pack._meta;
  check(name + ': _meta.estimatedTokens is an integer', meta && Number.isInteger(meta.estimatedTokens), JSON.stringify(meta));
  check(name + ': _meta.kbEnabled is boolean', meta && typeof meta.kbEnabled === 'boolean', JSON.stringify(meta));
  const kbWanted = / kb=true$/.test(name);
  check(name + ': _meta.kbEnabled reflects the toggle', meta && meta.kbEnabled === kbWanted, JSON.stringify(meta));
}
check('buildEvidencePack source is novelData-local', packs['buildEvidencePack kb=true']._meta.source === 'novelData-local', JSON.stringify(packs['buildEvidencePack kb=true']._meta));
check('retrieveChapterContextEvidence source is chapterBlueprints-local', packs['retrieveChapterContextEvidence kb=true']._meta.source === 'chapterBlueprints-local', JSON.stringify(packs['retrieveChapterContextEvidence kb=true']._meta));

const failed = checks.filter((c) => !c.ok);
for (const c of checks) process.stdout.write((c.ok ? 'PASS ' : 'FAIL ') + c.name + (c.ok ? '' : ' :: ' + c.detail) + '\n');
process.stdout.write('\nEVIDENCE PACK SCHEMA SMOKE: ' + (failed.length ? 'FAIL' : 'PASS') + ' (' + (checks.length - failed.length) + '/' + checks.length + ')\n');
process.exit(failed.length ? 1 : 0);