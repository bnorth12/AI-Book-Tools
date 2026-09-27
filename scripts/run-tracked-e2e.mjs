/**
 * Lean Tracked E2E driver — step-by-step with live progress
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import dotenv from 'dotenv';

const PLAN = 'C:/Users/brian/grok-build-queue/plans/ai-book-tools-2026-09-27/novelwriter';
const LIVE = 'file:///C:/NovelWriterSite/NovelWriter/NovelWriter.html';
const ENV = 'C:/NovelWriterSite/.env';
const REPORT_JSON = path.join(PLAN, 'TRACKED_E2E_REPORT.json');
const REPORT_MD_LATEST = path.join(PLAN, 'TRACKED_E2E_REPORT_LATEST.md');
const PROGRESS = path.join(PLAN, 'TRACKED_E2E_PROGRESS.md');
const STATUS = path.join(PLAN, 'TRACKED_E2E_STATUS.json');
const ANNEX_JSON = path.join(PLAN, 'TRACKED_E2E_ANNEX_NOVELDATA.json');
const ANNEX_MD = path.join(PLAN, 'TRACKED_E2E_ANNEXES.md');
const TOKENS_MD = path.join(PLAN, 'TRACKED_E2E_TOKENS_BY_STAGE.md');

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

  
  // Track B: optional rich fixture seed (skip bible regen unless NW_E2E_REGEN_BIBLE=1)
  const fixturePath = process.env.NW_E2E_FIXTURE || '';
  const regenBible = process.env.NW_E2E_REGEN_BIBLE === '1';
  report.config.fixture = fixturePath || null;
  if (fixturePath) {
    const absFix = path.isAbsolute(fixturePath) ? fixturePath : path.join(path.dirname(fileURLToPath(import.meta.url)), '..', fixturePath);
    const seed = JSON.parse(fs.readFileSync(absFix, 'utf8'));
    appendProgress('### Phase - fixture seed\n- Status: loading\n- Eval: ' + absFix + '\n');
    await page.evaluate(({ seedObj, doRegen }) => {
      const keep = ['apiKey'];
      Object.keys(seedObj).forEach((k) => {
        if (k === 'notes' || k === 'fixtureId' || k === 'schemaHint' || k === 'world' || k === 'motifs') return;
        novelData[k] = seedObj[k];
      });
      novelData.worldBible = seedObj.world || novelData.worldBible;
      novelData.motifs = seedObj.motifs || novelData.motifs;
      novelData.kbEnabled = seedObj.kbEnabled !== false;
      const kb = document.getElementById('kbEnabled');
      if (kb) kb.checked = !!novelData.kbEnabled;
      const set = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
      set('title', novelData.title);
      set('genre', novelData.genre);
      set('numChapters', novelData.numChapters);
      set('storyArc', novelData.storyArc);
      set('styleGuide', novelData.styleGuide);
      if (typeof updateChapterSubpages === 'function') updateChapterSubpages();
      // populate character UI from novelData (names/roles must survive collectData)
      if (Array.isArray(novelData.characters) && novelData.characters.length) {
        const n = document.getElementById('numCharacters');
        if (n) n.value = String(novelData.characters.length);
      }
      if (typeof renderCharacters === 'function') {
        renderCharacters();
      } else if (Array.isArray(novelData.characters)) {
        // fallback: expand slots then fill .charName/.charBackstory/.charArc
        if (typeof syncCharacterEntries === 'function') syncCharacterEntries();
        const cards = document.querySelectorAll('#characterList .character');
        novelData.characters.forEach((c, i) => {
          const card = cards[i];
          if (!card) return;
          const nameEl = card.querySelector('.charName');
          const backEl = card.querySelector('.charBackstory');
          const arcEl = card.querySelector('.charArc');
          if (nameEl) nameEl.value = c.name || '';
          if (backEl) backEl.value = c.backstory || '';
          if (arcEl) arcEl.value = c.arc || '';
        });
      }
      window.__NW_FIXTURE_LOADED = { id: seedObj.fixtureId, regenBible: doRegen, chars: (novelData.characters || []).length };
    }, { seedObj: seed, doRegen: regenBible });
    report.config.lean = false;
    report.config.numChapters = seed.numChapters || report.config.numChapters;
    appendProgress('### Phase - fixture seed\n- Status: loaded\n- Eval: fixtureId=' + (seed.fixtureId || '?') + ' chars=' + ((seed.characters || []).length) + ' chapters=' + (seed.numChapters || '?') + ' kbEnabled=' + !!seed.kbEnabled + '\n');
  }


  // Item 3/4: chapter count + optional force multipass
  // NW_E2E_CHAPTERS overrides; fixture stress defaults to min(fixture numChapters, NW_E2E_CHAPTER_CAP||4)
  {
    const envCh = parseInt(process.env.NW_E2E_CHAPTERS || '', 10);
    const cap = parseInt(process.env.NW_E2E_CHAPTER_CAP || '4', 10) || 4;
    let n = report.config.numChapters || 2;
    if (Number.isFinite(envCh) && envCh > 0) n = envCh;
    else if (fixturePath) n = Math.min(Math.max(1, n), cap);
    else n = Math.min(Math.max(1, n), 2); // lean stays 2
    report.config.numChapters = n;
    report.config.chaptersToGenerate = n;
    report.config.forceMultipass = process.env.NW_E2E_FORCE_MULTIPASS === '1';
    appendProgress('### Phase - chapter plan\n- Status: ready\n- Eval: chaptersToGenerate=' + n + ' forceMultipass=' + report.config.forceMultipass + ' fixture=' + (fixturePath || 'none') + '\n');
  }

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

  const useFixture = !!fixturePath && !regenBible;

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
    if (useFixture) return page.evaluate(() => ({ title: novelData.title || '', skipped: true, reason: 'fixture' }));
    return page.evaluate(async () => {
      await suggestStoryInfo();
      return { title: document.getElementById('title').value };
    });
  }, (a, r) => (r && r.skipped) ? ('Fixture title/arc reused: "' + (a.storyArcSnippet || a.title || '…') + '".') : ('Title/arc filled. Snippet: "' + (a.storyArcSnippet || '…') + '". Looking for concrete stakes vs stock openers.'), { minChars: 0, allowNoCall: true });

  await doStep(2, 'Characters', 'suggestCharacters', async () => {
    if (useFixture) return page.evaluate(() => ({ count: (novelData.characters || []).length, skipped: true }));
    return page.evaluate(async () => {
      await suggestCharacters();
      return { count: (novelData.characters || []).length };
    });
  }, (a, r) => (r && r.skipped) ? ('Fixture cast reused: ' + ((r && r.count) || a.chars) + ' characters.') : ('Got ' + ((r && r.count) || a.chars) + ' characters (target 3). Prefer named agents with concrete backstory.'), { allowNoCall: true });

  await doStep(3, 'Subplots', 'suggestSubplots', async () => {
    if (useFixture) return page.evaluate(() => ({ count: (novelData.subplots || []).length, skipped: true }));
    return page.evaluate(async () => {
      await suggestSubplots();
      return { count: (novelData.subplots || []).length };
    });
  }, (a, r) => (r && r.skipped) ? ('Fixture subplots reused: ' + ((r && r.count) || a.subplots) + '.') : ('Subplots: ' + ((r && r.count) || a.subplots) + ' (target >=2). Should braid into main conflict.'), { allowNoCall: true });

  await doStep(4, 'Outlines', 'generateNovelOutlines', async () => {
    if (useFixture) return page.evaluate(() => ({ skipped: true, outlines: (novelData.chapterOutlines || []).length, arcLen: (novelData.storyArc || '').length }));
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

  // Outlines + generates for chapters 2..N (ch1 outline already done above when present)
  const chaptersToGenerate = report.config.chaptersToGenerate || report.config.numChapters || 2;

  // Ensure ch1 outline exists (lean path already ran generateChapterOutline1)
  for (let ch = 2; ch <= chaptersToGenerate; ch++) {
    await doStep(4, 'Outlines', 'generateChapterOutline' + ch, async () => {
      return page.evaluate(async (chapterNum) => {
        await generateChapterOutline(chapterNum);
        return { len: (novelData.chapterOutlines[chapterNum - 1] || '').length, chapter: chapterNum };
      }, ch);
    }, (a, r) => 'Ch' + ch + ' outline len ' + ((r && r.len) || 0) + '.');
  }

  // Item 3: optionally seed continuity + raise gate bar so pass1 gate-fail + pass2 continuity fire
  if (report.config.forceMultipass) {
    await page.evaluate(() => {
      novelData.continuityFindings = novelData.continuityFindings || [];
      if (!novelData.continuityFindings.length) {
        novelData.continuityFindings.push('Chapter 1: timeline drift on dock clocks (E2E force multipass)');
      }
      if (!novelData.continuityTracker) novelData.continuityTracker = { chapters: [], characterArcProgress: [], storyArcProgress: {} };
      novelData.continuityTracker.chapters = novelData.continuityTracker.chapters || [];
      novelData.continuityTracker.chapters[0] = {
        chapter: 1,
        continuityRisks: ['Unnamed child status restated without update (E2E force multipass)']
      };
      if (typeof NW_QUALITY_GATE === 'object' && NW_QUALITY_GATE) {
        window.__NW_GATE_BACKUP = Object.assign({}, NW_QUALITY_GATE);
        // High bar so first draft fails closed → pass1 revise; continuity still open → pass2
        NW_QUALITY_GATE.minInterest = Math.max(NW_QUALITY_GATE.minInterest || 0, 92);
        NW_QUALITY_GATE.minHumanLikeness = Math.max(NW_QUALITY_GATE.minHumanLikeness || 0, 90);
      }
      window.__NW_FORCE_MULTIPASS = true;
    });
    appendProgress('### Phase - force multipass\n- Status: seeded\n- Eval: continuity findings + raised gate thresholds for Ch1\n');
  }

  await doStep(5, 'Generate Chapters', 'generateChapter1+quality', async () => {
    return page.evaluate(async () => {
      await generateChapter(1);
      const text = novelData.chapters[0] || '';
      if (!text || text.trim().length < 50) throw new Error('generateChapter(1) produced empty/short text len=' + text.length);
      const heur = scoreProseQuality(text);
      pushQualitySample('chapter1-heuristics', heur, text.length);
      let judged = null;
      const align = novelData.lastJudgeGateAlignment || null;
      if (align && align.judgeScores) {
        judged = align.judgeScores;
      } else if (typeof judgeProseQualityLLM === 'function') {
        judged = await judgeProseQualityLLM(text, document.getElementById('tab5') || document.getElementById('tab1'));
        pushQualitySample('chapter1-llmJudge', judged, text.length);
        if (typeof alignJudgeWithGate === 'function' && novelData.lastQualityGate) {
          alignJudgeWithGate(novelData.lastQualityGate, judged, { label: 'chapter1-generate-e2e' });
        }
      }
      const gate = novelData.lastQualityGate || null;
      const reviseLog = (novelData.qualityReviseLog || []).slice();
      const multi = (novelData.qualityMultiPassLog || []).slice();
      const alignNow = novelData.lastJudgeGateAlignment || align;
      // restore gate thresholds after Ch1 multipass attempt
      if (window.__NW_GATE_BACKUP && typeof NW_QUALITY_GATE === 'object') {
        Object.assign(NW_QUALITY_GATE, window.__NW_GATE_BACKUP);
        window.__NW_GATE_BACKUP = null;
      }
      return {
        textLen: text.length,
        heur: heur,
        judged: judged ? {
          interest: judged.interest,
          readability: judged.readability,
          aiSlopRisk: judged.aiSlopRisk,
          humanLikeness: judged.humanLikeness,
          source: judged.source,
          rationale: (judged.rationale || '').slice(0, 180)
        } : null,
        gatePassed: gate ? !!gate.passed : null,
        gateFailures: gate && gate.failures ? gate.failures.slice(0, 6) : [],
        reviseAttempts: reviseLog.length,
        multiPassLog: multi,
        multiPassCount: multi.length,
        judgeAligned: alignNow ? alignNow.aligned : null,
        judgeDivergences: alignNow && alignNow.divergences ? alignNow.divergences.slice() : [],
        gateDriver: gate && gate.driver
      };
    });
  }, (a, r) => {
    const j = r && r.judged;
    const h = r && r.heur;
    const hs = h ? [h.interest, h.readability, h.aiSlopRisk, h.humanLikeness].join('/') : '?';
    const js = j ? [j.interest, j.readability, j.aiSlopRisk, j.humanLikeness].join('/') + ' (' + j.source + ')' : 'n/a';
    const gp = r && r.gatePassed;
    const ra = r && r.reviseAttempts;
    const mc = r && r.multiPassCount;
    const al = r && r.judgeAligned;
    const div = (r && r.judgeDivergences && r.judgeDivergences.length) ? r.judgeDivergences.join(',') : 'none';
    const kinds = (r && r.multiPassLog) ? r.multiPassLog.map(x => 'p' + x.pass + ':' + x.kind).join(',') : '';
    return 'Ch1 ' + ((r && r.textLen) || a.ch1Len) + ' chars. Heuristics interest/read/slop/human=' + hs + '. LLM judge=' + js + '. Gate=' + gp + ' driver=' + (r && r.gateDriver) + ' reviseLog=' + ra + ' multiPass=' + mc + '(' + kinds + ') judgeAlign=' + al + ' diverge=' + div + '.';
  }, { minChars: 200, contentFromResult: true });

  for (let ch = 2; ch <= chaptersToGenerate; ch++) {
    await doStep(5, 'Generate Chapters', 'generateChapter' + ch + '+quality', async () => {
      return page.evaluate(async (chapterNum) => {
        await generateChapter(chapterNum);
        const text = novelData.chapters[chapterNum - 1] || '';
        if (!text || text.trim().length < 50) throw new Error('generateChapter(' + chapterNum + ') produced empty/short text len=' + text.length);
        const heur = scoreProseQuality(text);
        pushQualitySample('chapter' + chapterNum + '-heuristics', heur, text.length);
        const multi = (novelData.qualityMultiPassLog || []).filter(e => e && e.chapter === chapterNum);
        return { textLen: text.length, heur: heur, chapter: chapterNum, multiPassCount: multi.length };
      }, ch);
    }, (a, r) => {
      const h = r && r.heur;
      const hs = h ? [h.interest, h.readability, h.aiSlopRisk, h.humanLikeness].join('/') : '?';
      return 'Ch' + ch + ' ' + ((r && r.textLen) || 0) + ' chars. Heuristics ' + hs + '. multiPassCh=' + ((r && r.multiPassCount) || 0) + '.';
    }, { minChars: 200, contentFromResult: true });
  }

  await doStep(6, 'Edit Chapters', 'applyStagedChapterImprovements1', async () => {
    return page.evaluate(async () => {
      if (typeof showTab === 'function') showTab(6);
      if (typeof applyStagedChapterImprovements !== 'function') throw new Error('applyStagedChapterImprovements missing — refresh live HTML');
      const editEl = document.getElementById('chapterEditContent1');
      if (!editEl) throw new Error('chapterEditContent1 missing');
      if (!editEl.value && novelData.chapters[0]) editEl.value = novelData.chapters[0];
      if (typeof stageChapterImprovement === 'function') {
        stageChapterImprovement(1, 'Tighten opening; add one concrete sensory detail; keep near target length.', { mode: 'replace', source: 'e2e-staged' });
      } else {
        const improvEl = document.getElementById('chapterEditImprovement1');
        if (improvEl) improvEl.value = 'Tighten opening; add one concrete sensory detail; keep near target length.';
      }
      const before = scoreProseQuality(novelData.chapters[0] || '');
      const out = await applyStagedChapterImprovements(1);
      const text = novelData.chapters[0] || '';
      const heur = (out && out.afterScores) || scoreProseQuality(text);
      return { textLen: text.length, heur: heur, before: before, delta: out && out.afterScores ? {
        interest: out.afterScores.interest - before.interest,
        readability: out.afterScores.readability - before.readability,
        aiSlopRisk: out.afterScores.aiSlopRisk - before.aiSlopRisk,
        humanLikeness: out.afterScores.humanLikeness - before.humanLikeness
      } : null };
    });
  }, (a, r) => {
    const h = r && r.heur;
    const hs = h ? [h.interest, h.readability, h.aiSlopRisk, h.humanLikeness].join('/') : '?';
    const d = r && r.delta;
    const ds = d ? (' delta i/r/s/h=' + [d.interest, d.readability, d.aiSlopRisk, d.humanLikeness].join('/')) : '';
    return 'Applied staged Ch1 improvements (' + a.ch1Len + ' chars). Scores ' + hs + ds + '.';
  }, { minChars: 200, contentFromResult: true });

  await doStep(6, 'Edit Chapters', 'reviseChapterForQuality1', async () => {
    return page.evaluate(async () => {
      if (typeof reviseChapterForQuality !== 'function') throw new Error('reviseChapterForQuality missing — refresh live HTML');
      const prior = (novelData.qualityReviseLog || []).slice();
      const autoRevise = prior.length > 0;
      let result;
      if (autoRevise) {
        const gate = runQualityGate(novelData.chapters[0] || '', { label: 'chapter1-e2e-postAutoRevise' });
        result = { revised: false, skipped: true, reason: 'auto-revise already ran during generate', attempts: prior.length, gateAfter: gate, gateBefore: prior[prior.length - 1] };
      } else {
        const scores = scoreProseQuality(novelData.chapters[0] || '');
        const fakeFail = { passed: false, failures: ['e2e-forced-revise-exercise', 'aiSlopRisk>=55'], scores: Object.assign({}, scores, { aiSlopRisk: Math.max(60, scores.aiSlopRisk || 0) }) };
        result = await reviseChapterForQuality(1, fakeFail, { maxAttempts: 1 });
        result.skipped = false;
        result.reason = 'forced revise to exercise QE2 path';
      }
      return {
        skipped: !!result.skipped,
        reason: result.reason || '',
        attempts: result.attempts || 0,
        passedBefore: result.gateBefore ? !!result.gateBefore.passed : null,
        passedAfter: result.gateAfter ? !!result.gateAfter.passed : null,
        reviseLogLen: (novelData.qualityReviseLog || []).length,
        textLen: (novelData.chapters[0] || '').length
      };
    });
  }, (a, r) => {
    return 'QE2 revise: skipped=' + (r && r.skipped) + ' reason=' + ((r && r.reason) || '') + ' attempts=' + ((r && r.attempts) || 0) + ' gate ' + (r && r.passedBefore) + '→' + (r && r.passedAfter) + ' log=' + (r && r.reviseLogLen) + '.';
  }, { minChars: 200, contentFromResult: true, allowNoCall: true });

  await doStep(7, 'Book', 'suggestBookImprovements', async () => {
    return page.evaluate(async () => {
      if (typeof showTab === 'function') showTab(7);
      const pack = typeof buildPromptContextPack === 'function' ? buildPromptContextPack({ includePacket: false }) : null;
      const packChars = pack ? ((pack._approxChars) || JSON.stringify(pack).length) : null;
      requestLog.contextPackChars = packChars;
      await suggestBookImprovements();
      return { packChars: packChars, improvements: (novelData.bookImprovements || []).length, withStatus: (novelData.bookImprovementsWithStatus || []).length };
    });
  }, (a, r) => 'Book critique returned ' + ((r && r.improvements) || 0) + ' items; packChars=' + (r && r.packChars) + '. Should use digests (not full dump).', { minChars: 0 });

  await doStep(7, 'Book', 'applyTopBookCritique', async () => {
    return page.evaluate(async () => {
      if (typeof applyTopBookCritiques !== 'function') throw new Error('applyTopBookCritiques missing — refresh live HTML');
      const pending = (novelData.bookImprovementsWithStatus || []).filter(x => x && x.status === 'To Incorporate' && String(x.text || '').trim());
      if (!pending.length) throw new Error('No To Incorporate critique items to apply');
      const before = scoreProseQuality(novelData.chapters[0] || '');
      const out = await applyTopBookCritiques(1);
      const applied = (out && out.applied) || [];
      if (!applied.length) throw new Error('applyTopBookCritiques returned zero applied');
      const a0 = applied[0];
      return {
        appliedCount: applied.length,
        chapter: a0.chapter,
        before: before,
        after: a0.afterScores,
        delta: a0.item && a0.item.applyDelta,
        status: a0.item && a0.item.status,
        critiqueApplyLog: (novelData.critiqueApplyLog || []).length
      };
    });
  }, (a, r) => {
    const d = r && r.delta;
    const ds = d ? [d.interest, d.readability, d.aiSlopRisk, d.humanLikeness].join('/') : '?';
    return 'Applied top critique to Ch.' + (r && r.chapter) + ' status=' + (r && r.status) + ' delta i/r/s/h=' + ds + ' log=' + (r && r.critiqueApplyLog) + '.';
  }, { minChars: 200, contentFromResult: true });

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

  // Snapshot sanitized novelData for Annex E
  const annexNovel = await page.evaluate(() => {
    const nd = (typeof novelData !== 'undefined' && novelData) ? novelData : {};
    const clone = JSON.parse(JSON.stringify(nd));
    // strip secrets / huge binary-ish if any; keep story content
    if (clone.apiKey) delete clone.apiKey;
    if (clone.GROK_API_KEY) delete clone.GROK_API_KEY;
    return clone;
  });
  report.annexNovelDataMeta = {
    title: annexNovel.title || '',
    genre: annexNovel.genre || '',
    characters: (annexNovel.characters || []).length,
    subplots: (annexNovel.subplots || []).length,
    chapters: (annexNovel.chapters || []).map(c => (c || '').length),
    hasTokenUsage: !!(annexNovel.tokenUsage && annexNovel.tokenUsage.calls),
    hasQuality: !!(annexNovel.qualitySamples && annexNovel.qualitySamples.length)
  };
  fs.writeFileSync(ANNEX_JSON, JSON.stringify(annexNovel, null, 2));

  const calls = (finalUsage && finalUsage.calls) ? finalUsage.calls : [];
  // Per-stage rollup (by originTab + operationName)
  const byStage = {};
  for (const c of calls) {
    const stage = (c.originTab || 'unknown') + ' / ' + (c.operationName || 'unnamed');
    if (!byStage[stage]) {
      byStage[stage] = { stage: stage, originTab: c.originTab || '', operationName: c.operationName || '', count: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    }
    byStage[stage].count += 1;
    byStage[stage].prompt_tokens += (c.prompt_tokens || 0);
    byStage[stage].completion_tokens += (c.completion_tokens || 0);
    byStage[stage].total_tokens += (c.total_tokens || 0);
  }
  report.tokensByStage = Object.values(byStage);
  report.tokensByPrompt = calls.map((c, i) => ({
    i: i + 1,
    operationName: c.operationName || '',
    originTab: c.originTab || '',
    model: c.model || '',
    prompt_tokens: c.prompt_tokens || 0,
    completion_tokens: c.completion_tokens || 0,
    total_tokens: c.total_tokens || 0,
    contextPackChars: c.contextPackChars == null ? null : c.contextPackChars,
    ts: c.ts || null
  }));

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
    '## Cost / efficiency (tokens) — not quality',
    '',
    'Token usage is a cost/efficiency product metric. Quality scores are separate (below).',
    '',
    '### Per prompt (each LLM call)',
    '',
    '| # | Stage (tab) | Operation / prompt | Prompt | Completion | Total | Pack chars |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: |'
  ];
  for (const c of report.tokensByPrompt) {
    mdLines.push('| ' + c.i + ' | ' + c.originTab + ' | ' + c.operationName + ' | ' + c.prompt_tokens + ' | ' + c.completion_tokens + ' | ' + c.total_tokens + ' | ' + (c.contextPackChars == null ? '—' : c.contextPackChars) + ' |');
  }
  mdLines.push('');
  mdLines.push('### Per stage rollup');
  mdLines.push('');
  mdLines.push('| Stage | Calls | Prompt | Completion | Total |');
  mdLines.push('| --- | ---: | ---: | ---: | ---: |');
  for (const s of report.tokensByStage) {
    mdLines.push('| ' + s.stage + ' | ' + s.count + ' | ' + s.prompt_tokens + ' | ' + s.completion_tokens + ' | ' + s.total_tokens + ' |');
  }
  mdLines.push('');
  mdLines.push('### Book rollup');
  mdLines.push('');
  mdLines.push('- prompt/comp/total: **' + report.summary.totals.prompt_tokens + ' / ' + report.summary.totals.completion_tokens + ' / ' + report.summary.totals.total_tokens + '**');
  mdLines.push('- calls: **' + report.summary.callCount + '**');
  mdLines.push('');
  mdLines.push('## Quality samples (prose — separate from tokens)');
  for (const s of report.qualitySamples) {
    mdLines.push('- ' + s.label + ': interest=' + s.interest + ' readability=' + s.readability + ' aiSlopRisk=' + s.aiSlopRisk + ' humanLikeness=' + s.humanLikeness + ' (' + s.source + ')');
  }
  mdLines.push('');
  mdLines.push('## Annexes');
  mdLines.push('');
  mdLines.push('- Canonical human deliverable after builder: `TRACKED_E2E_REPORT_YYYY-MM-DD_HHMMSS.md` (+ `TRACKED_E2E_REPORT_LATEST.md` copy)');
  mdLines.push('- Optional sidecar: `TRACKED_E2E_ANNEX_NOVELDATA.json`');
  mdLines.push('- `TRACKED_E2E_TOKENS_BY_STAGE.md` — tokens-only view');
  mdLines.push('- `TRACKED_E2E_REPORT.json` — machine-readable (includes tokensByPrompt / tokensByStage)');
  fs.writeFileSync(REPORT_MD_LATEST, mdLines.join('\n') + '\n');

  // Tokens-only companion
  const tokMd = [
    '# Tracked E2E — tokens by stage / prompt',
    '',
    'Cost/efficiency only. Not quality.',
    '',
    'Book: ' + report.summary.totals.prompt_tokens + '/' + report.summary.totals.completion_tokens + '/' + report.summary.totals.total_tokens + ' (' + report.summary.callCount + ' calls)',
    '',
    '## Per prompt',
    ''
  ];
  for (const c of report.tokensByPrompt) {
    tokMd.push('- #' + c.i + ' [' + c.originTab + '] ' + c.operationName + ': ' + c.prompt_tokens + '/' + c.completion_tokens + '/' + c.total_tokens);
  }
  tokMd.push('');
  tokMd.push('## Per stage rollup');
  tokMd.push('');
  for (const s of report.tokensByStage) {
    tokMd.push('- ' + s.stage + ' (x' + s.count + '): ' + s.prompt_tokens + '/' + s.completion_tokens + '/' + s.total_tokens);
  }
  fs.writeFileSync(TOKENS_MD, tokMd.join('\n') + '\n');

  // Do not write TRACKED_E2E_ANNEXES.md — book annexes live only in TRACKED_E2E_REPORT.md.
  if (fs.existsSync(ANNEX_MD)) {
    fs.unlinkSync(ANNEX_MD);
  }


  appendProgress(
    '### Phase — lean E2E — final\n' +
    '- Status: ' + (report.ok ? 'pass' : 'partial/fail') + '\n' +
    '- Tokens this call / book cumulative: — / book ' + report.summary.totals.prompt_tokens + '/' + report.summary.totals.completion_tokens + '/' + report.summary.totals.total_tokens + ' (' + report.summary.callCount + ' calls)\n' +
    '- Eval: Lean run finished. Failed=[' + (report.summary.failedSteps.join(', ') || 'none') + ']. Dated report via builder (TRACKED_E2E_REPORT_<stamp>.md).\n'
  );

  // Rebuild single multi-section report (exec summary + cost) via plans helper
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const builderRepo = path.join(__dirname, 'build_unified_report.py');
    const builderPlan = path.join(PLAN, 'build_unified_report.py');
    const builder = fs.existsSync(builderRepo) ? builderRepo : builderPlan;
    if (fs.existsSync(builder)) {
      const r = spawnSync('py', ['-3', builder], { encoding: 'utf-8' });
      if (r.status !== 0) {
        console.error('unified report builder failed', r.stderr || r.stdout);
      } else {
        appendProgress('### Phase — unified report\n- Status: pass\n- Eval: Dated TRACKED_E2E_REPORT_<stamp>.md (+ LATEST copy) regenerated as single-file deliverable.\n');
      }
    }
  } catch (e) {
    console.error('unified report hook error', e);
  }

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
