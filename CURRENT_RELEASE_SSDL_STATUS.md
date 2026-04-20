# Current Release SSDLC Status (Backfilled)

This file backfills the Secure SDLC checklist for the current capability release because the formal checklist was introduced mid-stream.

## Release Snapshot

- Release scope (current): NovelWriter stabilization, shared-schema alignment updates, smoke/regression harness hardening, and release-process documentation hardening.
- Status: Release validation complete on `main`; tag/release publication finalized.
- Baseline policy template: `FEATURE_RELEASE_SSDL_CHECKLIST.md`
- Suite version baseline for this active cycle: `V0.5.0`.
- Suite version target at final closeout/check-in: `V0.6.0`.
- Component versioning rule for this cycle: each tool component version is finalized at closeout, and suite `V0.6.0` references that finalized component set.

## Late-Adoption Gap Notes

- SSDLC process artifacts were created during execution, not at release kickoff.
- Some planning/governance controls were done implicitly and need explicit retrospective documentation.
- Traceability from requirements -> PRs -> test evidence is partially documented and needs final closure pass.

## 1) Create and Plan

- [x] Define release scope, objective, and explicit out-of-scope items.
  - Note: Scope evolved during execution; final scope now documented across `CHANGELOG.md` and `ISSUES.md`.
- [ ] Create milestone, umbrella issue, and child issues.
  - Gap: Formal milestone/umbrella structure not fully confirmed in repo process artifacts.
- [x] Identify security-impacting changes (auth, secrets, config, storage, transport, dependencies).
  - Note: API-key handling and placeholder checks were explicitly addressed in smoke tests/runbook.
- [ ] Define acceptance criteria including security, privacy, and data handling expectations.
  - Partial: Functional acceptance criteria are present; security/privacy acceptance criteria need explicit release-level signoff checklist.
- [ ] Define requirement IDs and requirement-to-test traceability method.
  - Partial: Inline requirement references exist in places; full traceability matrix for this release is incomplete.
- [x] Define branch strategy and merge order for dependent work.
  - Note: Final closeout merged `feature/novelwriter-schema-stabilization` into `main` and cleaned up the remote feature branch.

## 2) Design and Threat Modeling

- [ ] Document architecture and trust boundaries affected by the release.
  - Gap: Not captured as a dedicated artifact for this release.
- [ ] Perform lightweight threat modeling for changed flows.
  - Gap: No formal threat model doc identified for this release.
- [ ] Review least-privilege needs for tokens/keys/endpoints and local storage usage.
  - Partial: Key handling guidance improved; formal least-privilege review signoff missing.
- [x] Define configuration strategy: defaults, overrides, environment variables, and safe fallback behavior.
  - Note: Environment-based API key setup and unresolved-placeholder handling documented and implemented.
- [ ] Define data classification and handling rules (PII, secrets, generated content, logs, exports).
  - Gap: No explicit classification artifact found for this release.
- [ ] Define retention and redaction expectations for logs/artifacts.
  - Gap: Artifact locations documented, retention/redaction policy not fully defined.

## 3) Implement Securely

- [ ] Implement feature changes with requirement IDs reflected inline where applicable.
  - Partial: Some requirement-style comments exist; consistent requirement-ID usage is incomplete.
- [x] Keep secrets out of source and test fixtures; use environment-based configuration.
  - Note: Workflow guidance emphasizes env var usage and avoiding committed secrets.
- [x] Validate inputs and sanitize/escape outputs where relevant.
  - Note: Defensive parsing/fallback handling added in key workflow areas (especially test harness and JSON flows).
- [x] Add defensive error handling that avoids leaking sensitive data.
  - Note: Runbook/process improvements reduce accidental secret exposure in logs.
- [x] Update documentation impacted by behavior/config/data changes.
  - Note: `README.md`, `CONTRIBUTING.md`, `TESTING_MANUAL_RUNBOOK.md`, and release checklists were updated.
- [x] Keep dependency changes minimal and justified.
  - Note: No major dependency expansion during this release workflow.

## 4) Test and Verify

- [x] Run functional tests for changed workflows.
  - Note: Smoke and targeted flow verification repeatedly executed.
- [ ] Run regression suites for impacted tools.
  - Partial: Regression coverage updated; final clean full regression signoff for release closure still pending.
- [ ] Run security-focused checks for changed surfaces (secrets handling, auth, config misuse, data exposure).
  - Partial: Auth/config misuse checks improved; no formal security test report produced.
