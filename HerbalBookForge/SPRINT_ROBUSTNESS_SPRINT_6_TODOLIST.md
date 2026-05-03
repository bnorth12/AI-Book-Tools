# HerbalBookForge Sprint 6 Todo List

Date: 2026-05-02
Sprint Number: Sprint 6
Target Capability: Robustness, UX Polish & Output Quality — v0.14.0
Status: Planning — pending branch creation and issue filing

## Sprint 6 Goal
Address the backlog of quality, robustness, and UX issues identified in the Sprint 5 closeout analysis (#102 issue set). Deliver accurate indexing, correct safety scope display, normalized outline output, polished navigation order and iconography, author-name guardrails, and duplicate-heading elimination — with full requirement traceability, smoke and integration test coverage, and clean sprint closeout.

## Scope Summary
- In scope:
  - Chapter indexing off-by-one in progress/status labels (Drafting + batch) — HBF.DR10
  - Safety scan scope label accuracy and blank flag text fallback — HBF.SA7, HBF.SA8
  - Outline improve/edit raw JSON / escaped markup display — HBF.CHO8
  - Outline generation truncation detection and guard — HBF.CHO9
  - Assembled manuscript duplicate chapter heading — HBF.PR5
  - Tab navigation order: Prompts moved after Preview — HBF.UI1
  - Export/Import icon semantics and accessible labels — HBF.UI2
  - Footer status label — user-facing author language — HBF.UI3
  - Author name leakage guard in prompt output — HBF.POL1
  - Smoke test updates (HBFST.7, HBFST.8)
  - Integration tests HBFIT.25–HBFIT.30
  - REQUIREMENTS.md and TESTING.md synchronization
  - Full GitHub process (issues, branch, PR, review, merge, closeout)
- Out of scope:
  - DOCX export (deferred beyond v0.13.0 per Sprint 5 decision)
  - Major new feature tabs
  - Schema interoperability with other tools (tracked separately)

---

## Requirement Planning and Derivation Checklist
- [ ] Review open issues #80, #82, #86, #88, #91, #94, #95, #98, #99, #101 and confirm canonical dedupe map from #102 analysis is still accurate.
- [ ] Create and finalize new requirements in REQUIREMENTS.md:
  - [ ] HBF.DR10: Drafting progress and status displays SHALL use 1-based chapter numbering and SHALL match the chapter currently being generated for both single-chapter and batch generation.
  - [ ] HBF.SA7: Safety scan scope labels SHALL display the exact user-selected chapter number for chapter-scoped scans; full-book findings SHALL include chapter number per flag.
  - [ ] HBF.SA8: Safety prompt/output contract SHALL require per-flag `chapterNumber`, `issue` (or normalized equivalent), and `suggestion` (or normalized equivalent); UI SHALL surface a user-visible parse warning for malformed flags.
  - [ ] HBF.CHO8: Outline improve/edit outputs SHALL be normalized to human-readable outline text before render/save; raw JSON and escaped markup SHALL not be displayed in the chapter-outline editor.
  - [ ] HBF.CHO9: Outline generation/improve flows SHALL detect truncation (e.g., via `finish_reason`) and SHALL retry/continue or block acceptance with a clear user warning if output is incomplete.
  - [ ] HBF.PR5: Assembled manuscript output SHALL contain exactly one chapter heading per chapter section.
  - [ ] HBF.UI1: Top navigation order SHALL reflect author workflow: Goals → Outline → Chapter Outlines → Drafting → Safety → Preview → Prompts.
  - [ ] HBF.UI2: Header Export/Import icons SHALL align with action semantics and include accessible labels/tooltips.
  - [ ] HBF.UI3: Footer status copy SHALL be user-facing, include explicit role/mode semantics, and support configurable role labels (Developer / Author / Editor) via project setting or env flag.
  - [ ] HBF.POL1: Style-reference author names in prompts SHALL not appear in generated chapter or outline prose unless explicitly requested by the user; a lexical post-check SHALL flag accidental name leakage.
- [ ] Add integration test specifications to REQUIREMENTS.md:
  - [ ] HBFIT.25: Generate Remaining and single draft status numbering is accurate for chapters >10 and matches the active chapter.
  - [ ] HBFIT.26: Safety chapter-scoped scan label matches selected chapter; full-book flags include chapter number per flag.
  - [ ] HBFIT.27: Safety rendering shows issue/suggestion text for canonical and alternate key names; malformed flags trigger a visible warning.
  - [ ] HBFIT.28: Outline improve/edit output normalization strips JSON/escaped markup and preserves readable structure.
  - [ ] HBFIT.29: Outline truncation detection blocks acceptance or auto-recovers continuation path.
  - [ ] HBFIT.30: Assembled manuscript contains one heading per chapter in preview/export outputs.
- [ ] Add smoke test specifications:
  - [ ] HBFST.7: Nav order check confirms Prompts tab appears after Preview; footer status element semantics are present.
  - [ ] HBFST.8: Export/Import icon semantics and accessible labels are present and correct.
- [ ] Synchronize requirement IDs across:
  - [ ] HerbalBookForge/REQUIREMENTS.md
  - [ ] HerbalBookForge/HerbalBookForge.html (inline requirement comments)
  - [ ] Sprint issue descriptions and PR traceability

---

## Data Contract and State Model Checklist
- [ ] HBF.DR10 — centralize `toDisplayChapterNumber(index)` helper returning 1-based display number; replace all raw index formatting in Drafting and batch-generation status labels.
- [ ] HBF.SA7/SA8 — enforce chapterNumber field in safety flag objects; add fallback map for `issue|flaggedText|flagged_text|text` and `suggestion|recommendation`; add malformed-flag warning banner.
- [ ] HBF.CHO8 — define canonical outline normalization function (`normalizeOutlineText(raw)`): strips code fences, escaped newlines, JSON wrapper; returns readable text or throws for graceful fallback.
- [ ] HBF.CHO9 — add `finish_reason` check to outline API responses; define truncation detection threshold and continuation-retry or block-with-warning behavior.
- [ ] HBF.PR5 — define single heading-source rule for `assembleManuscript()`: use outline chapter title; strip matching prefix from draft body before concatenation.
- [ ] HBF.POL1 — define author-name extraction from prompts state; define post-check function `detectAuthorNameLeakage(text, authorNames[])`; define warning/strip behavior.

---

## Implementation Checklist

### Issue 1 — Sprint 6 Requirements Lock
- [ ] Lock all 10 new requirements (HBF.DR10, HBF.SA7, HBF.SA8, HBF.CHO8, HBF.CHO9, HBF.PR5, HBF.UI1, HBF.UI2, HBF.UI3, HBF.POL1) in REQUIREMENTS.md with acceptance criteria.
- [ ] Add integration test specs HBFIT.25–30 and smoke specs HBFST.7–8.
- [ ] Version status in REQUIREMENTS.md updated to v0.14.0, sync date 2026-05-02.

### Issue 2 — Chapter Indexing Fix (HBF.DR10) — closes #80, #99
- [ ] Add `toDisplayChapterNumber(index)` helper (returns `index + 1`).
- [ ] Replace all raw index-based status strings in `generateDraft()`, `generateRemainingChapters()`, and any other Drafting status labels.
- [ ] Verify "Drafting X of Y" indicator shows correct 1-based numbers for chapters >10.
- [ ] Add HBFIT.25 integration test.

### Issue 3 — Safety Scope Label and Flag Text Fix (HBF.SA7, HBF.SA8) — closes #82, #79, #81
- [ ] Fix chapter-scoped scan label to display 1-based chapter number, not array index.
- [ ] Enforce `chapterNumber` field in safety prompt output contract.
- [ ] Extend `coerceStr()` / flag parser to try `issue|flaggedText|flagged_text|text|description|concern` for flag text.
- [ ] Extend suggestion fallback to try `suggestion|recommendation|fix|resolution`.
- [ ] Add visible malformed-flag warning banner when parse fails.
- [ ] Add HBFIT.26 and HBFIT.27 integration tests.

### Issue 4 — Outline Truncation Detection (HBF.CHO9) — closes #86
- [ ] Check `finish_reason` on outline generation and improve API calls.
- [ ] If `finish_reason === 'length'` or structural completeness check fails: auto-retry continuation or display actionable block warning.
- [ ] Do not allow "Accept Outline" / "Accept Chapter Outlines" if truncation is detected.
- [ ] Add HBFIT.29 integration test.

### Issue 5 — Outline Normalize Output (HBF.CHO8) — closes #94, #92, #93
- [ ] Implement `normalizeOutlineText(raw)`: strips ` ```json `, ` ``` `, JSON wrapper objects, escaped `\n` → newline, leading/trailing whitespace.
- [ ] Apply normalization before populating outline editor textarea and before saving to state.
- [ ] Validate readable format before enabling accept action; show warning if normalization fails.
- [ ] Add HBFIT.28 integration test.

### Issue 6 — Assembled Manuscript Duplicate Heading Fix (HBF.PR5) — closes #101, #100
- [ ] In `assembleManuscript()`: use outline chapter title as heading; strip matching title prefix from draft body before concatenation.
- [ ] Add case-insensitive, whitespace-normalized heading deduplication.
- [ ] Add HBFIT.30 integration test.

### Issue 7 — Tab Navigation Order (HBF.UI1) — closes #95
- [ ] Reorder top nav tabs in HTML: Goals → Outline → Chapter Outlines → Drafting → Safety → Preview → Prompts.
- [ ] Verify all existing tab-switching JS references use IDs, not positional index.
- [ ] Update smoke test tab-order assertion.
- [ ] Update HBFST.7 (nav order + footer status label test).

### Issue 8 — Export/Import Icon Fix (HBF.UI2) — closes #88, #87
- [ ] Identify which icon is reversed (export = outward arrow, import = inward arrow).
- [ ] Swap or replace icons; add `aria-label` and `title` tooltip attributes.
- [ ] Verify `export-project-btn` and `import-project-input` test IDs remain stable.
- [ ] Add HBFST.8 smoke test for icon semantics and accessible labels.

### Issue 9 — Footer Status Label Clarity (HBF.UI3) — closes #91, #89, #90
- [ ] Replace developer-centric status copy with author-facing language.
- [ ] Define role/mode status taxonomy: Role (Developer/Author/Editor), Mode (Working/Scanning/Drafting/Exporting), Agent Scope.
- [ ] Add `data-testid="footer-status-label"` if not present.
- [ ] HBFST.7 smoke assertion updated to include footer status element.

### Issue 10 — Author Name Leakage Guard (HBF.POL1) — closes #98, #96, #97
- [ ] Extract author names from prompts state (style reference field).
- [ ] Implement `detectAuthorNameLeakage(text, authorNames[])` post-check after each draft/outline generation.
- [ ] If name leakage detected: surface non-blocking warning with flagged excerpt; do not auto-strip (user decides).
- [ ] Add prompt guardrail to Drafter and Outliner default prompts: "Style-reference authors guide tone only and must NOT appear by name in generated prose."
- [ ] Add HBFIT.27 coverage note (warning visibility path).

### Issue 11 — Smoke Test Updates (HBFST.7, HBFST.8)
- [ ] Add HBFST.7: validate Prompts tab appears after Preview in DOM order; validate `footer-status-label` element present and contains user-facing text.
- [ ] Add HBFST.8: validate Export button has `aria-label` containing "Export"; validate Import control has `aria-label` containing "Import".
- [ ] Ensure all 8 smoke tests pass (6 legacy + 2 new).

### Issue 12 — Integration Tests HBFIT.25–30
- [ ] HBFIT.25: Chapter status numbering accuracy for batch draft generation >10 chapters.
- [ ] HBFIT.26: Safety chapter-scoped scan label shows correct chapter number.
- [ ] HBFIT.27: Safety rendering with alternate field names and malformed-flag warning.
- [ ] HBFIT.28: Outline normalize strips JSON/escaped markup, readable text preserved.
- [ ] HBFIT.29: Outline truncation detection blocks accept with warning.
- [ ] HBFIT.30: Assembled manuscript has one heading per chapter, no duplicates.
- [ ] Verify all 33 integration tests pass (27 legacy + 6 new).

### Issue 13 — TESTING.md + REQUIREMENTS.md Sync
- [ ] Update TESTING.md: version v0.14.0, date 2026-05-02.
- [ ] Add Sprint 6 smoke test section (HBFST.7, HBFST.8 descriptions, data-testid table updates).
- [ ] Add Sprint 6 integration test section (HBFIT.25–30 descriptions and commands).
- [ ] Update smoke test count: 8/8; integration test count: 33/33.
- [ ] Confirm REQUIREMENTS.md locked (Issue 1 prerequisite).

### Issue 14 — Sprint Closeout and PR Packaging
- [ ] Write sprint closeout report: docs/releases/RELEASE_CLOSEOUT_REPORT_SPRINT6_ROBUSTNESS_2026-05-02.md.
- [ ] PR body: requirement traceability table, Closes statements for all sprint issues (#80, #82, #86, #87, #88, #89, #90, #91, #92, #93, #94, #95, #96, #97, #98, #99, #100, #101).
- [ ] PR body: test results summary (8/8 smoke, 33/33 integration).
- [ ] PR body: risk/rollback notes (tab reorder, icon change, output normalization).
- [ ] Update version to v0.14.0 in HerbalBookForge.html and package.json.
- [ ] Merge PR to main, delete feature branch.
- [ ] Close all linked sprint issues.

---

## Testing and Test Asset Update Checklist
- [ ] Smoke tests: extend from 6 → 8 passing (HBFST.7 + HBFST.8).
- [ ] Integration tests: extend from 27 → 33 passing (HBFIT.25–30).
- [ ] Negative tests:
  - [ ] Outline with truncated finish_reason (HBFIT.29)
  - [ ] Safety malformed flag produces warning banner (HBFIT.27)
  - [ ] Assembled manuscript heading dedupe with exact and near-match titles (HBFIT.30)
- [ ] Capture test evidence under docs/releases/evidence/.

---

## GitHub and Administrative Process Checklist
- [ ] Create sprint issue set (target: 14 issues) for Sprint 6.
- [ ] Every issue includes: requirement IDs, acceptance criteria, test expectation, dependency/ordering notes.
- [ ] Feature branch created from main: `feature/herbalbookforge-sprint-6-robustness`
- [ ] Implement and commit in logical slices mapped to issues.
- [ ] Open PR from feature branch to main.
- [ ] PR reviewed and approved.
- [ ] PR merged using agreed strategy.
- [ ] Close all linked sprint issues.
- [ ] Delete feature branch after merge.
- [ ] Update sprint checklist and release evidence docs for closeout.

---

## Suggested Sprint 6 Issue Backlog (Planning Draft)
- [ ] Issue 1: Sprint 6 requirements lock — HBF.DR10, HBF.SA7, HBF.SA8, HBF.CHO8, HBF.CHO9, HBF.PR5, HBF.UI1–UI3, HBF.POL1 + test specs HBFIT.25–30, HBFST.7–8
- [ ] Issue 2: Fix chapter indexing off-by-one in Drafting progress/status (closes #80, #99) — HBF.DR10
- [ ] Issue 3: Fix safety scan scope label and blank flag text fallback (closes #82, #79, #81) — HBF.SA7, HBF.SA8
- [ ] Issue 4: Outline truncation detection and guard (closes #86) — HBF.CHO9
- [ ] Issue 5: Outline improve/edit output normalization — strip raw JSON/markup (closes #94, #92, #93) — HBF.CHO8
- [ ] Issue 6: Assembled manuscript duplicate heading fix (closes #101, #100) — HBF.PR5
- [ ] Issue 7: Tab navigation reorder — Prompts after Preview (closes #95) — HBF.UI1
- [ ] Issue 8: Export/Import icon semantics and accessible labels (closes #88, #87) — HBF.UI2
- [ ] Issue 9: Footer status label — author-facing language (closes #91, #89, #90) — HBF.UI3
- [ ] Issue 10: Author name leakage guard in prompt output (closes #98, #96, #97) — HBF.POL1
- [ ] Issue 11: Smoke test updates — HBFST.7 (nav order + footer status) and HBFST.8 (icon a11y)
- [ ] Issue 12: Integration tests HBFIT.25–30
- [ ] Issue 13: TESTING.md + REQUIREMENTS.md sync for v0.14.0
- [ ] Issue 14: Sprint 6 closeout, PR packaging, version bump to v0.14.0

---

## Definition of Done (Sprint 6)
- [ ] All 14 Sprint 6 issues are created, implemented, reviewed, and closed.
- [ ] Feature branch `feature/herbalbookforge-sprint-6-robustness` merged to main and deleted.
- [ ] PR merged with requirement traceability and passing tests documented.
- [ ] Requirements and inline requirement comments are synchronized.
- [ ] Chapter progress indicators show correct 1-based numbering.
- [ ] Safety scan scope and flag text are accurate and complete.
- [ ] Outline output is always human-readable; truncation is detected and handled.
- [ ] Assembled manuscript contains exactly one heading per chapter.
- [ ] Tab order follows author workflow; icons and footer label are clear and accessible.
- [ ] Author-name leakage produces a visible warning.
- [ ] Smoke tests: 8/8 passing. Integration tests: 33/33 passing.
- [ ] Release evidence and sprint closeout artifacts are complete.
- [ ] Version bumped to v0.14.0 in HerbalBookForge.html and package.json.
