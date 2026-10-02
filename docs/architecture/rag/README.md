# Architecture — RAG / Shared Knowledge Layer

Phase 0 contracts for a **single shared GraphRAG-style KB** used by fiction (NovelWriter, BookEditor, BookDecomposer) and nonfiction (HerbalBookForge).

**Status:** Docs + schemas only — **no runtime behavior change**.  
**Locked mediation:** 2026-09-16 — Fiction Phase 0 KB: `Character`, `PlotBeat`, `Motif`, `StyleExemplar`; shared: `EvidencePack` + `ReferenceDoc`; nonfiction: `Taxon`, `Preparation`, `Contraindication`, `SafetyTopic`. Later/non-KB: `ChapterNode`, `QualityFinding`, `ProjectGoal`. Domain tags; local retrieve / remote generate; `kbEnabled` ⊥ provider.

## Index

| Doc | Purpose |
| --- | --- |
| [PHASE0_CONTRACT.md](./PHASE0_CONTRACT.md) | Goals, non-goals, ownership, schema policy, acceptance |
| [ENTITY_MODEL.md](./ENTITY_MODEL.md) | Fiction, nonfiction, and shared entities + edges |
| [EVIDENCE_PACK.md](./EVIDENCE_PACK.md) | Local retrieve pack shape, budgets, expand/narrow |
| [EDITOR_SIGNALS.md](./EDITOR_SIGNALS.md) | Quality signals ↔ quality_judge; findings persistence later/non-KB |
| [SOURCE_ORG.md](./SOURCE_ORG.md) | Source organisation, storage, indexing, retrieval |

## Schemas (repo root `schema/`)

| File | Purpose |
| --- | --- |
| `schema/knowledge-graph-0.1.json` | Graph document JSON Schema (draft-07) |
| `schema/evidence-pack-0.1.json` | EvidencePack JSON Schema (draft-07) |
| `schema/samples/rag/minimal-graph.json` | Tiny fiction + nonfiction demo graph |
| `schema/samples/rag/minimal-evidence-pack.json` | Minimal EvidencePack fixture |

## Roadmap

- `docs/roadmap/RAG_IMPLEMENTATION_TODO.md` — Phases 0–5 checklist

## Rules of thumb

1. Do **not** fork a second KB for fiction vs herbal.
2. Do **not** add shared types without Engineering ping.
3. Do **not** send full KB / full session dumps to the LLM — EvidencePack only.
4. Phase 1+ `shared/kb/` implementation requires explicit go-ahead (Cloud Agents unavailable on current plan; docs pack is the Phase 0 deliverable).
