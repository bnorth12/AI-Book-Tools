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

const RUNS_PER_VARIANT = 3;

const VARIANTS = [
  { id: 'baseline', label: 'Baseline current prompt', prompt: null },
  {
    id: 'variant_a_structured',
    label: 'Structured subplot planner',
    prompt:
      'You are a subplot systems planner for long-form fiction. Create subplots that explicitly connect to story arc, character motivations, and chapter progression. Prioritize causal clarity, thematic relevance, and actionable chapter-level beats. Avoid generic subplot phrasing and ensure each subplot has concrete tension and payoff potential.',
  },
  {
    id: 'variant_b_character_pressure',
    label: 'Character-pressure subplot design',
    prompt:
      'You are a developmental editor designing subplots that pressure and evolve character arcs. Each subplot must create distinct emotional and practical conflict, force decisions, and generate downstream consequences that can be refined into character arc updates. Keep subplots specific, non-redundant, and tightly integrated with main plot stakes.',
  },
];

async function waitForLLM(page, timeoutMs = 300000) {
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

async function gotoTab(page, n) {
  await page.click(`#nav button:has-text("${n}.")`);
  await page.waitForTimeout(250);
}

function avg(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

async function seedBaseState(page, runIndex) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.fill('#apiKey', API_KEY);
  await page.selectOption('#genre', 'scifi');
  await page.dispatchEvent('#genre', 'change');
  await page.selectOption('#authorStyle', 'nealstephenson');
  await page.dispatchEvent('#authorStyle', 'change');
  await page.fill('#title', `LoopEval ${new Date().toISOString()} #${runIndex}`);
  await page.fill('#numChapters', '3');
  await page.dispatchEvent('#numChapters', 'change');

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

async function getSubplots(page) {
  return await page.$$eval('#subplotList .subplot', (els) =>
    els.map((el) => (el.value || '').trim()).filter(Boolean)
  );
}

function overlapRatio(a, b) {
  const setA = new Set(a.map((x) => x.slice(0, 120)));
  const setB = new Set(b.map((x) => x.slice(0, 120)));
  if (setA.size === 0 && setB.size === 0) return 1;
  const inter = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size || 1;
  return inter / union;
}

async function runVariant(page, variant, baselinePrompt) {
  const promptToUse = variant.prompt || baselinePrompt;
  await page.evaluate((promptValue) => {
    if (typeof promptCatalog === 'undefined' || !promptCatalog?.tab3?.suggestSubplots) {
      throw new Error('promptCatalog.tab3.suggestSubplots not found');
    }
    promptCatalog.tab3.suggestSubplots.systemPrompt = promptValue;
  }, promptToUse);

  await gotoTab(page, 2);
  const beforeArcLens = await getCharacterArcLengths(page);

  await gotoTab(page, 3);
  await page.fill('#minSubplots', '2');
  await page.dispatchEvent('#minSubplots', 'change');

  const t1 = Date.now();
  await page.click('button:has-text("AI Suggest Subplots")');
  await waitForLLM(page);
  const subplotPass1Ms = Date.now() - t1;
  const subplotsFirst = await getSubplots(page);

  await gotoTab(page, 2);
  const t2 = Date.now();
  await page.click('button:has-text("Refine Characters with Subplots")');
  await waitForLLM(page);
  const refineMs = Date.now() - t2;
  const afterArcLens = await getCharacterArcLengths(page);

  await gotoTab(page, 3);
  const t3 = Date.now();
  await page.click('button:has-text("AI Suggest Subplots")');
  await waitForLLM(page);
  const subplotPass2Ms = Date.now() - t3;
  const subplotsSecond = await getSubplots(page);

  const arcCoverage = afterArcLens.filter((n) => n > 100).length / Math.max(1, afterArcLens.length);
  const arcAvgBefore = avg(beforeArcLens);
  const arcAvgAfter = avg(afterArcLens);
  const subplotAvgLen1 = avg(subplotsFirst.map((s) => s.length));
  const subplotAvgLen2 = avg(subplotsSecond.map((s) => s.length));
  const stability = overlapRatio(subplotsFirst, subplotsSecond);
  const quality = await judgeArtifactQuality({
    apiKey: API_KEY,
    variantId: variant.id,
    artifactType: 'tab3_tab2_feedback_loop',
    context: {
      arcAvgBefore,
      arcAvgAfter,
      arcGrowth: arcAvgAfter - arcAvgBefore,
      subplotStability: stability,
    },
    artifactText: [
      `Subplots pass 1:\n${subplotsFirst.join('\n- ')}`,
      `Subplots pass 2:\n${subplotsSecond.join('\n- ')}`,
      `Character arc lengths before: ${JSON.stringify(beforeArcLens)}`,
      `Character arc lengths after: ${JSON.stringify(afterArcLens)}`,
    ].join('\n\n'),
  });

  return {
    variantId: variant.id,
    variantLabel: variant.label,
    arcCoverage,
    arcAvgBefore,
    arcAvgAfter,
    arcGrowth: arcAvgAfter - arcAvgBefore,
    subplotsCount1: subplotsFirst.length,
    subplotsCount2: subplotsSecond.length,
    subplotAvgLen1,
    subplotAvgLen2,
    subplotStability: stability,
    quality,
    latencyMs: {
      suggestSubplotsPass1: subplotPass1Ms,
      refineCharacters: refineMs,
      suggestSubplotsPass2: subplotPass2Ms,
      total: subplotPass1Ms + refineMs + subplotPass2Ms,
    },
  };
}

function summarize(results) {
  const byVariant = new Map();
  for (const r of results) {
    if (!byVariant.has(r.variantId)) byVariant.set(r.variantId, []);
    byVariant.get(r.variantId).push(r);
  }

  const rows = [];
  for (const [variantId, items] of byVariant.entries()) {
    const a = (fn) => avg(items.map(fn));
    rows.push({
      variantId,
      label: items[0].variantLabel,
      runs: items.length,
      avgQualityOverall: a((x) => x.quality?.overallScore || 0),
      avgArcCoverage: a((x) => x.arcCoverage),
      avgArcGrowth: a((x) => x.arcGrowth),
      avgSubplotLen1: a((x) => x.subplotAvgLen1),
      avgSubplotLen2: a((x) => x.subplotAvgLen2),
      avgSubplotStability: a((x) => x.subplotStability),
      avgLatencyMs: a((x) => x.latencyMs.total),
    });
  }

  rows.sort((x, y) => {
    // prioritize loop quality first, then latency
    if (y.avgQualityOverall !== x.avgQualityOverall) return y.avgQualityOverall - x.avgQualityOverall;
    if (y.avgArcCoverage !== x.avgArcCoverage) return y.avgArcCoverage - x.avgArcCoverage;
    if (y.avgArcGrowth !== x.avgArcGrowth) return y.avgArcGrowth - x.avgArcGrowth;
    if (y.avgSubplotStability !== x.avgSubplotStability) return y.avgSubplotStability - x.avgSubplotStability;
    return x.avgLatencyMs - y.avgLatencyMs;
  });

  return rows;
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
    if (!baselinePrompt) throw new Error('Unable to read baseline prompt from promptCatalog.tab3.suggestSubplots');

    const results = [];
    for (const variant of VARIANTS) {
      for (let i = 1; i <= RUNS_PER_VARIANT; i++) {
        await seedBaseState(page, i);
        const row = await runVariant(page, variant, baselinePrompt);
        row.run = i;
        results.push(row);
        console.log(
          `[run] ${variant.id} #${i} quality=${row.quality?.overallScore || 0} arcCoverage=${row.arcCoverage.toFixed(2)} arcGrowth=${row.arcGrowth.toFixed(1)} ` +
            `stability=${row.subplotStability.toFixed(2)} latency=${row.latencyMs.total}ms`
        );
      }
    }

    const summary = summarize(results);
    const out = {
      generatedAt: new Date().toISOString(),
      scope: {
        agent: 'tab3.suggestSubplots -> tab2.refineCharacters loop',
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
    const outPath = path.join(outDir, `prompt-variant-eval-tab3-loop-${Date.now()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');

    console.log('\n=== Prompt Variant Summary (tab3 loop) ===');
    for (const s of summary) {
      console.log(
        `${s.variantId.padEnd(24)} quality=${s.avgQualityOverall.toFixed(2)} arcCov=${s.avgArcCoverage.toFixed(2)} arcGrowth=${Math.round(s.avgArcGrowth)} ` +
          `stability=${s.avgSubplotStability.toFixed(2)} latency=${Math.round(s.avgLatencyMs)}ms`
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
