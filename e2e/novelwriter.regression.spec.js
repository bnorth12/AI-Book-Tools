const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '..', 'NovelWriter', 'NovelWriter.html');
const APP_URL = pathToFileURL(APP_PATH).toString();

async function gotoApp(page) {
  await page.goto(APP_URL);
  await expect(page.locator('h1')).toContainText('Novel Writer');
}

function mockXaiEndpoint(page) {
  return page.route('https://api.x.ai/v1/chat/completions', async route => {
    const req = route.request();
    const body = req.postDataJSON() || {};
    const messages = body.messages || [];
    const lastUser = messages[messages.length - 1]?.content || '';

    let content = 'Mock response';

    if (typeof lastUser === 'string' && lastUser.includes('"title": "<title>"')) {
      content = JSON.stringify({
        title: 'Smoke Test Novel',
        storyArc: 'A fragmented coalition must choose unity over control as a stellar threat escalates.',
        generalPlot:
          'After a failed terraforming experiment destabilizes a frontier system, rival factions race to contain a spreading anomaly before it consumes key trade routes. Alliances fracture, hidden agendas surface, and a reluctant scientist is forced into leadership to prevent civil collapse.',
        setting:
          'A chain of orbital habitats around a red-dwarf star, linked by fragile diplomacy and aging infrastructure.',
        styleGuide:
          'Use precise, sensory prose with strategic bursts of technical detail and emotionally grounded stakes.'
      });
    } else if (typeof lastUser === 'string' && lastUser.includes('"novelOutline": "<outline>"')) {
      content = JSON.stringify({
        novelOutline:
          'Act I: inciting anomaly and political fracture. Act II: failed containment attempts and escalating costs. Act III: high-risk coalition plan and resolution.',
        plotOutline:
          'Chapter beats track discovery, mistrust, tactical failures, and coordinated final action.',
        storyArcOutline:
          'Leadership evolves from avoidance to accountability, mirrored by coalition trust rebuilding.'
      });
    } else if (typeof lastUser === 'string' && lastUser.includes('Generate the first half of Chapter')) {
      // generateChapter Part 1
      content = JSON.stringify({
        chapter:
          'The habitat ring groaned under simulated gravity as Dr. Yeva Sorin pulled herself through the docking umbilical.\n\n' +
          'Pressure seals hissed behind her. Through the viewport, the red dwarf bled its dull light across the accretion belt like a wound that refused to close.\n\n' +
          'She checked her tablet: forty-eight hours until the anomaly front reached Pylon Seven. Forty-eight hours to convince three factions that cooperation was not surrender.\n\n' +
          '"They are already arguing about quorum," said Rask, her aide, appearing at her shoulder with the particular quietness that made her distrust him slightly.\n\n' +
          'Yeva exhaled. Outside, the old ore-processing drum that served as Pylon Council Hall rotated slowly, its lights a cold blue. Inside would be shouting.'
      });
    } else if (typeof lastUser === 'string' && lastUser.includes('Continue Chapter') && lastUser.includes('second half')) {
      // generateChapter Part 2
      content = JSON.stringify({
        chapter:
          'The second chamber fell quiet when Yeva raised her hand — not a gesture of authority, but of exhaustion.\n\n' +
          '"If we cannot agree on a perimeter protocol in the next hour," she said, "the anomaly will make the decision for us."\n\n' +
          'Faction representative Okafor pressed his palms flat against the table. His delegation from the Outer Ring had lost two platforms already.\n\n' +
          '"Give us the transponder codes," he said. "We will hold our own sector. You hold yours."\n\n' +
          'Yeva looked at the holographic spread: five sectors, three navies, one containment window. The math was impossible unless everyone moved together.\n\n' +
          '"There are no yours anymore," she said. "Only ours. And we are running out of time."'
      });
    } else if (typeof lastUser === 'string' && lastUser.includes('Current Chapter Content')) {
      // updateChapter
      content = JSON.stringify({
        chapter:
          'Revised: The habitat ring was quieter after the vote. Yeva stood at the viewport as the factions filed out, their silence heavier than any argument.\n\n' +
          'Rask handed her a summary tablet. The anomaly had slowed — slightly, barely — but enough to mean that the coalition had bought itself one more rotation.\n\n' +
          '"Was it worth it?" Rask asked.\n\n' +
          'She thought about the cost — the concessions, the pride spent like currency — and decided that the question itself was the luxury they could no longer afford.\n\n' +
          '"Ask me when it is over," she said, and turned back toward the council hall.'
      });
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content } }] })
    });
  });
}

test('NW-REG-01 loads and navigates primary tabs', async ({ page }) => {
  await gotoApp(page);

  await page.click('#nav button:has-text("2. Characters")');
  await expect(page.locator('#tab2')).toHaveClass(/active/);

  await page.click('#nav button:has-text("4. Outlines")');
  await expect(page.locator('#tab4')).toHaveClass(/active/);

  await page.click('#nav button:has-text("11. Agent Prompts")');
  await expect(page.locator('#tab11')).toHaveClass(/active/);
});

