# Joint summary — book-schema 1.1 + paste-bridge (Book Tools)

**Date:** 2026-09-27 CT  
**Status:** Ready for CoS merge into backlog  
**Paths:** `/workspace/plans/book-schema-1.1/` (+ Phase 0 pack `/workspace/rag-phase0/`)

## Agreement (Fiction + Nonfiction)

1. **Additive book-schema-1.1** packages alongside `novel-schema-1.0` — do not break required `schemaVersion` + `novelData`.
2. **Layered memory:** L1 SeriesBible (durable) → L2 BookState (per-book) → L3 EvidencePack (ephemeral retrieve). Never default full manuscript / `chapters[]` / HBF `drafts[]` prose.
3. **Phase 0 KB lock intact:** shared `EvidencePack` + `ReferenceDoc` only; fiction Character/PlotBeat/Motif/StyleExemplar; nonfiction Taxon/Preparation/Contraindication/SafetyTopic. ChapterNode / QualityFinding / ProjectGoal stay non-KB (structure / editor / facet).
4. **Soft flags locked:** WorldRule/TimelineEvent → fiction-optional deferred (`continuityNotes` until Engineering mediates). SeriesBible / BookState / RetrievalHook / PasteBridgePacket = **1.1 document packages**, not new shared KB types — Engineering ping before any new shared type.
5. **Paste-bridge first:** `providerConfig.mode: "none"` default; shared `PasteBridgePacket` for NW/BE/BD + HBF; paid Grok Bot / grok.com / Copilot — **no extra xAI console key**.
6. **Fiction-first vertical** (Decomposer → EvidencePack → NW → BookEditor) before **HBF Phase 5** consume.

## HBF fold (Nonfiction)

| Layer | Map |
| --- | --- |
| L1 | Taxon, Preparation, Contraindication, SafetyTopic + ReferenceDoc (`kind` safety\|domain\|citation\|note) |
| L2 | goals, outlineSummary, draftSummaries[], openThreads, safetyReportSummary (not full draft dump) |
| L3 | EvidencePack; goalFacets += `safetyTopic` \| `taxonId` \| `preparationId` |

In-app without key: Setup (sans generate), Goals/outline edit, Preview, Safety review of pasted text, JSON I/O. Bridge: export L1+2 (+ optional L3) → Bot/Chat → paste `draftText` → validate offline. Contraindication.severity + evidenceRefs → ReferenceDoc ids; no medical-advice claims in generated copy.

## Ranked next (joint)

**P0:** Provider adapter design (`none` default) · kill full-upload → EvidencePack · BE schema-faithful export (strip apiKey) · paste-bridge playbook · packing policy  
**P1:** Multi-model-by-scope · layered memory v1 · land Phase 0 packs on `feat/rag-phase-0-docs` · HBF JSON → 1.1 nonfiction BookState + safety ReferenceDocs  
**P2 / Phase 5:** Ollama via same adapter · local herbal RAG · HBF consume after fiction prove-out

## Ask of CoS

Merge this pack into `shared/workstreams/ai-book-tools-eval-backlog.md`. Gate coding until Engineering reviews DESIGN. Runtime = separate go-ahead.
