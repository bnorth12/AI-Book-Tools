const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '..', 'HerbalBookForge', 'HerbalBookForge.html');
const APP_URL = pathToFileURL(APP_PATH).toString();

async function gotoApp(page) {
  await page.goto(APP_URL);
  await expect(page.locator('h1')).toContainText('HerbalBookForge');
}

async function setApiKey(page, value = 'gsk_test_key') {
  await page.click('#tab-setup');
  const apiKey = page.locator('#api-key');
  await apiKey.fill(value);
  await apiKey.dispatchEvent('input');
}

async function openOutline(page) {
  await page.click('#tab-outline');
  await expect(page.locator('#outline-editor')).toBeVisible();
}

function mockXaiEndpoints(page) {
  return page.route('https://api.x.ai/v1/chat/completions', async route => {
    const req = route.request();
    const body = req.postDataJSON();
    const sys = body?.messages?.[0]?.content || '';
    const user = body?.messages?.[body.messages.length - 1]?.content || '';

    let content = 'Default mocked response';

    if (sys.includes('Book Goals Agent')) {
      content = JSON.stringify({
        mainGoal: 'Create a practical herbal safety-first handbook',
        contentTypes: 'Materia medica, formulations, safety notes',
        tone: 'Warm and practical',
      });
    } else if (sys.includes('Outliner / Structurer Agent')) {
      if (user.includes('Improve this herbal book outline')) {
        content = '# Herbal Book\n\n## Vision\n- scope\n\n## Chapter 1 - Safety Foundations\n- intro\n\n## Chapter 2 - Core Herbs\n- materia medica\n';
      } else {
        content = 'Specific outline answer';
      }
    } else if (sys.includes('Chapter Annotator Agent')) {
      const titleMatch = /Chapter title:\s*(.+)/.exec(user);
      const title = titleMatch ? titleMatch[1].trim() : 'Chapter';
      content = `### ${title}\n\n- Chapter Objective\n- Core Sections\n- Safety and Contraindication Checks`;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [{ message: { content } }],
      }),
    });
  });
}

test('REG-SU-01 HBF.SU1 toggles API key visibility', async ({ page }) => {
  await gotoApp(page);
  await page.click('#tab-setup');

  const apiKey = page.locator('#api-key');
  await expect(apiKey).toHaveAttribute('type', 'password');
  await page.click('#api-key-toggle');
  await expect(apiKey).toHaveAttribute('type', 'text');
  await page.click('#api-key-toggle');
  await expect(apiKey).toHaveAttribute('type', 'password');
});

test('REG-SU-02 HBF.SU2 preferred model persists after reload', async ({ page }) => {
  await gotoApp(page);
  await page.click('#tab-setup');
  await page.selectOption('#preferred-model', 'grok-4-1-fast-reasoning');
  await page.reload();
  await page.click('#tab-setup');
  await expect(page.locator('#preferred-model')).toHaveValue('grok-4-1-fast-reasoning');
});

test('REG-BG-04 HBF.BG.G2 accept goals generates initial outline if empty', async ({ page }) => {
  await gotoApp(page);
  await page.click('#tab-goals');
  await page.click('button:has-text("Accept Goals")');
  await expect(page.locator('#outline-editor')).toBeVisible();
  await expect(page.locator('#outline-editor')).toContainText('## Chapter 1 - Foundations and Safety');
});

test('REG-OL-04 HBF.OL6 accept outline without key redirects to setup', async ({ page }) => {
  await gotoApp(page);
  await openOutline(page);
  await page.fill('#outline-editor', '## Chapter 1 - Test');

  const dialogPromise = page.waitForEvent('dialog');
  await page.click('#outline-accept-btn');
  const dialog = await dialogPromise;
  expect(dialog.message()).toContain('Add your Grok API key in Setup');
  await dialog.accept();

  await expect(page.locator('#tab-setup')).toHaveClass(/active/);
});

