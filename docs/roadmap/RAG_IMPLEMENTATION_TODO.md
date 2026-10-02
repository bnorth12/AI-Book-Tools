# RAG Implementation TODO

**Related:** `docs/architecture/rag/` · Plan: `plans/AI-Book-Tools-RAG-Phase0-GrokBuild.md`  
**Note:** Phase 0 is docs/schemas only — **no runtime behavior change**. Cloud Agents unavailable on current plan; implement Phase 1+ via Pro/cloud or Grok Build after explicit go-ahead.

Ping Engineering before any new shared type (only `EvidencePack` and `ReferenceDoc` are shared today).

**Phase 0 entityTypes:** Fiction — `Character`, `PlotBeat`, `Motif`, `StyleExemplar`; Shared graph — `ReferenceDoc`; Nonfiction — `Taxon`, `Preparation`, `Contraindication`, `SafetyTopic`. **Later / non-KB:** `ChapterNode`, `QualityFinding`, `ProjectGoal`.

---

## Phase 0 — Contracts & docs

- [x] `docs/architecture/rag/PHASE0_CONTRACT.md`
- [x] `docs/architecture/rag/ENTITY_MODEL.md`
- [x] `docs/architecture/rag/EVIDENCE_PACK.md`
- [x] `docs/architecture/rag/EDITOR_SIGNALS.md`
- [x] `docs/architecture/rag/SOURCE_ORG.md`
- [x] `docs/architecture/rag/README.md`
- [x] `schema/knowledge-graph-0.1.json`
- [x] `schema/evidence-pack-0.1.json`
- [x] `schema/samples/rag/minimal-evidence-pack.json`
- [x] `schema/samples/rag/minimal-graph.json`
- [x] This checklist
- [ ] Land docs PR on `main` (intended repo paths below); update `docs/README.md` index in-repo
- [ ] PR description states **no runtime behavior change**

**Acceptance:** Schemas validate; no-fork-KB + ownership explicit; no NW/BE/HBF HTML rewrites.

---

## Phase 1 — Shared KB core (feature-flagged)

- [ ] `shared/kb/` (or `shared/js/kb/`): index, retrieve, pack, expand/narrow (vanilla JS, browser-safe)
- [ ] Project-local persistence: IndexedDB and/or downloadable `.kb.json`
- [ ] Node-runnable unit tests for retrieve scoring (deterministic EvidencePack from fixture graph)
- [ ] `kbEnabled=false` → empty pack; generation falls back to current behavior
- [ ] Domain filter support (`fiction` / `nonfiction` / `shared`)

**Do not start without explicit go-ahead.**

---

## Phase 2 — Fiction ingest (BookDecomposer)

- [ ] Emit optional graph entities + ReferenceDocs into shared-schema-compatible export
- [ ] Fixture from `schema/samples/beyond-prepared-*.json` (or rag minimal-graph)
- [ ] Round-trip: decompose → graph pack → validate knowledge-graph-0.1
- [ ] No break of existing BookEditor novelData import

---

## Phase 3 — NovelWriter consume

- [ ] Build EvidencePack from character / blueprint / prior chapters / style exemplars
- [ ] Inject pack into `callAI` prompt (excerpts only)
- [ ] Minimal References / KB panel (list, add note, toggle KB)
- [ ] Recommend: narrow character / expand motif
- [ ] Smoke: request log shows pack summary (counts + top ref ids), not full dump
- [ ] Regression: UIU.NW.NF3 selectors stable

---

## Phase 4 — Quality editor

- [ ] Port quality_judge concepts in-browser (or remote judge with packed context only)
- [ ] Findings table, jump-to-chapter, severity, ack for export gate
- [ ] Human-vs-AI heuristic pass (local) + optional LLM explain
- [ ] Align with novel-quality multipass (draft → structural → voice → continuity)
- [ ] Feature-flagged; conservative thresholds

---

## Phase 5 — Nonfiction alignment (HerbalBookForge)

- [ ] HBF uses same `shared/kb` for citations / safety domain facts
- [ ] Safety retrieve via ReferenceDoc `kind=safety` + SafetyTopic entities (no separate KB)
- [ ] Field names agreed via Engineering
- [ ] Optional BookEditor factual/safety signals on shared quality-finding path (later/non-KB persistence — not Phase 0 KB entityType)

---

## Cross-cutting tests

- [ ] Schema: `npm run validate-json`; fixtures under `schema/samples/rag/`
- [ ] Unit: retrieve ranking, pack token trim, expand/narrow
- [ ] E2E: flag-gated Playwright — KB toggle; pack attached; findings render
- [ ] Governance: REQUIREMENTS IDs for NW/BE/BD RAG when implementing
- [ ] Cost: cap EvidencePack tokens; log pack size in requestLog

---

## Intended repo layout (copy from this pack)

```text
docs/architecture/rag/PHASE0_CONTRACT.md
docs/architecture/rag/ENTITY_MODEL.md
docs/architecture/rag/EVIDENCE_PACK.md
docs/architecture/rag/EDITOR_SIGNALS.md
docs/architecture/rag/SOURCE_ORG.md
docs/architecture/rag/README.md
docs/roadmap/RAG_IMPLEMENTATION_TODO.md
schema/knowledge-graph-0.1.json
schema/evidence-pack-0.1.json
schema/samples/rag/minimal-evidence-pack.json
schema/samples/rag/minimal-graph.json
```
