# NovelWriter RAG Hook Candidates

**Locks respected (Phase 0):**
- Shared KB entityTypes ONLY: `Character`, `PlotBeat`, `Motif`, `StyleExemplar` + shared `EvidencePack`, `ReferenceDoc`
- Conflict / tension / resolution / throughline = **fields/relations on PlotBeat + Character** OR **L2 BookState** — do **not** invent new shared KB entityTypes without Engineering
- `kbEnabled` ⊥ provider; prefer **paste-bridge mode none** (EvidencePack injects into existing message arrays without new provider wiring)

**Layers:**
- **L1 SeriesBible:** characters digest, world digest, style exemplars, stable motifs
- **L2 BookState:** beats, open threads, active conflicts, chapter position, arc progress
- **L3 EvidencePack:** retrieved snippets (quotes, beat cards, motif hits) injected at call site

---

## Per call-site recommendations

### Tab 1

#### `fetchAuthors` / `fetchStyleGuide`
- **EvidencePack:** Optional StyleExemplar snippets for genre (fetchStyleGuide only).
- **L1 always:** none required for authors; for styleGuide — prior StyleExemplar if series continues.
- **L2 always:** N/A
- **Kill:** N/A (already lean)
- **Query facets:** `genre`, `authorId` / style key
- **Notes:** Good seed path to **upsert StyleExemplar** after fetchStyleGuide.

#### `suggestStoryArc` / `suggestGeneralPlot` / `suggestSetting` / `suggestStoryInfo`
- **EvidencePack inject:** After system prompt, before/alongside user template — short Motif + PlotBeat exemplars from series KB (if any); Setting call also world ReferenceDoc digests.
- **L1 always:** world digest (even stub), StyleExemplar summary (not full styleGuide dump if L1 has digest).
- **L2 always:** empty for brand-new book; if continuing series — prior BookState throughline summary only.
- **Kill:** Re-pasting entire styleGuide prose into every Tab1 call when L1 StyleExemplar digest exists; example-payload bloat in templates.
- **Query facets:** `genre`, `motif`, `seriesId`
- **CTR mapping:** Main conflict / stakes → PlotBeat fields (`conflict`, `tension`, `resolution` as beat properties) or L2 `openConflicts[]` — **not** new entityType.

---

### Tab 2

#### `scrapeBookInfoForCharacters`
- **EvidencePack:** Optional Character name aliases from L1 to reduce false positives.
- **L1/L2:** L1 Character roster names only.
- **Kill:** N/A (already selective)
- **Facets:** `chapter` N/A · `characterIds` (existing) · motif N/A
- **Post-hook:** Map scraped names → Character entities (Phase 0 OK).

#### `suggestCharacters`
- **EvidencePack:** Motif + PlotBeat cards tied to story; StyleExemplar voice for backstory prose.
- **L1 always:** Character digests for locked/complete cast (replace full JSON of locked chars with compact cards: name, role, goal, flaw, relationships).
- **L2 always:** planned beat skeleton if outlines exist later; else storyArc/plot **digests** not full blobs.
- **Kill:** **Full styleGuide + full storyArc + full generalPlot + full setting + full completeCharacters JSON** in one prompt — classic full-dump anti-pattern.
- **Facets:** `characterIds`, `motif`, `conflictId` (as PlotBeat id / BookState conflict key)

#### `refineCharacters`
- **EvidencePack:** Subplot-related PlotBeats + Motif hits.
- **L1 always:** Character cards being refined.
- **L2 always:** active subplot pressures / open threads from BookState.
- **Kill:** `JSON.stringify(novelData.characters)` + full subplot texts + full styleGuide.
- **Facets:** `characterIds`, `conflictId`, motif

---

### Tab 3

#### `suggestSubplots`
- **EvidencePack:** PlotBeat patterns for genre; Motif cards.
- **L1 always:** Character digest (not full backstories); world digest.
- **L2 always:** main conflict summary; chapter span targets.
- **Kill:** Full characters JSON + full styleGuide + full arc/plot/setting prose.
- **Facets:** `characterIds`, `motif`, `conflictId`
- **CTR:** Encode subplot conflict as PlotBeat relations / L2 `subplots[].pressure` — no Conflict entityType.

---

### Tab 4

