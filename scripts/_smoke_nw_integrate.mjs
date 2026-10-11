/**
 * Offline smoke for NW_SLOT_6B_INTEGRATE_SPEC Part 1 (Tab 8 Integrate): I1-I6.
 * No network, no API key: every http(s) request is aborted; window.callAI is replaced by a stub.
 * Nothing here needs XAI_API_KEY. Fixture-first: this file is expected to FAIL on unmodified main.
 *
 * Fixture: 3 chapters with prose, labelled outlines ("Outline: ...\n\nArc: ..."), and two
 * "To Incorporate" improvements whose breakdowns touch ch1 and ch2 (chapters + chapterOutlines)
 * plus novelOutlines. Stub callAI returns "REVISED chN" for ch1 and rejects for ch2 (callback never
 * fired). Assertions each run after a following collectData().
 *
 *   I1  novelData.chapters[0] === "REVISED ch1" and #chapterGenContent1.value matches
 *   I2  chapterOutlines[0] and chapterArcs[0] keep original text; outline carries [Integration Notes]
 *   I3  ch2 reject: function returns within a hard timeout, loading indicator hidden, ch2 text unchanged
 *   I4  only items whose chapters all succeeded flip to Incorporated; the ch2 item stays To Incorporate
 *   I5  ch3 (no breakdown) untouched byte-for-byte; novelOutline gets one [Integration Notes] block
 *   I6  batch lock: nwBatchIsLocked() true -> Integrate returns false and changes nothing
 *   I7  callAI {chapter, _jsonParseError} (or no usable prose) is a FAILED revision: chapters[] unchanged,
 *       counted in "M failed", item stays To Incorporate
 *
 * Mutations (TEMP copy, flags flipped false; each must turn a core assertion red):
 *   M1  wrong prose target (write to #chapterContent{n}) -> I1 red
 *   M2  missing reject path -> I3 red
 *   M3  status flip-all -> I4 red
 *   M4  ignore _jsonParseError and write chapter field -> I7 red
 *
 * I3 uses an in-page hard timeout (I3_TIMEOUT_MS) plus a Node-side backup so a hang is FAIL, not a
 * stuck process. The ch2 stub rejects without invoking the callback, which hangs the main-branch
 * Promise that only has a resolve path.
 *
 * Usage: node scripts/_smoke_nw_integrate.mjs
 * Env:   NW_HTML_PATH (default this checkout's NovelWriter/NovelWriter.html), NW_OUT_DIR (default out/nw-smoke)
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

/** In-page race around integrateBreakdownSuggestions. Hang on main is FAIL, not a stuck process. */
const I3_TIMEOUT_MS = 8000;
/** Node/Playwright backup if the page itself never answers. */
const I3_NODE_TIMEOUT_MS = 20000;

for (const k of ['XAI_API_KEY', 'GROK_API_KEY', 'NW_E2E_LIVE']) delete process.env[k];

const checks = [];
const check = (id, name, ok, detail) => checks.push({ id, name, ok: !!ok, detail: ok ? '' : String(detail == null ? '' : detail).slice(0, 1200) });
const clone = (o) => JSON.parse(JSON.stringify(o));

const CH1 = 'Chapter 1 original prose. Mira counted the relay clicks under failing lights on the wet dock.';
const CH2 = 'Chapter 2 original prose. The dock clock disagreed with the log after the first choice.';
const CH3 = 'Chapter 3 original prose. Ozone drifted off the cable tray and Mira did not look back.';
const OUT1 = 'Mira must commit an observation before the telemetry window closes and the dock clock is trusted.';
const ARC1 = 'Mira shifts from guarded procedure toward open doubt, paying a visible personal cost.';
const OUT2 = 'The log and the dock clock still disagree; Mira has to choose which record to defend.';
const ARC2 = 'Mira pays for the first choice: the crew now treats her doubt as a defect in the procedure.';
const OUT3 = 'A delayed consequence of the dock-clock choice lands and narrows the next options.';
const ARC3 = 'Mira stops looking back at the tray and commits to the observation she named aloud.';
const NOVEL_OUTLINE = 'A three-chapter dock-clock story about Mira, telemetry, and a delayed consequence.';
const NOTE1 = 'Note: Mira must hear the clock mismatch before she commits.';
const NOTE2 = 'Note: keep the clock/log disagreement unresolved in chapter 2.';
const NOVEL_NOTE_1 = 'Clock mismatch is a through-line from chapter 1.';
const NOVEL_NOTE_2 = 'The disagreement remains unresolved through chapter 2.';

