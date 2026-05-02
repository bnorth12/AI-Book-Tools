# HerbalBookForge Sprint 2 Todo List

Date: 2026-04-26 (updated 2026-05-02)
Sprint Number: Sprint 2
Target Capability: Drafting tab chapter writing from Book Goals + Chapter Outline inputs
Status: In Progress — Issue #26 complete

## Sprint 2 Goal
Implement the Drafting tab so users can generate full chapter text from approved chapter outlines and book goals, validate the generated text, and iteratively revise chapter drafts using user feedback.

## Scope Summary
- In scope:
  - Drafting tab end-to-end workflow for first-pass chapter generation
  - JSON-based Drafter agent prompt/response contract updates
  - Draft validation workflow and UI feedback
  - Revision workflow for iterative chapter updates
  - Requirement updates and test coverage updates
  - Full GitHub process (issues, branch, PR, review, merge, closeout)
- Out of scope:
  - Full manuscript assembly/export redesign
  - Major visual redesign of non-Drafting tabs

## Requirement Planning and Derivation Checklist
- [x] Review current requirements in HerbalBookForge/REQUIREMENTS.md and inline requirement comments in HerbalBookForge/HerbalBookForge.html.
- [x] Confirm baseline existing Drafting requirements (HBF.DR1, HBF.DR2) and identify gaps.
- [x] Create new Drafting requirements (proposed IDs):
  - [x] HBF.DR3: Drafting tab SHALL generate full chapter text using selected chapter outline + book goals context.
  - [x] HBF.DR4: Drafter agent SHALL return strict JSON with parseable chapter draft fields.
  - [x] HBF.DR5: User SHALL be able to provide revision instructions and regenerate updated chapter text from prior draft.
  - [x] HBF.DR6: Draft validation SHALL evaluate structure/quality/safety and present actionable feedback.
  - [x] HBF.DR7: Draft edits and revisions SHALL persist in project state and survive reload.
  - [x] HBF.DR8: Drafting tab controls/selectors SHALL remain stable or be intentionally revised with test updates.
- [x] Add/align integration-test requirements (proposed IDs HBFIT.9-HBFIT.13) for drafting generation, revision, validation, and persistence.
- [x] Synchronize requirement IDs across:
  - [x] HerbalBookForge/REQUIREMENTS.md
  - [x] HerbalBookForge/HerbalBookForge.html (inline comments)
  - [ ] Sprint issue descriptions and PR traceability (manual — apply to GitHub issue #26 body)

## Data Contract and State Model Checklist
- [ ] Define chapter draft object model in project state (proposed):
  - [ ] chapterId
  - [ ] chapterTitle
  - [ ] outlineContext
  - [ ] draftText
  - [ ] validation
  - [ ] revisionHistory[]
  - [ ] lastUpdated
- [ ] Define strict JSON response schema for Drafter agent first-pass generation.
- [ ] Define strict JSON response schema for Drafter agent revision pass.
- [ ] Define strict JSON response schema for draft validation feedback.
- [ ] Add defensive parsing and fallback handling for malformed JSON.
- [ ] Confirm persistence in localStorage save/load and export/import path.

## Agent and Prompt Update Checklist
- [ ] Update Drafter prompt in default prompts and Prompts Editor to enforce strict JSON output contract.
- [ ] Ensure callLlmAgent agent-to-prompt routing remains compliant with HBF.UNI1 and HBF.UNI4.
- [ ] Add explicit Drafter prompt instructions for:
  - [ ] Using both Book Goals and selected Chapter Outline
  - [ ] Producing full chapter prose (not just bullet outline)
  - [ ] Tone and practical style consistency
  - [ ] Structured self-check/quality flags in JSON
- [ ] Add sample Drafter response structure in prompt guidance and parsing docs.
- [ ] Add/confirm separate validation path (Safety and/or validation parser) for generated chapter text.

## Drafting Workflow Functional Checklist
- [ ] Drafting tab chapter selector bound to accepted chapter outlines.
- [ ] Generate first-pass chapter draft action.
- [ ] Render generated chapter text in editable draft workspace.
- [ ] Save edited draft action.
- [ ] Revision instruction input for user feedback (for example: tighten intro, add dosage caution details).
- [ ] Regenerate/Revise draft action that uses prior draft + user revision instruction.
- [ ] Compare or revision history view (minimum: timestamps + revision notes).
- [ ] Draft validation action and validation result panel.
- [ ] Clear status/progress indicators for long-running LLM requests.

## UI and UX Checklist (Drafting Tab)
- [ ] Add required Drafting tab controls and data-testid hooks.
- [ ] Keep responsive layout and keyboard focus requirements intact.
- [ ] Add clear empty states when no chapter outlines are available.
- [ ] Add non-blocking error messaging for failed generation/parsing.
- [ ] Ensure IDs/selectors used by existing smoke/regression tests remain stable or update tests in same sprint.

## Testing and Test Asset Update Checklist
- [ ] Update smoke tests to verify Drafting tab controls/visibility.
- [ ] Add Drafting-specific functional tests:
  - [ ] first-pass generation
  - [ ] save edited draft
  - [ ] revise from user instruction
  - [ ] validation output rendering
  - [ ] persistence across reload
- [ ] Extend integration test flow to include:
  - [ ] Book Goals -> Outline -> Chapter Outlines -> Draft generation
  - [ ] Draft revision loop using user input
  - [ ] Validation results checks
- [ ] Add negative tests:
  - [ ] malformed JSON from Drafter
  - [ ] timeout/error handling
  - [ ] missing prerequisites (no accepted outline)
- [ ] Update HerbalBookForge/TESTING.md with new commands, timings, and troubleshooting notes.
- [ ] Capture and store sprint test evidence under docs/releases/evidence/.

## GitHub and Administrative Process Checklist
- [ ] Create sprint issue set (target: 10-14 issues) for Sprint 2.
- [ ] Every issue includes:
  - [ ] Requirement IDs
  - [ ] Acceptance criteria
  - [ ] Test expectation
  - [ ] Dependency/ordering notes
- [ ] Create feature branch from main:
  - [ ] branch naming proposal: feature/herbalbookforge-sprint-2-drafting
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

## Suggested Sprint 2 Issue Backlog (Planning Draft)
- [ ] Issue 1: Requirement analysis and DR3-DR8 derivation
- [ ] Issue 2: Drafting tab state model and persistence updates
- [ ] Issue 3: Drafter prompt/spec update and parser hardening
- [ ] Issue 4: First-pass chapter generation pipeline
- [ ] Issue 5: Editable draft workspace and save behavior
- [ ] Issue 6: Revision instruction input and revise pipeline
- [ ] Issue 7: Draft validation pipeline and UI
- [ ] Issue 8: Error handling and malformed JSON fallback
- [ ] Issue 9: Smoke/regression test updates
- [ ] Issue 10: Integration test expansion (real API flow)
- [ ] Issue 11: Documentation updates (requirements/testing/user flow)
- [ ] Issue 12: PR packaging, evidence, and sprint closeout

## Definition of Done (Sprint 2)
- [ ] All Sprint 2 issues are created, implemented, reviewed, and closed.
- [ ] Feature branch is merged to main and deleted.
- [ ] PR is merged with requirement traceability and passing tests documented.
- [ ] Requirements and inline requirement comments are synchronized.
- [ ] Drafting workflow supports generate, edit, validate, revise, and persist.
- [ ] Integration and smoke/regression tests pass with updated coverage.
- [ ] Release evidence and sprint closeout artifacts are complete.

## Execution Guardrail
This document is planning only. Do not start issue filing, branching, implementation, testing, or PR creation until explicit kickoff approval is given.
