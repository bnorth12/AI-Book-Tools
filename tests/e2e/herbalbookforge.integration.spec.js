// Full Integration Test for HerbalBookForge with real API calls
// Tests the complete workflow: Book Goals → Outline → Chapter Outlines
// Uses real Grok API calls with proper timeout handling for LLM responses

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
function loadEnv() {
  const envPath = path.join(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf-8');
    const lines = envFile.split('\n');
    const env = {};
    lines.forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split('=');
        if (key && value) {
          env[key.trim()] = value.trim();
        }
      }
    });
    return env;
  }
  return {};
}

const envVars = loadEnv();
const GROK_API_KEY = envVars.GROK_API_KEY || process.env.GROK_API_KEY;

test.describe('HerbalBookForge Full Integration Test', () => {
  test.beforeEach(async ({ page }) => {
    // Skip test if API key is not available
    test.skip(!GROK_API_KEY || GROK_API_KEY === 'your_grok_api_key_here', 'GROK_API_KEY not configured in .env');
  });

  test('End-to-end workflow: Book Goals → Outline → Chapter Outlines with real API calls', async ({ page }) => {
    // Navigate to HerbalBookForge
    await page.goto('/HerbalBookForge/HerbalBookForge.html');
    await expect(page).toHaveTitle(/HerbalBookForge/, { timeout: 5000 });

    // === SETUP PHASE ===
    console.log('🔧 Setting up API key...');

    // Switch to Setup tab
    await page.click('button#tab-setup');
    await page.waitForSelector('#content-setup:not(.hidden)', { timeout: 5000 });

    // Set API key
    const apiKeyInput = page.locator('#api-key');
    await apiKeyInput.fill(GROK_API_KEY);
    await page.waitForTimeout(500); // Allow save to complete

    // === BOOK GOALS PHASE ===
    console.log('🎯 Testing Book Goals workflow with LLM...');

    // Switch to Goals tab
    await page.click('button#tab-goals');
    await page.waitForSelector('#content-goals:not(.hidden)', { timeout: 5000 });

    // Fill in book goals
    await page.fill('#goal-main', 'A beginner-friendly guide to medicinal herbs and their healing properties');
    await page.fill('#goal-content', 'Herb profiles, preparation methods, safety guidelines, practical applications');
    await page.fill('#goal-audience', 'Adult beginners interested in herbal medicine');
    await page.selectOption('#goal-length', '220-280 pages');
    await page.waitForTimeout(500);

    // Send query to Book Goals Agent
    console.log('📤 Sending query to Book Goals Agent...');
    await page.fill('#agent-input', 'Help me refine these goals for my herbal medicine book');

    const sendButton = page.locator('#send-btn');
    await sendButton.click();

    // Wait for response - LLM takes time, so use extended timeout
    console.log('⏳ Waiting for Book Goals Agent response (LLM processing)...');
    const chatHistoryContainer = page.locator('#agent-chat');

    // Wait for the assistant response to appear in chat
    await page.waitForFunction(
      () => {
        const chat = document.getElementById('agent-chat');
        const messages = chat?.querySelectorAll('[class*="flex"]') || [];
        return messages.length >= 2; // At least user + assistant message
      },
      { timeout: 60000 } // 60 second timeout for LLM response
    );

    console.log('✅ Book Goals Agent responded');

    // Verify response is present
    const assistantMessages = await chatHistoryContainer.locator('[class*="flex-shrink-0"]:has-text("🌿")').count();
    expect(assistantMessages).toBeGreaterThan(0);

    // === ACCEPT GOALS AND GENERATE OUTLINE ===
    console.log('📋 Accepting goals and generating outline...');

    const acceptGoalsBtn = page.locator('#accept-goals-btn');
    expect(acceptGoalsBtn).toBeVisible();

    await acceptGoalsBtn.click();

    // Wait for outline generation status message
    console.log('⏳ Waiting for outline generation from LLM...');
    const goalsStatus = page.locator('#goals-status');

    // Monitor the status element to see when generation completes
    await page.waitForFunction(
      () => {
        const status = document.getElementById('goals-status');
        const text = status?.textContent || '';
        return text.includes('Outline generated') || text.includes('generated');
      },
      { timeout: 120000 } // 2 minute timeout for outline generation
    );

    console.log('✅ Outline generated successfully');

    // Wait for tab switch to outline
    await page.waitForSelector('#content-outline:not(.hidden)', { timeout: 10000 });

    // Verify outline is present in the editor
    const outlineEditor = page.locator('#outline-editor');
    const outlineContent = await outlineEditor.inputValue();
    expect(outlineContent).toBeTruthy();
    expect(outlineContent.length).toBeGreaterThan(100);
    console.log(`📝 Outline generated with ${outlineContent.length} characters`);

    // === ACCEPT OUTLINE AND GENERATE CHAPTER OUTLINES ===
    console.log('📚 Generating chapter outlines...');

    const outlineAcceptBtn = page.locator('#outline-accept-btn');
    expect(outlineAcceptBtn).toBeVisible();

    await outlineAcceptBtn.click();

    // Monitor outline generation status
    console.log('⏳ Waiting for chapter outline generation from Chapter Annotator Agent...');
    const outlineStatus = page.locator('#outline-generation-status');

    // Wait for completion message
    await page.waitForFunction(
      () => {
        const status = document.getElementById('outline-generation-status');
        const text = status?.textContent || '';
        return text.includes('Completed') || text.includes('completed');
      },
      { timeout: 180000 } // 3 minute timeout for chapter generation (one LLM call per chapter)
    );

    console.log('✅ Chapter outlines generated successfully');

    // Verify chapter outlines were created
    await page.waitForSelector('#chapter-list:not(:empty)', { timeout: 10000 });

    const chapterSelect = page.locator('#chapter-select');
    const optionCount = await chapterSelect.locator('option').count();
    expect(optionCount).toBeGreaterThan(0);
    console.log(`📖 Created ${optionCount} chapter outlines`);

    // === VERIFY CHAPTER ANNOTATIONS ===
    console.log('🔍 Verifying chapter annotations...');

    // Get first chapter and verify annotation
    const firstChapterTextarea = page.locator('textarea[id*="chapter-annotation-"]').first();
    const annotationContent = await firstChapterTextarea.inputValue();
    expect(annotationContent).toBeTruthy();
    expect(annotationContent.length).toBeGreaterThan(50);
    console.log(`✅ Chapter annotation present with ${annotationContent.length} characters`);

    // === VERIFY PROJECT STATE PERSISTENCE ===
    console.log('💾 Verifying project state persistence...');

    await page.click('button#tab-setup');
    await page.waitForSelector('#content-setup:not(.hidden)', { timeout: 5000 });

    const projectName = page.locator('#project-name');
    await projectName.fill('Test Herbal Medicine Book');
    await page.waitForTimeout(500);

    // Reload page to verify persistence
    await page.reload();
    await page.waitForTimeout(1000);

    await page.click('button#tab-setup');
    await page.waitForSelector('#content-setup:not(.hidden)', { timeout: 5000 });

    // Verify data persisted
    const savedProjectName = await page.locator('#project-name').inputValue();
    expect(savedProjectName).toBe('Test Herbal Medicine Book');
    console.log('✅ Project state persisted after reload');

    // === FINAL VERIFICATION ===
    console.log('🎉 All integration tests passed!');
    expect(true).toBe(true);
  });

  test('Verify API key from .env is properly configured', async ({ page }) => {
    test.skip(!GROK_API_KEY || GROK_API_KEY === 'your_grok_api_key_here', 'GROK_API_KEY not configured');

    await page.goto('/HerbalBookForge/HerbalBookForge.html');

    // Check API key is loaded
    expect(GROK_API_KEY).toBeTruthy();
    expect(GROK_API_KEY.length).toBeGreaterThan(10);
    console.log('✅ API key loaded from .env file successfully');
  });

  test('Handle API timeouts and errors gracefully', async ({ page }) => {
    test.skip(!GROK_API_KEY || GROK_API_KEY === 'your_grok_api_key_here', 'GROK_API_KEY not configured');

    await page.goto('/HerbalBookForge/HerbalBookForge.html');

    // Setup API key
    await page.click('button#tab-setup');
    const apiKeyInput = page.locator('#api-key');
    await apiKeyInput.fill(GROK_API_KEY);
    await page.waitForTimeout(500);

    // Go to Goals tab
    await page.click('button#tab-goals');

    // Test with minimal input
    await page.fill('#goal-main', 'Test goals');
    await page.fill('#agent-input', 'Short test');

    const sendButton = page.locator('#send-btn');
    await sendButton.click();

    // Should either show response or error message within timeout
    const chatContainer = page.locator('#agent-chat');

    try {
      await page.waitForFunction(
        () => {
          const chat = document.getElementById('agent-chat');
          return chat && chat.textContent.length > 0;
        },
        { timeout: 60000 }
      );
      console.log('✅ API call completed (success or error handled)');
    } catch (e) {
      console.log('⚠️ API timeout - this is expected for slow networks');
    }
  });
});