const FIX = {
  title: 'Dock Clock',
  genre: 'scifi',
  numChapters: 3,
  chapterLength: 2000,
  storyArc: 'Mira vs the dock clock',
  generalPlot: 'A telemetry window and a disagreeing log.',
  setting: 'Wet dock, failing lights, cable tray.',
  novelOutline: NOVEL_OUTLINE,
  plotOutline: 'Three chapters; clock mismatch; delayed cost.',
  storyArcOutline: 'Doubt becomes a visible cost.',
  chapterOutlines: [OUT1, OUT2, OUT3],
  chapterArcs: [ARC1, ARC2, ARC3],
  chapters: [CH1, CH2, CH3],
  chapterImprovements: ['', '', ''],
  characters: [{ name: 'Mira', role: 'lead', backstory: 'Dock tech.', arc: 'Guarded to committed.' }],
  subplots: ['The dock clock vs the relay log.'],
  bookImprovementsWithStatus: [
    {
      text: 'Tighten Mira dock-clock beat in chapter 1.',
      status: 'To Incorporate',
      breakdown: {
        chapters: { 'Chapter 1': 'Revise ch1 so Mira names the clock mismatch aloud.' },
        chapterOutlines: { 'Chapter 1': NOTE1 },
        novelOutlines: NOVEL_NOTE_1
      }
    },
    {
      text: 'Carry the dock-clock disagreement into chapter 2.',
      status: 'To Incorporate',
      breakdown: {
        chapters: { 'Chapter 2': 'Revise ch2 so the log and clock still disagree after the first choice.' },
        chapterOutlines: { 'Chapter 2': NOTE2 },
        novelOutlines: NOVEL_NOTE_2
      }
    }
  ]
};

const browser = await chromium.launch({ headless: true });
const pageErrors = [];
const networkSeen = [];

function hardTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(label + ': hard-timeout after ' + ms + ' ms')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

async function installHarness(page) {
  await page.evaluate(() => {
    const h = window.__h = { calls: [], rejected: [], dialogs: [], toasts: [] };
    const toastEl = document.getElementById('nwToast');
    if (toastEl) new MutationObserver(() => { if (toastEl.textContent) h.toasts.push(toastEl.textContent); }).observe(toastEl, { childList: true, characterData: true, subtree: true });
    ['alert', 'confirm', 'prompt'].forEach((k) => {
      window[k] = function (m) { h.dialogs.push(k + ': ' + String(m).slice(0, 200)); return k === 'confirm' ? true : (k === 'prompt' ? null : undefined); };
    });
    // Callback-style stub matching integrateBreakdownSuggestions(callAI(messages, tab, cb, opts)).
    // ch1: invoke callback with "REVISED ch1". ch2: reject WITHOUT calling the callback (hangs main).
    window.callAI = function (messages, tabElement, callbackOrOptions, options) {
      const isCallback = typeof callbackOrOptions === 'function';
      const callback = isCallback ? callbackOrOptions : null;
      const opts = isCallback ? (options || {}) : (callbackOrOptions || {});
      const op = String(opts.operationName || '');
      const m = /Integrate Ch\.(\d+)/.exec(op);
      const ch = m ? Number(m[1]) : 0;
      h.calls.push({ operationName: op, ch: ch });
      if (ch === 2) {
        h.rejected.push(ch);
        return Promise.reject(new Error('smoke: provider reject ch2'));
      }
      const text = 'REVISED ch' + (ch || 'N');
      if (typeof callback === 'function') callback(text);
      return Promise.resolve(text);
    };
    h.labelled = function (outline, arc) {
      return 'Outline:\n' + outline + '\n\nArc:\n' + arc;
    };
    h.load = async function (nd) {
      Object.keys(nd).forEach((k) => { novelData[k] = JSON.parse(JSON.stringify(nd[k])); });
      novelData.apiKey = '';
      novelData.tokenUsage = null;
      if (typeof ensureBookTokenUsage === 'function') ensureBookTokenUsage();
      delete novelData.batchRun;
      const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      setVal('numChapters', String(nd.numChapters));
      setVal('chapterLength', String(nd.chapterLength || 2000));
      setVal('title', nd.title || '');
      setVal('genre', nd.genre || '');
      setVal('storyArc', nd.storyArc || '');
      setVal('generalPlot', nd.generalPlot || '');
      setVal('setting', nd.setting || '');
      setVal('novelOutline', nd.novelOutline || '');
      setVal('plotOutline', nd.plotOutline || '');
      setVal('storyArcOutline', nd.storyArcOutline || '');
      setVal('apiKey', '');
      setVal('maxTokens', '1000');
      if (typeof updateChapterSubpages === 'function') await updateChapterSubpages();
      for (let n = 1; n <= nd.numChapters; n++) {
        const labelled = h.labelled(nd.chapterOutlines[n - 1], nd.chapterArcs[n - 1]);
        const content = document.getElementById('chapterContent' + n);
        if (content) content.value = labelled;
        const gen = document.getElementById('chapterGenContent' + n);
        if (gen) gen.value = nd.chapters[n - 1];
        const edit = document.getElementById('chapterEditContent' + n);
        if (edit) edit.value = nd.chapters[n - 1];
      }
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    };
    h.snap = function () {
      const el = (id) => document.getElementById(id);
      const loading = document.querySelector('#tab8 .loading-indicator');
      return {
        chapters: (novelData.chapters || []).slice(),
        chapterOutlines: (novelData.chapterOutlines || []).slice(),
        chapterArcs: (novelData.chapterArcs || []).slice(),
        novelOutline: String(novelData.novelOutline || ''),
        statuses: (novelData.bookImprovementsWithStatus || []).map((it) => it && it.status),
        genDom: [1, 2, 3].map((n) => (el('chapterGenContent' + n) || {}).value || ''),
        editDom: [1, 2, 3].map((n) => (el('chapterEditContent' + n) || {}).value || ''),
        contentDom: [1, 2, 3].map((n) => (el('chapterContent' + n) || {}).value || ''),
        novelOutlineDom: (el('novelOutline') || {}).value || '',
        loadingDisplay: loading ? String(loading.style.display || '') : '',
        calls: h.calls.slice(),
        rejected: h.rejected.slice(),
        dialogs: h.dialogs.slice(),
        toasts: h.toasts.slice()
      };
    };
  });
}

