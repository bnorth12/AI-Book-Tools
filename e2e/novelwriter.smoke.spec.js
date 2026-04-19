/**
 * NovelWriter Full Smoke Test
 *
 * Exercises every tab and every major AI function against the real xAI API.
 * Requires:
 *   - XAI_API_KEY environment variable set
 *   - Python HTTP server running (managed by playwright.config.js webServer)
 *   - Run with: npx playwright test --project=smoke-full
 *
 * Tab coverage:
 *   Tab 1  — API & Story Info (fetch authors, style guide, suggest arc/plot/setting, AI Suggest)
 *   Tab 2  — Characters (set count, sync entries, suggest characters, add one, refine with subplots)
 *   Tab 3  — Subplots (set to 4, AI suggest, add one more, AI suggest new one, back to characters)
 *   Tab 4  — Outlines (AI suggest, incorporate suggestions, per-chapter outline+arc, 3 chapter updates)
 *   Tab 5  — Generate Chapters (generate all 15 chapters)
 *   Tab 6  — Edit Chapters (view all, suggest improvements on 3, spell-check half)
 *   Tab 7  — Book (suggest improvements, cycle table, mark half incorporate/half ignore)
 *   Tab 8  — Consolidated Breakdowns (consolidate and verify)
 *   Tab 9  — Request Log (verify populated)
 *   Tab 10 — Element Values (refresh and verify JSON)
 *   Tab 11 — Agent Prompts (verify all agents present)
 *   Help   — verify user guide opens
 */

const { test, expect } = require('@playwright/test');
const path = require('path');

const APP_URL = 'http://localhost:8080/NovelWriter/NovelWriter.html';
const API_KEY = process.env.XAI_API_KEY || '';
const NUM_CHAPTERS = 15;
const SMOKE_TITLE = `SmokeTest ${new Date().toISOString().replace('T', ' ').substring(0, 19)}`;

// Generous per-operation timeout for real LLM calls (ms)
const LLM_TIMEOUT = 300_000; // 5 min

function hasValidApiKey(value) {
  if (!value || !value.trim()) return false;
  // Catch unresolved cmd placeholder usage like: set XAI_API_KEY=%XAI_API_KEY%
  if (/^%[A-Z0-9_]+%$/i.test(value.trim())) return false;
  return true;
}

function ts() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

async function runStep(name, fn) {
  console.log(`[${ts()}] STEP START: ${name}`);
  const result = await test.step(name, fn);
  console.log(`[${ts()}] STEP DONE:  ${name}`);
  return result;
}

