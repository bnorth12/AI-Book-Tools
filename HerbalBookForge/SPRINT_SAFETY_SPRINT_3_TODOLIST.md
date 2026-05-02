# HerbalBookForge Sprint 3 Todo List

Date: 2026-05-02
Sprint Number: Sprint 3
Target Capability: Safety tab — full manuscript/chapter safety scanning, report generation, and Drafter integration
Status: Planning — branch created, issues pending

## Sprint 3 Goal
Implement the Safety tab so users can run a safety audit across the full manuscript or selected chapters using the Safety & Accuracy Checker Agent, receive a structured report of contraindications, dosage issues, and PA content limits with suggested fixes per flag, and navigate directly from a safety flag to the relevant draft chapter.

## Scope Summary
- In scope:
  - Safety tab end-to-end workflow for full-manuscript and per-chapter safety scanning
  - Safety agent prompt/response contract at manuscript scope (distinct from per-chapter validation introduced in Sprint 2)
  - Structured safety report with flagged items, flag types, and suggested fixes
  - Integration link from safety flag to Drafting tab for targeted revision
  - Safety results persistence in project state and localStorage
  - Requirement updates, test coverage updates (smoke + integration)
  - Full GitHub process (issues, branch, PR, review, merge, closeout)
- Out of scope:
  - Preview tab (deferred to Sprint 4)
  - Prompts tab changes (no work needed this sprint)
  - PDF/Markdown export (Sprint 4)
  - Major visual redesign of non-Safety tabs

## Requirement Planning and Derivation Checklist
- [ ] Review current Safety tab requirement stubs in HerbalBookForge.html (HBF.SA1–SA4) and REQUIREMENTS.md.
- [ ] Confirm baseline existing Safety agent wiring in callLlmAgent (from Sprint 2 per-chapter validation).
- [ ] Create and finalize new Safety requirements:
  - [ ] HBF.SA1: Safety Tab SHALL provide safety checking via the Safety & Accuracy Checker Agent.
  - [ ] HBF.SA2: Safety Tab SHALL scan the full manuscript or selected chapters for contraindications, dosage issues, extraction risks, and PA content limits (e.g., comfrey).
  - [ ] HBF.SA3: Safety Tab SHALL generate a structured safety report with flagged items (chapter reference, flag type, flagged text, suggested fix) and an overall summary.
  - [ ] HBF.SA4: Safety Tab SHALL integrate with the Drafter tab — each flag SHALL provide a navigation action to open the relevant chapter in the Drafting tab for targeted revision.
  - [ ] HBF.SA5: Safety report SHALL persist in project state across page reloads and survive localStorage save/load and JSON export/import. The schema SHALL include a `safetyReport` object with fields: `scanScope`, `scanTimestamp`, `flags[]`, `summary`, `lastUpdated`.
  - [ ] HBF.SA6: All Safety tab interactive controls (scope selector, scan button, report panel, flag list) SHALL use stable HTML `id` and `data-testid` attributes. Selectors SHALL remain stable across revisions unless intentionally changed with corresponding test updates.
- [ ] Add/align integration-test requirements (proposed IDs HBFIT.14–HBFIT.17):
  - [ ] HBFIT.14: Integration tests SHALL verify full-manuscript safety scan via the Safety Agent, including valid JSON response structure (`flags`, `summary`).
  - [ ] HBFIT.15: Integration tests SHALL verify that safety report flags are rendered in the Safety tab UI after a scan completes.
  - [ ] HBFIT.16: Integration tests SHALL verify that safety report results persist across a full page reload (localStorage round-trip).
  - [ ] HBFIT.17: Integration tests SHALL verify that clicking a flag navigation action switches the active tab to Drafting and selects the correct chapter.
- [ ] Synchronize requirement IDs across:
  - [ ] HerbalBookForge/REQUIREMENTS.md
  - [ ] HerbalBookForge/HerbalBookForge.html (inline comments replacing existing stubs)
  - [ ] Sprint issue descriptions and PR traceability

## Data Contract and State Model Checklist
- [ ] Define `safetyReport` object in project state:
  - [ ] scanScope: "full" | "chapter:<chapterId>"
  - [ ] scanTimestamp: ISO string
  - [ ] flags[]: array of { chapterId, chapterTitle, flagType, flaggedText, suggestion }
  - [ ] summary: string
  - [ ] lastUpdated: ISO string
- [ ] Define strict JSON response schema for Safety agent manuscript-level scan:
  - [ ] `{ "flags": [ { "chapterId": "...", "chapterTitle": "...", "flagType": "...", "flaggedText": "...", "suggestion": "..." } ], "summary": "..." }`
- [ ] Add defensive parsing and fallback handling for malformed JSON from Safety agent.
- [ ] Confirm persistence in localStorage save/load and export/import path.
- [ ] Confirm coexistence with per-chapter `validation` field already in `drafts[]` from Sprint 2.

## Agent and Prompt Update Checklist
- [ ] Update Safety agent system prompt in `callLlmAgent` default prompts to support manuscript-level scope.
- [ ] Distinguish manuscript-level Safety scan (Safety tab) from per-chapter validation (Drafting tab) in prompt routing:
  - [ ] Per-chapter validation (Sprint 2): remains in `drafts[idx].validation` via Drafting tab.
  - [ ] Manuscript-level scan (Sprint 3): writes to `project.safetyReport` via Safety tab.
