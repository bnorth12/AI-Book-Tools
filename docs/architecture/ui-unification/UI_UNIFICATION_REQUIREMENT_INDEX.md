# UI Unification Requirement Index

Date: 2026-04-19
Branch: feature/ui-unification-foundation

## Purpose

Provide a single index of active UI unification requirement IDs and their scope.

## Cross-Tool Requirements

- `UIU.X.1`: Shared visual token system across target tools.
- `UIU.X.2`: No critical workflow regressions after UI migration.
- `UIU.X.3`: Accessibility and responsive parity baseline.

## NovelWriter Requirements

- `UIU.NW.F1`: Stable tab labels and showTab behavior.
- `UIU.NW.F2`: Schema-versioned session import/export compatibility.
- `UIU.NW.F3`: AI request routing through central callAI gateway.
- `UIU.NW.F4`: Chapter generation/edit workflow semantics preserved.
- `UIU.NW.F5`: Request history and prompt management surfaces retained.
- `UIU.NW.NF1`: Shared token styling adoption.
- `UIU.NW.NF2`: Responsive layout and keyboard focus visibility.
- `UIU.NW.NF3`: Selector/ID stability for smoke/regression tests.
- `UIU.NW.NF4`: Visible focus states for key controls.

## BookEditor Requirements

- `UIU.BE.F1`: Stable six-tab shell with unchanged labels/IDs.
- `UIU.BE.F2`: Project setup controls and session import/export preserved.
- `UIU.BE.F3`: Book input and suggestion workflow preserved.
- `UIU.BE.F4`: Chat bot workflow preserved.
- `UIU.BE.F5`: Improvements workflow and edited output flow preserved.
- `UIU.BE.NF1`: Shared token shell styling adoption.
- `UIU.BE.NF2`: Responsive behavior at mobile breakpoints preserved.
- `UIU.BE.NF3`: Request logging traceability retained.
- `UIU.BE.NF4`: Stable selectors/test IDs for smoke coverage.

## BookDecomposer Requirements

- `UIU.BD.F1`: Stable four-tab decomposition workflow.
- `UIU.BD.F2`: Input capture workflow preserved.
- `UIU.BD.F3`: Chapter preview output preserved.
- `UIU.BD.F4`: Extracted elements table workflow preserved.
- `UIU.BD.F5`: Output JSON export/import behavior preserved.
- `UIU.BD.NF1`: Shared token shell styling adoption.
- `UIU.BD.NF2`: `.tab` and `.tabcontent` contract stability preserved.
- `UIU.BD.NF3`: Output readability and scroll-safe display preserved.
- `UIU.BD.NF4`: Stable selector hooks for smoke coverage.

## Traceability Links

- Baseline matrix: `docs/architecture/ui-unification/UI_UNIFICATION_REQUIREMENTS_TRACEABILITY_BASELINE.md`
- Execution evidence: `docs/architecture/ui-unification/UI_UNIFICATION_EXECUTION_TEST_PLAN.md`
- Accessibility evidence: `docs/architecture/ui-unification/UI_UNIFICATION_ACCESSIBILITY_RESPONSIVE_CHECKLIST.md`
