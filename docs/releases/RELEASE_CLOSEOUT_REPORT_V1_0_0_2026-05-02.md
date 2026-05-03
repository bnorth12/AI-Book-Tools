# HerbalBookForge v1.0.0 — Release Closeout Report

**Release**: v1.0.0 GA
**Date**: 2026-05-02
**Sprint**: Sprint 6 — Robustness, UX Polish & Output Quality
**Status**: ✅ Released

---

## Overview

HerbalBookForge v1.0.0 is the first General Availability release of the single-file browser-based herbal medicine book authoring tool. This release completes the full 8-tab authoring pipeline — Setup, Book Goals, Outline, Chapter Outlines, Drafting, Safety, Preview, and Prompts — with all core LLM-agent workflows operational, a 33-test integration suite, and an 8-test smoke suite passing.

---

## Sprint 6 Issues Delivered (v0.14.0 → v1.0.0)

| # | Issue | Req ID(s) | Status |
|---|-------|-----------|--------|
| 1 | Sprint 6 Requirements Lock | HBF.DR10, HBF.SA7-8, HBF.CHO8-9, HBF.PR5, HBF.UI1-3, HBF.POL1 | ✅ Done |
| 2 | Chapter Indexing Off-by-One Fix | HBF.DR10 | ✅ Done |
| 3 | Safety Scope Label & Flag Text Fix | HBF.SA7, HBF.SA8 | ✅ Done |
| 4 | Outline Truncation Detection Guard | HBF.CHO9 | ✅ Done |
| 5 | Outline Output Normalization | HBF.CHO8 | ✅ Done |
| 6 | Duplicate Heading Fix in Preview | HBF.PR5 | ✅ Done |
| 7 | Tab Navigation Order Reorder | HBF.UI1 | ✅ Done |
| 8 | Export/Import Icon Semantics Fix | HBF.UI2 | ✅ Done |
| 9 | Footer Status Label Clarity | HBF.UI3 | ✅ Done |
| 10 | Author Name Leakage Guard | HBF.POL1 | ✅ Done |
| 11 | Smoke Test Updates (HBFST.7-8) | HBFST.7, HBFST.8 | ✅ Done |
| 12 | Integration Tests HBFIT.25-30 | HBFIT.25–30 | ✅ Done |
| 13 | TESTING.md + REQUIREMENTS.md Sync | — | ✅ Done |
| 14 | Sprint Closeout & PR Packaging | — | ✅ Done |

---

## What Changed in Sprint 6

### Code Changes — `HerbalBookForge/HerbalBookForge.html`

**New helpers added:**

- `toDisplayChapterNumber(zeroBasedIndex)` — centralized 1-based chapter display number (HBF.DR10)
- `normalizeOutlineText(raw)` — strips code fences, JSON wrappers, escaped `\n` from LLM outline output (HBF.CHO8)
- `isOutlineTruncated(finishReason, outlineText)` — detects truncated LLM responses via `finish_reason==='length'` (HBF.CHO9)
- `detectAuthorNameLeakage(text, authorNames)` — regex-based author name scan in generated text (HBF.POL1)
- `extractStyleReferenceNames(goals)` — extracts proper name candidates from the tone/style field (HBF.POL1)

**Modified functions:**

- `callLlmAgent()` — now extracts `finish_reason` from API response and attaches it as `parsed._finishReason`
- `acceptBookGoals()` — applies `normalizeOutlineText()` and `isOutlineTruncated()` with yellow truncation warning
- `sendToOutlinerForOutline()` — applies `normalizeOutlineText()` and `isOutlineTruncated()` with yellow truncation warning
- `generateDraft()` — status message uses `toDisplayChapterNumber(idx)`; adds non-blocking author name leakage warning after save
- `generateRemainingChapters()` — progress string uses `toDisplayChapterNumber(idx)`
- `runSafetyCheck()` — scope label uses `toDisplayChapterNumber()` (1-based display in chapter scope); chapter context strings updated
- `parseSafetyReport()` — flags now include `chapterNumber` (1-based) and `_parseWarning` fields
- `renderSafetyReport()` — renders `⚠️` warning banner when flags have `_parseWarning` set (HBF.SA8)
- `assembleManuscript()` — strips matching heading prefix from draft body before concatenating to prevent duplicate headings (HBF.PR5)

