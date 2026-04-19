const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { judgeChapterQuality, judgePairwiseQuality } = require('./quality_judge');

const APP_URL = 'http://localhost:8080/NovelWriter/NovelWriter.html';
const API_KEY = process.env.XAI_API_KEY || '';
const ENABLE_PAIRWISE = process.env.QUALITY_PAIRWISE === '1';
if (!API_KEY) {
  console.error('Missing XAI_API_KEY environment variable.');
  process.exit(1);
}

const RUNS_PER_VARIANT = 2;
const FIXED_TAB3_PROMPT =
  'You are a developmental editor designing subplots that pressure and evolve character arcs. Each subplot must create distinct emotional and practical conflict, force decisions, and generate downstream consequences that can be refined into character arc updates. Keep subplots specific, non-redundant, and tightly integrated with main plot stakes.';
const FIXED_TAB4_STRUCTURAL_PROMPT =
  'You are a novel structure planner. Produce a chapter-distributed plan that phases plot, subplot pressure, and character-arc movement across opening/middle/late sections. Preserve escalation discipline: seed and setup in early chapters, compounding reversals in middle chapters, and major payoffs only in late chapters.';

const VARIANTS = [
  { id: 'baseline', label: 'Baseline Tab 4 prompt', tab4Prompt: null },
  {
    id: 'variant_a_causal_beats',
    label: 'Causal beats + chapter function',
    tab4Prompt:
      'You are a chapter planning editor for long-form fiction. Build chapter outlines as causal units, not scene lists. Each outline must define chapter function, 2-3 concrete turning events, pressure on at least one main subplot, and named character beats that shift motive, trust, or leverage. Enforce chapter-window discipline: in Chapter 1 prioritize setup and pressure seeding, avoid resolving central arc turns or climax-grade revelations, and defer major payoffs to later chapters.',
  },
  {
    id: 'variant_b_emotional_continuity',
    label: 'Emotional continuity + payoff discipline',
    tab4Prompt:
      'You are a chapter architecture specialist. Design chapter outlines and arcs that preserve continuity, stage emotional reversals, and pay off subplot pressure without collapsing future beats too early. For early chapters, include setup plus one meaningful complication, keep identity-defining and world-defining revelations partial, and reserve irreversible arc transformations for middle/late chapters. Use concrete named story detail over generic planning language.',
  },
  {
    id: 'variant_c_staged_folding',
    label: 'Staged fold planning',
    tab4Prompt:
      'You are a structural narrative planner focused on staged folding. For this chapter, select only the plot/subplot beats appropriate to chapter position, explicitly mark what remains unresolved for later chapters, and cap escalation so the novel can breathe. Require: one anchor event, one subplot pressure beat, one character state shift, and one deferred thread that points forward without premature payoff.',
  },
];

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function riskLevelToScore(level) {
  const normalized = String(level || '').toLowerCase();
  if (normalized === 'low') return 1;
  if (normalized === 'medium') return 2;
  if (normalized === 'high') return 3;
  return 4;
}

function buildPairwiseArtifact(row) {
  return [
    `Title: ${row.title || 'Untitled'}`,
    `Genre: ${row.genre || 'unknown'}`,
    `Story Arc: ${row.storyArc || 'N/A'}`,
    `General Plot: ${row.generalPlot || 'N/A'}`,
    `Chapter Outline: ${row.chapterOutline || 'N/A'}`,
    `Chapter Arc: ${row.chapterArc || 'N/A'}`,
    `Subplots: ${Array.isArray(row.subplots) ? row.subplots.join(' | ') : ''}`,
    'Chapter Text:',
    row.chapterText || '',
    'Continuity Audit:',
    JSON.stringify(row.continuityAudit || {}),
  ].join('\n');
}

async function waitForLLM(page, timeoutMs = 600000) {
  try {
    await page.locator('.loading-indicator:visible').first().waitFor({ state: 'visible', timeout: 5000 });
  } catch {
    // ignore
  }
  await page.waitForFunction(
    () => {
      const indicators = document.querySelectorAll('.loading-indicator');
      return Array.from(indicators).every((el) => {
        const style = window.getComputedStyle(el);
        return style.display === 'none' || style.visibility === 'hidden' || el.offsetParent === null;
      });
    },
    null,
    { timeout: timeoutMs }
  );
  await page.waitForTimeout(350);
}

async function gotoTab(page, n) {
  await page.click(`#nav button:has-text("${n}.")`);
  await page.waitForTimeout(250);
}

