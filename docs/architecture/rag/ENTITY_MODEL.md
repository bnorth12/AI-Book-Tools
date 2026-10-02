# Entity Model — Shared Knowledge Graph v0.1

**Schema:** `schema/knowledge-graph-0.1.json`  
**Shared types (ONLY):** `EvidencePack` (retrieve contract), `ReferenceDoc` (graph entity)  
**Domain tags:** every entity SHOULD carry `domain: "fiction" | "nonfiction" | "shared"` so tools can filter without forking the KB.

**Canonical lock (2026-09-16):** Fiction Phase 0 KB entities are **only** `Character`, `PlotBeat`, `Motif`, `StyleExemplar`. Chapters, quality findings, and project goals are **not** Phase 0 graph nodes — see [§7 Later / non-KB](#7-later--non-kb-engineering-lock-2026-09-16).

Ping Engineering before introducing any new shared type or cross-domain field name.

---

## 1. Shared types (fiction + nonfiction)

### ReferenceDoc

Cross-domain citation / note / domain fact / safety source. **The only shared document entity** — do not alias as Citation, SourceNote, etc.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable project-local id |
| `kind` | enum | `citation` \| `note` \| `domain` \| `safety` |
| `title` | string | Optional short label |
| `text` | string | Body / excerpt usable in EvidencePack |
| `provenance` | object | `{ source, url?, retrievedAt?, author? }` |
| `domain` | enum | `fiction` \| `nonfiction` \| `shared` |
| `tags` | string[] | Free tags (genre, herb family, chapter, etc.) |

**Typical edges:** `SUPPORTS` → any Phase 0 KB entity

### EvidencePack

Not a graph node — the **retrieve contract object** produced locally and passed to remote generation. See [EVIDENCE_PACK.md](./EVIDENCE_PACK.md) and `schema/evidence-pack-0.1.json`.

Query facets (not graph nodes) commonly include `filters.chapter`, `filters.projectGoal`, character/theme/safety filters.

---

## 2. Fiction-only entities (Phase 0 KB — four types)

Tagged `domain: "fiction"`. Herbal tools ignore these.

### Character

| Field | Type | Notes |
| --- | --- | --- |
| `id`, `name` | string | |
| `role` | string | protagonist, antagonist, support, etc. |
| `voiceCard` | object | `{ lexicon[], cadence, tabooPhrases[], emotionalBaseline }` |
| `arcSummary` | string | |
| `chapters` | number[] | Optional **chapter facet** (not a `ChapterNode` edge target) |

**Edges:** `RELATES_TO` → Character; `MOTIVATED_BY` → PlotBeat. Chapter presence = facet / retrieve filter (`filters.chapter`), not `APPEARS_IN` → ChapterNode.

### PlotBeat

| Field | Type | Notes |
| --- | --- | --- |
| `id`, `label` | string | |
| `arcStep` | string | setup, turn, climax, payoff, etc. |
| `stakes` | string | |
| `payoffStatus` | enum | `open` \| `paid` \| `abandoned` |
| `chapter` | number | Optional **chapter facet** |

**Edges:** `PRECEDES` → PlotBeat; `ADVANCES` → PlotBeat (subplot). Chapter placement = facet, not `IN_CHAPTER` → ChapterNode.

### Motif

| Field | Type | Notes |
| --- | --- | --- |
| `id`, `label` | string | |
| `imageryTokens` | string[] | |
| `overuseThreshold` | number | Soft cap for repetition signals |
| `chapters` | number[] | Optional **chapter facet** |

**Edges:** `ECHOES` → Motif. Recurrence by chapter = facet / retrieve filter, not `RECURS_IN` → ChapterNode.

### StyleExemplar

| Field | Type | Notes |
| --- | --- | --- |
| `id`, `title` | string | |
| `excerpt` | string | |
| `voiceTags` | string[] | |
| `sourceRef` | string | Optional id of a `ReferenceDoc` |

**Edges:** `INFORMS` → Character / PlotBeat / Motif (or other Phase 0 entities). Project / chapter **intent** is a query facet (`filters.projectGoal`, `filters.chapter`) or `meta` on the edge — not a `ProjectGoal` / `ChapterNode` target.

Also usable by nonfiction for domain exemplars (e.g. herbal safety/style prose) when tagged appropriately — entity type stays `StyleExemplar` (no parallel type).

---

## 3. Nonfiction entities (HerbalBookForge)

Tagged `domain: "nonfiction"`. Fiction tools ignore these unless explicitly browsing shared KB.

### Taxon

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | |
| `scientificName` | string | |
| `commonNames` | string[] | |
| `family` | string | Botanical family |

**Edges:** `HAS_PREP` → Preparation; `CITED_IN` → ReferenceDoc

### Preparation

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | |
| `method` | string | tea, tincture, poultice, etc. |
| `partUsed` | string | leaf, root, bark, etc. |
| `notes` | string | |

**Edges:** `FOR_TAXON` → Taxon; `SAFETY` → SafetyTopic

### Contraindication

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | |
| `severity` | enum | `low` \| `moderate` \| `high` \| `critical` |
| `population` | string | pregnancy, children, etc. |
| `evidenceRefs` | string[] | Prefer `ReferenceDoc` ids |

**Edges:** `APPLIES_TO` → Taxon / Preparation

### SafetyTopic

| Field | Type | Notes |
| --- | --- | --- |
| `id`, `label` | string | |
| `kind` | string | interaction, dosage, allergy, etc. |

**Edges:** `DOCUMENTED_BY` → ReferenceDoc

Safety / domain citations also use shared `ReferenceDoc` with `kind: "safety"` or `kind: "domain"` — **do not** invent a second citation type.

---

## 4. Edge vocabulary (v0.1 Phase 0 KB)

| Edge type | From → To | Domain |
| --- | --- | --- |
| `SUPPORTS` | ReferenceDoc → any Phase 0 entity | shared |
| `RELATES_TO` | Character → Character | fiction |
| `MOTIVATED_BY` | Character → PlotBeat | fiction |
| `PRECEDES` | PlotBeat → PlotBeat | fiction |
| `ADVANCES` | PlotBeat → PlotBeat (subplot) | fiction |
| `ECHOES` | Motif → Motif | fiction |
| `INFORMS` | StyleExemplar → Character / PlotBeat / Motif (+ `meta.chapter` / project intent facet) | fiction (+ domain exemplars) |
| `HAS_PREP` | Taxon → Preparation | nonfiction |
| `CITED_IN` | Taxon → ReferenceDoc | nonfiction |
| `FOR_TAXON` | Preparation → Taxon | nonfiction |
| `SAFETY` | Preparation → SafetyTopic | nonfiction |
| `APPLIES_TO` | Contraindication → Taxon / Preparation | nonfiction |
| `DOCUMENTED_BY` | SafetyTopic → ReferenceDoc | nonfiction |

**Dropped from Phase 0 edge enum** (were chapter/goal/finding-node edges): `APPEARS_IN`, `IN_CHAPTER`, `RECURS_IN`, `CONTAINS`, `GUIDES`, `ABOUT`. Use chapter / projectGoal **query facets** instead.

Edges are stored as `{ id?, type, from, to, meta? }` on the graph document.

---

## 5. Graph document shape

```json
{
  "schemaVersion": "0.1",
  "projectId": "string",
  "entities": [ /* typed objects with entityType discriminator */ ],
  "edges": [ { "type": "SUPPORTS", "from": "id", "to": "id" } ],
  "meta": { "createdAt": "", "updatedAt": "", "sourceTool": "" }
}
```

`entityType` discriminator values (Phase 0 KB):

`Character` | `PlotBeat` | `Motif` | `StyleExemplar` | `ReferenceDoc` | `Taxon` | `Preparation` | `Contraindication` | `SafetyTopic`

---

## 6. Fiction vs nonfiction filter

| Consumer | Sees by default |
| --- | --- |
| NovelWriter / BookDecomposer / fiction BookEditor | `domain` in `fiction`, `shared` |
| HerbalBookForge | `domain` in `nonfiction`, `shared` |
| Shared KB APIs | All; callers pass domain filter |

One store; filter at retrieve time. Never duplicate into a second KB.

---

## 7. Later / non-KB (Engineering lock 2026-09-16)

These names may appear in quality-editor or NovelWriter structure docs as **future** persistence. They are **not** Phase 0 `entityType` values and MUST NOT appear in `knowledge-graph-0.1.json` / `evidence-pack-0.1.json` enums.

| Name | Disposition |
| --- | --- |
| `ChapterNode` | NovelWriter structure later; chapters = **retrieve facets only** (`filters.chapter`, optional `chapter` / `chapters` on entities). Not graph nodes. |
| `QualityFinding` | Quality-editor phase (later). Signal docs remain in [EDITOR_SIGNALS.md](./EDITOR_SIGNALS.md); persistence may be session export / later store — **not** a Phase 0 KB entityType. |
| `ProjectGoal` | Tagged **query facet** (`filters.projectGoal` / outline intent text), not a graph node. |

Do not re-add these to Phase 0 schemas without a new Engineering mediation lock.
