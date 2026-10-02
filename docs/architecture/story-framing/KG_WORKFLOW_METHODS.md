# Knowledge graph + RAG methods for NovelWriter workflow

**Date:** 2026-09-27  
**Status:** methods design (docs only)  
**Question answered:** Is a knowledge graph useful here? **Yes — as the spine for retrieve, not as a second novel format.**

---

## 1. Why a graph (vs only prose fields)

NovelWriter already *implies* a graph:

| Implicit today | Explicit graph tomorrow |
| --- | --- |
| Characters with arcs | `Character` nodes |
| Story arc / general plot / chapter outlines | `PlotBeat` nodes + `PRECEDES` |
| Subplots | throughline tags / subplot edges |
| Continuity tracker (characterArcProgress, storyArcProgress) | progress edges + open thread list |
| Setting + style | `ReferenceDoc` / `StyleExemplar` |
| Motifs (not first-class yet) | `Motif` + `ECHOES` |

Conflicts and tensions are **edges and states**, which is exactly what graphs are good at:

```text
Character --OPPOSES--> Character
Character --CONSTRAINED_BY--> WorldConstraint (ReferenceDoc / deferred WorldRule)
PlotBeat --ESCALATES--> Conflict
PlotBeat --RESOLVES--> Conflict
Motif --ECHOES_IN--> PlotBeat
```

Prose fields alone force every prompt to re-paste the whole Tab 1–4 blob. A graph lets **local retrieve** build an EvidencePack of only the neighbors needed for this chapter.

---

## 2. Layered memory (already accepted) + graph

| Layer | Contents | Graph role |
| --- | --- | --- |
| **L1 SeriesBible** | Canon digest: world, cast, voice, standing conflicts | Stable nodes; rarely full-dump |
| **L2 BookState** | Rolling synopsis, openThreads, open conflicts/tensions, arc progress | Working set + statuses |
| **L3 EvidencePack** | Ranked excerpts from graph neighbors for *this* query | Retrieve only |

Rule (packing policy): **always L1+L2; retrieve L3; never default full `chapters[]`.**

---

## 3. Where graph + RAG plug into the *current* NW flow

Typical path: Tab1 story info → Tab2 characters → Tab3 subplots → Tab4 outlines → Tab5 generate → Tab6 edit → Tab7 critique → Tab8 integrate.

| Stage | Today (approx.) | With KG + RAG |
| --- | --- | --- |
| Tab1 suggestStoryArc / Plot / Setting | Stuff genre + style + sibling fields | Write/update L1 digest + seed PlotBeats / ReferenceDocs |
| Tab2 suggest/refine Characters | Dump story fields + blanks | Upsert Character nodes; link conflict hooks as edges |
| Tab3 Subplots | Dump cast + plot | Create throughline ids; cross-pressure edges |
| Tab4 Outlines | Large concatenated context | Emit ordered PlotBeats; tag throughlines; mark tension peaks |
| Tab5 generateChapter | Continuity packets + ~prior chapter slice | Query: chapter + characterIds + open conflictIds → EvidencePack |
| Tab5 continuityAudit | Tracker JSON | Diff graph statuses vs chapter text; flag unresolved conflicts |
| Tab6/7/8 revise/critique | Often large prose | Pack L1+L2 + retrieve affected beats/characters only |

**Highest-value first hooks (implement order when coding):**

1. `generateChapter` — EvidencePack inject (replaces “prior 1.2k only” as sole memory).
2. `continuityAudit` — conflict/tension/throughline checks in JSON.
3. `suggestCharacters` / `refineCharacters` — emit structured conflict hooks → graph.
4. `generateNovelOutlines` / `generateChapterOutline` — emit PlotBeat list alongside prose outlines.
5. Tab7 `suggestBookImprovements` — retrieve open conflicts / weak resolutions instead of full manuscript upload pattern.

---

## 4. EvidencePack query shapes (fiction)

```json
{
  "query": {
    "goal": "draft chapter 12 climax beat",
    "filters": {
      "chapter": 12,
      "characterIds": ["c_mira", "c_antagonist"],
      "throughlineId": "main",
      "conflictId": "cf_succession",
      "tensionFocus": "betrayal_reveal",
      "themes": ["loyalty"]
    }
  }
}
```

Excerpt `entityType` allow-list stays Phase 0: Character | PlotBeat | Motif | StyleExemplar | ReferenceDoc.

Conflict/tension text rides **inside** PlotBeat/Character excerpt payloads or L2 BookState — not as new entityTypes.

---

## 5. Prompt method (without rewriting HTML yet)

For each agent in Tab 11:

1. **System prompt** — keep craft role; add one normative line: “Honor active conflicts, open tensions, and throughline tags from the EvidencePack; do not invent resolutions for closed conflicts.”
2. **User message assembly** — replace free-form dumps with:
   - Block A: L1 digest (≤ ~800–1200 tokens combined with B)
   - Block B: L2 BookState (open conflicts/tensions/threads)
   - Block C: EvidencePack Layer3 (ranked)
   - Block D: task-specific payload (this chapter outline, improvement list, …)
3. **Paste-bridge** — same A–D as `PasteBridgePacket` when `providerConfig.mode: none`.

Document per-agent A–D matrix in `PROMPT_PACKING_MATRIX.md` (filled from workflow audit).

---

## 6. What NOT to do

- Do not fork a second “story KB” beside the shared Phase 0 graph.
- Do not add Conflict/Tension as shared `entityType` without Engineering.
- Do not treat knowledge graph as a replacement for readable Tab 1–4 fields — graph is the **index**; fields stay the author UI.
- Do not wait on vector DB — keyword + graph-neighbor retrieve is enough for Phase 1.

---

## 7. Success criteria (when runtime lands)

- Chapter draft requestLog shows EvidencePack summary (counts + top ref ids + conflictIds), not full Tab1–4 dump.
- Continuity audit can list open conflicts with no resolution beat.
- Author can filter “show me unresolved tensions for Mira’s arc” via retrieve (UI or paste-bridge).
- Same `shared/kb` module usable later by BookDecomposer extract and HBF Phase 5.
