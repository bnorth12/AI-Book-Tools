# NovelWriter — Multi-pass quality editing (QE5)

**Status:** implemented 2026-09-27 in `NovelWriter/NovelWriter.html`

## What it does

After the first auto-revise (QE2 gate-fail) or after Tab6 apply-staged (QE3), NovelWriter may run a **second targeted pass** when:

| Trigger | Pass kind |
| --- | --- |
| Heuristics gate still failing | `gate-fail` |
| Chapter continuity findings / tracker risks | `continuity` |
| Residual staged improvement notes (after apply-staged) | `residual-staged` |

## Caps & fail-closed

- `NW_QUALITY_REVISE.maxAutoPasses = 2` (hard cap on auto revise/apply passes)
- Fail-closed driver remains **heuristics** (`runQualityGate`)
- `reviseOnJudgeAdvisory` stays **false** (LLM judge advisory only; QE4 unchanged)

## Logging

- Each attempt appends to `novelData.qualityReviseLog` with `pass` + `kind` (+ `multiPass: true` for targeted passes)
- Parallel trail: `novelData.qualityMultiPassLog` / `lastQualityMultiPass` so reports can show **pass1 → pass2**
- Quality samples labeled `chapterN-afterMultiPass2` when the continuity/residual path runs

## API

- `getChapterContinuityFindings(chapterNum)`
- `buildContinuityReviseBrief(chapterNum)`
- `needsQualityMultiPass(chapterNum, gate, ctx)`
- `runTargetedQualityPass(chapterNum, gate, { pass, kind })`
- Wired from `ensureQualityAfterGenerate` and `applyStagedChapterImprovements`

## Smoke

Tab1 **QE5 Multi-Pass Smoke** — offline structure asserts (cap, continuity brief, need/cap logic, multipass log).
