# NovelWriter C2 RAG hooks (#120)

**Status:** in progress on `feat/nw-token-packing`  
**Date:** 2026-09-27

## Scope of this slice (runtime)

- Feature flag: `kbEnabled` (default **OFF**), orthogonal to provider/model.
- Local retrieve builds an **EvidencePack** (`schemaVersion: "0.1"`) from **current project `novelData` only** (Character / PlotBeat / Motif / StyleExemplar digests).
- Inject when `kbEnabled` into: `generateChapter`, continuity audit path, book critique (`suggestBookImprovements`).
- Empty pack or `kbEnabled === false` → **identical** prompt behavior to today (no empty Evidence noise).
- Helpers vendored inside NovelWriter only (no central `shared/kb` import).

## Out of scope here / future (document only)

### Series concepts via RAG + knowledge graph

A **series** (multi-book bible, recurring cast, motifs, prior-book PlotBeats) becomes much more practical once:

1. Shared KB / GraphRAG retrieve is live (Phase 0 contracts already lock `EvidencePack` + `ReferenceDoc` + fiction entityTypes).
2. L1 **SeriesBible** digests can be retrieved across books into an EvidencePack (not only the active `novelData` session).
3. Expand/narrow UI can scope retrieve to `seriesId` / prior book facets.

Until that lands, NovelWriter must **not** pretend series continuity is solved by stuffing prior books into prompts. Document series as a **future capability** enabled by RAG+KG; do not hard-wire multi-book dumps into C2.

Related docs: `docs/architecture/rag/PHASE0_CONTRACT.md`, `docs/architecture/novelwriter-workflow-rag/RAG_HOOK_CANDIDATES.md` (L1 SeriesBible / L2 BookState / L3 EvidencePack).

## Hook checklist (this slice)

| Call site | When kbEnabled | Pack contents (project-local) |
| --- | --- | --- |
| `generateChapter` | inject after digests | Character cards, PlotBeat/subplot excerpts, StyleExemplar snippet, Motif if present |
| `runChapterContinuityAudit` | inject | prior-chapter digests as PlotBeat/continuity excerpts (still not full manuscript join) |
| `suggestBookImprovements` | inject | cast + beat digests already preferred; EvidencePack optional enrichment |

## C3 note (same PR slice)

Quality / no-AI-slot gate (`runQualityGate`) is separate from RAG. Series KG does not replace quality scoring.
