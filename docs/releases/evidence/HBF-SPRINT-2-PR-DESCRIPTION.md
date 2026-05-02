# HerbalBookForge Sprint 2 — PR Description

**Date:** 2026-05-02
**PR:** #38
**Branch:** `feature/herbalbookforge-sprint-2-drafting` → `main`
**Version:** v0.10.0

---

## Summary

Implements the full Drafting tab pipeline for HerbalBookForge. Users can now generate first-pass chapter drafts using book goals and annotated chapter outlines as context, edit drafts inline, request targeted revisions, validate drafts via the Safety & Accuracy Checker Agent, and persist all state across sessions.

---

## Scope

### Features implemented

- **First-pass generation** — Drafter Agent called with `BOOK GOALS + CHAPTER OUTLINE (annotated)` context. Returns strict JSON `{chapterTitle, draftText, qualityFlags}`. Stored in `project.drafts[]`.
- **Editable workspace** — `<textarea>` for inline editing with explicit Save Draft button. Transient "Saved at HH:MM" confirmation.
- **Revision loop** — User enters a revision instruction; prior draft text + instruction sent to Drafter Agent. Each revision appended to `revisionHistory[]` with timestamp.
- **Validation** — Validate Draft button calls Safety & Accuracy Checker Agent with draft text. Parses `{flags, summary}` JSON. Renders summary and flagged items. Stores `validatedAt` timestamp.
- **Error handling** — HTTP status codes mapped to user-readable messages (401, 403, 429, 500, 503). Empty draft guard on validation. Empty-result guard on revision (original preserved).
- **State persistence** — `drafts[]` array added to project schema. localStorage key bumped to `herbalBookForgeProject_v0.10.0` with backward-compatible load from `v0.9.5` and `v0.9.3`.

### Tests

- Smoke test expanded to 2 tests — new test verifies all 11 Drafting tab `data-testid` controls are present in DOM
- Integration tests HBFIT.9–13 added (draft generation, revision, validation, persistence, end-to-end pipeline)

### Documentation

- `HerbalBookForge/REQUIREMENTS.md` — HBF.DR1–DR8, HBFIT.9–13 derived and documented
- `HerbalBookForge/TESTING.md` — Updated for v0.10.0: Drafting tab test ID table, HBFIT.9–13 section, performance baseline

---

## Requirements Traceability

- HBF.DR1, HBF.DR2, HBF.DR3, HBF.DR4, HBF.DR5, HBF.DR6, HBF.DR7, HBF.DR8
- HBFIT.9, HBFIT.10, HBFIT.11, HBFIT.12, HBFIT.13
- HBF.UNI1, HBF.UNI4, HBF.UNI4.1

---

## Sprint 2 Issues Closed

- Closes #26 — Drafting requirements analysis and new requirement derivation
- Closes #27 — Drafting state model and persistence for chapter drafts
- Closes #28 — Drafter prompt contract and JSON parser hardening
- Closes #29 — First-pass chapter generation pipeline in Drafting tab
- Closes #30 — Editable draft workspace and explicit save behavior
- Closes #31 — Revision instruction input and iterative revise flow
- Closes #32 — Draft validation pipeline and validation results UI
- Closes #33 — Error handling and fallback behavior for drafting workflows
- Closes #34 — Smoke and regression test updates for Drafting tab
- Closes #35 — Integration test expansion for drafting revision and validation
- Closes #36 — Documentation updates for requirements, testing, and user workflow
- Closes #37 — PR packaging, review, merge, issue closure, and release evidence

---

## Files Changed

| File | Change |
|---|---|
| `HerbalBookForge/HerbalBookForge.html` | Main implementation — Drafting tab HTML, all JS functions, prompt contracts, error handling |
| `HerbalBookForge/REQUIREMENTS.md` | Added HBF.DR1–DR8, HBFIT.9–13; bumped version to v0.10.0 |
| `HerbalBookForge/TESTING.md` | Updated for v0.10.0: Drafting controls table, HBFIT.9–13 section, performance baseline |
| `tests/e2e/herbalbookforge.smoke.spec.js` | Expanded from 1 to 2 tests; added Drafting tab control assertions |
| `tests/e2e/herbalbookforge.integration.spec.js` | Added HBFIT.9–13 Drafting integration tests |
| `docs/releases/evidence/HBF-SPRINT-2-TEST-RESULTS.md` | Test evidence for this PR |
| `docs/releases/evidence/HBF-SPRINT-2-PR-DESCRIPTION.md` | This file |

---

## Test Evidence

- `docs/releases/evidence/HBF-SPRINT-2-TEST-RESULTS.md`
- Smoke: 2/2 passed (5.3s)
- Integration: HBFIT.9–13 written; require API key to execute

---

## Risks and Rollback

- **Risk**: Drafter Agent may return malformed JSON. **Mitigation**: `parseDraftResponse()` always returns a usable `draftText` (falls back to raw string) and never throws.
- **Risk**: Safety Agent prompt may be empty in older saved sessions. **Mitigation**: `callLlmAgent` now has a hardcoded default Safety prompt fallback.
- **Risk**: localStorage migration from v0.9.x. **Mitigation**: `loadProject()` reads v0.10.0 first, then falls back to v0.9.5 then v0.9.3 and merges `drafts` array.
- **Rollback**: Revert to commit `280083b` (last commit before Sprint 2 feature work) or use localStorage key `herbalBookForgeProject_v0.9.5` from browser DevTools.

---

## Notes for Reviewer

- PR #38 title in GitHub UI currently shows the kickoff stub title — please update manually to: **"Sprint 2: HerbalBookForge Drafting tab generation, revision, validation, and closeout"**
- Labels for issues #26–#37 could not be applied via PAT — apply `enhancement` / `sprint-2` labels manually if desired
