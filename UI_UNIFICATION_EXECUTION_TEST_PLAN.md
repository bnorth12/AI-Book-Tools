# UI Unification Execution and Risk Test Plan

Date: 2026-04-19
Branch: feature/ui-unification-foundation

## Purpose

Define execution controls for the UI unification capability release with explicit risk coverage, selector-stability safeguards, and test evidence expectations.

## Release Risks and Mitigations

### R1 Selector breakage during shell refactor

Risk:

- Existing tests rely heavily on text/ordinal selectors and DOM shape.

Mitigations:

- Preserve existing IDs and core tab labels while migrating styles.
- Introduce stable data-testid attributes in migrated shells.
- Land shell styling changes in small PR slices with immediate smoke verification.

### R2 Functional regressions hidden by visual-only changes

Risk:

- Refactor could alter tab activation and workflow state transitions.

Mitigations:

- Require smoke verification after each tool shell migration step.
- Keep behavior logic unchanged in shell migration commits.
- Add explicit tab activation and core control assertions in smoke suites.

### R3 No automated coverage for BookEditor/BookDecomposer

Risk:

- DOM migration in these tools currently has no regression safety net.

Mitigations:

- Add smoke suites before heavy refactor work starts.
- Expand from shell smoke to workflow smoke before structural rewrites.

## Execution Sequence (Current)

1. Shared token scaffold established.
2. NovelWriter shell migration started with selector stabilization hooks.
3. BookEditor shell smoke test added.
4. BookDecomposer shell smoke test added.
5. Next: run smoke-ui-shell project and record baseline evidence.

## Test Plan Matrix

| Scope | Requirement IDs | Test Project | Evidence Required |
| --- | --- | --- | --- |
| Shared tokens and shell consistency | UIU.X.1, UIU.NW.1, UIU.BE.1, UIU.BD.1 | smoke-ui-shell + visual review | test run output + screenshot diff notes |
| No critical workflow regressions | UIU.X.2 | smoke, smoke-full, regression | passing run logs and HTML report |
| Accessibility/responsive parity baseline | UIU.X.3 | manual keyboard/responsive checklist | checklist completion in PR notes |
| NovelWriter selector stability | UIU.NW.1 | smoke + smoke-full + regression | pass evidence and selector change notes |
| BookEditor baseline safety net | UIU.BE.1 | smoke-ui-shell | BE-SMOKE-01 pass output |
| BookDecomposer baseline safety net | UIU.BD.1 | smoke-ui-shell | BD-SMOKE-01 pass output |

## Baseline Commands

- npm run lint:md
- npx playwright test --project=smoke-ui-shell
- npx playwright test --project=smoke
- npx playwright test --project=regression

## PR Controls for This Capability

- Link requirement IDs in PR description.
- Include risk note section (R1/R2/R3) with mitigation evidence.
- Include command transcript or CI links for required suites.
- Defer non-shell behavior changes unless explicitly scoped and tested.
