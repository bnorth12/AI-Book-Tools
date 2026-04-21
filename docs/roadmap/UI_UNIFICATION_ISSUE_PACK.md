# UI Unification Issue Pack

Date: 2026-04-20
Owner: Brian North
Milestone: Unify Visual Layout
Milestone due date: 2026-04-20

## Umbrella Issue Draft

Title:

- UI/CSS Unification Capability Release - Unify Visual Layout

Description:

- The four separate AI Book Tools currently have unique visual appearance and navigation techniques.
- For this release, synchronize layout, styling, and shell navigation behavior to the HerbalBookForge style baseline while preserving each tool's workflow behavior.

Scope:

- NovelWriter
- BookEditor
- BookDecomposer
- Cross-tool visual consistency, evidence, and release-closeout traceability

Owner:

- Brian North

Acceptance Criteria:

- Shared UI shell conventions are applied to target tools.
- Smoke suite evidence exists with HTML artifacts.
- Requirement and traceability docs are up to date.
- Security analysis and SSDLC evidence are linked.
- Release closeout trackers reference actual issue/PR state.

## Child Issues to Create

### Child 1 - NovelWriter UI Synchronization

Suggested title:

- UIU Child - NovelWriter shell and navigation synchronization

Owner:

- Brian North

Checklist:

- [ ] Verify tab shell and panel styling match shared token conventions.
- [ ] Verify selector stability for smoke/regression tests.
- [ ] Verify import/export and LLM workflow parity.
- [ ] Link requirement IDs and evidence.

### Child 2 - BookEditor UI Synchronization

Suggested title:

- UIU Child - BookEditor shell and navigation synchronization

Owner:

- Brian North

Checklist:

- [ ] Verify six-tab shell visuals match shared token conventions.
- [ ] Verify improvements list and editor panel visual consistency.
- [ ] Verify import/export and edit workflow parity.
- [ ] Link requirement IDs and evidence.

### Child 3 - BookDecomposer UI Synchronization

Suggested title:

- UIU Child - BookDecomposer shell and navigation synchronization

Owner:

- Brian North

Checklist:

- [ ] Verify four-tab shell visuals match shared token conventions.
- [ ] Verify `.tab` and `.tabcontent` behavior compatibility.
- [ ] Verify output preview and export usability parity.
- [ ] Link requirement IDs and evidence.

### Child 4 - Cross-Tool Design and Visual Consistency

Suggested title:

- UIU Child - Shared design system and visual consistency

Owner:

- Brian North

Checklist:

- [ ] Confirm token usage patterns are documented.
- [ ] Confirm visual consistency checklist is complete and linked.
- [ ] Confirm responsive and accessibility parity evidence is linked.
- [ ] Confirm docs index references are current.

### Child 5 - Test Evidence and Release Artifacts

Suggested title:

- UIU Child - Smoke evidence, HTML reports, and release artifact packaging

Owner:

- Brian North

Checklist:

- [ ] Confirm smoke, smoke-ui-shell, and smoke-full evidence links are present.
- [ ] Confirm HTML report paths are preserved in evidence bundle.
- [ ] Confirm release artifact folder policy alignment.
- [ ] Confirm final rerun gate is reserved for release-candidate commit.

### Child 6 - Security and SSDLC Closeout

Suggested title:

- UIU Child - Security analysis and SSDLC release closeout

Owner:

- Brian North

Checklist:

- [ ] Confirm threat model and trust boundary analysis are linked.
- [ ] Confirm residual-risk mitigation ownership mapping exists.
- [ ] Confirm SSDLC checklist snapshot reflects current evidence.
- [ ] Confirm rollback and release candidate tagging steps are tracked.

## Discovered and Corrected Items (Ready to Reference in Child Issues)

Use this section to quickly close child-issue subtasks that are already completed in this branch.

- [x] Smoke HTML evidence synchronization completed in roadmap/governance/evidence docs.
- [x] Requirement index document created and linked.
- [x] Per-tool migration notes created and linked.
- [x] Visual consistency checklist created and linked.
- [x] Release evidence bundle created and linked.
- [x] Tool README UI-convention sections added.
- [x] Shared design system section added to repo docs.
- [x] Security analysis centralized under system-security-analysis.

## Execution Notes

- This issue pack prepares content and structure.
- GitHub milestone/issue creation is an execution step outside this markdown artifact and should be completed in the repository issue tracker.

## Approved Screenshot Policy

- Scope per tool:
  - Shell/navigation `before` and `after`
  - One key workflow panel `after`
  - One short interaction note
- Filename format:
  - `<tool>-<surface>-<state>-<yyyy-mm-dd>.png`
- Storage path:
  - `docs/releases/evidence/screenshots/`
