# Release Snapshot Packaging Policy

This policy defines mandatory release snapshot packaging in the repository root.

## Required Location

For every official release, create a versioned folder at:

- `releases/AI Book Tools <version>/`

Example:

- `releases/AI Book Tools 1.2.0/`

## Required Contents

Each release snapshot folder must contain:

1. A copy of the root launcher:
   - `index.html`
2. Application subfolders with only required HTML files:
   - `NovelWriter/`
   - `BookEditor/`
   - `BookDecomposer/`
   - `HerbalBookForge/`
3. A release test artifacts subfolder:
   - `Release Test Artifacts/`
4. Inside `Release Test Artifacts/`:
   - `FINAL_TEST_ARTIFACTS.md`
   - HTML Playwright report file (for example `playwright-report.html`)

## Final Test Evidence Requirement

When running Playwright final release validation with overridden reporter settings,
use:

- `--reporter=line,html`

This ensures both terminal output and HTML report artifacts are generated for release
provenance.

Recommended examples:

- `npx playwright test --project=smoke --reporter=line,html`
- `npx playwright test --project=smoke-full --reporter=line,html`
- `npx playwright test --project=regression --reporter=line,html`

Historical snapshot note:

- Do not rerun prior releases only to backfill HTML reports.
- Enforce the HTML reporter requirement when closing the active feature branch/release.

## Traceability Notes

- `docs/releases/` is for release closeout reports and documentation.
- `releases/` (repo root) is for frozen file snapshots and artifact inventory per version.
- Release tags must still follow provenance policy in `CONTRIBUTING.md`.
