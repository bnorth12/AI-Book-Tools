# book-schema-1.1 — docs pack

**Status:** joint draft ready for CoS merge (docs-only; no app code)  
**Repo:** `bnorth12/AI-Book-Tools`  
**Date:** 2026-09-27 ~00:12 CDT  
**Aligns with:** Phase 0 RAG lock (`/workspace/rag-phase0/`), CoS backlog P0 (`ai-book-tools-eval-backlog.md`), Fiction P0–P2 ranks (Book Tools channel)

This directory proposes an **additive** `book-schema-1.1` shared core (or optional package alongside `novel-schema-1.0`) so fiction trio + HerbalBookForge share workType, layered memory, provider policy, and EvidencePack hooks — without breaking `novel-schema-1.0` required keys.

---

## Owners

| Lane | Surfaces | Schema / memory ownership |
| --- | --- | --- |
| **Fiction** | NovelWriter, BookEditor, BookDecomposer | Fiction profile (`novelData` compat); L1 `SeriesBible`; L2 `BookState`; Phase 0 KB: Character, PlotBeat, Motif, StyleExemplar |
| **Nonfiction** | HerbalBookForge (HBF) | Nonfiction / HBF profile; L1 herbal entities + ReferenceDoc; L2 goals/outlines/draft summaries/safetyReport; Phase 0 KB: Taxon, Preparation, Contraindication, SafetyTopic |
| **Engineering** | Shared provider adapter / `callAI`; schema package land | Ping **before** any new shared type beyond `EvidencePack` + `ReferenceDoc` |
| **CoS** | Spend / admission | No extra xAI API tokens by default; paste-bridge first |

---

## Files in this pack

| File | Purpose |
| --- | --- |
| [BOOK_SCHEMA_1.1_DESIGN.md](./BOOK_SCHEMA_1.1_DESIGN.md) | Additive schema design: shared core, fiction + nonfiction profiles, layered memory, soft-deferred WorldRule/TimelineEvent |
| [PASTE_BRIDGE_PLAYBOOK.md](./PASTE_BRIDGE_PLAYBOOK.md) | First-class no-extra-key mode (`providerConfig: none`); shared `PasteBridgePacket` for HBF + fiction tools |
| [EVIDENCEPACK_PACKING_POLICY.md](./EVIDENCEPACK_PACKING_POLICY.md) | Always Layer1+2; retrieve Layer3; never default full `chapters[]`; herbal safety cites `ReferenceDoc kind=safety` |
| [NONFICTION_JOINT_SUMMARY.md](./NONFICTION_JOINT_SUMMARY.md) | ≤1 page joint summary for Book Tools channel (Fiction half **accepted** with soft flags) |

---

## Ranked backlog (joint Fiction + Nonfiction)

### P0 — no-extra-xAPI + continuity discipline

| # | Item | Owner |
| --- | --- | --- |
| F0.1 | Shared **provider adapter** spike design (`xai` \| `ollama` \| `external` \| `none`) — docs/design only for P0 | Engineering (+ Fiction lead) |
| F0.2 | Kill full-manuscript upload default → **EvidencePack** packing (Layer1+2 always; Layer3 retrieve) | Fiction |
| F0.3 | BookEditor **schema-faithful export** (close SCHEMA_AUDIT gaps vs novel-schema-1.0) | Fiction |
| N0.1 | **Paste-bridge** first-class: `providerConfig.mode: none` + playbook checklist | Nonfiction (pattern shared) |
| N0.2 | Ship / adopt **EvidencePack packing policy** (this pack) | Nonfiction + Fiction |

### P1 — product depth

| # | Item | Owner |
| --- | --- | --- |
| F1.1 | **Multi-model-by-scope** presets (outline / draft / continuity / copyedit / safety) | Fiction (+ Eng) |
| F1.2 | **Layered memory v1** in session JSON: SeriesBible + BookState + RetrievalHook | Fiction |
| F1.3 | Land Phase 0 RAG docs+schemas on `feat/rag-phase-0-docs` (no runtime) | Fiction / Eng |
| N1.1 | Map HBF project JSON → book-schema-1.1 **nonfiction BookState** + safety `ReferenceDoc`s | Nonfiction |
| N1.2 | Optional EvidencePack / referenceKb hooks on HBF export (still offline-valid) | Nonfiction |

### P2 — on-prem / scale (Fiction-listed + Nonfiction trail)

| # | Item | Owner |
| --- | --- | --- |
| F2.1 | Ollama OpenAI-compat endpoint in shared `callAI` | Engineering |
| F2.2 | Local RAG over chapter summaries / lore tags | Fiction |
| F2.3 | Series workspace (multi-book under one `seriesId`) | Fiction |
| F2.4 | Optional thin proxy later (avoid if Bot/Chat suffice) | CoS gate |
| N2.1 | Local RAG over herbal KB (Taxon/SafetyTopic + ReferenceDoc) | Nonfiction |
| **Phase 5** | HBF consume shared KB / EvidencePack **after** fiction-first vertical prove-out | Nonfiction |

---

## Hard locks (do not reopen in this pack)

- Phase 0 shared types **ONLY** `EvidencePack` + `ReferenceDoc`.
- Fiction KB: Character, PlotBeat, Motif, StyleExemplar.
- Nonfiction KB: Taxon, Preparation, Contraindication, SafetyTopic.
- Later / non-KB: ChapterNode, QualityFinding, ProjectGoal (facets only).
- Soft-deferred (no Phase 0 enum; **not** new shared types without Engineering): `WorldRule`, `TimelineEvent`.
- Do **not** break `novel-schema-1.0` required `schemaVersion` + `novelData`.
- Fiction vertical before HBF Phase 5 consume.

---

## Intended next step

1. Nonfiction posts [NONFICTION_JOINT_SUMMARY.md](./NONFICTION_JOINT_SUMMARY.md) to Book Tools.  
2. Engineering reviews [BOOK_SCHEMA_1.1_DESIGN.md](./BOOK_SCHEMA_1.1_DESIGN.md) before any JSON Schema land.  
3. Runtime stays untouched until explicit go-ahead (provider adapter / paste-bridge UI are separate coding tasks).