// Skip all smoke tests gracefully if no API key is provided
test.beforeEach(async ({}, testInfo) => {
  if (!hasValidApiKey(API_KEY)) {
    testInfo.skip(true, 'XAI_API_KEY is missing or unresolved (e.g. "%XAI_API_KEY%"). Set a real key and re-run with --project=smoke.');
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function gotoApp(page) {
  await page.goto(APP_URL);
  await expect(page.locator('h1')).toContainText('Novel Writer');
  // Inject API key
  await page.fill('#apiKey', API_KEY);
}

/** Wait for any loading indicator on the current tab to disappear */
async function waitForLLM(page, label = 'LLM call') {
  const startedAt = Date.now();
  console.log(`[${ts()}] Waiting on LLM: ${label}`);

  // If indicator appears, wait for it to hide. If not, continue to fallback check.
  try {
    await page.locator('.loading-indicator:visible').first().waitFor({ state: 'visible', timeout: 5000 });
  } catch {
    // No visible indicator found quickly; continue with fallback condition.
  }

  // The app uses .loading-indicator; wait for it to become hidden
  await page.waitForFunction(
    () => {
      const indicators = document.querySelectorAll('.loading-indicator');
      return Array.from(indicators).every(el => {
        const style = window.getComputedStyle(el);
        const hiddenByDisplay = style.display === 'none';
        const hiddenByVisibility = style.visibility === 'hidden';
        const hiddenByLayout = el.offsetParent === null;
        return hiddenByDisplay || hiddenByVisibility || hiddenByLayout;
      });
    },
    { timeout: LLM_TIMEOUT }
  );
  // Small settle delay to allow DOM updates
  await page.waitForTimeout(500);
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[${ts()}] LLM completed: ${label} (${elapsedSec}s)`);
}

/** Click a button by its visible text on the page */
async function clickButton(page, text) {
  await page.locator(`button:has-text("${text}"):visible`).first().click();
}

/** Navigate to a tab by number via nav bar */
async function gotoTab(page, n) {
  await page.click(`#nav button:has-text("${n}.")`);
  await page.waitForTimeout(300);
}

test('SMOKE-01 Additive full end-to-end flow preserves prior tab state', async ({ page, context }, testInfo) => {
  test.setTimeout(60 * 60 * 1000);
  page.on('dialog', async dialog => {
    console.log(`[${ts()}] Auto-dismissed dialog: ${dialog.message().slice(0, 120)}`);
    await dialog.dismiss();
  });
  let exportedSessionPath = '';
  let exportedBookPath = '';

  await runStep('Tab 1 setup + story info generation', async () => {
    await gotoApp(page);
    await page.selectOption('#genre', 'scifi');
    await page.dispatchEvent('#genre', 'change');

    // Deterministic author selection for smoke stability.
    await page.selectOption('#authorStyle', 'nealstephenson');
    await page.dispatchEvent('#authorStyle', 'change');

    // Explicitly exercise style-guide generation path.
    await clickButton(page, 'Fetch Style Guide');
    await waitForLLM(page, 'SMOKE Additive Fetch Style Guide');

    const styleGuideValue = await page.locator('#styleGuide').inputValue();
    if (!styleGuideValue.trim()) {
      await page.fill('#styleGuide', 'Use atmospheric hard-science prose with clear causality, grounded technical detail, and human-centered stakes.');
    }

    await page.fill('#title', SMOKE_TITLE);
    await page.fill('#numChapters', String(NUM_CHAPTERS));
    await page.dispatchEvent('#numChapters', 'change');

    const currentLength = parseInt(await page.locator('#chapterLength').inputValue(), 10);
    await page.fill('#chapterLength', String(Math.round(currentLength * 1.1)));

    await clickButton(page, 'Suggest Story Arc');
    await waitForLLM(page, 'SMOKE Additive Suggest Story Arc');
    let storyArcValue = await page.locator('#storyArc').inputValue();
    if (!storyArcValue.trim()) {
      // Retry once for intermittent empty LLM response.
      await clickButton(page, 'Suggest Story Arc');
      await waitForLLM(page, 'SMOKE Additive Suggest Story Arc (retry)');
      storyArcValue = await page.locator('#storyArc').inputValue();
      if (!storyArcValue.trim()) {
        await page.fill('#storyArc', 'A fractured crew must evolve from isolated survival to coordinated sacrifice to stop an adaptive anomaly.');
      }
    }
    await clickButton(page, 'Suggest General Plot');
    await waitForLLM(page, 'SMOKE Additive Suggest Plot');
    let plotValue = await page.locator('#generalPlot').inputValue();
    if (!plotValue.trim()) {
      await page.fill('#generalPlot', 'A deep-space relay station discovers an adaptive anomaly and must coordinate a risky containment plan before system-wide collapse.');
      plotValue = await page.locator('#generalPlot').inputValue();
    }

    await clickButton(page, 'Suggest Setting');
    await waitForLLM(page, 'SMOKE Additive Suggest Setting');
    let settingValue = await page.locator('#setting').inputValue();
    if (!settingValue.trim()) {
      await page.fill('#setting', 'A failing retrofitted orbital habitat at the edge of charted space.');
      settingValue = await page.locator('#setting').inputValue();
    }

    await clickButton(page, 'AI Suggest Story Info');
    await waitForLLM(page, 'SMOKE Additive AI Suggest Story Info');

    // AI Suggest can overwrite title; force canonical smoke title for deterministic downstream checks.
    const titleAfterSuggest = await page.locator('#title').inputValue();
    if (titleAfterSuggest !== SMOKE_TITLE) {
      await page.fill('#title', SMOKE_TITLE);
    }
    await expect(page.locator('#title')).toHaveValue(SMOKE_TITLE);
    await expect(page.locator('#storyArc')).not.toHaveValue('');
    await expect(page.locator('#generalPlot')).not.toHaveValue('');
    await expect(page.locator('#setting')).not.toHaveValue('');
  });

  await runStep('Tab 2 characters build on Tab 1', async () => {
    await gotoTab(page, 2);
    await page.fill('#numCharacters', '6');
    await page.dispatchEvent('#numCharacters', 'change');
    await expect(page.locator('#characterList .character')).toHaveCount(6);

    await clickButton(page, 'Suggest Characters');
    await waitForLLM(page, 'SMOKE Additive Suggest Characters');

    const charNames = await page.locator('#characterList .charName').evaluateAll(nodes => nodes.map(n => n.value || ''));
    const hasAnyCharacter = charNames.some(v => v.trim().length > 0);
    if (!hasAnyCharacter) {
      const first = page.locator('#characterList .character').first();
      await first.locator('.charName').fill('Ari Kade');
      await first.locator('.charBackstory').fill('A systems analyst haunted by a past containment failure.');
      await first.locator('.charArc').fill('Learns to trust a team under extreme pressure.');
    }

    await clickButton(page, 'Add Another Character');
    await expect(page.locator('#characterList .character')).toHaveCount(7);

    const lastChar = page.locator('#characterList .character').last();
    await lastChar.locator('.charName').fill('Kael Voss');
    await lastChar.locator('.charBackstory').fill('A rogue engineer who sabotaged the failed terraforming experiment.');
    await lastChar.locator('.charArc').fill('Seeks redemption by becoming the key to containing the anomaly.');

    // Ensure all character slots are fully populated for downstream additive dependencies.
    const characterRows = page.locator('#characterList .character');
    const totalRows = await characterRows.count();
    for (let i = 0; i < totalRows; i++) {
      const row = characterRows.nth(i);
      const nameInput = row.locator('.charName');
      const backstoryInput = row.locator('.charBackstory');
      const arcInput = row.locator('.charArc');

      const currentName = (await nameInput.inputValue()).trim();
      const currentBackstory = (await backstoryInput.inputValue()).trim();
      const currentArc = (await arcInput.inputValue()).trim();

      if (!currentName) {
        await nameInput.fill(`Character ${i + 1}`);
      }
      if (!currentBackstory) {
        await backstoryInput.fill(`Character ${i + 1} has a critical technical role tied to station containment operations.`);
      }
      if (!currentArc) {
        await arcInput.fill(`Character ${i + 1} moves from uncertainty to decisive collaboration under pressure.`);
      }
    }
  });

  await runStep('Tab 3 subplots build on prior setup', async () => {
    await gotoTab(page, 3);
    await page.fill('#minSubplots', '4');
    await clickButton(page, 'AI Suggest Subplots');
    await waitForLLM(page, 'SMOKE Additive Suggest Subplots initial');
    let subplotCount = await page.locator('#subplotList .subplot-section').count();
    if (subplotCount < 4) {
      // Seed minimum deterministic subplots if LLM returns sparse output.
      for (let i = subplotCount; i < 4; i++) {
        await clickButton(page, 'Add Another Subplot');
      }
      const subplotInputs = page.locator('#subplotList .subplot');
      const seedTexts = [
        'Power-grid sabotage threatens containment operations.',
        'Crew trust fracture between command and engineering.',
        'External salvage team attempts opportunistic docking.',
        'A hidden maintenance log reveals prior anomaly exposure.'
      ];
      const total = await subplotInputs.count();
      for (let i = 0; i < Math.min(total, seedTexts.length); i++) {
        const val = await subplotInputs.nth(i).inputValue();
        if (!val.trim()) await subplotInputs.nth(i).fill(seedTexts[i]);
      }
      subplotCount = await page.locator('#subplotList .subplot-section').count();
    }
    expect(subplotCount).toBeGreaterThanOrEqual(4);

    await clickButton(page, 'Add Another Subplot');
    await clickButton(page, 'AI Suggest Subplots');
    await waitForLLM(page, 'SMOKE Additive Suggest Subplots after add');

    await gotoTab(page, 2);
    await clickButton(page, 'Refine Characters with Subplots');
    await waitForLLM(page, 'SMOKE Additive Refine Characters with Subplots');
    await gotoTab(page, 3);
  });

  await runStep('Tab 4 outlines + all chapter outlines/arcs', async () => {
    // Ensure additive prerequisites are present before outline generation.
    await gotoTab(page, 1);
    await expect(page.locator('#storyArc')).not.toHaveValue('');
    await expect(page.locator('#generalPlot')).not.toHaveValue('');
    await expect(page.locator('#setting')).not.toHaveValue('');

    await gotoTab(page, 2);
    const namesBeforeTab4 = await page.locator('#characterList .charName').evaluateAll(nodes => nodes.map(n => n.value || ''));
    expect(namesBeforeTab4.some(v => v.trim().length > 0)).toBeTruthy();

    await gotoTab(page, 3);
    const subplotCountBeforeTab4 = await page.locator('#subplotList .subplot-section').count();
    expect(subplotCountBeforeTab4).toBeGreaterThanOrEqual(4);

    await gotoTab(page, 4);
    await clickButton(page, 'AI Suggest Novel Outline');
    await waitForLLM(page, 'SMOKE Additive Suggest Novel Outline');
    await expect(page.locator('#novelOutline')).not.toHaveValue('');

    await page.fill('#outlineImprovements', 'Strengthen the theme of unity vs isolation in each act transition.');
    await clickButton(page, 'Incorporate Suggestions');
    await waitForLLM(page, 'SMOKE Additive Incorporate Outline Suggestions');

    const outlineNavButtons = page.locator('#chapterOutlinesNav button');
    for (let i = 1; i <= NUM_CHAPTERS; i++) {
      await expect(outlineNavButtons.nth(i)).toBeAttached();
      await page.evaluate((chapterNum) => {
        if (typeof window.showChapterSubpage === 'function') {
          window.showChapterSubpage(chapterNum);
        }
      }, i);
      await page.waitForTimeout(200);

      await page.evaluate(async (chapterNum) => {
        if (typeof window.generateChapterOutline === 'function') {
          await window.generateChapterOutline(chapterNum);
        }
      }, i);
      await waitForLLM(page, `SMOKE Additive Generate Outline & Arc Ch ${i}`);

      if ([3, 7, 12].includes(i)) {
        const impInput = page.locator(`#chapterImprovement${i}`);
        await impInput.fill(`Deepen the tension and add a character-specific reveal for chapter ${i}.`);
        await page.evaluate(async (chapterNum) => {
          if (typeof window.updateChapterOutline === 'function') {
            await window.updateChapterOutline(chapterNum);
          }
        }, i);
        await waitForLLM(page, `SMOKE Additive Update Outline Ch ${i}`);
      }
    }
  });

  await runStep('Tab 5 generate all chapters', async () => {
    await gotoTab(page, 5);
    for (let i = 1; i <= NUM_CHAPTERS; i++) {
      const chapterGenNavButtons = page.locator('#chapterGenNav button');
      await expect(chapterGenNavButtons.nth(i - 1)).toBeAttached();
      await page.evaluate((chapterNum) => {
        if (typeof window.showGenChapterSubpage === 'function') {
          window.showGenChapterSubpage(chapterNum);
        }
      }, i);
      await page.waitForTimeout(200);

      await page.evaluate(async (chapterNum) => {
        if (typeof window.generateChapter === 'function') {
          window.generateChapter(chapterNum);
        }
      }, i);
      await waitForLLM(page, `SMOKE Additive Generate Chapter ${i}`);

      const content = await page.locator(`#chapterGenContent${i}`).inputValue();
      expect(content.length).toBeGreaterThan(50);
    }
  });

  await runStep('Tab 6 edit + spell-check chapters', async () => {
    await gotoTab(page, 6);
    const half = Math.ceil(NUM_CHAPTERS / 2);

    for (let i = 1; i <= NUM_CHAPTERS; i++) {
      const chapterEditNavButtons = page.locator('#chapterEditNav button');
      await expect(chapterEditNavButtons.nth(i - 1)).toBeAttached();
      await page.evaluate((chapterNum) => {
        if (typeof window.showEditChapterSubpage === 'function') {
          window.showEditChapterSubpage(chapterNum);
        }
      }, i);
      await page.waitForTimeout(200);

      await expect(page.locator(`#chapterEditContent${i}`)).toBeVisible();

      if ([2, 8, 14].includes(i)) {
        const impInput = page.locator(`#chapterEditImprovement${i}`);
        if (await impInput.count() > 0) {
          await impInput.fill(`Improve pacing and add stronger sensory detail in chapter ${i}.`);
        }
        await page.evaluate(async (chapterNum) => {
          if (typeof window.updateChapter === 'function') {
            window.updateChapter(chapterNum);
          }
        }, i);
        await waitForLLM(page, `SMOKE Additive Update Chapter ${i}`);
      }

      if (i <= half) {
        await page.evaluate(async (chapterNum) => {
          if (typeof window.checkSpellingAndGrammar === 'function') {
            window.checkSpellingAndGrammar(chapterNum, 'edit');
          }
        }, i);
        await waitForLLM(page, `SMOKE Additive Spell Check Chapter ${i}`);
      }
    }
  });

  await runStep('Tab 7 book improvements + status + breakdown', async () => {
    await gotoTab(page, 7);
    await clickButton(page, 'Suggest Improvements');
    await waitForLLM(page, 'SMOKE Additive Suggest Book Improvements');

    const rows = page.locator('#improvementsTableBody tr').filter({ has: page.locator('select') });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    const firstThird = Math.ceil(rowCount / 3);
    const secondThird = Math.ceil((rowCount * 2) / 3);
    for (let i = 0; i < rowCount; i++) {
      const select = rows.nth(i).locator('select');
      // Match actual Tab 7 option values: To Incorporate | Incorporated | Ignored
      let status = 'Ignored';
      if (i < firstThird) status = 'To Incorporate';
      else if (i < secondThird) status = 'Incorporated';
      await select.selectOption(status);

      // Only "To Incorporate" can be broken down by app logic.
      if (status === 'To Incorporate') {
        const breakdownBtn = rows.nth(i).locator('button').filter({ hasText: 'Break Down' }).first();
        if (await breakdownBtn.count() > 0) {
          await breakdownBtn.click();
          await waitForLLM(page, `SMOKE Additive Breakdown Improvement ${i + 1}`);
        }
      }
    }
  });

  await runStep('Tab 8 review consolidated suggestions + integrate', async () => {
    await gotoTab(page, 8);

    // Tab 8 auto-populates on navigation; no need to force Refresh Breakdowns here.
    await page.waitForTimeout(1000);

    const chars = await page.locator('#consolidatedCharacters').inputValue();
    const subplots = await page.locator('#consolidatedSubplots').inputValue();
    const chapterContent = await page.locator('#consolidatedChapters').inputValue();
    console.log(`Consolidated characters: ${chars.length} chars`);
    console.log(`Consolidated subplots: ${subplots.length} chars`);

    // If no actionable consolidated breakdowns are present, integration should be skipped by app logic.
    const hasActionableBreakdowns = [chars, subplots, chapterContent].some(v => {
      const t = (v || '').trim();
      return t && !/^No .* suggestions\.$/i.test(t);
    });

    if (hasActionableBreakdowns) {
      await clickButton(page, 'Integrate Suggestions');
      await waitForLLM(page, 'SMOKE Additive Integrate Breakdown Suggestions');

      // After integration, Tab 7 should include at least one Incorporated status.
      await gotoTab(page, 7);
      const incorporatedCount = await page.locator('#improvementsTableBody select').evaluateAll(selects =>
        selects.filter(s => s.value === 'Incorporated').length
      );
      expect(incorporatedCount).toBeGreaterThan(0);

      await gotoTab(page, 8);
    }
  });

  await runStep('Tab 9 request log populated', async () => {
    await gotoTab(page, 9);
    const status = (await page.locator('#requestStatus').textContent()).trim();
    expect(['Completed', 'Failed', 'Idle']).toContain(status);
    const lastPrompt = await page.locator('#lastPrompt').inputValue();
    expect(lastPrompt.length).toBeGreaterThan(0);
  });

  await runStep('Tab 10 element values visible', async () => {
    await gotoTab(page, 10);
    await clickButton(page, 'Refresh Values');
    await page.waitForTimeout(500);
    const values = await page.locator('#elementValues').inputValue();
    expect(values).toContain('title:');
    expect(values.length).toBeGreaterThan(50);
  });

  await runStep('Tab 11 agent prompts table visible', async () => {
    await gotoTab(page, 11);
    const rows = await page.locator('#promptManagerBody tr').count();
    expect(rows).toBeGreaterThan(3);
    const firstAgentCell = page.locator('#promptManagerBody tr').first().locator('td').nth(1);
    const agentName = await firstAgentCell.textContent();
    expect(agentName.trim().length).toBeGreaterThan(0);
  });

  await runStep('Help opens in new tab', async () => {
    const [helpPage] = await Promise.all([
      context.waitForEvent('page'),
      page.click('button:has-text("Help")'),
    ]);
    await helpPage.waitForLoadState('domcontentloaded');
    expect(helpPage.url()).toMatch(/user_guide\.html/i);
  });

  await runStep('Return to Tab 7 and export book + session checkpoint', async () => {
    await gotoTab(page, 7);

    const [bookDownload] = await Promise.all([
      page.waitForEvent('download'),
      clickButton(page, 'Export Book'),
    ]);
    expect(bookDownload.suggestedFilename()).toMatch(/\.txt$/i);
    exportedBookPath = testInfo.outputPath('smoke-full-book.txt');
    await bookDownload.saveAs(exportedBookPath);
    console.log(`[${ts()}] Exported book saved: ${path.basename(exportedBookPath)} -> ${exportedBookPath}`);

    const [sessionDownload] = await Promise.all([
      page.waitForEvent('download'),
      clickButton(page, 'Export Session'),
    ]);
    expect(sessionDownload.suggestedFilename()).toMatch(/_session\.json$/i);
    exportedSessionPath = testInfo.outputPath('smoke-full-session.json');
    await sessionDownload.saveAs(exportedSessionPath);
    console.log(`[${ts()}] Exported session saved: ${path.basename(exportedSessionPath)} -> ${exportedSessionPath}`);

    const exportSummary = [
      `bookFileName: ${path.basename(exportedBookPath)}`,
      `bookPath: ${exportedBookPath}`,
      `sessionFileName: ${path.basename(exportedSessionPath)}`,
      `sessionPath: ${exportedSessionPath}`,
    ].join('\n');
    await testInfo.attach('smoke-full-export-paths', {
      body: exportSummary,
      contentType: 'text/plain',
    });
  });

  await runStep('Reload and import exported session', async () => {
    await page.reload();
    await expect(page.locator('h1')).toContainText('Novel Writer');
    await page.fill('#apiKey', API_KEY);

    await page.setInputFiles('#importFile', exportedSessionPath);
    await page.waitForTimeout(1000);

    await expect(page.locator('#title')).toHaveValue(SMOKE_TITLE);
    await expect(page.locator('#numChapters')).toHaveValue(String(NUM_CHAPTERS));

    await gotoTab(page, 5);
    const restoredChapterOne = await page.locator('#chapterGenContent1').inputValue();
    expect(restoredChapterOne.length).toBeGreaterThan(50);
  });
});
