# Source Organisation — Storage, Indexing & Retrieval

**Scope:** How reference sources and graph entities are organised, stored, and retrieved into EvidencePacks.  
**Shared types:** Sources surface as `ReferenceDoc` (and graph neighbors); packs are always `EvidencePack`.

---

## 1. Organisation principles

1. **One project-local KB** — citations, notes, domain facts, safety docs, and story/graph entities live in one store per project.
2. **Domain tags, not forks** — `fiction` / `nonfiction` / `shared` filter views; storage is unified.
3. **ReferenceDoc is the document unit** — manuscripts may produce many entities; external/web/user notes enter as `ReferenceDoc` with `kind` and `provenance`.
4. **Graph + text index** — entities/edges for neighbor walks; text fields for keyword (and later embedding) retrieve.
5. **Pack at the boundary** — nothing leaves the local store into an LLM prompt except via EvidencePack.

---

## 2. Source kinds (`ReferenceDoc.kind`)

| kind | Typical content | Consumers |
| --- | --- | --- |
| `citation` | Bibliographic quote, DOI/URL-backed excerpt | Fiction research; herbal citations |
| `note` | Author/editor working note | Both |
| `domain` | Domain fact (setting bible; botanical fact) | Filtered by domain tag |
| `safety` | Safety / contraindication evidence | HBF primary; BookEditor safety signals |

Provenance object SHOULD capture `source`, optional `url`, `retrievedAt`, `author` so packs can cite without re-fetching.

---

## 3. Storage (Phase 1 target; Phase 0 contract only)

| Backend | Role | Notes |
| --- | --- | --- |
| Project JSON graph pack | Portable `.kb.json` / graph document beside session export | Validates against `knowledge-graph-0.1.json` |
| Browser IndexedDB | Session-speed local index | Feature-flagged; same schemaVersion |
| In-memory index | Retrieve scoring for tests | Node-runnable pure functions |

**Non-goals for v1:** server-side vector DB, cross-project cloud sync, silent network scrape into prompts.

Export/import round-trip: graph document + optional EvidencePack fixtures under `schema/samples/rag/`.

---

## 4. Indexing fields

Minimum indexed text per entity (for keyword retrieve):

| entityType | Indexed fields |
| --- | --- |
| ReferenceDoc | title, text, tags, kind |
| Character | name, role, arcSummary, voiceCard.lexicon, chapters (facet) |
| PlotBeat | label, stakes, arcStep, chapter (facet) |
| Motif | label, imageryTokens, chapters (facet) |
| StyleExemplar | title, excerpt, voiceTags |
| Taxon | scientificName, commonNames, family |
| Preparation | method, partUsed, notes |
| Contraindication | population, severity |
| SafetyTopic | label, kind |

Chapter number and project/outline goal are **query facets** (`filters.chapter`, `filters.projectGoal`), not indexed as `ChapterNode` / `ProjectGoal` entities. Quality findings are quality-editor phase persistence (later / non-KB), not Phase 0 index rows.

Edges are not full-text indexed; they drive `graphPath` expansion after seed hits.

---

## 5. Retrieval pipeline (local)

```text
query (goal + filters + domain)
    → candidate seed hits (keyword / later embeddings)
    → optional neighbor expand along edges (bounded hop count)
    → rank + trim to tokenBudgetHint
    → EvidencePack { excerpts, graphPath, expandOrNarrow }
```

Constraints:

- Domain filter applied before ranking (fiction tools do not pull Taxon by default).
- Safety-aware queries prefer `ReferenceDoc` kind=`safety` and `SafetyTopic` neighbors.
- `kbEnabled=false` short-circuits to empty pack.
- No remote retrieve in v1; remote is generate-only from the pack.

---

## 6. Ingest paths (by tool)

| Tool | Writes into KB |
| --- | --- |
| BookDecomposer | Character, PlotBeat, Motif, ReferenceDoc from manuscript |
| NovelWriter | Planning entities (Character/PlotBeat/Motif/StyleExemplar), user notes as ReferenceDoc; chapter/project intent as retrieve facets |
| BookEditor | Optional note ReferenceDocs; quality findings persist later/non-KB (session export), not Phase 0 KB entities |
| HerbalBookForge | Taxon, Preparation, Contraindication, SafetyTopic, ReferenceDoc (safety/domain) |

All writers use the **same** schema types. Engineering mediation required before any new shared writer-facing type.

---

## 7. Lifecycle

1. **Create / import** — validate against knowledge-graph-0.1.
2. **Index** — rebuild local text index (Phase 1 module).
3. **Retrieve** — EvidencePack for a generation or review goal.
4. **Generate** — remote LLM sees pack excerpts only.
5. **Review** — Quality-editor findings (later / non-KB) may cite `evidenceRefs` back into Phase 0 graph ids + chapter facets.
6. **Export** — session + optional graph pack; still additive to novel-schema-1.0.

---

## 8. Related

- [PHASE0_CONTRACT.md](./PHASE0_CONTRACT.md)
- [ENTITY_MODEL.md](./ENTITY_MODEL.md)
- [EVIDENCE_PACK.md](./EVIDENCE_PACK.md)
