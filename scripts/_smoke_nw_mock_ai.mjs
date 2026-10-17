/**
 * M-STAB WP0 M0: self-test for the shared mock-AI harness (scripts/_nw_mock_ai.mjs).
 * Offline. Drives the real NovelWriter callAI against the mocked api.x.ai and checks that
 *   - the harness refuses to start when XAI_API_KEY or GROK_API_KEY is set,
 *   - every host except the mocked api.x.ai is blocked and recorded as a violation,
 *   - the bearer the mock sees is the mock key (any other key is rejected and recorded),
 *   - each mode behaves: ok / delay / hang / http:<5xx> / truncated / partial / abort.
 *
 *   node scripts/_smoke_nw_mock_ai.mjs
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const HARNESS = path.join(SCRIPT_DIR, '_nw_mock_ai.mjs');
const HTML_PATH = path.resolve(process.env.NW_HTML_PATH || path.join(REPO_ROOT, 'NovelWriter', 'NovelWriter.html'));
const OUT_DIR = path.resolve(process.env.NW_OUT_DIR || path.join(REPO_ROOT, 'out', 'nw-smoke'));

const checks = [];
const check = (id, name, ok, detail) => checks.push({ id, name, ok: !!ok, detail: ok ? '' : String(detail == null ? '' : detail).slice(0, 1400) });

// ---------------- Refuse to start with a live key ----------------
function importHarnessWith(env) {
  const childEnv = { ...process.env };
  delete childEnv.XAI_API_KEY; delete childEnv.GROK_API_KEY;
  Object.assign(childEnv, env);
  return spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(HARNESS).href)}); console.log('HARNESS_LOADED');`], {
    cwd: REPO_ROOT, env: childEnv, encoding: 'utf8', timeout: 60000,
  });
}
for (const k of ['XAI_API_KEY', 'GROK_API_KEY']) {
  const r = importHarnessWith({ [k]: 'live-looking-value' });
  check('M0.env', `harness refuses to start when ${k} is set`,
    r.status !== 0 && !/HARNESS_LOADED/.test(r.stdout || '') && new RegExp(`refus\\w* to start[^\\n]*${k}`, 'i').test(r.stderr || ''),
    `status=${r.status} stdout=${(r.stdout || '').slice(-200)} stderr=${(r.stderr || '').slice(-400)}`);
}
{
  const r = importHarnessWith({});
  check('M0.env', 'harness loads when neither key is set', r.status === 0 && /HARNESS_LOADED/.test(r.stdout || ''),
    `status=${r.status} stderr=${(r.stderr || '').slice(-400)}`);
}

// The rest of this smoke runs with no key in this process either.
for (const k of ['XAI_API_KEY', 'GROK_API_KEY', 'NW_E2E_LIVE']) delete process.env[k];
let harness = null;
try { harness = await import(pathToFileURL(HARNESS).href); }
catch (e) { check('M0.load', 'harness module loads', false, String(e && e.stack || e)); }

if (harness) {
  const { MOCK_KEY, installMockAI } = harness;
  check('M0.key', 'MOCK_KEY is the literal mock-key-not-real', MOCK_KEY === 'mock-key-not-real', String(MOCK_KEY));

  // Copilot r:110 (#178 round 2 item 7): a /g stage matcher must classify the same request the same
  // way every time (RegExp.test() with /g advances lastIndex). Driven through a fake route target, no browser.
  {
    let handler = null;
    const fake = { route: async (_p, h) => { handler = h; }, unroute: async () => {} };
    const g = await installMockAI(fake, {
      fixtures: { default: { which: 'default' }, selftest: { which: 'selftest' } },
      stages: { selftest: /MOCKSTAGE:selftest/g },
    });
    const reqBody = JSON.stringify({ messages: [{ role: 'user', content: 'MOCKSTAGE:selftest' }] });
    const send = async () => {
      let out = null;
      await handler({
        request: () => ({ url: () => 'https://api.x.ai/v1/chat/completions', method: () => 'POST', postData: () => reqBody, headers: () => ({ authorization: `Bearer ${MOCK_KEY}` }) }),
        fulfill: async (r) => { out = r; }, abort: async () => {}, continue: async () => {},
      });
      try { return JSON.parse(JSON.parse(out.body).choices[0].message.content).which; } catch (_) { return null; }
    };
    const got = [await send(), await send()];
    const stagesSeen = g.requests.map((r) => r.stage);
    check('M0.stage', '/g stage matcher: the same request twice gets the selftest stage and fixture both times',
      got.join(',') === 'selftest,selftest' && stagesSeen.join(',') === 'selftest,selftest', JSON.stringify({ got, stagesSeen }));
    await g.dispose();
  }

  const FIXTURE = { items: [
    { name: 'alpha', text: 'First item. '.repeat(20) },
    { name: 'beta', text: 'Second item. '.repeat(20) },
    { name: 'gamma', text: 'Third item. '.repeat(20) },
    { name: 'delta', text: 'Fourth item. '.repeat(20) },
  ] };
  const FULL_LEN = JSON.stringify(FIXTURE).length;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const pageErrors = [];
  const ai = await installMockAI(context, {
    fixtures: { default: FIXTURE },
    stages: { selftest: /MOCKSTAGE:selftest/ },
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.goto(pathToFileURL(HTML_PATH).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof callAI === 'function', null, { timeout: 30000 });
  await ai.fillKey(page);

  const call = (timeoutSec) => page.evaluate(async (t) => {
    document.getElementById('aiCallTimeoutSec').value = String(t);
    document.getElementById('maxTokens').value = '1000';
    const t0 = Date.now();
    try {
      const res = await callAI([
        { role: 'system', content: 'MOCKSTAGE:selftest harness self-test.' },
        { role: 'user', content: 'Return JSON only: {"items":[...]}' },
      ], document.getElementById('tab1'), { operationName: 'mockSelfTest' });
      return { ok: true, ms: Date.now() - t0, res };
    } catch (e) {
      return { ok: false, ms: Date.now() - t0, err: String(e && e.message || e) };
    }
  }, timeoutSec);

  // ok
  ai.setMode('selftest', 'ok');
  let r = await call(10);
  check('M0.ok', 'ok: callAI returns the fixture (4 items)', r.ok && r.res && Array.isArray(r.res.items) && r.res.items.length === 4 && r.res.items[0].name === 'alpha', JSON.stringify(r).slice(0, 600));
  const okReq = ai.requests[ai.requests.length - 1];
  check('M0.ok', 'ok: request reached the mock at api.x.ai and was classified as selftest', okReq && /^https:\/\/api\.x\.ai\/v1\//.test(okReq.url) && okReq.stage === 'selftest' && okReq.mode === 'ok', JSON.stringify(okReq));

  // bearer
  check('M0.bearer', 'bearer seen by the mock is the mock key', ai.requests.length > 0 && ai.requests.every((q) => q.authorization === `Bearer ${MOCK_KEY}`) && ai.bearerMismatches.length === 0, JSON.stringify(ai.requests.map((q) => q.authorization)));
  await page.evaluate(() => { document.getElementById('apiKey').value = 'not-the-mock-key'; });
  r = await call(10);
  check('M0.bearer', 'any other bearer is rejected (401) and recorded as a mismatch', !r.ok && /Status: 401/.test(r.err || '') && ai.bearerMismatches.length === 1, JSON.stringify({ r, mm: ai.bearerMismatches }));
  ai.bearerMismatches.length = 0;
  await ai.fillKey(page);

  // delay below / above the page timeout
  ai.setMode('selftest', 'delay:400');
  r = await call(10);
  check('M0.delay', 'delay:400 under a 10 s timeout resolves with the fixture after >= 400 ms', r.ok && r.ms >= 380 && r.res.items.length === 4, JSON.stringify(r).slice(0, 400));
  ai.setMode('selftest', 'delay:4000');
  r = await call(1);
  check('M0.delay', 'delay:4000 over a 1 s timeout fails with the app timeout in ~1 s', !r.ok && /^Timed out after 1 s/.test(r.err || '') && r.ms < 3000, JSON.stringify(r));

  // hang
  ai.setMode('selftest', 'hang');
  r = await call(1);
  check('M0.hang', 'hang: never fulfilled; app timeout fires in ~1 s', !r.ok && /^Timed out after 1 s/.test(r.err || '') && r.ms < 3000, JSON.stringify(r));
  check('M0.hang', 'hang: harness holds the request as pending', ai.pending() >= 1, String(ai.pending()));

  // http:5xx
  for (const code of [500, 503]) {
    ai.setMode('selftest', `http:${code}`);
    r = await call(10);
    check('M0.http', `http:${code}: callAI rejects with Status: ${code}`, !r.ok && new RegExp(`Status: ${code}`).test(r.err || ''), JSON.stringify(r));
  }

  // truncated
  ai.setMode('selftest', 'truncated:120');
  r = await call(10);
  const trReq = ai.requests[ai.requests.length - 1];
  check('M0.truncated', 'truncated:120: envelope is valid, content is the fixture JSON cut at 120 chars', r.ok && r.res && r.res._jsonParseError && typeof r.res.chapter === 'string' && r.res.chapter.length === 120 && JSON.stringify(FIXTURE).startsWith(r.res.chapter), JSON.stringify(r).slice(0, 500));
  ai.setMode('selftest', 'truncated');
  r = await call(10);
  check('M0.truncated', 'truncated (default): content cut to half the fixture', r.ok && r.res && r.res._jsonParseError && r.res.chapter.length === Math.floor(FULL_LEN / 2), JSON.stringify(r).slice(0, 300));
  check('M0.truncated', 'truncated: request recorded with mode', trReq && trReq.mode === 'truncated:120', JSON.stringify(trReq));

  // partial
  ai.setMode('selftest', 'partial:2');
  r = await call(10);
  check('M0.partial', 'partial:2: valid JSON with only the first 2 of 4 items', r.ok && r.res && !r.res._jsonParseError && Array.isArray(r.res.items) && r.res.items.length === 2 && r.res.items[1].name === 'beta', JSON.stringify(r).slice(0, 400));

  // abort
  ai.setMode('selftest', 'abort');
  r = await call(10);
  check('M0.abort', 'abort: network failure surfaces as a fetch error', !r.ok && /fetch/i.test(r.err || '') && !/Timed out/.test(r.err || ''), JSON.stringify(r));

  // off-list hosts
  const before = ai.violations.length;
  const off = await page.evaluate(async () => {
    const out = {};
    for (const u of ['https://example.com/', 'https://api.x.ai.evil.example/v1/chat/completions', 'http://x.ai/']) {
      try { await fetch(u, { mode: 'no-cors' }); out[u] = 'resolved'; } catch (e) { out[u] = 'blocked'; }
    }
    return out;
  });
  check('M0.block', 'requests to off-list hosts are blocked in the page', Object.values(off).every((v) => v === 'blocked'), JSON.stringify(off));
  const newViolations = ai.violations.slice(before).map((v) => v.url);
  check('M0.block', 'each off-list request is recorded as a violation', ['example.com', 'api.x.ai.evil.example', 'x.ai'].every((h) => newViolations.some((u) => new URL(u).hostname === h)), JSON.stringify(newViolations));
  check('M0.block', 'no violation before the deliberate off-list probes', before === 0, JSON.stringify(ai.violations.slice(0, before)));

  check('M0.pageerror', 'no uncaught pageerror events', pageErrors.length === 0, pageErrors.join(' | '));

  await ai.dispose();
  await context.close();
  await browser.close();
}

const failed = checks.filter((c) => !c.ok);
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'SMOKE_NW_MOCK_AI.json'), JSON.stringify({ passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));
console.log('NW MOCK-AI HARNESS SMOKE (M0): ' + (failed.length ? 'FAIL' : 'PASS') + ' (' + (checks.length - failed.length) + '/' + checks.length + ')');
for (const c of checks) console.log((c.ok ? 'PASS' : 'FAIL') + ' [' + c.id + '] ' + c.name + (c.ok ? '' : ' :: ' + c.detail));
process.exit(failed.length ? 1 : 0);
