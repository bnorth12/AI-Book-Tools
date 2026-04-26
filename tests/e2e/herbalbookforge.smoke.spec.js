// Minimal Playwright E2E smoke test for HerbalBookForge
const { test, expect } = require('@playwright/test');

test.describe('HerbalBookForge Smoke Test', () => {
  test('App loads and shows main tabs', async ({ page }) => {
    await page.goto('/HerbalBookForge/HerbalBookForge.html');
    // Check for tab buttons using more specific selectors
    await expect(page.locator('button#tab-goals')).toBeVisible();
    await expect(page.locator('button#tab-outline')).toBeVisible();
    await expect(page.locator('button#tab-chapter-outlines')).toBeVisible();
    await expect(page.locator('button#tab-drafting')).toBeVisible();
    await expect(page.locator('button#tab-prompts')).toBeVisible();
    await expect(page.locator('button#tab-safety')).toBeVisible();
    await expect(page.locator('button#tab-preview')).toBeVisible();
  });
});
