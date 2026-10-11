// Playwright E2E smoke test for HerbalBookForge
// Covers: tab navigation, Drafting tab controls (HBF.DR8), Safety tab controls (HBF.SA6), Preview tab controls (HBF.PR1/PR2/PR3)
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

  test('Safety tab renders all required controls (HBF.SA6)', async ({ page }) => {
    await page.goto('/HerbalBookForge/HerbalBookForge.html');

    // Switch to Safety tab
    await page.click('button#tab-safety');
    await page.waitForSelector('#content-safety:not(.hidden)', { timeout: 5000 });

    // Scope selector and scan button — visible when no drafts exist the empty state is shown
    // but the controls container is still attached to the DOM
    await expect(page.locator('[data-testid="safety-scope-select"]')).toBeAttached();
    await expect(page.locator('[data-testid="safety-scan-btn"]')).toBeAttached();
    await expect(page.locator('[data-testid="safety-status"]')).toBeAttached();
    await expect(page.locator('[data-testid="safety-report"]')).toBeAttached();
    await expect(page.locator('[data-testid="safety-empty-state"]')).toBeAttached();
  });

  test('Preview tab renders all required controls (Sprint 4)', async ({ page }) => {
    await page.goto('/HerbalBookForge/HerbalBookForge.html');

    // Switch to Preview tab
    await page.click('button#tab-preview');
    await page.waitForSelector('#content-preview:not(.hidden)', { timeout: 5000 });

    // Preview assembly and export controls should be present
    await expect(page.locator('[data-testid="preview-assemble-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="preview-export-md-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="preview-export-html-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="preview-export-rtf-btn"]')).toBeVisible();

    // Empty state visible before assembly; preview content exists in DOM for post-assembly rendering
    await expect(page.locator('[data-testid="preview-empty-state"]')).toBeVisible();
    await expect(page.locator('[data-testid="preview-content"]')).toBeAttached();
  });

  test('Drafting tab renders Generate Remaining button (HBF.DR9, Sprint 5)', async ({ page }) => {
    await page.goto('/HerbalBookForge/HerbalBookForge.html');

    // Switch to Drafting tab
    await page.click('button#tab-drafting');
    await page.waitForSelector('#content-drafting:not(.hidden)', { timeout: 5000 });

    // Generate Remaining button should be visible next to Generate Draft
    await expect(page.locator('[data-testid="generate-remaining-btn"]')).toBeVisible();
  });

  test('Setup tab renders export/import controls', async ({ page }) => {
    await page.goto('/HerbalBookForge/HerbalBookForge.html');

    // Switch to Setup tab
    await page.click('button#tab-setup');
    await page.waitForSelector('#content-setup:not(.hidden)', { timeout: 5000 });

    // Export and import button/input should be attached to DOM
    await expect(page.locator('[data-testid="export-project-btn"]')).toBeAttached();
    await expect(page.locator('[data-testid="import-project-input"]')).toBeAttached();
  });

  test('HBF-SEC-01 project export, storage, and import omit API keys', async ({ page }) => {
    await page.goto('/HerbalBookForge/HerbalBookForge.html');
    const secret = 'xai-TESTKEY-123';
    const importNotices = [];
    page.on('dialog', async dialog => {
      importNotices.push(dialog.message());
      await dialog.accept();
    });

    const { exportedJson, storedProject } = await page.evaluate((apiKey) => new Promise((resolve) => {
      document.getElementById('api-key').value = apiKey;
      project.setup.apiKey = apiKey;
      project.setup.authorization = apiKey;
      project.setup.API_KEY = apiKey;
      project.setup.privateKey = apiKey;
      project.setup.endpointWithCredentials = `https://${'user:pass'}@example.com/service`;
      project.setup.endpointWithUsername = 'https://user@example.com/service';
      project.setup.endpointWithPassword = `https://${':pass'}@example.com/service`;
      project.setup.endpointWithToken = 'https://example.com/service?token=hidden';
      project.setup.endpointWithFragment = 'https://example.com/callback#access_token=hidden';
      project.setup.serviceSecret = 'hidden-secret';
      project.setup.savedPassword = 'hidden-password';
      project.setup.bearerToken = 'hidden-bearer';
      project.key = 'sort-key';
      project.token = 'ordinary-token';
      project.tokenUsage = { calls: 2, promptTokens: 17 };
      project.maxTokens = 4321;
      project.promptTokens = 17;
      project.agentKey = 'fetchAuthors';
      const originalCreateObjectURL = URL.createObjectURL;
      URL.createObjectURL = function (blob) {
        const reader = new FileReader();
        reader.onload = () => {
          URL.createObjectURL = originalCreateObjectURL;
          resolve({
            exportedJson: reader.result,
            storedProject: localStorage.getItem('herbalBookForgeProject_v1.0.0'),
          });
        };
        reader.readAsText(blob);
        return 'blob:mock';
      };
      saveProject();
      exportProject();
    }), secret);

    expect(exportedJson).not.toContain(secret);
    expect(JSON.parse(exportedJson).setup).not.toHaveProperty('apiKey');
    expect(JSON.parse(exportedJson).setup).not.toHaveProperty('authorization');
    expect(exportedJson).not.toContain('user:pass@');
    expect(exportedJson).not.toContain('token=hidden');
    expect(exportedJson).not.toContain('access_token=hidden');
    expect(JSON.parse(exportedJson).setup).not.toHaveProperty('API_KEY');
    expect(JSON.parse(exportedJson).setup).not.toHaveProperty('privateKey');
    expect(JSON.parse(exportedJson).setup).not.toHaveProperty('endpointWithCredentials');
    expect(JSON.parse(exportedJson).setup).not.toHaveProperty('endpointWithUsername');
    expect(JSON.parse(exportedJson).setup).not.toHaveProperty('endpointWithPassword');
    expect(JSON.parse(exportedJson).setup).not.toHaveProperty('endpointWithToken');
    expect(JSON.parse(exportedJson).setup).not.toHaveProperty('endpointWithFragment');
    expect(JSON.parse(exportedJson).setup).not.toHaveProperty('serviceSecret');
    expect(JSON.parse(exportedJson).setup).not.toHaveProperty('savedPassword');
    expect(JSON.parse(exportedJson).setup).not.toHaveProperty('bearerToken');
    expect(storedProject).not.toContain(secret);
    expect(storedProject).not.toContain('user:pass@');
    expect(storedProject).not.toContain('token=hidden');
    expect(storedProject).not.toContain('access_token=hidden');
    expect(JSON.parse(storedProject).setup).not.toHaveProperty('apiKey');
    expect(JSON.parse(storedProject).setup).not.toHaveProperty('authorization');
    expect(JSON.parse(storedProject).setup).not.toHaveProperty('API_KEY');
    expect(JSON.parse(storedProject).setup).not.toHaveProperty('privateKey');
    expect(JSON.parse(exportedJson)).toMatchObject({
      key: 'sort-key',
      token: 'ordinary-token',
      tokenUsage: { calls: 2, promptTokens: 17 },
      maxTokens: 4321,
      promptTokens: 17,
      agentKey: 'fetchAuthors',
    });

    await page.locator('#api-key').fill('existing-user-key');
    await page.locator('#import-file').setInputFiles({
      name: 'project-with-key.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        setup: {
          apiKey: secret,
          endpointWithUsername: 'https://user@example.com/service',
          endpointWithPassword: `https://${':pass'}@example.com/service`,
          bearer: secret,
          API_KEY: secret,
          privateKey: secret,
          endpoint: 'https://example.com/?access_token=hidden',
          callback: 'https://example.com/callback#access_token=hidden',
          serviceSecret: 'hidden-secret',
          savedPassword: 'hidden-password',
          bearerToken: 'hidden-bearer',
        },
        meta: { name: 'Imported project' },
        key: 'sort-key',
        token: 'ordinary-token',
        tokenUsage: { calls: 3, promptTokens: 19 },
        maxTokens: 5432,
        promptTokens: 19,
        agentKey: 'importedAgent',
      })),
    });
    await expect(page.locator('#api-key')).toHaveValue('existing-user-key');
    expect(await page.evaluate(() => project.setup.apiKey)).toBe('existing-user-key');
    await expect(page.locator('#project-name')).toHaveValue('Imported project');
    await expect.poll(() => page.evaluate(() => ({
      metaName: project.meta.name,
      key: project.key,
      token: project.token,
      tokenUsage: project.tokenUsage,
      maxTokens: project.maxTokens,
      promptTokens: project.promptTokens,
      agentKey: project.agentKey,
    }))).toEqual({
      metaName: 'Imported project',
      key: 'sort-key',
      token: 'ordinary-token',
      tokenUsage: { calls: 3, promptTokens: 19 },
      maxTokens: 5432,
      promptTokens: 19,
      agentKey: 'importedAgent',
    });
    const importedSetup = await page.evaluate(() => project.setup);
    expect(importedSetup).not.toHaveProperty('API_KEY');
    expect(importedSetup).not.toHaveProperty('privateKey');
    expect(importedSetup).not.toHaveProperty('endpoint');
    expect(importedSetup).not.toHaveProperty('endpointWithUsername');
    expect(importedSetup).not.toHaveProperty('endpointWithPassword');
    expect(importedSetup).not.toHaveProperty('callback');
    expect(importedSetup).not.toHaveProperty('serviceSecret');
    expect(importedSetup).not.toHaveProperty('savedPassword');
    expect(importedSetup).not.toHaveProperty('bearerToken');
    expect(importNotices.some(message => message.includes('API_KEY') && message.includes('endpoint') && message.includes('console.x.ai'))).toBe(true);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('herbalBookForgeProject_v1.0.0'))).not.toContain(secret);
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('herbalBookForgeProject_v1.0.0')))).toMatchObject({
      meta: { name: 'Imported project' },
      key: 'sort-key',
      token: 'ordinary-token',
      tokenUsage: { calls: 3, promptTokens: 19 },
      maxTokens: 5432,
      promptTokens: 19,
      agentKey: 'importedAgent',
    });
  });

  // HBFST.7 (Sprint 6): Tab order — Prompts tab appears after Preview; footer has author-facing label
  test('Prompts tab appears after Preview tab in DOM order (HBFST.7)', async ({ page }) => {
    await page.goto('/HerbalBookForge/HerbalBookForge.html');

    // Verify Prompts tab is present
    await expect(page.locator('button#tab-prompts')).toBeVisible();

    // Verify DOM order: #tab-preview comes before #tab-prompts
    const tabOrder = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button[id^="tab-"]'));
      return tabs.map(t => t.id);
    });
    const previewIdx = tabOrder.indexOf('tab-preview');
    const promptsIdx = tabOrder.indexOf('tab-prompts');
    expect(previewIdx).toBeGreaterThan(-1);
    expect(promptsIdx).toBeGreaterThan(-1);
    expect(promptsIdx).toBeGreaterThan(previewIdx);

    // Verify footer has author-facing label with correct data-testid
    const footerLabel = page.locator('[data-testid="footer-status-label"]');
    await expect(footerLabel).toBeAttached();
    const text = await footerLabel.textContent();
    expect(text).toMatch(/author/i);
  });

  // HBFST.8 (Sprint 6): Export button and import input have meaningful aria-labels
  test('Export and Import controls have semantic aria-labels (HBFST.8)', async ({ page }) => {
    await page.goto('/HerbalBookForge/HerbalBookForge.html');

    const exportBtn = page.locator('[data-testid="export-project-btn"]');
    const importInput = page.locator('[data-testid="import-project-input"]').locator('..').locator('label').first();

    await expect(exportBtn).toBeAttached();
    const exportLabel = await exportBtn.getAttribute('aria-label');
    expect(exportLabel).toBeTruthy();
    expect(exportLabel.toLowerCase()).toContain('export');

    // Import label element should contain "Import" in aria-label or visible text
    const importLabel = page.locator('[aria-label*="Import"], [aria-label*="import"]').first();
    await expect(importLabel).toBeAttached();
  });
});
