/**
 * Lean Tracked E2E driver — step-by-step with live progress
 */
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import dotenv from 'dotenv';

const PLAN = 'C:/Users/brian/grok-build-queue/plans/ai-book-tools-2026-09-27/novelwriter';
const LIVE = 'file:///C:/NovelWriterSite/NovelWriter/NovelWriter.html';
const ENV = 'C:/NovelWriterSite/.env';
const REPORT_JSON = path.join(PLAN, 'TRACKED_E2E_REPORT.json');
const REPORT_MD = path.join(PLAN, 'TRACKED_E2E_REPORT.md');
const PROGRESS = path.join(PLAN, 'TRACKED_E2E_PROGRESS.md');
const STATUS = path.join(PLAN, 'TRACKED_E2E_STATUS.json');

dotenv.config({ path: ENV });
const apiKey = process.env.GROK_API_KEY || '';
if (!apiKey) {
  console.error('GROK_API_KEY missing from .env');
  process.exit(1);
}

function writeStatus(tab, step, status) {
  fs.writeFileSync(STATUS, JSON.stringify({ tab, step, status, updatedAt: new Date().toISOString() }, null, 2));
}

function appendProgress(block) {
  fs.appendFileSync(PROGRESS, '\n' + block.trim() + '\n');
}

async function bookSnap(page) {
  return page.evaluate(() => {
    const u = (typeof getSessionUsage === 'function') ? getSessionUsage() : (novelData.tokenUsage || {});
    const last = (u.calls && u.calls.length) ? u.calls[u.calls.length - 1] : null;
    const q = (novelData.qualitySamples || []).slice(-1)[0] || null;
    return {
      totals: {
        prompt_tokens: u.prompt_tokens || 0,
        completion_tokens: u.completion_tokens || 0,
        total_tokens: u.total_tokens || 0,
        calls: (u.calls || []).length
      },
      last: last ? {
        name: last.operationName,
        prompt: last.prompt_tokens,
        completion: last.completion_tokens,
        total: last.total_tokens
      } : null,
      title: novelData.title || '',
      genre: novelData.genre || '',
      chars: (novelData.characters || []).length,
      subplots: (novelData.subplots || []).length,
      ch1Len: ((novelData.chapters && novelData.chapters[0]) || '').length,
      ch2Len: ((novelData.chapters && novelData.chapters[1]) || '').length,
      ch1Snippet: (((novelData.chapters && novelData.chapters[0]) || '').replace(/\s+/g, ' ').slice(0, 140)),
      ch2Snippet: (((novelData.chapters && novelData.chapters[1]) || '').replace(/\s+/g, ' ').slice(0, 140)),
      storyArcSnippet: ((novelData.storyArc || '').replace(/\s+/g, ' ').slice(0, 120)),
      quality: q
    };
  });
}


function assertApiStep(label, beforeCalls, after, opts) {
  opts = opts || {};
  const grew = after.totals.calls > beforeCalls;
  const minChars = opts.minChars || 0;
  const contentLen = opts.contentLen != null ? opts.contentLen : null;
  if (!grew && !opts.allowNoCall) {
    throw new Error(label + ': expected API call to increase book tokenUsage.calls (before=' + beforeCalls + ' after=' + after.totals.calls + ') — likely auth failure or silent no-op');
  }
  if (contentLen != null && contentLen < minChars) {
    throw new Error(label + ': expected content >= ' + minChars + ' chars, got ' + contentLen + ' (false pass / empty generation)');
  }
}

function tokLine(snap, beforeCalls) {
  const last = snap.last;
  const thisCall = last && snap.totals.calls > beforeCalls
    ? (last.prompt + '/' + last.completion + '/' + last.total)
    : '0/0/0 (no new call)';
  return thisCall + ' / book ' + snap.totals.prompt_tokens + '/' + snap.totals.completion_tokens + '/' + snap.totals.total_tokens + ' (' + snap.totals.calls + ' calls)';
}

