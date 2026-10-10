/**
 * QCAT harness (slot 8d): headless driver for NovelWriter in-app scoring.
 * Scoring logic lives only in NovelWriter.html (nwScoreChapterVsBlueprint / nwScoreBook).
 *
 *   node scripts/qcat_harness.mjs --book <export.json> [--expect <qcat_expect.json>]
 *     [--chapters 1-5] [--out <dir>] [--label <text>]
 *     [--live --regen 1,4,5 --max-tokens 250000]
 *
 * Offline by default. --live refuses unless QCAT_LIVE_ACK=1.
 * --stub-ai is for the self-test only (no provider calls).
 *
 * Exit 0 even on scorecard FAILs. Exit 2 on bad input or live-ack refusal.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { spawnSync } from 'child_process';
import { chromium } from 'playwright';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const HTML_PATH = path.resolve(process.env.NW_HTML_PATH || path.join(REPO_ROOT, 'NovelWriter', 'NovelWriter.html'));

function parseArgs(argv) {
  const a = { live: false, stubAi: false, maxTokens: 250000, chapters: null, regen: [], label: 'qcat', out: null, book: null, expect: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i];
    if (k === '--book') a.book = next();
    else if (k === '--expect') a.expect = next();
    else if (k === '--chapters') a.chapters = next();
    else if (k === '--out') a.out = next();
    else if (k === '--label') a.label = next();
    else if (k === '--live') a.live = true;
    else if (k === '--regen') a.regen = String(next() || '').split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => n > 0);
    else if (k === '--max-tokens') a.maxTokens = parseInt(next(), 10) || 250000;
    else if (k === '--stub-ai') a.stubAi = true;
    else if (k === '--help' || k === '-h') a.help = true;
  }
  return a;
}

function parseChapterRange(spec, fallback) {
  if (!spec) return fallback;
  const out = [];
  String(spec).split(',').forEach((part) => {
    const m = String(part).trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      for (let n = a; n <= b; n++) out.push(n);
    } else {
      const n = parseInt(part, 10);
      if (n > 0) out.push(n);
    }
  });
  return out;
}

function stampLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes());
}

function appSha() {
  try {
    const r = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  } catch (_) { /* ignore */ }
  return 'unknown';
}

function defaultOutRoot() {
  if (process.env.QCAT_OUT_DIR) return path.resolve(process.env.QCAT_OUT_DIR);
  return path.join(os.homedir(), 'Downloads', 'QuantumCat-Outputs', 'runs');
}

function sanitizeTitle(t) {
  return String(t || 'Untitled_Novel').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim() || 'Untitled_Novel';
}

