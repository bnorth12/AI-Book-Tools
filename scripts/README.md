# scripts

## NovelWriter detector smoke scripts (PR2)

These scripts resolve paths from their own checkout (`import.meta.url`), not from the caller's current directory. Use Node 20 or newer (per `package.json` `engines`). Install from the repository root:

```sh
npm ci
npm run test:e2e:install   # once, installs Chromium for the Playwright-based smokes
```

### Offline checks (no API key, no LLM calls)

```sh
node scripts/_smoke_slop_tells.mjs
node scripts/_smoke_b5_0_name_echo.mjs
node scripts/_smoke_nw_quality_html.mjs
NW_B4_PRECHECK_ONLY=1 node scripts/_b4_1a_inject_prove.mjs
```

On PowerShell, set the variable for the process first (`$env:NW_B4_PRECHECK_ONLY='1'`) and then run the Node command.

| Script | What it checks | Needs Chromium |
|---|---|---|
| `_smoke_slop_tells.mjs` | B1/B4 anti-slop tell detectors (`_nw_slop_tells_snippet.mjs`) against vendored annex chapters and the slop corpus | No |
| `_smoke_b5_0_name_echo.mjs` | B5-0 nameEcho stopword fix, before/after scoring of annex prose and B4 inject spans | No |
| `_smoke_nw_quality_html.mjs` | Loads this checkout's `NovelWriter/NovelWriter.html` and runs the C3 / QE1-6 in-page smokes plus anti-slop helpers; runs the in-page `_scoreNameEchoTell` (B5-0 function-word cases + HTML/snippet parity over `scripts/fixtures`); asserts the smokes leave `novelData` unchanged | Yes |
| `_b4_1a_inject_prove.mjs` with `NW_B4_PRECHECK_ONLY=1` | Loads the HTML, the vendored B3R seed and an inject span, and stops after the in-page detector precheck | Yes |

`_nw_slop_tells_snippet.mjs` is the shared ESM detector module imported by the two pure smokes; it is not run directly.

### Live B4-1A prove (spends LLM tokens)

Without `NW_B4_PRECHECK_ONLY=1`, `_b4_1a_inject_prove.mjs` runs the bounded anti-slop multipass against the live API:

```sh
node scripts/_b4_1a_inject_prove.mjs
```

It reads `XAI_API_KEY` (with `GROK_API_KEY` as a fallback) from the dotenv file named by `NW_ENV_FILE`, which defaults to the gitignored `secrets/xai.local.env`. Never commit that file. Do not run the live prove in CI unless a key is supplied on purpose. The offline smokes and the precheck do not need or print a key.

### Environment variables

| Variable | Default | Used by | Meaning |
|---|---|---|---|
| `NW_HTML_PATH` | `<repo>/NovelWriter/NovelWriter.html` | quality HTML smoke, B4 prove | HTML file under test |
| `NW_FIXTURES_DIR` | `<repo>/scripts/fixtures/nw_slop` | slop tells, B5-0, B4 prove | Vendored seed, annex chapters and inject spans |
| `NW_OUT_DIR` | `<repo>/out/nw-smoke` | all four | Report/evidence output (gitignored) |
| `NW_ENV_FILE` | `<repo>/secrets/xai.local.env` | B4 prove (live only) | dotenv file with the API key |
| `NW_E2E_SEED` | `<fixtures>/b3r_seed.json` | B4 prove | Seed `novelData` JSON |
| `NW_B4_PRECHECK_ONLY` | unset | B4 prove | Set to `1` for the offline precheck (no key, no LLM) |
| `NW_E2E_SLOP_INJECT_SPAN` | `span_b3r_ch2_overexplain.txt` | B4 prove | Span basename (under `inject_spans/`) or path |
| `NW_E2E_SLOP_INJECT_CHAPTER` | `2` | B4 prove | Target chapter for the injected span |
| `NW_E2E_SLOP_INJECT_AFTER_CONTINUITY` | `1` | B4 prove | Set to `0` to inject immediately instead of after continuity |

### Output

JSON reports go under `out/nw-smoke/` (for example `B1_SLOP_TELL_SMOKE_REPORT.json`, `B5_0_NAMEECHO_SMOKE.json`, `B4_1A_INJECT_PRECHECK.json`). `out/` is gitignored. The scripts never write into `plans/`, `NovelWriter/docs/`, or a deployed copy of the site.

## NovelWriter Tracked E2E runner and unified report (PR3)