#### `generateNovelOutlines`
- **EvidencePack:** Series Motifs; prior-book PlotBeat shapes (if series); StyleExemplar structural notes.
- **L1 always:** Character digests + world digest + StyleExemplar digest.
- **L2 always:** seed BookState from Tab1 (arc beat list); empty openThreads.
- **Kill:** Concatenating **all** characters + **all** subplot full texts + **three** possibly long existing outlines + full styleGuide in one shot.
- **Facets:** `motif`, `characterIds`, chapter range
- **Hook gold:** Response `chapterBlueprints` → **PlotBeat** entities (role, arcStep, allowedPayoffs, deferredThreads) + L2 BookState initialization.

#### `generateChapterOutline` / `updateChapterOutline`
- **EvidencePack:** Chapter-scoped PlotBeats; Character cards for named beats; Motif for thematic beats.
- **L1 always:** Characters appearing in blueprint.characterBeats; world digest.
- **L2 always:** this chapter’s blueprint + adjacent chapter deferred/allowed + openThreads.
- **Kill:** Re-sending all three macro outlines in full + all characters + all subplots every chapter.
- **Facets:** `chapter`, `characterIds`, `motif`, `conflictId`
- **Prefer:** Pass blueprint JSON + digests; retrieve EvidencePack for adjacent chapters only.

#### `incorporateOutlineSuggestions`
- **EvidencePack:** Optional Motif/PlotBeat for improvement themes.
- **L1/L2:** L2 current outline digests.
- **Kill:** If improvements reference characters, avoid pulling full cast unless needed.
- **Facets:** `motif`, `chapter` (if notes specify)

---

### Tab 5 — **highest priority hooks**

#### `generateChapter` (part1 + part2)
- **EvidencePack inject point:** Immediately after system message(s), as a dedicated user or system block labeled `EvidencePack` / paste-bridge — **before** long requirements list. Same pack for both passes; part2 may add “already written” local context only.
- **L1 always:**
  - Character digests for cast in this chapter (from blueprint/outline), not full backstories
  - World digest (locations/rules) — not full `setting` essay
  - StyleExemplar digest (replace ad-hoc authorStyle string drift)
- **L2 always:**
  - Current PlotBeat / blueprint for chapter N
  - `openThreads` / unresolved from continuity tracker
  - Active conflicts (BookState fields)
  - `prevChapterSummary` + `nextChapterIntent` (already in packet — keep)
  - storyArc progress beat (tracker)
- **Kill anti-patterns:**
  1. Full `JSON.stringify(characters)` with 200–250w backstories each
  2. All subplot full texts (packet already takes up to 8 full subplots)
  3. Full storyArc + generalPlot + setting essays every pass
  4. Part2 re-dumping all of the above **plus** entire part1 (keep part1; slim the rest)
  5. Duplicate arc text inside packet `storyArcAnchor` AND outer storyArc field
- **Query facets:** `chapter`, `characterIds`, `motif`, `conflictId`
- **Continuity packet evolution:** Treat packet as **L2 carrier**; trim `activeSubplots` to ids+1-line digests; keep `unresolvedThreads` + character states; inject EvidencePack separately for sensory/world quotes.

#### `continuityAudit` / `runContinuityAuditAll`
- **EvidencePack:** Prior chapter summaries (ReferenceDoc or PlotBeat notes), Motif continuity checks.
- **L1 always:** Character digests (states to verify against).
- **L2 always:** packet + prior unresolvedThreads + expected beats for chapter.
- **Kill:** Pasting **full chapter text + full plot + full storyArc + full characters** when audit only needs summary + risk checklist — prefer chapter text + L2 packet + L1 digests; retrieve EvidencePack for prior contradictions.
- **Facets:** `chapter`, `characterIds`, `conflictId`
- **Write-back:** Audit → update L2 BookState (`openThreads`, `characterArcProgress`, `storyArcProgress`, risks). Map risks onto PlotBeat.risk fields if present — still no Conflict entityType.
- **Bug/design note for RAG:** Global `characterArcProgress` is **overwritten** by last audit (L2388) — L2 merge strategy needed.

---

### Tab 6

#### `updateChapter`
- **EvidencePack:** Improvement-targeted Motifs/PlotBeats/Character quotes.
- **L1 always:** Characters mentioned in improvements + chapter.
- **L2 always:** chapter beat, open threads, conflict state.
- **Kill:** Full macro outlines ×3 + all characters + all subplots + styleGuide + long previous-chapter tail — worst mid-workflow dump after generateChapter.
- **Facets:** `chapter`, `characterIds`, `motif`, `conflictId`
- **Keep:** Current chapter + improvements + short prev context (existing trim is OK; maybe use packet summary instead).

