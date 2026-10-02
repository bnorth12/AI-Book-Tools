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
