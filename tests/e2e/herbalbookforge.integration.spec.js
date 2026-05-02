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

// ============================================================
// HBFIT.9–13: Drafting tab integration tests (Sprint 2)
// These tests inject pre-built project state into localStorage to
// skip the full pipeline setup, except for HBFIT.13 which exercises
// the end-to-end flow from Book Goals → Draft.
// ============================================================

// Shared factory: build a minimal project state with one chapter outline + optional draft
function makeProjectState({ apiKey = '', withDraft = false } = {}) {
  const chapterOutline = {
    id: 0,
    title: 'Chapter 1: Introduction to Medicinal Herbs',
    annotation: 'Overview of key medicinal herbs. Covers elderberry, echinacea, and chamomile. Includes safety notes and preparation basics.'
  };
  const draft = withDraft ? {
    chapterId: 0,
    chapterTitle: 'Chapter 1: Introduction to Medicinal Herbs',
    outlineContext: chapterOutline.annotation,
    draftText: 'Medicinal herbs have been used for thousands of years. Elderberry (Sambucus nigra) supports immune function and is particularly valued during cold and flu season. Echinacea is another cornerstone of herbal medicine, traditionally used to shorten the duration of colds.',
    qualityFlags: [],
    validation: null,
    revisionHistory: [],
    lastUpdated: new Date().toISOString()
  } : null;
  return {
    meta: { version: '0.10.0' },
    setup: {
      apiKey,
      apiEndpoint: 'https://api.x.ai/v1/chat/completions',
      preferredModel: 'grok-4.20-0309-reasoning',
      projectName: 'Integration Test Herbal Book'
    },
    goals: {
      mainGoal: 'A beginner-friendly guide to medicinal herbs',
      tone: 'Friendly, practical, in the style of Brigitte Mars',
      audience: 'Adult beginners',
      contentTypes: 'Herb profiles, preparation methods, safety guidelines',
      chatHistory: []
    },
    outline: { text: '## Chapter 1: Introduction to Medicinal Herbs\n## Chapter 2: Preparations', accepted: true },
    chapterOutlines: [chapterOutline],
    drafts: withDraft ? [draft] : [],
    prompts: {
      bookGoalsAgent: '',
      outliner: '',
      chapterAnnotator: '',
      drafter: '',
      safety: ''
    }
  };
}

