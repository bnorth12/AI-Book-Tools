# Feature Release Secure SDLC Checklist

## Current Status Snapshot (HerbalBookForge Chapter Outlines, 2026-04-25)

Legend: READY = verified in current workspace evidence; NOT READY = missing completion evidence or incomplete.

### Ready/Not-Ready Matrix

| Checklist Section | Item | Status | Evidence/Notes |
|---|---|---|---|
| 1) Create and Plan | Scope/objective/out-of-scope defined | READY | Sprint plan and issue breakdown docs exist under HerbalBookForge sprint docs. |
| 1) Create and Plan | Milestone/umbrella/child issues created | NOT READY | GitHub artifact creation/closure is not verifiable from local workspace. |
| 1) Create and Plan | Requirement IDs and traceability method defined | READY | HBF.CHO1-HBF.CHO6 are documented and referenced in code/docs. |
| 2) Design and Threat Modeling | Architecture/trust boundaries and threat model documented | NOT READY | No sprint-specific threat model artifact was verified for this sprint. |
| 3) Implement Securely | Feature implemented with requirement IDs inline | READY | Chapter Outlines requirements are present inline in HerbalBookForge.html. |
| 3) Implement Securely | Secrets kept out of source | READY | API key workflow is environment/local setup based and .env usage documented. |
| 3) Implement Securely | Inputs/outputs sanitized and defensive errors | READY | escapeHtml and defensive parsing/fallback patterns are implemented. |
| 4) Test and Verify | Functional tests run | READY | Smoke and integration runs were executed; core chapter generation completed successfully. |
| 4) Test and Verify | Regression suites for impacted tools | NOT READY | Full regression signoff for sprint closeout was not verified. |
| 4) Test and Verify | Security-focused checks formalized | NOT READY | No dedicated security test report artifact verified for this sprint. |
| 4) Test and Verify | Test evidence recorded | READY | Playwright HTML report/video/screenshot artifacts were generated. |
| 5) Release Candidate Review | PR includes requirements, risks, test evidence | NOT READY | No finalized sprint PR evidence is available in workspace. |
| 6) Close and Release | Final required suite pass on release candidate commit | NOT READY | Smoke and herbalbookforge-integration are now passing locally with HTML evidence; release-candidate commit pin/tag and PR evidence gate remain open. |
| 6) Close and Release | Tag validated commit and publish notes | NOT READY | No sprint-specific tag/release publication evidence verified for this work. |
| 6) Close and Release | Merge approved branch to trunk | NOT READY | Work is currently in local uncommitted state on main. |
| 7) Post-Release Governance | Lessons learned and follow-up issues captured | NOT READY | No sprint-specific retrospective artifact verified as complete. |

Use this checklist for any feature/capability release that changes code, configuration, data handling, or external integrations.

## Policy Intent

- Enforce a secure software development lifecycle (SSDLC) from planning through release closeout.
- Ensure configuration and data management controls are explicitly reviewed and tested.
- Maintain traceability from requirements to implementation, tests, and release artifacts.

## 1) Create and Plan

- [ ] Define release scope, objective, and explicit out-of-scope items.
- [ ] Create milestone, umbrella issue, and child issues.
- [ ] Identify security-impacting changes (auth, secrets, config, storage, transport, dependencies).
- [ ] Define acceptance criteria including security, privacy, and data handling expectations.
- [ ] Define requirement IDs and requirement-to-test traceability method.
- [ ] Define branch strategy and merge order for dependent work.

## 2) Design and Threat Modeling

- [ ] Document architecture and trust boundaries affected by the release.
- [ ] Perform lightweight threat modeling for changed flows.
- [ ] Review least-privilege needs for tokens/keys/endpoints and local storage usage.
- [ ] Define configuration strategy: defaults, overrides, environment variables, and safe fallback behavior.
- [ ] Define data classification and handling rules (PII, secrets, generated content, logs, exports).
- [ ] Define retention and redaction expectations for logs/artifacts.

## 3) Implement Securely

- [ ] Implement feature changes with requirement IDs reflected inline where applicable.
- [ ] Keep secrets out of source and test fixtures; use environment-based configuration.
- [ ] Validate inputs and sanitize/escape outputs where relevant.
- [ ] Add defensive error handling that avoids leaking sensitive data.
- [ ] Update documentation impacted by behavior/config/data changes.
- [ ] Keep dependency changes minimal and justified.

## 4) Test and Verify

- [ ] Run functional tests for changed workflows.
- [ ] Run regression suites for impacted tools.
- [ ] Run security-focused checks for changed surfaces (secrets handling, auth, config misuse, data exposure).
- [ ] Validate configuration behavior across expected environments.
- [ ] Validate data management behavior (import/export correctness, redaction, retention expectations).
- [ ] Validate accessibility and responsive behavior where UI is changed.
- [ ] Record test evidence (command, result, logs, reports, artifacts).