export async function runQcatHarness(opts) {
  const logLines = [];
  const log = (s) => { const line = String(s); logLines.push(line); console.log(line); };
  if (!opts.book || !fs.existsSync(opts.book)) {
    log('error: --book is required and must exist');
    return { exitCode: 2, log: logLines };
  }
  if (opts.live && process.env.QCAT_LIVE_ACK !== '1') {
    log('error: --live refused (QCAT_LIVE_ACK is not 1)');
    return { exitCode: 2, log: logLines, refusedLive: true };
  }
  if (opts.expect) {
    if (!fs.existsSync(opts.expect)) {
      log('error: --expect file not found: ' + opts.expect);
      return { exitCode: 2, log: logLines };
    }
  }
  let bookRaw;
  try {
    bookRaw = JSON.parse(fs.readFileSync(opts.book, 'utf8'));
  } catch (e) {
    log('error: malformed book JSON: ' + String(e && e.message || e));
    return { exitCode: 2, log: logLines };
  }
  let expectRaw = null;
  if (opts.expect) {
    try {
      expectRaw = JSON.parse(fs.readFileSync(opts.expect, 'utf8'));
    } catch (e) {
      log('error: malformed expect JSON: ' + String(e && e.message || e));
      return { exitCode: 2, log: logLines };
    }
  }
  const outRoot = opts.out ? path.resolve(opts.out) : defaultOutRoot();
  const runDir = path.join(outRoot, stampLocal() + '_' + (opts.label || 'qcat'));
  fs.mkdirSync(path.join(runDir, 'chapters'), { recursive: true });
  fs.mkdirSync(path.join(runDir, 'sessions'), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  const allowNet = !!(opts.live && process.env.QCAT_LIVE_ACK === '1' && !opts.stubAi);
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (!/^https?:/i.test(url)) return route.continue();
    if (allowNet && /api\.x\.ai/i.test(url)) return route.continue();
    return route.abort('blockedbyclient');
  });
  await page.goto(pathToFileURL(HTML_PATH).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof nwScoreBook === 'function' && typeof normalizeImportedSessionData === 'function', null, { timeout: 30000 });

  if (opts.stubAi) {
    await page.evaluate(() => {
      window.callAI = async function (messages, tab, opts) {
        const op = (opts && opts.operationName) || '';
        const usage = { prompt_tokens: 40, completion_tokens: 40, total_tokens: 80 };
        if (typeof recordBookTokenUsage === 'function') {
          recordBookTokenUsage(Object.assign({ operationName: op || 'generateChapter', originTab: 'tab5', model: 'qcat-stub' }, usage));
        }
        requestLog.returnedInfo = JSON.stringify({ usage });
        if (op === 'beatCheck') {
          return { beats: [{ field: 'sceneGoal', result: 'present', evidence: 'stub' }] };
        }
        const g = window.__lastGenerateChapterGate;
        const ch = g ? g.chapter : 1;
        const part = /Part 2/.test(String(requestLog.status)) ? 2 : 1;
        const text = 'Elena Voss stood on the lunar hub gallery rail. Bastian Kane named the ice haul vector. Ozone drifted off the cable tray. Chapter ' + ch + ' part ' + part + ' stub draft. ' + ('The watch held. ').repeat(40);
        return { chapter: text };
      };
      window.scoreObligationCoverage = function () {
        return { covered: 6, total: 6, ratio: 1, words: 200, passed: true, failures: [], misses: [] };
      };
    });
  }

  const imported = await page.evaluate(({ bookRaw, expectRaw }) => {
    ['alert', 'confirm', 'prompt'].forEach((k) => { window[k] = function () { return k === 'confirm' ? true : null; }; });
    const r = normalizeImportedSessionData(bookRaw);
    novelData = r.novelData;
    requestLog = r.requestLog;
    if (document.getElementById('apiKey') && !document.getElementById('apiKey').value) document.getElementById('apiKey').value = 'qcat-harness-placeholder';
    applySessionDataToUI();
    if (expectRaw && typeof nwMergeQcatExpect === 'function') nwMergeQcatExpect(expectRaw);
    return { title: novelData.title, numChapters: novelData.numChapters, chapters: (novelData.chapters || []).map((t) => String(t || '').trim().length) };
  }, { bookRaw, expectRaw });

  const nCh = imported.numChapters || 1;
  const allWithText = [];
  for (let i = 1; i <= nCh; i++) if (imported.chapters[i - 1] > 0) allWithText.push(i);
  const wanted = parseChapterRange(opts.chapters, allWithText);

  const regenTs = Date.now();
  if (opts.live) {
    const list = (opts.regen && opts.regen.length) ? opts.regen : wanted;
    const maxTok = opts.maxTokens || 250000;
    for (let i = 0; i < list.length; i++) {
      const ch = list[i];
      const used = await page.evaluate(() => {
        try { return Number(ensureBookTokenUsage().total_tokens) || 0; } catch (e) { return 0; }
      });
      if (used >= maxTok) {
        log('Token cap reached (' + used + '/' + maxTok + '). Stopping between chapters.');
        break;
      }
      log('Chapter ' + (i + 1) + '/' + list.length + ': drafting...');
      const t0 = Date.now();
      const r = await page.evaluate(async (ch) => {
        novelData.skipAutoRevision = true;
        const skip = document.getElementById('skipAutoRevision');
        if (skip) skip.checked = true;
        const aud = document.getElementById('autoContinuityAudit');
        if (aud) aud.checked = false;
        novelData.autoContinuityAudit = false;
        let err = null;
        try {
          await generateChapter(ch, { batch: true });
        } catch (e) { err = String(e && e.message || e); }
        const text = String((novelData.chapters || [])[ch - 1] || '');
        const words = (typeof nwWordCount === 'function') ? nwWordCount(text) : text.trim().split(/\s+/).filter(Boolean).length;
        let tokens = 0;
        try { tokens = Number(ensureBookTokenUsage().total_tokens) || 0; } catch (e2) { tokens = 0; }
        return { words: words, tokens: tokens, err: err, stage: (typeof nwWorkflowStage === 'function') ? nwWorkflowStage(novelData) : '' };
      }, ch);
      if (r.err) log('Chapter ' + (i + 1) + '/' + list.length + ': error ' + r.err);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      log('Chapter ' + (i + 1) + '/' + list.length + ': done (' + r.words + ' words, ' + elapsed + ' s, ' + r.tokens + ' tokens)');
      const snap = await page.evaluate(() => {
        const { apiKey, model, maxTokens, authors, bookImprovements, chapterImprovements, ...rest } = novelData;
        return { schemaVersion: '1.0', sourceTool: 'NovelWriter', sourceVersion: (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '0.3.4'), exportedAt: new Date().toISOString(), novelData: Object.assign({}, rest, { workflowStage: (typeof nwWorkflowStage === 'function') ? nwWorkflowStage(novelData) : rest.workflowStage }) };
      });
      const regenPath = opts.book.replace(/\.json$/i, '') + '.regen_' + regenTs + '.json';
      fs.writeFileSync(regenPath, JSON.stringify(snap, null, 2));
      const sessName = sanitizeTitle(snap.novelData.title) + '_' + (snap.novelData.workflowStage || '05-drafted') + '_' + stampLocal().replace(/[-:]/g, '').replace('_', '-') + '.json';
      fs.writeFileSync(path.join(runDir, 'sessions', sessName), JSON.stringify(snap, null, 2));
    }
  }

  const scored = await page.evaluate(async (wanted) => {
    const result = await nwScoreBook({ trigger: 'harness', chapters: wanted });
    const md = nwScorecardMarkdown(result);
    const stage = nwWorkflowStage(novelData);
    const texts = {};
    (wanted || []).forEach((n) => { texts[n] = (typeof nwChapterText === 'function') ? nwChapterText(n) : String((novelData.chapters || [])[n - 1] || ''); });
    const { apiKey, model, maxTokens, authors, bookImprovements, chapterImprovements, ...rest } = novelData;
    const session = { schemaVersion: '1.0', sourceTool: 'NovelWriter', sourceVersion: (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '0.3.4'), exportedAt: new Date().toISOString(), novelData: Object.assign({}, rest, { workflowStage: stage }) };
    return { result: result, md: md, stage: stage, texts: texts, session: session, cards: JSON.parse(JSON.stringify(novelData.chapterScorecards || [])) };
  }, wanted);

  const sha = appSha();
  const scoreJson = {
    book: scored.result.book,
    chapters: scored.result.chapters,
    expectFile: opts.expect || null,
    scorerVersion: '8d.1',
    appSha: sha
  };
  fs.writeFileSync(path.join(runDir, 'scorecard.json'), JSON.stringify(scoreJson, null, 2));
  fs.writeFileSync(path.join(runDir, 'scorecard.md'), scored.md + '\n');
  Object.keys(scored.texts || {}).forEach((k) => {
    const n = String(k).padStart(2, '0');
    fs.writeFileSync(path.join(runDir, 'chapters', 'ch' + n + '.txt'), scored.texts[k] || '');
  });
  const bookTxt = (wanted || []).map((n) => 'Chapter ' + n + '\n\n' + (scored.texts[n] || '')).join('\n\n---\n\n');
  fs.writeFileSync(path.join(runDir, 'book_' + (scored.stage || 'scored') + '.txt'), bookTxt);
  if (!opts.live) {
    const sessName = sanitizeTitle(scored.session.novelData.title) + '_' + (scored.stage || '06-scored') + '_' + stampLocal().replace(/[-:]/g, '').replace('_', '-') + '.json';
    fs.writeFileSync(path.join(runDir, 'sessions', sessName), JSON.stringify(scored.session, null, 2));
  }
  fs.writeFileSync(path.join(runDir, 'run.log'), logLines.join('\n') + '\n');
  await browser.close();
  return { exitCode: 0, runDir: runDir, scoreJson: scoreJson, md: scored.md, cards: scored.cards, log: logLines, stage: scored.stage };
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.book) {
    console.log('Usage: node scripts/qcat_harness.mjs --book <export.json> [--expect <qcat_expect.json>] [--chapters 1-5] [--out <dir>] [--label <text>] [--live --regen 1,4,5 --max-tokens 250000]');
    process.exit(args.book ? 0 : 2);
  }
  const r = await runQcatHarness(args);
  process.exit(r.exitCode);
}