async function openPage(htmlPath) {
  const page = await browser.newPage();
  page.setDefaultTimeout(I3_NODE_TIMEOUT_MS);
  page.on('pageerror', (e) => {
    const m = String(e && e.message || e);
    if (/smoke: provider reject ch2/.test(m)) return;
    pageErrors.push(m);
  });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (!/^https?:/i.test(url)) return route.continue();
    networkSeen.push(url);
    return route.abort('blockedbyclient');
  });
  await page.goto(pathToFileURL(htmlPath || HTML_PATH).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof integrateBreakdownSuggestions === 'function' && typeof collectData === 'function' && typeof nwBatchIsLocked === 'function', null, { timeout: 30000 });
  await installHarness(page);
  return page;
}

const HTML = fs.readFileSync(HTML_PATH, 'utf8');
const FLAGS = {
  prose: 'var NW_6B_WRITE_PROSE_TO_GEN = true;',
  reject: 'var NW_6B_CALLAI_REJECT_PATH = true;',
  status: 'var NW_6B_STATUS_PER_ITEM = true;',
  parseFail: 'var NW_6B_PARSE_FAIL_AS_FAILURE = true;'
};
const PARSE_GARBAGE = '{broken-json-not-prose chapter ';
function mutateCopy(flagFrom) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-6b-'));
  const copy = path.join(dir, 'NovelWriter.html');
  if (HTML.indexOf(flagFrom) < 0) return { ok: false, copy: null, dir, detail: 'flag not found: ' + flagFrom };
  fs.writeFileSync(copy, HTML.replace(flagFrom, flagFrom.replace('true', 'false')));
  return { ok: true, copy, dir };
}

