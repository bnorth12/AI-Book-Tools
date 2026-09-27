# Book Tools universal contract checklist

**Status:** tracking (docs only)  
**Date:** 2026-09-27  
**Owners:** Fiction — NovelWriter, BookEditor, BookDecomposer; Nonfiction — HerbalBookForge; shared KB contracts with Engineering as needed.

## Rules (standing)

1. **Separate codebases** — each app stays its own tree (`NovelWriter/`, `BookEditor/`, `BookDecomposer/`, `HerbalBookForge/`). No mega-merge.
2. **Universal concepts** — digests/packets, RAG → EvidencePack, quality / human readability / no AI-slot, provider modes. Same meaning in every tool.
3. **Vendored copies only** — if helpers are shared in spirit, **each tool keeps its own copy**. No runtime import from a central `shared/` package for these contracts.
4. **One shared KB schema** — do not fork two knowledge bases; fiction vs herbal = different entity lenses on the same graph contracts (Phase 0 locks).
5. **Runtime host** — live pages serve from `C:\NovelWriterSite` on BNLaptop (future RPi); GitHubRepos is source. Deploy/sync after merges.

Related: Phase 0 RAG docs (`docs/architecture/rag/` when landed), NW packing matrix / PR #117, models/routing PR #118, `EVIDENCEPACK_PACKING_POLICY.md` / story-framing packs.

## Contract columns (apply to every tool)

| ID | Concept | Done when |
| --- | --- | --- |
| C1 | **Token digests / no full-book dump** | LLM user payloads use digests/packets; no `chapters.join` / full manuscript / full cast+subplot essays on hot paths |
| C2 | **RAG hooks** | Documented retrieve → EvidencePack injection points; feature-flagged; empty pack = current behavior |
| C3 | **Quality / no AI-slot** | Human readability + interest + human-vs-AI pattern checks exist as a gate or critique path (local heuristics and/or packed LLM judge) |
| C4 | **Provider / paste-bridge ready** | Not permanently hardcoupled to a single key UX; path toward `mode: none` / paste-bridge / Bot without rewriting prompts |
| C5 | **Vendored contract copy** | Digests/pack/quality helpers (when present) live **inside that tool**; twin of another tool is a copy, not an import |

## Per-tool matrix

Update status only: `not started` · `in progress` · `done` · `n/a` (with note).

| Tool | Owner | C1 Digests | C2 RAG hooks | C3 Quality / no AI-slot | C4 Provider | C5 Vendored copy | Notes / PRs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **NovelWriter** | Fiction | in progress (#117) | not started (hooks documented; runtime gated) | not started (editor signals documented) | not started (xAI Tab 1 key) | in progress (digests in `NovelWriter.html`) | Token packing PR #117; models #118 |
| **BookEditor** | Fiction | not started (full-upload patterns) | not started | not started | not started | not started | Kill full-book upload first |
| **BookDecomposer** | Fiction | not started (API paths) | not started (Phase 2 ingest candidate) | n/a for ingest-only; apply when LLM called | not started | not started | Prefer graph export + slim LLM calls |
| **HerbalBookForge** | Nonfiction | not started (herbal packet shape) | not started (Phase 5; safety/citations lens) | partial (safety/quality sprints; not universal C3 yet) | not started | not started | Evidence/safety packets ≠ story arcs; same C1–C5 shape |

## Tool touch lists (must visit each)

### NovelWriter (Fiction)

- [ ] C1 — Merge/verify digest packing on generate/update/critique/breakdown/continuity (#117); smoke asserts no full-manuscript join
- [ ] C1 — Auto-test smoke button (cheap) + optional workflow tier
- [ ] C2 — Wire EvidencePack into top hooks when KB flag on (`generateChapter`, continuity, critique)
- [ ] C3 — Quality / human-vs-AI pass on chapter or book critique path
- [ ] C4 — Provider adapter / paste-bridge (shared concept, local NW UI)
- [ ] C5 — Keep helpers inside `NovelWriter.html` (or NW-local file only)

### BookEditor (Fiction)

- [ ] C1 — Inventory LLM call sites; replace full manuscript / full novelData dumps with digests
- [ ] C2 — RAG consume hooks (edit/critique), vendored pack builder
- [ ] C3 — Quality / no AI-slot on edit suggestions
- [ ] C4 — Align model list + multi-agent routing with suite (#118); then paste-bridge
- [ ] C5 — Local copies of digest/pack helpers (port from NW, do not import)

### BookDecomposer (Fiction)

- [ ] C1 — Slim `callGrokAPI` payloads (digests of chunks/context, not whole book every step where avoidable)
- [ ] C2 — Optional graph / ReferenceDoc emit compatible with Phase 0 schema (ingest)
- [ ] C3 — Only where LLM rewrites prose; skip for pure structure extract if no generation
- [ ] C4 — Model/provider alignment (#118 done for dropdown); paste-bridge later
- [ ] C5 — Helpers in `BookDecomposer.js` only

### HerbalBookForge (Nonfiction)

- [ ] C1 — Herbal **evidence/safety digests** (claims, citations, contraindications) — not fiction arc digests
- [ ] C2 — Same KB retrieve contracts; domain filter `nonfiction` / safety kinds
- [ ] C3 — Readability + no AI-slot **and** safety/factual gates (herbal-specific bar)
- [ ] C4 — Provider / paste-bridge; multi-agent Responses routing already aligned (#118)
- [ ] C5 — Vendored copies inside HBF; coordinate with Fiction on contract text only

## Acceptance for “we touched every tool”

- [ ] This matrix has no silent blanks — every cell is `not started` / `in progress` / `done` / `n/a`+note
- [ ] Each tool has at least one GitHub issue (or linked PR) referencing C1–C5
- [ ] NW C1 smoke exists and BE/BD/HBF either have a twin smoke or an explicit deferred issue
- [ ] No tool gains a runtime dependency on another tool’s folder for these helpers

## Out of scope here

- Implementing Phase 1 `shared/kb` runtime (separate go-ahead; if code is reused, **copy** into each consumer)
- Merging HTML apps
- New Phase 0 KB entityTypes
