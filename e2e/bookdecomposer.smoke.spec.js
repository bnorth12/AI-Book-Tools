const { test, expect } = require('@playwright/test');

const APP_URL = 'http://localhost:8080/BookDecomposer/BookDecomposer.html';

test('BD-SMOKE-01 tab shell and output panes render', async ({ page }) => {
  await page.goto(APP_URL);
  await expect(page).toHaveTitle(/Book Decomposer/i);

  const tabButtons = page.locator('.tab button');
  await expect(tabButtons).toHaveCount(4);

  const tabExpectations = [
    { buttonText: 'Input Book', tabId: '#tab1' },
    { buttonText: 'Chapters Preview', tabId: '#tab2' },
    { buttonText: 'Extracted Elements', tabId: '#tab3' },
    { buttonText: 'Output JSON', tabId: '#tab4' },
  ];

  for (const step of tabExpectations) {
    await page.locator(`.tab button:has-text("${step.buttonText}")`).click();
    await expect(page.locator(step.tabId)).toHaveClass(/active/);
  }

  await page.locator('.tab button:has-text("Chapters Preview")').click();
  await expect(page.locator('#chaptersTable')).toBeVisible();

  await page.locator('.tab button:has-text("Extracted Elements")').click();
  await expect(page.locator('#elementsTable')).toBeVisible();

  await page.locator('.tab button:has-text("Output JSON")').click();
  await expect(page.locator('#tab4')).toHaveClass(/active/);
  await expect(page.locator('button:has-text("Export JSON")')).toBeVisible();
  await expect(page.locator('#jsonOutput')).toBeAttached();
});
