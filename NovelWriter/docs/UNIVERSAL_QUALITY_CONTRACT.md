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
| **ObligationCoverage** | Lightweight beat/name/location coverage vs chapter blueprint; fail-closed when spine obligations missing or short+low-coverage (not a token-success signal). Portable shape: `{ covered, total, ratio, hits[], misses[], words, passed, failures[] }` | `scoreObligationCoverage` / `assertObligationCoverageOrThrow` — **no** Editor impl |
| **EnrichReadiness / DensityFloors** | Fail-closed cast backstory+arc and subplot nuance floors; outline obligations (world/plot/character_named/conflict_resolution/subplot_named); Tab5 blocked until green. Not pad-to-N quotas. | `scoreCastDensity` / `scoreSubplotDensity` / `scoreOutlineObligations` / `scoreAdvanceToTab5Readiness` / `assertAdvanceToTab5ReadinessOrThrow` |
| **AgentSkill / SkillIO** | Declared per-agent inputs (binders), output validators, and ability text layered on system prompts. Portable catalog shape (`schemaVersion`, skill id, inputs[], output, stop). Runtime stays per-app. | `defaultSkillCatalog` / `packSkillInputs` / `validateSkillOutput` / `getSkillSystemPrompt` — **no** Editor impl yet |
| **StageSchema** | Per-tab/stage required vs optional fields (soft early, fail-closed later); bidirectional normalizeInbound/Outbound; alias map | `normalizeInbound` / `normalizeOutbound` / `validateAgainstStageSchema` / `schemaPromptLines` — NW-first; portable catalog shape |
| **SlopTellReport** | Tell-level anti-slop scores (cadence/stockMetaphor/hedgeStack/nameEcho/emotionLabel/overExplain/chapterEcho); revise-only multipass kind `anti-slop`; does **not** fail-close Quality gate until product opts in | `scoreSlopTells` / `buildAntiSlopReviseBrief` — NW-first; portable shape for Editor |
| **Multipass** | Cap (NW: `maxAutoPasses=2`); kinds `gate-fail` \| `continuity` \| `residual-staged`; log `qualityMultiPassLog[]` with `{chapter, pass, kind, passedBefore, passedAfter, ...}` | QE5 |

## Explicitly out of contract (NW-only / product UI)

- Tab1–Tab11 create-path UI, Agent Prompts manager, Fetch Authors, session import/export chrome.
- NovelWriter-specific digests packing into chapter prompts.
- Tracked E2E Playwright runner and plan-folder report filenames.

## Future suite / KG (document only — not implemented)

Likely eventual **multifunction suite** combining NovelWriter + BookEditor + BookDecomposer for reverse-engineer → rewrite → improve novels. Novel- and series-level knowledge graphs fit that path.

**Near term unchanged:** separate codebases; universal concepts via this contract; each tool keeps vendored copies; **no** central shared runtime. C2 remains **local EvidencePack only**. Series RAG/KG stays future documentation.

| Idea | Guidance |
| --- | --- |
| Suite | Product surface composed **over** contracts — not a shared library import graph |
| KG | Attaches to reverse-engineer → rewrite → improve; not required for create-path NW gate/revise |
| Boundaries | Unknown unknowns at suite edges (import units, decompose/recompose maps, cross-book identity) — do not over-abstract until a real consumer exists |

Do **not** merge apps or wire series KG in the current NovelWriter milestone.

## Unknown unknowns (do not over-abstract yet)

- **BookEditor:** imported manuscript units, selection-scoped edits, non-create bible — may need different continuity anchors and no `numCharacters` UI sync.
- **BookDecomposer:** decompose/recompose unit boundaries, chapter↔scene maps — gate/revise may apply per unit, not per NW chapter index.

When Editor/Decomposer adopt these seams, **vendored copies** of the score/gate/brief helpers are preferred over a shared package.