#### `checkSpellingAndGrammar`
- **EvidencePack / L1 / L2:** None required.
- **Kill:** N/A
- **Facets:** N/A

---

### Tab 7

#### `suggestBookImprovements`
- **EvidencePack:** Motif underuse; Character arc gaps; PlotBeat payoff misses — retrieved, not full MS if possible.
- **L1 always:** Character + Motif digests; StyleExemplar.
- **L2 always:** beat map + openThreads + conflict ledger.
- **Kill:** **`fullBook` entire manuscript in prompt** — #1 token anti-pattern. Prefer chapter abstracts / EvidencePack sampling + L2 structure map; escalate to full text only for flagged ranges.
- **Facets:** `chapter` (multi), `characterIds`, `motif`, `conflictId`

#### `breakdownImprovement`
- **EvidencePack:** Chapter slices for cited chapters only.
- **L1 always:** referenced Characters.
- **L2 always:** affected PlotBeats.
- **Kill:** Sending all chapters when improvement cites a subset; full character/subplot dumps.
- **Facets:** `chapter`, `characterIds`, `conflictId`

---

### Tab 8

#### `integrateBreakdown`
- **EvidencePack:** Optional StyleExemplar + Character voice cards for revision fidelity.
- **L1 always:** Characters appearing in chapter.
- **L2 always:** target beats/conflicts for this chapter’s instructions.
- **Kill:** If multiple improvements, avoid re-attaching entire book — already chapter-scoped (good). Don’t expand to full outlines in LLM path (outline notes already local-append — keep that).
- **Facets:** `chapter`, `characterIds`, `motif`

---

## Cross-cutting anti-patterns to kill

| Anti-pattern | Where worst | Replacement |
|--------------|-------------|-------------|
| Full manuscript in prompt | `suggestBookImprovements` | L2 beat map + EvidencePack samples |
| Full cast JSON (backstory+arc) | generateChapter, updateChapter, outlines, subplots, refine | L1 Character digests + EvidencePack for deep bios |
| Full styleGuide essay every call | Most Tab2–6 calls | L1 StyleExemplar digest (~150–300 tokens) |
| Full subplot texts ×8 in packet | continuity packet / generateChapter | subplot id + one-line pressure + EvidencePack |
| Triple outline re-dump per chapter | generate/updateChapterOutline, updateChapter | L2 outline digest + chapter blueprint |
| Duplicate arc in packet + outer fields | generateChapter | Single L2 arc anchor |
| Audit overwrites global character progress | continuityAudit | Merge into L2 BookState ledger |

---

## Suggested EvidencePack injection shape (paste-bridge)

At each hooked `callAI` site, after agent system prompt (and sci-fi prepend if any):

```
{ role: 'system' or 'user', content:
  ## EvidencePack (Layer3)
  <retrieved snippets: Character|PlotBeat|Motif|StyleExemplar>
  ## SeriesBible (L1) — always
  <character digests; world digest; style digest>
  ## BookState (L2) — always
  <beats for chapter; openThreads; conflicts; arcProgress>
}
```

Then existing user template — but **stripped** of fields now covered by L1/L2.

`kbEnabled` gates pack build; when false, behave as today (or slim dumps without KB). Provider remains xAI `callAI` unchanged.

---

## Phase 0 entity mapping from novelData

| novelData | Phase 0 target |
|-----------|----------------|
| `characters[]` | **Character** |
| `chapterBlueprints[]`, chapter outline events, audit storyArcProgress | **PlotBeat** (+ CTR as fields) |
| Themes / recurring images in styleGuide & arcs | **Motif** |
| `styleGuide` / author style | **StyleExemplar** |
| Continuity findings, chapter summaries | BookState L2 + optional **ReferenceDoc** |
| Subplots, conflicts, tensions, resolutions | PlotBeat relations / Character fields / **L2 BookState** — **not** new entityTypes |
| Evidence snippets at retrieve time | **EvidencePack** |

---

## Priority order for implementation

1. `generateChapter` (both passes) — highest volume + continuity packet already halfway to L2  
2. `continuityAudit` — write-back path for L2  
3. `generateNovelOutlines` / `generateChapterOutline` — PlotBeat seeding  
4. `updateChapter` — dump reduction  
5. `suggestBookImprovements` — kill full-book dump  
