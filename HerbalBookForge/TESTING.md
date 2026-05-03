# HerbalBookForge Testing Guide

**Version**: v1.0.0 | **Updated**: 2026-05-02 (v1.0.0 GA)

## Overview

HerbalBookForge includes comprehensive test coverage spanning smoke tests, regression tests, and full integration tests with real LLM API calls.

## Test Suites

### 1. Smoke Tests (`herbalbookforge.smoke.spec.js`)

**Purpose**: Quick validation of core UI elements, tab navigation, Drafting/Safety/Preview control presence

**Tests** (8 total — 4 core + 2 Sprint 5 + 2 Sprint 6):

#### Test 1 — App loads and shows main tabs

- All 7 main tab buttons are visible (`tab-goals`, `tab-outline`, `tab-chapter-outlines`, `tab-drafting`, `tab-prompts`, `tab-safety`, `tab-preview`)

#### Test 2 — Drafting tab renders all required controls (HBF.DR8)

Switches to the Drafting tab and asserts the following `data-testid` attributes are present in the DOM:

| `data-testid` | Element | Always visible? |
|---|---|---|
| `draft-chapter-select` | Chapter dropdown | ✅ Yes |
| `generate-draft-btn` | Generate Draft button | ✅ Yes |
| `draft-status` | Status message span | Attached |
| `draft-text-area` | Editable draft textarea | Attached (hidden until draft exists) |
| `save-draft-btn` | Save Draft button | Attached |
| `revision-instruction` | Revision instruction textarea | Attached |
| `revise-draft-btn` | Revise Draft button | Attached |
| `revise-status` | Revise status span | Attached |
| `validate-draft-btn` | Validate Draft button | Attached |
| `validate-status` | Validate status span | Attached |
| `validation-results` | Validation results panel | Attached |

#### Test 3 — Safety tab renders all required controls (HBF.SA6)

Switches to the Safety tab and asserts the following `data-testid` attributes are present in the DOM:

| `data-testid` | Element | Notes |
|---|---|---|
| `safety-scope-select` | Scan scope dropdown | Attached (visible when drafts exist) |
| `safety-scan-btn` | Run Safety Scan button | Attached |
| `safety-status` | Status/progress indicator | Attached |
| `safety-report` | Safety report panel | Attached (hidden until scan completes) |
| `safety-empty-state` | No-drafts empty state | Attached (visible when no drafts) |

#### Test 4 — Preview tab renders all required controls (Sprint 4)

Switches to the Preview tab and asserts the following `data-testid` attributes:

| `data-testid` | Element | Notes |
|---|---|---|
| `preview-assemble-btn` | Assemble Manuscript button | Visible |
| `preview-export-md-btn` | Export Markdown button | Visible |
| `preview-export-html-btn` | Export Printable HTML button | Visible |
| `preview-export-rtf-btn` | Export RTF button | Visible |
| `preview-empty-state` | Preview empty state panel | Visible before assembly |
| `preview-content` | Preview content container | Attached (shown after assembly) |

#### Test 5 — Drafting tab renders Generate Remaining button (HBF.DR9, Sprint 5)

Switches to the Drafting tab and asserts:

- `generate-remaining-btn` is visible (blue button labeled "📚 Generate Remaining")
- Validates Sprint 5 Generate Remaining Chapters feature is present

#### Test 6 — Setup tab renders export/import controls (Sprint 5)

Switches to the Setup tab and asserts export/import controls:

| `data-testid` | Element |
|---|---|
| `export-project-btn` | Export Project button |
| `import-project-input` | Import Project file input |

**Run time**: ~15-20 seconds

**Command**:

```bash

npx playwright test --project=herbalbookforge-smoke

```

#### Test 7 — Prompts tab appears after Preview in DOM order (HBFST.7, Sprint 6)

Verifies tab navigation order:

- `#tab-preview` precedes `#tab-prompts` in DOM order
- `[data-testid="footer-status-label"]` is attached and contains author-facing text (matches `/author/i`)

#### Test 8 — Export and Import controls have semantic aria-labels (HBFST.8, Sprint 6)

- `[data-testid="export-project-btn"]` has an `aria-label` containing "Export"
- An element with `aria-label` containing "Import" is present in the DOM

**Run time**: ~20-25 seconds

**Command**:

```bash

npx playwright test --project=herbalbookforge-smoke

```

**Status**: ✅ Passing (8/8)

---

### 2. Integration Tests (`herbalbookforge.integration.spec.js`)

**Purpose**: End-to-end workflow validation with real Grok API calls

#### Test 1: Full Workflow with Real API Calls