**UI changes:**

- Tab order: Prompts tab moved after Preview (`Setup → Goals → Outline → Chapter Outlines → Drafting → Safety → Preview → Prompts`)
- Export button: `↑ Export` with `aria-label="Export project to JSON file"`
- Import label: `↓ Import` with `aria-label="Import project from JSON file"`
- Footer: `Author Mode | Agents: Herbal Experts Only` with `data-testid="footer-status-label"`

**Version / localStorage:**

- All version strings updated to `v1.0.0`
- localStorage key: `herbalBookForgeProject_v1.0.0`
- Migration fallback chain: `v1.0.0 → v0.14.0 → v0.11.0 → v0.10.0 → v0.9.5 → v0.9.3`

---

## Test Coverage at v1.0.0

| Suite | File | Count | Status |
|---|---|---|---|
| Smoke | `herbalbookforge.smoke.spec.js` | 8 tests | ✅ Passing |
| Integration | `herbalbookforge.integration.spec.js` | 33 tests | ✅ Passing |

### New tests in this release

- **HBFST.7** — Prompts tab DOM order; footer `data-testid` and author-facing text
- **HBFST.8** — Export/Import aria-label semantics
- **HBFIT.25** — Draft chapter selector shows 1-based numbers
- **HBFIT.26** — Safety scope options do not expose 0-based chapter IDs
- **HBFIT.27** — Safety warning banner for malformed flags
- **HBFIT.28** — `normalizeOutlineText` strips code fences
- **HBFIT.29** — `isOutlineTruncated` detects `finish_reason=length`
- **HBFIT.30** — Preview assembly strips duplicate heading from draft body

---

## Feature Completeness at v1.0.0

| Tab / Feature | Sprint Delivered | Status |
|---|---|---|
| Setup (API key, project name, export/import) | Sprint 1 | ✅ Complete |
| Book Goals Agent | Sprint 1 | ✅ Complete |
| Outline Agent | Sprint 1 | ✅ Complete |
| Chapter Annotator Agent | Sprint 1–2 | ✅ Complete |
| Drafting Agent (single + batch) | Sprint 2–5 | ✅ Complete |
| Revision Agent | Sprint 2 | ✅ Complete |
| Validation Agent | Sprint 2 | ✅ Complete |
| Safety Agent (full + chapter scope) | Sprint 3 | ✅ Complete |
| Preview (assemble + MD/HTML/RTF export) | Sprint 4 | ✅ Complete |
| Prompts tab (custom agent prompts) | Sprint 4 | ✅ Complete |
| Generate Remaining Chapters | Sprint 5 | ✅ Complete |
| Outline normalization & truncation guard | Sprint 6 | ✅ Complete |
| Author name leakage detection | Sprint 6 | ✅ Complete |
| Duplicate heading deduplication | Sprint 6 | ✅ Complete |

**Deferred (post-v1.0.0):**

- Native DOCX export (HBF.PR3.D1)
- Mock LLM responses for CI/CD (no API key)
- Cross-browser testing (Firefox, Safari)

---

## Files Modified in This Sprint

| File | Change |
|---|---|
| `HerbalBookForge/HerbalBookForge.html` | All Sprint 6 code changes + v1.0.0 version bump |
| `HerbalBookForge/REQUIREMENTS.md` | Sprint 6 requirements locked; header updated to v1.0.0 GA |
| `HerbalBookForge/TESTING.md` | Updated to v1.0.0; HBFST.7-8 and HBFIT.25-30 documented |
| `tests/e2e/herbalbookforge.smoke.spec.js` | Added HBFST.7 and HBFST.8 |
| `tests/e2e/herbalbookforge.integration.spec.js` | Added HBFIT.25–30 |
| `package.json` | Bumped repo version to 1.3.0 |

---

## Definition of Done — All Criteria Met ✅

- [x] All 14 Sprint 6 issues implemented and closed
- [x] REQUIREMENTS.md locked and synced to v1.0.0
- [x] TESTING.md updated with new test descriptions and counts
- [x] Smoke tests: 8/8 passing
- [x] Integration tests: 33/33 passing
- [x] Version badge, localStorage key, meta.version, and comment header all read `v1.0.0`
- [x] Migration fallback chain preserves user data from v0.9.3 through v0.14.0
- [x] Release closeout report created
