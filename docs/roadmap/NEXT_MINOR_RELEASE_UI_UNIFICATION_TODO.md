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

## Phase 0: Baseline Discovery and Gap Analysis (Do First)

- [ ] Create a baseline gap-analysis issue and link all discovery tasks to it.
- [x] Inventory current CSS/layout/component patterns in NovelWriter, BookEditor, and BookDecomposer.
- [x] Inventory current smoke/regression selectors and identify brittle selectors likely to break during UI refactor.
- [x] Define requirement ID scheme for this release (example: `UIU.NW.*`, `UIU.BE.*`, `UIU.BD.*`, `UIU.X.*`).
- [x] Draft initial requirement set for UI parity, responsiveness, accessibility, and workflow preservation.
- [x] Produce requirement-to-test mapping baseline before first implementation PR.
- [ ] Capture before screenshots and interaction notes for key flows in all three tools.
- [x] Publish a short gap-analysis summary in repo docs and link it from the umbrella issue.

## Administrative and Planning Setup

- [ ] Create a dedicated milestone for this minor release.
- [x] Create an umbrella tracking issue for "UI/CSS Unification Capability Release".
- [x] Create child issues per tool and per cross-cutting concern.
- [x] Define branch strategy (`feature/ui-unification-*`) and merge order.
- [x] Define Definition of Done (DoD) for each tool and for release-level signoff.
- [x] Define requirements traceability method (issue ID -> file/section -> test evidence).
- [x] Confirm release version target and naming convention before implementation starts.

Administrative definitions (added 2026-04-19):

- Branch strategy: all remaining work lands on `feature/ui-unification-foundation`; merge order is NovelWriter -> BookEditor -> BookDecomposer -> cross-tool docs/evidence -> closeout artifacts.
- DoD (per tool): shell migration merged, smoke coverage passing, selector stability verified, requirements IDs present, and evidence recorded in docs.
- DoD (release): required suites pass on release-candidate commit, SSDLC checklist evidence complete, release snapshot package complete, tag/release provenance complete.
- Traceability method: issue -> requirement IDs -> changed files -> test command/evidence -> release artifact links.
- Version target convention: one minor version increment at release closeout with changelog/repo metadata synchronized.

Administrative decisions update (2026-04-20):

- Milestone name: `Unify Visual Layout`.
- Milestone due date: `2026-04-20`.
- Umbrella issue owner: `Brian North`.
- Umbrella issue statement: the four AI Book Tools currently have unique visual appearance and navigation techniques and need synchronization to the HerbalBookForge style baseline.
- Child issue pack prepared: `docs/roadmap/UI_UNIFICATION_ISSUE_PACK.md`.

GitHub execution status (2026-04-20):

- Umbrella issue: <https://github.com/bnorth12/AI-Book-Tools/issues/8>.
- Child issue: <https://github.com/bnorth12/AI-Book-Tools/issues/9>.
- Child issue: <https://github.com/bnorth12/AI-Book-Tools/issues/10>.
- Child issue: <https://github.com/bnorth12/AI-Book-Tools/issues/11>.
- Child issue: <https://github.com/bnorth12/AI-Book-Tools/issues/12>.
- Child issue: <https://github.com/bnorth12/AI-Book-Tools/issues/13>.
- Child issue: <https://github.com/bnorth12/AI-Book-Tools/issues/14>.
- Milestone creation blocked by token permissions (`HTTP 403`, `Resource not accessible by personal access token`).
- Assignment/edit operations blocked by token permissions (`replaceActorsForAssignable`, `updateIssue`).
- Duplicate umbrella issues were created during retries and need cleanup after permission elevation:
  - <https://github.com/bnorth12/AI-Book-Tools/issues/6>
  - <https://github.com/bnorth12/AI-Book-Tools/issues/7>

## Requirements Governance (Inline + Tested)

- [x] Add/update inline requirements sections in each affected tool where behavior is changed.
- [x] Ensure requirement IDs are unique and traceable.
- [x] Update or create requirement-to-test mapping notes.
- [ ] Add/adjust automated checks for requirement governance if needed.
- [ ] Validate that each requirement change has explicit test evidence before merge.

Evidence references:

- Requirements mapping baseline: `docs/architecture/ui-unification/UI_UNIFICATION_REQUIREMENTS_TRACEABILITY_BASELINE.md`.
- Execution evidence log: `docs/architecture/ui-unification/UI_UNIFICATION_EXECUTION_TEST_PLAN.md`.

## Secure SDLC Alignment (Required)

- [ ] Run Feature SSDLC checklist for this release and track completion in `docs/governance/FEATURE_RELEASE_SSDL_CHECKLIST.md`.
- [x] Document affected trust boundaries and perform lightweight threat modeling for changed UI/data flows.
- [ ] Confirm secrets/config/data handling expectations for any changed import/export/logging behavior.
- [ ] Record security/config/data verification evidence in PRs and release closeout notes.
- [ ] Ensure rollback approach is documented for high-impact regressions introduced by UI refactor.
- [x] Add STRIDE scored risk table (attack surface, likelihood, impact, inherent risk, residual risk) to release threat model.
- [x] For any non-trivial residual risk item, create explicit mitigation implementation tasks with owners and target release.
- [ ] If deploying beyond local-use context, implement and verify hosted-environment mitigations:
  - CSP allowlists for external style/font sources.
  - Optional self-hosted font assets to reduce CDN dependency risk.
  - Verification that API keys are not persisted and no sensitive data appears in test selectors.

Security analysis references:

- Canonical threat model: `docs/system-security-analysis/UI_UNIFICATION_THREAT_MODEL.md`.
- Security analysis index: `docs/system-security-analysis/README.md`.

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

- [x] Add/update smoke checks for each tool's critical user flow after migration.
- [ ] Run existing regression suites and fix UI-selector brittleness introduced by refactors.
- [x] Add focused visual consistency checklist (spacing, typography, controls, states).
- [x] Validate desktop + mobile layouts for all tools.
- [x] Run accessibility checks (keyboard-only pass, visible focus, contrast).
- [x] Verify no functional regressions in import/export and LLM workflows.

Evidence references:

- `docs/architecture/ui-unification/UI_UNIFICATION_ACCESSIBILITY_RESPONSIVE_CHECKLIST.md`.
- `docs/architecture/ui-unification/UI_UNIFICATION_RELEASE_EVIDENCE_BUNDLE.md`.

## Documentation and Communication

- [x] Update tool README files with new UI conventions where relevant.
- [x] Add a short "shared design system" section to repo docs.
- [ ] Capture before/after screenshots for release notes and PR context.
- [ ] Keep changelog entries in Unreleased during implementation.

## PR and Issue Execution Flow

- [ ] Open PRs linked to each child issue (or one PR per tool if preferred).
- [ ] Ensure each PR includes: scope, requirement IDs, test evidence, screenshots.
- [ ] Close addressed issues only after merge + verification evidence.
- [ ] Close superseded PRs and keep one canonical PR thread per issue.

## Traceability Artifacts (Must Exist Before Release Close)

- [x] Requirement index document with final IDs and descriptions.
- [x] Requirement-to-test evidence matrix (test ID/command -> pass/fail evidence link).
- [x] Per-tool migration notes (what changed, what stayed compatible, known limits).
- [x] Release evidence bundle links (screenshots, logs, reports, and final verification commands).

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
