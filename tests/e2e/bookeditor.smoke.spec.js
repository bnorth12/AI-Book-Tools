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

test('BE-SEC-01 session export and import omit API keys', async ({ page }) => {
  await page.goto(APP_URL);

  const importNotices = [];
  page.on('dialog', async dialog => {
    importNotices.push(dialog.message());
    await dialog.accept();
  });
  const secret = 'xai-TESTKEY-123';
  const proseFixture = 'She kept the #secret close. Who holds the key?key=yes. The word password stayed in the sentence.';
  const exportedJson = await page.evaluate(({ apiKey, prose }) => new Promise((resolve) => {
    document.getElementById('apiKey').value = apiKey;
    document.getElementById('bookText').value = prose;
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
    exportSession();
  }), { apiKey: secret, prose: proseFixture });

  expect(exportedJson).not.toContain(secret);
  expect(JSON.parse(exportedJson)).not.toHaveProperty('apiKey');
  expect(JSON.parse(exportedJson).bookText).toBe(proseFixture);
  expect(await page.evaluate((prose) => {
    const url = new URL(prose, window.location.href);
    const fragment = url.hash.slice(1);
    const params = new URLSearchParams(fragment.includes('?') ? fragment.slice(fragment.indexOf('?') + 1) : fragment);
    return params.has('key');
  }, proseFixture)).toBe(true);

  await page.locator('#apiKey').fill('');
  await page.locator('#importFile').setInputFiles({
    name: 'session.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ apiKey: secret, genre: 'fantasy', bookText: proseFixture })),
  });
  await expect(page.locator('#bookText')).toHaveValue(proseFixture);
  await expect(page.locator('#apiKey')).toHaveValue('');
  expect(importNotices.some(message => message.includes('apiKey') && message.includes('console.x.ai'))).toBe(true);

  const exportedBook = await page.evaluate((apiKey) => new Promise((resolve) => {
    novelData = {
      ...novelData,
      apiKey,
      bearer: apiKey,
      API_KEY: apiKey,
      privateKey: apiKey,
      endpointWithCredentials: `https://${'user:pass'}@example.com/service`,
      endpointWithUsername: 'https://user@example.com/service',
      endpointWithPassword: `https://${':pass'}@example.com/service`,
      endpointWithToken: 'https://example.com/service?token=hidden',
      endpointWithFragment: 'https://example.com/callback#access_token=hidden',
      serviceSecret: 'hidden-secret',
      savedPassword: 'hidden-password',
      bearerToken: 'hidden-bearer',
      key: 'chapter-key',
      token: 'ordinary-token',
      tokenUsage: { calls: 2, promptTokens: 17 },
      maxTokens: 4321,
      promptTokens: 17,
      agentKey: 'fetchAuthors',
    };
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
    exportBook();
  }), secret);
  const parsedBook = JSON.parse(exportedBook);
  expect(exportedBook).not.toContain(secret);
  expect(exportedBook).not.toContain('user:');
  expect(exportedBook).not.toContain('token=hidden');
  expect(exportedBook).not.toContain('access_token=hidden');
  expect(parsedBook.novelData).toMatchObject({
    bookText: proseFixture,
    key: 'chapter-key',
    token: 'ordinary-token',
    tokenUsage: { calls: 2, promptTokens: 17 },
    maxTokens: 4321,
    promptTokens: 17,
    agentKey: 'fetchAuthors',
  });
  expect(parsedBook.novelData).not.toHaveProperty('API_KEY');
  expect(parsedBook.novelData).not.toHaveProperty('privateKey');
  expect(parsedBook.novelData).not.toHaveProperty('endpointWithCredentials');
  expect(parsedBook.novelData).not.toHaveProperty('endpointWithUsername');
  expect(parsedBook.novelData).not.toHaveProperty('endpointWithPassword');
  expect(parsedBook.novelData).not.toHaveProperty('endpointWithToken');
  expect(parsedBook.novelData).not.toHaveProperty('endpointWithFragment');
  expect(parsedBook.novelData).not.toHaveProperty('serviceSecret');
  expect(parsedBook.novelData).not.toHaveProperty('savedPassword');
  expect(parsedBook.novelData).not.toHaveProperty('bearerToken');

  await page.evaluate(() => { delete novelData.apiKey; });
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.evaluate(() => importBook()),
  ]);
  await fileChooser.setFiles({
    name: 'book-with-secret.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      ...parsedBook,
      novelData: {
        ...parsedBook.novelData,
        apiKey: secret,
        authorization: secret,
        privateKey: secret,
        endpoint: 'https://example.com/?api_key=hidden',
        endpointWithUsername: 'https://user@example.com/service',
        endpointWithPassword: `https://${':pass'}@example.com/service`,
        callback: 'https://example.com/callback#access_token=hidden',
        serviceSecret: 'hidden-secret',
        savedPassword: 'hidden-password',
        bearerToken: 'hidden-bearer',
      },
    })),
  });
  await expect(page.locator('#bookText')).toHaveValue(proseFixture);
  await expect.poll(() => page.evaluate(() => ({
    tokenUsage: novelData.tokenUsage,
    key: novelData.key,
    token: novelData.token,
    maxTokens: novelData.maxTokens,
    promptTokens: novelData.promptTokens,
    agentKey: novelData.agentKey,
    hasApiKey: Object.hasOwn(novelData, 'apiKey'),
    hasAuthorization: Object.hasOwn(novelData, 'authorization'),
    hasPrivateKey: Object.hasOwn(novelData, 'privateKey'),
    hasEndpoint: Object.hasOwn(novelData, 'endpoint'),
    hasEndpointWithUsername: Object.hasOwn(novelData, 'endpointWithUsername'),
    hasEndpointWithPassword: Object.hasOwn(novelData, 'endpointWithPassword'),
    hasCallback: Object.hasOwn(novelData, 'callback'),
    hasServiceSecret: Object.hasOwn(novelData, 'serviceSecret'),
    hasSavedPassword: Object.hasOwn(novelData, 'savedPassword'),
    hasBearerToken: Object.hasOwn(novelData, 'bearerToken'),
  }))).toEqual({
    tokenUsage: { calls: 2, promptTokens: 17 },
    key: 'chapter-key',
    token: 'ordinary-token',
    maxTokens: 4321,
    promptTokens: 17,
    agentKey: 'fetchAuthors',
    hasApiKey: false,
    hasAuthorization: false,
    hasPrivateKey: false,
    hasEndpoint: false,
    hasEndpointWithUsername: false,
    hasEndpointWithPassword: false,
    hasCallback: false,
    hasServiceSecret: false,
    hasSavedPassword: false,
    hasBearerToken: false,
  });
  expect(importNotices.some(message => message.includes('apiKey') && message.includes('privateKey') && message.includes('endpoint') && message.includes('console.x.ai'))).toBe(true);
});
