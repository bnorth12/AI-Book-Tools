const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const APP_URL = 'http://localhost:8080/NovelWriter/NovelWriter.html';
const API_KEY = process.env.XAI_API_KEY || '';
if (!API_KEY) {
  console.error('Missing XAI_API_KEY environment variable.');
  process.exit(1);
}

const RUNS_PER_VARIANT = 1;

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
  await page.waitForTimeout(400);
}

async function gotoTab(page, n) {
  await page.click(`#nav button:has-text("${n}.")`);
  await page.waitForTimeout(300);
}

async function seedWithGeneratedChapter(page, runIndex) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.fill('#apiKey', API_KEY);

  await page.selectOption('#genre', 'scifi');
  await page.dispatchEvent('#genre', 'change');
  await page.selectOption('#authorStyle', 'nealstephenson');
  await page.dispatchEvent('#authorStyle', 'change');

  await page.fill('#title', `Tab5AuditEval ${new Date().toISOString()} #${runIndex}`);
  await page.fill('#storyArc', 'A resistance discovers predictive simulations control policy and must break the algorithm.');
  await page.fill('#generalPlot', 'A data specialist infiltrates an archive with a strategist and a systems monk.');
  await page.fill('#setting', 'Layered orbital city with competing prediction engines.');

  await page.fill('#numChapters', '1');
  await page.dispatchEvent('#numChapters', 'change');
  await page.fill('#chapterLength', '1000');
  await page.fill('#chapterLength', '600');
  await page.dispatchEvent('#chapterLength', 'change');

  // Tab 2: Generate characters
  await gotoTab(page, 2);
  await page.fill('#numCharacters', '2');
  await page.dispatchEvent('#numCharacters', 'change');
  await page.click('button:has-text("Suggest Characters")');
  await waitForLLM(page);

  // Tab 3: Suggest subplots
  await gotoTab(page, 3);
  await page.fill('#minSubplots', '2');
  await page.dispatchEvent('#minSubplots', 'change');
  await page.click('button:has-text("AI Suggest Subplots")');
  await waitForLLM(page);

  // Tab 4: Generate outline
  await gotoTab(page, 4);
  await page.evaluate(() => showChapterSubpage(1));
  await page.click('#chapterOutline1 button:has-text("Generate Chapter Outline & Arc")');
  await waitForLLM(page);

  // Tab 5: Generate chapter
  await gotoTab(page, 5);
  await page.evaluate(() => showGenChapterSubpage(1));
  await page.click('#chapterGen1 button:has-text("Generate Chapter")');
  await waitForLLM(page, 900000);

  // Ensure data is in place
  await page.waitForTimeout(1000);
  const chapterData = await page.evaluate(() => {
    return {
      modelText: (window.novelData?.chapters?.[0] || '').trim(),
      textareaText: (document.getElementById('chapterGenContent1')?.value || '').trim(),
      status: window.requestLog?.status || '',
    };
  });

  const finalText = chapterData.modelText || chapterData.textareaText;
  if (finalText.length < 50) {
    console.warn(`Chapter generation returned short content (${finalText.length} chars). Status: ${chapterData.status}`);
    throw new Error(`Chapter generation failed: ${finalText.length} chars, status=${chapterData.status}`);
  }
}