## 5) Release Candidate Review

- [ ] Confirm all linked issues/requirements are implemented or explicitly deferred.
- [ ] Confirm PRs include requirement links, risk notes, and test evidence.
- [ ] Confirm changelog and version updates are complete.
- [ ] Confirm no unresolved high-severity security/privacy findings remain.
- [ ] Confirm rollback/recovery approach for critical regressions.

## 6) Close and Release

- [ ] Run final required suite pass on release candidate commit.
  - Use Playwright `--reporter=line,html` when overriding reporter settings so HTML evidence is generated.
- [ ] Tag the exact commit that passed final required tests.
- [ ] If any commit is added after final pass, rerun required validation before tagging.
- [ ] Publish release notes with links to tag, key PRs/issues, and evidence.
- [ ] Create release snapshot package at `releases/AI Book Tools <version>/` with:
  - copied `index.html`
  - app subfolders containing only required HTML files
  - `Release Test Artifacts/` containing:
    - `FINAL_TEST_ARTIFACTS.md` that inventories final test artifacts
    - HTML Playwright report file
- [ ] Run documentation/version alignment audit before tagging:
  - Verify top-level docs (`README.md`, `CHANGELOG.md`, launcher labels) match current tool versions.
  - Verify closeout trackers reflect actual GitHub issue/PR closure state.
  - Verify suite version metadata (`package.json` and changelog release section) are synchronized.
- [ ] Merge approved branches to trunk in dependency-safe order.
- [ ] Run post-merge verification on trunk.
- [ ] Close milestone, close addressed issues, and clean up merged branches.

## 7) Post-Release Governance

- [ ] Capture lessons learned and known follow-ups.
- [ ] Create issues for deferred or discovered follow-up work.
- [ ] Update runbooks/process docs if release exposed workflow gaps.
- [ ] Confirm provenance trail is complete (requirements -> commits/PRs -> tests -> tag/release).

## Evidence Template (Per Release)

- Release name/version:
- Scope summary:
- Final tested commit:
- Release tag:
- Required suites executed:
- Evidence locations (logs/reports/artifacts):
- Security/config/data checks performed:
- Open risks and mitigations:
- Documentation/version alignment checks completed (README/changelog/launcher/closeout docs):

## Feature Branch Status Snapshot (2026-04-20)

Branch: feature/ui-unification-foundation

Completed now:

- [x] Lightweight threat modeling for changed UI flows (see docs/architecture/ui-unification/UI_UNIFICATION_EXECUTION_TEST_PLAN.md).
- [x] Lightweight threat modeling for changed UI flows (canonical analysis at docs/system-security-analysis/UI_UNIFICATION_THREAT_MODEL.md; summary in docs/architecture/ui-unification/UI_UNIFICATION_EXECUTION_TEST_PLAN.md).
- [x] Inline requirement IDs reflected in all four applications (NovelWriter, BookEditor, BookDecomposer, HerbalBookForge).
- [x] External per-application requirements documents created and synced (REQUIREMENTS.md in each app folder).
- [x] Accessibility/responsive checklist completed for UIU.X.3 (see docs/architecture/ui-unification/UI_UNIFICATION_ACCESSIBILITY_RESPONSIVE_CHECKLIST.md).
- [x] Functional smoke evidence recorded for BookEditor and BookDecomposer shell suites.
- [x] Smoke suite pass with HTML evidence recorded:
  - `npx playwright test --project=smoke --reporter=line,html`
  - `playwright-report-smoke/index.html`
- [x] Smoke UI shell pass with HTML evidence recorded:
  - `npx playwright test --project=smoke-ui-shell --reporter=line,html`
  - `playwright-report-ui-shell/index.html`
- [x] Smoke-full suite pass with HTML evidence recorded:
  - `npx playwright test --project=smoke-full --reporter=line,html`
  - `playwright-report-smoke-full/index.html`
  - archived: `docs/releases/evidence/playwright-report-smoke-full-2026-04-19.html`
- [x] Final required suites rerun on release-candidate commit `93bed58` with HTML evidence recorded:
  - `npx playwright test --project=smoke --reporter=line,html`
  - `npx playwright test --project=smoke-ui-shell --reporter=line,html`
  - `npx playwright test --project=smoke-full --reporter=line,html`
- [x] Release tag `v1.2.0` now points to validated commit `93bed58`.
- [x] Feature branch merged to `main` and post-merge verification completed.
- [x] Milestone closed, umbrella/child issues closed, and merged feature branch deleted.

Release close status:

- [x] Create/confirm milestone, umbrella issue, and child issue closure mapping.
- [x] Rerun final required suites on release-candidate commit and tag that exact commit.
- [x] Complete release closeout items (release notes, merge order, post-merge trunk verification).