async function runI1I5(htmlPath) {
  const page = await openPage(htmlPath);
  let r;
  try {
    r = await hardTimeout(page.evaluate(async ({ fix, timeoutMs }) => {
      const h = window.__h;
      await h.load(fix);
      const t0 = Date.now();
      let timedOut = false;
      let returned;
      let threw = null;
      const work = Promise.resolve().then(() => integrateBreakdownSuggestions())
        .then((v) => { returned = v; return v; })
        .catch((e) => { threw = String(e && e.message || e); });
      const raced = await Promise.race([
        work.then(() => 'settled'),
        new Promise((res) => setTimeout(() => res('timeout'), timeoutMs))
      ]);
      if (raced === 'timeout') timedOut = true;
      const ms = Date.now() - t0;
      if (typeof collectData === 'function') collectData();
      const after = h.snap();
      return { after, timedOut, returned, threw, ms, settled: raced === 'settled' };
    }, { fix: clone(FIX), timeoutMs: I3_TIMEOUT_MS }), I3_NODE_TIMEOUT_MS, 'I3');
  } catch (e) {
    r = { hardTimeout: true, error: String(e && e.message || e), timedOut: true, settled: false, returned: undefined, threw: null, ms: I3_NODE_TIMEOUT_MS, after: null };
  }
  const after = r.after || { chapters: [], chapterOutlines: [], chapterArcs: [], novelOutline: '', statuses: [], genDom: ['', '', ''], loadingDisplay: 'unknown' };
  const out0 = String(after.chapterOutlines[0] || '');
  const arc0 = String(after.chapterArcs[0] || '');
  const loadingHidden = after.loadingDisplay === 'none' || after.loadingDisplay === '';
  const ch2Unchanged = after.chapters[1] === CH2 && after.genDom[1] === CH2;
  const notesCount = (String(after.novelOutline).match(/\[Integration Notes\]/g) || []).length;
  const novelNotesOk = after.novelOutline.indexOf(NOVEL_OUTLINE) >= 0 && notesCount === 1 && after.novelOutline.indexOf(NOVEL_NOTE_1) >= 0;
  const verdict = {
    I1: after.chapters[0] === 'REVISED ch1' && after.genDom[0] === 'REVISED ch1',
    I2: out0.indexOf(OUT1) >= 0 && arc0 === ARC1 && out0.indexOf('[Integration Notes]') >= 0 && out0.indexOf(NOTE1) >= 0,
    I3: r.settled === true && r.timedOut === false && !r.hardTimeout && loadingHidden && ch2Unchanged && r.ms <= I3_TIMEOUT_MS,
    I4: after.statuses[0] === 'Incorporated' && after.statuses[1] === 'To Incorporate',
    I5: after.chapters[2] === CH3 && after.genDom[2] === CH3 && novelNotesOk
  };
  await page.close();
  return { verdict, after, r };
}

