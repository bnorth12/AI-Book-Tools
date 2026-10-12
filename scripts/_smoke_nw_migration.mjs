/**
 * Offline smoke for NW S1 schema + scenes (ARCHITECTURE.md §4.4).
 * No network, no API key: callAI is replaced by a throw. Prints each check id PASS/FAIL.
 *
 *   node scripts/_smoke_nw_migration.mjs
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const HTML_PATH = path.resolve(process.env.NW_HTML_PATH || path.join(REPO_ROOT, 'NovelWriter', 'NovelWriter.html'));
const OUT_DIR = path.resolve(process.env.NW_OUT_DIR || path.join(REPO_ROOT, 'out', 'nw-smoke'));
const FIX_DIR = path.join(REPO_ROOT, 'NovelWriter', 'fixtures', 'nw-migration');
const SEED = 0x53310001;

for (const k of ['XAI_API_KEY', 'GROK_API_KEY', 'NW_E2E_LIVE']) delete process.env[k];

const checks = [];
const check = (id, name, ok, detail) => checks.push({ id, name, ok: !!ok, detail: ok ? '' : String(detail == null ? '' : detail).slice(0, 1600) });
const clone = (o) => JSON.parse(JSON.stringify(o));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const HTML = fs.readFileSync(HTML_PATH, 'utf8');

function mutateCopy(from, to) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-s1-mig-'));
  const copy = path.join(dir, 'NovelWriter.html');
  if (HTML.indexOf(from) < 0) return { ok: false, copy: null, dir, detail: 'flag not found: ' + from };
  fs.writeFileSync(copy, HTML.replace(from, to));
  return { ok: true, copy, dir };
}

const browser = await chromium.launch({ headless: true });
const pageErrors = [];
const warnings = [];

async function openPage(htmlPath) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));
  page.on('console', (msg) => {
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (!/^https?:/i.test(url)) return route.continue();
    return route.abort('blockedbyclient');
  });
  await page.goto(pathToFileURL(htmlPath || HTML_PATH).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof nwMigrateSession === 'function' && typeof normalizeImportedSessionData === 'function', null, { timeout: 30000 });
  await page.evaluate(() => {
    window.callAI = async function () { throw new Error('S1 smoke: callAI must not run'); };
  });
  return page;
}

function tokenizePath(p) {
  const out = [];
  String(p).replace(/([^.\[\]]+)|\[(\d+|\*)\]/g, (_, key, idx) => {
    if (key) out.push(key);
    else out.push(idx === '*' ? '*' : Number(idx));
    return '';
  });
  return out;
}

function getPath(obj, p) {
  const parts = tokenizePath(p);
  let cur = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

function hasPath(obj, p) {
  const parts = tokenizePath(p);
  let cur = obj;
  for (const part of parts) {
    if (cur == null || !Object.prototype.hasOwnProperty.call(cur, part)) return false;
    cur = cur[part];
  }
  return true;
}

function deletePath(obj, p) {
  const parts = tokenizePath(p);
  if (!parts.length) return;
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur == null) return;
    cur = cur[parts[i]];
  }
  if (cur && typeof cur === 'object') delete cur[parts[parts.length - 1]];
}

function expandKeys(keys, input, output) {
  const out = [];
  for (const k of keys) {
    if (!k.includes('[*]')) { out.push(k); continue; }
    const [pre, post] = k.split('[*]');
    const arrPath = pre.replace(/\.$/, '');
    const arr = getPath(output, arrPath);
    if (!Array.isArray(arr)) continue;
    for (let i = 0; i < arr.length; i++) {
      const candidate = arrPath + '[' + i + ']' + (post || '');
      if (post) {
        if (hasPath(output, candidate) && !hasPath(input, candidate)) out.push(candidate);
      } else if (arr[i] != null && !hasPath(input, arrPath + '[' + i + ']')) {
        out.push(arrPath + '[' + i + ']');
      }
    }
  }
  return out;
}

function stripAdded(output, added) {
  const copy = clone(output);
  for (const p of added) deletePath(copy, p);
  return copy;
}

function pathPrefix(path, parts) {
  let p = '';
  for (const part of parts) {
    p = typeof part === 'number' ? p + '[' + part + ']' : (p ? p + '.' + part : part);
  }
  return p;
}

function existingEqual(input, output, added) {
  const addedSet = new Set(added);
  function skip(p) {
    if (addedSet.has(p)) return true;
    for (const a of addedSet) {
      if (a.startsWith(p + '.') || a.startsWith(p + '[')) return false;
      if (p.startsWith(a + '.') || p.startsWith(a + '[')) return true;
    }
    return false;
  }
  function walk(a, b, parts) {
    const p = pathPrefix('', parts.length ? parts : []);
    const cur = parts.length ? pathPrefix('', parts) : '';
    if (cur && skip(cur)) return true;
    if (a === b) return true;
    if (a && typeof a === 'object' && b && typeof b === 'object') {
      const keys = Object.keys(a);
      for (const k of keys) {
        const next = parts.concat(Array.isArray(a) ? Number(k) : k);
        const np = pathPrefix('', next);
        if (skip(np)) continue;
        if (!walk(a[k], Array.isArray(b) ? b[k] : b[k], next)) return false;
      }
      return true;
    }
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return walk(input, output, []);
}

function inputNd(fx) {
  if (fx.input && fx.input.novelData && fx.input.batchRun) return fx.input.novelData;
  return fx.input;
}

const fixtureFiles = fs.readdirSync(FIX_DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_')).sort();

const page = await openPage();

{
  const threw = await page.evaluate(async () => {
    try { await callAI([], null, {}); return 'no-throw'; } catch (e) { return String(e && e.message || e); }
  });
  check('MIG:callAI-stub', 'callAI stub throws (no AI)', /must not run/.test(threw), threw);
}

for (const file of fixtureFiles) {
  const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, file), 'utf8'));
  const id = 'MIG:' + file.replace(/\.json$/, '');
  const helper = /^helper\b/i.test(String(fx.notes || '').trim());
  const isCk = file === 'v0-checkpoint-restore.json';
  const ndIn = inputNd(fx);
  warnings.length = 0;

  const result = await page.evaluate(({ nd, seed }) => {
    nwSetOpaqueRng(nwSeededRng(seed));
    const warns = [];
    const orig = console.warn;
    console.warn = function () { warns.push(Array.from(arguments).map(String).join(' ')); return orig.apply(console, arguments); };
    const input = JSON.parse(JSON.stringify(nd));
    const once = nwMigrateSession(JSON.parse(JSON.stringify(input)));
    nwSetOpaqueRng(nwSeededRng(seed));
    const twice = nwMigrateSession(JSON.parse(JSON.stringify(once)));
    console.warn = orig;
    return { once, twice, warns, input };
  }, { nd: ndIn, seed: SEED });

  const added = expandKeys(fx.expectedAddedKeys || [], result.input, result.once);
  const preEqual = existingEqual(result.input, result.once, added);
  const idem = eq(result.once, result.twice);
  const missing = added.filter((p) => !hasPath(result.once, p));

  if (!helper) {
    check(id, file + ' pre-existing keys deep-equal after stripping added', preEqual, JSON.stringify({ added, inputKeys: Object.keys(result.input), outKeys: Object.keys(result.once) }).slice(0, 800));
    check(id, file + ' expectedAddedKeys present', missing.length === 0, missing.join(','));
    check(id, file + ' idempotence migrate(migrate(x)) deep-equal', idem, 'mismatch');
  } else {
    check(id, file + ' loaded for helper tests', !!result.once, 'no output');
  }

  if (file === 'v0-pre6b-no-flags.json') {
    check('MIG:v0-pre6b-no-flags', 'no chapterFlags after migrate', !Object.prototype.hasOwnProperty.call(result.once, 'chapterFlags'), JSON.stringify(result.once.chapterFlags));
    check('MIG:v0-pre6b-no-flags', 'no storyLedger after migrate', !Object.prototype.hasOwnProperty.call(result.once, 'storyLedger'), JSON.stringify(result.once.storyLedger));
  }
  if (file === 'v0-worldbible-string.json') {
    const sw = result.once.storyWorld;
    check(id, 'storyWorld is {version, notes} only', sw && sw.version === 1 && typeof sw.notes === 'string' && Object.keys(sw).sort().join(',') === 'notes,version', JSON.stringify(sw));
  }
  if (file === 'v0-world-object.json') {
    check(id, 'no storyWorld', !Object.prototype.hasOwnProperty.call(result.once, 'storyWorld'), JSON.stringify(result.once.storyWorld));
    check(id, 'world byte-equal', eq(result.once.world, result.input.world), 'world changed');
  }
  if (file === 'v0-no-world.json') {
    check(id, 'no storyWorld', !Object.prototype.hasOwnProperty.call(result.once, 'storyWorld'), JSON.stringify(result.once.storyWorld));
  }
  if (file === 'v0-characters-rich.json') {
    const ids = (result.once.characters || []).map((c) => c && c.id);
    check(id, 'ids ana, ana-2, zoe', eq(ids, ['ana', 'ana-2', 'zoe']), JSON.stringify(ids));
  }
  if (file === 'v0-factchecks-legacy.json') {
    check(id, 'legacy chapterFactChecks byte-equal', eq(result.once.chapterFactChecks, result.input.chapterFactChecks), 'legacy changed');
    const items0 = result.once.chapterRequiredFacts && result.once.chapterRequiredFacts[0] && result.once.chapterRequiredFacts[0].items;
    check(id, 'probes not mapped; include+exclude mapped', Array.isArray(items0) && items0.length === 2 && items0.every((it) => it.source === 'user'), JSON.stringify(items0));
  }
  if (file === 'v0-required-facts-present.json') {
    check(id, 'entry [0] deep-equal', eq(result.once.chapterRequiredFacts[0], result.input.chapterRequiredFacts[0]), JSON.stringify(result.once.chapterRequiredFacts[0]));
    check(id, 'entry [1] added from legacy', !!(result.once.chapterRequiredFacts && result.once.chapterRequiredFacts[1]), 'missing [1]');
  }
  if (file === 'v0-cast-unresolved.json') {
    const cast = result.once.chapterRequirements && result.once.chapterRequirements[0] && result.once.chapterRequirements[0].cast;
    check(id, 'unresolved cast kept as text', Array.isArray(cast) && cast.indexOf('NobodyHere') >= 0, JSON.stringify(cast));
  }
  if (file === 'v2-newer-version.json') {
    check(id, 'newer version read-through (no added keys, version 2)', result.once.nwSchemaVersion === 2 && eq(result.once.futureKey, { keep: true }), JSON.stringify({ v: result.once.nwSchemaVersion, future: result.once.futureKey }));
    check(id, 'newer-version warning', (result.warns || []).some((w) => /newer/i.test(w)), JSON.stringify(result.warns));
  }
  if (file === 'v1-wrong-types.json') {
    check(id, 'wrong types kept as-is', result.once.storyWorld === 'text' && eq(result.once.chapterRequirements, {}) && result.once.chapterRequiredFacts === 5 && result.once.chapterIds === 'not-an-array' && eq(result.once.chapterScenes, { nope: true }) && result.once.subplotsMeta === 'not-an-array', JSON.stringify({ sw: result.once.storyWorld, req: result.once.chapterRequirements, rf: result.once.chapterRequiredFacts, ids: result.once.chapterIds, sc: result.once.chapterScenes, sm: result.once.subplotsMeta }));
    check(id, 'wrong-typed chapterIds/chapterScenes warn; owner write skipped', (result.warns || []).some((w) => /chapterIds/.test(w)) && (result.warns || []).some((w) => /chapterScenes/.test(w)), JSON.stringify(result.warns));
    const normMeta = await page.evaluate((nd) => {
      const warns = [];
      const orig = console.warn;
      console.warn = function () { warns.push(Array.from(arguments).map(String).join(' ')); return orig.apply(console, arguments); };
      const n = normalizeImportedSessionData({ schemaVersion: '1.0', novelData: JSON.parse(JSON.stringify(nd)) });
      console.warn = orig;
      return { meta: n.novelData.subplotsMeta, warns };
    }, ndIn);
    check(id, 'wrong-typed subplotsMeta kept as-is; warn', result.once.subplotsMeta === 'not-an-array' && (result.warns || []).some((w) => /subplotsMeta/.test(w)) && normMeta.meta === 'not-an-array' && (normMeta.warns || []).some((w) => /subplotsMeta/.test(w)), JSON.stringify({ mig: result.once.subplotsMeta, migWarns: result.warns, norm: normMeta }));
    const scCase = await page.evaluate((nd) => {
      const warns = [];
      const orig = console.warn;
      console.warn = function () { warns.push(Array.from(arguments).map(String).join(' ')); return orig.apply(console, arguments); };
      const once = nwMigrateSession(JSON.parse(JSON.stringify(nd)));
      console.warn = orig;
      const rec = once.chapterScenes && once.chapterScenes[0];
      const scene = rec && rec.scenes && rec.scenes[0];
      return {
        ids: once.chapterIds,
        chapterId: scene && scene.chapterId,
        hasScene: !!(scene && scene.id),
        warns
      };
    }, fx.inputSceneChapterIds);
    check(id, 'wrong-typed chapterIds skips scene chapterId write; warn', scCase.hasScene === true && scCase.ids === 'not-an-array' && scCase.chapterId == null && (scCase.warns || []).some((w) => /skipping scene chapterId/i.test(w)), JSON.stringify(scCase));
    const rfCase = await page.evaluate((nd) => {
      const warns = [];
      const orig = console.warn;
      console.warn = function () { warns.push(Array.from(arguments).map(String).join(' ')); return orig.apply(console, arguments); };
      const once = nwMigrateSession(JSON.parse(JSON.stringify(nd)));
      const help = { numChapters: 1, chapterRequiredFacts: 5 };
      const upsert = nwRequiredFactsUpsert(1, [{ text: 'x' }], 'user', help);
      console.warn = orig;
      return {
        rf: once.chapterRequiredFacts,
        warns,
        helpRf: help.chapterRequiredFacts,
        upsertOk: upsert && upsert.ok,
        upsertReason: upsert && upsert.reason
      };
    }, fx.inputRequiredFacts);
    check(id, 'wrong-typed chapterRequiredFacts kept with legacy factChecks; warn; helper refuses', rfCase.rf === 5 && (rfCase.warns || []).some((w) => /chapterRequiredFacts has wrong type; keeping as-is/.test(w)) && rfCase.helpRf === 5 && rfCase.upsertOk === false && rfCase.upsertReason === 'wrong-type', JSON.stringify(rfCase));
    const reqCase = await page.evaluate((nd) => {
      const warns = [];
      const orig = console.warn;
      console.warn = function () { warns.push(Array.from(arguments).map(String).join(' ')); return orig.apply(console, arguments); };
      const once = nwMigrateSession(JSON.parse(JSON.stringify(nd)));
      const help = JSON.parse(JSON.stringify(nd));
      const derived = nwDeriveChapterRequirements(1, help);
      console.warn = orig;
      return {
        req: once.chapterRequirements,
        warns,
        helpReq: help.chapterRequirements,
        derivedOk: derived && derived.ok,
        derivedReason: derived && derived.reason
      };
    }, fx.inputRequirements);
    check(id, 'wrong-typed chapterRequirements kept with blueprints; warn; helper refuses', eq(reqCase.req, {}) && (reqCase.warns || []).some((w) => /chapterRequirements has wrong type; keeping as-is/.test(w)) && eq(reqCase.helpReq, {}) && reqCase.derivedOk === false && reqCase.derivedReason === 'wrong-type', JSON.stringify(reqCase));
    const fpCase = await page.evaluate((nd) => {
      const warns = [];
      const orig = console.warn;
      console.warn = function () { warns.push(Array.from(arguments).map(String).join(' ')); return orig.apply(console, arguments); };
      const once = nwMigrateSession(JSON.parse(JSON.stringify(nd)));
      const help = JSON.parse(JSON.stringify(nd));
      const built = nwBuildChapterFingerprint(1, help);
      console.warn = orig;
      return {
        fp: once.chapterFingerprints,
        warns,
        helpFp: help.chapterFingerprints,
        built
      };
    }, fx.inputFingerprints);
    check(id, 'wrong-typed chapterFingerprints kept with chapter text; warn; helper refuses', fpCase.fp === 'not-an-array' && (fpCase.warns || []).some((w) => /chapterFingerprints has wrong type; keeping as-is/.test(w)) && fpCase.helpFp === 'not-an-array' && fpCase.built == null, JSON.stringify(fpCase));
  }
  if (file === 'v1-n-wrong-types.json') {
    check(id, 'chapterThemeTags string and systems {} kept', result.once.chapterThemeTags === 'x' && result.once.storyWorld && eq(result.once.storyWorld.systems, {}), JSON.stringify({ tags: result.once.chapterThemeTags, sys: result.once.storyWorld && result.once.storyWorld.systems }));
  }
  if (file === 'v0-chapters-to-proposed-scenes.json') {
    const sc0 = result.once.chapterScenes && result.once.chapterScenes[0];
    const sc1 = result.once.chapterScenes && result.once.chapterScenes[1];
    const sc2 = result.once.chapterScenes && result.once.chapterScenes[2];
    const ids = result.once.chapterIds;
    check(id, 'seeded chapterIds', Array.isArray(ids) && ids.length === 3 && ids.every((x) => /^ch_[a-z0-9]{10}$/.test(x)), JSON.stringify(ids));
    check(id, 'two placeholder scenes, none for empty ch3', !!(sc0 && sc1) && sc2 == null, JSON.stringify(result.once.chapterScenes));
    check(id, 'no span, breakApproved false, source import, no scene migratedBy', sc0 && sc0.scenes && sc0.scenes[0] && sc0.scenes[0].breakApproved === false && sc0.scenes[0].source === 'import' && sc0.scenes[0].span === undefined && !('migratedBy' in sc0.scenes[0]), JSON.stringify(sc0));
    check(id, 'session-level migratedBy S1 only', result.once.ext && result.once.ext.novelWriter && result.once.ext.novelWriter.migratedBy === 'S1', JSON.stringify(result.once.ext));
    check(id, 'builtFrom unchanged', result.once.chapterWritingPlans[0].builtFrom === 'keep-me-builtFrom', JSON.stringify(result.once.chapterWritingPlans[0]));
    const hashOk = await page.evaluate((nd) => {
      const t0 = nd.chapters[0];
      const rec = nd.chapterScenes[0];
      return !nwChapterTextHasSceneMarker(t0) && rec.textHash === nwTextHash(t0);
    }, result.once);
    check('MIG:v0-chapters-to-proposed-scenes', 'stored text has no marker; textHash === nwTextHash(chapters[n-1])', hashOk === true, String(hashOk));
    const exact = await page.evaluate((seed) => {
      nwSetOpaqueRng(nwSeededRng(seed));
      const taken = new Set();
      return { ch: [nwOpaqueId('ch_', taken), nwOpaqueId('ch_', taken), nwOpaqueId('ch_', taken)], sc: [nwOpaqueId('sc_', taken), nwOpaqueId('sc_', taken)] };
    }, SEED);
    check('MIG:v1-opaque-ids-seeded', 'exact seeded ch_/sc_ ids', eq(ids, exact.ch) && sc0.scenes[0].id === exact.sc[0] && sc1.scenes[0].id === exact.sc[1], JSON.stringify({ ids, sc: [sc0.scenes[0].id, sc1.scenes[0].id], exact }));
  }
  if (file === 'v1-no-text-no-scenes.json') {
    check(id, 'chapterIds assigned, no chapterScenes', Array.isArray(result.once.chapterIds) && result.once.chapterIds.length === 2 && !result.once.chapterScenes, JSON.stringify({ ids: result.once.chapterIds, sc: result.once.chapterScenes }));
  }
  if (file === 'v1-existing-core-ids-no-placeholders.json') {
    check(id, 'no new ch_/sc_ ids, entries deep-equal', eq(result.once.chapterIds, result.input.chapterIds) && eq(result.once.chapterScenes, result.input.chapterScenes), JSON.stringify({ ids: result.once.chapterIds, sc: result.once.chapterScenes }));
  }
  if (file === 'v1-scenes-approved-untouched.json') {
    check(id, 'approved entry + unknown keys deep-equal', eq(result.once.chapterScenes, result.input.chapterScenes), JSON.stringify(result.once.chapterScenes));
  }
  if (file === 'v1-scene-core-minimal.json') {
    const unapproved = result.once.chapterScenes[1].scenes[0];
    check(id, 'unapproved exported breakApproved false', unapproved.breakApproved === false && unapproved.source === 'import', JSON.stringify(unapproved));
  }
  if (file === 'v1-dangling-sceneId-chapter-scope.json') {
    const r = await page.evaluate((nd) => {
      novelData = nd;
      return nwResolveSceneRef('sc_deleted', nd);
    }, result.once);
    check(id, 'dangling sceneId falls back to chapter scope', r && r.scope === 'chapter', JSON.stringify(r));
    check(id, 'refs kept unchanged', result.once.chapterWritingPlans[0].items[0].sceneId === 'sc_deleted' && result.once.chapterFlags[0].missing[0].sceneId === 'sc_deleted', 'refs repaired');
  }
  if (file === 'v1-flags-null-gaps.json') {
    check(id, 'null kept', result.once.chapterFlags[0] === null && result.once.chapterFlags[1] && result.once.chapterFlags[1].coverageFailed === true, JSON.stringify(result.once.chapterFlags));
  }
  if (file === 'v0-partial-writing-plans.json') {
    check(id, 'plans untouched, no padding', result.once.chapterWritingPlans.length === 2 && result.once.chapterWritingPlans[0].extraPlan === true, JSON.stringify(result.once.chapterWritingPlans));
  }
  if (file === 'v1-world-full.json') {
    check(id, 'world keys deep-equal', eq(result.once.storyWorld, result.input.storyWorld) && eq(result.once.chapterThemeTags, result.input.chapterThemeTags), 'changed');
    check(id, 'no storyLedger', !Object.prototype.hasOwnProperty.call(result.once, 'storyLedger'), 'ledger present');
  }

  if (!helper && file !== 'v2-newer-version.json') {
    const mut = clone(result.once);
    const keys = Object.keys(mut);
    let mutFailed = 0;
    for (const k of keys) {
      const c = clone(mut);
      delete c[k];
      if (eq(c, result.once)) mutFailed++;
    }
    const c0 = mut.characters && mut.characters[0];
    if (c0 && typeof c0 === 'object') {
      for (const k of Object.keys(c0)) {
        const c = clone(mut);
        delete c.characters[0][k];
        if (eq(c, result.once)) mutFailed++;
      }
    }
    check(id + ':mutation', 'deleting each top-level / characters[0] key makes equality fail', mutFailed === 0, 'silent deletions: ' + mutFailed);
  }

  if (isCk) {
    const restored = await page.evaluate(async (fx) => {
      const rec = { novelData: JSON.parse(JSON.stringify(fx.input.novelData)), batchRun: JSON.parse(JSON.stringify(fx.input.batchRun)), active: true };
      nwBatchState.interrupted = rec;
      nwSetOpaqueRng(nwSeededRng(0x53310001));
      await restoreInterruptedBatchRun();
      return { version: novelData.nwSchemaVersion, scenes: novelData.chapterScenes, flags: Object.prototype.hasOwnProperty.call(novelData, 'chapterFlags'), ledger: Object.prototype.hasOwnProperty.call(novelData, 'storyLedger') };
    }, fx);
    check('MIG:v0-checkpoint-restore', 'restoreInterruptedBatchRun migrates v0 checkpoint', restored.version === 1 && Array.isArray(restored.scenes) && !restored.ledger, JSON.stringify(restored));
  }
}

// ---- helper tests ----
{
  const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-locked-canon.json'), 'utf8'));
  const r = await page.evaluate((nd) => {
    novelData = JSON.parse(JSON.stringify(nd));
    const patch = {
      concepts: [{ id: 'c1', name: 'Locked-X' }, { id: 'c2', name: 'Open-X' }],
      rules: [{ id: 'r1', name: 'LockedR-X' }, { id: 'r2', name: 'OpenR-X' }],
      locations: [{ id: 'l1', name: 'LockedL-X' }, { id: 'l2', name: 'OpenL-X' }],
      systems: [{ id: 's1', name: 'LockedS-X' }, { id: 's2', name: 'OpenS-X' }],
      themes: [{ id: 't1', text: 'LockedT-X' }, { id: 't2', text: 'OpenT-X' }]
    };
    const sw = nwStoryWorldUpdate(patch, 'ai');
    const kn = nwCharacterKnowsUpdate('mira', [{ conceptId: 'c1', learnedIn: 2 }, { conceptId: 'c2', learnedIn: 2 }], 'ai');
    return {
      skipped: sw.skipped, knSkipped: kn.skipped,
      c1: novelData.storyWorld.concepts.find((c) => c.id === 'c1').name,
      c2: novelData.storyWorld.concepts.find((c) => c.id === 'c2').name,
      knows1: novelData.characters[0].knows.find((k) => k.conceptId === 'c1').learnedIn,
      knows2: novelData.characters[0].knows.find((k) => k.conceptId === 'c2').learnedIn,
      deleted: novelData.storyWorld.concepts.length
    };
  }, fx.input);
  check('MIG:v1-locked-canon', 'locked items unchanged, unlocked patched, skipped returned, none deleted', r.c1 === 'Locked' && r.c2 === 'Open-X' && r.knows1 === 1 && r.knows2 === 2 && r.skipped.indexOf('c1') >= 0 && r.deleted === 2, JSON.stringify(r));
}

{
  const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-ai-propose-only.json'), 'utf8'));
  const r = await page.evaluate((nd) => {
    novelData = JSON.parse(JSON.stringify(nd));
    const before = JSON.parse(JSON.stringify(novelData.storyWorld));
    const ai = nwStoryWorldUpdate({ genreProfiles: ['fantasy'], immersionWeight: { culture: 1, science: 0, tech: 0 } }, 'ai');
    const mid = JSON.parse(JSON.stringify(novelData.storyWorld));
    const user = nwStoryWorldUpdate({ genreProfiles: ['fantasy'], immersionWeight: { culture: 1, science: 0, tech: 0 } }, 'user');
    return { aiOk: ai.ok, refused: ai.refused, proposal: ai.proposal, midEq: JSON.stringify(mid) === JSON.stringify(before), after: novelData.storyWorld.genreProfiles, userOk: user.ok };
  }, fx.input);
  check('MIG:v1-ai-propose-only', 'ai whole-replace refused; user accept writes', r.aiOk === false && r.midEq && r.userOk && eq(r.after, ['fantasy']), JSON.stringify(r));
}

{
  const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-role-character.json'), 'utf8'));
  const r = await page.evaluate((nd) => {
    novelData = JSON.parse(JSON.stringify(nd));
    const ai = nwStoryWorldUpdate({ role: { value: 'backdrop', source: 'ai' } }, 'ai');
    const still = novelData.storyWorld.role.value;
    const user = nwStoryWorldUpdate({ role: { value: 'backdrop', source: 'user' } }, 'user');
    return { aiOk: ai.ok, still, after: novelData.storyWorld.role.value, arc: novelData.storyWorld.arc, subs: novelData.storyWorld.subplots };
  }, fx.input);
  check('MIG:v1-role-character', 'ai overwrite of user role refused; user downgrade keeps arc/subplots stored', r.still === 'character' && r.after === 'backdrop' && Array.isArray(r.arc) && Array.isArray(r.subs), JSON.stringify(r));
}

{
  const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-role-backdrop.json'), 'utf8'));
  const r = await page.evaluate((nd) => {
    novelData = JSON.parse(JSON.stringify(nd));
    const ai = nwStoryWorldUpdate({ arc: [{ stage: 'nope', chapterPos: 0.2, change: 'x' }] }, 'ai');
    return { aiOk: ai.ok, arc: novelData.storyWorld.arc };
  }, fx.input);
  check('MIG:v1-role-backdrop', 'ai arc patch refused, arc stays absent', r.aiOk === false && r.arc == null, JSON.stringify(r));
}

{
  const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-unknown-nested.json'), 'utf8'));
  const r = await page.evaluate((nd) => {
    const n = normalizeImportedSessionData({ schemaVersion: '1.0', novelData: JSON.parse(JSON.stringify(nd)) });
    novelData = n.novelData;
    nwMigrateSession(novelData);
    const afterNorm = JSON.parse(JSON.stringify(novelData.storyWorld));
    nwStoryWorldUpdate({ notes: 'touched' }, 'user');
    return {
      extraWorld: novelData.storyWorld.extraWorld === true,
      extraRole: novelData.storyWorld.role.extraRole === true,
      extraImm: novelData.storyWorld.immersionWeight.extraImm === true,
      extraBeat: novelData.storyWorld.structureTemplate.beats[0].extraBeat === true,
      extraSys: novelData.storyWorld.systems[0].extraSys === true,
      extraKnows: novelData.characters[0].knows[0].extraKnows === true,
      extraTag: novelData.chapterThemeTags[0].extraTag === true,
      extraChar: novelData.characters[0].extraChar === true,
      notes: novelData.storyWorld.notes
    };
  }, fx.input);
  check('MIG:v1-unknown-nested', 'unknown nested keys survive normalize, migrate, and one nwStoryWorldUpdate', r.extraWorld && r.extraRole && r.extraImm && r.extraBeat && r.extraSys && r.extraKnows && r.extraTag && r.extraChar && r.notes === 'touched', JSON.stringify(r));
}

{
  const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-knows-tab2-rebuild.json'), 'utf8'));
  const r = await page.evaluate((nd) => {
    novelData = JSON.parse(JSON.stringify(nd));
    renderCharacters();
    novelData.characters = nwCollectCharactersFromDom();
    const c = novelData.characters[0];
    return { knows: c.knows, extraChar: c.extraChar, id: c.id };
  }, fx.input);
  check('MIG:v1-knows-tab2-rebuild', 'knows[] locked/source and unknown keys survive Tab 2 rebuild', Array.isArray(r.knows) && r.knows[0].locked === true && r.knows[1].extraKnows === 'keep' && r.extraChar === 'keep' && r.id === 'mira', JSON.stringify(r));
}

{
  const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-batch-locked.json'), 'utf8'));
  const r = await page.evaluate((nd) => {
    novelData = JSON.parse(JSON.stringify(nd));
    const before = JSON.parse(JSON.stringify(novelData));
    const real = nwBatchIsLocked;
    nwBatchIsLocked = function () { return true; };
    const a = nwStoryWorldUpdate({ notes: 'nope' }, 'user');
    const b = nwCharacterKnowsUpdate('mira', [{ conceptId: 'c9', learnedIn: 1 }], 'user');
    const c = nwChapterThemeTagsUpdate(1, { tags: ['x'], source: 'user' }, 'user');
    const d = nwChapterScenesUpdate(1, { version: 1, scenes: [] }, 'user');
    nwBatchIsLocked = real;
    return { a, b, c, d, eq: JSON.stringify(novelData) === JSON.stringify(before) };
  }, fx.input);
  check('MIG:v1-batch-locked', 'helpers refuse under batch lock; novelData unchanged', r.eq && r.a.reason === 'locked' && r.b.reason === 'locked' && r.c.reason === 'locked' && r.d.reason === 'locked', JSON.stringify(r));
}

{
  const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-text-hash-change-reproposes.json'), 'utf8'));
  const r = await page.evaluate((nd) => {
    novelData = JSON.parse(JSON.stringify(nd));
    const hash = nwTextHash(novelData.chapters[0]);
    novelData.chapterScenes[0].textHash = hash;
    novelData.chapterWritingPlans[0].builtFrom = nwComputeBuiltFrom(1);
    const beforeSave = nwSceneBoundaryStatus(1);
    const planFreshBefore = !nwPlanIsStale(1);
    novelData.chapters[0] = novelData.chapters[0] + ' extra sentence.';
    const afterEdit = nwSceneBoundaryStatus(1);
    const stale = nwPlanIsStale(1);
    const spans = novelData.chapterScenes[0].scenes[0].span;
    const stored = novelData.chapterScenes[0].scenes[0].breakApproved;
    const saved = nwChapterScenesUpdate(1, { scenes: novelData.chapterScenes[0].scenes }, 'user');
    return {
      beforeSaveProposed: afterEdit.proposed, reason: afterEdit.reason, stale, stored, spans,
      after: novelData.chapterScenes[0].scenes[0].breakApproved,
      planFreshBefore, effectivelyBefore: beforeSave.effectivelyApproved
    };
  }, fx.input);
  check('MIG:v1-text-hash-change-reproposes', 'before save: not effectively approved, plan stale, spans unchanged, stored breakApproved still true', r.beforeSaveProposed && r.reason === 'chapter text changed' && r.stale && r.stored === true && r.spans && r.spans.start === 0, JSON.stringify(r));
  check('MIG:v1-text-hash-change-reproposes', 'after user save: breakApproved false persisted', r.after === false, JSON.stringify(r));
}

{
  const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-ids-survive-insert-reorder.json'), 'utf8'));
  const r = await page.evaluate((nd) => {
    novelData = JSON.parse(JSON.stringify(nd));
    nwSetOpaqueRng(nwSeededRng(0x53310001));
    const orig = novelData.chapterIds.slice();
    const scB = novelData.chapterScenes[1].scenes.map((s) => s.id);
    nwChapterIdsUpdate('insert', 2);
    const afterIns = novelData.chapterIds.slice();
    const scenesAfterIns = (novelData.chapterScenes || []).map((rec, i) => rec && rec.scenes && rec.scenes.map((s) => ({ id: s.id, chapterId: s.chapterId, order: s.order, chAt: novelData.chapterIds[i] })));
    nwChapterIdsUpdate('reorder', 3, 4);
    const afterOrd = novelData.chapterIds.slice();
    const scenesAfterOrd = (novelData.chapterScenes || []).map((rec, i) => rec && rec.scenes && rec.scenes.map((s) => ({ id: s.id, chapterId: s.chapterId, order: s.order, chAt: novelData.chapterIds[i] })));
    nwChapterIdsUpdate('delete', 4);
    const afterDel = novelData.chapterIds.slice();
    const rec = novelData.chapterScenes[2];
    nwChapterScenesUpdate(3, { scenes: rec.scenes.slice().reverse().map((s, i) => Object.assign({}, s, { order: i + 1 })) }, 'user');
    return { orig, afterIns, afterOrd, afterDel, scB, scenesAfter: (novelData.chapterScenes[1] && novelData.chapterScenes[1].scenes || []).map((s) => s.id), chIds: novelData.chapterIds, sceneChapterIds: (novelData.chapterScenes || []).map((rec, i) => rec && rec.scenes && rec.scenes.map((s) => s.chapterId)), scenesAfterIns, scenesAfterOrd };
  }, fx.input);
  const insOk = r.afterIns.length === 4 && r.afterIns[0] === r.orig[0] && r.afterIns[2] === r.orig[1] && r.afterIns[3] === r.orig[2] && r.afterIns[1] !== r.orig[0] && r.afterIns[1] !== r.orig[1] && r.afterIns[1] !== r.orig[2];
  const ordOk = r.afterOrd.length === 4 && r.afterOrd[0] === r.orig[0] && r.afterOrd[1] === r.afterIns[1] && r.afterOrd[2] === r.orig[2] && r.afterOrd[3] === r.orig[1];
  const linkIns = Array.isArray(r.scenesAfterIns) && r.scenesAfterIns.every((row) => !row || row.every((s) => s.chapterId === s.chAt));
  const linkOrd = Array.isArray(r.scenesAfterOrd) && r.scenesAfterOrd.every((row) => !row || row.every((s) => s.chapterId === s.chAt));
  check('MIG:v1-ids-survive-insert-reorder', 'surviving ids unchanged; insert mints one new ch_; scenes move with chapter', insOk && r.afterDel.length === 3, JSON.stringify(r));
  check('MIG:v1-ids-survive-insert-reorder', 'every intermediate order and each scene chapterId after insert and reorder', insOk && ordOk && linkIns && linkOrd, JSON.stringify({ afterIns: r.afterIns, afterOrd: r.afterOrd, scenesAfterIns: r.scenesAfterIns, scenesAfterOrd: r.scenesAfterOrd }));
}

{
  const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-ids-resize.json'), 'utf8'));
  const r = await page.evaluate((nd) => {
    novelData = JSON.parse(JSON.stringify(nd));
    nwSetOpaqueRng(nwSeededRng(0x53310001));
    const orig = novelData.chapterIds.slice();
    nwChapterIdsUpdate('resize', 5);
    const up = novelData.chapterIds.slice();
    const upScenes = (novelData.chapterScenes || []).length;
    const upCh = (novelData.chapters || []).length;
    nwChapterIdsUpdate('resize', 2);
    const down = {
      ids: novelData.chapterIds.slice(),
      scenes: (novelData.chapterScenes || []).length,
      chLen: (novelData.chapters || []).length,
      facts: (novelData.chapterRequiredFacts || []).length,
      reqs: (novelData.chapterRequirements || []).length,
      fps: (novelData.chapterFingerprints || []).length,
      plans: (novelData.chapterWritingPlans || []).length,
      staleFact: novelData.chapterRequiredFacts && novelData.chapterRequiredFacts[2],
      stalePlan: novelData.chapterWritingPlans && novelData.chapterWritingPlans[2]
    };
    nwChapterIdsUpdate('resize', 5);
    const grown = {
      ids: novelData.chapterIds.slice(),
      chLen: (novelData.chapters || []).length,
      facts2: novelData.chapterRequiredFacts && novelData.chapterRequiredFacts[2],
      reqs2: novelData.chapterRequirements && novelData.chapterRequirements[2],
      fps2: novelData.chapterFingerprints && novelData.chapterFingerprints[2],
      plans2: novelData.chapterWritingPlans && novelData.chapterWritingPlans[2],
      scenes2: novelData.chapterScenes && novelData.chapterScenes[2]
    };
    return { orig, up, upCh, down, upScenes, grown };
  }, fx.input);
  check('MIG:v1-ids-resize', 'grow pads new ch_ ids; shrink truncates ids and scenes', r.up.length === 5 && r.up[0] === r.orig[0] && r.up[1] === r.orig[1] && r.up[2] === r.orig[2] && r.down.ids.length === 2 && r.down.scenes === 2, JSON.stringify(r));
  check('MIG:v1-ids-resize', 'chapters.length === chapterIds.length after shrink and grow', r.upCh === r.up.length && r.down.chLen === r.down.ids.length && r.grown.chLen === r.grown.ids.length, JSON.stringify(r));
  check('MIG:v1-ids-resize', 'shrink truncates every S1 per-chapter array; shrink-then-grow brings back no stale record', r.down.facts === 2 && r.down.reqs === 2 && r.down.fps === 2 && r.down.plans === 2 && r.down.staleFact == null && r.down.stalePlan == null && r.grown.facts2 == null && r.grown.reqs2 == null && r.grown.fps2 == null && r.grown.plans2 == null && r.grown.scenes2 == null && r.grown.ids.length === 5 && r.grown.ids[0] === r.orig[0], JSON.stringify(r));
}

{
  const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v2-ids-resize.json'), 'utf8'));
  const r = await page.evaluate((nd) => {
    novelData = JSON.parse(JSON.stringify(nd));
    const snap = () => JSON.parse(JSON.stringify({
      ids: novelData.chapterIds,
      scenes: novelData.chapterScenes,
      facts: novelData.chapterRequiredFacts,
      reqs: novelData.chapterRequirements,
      fps: novelData.chapterFingerprints,
      plans: novelData.chapterWritingPlans,
      chapters: novelData.chapters,
      numChapters: novelData.numChapters,
      futureKey: novelData.futureKey,
      ver: novelData.nwSchemaVersion
    }));
    const before = snap();
    const ver = typeof nwSchemaVersion === 'function' ? nwSchemaVersion(novelData) : novelData.nwSchemaVersion;
    nwSetOpaqueRng(nwSeededRng(0x53310001));
    const up = nwChapterIdsUpdate('resize', 4);
    const afterUp = snap();
    const down = nwChapterIdsUpdate('resize', 1);
    const afterDown = snap();
    return { before, afterUp, afterDown, ver, up, down };
  }, fx.input);
  check('MIG:v2-ids-resize', 'resize leaves v2+ chapterIds and S1 per-chapter arrays untouched', r.ver === 2 && eq(r.afterUp, r.before) && eq(r.afterDown, r.before) && eq(r.before.ids, ['v2_keep_a', 'v2_keep_b']) && r.before.futureKey && r.before.futureKey.keep === true, JSON.stringify(r));
}

{
  const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-plan-stale.json'), 'utf8'));
  const r = await page.evaluate((nd) => {
    novelData = JSON.parse(JSON.stringify(nd));
    for (let n = 1; n <= 5; n++) {
      if (novelData.chapterWritingPlans[n - 1] && novelData.chapterWritingPlans[n - 1].builtFrom === 'PLACEHOLDER') {
        novelData.chapterWritingPlans[n - 1].builtFrom = nwComputeBuiltFrom(n);
      }
    }
    const ch1Fresh0 = !nwPlanIsStale(1);
    novelData.chapterRequiredFacts[0].items = novelData.chapterRequiredFacts[0].items.slice().reverse();
    novelData.chapterRequirements[0].derivedFrom = 'changed-only';
    const ch1Fresh = !nwPlanIsStale(1);
    novelData.chapterBlueprints[1] = Object.assign({}, novelData.chapterBlueprints[1], { arcStep: 'edited' });
    novelData.chapterRequiredFacts[2].items[0].text = 'edited-text';
    novelData.chapterRequirements[3].mustNotInclude = ['no-magic', 'new'];
    const stale = [1, 2, 3, 4, 5].map((n) => nwPlanIsStale(n));
    return { ch1Fresh0, ch1Fresh, stale };
  }, fx.input);
  check('MIG:v1-plan-stale', 'ch1 stays fresh (sort by id / derivedFrom excluded); ch2-ch5 stale; no auto rebuild', r.ch1Fresh0 && r.ch1Fresh && r.stale[0] === false && r.stale[1] && r.stale[2] && r.stale[3] && r.stale[4], JSON.stringify(r));
}

{
  const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-plan-world-stale.json'), 'utf8'));
  const r = await page.evaluate((nd) => {
    novelData = JSON.parse(JSON.stringify(nd));
    novelData.chapterWritingPlans[0].builtFrom = nwComputeBuiltFrom(1);
    novelData.chapterWritingPlans[1].builtFrom = nwComputeBuiltFrom(2);
    novelData.chapterWritingPlans[1].worldFrom = nwComputeWorldFrom(2);
    novelData.chapterWritingPlans[2].builtFrom = nwComputeBuiltFrom(3);
    const lock = nwStoryWorldUpdate({ concepts: [{ id: 'c-used', locked: true }] }, 'user');
    const afterLock = [1, 2, 3].map((n) => nwPlanIsStale(n));
    nwStoryWorldUpdate({ concepts: [{ id: 'c-new', approvedAt: '2026-02-01T00:00:00.000Z', mustExplain: true, familiarity: 'new' }] }, 'user');
    const afterApprove = [1, 2, 3].map((n) => nwPlanIsStale(n));
    novelData.chapterWritingPlans[0].builtFrom = nwComputeBuiltFrom(1);
    novelData.chapterWritingPlans[0].worldFrom = nwComputeWorldFrom(1) || 'stored-worldFrom';
    novelData.chapterWritingPlans[1].builtFrom = nwComputeBuiltFrom(2);
    novelData.chapterWritingPlans[1].worldFrom = nwComputeWorldFrom(2);
    novelData.chapterWritingPlans[2].builtFrom = nwComputeBuiltFrom(3);
    delete novelData.storyWorld;
    const afterRemove = [1, 2, 3].map((n) => nwPlanIsStale(n));
    return { afterLock, afterApprove, preW1: afterLock[0], wbNoWorld: afterLock[2], afterRemove };
  }, fx.input);
  check('MIG:v1-plan-world-stale', 'locking alone leaves plans fresh; worldBeat without worldFrom is stale; pre-W1 no worldBeats fresh', r.afterLock[0] === false && r.afterLock[2] === true, JSON.stringify(r));
  check('MIG:v1-plan-world-stale', 'removing storyWorld marks plans with stored worldFrom stale (cur===null => stale)', r.afterRemove && r.afterRemove[0] === true, JSON.stringify(r.afterRemove));
}

{
  const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-prior-drafts.json'), 'utf8'));
  const r = await page.evaluate((nd) => {
    novelData = JSON.parse(JSON.stringify(nd));
    const br = novelData.batchRun;
    const first = JSON.parse(JSON.stringify(nwBatchGetPriorDraft(br, 2)));
    const second = nwBatchSetPriorDraft(br, 2, 'overwrite attempt');
    const refused = second && second.text === first.text;
    nwBatchSetChapterText(2, 'failed draft');
    const skipped = nwBatchRestorePriorDraft(br, 2);
    const restored = novelData.chapters[1];
    nwBatchSetPriorDraft(br, 1, 'ch1 original');
    nwBatchClearPriorDraft(br, 1);
    const cleared = nwBatchGetPriorDraft(br, 1);
    return { refused, skipped, restored, cleared };
  }, fx.input);
  check('MIG:v1-prior-drafts', 'write-once; Skip restores; Accept clears', r.refused && r.skipped && r.restored === 'original ch2' && r.cleared == null, JSON.stringify(r));
}

{
  const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-flags-passthrough.json'), 'utf8'));
  const r = await page.evaluate((nd) => {
    const n = normalizeImportedSessionData({ schemaVersion: '1.0', novelData: JSON.parse(JSON.stringify(nd)) });
    return n.novelData.chapterFlags;
  }, fx.input);
  check('MIG:v1-flags-passthrough', 'object entries keep unknown keys; wrong-type entry null', r && r[0] && r[0].extra === true && r[1] && r[1].replay && r[2] === null, JSON.stringify(r));
}

// round-trip
{
  const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v0-chapters-to-proposed-scenes.json'), 'utf8'));
  const r = await page.evaluate(async (nd) => {
    nwSetOpaqueRng(nwSeededRng(0x53310001));
    const n = normalizeImportedSessionData({ schemaVersion: '1.0', sourceTool: 'NovelWriter', novelData: JSON.parse(JSON.stringify(nd)) });
    novelData = nwMigrateSession(n.novelData);
    applySessionDataToUI();
    const before = JSON.parse(JSON.stringify({
      storyWorld: novelData.storyWorld,
      chapterIds: novelData.chapterIds,
      chapterScenes: novelData.chapterScenes,
      chapterRequirements: novelData.chapterRequirements,
      chapterRequiredFacts: novelData.chapterRequiredFacts,
      chapterFingerprints: novelData.chapterFingerprints,
      nwSchemaVersion: novelData.nwSchemaVersion,
      ext: novelData.ext
    }));
    window.__h = window.__h || {};
    const realCOU = URL.createObjectURL;
    URL.createObjectURL = function (b) { window.__h.lastExport = b; return realCOU.call(URL, b); };
    HTMLAnchorElement.prototype.click = function () {};
    exportSession();
    const text = await window.__h.lastExport.text();
    const env = JSON.parse(text);
    const imp = normalizeImportedSessionData(env);
    const afterNd = nwMigrateSession(imp.novelData);
    const after = {
      storyWorld: afterNd.storyWorld,
      chapterIds: afterNd.chapterIds,
      chapterScenes: afterNd.chapterScenes,
      chapterRequirements: afterNd.chapterRequirements,
      chapterRequiredFacts: afterNd.chapterRequiredFacts,
      chapterFingerprints: afterNd.chapterFingerprints,
      nwSchemaVersion: afterNd.nwSchemaVersion,
      ext: afterNd.ext
    };
    return { eq: JSON.stringify(before) === JSON.stringify(after), before, after };
  }, fx.input);
  check('MIG:round-trip', 'export → import → deep-equal S1 keys including chapterScenes/chapterIds', r.eq === true, JSON.stringify({ before: r.before, after: r.after }).slice(0, 1200));
}

{
  const r = await page.evaluate(() => {
    const input = {
      chapterIds: ['ch_aaaaaaaaaa', 'ch_bbbbbbbbbb'],
      chapterScenes: [
        { id: 'sc_cccccccccc', scenes: [{ id: 'sc_dddddddddd', chapterId: 'ch_aaaaaaaaaa', order: 1, span: [0, 10] }] },
        null
      ],
      storyWorld: { version: 1, notes: 'keep me', concepts: [{ id: 'c1', name: 'Alpha' }] },
      apiKey: 'xai-SHOULD-STRIP'
    };
    const out = stripSecretFields(JSON.parse(JSON.stringify(input)));
    return {
      idsEq: JSON.stringify(out.chapterIds) === JSON.stringify(input.chapterIds),
      scenesEq: JSON.stringify(out.chapterScenes) === JSON.stringify(input.chapterScenes),
      worldEq: JSON.stringify(out.storyWorld) === JSON.stringify(input.storyWorld),
      hasApiKey: Object.prototype.hasOwnProperty.call(out, 'apiKey')
    };
  });
  check('MIG:strip-s1-passthrough', 'stripSecretFields passes chapterIds, chapterScenes and storyWorld through unchanged', r.idsEq && r.scenesEq && r.worldEq && r.hasApiKey === false, JSON.stringify(r));
}

await page.close();

{
  const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v0-chapters-to-proposed-scenes.json'), 'utf8'));
  const pRng = await openPage();
  const r = await pRng.evaluate((nd) => {
    const marker = function () { return 0.5; };
    nwSetOpaqueRng(marker);
    nwMigrateSession(JSON.parse(JSON.stringify(nd)), { rng: nwSeededRng(0x53310001) });
    const after = nwOpaqueId('xx_', new Set());
    return { after, expectedMarker: 'xx_iiiiiiiiii' };
  }, fx.input);
  await pRng.close();
  check('MIG:rng-restore', 'opaque-id RNG restored in finally after migration', r.after === r.expectedMarker, JSON.stringify(r));
}

{
  const pId = await openPage();
  const r = await pId.evaluate(() => {
    const taken = new Set(['xx_0000000000']);
    try {
      const id = nwOpaqueId('xx_', taken, function () { return 0; });
      return { threw: false, id, taken: Array.from(taken) };
    } catch (e) {
      return { threw: true, message: String(e && e.message || e), taken: Array.from(taken) };
    }
  });
  await pId.close();
  check('MIG:opaque-id-collision', 'stuck RNG throws after 50 collisions instead of returning a duplicate', r.threw === true && /too many collisions/i.test(r.message || '') && r.taken.length === 1 && r.taken[0] === 'xx_0000000000', JSON.stringify(r));
}

// SCH-01 mutation: whitelist rebuild turns v1-unknown-nested red
{
  const mut = mutateCopy('var NW_S1_NORMALIZER_PASSTHROUGH = true;', 'var NW_S1_NORMALIZER_PASSTHROUGH = false;');
  check('MIG:v1-unknown-nested:mutation-flag', 'whitelist flag present for mutation', mut.ok, mut.detail);
  if (mut.ok) {
    const p = await openPage(mut.copy);
    const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-unknown-nested.json'), 'utf8'));
    const r = await p.evaluate((nd) => {
      const n = normalizeImportedSessionData({ schemaVersion: '1.0', novelData: JSON.parse(JSON.stringify(nd)) });
      return {
        extraWorld: n.novelData.storyWorld && n.novelData.storyWorld.extraWorld,
        extraRole: n.novelData.storyWorld && n.novelData.storyWorld.role && n.novelData.storyWorld.role.extraRole,
        extraSys: n.novelData.storyWorld && n.novelData.storyWorld.systems && n.novelData.storyWorld.systems[0] && n.novelData.storyWorld.systems[0].extraSys
      };
    }, fx.input);
    check('MIG:v1-unknown-nested:mutation', 'whitelist rebuild drops unknown nested keys (turns green case red)', r.extraWorld !== true && r.extraRole !== true && r.extraSys !== true, JSON.stringify(r));
    await p.close();
  }
}

{
  const mut = mutateCopy('var NW_S1_KEEP_WRONG_TYPES = true;', 'var NW_S1_KEEP_WRONG_TYPES = false;');
  check('MIG:v1-wrong-types:mutation-flag', 'keep-wrong-types flag present', mut.ok, mut.detail);
  if (mut.ok) {
    const p = await openPage(mut.copy);
    const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-wrong-types.json'), 'utf8'));
    const r = await p.evaluate((nd) => {
      const once = nwMigrateSession(JSON.parse(JSON.stringify(nd)));
      return { ids: once.chapterIds, sc: once.chapterScenes };
    }, fx.input);
    check('MIG:v1-wrong-types:mutation', 'coercing wrong-typed chapterIds/chapterScenes to [] turns keep-as-is red', Array.isArray(r.ids) && Array.isArray(r.sc), JSON.stringify(r));
    await p.close();
  }
}

{
  const mut = mutateCopy('var NW_S1_KEEP_WRONG_SUBPLOTS_META = true;', 'var NW_S1_KEEP_WRONG_SUBPLOTS_META = false;');
  check('MIG:v1-wrong-types:subplotsMeta-mutation-flag', 'keep-wrong-subplotsMeta flag present', mut.ok, mut.detail);
  if (mut.ok) {
    const p = await openPage(mut.copy);
    const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-wrong-types.json'), 'utf8'));
    const r = await p.evaluate((nd) => {
      const warns = [];
      const orig = console.warn;
      console.warn = function () { warns.push(Array.from(arguments).map(String).join(' ')); return orig.apply(console, arguments); };
      const once = nwMigrateSession(JSON.parse(JSON.stringify(nd)));
      const n = normalizeImportedSessionData({ schemaVersion: '1.0', novelData: JSON.parse(JSON.stringify(nd)) });
      console.warn = orig;
      return { mig: once.subplotsMeta, norm: n.novelData.subplotsMeta, warns };
    }, fx.input);
    console.log('MIG:subplotsMeta-mutation red-run ' + JSON.stringify(r));
    check('MIG:v1-wrong-types:subplotsMeta-mutation', 'overwriting wrong-typed subplotsMeta turns keep-as-is red', Array.isArray(r.mig) && Array.isArray(r.norm), JSON.stringify(r));
    await p.close();
  }
}

{
  const mut = mutateCopy('var NW_S1_SKIP_SCENE_CHAPTERID_WRONG_IDS = true;', 'var NW_S1_SKIP_SCENE_CHAPTERID_WRONG_IDS = false;');
  check('MIG:v1-wrong-types:scene-chapterId-mutation-flag', 'skip-scene-chapterId flag present', mut.ok, mut.detail);
  if (mut.ok) {
    const p = await openPage(mut.copy);
    const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-wrong-types.json'), 'utf8'));
    const r = await p.evaluate((nd) => {
      const once = nwMigrateSession(JSON.parse(JSON.stringify(nd)));
      const rec = once.chapterScenes && once.chapterScenes[0];
      const scene = rec && rec.scenes && rec.scenes[0];
      return { ids: once.chapterIds, chapterId: scene && scene.chapterId, hasScene: !!(scene && scene.id) };
    }, fx.inputSceneChapterIds);
    console.log('MIG:scene-chapterId-mutation red-run ' + JSON.stringify(r));
    check('MIG:v1-wrong-types:scene-chapterId-mutation', 'writing junk scene chapterId from wrong-typed chapterIds turns skip-write green red', r.hasScene === true && r.ids === 'not-an-array' && typeof r.chapterId === 'string' && r.chapterId.length === 1, JSON.stringify(r));
    await p.close();
  }
}

{
  const mut = mutateCopy('var NW_S1_KEEP_WRONG_REQUIRED_FACTS = true;', 'var NW_S1_KEEP_WRONG_REQUIRED_FACTS = false;');
  check('MIG:v1-wrong-types:requiredFacts-mutation-flag', 'keep-wrong-requiredFacts flag present', mut.ok, mut.detail);
  if (mut.ok) {
    const p = await openPage(mut.copy);
    const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-wrong-types.json'), 'utf8'));
    const r = await p.evaluate((nd) => {
      const once = nwMigrateSession(JSON.parse(JSON.stringify(nd)));
      const help = { numChapters: 1, chapterRequiredFacts: 5 };
      const upsert = nwRequiredFactsUpsert(1, [{ text: 'x' }], 'user', help);
      return { rf: once.chapterRequiredFacts, helpRf: help.chapterRequiredFacts, upsertOk: upsert && upsert.ok };
    }, fx.inputRequiredFacts);
    console.log('MIG:requiredFacts-mutation red-run ' + JSON.stringify(r));
    check('MIG:v1-wrong-types:requiredFacts-mutation', 'overwriting wrong-typed chapterRequiredFacts turns keep-as-is red', Array.isArray(r.rf) && Array.isArray(r.helpRf) && r.upsertOk === true, JSON.stringify(r));
    await p.close();
  }
}

{
  const mut = mutateCopy('var NW_S1_KEEP_WRONG_REQUIREMENTS = true;', 'var NW_S1_KEEP_WRONG_REQUIREMENTS = false;');
  check('MIG:v1-wrong-types:requirements-mutation-flag', 'keep-wrong-requirements flag present', mut.ok, mut.detail);
  if (mut.ok) {
    const p = await openPage(mut.copy);
    const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-wrong-types.json'), 'utf8'));
    const r = await p.evaluate((nd) => {
      const once = nwMigrateSession(JSON.parse(JSON.stringify(nd)));
      const help = JSON.parse(JSON.stringify(nd));
      const derived = nwDeriveChapterRequirements(1, help);
      return { req: once.chapterRequirements, helpReq: help.chapterRequirements, derivedOk: derived && derived.ok };
    }, fx.inputRequirements);
    console.log('MIG:requirements-mutation red-run ' + JSON.stringify(r));
    check('MIG:v1-wrong-types:requirements-mutation', 'overwriting wrong-typed chapterRequirements turns keep-as-is red', Array.isArray(r.req) && Array.isArray(r.helpReq) && r.derivedOk === true, JSON.stringify(r));
    await p.close();
  }
}

{
  const mut = mutateCopy('var NW_S1_KEEP_WRONG_FINGERPRINTS = true;', 'var NW_S1_KEEP_WRONG_FINGERPRINTS = false;');
  check('MIG:v1-wrong-types:fingerprints-mutation-flag', 'keep-wrong-fingerprints flag present', mut.ok, mut.detail);
  if (mut.ok) {
    const p = await openPage(mut.copy);
    const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-wrong-types.json'), 'utf8'));
    const r = await p.evaluate((nd) => {
      const once = nwMigrateSession(JSON.parse(JSON.stringify(nd)));
      const help = JSON.parse(JSON.stringify(nd));
      const built = nwBuildChapterFingerprint(1, help);
      return { fp: once.chapterFingerprints, helpFp: help.chapterFingerprints, built: built && built.textHash };
    }, fx.inputFingerprints);
    console.log('MIG:fingerprints-mutation red-run ' + JSON.stringify(r));
    check('MIG:v1-wrong-types:fingerprints-mutation', 'overwriting wrong-typed chapterFingerprints turns keep-as-is red', Array.isArray(r.fp) && Array.isArray(r.helpFp) && typeof r.built === 'string', JSON.stringify(r));
    await p.close();
  }
}

{
  const mut = mutateCopy('var NW_S1_OPAQUE_ID_THROW_ON_COLLISION = true;', 'var NW_S1_OPAQUE_ID_THROW_ON_COLLISION = false;');
  check('MIG:opaque-id-collision:mutation-flag', 'opaque-id-throw flag present', mut.ok, mut.detail);
  if (mut.ok) {
    const p = await openPage(mut.copy);
    const r = await p.evaluate(() => {
      const taken = new Set(['xx_0000000000']);
      try {
        const id = nwOpaqueId('xx_', taken, function () { return 0; });
        return { threw: false, id, taken: Array.from(taken) };
      } catch (e) {
        return { threw: true, message: String(e && e.message || e), taken: Array.from(taken) };
      }
    });
    console.log('MIG:opaque-id-collision-mutation red-run ' + JSON.stringify(r));
    check('MIG:opaque-id-collision:mutation', 'returning a duplicate after 50 collisions turns throw green red', r.threw === false && r.id === 'xx_0000000000', JSON.stringify(r));
    await p.close();
  }
}

{
  const mut = mutateCopy('var NW_S1_RESIZE_SPLICE_ALL = true;', 'var NW_S1_RESIZE_SPLICE_ALL = false;');
  check('MIG:v1-ids-resize:mutation-flag', 'resize-splice flag present', mut.ok, mut.detail);
  if (mut.ok) {
    const p = await openPage(mut.copy);
    const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-ids-resize.json'), 'utf8'));
    const r = await p.evaluate((nd) => {
      novelData = JSON.parse(JSON.stringify(nd));
      nwChapterIdsUpdate('resize', 2);
      nwChapterIdsUpdate('resize', 5);
      return {
        plans2: novelData.chapterWritingPlans && novelData.chapterWritingPlans[2],
        facts2: novelData.chapterRequiredFacts && novelData.chapterRequiredFacts[2],
        fps2: novelData.chapterFingerprints && novelData.chapterFingerprints[2],
        reqs2: novelData.chapterRequirements && novelData.chapterRequirements[2]
      };
    }, fx.input);
    check('MIG:v1-ids-resize:mutation', 'skipping S1 array truncate on resize brings stale records back (turns green red)', !!(r.plans2 && r.plans2.builtFrom === 'plan-stale') || !!(r.facts2 && r.facts2.items && r.facts2.items[0] && r.facts2.items[0].id === 'f-c'), JSON.stringify(r));
    await p.close();
  }
}

{
  const mut = mutateCopy('var NW_S1_RESIZE_CHAPTERS = true;', 'var NW_S1_RESIZE_CHAPTERS = false;');
  check('MIG:v1-ids-resize:chapters-mutation-flag', 'resize-chapters flag present', mut.ok, mut.detail);
  if (mut.ok) {
    const p = await openPage(mut.copy);
    const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-ids-resize.json'), 'utf8'));
    const r = await p.evaluate((nd) => {
      novelData = JSON.parse(JSON.stringify(nd));
      nwChapterIdsUpdate('resize', 2);
      const down = { chLen: (novelData.chapters || []).length, idLen: (novelData.chapterIds || []).length };
      nwChapterIdsUpdate('resize', 5);
      const grown = { chLen: (novelData.chapters || []).length, idLen: (novelData.chapterIds || []).length };
      return { down, grown };
    }, fx.input);
    check('MIG:v1-ids-resize:chapters-mutation', 'skipping chapters resize turns length-equal green red', r.down.chLen !== r.down.idLen || r.grown.chLen !== r.grown.idLen, JSON.stringify(r));
    await p.close();
  }
}

{
  const mut = mutateCopy('var NW_S1_RESIZE_SKIP_FUTURE = true;', 'var NW_S1_RESIZE_SKIP_FUTURE = false;');
  check('MIG:v2-ids-resize:mutation-flag', 'resize-skip-future flag present', mut.ok, mut.detail);
  if (mut.ok) {
    const p = await openPage(mut.copy);
    const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v2-ids-resize.json'), 'utf8'));
    const r = await p.evaluate((nd) => {
      novelData = JSON.parse(JSON.stringify(nd));
      const before = novelData.chapterIds.slice();
      nwSetOpaqueRng(nwSeededRng(0x53310001));
      nwChapterIdsUpdate('resize', 4);
      const afterUp = novelData.chapterIds.slice();
      nwChapterIdsUpdate('resize', 1);
      const afterDown = novelData.chapterIds.slice();
      return { before, afterUp, afterDown, chLen: (novelData.chapters || []).length };
    }, fx.input);
    console.log('MIG:v2-ids-resize-mutation red-run ' + JSON.stringify(r));
    check('MIG:v2-ids-resize:mutation', 'resizing a v2 book writes chapterIds (turns leave-untouched green red)', r.afterUp.length !== r.before.length || r.afterDown.length !== r.before.length, JSON.stringify(r));
    await p.close();
  }
}

{
  const mut = mutateCopy('var NW_S1_SPLICE_SCENES = true;', 'var NW_S1_SPLICE_SCENES = false;');
  check('MIG:v1-ids-survive-insert-reorder:mutation-flag', 'splice-scenes flag present', mut.ok, mut.detail);
  if (mut.ok) {
    const p = await openPage(mut.copy);
    const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-ids-survive-insert-reorder.json'), 'utf8'));
    const r = await p.evaluate((nd) => {
      novelData = JSON.parse(JSON.stringify(nd));
      const orig = novelData.chapterIds.slice();
      nwChapterIdsUpdate('insert', 2);
      const afterIns = novelData.chapterIds.slice();
      const scenesAfterIns = (novelData.chapterScenes || []).map((rec, i) => rec && rec.scenes && rec.scenes.map((s) => ({ id: s.id, chapterId: s.chapterId, chAt: novelData.chapterIds[i] })));
      const linkIns = scenesAfterIns.every((row) => !row || row.every((s) => s.chapterId === s.chAt));
      return { orig, afterIns, linkIns, scenesAfterIns };
    }, fx.input);
    check('MIG:v1-ids-survive-insert-reorder:mutation', 'skipping scene splice on insert turns order/chapterId asserts red', r.linkIns === false, JSON.stringify(r));
    await p.close();
  }
}

{
  const mut = mutateCopy('var NW_S1_WORLD_REMOVED_STALE = true;', 'var NW_S1_WORLD_REMOVED_STALE = false;');
  check('MIG:v1-plan-world-stale:mutation-flag', 'world-removed-stale flag present', mut.ok, mut.detail);
  if (mut.ok) {
    const p = await openPage(mut.copy);
    const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v1-plan-world-stale.json'), 'utf8'));
    const r = await p.evaluate((nd) => {
      novelData = JSON.parse(JSON.stringify(nd));
      novelData.chapterWritingPlans[0].builtFrom = nwComputeBuiltFrom(1);
      novelData.chapterWritingPlans[0].worldFrom = nwComputeWorldFrom(1) || 'stored-worldFrom';
      delete novelData.storyWorld;
      return { stale: nwPlanIsStale(1), cur: nwComputeWorldFrom(1) };
    }, fx.input);
    check('MIG:v1-plan-world-stale:mutation', 'cur && guard treats removed storyWorld as fresh (turns green red)', r.stale === false, JSON.stringify(r));
    await p.close();
  }
}

{
  const mut = mutateCopy('var NW_S1_RESTORE_OPAQUE_RNG = true;', 'var NW_S1_RESTORE_OPAQUE_RNG = false;');
  check('MIG:rng-restore:mutation-flag', 'restore-rng flag present', mut.ok, mut.detail);
  if (mut.ok) {
    const p = await openPage(mut.copy);
    const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'v0-chapters-to-proposed-scenes.json'), 'utf8'));
    const r = await p.evaluate((nd) => {
      const marker = function () { return 0.5; };
      nwSetOpaqueRng(marker);
      nwMigrateSession(JSON.parse(JSON.stringify(nd)), { rng: nwSeededRng(0x53310001) });
      const after = nwOpaqueId('xx_', new Set());
      return { after, expectedMarker: 'xx_iiiiiiiiii' };
    }, fx.input);
    check('MIG:rng-restore:mutation', 'skipping RNG restore leaks seeded rng (turns green red)', r.after !== r.expectedMarker, JSON.stringify(r));
    await p.close();
  }
}

check('pageerror', 'no uncaught pageerror', pageErrors.length === 0, pageErrors.join(' | '));

await browser.close();

const failed = checks.filter((c) => !c.ok);
const report = { passed: checks.filter((c) => c.ok).length, failed: failed.length, checks, pageErrors };
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'SMOKE_NW_MIGRATION.json'), JSON.stringify(report, null, 2));
console.log('NW migration smoke: ' + report.passed + ' passed, ' + report.failed + ' failed');
for (const c of checks) {
  console.log((c.ok ? 'PASS' : 'FAIL') + ' [' + c.id + '] ' + c.name + (c.ok ? '' : ' :: ' + c.detail));
}
if (failed.length) process.exit(1);
