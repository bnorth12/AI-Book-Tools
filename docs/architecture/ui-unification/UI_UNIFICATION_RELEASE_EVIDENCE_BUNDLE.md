# UI Unification Release Evidence Bundle

Date: 2026-04-21
Branch: main

## Purpose

Central index of release evidence artifacts for UI unification.

## Test Evidence

- Final tested release-candidate commit:
  - `93bed58606e796ab5f5dc734f22d65d30b2aa76d`
- Published release tag:
  - `v1.2.0`

- NovelWriter smoke pass with HTML evidence:
  - Command: `npx playwright test --project=smoke --reporter=line,html`
  - Report: `playwright-report-smoke/index.html`
- Smoke UI shell pass with HTML evidence:
  - Command: `npx playwright test --project=smoke-ui-shell --reporter=line,html`
  - Report: `playwright-report-ui-shell/index.html`
- NovelWriter smoke-full pass with HTML evidence:
  - Command: `npx playwright test --project=smoke-full --reporter=line,html`
  - Report: `playwright-report-smoke-full/index.html`
  - Archived copy: `docs/releases/evidence/playwright-report-smoke-full-2026-04-19.html`
  - Snapshot copy: `releases/AI Book Tools 1.2.0/Release Test Artifacts/playwright-report-smoke-full.html`
- Historical shell smoke references:
  - `tests/e2e/bookeditor.smoke.spec.js`
  - `tests/e2e/bookdecomposer.smoke.spec.js`
- Post-merge verification on `main`:
  - `npx playwright test --project=smoke --reporter=line,html` (pass)
  - `npx playwright test --project=smoke-ui-shell --reporter=line,html` (pass)

## Governance and Security Evidence

- Threat model and cyber analysis:
  - `docs/system-security-analysis/UI_UNIFICATION_THREAT_MODEL.md`
- SSDLC checklist:
  - `docs/governance/FEATURE_RELEASE_SSDL_CHECKLIST.md`

## Accessibility and Visual Evidence

- Accessibility/responsive checklist:
  - `docs/architecture/ui-unification/UI_UNIFICATION_ACCESSIBILITY_RESPONSIVE_CHECKLIST.md`
- Visual consistency checklist:
  - `docs/architecture/ui-unification/UI_UNIFICATION_VISUAL_CONSISTENCY_CHECKLIST.md`
- Screenshot interaction notes:
  - `docs/releases/evidence/screenshots/SCREENSHOT_INTERACTION_NOTES_2026-04-20.md`

## Screenshot Evidence Standard

- Required scope per tool:
  - Shell/navigation container screenshot (`before` and `after`)
  - One key workflow panel screenshot (`after`)
  - One short interaction note describing visible changes and compatibility
- Naming convention:
  - `<tool>-<surface>-<state>-<yyyy-mm-dd>.png`
  - Example: `novelwriter-shell-after-2026-04-20.png`
- Storage location:
  - `docs/releases/evidence/screenshots/`
- Captured artifacts:
  - `docs/releases/evidence/screenshots/novelwriter-shell-before-2026-04-20.png`
  - `docs/releases/evidence/screenshots/novelwriter-shell-after-2026-04-20.png`
  - `docs/releases/evidence/screenshots/novelwriter-generate-panel-after-2026-04-20.png`
  - `docs/releases/evidence/screenshots/bookeditor-shell-before-2026-04-20.png`
  - `docs/releases/evidence/screenshots/bookeditor-shell-after-2026-04-20.png`
  - `docs/releases/evidence/screenshots/bookeditor-improvements-panel-after-2026-04-20.png`
  - `docs/releases/evidence/screenshots/bookdecomposer-shell-before-2026-04-20.png`
  - `docs/releases/evidence/screenshots/bookdecomposer-shell-after-2026-04-20.png`
  - `docs/releases/evidence/screenshots/bookdecomposer-output-panel-after-2026-04-20.png`
- Historical sources used for `before` captures:
  - `a839b93:NovelWriter/NovelWriter.html`
  - `29effc7:BookEditor/BookEditor.html`
  - `29effc7:BookDecomposer/BookDecomposer.html`

## Release Snapshot Evidence

- Snapshot packaging policy:
  - `docs/governance/RELEASE_PACKAGE_POLICY.md`
- Snapshot artifact inventory location pattern:
  - `releases/AI Book Tools <version>/Release Test Artifacts/FINAL_TEST_ARTIFACTS.md`

## Release Completion Evidence

- GitHub release:
  - `v1.2.0`
- Milestone:
  - `Unify Visual Layout`
- Main branch promoted to release commit:
  - `93bed58606e796ab5f5dc734f22d65d30b2aa76d`