async function seedBaseState(page, runIndex) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.fill('#apiKey', API_KEY);
  await page.selectOption('#genre', 'scifi');
  await page.dispatchEvent('#genre', 'change');
  await page.selectOption('#authorStyle', 'nealstephenson');
  await page.dispatchEvent('#authorStyle', 'change');

  await page.fill('#title', `Tab4VariantEval ${new Date().toISOString()} #${runIndex}`);
  await page.fill('#storyArc', 'A covert resistance learns the empire is using predictive simulations to pre-empt rebellion and must break the model before the model breaks them.');
  await page.fill('#generalPlot', 'A data-forger, a disillusioned strategist, and a systems monk infiltrate a simulation archive, triggering a city-wide trust collapse and moral crisis over who controls truth.');
  await page.fill('#setting', 'A layered orbital city where neighborhoods are governed by competing prediction engines and citizens trade in verified memory shards.');
  await page.fill('#numChapters', '2');
  await page.dispatchEvent('#numChapters', 'change');
  await page.fill('#chapterLength', '1200');
  await page.dispatchEvent('#chapterLength', 'change');

  await page.evaluate((tab3Prompt) => {
    if (typeof promptCatalog === 'undefined' || !promptCatalog?.tab3?.suggestSubplots) {
      throw new Error('promptCatalog.tab3.suggestSubplots not found');
    }
    promptCatalog.tab3.suggestSubplots.systemPrompt = tab3Prompt;
  }, FIXED_TAB3_PROMPT);

  await gotoTab(page, 2);
  await page.fill('#numCharacters', '2');
  await page.dispatchEvent('#numCharacters', 'change');
  await page.click('button:has-text("Suggest Characters")');
  await waitForLLM(page);

  await gotoTab(page, 3);
  await page.fill('#minSubplots', '2');
  await page.dispatchEvent('#minSubplots', 'change');
  await page.click('button:has-text("AI Suggest Subplots")');
  await waitForLLM(page);

  await gotoTab(page, 2);
  await page.click('button:has-text("Refine Characters with Subplots")');
  await waitForLLM(page);
}

async function runVariant(page, variant, baselinePrompt) {
  const tab4Prompt = variant.tab4Prompt || baselinePrompt;
  await page.evaluate((promptValue) => {
    if (typeof promptCatalog === 'undefined' || !promptCatalog?.tab4?.generateChapterOutline) {
      throw new Error('promptCatalog.tab4.generateChapterOutline not found');
    }
    promptCatalog.tab4.generateChapterOutline.systemPrompt = promptValue;
  }, tab4Prompt);

  await page.evaluate((structuralPrompt) => {
    if (typeof promptCatalog === 'undefined' || !promptCatalog?.tab4?.generateNovelOutlines) {
      throw new Error('promptCatalog.tab4.generateNovelOutlines not found');
    }
    promptCatalog.tab4.generateNovelOutlines.systemPrompt = structuralPrompt;
  }, FIXED_TAB4_STRUCTURAL_PROMPT);

  await gotoTab(page, 4);
  await page.evaluate(() => showChapterSubpage(0));
  const macroPlanStarted = Date.now();
  await page.click('#outlineMain button:has-text("AI Suggest Novel Outline")');
  await waitForLLM(page, 900000);
  const macroPlanMs = Date.now() - macroPlanStarted;

  await page.evaluate(() => showChapterSubpage(1));
  const outlineStarted = Date.now();
  await page.click('#chapterOutline1 button:has-text("Generate Chapter Outline & Arc")');
  await waitForLLM(page);
  const outlineMs = Date.now() - outlineStarted;

  await gotoTab(page, 5);
  await page.evaluate(() => showGenChapterSubpage(1));
  const chapterStarted = Date.now();
  await page.click('#chapterGen1 button:has-text("Generate Chapter")');
  await waitForLLM(page, 900000);
  const chapterMs = Date.now() - chapterStarted;

  const auditStarted = Date.now();
  const auditResult = await page.evaluate(async () => {
    if (!window.runChapterContinuityAudit) {
      return { error: 'runChapterContinuityAudit not available' };
    }
    try {
      const result = await window.runChapterContinuityAudit(1, { silent: true });
      await new Promise((resolve) => setTimeout(resolve, 500));
      const chapterAudit = window.novelData?.continuityTracker?.chapters?.[0] || null;
      return { success: true, audit: chapterAudit, directAudit: result || null };
    } catch (error) {
      return { error: error.message };
    }
  });
  await waitForLLM(page, 300000);
  const auditMs = Date.now() - auditStarted;

  const result = await page.evaluate((capturedAudit) => {
    const chapterFromModel = (window.novelData?.chapters?.[0] || '').trim();
    const chapterFromTextarea = (document.getElementById('chapterGenContent1')?.value || '').trim();
    const chapterText = chapterFromModel || chapterFromTextarea;
    const chapterAudit = window.novelData?.continuityTracker?.chapters?.[0] || null;
    const auditPayload = chapterAudit || capturedAudit?.directAudit || capturedAudit?.audit || null;
    const subplots = (window.novelData?.subplots || []).filter(Boolean);

    return {
      title: window.novelData?.title || '',
      genre: window.novelData?.genre || '',
      storyArc: window.novelData?.storyArc || '',
      generalPlot: window.novelData?.generalPlot || '',
      setting: window.novelData?.setting || '',
      characters: Array.isArray(window.novelData?.characters) ? window.novelData.characters.filter((c) => c?.name) : [],
      chapterOutline: window.novelData?.chapterOutlines?.[0] || '',
      chapterArc: window.novelData?.chapterArcs?.[0] || '',
      chapterText,
      chapterWords: chapterText ? chapterText.split(/\s+/).filter(Boolean).length : 0,
      chapterChars: chapterText.length,
      chapterGenerated: chapterText.length > 200,
      subplots,
      continuityAudit: auditPayload,
      continuityRisksCount: Array.isArray(auditPayload?.continuityRisks) ? auditPayload.continuityRisks.length : 0,
      unresolvedThreadsCount: Array.isArray(auditPayload?.unresolvedThreads) ? auditPayload.unresolvedThreads.length : 0,
      recommendedFixesCount: Array.isArray(auditPayload?.recommendedFixes) ? auditPayload.recommendedFixes.length : 0,
      storyArcRiskLevel: auditPayload?.storyArcProgress?.riskLevel || 'unknown',
      auditGenerated: !!auditPayload,
      auditSummary: auditPayload?.chapterSummary || '',
      requestStatus: window.requestLog?.status || '',
    };
  }, auditResult);

  const quality = await judgeChapterQuality({
    apiKey: API_KEY,
    title: result.title,
    genre: result.genre,
    variantId: variant.id,
    storyArc: result.storyArc,
    generalPlot: result.generalPlot,
    setting: result.setting,
    characters: result.characters,
    subplots: result.subplots,
    chapterOutline: result.chapterOutline,
    chapterArc: result.chapterArc,
    chapterText: result.chapterText,
    continuityAudit: result.continuityAudit,
  });

  return {
    variantId: variant.id,
    variantLabel: variant.label,
    tab4Prompt,
    ...result,
    quality,
    latencyMs: {
      tab4GenerateMacroPlan: macroPlanMs,
      tab4GenerateOutline: outlineMs,
      tab5GenerateChapter: chapterMs,
      tab5ContinuityAudit: auditMs,
      total: macroPlanMs + outlineMs + chapterMs + auditMs,
    },
  };
}

