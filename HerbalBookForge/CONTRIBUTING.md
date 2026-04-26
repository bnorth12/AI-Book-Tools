# Contributing to HerbalBookForge

Thank you for your interest in contributing to HerbalBookForge! This guide explains how to develop, test, and contribute changes.

## Development Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Python 3.8+ (for local server)
- Git

### Local Development

1. **Clone the repository**
```bash
git clone <repo-url>
cd NovelWriterSite
```

2. **Install dependencies**
```bash
npm install
```

3. **Create `.env` file with API key**
```bash
echo "GROK_API_KEY=xai-your_api_key_here" > .env
```

4. **Start local web server**
```bash
python -m http.server 8080
```

5. **Open in browser**
```
http://localhost:8080/HerbalBookForge/HerbalBookForge.html
```

## Project Structure

```
HerbalBookForge/
├── HerbalBookForge.html          # Main application (all-in-one HTML file)
├── README.md                      # User guide
├── REQUIREMENTS.md                # Technical requirements
├── TESTING.md                     # Testing guide (this file)
├── CHAPTER_OUTLINES_FEATURES.md   # Feature documentation
└── CONTRIBUTING.md                # Developer guide (this file)

tests/e2e/
├── herbalbookforge.smoke.spec.js        # Quick UI tests
└── herbalbookforge.integration.spec.js  # Full workflow tests with real LLM

.env                              # Environment variables (git-ignored)
playwright.config.js              # Test configuration
```

## Code Organization

### HerbalBookForge.html Structure

The application is a single HTML file with three main sections:

1. **HTML Section** (lines 1-450)
   - Semantic structure with tabs and content divs
   - Tab buttons with IDs: `#tab-goals`, `#tab-outline`, etc.
   - Content containers with IDs: `#content-goals`, `#content-outline`, etc.

2. **CSS Section** (lines 26-300, in `<style>` tag)
   - Tailwind-based utility classes
   - Emerald color theme
   - Responsive layout

3. **JavaScript Section** (lines 460-1546, in `<script>` tag)
   - Core functions: `loadProject()`, `saveProject()`, `switchTab()`
   - Agent functions: `sendToBookGoalsAgent()`, `acceptOutline()`
   - LLM interface: `callLlmAgent()` (unified API)
   - UI rendering: `renderSetupForm()`, `renderChapterList()`, etc.

### Key Functions

#### `callLlmAgent({agent, context, userPrompt, parseResponse, temperature, max_tokens})`
Unified LLM API interface. All LLM calls go through this function.

**Parameters**:
- `agent`: 'bookGoals' | 'outliner' | 'chapterAnnotator' | 'drafter' | 'safety'
- `context`: Additional context string for the LLM
- `userPrompt`: User's question/request
- `parseResponse`: Function to parse LLM JSON response
- `temperature`: LLM creativity (0.0-1.0)
- `max_tokens`: Response length limit

**Returns**: Parsed response from LLM

#### `saveProject()` / `loadProject()`
Handle localStorage persistence of project state.

**Project State Structure**:
```javascript
{
  meta: { version, created, lastEdited, name },
  setup: { apiKey, collectionIds, webSearchEnabled, preferredModel },
  prompts: { bookGoalsAgent, outliner, chapterAnnotator, drafter, safety },
  goals: { mainGoal, contentTypes, tone, audience, length, finalized, chatHistory },
  outline: "# Outline text...",
  chapterOutlines: [{ title, annotation }, ...],
  safetyNotes: ""
}
```

#### `switchTab(tabId)`
Switch between tabs and update UI accordingly.

## Making Changes

### Adding a New Feature

1. **Identify the tab** (goals, outline, chapter-outlines, drafting, safety, preview)

2. **Add HTML structure** to the corresponding tab content div
   - Use semantic HTML
   - Add IDs for JavaScript targeting
   - Use Tailwind classes for styling

3. **Add JavaScript logic**
   - Create render function (e.g., `renderNewFeature()`)
   - Create event handlers
   - Update `loadProject()` and `saveProject()` if needed

4. **Add to initialization**
   - Call render function in `loadProject()`
   - Bind event listeners in appropriate setup function

5. **Test locally**
```bash
npm run test:smoke     # Quick UI tests
npm run test:full      # Full integration tests
```

6. **Update documentation**
   - Update REQUIREMENTS.md with new feature requirements
   - Update README.md or create feature-specific doc
   - Add inline code comments with requirement IDs (e.g., `HBF.NEW1`)

### Example: Adding a New Button

```javascript
// In HTML section (within appropriate tab):
<button id="my-new-btn" class="px-4 py-2 bg-emerald-600 rounded-3xl">
  Do Something
</button>

// In JavaScript section (in appropriate function):
document.getElementById('my-new-btn')?.addEventListener('click', async () => {
  console.log('🎯 Starting new feature...');
  const result = await callLlmAgent({
    agent: 'bookGoals',
    context: 'Some context',
    userPrompt: 'User input',
    parseResponse: (raw) => JSON.parse(raw),
    temperature: 0.7,
    max_tokens: 1200
  });
  // Handle result
});
```

## Testing

### Running Tests

```bash
# Smoke tests (quick UI validation)
npx playwright test --project=herbalbookforge-smoke

# Integration tests (full workflow with LLM)
npx playwright test --project=herbalbookforge-integration

# All HerbalBookForge tests
npm run test:hbf

# Specific test
npx playwright test --project=herbalbookforge-integration --grep "API key"

# With visible browser
npx playwright test --project=herbalbookforge-integration --headed

# With trace
npx playwright test --project=herbalbookforge-integration --trace on
```

### Writing Tests

Tests should follow this pattern:

