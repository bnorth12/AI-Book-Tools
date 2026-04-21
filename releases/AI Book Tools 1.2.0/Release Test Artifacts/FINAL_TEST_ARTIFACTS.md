# Final Test Artifacts - AI Book Tools 1.2.0

Release snapshot folder: releases/AI Book Tools 1.2.0
Artifacts folder: releases/AI Book Tools 1.2.0/Release Test Artifacts
Generated on: 2026-04-19 23:21:49 -05:00

## Required final release test command policy

For final release validation runs, when overriding Playwright reporters, use --reporter=line,html to ensure an HTML report is generated and archived.

Example:

- npx playwright test --project=smoke --reporter=line,html
- npx playwright test --project=smoke-full --reporter=line,html
- npx playwright test --project=regression --reporter=line,html

Implementation note for this historical snapshot:

- Tests were not rerun solely to backfill HTML artifacts for the prior release.
- This branch enforces the HTML reporter requirement at feature-branch closeout.

## Playwright report files captured

- Release Test Artifacts\playwright-report.html
- playwright-report\index.html
- playwright-report\data\4c8f24a638f91e74e2e8c25c5a197ee6f7b8d8bb.png
- playwright-report\data\b8a804fdd64736770f3141f9cb075f05db503188.webm
- playwright-report\data\c70a50a7076757f17dbf1ec3396c08271aec76a4.webm
- playwright-report\data\dee134913ccecfa62a58e8816eb5280e678469ac.png

## Test-results files captured

- test-results\.last-run.json
