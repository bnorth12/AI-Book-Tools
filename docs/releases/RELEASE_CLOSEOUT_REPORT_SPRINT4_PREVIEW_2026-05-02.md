# Sprint 4 Closeout Report - Preview Tab (v0.12.0)

Date: 2026-05-02
Scope: HerbalBookForge Sprint 4 - Preview tab implementation
Branch: feature/herbalbookforge-sprint-4-preview

## Summary

Sprint 4 implemented the Preview tab end-to-end for manuscript assembly, in-app rendering, and export workflows.

Delivered capabilities:

- Preview manuscript assembly from chapter drafts in outline order
- Preview rendering with empty-state handling and stale-preview guidance
- Export to Markdown (.md)
- Export to printable HTML (print to PDF via browser print dialog)
- Export to Rich Text Format (.rtf) for Word-friendly editing workflows
- Preview state persistence in localStorage v0.12.0 (`project.preview.lastGenerated`, `project.preview.assembledText`, `project.preview.exportHistory[]`)

Deferred:

- Native DOCX export (tracked as deferred requirement beyond v0.12.0)

## Issue Coverage

Completed Sprint 4 issues:

- #54 Requirements and acceptance criteria (HBF.PR1-HBF.PR4, HBFIT.18-HBFIT.21)
- #55 Preview state model and localStorage v0.12.0 migration
- #56 Preview tab UI shell with test ids and empty state
- #57 assembleManuscript implementation in outline order
- #58 Preview rendering and refresh/stale behavior
- #59 Markdown export
- #60 Printable HTML export for print-to-PDF workflow
- #61 RTF export for Word-friendly workflow
- #62 Smoke coverage for Preview controls
- #63 Integration coverage HBFIT.18-HBFIT.21
- #64 TESTING and REQUIREMENTS sync
- #65 Sprint closeout and PR packaging (this report)

## Validation Evidence

Smoke suite:

- Command: `npx playwright test --project=herbalbookforge-smoke --reporter=list`
- Result: 4 passed
- Included Preview smoke control coverage.

Preview integration slice:

- Command: `npx playwright test --project=herbalbookforge-integration --grep "HBFIT\.18|HBFIT\.19|HBFIT\.20|HBFIT\.21"`
- Result: 4 passed
- Covered assembly ordering, render/refresh behavior, export actions/guards, and persistence.

## Key Commits

- df4359a feat(hbf): lock Preview requirements and add v0.12 preview state migration
- 04be56d feat(hbf): add Preview tab UI shell with export controls
- d943a74 feat(hbf): assemble and render Preview manuscript state
- 64fb119 feat(hbf): add Markdown export for Preview manuscript
- b5b137d feat(hbf): add printable HTML and RTF exports
- 354ad66 test(hbf): add Preview smoke and integration coverage
- b3d5a81 docs(hbf): update Sprint 4 Preview testing documentation

## PR Packaging Notes

Suggested PR title:

- feat(hbf): Sprint 4 Preview tab v0.12.0

Suggested PR summary bullets:

- Adds Preview tab manuscript assembly and render pipeline
- Adds export support: Markdown, printable HTML (print-to-PDF), and RTF
- Adds persistent preview metadata state in localStorage v0.12.0
- Adds smoke and integration test coverage for HBFIT.18-HBFIT.21
- Documents DOCX export deferment beyond v0.12.0

Risk notes:

- Printable HTML export depends on popup allowance in browser settings
- Native DOCX generation remains deferred by design

## Outstanding Follow-ups

- Open deferred Safety items remain tracked separately: #52 and #53
- Manual GitHub PR creation/merge may still be required if PAT permissions remain restricted
