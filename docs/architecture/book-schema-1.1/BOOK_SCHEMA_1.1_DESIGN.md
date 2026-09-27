# book-schema-1.1 design (docs only)

**Status:** draft for Engineering review — no JSON Schema land without go-ahead  
**Additive:** must not break `novel-schema-1.0` required `schemaVersion` + `novelData`  
**KB lock:** shared types remain **only** `EvidencePack` + `ReferenceDoc`. SeriesBible / BookState / RetrievalHook / PasteBridgePacket are **1.1 document packages**, not Phase 0 KB entityTypes. Ping Engineering before any new shared type.

---

## Shared core (both workTypes)

```text
BookDocument-1.1 {
  schemaVersion: "1.1"          // or dual-write: keep 1.0 envelope + optional bookMeta
  workType: "fiction" | "nonfiction"
  seriesId?: string
  seriesBible?: SeriesBible     // L1 package
  bookState?: BookState         // L2 package
  retrievalIndex?: RetrievalIndex
  modelPolicy?: { task → role } // outline|draft|continuity|copyedit|safety → fast|mid|deep
  providerConfig: {
    mode: "xai" | "ollama" | "external" | "none"   // default "none" for paste-bridge path
    endpoint?: string
    modelHints?: object
  }
  // fiction profile keeps novelData for 1.0 compat
  // nonfiction profile maps HBF project fields into optional extension
  novelData?: object            // required when bridging from novel-schema-1.0
  nonfictionExt?: object        // HBF: goals, outlines, draftSummaries, safetyReport summary
  evidencePacks?: EvidencePack[]  // optional attached L3 packs (prefer retrieve, not embed all)
}
```

### SeriesBible (L1 — durable canon)

| Field | Fiction | Nonfiction |
| --- | --- | --- |
| seriesId, title, continuityVersion | yes | herb-lineage / series id |
| acceptedCanonSummary / goals | voice + locked plot facts | herbal goals + scope |
| characters[] / motifs[] / styleExemplars[] | Phase 0 entity refs | — |
| taxons[] / preparations[] / contraindications[] / safetyTopics[] | — | Phase 0 entity refs |
| continuityNotes | freeform; **not** WorldRule/TimelineEvent KB types | safety constraints narrative |
| spoilerTier / canonFlags | fiction | optional |

Soft-deferred (fields or notes only until Engineering mediates): `WorldRule`, `TimelineEvent`.

### BookState (L2 — per-book rolling state)

| Field | Notes |
| --- | --- |
| bookId, seriesId?, bookNumber?, workingTitle, status | outline \| draft \| revise |
| rollingSynopsis | short; never full MS |
| openThreads[] | plot or research threads |
| lastAcceptedCanon | pointer / hash into L1 |
| plotBeats[] | fiction; book-scoped Phase 0 PlotBeat refs |
| chapterSummaries[] | `{ id, title, summary, beatIds? }` — **structure refs, not ChapterNode KB entity** |
| voiceNotes / styleNotes | fiction |
| goals, outlineSummary, draftSummaries[], safetyReportSummary | nonfiction / HBF map |
| continuityTracker?, continuityFindings? | promote from NW runtime (today additionalProperties) |

### RetrievalIndex + RetrievalHook

- `RetrievalIndex`: local locators for summaries, lore tags, ReferenceDoc ids (IndexedDB later).
- `RetrievalHook`: `{ layer: L1|L2|L3, entityTypes[], goalFacets[], expandNarrow }` builds an `EvidencePack` for one turn.
- Goal facets fiction: `genre | chapterTheme | characterId | motifId | styleExemplarId`
- Goal facets nonfiction: `+ safetyTopic | taxonId | preparationId`
- `ProjectGoal` remains a **facet/tag**, not an entityType.

### QualityFinding

Deferred to editor phase (BookEditor). Not a 1.1 KB entityType.

---

## Fiction profile (`workType: fiction`)

1. Dual-compat: keep exporting/importing `novel-schema-1.0` envelope; add optional `bookMeta` / parallel 1.1 wrapper as Engineering prefers.
2. Promote NW `chapterContinuityPackets`, `continuityTracker`, `continuityFindings` into `BookState` (formal keys).
3. Phase 0 KB entities used for retrieval tagging only: Character, PlotBeat, Motif, StyleExemplar.
4. Vertical prove-out order: BookDecomposer extract → EvidencePack → NovelWriter draft → BookEditor quality signals — **before** HBF Phase 5 consume.

## Nonfiction profile (`workType: nonfiction`)

Owned by Nonfiction. Map HBF project JSON → `nonfictionExt` + BookState + SeriesBible herbal refs.

Suggested `nonfictionExt` (tool-local; not novelData required keys):

```text
nonfictionExt {
  goals: { mainGoal, contentTypes[], toneStyle, audience, length? }
  outlines?: object
  chapterOutlines?: [{ chapterId, title, annotation }]
  draftSummaries?: [{ chapterId, title, summary, lastUpdated }]  // not full draftText in BookState
  draftsRef?: "project-local"   // full prose stays in HBF project JSON / IndexedDB
  safetyReportSummary?: { scanScope, summary, flagCount, lastUpdated }
  revisionHints?: string[]
}
```

Phase 0 KB entities (domain `nonfiction`): Taxon, Preparation, Contraindication, SafetyTopic. Citations via shared `ReferenceDoc` only (`kind` safety|domain|citation|note). Contraindication.severity + evidenceRefs → ReferenceDoc ids. No medical-advice claims in generated copy. HBF Phase 5 consume waits on fiction-first vertical prove-out.

---

## Provider policy (docs)

| mode | Use |
| --- | --- |
| `none` | **Default for spend constraints** — paste-bridge to Grok Bot / grok.com / Copilot |
| `xai` | Existing in-app key path (opt-in) |
| `ollama` | Later on-prem; same adapter shape |
| `external` | Future OpenAI-compat |

`kbEnabled` remains orthogonal to provider (Phase 0 lock).

---

## Out of scope for this pack

Runtime code, vector infra, new shared KB types, WorldRule/TimelineEvent enums, QualityFinding schema land.
