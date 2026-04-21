const { test, expect } = require('@playwright/test');

const APP_URL = 'http://localhost:8080/BookEditor/BookEditor.html';

test('BE-SMOKE-01 tab shell and core controls render', async ({ page }) => {
  await page.goto(APP_URL);
  await expect(page.locator('h1')).toContainText('BookEditor');

  const navButtons = page.locator('#nav button');
  await expect(navButtons).toHaveCount(6);

  const tabExpectations = [
    { buttonText: '1. Project Setup', tabId: '#tab1' },
    { buttonText: '2. Book Input', tabId: '#tab2' },
    { buttonText: '3. Chat Bot', tabId: '#tab3' },
    { buttonText: '4. Improvements List', tabId: '#tab4' },
    { buttonText: '5. Edited Output', tabId: '#tab5' },
    { buttonText: '6. Request Log', tabId: '#tab6' },
  ];

  for (const step of tabExpectations) {
    await page.locator(`#nav button:has-text("${step.buttonText}")`).click();
    await expect(page.locator(step.tabId)).toHaveClass(/active/);
  }

  await page.locator('#nav button:has-text("4. Improvements List")').click();
  await expect(page.locator('#improvementsTable')).toBeVisible();

  await page.locator('#nav button:has-text("2. Book Input")').click();
  await expect(page.locator('#bookText')).toBeVisible();
});
