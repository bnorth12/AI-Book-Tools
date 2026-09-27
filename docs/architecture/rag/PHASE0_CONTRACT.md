# Phase 0 Contract — Shared GraphRAG Knowledge Layer

**Status:** Locked (docs-only)  
**Date:** 2026-09-16 (America/Chicago)  
**Repo paths:** `docs/architecture/rag/*`, `schema/*-0.1.json`  
**Runtime impact:** None — contracts and schemas only; no app HTML/JS behavior change

---

## Engineering mediation (locked 2026-09-16)

| Rule | Decision |
| --- | --- |
| Paths | `docs/architecture/rag/*` and `schema/*-0.1.json` only for Phase 0 |
| Shared types | **ONLY** `EvidencePack` and `ReferenceDoc` — no aliases, no parallel types |
| Fiction entities (Phase 0 KB) | `Character`, `PlotBeat`, `Motif`, `StyleExemplar` only |
| Shared | `EvidencePack` (retrieve contract), `ReferenceDoc` (graph) |
| Nonfiction entities | `Taxon`, `Preparation`, `Contraindication`, `SafetyTopic` (+ shared `ReferenceDoc`) |
| Later / non-KB | `ChapterNode` (NovelWriter structure later; chapters = retrieve facets); `QualityFinding` (quality-editor phase); `ProjectGoal` (query/outline facet, not a graph node) |
| Knowledge base | **One shared KB**; domain tags (`fiction` \| `nonfiction`) distinguish use |
| Retrieve / generate | Local EvidencePack retrieve; remote LLM completes from pack only |
| Provider vs KB | `kbEnabled` is orthogonal to LLM provider / model selection |
| New shared types | **Ping Engineering before introducing any new shared type** |

Cloud Agents unavailable on current plan; Phase 0 deliverable is this docs + schema pack (Grok Build / local docs PR). Implementation of `shared/kb/` waits for explicit Phase 1 go-ahead (Pro/cloud or Grok Build).

---

## 1. Goals

| Layer | Contract | Notes |
| --- | --- | --- |
| Reference knowledge | Per-project store of citations, source notes, style exemplars, domain/story facts | Shared module used by fiction + nonfiction tools |
| Retrieve | Local EvidencePack of excerpts + graph neighbors | Prefer local retrieve; KB on/off orthogonal to LLM provider |
| Generate | Remote LLM complete using EvidencePack only (no silent full-KB dump) | Same pattern as MATM GraphRAG ideas |
| Quality editor | Interest, readability, human-vs-AI pattern detect/mitigate | BookEditor + in-tool review; NovelWriter Quality tab later |

---

## 2. Non-goals (Phase 0–1)

- No second knowledge base for fiction vs herbal.
- No schema-breaking changes to `schema/novel-schema-1.0.json` required fields (extensions are additive / optional).
- No major CSS redesign (owned by UI unification release).
- No server-side vector DB requirement for v1 (browser IndexedDB / project JSON pack is fine).
- No runtime HTML/JS changes in Phase 0 (docs + schemas only).

---

## 3. Shared platform rules

1. **One KB.** Fiction and nonfiction share the same store and APIs. Domain tags filter views; they do not fork storage.
2. **Shared types only:** `EvidencePack`, `ReferenceDoc`. Do not invent aliases (`CitationDoc`, `SourceRef`, etc.) or parallel packs.
3. **Local retrieve → remote generate.** Retrieval builds an EvidencePack locally (keyword + optional embeddings later). Generation prompts receive EvidencePack excerpts only, never a full project/KB dump.
4. **`kbEnabled` orthogonal to provider.** Turning the KB off yields an empty pack and falls back to current prompt-stuffing behavior, regardless of which LLM API is selected.
5. **Additive schemas.** `knowledge-graph-0.1.json` and `evidence-pack-0.1.json` are optional packages. Existing novel schema required fields stay intact.
6. **Engineering ping.** Before adding any new shared entity or field name used across fiction and nonfiction, coordinate via Engineering.

---

## 4. Tool ownership

| Surface | Owner | RAG / quality role |
| --- | --- | --- |
| NovelWriter | Fiction | Primary authoring; ingest planning entities into graph; attach EvidencePack to chapter generation; Quality tab |
| BookEditor | Fiction (+ shared) | Quality review UI; interest/readability/AI-pattern passes; import graph-enriched sessions |
| BookDecomposer | Fiction | Extract Character/PlotBeat/Motif/ReferenceDoc from manuscript into shared schema + graph pack |
| HerbalBookForge | Nonfiction | Same shared KB APIs; safety topics as ReferenceDoc kind + SafetyTopic entities; do not fork store |
| `shared/` | Shared | Future: `shared/kb/` JS modules (retrieve, pack, index) — not only CSS tokens |

---

## 5. Schema extension policy

- Keep `schema/novel-schema-1.0.json` as-is for required keys.
- Add **optional** additive package: `schema/knowledge-graph-0.1.json` + `schema/evidence-pack-0.1.json`.
- Optional `novelData` extensions (all optional; `additionalProperties` already allowed):
  - `novelIntent`, `chapterIntents[]`
  - `characterVoiceCards[]`, `characterMemoryPackets[]`
  - `continuityTracker`, `continuityFindings[]`, `chapterContinuityPackets[]`
  - `referenceKb` (project-local index metadata)
  - `qualityFindings[]`, `qualityGateSummary` (quality-editor phase / session export — later/non-KB; **not** a Phase 0 graph `entityType`)
- Coordinate conflicts with Nonfiction via Engineering before shipping shared field names.

---

## 6. Phase 0 acceptance

- [x] Docs under `docs/architecture/rag/` (including `SOURCE_ORG.md`)
- [x] Schemas under `schema/*-0.1.json` with `schemaVersion: "0.1"`
- [x] Sample fixtures under `schema/samples/rag/`
- [x] Roadmap checklist `docs/roadmap/RAG_IMPLEMENTATION_TODO.md`
- [x] Explicit "no fork KB" and ownership table
- [x] No changes to NovelWriter / BookEditor / HBF runtime HTML
- [x] MANIFEST lists every file + intended repo path + "no runtime behavior change"

---

## Related docs

- [ENTITY_MODEL.md](./ENTITY_MODEL.md)
- [EVIDENCE_PACK.md](./EVIDENCE_PACK.md)
- [EDITOR_SIGNALS.md](./EDITOR_SIGNALS.md)
- [SOURCE_ORG.md](./SOURCE_ORG.md)
- [README.md](./README.md)
