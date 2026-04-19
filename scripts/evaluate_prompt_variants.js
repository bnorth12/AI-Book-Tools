const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { judgeArtifactQuality } = require('./quality_judge');

const APP_URL = 'http://localhost:8080/NovelWriter/NovelWriter.html';
const API_KEY = process.env.XAI_API_KEY || '';

if (!API_KEY) {
  console.error('Missing XAI_API_KEY environment variable.');
  process.exit(1);
}

const VARIANTS = [
  {
    id: 'baseline',
    label: 'Baseline current prompt',
    // prompt pulled from app at runtime
    prompt: null,
  },
  {
    id: 'variant_a_structured',
    label: 'Structured + strict completion',
    prompt:
      'You are a senior novel development editor. Your job is to generate complete, production-ready story bootstrap fields for title, story arc, general plot, setting, and style guide. Priorities: (1) fill every required field, (2) maintain internal consistency, (3) provide concrete narrative hooks and stakes, (4) avoid vague placeholders. Prefer explicit causality, chapter-scalable conflicts, and thematic coherence. Return clean JSON-compatible content with no meta commentary.',
  },
  {
    id: 'variant_b_creative_guardrails',
    label: 'Creative richness + guardrails',
    prompt:
      'You are a creative director for long-form fiction. Generate vivid, specific, and marketable story foundations while preserving structural discipline. Ensure each output field is fully populated and mutually consistent. Story Arc should define transformation and stakes; General Plot should map escalating causality across chapters; Setting should shape character pressure and conflict; Style Guide should be actionable for drafting voice and pacing. Never leave required fields empty and avoid generic phrasing.',
  },
];

const RUNS_PER_VARIANT = 2;

function extractTokenCount(tokenUsageText) {
  const m = String(tokenUsageText || '').match(/(\d+)\s+tokens/i);
  return m ? Number(m[1]) : null;
}

async function waitForLLM(page, timeoutMs = 240000) {
  try {
    await page.locator('.loading-indicator:visible').first().waitFor({ state: 'visible', timeout: 5000 });
  } catch {
    // indicator may already be hidden; continue with settle wait
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
  await page.waitForTimeout(300);
}

async function seedBaseState(page, runIndex) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.fill('#apiKey', API_KEY);
  await page.selectOption('#genre', 'scifi');
  await page.dispatchEvent('#genre', 'change');
  await page.selectOption('#authorStyle', 'nealstephenson');
  await page.dispatchEvent('#authorStyle', 'change');
  await page.fill('#title', `VariantEval ${new Date().toISOString()} #${runIndex}`);
  await page.fill('#numChapters', '3');
  await page.dispatchEvent('#numChapters', 'change');
  await page.fill('#storyArc', '');
  await page.fill('#generalPlot', '');
  await page.fill('#setting', '');
}

async function runVariant(page, variant, baselinePrompt) {
  const promptToUse = variant.prompt || baselinePrompt;
  await page.evaluate((promptValue) => {
    if (typeof promptCatalog === 'undefined' || !promptCatalog?.tab1?.suggestStoryInfo) {
      throw new Error('promptCatalog.tab1.suggestStoryInfo not found');
    }
    promptCatalog.tab1.suggestStoryInfo.systemPrompt = promptValue;
  }, promptToUse);

  const started = Date.now();
  await page.click('button:has-text("AI Suggest Story Info")');
  await waitForLLM(page);
  const elapsedMs = Date.now() - started;

  const storyArc = await page.inputValue('#storyArc');
  const generalPlot = await page.inputValue('#generalPlot');
  const setting = await page.inputValue('#setting');
  const styleGuide = await page.inputValue('#styleGuide');

  await page.click('#nav button:has-text("9.")');
  await page.waitForTimeout(200);
  const requestStatus = await page.textContent('#requestStatus');
  const tokenUsage = await page.textContent('#tokenUsage');

  const nonEmptyCount = [storyArc, generalPlot, setting].filter((v) => String(v || '').trim().length > 0).length;
  const quality = await judgeArtifactQuality({
    apiKey: API_KEY,
    variantId: variant.id,
    artifactType: 'tab1_story_bootstrap',
    context: {
      genre: await page.inputValue('#genre').catch(() => 'unknown'),
      authorStyle: await page.inputValue('#authorStyle').catch(() => 'unknown'),
      requestStatus: String(requestStatus || '').trim(),
    },
    artifactText: [
      `Story Arc:\n${storyArc}`,
      `General Plot:\n${generalPlot}`,
      `Setting:\n${setting}`,
      `Style Guide:\n${styleGuide}`,
    ].join('\n\n'),
  });

  return {
    variantId: variant.id,
    variantLabel: variant.label,
    elapsedMs,
    requestStatus: String(requestStatus || '').trim(),
    tokenUsageText: String(tokenUsage || '').trim(),
    tokenCount: extractTokenCount(tokenUsage),
    storyArcLen: storyArc.trim().length,
    generalPlotLen: generalPlot.trim().length,
    settingLen: setting.trim().length,
    styleGuideLen: styleGuide.trim().length,
    completeness: nonEmptyCount / 3,
    success: nonEmptyCount === 3,
    quality,
  };
}