async function runStep(page, tab, name, stepLabel, fn, evalFn) {
  writeStatus(tab, stepLabel, 'running');
  appendProgress('### Tab ' + tab + ' — ' + name + ' — ' + stepLabel + '\n- Status: running\n- Tokens: pending\n- Eval: starting…\n');
  const before = await bookSnap(page);
  const beforeCalls = before.totals.calls;
  let ok = true;
  let err = null;
  let result = null;
  try {
    result = await fn();
  } catch (e) {
    ok = false;
    err = e && e.message ? e.message : String(e);
  }
  const after = await bookSnap(page);
  const evalText = evalFn ? evalFn(after, result, ok, err) : (ok ? 'Step completed.' : ('Failed: ' + err));
  const status = ok ? 'pass' : 'fail';
  writeStatus(tab, stepLabel, status);
  appendProgress(
    '### Tab ' + tab + ' — ' + name + ' — ' + stepLabel + '\n' +
    '- Status: ' + status + (err ? (' — ' + String(err).replace(/\n/g, ' ').slice(0, 200)) : '') + '\n' +
    '- Tokens this call / book cumulative: ' + tokLine(after, beforeCalls) + '\n' +
    '- Eval: ' + evalText + '\n'
  );
  return { ok: ok, err: err, result: result, after: after, name: stepLabel };
}

const report = {
  ok: false,
  steps: [],
  startedAt: new Date().toISOString(),
  config: { numChapters: 2, chapterLength: 500, numCharacters: 3, minSubplots: 2, maxTokens: 2000, genre: 'scifi' }
};