```javascript
test('description', async ({ page }) => {
  // Setup
  await page.goto('/HerbalBookForge/HerbalBookForge.html');
  
  // Action with logging
  console.log('🎯 Doing something...');
  await page.click('button#my-btn');
  
  // Wait for result (with appropriate timeout)
  console.log('⏳ Waiting for response...');
  await page.waitForFunction(
    () => document.querySelector('#result')?.textContent.length > 0,
    { timeout: 30000 }
  );
  
  // Assertion
  console.log('✅ Success');
  expect(true).toBe(true);
});
```

### Test Requirements

- Tests must handle network delays (use timeouts)
- Tests must skip gracefully if API key not configured
- Tests must log progress with emoji prefixes (🔧 🎯 📤 ⏳ ✅ ❌)
- Integration tests must make real API calls (no mocks)
- Tests must be idempotent (can run multiple times)

## Code Standards

### Naming Conventions

- **Variables**: camelCase (`const projectName = "..."`)
- **Functions**: camelCase (`function loadProject()`)
- **IDs**: kebab-case (`id="my-button"`)
- **CSS Classes**: Tailwind utilities (`class="px-4 py-2 rounded-3xl"`)

### Comments

Use requirement IDs in comments to link code to requirements:

```javascript
// HBF.BG.G1: Display book goals in form
function renderGoalsForm() {
  // ...
}

// HBF.UNI1: Unified LLM API call
async function callLlmAgent({...}) {
  // ...
}
```

### Error Handling

Always include try/catch for LLM calls:

```javascript
try {
  const reply = await callLlmAgent({...});
  // Process reply
} catch (err) {
  alert(`Operation failed: ${err.message}`);
  console.error('[ERROR] Operation details:', err);
}
```

### HTML Escaping

Always escape user/LLM content before rendering:

```javascript
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Usage
const escaped = escapeHtml(userInput);
element.innerHTML = `<div>${escaped}</div>`;
```

## Requirements Traceability

Every feature must be linked to requirements:

1. **Add to REQUIREMENTS.md** with unique ID (e.g., `HBF.NEW1`, `HBF.NEW2`)
2. **Reference in code comments** with requirement ID
3. **Link in tests** with requirement IDs
4. **Document in feature README** with requirement mapping

Example:
```
REQUIREMENTS.md:
- HBF.NEW1: The app SHALL support new feature X
- HBF.NEW2: Feature X SHALL save state to localStorage

HerbalBookForge.html:
// HBF.NEW1: New feature X implementation
async function newFeature() { ... }

TESTING.md:
Test validates HBF.NEW1 and HBF.NEW2
```

## Pull Request Process

1. **Branch naming**: `feature/description` or `fix/description`

2. **Commit messages**: Clear and linked to requirements
   ```
   feat: Add new feature X (HBF.NEW1)
   fix: Resolve timeout issue in chapter generation
   docs: Update testing guide
   ```

3. **PR description**:
   - What: Brief feature description
   - Why: Why this change is needed
   - How: How it was implemented
   - Test: How to test the changes
   - Requirements: Link to REQUIREMENTS.md

4. **Pre-submission checklist**:
   - [ ] Code follows standards
   - [ ] Tests pass (`npm run test:hbf`)
   - [ ] Documentation updated
   - [ ] Requirements linked
   - [ ] No console errors
   - [ ] `.env` file is in `.gitignore`

5. **Review process**:
   - Code review for standards compliance
   - Test verification
   - Documentation review
   - Requirements traceability check

## Common Tasks

### Add a new LLM agent
1. Create agent prompt in `project.prompts`
2. Add agent case in `callLlmAgent()`
3. Create UI for agent interaction
4. Add tests for agent workflow

### Add a new tab
1. Add HTML structure with `id="content-newtab"`
2. Add tab button with `id="tab-newtab"`
3. Create render function `renderNewTab()`
4. Add case in `switchTab()`
5. Call render in `loadProject()`

### Update prompts
1. Edit prompt in `project.prompts`
2. Test locally with real API
3. Update REQUIREMENTS.md with prompt changes
4. Document changes in PR

## Debugging

### Enable console logging
Tests print logs with emoji prefixes. Check browser console for:
- `[DEBUG]` messages
- `[ERROR]` messages
- Progress indicators

### Use Playwright debugging
```bash
# Interactive debug mode
npx playwright test --project=herbalbookforge-integration --debug

# Generate trace
npx playwright test --project=herbalbookforge-integration --trace on

# View trace
npx playwright show-trace test-results/trace.zip
```

### Check API requests
Open browser DevTools → Network tab → filter for `api.x.ai` requests

### Validate HTML/CSS
Use browser DevTools Inspector to verify:
- Element structure
- Class application
- Event listeners attached

## Performance Considerations

- **LLM calls** take 20-120 seconds (unavoidable)
- **localStorage** can store ~10MB (sufficient for projects)
- **Single file** keeps deployment simple
- **State updates** should re-render only affected sections

## Version Management

Current version: **0.9.5**
- v0.9.x: Current stable series with core features
- v0.10: Planned with Drafting and Safety features
- v1.0: Full feature set with all tabs functional

Version is defined in:
- `project.meta.version` in JavaScript
- REQUIREMENTS.md header
- README.md

## Getting Help

- **Questions**: Open an issue with `[question]` prefix
- **Bugs**: Open an issue with `[bug]` prefix and reproduction steps
- **Features**: Open an issue with `[feature]` prefix and use case
- **Documentation**: Improve docs and submit PR

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Grok API Docs](https://docs.x.ai/)
- [Tailwind CSS](https://tailwindcss.com)
- [xAI Console](https://console.x.ai)

---

**Last updated**: 2026-04-25
**Version**: 0.9.5
