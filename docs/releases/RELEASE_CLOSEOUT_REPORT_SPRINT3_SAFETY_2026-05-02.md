# Release Closeout Report — Sprint 3 Safety Tab (v0.11.0) — 2026-05-02

## Objective

Close out Sprint 3 for HerbalBookForge by merging the Safety tab implementation
(`feature/herbalbookforge-sprint-3-safety`) to `main`, documenting all completed
work, and recording final test evidence.

---

## Sprint 3 Issues Completed

| Issue | Title | Commit |
|-------|-------|--------|
| #39 | Requirements derivation — HBF.SA1-SA6, HBFIT.14-17 | `29a8360` |
| #40 | Safety state model (`safetyReport`), localStorage v0.11.0 | `f269ae0` |
| #41 | Safety agent manuscript-level prompt, `parseSafetyReport()` | `6ef6b45` |
| #42 | Safety tab HTML — scope select, scan button, report panel, data-testid hooks | `25dac37` |
| #43 | `renderSafetyTab()`, `runSafetyCheck()`, `renderSafetyReport()`, `navigateToDraftFromFlag()` | `9c9c752` |
| #44 | Error handling — empty guard, HTTP errors, malformed JSON protection | `3c7b00e` |
| #45 | Per-flag rendering + navigate-to-draft (colour-coded badges, "Open in Drafting tab") | `3c7b00e` |
| #46 | Smoke test — Safety tab control presence (HBF.SA6) | `e6d2126` |
| #47 | Integration tests HBFIT.14–17 | `8a9c6b5` |
| #48 | TESTING.md updated for v0.11.0 (smoke test 3, HBFIT.14-17 documented) | `c1e56ec` |
| #49 | REQUIREMENTS.md final sync, inline HTML comment verification | `6b8e3ff` |
| #50 | PR packaging and sprint closeout | *(this commit)* |

---

## Requirements Coverage

| Requirement | Description | Status |
|-------------|-------------|--------|
| HBF.SA1 | Safety tab with Safety & Accuracy Checker Agent | ✅ Implemented |
| HBF.SA2 | Full-manuscript or per-chapter scan scope | ✅ Implemented |
| HBF.SA3 | Structured report: `{ flags[], summary }` with typed flags | ✅ Implemented |
| HBF.SA4 | Navigate-to-draft integration from each flag | ✅ Implemented |
| HBF.SA5 | `safetyReport` persists in `project.safetyReport` via localStorage | ✅ Implemented |
| HBF.SA6 | Stable `id` and `data-testid` attributes on all Safety tab controls | ✅ Implemented |
| HBFIT.14 | Integration test: full-manuscript scan, valid `{ flags[], summary }` | ✅ Added |
| HBFIT.15 | Integration test: flags render in Safety tab UI after scan | ✅ Added |
| HBFIT.16 | Integration test: report persists across page reload | ✅ Added |
| HBFIT.17 | Integration test: navigate-to-draft switches tab and selects chapter | ✅ Added |

---

## Test Evidence

### Smoke Tests — Final Run Before Merge

```

Running 3 tests using 1 worker

  ✓  1  App loads and shows main tabs (1.6s)
  ✓  2  Drafting tab renders all required controls (HBF.DR8) (1.8s)
  ✓  3  Safety tab renders all required controls (HBF.SA6) (2.2s)

  3 passed (8.2s)

```

### Integration Tests

- HBFIT.14–17: added to `herbalbookforge.integration.spec.js`
- Require `GROK_API_KEY` in `.env`; skip gracefully if not configured
- HBFIT.15/16/17 use localStorage injection (no API call required)
- HBFIT.14 exercises live Safety Agent (120s timeout)

---

## Key Implementation Details

- **Safety agent**: `grok-4.20-0309-reasoning` with manuscript-level JSON contract
  `{ "flags": [{ chapterId, chapterTitle, flagType, flaggedText, suggestion }], "summary": "..." }`

- **Flag types**: `CONTRAINDICATION`, `DOSAGE`, `PA_CONTENT`, `EXTRACTION_RISK`, `GENERAL_SAFETY`
- **Scan scopes**: Full manuscript + per-chapter (dropdown populated from `project.drafts`)
- **Persistence key**: `herbalBookForgeProject_v0.11.0` (fallback chain: v0.10.0 → v0.9.5 → v0.9.3)
- **Duplicate parser removed**: `parseSafetyReport` deduplication in `3c7b00e`

---

## Git Evidence

- Feature branch: `feature/herbalbookforge-sprint-3-safety`
- Commits ahead of main: 12
- Smoke tests: 3/3 passing on branch HEAD

## Required Post-Merge Actions

1. Run smoke tests on `main` after merge to confirm clean state.
2. Tag release: `git tag v0.11.0 && git push origin v0.11.0`
3. Run HBFIT.14 with live API key to record integration evidence.
