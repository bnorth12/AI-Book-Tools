# Universal quality contract (portable shapes)

**Standing rule:** separate apps; universal concepts via contracts; each tool keeps its own **vendored copy**. **No** central shared runtime / cross-app imports.

This note lists **copy-ready seams** so a future BookEditor / BookDecomposer rework can stay narrow. Implementers copy shapes into their tree; they do not import NovelWriter.

## In contract (portable)

| Shape | Intent | NW reference |
| --- | --- | --- |
| **EvidencePack** | Local retrieve object only (`schemaVersion`, `query`, ranked `excerpts[]` with `refId`/`entityType`/`text`/`score`) | `buildEvidencePack` — **not** series KG |
| **Token ledger** | Book-level usage on session data: `prompt_tokens`, `completion_tokens`, `total_tokens`, `calls[]`, optional `prompt_tokens_details.cached_tokens` | `novelData.tokenUsage` + requestLog mirror |
| **Rate card / est. cost** | Optional display/report: input/output/cached USD per 1M | NW Tab1 diagnostics / Tracked E2E report |
| **Quality scores** | `{ interest, readability, aiSlopRisk, humanLikeness, consistency, flow, pacing, notes, meta? }` | `scoreProseQuality` |
| **Quality gate** | Heuristics **fail-closed**: `{ passed, failures[], scores, thresholds, driver:'heuristics' }` | `runQualityGate` |
| **Judge advisory** | LLM scores + alignment/divergence log; must not override fail-closed unless product opts in | `judgeProseQualityLLM` / `alignJudgeWithGate` |
| **Revise brief** | Text instructions derived from failures + attribute craft lines | `buildQualityReviseBrief` |
| **Continuity brief** | Continuity risks + cast/world anchors + attribute snapshot | `buildContinuityReviseBrief` |
| **Multipass** | Cap (NW: `maxAutoPasses=2`); kinds `gate-fail` \| `continuity` \| `residual-staged`; log `qualityMultiPassLog[]` with `{chapter, pass, kind, passedBefore, passedAfter, ...}` | QE5 |

## Explicitly out of contract (NW-only / product UI)

- Tab1–Tab11 create-path UI, Agent Prompts manager, Fetch Authors, session import/export chrome.
- NovelWriter-specific digests packing into chapter prompts.
- Tracked E2E Playwright runner and plan-folder report filenames.

## Unknown unknowns (do not over-abstract yet)

- **BookEditor:** imported manuscript units, selection-scoped edits, non-create bible — may need different continuity anchors and no `numCharacters` UI sync.
- **BookDecomposer:** decompose/recompose unit boundaries, chapter↔scene maps — gate/revise may apply per unit, not per NW chapter index.

When Editor/Decomposer adopt these seams, **vendored copies** of the score/gate/brief helpers are preferred over a shared package.
