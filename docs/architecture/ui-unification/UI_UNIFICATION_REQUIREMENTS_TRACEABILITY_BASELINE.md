# UI Unification Requirements Traceability Baseline

Date: 2026-04-19
Branch: feature/ui-unification-foundation

## Purpose

Define initial requirement IDs and baseline evidence mapping for the UI unification release.
This matrix will be expanded as implementation PRs are opened.

## Requirement IDs (Initial)

- UIU.X.1 Shared visual token system across target tools.
- UIU.X.2 No critical workflow regressions after UI migration.
- UIU.X.3 Accessibility and responsive parity at minimum.
- UIU.NW.1 NovelWriter shell/nav/forms aligned to shared design.
- UIU.BE.1 BookEditor shell/nav/improvements aligned to shared design.
- UIU.BD.1 BookDecomposer shell/tab/panel layout aligned to shared design.

## Requirement to Test Baseline Matrix

| Requirement ID | Scope | Existing Automated Coverage | Current Gap | Planned Evidence |
| --- | --- | --- | --- | --- |
| UIU.X.1 | Cross-tool design token adoption | None specific | No token-level assertions | PR screenshots + visual checklist + CSS token diff; current evidence includes NovelWriter Tabs 2-4 tokenized shell update |
| UIU.X.2 | Cross-tool regression safety | NovelWriter smoke/regression, HerbalBookForge regression | No BookEditor/BookDecomposer automated regression | Playwright smoke additions + existing suite reruns; current evidence includes isolated NovelWriter regression rerun |
| UIU.X.3 | Cross-tool accessibility/responsive parity | None explicit | No automated a11y checks, no responsive assertions | Keyboard walkthrough notes + viewport checks + PR evidence |
| UIU.NW.1 | NovelWriter migration | tests/e2e/novelwriter.smoke.spec.js, tests/e2e/novelwriter.regression.spec.js, tests/e2e/novelwriter.smoke.quick.spec.js | Selector brittleness expected during refactor | Selector stabilization + rerun smoke/regression outputs; latest evidence: smoke project passed 1/1 with XAI_API_KEY and isolated regression run passed 9/9 |
| UIU.BE.1 | BookEditor migration | tests/e2e/bookeditor.smoke.spec.js | Workflow-level coverage still missing | Add workflow smoke/regression after shell migration |
| UIU.BD.1 | BookDecomposer migration | tests/e2e/bookdecomposer.smoke.spec.js | Workflow-level coverage still missing | Add workflow smoke/regression after shell migration |

## Baseline Test Inventory

Existing suites:

- tests/e2e/novelwriter.smoke.spec.js
- tests/e2e/novelwriter.smoke.quick.spec.js
- tests/e2e/novelwriter.regression.spec.js
- tests/e2e/herbalbookforge.regression.spec.js
- tests/e2e/bookeditor.smoke.spec.js
- tests/e2e/bookdecomposer.smoke.spec.js

Execution artifact:

- docs/architecture/ui-unification/UI_UNIFICATION_EXECUTION_TEST_PLAN.md

## Governance Notes

- Every implementation PR should reference one or more UIU requirement IDs.
- Each PR should include explicit test evidence for mapped requirement IDs.
- Any deferred requirement must be marked with rationale and follow-up issue link.
