# UI Unification Gap Analysis Baseline

Date: 2026-04-19
Branch: feature/ui-unification-foundation
Scope: NovelWriter, BookEditor, BookDecomposer, baseline against HerbalBookForge

## Baseline Summary

HerbalBookForge is the visual baseline and already implements a cohesive design system.
NovelWriter, BookEditor, and BookDecomposer currently use legacy inline CSS styles with divergent layouts, component styles, and interaction patterns.

## Baseline Reference (Target)

Source: HerbalBookForge/HerbalBookForge.html

Key baseline traits:

- Tailwind-driven utility styling.
- Distinct visual identity: emerald palette, gradient background, rounded controls.
- Modern typography stack using Inter and Space Grotesk.
- Consistent tab-button pattern with active underline treatment.
- Card-style grouped sections and sticky header/nav behavior.
- Requirement comments embedded per section and function traceability discipline.

## Current State by Tool

### NovelWriter

Source: NovelWriter/NovelWriter.html

Observed state:

- Inline CSS with Arial-based default style.
- Legacy flat button and table styling (#007bff palette).
- Dense tab nav with 11 functional tabs and custom HUD/status styles.
- Strong requirement comment coverage already present.

Primary visual gaps vs baseline:

- No shared tokens for color, spacing, radius, or typography.
- No card-based visual hierarchy.
- Tab nav interaction differs from HerbalBookForge pattern.
- Mixed spacing rules and component-specific ad hoc styles.

Risk notes:

- Largest selector and flow surface area.
- Refactor can destabilize tab visibility, chapter subpages, and HUD behavior.

### BookEditor

Source: BookEditor/BookEditor.html

Observed state:

- Inline CSS with Arial and Microsoft-blue style buttons.
- Float-based tab nav and basic table layout.
- Duplicate loading element IDs in multiple tabs.
- Less structured requirement annotation than NovelWriter.

Primary visual gaps vs baseline:

- No tokenized design system.
- No modern layout primitives (cards, spacing scale, typographic hierarchy).
- Tab and button states inconsistent with target baseline.

Risk notes:

- High chance of regressions in improvements table and tab switching due to structural DOM changes.

### BookDecomposer

Source: BookDecomposer/BookDecomposer.html

Observed state:

- Minimal inline CSS and basic tabcontent toggling.
- Simple table-first layout with minimal visual hierarchy.
- Most logic split to BookDecomposer.js.

Primary visual gaps vs baseline:

- No design language alignment with target tool.
- No reusable component patterns.
- Tab navigation and panel layout are functionally minimal.

Risk notes:

- Lower UI complexity than NovelWriter/BookEditor, but likely needs substantial layout rewrite.

## Test and Selector Baseline

Sources:

- e2e/novelwriter.smoke.spec.js
- e2e/novelwriter.regression.spec.js
- e2e/novelwriter.smoke.quick.spec.js
- e2e/herbalbookforge.regression.spec.js

Findings:

- Selector coverage is strong for NovelWriter and HerbalBookForge.
- Selectors are mostly ID/text/CSS-chain based and potentially brittle to UI structure changes.
- There are currently no dedicated BookEditor or BookDecomposer Playwright suites.

High-risk selector categories during refactor:

- Text-matched button selectors (button:has-text(...)).
- Deep CSS chain selectors tied to current table/nav structure.
- Hard-coded nav text and ordinal tab labels.

## Canonical Requirement ID Scheme (Approved for This Release)

- UIU.NW.* for NovelWriter migration requirements.
- UIU.BE.* for BookEditor migration requirements.
- UIU.BD.* for BookDecomposer migration requirements.
- UIU.X.* for cross-tool requirements (tokens, accessibility, responsive, QA, docs).

## Initial Requirement Set (Baseline)

- UIU.X.1: All target tools shall adopt shared visual tokens for color, type, spacing, radius, and elevation.
- UIU.X.2: All target tools shall preserve current core workflows without critical functional regressions.
- UIU.X.3: All target tools shall meet baseline keyboard focus visibility and responsive behavior parity.
- UIU.NW.1: NovelWriter shall migrate nav, panel, and form styling to shared tokens/components without changing tab workflow semantics.
- UIU.BE.1: BookEditor shall migrate shell, nav, and improvements UI to shared components while preserving edit/import/export behavior.
- UIU.BD.1: BookDecomposer shall migrate shell and tab/panel styling to shared components while preserving processing/export behavior.

## Recommended Next Implementation Steps

1. Create shared token scaffold (CSS variables or utility layer) derived from HerbalBookForge.
2. Land NovelWriter visual shell migration first with selector stabilization strategy.
3. Add BookEditor smoke/regression coverage before heavy DOM refactor.
4. Add BookDecomposer smoke coverage before visual/layout rewrite.
