# Pull Request: HerbalBookForge Chapter Outlines Sprint

**Branch:** `main` (sprint work committed directly to main; issues filed retroactively for audit trail)  
**Target:** `main`  
**Date:** 2026-04-25  
**Author:** AI Book Tools Team

---

## Summary

Implements the full Chapter Outlines sprint for HerbalBookForge, including tab renaming, LLM-driven outline generation per chapter, inline editing and save, per-chapter regeneration, and second-pass consistency editing across all chapter outlines. Also introduces the unified LLM API and state architecture, annotation string consistency enforcement, and a complete integration test suite.

---

## Sprint Issues Closed by This PR

| # | Title | Requirement IDs |
|---|-------|-----------------|
| [#16](https://github.com/bnorth12/AI-Book-Tools/issues/16) | Refactor Tab and Navigation (rename "Chapters" → "Chapter Outlines") | HBF.CHO1 |
| [#17](https://github.com/bnorth12/AI-Book-Tools/issues/17) | Implement Annotated Outline Cards/Sub-Tabs | HBF.CHO1, HBF.CHO2 |
| [#18](https://github.com/bnorth12/AI-Book-Tools/issues/18) | Integrate LLM/Agent for Outline Generation (Unified API) | HBF.BG.G2, HBF.UNI1, HBF.UNI2, HBF.UNI3, HBF.UNI4, HBF.UNI4.1 |
| [#19](https://github.com/bnorth12/AI-Book-Tools/issues/19) | Enable Inline Editing and Save | HBF.CHO3 |
| [#20](https://github.com/bnorth12/AI-Book-Tools/issues/20) | Support Per-Chapter Regeneration | HBF.CHO4 |
| [#21](https://github.com/bnorth12/AI-Book-Tools/issues/21) | Implement Second-Pass Consistency-Editing | HBF.CHO5 |
| [#22](https://github.com/bnorth12/AI-Book-Tools/issues/22) | Update Requirements in Code and Docs | HBF.CHO1–HBF.CHO7, HBF.UNI1–HBF.UNI4.1, HBF.BG.G1, HBF.BG.G2, HBF.BG.BGA1–HBF.BG.BGA3 |
| [#23](https://github.com/bnorth12/AI-Book-Tools/issues/23) | Write/Expand Tests | HBFIT.1–HBFIT.8 |
| [#24](https://github.com/bnorth12/AI-Book-Tools/issues/24) | Update User Documentation | All |
| [#25](https://github.com/bnorth12/AI-Book-Tools/issues/25) | Sprint PR and Closeout | All |

---

## Requirement IDs Covered

### Unified LLM API and State Architecture
- **HBF.UNI1** – All LLM API calls routed through a single `callLlmAgent` function.
- **HBF.UNI2** – Each tab prepares its own context and parses its own LLM response; all updates go through central project JSON state.
- **HBF.UNI3** – UI always renders from central project JSON state after any LLM call or user edit.
- **HBF.UNI4** / **HBF.UNI4.1** – Correct agent prompts enforced per function; all agent responses use strict JSON output; fallback/error handling in place.

### Chapter Outlines Tab
- **HBF.CHO1** – "Chapters" tab renamed to "Chapter Outlines"; navigation and selectors updated.
- **HBF.CHO2** – One annotated card per chapter displayed in the Chapter Outlines tab.
- **HBF.CHO3** – Inline editing and explicit save per chapter outline.
- **HBF.CHO4** – Per-chapter regeneration via Chapter Annotator Agent.
- **HBF.CHO5** – Second-pass consistency-editing triggered after the last chapter outline is created; harmonizes style, structure, and cross-references.
- **HBF.CHO7** – All chapter annotation context, storage, and UI rendering is always a string; `[object Object]` regression eliminated.

### Book Goals
- **HBF.BG.G1** – Book Goals Tab displays and allows editing of all goal fields.
- **HBF.BG.G2** – Accept Goals generates an initial outline using the LLM (never static) when no outline is present.
- **HBF.BG.BGA1** – Book Goals Tab uses the dedicated Book Goals Agent.
- **HBF.BG.BGA2** – Book Goals Agent returns structured JSON with Copy buttons; Copy To buttons handle all values without JS errors.
- **HBF.BG.BGA3** – UI shows clear indication when a request is sent to the LLM/agent.

### Integration Testing
- **HBFIT.1** – Integration tests load `.env` for `GROK_API_KEY`.
- **HBFIT.2** – Tests make real LLM API calls through all agents.
- **HBFIT.3** – Book Goals Agent response timeout: 60 s.
- **HBFIT.4** – Outline generation timeout: 120 s.
- **HBFIT.5** – Chapter Outline generation timeout: 180 s.
- **HBFIT.6** – Tests skip gracefully when API key is not configured.
- **HBFIT.7** – Tests verify project state persists across page reloads.
- **HBFIT.8** – Tests validate HTML response structure and content length.

---

## Major Changes

1. **Tab rename** – `button#tab-chapters` → `button#tab-chapter-outlines`; content panel and all selectors updated accordingly.
2. **Unified LLM API** – Introduced `callLlmAgent(agent, context, userPrompt, parser)` as the single LLM gateway; removed duplicate per-tab API call logic.
3. **LLM-driven outline generation** – Accept Goals now triggers `callLlmAgent` with the Outliner agent to generate the initial book outline; no static fallback.
4. **Chapter Outlines tab** – Renders one card per chapter with title and annotation fields; supports inline edit, save, regenerate, and the consistency-edit-all action.
5. **Second-pass consistency editing** – Automatically runs after the last chapter outline is created; re-submits all outlines to the Chapter Annotator Agent.
6. **Annotation string safety** – `HBF.CHO7` enforcement: all annotation values are coerced to string before LLM call, state save, and UI render.
7. **Integration test suite** – `tests/e2e/herbalbookforge.integration.spec.js` covers full Book Goals → Outline → Chapter Outlines workflow with real API calls and state persistence validation.
8. **Requirements doc sync** – `HerbalBookForge/REQUIREMENTS.md` updated to v0.9.6 with all new requirement IDs inline and in external doc.

---

## Test Results

See [`docs/releases/evidence/HBF-SPRINT-CHAPTER-OUTLINES-TEST-RESULTS.md`](HBF-SPRINT-CHAPTER-OUTLINES-TEST-RESULTS.md) for full test evidence.

**Summary:**
| Suite | Tests | Result | Date |
|-------|-------|--------|------|
| `herbalbookforge-smoke` (Playwright) | 1 | ✅ PASSED | 2026-04-25 |
| `.last-run.json` (full regression) | All | ✅ PASSED, 0 failed | 2026-04-25 |
| `herbalbookforge-integration` (real LLM API) | 3 | ✅ PASSED (6.3 min) | 2026-04-25 |

---

## Files Changed (key)

- `HerbalBookForge/HerbalBookForge.html` – All feature implementation
- `HerbalBookForge/REQUIREMENTS.md` – Requirements updated to v0.9.6
- `HerbalBookForge/CHAPTER_OUTLINES_FEATURES.md` – Feature documentation
- `HerbalBookForge/TESTING.md` – Test guidance updated
- `tests/e2e/herbalbookforge.smoke.spec.js` – Smoke test (tabs verified)
- `tests/e2e/herbalbookforge.integration.spec.js` – Full integration test suite
- `HerbalBookForge/SPRINT_CHAPTER_OUTLINES_PR_CHECKLIST.md` – Checklist updated
- `docs/releases/evidence/HBF-SPRINT-CHAPTER-OUTLINES-PR-DESCRIPTION.md` – This file
- `docs/releases/evidence/HBF-SPRINT-CHAPTER-OUTLINES-TEST-RESULTS.md` – Test evidence

---

## Closes

```
Closes #16
Closes #17
Closes #18
Closes #19
Closes #20
Closes #21
Closes #22
Closes #23
Closes #24
Closes #25
```

> All issues filed as #16–#25 in bnorth12/AI-Book-Tools on 2026-04-25. Work was committed directly to main; issues closed retroactively via commit references.
