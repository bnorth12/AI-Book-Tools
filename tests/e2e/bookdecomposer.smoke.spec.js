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

test('BD-SEC-01 JSON export and import omit API keys', async ({ page }) => {
  await page.goto(APP_URL);
  await page.locator('.tab button:has-text("Output JSON")').click();
  const secret = 'xai-TESTKEY-123';
  const proseFixture = 'She kept the #secret close. Who holds the key?key=yes. The word password stayed in the sentence.';
  const importNotices = [];
  page.on('dialog', async dialog => {
    importNotices.push(dialog.message());
    await dialog.accept();
  });

  const exportedJson = await page.evaluate(({ apiKey, prose }) => new Promise((resolve) => {
    novelData.apiKey = apiKey;
    novelData.chapters = [prose];
    novelData.nested = { accessToken: apiKey, bearer: apiKey, title: 'Safe content' };
    novelData.API_KEY = apiKey;
    novelData.privateKey = apiKey;
    novelData.endpointWithCredentials = `https://${'user:pass'}@example.com/service`;
    novelData.endpointWithUsername = 'https://user@example.com/service';
    novelData.endpointWithPassword = `https://${':pass'}@example.com/service`;
    novelData.endpointWithToken = 'https://example.com/service?token=hidden';
    novelData.endpointWithFragment = 'https://example.com/callback#access_token=hidden';
    novelData.serviceSecret = 'hidden-secret';
    novelData.savedPassword = 'hidden-password';
    novelData.bearerToken = 'hidden-bearer';
    novelData.key = 'sort-key';
    novelData.token = 'ordinary-token';
    novelData.tokenUsage = { calls: 2, promptTokens: 17 };
    novelData.maxTokens = 4321;
    novelData.promptTokens = 17;
    novelData.agentKey = 'fetchAuthors';
    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = function (blob) {
      const reader = new FileReader();
      reader.onload = () => {
        URL.createObjectURL = originalCreateObjectURL;
        resolve(reader.result);
      };
      reader.readAsText(blob);
      return 'blob:mock';
    };
    exportJSON();
  }), { apiKey: secret, prose: proseFixture });
  expect(exportedJson).not.toContain(secret);
  expect(exportedJson).not.toContain('user:pass@');
  expect(exportedJson).not.toContain('token=hidden');
  expect(exportedJson).not.toContain('access_token=hidden');
  expect(JSON.parse(exportedJson).novelData).toMatchObject({
    chapters: [proseFixture],
    key: 'sort-key',
    token: 'ordinary-token',
    tokenUsage: { calls: 2, promptTokens: 17 },
    maxTokens: 4321,
    promptTokens: 17,
    agentKey: 'fetchAuthors',
  });
  expect(await page.evaluate((prose) => {
    const url = new URL(prose, window.location.href);
    const fragment = url.hash.slice(1);
    const params = new URLSearchParams(fragment.includes('?') ? fragment.slice(fragment.indexOf('?') + 1) : fragment);
    return params.has('key');
  }, proseFixture)).toBe(true);
  expect(JSON.parse(exportedJson).novelData).not.toHaveProperty('API_KEY');
  expect(JSON.parse(exportedJson).novelData).not.toHaveProperty('privateKey');
  expect(JSON.parse(exportedJson).novelData).not.toHaveProperty('endpointWithCredentials');
  expect(JSON.parse(exportedJson).novelData).not.toHaveProperty('endpointWithUsername');
  expect(JSON.parse(exportedJson).novelData).not.toHaveProperty('endpointWithPassword');
  expect(JSON.parse(exportedJson).novelData).not.toHaveProperty('endpointWithToken');
  expect(JSON.parse(exportedJson).novelData).not.toHaveProperty('endpointWithFragment');
  expect(JSON.parse(exportedJson).novelData).not.toHaveProperty('serviceSecret');
  expect(JSON.parse(exportedJson).novelData).not.toHaveProperty('savedPassword');
  expect(JSON.parse(exportedJson).novelData).not.toHaveProperty('bearerToken');

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Import JSON' }).click(),
  ]);
  await fileChooser.setFiles({
    name: 'session-with-key.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      schemaVersion: '1.0',
      sourceTool: 'BookDecomposer',
      novelData: {
        title: 'Imported safely',
        chapters: [proseFixture],
        apiKey: secret,
        API_KEY: secret,
        privateKey: secret,
        key: 'sort-key',
        token: 'ordinary-token',
        nested: { authorization: secret, bearer: secret },
        tokenUsage: { calls: 2, promptTokens: 17 },
        maxTokens: 4321,
        promptTokens: 17,
        agentKey: 'fetchAuthors',
        endpoint: 'https://example.com/service?access_token=hidden',
        endpointWithUsername: 'https://user@example.com/service',
        endpointWithPassword: `https://${':pass'}@example.com/service`,
        callback: 'https://example.com/callback#access_token=hidden',
        serviceSecret: 'hidden-secret',
        savedPassword: 'hidden-password',
        bearerToken: 'hidden-bearer',
      },
    })),
  });

  await expect(page.locator('#jsonOutput')).toContainText('Imported safely');
  await expect(page.locator('#jsonOutput')).toContainText(proseFixture);
  await expect(page.locator('#jsonOutput')).not.toContainText(secret);
  expect(await page.evaluate(() => ({
    hasApiKey: Object.hasOwn(novelData, 'apiKey'),
    hasAuthorization: Object.hasOwn(novelData.nested, 'authorization'),
    hasBearer: Object.hasOwn(novelData.nested, 'bearer'),
    hasApiKeyUpper: Object.hasOwn(novelData, 'API_KEY'),
    hasPrivateKey: Object.hasOwn(novelData, 'privateKey'),
    hasEndpoint: Object.hasOwn(novelData, 'endpoint'),
    hasEndpointWithUsername: Object.hasOwn(novelData, 'endpointWithUsername'),
    hasEndpointWithPassword: Object.hasOwn(novelData, 'endpointWithPassword'),
    hasCallback: Object.hasOwn(novelData, 'callback'),
    hasServiceSecret: Object.hasOwn(novelData, 'serviceSecret'),
    hasSavedPassword: Object.hasOwn(novelData, 'savedPassword'),
    hasBearerToken: Object.hasOwn(novelData, 'bearerToken'),
    key: novelData.key,
    token: novelData.token,
    tokenUsage: novelData.tokenUsage,
    maxTokens: novelData.maxTokens,
    promptTokens: novelData.promptTokens,
    agentKey: novelData.agentKey,
    chapters: novelData.chapters,
  }))).toEqual({
    hasApiKey: false,
    hasAuthorization: false,
    hasBearer: false,
    hasApiKeyUpper: false,
    hasPrivateKey: false,
    hasEndpoint: false,
    hasEndpointWithUsername: false,
    hasEndpointWithPassword: false,
    hasCallback: false,
    hasServiceSecret: false,
    hasSavedPassword: false,
    hasBearerToken: false,
    key: 'sort-key',
    token: 'ordinary-token',
    tokenUsage: { calls: 2, promptTokens: 17 },
    maxTokens: 4321,
    promptTokens: 17,
    agentKey: 'fetchAuthors',
    chapters: [proseFixture],
  });
  await expect(page.locator('#apiKey')).toHaveValue('');
  expect(importNotices.some(message => message.includes('apiKey') && message.includes('endpoint') && message.includes('console.x.ai'))).toBe(true);
});
