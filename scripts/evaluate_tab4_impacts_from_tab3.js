const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { judgeChapterQuality, judgePairwiseQuality } = require('./quality_judge');

const APP_URL = 'http://localhost:8080/NovelWriter/NovelWriter.html';
const API_KEY = process.env.XAI_API_KEY || '';
if (!API_KEY) {
  console.error('Missing XAI_API_KEY environment variable.');
  process.exit(1);
}

const RUNS_PER_VARIANT = 2;
const ENABLE_PAIRWISE = process.env.QUALITY_PAIRWISE === '1';

const VARIANTS = [
  { id: 'baseline', label: 'Baseline Tab 3 prompt', tab3Prompt: null },
  {
    id: 'variant_b_character_pressure',
    label: 'Improved Tab 3 prompt (character-pressure)',
    tab3Prompt:
      'You are a developmental editor designing subplots that pressure and evolve character arcs. Each subplot must create distinct emotional and practical conflict, force decisions, and generate downstream consequences that can be refined into character arc updates. Keep subplots specific, non-redundant, and tightly integrated with main plot stakes.',
  },
];

function avg(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
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
    `Story Arc: ${row.storyArc || 'N/A'}`,
    `Plot: ${row.generalPlot || 'N/A'}`,
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
    // Ignore if indicator never visibly appeared.
  }
  await page.waitForFunction(
    () => {
      const indicators = document.querySelectorAll('.loading-indicator');
      return Array.from(indicators).every((el) => {
        const style = window.getComputedStyle(el);
        const hiddenByDisplay = style.display === 'none';
        const hiddenByVisibility = style.visibility === 'hidden';
        const hiddenByLayout = el.offsetParent === null;
        return hiddenByDisplay || hiddenByVisibility || hiddenByLayout;
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

  await page.fill('#title', `Tab4ImpactEval ${new Date().toISOString()} #${runIndex}`);
  await page.fill('#storyArc', 'A covert resistance learns the empire is using predictive simulations to pre-empt rebellion and must break the model before the model breaks them.');
  await page.fill('#generalPlot', 'A data-forger, a disillusioned strategist, and a systems monk infiltrate a simulation archive, triggering a city-wide trust collapse and moral crisis over who controls truth.');
  await page.fill('#setting', 'A layered orbital city where neighborhoods are governed by competing prediction engines and citizens trade in verified memory shards.');

  await page.fill('#numChapters', '2');
  await page.dispatchEvent('#numChapters', 'change');
  await page.fill('#chapterLength', '1200');
  await page.dispatchEvent('#chapterLength', 'change');

  await gotoTab(page, 2);
  await page.fill('#numCharacters', '2');
  await page.dispatchEvent('#numCharacters', 'change');
  await page.click('button:has-text("Suggest Characters")');
  await waitForLLM(page);
}

async function getCharacterArcLengths(page) {
  return await page.$$eval('#characterList .charArc', (els) =>
    els.map((el) => (el.value || '').trim().length)
  );
}

async function runVariant(page, variant, baselinePrompt) {
  const promptToUse = variant.tab3Prompt || baselinePrompt;
  await page.evaluate((promptValue) => {
    if (typeof promptCatalog === 'undefined' || !promptCatalog?.tab3?.suggestSubplots) {
      throw new Error('promptCatalog.tab3.suggestSubplots not found');
    }
    promptCatalog.tab3.suggestSubplots.systemPrompt = promptValue;
  }, promptToUse);

  await gotoTab(page, 2);
  const arcBefore = await getCharacterArcLengths(page);

  await gotoTab(page, 3);
  await page.fill('#minSubplots', '2');
  await page.dispatchEvent('#minSubplots', 'change');

  const tSubplots = Date.now();
  await page.click('button:has-text("AI Suggest Subplots")');
  await waitForLLM(page);
  const subplotsMs = Date.now() - tSubplots;

  await gotoTab(page, 2);
  const tRefine = Date.now();
  await page.click('button:has-text("Refine Characters with Subplots")');
  await waitForLLM(page);
  const refineMs = Date.now() - tRefine;
  const arcAfter = await getCharacterArcLengths(page);

  await gotoTab(page, 4);
  await page.evaluate(() => showChapterSubpage(1));
  const tOutline = Date.now();
  await page.click('#chapterOutline1 button:has-text("Generate Chapter Outline & Arc")');
  await waitForLLM(page);
  const outlineMs = Date.now() - tOutline;

  await gotoTab(page, 5);
  await page.evaluate(() => showGenChapterSubpage(1));
  const tChapter = Date.now();
  await page.click('#chapterGen1 button:has-text("Generate Chapter")');
  await waitForLLM(page, 900000);
  const chapterMs = Date.now() - tChapter;

  const tAudit = Date.now();
  const auditResult = await page.evaluate(async () => {
    if (!window.runChapterContinuityAudit) {
      return { error: 'runChapterContinuityAudit not available' };
    }
    try {
      const result = await window.runChapterContinuityAudit(1, { silent: true });
      await new Promise(resolve => setTimeout(resolve, 500));
      const chapterAudit = window.novelData?.continuityTracker?.chapters?.[0] || null;
      return { success: true, audit: chapterAudit, directAudit: result || null };
    } catch (e) {
      return { error: e.message };
    }
  });
  await waitForLLM(page, 300000);
  const auditMs = Date.now() - tAudit;

  const result = await page.evaluate((capturedAudit) => {
    const chapterFromModel = (window.novelData?.chapters?.[0] || '').trim();
    const chapterFromTextarea = (document.getElementById('chapterGenContent1')?.value || '').trim();
    const chapterText = chapterFromModel || chapterFromTextarea;
    const chapterAudit = window.novelData?.continuityTracker?.chapters?.[0] || null;
    const auditPayload = chapterAudit || capturedAudit?.directAudit || capturedAudit?.audit || null;
    const subplots = (window.novelData?.subplots || []).filter(Boolean);
    const requestStatus = window.requestLog?.status || '';

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
      continuityRisksCount: Array.isArray(auditPayload?.continuityRisks) ? auditPayload.continuityRisks.length : 0,
      unresolvedThreadsCount: Array.isArray(auditPayload?.unresolvedThreads) ? auditPayload.unresolvedThreads.length : 0,
      recommendedFixesCount: Array.isArray(auditPayload?.recommendedFixes) ? auditPayload.recommendedFixes.length : 0,
      storyArcRiskLevel: auditPayload?.storyArcProgress?.riskLevel || 'unknown',
      auditGenerated: !!auditPayload,
      requestStatus,
      subplotsCount: subplots.length,
      subplots,
      continuityAudit: auditPayload,
      auditSummary: auditPayload?.chapterSummary || '',
    };
  }, auditResult);

  if (auditResult.error) {
    console.warn(`[audit] Chapter 1 audit failed: ${auditResult.error}`);
  } else if (auditResult.success) {
    console.log(`[audit] Chapter 1 audit captured: ${auditResult.audit ? 'success' : 'null'}`);
  }

  const arcAvgBefore = avg(arcBefore);
  const arcAvgAfter = avg(arcAfter);
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
    arcGrowth: arcAvgAfter - arcAvgBefore,
    ...result,
    quality,
    latencyMs: {
      tab3SuggestSubplots: subplotsMs,
      tab2RefineCharacters: refineMs,
      tab4GenerateOutline: outlineMs,
      tab5GenerateChapter: chapterMs,
      tab5ContinuityAudit: auditMs,
      total: subplotsMs + refineMs + outlineMs + chapterMs + auditMs,
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
      avgArcGrowth: a((x) => x.arcGrowth),
      avgChapterWords: a((x) => x.chapterWords),
      avgChapterChars: a((x) => x.chapterChars),
      chapterGenerationSuccessRate: a((x) => (x.chapterGenerated ? 1 : 0)),
      auditGenerationSuccessRate: a((x) => (x.auditGenerated ? 1 : 0)),
      avgContinuityRisks: a((x) => x.continuityRisksCount),
      avgUnresolvedThreads: a((x) => x.unresolvedThreadsCount),
      avgRecommendedFixes: a((x) => x.recommendedFixesCount),
      avgStoryArcRiskScore: a((x) => riskLevelToScore(x.storyArcRiskLevel)),
      avgLatencyMs: a((x) => x.latencyMs.total),
    });
  }

  summary.sort((x, y) => {
    if (y.chapterGenerationSuccessRate !== x.chapterGenerationSuccessRate) {
      return y.chapterGenerationSuccessRate - x.chapterGenerationSuccessRate;
    }
    if (y.auditGenerationSuccessRate !== x.auditGenerationSuccessRate) {
      return y.auditGenerationSuccessRate - x.auditGenerationSuccessRate;
    }
    if (y.avgQualityOverall !== x.avgQualityOverall) {
      return y.avgQualityOverall - x.avgQualityOverall;
    }
    if (y.avgQualityContinuityIntegrity !== x.avgQualityContinuityIntegrity) {
      return y.avgQualityContinuityIntegrity - x.avgQualityContinuityIntegrity;
    }
    if (x.avgContinuityRisks !== y.avgContinuityRisks) return x.avgContinuityRisks - y.avgContinuityRisks;
    if (x.avgStoryArcRiskScore !== y.avgStoryArcRiskScore) return x.avgStoryArcRiskScore - y.avgStoryArcRiskScore;
    if (y.avgArcGrowth !== x.avgArcGrowth) return y.avgArcGrowth - x.avgArcGrowth;
    if (y.avgChapterWords !== x.avgChapterWords) return y.avgChapterWords - x.avgChapterWords;
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
      return promptCatalog?.tab3?.suggestSubplots?.systemPrompt || '';
    });
    if (!baselinePrompt) throw new Error('Unable to read baseline Tab 3 prompt');

    const rows = [];
    for (const variant of VARIANTS) {
      for (let i = 1; i <= RUNS_PER_VARIANT; i++) {
        await seedBaseState(page, i);
        const row = await runVariant(page, variant, baselinePrompt);
        row.run = i;
        rows.push(row);

        console.log(
          `[run] ${variant.id} #${i} risks=${row.continuityRisksCount} storyRisk=${row.storyArcRiskLevel} ` +
            `quality=${row.quality?.overallScore || 0} arcGrowth=${row.arcGrowth.toFixed(1)} words=${row.chapterWords} generated=${row.chapterGenerated} ` +
            `audit=${row.auditGenerated} status=${row.requestStatus} latency=${row.latencyMs.total}ms`
        );
      }
    }

    const summary = summarize(rows);
    let pairwise = [];
    if (ENABLE_PAIRWISE) {
      const baselineRows = rows.filter((r) => r.variantId === 'baseline');
      const candidateRows = rows.filter((r) => r.variantId !== 'baseline');
      for (const candidate of candidateRows) {
        const baseline = baselineRows.find((b) => b.run === candidate.run);
        if (!baseline) continue;
        const decision = await judgePairwiseQuality({
          apiKey: API_KEY,
          artifactType: 'tab4_tab5_chapter_output',
          context: {
            run: candidate.run,
            title: candidate.title,
            genre: candidate.genre,
          },
          baselineArtifact: buildPairwiseArtifact(baseline),
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
        purpose: 'Validate Tab 4/5 downstream impact from improved Tab 3 subplot prompt with quality-first scoring',
        comparedVariants: VARIANTS.map((x) => ({ id: x.id, label: x.label })),
        runsPerVariant: RUNS_PER_VARIANT,
        rankingMethod: 'Quality-first with proxies as supporting evidence',
        pairwiseEnabled: ENABLE_PAIRWISE,
      },
      results: rows,
      pairwise,
      summary,
      winner: summary[0] || null,
    };

    const outDir = path.join(process.cwd(), 'test-results');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `tab4-impact-from-tab3-${Date.now()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');

    console.log('\n=== Tab 4/5 Downstream Impact Summary ===');
    for (const s of summary) {
      console.log(
        `${s.variantId.padEnd(30)} quality=${s.avgQualityOverall.toFixed(2)} genRate=${s.chapterGenerationSuccessRate.toFixed(2)} auditRate=${s.auditGenerationSuccessRate.toFixed(2)} ` +
          `risks=${s.avgContinuityRisks.toFixed(2)} storyRiskScore=${s.avgStoryArcRiskScore.toFixed(2)} ` +
          `arcGrowth=${Math.round(s.avgArcGrowth)} words=${Math.round(s.avgChapterWords)} latency=${Math.round(s.avgLatencyMs)}ms`
      );
    }
    if (summary[0]) {
      console.log(`\nWinner: ${summary[0].variantId} (${summary[0].label})`);
    }
    if (pairwise.length) {
      console.log('\n=== Pairwise Quality Decisions ===');
      for (const p of pairwise) {
        console.log(
          `run=${p.run} candidate=${p.candidateVariantId} winner=${p.winner} confidence=${(p.confidence || 0).toFixed(2)}`
        );
      }
    }
    console.log(`Report saved: ${outPath}`);
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