// ---------------- I1-I5: one integrate with ch1 stub success, ch2 reject ----------------
{
  const page = await openPage();
  let r;
  try {
    r = await hardTimeout(page.evaluate(async ({ fix, timeoutMs }) => {
      const h = window.__h;
      await h.load(fix);
      const before = h.snap();
      const t0 = Date.now();
      let timedOut = false;
      let returned;
      let threw = null;
      const work = Promise.resolve().then(() => integrateBreakdownSuggestions())
        .then((v) => { returned = v; return v; })
        .catch((e) => { threw = String(e && e.message || e); });
      const raced = await Promise.race([
        work.then(() => 'settled'),
        new Promise((res) => setTimeout(() => res('timeout'), timeoutMs))
      ]);
      if (raced === 'timeout') timedOut = true;
      const ms = Date.now() - t0;
      if (typeof collectData === 'function') collectData();
      const after = h.snap();
      return { before, after, timedOut, returned, threw, ms, settled: raced === 'settled' };
    }, { fix: clone(FIX), timeoutMs: I3_TIMEOUT_MS }), I3_NODE_TIMEOUT_MS, 'I3');
  } catch (e) {
    r = { hardTimeout: true, error: String(e && e.message || e), timedOut: true, settled: false, returned: undefined, threw: null, ms: I3_NODE_TIMEOUT_MS, after: null, before: null };
  }

  const after = r.after || {
    chapters: [], chapterOutlines: [], chapterArcs: [], novelOutline: '', statuses: [],
    genDom: ['', '', ''], loadingDisplay: 'unknown'
  };

  check('I1', 'novelData.chapters[0] === "REVISED ch1" and #chapterGenContent1.value matches',
    after.chapters[0] === 'REVISED ch1' && after.genDom[0] === 'REVISED ch1',
    JSON.stringify({ chapter0: after.chapters[0], gen1: after.genDom[0], content1: after.contentDom && after.contentDom[0], timedOut: r.timedOut, hardTimeout: r.hardTimeout || false, error: r.error || '' }));

  const out0 = String(after.chapterOutlines[0] || '');
  const arc0 = String(after.chapterArcs[0] || '');
  check('I2', 'chapterOutlines[0] and chapterArcs[0] keep original text; outline carries [Integration Notes]',
    out0.indexOf(OUT1) >= 0 && arc0 === ARC1 && out0.indexOf('[Integration Notes]') >= 0 && out0.indexOf(NOTE1) >= 0,
    JSON.stringify({ outline0: out0, arc0: arc0, timedOut: r.timedOut }));

  const loadingHidden = after.loadingDisplay === 'none' || after.loadingDisplay === '';
  const ch2Unchanged = after.chapters[1] === CH2 && after.genDom[1] === CH2;
  check('I3', 'ch2 reject: function returns within hard timeout, loading indicator hidden, ch2 text unchanged',
    r.settled === true && r.timedOut === false && !r.hardTimeout && loadingHidden && ch2Unchanged && r.ms <= I3_TIMEOUT_MS,
    JSON.stringify({ settled: r.settled, timedOut: r.timedOut, hardTimeout: r.hardTimeout || false, ms: r.ms, loadingDisplay: after.loadingDisplay, ch2: after.chapters[1], gen2: after.genDom[1], returned: r.returned, threw: r.threw, error: r.error || '' }));

  check('I4', 'only items whose chapters all succeeded flip to Incorporated; the ch2 item stays To Incorporate',
    after.statuses[0] === 'Incorporated' && after.statuses[1] === 'To Incorporate',
    JSON.stringify({ statuses: after.statuses, timedOut: r.timedOut }));

  const notesCount = (String(after.novelOutline).match(/\[Integration Notes\]/g) || []).length;
  const novelNotesOk = after.novelOutline.indexOf(NOVEL_OUTLINE) >= 0 && notesCount === 1
    && after.novelOutline.indexOf(NOVEL_NOTE_1) >= 0;
  check('I5', 'ch3 (no breakdown) untouched byte-for-byte; novelOutline gets one [Integration Notes] block',
    after.chapters[2] === CH3 && after.genDom[2] === CH3 && novelNotesOk,
    JSON.stringify({ ch3: after.chapters[2], gen3: after.genDom[2], novelOutline: after.novelOutline, notesCount: notesCount, timedOut: r.timedOut }));

  await page.close();
}

// ---------------- I6: batch lock ----------------
{
  const page = await openPage();
  let r;
  try {
    r = await hardTimeout(page.evaluate(async (fix) => {
      const h = window.__h;
      await h.load(fix);
      nwBatchState.running = true;
      const before = h.snap();
      const locked = nwBatchIsLocked();
      const t0 = Date.now();
      let returned;
      let threw = null;
      let timedOut = false;
      const work = Promise.resolve().then(() => integrateBreakdownSuggestions())
        .then((v) => { returned = v; return v; })
        .catch((e) => { threw = String(e && e.message || e); });
      const raced = await Promise.race([
        work.then(() => 'settled'),
        new Promise((res) => setTimeout(() => res('timeout'), 8000))
      ]);
      if (raced === 'timeout') timedOut = true;
      const after = h.snap();
      return {
        locked, returned, threw, timedOut, ms: Date.now() - t0,
        beforeChapters: before.chapters, afterChapters: after.chapters,
        beforeOutlines: before.chapterOutlines, afterOutlines: after.chapterOutlines,
        beforeArcs: before.chapterArcs, afterArcs: after.chapterArcs,
        beforeNovel: before.novelOutline, afterNovel: after.novelOutline,
        beforeStatuses: before.statuses, afterStatuses: after.statuses,
        beforeGen: before.genDom, afterGen: after.genDom,
        beforeContent: before.contentDom, afterContent: after.contentDom,
        calls: after.calls
      };
    }, clone(FIX)), I3_NODE_TIMEOUT_MS, 'I6');
  } catch (e) {
    r = { hardTimeout: true, error: String(e && e.message || e), returned: undefined, locked: false, timedOut: true, calls: [] };
  }

  const unchanged = r && !r.hardTimeout
    && JSON.stringify(r.beforeChapters) === JSON.stringify(r.afterChapters)
    && JSON.stringify(r.beforeOutlines) === JSON.stringify(r.afterOutlines)
    && JSON.stringify(r.beforeArcs) === JSON.stringify(r.afterArcs)
    && r.beforeNovel === r.afterNovel
    && JSON.stringify(r.beforeStatuses) === JSON.stringify(r.afterStatuses)
    && JSON.stringify(r.beforeGen) === JSON.stringify(r.afterGen)
    && JSON.stringify(r.beforeContent) === JSON.stringify(r.afterContent);
  check('I6', 'with nwBatchIsLocked() true, Integrate returns false and changes nothing',
    r.locked === true && r.returned === false && r.timedOut === false && !r.hardTimeout && unchanged && (r.calls || []).length === 0,
    JSON.stringify({ locked: r.locked, returned: r.returned, timedOut: r.timedOut, hardTimeout: r.hardTimeout || false, calls: r.calls, statuses: r.afterStatuses, error: r.error || '', threw: r.threw }));

  await page.close();
}

