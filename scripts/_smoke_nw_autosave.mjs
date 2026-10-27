#!/usr/bin/env node
// M-STAB WP1 smoke: NovelWriter autosave + SEC-SWEEP #180 shared isSecretField copy.
// Fully offline: AI responses come from _nw_mock_ai.mjs + the offline responder. The only key
// material used is the fake fixture FAKE-MOCK-KEY-0000. Run: npm run test:smoke:nw-autosave
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { stripperBlock, extractFn, markedBlock } from '../tests/sec/_load.mjs';
import { loadHBF, readHBF } from '../tests/sec/hbf/_hbf-load.mjs';
import { installMockAI } from './_nw_mock_ai.mjs';
import { createOfflineResponder, promptTextFromBody } from './_nw_e2e_offline_responder.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML_PATH = path.join(ROOT, 'NovelWriter', 'NovelWriter.html');
const URL_ = pathToFileURL(HTML_PATH).href;
const FAKE = 'FAKE-MOCK-KEY-0000';
const ONLY = process.env.NW_AUTOSAVE_ONLY ? new RegExp(process.env.NW_AUTOSAVE_ONLY) : null;

const results = [];
function check(id, ok, detail = '') {
  results.push({ id, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ' :: ' + String(detail).slice(0, 400) : ''}`);
}
const diffKeys = (a, b) => [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])].filter((k) => canon((a || {})[k]) !== canon((b || {})[k])).join(',');
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)) ? Object.keys(x).sort().reduce((o, kk) => (o[kk] = x[kk], o), {}) : x);

// ---------------------------------------------------------------- Part A: node / vm
const HTML = fs.readFileSync(HTML_PATH, 'utf8');
const HBF_HTML = readHBF();
const SEC_BEGIN = '// SEC-SWEEP #180 shared copy: begin';
const SEC_END = '// SEC-SWEEP #180 shared copy: end';

function loadNW() {
  const { block } = stripperBlock(HTML);
  const ctx = vm.createContext({ URL, URLSearchParams, console });
  vm.runInContext(block + '\n;globalThis.__x = { isSecretField: typeof isSecretField === "function" ? isSecretField : null, stripSecretFields: typeof stripSecretFields === "function" ? stripSecretFields : null };', ctx);
  return ctx.__x;
}
const H = loadHBF();
const hbfIsSecret = (k) => !!H.isSecretField(k);
let NW = null;
try { NW = loadNW(); } catch (e) { check('A.load-nw-stripper', false, e.name); }
const nwStrips = (k) => {
  if (!NW || !NW.stripSecretFields) return null;
  const out = NW.stripSecretFields({ [k]: 'v' });
  return !Object.prototype.hasOwnProperty.call(out, k);
};

const SECRET_NAMES = (() => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts', '_smoke_nw_story_core_21.mjs'), 'utf8');
  const m = src.match(/const SECRET_NAMES\s*=\s*(\[[\s\S]*?\]);/);
  return m ? vm.runInNewContext(m[1]) : [];
})();
const hbfRows = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'sec', 'hbf', 'fixtures', 'hbf-rows.json'), 'utf8')).rows;
const NAME_ROWS = hbfRows.filter((r) => r.kind === 'name').map((r) => r.input);

function declText(src, name) {
  const fnIdx = src.indexOf('function ' + name + '(');
  if (fnIdx >= 0) return extractFn(src, name);
  const re = new RegExp('const ' + name + ' = [^\\n]*');
  const m = src.match(re);
  if (!m) return null;
  return m[0].replace(/;\s*\/\/.*$/, ';');
}
const norm = (s) => (s == null ? null : s.replace(/\s+/g, ' ').trim());
if (!ONLY || ONLY.test('T-PAR')) {
  // T-PAR-1: marked block present and every shared declaration is a textual copy of HBF's.
  let nwBlock = null;
  try { nwBlock = markedBlock(HTML); } catch (_) { nwBlock = null; }
  check('T-PAR-1.marker-present', !!nwBlock, nwBlock ? '' : 'no SEC-SWEEP #180 marked block in NovelWriter.html');
  const hbfBlock = markedBlock(HBF_HTML);
  for (const n of ['FOLD', 'foldCase', 'EXACT', 'CRED_EXACT', 'KEY_STEMS', 'STEM_MAX', 'normalizeName', 'cls', 'nameWords', 'hasProviderKeyWords', 'isSecretField']) {
    const a = nwBlock ? norm(declText(nwBlock, n)) : null;
    const b = norm(declText(hbfBlock, n));
    check(`T-PAR-1.${n}`, a !== null && a === b, a === null ? 'missing in NW block' : (a === b ? '' : 'text differs'));
  }
  check('T-PAR-1.denylist-name-kept', /SECRET_FIELD_DENYLIST/.test(nwBlock || ''), '');
  // T-PAR-2: behavioural parity on every HBF name row + SECRET_NAMES.
  const names = [...NAME_ROWS, ...SECRET_NAMES];
  const mism = [];
  for (const k of names) { const a = nwStrips(k); const b = hbfIsSecret(k); if (a !== b) mism.push(JSON.stringify(k) + ' nw=' + a + ' hbf=' + b); }
  check('T-PAR-2.parity', names.length >= 145 && mism.length === 0, `${names.length} names, ${mism.length} mismatches${mism.length ? ': ' + mism.slice(0, 12).join('; ') : ''}`);
}

// Must-strip / must-keep sets. Variants (marked v:) give each name a case that is red at parent (F3).
const PSEC_STRIP = ['csrfToken', 'SESSION_TOKEN', 'XAI-API-KEY', 'awsKey', 'api_key', 'Api-Key', 'xaiApiKey', 'apiKey', 'sessionId',
  /* v: */ 'API_KEY_ID', 'apiKeyHint'];
const KEEP = ['tokens', 'tokenCount', 'tokenizer', 'sortKey', 'keyword', 'tokensUsed', 'maxTokens', 'tokenBudget', 'keyScene', 'keyEvents', 'monkey', 'turnkey', 'keystone', 'bookId', 'authorStyle', 'authorName', 'tokenUsage'];
const X5_STRIP = ['XAI_API_KEY', 'x-api-key', 'ApiKeyValue', 'myApiKey', 'refresh_token', 'idToken', 'OPENAI_KEY', 'anthropic-key', 'GeminiKey', 'github_key', 'Private-Key', 'secret_key',
  /* v: */ '\u017Fecret_key'];
const X8_STEMS = [['openai', 'Openai'], ['xai', 'Xai'], ['anthropic', 'Anthropic'], ['gemini', 'Gemini'], ['github', 'Github'], ['google', 'Google'], ['aws', 'Aws'], ['private', 'Private'], ['secret', 'Secret']];
const X8_STRIP = X8_STEMS.flatMap(([l, c]) => [l + 'Key', l + '_key', l + '-key', c + 'Key']).concat(['\u017FecretKey']);

if (!ONLY || ONLY.test('X|P-SEC')) {
  for (const k of PSEC_STRIP) check(`P-SEC-a.strip ${JSON.stringify(k)}`, nwStrips(k) === true && hbfIsSecret(k) === true);
  for (const k of KEEP) check(`P-SEC-a.keep ${k}`, nwStrips(k) === false && hbfIsSecret(k) === false);
  for (const k of X5_STRIP) check(`X5.strip ${JSON.stringify(k)}`, nwStrips(k) === true);
  for (const k of KEEP) check(`X6.keep ${k}`, nwStrips(k) === false);
  for (const k of X8_STRIP) check(`X8.strip ${JSON.stringify(k)}`, nwStrips(k) === true && hbfIsSecret(k) === true);
  // X4 nested objects / arrays.
  if (NW && NW.stripSecretFields) {
    const inObj = { chapters: [{ meta: { xaiApiKey: FAKE, note: 'ok' } }], settings: { Authorization: 'Bearer ' + FAKE, githubKey: FAKE, theme: 'dark' }, list: [{ refresh_token: FAKE, keyword: 'kw' }] };
    const out = NW.stripSecretFields(JSON.parse(JSON.stringify(inObj)));
    const s = JSON.stringify(out);
    check('X4.nested-stripped', !s.includes(FAKE) && out.chapters?.[0]?.meta?.note === 'ok' && out.settings?.theme === 'dark' && out.list?.[0]?.keyword === 'kw', s.includes(FAKE) ? 'fake key survived' : '');
  } else check('X4.nested-stripped', false, 'stripSecretFields unavailable');
  // X7 URL query/fragment names.
  const URLS = [['https://api.example.test/v1?X-Api-Key=' + FAKE, true], ['https://api.example.test/v1#xaiApiKey=' + FAKE, true], ['https://api.example.test/v1?openai_key=' + FAKE, true],
    ['https://api.example.test/v1?refresh_token=' + FAKE, true], ['https://example.org/book?keyword=x&tokens=3', false]];
  for (const [u, secret] of URLS) {
    let ok = false;
    if (NW && NW.stripSecretFields) { const out = NW.stripSecretFields({ link: u }); ok = secret ? !JSON.stringify(out).includes(FAKE) : out.link === u; }
    check(`X7.url ${u.replace(FAKE, '<fake>')}`, ok);
  }
}

// ---------------------------------------------------------------- Part B: browser
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'fixtures', 'nw_slop', 'b3r_seed.json'), 'utf8'));
const responder = createOfflineResponder(seed);
const browser = await chromium.launch({ headless: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-autosave-'));

const AIS = new Map();
const fillKey = (page) => AIS.get(page).fillKey(page);
async function newPage({ initScript } = {}) {
  const context = await browser.newContext({ acceptDownloads: true });
  const ai = await installMockAI(context, {
    fixtures: { default: (body) => responder.respond(body).content, subplots: (body) => responder.respond(body).content },
    classify: (_t, body) => (/"subplots"\s*:\s*\[/.test(promptTextFromBody(body || {})) ? 'subplots' : 'default'),
  });
  const page = await context.newPage();
  const consoleLines = []; const pageErrors = [];
  page.on('console', (m) => consoleLines.push(m.text()));
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message)));
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  AIS.set(page, ai);
  if (initScript) await page.addInitScript(initScript);
  await load(page);
  return { context, ai, page, consoleLines, pageErrors };
}
async function load(page, reload = false) {
  if (reload) await page.reload({ waitUntil: 'load' }); else await page.goto(URL_, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.callAI === 'function' || typeof callAI === 'function', null, { timeout: 15000 });
  await page.waitForFunction(() => window.__nwAutosaveReady === true, null, { timeout: 1500 }).catch(() => {});
}
async function dump(page) {
  return page.evaluate(async () => {
    const ls = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); }
    const idb = {}; let version = 0;
    try {
      const db = await new Promise((res, rej) => { const r = indexedDB.open('novelwriter'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      version = db.version;
      for (const s of Array.from(db.objectStoreNames)) {
        idb[s] = await new Promise((res) => { const rq = db.transaction(s, 'readonly').objectStore(s).getAll(); rq.onsuccess = () => res(rq.result); rq.onerror = () => res([]); });
      }
      db.close();
    } catch (_) {}
    return { ls, idb, version };
  });
}
function autosaveRecs(d) {
  const lsKey = Object.keys(d.ls).find((k) => /autosave/i.test(k));
  let ls = null; try { ls = lsKey ? JSON.parse(d.ls[lsKey]) : null; } catch (_) { ls = 'CORRUPT'; }
  const idb = (d.idb.autosave || [])[0] || null;
  return { lsKey, lsRaw: lsKey ? d.ls[lsKey] : null, ls, idb, idbRaw: idb ? JSON.stringify(idb) : null };
}
// Restore runs the import path (normalizeImportedSessionData + nwMigrateSession + applySessionDataToUI), which adds
// ext.novelWriter.migratedBy, character/subplot ids and UI-derived chapter fields. Those are compared out; all else is deep-equal.
const DERIVED = ['ext', 'editedChapters', 'bookText', 'chapterScenes', 'chapterFingerprints'];
const mig = (nd) => { const c = JSON.parse(JSON.stringify(nd || {})); for (const k of DERIVED) delete c[k]; for (const k of ['characters', 'subplots']) if (Array.isArray(c[k])) c[k] = c[k].map((x) => { if (x && typeof x === 'object') { const y = { ...x }; delete y.id; return y; } return x; }); return c; };
const pageState = (page) => page.evaluate(() => {
  const cur = JSON.parse(JSON.stringify(novelData)); delete cur.apiKey;
  const s = typeof stripSecretFields === 'function' ? stripSecretFields(cur) : cur;
  return { nd: s, apiKeyField: document.getElementById('apiKey').value, apiKeyND: novelData.apiKey };
});
const stripRec = (nd) => { const c = JSON.parse(JSON.stringify(nd || {})); delete c.apiKey; return c; };
const bannerText = (page) => page.evaluate(() => { const b = document.getElementById('nwAutosaveBanner'); return b && b.offsetParent !== null ? b.innerText : ''; });
const warnText = (page) => page.evaluate(() => { const b = document.getElementById('nwAutosaveWarn'); return b && b.offsetParent !== null ? b.innerText.trim() : ''; });
async function edit(page, sel, val) { await page.fill(sel, val); }
const settle = (ms) => new Promise((r) => setTimeout(r, ms));
async function setupStory(page) {
  await page.evaluate((s) => {
    document.getElementById('genre').value = 'scifi';
    document.getElementById('title').value = s.title || 'Offline Seed Title';
    document.getElementById('numChapters').value = '3';
    if (typeof updateChapterSubpages === 'function') updateChapterSubpages();
    if (typeof syncCharacterEntries === 'function') syncCharacterEntries();
    if (typeof syncSubplotEntries === 'function') syncSubplotEntries();
    if (typeof collectData === 'function') collectData();
  }, seed);
  await fillKey(page);
}
const runStage = (page, fn) => page.evaluate(async (f) => { try { await window[f](); return 'ok'; } catch (e) { return 'err:' + (e && e.name); } }, fn);
const scan = (s) => (String(s).match(/FAKE-MOCK-KEY/g) || []).length;
const T = (id) => !ONLY || ONLY.test(id);

try {
  // ---- P1 + P4: every stage boundary is saved and survives reload.
  if (T('P1') || T('P4')) {
    const { page, context } = await newPage();
    await setupStory(page);
    const marker = 'P1-title-' + Date.now();
    await edit(page, '#title', marker);
    await settle(1000);
    let r = autosaveRecs(await dump(page));
    check('P1.inputs-saved-before-call', r.ls && r.ls !== 'CORRUPT' && r.ls.novelData?.title === marker && r.idb?.novelData?.title === marker);
    for (const st of ['fetchAuthors', 'suggestStoryInfo', 'suggestCharacters', 'suggestSubplots']) {
      const rv = await runStage(page, st);
      await settle(300);
      const ps = await pageState(page);
      r = autosaveRecs(await dump(page));
      const okLs = r.ls && r.ls !== 'CORRUPT' && canon(stripRec(r.ls.novelData)) === canon(ps.nd);
      const okIdb = r.idb && canon(stripRec(r.idb.novelData)) === canon(ps.nd);
      check(`P1.${st}.saved-after-settle`, okLs && okIdb, `stage=${rv} ls=${!!okLs} idb=${!!okIdb}`);
      await load(page, true);
      const after = await pageState(page);
      check(`P4.${st}.reload-restores`, canon(mig(after.nd)) === canon(mig(ps.nd)) && /Restored autosave from .+ CT/.test(await bannerText(page)), 'diff=' + diffKeys(mig(after.nd), mig(ps.nd)));
      await fillKey(page);
    }
    // chapters boundary (seeded chapter text + a settled AI call flush).
    await page.evaluate(() => { novelData.chapters = Array.from({ length: Number(novelData.numChapters) || 1 }, (_, i) => (i === 0 ? 'Chapter one seeded text for autosave boundary.' : '')); });
    await page.evaluate(async () => { try { await callAI([{ role: 'user', content: 'Reply with exactly: ok' }], document.getElementById('tab1'), { operationName: 'autosaveSmoke' }); } catch (_) {} });
    await settle(300);
    const psC = await pageState(page);
    await load(page, true);
    const afterC = await pageState(page);
    check('P4.chapters.reload-restores', afterC.nd.chapters?.[0] === psC.nd.chapters?.[0] && psC.nd.chapters?.[0]?.startsWith('Chapter one') && canon(mig(afterC.nd)) === canon(mig(psC.nd)), 'diff=' + diffKeys(mig(afterC.nd), mig(psC.nd)) + ' ' + JSON.stringify(psC.nd.chapters).slice(0, 120) + ' -> ' + JSON.stringify(afterC.nd.chapters).slice(0, 120));
    await context.close();
  }

  // ---- P2: AI timeout on Subplots, reload within 100ms; P3: reload mid-call.
  if (T('P2') || T('P3')) {
    for (const mode of ['P2', 'P3']) {
      const { page, context, ai } = await newPage();
      await setupStory(page);
      for (const st of ['fetchAuthors', 'suggestStoryInfo', 'suggestCharacters']) await runStage(page, st);
      await settle(300);
      const before = await pageState(page);
      ai.setMode('subplots', 'hang');
      await page.evaluate(() => { document.getElementById('aiCallTimeoutSec').value = '1'; });
      if (mode === 'P2') {
        await runStage(page, 'suggestSubplots');
        await page.reload({ waitUntil: 'load' }).catch(() => {});
      } else {
        await page.evaluate(() => { window.suggestSubplots().catch(() => {}); });
        await settle(300);
        await page.reload({ waitUntil: 'load' }).catch(() => {});
      }
      await load(page, true).catch(() => {});
      const after = await pageState(page);
      const eq = ['title', 'genre', 'authors', 'author', 'storyArc', 'generalPlot', 'setting', 'characters'].every((k) => canon(mig(after.nd)[k]) === canon(mig(before.nd)[k]));
      check(`${mode}.prior-tabs-intact`, eq && /Restored autosave/.test(await bannerText(page)), 'diff=' + diffKeys(mig(after.nd), mig(before.nd)) + ' banner=' + JSON.stringify((await bannerText(page)).slice(0, 80)));
      if (mode === 'P3') check('P3.interrupted-stage-marked', /interrupted/i.test(await bannerText(page)));
      await context.close();
    }
  }

  // ---- P5: corrupt localStorage record.
  if (T('P5')) {
    const { page, context, pageErrors } = await newPage();
    const marker = 'P5-good-' + Date.now();
    await edit(page, '#title', marker); await settle(1000);
    const r = autosaveRecs(await dump(page));
    check('P5.good-record-written', !!r.lsKey && r.idb?.novelData?.title === marker);
    if (r.lsKey) await page.evaluate((k) => localStorage.setItem(k, '{corrupt'), r.lsKey);
    pageErrors.length = 0;
    await load(page, true);
    const st = await pageState(page);
    check('P5.corrupt-recovered', pageErrors.length === 0 && /autosave/i.test(await warnText(page)) && st.nd.title === marker, `errors=${pageErrors.length} warn=${JSON.stringify(await warnText(page))} title=${st.nd.title === marker}`);
    await context.close();
  }

  // ---- P6 / F2: quota + IDB write errors keep last good copy; warning is fixed text + class only.
  if (T('P6') || T('F2')) {
    for (const kind of ['QuotaExceededError', 'UnknownError', 'DataCloneError']) {
      const { page, context, consoleLines } = await newPage();
      await page.fill('#apiKey', FAKE);
      await page.evaluate((f) => { novelData.apiKey = f; }, FAKE);
      const good = 'P6-good-' + kind;
      await edit(page, '#title', good); await settle(1000);
      const r0 = autosaveRecs(await dump(page));
      await page.evaluate((k) => {
        if (k === 'QuotaExceededError') { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (a, b) { if (/autosave/i.test(a)) throw new DOMException('quota exceeded', 'QuotaExceededError'); return o.call(this, a, b); }; }
        else { IDBObjectStore.prototype.put = function () { throw new DOMException('put failed', k); }; }
      }, kind);
      const bad = 'P6-bad-' + kind;
      await edit(page, '#title', bad); await settle(1000);
      const r1 = autosaveRecs(await dump(page));
      const w = await warnText(page);
      const fixed = /^Autosave failed \(([A-Za-z]+)\)\. Last good copy kept\.$/.exec(w);
      check(`P6.${kind}.warning-fixed-text`, !!fixed && fixed[1] === kind && !w.includes(bad), JSON.stringify(w));
      if (kind === 'QuotaExceededError') check(`P6.${kind}.last-good-kept`, !!r0.lsRaw && r1.lsRaw === r0.lsRaw);
      else check(`P6.${kind}.last-good-kept`, !!r0.idbRaw && r1.idbRaw === r0.idbRaw);
      const dom = await page.evaluate(() => document.documentElement.outerHTML + '\n' + document.body.innerText + '\n' + JSON.stringify((window.nwBatchState && nwBatchState.log) || []));
      const leaks = scan(consoleLines.join('\n')) + scan(dom) + scan(JSON.stringify(await dump(page)));
      check(`F2.${kind}.no-key-leak`, !!fixed && leaks === 0, `leaks=${leaks}`);
      await context.close();
    }
  }

  // ---- P7: autosave + batch checkpoint both present -> prompt naming the newer, no auto-apply.
  if (T('P7')) {
    for (const order of ['autosave-newer', 'checkpoint-newer']) {
      const { page, context } = await newPage();
      const mkCkpt = () => page.evaluate(async () => {
        novelData.batchRun = { id: 'run-p7', startedAt: new Date().toISOString(), completed: [], inFlight: { op: 'x' }, status: 'running' };
        if (typeof nwBatchState !== 'undefined') nwBatchState.runId = 'run-p7';
        if (typeof nwBatchCheckpoint === 'function') await nwBatchCheckpoint(true);
      });
      if (order === 'checkpoint-newer') { await edit(page, '#title', 'P7-auto'); await settle(1000); await settle(50); await mkCkpt(); }
      else { await mkCkpt(); await settle(50); await edit(page, '#title', 'P7-auto'); await settle(1000); }
      await load(page, true);
      const t = await page.evaluate(() => { const b = document.getElementById('nwAutosaveConflict'); return b && b.offsetParent !== null ? b.innerText : ''; });
      const want = order === 'autosave-newer' ? /autosave[^.]*newer|newer[^.]*autosave/i : /checkpoint[^.]*newer|newer[^.]*checkpoint/i;
      const title = await page.evaluate(() => document.getElementById('title').value);
      check(`P7.${order}.prompt`, want.test(t) && title !== 'P7-auto', JSON.stringify(t.slice(0, 160)));
      await context.close();
    }
  }

  // ---- X1/X2/X3/X9/X13/X14/P-SEC-b/P-SEC-c in one context.
  if (T('X') || T('P-SEC')) {
    const { page, context } = await newPage();
    // X1: key in #apiKey, stage rejects (401 for non-mock bearer) -> flush; no key anywhere.
    await setupStory(page);
    await page.fill('#apiKey', FAKE);
    await runStage(page, 'fetchAuthors');
    await settle(300);
    let d = await dump(page); let r = autosaveRecs(d);
    check('X1.flush-no-key', !!r.ls && !!r.idb && scan(JSON.stringify(d)) === 0);
    // X2: key in novelData.apiKey.
    await page.evaluate((f) => { novelData.apiKey = f; }, FAKE);
    await edit(page, '#title', 'X2-title'); await settle(1000);
    d = await dump(page); r = autosaveRecs(d);
    check('X2.novelData-apiKey-not-persisted', r.ls?.novelData?.title === 'X2-title' && !('apiKey' in (r.ls?.novelData || { apiKey: 1 })) && !('apiKey' in (r.idb?.novelData || { apiKey: 1 })) && scan(JSON.stringify(d)) === 0);
    // X3: pagehide synchronous write.
    const x3 = await page.evaluate((f) => {
      document.getElementById('apiKey').value = f; novelData.apiKey = f;
      const el = document.getElementById('title'); el.value = 'X3-pagehide'; el.dispatchEvent(new Event('input', { bubbles: true }));
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
      const out = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); out[k] = localStorage.getItem(k); }
      return out;
    }, FAKE);
    const x3raw = Object.entries(x3).find(([k]) => /autosave/i.test(k))?.[1] || '';
    check('X3.pagehide-sync-no-key', x3raw.includes('X3-pagehide') && scan(x3raw) === 0);
    // P-SEC-b: names inside novelData.
    await page.evaluate(({ strip, keep, f }) => {
      novelData.secProbe = {}; for (const k of strip) novelData.secProbe[k] = f; for (const k of keep) novelData.secProbe[k] = 'keep-' + k;
    }, { strip: [...PSEC_STRIP, ...X5_STRIP.slice(0, 4)], keep: KEEP, f: FAKE });
    // P-SEC-c: 2KB chapter body with a link mid-paragraph.
    const link = 'https://example.org/research/notes?page=7';
    const body = ('Lorem ipsum dolor sit amet, prose paragraph. ').repeat(22) + ' See ' + link + ' for the map. ' + ('More chapter prose follows here. ').repeat(34);
    await page.evaluate((b) => { novelData.chapters = [b]; }, body);
    await edit(page, '#title', 'PSEC-title'); await settle(1000);
    d = await dump(page); r = autosaveRecs(d);
    const probes = [r.ls?.novelData?.secProbe, r.idb?.novelData?.secProbe];
    check('P-SEC-b.strip+keep', probes.every((p) => p && PSEC_STRIP.every((k) => !(k in p)) && KEEP.every((k) => p[k] === 'keep-' + k)) && scan(JSON.stringify(d)) === 0);
    const ch = r.ls?.novelData?.chapters?.[0];
    const [pre, post] = body.split(link);
    check('P-SEC-c.prose-kept', typeof ch === 'string' && (ch === body || (ch.startsWith(pre) && ch.endsWith(post))) && r.idb?.novelData?.chapters?.[0] === ch, `len=${ch && ch.length}/${body.length}`);
    // X9 + X13: reload -> restore; key empty; banner + Discard.
    await page.fill('#apiKey', FAKE);
    await load(page, true);
    const st = await pageState(page);
    const bt = await bannerText(page);
    check('X9.restore-key-empty', st.nd.title === 'PSEC-title' && st.apiKeyField === '' && st.apiKeyND === '');
    check('X13.banner', /^Restored autosave from .+ CT/.test(bt.trim()) && (await page.locator('#nwAutosaveBanner button', { hasText: 'Discard' }).count()) === 1, JSON.stringify(bt.slice(0, 120)));
    // X14: export never contains the key.
    await page.fill('#apiKey', FAKE);
    const dl = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.evaluate(() => exportSession())]).then(([x]) => x).catch(() => null);
    let exp = ''; if (dl) { const p = path.join(tmp, 'x14.json'); await dl.saveAs(p); exp = fs.readFileSync(p, 'utf8'); }
    check('X14.export-no-key', exp.length > 0 && scan(exp) === 0);
    await context.close();
  }

  // ---- X10: settled-rejected call flushes within 50ms.
  if (T('X10')) {
    const { page, context, ai } = await newPage();
    await fillKey(page);
    await edit(page, '#title', 'X10'); await settle(1000);
    ai.next('http:500');
    const res = await page.evaluate(async () => {
      const rd = () => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/autosave/i.test(k)) { try { return JSON.parse(localStorage.getItem(k)).savedAt; } catch (_) { return null; } } } return null; };
      const before = rd();
      novelData.title = 'X10-after';
      await new Promise((r) => setTimeout(r, 5));
      let t0 = 0; try { await callAI([{ role: 'user', content: 'Reply with exactly: ok' }], document.getElementById('tab1'), { operationName: 'autosaveSmoke' }); } catch (_) { } t0 = performance.now();
      while (performance.now() - t0 < 300) { const s = rd(); if (s && s !== before) return { dt: performance.now() - t0, ok: true }; await new Promise((r) => setTimeout(r, 2)); }
      return { ok: false };
    });
    check('X10.reject-flush-50ms', res.ok && res.dt <= 50, JSON.stringify(res));
    await context.close();
  }

  // ---- X11: IDB v1 -> v2 keeps checkpoints.
  if (T('X11')) {
    const init = () => {
      if (sessionStorage.getItem('x11done')) return; sessionStorage.setItem('x11done', '1');
      const r = indexedDB.open('novelwriter', 1);
      r.onupgradeneeded = () => { const db = r.result; const s = db.createObjectStore('checkpoints'); s.put({ key: 'run-old', savedAt: '2026-01-01T00:00:00.000Z', active: false, novelData: { title: 'X11' }, batchRun: { id: 'run-old' } }, 'run-old'); };
      r.onsuccess = () => r.result.close();
    };
    const { page, context } = await newPage({ initScript: init });
    await settle(500);
    const d = await dump(page);
    check('X11.idb-upgrade', d.version === 2 && Array.isArray(d.idb.autosave) && (d.idb.checkpoints || []).some((c) => c && c.key === 'run-old' && c.novelData?.title === 'X11'), `v=${d.version} stores=${Object.keys(d.idb)}`);
    await context.close();
  }

  // ---- X12: bookId migration on import, survives export -> re-import.
  if (T('X12')) {
    const { page, context } = await newPage();
    const sess = { title: 'X12-legacy', genre: 'scifi', numChapters: 3, chapters: [], characters: [], subplots: [] };
    const f1 = path.join(tmp, 'x12.json'); fs.writeFileSync(f1, JSON.stringify(sess));
    await page.setInputFiles('#importFile', f1);
    await page.waitForFunction(() => novelData.title === 'X12-legacy', null, { timeout: 5000 }).catch(() => {});
    const id1 = await page.evaluate(() => novelData.bookId || '');
    await edit(page, '#title', 'X12-legacy'); await settle(1000);
    const r = autosaveRecs(await dump(page));
    const dl = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.evaluate(() => exportSession())]).then(([x]) => x).catch(() => null);
    const f2 = path.join(tmp, 'x12b.json'); if (dl) await dl.saveAs(f2);
    await context.close();
    const P2 = await newPage();
    if (dl) await P2.page.setInputFiles('#importFile', f2);
    await P2.page.waitForFunction(() => novelData.title === 'X12-legacy', null, { timeout: 5000 }).catch(() => {});
    const id2 = await P2.page.evaluate(() => novelData.bookId || '');
    check('X12.bookId-migrated', typeof id1 === 'string' && id1.length >= 8 && r.idb?.bookId === id1 && id2 === id1, `id1=${!!id1} rec=${r.idb?.bookId === id1} id2=${id2 === id1}`);
    await P2.context.close();
  }

  // ---- F1: Discard is final.
  if (T('F1')) {
    const { page, context, ai } = await newPage();
    await fillKey(page);
    const prime = async (tag) => { await edit(page, '#title', 'F1-' + tag); await settle(1000); await load(page, true); return /Restored autosave/.test(await bannerText(page)); };
    const empty = async () => { const r = autosaveRecs(await dump(page)); return !r.lsRaw && !r.idb; };
    const discard = async () => { const b = page.locator('#nwAutosaveBanner button', { hasText: 'Discard' }); if (await b.count()) await b.click(); };
    // (i) pending debounce
    let ok = await prime('i');
    await page.fill('#title', 'F1-i-pending');
    await discard(); await settle(1200);
    check('F1.i.pending-debounce', ok && await empty());
    // (ii) in-flight callAI
    ok = await prime('ii');
    await fillKey(page);
    ai.setMode('default', 'delay:800');
    await page.evaluate(() => { window.__f1 = callAI([{ role: 'user', content: 'Reply with exactly: ok' }], document.getElementById('tab1'), { operationName: 'autosaveSmoke' }).catch(() => {}); });
    await settle(100); await discard();
    await page.evaluate(() => window.__f1); await settle(300);
    ai.setMode('default', 'ok');
    check('F1.ii.inflight-callAI', ok && await empty());
    // (iii) pagehide
    ok = await prime('iii');
    await discard();
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
    check('F1.iii.pagehide', ok && await empty());
    // (iv) reload immediately after Discard
    ok = await prime('iv');
    await page.fill('#title', 'F1-iv-pending');
    await discard();
    await load(page, true);
    check('F1.iv.reload', ok && await empty() && !(await bannerText(page)));
    await context.close();
  }
  const typeVal = (page, sel, v) => page.evaluate(([q, x]) => { const el = document.querySelector(q); el.value = x; el.dispatchEvent(new Event('input', { bubbles: true })); }, [sel, v]);
  // ---- FIX1 (Copilot #194 r4387552939): typed subplot + chapterContentN edits reach novelData and the autosave record.
  if (T('R1')) {
    const { page, context } = await newPage();
    await setupStory(page);
    await settle(200);
    const sub = 'R1-subplot-' + Date.now();
    const subSel = '#subplotList textarea.subplot';
    const hasSub = await page.locator(subSel).count();
    const typeIn = (sel, v) => page.evaluate(([q, x]) => { const el = document.querySelector(q); el.value = x; el.dispatchEvent(new Event('input', { bubbles: true })); }, [sel, v]);
    if (hasSub) await typeIn(subSel, sub);
    const hasCc = await page.locator('#chapterContent1').count();
    const cc = 'Outline: R1 outline text\n\nArc: R1 arc text';
    if (hasCc) await typeIn('#chapterContent1', cc);
    const hasImp = await page.locator('#chapterImprovement1').count();
    if (hasImp) await typeIn('#chapterImprovement1', 'R1 improvement note');
    await settle(1000);
    const r = autosaveRecs(await dump(page));
    const recSub = (x) => { const s = x?.novelData?.subplots?.[0]; return typeof s === 'string' ? s : (s && (s.summary || s.title)) || ''; };
    check('R1.subplot-typed-saved', hasSub > 0 && recSub(r.ls) === sub && recSub(r.idb) === sub, `dom=${hasSub} ls=${JSON.stringify(recSub(r.ls)).slice(0, 60)}`);
    check('R1.chapterContent-typed-saved', hasCc > 0 && r.ls?.novelData?.chapterOutlines?.[0] === 'R1 outline text' && r.ls?.novelData?.chapterArcs?.[0] === 'R1 arc text' && r.idb?.novelData?.chapterOutlines?.[0] === 'R1 outline text', `dom=${hasCc} out=${JSON.stringify(r.ls?.novelData?.chapterOutlines?.[0])}`);
    check('R1.chapterImprovement-typed-saved', hasImp > 0 && r.ls?.novelData?.chapterImprovements?.[0] === 'R1 improvement note', `dom=${hasImp}`);
    const memSub = await page.evaluate(() => novelData.subplots && novelData.subplots[0]);
    check('R1.subplot-in-novelData', memSub === sub, JSON.stringify(memSub).slice(0, 60));
    await load(page, true);
    const after = await page.evaluate(() => ({ sub: (document.querySelector('#subplotList textarea.subplot') || {}).value || '', cc: (document.getElementById('chapterContent1') || {}).value || '' }));
    check('R1.reload-restores-typed', after.sub === sub && /R1 outline text/.test(after.cc) && /R1 arc text/.test(after.cc), JSON.stringify({ sub: after.sub.slice(0, 40), cc: after.cc.slice(0, 60) }));
    await context.close();
  }

  // ---- FIX2/FIX3 (r4387553057, r4387553119): conflict-path choices.
  async function conflictPage() {
    const ctx = await newPage();
    const { page } = ctx;
    await page.evaluate(async () => {
      document.getElementById('title').value = 'R-ckpt-title'; novelData.title = 'R-ckpt-title';
      novelData.batchRun = { id: 'run-r23', startedAt: new Date().toISOString(), completed: [], inFlight: null, status: 'running', reason: 'user', stoppedAt: 1, range: { from: 1, to: 1 } };
      if (typeof nwBatchState !== 'undefined') nwBatchState.runId = 'run-r23';
      if (typeof nwBatchCheckpoint === 'function') await nwBatchCheckpoint(true);
    });
    await settle(50);
    await edit(page, '#title', 'R-auto-title'); await settle(1000);
    await load(page, true);
    const shown = await page.evaluate(() => { const b = document.getElementById('nwAutosaveConflict'); return !!(b && b.offsetParent !== null); });
    return { ...ctx, shown };
  }
  const lockState = (page) => page.evaluate(() => ({
    locked: typeof nwBatchIsLocked === 'function' ? nwBatchIsLocked() : null,
    interrupted: !!(window.nwBatchState && nwBatchState.interrupted) || (typeof nwBatchState !== 'undefined' && !!nwBatchState.interrupted),
    restoreBox: (() => { const b = document.getElementById('batchRestoreBox'); return !!(b && !b.hidden); })(),
    batchFromDisabled: (() => { const b = document.getElementById('batchFrom'); return b ? !!b.disabled : null; })(),
    ready: typeof nwAutosaveState !== 'undefined' ? !!nwAutosaveState.ready : null,
    conflict: (() => { const b = document.getElementById('nwAutosaveConflict'); return !!(b && !b.hidden); })(),
    title: document.getElementById('title').value,
  }));
  if (T('R2')) {
    const { page, context, shown } = await conflictPage();
    if (shown) await page.click('#nwAutosaveConflictRestore');
    await settle(300);
    const s = await lockState(page);
    check('R2.restore-autosave-unlocks', shown && s.locked === false && !s.interrupted && !s.restoreBox && s.batchFromDisabled === false && s.title === 'R-auto-title', JSON.stringify(s));
    await typeVal(page, '#title', 'R2-after'); await settle(1000);
    const r = autosaveRecs(await dump(page));
    check('R2.autosave-on-after-restore', r.ls?.novelData?.title === 'R2-after', JSON.stringify(r.ls?.novelData?.title));
    await load(page, true);
    const c2 = await page.evaluate(() => { const b = document.getElementById('nwAutosaveConflict'); return !!(b && b.offsetParent !== null); });
    const s2 = await lockState(page);
    check('R2.checkpoint-not-resurrected', !c2 && s2.locked === false && s2.title === 'R2-after', JSON.stringify({ c2, ...s2 }));
    await context.close();
  }
  if (T('R3')) {
    const { page, context, shown } = await conflictPage();
    if (shown) await page.evaluate(() => document.getElementById('batchRestoreBtn').click());
    await settle(500);
    const s = await lockState(page);
    check('R3.ckpt-restore-resolves-conflict', shown && s.ready === true && s.conflict === false && s.title === 'R-ckpt-title', JSON.stringify(s));
    await typeVal(page, '#title', 'R3-after'); await settle(1000);
    const r = autosaveRecs(await dump(page));
    check('R3.autosave-on-after-ckpt-restore', r.ls?.novelData?.title === 'R3-after' && r.idb?.novelData?.title === 'R3-after', JSON.stringify(r.ls?.novelData?.title));
    // A stale "Discard autosave" button must not blank the restored session.
    await page.evaluate(() => { const b = document.getElementById('nwAutosaveConflictDiscard'); if (b) b.click(); });
    await settle(500);
    const t = await page.evaluate(() => ({ title: document.getElementById('title').value, nd: novelData.title }));
    check('R3.stale-discard-keeps-session', t.title === 'R3-after' && t.nd === 'R3-after', JSON.stringify(t));
    await context.close();
    // Discard autosave from the conflict prompt keeps the current session (nothing from the autosave was applied).
    const B = await conflictPage();
    if (B.shown) await typeVal(B.page, '#title', 'R3-typed-during-prompt');
    const pre = await B.page.evaluate(() => JSON.stringify({ t: document.getElementById('title').value, g: document.getElementById('genre').value }));
    if (B.shown) await B.page.click('#nwAutosaveConflictDiscard');
    await settle(500);
    const post = await B.page.evaluate(() => JSON.stringify({ t: document.getElementById('title').value, g: document.getElementById('genre').value }));
    const sB = await lockState(B.page);
    check('R3.conflict-discard-no-blank', B.shown && post === pre && /R3-typed-during-prompt/.test(post) && sB.ready === true && sB.conflict === false, `pre=${pre} post=${post}`);
    await B.context.close();
  }

  // ---- FIX4 (CodeQL js/clear-text-storage :15539): the key value never reaches any autosave payload.
  if (T('R4')) {
    const { page, context, consoleLines } = await newPage();
    await page.fill('#apiKey', FAKE);
    await page.evaluate((f) => {
      novelData.apiKey = f;
      novelData.generalPlot = 'Plot text with a pasted key ' + f + ' inside.';
      novelData.secProbe2 = { deep: [{ apiKey: f }, { note: 'x' + f + 'y' }] };
    }, FAKE);
    await edit(page, '#title', 'R4-title'); await settle(1000);
    const d = await dump(page); const r = autosaveRecs(d);
    check('R4.key-value-never-persisted', r.ls?.novelData?.title === 'R4-title' && r.idb?.novelData?.title === 'R4-title' && scan(JSON.stringify(d)) === 0 && scan(consoleLines.join('\n')) === 0, `hits=${scan(JSON.stringify(d))}`);
    check('R4.surrounding-text-kept', /Plot text with a pasted key .* inside\./.test(r.ls?.novelData?.generalPlot || ''), '');
    const x3 = await page.evaluate(() => { window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })); return localStorage.getItem('novelwriter.autosave.v1') || ''; });
    check('R4.pagehide-key-value-never-persisted', x3.includes('R4-title') && scan(x3) === 0);
    const unit = await page.evaluate(() => {
      if (typeof nwAutosaveSerialize !== 'function') return { ok: false, why: 'no nwAutosaveSerialize' };
      const s = nwAutosaveSerialize(nwAutosaveBuildRecord());
      return { ok: typeof s === 'string' && !/"apiKey"\s*:/.test(s), why: '' };
    });
    check('R4.serializer-drops-apiKey', unit.ok, unit.why);
    await context.close();
  }
} catch (e) {
  check('B.harness', false, (e && e.name) + ': ' + String(e && e.message).split('\n')[0]);
} finally {
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

const fail = results.filter((r) => !r.ok);
console.log(`SUMMARY nw-autosave: ${results.length - fail.length}/${results.length} PASS, ${fail.length} FAIL`);
process.exit(fail.length ? 1 : 0);
