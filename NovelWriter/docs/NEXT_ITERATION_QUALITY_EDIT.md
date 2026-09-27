# Next iteration — quality editing & review (NovelWriter)

Status: **1–3 implemented** (2026-09-27, QE slice). Items 4–6 still open.

## Why
Lean Tracked E2E now reports quality gate scores, heuristic samples, Ch1 `updateChapter` delta, book critique items, and continuity findings in the unified report. Existing review/edit paths still need product-strength improvements.

## Priority backlog

1. **Apply-critique loop** ✅ — turn `suggestBookImprovements` / chapter critique items into applied edits (or staged apply), not list-only.
2. **Fail-closed revise** ✅ — when `runQualityGate` fails, auto-revise once (or N) against failure reasons, then re-gate; keep fail-closed if still below thresholds.
3. **Chapter improvement application** ✅ — wire non-empty `chapterImprovements` into Tab6 edit flow; stop silent empty slots.
4. **Judge ↔ gate alignment** — reconcile LLM judge vs heuristics (this run: heur gate PASS while LLM judge showed high slop / low human); decide which drives fail-closed vs advisory.
5. **Multi-pass quality editing** — optional second pass after continuity audit; record before/after in `qualitySamples` and unified report §5.
6. **Per-prompt cost in-product** — surface tokensByPrompt / est. $ in Tab1 diagnostics (report already has it).

## Related future (not this backlog)
- Series concepts via RAG + knowledge graph (L1 SeriesBible / cross-book EvidencePack) — documented in `C2_RAG_HOOKS.md`.
- #120 C4 provider / paste-bridge; C5 remaining checklist items.
- Per-agent model tier selection (Tab1 today is single-model).

## Acceptance sketch (next slice)
- [x] Gate fail triggers at least one automated revise attempt with logged delta.
- [x] At least one book-critique item can be applied and re-scored (Apply / Apply Top Critique).
- [ ] Unified report §5 shows generate → revise → final scores for edited chapters. (samples logged; report builder follow-up)
- [x] Offline smoke for revise path (QE 1/2/3 Smoke structure asserts).
