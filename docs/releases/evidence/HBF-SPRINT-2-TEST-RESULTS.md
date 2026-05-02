# HerbalBookForge Sprint 2 — Test Results Evidence

**Date:** 2026-05-02
**Sprint:** Sprint 2 — Drafting Tab (generation, revision, validation, persistence)
**Application version:** HerbalBookForge v0.10.0
**Branch:** `feature/herbalbookforge-sprint-2-drafting`
**PR:** #38

---

## 1. Smoke Test — `herbalbookforge-smoke`

**Command run:**
```
npx playwright test --project=herbalbookforge-smoke --reporter=line
```

**Result:**
```
Running 2 tests using 1 worker
  2 passed (5.3s)
```

**Tests verified:**

### Test 1 — App loads and shows main tabs
- All 7 main tab buttons visible: `#tab-goals`, `#tab-outline`, `#tab-chapter-outlines`, `#tab-drafting`, `#tab-prompts`, `#tab-safety`, `#tab-preview`

### Test 2 — Drafting tab renders all required controls (HBF.DR8)
All `data-testid` attributes confirmed present in DOM after navigating to the Drafting tab:

| `data-testid` | Status |
|---|---|
| `draft-chapter-select` | ✅ Visible |
| `generate-draft-btn` | ✅ Visible |
| `draft-status` | ✅ Attached |
| `draft-text-area` | ✅ Attached |
| `save-draft-btn` | ✅ Attached |
| `revision-instruction` | ✅ Attached |
| `revise-draft-btn` | ✅ Attached |
| `revise-status` | ✅ Attached |
| `validate-draft-btn` | ✅ Attached |
| `validate-status` | ✅ Attached |
| `validation-results` | ✅ Attached |

**Status:** ✅ PASSED (2/2)

---

## 2. Integration Tests — `herbalbookforge-integration` (HBFIT.9–13)

**Status:** Designed and included. Require `GROK_API_KEY` in `.env` to execute.
All 5 new tests (`HBFIT.9`–`HBFIT.13`) skip gracefully without an API key.

| Test | Requirement | Execution Requirement |
|---|---|---|
| HBFIT.9 — First-pass draft generation | HBF.DR3, HBF.DR4 | API key |
| HBFIT.10 — Revision flow + history | HBF.DR5 | API key |
| HBFIT.11 — Validation results rendered | HBF.DR6 | API key |
| HBFIT.12 — Persistence across reload | HBF.DR7 | API key |
| HBFIT.13 — End-to-end pipeline | HBFIT.13 | API key, ~10 min |

---

## 3. Commit Log (Sprint 2 — branch ahead of main)

| SHA | Message |
|---|---|
| `aabc2ec` | docs(hbf): update TESTING.md for v0.10.0 — Drafting tab test IDs, HBFIT.9-13, performance baseline (closes #36) |
| `88a0e81` | test(hbf): add HBFIT.9-13 integration tests — generation, revision, validation, persistence, e2e (closes #35) |
| `d44bd95` | test(hbf): expand smoke test — verify Drafting tab controls present (HBF.DR8) (closes #34) |
| `47278b4` | feat(hbf): harden error handling — HTTP error messages, empty-draft guard, empty-revision guard (closes #33) |
| `a757e1d` | feat(hbf): add validation pipeline, validateChapterDraft(), Safety agent fallback, validation results UI (closes #32) |
| `783459a` | feat(hbf): add revision instruction input, reviseChapterDraft(), revision history UI (closes #31) |
| `0f506b8` | feat(hbf): add Drafting tab HTML, editable workspace, saveDraftEdits() (closes #30) |
| `165dfb0` | feat(hbf): implement Drafting tab first-pass generation pipeline (closes #29) |
| `cd0d0d2` | feat(hbf): update Drafter prompt to strict JSON contract, add parseDraftResponse() (closes #28) |
| `47de0c3` | feat(hbf): add drafts[] state model, bump version to v0.10.0, update localStorage key (closes #27) |
| `12c0e0f` | feat(hbf): derive Drafting requirements HBF.DR1-DR8 and HBFIT.9-13 (closes #26) |

---

## 4. Requirements Traceability

| Requirement | Description | Status |
|---|---|---|
| HBF.DR1 | Drafting tab present and navigable | ✅ Implemented |
| HBF.DR2 | Book goals + annotated outline as context | ✅ Implemented |
| HBF.DR3 | Chapter selector + first-pass generation | ✅ Implemented |
| HBF.DR4 | Strict JSON contract `{chapterTitle, draftText, qualityFlags}` + fallback | ✅ Implemented |
| HBF.DR5 | Revision instruction + `revisionHistory[]` with timestamp | ✅ Implemented |
| HBF.DR6 | Validation action via Safety Agent + results rendered | ✅ Implemented |
| HBF.DR7 | `drafts[]` schema persisted in localStorage v0.10.0 | ✅ Implemented |
| HBF.DR8 | Stable `id` and `data-testid` on all Drafting controls | ✅ Implemented |
| HBF.UNI4 | Agent-to-prompt mapping enforced (Drafter + Safety fallbacks) | ✅ Implemented |
| HBFIT.9 | Integration test: first-pass generation | ✅ Written |
| HBFIT.10 | Integration test: revision flow | ✅ Written |
| HBFIT.11 | Integration test: validation rendered | ✅ Written |
| HBFIT.12 | Integration test: persistence across reload | ✅ Written |
| HBFIT.13 | Integration test: end-to-end pipeline | ✅ Written |

---

## 5. Known Pre-existing Issues (not introduced by Sprint 2)

- `herbalbookforge-regression` project: 6 pre-existing failures unrelated to Sprint 2 (chapter save persistence, regeneration, prompt editor — selector/tab-visibility issues predating this sprint)
- PR #38 title requires manual update in GitHub UI (PAT cannot edit PRs)