**Workflow**:

1. **Setup Phase** (~30 seconds)
   - Navigate to HerbalBookForge
   - Load API key from `.env` file
   - Switch to Setup tab and enter API key

2. **Book Goals Phase** (~45 seconds)
   - Fill in book goals (main goal, content types, audience, length)
   - Send query to Book Goals Agent
   - **Wait up to 60 seconds** for LLM response
   - Verify response structure

3. **Accept Goals & Generate Outline** (~120 seconds)
   - Click "Accept Goals" button
   - **Wait up to 120 seconds** for LLM to generate outline
   - Verify outline is present and contains meaningful content (>100 chars)

4. **Generate Chapter Outlines** (~180 seconds)
   - Accept outline
   - **Wait up to 180 seconds** for Chapter Annotator Agent
   - Verify chapter dropdown populated with chapters
   - Verify chapter annotations are present and meaningful (>50 chars)

5. **Project Persistence** (~5 seconds)
   - Edit project name
   - Reload page
   - Verify project name persists in localStorage

**Total time**: ~6-7 minutes (depends on LLM response times)

**Command**:

```bash

npx playwright test --project=herbalbookforge-integration

```

**Environment Setup**:

```bash

# Create .env file with your API key

echo "GROK_API_KEY=your_grok_api_key_here" > .env

```

**Requirements**:

- Active Grok API key in `.env` file
- Network access to `https://api.x.ai/v1/chat/completions`
- 10+ minute timeout allocation for all tests

#### Test 2: API Key Configuration Validation

**Purpose**: Verify `.env` file is properly loaded

**What it checks**:

- GROK_API_KEY environment variable is available
- API key has sufficient length (>10 chars)

**Skips** if API key not configured

#### Test 3: Error Handling

**Purpose**: Verify graceful handling of API timeouts and errors

**What it tests**:

- Minimal queries don't crash the application
- Error messages display properly
- UI remains responsive

---

### 3. Drafting Tab Integration Tests (`herbalbookforge.integration.spec.js`) — Sprint 2 (HBFIT.9–13)

**Purpose**: Validate the full Drafting tab pipeline — generation, revision, validation, persistence, and end-to-end context flow

**All tests skip gracefully if `GROK_API_KEY` is not configured.**

A shared helper `makeProjectState()` injects a minimal pre-built project state (one chapter outline ± draft) into `localStorage` before each test, avoiding full pipeline setup for isolated tests.

#### HBFIT.9 — First-pass draft generation

- Injects outline-only state, selects chapter 0, clicks Generate Draft
- Waits for `#draft-workspace` to become visible (up to 120s)
- Asserts draft text length >100 chars
- Validates `localStorage` structure: `chapterId`, `chapterTitle` (string), `draftText` (non-empty string), `qualityFlags` (array)

#### HBFIT.10 — Revision flow

- Injects draft state, fills revision instruction textarea, clicks Revise Draft
- Waits for revise button to re-enable (up to 120s)
- Asserts `revisionHistory[0].instruction` equals the entered instruction
- Asserts `revisionHistory.length > 0`

#### HBFIT.11 — Validation results rendered

- Injects draft state, clicks Validate Draft
- Waits for `[data-testid="validation-results"]:not(.hidden)` (up to 120s)
- Asserts `#validation-summary` has non-empty text
- Validates `localStorage` draft has `{ flags: [], summary: string }` shape

#### HBFIT.12 — Persistence across page reload

- Injects draft + revision history state
- Navigates to Drafting tab, selects chapter, asserts draft text matches
- Performs `page.reload()`, re-navigates, re-checks draft text is unchanged
- Asserts `#revision-history-container` is visible with ≥1 `<li>` in `#revision-history-list`

#### HBFIT.13 — End-to-end pipeline (Book Goals → Outline → Chapter Outlines → Draft)

- Runs the full real-API pipeline from scratch (no localStorage injection)
- Book Goals Agent → accept goals → Outline generated → accept outline → Chapter Annotator → Drafting tab → Generate Draft for chapter 0
- Asserts draft is >100 chars and contains herb/plant/medicinal keywords (confirms context flowed through all agents)
- **Total time**: ~8–12 minutes

---

### 4. Safety Tab Integration Tests (`herbalbookforge.integration.spec.js`) — Sprint 3 (HBFIT.14–17)

**Purpose**: Validate the full Safety tab pipeline — scan via Safety Agent, flag rendering, persistence, and navigate-to-draft integration

**All tests skip gracefully if `GROK_API_KEY` is not configured.**