- [ ] Add explicit Safety agent instructions for:
  - [ ] Scanning multi-chapter context (all draft texts concatenated or individually labeled)
  - [ ] Returning structured flag array with chapter attribution
  - [ ] Flag type taxonomy: CONTRAINDICATION, DOSAGE, PA_CONTENT, EXTRACTION_RISK, GENERAL_SAFETY
  - [ ] Strict JSON output contract
- [ ] Ensure `callLlmAgent` routing remains compliant with HBF.UNI1 and HBF.UNI4.

## Safety Workflow Functional Checklist
- [ ] Safety tab scope selector (full manuscript or per-chapter dropdown).
- [ ] Run Safety Scan action button.
- [ ] Render structured safety report panel (summary + flag list).
- [ ] Per-flag display: chapter reference, flag type badge, flagged text excerpt, suggested fix.
- [ ] Navigate-to-draft action per flag (switches to Drafting tab, selects chapter).
- [ ] Clear progress/status indicator during long-running scan.
- [ ] Empty state when no drafts exist (scan requires at least one draft).
- [ ] Re-scan action to refresh report after revisions.

## UI and UX Checklist (Safety Tab)
- [ ] Add required Safety tab controls with `data-testid` hooks.
- [ ] Keep responsive layout and keyboard focus requirements intact (UIU.HBF.NF1–NF4).
- [ ] Add clear empty state when no chapter drafts are available.
- [ ] Add non-blocking error messaging for failed scan/parsing.
- [ ] Flag type badges use distinct visual treatment (color or icon) for quick scanning.
- [ ] Ensure IDs/selectors used by existing smoke/regression tests remain stable or update tests in same sprint.

## Testing and Test Asset Update Checklist
- [ ] Update smoke tests to verify Safety tab controls/visibility (HBF.SA6).
- [ ] Add Safety-specific integration tests:
  - [ ] Full-manuscript scan (HBFIT.14)
  - [ ] Flag rendering in Safety tab UI (HBFIT.15)
  - [ ] Safety report persistence across reload (HBFIT.16)
  - [ ] Flag navigation to Drafting tab (HBFIT.17)
- [ ] Add negative tests:
  - [ ] No drafts available (empty manuscript guard)
  - [ ] Malformed JSON from Safety agent
  - [ ] API error handling (401, 429, 500, 503)
- [ ] Update HerbalBookForge/TESTING.md:
  - [ ] Add Safety tab smoke test descriptions and data-testid table
  - [ ] Add HBFIT.14–17 section with wait times and skip behavior
  - [ ] Update performance metrics table with Safety scan row
- [ ] Capture and store sprint test evidence under docs/releases/evidence/.

## GitHub and Administrative Process Checklist
- [ ] Create sprint issue set (target: 12 issues) for Sprint 3.
- [ ] Every issue includes:
  - [ ] Requirement IDs
  - [ ] Acceptance criteria
  - [ ] Test expectation
  - [ ] Dependency/ordering notes
- [ ] Feature branch created from main:
  - [x] branch name: feature/herbalbookforge-sprint-3-safety
- [ ] Implement and commit in logical slices mapped to issues.
- [ ] Open PR from feature branch to main.
- [ ] PR body includes:
  - [ ] Requirement traceability table
  - [ ] Closes statements for all sprint issues
  - [ ] Test result summary
  - [ ] Risk/rollback notes
- [ ] Request review and obtain approval.
- [ ] Merge PR using agreed strategy.
- [ ] Close all linked sprint issues.
- [ ] Delete feature branch after merge.
- [ ] Update sprint checklist and release evidence docs for closeout.

## Suggested Sprint 3 Issue Backlog (Planning Draft)
- [ ] Issue 1: Requirement analysis — HBF.SA1–SA6 and HBFIT.14–17 derivation
- [ ] Issue 2: Safety state model — `safetyReport` schema and persistence
- [ ] Issue 3: Safety agent prompt update — manuscript-level scan contract and JSON parser
- [ ] Issue 4: Safety tab HTML — scope selector, scan button, report panel structure
- [ ] Issue 5: `renderSafetyTab()` and `runSafetyCheck()` implementation
- [ ] Issue 6: Per-flag rendering and navigate-to-draft integration with Drafting tab
- [ ] Issue 7: Error handling — empty manuscript guard, HTTP errors, malformed JSON fallback
- [ ] Issue 8: Smoke test updates for Safety tab controls
- [ ] Issue 9: Integration tests HBFIT.14–17
- [ ] Issue 10: TESTING.md update for v0.11.0
- [ ] Issue 11: REQUIREMENTS.md update + inline HTML comment sync
- [ ] Issue 12: PR packaging, evidence files, and sprint closeout

## Definition of Done (Sprint 3)
- [ ] All Sprint 3 issues are created, implemented, reviewed, and closed.
- [ ] Feature branch is merged to main and deleted.
- [ ] PR is merged with requirement traceability and passing tests documented.
- [ ] Requirements and inline requirement comments are synchronized.
- [ ] Safety tab supports: scope selection, scan, report rendering, flag navigation, and persist.
- [ ] Integration and smoke tests pass with updated coverage.
- [ ] Release evidence and sprint closeout artifacts are complete.
- [ ] Version bumped to v0.11.0 in HerbalBookForge.html and package.json.

## Execution Guardrail
This document is planning only. Do not start issue filing, implementation, testing, or PR creation until explicit kickoff approval is given for each phase.
