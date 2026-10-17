/**
 * M-STAB WP0: shared mock-AI harness for offline NovelWriter smokes (Engineering design M0, §4.1).
 *
 *   import { MOCK_KEY, installMockAI } from './_nw_mock_ai.mjs';
 *   const ai = await installMockAI(context, { fixtures: { default: {...}, authors: {...} }, stages: { authors: /Fetch Authors/ } });
 *   const page = await context.newPage(); await page.goto(...); await ai.fillKey(page);
 *   ai.setMode('authors', 'delay:5000');   // or ai.next('http:503') for the next request only
 *   ...; ai.assertClean(); await ai.dispose();
 *
 * Fail-closed rules:
 *   1. Refuses to start (throws at import) when XAI_API_KEY or GROK_API_KEY is set in the environment.
 *   2. Installs a deny-all route: https://api.x.ai/** is answered by the mock; file:/data:/blob: and
 *      localhost pass through; every other host is aborted and recorded in `violations` (the two
 *      web-font hosts in BLOCKED_ASSET_HOSTS are aborted too, but logged in `blockedAssets`).
 *   3. Every mocked request must carry `Authorization: Bearer mock-key-not-real`; any other bearer gets a
 *      401 and is recorded in `bearerMismatches`.
 *
 * Modes (per stage key, matched against the raw request body; unmatched requests use `default`):
 *   ok               200 with the stage fixture
 *   delay:<ms>       wait, then ok (use with a short #aiCallTimeoutSec to exercise the app timeout)
 *   hang             never answered until dispose()
 *   http:<code>      that status with an error body (4xx/5xx)
 *   truncated[:<n>]  valid envelope, content = fixture JSON cut at n chars (default half)
 *   partial[:<n>]    valid JSON, first array in the fixture cut to n items (default half, min 1)
 *   abort            network failure (route.abort('failed'))
 */

export const MOCK_KEY = 'mock-key-not-real';
export const MOCK_HOST = 'api.x.ai';
export const LIVE_KEY_VARS = ['XAI_API_KEY', 'GROK_API_KEY'];

export function assertNoLiveKeys(env = process.env) {
  for (const k of LIVE_KEY_VARS) {
    if (env[k] !== undefined && env[k] !== '') {
      throw new Error(`nw-mock-ai: refusing to start: ${k} is set. The mock harness never runs with a live key; unset ${k} and rerun.`);
    }
  }
}
assertNoLiveKeys();

const PASS_THROUGH_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
// Static web-font hosts NovelWriter.html links in <head>. Still aborted (no network), but logged in
// `blockedAssets` instead of `violations` so page chrome doesn't fail every smoke. Never add an AI host here.
export const BLOCKED_ASSET_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
};

export function parseMode(mode) {
  const m = String(mode || '').trim();
  let x;
  if (m === 'ok' || m === 'hang' || m === 'abort') return { kind: m };
  if ((x = /^delay:(\d+)$/.exec(m))) return { kind: 'delay', ms: Number(x[1]) };
  if ((x = /^http:([45]\d\d)$/.exec(m))) return { kind: 'http', status: Number(x[1]) };
  if ((x = /^truncated(?::(\d+))?$/.exec(m))) return { kind: 'truncated', n: x[1] == null ? null : Number(x[1]) };
  if ((x = /^partial(?::(\d+))?$/.exec(m))) return { kind: 'partial', n: x[1] == null ? null : Number(x[1]) };
  throw new Error(`nw-mock-ai: unknown mode "${m}"`);
}

function partialOf(fixture, n) {
  const copy = JSON.parse(JSON.stringify(fixture));
  const cut = (arr) => arr.slice(0, n == null ? Math.max(1, Math.floor(arr.length / 2)) : n);
  if (Array.isArray(copy)) return cut(copy);
  if (copy && typeof copy === 'object') {
    for (const k of Object.keys(copy)) {
      if (Array.isArray(copy[k])) { copy[k] = cut(copy[k]); return copy; }
    }
  }
  throw new Error('nw-mock-ai: partial mode needs a fixture with an array');
}

function envelope(url, content) {
  const usage = { prompt_tokens: 60, completion_tokens: 40, total_tokens: 100 };
  if (/\/v1\/responses\b/.test(url)) {
    return {
      id: 'mock-response', object: 'response', model: 'mock',
      output_text: content,
      output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: content }] }],
      usage: { input_tokens: usage.prompt_tokens, output_tokens: usage.completion_tokens, total_tokens: usage.total_tokens },
    };
  }
  return {
    id: 'mock-chat', object: 'chat.completion', model: 'mock',
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }],
    usage,
  };
}

