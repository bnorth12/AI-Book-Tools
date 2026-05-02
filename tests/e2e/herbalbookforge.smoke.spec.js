// Playwright E2E smoke test for HerbalBookForge
// Covers: tab navigation, Drafting tab control presence (HBF.DR8)
const { test, expect } = require('@playwright/test');

test.describe('HerbalBookForge Smoke Test', () => {
  test('App loads and shows main tabs', async ({ page }) => {
    await page.goto('/HerbalBookForge/HerbalBookForge.html');
    await expect(page.locator('button#tab-goals')).toBeVisible();
    await expect(page.locator('button#tab-outline')).toBeVisible();
    await expect(page.locator('button#tab-chapter-outlines')).toBeVisible();
    await expect(page.locator('button#tab-drafting')).toBeVisible();
    await expect(page.locator('button#tab-prompts')).toBeVisible();
    await expect(page.locator('button#tab-safety')).toBeVisible();
    await expect(page.locator('button#tab-preview')).toBeVisible();
  });

  test('Drafting tab renders all required controls (HBF.DR8)', async ({ page }) => {
    await page.goto('/HerbalBookForge/HerbalBookForge.html');

    // Switch to Drafting tab
    await page.click('button#tab-drafting');
    await page.waitForSelector('#content-drafting:not(.hidden)', { timeout: 5000 });

    // Chapter selector and generate button are always present
    await expect(page.locator('[data-testid="draft-chapter-select"]')).toBeVisible();
    await expect(page.locator('[data-testid="generate-draft-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="draft-status"]')).toBeAttached();

    // The workspace is hidden until a draft exists — just verify DOM presence
    await expect(page.locator('[data-testid="draft-text-area"]')).toBeAttached();
    await expect(page.locator('[data-testid="save-draft-btn"]')).toBeAttached();
    await expect(page.locator('[data-testid="revision-instruction"]')).toBeAttached();
    await expect(page.locator('[data-testid="revise-draft-btn"]')).toBeAttached();
    await expect(page.locator('[data-testid="revise-status"]')).toBeAttached();
    await expect(page.locator('[data-testid="validate-draft-btn"]')).toBeAttached();
    await expect(page.locator('[data-testid="validate-status"]')).toBeAttached();
    await expect(page.locator('[data-testid="validation-results"]')).toBeAttached();
  });
});
