# HerbalBookForge Testing Guide

## Overview

HerbalBookForge includes comprehensive test coverage spanning smoke tests, regression tests, and full integration tests with real LLM API calls.

## Test Suites

### 1. Smoke Tests (`herbalbookforge.smoke.spec.js`)

**Purpose**: Quick validation of core UI elements and tab navigation

**What it tests**:
- All 7 main tabs load and are visible
- Tab button IDs are correct
- DOM structure is intact

**Run time**: ~3 seconds

**Command**:
```bash
npx playwright test --project=herbalbookforge-smoke
```

**Status**: ✅ Passing

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

### Current Baseline (v0.9.5)

| Test | Duration | Status |
|------|----------|--------|
| Smoke tests | ~3 seconds | ✅ Passing |
| Integration tests | 6-8 minutes | ✅ Passing |
| API response time (Book Goals) | 20-45 seconds | ✅ Acceptable |
| API response time (Outline) | 30-90 seconds | ✅ Acceptable |
| API response time (Chapter) | 20-60 seconds each | ✅ Acceptable |

---

## Known Issues & Limitations

1. **LLM Response Variability**: Response times vary based on API load (20-120 seconds)
2. **Network Dependent**: Tests require active internet and API access
3. **Rate Limiting**: Multiple runs may hit Grok API rate limits
4. **State Isolation**: Tests use shared localStorage - may interfere if run in parallel

---

## Future Test Plans (v0.9.6+)

- [ ] Drafting tab integration tests
- [ ] Safety checker workflow tests
- [ ] Preview tab export validation tests
- [ ] Consistency editing validation tests
- [ ] Mock LLM responses for faster CI/CD testing
- [ ] Performance regression testing
- [ ] Cross-browser testing (Firefox, Safari)

---

## Support & Questions

- Check test output logs for specific failures
- Review trace files: `npx playwright show-trace test-results/trace.zip`
- Verify `.env` file exists and contains valid key
- Check Grok API status at https://status.x.ai

---

**Last updated**: 2026-04-25
**Test suite version**: 1.0
**HerbalBookForge version**: 0.9.5