async function runParseFail(htmlPath) {
  const page = await openPage(htmlPath);
  const r = await page.evaluate(async (fix) => {
    const h = window.__h;
    await h.load(fix);
    window.callAI = function (messages, tabElement, callbackOrOptions, options) {
      const isCallback = typeof callbackOrOptions === 'function';
      const callback = isCallback ? callbackOrOptions : null;
      const opts = isCallback ? (options || {}) : (callbackOrOptions || {});
      const op = String(opts.operationName || '');
      const m = /Integrate Ch\.(\d+)/.exec(op);
      const ch = m ? Number(m[1]) : 0;
      h.calls.push({ operationName: op, ch: ch, parse: true });
      const resp = {
        chapter: '{broken-json-not-prose chapter ' + ch,
        _jsonParseError: 'SyntaxError: Unexpected end of JSON input'
      };
      if (typeof callback === 'function') callback(resp);
      return Promise.resolve(resp);
    };
    h.toasts.length = 0;
    await integrateBreakdownSuggestions();
    if (typeof collectData === 'function') collectData();
    const parseAfter = h.snap();
    const parseToasts = h.toasts.slice();
    const fix2 = JSON.parse(JSON.stringify(fix));
    fix2.bookImprovementsWithStatus = [fix.bookImprovementsWithStatus[0]];
    await h.load(fix2);
    window.callAI = function (messages, tabElement, callbackOrOptions, options) {
      const isCallback = typeof callbackOrOptions === 'function';
      const callback = isCallback ? callbackOrOptions : null;
      const opts = isCallback ? (options || {}) : (callbackOrOptions || {});
      const op = String(opts.operationName || '');
      const m = /Integrate Ch\.(\d+)/.exec(op);
      const ch = m ? Number(m[1]) : 0;
      h.calls.push({ operationName: op, ch: ch, empty: true });
      const resp = {};
      if (typeof callback === 'function') callback(resp);
      return Promise.resolve(resp);
    };
    h.toasts.length = 0;
    await integrateBreakdownSuggestions();
    if (typeof collectData === 'function') collectData();
    return { after: parseAfter, toasts: parseToasts, empty: { after: h.snap(), toasts: h.toasts.slice() } };
  }, clone(FIX));
  await page.close();
  return r;
}

// ---------------- I7: _jsonParseError / no usable prose is a FAILED revision ----------------
{
  const r = await runParseFail();
  const after = (r && r.after) || { chapters: [], genDom: ['', '', ''], statuses: [], toasts: [] };
  const toast = (after.toasts || r.toasts || []).join(' ');
  const ch1Unchanged = after.chapters[0] === CH1 && after.genDom[0] === CH1;
  const ch2Unchanged = after.chapters[1] === CH2 && after.genDom[1] === CH2;
  const notIncorporated = after.statuses[0] === 'To Incorporate' && after.statuses[1] === 'To Incorporate';
  const failedNotice = /0 revised, 2 failed/.test(toast);
  const noGarbage = String(after.chapters[0] || '').indexOf(PARSE_GARBAGE) < 0 && String(after.chapters[1] || '').indexOf(PARSE_GARBAGE) < 0;
  check('I7', 'callAI _jsonParseError does not write chapters[], counts as failed, items stay To Incorporate',
    ch1Unchanged && ch2Unchanged && notIncorporated && failedNotice && noGarbage,
    JSON.stringify({ chapters: after.chapters, gen: after.genDom, statuses: after.statuses, toast: toast }));
  const emptyAfter = (r && r.empty && r.empty.after) || { chapters: [], genDom: ['', '', ''], statuses: [], toasts: [] };
  const emptyToast = (emptyAfter.toasts || (r.empty && r.empty.toasts) || []).join(' ');
  check('I7', 'no usable prose ({}) does not write chapters[], counts as failed, item stays To Incorporate',
    emptyAfter.chapters[0] === CH1 && emptyAfter.genDom[0] === CH1 && emptyAfter.statuses[0] === 'To Incorporate' && /0 revised, 1 failed/.test(emptyToast),
    JSON.stringify({ chapters: emptyAfter.chapters, gen: emptyAfter.genDom, statuses: emptyAfter.statuses, toast: emptyToast }));
}

