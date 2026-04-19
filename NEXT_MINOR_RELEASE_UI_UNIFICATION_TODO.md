# Next Minor Capability Release Todo

## Release Theme

Unify visual style, CSS system, and UI interaction patterns across all tools by adopting the HerbalBookForge design system as the baseline.

Scope focus for this release:

- NovelWriter
- BookEditor
- BookDecomposer

Out of scope:

- New major product capabilities unrelated to UI/style unification
- Schema/versioning overhauls not required by UI migration

## Objectives and Success Criteria

- [ ] All three target tools use a shared design language aligned with HerbalBookForge.
- [ ] Shared style foundations (tokens/components/layout patterns) are documented and reusable.
- [ ] Existing core workflows remain functional with no critical regressions.
- [ ] Requirements are incorporated inline in each tool and validated by tests/review.
- [ ] Accessibility and responsive behavior are at least equal to current behavior.

## Administrative and Planning Setup

- [ ] Create a dedicated milestone for this minor release.
- [ ] Create an umbrella tracking issue for "UI/CSS Unification Capability Release".
- [ ] Create child issues per tool and per cross-cutting concern.
- [ ] Define branch strategy (`feature/ui-unification-*`) and merge order.
- [ ] Define Definition of Done (DoD) for each tool and for release-level signoff.
- [ ] Define requirements traceability method (issue ID -> file/section -> test evidence).
- [ ] Confirm release version target and naming convention before implementation starts.

## Requirements Governance (Inline + Tested)

- [ ] Add/update inline requirements sections in each affected tool where behavior is changed.
- [ ] Ensure requirement IDs are unique and traceable.
- [ ] Update or create requirement-to-test mapping notes.
- [ ] Add/adjust automated checks for requirement governance if needed.
- [ ] Validate that each requirement change has explicit test evidence before merge.

## Design System Extraction and Decisions

- [ ] Inventory HerbalBookForge CSS tokens, spacing scale, typography, components, and motion.
- [ ] Decide canonical token names and where shared CSS will live.
- [ ] Document what is copied vs adapted vs deprecated.
- [ ] Define responsive breakpoints and mobile behavior standards for all tools.
- [ ] Define accessibility baseline (focus states, contrast, keyboard navigation, reduced motion).

## Tool Migration Workstreams

### NovelWriter

- [ ] Map current structure to target component/layout model.
- [ ] Refactor tab/nav/layout scaffolding to new style system.
- [ ] Update forms, chapter subpages, and status panels to shared components.
- [ ] Preserve/verify all tab behaviors after UI refactor.

### BookEditor

- [ ] Migrate shell layout and controls to shared style system.
- [ ] Align improvements tables, editors, and nav patterns to new components.
- [ ] Preserve import/export and edit workflows during UI changes.

### BookDecomposer

- [ ] Migrate shell/layout/forms/preview panes to shared style system.
- [ ] Align model selection and output preview UI to common component patterns.
- [ ] Preserve processing workflow and output usability.

## Cross-Tool QA and Testing

- [ ] Add/update smoke checks for each tool's critical user flow after migration.
- [ ] Run existing regression suites and fix UI-selector brittleness introduced by refactors.
- [ ] Add focused visual consistency checklist (spacing, typography, controls, states).
- [ ] Validate desktop + mobile layouts for all tools.
- [ ] Run accessibility checks (keyboard-only pass, visible focus, contrast).
- [ ] Verify no functional regressions in import/export and LLM workflows.

## Documentation and Communication

- [ ] Update tool README files with new UI conventions where relevant.
- [ ] Add a short "shared design system" section to repo docs.
- [ ] Capture before/after screenshots for release notes and PR context.
- [ ] Keep changelog entries in Unreleased during implementation.

## PR and Issue Execution Flow

- [ ] Open PRs linked to each child issue (or one PR per tool if preferred).
- [ ] Ensure each PR includes: scope, requirement IDs, test evidence, screenshots.
- [ ] Close addressed issues only after merge + verification evidence.
- [ ] Close superseded PRs and keep one canonical PR thread per issue.

## Release Closeout (After Clean Pass)

- [ ] Execute full clean test pass across required suites.
- [ ] Move version by one minor release and update version references.
- [ ] Finalize changelog from Unreleased to versioned release section.
- [ ] Merge approved feature branches to trunk in dependency-safe order.
- [ ] Run post-merge verification on trunk.
- [ ] Push all finalized release files to GitHub.
- [ ] Create release tag and publish release notes.
- [ ] Close milestone and clean up merged branches.

## Risks and Mitigations

- [ ] Risk: Large CSS refactor causes selector/test breakage.
  - Mitigation: Stabilize test selectors as part of each tool migration PR.
- [ ] Risk: Functional regressions hidden by visual changes.
  - Mitigation: Require flow-level smoke verification before each merge.
- [ ] Risk: Scope creep beyond style unification.
  - Mitigation: Keep non-UI capability changes out of this milestone.

## Suggested Execution Order

1. HerbalBookForge style/token inventory and shared CSS extraction.
2. NovelWriter migration (largest/most complex dependency surface).
3. BookEditor migration.
4. BookDecomposer migration.
5. Cross-tool polish, accessibility, responsive QA.
6. Release closeout and GitHub push/tag.