function summarize(results) {
  const byVariant = new Map();
  for (const r of results) {
    if (!byVariant.has(r.variantId)) byVariant.set(r.variantId, []);
    byVariant.get(r.variantId).push(r);
  }

  const summary = [];
  for (const [variantId, rows] of byVariant.entries()) {
    const avg = (vals) => {
      const nums = vals.filter((v) => typeof v === 'number' && !Number.isNaN(v));
      if (!nums.length) return null;
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    };

    const successRate = rows.filter((r) => r.success).length / rows.length;
    summary.push({
      variantId,
      label: rows[0].variantLabel,
      runs: rows.length,
      avgQualityOverall: avg(rows.map((r) => r.quality?.overallScore || 0)),
      successRate,
      avgCompleteness: avg(rows.map((r) => r.completeness)),
      avgElapsedMs: avg(rows.map((r) => r.elapsedMs)),
      avgTokenCount: avg(rows.map((r) => r.tokenCount)),
      avgStoryArcLen: avg(rows.map((r) => r.storyArcLen)),
      avgGeneralPlotLen: avg(rows.map((r) => r.generalPlotLen)),
      avgSettingLen: avg(rows.map((r) => r.settingLen)),
      avgStyleGuideLen: avg(rows.map((r) => r.styleGuideLen)),
    });
  }

  summary.sort((a, b) => {
    if ((b.avgQualityOverall || 0) !== (a.avgQualityOverall || 0)) return (b.avgQualityOverall || 0) - (a.avgQualityOverall || 0);
    if (b.successRate !== a.successRate) return b.successRate - a.successRate;
    if ((b.avgCompleteness || 0) !== (a.avgCompleteness || 0)) return (b.avgCompleteness || 0) - (a.avgCompleteness || 0);
    return (a.avgElapsedMs || Infinity) - (b.avgElapsedMs || Infinity);
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
      return promptCatalog?.tab1?.suggestStoryInfo?.systemPrompt || '';
    });
    if (!baselinePrompt) throw new Error('Unable to read baseline prompt from promptCatalog.tab1.suggestStoryInfo');

    const results = [];
    for (const variant of VARIANTS) {
      for (let i = 1; i <= RUNS_PER_VARIANT; i++) {
        await seedBaseState(page, i);
        const row = await runVariant(page, variant, baselinePrompt);
        row.run = i;
        results.push(row);
        console.log(`[run] ${variant.id} #${i} -> success=${row.success} completeness=${row.completeness.toFixed(2)} elapsed=${row.elapsedMs}ms tokens=${row.tokenCount ?? 'n/a'}`);
        console.log(`[quality] ${variant.id} #${i} -> overall=${row.quality?.overallScore || 0} verdict=${row.quality?.verdict || 'n/a'}`);
      }
    }

    const summary = summarize(results);

    const out = {
      generatedAt: new Date().toISOString(),
      scope: {
        agent: 'tab1.suggestStoryInfo',
        runsPerVariant: RUNS_PER_VARIANT,
        variants: VARIANTS.map((v) => ({ id: v.id, label: v.label })),
        rankingMethod: 'quality-first (proxies are secondary)',
      },
      results,
      summary,
      winner: summary[0] || null,
    };

    const outDir = path.join(process.cwd(), 'test-results');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `prompt-variant-eval-${Date.now()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');

    console.log('\n=== Prompt Variant Summary (tab1.suggestStoryInfo) ===');
    for (const s of summary) {
      console.log(
        `${s.variantId.padEnd(22)} quality=${(s.avgQualityOverall ?? 0).toFixed(2)} success=${(s.successRate * 100).toFixed(0)}% ` +
          `comp=${(s.avgCompleteness ?? 0).toFixed(2)} ` +
          `elapsed=${Math.round(s.avgElapsedMs ?? 0)}ms ` +
          `tokens=${s.avgTokenCount ? Math.round(s.avgTokenCount) : 'n/a'} ` +
          `lens[arc/plot/set]=${Math.round(s.avgStoryArcLen ?? 0)}/${Math.round(s.avgGeneralPlotLen ?? 0)}/${Math.round(s.avgSettingLen ?? 0)}`
      );
    }
    if (summary[0]) {
      console.log(`\nWinner: ${summary[0].variantId} (${summary[0].label})`);
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