test('REG-OL-05 HBF.OL4 HBF.OL5 accept outline shows progress and completes', async ({ page }) => {
  await mockXaiEndpoints(page);
  await gotoApp(page);
  await setApiKey(page);
  await openOutline(page);

  await page.fill(
    '#outline-editor',
    '# Test\n\n## Vision\n- not chapter\n\n## Chapter 1 - Safety\n- a\n\n## Chapter 2 - Herbs\n- b\n'
  );

  await page.click('#outline-accept-btn');

  await expect(page.locator('#outline-generation-status')).toContainText('Generating chapter');
  await expect(page.locator('#outline-generation-status')).toContainText('Completed 2 chapter annotations.');
  await expect(page.locator('#tab-chapters')).toHaveClass(/active/);

  const cards = page.locator('#chapter-list .card');
  await expect(cards).toHaveCount(2);
});

test('REG-OL-06 parse only chapter headings into chapter cards', async ({ page }) => {
  await mockXaiEndpoints(page);
  await gotoApp(page);
  await setApiKey(page);
  await openOutline(page);

  await page.fill(
    '#outline-editor',
    '# Book\n\n## Vision\n- intro\n\n## Chapter 1 - One\n- item\n\n## Chapter 2 - Two\n- item\n'
  );

  await page.click('#outline-accept-btn');
  const chapterTitles = page.locator('[id^="chapter-title-"]');
  await expect(chapterTitles).toHaveCount(2);
});

test('REG-CH-02 HBF.CH3 HBF.CH5 chapter save persists edits', async ({ page }) => {
  await mockXaiEndpoints(page);
  await gotoApp(page);
  await setApiKey(page);
  await openOutline(page);
  await page.fill('#outline-editor', '## Chapter 1 - Save Test');
  await page.click('#outline-accept-btn');

  await page.fill('#chapter-title-0', 'Chapter 1 - Updated');
  await page.fill('#chapter-annotation-0', 'Updated annotation content');
  await page.click('button:has-text("Save")');

  await page.reload();
  await page.click('#tab-chapters');
  await expect(page.locator('#chapter-title-0')).toHaveValue('Chapter 1 - Updated');
  await expect(page.locator('#chapter-annotation-0')).toHaveValue('Updated annotation content');
});

test('REG-CH-03 HBF.CH4 chapter regenerate updates content', async ({ page }) => {
  await mockXaiEndpoints(page);
  await gotoApp(page);
  await setApiKey(page);
  await openOutline(page);
  await page.fill('#outline-editor', '## Chapter 1 - Regenerate Test');
  await page.click('#outline-accept-btn');

  await page.fill('#chapter-annotation-0', 'Old annotation');
  await page.click('button:has-text("Regenerate")');
  await expect(page.locator('#chapter-annotation-0')).toContainText('Chapter Objective');
});

test('REG-PE-01 HBF.PE1 HBF.PE2 prompt edits persist across reload', async ({ page }) => {
  await gotoApp(page);
  await page.click('#tab-prompts');

  await page.fill('#prompt-bookgoals', 'Book goals prompt test');
  await page.fill('#prompt-outliner', 'Outliner prompt test');
  await page.fill('#prompt-chapter-annotator', 'Chapter annotator prompt test');
  await page.fill('#prompt-drafter', 'Drafter prompt test');
  await page.fill('#prompt-safety', 'Safety prompt test');

  const dialogPromise = page.waitForEvent('dialog');
  await page.click('button:has-text("Save All Prompts")');
  const dialog = await dialogPromise;
  expect(dialog.message()).toContain('All agent prompts saved');
  await dialog.accept();

  await page.reload();
  await page.click('#tab-prompts');
  await expect(page.locator('#prompt-bookgoals')).toHaveValue('Book goals prompt test');
  await expect(page.locator('#prompt-outliner')).toHaveValue('Outliner prompt test');
  await expect(page.locator('#prompt-chapter-annotator')).toHaveValue('Chapter annotator prompt test');
});

test('REG-SU-06 HBF.SU6 export session initiates download', async ({ page }) => {
  await gotoApp(page);
  await page.click('#tab-setup');
  await page.fill('#project-name', 'Download Test Project');
  await page.locator('#project-name').dispatchEvent('input');

  const downloadPromise = page.waitForEvent('download');
  await page.click('button:has-text("Export")');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('_session.json');
});
