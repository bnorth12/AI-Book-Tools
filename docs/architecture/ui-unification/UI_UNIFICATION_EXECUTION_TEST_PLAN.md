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
5. NovelWriter Tabs 2-4 shell migration landed with non-breaking panel/subpanel styling and stable hooks.
6. Next: continue NovelWriter migration in additional tab groups with the same immediate validation gate.

## Test Plan Matrix

| Scope | Requirement IDs | Test Project | Evidence Required |
| --- | --- | --- | --- |
| Shared tokens and shell consistency | UIU.X.1, UIU.NW.1, UIU.BE.1, UIU.BD.1 | smoke-ui-shell + visual review | test run output + screenshot diff notes |
| No critical workflow regressions | UIU.X.2 | smoke, smoke-full, regression | passing run logs and HTML report |
| Accessibility/responsive parity baseline | UIU.X.3 | manual keyboard/responsive checklist | docs/architecture/ui-unification/UI_UNIFICATION_ACCESSIBILITY_RESPONSIVE_CHECKLIST.md |
| NovelWriter selector stability | UIU.NW.1 | smoke + smoke-full + regression | pass evidence and selector change notes |
| BookEditor baseline safety net | UIU.BE.1 | smoke-ui-shell | BE-SMOKE-01 pass output |
| BookDecomposer baseline safety net | UIU.BD.1 | smoke-ui-shell | BD-SMOKE-01 pass output |

## Baseline Commands

- npm run lint:md
- npx playwright test --project=smoke-ui-shell
- npx playwright test --project=smoke
- npx playwright test --project=regression

## Latest Execution Evidence (2026-04-20)

- NovelWriter Tabs 2-4 received shell-only styling updates with existing IDs and visible tab labels preserved.
- NovelWriter/user_guide.html was visually aligned to the shared shell so the separate help surface now matches the current application theme.
- cmd /c "set XAI_API_KEY=...&& npx playwright test --project=smoke --reporter=line": 1 passed.
- npx playwright test tests/e2e/novelwriter.regression.spec.js --project=regression --reporter=line: 9 passed.
- npx playwright test --project=regression --reporter=line: blocked by unrelated HerbalBookForge failure REG-BG-04 in tests/e2e/herbalbookforge.regression.spec.js.
- BookEditor shell migration complete (UIU.BE.1): token CSS, font links,
  ui-shell/ui-nav/ui-tab-btn/ui-panel, data-testid hooks.
  BE-SMOKE-01:
  `npx playwright test tests/e2e/bookeditor.smoke.spec.js --project=smoke-ui-shell --reporter=line`
  -> 1 passed (exit 0).
- BookDecomposer shell migration complete (UIU.BD.1): same token pattern,
  .tab wrapper and .tabcontent preserved for smoke selector and JS compatibility.
  BD-SMOKE-01:
  `npx playwright test tests/e2e/bookdecomposer.smoke.spec.js --project=smoke-ui-shell --reporter=line`
  -> 1 passed, 4.4s (exit 0).
- UIU.X.3 checklist completed and captured in docs/architecture/ui-unification/UI_UNIFICATION_ACCESSIBILITY_RESPONSIVE_CHECKLIST.md for NovelWriter, BookEditor, BookDecomposer, and HerbalBookForge.
- Per-application external requirements documents created and synced with inline IDs: NovelWriter/REQUIREMENTS.md, BookEditor/REQUIREMENTS.md, BookDecomposer/REQUIREMENTS.md, HerbalBookForge/REQUIREMENTS.md.
- `npx playwright test --project=smoke --reporter=line,html`: 1 passed (HTML: `playwright-report-smoke/index.html`).
- `npx playwright test --project=smoke-ui-shell --reporter=line,html`: 2 passed (HTML: `playwright-report-ui-shell/index.html`).
- `npx playwright test --project=smoke-full --reporter=line,html`: 1 passed (HTML: `playwright-report-smoke-full/index.html`).
- Archived smoke-full HTML evidence: `docs/releases/evidence/playwright-report-smoke-full-2026-04-19.html`.

## Threat Model (System Security Analysis)

Detailed threat model and cyber threat analysis have been moved to:

- `docs/system-security-analysis/UI_UNIFICATION_THREAT_MODEL.md`

Summary:

- Scope remains UI-only (`feature/ui-unification-foundation`) with no backend/API/auth surface changes.
- STRIDE scoring, trust boundaries, data-flow CIA classification, suggested mitigations, and residual risk are maintained in the System Security Analysis document.
- Mitigation implementation scope is tracked in roadmap and release SSDLC artifacts.

## PR Controls for This Capability

- Link requirement IDs in PR description.
- Include risk note section (R1/R2/R3) with mitigation evidence.
- Include command transcript or CI links for required suites.
- Defer non-shell behavior changes unless explicitly scoped and tested.