`run-tracked-e2e.mjs` drives this checkout's `NovelWriter/NovelWriter.html` through the lean book flow in headless Chromium (Tab 1 story info, cast, subplots, outlines, two chapters with the quality gate, Tab 6 apply-staged and revise, Tab 7 critique and apply). It runs the fail-closed stage gates between stages and writes progress, status, JSON and a single-file Markdown report. `build_unified_report.py` turns the runner JSON and the `novelData` annex into that dated report. The builder makes no network or API calls.

### Offline by default (no key, no paid calls)

```sh
node scripts/run-tracked-e2e.mjs                 # offline fixture run, about 3 s
node scripts/_smoke_tracked_e2e_offline.mjs      # PR3 smoke: runner, guards, report builder, in-page runner
```

Without `NW_E2E_LIVE=1`, the runner:

- answers every `https://api.x.ai/` request in the browser through Playwright `page.route()`, using `_nw_e2e_offline_responder.mjs`. The responder builds deterministic replies from the vendored seed `fixtures/nw_slop/b3r_seed.json`;
- aborts every other http(s) request (for example web fonts) and lists them in `report.network.blockedRequests`;
- never reads `NW_ENV_FILE` or a key variable. The page gets the placeholder `offline-fixture-not-a-key`.

Token counts in offline reports are chars/4 estimates, and the report marks its cost lines as notional. Any prompt that no responder rule matches is recorded in `report.offline.unmatched`. The smoke fails if that list is not empty.

Some steps need page helpers that arrive with split PR1: the token rollup, enrich agents, Tab 5 readiness, the blueprint draft pack and World Bible packing. If the HTML lacks one of those helpers, the runner lists it in `report.config.missingHelpers` and skips only the gate or step that needs it, recording the skip in the progress log and the report. Set `NW_E2E_STRICT=1` to fail instead. When the page has no token rollup, the runner counts calls at the network layer.