A shared helper `makeSafetyProjectState()` injects a minimal project state (one chapter draft with comfrey/elderberry text) into `localStorage`. HBFIT.15/16/17 use a pre-built mock safety report to avoid real API calls; HBFIT.14 exercises the live Safety Agent.

#### HBFIT.14 — Full-manuscript safety scan via Safety Agent

- Injects draft-only state (no stored report), navigates to Safety tab
- Asserts empty state is hidden (draft exists) and scan controls are visible
- Clicks Run Safety Scan, waits for `[data-testid="safety-report"]:not(.hidden)` (up to 120s)
- Validates `localStorage` structure: `flags[]` (array), `summary` (non-empty string), `scanTimestamp`, `scanScope === 'full'`

#### HBFIT.15 — Safety report flags render in Safety tab UI

- Injects state with pre-built 2-flag safety report (PA_CONTENT + DOSAGE)
- Navigates to Safety tab, asserts report panel is immediately visible (rendered from stored report)
- Asserts summary contains expected text
- Asserts `[data-testid="safety-flags-list"] li` count equals 2
- Asserts first flag item contains `PA_CONTENT` badge or flaggedText

#### HBFIT.16 — Safety report persists across page reload

- Injects state with 2-flag report, verifies report on first load (2 flags)
- Performs `page.reload()`, re-navigates to Safety tab
- Asserts report still visible with 2 flags after reload

#### HBFIT.17 — Navigate-to-draft action switches tab and selects chapter

- Injects state with 2-flag report
- Clicks the "Open in Drafting tab" button on the first flag
- Asserts `#content-drafting:not(.hidden)` becomes visible (tab switched)
- Asserts `[data-testid="draft-chapter-select"]` value equals `'0'` (chapter selected)

**Command**:

```bash

npx playwright test --project=herbalbookforge-integration

```

---

### 5. Preview Tab Integration Tests (`herbalbookforge.integration.spec.js`) — Sprint 4 (HBFIT.18-21)

**Purpose**: Validate Preview tab manuscript assembly, rendering/refresh behavior, export guards/actions, and persistence

These tests use localStorage-injected project state and do not require live LLM responses.

#### HBFIT.18 — Assembly in outline order

- Injects two drafts intentionally out of array order
- Clicks Assemble Manuscript
- Asserts Preview content renders Chapter 1 before Chapter 2

#### HBFIT.19 — Rendering and stale preview guidance

- Verifies empty-state is visible before assembly
- Asserts assembled preview becomes visible with metadata
- Edits and saves a draft in Drafting tab
- Returns to Preview and asserts stale warning appears

#### HBFIT.20 — Export actions and guards

- Verifies guard message when exporting before assembly
- After assembly, validates:
  - Markdown export triggers a `.md` download
  - Printable HTML export opens a popup print document
  - RTF export triggers a `.rtf` download

#### HBFIT.21 — Preview persistence across reload

- Assembles manuscript and triggers export to create history
- Verifies `preview.assembledText`, `preview.lastGenerated`, and `preview.exportHistory[]` in localStorage
- Reloads page and confirms Preview content remains rendered

**Command (targeted)**:

```bash

npx playwright test --project=herbalbookforge-integration --grep "HBFIT\.18|HBFIT\.19|HBFIT\.20|HBFIT\.21"

```

**Status**: ✅ Passing (4/4 targeted)

---

### 6. Safety & Drafting Tab Integration Tests (`herbalbookforge.integration.spec.js`) — Sprint 5 (HBFIT.22-24)

**Purpose**: Validate Sprint 5 quality and workflow improvements: Safety flag rendering with field normalization, apply-suggestion action, and generate-remaining-chapters feature

#### HBFIT.22 — Safety flag flaggedText and suggestion content render in flag boxes

- Injects mock safetyReport with 2 flags (using alternative field names: `issue` instead of `flaggedText`)
- Verifies both `flaggedText` and `suggestion` content render visibly in safety flag boxes
- Tests `coerceStr()` field normalization resilience

#### HBFIT.23 — Apply suggestion action pre-fills revision instruction textarea

- Loads project state with safety report
- Clicks "💡 Apply suggestion" button on a flag
- Verifies `revision-instruction` textarea is pre-filled with suggestion text
- Tests `applySuggestionToDraft()` workflow

#### HBFIT.24 — Generate Remaining Chapters skips chapters with existing drafts

- Creates project state with Chapter 1 (existing draft) and Chapter 2 (empty)
- Clicks "📚 Generate Remaining" button
- Verifies Chapter 1 draft unchanged and Chapter 2 now populated with generated draft
- Tests `generateRemainingChapters()` non-destructive batch generation

