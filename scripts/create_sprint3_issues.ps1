$repo = "bnorth12/AI-Book-Tools"

$issues = @(
  @{
    Title = "Sprint 3: Safety requirements analysis and derivation (HBF.SA1-SA6, HBFIT.14-17)"
    Body = @'
Summary
Define and ratify Sprint 3 requirements for the Safety tab — manuscript-level safety scanning, structured report generation, flag navigation, and persistence.

Requirement IDs
- Existing stubs: HBF.SA1, HBF.SA2, HBF.SA3, HBF.SA4
- Proposed new: HBF.SA5, HBF.SA6
- Proposed integration: HBFIT.14, HBFIT.15, HBFIT.16, HBFIT.17

Scope
- Review and finalize Sprint 3 requirement set.
- Sync requirements across REQUIREMENTS.md and inline HTML comments (replacing existing stubs).
- Publish traceability mapping for all Sprint 3 issues.

Acceptance Criteria
- HBF.SA1-SA6 finalized in HerbalBookForge/REQUIREMENTS.md.
- HBFIT.14-17 finalized in HerbalBookForge/REQUIREMENTS.md.
- Inline requirement stub comments synchronized in HerbalBookForge/HerbalBookForge.html.
- Traceability mapping published for Sprint 3 issue set.

Dependencies
- None
'@
  },
  @{
    Title = "Sprint 3: Safety state model — safetyReport schema and persistence"
    Body = @'
Summary
Implement the safetyReport data model in project state and persistence lifecycle.

Requirement IDs
- HBF.SA5, HBF.UNI2, HBF.UNI3

Scope
- Define safetyReport object fields: scanScope, scanTimestamp, flags[], summary, lastUpdated.
- Define flag object fields: chapterId, chapterTitle, flagType, flaggedText, suggestion.
- Add save/load behavior in localStorage pipeline (bump version to v0.11.0).
- Ensure export/import round-trip preserves safetyReport.
- Confirm coexistence with per-chapter drafts[].validation from Sprint 2.

Acceptance Criteria
- safetyReport model implemented and used consistently.
- Safety report persists across reload.
- Export/import preserves safetyReport data.
- Existing tabs and drafts[] state remain unaffected.
- localStorage key updated to v0.11.0 with backward-compat load from v0.10.0.

Dependencies
- Depends on Sprint 3 requirements finalization issue.
'@
  },
  @{
    Title = "Sprint 3: Safety agent prompt update — manuscript-level scan contract and JSON parser"
    Body = @'
Summary
Update Safety agent system prompt and parsing path to support manuscript-level scan with strict JSON contract.

Requirement IDs
- HBF.SA2, HBF.SA3, HBF.UNI1, HBF.UNI4, HBF.UNI4.1

Scope
- Update default Safety agent system prompt in callLlmAgent for manuscript-level context.
- Distinguish manuscript-level scan (Safety tab) from per-chapter validation (Drafting tab).
- Define strict JSON response schema: { "flags": [ { "chapterId", "chapterTitle", "flagType", "flaggedText", "suggestion" } ], "summary" }.
- Flag type taxonomy: CONTRAINDICATION, DOSAGE, PA_CONTENT, EXTRACTION_RISK, GENERAL_SAFETY.
- Add parseSafetyReport() function with robust validation and fallback handling.
- callLlmAgent routing remains compliant with HBF.UNI1 and HBF.UNI4.

Acceptance Criteria
- Safety agent prompt explicitly requires strict JSON at manuscript scope.
- parseSafetyReport() validates required keys and array shape.
- Malformed JSON handled gracefully with user-visible error messaging.
- Manuscript-level and per-chapter validation paths remain independent.

Dependencies
- Depends on requirements finalization and state model issues.
'@
  },
  @{
    Title = "Sprint 3: Safety tab HTML — scope selector, scan button, report panel structure"
    Body = @'
Summary
Implement Safety tab HTML structure with scope selector, scan action, and report display panel.

Requirement IDs
- HBF.SA1, HBF.SA2, HBF.SA6

Scope
- Add scope selector: full manuscript or per-chapter dropdown (data-testid="safety-scope-select").
- Add Run Safety Scan button (data-testid="safety-scan-btn").
- Add status/progress indicator (data-testid="safety-status").
- Add report panel container (data-testid="safety-report") with summary area and flags list.
- Empty state when no drafts exist (data-testid="safety-empty-state").
- All controls use stable id and data-testid attributes per HBF.SA6.

Acceptance Criteria
- All Safety tab controls present with correct data-testid values.
- Scope selector populates from available chapter drafts.
- Report panel hidden until scan completes.
- Empty state shown when no drafts available.
- Responsive layout preserved (UIU.HBF.NF1).

Dependencies
- Depends on requirements and state model issues.
'@
  },
  @{
    Title = "Sprint 3: renderSafetyTab() and runSafetyCheck() implementation"
    Body = @'
Summary
Implement core Safety tab rendering and scan pipeline functions.

Requirement IDs
- HBF.SA1, HBF.SA2, HBF.SA3, HBF.SA5

Scope
- renderSafetyTab(): populate scope selector, show empty state if no drafts, render stored safetyReport if present.
- runSafetyCheck(): async, reads scope selection, builds manuscript context (all draft texts or selected chapter), calls callLlmAgent({ agent: "safety", parseResponse: parseSafetyReport }), writes result to project.safetyReport, re-renders tab.
- Integrate renderSafetyTab() into switchTab() and loadProject() hooks.
- Status feedback during long-running scan call.

Acceptance Criteria
- User can select scope and run scan.
- Scan uses all available draft text as context.
- Result written to project state and rendered from state (HBF.UNI2, HBF.UNI3).
- Status indicator visible and clears on completion.
- Stored report re-renders on tab revisit and page reload.

Dependencies
- Depends on HTML structure, state model, and agent prompt issues.
'@
  },
  @{
    Title = "Sprint 3: Per-flag rendering and navigate-to-draft integration with Drafting tab"
    Body = @'
Summary
Render individual safety flags with type badges and suggested fixes, and provide navigation from each flag to the relevant chapter in the Drafting tab.

Requirement IDs
- HBF.SA3, HBF.SA4

Scope
- Render each flag with: chapter reference, flag type badge (CONTRAINDICATION, DOSAGE, PA_CONTENT, EXTRACTION_RISK, GENERAL_SAFETY), flagged text excerpt, and suggested fix text.
- Add navigate-to-draft action per flag: switches active tab to Drafting, selects the correct chapter.
- Flag type badges use visually distinct treatment (color coding).
- Empty flag list state shown when scan returns no issues.

Acceptance Criteria
- Each flag renders all required fields.
- Flag type badges are visually distinguishable.
- Navigate-to-draft switches to Drafting tab with correct chapter selected.
- Zero-flag result shows clean "No issues found" state.

Dependencies
- Depends on renderSafetyTab(), runSafetyCheck(), and HTML structure issues.
'@
  },
  @{
    Title = "Sprint 3: Error handling — empty manuscript guard, HTTP errors, malformed JSON fallback"
    Body = @'
Summary
Harden Safety tab workflows for missing prerequisites, API failures, and malformed responses.

Requirement IDs
- HBF.SA5, HBF.SA6, HBF.UNI4.1

Scope
- Empty manuscript guard: show actionable message if no chapter drafts exist when scan is attempted.
- HTTP error map: 401 Invalid API key, 429 Rate limit, 500 Server error, 503 Service unavailable (reuse pattern from Sprint 2).
- Malformed JSON from Safety agent: fall back gracefully, do not corrupt project.safetyReport.
- All failures leave UI in recoverable state with user-visible messaging.

Acceptance Criteria
- Empty manuscript guard fires before API call.
- HTTP errors show descriptive message in safety-status element.
- Malformed JSON does not overwrite valid stored report.
- UI remains responsive after all failure scenarios.

Dependencies
- Depends on runSafetyCheck() implementation issue.
'@
  },
  @{
    Title = "Sprint 3: Smoke test updates for Safety tab controls (HBF.SA6)"
    Body = @'
Summary
Expand smoke test suite to verify Safety tab controls are present and visible.

Requirement IDs
- HBF.SA6, UIU.HBF.NF4

Scope
- Add smoke test: "Safety tab renders all required controls (HBF.SA6)".
- Navigate to Safety tab, assert toBeVisible() on safety-scope-select and safety-scan-btn.
- Assert toBeAttached() on safety-status, safety-report, safety-empty-state.
- Preserve all existing smoke test cases (tests 1 and 2 from Sprint 2).

Acceptance Criteria
- All existing smoke tests continue to pass.
- New Safety tab smoke test passes without API key.
- All data-testid selectors match implemented HTML.

Dependencies
- Depends on Safety tab HTML structure issue.
'@
  },
  @{
    Title = "Sprint 3: Integration tests HBFIT.14-17 for Safety tab"
    Body = @'
Summary
Add integration tests covering Safety tab scan, report rendering, persistence, and flag navigation.

Requirement IDs
- HBFIT.14, HBFIT.15, HBFIT.16, HBFIT.17

Scope
- HBFIT.14: Inject project state with draft content, run safety scan, validate localStorage safetyReport JSON shape (flags[], summary).
- HBFIT.15: After scan, assert safety-report panel is visible and contains at least one flag item.
- HBFIT.16: Inject project state with stored safetyReport, reload page, assert report still rendered.
- HBFIT.17: Click navigate-to-draft on a flag, assert Drafting tab is active and correct chapter is selected.
- All tests skip gracefully when GROK_API_KEY not configured.

Acceptance Criteria
- HBFIT.14-17 pass with valid API key.
- Tests skip cleanly without API key.
- makeProjectState helper extended to support withSafetyReport option.
- Tests are in herbalbookforge.integration.spec.js describe block for Sprint 3.

Dependencies
- Depends on all core Safety tab implementation issues.
'@
  },
  @{
    Title = "Sprint 3: TESTING.md update for v0.11.0 Safety tab"
    Body = @'
Summary
Update HerbalBookForge/TESTING.md to document Safety tab smoke and integration tests.

Requirement IDs
- HBF.SA6, HBFIT.14-17

Scope
- Add Safety tab smoke test to section 2 with full data-testid table.
- Add new section 4: "Safety Tab Integration Tests (HBFIT.14-17)" — document each test with scope, wait times, and skip behavior.
- Update performance metrics table with Safety scan agent row (estimated 30-60s for real API calls).
- Update future plans section: mark Preview tab items as v0.12.0+.

Acceptance Criteria
- All new Safety tab test IDs documented with data-testid references.
- HBFIT.14-17 section accurate and consistent with implementation.
- Existing Sprint 2 content (sections 1-3) preserved unchanged.
- No stale or incorrect timing estimates.

Dependencies
- Depends on all Safety tab implementation and test issues.
'@
  },
  @{
    Title = "Sprint 3: REQUIREMENTS.md update and inline HTML comment sync for v0.11.0"
    Body = @'
Summary
Update REQUIREMENTS.md and HerbalBookForge.html inline comments for Sprint 3 Safety tab requirements.

Requirement IDs
- HBF.SA1-SA6, HBFIT.14-17

Scope
- Add Safety Tab Requirements section to HerbalBookForge/REQUIREMENTS.md (HBF.SA1-SA6).
- Add Integration Testing Requirements for Sprint 3 (HBFIT.14-17).
- Replace existing HBF.SA1-SA4 stub comments in HerbalBookForge.html with finalized requirement text.
- Update version status to v0.11.0 and sync date.
- Update Sync Status block.

Acceptance Criteria
- All HBF.SA1-SA6 documented and consistent between REQUIREMENTS.md and inline HTML.
- HBFIT.14-17 documented in REQUIREMENTS.md.
- Version reference updated to v0.11.0.
- No orphaned or duplicate requirement entries.

Dependencies
- Depends on all Safety tab implementation issues.
'@
  },
  @{
    Title = "Sprint 3: PR packaging, evidence files, and sprint closeout"
    Body = @'
Summary
Complete Sprint 3 administrative closeout — branch, PR, review, merge, issue closure, and evidence artifacts.

Branch
- feature/herbalbookforge-sprint-3-safety

Scope
- Open PR with full requirement traceability table (HBF.SA1-SA6, HBFIT.14-17).
- Include Closes references for all Sprint 3 issues.
- Create docs/releases/evidence/HBF-SPRINT-3-TEST-RESULTS.md with smoke pass evidence and integration test inventory.
- Create docs/releases/evidence/HBF-SPRINT-3-PR-DESCRIPTION.md with full PR narrative.
- Merge PR, close linked issues, delete feature branch, update sprint checklist.

Acceptance Criteria
- PR includes requirement traceability and test summary.
- All Sprint 3 issues closed.
- Evidence artifacts stored under docs/releases/evidence/.
- Feature branch deleted after merge.
- SPRINT_SAFETY_SPRINT_3_TODOLIST.md updated to reflect completion.

Dependencies
- Depends on completion of all Sprint 3 implementation, test, and docs issues.
'@
  }
)

$created = @()

foreach ($issue in $issues) {
  $ghArgs = @(
    "issue","create",
    "--repo",$repo,
    "--title",$issue.Title,
    "--body",$issue.Body
  )

  $url = gh @ghArgs
  $created += [PSCustomObject]@{
    Title = $issue.Title
    Url = $url
  }
  Write-Host "Created: $($issue.Title)"
  Write-Host "  -> $url"
}

Write-Host ""
Write-Host "All Sprint 3 issues created:"
$created | Format-Table -AutoSize