// ---------------- Mutations: TEMP copy, flags flipped false ----------------
{
  const m1 = mutateCopy(FLAGS.prose);
  check('M1', 'flag NW_6B_WRITE_PROSE_TO_GEN present', m1.ok, m1.detail);
  if (m1.ok) {
    const r = await runI1I5(m1.copy);
    check('M1', 'wrong prose target turns I1 red', r.verdict.I1 === false, JSON.stringify({ I1: r.verdict.I1, chapter0: r.after.chapters[0], gen1: r.after.genDom[0] }));
    try { fs.rmSync(m1.dir, { recursive: true, force: true }); } catch (_) { /* temp */ }
  }
  const m2 = mutateCopy(FLAGS.reject);
  check('M2', 'flag NW_6B_CALLAI_REJECT_PATH present', m2.ok, m2.detail);
  if (m2.ok) {
    const r = await runI1I5(m2.copy);
    check('M2', 'missing reject path turns I3 red', r.verdict.I3 === false, JSON.stringify({ I3: r.verdict.I3, timedOut: r.r.timedOut, settled: r.r.settled, hardTimeout: r.r.hardTimeout, ms: r.r.ms }));
    try { fs.rmSync(m2.dir, { recursive: true, force: true }); } catch (_) { /* temp */ }
  }
  const m3 = mutateCopy(FLAGS.status);
  check('M3', 'flag NW_6B_STATUS_PER_ITEM present', m3.ok, m3.detail);
  if (m3.ok) {
    const r = await runI1I5(m3.copy);
    check('M3', 'status flip-all turns I4 red', r.verdict.I4 === false, JSON.stringify({ I4: r.verdict.I4, statuses: r.after.statuses }));
    try { fs.rmSync(m3.dir, { recursive: true, force: true }); } catch (_) { /* temp */ }
  }
  const m4 = mutateCopy(FLAGS.parseFail);
  check('M4', 'flag NW_6B_PARSE_FAIL_AS_FAILURE present', m4.ok, m4.detail);
  if (m4.ok) {
    const r = await runParseFail(m4.copy);
    const after = (r && r.after) || { chapters: [], genDom: ['', '', ''], statuses: [] };
    const keptOriginal = after.chapters[0] === CH1 && after.genDom[0] === CH1 && after.statuses[0] === 'To Incorporate';
    check('M4', 'dropping PARSE_FAIL_AS_FAILURE writes parse-error chapter (I7 red)', keptOriginal === false, JSON.stringify({ chapter0: after.chapters[0], gen1: after.genDom[0], statuses: after.statuses }));
    try { fs.rmSync(m4.dir, { recursive: true, force: true }); } catch (_) { /* temp */ }
  }
}

check('ALL', 'no unexpected page errors', pageErrors.length === 0, pageErrors.slice(0, 5).join(' | '));
check('ALL', 'no live provider calls (api.x.ai aborted / unused)', networkSeen.filter((u) => /api\.x\.ai/i.test(u)).length === 0, networkSeen.slice(0, 5).join(' | '));
await browser.close();

fs.mkdirSync(OUT_DIR, { recursive: true });
const failed = checks.filter((c) => !c.ok);
fs.writeFileSync(path.join(OUT_DIR, 'SMOKE_NW_INTEGRATE.json'), JSON.stringify({ ok: !failed.length, passed: checks.length - failed.length, total: checks.length, checks }, null, 2));
for (const c of checks) process.stdout.write((c.ok ? 'PASS ' : 'FAIL ') + '[' + c.id + '] ' + c.name + (c.ok ? '' : ' :: ' + c.detail) + '\n');
process.stdout.write('\nNW INTEGRATE SMOKE: ' + (failed.length ? 'FAIL' : 'PASS') + ' (' + (checks.length - failed.length) + '/' + checks.length + ')\n');
process.exit(failed.length ? 1 : 0);
