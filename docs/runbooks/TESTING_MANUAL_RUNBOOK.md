# Manual Test Runbook (Human-Operated)

This runbook explains how to run and observe the Playwright suites manually while they execute, and how to analyze failures quickly.

## Scope

These suites are covered:

- `smoke` project: `tests/e2e/novelwriter.smoke.quick.spec.js`
- `smoke-full` project: `tests/e2e/novelwriter.smoke.spec.js`
- `regression` project: `tests/e2e/novelwriter.regression.spec.js`, `tests/e2e/herbalbookforge.regression.spec.js`

## Prerequisites

1. Node.js is installed.
2. Dependencies are installed:
   - `npm install`
3. Playwright browser is installed at least once:
   - `npm run test:e2e:install`
4. Local static server is available (Playwright config also starts one):
   - `python -m http.server 8080`
5. Valid xAI key is exported in the shell used for the run.

## API Key Setup (PowerShell)

Use one shell and keep all test commands in that same shell.

```powershell
Remove-Item Env:XAI_API_KEY -ErrorAction SilentlyContinue
$env:XAI_API_KEY = "YOUR_REAL_KEY"
[string]::IsNullOrWhiteSpace($env:XAI_API_KEY)
```

Expected result from the last line: `False`

If you suspect a bad key, re-run this block before starting a new test process.

## Run Commands

### Fast sanity check (recommended first)

```powershell
npx playwright test --project=smoke -g QSMOKE-01 --reporter=line
```

### Quick smoke project

```powershell
npx playwright test --project=smoke --reporter=line
```

### Full additive smoke project (long-running)

```powershell
npx playwright test --project=smoke-full --reporter=line
```

### Regression project

```powershell
npx playwright test --project=regression --reporter=line
```

### Single test targeting

```powershell
npx playwright test --project=smoke-full -g "SMOKE-01 Additive full end-to-end flow preserves prior tab state" --reporter=line
```

### Generate HTML report from command line

When you override reporters (for example `--reporter=line`), Playwright will not emit the HTML report unless you include it explicitly.

Use this form to keep line output and also generate a fresh HTML report:

```powershell
npx playwright test --project=smoke-full --reporter=line,html
```

For quick smoke with HTML output:

```powershell
npx playwright test --project=smoke --reporter=line,html
```

Then open the generated report:

```powershell
npx playwright show-report
```

## Live Monitoring While Tests Run

### What to watch in terminal output

1. Step boundaries:
   - `STEP START: ...`
   - `STEP DONE: ...`
2. LLM operation cadence:
   - `Waiting on LLM: ...`
   - `LLM completed: ...`
3. Stalls usually appear as repeated wait/click retries with no matching completion line.

### Manual observer checklist

1. Confirm the active tab in UI matches the expected step in logs.
2. Do not click in the app while automation is active unless intentionally investigating a stall.
3. If a stall is suspected, capture:
   - current step name from terminal
   - first error stack block when it appears
   - screenshot path shown by Playwright
4. If the run appears wedged with no new log lines for several minutes, stop and restart once, then compare the first failing step.

## Smoke-Full Expected Late-Stage Flow (Current)

For `SMOKE-01 Additive full end-to-end flow preserves prior tab state`, the intended late-stage sequence is:

1. **Tab 7**: Suggest improvements, assign statuses across valid values (`To Incorporate`, `Incorporated`, `Ignored`), and run `Break Down` only for rows marked `To Incorporate`.
2. **Tab 8**: Review consolidated suggestions and run `Integrate Suggestions` when actionable consolidated content exists.
3. **Tabs 9-11 + Help**: Continue through remaining intended tabs to verify request log, element values, prompts, and help page behavior.
4. **Return to Tab 7**: Export **Book** first, then **Session** as a checkpoint.
5. **Reload + Import**: Reload app and import exported session to confirm persistence/restore.

Notes:

- `Refresh Breakdowns` in Tab 8 is not required for core autonomous flow because Tab 8 auto-populates on navigation.
- `Break Down` is only valid for items with status `To Incorporate`.

## Common Failure Patterns and First Actions

### Invalid or wrong API key

Signals:

- early failures across Tab 1 calls
- auth errors (401/403) or empty responses

Actions:

1. Re-export `XAI_API_KEY` in current shell.
2. Re-run `QSMOKE-01` first.
3. Run longer suite only after quick smoke succeeds.

### Hidden subpage/button mismatch

Signals:

- click retries for an element that exists but is not visible
- long waits on a chapter subpage step

Actions:

1. Capture first failing locator and step name.
2. Patch test to use deterministic subpage function call instead of generic first visible button.

### Modal dialog blocking

Signals:

- test appears idle while UI has alert/confirm

Actions:

1. Add or verify dialog handler in test.
2. Re-run from start.

## Artifacts and Post-Run Analysis

Playwright writes outputs under:

- `test-results/`
- `playwright-report/`

Typical files to review:

- `error-context.md`
- `test-failed-1.png`
- `video.webm`
- `trace.zip`
- `smoke-full-export-paths` (Playwright text attachment containing exported file names and save paths)

Export behavior note:

- Playwright captures downloads programmatically via download events and `saveAs(...)`.
- Manual interaction with OS-level Save dialogs is not required for automated runs.

Open trace after a failure:

```powershell
npx playwright show-trace test-results\<failure-folder>\trace.zip
```

Open HTML report:

```powershell
npx playwright show-report
```

## Release Tagging Rule (When Closing a Release)

1. Use the exact commit that passed the final required release test suites as the release tag target.
2. Do not introduce additional code commits between final verification and tagging.
3. If additional commits are required, rerun required release suites and tag the newly validated commit.
4. Include tag reference plus test evidence links in release notes/PR.

## Suggested Human Review Flow

1. Run `QSMOKE-01`.
2. If green, run `smoke-full`.
3. If `smoke-full` fails, triage only the first failure block first.
4. Patch that blocker and rerun same target.
5. Once stable, run `regression` before merge.

## Operator Notes Template

Copy this into PR notes or issue comments:

- Date/time:
- Suite:
- Command used:
- Result:
- First failing step (if any):
- First failing locator/stack line:
- Artifact folder:
- Key hypothesis:
- Fix applied:
- Verification rerun result:
