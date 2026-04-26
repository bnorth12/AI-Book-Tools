# HerbalBookForge Chapter Outlines Features (Sprint X)

## Features Implemented

- Inline editing and save for each chapter outline card
- Per-chapter regeneration via the Chapter Annotator Agent
- Second-pass consistency-editing for all chapter outlines
- All requirements traceable in code and requirements doc

## How to Use

1. **Edit Chapter Outlines:**
   - Go to the Chapter Outlines tab.
   - Edit the title and annotation for any chapter inline.
   - Click "Save" to persist changes for that chapter.

2. **Regenerate a Chapter Outline:**
   - Click "Regenerate" on any chapter card to use the agent for a new annotation.

3. **Consistency Edit All Outlines:**
   - Click "Consistency Edit All Outlines" to harmonize all outlines for style, structure, and cross-references.

## Requirements Traceability

- All features are mapped to HBF.CHO1–HBF.CHO6 in code and HerbalBookForge/REQUIREMENTS.md.

## Testing

- Regression and feature tests are in tests/e2e/herbalbookforge.regression.spec.js
- All new features are covered by Playwright tests with mocked agent responses.

---

### Last updated: 2026-04-25

## Integration Testing

Full end-to-end integration tests are now available in `tests/e2e/herbalbookforge.integration.spec.js`:

- Tests real LLM API calls with proper timeout handling
- Validates complete workflow from Book Goals through Chapter Outline generation
- Tests project state persistence across page reloads
- Handles API delays and LLM response waits (60+ second timeouts)

Run with:
```bash
npx playwright test --project=herbalbookforge-integration
```
