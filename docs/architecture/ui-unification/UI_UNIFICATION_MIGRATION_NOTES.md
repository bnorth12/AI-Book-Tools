# UI Unification Per-Tool Migration Notes

Date: 2026-04-19
Branch: feature/ui-unification-foundation

## Scope

These notes summarize what changed and what compatibility constraints were preserved per tool.

## NovelWriter

### What Changed

- Adopted shared token shell classes and styling from `shared/ui-unification-tokens.css`.
- Expanded shell/panel styling through shared classes for tabs 2-4 and related subpanels.
- Added stable `data-testid` hooks for selector hardening.

### What Stayed Compatible

- Existing tab labels, IDs, and showTab behavior retained.
- Existing chapter workflow semantics retained.
- Existing request log and prompt-management behavior retained.

### Known Limits

- Full smoke-full stability remains an active closeout concern and must be validated on the release-candidate commit.

## BookEditor

### What Changed

- Adopted token shell classes (`ui-shell`, `ui-nav`, `ui-tab-btn`, `ui-panel`).
- Added smoke-oriented `data-testid` hooks and shell wrappers.

### What Stayed Compatible

- Existing tab labels, IDs, import/export behavior, and workflow sequencing retained.
- Existing improvements table workflow preserved.

### Known Limits

- Workflow-level regression depth beyond shell smoke should continue to expand incrementally.

## BookDecomposer

### What Changed

- Adopted shared token shell and panel styling.
- Added smoke-oriented `data-testid` hooks.

### What Stayed Compatible

- `.tab` wrapper and `.tabcontent` classes preserved for existing JS and tests.
- Existing processing/export flow preserved.

### Known Limits

- Workflow-level regression depth beyond shell smoke should continue to expand incrementally.

## Cross-Tool Compatibility Notes

- Shared-schema compatibility remains in place through `schema/novel-schema-1.0.json` for session/data interchange.
- Security analysis and residual-risk tracking are documented in `docs/system-security-analysis/UI_UNIFICATION_THREAT_MODEL.md`.
