$repo = "bnorth12/AI-Book-Tools"


$issues = @(
  @{
    Title = "Sprint 2: Drafting requirements analysis and new requirement derivation"
    Body = @'
Summary
Define and ratify Sprint 2 requirements for Drafting tab chapter writing, revision, validation, and persistence.

Requirement IDs
- Existing: HBF.DR1, HBF.DR2, HBF.UNI1, HBF.UNI4, HBF.UNI4.1
- Proposed: HBF.DR3, HBF.DR4, HBF.DR5, HBF.DR6, HBF.DR7, HBF.DR8
- Proposed integration: HBFIT.9, HBFIT.10, HBFIT.11, HBFIT.12, HBFIT.13

Scope
- Review and finalize Sprint 2 requirement set.
- Sync requirements across REQUIREMENTS.md and inline HTML comments.
- Publish traceability mapping for all Sprint 2 issues.

Acceptance Criteria
- DR3-DR8 finalized in HerbalBookForge/REQUIREMENTS.md.
- HBFIT.9-HBFIT.13 finalized in HerbalBookForge/REQUIREMENTS.md.
- Inline requirement comments synchronized in HerbalBookForge/HerbalBookForge.html.
- Traceability mapping published for Sprint 2 issue set.

Dependencies
- None
'@
  },
  @{
    Title = "Sprint 2: Drafting state model and persistence for chapter drafts"
    Body = @'
Summary
Implement Drafting data model in project state and persistence lifecycle.

Requirement IDs
- HBF.DR3, HBF.DR7, HBF.UNI2, HBF.UNI3

Scope
- Define chapter draft object fields: chapterId, chapterTitle, outlineContext, draftText, validation, revisionHistory, lastUpdated.
- Add save/load behavior in localStorage pipeline.
- Ensure export/import round-trip for Drafting data.

Acceptance Criteria
- Chapter draft model implemented and used consistently.
- Draft content persists across reload.
- Export/import preserves draft data.
- Existing tabs remain unaffected.

Dependencies
- Depends on Sprint 2 requirements finalization issue.
'@
  },
  @{
    Title = "Sprint 2: Drafter prompt contract and JSON parser hardening"
    Body = @'
Summary
Update Drafter prompt and parsing path to strict JSON contract aligned to unified agent architecture.

Requirement IDs
- HBF.DR4, HBF.UNI1, HBF.UNI4, HBF.UNI4.1

Scope
- Update default Drafter system prompt.
- Update Prompts Editor Drafter behavior.
- Define strict JSON response schema for first-pass and revision.
- Add robust parser validation and fallback handling.

Acceptance Criteria
- Drafter prompt explicitly requires strict JSON.
- Parser validates required keys and types.
- Malformed JSON handled gracefully with actionable UI messaging.
- callLlmAgent routing remains compliant.

Dependencies
- Depends on Sprint 2 requirements finalization issue.
'@
  },
  @{
    Title = "Sprint 2: First-pass chapter generation pipeline in Drafting tab"
    Body = @'
Summary
Build first-pass chapter generation from selected chapter outline and book goals context.

Requirement IDs
- HBF.DR1, HBF.DR2, HBF.DR3, HBF.DR4

Scope
- Bind chapter selector to accepted chapter outlines.
- Generate chapter draft through Drafter agent.
- Render draft text in editable workspace.
- Add status/progress feedback for generation.

Acceptance Criteria
- User can select chapter and generate full draft text.
- Request uses chapter outline and goals context.
- Generated text is committed to central state and rendered from state.
- Status feedback visible during long calls.

Dependencies
- Depends on state model and prompt contract issues.
'@
  },
  @{
    Title = "Sprint 2: Editable draft workspace and explicit save behavior"
    Body = @'
Summary
Allow users to edit generated draft text and explicitly save updates.

Requirement IDs
- HBF.DR3, HBF.DR7

Scope
- Add editable draft workspace for selected chapter.
- Implement explicit save action with feedback.
- Update metadata such as lastUpdated.

Acceptance Criteria
- User can edit draft text in-place.
- Save persists edits to state and storage.
- Reload restores saved edits.
- Save UX is clear and non-blocking.

Dependencies
- Depends on first-pass generation and state model issues.
'@
  },
  @{
    Title = "Sprint 2: Revision instruction input and iterative revise flow"
    Body = @'
Summary
Implement user-directed iterative revision of existing chapter drafts.

Requirement IDs
- HBF.DR5, HBF.DR7

Scope
- Add revision instruction input in Drafting tab.
- Implement revise action using prior draft + user instruction.
- Store revision output and revisionHistory entries with timestamps.

Acceptance Criteria
- User can submit revision instructions for selected chapter.
- Revised draft updates predictably.
- revisionHistory captures instruction and timestamp per iteration.
- UI clearly indicates revision progress and completion.

Dependencies
- Depends on prompt contract, state model, and editable workspace issues.
'@
  },
  @{
    Title = "Sprint 2: Draft validation pipeline and validation results UI"
    Body = @'
Summary
Add validation workflow for generated chapter drafts and display actionable feedback.

Requirement IDs
- HBF.DR6, HBF.UNI1, HBF.UNI4

Scope
- Define validation schema and parser.
- Implement validation action for selected draft.
- Render structured validation output.
- Persist validation results in state.

Acceptance Criteria
- User can validate selected draft.
- Validation includes structure, quality, and safety feedback.
- Validation output persists and re-renders from state.
- Validation failures handled gracefully.

Dependencies
- Depends on prompt contract and state model issues.
'@
  },
  @{
    Title = "Sprint 2: Error handling and fallback behavior for drafting workflows"
    Body = @'
Summary
Harden Drafting workflows for malformed JSON, timeouts, missing prerequisites, and API failures.

Requirement IDs
- HBF.DR4, HBF.DR6, HBF.DR8, HBF.UNI4.1

Scope
- Add prerequisite guards (accepted outline, goals context).
- Add timeout and API failure handling for generate/revise/validate.
- Add malformed JSON fallback and safe-state behavior.
- Prevent hard UI crashes.

Acceptance Criteria
- Missing prerequisites show clear guidance.
- Timeout/API failures are recoverable with user messaging.
- Malformed JSON does not corrupt project state.
- UI remains responsive after failures.

Dependencies
- Depends on generation, revision, and validation issues.
'@
  },
  @{
    Title = "Sprint 2: Smoke and regression test updates for Drafting tab"
    Body = @'
Summary
Update smoke and regression suites for Drafting tab controls and selector stability.

Requirement IDs
- HBF.DR8, UIU.HBF.NF4

Scope
- Update smoke test coverage for Drafting controls and tab navigation.
- Update regression tests for any intentional selector changes.
- Add or preserve stable IDs and data-testid hooks.

Acceptance Criteria
- Smoke tests verify Drafting tab controls visibility and basic flow.
- Regression tests remain green with selector updates.
- Selector changes are intentional and documented.

Dependencies
- Depends on Drafting UI implementation issues.
'@
  },
  @{
    Title = "Sprint 2: Integration test expansion for drafting revision and validation"
    Body = @'
Summary
Extend integration tests to include drafting generation, revision loop, and validation checks.

Requirement IDs
- HBFIT.9, HBFIT.10, HBFIT.11, HBFIT.12, HBFIT.13

Scope
- Extend full workflow: Goals -> Outline -> Chapter Outlines -> Draft generation -> Revision -> Validation.
- Verify persistence in drafting context.
- Keep graceful skip behavior when API key is missing.

Acceptance Criteria
- Integration suite covers first-pass drafting.
- Integration suite covers revision loop.
- Integration suite covers validation output checks.
- Integration suite verifies persistence and resilience.

Dependencies
- Depends on generation, revision, and validation implementation issues.
'@
  },
  @{
    Title = "Sprint 2: Documentation updates for requirements testing and user workflow"
    Body = @'
Summary
Update requirements, testing, and user workflow documentation for Sprint 2 Drafting functionality.

Requirement IDs
- HBF.DR1-HBF.DR8
- HBFIT.9-HBFIT.13

Scope
- Update HerbalBookForge/REQUIREMENTS.md.
- Update HerbalBookForge/TESTING.md.
- Update HerbalBookForge/README.md with Drafting flow.
- Sync inline requirement comments in HerbalBookForge/HerbalBookForge.html.

Acceptance Criteria
- Requirement docs match implemented behavior and IDs.
- Testing docs include commands, timing expectations, and troubleshooting.
- User docs cover generate, edit, revise, validate flow.
- Traceability references complete for PR closeout.

Dependencies
- Depends on all core implementation and test issues.
'@
  },
  @{
    Title = "Sprint 2: PR packaging review merge issue closure and release evidence"
    Body = @'
Summary
Complete Sprint 2 administrative closeout for branch, PR, review, merge, issue closure, and evidence.

Branch
- feature/herbalbookforge-sprint-2-drafting

Scope
- Open PR with full requirement traceability table.
- Include Closes references for Sprint 2 issues.
- Capture and publish test evidence.
- Merge PR, close linked issues, delete feature branch, and update sprint checklist.

Acceptance Criteria
- PR includes requirement traceability and test summary.
- PR reviewed and approved before merge.
- All Sprint 2 issues closed.
- Evidence artifacts stored and referenced.
- Feature branch deleted after merge.

Dependencies
- Depends on completion of Sprint 2 implementation, tests, and docs.
'@
  }
)

$created = @()

foreach ($issue in $issues) {
  $args = @(
    "issue","create",
    "--repo",$repo,
    "--title",$issue.Title,
    "--body",$issue.Body
  )

  $url = gh @args
  $created += [PSCustomObject]@{
    Title = $issue.Title
    Url = $url
  }
  Write-Host "Created: $($issue.Title)"
  Write-Host "  -> $url"
}

Write-Host ""
Write-Host "All Sprint 2 issues created:"
$created | Format-Table -AutoSize