test('NW-REG-02 AI Suggest populates story fields with mocked API', async ({ page }) => {
  await mockXaiEndpoint(page);
  await gotoApp(page);

  await page.fill('#apiKey', 'gsk_test_key');
  await page.fill('#title', 'Temp');
  await page.click('button:has-text("AI Suggest")');

  await expect(page.locator('#title')).toHaveValue('Smoke Test Novel');
  await expect(page.locator('#storyArc')).toHaveValue(/fragmented coalition/);
  await expect(page.locator('#generalPlot')).toHaveValue(/terraforming experiment/);
  await expect(page.locator('#setting')).toHaveValue(/orbital habitats/);
  await expect(page.locator('#styleGuide')).toHaveValue(/sensory prose/);
});

test('NW-REG-03 Generate Novel Outlines populates all outline fields', async ({ page }) => {
  await mockXaiEndpoint(page);
  await gotoApp(page);

  await page.fill('#apiKey', 'gsk_test_key');
  await page.fill('#title', 'Outline Test');
  await page.fill('#storyArc', 'Coalition survival arc');
  await page.fill('#generalPlot', 'Plot baseline for test');
  await page.fill('#setting', 'Test habitat cluster');

  await page.click('#nav button:has-text("4. Outlines")');
  await page.click('button:has-text("AI Suggest Outlines")');

  await expect(page.locator('#novelOutline')).toHaveValue(/Act I/);
  await expect(page.locator('#plotOutline')).toHaveValue(/Chapter beats/);
  await expect(page.locator('#storyArcOutline')).toHaveValue(/Leadership evolves/);
});

test('NW-REG-04 Export Session triggers downloadable artifact', async ({ page }) => {
  await gotoApp(page);

  await page.fill('#title', 'Download Novel Session');
  await page.fill('#storyArc', 'Download path smoke test');

  const downloadPromise = page.waitForEvent('download');
  await page.click('button:has-text("Export Session")');
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/NovelWriter|novel/i);
  expect(download.suggestedFilename()).toMatch(/\.json$/i);
});

test('NW-REG-05 Session import populates story fields from schema envelope', async ({ page }) => {
  page.on('dialog', dialog => dialog.accept());
  await gotoApp(page);

  await page.evaluate(() => {
    const snapshot = {
      schemaVersion: '1.0',
      sourceTool: 'NovelWriter',
      sourceVersion: '0.3.4',
      novelData: {
        title: 'Imported Frontier Novel',
        storyArc: 'A coalition holds together long enough to survive.',
        generalPlot: 'Factions unite against a shared threat spanning the outer ring.',
        setting: 'Deep-space habitat cluster orbiting a red dwarf.',
        genre: 'scifi',
        numChapters: 3,
        chapterLength: 2000,
        authorStyle: 'nealstephenson',
        styleGuide: 'Precise technical prose with grounded emotional stakes.',
        authors: [],
        characters: [],
        subplots: ['The supply corridor is sabotaged from within.'],
        chapterOutlines: [],
        chapterArcs: [],
        chapters: [],
        editedChapters: [],
        bookImprovements: [],
        bookImprovementsWithStatus: [],
        chapterImprovements: [],
        novelOutline: 'Act I sets the stage. Act II escalates the anomaly threat. Act III resolves the coalition crisis.',
        plotOutline: 'Chapter beats build toward a climactic containment vote.',
        storyArcOutline: 'Leadership arc mirrors coalition trust rebuilding across three acts.'
      },
      requestLog: { status: 'Imported', lastPrompt: '', returnedInfo: '', tokenUsage: '', originTab: '' }
    };
    const mockFile = { content: JSON.stringify(snapshot) };
    const mockEvent = { target: { files: [mockFile] } };
    const origReadAsText = FileReader.prototype.readAsText;
    FileReader.prototype.readAsText = function (file) { this.onload({ target: { result: file.content } }); };
    importSession(mockEvent);
    FileReader.prototype.readAsText = origReadAsText;
  });

  await expect(page.locator('#title')).toHaveValue('Imported Frontier Novel');
  await expect(page.locator('#storyArc')).toHaveValue(/coalition holds together/);
  await expect(page.locator('#novelOutline')).toHaveValue(/Act I sets the stage/);
  await expect(page.locator('#plotOutline')).toHaveValue(/climactic containment vote/);
});

