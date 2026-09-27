# Next iteration — quality editing & review (NovelWriter)

Status: **1–6 implemented** (2026-09-27). Per-prompt cost in-product (Tab1 diagnostics) done.

## Why
Lean Tracked E2E now reports quality gate scores, heuristic samples, Ch1 `updateChapter` delta, book critique items, and continuity findings in the unified report. Existing review/edit paths still need product-strength improvements.

## Priority backlog

1. **Apply-critique loop** ✅ — turn `suggestBookImprovements` / chapter critique items into applied edits (or staged apply), not list-only.
2. **Fail-closed revise** ✅ — when `runQualityGate` fails, auto-revise once (or N) against failure reasons, then re-gate; keep fail-closed if still below thresholds.
3. **Chapter improvement application** ✅ — wire non-empty `chapterImprovements` into Tab6 edit flow; stop silent empty slots.
4. **Judge ↔ gate alignment** ✅ — heuristics = fail-closed driver; LLM judge = advisory + divergence log (`QUALITY_JUDGE_GATE.md`). `reviseOnJudgeAdvisory` default false.
5. **Multi-pass quality editing** ✅ — second targeted pass (continuity / still-fail / residual staged); cap `maxAutoPasses=2`; `qualityMultiPassLog` pass1→pass2 (`QUALITY_MULTI_PASS.md`).
6. **Per-prompt cost in-product** ✅ — Tab1 diagnostics table from `novelData.tokenUsage` + rate card (same as report).

## Related future (not this backlog)
- **Rich fixture Track B:** `NovelWriter/fixtures/rich-scifi-v1/` + `NW_E2E_FIXTURE` runner flag (stress E2E; lean stays default).
- Series concepts via RAG + knowledge graph (L1 SeriesBible / cross-book EvidencePack) — documented in `C2_RAG_HOOKS.md`.
- #120 C4 provider / paste-bridge; C5 remaining checklist items.
- Per-agent model tier selection (Tab1 today is single-model).

## Acceptance sketch (next slice)
- [x] Gate fail triggers at least one automated revise attempt with logged delta.
- [x] At least one book-critique item can be applied and re-scored (Apply / Apply Top Critique).
- [x] Unified report §5 documents multi-pass (pass1→pass2) + `qualityMultiPassLog` when present.
- [x] Offline smoke for revise path (QE 1/2/3 Smoke structure asserts).