**Command (targeted)**:

```bash

npx playwright test --project=herbalbookforge-integration --grep "HBFIT\.22|HBFIT\.23|HBFIT\.24"

```

**Status**: ✅ Passing (3/3)

---

## Environment Configuration

### Setting up `.env` file

1. Create `.env` file in project root:

```bash

cd c:\NovelWriterSite
echo "GROK_API_KEY=xai-YOUR_API_KEY_HERE" > .env

```

2. Verify it's in `.gitignore` (it should be):

```bash

cat .gitignore | grep "\.env"

```

### API Key Sources

- Get API key from [xAI Console](https://console.x.ai)
- Create new API key with chat permissions
- Copy full key (starts with `xai-`)

---

## Running Tests

### Run all HerbalBookForge tests

```bash

npx playwright test --project=herbalbookforge-smoke
npx playwright test --project=herbalbookforge-integration

```

### Run specific test

```bash

npx playwright test --project=herbalbookforge-integration --grep "Full Workflow"

```

### Run with visible browser

```bash

npx playwright test --project=herbalbookforge-integration --headed

```

### Run with trace for debugging

```bash

npx playwright test --project=herbalbookforge-integration --trace on

```

### View trace

```bash

npx playwright show-trace test-results/trace.zip

```

---

## Test Output

### Expected Output (Passing)

```

Running 3 tests using 1 worker

✅ HerbalBookForge Full Integration Test › Verify API key from .env is properly configured
✅ HerbalBookForge Full Integration Test › Handle API timeouts and errors gracefully
✅ HerbalBookForge Full Integration Test › End-to-end workflow: Book Goals → Outline → Chapter Outlines with real API calls

3 passed (6m 45s)

```

### Logs

Integration tests print detailed progress messages:

- 🔧 Setup phase
- 🎯 Book Goals phase
- 📤 API requests
- ⏳ Waiting indicators
- ✅ Completion markers
- 📝 Content statistics

---

## Troubleshooting

### Test fails: "GROK_API_KEY not configured"

**Solution**: Create `.env` file with valid API key

```bash

echo "GROK_API_KEY=xai-YOUR_KEY" > .env

```

### Test times out waiting for API response

**Possible causes**:

- API key is invalid
- Network is unreliable
- Grok API is slow or down
- Test timeout is insufficient

**Solutions**:

- Verify API key works: `curl -H "Authorization: Bearer YOUR_KEY" https://api.x.ai/v1/chat/completions`
- Increase timeout in `playwright.config.js` (currently 600 seconds)
- Check network connectivity
- Try again later if API is experiencing issues

### Test fails with "Outline not generated"

**Possible causes**:

- LLM response didn't include expected JSON
- Network issue during transmission
- API rate limiting

**Solution**: Increase timeout in `playwright.config.js` or retry test

### Test fails: "Cannot read property X of undefined"

**Cause**: UI elements not loading properly

**Solution**:

1. Check browser console for errors: `playwright test --headed`
2. Verify HerbalBookForge.html file is intact
3. Check localhost:8080 loads correctly

---

## Test Maintenance

### When to update tests

- ✏️ UI element IDs change → Update locators
- 📝 New tabs/features added → Add new test steps
- 🔄 LLM prompt changes → Update response parsing
- ⏱️ Performance degrades → Increase timeouts

### Adding new tests

1. Add test case to appropriate `.spec.js` file
2. Use existing test helpers (loadEnv, API key setup)
3. Include detailed logging with emoji prefixes
4. Document expected timeouts
5. Handle errors gracefully with try/catch

Example:

```javascript

test('New feature workflow', async ({ page }) => {
  console.log('🎯 Testing new feature...');

  await page.goto('/HerbalBookForge/HerbalBookForge.html');
  await page.click('button#tab-newfeature');

  console.log('📤 Triggering action...');
  await page.click('button#action-btn');

  console.log('⏳ Waiting for response...');
  await page.waitForFunction(
    () => document.querySelector('#result').textContent.length > 0,
    { timeout: 30000 }
  );

  console.log('✅ Feature working');
  expect(true).toBe(true);
});

```

---

## CI/CD Integration

### GitHub Actions Example

```yaml

name: HerbalBookForge Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: echo "GROK_API_KEY=${{ secrets.GROK_API_KEY }}" > .env
      - run: npx playwright test --project=herbalbookforge-smoke

```

---

## Performance Metrics

### Current Baseline (v0.10.0 — Sprint 2)

| Test | Duration | Status |
|------|----------|---------|
| Smoke test 1 — tab navigation | ~3 seconds | ✅ Passing |
| Smoke test 2 — Drafting tab controls (HBF.DR8) | ~2 seconds | ✅ Passing |
| Integration: HBFIT.9 — first-pass generation | 1–2 minutes | ✅ (with API key) |
| Integration: HBFIT.10 — revision flow | 1–2 minutes | ✅ (with API key) |
| Integration: HBFIT.11 — validation rendered | 30–90 seconds | ✅ (with API key) |
| Integration: HBFIT.12 — persistence reload | ~5 seconds | ✅ (with API key) |
| Integration: HBFIT.13 — end-to-end pipeline | 8–12 minutes | ✅ (with API key) |
| API response time (Book Goals Agent) | 20–45 seconds | ✅ Acceptable |
| API response time (Outliner Agent) | 30–90 seconds | ✅ Acceptable |
| API response time (Chapter Annotator) | 20–60 seconds each | ✅ Acceptable |
| API response time (Drafter Agent) | 30–90 seconds | ✅ Acceptable |
| API response time (Safety Agent) | 15–60 seconds | ✅ Acceptable |

---

## Known Issues & Limitations

1. **LLM Response Variability**: Response times vary based on API load (20-120 seconds)
2. **Network Dependent**: Tests require active internet and API access
3. **Rate Limiting**: Multiple runs may hit Grok API rate limits
4. **State Isolation**: Tests use shared localStorage - may interfere if run in parallel

---

## Future Test Plans (v0.11.0+)

- [ ] Safety tab standalone workflow tests (HBF.SA1–SA4)
- [ ] Preview tab export validation tests
- [ ] Consistency editing validation tests
- [ ] Mock LLM responses for faster CI/CD testing (no API key required)
- [ ] Regression spec for Drafting tab (selector/visibility assertions after state changes)
- [ ] Performance regression testing
- [ ] Cross-browser testing (Firefox, Safari)

---

## Support & Questions

- Check test output logs for specific failures
- Review trace files: `npx playwright show-trace test-results/trace.zip`
- Verify `.env` file exists and contains valid key
- Check Grok API status at <https://status.x.ai>

---

---

### 7. Sprint 6 Robustness Tests (`herbalbookforge.integration.spec.js`) — Sprint 6 (HBFIT.25–30)

**Purpose**: Validate Sprint 6 robustness improvements — chapter numbering, safety scope labels, malformed-flag warnings, outline normalization, truncation detection, and heading deduplication.

#### HBFIT.25 — Chapter selector shows 1-based numbers

- Injects a 1-chapter project, navigates to Drafting tab
- Asserts the chapter select option value `'0'` displays as "Chapter 1" or similar (not "Chapter 0")

#### HBFIT.26 — Safety scope options do not expose 0-based chapter IDs

- Injects a project with 1 draft, navigates to Safety tab
- Checks scope-select `<option>` text does not contain `chapter:0`

#### HBFIT.27 — Safety warning banner for malformed flags

- Injects a safety report with a flag missing `flaggedText` (`_parseWarning` set)
- Navigates to Safety tab; asserts `[data-testid="safety-status"]` is present in DOM

#### HBFIT.28 — `normalizeOutlineText` strips code fences

- Calls `normalizeOutlineText('\`\`\`markdown\n## Chapter 1\nHerbs\n\`\`\`')` in page context
- Asserts result contains "Chapter 1" and does not contain `\`\`\``

#### HBFIT.29 — `isOutlineTruncated` detects `finish_reason=length`

- Calls `isOutlineTruncated('length', 'Chapter 1: Basics')` in page context
- Asserts result is `true`

#### HBFIT.30 — Preview assembly strips duplicate heading from draft body

- Injects a draft whose `draftText` begins with `# Lavender` matching the chapter title
- Assembles manuscript; asserts the rendered preview does not contain two consecutive `<h>` tags for "Lavender"

**Status**: ✅ Passing (33/33)

---

## Future Test Plans (v0.14.0+)

- [ ] Mock LLM responses for faster CI/CD testing (no API key required)
- [ ] Regression spec for Drafting tab (selector/visibility assertions after state changes)
- [ ] Performance regression testing
- [ ] Cross-browser testing (Firefox, Safari)

---

## Troubleshooting & Support

- Check test output logs for specific failures
- Review trace files: `npx playwright show-trace test-results/trace.zip`
- Verify `.env` file exists and contains valid key
- Check Grok API status at <https://status.x.ai>

---

**Last updated**: 2026-05-02
**Test suite version**: 1.0
**HerbalBookForge version**: 1.0.0
