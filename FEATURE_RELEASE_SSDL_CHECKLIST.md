# Feature Release Secure SDLC Checklist

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
- [ ] Tag the exact commit that passed final required tests.
- [ ] If any commit is added after final pass, rerun required validation before tagging.
- [ ] Publish release notes with links to tag, key PRs/issues, and evidence.
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
