# NovelWriter — Judge ↔ Gate alignment (QE4)

**Status:** implemented 2026-09-27 in `NovelWriter/NovelWriter.html`

## Decision

| Role | Source | Effect |
| --- | --- | --- |
| **Fail-closed driver** | Heuristic `scoreProseQuality` → `runQualityGate` | Pass/fail; triggers auto-revise (QE2) |
| **Advisory** | `judgeProseQualityLLM` | Logged only; never flips `lastQualityGate.passed` by itself |

`NW_QUALITY_ROLES.reviseOnJudgeAdvisory` defaults **false**. When true, a heuristics-pass + judge-would-fail may trigger one optional revise (costly; off by default).

## Why

Lean E2E showed heuristics gate PASS while LLM judge scored high slop / low human on the same Ch1 sample. Heuristics are deterministic, cheap, and offline-capable — correct for fail-closed. LLM judge captures stylistic risk heuristics miss — correct as advisory + divergence signal.

## API

- `alignJudgeWithGate(gateResult, judgeScores)` → alignment object; stores `novelData.lastJudgeGateAlignment` + `judgeGateAlignments[]`
- `runJudgeAdvisoryAfterGate(text, gate, tabEl)` → judge + align
- `ensureQualityAfterGenerate` runs advisory judge on chapter 1 (or every chapter if `novelData.qualityJudgeEveryChapter`)

## Smoke

Tab1 **QE4 Judge↔Gate Smoke** — offline structure asserts (roles + diverge without flipping gate).