test('NW-REG-06 Generate Chapter populates chapter content via mocked API', async ({ page }) => {
  await mockXaiEndpoint(page);
  await gotoApp(page);

  await page.fill('#apiKey', 'gsk_test_key');
  await page.fill('#title', 'Frontier Novel');
  await page.fill('#storyArc', 'Coalition survival arc against an anomaly threat.');
  await page.fill('#generalPlot', 'Rival factions negotiate containment before the anomaly consumes Pylon Seven.');
  await page.fill('#setting', 'Orbital habitat cluster around a red dwarf, aging infrastructure.');
  await page.fill('#numChapters', '1');
  await page.dispatchEvent('#numChapters', 'change');

  await page.click('#nav button:has-text("5. Generate Chapters")');
  await page.evaluate(() => generateChapter(1));

  await expect(page.locator('#chapterGenContent1')).not.toBeEmpty();
  const content = await page.locator('#chapterGenContent1').inputValue();
  expect(content.length).toBeGreaterThan(200);
  expect(content).toContain('habitat');
  expect(content).toContain('Yeva');
});

test('NW-REG-07 Update Chapter revises chapter content via mocked API', async ({ page }) => {
  await mockXaiEndpoint(page);
  await gotoApp(page);

  await page.fill('#apiKey', 'gsk_test_key');
  await page.fill('#title', 'Edit Test Novel');
  await page.fill('#storyArc', 'Coalition survival under mounting pressure.');
  await page.fill('#generalPlot', 'Three factions negotiate a fragile truce against a growing anomaly.');
  await page.fill('#setting', 'Orbital ring with aging infrastructure and contested supply lanes.');
  await page.fill('#numChapters', '1');
  await page.dispatchEvent('#numChapters', 'change');

  await page.click('#nav button:has-text("6. Edit Chapters")');

  await page.evaluate(() => {
    novelData.chapters[0] = 'Original chapter content before edits.';
    document.getElementById('chapterEditContent1').value = 'Original chapter content before edits.';
    document.getElementById('chapterEditImprovement1').value = 'Add more tension in the negotiation scene and deepen Yeva character arc.';
  });

  await page.evaluate(() => updateChapter(1));

  const edited = await page.locator('#chapterEditContent1').inputValue();
  expect(edited.length).toBeGreaterThan(50);
  expect(edited).not.toBe('Original chapter content before edits.');
  expect(edited).toContain('Revised');
});

test('NW-REG-08 Export Session produces schema-compliant JSON without sensitive fields', async ({ page }) => {
  await gotoApp(page);

  await page.evaluate(() => {
    document.getElementById('apiKey').value = 'sk-secret-key-should-not-export';
    document.getElementById('title').value = 'Schema Validation Novel';
    document.getElementById('storyArc').value = 'A test of schema compliance.';
    document.getElementById('genre').value = 'scifi';
  });

  // Intercept the download by patching Blob/URL.createObjectURL in-page
  const exportedJson = await page.evaluate(() => {
    return new Promise((resolve) => {
      const origCreateObjectURL = URL.createObjectURL;
      URL.createObjectURL = function (blob) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsText(blob);
        URL.createObjectURL = origCreateObjectURL;
        return 'blob:mock';
      };
      exportSession();
    });
  });

  const parsed = JSON.parse(exportedJson);

  // Required schema envelope fields
  expect(parsed.schemaVersion).toBe('1.0');
  expect(parsed.sourceTool).toBe('NovelWriter');
  expect(typeof parsed.sourceVersion).toBe('string');
  expect(typeof parsed.exportedAt).toBe('string');
  expect(parsed.novelData).toBeDefined();
  expect(typeof parsed.novelData).toBe('object');

  // novelData must contain core story fields
  expect(parsed.novelData).toHaveProperty('title', 'Schema Validation Novel');
  expect(parsed.novelData).toHaveProperty('genre');
  expect(parsed.novelData).toHaveProperty('storyArc');
  expect(Array.isArray(parsed.novelData.characters)).toBe(true);
  expect(Array.isArray(parsed.novelData.subplots)).toBe(true);
  expect(Array.isArray(parsed.novelData.chapters)).toBe(true);
  expect(parsed.novelData).toHaveProperty('requestLog');

  // Sensitive and operational fields must NOT be present in novelData
  expect(parsed.novelData).not.toHaveProperty('apiKey');
  expect(parsed.novelData).not.toHaveProperty('model');
  expect(parsed.novelData).not.toHaveProperty('maxTokens');
  expect(parsed.novelData).not.toHaveProperty('chapterImprovements');
  expect(parsed.novelData).not.toHaveProperty('bookImprovements');
  expect(parsed.novelData).not.toHaveProperty('novelOutline');
  expect(parsed.novelData).not.toHaveProperty('plotOutline');
  expect(parsed.novelData).not.toHaveProperty('storyArcOutline');
  expect(parsed.novelData).not.toHaveProperty('authors');

  // requestLog must NOT be duplicated at root level
  expect(parsed).not.toHaveProperty('requestLog');
});
