# UI Unification Release Closeout Execution Todo

Date: 2026-04-19
Scope: feature/ui-unification-foundation
Primary source: docs/roadmap/NEXT_MINOR_RELEASE_UI_UNIFICATION_TODO.md

## Execution Rules

- Work top-down through this list.
- For each item: `Done`, `In Progress`, `Blocked - Input Required`, or `Deferred`.
- Keep evidence links in each completed item.

## Ordered Closeout Queue

1. Create release milestone and map umbrella/child issue structure.
   - Status: In Progress
   - Decision inputs resolved:
     - Milestone name: `Unify Visual Layout`
     - Milestone due date: `2026-04-20`
     - Umbrella issue owner: `Brian North`
     - Umbrella issue summary: synchronize visual appearance and navigation techniques across AI Book Tools to the HerbalBookForge style baseline.
   - Evidence:
       - `docs/roadmap/UI_UNIFICATION_ISSUE_PACK.md`
       - Umbrella issue: <https://github.com/bnorth12/AI-Book-Tools/issues/8>
       - Child issue: <https://github.com/bnorth12/AI-Book-Tools/issues/9>
       - Child issue: <https://github.com/bnorth12/AI-Book-Tools/issues/10>
       - Child issue: <https://github.com/bnorth12/AI-Book-Tools/issues/11>
       - Child issue: <https://github.com/bnorth12/AI-Book-Tools/issues/12>
       - Child issue: <https://github.com/bnorth12/AI-Book-Tools/issues/13>
       - Child issue: <https://github.com/bnorth12/AI-Book-Tools/issues/14>
   - Blockers:
       - Milestone creation in GitHub is blocked by token permissions (`HTTP 403`, `Resource not accessible by personal access token`).
       - Issue assignment/edit operations are blocked by token permissions (`replaceActorsForAssignable`, `updateIssue`).
   - Remaining execution step: create milestone, assign issues to Brian, and close duplicate umbrella issues (#6, #7) once token permissions are elevated.
2. Define branch strategy and merge order for remaining work.
   - Status: Done
   - Evidence: docs/roadmap/NEXT_MINOR_RELEASE_UI_UNIFICATION_TODO.md (Administrative definitions section).
3. Define release Definition of Done (DoD).
   - Status: Done
   - Evidence: docs/roadmap/NEXT_MINOR_RELEASE_UI_UNIFICATION_TODO.md (Administrative definitions section).
4. Define requirements traceability method and evidence linkage template.
   - Status: Done
   - Evidence: docs/roadmap/NEXT_MINOR_RELEASE_UI_UNIFICATION_TODO.md (Administrative definitions + Requirements Governance evidence references).
5. Confirm release version target and naming convention.
   - Status: Done
   - Evidence: docs/roadmap/NEXT_MINOR_RELEASE_UI_UNIFICATION_TODO.md (Administrative definitions section).
6. Ensure inline requirements and requirement-to-test mapping are complete and linked.
   - Status: Done
   - Evidence: docs/roadmap/NEXT_MINOR_RELEASE_UI_UNIFICATION_TODO.md and docs/architecture/ui-unification/UI_UNIFICATION_REQUIREMENTS_TRACEABILITY_BASELINE.md.
7. Confirm SSDLC security analysis requirements are complete (trust boundaries, scored STRIDE, residual mitigation scope).
   - Status: Done
   - Evidence: docs/system-security-analysis/UI_UNIFICATION_THREAT_MODEL.md.
8. Add owner/target-release mapping for non-trivial mitigation items.
   - Status: Done
   - Evidence: docs/system-security-analysis/UI_UNIFICATION_THREAT_MODEL.md (Suggested Mitigation Implementation Scope).
9. Validate cross-tool accessibility/responsive checks and mark completion with evidence links.
   - Status: Done
   - Evidence: docs/architecture/ui-unification/UI_UNIFICATION_ACCESSIBILITY_RESPONSIVE_CHECKLIST.md.
10. Capture before/after screenshots and interaction notes for release evidence.
      - Status: In Progress
      - Decision resolved: screenshot scope and naming standard approved.
      - Scope standard:
         - Per tool, capture shell `before` and `after` screenshots for the primary nav/tab container.
         - Per tool, capture one key workflow panel `after` screenshot.
         - Record one short interaction note per tool describing what changed and what remained compatible.
      - Naming standard: `<tool>-<surface>-<state>-<yyyy-mm-dd>.png`
         - Example: `novelwriter-shell-after-2026-04-20.png`
      - Storage standard: `docs/releases/evidence/screenshots/`
      - Remaining execution step: capture files and link them in the release evidence bundle.
11. Execute final required release suites and archive evidence.
      - Status: In Progress

      - Evidence (current branch dry-run):
         - `npx playwright test --project=smoke --reporter=line,html` (pass)
         - `npx playwright test --project=smoke-ui-shell --reporter=line,html` (pass)
         - `npx playwright test --project=smoke-full --reporter=line,html` (pass)
         - `playwright-report-smoke/index.html`
         - `playwright-report-ui-shell/index.html`
         - `playwright-report-smoke-full/index.html`
         - `docs/releases/evidence/playwright-report-smoke-full-2026-04-19.html`

      - Remaining gate: rerun required suites on the release-candidate commit before tag.
12. Final release closeout actions (version bump, changelog finalize, tag, release notes, branch cleanup).
    - Status: Deferred
    - Why deferred: End-of-cycle activities after all implementation/testing gates pass.