function summarize(results) {
  const byVariant = new Map();
  for (const row of results) {
    if (!byVariant.has(row.variantId)) byVariant.set(row.variantId, []);
    byVariant.get(row.variantId).push(row);
  }

  const summary = [];
  for (const [variantId, rows] of byVariant.entries()) {
    const a = (selector) => avg(rows.map(selector));
    summary.push({
      variantId,
      label: rows[0].variantLabel,
      runs: rows.length,
      avgQualityOverall: a((x) => x.quality?.overallScore || 0),
      avgQualityCoherence: a((x) => x.quality?.rubric?.chapterCoherence?.score || 0),
      avgQualityCharacterConsistency: a((x) => x.quality?.rubric?.characterConsistency?.score || 0),
      avgQualitySubplotIntegration: a((x) => x.quality?.rubric?.subplotIntegration?.score || 0),
      avgQualitySceneClarity: a((x) => x.quality?.rubric?.sceneClarity?.score || 0),
      avgQualityEmotionalImpact: a((x) => x.quality?.rubric?.emotionalImpact?.score || 0),
      avgQualityContinuityIntegrity: a((x) => x.quality?.rubric?.continuityIntegrity?.score || 0),
      avgQualityProseSpecificity: a((x) => x.quality?.rubric?.proseSpecificity?.score || 0),
      chapterGenerationSuccessRate: a((x) => (x.chapterGenerated ? 1 : 0)),
      auditGenerationSuccessRate: a((x) => (x.auditGenerated ? 1 : 0)),
      avgContinuityRisks: a((x) => x.continuityRisksCount),
      avgUnresolvedThreads: a((x) => x.unresolvedThreadsCount),
      avgRecommendedFixes: a((x) => x.recommendedFixesCount),
      avgStoryArcRiskScore: a((x) => riskLevelToScore(x.storyArcRiskLevel)),
      avgChapterWords: a((x) => x.chapterWords),
      avgLatencyMs: a((x) => x.latencyMs.total),
    });
  }

  summary.sort((x, y) => {
    if (y.chapterGenerationSuccessRate !== x.chapterGenerationSuccessRate) return y.chapterGenerationSuccessRate - x.chapterGenerationSuccessRate;
    if (y.auditGenerationSuccessRate !== x.auditGenerationSuccessRate) return y.auditGenerationSuccessRate - x.auditGenerationSuccessRate;
    if (y.avgQualityOverall !== x.avgQualityOverall) return y.avgQualityOverall - x.avgQualityOverall;
    if (y.avgQualityContinuityIntegrity !== x.avgQualityContinuityIntegrity) return y.avgQualityContinuityIntegrity - x.avgQualityContinuityIntegrity;
    if (x.avgContinuityRisks !== y.avgContinuityRisks) return x.avgContinuityRisks - y.avgContinuityRisks;
    return x.avgLatencyMs - y.avgLatencyMs;
  });

  return summary;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    const baselinePrompt = await page.evaluate(() => {
      if (typeof promptCatalog === 'undefined') return '';
      return promptCatalog?.tab4?.generateChapterOutline?.systemPrompt || '';
    });
    if (!baselinePrompt) throw new Error('Unable to read baseline Tab 4 prompt');

    const rows = [];
    for (const variant of VARIANTS) {
      for (let run = 1; run <= RUNS_PER_VARIANT; run++) {
        await seedBaseState(page, run);
        const row = await runVariant(page, variant, baselinePrompt);
        row.run = run;
        rows.push(row);
        console.log(
          `[run] ${variant.id} #${run} quality=${row.quality?.overallScore || 0} ` +
            `risks=${row.continuityRisksCount} storyRisk=${row.storyArcRiskLevel} ` +
            `words=${row.chapterWords} audit=${row.auditGenerated} latency=${row.latencyMs.total}ms`
        );
      }
    }

    const summary = summarize(rows);
    let pairwise = [];
    if (ENABLE_PAIRWISE) {
      const baselineRows = rows.filter((row) => row.variantId === 'baseline');
      const candidateRows = rows.filter((row) => row.variantId !== 'baseline');
      for (const candidate of candidateRows) {
        const baselineRow = baselineRows.find((row) => row.run === candidate.run);
        if (!baselineRow) continue;
        const decision = await judgePairwiseQuality({
          apiKey: API_KEY,
          artifactType: 'tab4_chapter_outline_downstream_chapter',
          context: {
            run: candidate.run,
            title: candidate.title,
            genre: candidate.genre,
            fixedTab3Prompt: 'variant_b_character_pressure',
          },
          baselineArtifact: buildPairwiseArtifact(baselineRow),
          candidateArtifact: buildPairwiseArtifact(candidate),
          baselineLabel: 'baseline',
          candidateLabel: candidate.variantId,
        });
        pairwise.push({
          run: candidate.run,
          baselineVariantId: 'baseline',
          candidateVariantId: candidate.variantId,
          ...decision,
        });
      }
    }

    const out = {
      generatedAt: new Date().toISOString(),
      scope: {
        purpose: 'Tune Tab 4 chapter outline agent while holding the current Tab 3 recommendation fixed',
        fixedTab3Prompt: 'variant_b_character_pressure',
        comparedVariants: VARIANTS.map((variant) => ({ id: variant.id, label: variant.label })),
        runsPerVariant: RUNS_PER_VARIANT,
        rankingMethod: 'Quality-first with continuity and pairwise checks',
        pairwiseEnabled: ENABLE_PAIRWISE,
      },
      results: rows,
      pairwise,
      summary,
      winner: summary[0] || null,
    };

    const outDir = path.join(process.cwd(), 'test-results');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `tab4-prompt-variant-eval-${Date.now()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');

    console.log('\n=== Tab 4 Prompt Variant Summary ===');
    for (const item of summary) {
      console.log(
        `${item.variantId.padEnd(28)} quality=${item.avgQualityOverall.toFixed(2)} ` +
          `cont=${item.avgQualityContinuityIntegrity.toFixed(2)} risks=${item.avgContinuityRisks.toFixed(2)} ` +
          `words=${Math.round(item.avgChapterWords)} latency=${Math.round(item.avgLatencyMs)}ms`
      );
    }
    if (pairwise.length) {
      console.log('\n=== Pairwise Quality Decisions ===');
      for (const decision of pairwise) {
        console.log(
          `run=${decision.run} candidate=${decision.candidateVariantId} winner=${decision.winner} confidence=${(decision.confidence || 0).toFixed(2)}`
        );
      }
    }
    if (summary[0]) {
      console.log(`\nWinner: ${summary[0].variantId} (${summary[0].label})`);
    }
    console.log(`Report saved: ${outPath}`);
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