- [x] Validate configuration behavior across expected environments.
  - Note: PowerShell/cmd env-key behaviors and placeholder handling validated in run iterations.
- [x] Validate data management behavior (import/export correctness, redaction, retention expectations).
  - Partial: Import/export correctness covered; retention/redaction policy signoff still missing.
- [ ] Validate accessibility and responsive behavior where UI is changed.
  - Gap: Not a central scope of this release and not fully documented.
- [x] Record test evidence (command, result, logs, reports, artifacts).
  - Note: Commands/logs/report paths are captured in workflow and runbook references.

## 5) Release Candidate Review

- [x] Confirm all linked issues/requirements are implemented or explicitly deferred.
  - Note: Implementation and administrative follow-up issues were closed after merge validation.
- [x] Confirm PRs include requirement links, risk notes, and test evidence.
  - Note: Final administrative PR `#5` includes issue linkage and release-alignment notes.
- [x] Confirm changelog and version updates are complete.
  - Note: Version and closeout references were aligned in `CHANGELOG.md`, `README.md`, launcher labels, and tool docs.
- [x] Confirm no unresolved high-severity security/privacy findings remain.
  - Note: Secret handling and configuration controls were validated; no open blocking security issues remain.
- [x] Confirm rollback/recovery approach for critical regressions.
  - Note: Recovery path remains a hard reset to the previous release commit/tag with rerun of required smoke gates.

## 6) Close and Release

- [x] Run final required suite pass on release candidate commit.
  - Note: `smoke` and `smoke-full` both passed on `main` with HTML reports generated (`--reporter=line,html`).
- [x] Tag the exact commit that passed final required tests.
  - Note: Release tag created from validated `main` head.
- [x] If any commit is added after final pass, rerun required validation before tagging.
  - Note: No additional commits were added between final pass and tag creation.
- [x] Publish release notes with links to tag, key PRs/issues, and evidence.
  - Note: GitHub release was published from the validated tag.
- [x] Merge approved branches to trunk in dependency-safe order.
  - Note: Completed via merge commit `ebc44e6` on `main`.
- [x] Run post-merge verification on trunk.
  - Note: Completed via final smoke and smoke-full executions on `main`.
- [x] Close milestone, close addressed issues, and clean up merged branches.
  - Note: No open issues/PRs remain; feature/admin branches were cleaned after merge.

## 7) Post-Release Governance

- [x] Capture lessons learned and known follow-ups.
  - Note: Added mandatory documentation/version alignment gate to closeout checklist for future cycles.
- [x] Create issues for deferred or discovered follow-up work.
  - Note: Administrative closeout alignment was tracked and completed via issue `#4`.
- [x] Update runbooks/process docs if release exposed workflow gaps.
  - Note: Process docs were significantly expanded during this release.
- [x] Confirm provenance trail is complete (requirements -> commits/PRs -> tests -> tag/release).
  - Note: Feature and admin issues/PRs, test evidence, and release tag are now linked and closed.

## Evidence Template (Current Release Draft)

- Release name/version: `1.2.0` capability closeout release (`V0.6.0` suite track)
- Scope summary: NovelWriter stabilization + schema alignment + smoke/regression/process hardening
- Final tested commit: `0b992cf`
- Release tag: `v1.2.0`
- Required suites executed: `smoke` (pass), `smoke-full` (pass)
- Evidence locations (logs/reports/artifacts): terminal run history, `playwright-report/`, `test-results/`
- Security/config/data checks performed: API-key handling checks, env-var workflow documentation, import/export/schema validations
- Open risks and mitigations: smoke-full runtime remains lengthy; continue using manual runbook and preserve HTML artifacts per release.

## Closeout Execution Notes (2026-04-19)

- Merged branch `feature/novelwriter-schema-stabilization` into `main` and pushed to origin.
- Deleted remote branch `feature/novelwriter-schema-stabilization`.
- Sanitized local workflow/task configuration to remove hardcoded API key usage.
- Could not execute final trunk validation suites in this environment because `XAI_API_KEY` is not set.
- Issue #3 was closed from GitHub UI after implementation validation.
- Dependabot PRs #1 and #2 were superseded by commit `2266939` and closed with comments.
- Added explicit closeout policy note to keep documentation and version metadata aligned during feature-branch closeout.
- Final post-merge validation completed on `main` with passing `smoke` and `smoke-full` suites.
- Release tag and publication completed for `v1.2.0`.