export async function installMockAI(target, opts = {}) {
  if (!target || typeof target.route !== 'function') throw new Error('nw-mock-ai: installMockAI needs a Playwright BrowserContext or Page');
  const fixtures = opts.fixtures || {};
  const stages = opts.stages || {};
  const modes = { default: 'ok' };
  for (const [k, v] of Object.entries(opts.modes || {})) { parseMode(v); modes[k] = v; }
  const queue = [];
  const requests = [];
  const violations = [];
  const blockedAssets = [];
  const bearerMismatches = [];
  const errors = [];
  let pendingCount = 0;
  let releaseAll;
  const disposed = new Promise((r) => { releaseAll = r; });
  let isDisposed = false;

  const classify = typeof opts.classify === 'function' ? opts.classify : (bodyText) => {
    for (const [key, test] of Object.entries(stages)) {
      if (typeof test === 'function' ? test(bodyText) : test.test(bodyText)) return key;
    }
    return 'default';
  };
  const fixtureFor = (stage, body) => {
    let fx = Object.prototype.hasOwnProperty.call(fixtures, stage) ? fixtures[stage] : fixtures.default;
    if (typeof fx === 'function') fx = fx(body, stage);
    return fx === undefined ? { ok: true } : fx;
  };
  const sleep = (ms) => new Promise((r) => { const t = setTimeout(r, ms); disposed.then(() => { clearTimeout(t); r(); }); });
  const safe = async (fn) => { try { await fn(); } catch (_) { /* page closed or request already aborted by the app */ } };
  const json = (status, obj) => ({ status, headers: { 'content-type': 'application/json', ...CORS }, body: JSON.stringify(obj) });

  async function handle(route) {
    const req = route.request();
    const url = req.url();
    if (!/^https?:/i.test(url)) return safe(() => route.continue());
    const host = new URL(url).hostname;
    if (host !== MOCK_HOST) {
      if (PASS_THROUGH_HOSTS.has(host) && opts.allowLocalhost !== false) return safe(() => route.continue());
      (BLOCKED_ASSET_HOSTS.has(host) ? blockedAssets : violations).push({ url, method: req.method() });
      return safe(() => route.abort('blockedbyclient'));
    }
    if (req.method() === 'OPTIONS') return safe(() => route.fulfill({ status: 204, headers: CORS, body: '' }));

    const bodyText = req.postData() || '';
    let body = null;
    try { body = JSON.parse(bodyText); } catch (_) { /* non-JSON body is recorded as null */ }
    const authorization = req.headers()['authorization'] || '';
    const stage = classify(bodyText, body);
    const mode = queue.length ? queue.shift() : (modes[stage] || modes.default);
    const record = { url, method: req.method(), stage, mode, authorization, body, at: Date.now() };
    requests.push(record);

    if (authorization !== `Bearer ${MOCK_KEY}`) {
      bearerMismatches.push({ url, stage, authorization: authorization ? authorization.slice(0, 12) + '…' : '' });
      return safe(() => route.fulfill(json(401, { error: { message: 'nw-mock-ai: bearer is not the mock key' } })));
    }

    let m;
    try { m = parseMode(mode); } catch (e) { errors.push(e.message); return safe(() => route.fulfill(json(500, { error: { message: e.message } }))); }
    const fx = fixtureFor(stage, body);
    const full = typeof fx === 'string' ? fx : JSON.stringify(fx);

    switch (m.kind) {
      case 'ok':
        return safe(() => route.fulfill(json(200, envelope(url, full))));
      case 'delay':
        await sleep(m.ms);
        if (isDisposed) return safe(() => route.abort('failed'));
        return safe(() => route.fulfill(json(200, envelope(url, full))));
      case 'hang':
        pendingCount++;
        await disposed;
        pendingCount--;
        return safe(() => route.abort('failed'));
      case 'http':
        return safe(() => route.fulfill(json(m.status, { error: { message: `nw-mock-ai http:${m.status}` } })));
      case 'truncated': {
        const n = m.n == null ? Math.floor(full.length / 2) : m.n;
        record.truncatedTo = n;
        return safe(() => route.fulfill(json(200, envelope(url, full.slice(0, n)))));
      }
      case 'partial': {
        let content;
        try { content = JSON.stringify(partialOf(typeof fx === 'string' ? JSON.parse(fx) : fx, m.n)); }
        catch (e) { errors.push(e.message); return safe(() => route.fulfill(json(500, { error: { message: e.message } }))); }
        return safe(() => route.fulfill(json(200, envelope(url, content))));
      }
      case 'abort':
        return safe(() => route.abort('failed'));
      default:
        return safe(() => route.abort('failed'));
    }
  }

  await target.route('**/*', handle);

  return {
    MOCK_KEY,
    requests,
    violations,
    blockedAssets,
    bearerMismatches,
    errors,
    setMode(stage, mode) { parseMode(mode); modes[stage] = mode; },
    setDefault(mode) { parseMode(mode); modes.default = mode; },
    next(mode) { parseMode(mode); queue.push(mode); },
    pending() { return pendingCount; },
    async fillKey(page) {
      await page.evaluate((k) => {
        const el = document.getElementById('apiKey');
        if (!el) throw new Error('nw-mock-ai: #apiKey not found');
        el.value = k;
      }, MOCK_KEY);
    },
    problems() {
      const p = [];
      if (violations.length) p.push(`${violations.length} off-list request(s): ${violations.map((v) => v.url).join(', ')}`);
      if (bearerMismatches.length) p.push(`${bearerMismatches.length} request(s) without the mock bearer`);
      if (errors.length) p.push(`harness errors: ${errors.join('; ')}`);
      return p;
    },
    assertClean() {
      const p = this.problems();
      if (p.length) throw new Error('nw-mock-ai: ' + p.join(' | '));
    },
    async dispose() {
      isDisposed = true;
      releaseAll();
      try { await target.unroute('**/*', handle); } catch (_) { /* context already closed */ }
    },
  };
}