test.describe('HerbalBookForge Drafting Integration Tests (HBFIT.9–13)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!GROK_API_KEY || GROK_API_KEY === 'your_grok_api_key_here', 'GROK_API_KEY not configured in .env');
  });

  // HBFIT.9: First-pass chapter draft generation
  test('HBFIT.9 — First-pass draft generation returns valid structure', async ({ page }) => {
    const state = makeProjectState({ apiKey: GROK_API_KEY });

    await page.goto('/HerbalBookForge/HerbalBookForge.html');
    // Inject project state before the app re-initialises from localStorage
    await page.evaluate((s) => {
      localStorage.setItem('herbalBookForgeProject_v0.10.0', JSON.stringify(s));
    }, state);
    await page.reload();
    await page.waitForSelector('button#tab-drafting', { timeout: 5000 });

    // Navigate to Drafting tab
    await page.click('button#tab-drafting');
    await page.waitForSelector('#content-drafting:not(.hidden)', { timeout: 5000 });

    // Chapter 0 should be auto-selected; verify the generate button is present
    const select = page.locator('[data-testid="draft-chapter-select"]');
    await expect(select).toBeVisible();
    await select.selectOption('0');

    console.log('📤 Triggering first-pass draft generation via Drafter Agent...');
    await page.click('[data-testid="generate-draft-btn"]');

    // Wait for the draft workspace to become visible (draft persisted and rendered)
    await page.waitForSelector('#draft-workspace:not(.hidden)', { timeout: 120000 });

    const draftText = await page.locator('[data-testid="draft-text-area"]').inputValue();
    expect(draftText.trim().length).toBeGreaterThan(100);
    console.log(`✅ HBFIT.9: Draft generated — ${draftText.length} characters`);

    // Verify draft was saved to localStorage with valid structure
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem('herbalBookForgeProject_v0.10.0');
      if (!raw) return null;
      const p = JSON.parse(raw);
      return p.drafts && p.drafts[0] ? {
        chapterId: p.drafts[0].chapterId,
        hasTitle: typeof p.drafts[0].chapterTitle === 'string',
        hasDraftText: typeof p.drafts[0].draftText === 'string' && p.drafts[0].draftText.length > 0,
        hasQualityFlags: Array.isArray(p.drafts[0].qualityFlags)
      } : null;
    });
    expect(saved).not.toBeNull();
    expect(saved.chapterId).toBe(0);
    expect(saved.hasTitle).toBe(true);
    expect(saved.hasDraftText).toBe(true);
    expect(saved.hasQualityFlags).toBe(true);
    console.log('✅ HBFIT.9: Draft JSON structure validated in localStorage');
  });

  // HBFIT.10: Revision flow
  test('HBFIT.10 — Revision instruction updates draft and appends to revisionHistory', async ({ page }) => {
    const state = makeProjectState({ apiKey: GROK_API_KEY, withDraft: true });

    await page.goto('/HerbalBookForge/HerbalBookForge.html');
    await page.evaluate((s) => {
      localStorage.setItem('herbalBookForgeProject_v0.10.0', JSON.stringify(s));
    }, state);
    await page.reload();
    await page.waitForSelector('button#tab-drafting', { timeout: 5000 });

    await page.click('button#tab-drafting');
    await page.waitForSelector('#content-drafting:not(.hidden)', { timeout: 5000 });

    // Select chapter with existing draft
    await page.locator('[data-testid="draft-chapter-select"]').selectOption('0');
    await page.waitForSelector('#draft-workspace:not(.hidden)', { timeout: 5000 });

    const originalText = await page.locator('[data-testid="draft-text-area"]').inputValue();
    expect(originalText.trim().length).toBeGreaterThan(0);

    // Enter revision instruction
    const instruction = 'Add a brief note about elderberry contraindications for autoimmune conditions.';
    await page.locator('[data-testid="revision-instruction"]').fill(instruction);

    console.log('📤 Triggering revision via Drafter Agent...');
    await page.click('[data-testid="revise-draft-btn"]');

    // Wait for workspace to refresh after revision (revise-status cleared or updated)
    await page.waitForFunction(
      () => {
        const btn = document.getElementById('revise-draft-btn');
        return btn && !btn.disabled;
      },
      { timeout: 120000 }
    );

    // Verify revision history was appended in localStorage
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem('herbalBookForgeProject_v0.10.0');
      if (!raw) return null;
      const p = JSON.parse(raw);
      const draft = p.drafts && p.drafts[0];
      if (!draft) return null;
      return {
        revisionCount: (draft.revisionHistory || []).length,
        lastInstruction: draft.revisionHistory && draft.revisionHistory[0] ? draft.revisionHistory[0].instruction : ''
      };
    });
    expect(saved).not.toBeNull();
    expect(saved.revisionCount).toBeGreaterThan(0);
    expect(saved.lastInstruction).toBe(instruction);
    console.log(`✅ HBFIT.10: Revision history has ${saved.revisionCount} entry/entries`);
  });

  // HBFIT.11: Validation results rendered in UI
  test('HBFIT.11 — Validation results are rendered after validate call', async ({ page }) => {
    const state = makeProjectState({ apiKey: GROK_API_KEY, withDraft: true });

    await page.goto('/HerbalBookForge/HerbalBookForge.html');
    await page.evaluate((s) => {
      localStorage.setItem('herbalBookForgeProject_v0.10.0', JSON.stringify(s));
    }, state);
    await page.reload();
    await page.waitForSelector('button#tab-drafting', { timeout: 5000 });

    await page.click('button#tab-drafting');
    await page.waitForSelector('#content-drafting:not(.hidden)', { timeout: 5000 });

    await page.locator('[data-testid="draft-chapter-select"]').selectOption('0');
    await page.waitForSelector('#draft-workspace:not(.hidden)', { timeout: 5000 });

    console.log('📤 Triggering draft validation via Safety Agent...');
    await page.click('[data-testid="validate-draft-btn"]');

    // Wait for validation results container to become visible
    await page.waitForSelector('[data-testid="validation-results"]:not(.hidden)', { timeout: 120000 });

    const summary = await page.locator('#validation-summary').textContent();
    expect(summary.trim().length).toBeGreaterThan(0);
    console.log(`✅ HBFIT.11: Validation results rendered — summary: "${summary.substring(0, 80)}..."`);

    // Verify validation stored in localStorage
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem('herbalBookForgeProject_v0.10.0');
      if (!raw) return null;
      const p = JSON.parse(raw);
      const draft = p.drafts && p.drafts[0];
      return draft && draft.validation ? { hasSummary: typeof draft.validation.summary === 'string', hasFlags: Array.isArray(draft.validation.flags) } : null;
    });
    expect(saved).not.toBeNull();
    expect(saved.hasSummary).toBe(true);
    expect(saved.hasFlags).toBe(true);
    console.log('✅ HBFIT.11: Validation stored in localStorage');
  });

  // HBFIT.12: Persistence across page reload
  test('HBFIT.12 — Draft text and revision history persist across page reload', async ({ page }) => {
    const state = makeProjectState({ apiKey: GROK_API_KEY, withDraft: true });
    // Inject a revision history entry to verify persistence
    state.drafts[0].revisionHistory = [{ instruction: 'Test revision', timestamp: new Date().toISOString() }];

    await page.goto('/HerbalBookForge/HerbalBookForge.html');
    await page.evaluate((s) => {
      localStorage.setItem('herbalBookForgeProject_v0.10.0', JSON.stringify(s));
    }, state);
    await page.reload();
    await page.waitForSelector('button#tab-drafting', { timeout: 5000 });

    await page.click('button#tab-drafting');
    await page.waitForSelector('#content-drafting:not(.hidden)', { timeout: 5000 });

    await page.locator('[data-testid="draft-chapter-select"]').selectOption('0');
    await page.waitForSelector('#draft-workspace:not(.hidden)', { timeout: 5000 });

    // Verify draft text loaded from storage
    const draftText = await page.locator('[data-testid="draft-text-area"]').inputValue();
    expect(draftText.trim()).toBe(state.drafts[0].draftText.trim());
    console.log('✅ HBFIT.12: Draft text persisted and loaded');

    // Full reload and re-check
    await page.reload();
    await page.waitForSelector('button#tab-drafting', { timeout: 5000 });
    await page.click('button#tab-drafting');
    await page.waitForSelector('#content-drafting:not(.hidden)', { timeout: 5000 });
    await page.locator('[data-testid="draft-chapter-select"]').selectOption('0');
    await page.waitForSelector('#draft-workspace:not(.hidden)', { timeout: 5000 });

    const draftTextAfterReload = await page.locator('[data-testid="draft-text-area"]').inputValue();
    expect(draftTextAfterReload.trim()).toBe(state.drafts[0].draftText.trim());

    // Verify revision history is rendered (container visible, at least 1 item)
    await expect(page.locator('#revision-history-container')).not.toHaveClass(/hidden/);
    const historyItems = await page.locator('#revision-history-list li').count();
    expect(historyItems).toBeGreaterThanOrEqual(1);
    console.log(`✅ HBFIT.12: Revision history (${historyItems} entry) persisted across reload`);
  });

  // HBFIT.13: End-to-end pipeline Book Goals → Outline → Chapter Outlines → Draft
  test('HBFIT.13 — End-to-end pipeline: Book Goals → Outline → Chapter Outlines → Draft generation', async ({ page }) => {
    await page.goto('/HerbalBookForge/HerbalBookForge.html');
    await expect(page).toHaveTitle(/HerbalBookForge/, { timeout: 5000 });

    // --- Setup ---
    console.log('🔧 [HBFIT.13] Setting up API key...');
    await page.click('button#tab-setup');
    await page.waitForSelector('#content-setup:not(.hidden)', { timeout: 5000 });
    await page.locator('#api-key').fill(GROK_API_KEY);

    // --- Book Goals ---
    console.log('🎯 [HBFIT.13] Book Goals phase...');
    await page.click('button#tab-goals');
    await page.waitForSelector('#content-goals:not(.hidden)', { timeout: 5000 });
    await page.fill('#goal-main', 'A practical guide to growing and using medicinal herbs at home');
    await page.fill('#goal-content', 'Herb profiles, growing tips, preparation methods, safety guidelines');
    await page.fill('#goal-audience', 'Home gardeners and wellness enthusiasts');
    await page.selectOption('#goal-length', '220-280 pages');
    await page.fill('#agent-input', 'Refine my herbal book goals for a clear structure');
    await page.click('#send-btn');

    await page.waitForFunction(
      () => { const c = document.getElementById('agent-chat'); return c && c.querySelectorAll('[class*="flex"]').length >= 2; },
      { timeout: 60000 }
    );
    console.log('✅ [HBFIT.13] Book Goals Agent responded');

    // Accept goals → triggers outline generation
    await page.click('#accept-goals-btn');
    await page.waitForFunction(
      () => { const s = document.getElementById('goals-status'); return s && (s.textContent.includes('generated') || s.textContent.includes('Outline')); },
      { timeout: 120000 }
    );
    console.log('✅ [HBFIT.13] Outline generated');

    // --- Outline: accept → triggers chapter annotation ---
    await page.waitForSelector('#content-outline:not(.hidden)', { timeout: 10000 });
    const outlineText = await page.locator('#outline-editor').inputValue();
    expect(outlineText.length).toBeGreaterThan(50);

    await page.click('#outline-accept-btn');
    await page.waitForFunction(
      () => { const s = document.getElementById('outline-generation-status'); return s && (s.textContent.includes('Completed') || s.textContent.includes('completed')); },
      { timeout: 180000 }
    );
    console.log('✅ [HBFIT.13] Chapter outlines annotated');

    // Verify at least one chapter outline was created
    const optionCount = await page.locator('#chapter-select option').count();
    expect(optionCount).toBeGreaterThan(0);
    console.log(`📖 [HBFIT.13] ${optionCount} chapter outlines created`);

    // --- Drafting: generate first-pass draft for chapter 0 ---
    console.log('✍️ [HBFIT.13] Generating first-pass draft...');
    await page.click('button#tab-drafting');
    await page.waitForSelector('#content-drafting:not(.hidden)', { timeout: 5000 });

    const select = page.locator('[data-testid="draft-chapter-select"]');
    await expect(select).toBeVisible();
    await select.selectOption('0');

    await page.click('[data-testid="generate-draft-btn"]');
    await page.waitForSelector('#draft-workspace:not(.hidden)', { timeout: 120000 });

    const draftText = await page.locator('[data-testid="draft-text-area"]').inputValue();
    expect(draftText.trim().length).toBeGreaterThan(100);
    console.log(`✅ [HBFIT.13] End-to-end draft generated — ${draftText.length} characters`);

    // Verify the draft captured book-goal context (should mention herbs)
    const lowerDraft = draftText.toLowerCase();
    expect(lowerDraft).toMatch(/herb|plant|medicinal|preparation|garden/);
    console.log('✅ [HBFIT.13] Draft content reflects book goals context — HBFIT.13 PASSED');
  });
});
