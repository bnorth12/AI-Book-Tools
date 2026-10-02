# NovelWriter quality attributes (QE6)

Status: **implemented 2026-09-27** in `NovelWriter/NovelWriter.html`.

## Fail-closed vs advisory

| Layer | Role | Notes |
| --- | --- | --- |
| `scoreProseQuality` heuristics | **Fail-closed driver** | Scores feed `runQualityGate` |
| `runQualityGate` | **Fail-closed** | Failures trigger revise / multipass |
| LLM `judgeProseQualityLLM` | **Advisory only** | Divergence logged; does not alone revise (`reviseOnJudgeAdvisory=false`) |
| Multipass | Cap `maxAutoPasses=2` | kinds: `gate-fail`, `continuity`, `residual-staged`, `anti-slop` (revise-only; never fail-closes the gate) |

## Attribute fields (0–100)

| Field | Higher means | Gate threshold (default) | Revise brief targets |
| --- | --- | --- | --- |
| `interest` | more engaging | `minInterest: 40` | sensory detail, specificity, rhythm |
| `readability` | easier craft clarity | `minReadability: 40` | sentence length, adverbs, paragraphs |
| `aiSlopRisk` | **more** slop (inverted) | `maxAiSlopRisk: 55` | stock/filler phrase purge |
| `humanLikeness` | more human | `minHumanLikeness: 50` | grounded observation |
| `consistency` | cast/timeline/world coherence | `minConsistency: 35` | named cast anchors, timeline |
| `flow` | rhythm / glue | `minFlow: 35` | transition stacks, short chops |
| `pacing` | beat density balance | `minPacing: 35` | rush vs stretch, dialogue balance |

## Wiring

- `buildQualityReviseBrief(gateResult)` → craft instructions per failing attribute (used by fail-closed revise).
- `buildContinuityReviseBrief(chapterNum)` → continuity risks + cast/world anchors + attribute snapshot.
- Tab1 **QE6 Attributes Smoke** asserts thresholds, slop detection, revise/continuity briefs.

## Out of scope here

- Series RAG / knowledge graph (future docs only).
- BookEditor / BookDecomposer implementations (see `UNIVERSAL_QUALITY_CONTRACT.md` for portable shapes only).