Every step row (runner and in-page report) has a `status` of `pass`, `fail` or `skip`. A skipped step has `ok: null`, never `ok: true`, and is listed in `summary.skippedSteps`; only `fail` rows fail the run. `c1Smoke` is a skip when the page has no `runC1Smoke` helper and a FAIL when it returns `false`. A chapter step whose generation leaves the chapter text empty (for example after HTTP 500s) is a FAIL. Any page error fails the runner (step `pageErrors`, exit 2) except the known `updateChapterSubpages` requestAnimationFrame race (#130): only a `Cannot set properties of null` error whose top `NovelWriter.html` frame is that callback line is exempt, and those are counted in `report.knownPageErrors`.

The rate card in the report is picked by the requested model. Only `grok-4.3` (and the retired `grok-4-1-fast-non-reasoning` slug, which redirects to it) has a card; any other model is shown with an `unknown` card and no cost.

`maxTokens`: the PR3 split plan does not fix a value. The runner uses the product default of 6000 (override with `NW_E2E_MAX_TOKENS`). The in-page Tab 1 button uses 2000 on purpose, because it makes live paid calls and 2000 covers a 500-word chapter.

`_smoke_tracked_e2e_offline.mjs` checks:

- an offline run exits 0, with 0 unmatched prompts and all artifacts under `NW_OUT_DIR`;
- `git status` is unchanged after the run;
- `NW_E2E_LIVE=1` exits 3 under CI (`CI=true`, `CI=false` and `CI=on` all count) and exits 3 without a key. In every case the runner exits before a browser starts or any network request;
- a failing report build exits 4, marks the run `incomplete`, and `TRACKED_E2E_REPORT_LATEST.md` says `OK: false (INCOMPLETE ...)`;
- `c1Smoke` is recorded as `skip` when the helper is absent and as a FAIL (exit 2) when `runC1Smoke()` returns `false`;
- an unexpected page error fails the run (exit 2, step `pageErrors`);
- the builder survives structured `generalPlot`/`storyArc` values, an unknown `NW_REPORT_TZ` and a Windows zone name, labels an unpriced model `unknown`, and exits non-zero on missing inputs;
- the in-page `runTrackedE2E()` (Tab 1 button "Tracked E2E (lean, live)") completes against the same responder and reads usage from the session ledger. Cancelling its confirm leaves `novelData` unchanged with zero xAI requests; HTTP 500s on the chapter calls make both chapter steps FAIL; a `runC1Smoke()` that returns `false` makes `c1Smoke` FAIL.

The smoke writes `out/nw-e2e-smoke/SMOKE_TRACKED_E2E_OFFLINE.json`.

### Live run (spends LLM tokens; never in CI)

```sh
NW_E2E_LIVE=1 node scripts/run-tracked-e2e.mjs
```

On PowerShell, set `$env:NW_E2E_LIVE='1'` first. Live mode reads `XAI_API_KEY` (falling back to `GROK_API_KEY`) from the environment or from the dotenv file at `NW_ENV_FILE` (default: the gitignored `secrets/xai.local.env`). The runner exits 3 when `CI` or `GITHUB_ACTIONS` is set to any non-empty value (including `CI=false`, `CI=0` and `CI=on`; the value is never parsed), so a workflow cannot make paid calls even if it sets `NW_E2E_LIVE` or has a key. The check runs before the key is read and before a browser starts. The in-page Tab 1 button is a manual dev tool that uses the key typed into the page.

### Runner environment variables

| Variable | Default | Meaning |
|---|---|---|
| `NW_E2E_LIVE` | unset (offline) | `1` = real xAI calls. Refused (exit 3) when `CI` or `GITHUB_ACTIONS` is non-empty |
| `NW_HTML_PATH` | `<repo>/NovelWriter/NovelWriter.html` | HTML under test |
| `NW_OUT_DIR` | `<repo>/out/nw-e2e` | All runner and report artifacts (gitignored) |
| `NW_ENV_FILE` | `<repo>/secrets/xai.local.env` | dotenv file for the key (live only) |
| `NW_FIXTURES_DIR` | `<repo>/scripts/fixtures/nw_slop` | Seed and inject-span fixtures |
| `NW_E2E_OFFLINE_SEED` | `<fixtures>/b3r_seed.json` | Seed the offline responder answers from |
| `NW_E2E_STRICT` | unset | `1` = fail when PR1 page helpers are missing instead of skipping their gates |
| `NW_E2E_FIXTURE` | unset | Seed `novelData` loaded into the page before the run (relative to the repo) |
| `NW_E2E_ENRICH` / `NW_E2E_REGEN_BIBLE` | unset | Run the enrich / densify passes (PR1 helpers) |
| `NW_E2E_OUTLINE_ONLY` | unset | Stop after the outline proof (no prose) |
| `NW_E2E_CHAPTERS` / `NW_E2E_CHAPTER_CAP` | 2 / 4 | Chapters to generate (lean / fixture cap) |
| `NW_E2E_CHAPTER_LENGTH` / `NW_E2E_MAX_TOKENS` | 500 / 6000 | Product chapter length and max tokens |
| `NW_E2E_FORCE_MULTIPASS` | unset | Seed continuity plus a raised gate bar so the QE5 multipass fires |
| `NW_E2E_SLOP_INJECT` (+ `_SPAN`, `_CHAPTER`, `_AFTER_CONTINUITY`) | unset | Arm the B4-1A slop inject with a span from `<fixtures>/inject_spans/` |
| `NW_E2E_REPORT_BUILDER` | `scripts/build_unified_report.py` | Report builder script |
| `NW_PYTHON` | `py -3` on Windows, `python3` elsewhere | Interpreter for the builder |
| `NW_REPORT_TZ` | `America/Chicago` | IANA zone for the report filename stamp. Common US Windows names (`Central Standard Time`, `Eastern Standard Time`, `Mountain Standard Time`, `US Mountain Standard Time`, `Pacific Standard Time`, `Alaskan Standard Time`, `Hawaiian Standard Time`, `UTC`) are mapped to IANA. An unknown zone, or a missing zone database (on Windows, `pip install tzdata` fixes that), falls back to the machine's local zone and the builder prints a note |

Exit codes: `0` pass, `1` fatal, `2` a step failed (including unexpected page errors), `3` live mode refused or key missing, `4` the steps passed but the report build failed (run marked incomplete).

### Output (`NW_OUT_DIR`, default `out/nw-e2e/`)

- `TRACKED_E2E_REPORT_<YYYY-MM-DD_HHMMSS>.md` and `TRACKED_E2E_REPORT_LATEST.md`: the single-file report (summary, tokens and cost, quality, and annexes A-E with the full chapter prose)
- `TRACKED_E2E_REPORT.json`: steps, `tokensByPrompt`, `tokensByStage`, cost, mode, network and offline evidence
- `TRACKED_E2E_ANNEX_NOVELDATA.json`: sanitized `novelData`, with key fields removed
- `TRACKED_E2E_PROGRESS.md`, `TRACKED_E2E_STATUS.json` and `TRACKED_E2E_TOKENS_BY_STAGE.md`

Nothing is written to `NovelWriter/docs/`, the plans folder or a deployed copy of the site.