(async () => {
  appendProgress('### Phase — lean E2E — launching\n- Status: running\n- Tokens: n/a\n- Eval: Opening live NovelWriter via Playwright; injecting API key (not logged); lean config 2ch/500w/3chars/2subplots.\n');
  writeStatus(0, 'e2e-launch', 'running');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(600000);
  await page.goto(LIVE);
  await page.waitForFunction(() => typeof runTrackedE2E === 'function' && typeof callAI === 'function');

  await page.evaluate(({ key, cfg }) => {
    document.getElementById('apiKey').value = key;
    const modelSel = document.getElementById('model');
    if (modelSel) {
      const opts = Array.from(modelSel.options || []);
      const g47 = opts.find(o => /grok-4\.7/i.test(o.value) || /grok-4\.7/i.test(o.textContent || ''));
      const fast = opts.find(o => /fast-non-reasoning/i.test(o.value));
      if (g47) modelSel.value = g47.value;
      else if (fast) modelSel.value = fast.value;
      else if (!modelSel.value && opts[0]) modelSel.value = opts[0].value;
    }
    if (typeof resetBookTokenUsage === 'function') resetBookTokenUsage();
    novelData.qualitySamples = [];
    document.getElementById('genre').value = cfg.genre;
    document.getElementById('title').value = cfg.title;
    document.getElementById('numChapters').value = String(cfg.numChapters);
    document.getElementById('chapterLength').value = String(cfg.chapterLength);
    document.getElementById('numCharacters').value = String(cfg.numCharacters);
    document.getElementById('minSubplots').value = String(cfg.minSubplots);
    document.getElementById('maxTokens').value = String(cfg.maxTokens);
    if (typeof updateChapterSubpages === 'function') updateChapterSubpages();
    if (typeof syncCharacterEntries === 'function') syncCharacterEntries();
    if (typeof syncSubplotEntries === 'function') syncSubplotEntries();
    if (typeof collectData === 'function') collectData();
  }, { key: apiKey, cfg: Object.assign({}, report.config, { title: 'Tracked E2E Lean ' + new Date().toISOString().slice(0, 16) }) });

  report.config.model = await page.evaluate(() => document.getElementById('model').value);

  async function doStep(tab, name, stepLabel, fn, evalFn, assertOpts) {
    const beforeSnap = await bookSnap(page);
    const beforeCalls = beforeSnap.totals.calls;
    const r = await runStep(page, tab, name, stepLabel, fn, evalFn);
    if (r.ok && assertOpts) {
      try {
        const contentLen = assertOpts.contentFromResult
          ? (r.result && (r.result.textLen != null ? r.result.textLen : r.result.len != null ? r.result.len : r.result.count))
          : (assertOpts.contentLen != null ? assertOpts.contentLen : null);
        assertApiStep(stepLabel, beforeCalls, r.after, {
          minChars: assertOpts.minChars || 0,
          contentLen: contentLen,
          allowNoCall: !!assertOpts.allowNoCall
        });
      } catch (assertErr) {
        r.ok = false;
        r.err = assertErr.message;
        // rewrite last progress as fail
        appendProgress('### Tab ' + tab + ' — ' + name + ' — ' + stepLabel + ' (assert)\n- Status: fail — ' + assertErr.message + '\n- Tokens this call / book cumulative: ' + tokLine(r.after, beforeCalls) + '\n- Eval: Treated as fail: empty content or no book token growth despite API-intended step.\n');
        writeStatus(tab, stepLabel, 'fail');
      }
    }
    report.steps.push({ name: stepLabel, ok: r.ok, error: r.err });
    fs.writeFileSync(REPORT_JSON, JSON.stringify(Object.assign({}, report, {
      partial: true,
      bookTokenUsage: await page.evaluate(() => (typeof getSessionUsage === 'function' ? getSessionUsage() : null)),
      qualitySamples: await page.evaluate(() => (novelData.qualitySamples || []).slice())
    }), null, 2));
    return r;
  }

  await doStep(1, 'API & Story Info', 'c1Smoke', async () => {
    return page.evaluate(async () => (typeof runC1Smoke === 'function' ? await runC1Smoke() : false));
  }, (a, r, ok) => ok && r
    ? 'Local digest asserts passed (no full-manuscript dump). Packing path looks healthy for lean run.'
    : 'C1 smoke failed or returned false — digests/packing may be weak; continuing carefully.');

  await doStep(1, 'API & Story Info', 'fetchAuthors', async () => {
    return page.evaluate(async () => {
      await fetchAuthors();
      const sel = document.getElementById('authorStyle');
      const options = Array.from(sel.options || []).filter(o => o.value);
      if (options.length) {
        sel.value = options[0].value;
        if (typeof updateStyleGuide === 'function') updateStyleGuide();
      }
      return { author: sel.value, n: options.length };
    });
  }, (a, r) => 'Author pick: ' + ((r && r.author) || 'none') + ' (' + ((r && r.n) || 0) + ' options). Dropdown populated for genre=' + a.genre + '.');

  await doStep(1, 'API & Story Info', 'fetchStyleGuide', async () => {
    return page.evaluate(async () => {
      const author = (document.getElementById('authorStyle') || {}).value || '';
      if (!author) return { skipped: true };
      await fetchStyleGuide();
      return { author: author, len: ((document.getElementById('styleGuide') || {}).value || '').length };
    });
  }, (a, r) => (r && r.skipped) ? 'Skipped — no author set.' : ('Style guide length ' + ((r && r.len) || 0) + '. Prefer concrete craft notes over vague cheerleading.'));

  await doStep(1, 'API & Story Info', 'suggestStoryInfo', async () => {
    return page.evaluate(async () => {
      await suggestStoryInfo();
      return { title: document.getElementById('title').value };
    });
  }, (a) => 'Title/arc filled. Snippet: "' + (a.storyArcSnippet || '…') + '". Looking for concrete stakes vs stock openers.', { minChars: 0 });

  await doStep(2, 'Characters', 'suggestCharacters', async () => {
    return page.evaluate(async () => {
      await suggestCharacters();
      return { count: (novelData.characters || []).length };
    });
  }, (a, r) => 'Got ' + ((r && r.count) || a.chars) + ' characters (target 3). Prefer named agents with concrete backstory.');

  await doStep(3, 'Subplots', 'suggestSubplots', async () => {
    return page.evaluate(async () => {
      await suggestSubplots();
      return { count: (novelData.subplots || []).length };
    });
  }, (a, r) => 'Subplots: ' + ((r && r.count) || a.subplots) + ' (target >=2). Should braid into main conflict.');

  await doStep(4, 'Outlines', 'generateNovelOutlines', async () => {
    return page.evaluate(async () => {
      await generateNovelOutlines();
      return { novel: (novelData.novelOutline || '').length, plot: (novelData.plotOutline || '').length };
    });
  }, (a, r) => 'Novel/plot outline lens: ' + ((r && r.novel) || 0) + '/' + ((r && r.plot) || 0) + '. Want chapter roles + escalation, not buzzword tapestry.');

  await doStep(4, 'Outlines', 'generateChapterOutline1', async () => {
    return page.evaluate(async () => {
      await generateChapterOutline(1);
      return { len: (novelData.chapterOutlines[0] || '').length };
    });
  }, (a, r) => 'Ch1 outline len ' + ((r && r.len) || 0) + '. Should name scenes/beats with concrete locations.');

  await doStep(4, 'Outlines', 'generateChapterOutline2', async () => {
    return page.evaluate(async () => {
      await generateChapterOutline(2);
      return { len: (novelData.chapterOutlines[1] || '').length };
    });
  }, (a, r) => 'Ch2 outline len ' + ((r && r.len) || 0) + '. Continuity with Ch1 stakes matters more than length.');

  await doStep(5, 'Generate Chapters', 'generateChapter1+quality', async () => {
    return page.evaluate(async () => {
      await generateChapter(1);
      const text = novelData.chapters[0] || '';
      if (!text || text.trim().length < 50) throw new Error('generateChapter(1) produced empty/short text len=' + text.length);
      const heur = scoreProseQuality(text);
      pushQualitySample('chapter1-heuristics', heur, text.length);
      const judged = await judgeProseQualityLLM(text, document.getElementById('tab5') || document.getElementById('tab1'));
      pushQualitySample('chapter1-llmJudge', judged, text.length);
      return {
        textLen: text.length,
        heur: heur,
        judged: {
          interest: judged.interest,
          readability: judged.readability,
          aiSlopRisk: judged.aiSlopRisk,
          humanLikeness: judged.humanLikeness,
          source: judged.source,
          rationale: (judged.rationale || '').slice(0, 180)
        }
      };
    });
  }, (a, r) => {
    const j = r && r.judged;
    const h = r && r.heur;
    const hs = h ? [h.interest, h.readability, h.aiSlopRisk, h.humanLikeness].join('/') : '?';
    const js = j ? [j.interest, j.readability, j.aiSlopRisk, j.humanLikeness].join('/') + ' (' + j.source + ')' : 'n/a';
    return 'Ch1 ' + a.ch1Len + ' chars. Heuristics interest/read/slop/human=' + hs + '. LLM judge=' + js + '. Snippet: "' + a.ch1Snippet + '".';
  }, { minChars: 200, contentFromResult: true });

  await doStep(5, 'Generate Chapters', 'generateChapter2+quality', async () => {
    return page.evaluate(async () => {
      await generateChapter(2);
      const text = novelData.chapters[1] || '';
      if (!text || text.trim().length < 50) throw new Error('generateChapter(2) produced empty/short text len=' + text.length);
      const heur = scoreProseQuality(text);
      pushQualitySample('chapter2-heuristics', heur, text.length);
      return { textLen: text.length, heur: heur };
    });
  }, (a, r) => {
    const h = r && r.heur;
    const hs = h ? [h.interest, h.readability, h.aiSlopRisk, h.humanLikeness].join('/') : '?';
    return 'Ch2 ' + a.ch2Len + ' chars. Heuristics ' + hs + '. Snippet: "' + a.ch2Snippet + '". (Skipped 2nd LLM judge to save tokens.)';
  }, { minChars: 200, contentFromResult: true });

  await doStep(6, 'Edit Chapters', 'updateChapter1', async () => {
    return page.evaluate(async () => {
      if (typeof showTab === 'function') showTab(6);
      const editEl = document.getElementById('chapterEditContent1');
      const improvEl = document.getElementById('chapterEditImprovement1');
      if (!editEl) throw new Error('chapterEditContent1 missing');
      if (!editEl.value && novelData.chapters[0]) editEl.value = novelData.chapters[0];
      if (improvEl) improvEl.value = 'Tighten opening; add one concrete sensory detail; keep near target length.';
      await updateChapter(1);
      const text = novelData.chapters[0] || '';
      const heur = scoreProseQuality(text);
      pushQualitySample('chapter1-afterUpdate', heur, text.length);
      return { textLen: text.length, heur: heur };
    });
  }, (a, r) => {
    const h = r && r.heur;
    const hs = h ? [h.interest, h.readability, h.aiSlopRisk, h.humanLikeness].join('/') : '?';
    return 'Updated Ch1 (' + a.ch1Len + ' chars). Post-edit scores ' + hs + '. Prefer sharper concreteness without purple stock phrases.';
  }, { minChars: 200, contentFromResult: true });

  await doStep(7, 'Book', 'suggestBookImprovements', async () => {
    return page.evaluate(async () => {
      if (typeof showTab === 'function') showTab(7);
      const pack = typeof buildPromptContextPack === 'function' ? buildPromptContextPack({ includePacket: false }) : null;
      const packChars = pack ? ((pack._approxChars) || JSON.stringify(pack).length) : null;
      requestLog.contextPackChars = packChars;
      await suggestBookImprovements();
      return { packChars: packChars, improvements: (novelData.bookImprovements || []).length };
    });
  }, (a, r) => 'Book critique returned ' + ((r && r.improvements) || 0) + ' items; packChars=' + (r && r.packChars) + '. Should use digests (not full dump).', { minChars: 0 });

  const finalUsage = await page.evaluate(() => getSessionUsage());
  const finalQuality = await page.evaluate(() => getSessionQuality());
  report.ok = report.steps.every(s => s.ok);
  report.finishedAt = new Date().toISOString();
  report.bookTokenUsage = finalUsage;
  report.sessionUsage = finalUsage;
  report.sessionQuality = finalQuality;
  report.qualitySamples = finalQuality.samples || [];
  report.summary = {
    callCount: (finalUsage.calls || []).length,
    totals: {
      prompt_tokens: finalUsage.prompt_tokens,
      completion_tokens: finalUsage.completion_tokens,
      total_tokens: finalUsage.total_tokens
    },
    contextPackCharsSum: finalUsage.contextPackCharsSum,
    failedSteps: report.steps.filter(s => !s.ok).map(s => s.name),
    leanConfig: report.config
  };
  delete report.partial;

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
  const mdLines = [
    '# Tracked E2E Report (lean)',
    '',
    '- Finished: ' + report.finishedAt,
    '- OK: ' + report.ok,
    '- Config: 2 chapters / 500 words / 3 chars / 2 subplots / model=' + report.config.model,
    '- Calls: ' + report.summary.callCount,
    '- Book tokens prompt/comp/total: ' + report.summary.totals.prompt_tokens + '/' + report.summary.totals.completion_tokens + '/' + report.summary.totals.total_tokens,
    '- Failed steps: ' + (report.summary.failedSteps.join(', ') || 'none'),
    '',
    '## Quality samples'
  ];
  for (const s of report.qualitySamples) {
    mdLines.push('- ' + s.label + ': interest=' + s.interest + ' readability=' + s.readability + ' aiSlopRisk=' + s.aiSlopRisk + ' humanLikeness=' + s.humanLikeness + ' (' + s.source + ')');
  }
  fs.writeFileSync(REPORT_MD, mdLines.join('\n') + '\n');

  appendProgress(
    '### Phase — lean E2E — final\n' +
    '- Status: ' + (report.ok ? 'pass' : 'partial/fail') + '\n' +
    '- Tokens this call / book cumulative: — / book ' + report.summary.totals.prompt_tokens + '/' + report.summary.totals.completion_tokens + '/' + report.summary.totals.total_tokens + ' (' + report.summary.callCount + ' calls)\n' +
    '- Eval: Lean run finished. Failed=[' + (report.summary.failedSteps.join(', ') || 'none') + ']. Reports at TRACKED_E2E_REPORT.json/.md.\n'
  );
  writeStatus(7, 'final', report.ok ? 'pass' : 'fail');

  await browser.close();
  console.log(JSON.stringify({
    ok: report.ok,
    calls: report.summary.callCount,
    totals: report.summary.totals,
    failed: report.summary.failedSteps
  }, null, 2));
  process.exit(report.ok ? 0 : 2);
})().catch(err => {
  appendProgress('### Phase — lean E2E — fatal\n- Status: fail\n- Eval: ' + String(err && err.message || err).slice(0, 300) + '\n');
  writeStatus(0, 'fatal', 'fail');
  console.error(err);
  process.exit(1);
});