async function runAuditForVariant(page, variant, baselinePrompt) {
  const promptToUse = variant.tab3Prompt || baselinePrompt;

  // Set Tab 3 prompt before running chapter generation
  await page.evaluate((promptValue) => {
    if (typeof promptCatalog === 'undefined' || !promptCatalog?.tab3?.suggestSubplots) {
      throw new Error('promptCatalog.tab3.suggestSubplots not found');
    }
    promptCatalog.tab3.suggestSubplots.systemPrompt = promptValue;
  }, promptToUse);

  const tAudit = Date.now();
  const auditResult = await page.evaluate(async () => {
    if (typeof runChapterContinuityAudit !== 'function') {
      throw new Error('runChapterContinuityAudit not available');
    }
    const result = await window.runChapterContinuityAudit(1, { silent: true });
    await new Promise(r => setTimeout(r, 600));
    return result;
  });
  await waitForLLM(page, 300000);
  const auditMs = Date.now() - tAudit;

  const chapterLength = await page.evaluate(() => (window.novelData?.chapters?.[0] || '').length);

  // Use audit function return value directly
  const auditData = auditResult || {};
  return {
    variantId: variant.id,
    variantLabel: variant.label,
    riskCount: Array.isArray(auditData?.continuityRisks) ? auditData.continuityRisks.length : 0,
    risksDetail: Array.isArray(auditData?.continuityRisks) ? auditData.continuityRisks : [],
    unresolvedCount: Array.isArray(auditData?.unresolvedThreads) ? auditData.unresolvedThreads.length : 0,
    fixCount: Array.isArray(auditData?.recommendedFixes) ? auditData.recommendedFixes.length : 0,
    storyArcRiskLevel: auditData?.storyArcProgress?.riskLevel || 'unknown',
    storyArcRiskScore: riskLevelToScore(auditData?.storyArcProgress?.riskLevel),
    charArcRisks: Array.isArray(auditData?.characterArcProgress)
      ? auditData.characterArcProgress.map((c) => ({ name: c.name, risk: c.risk }))
      : [],
    chapterLength,
    auditLatencyMs: auditMs,
    auditGenerated: !!auditData?.chapter,
    auditSummary: (auditData?.chapterSummary || '').slice(0, 150),
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
      auditSuccessRate: a((x) => (x.auditGenerated ? 1 : 0)),
      avgRiskCount: a((x) => x.riskCount),
      avgUnresolvedCount: a((x) => x.unresolvedCount),
      avgFixCount: a((x) => x.fixCount),
      avgStoryArcRiskScore: a((x) => x.storyArcRiskScore),
      avgChapterLength: a((x) => x.chapterLength),
      avgAuditLatencyMs: a((x) => x.auditLatencyMs),
    });
  }

  summary.sort((x, y) => {
    if (y.auditSuccessRate !== x.auditSuccessRate) return y.auditSuccessRate - x.auditSuccessRate;
    if (x.avgRiskCount !== y.avgRiskCount) return x.avgRiskCount - y.avgRiskCount;
    if (x.avgStoryArcRiskScore !== y.avgStoryArcRiskScore) return x.avgStoryArcRiskScore - y.avgStoryArcRiskScore;
    return x.avgAuditLatencyMs - y.avgAuditLatencyMs;
  });

  return summary;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Fetching baseline Tab 3 prompt...');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    const baselinePrompt = await page.evaluate(() => {
      if (typeof promptCatalog === 'undefined') return '';
      return promptCatalog?.tab3?.suggestSubplots?.systemPrompt || '';
    });
    if (!baselinePrompt) throw new Error('Unable to read baseline Tab 3 prompt');

    const rows = [];
    for (const variant of VARIANTS) {
      for (let i = 1; i <= RUNS_PER_VARIANT; i++) {
        console.log(`\n[init] Seeding variant ${variant.id} run ${i}...`);
        await seedWithGeneratedChapter(page, i);

        console.log(`[audit] Running audit for ${variant.id} run ${i}...`);
        const row = await runAuditForVariant(page, variant, baselinePrompt);
        row.run = i;
        rows.push(row);

        console.log(
          `[run] ${variant.id} #${i} auditGen=${row.auditGenerated} risks=${row.riskCount} ` +
            `unresolved=${row.unresolvedCount} fixes=${row.fixCount} ` +
            `storyRisk=${row.storyArcRiskLevel} latency=${row.auditLatencyMs}ms`
        );
      }
    }

    const summary = summarize(rows);
    const out = {
      generatedAt: new Date().toISOString(),
      scope: {
        purpose: 'Focused Tab 5 continuity-audit evaluation: validate downstream quality from improved Tab 3 subplot prompt',
        comparedVariants: VARIANTS.map((x) => ({ id: x.id, label: x.label })),
        runsPerVariant: RUNS_PER_VARIANT,
        methodology: 'Generate full workflow (Tab2->Tab3->Tab4->Tab5 chapter) then explicitly audit Chapter 1 and measure continuity detection quality',
      },
      results: rows,
      summary,
      winner: summary[0] || null,
    };

    const outDir = path.join(process.cwd(), 'test-results');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `tab5-audit-quality-from-tab3-${Date.now()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');

    console.log('\n=== Tab 5 Continuity Audit Quality Summary ===');
    for (const s of summary) {
      console.log(
        `${s.variantId.padEnd(30)} auditRate=${s.auditSuccessRate.toFixed(2)} ` +
          `risks=${s.avgRiskCount.toFixed(1)} unresolved=${s.avgUnresolvedCount.toFixed(1)} ` +
          `fixes=${s.avgFixCount.toFixed(1)} storyRiskScore=${s.avgStoryArcRiskScore.toFixed(2)} ` +
          `latency=${Math.round(s.avgAuditLatencyMs)}ms`
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
  console.error('Fatal error:', err);
  process.exit(1);
});
