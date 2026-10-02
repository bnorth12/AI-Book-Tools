# Story framing improvements — NovelWriter / fiction suite

**Date:** 2026-09-27 (America/Chicago)  
**Owner:** Fiction  
**Status:** backlog + methods (docs only; no HTML rewrites yet)  
**Aligns with:** Phase 0 RAG locks, book-schema 1.1, CoS eval backlog

---

## 1. User framing (keep as planning lenses)

| Authoring lens (UI language) | What it covers | Current NW home |
| --- | --- | --- |
| World development | Setting rules, culture, constraints, places that pressure decisions | Tab 1 `setting` (+ style/genre) |
| Character development | Who they are, motives, relationships | Tab 2 name / backstory / arc |
| Character arcs | Per-person change curve over the book | Tab 2 `arc`; continuity `characterArcProgress` |
| Story development | Plot spine, events, causality | Tab 1 `generalPlot`; Tab 3 subplots; Tab 4 outlines |
| Story arc | Emotional/thematic journey & act turns | Tab 1 `storyArc`; Tab 4 `storyArcOutline`; continuity `storyArcProgress` |

**Verdict:** Keep these five as **tabs / planning language**. They are incomplete for **conflict, tension, resolution, and throughlines** — those are relations and pressures *between* world/character/plot, not parallel silos.

---

## 2. Add to improvement backlog (new items)

### P0 (docs + contract — this pack)

| ID | Item | Notes |
| --- | --- | --- |
| SF0.1 | Document NW current workflow + prompt inventory | See `/workspace/plans/novelwriter-workflow-rag/` |
| SF0.2 | Map lenses → Phase 0 entities + L1/L2 BookState | No new shared KB entityTypes |
| SF0.3 | Define Conflict / Tension / Resolution / Throughline as **fields & edges**, not new Phase 0 types | Eng ping if anyone proposes shared types |
| SF0.4 | EvidencePack query facets: `conflictId`, `throughlineId`, `tensionFocus` | Additive filters on EvidencePack 0.1 |
| SF0.5 | Prompt packing rules per agent (which L1/L2/L3) | Replace ad-hoc full-field stuffing |

### P1 (runtime after Eng / CoS go-ahead)

| ID | Item | Surfaces |
| --- | --- | --- |
| SF1.1 | Session fields: `conflicts[]`, `tensions[]`, `resolutions[]`, `throughlines[]` (or fold into continuityTracker) | NW session JSON; optional additive novelData |
| SF1.2 | UI: lightweight Conflict/Tension panel (or extend Tab 10 Element Values) | NW |
| SF1.3 | Prompt updates: every plot/character/chapter agent must name active conflicts + open tensions | Tab 11 defaults |
| SF1.4 | Continuity audit JSON: add conflict/tension drift checks | Tab 5 continuityAudit |
| SF1.5 | Graph extract from Tab1–4 → knowledge-graph-0.1 nodes/edges | shared/kb + Decomposer later |
| SF1.6 | Chapter generate: retrieve by throughline + conflict, not “prior 1.2k chars only” | Phase 3 RAG |

### P2

| ID | Item |
| --- | --- |
| SF2.1 | Series-level throughlines across books (SeriesBible) |
| SF2.2 | Motif ↔ conflict echo rules (overuse vs intentional recurrence) |
| SF2.3 | BookEditor import of conflict/tension pack for critique without full-book upload |

---

## 3. Mapping — lenses → graph (Phase 0 safe)

```text
World development  →  ReferenceDoc (lore) + soft WorldRule (deferred) + setting text in L1 digest
Character development → Character (voiceCard, motivation)
Character arcs     →  Character.arcSummary + edges MOTIVATED_BY → PlotBeat
Story development  →  PlotBeat chain (PRECEDES) + subplot tags
Story arc          →  PlotBeat.arcStep + L2 rollingSynopsis / storyArcProgress
Conflict           →  edge or PlotBeat fields: parties[], stake, status (open|escalating|resolved)
Tension            →  L2 / chapter facet: level, locus, threatens
Resolution         →  PlotBeat.payoffStatus + link conflictId → resolvedByBeatId
Throughline        →  tag on PlotBeat/Character/Conflict (main|subplot:<id>)
Motif              →  Motif entity (keep separate from “story development”)
```

**Hard lock:** Do **not** add Conflict/Tension/Resolution as Phase 0 `entityType` enum values without Engineering. Store as PlotBeat/Character properties + L2 BookState + graph **edges**.

---

## 4. CoS eval backlog delta (apply)

Add under P0 after item 5:

> 5b. Story framing: treat world/character/story/arcs as UI lenses; add conflict/tension/resolution/throughline as L2 + PlotBeat relations; document NW prompts for RAG hooks (Fiction).

Add under P1:

> 7b. NW continuityTracker extension for conflicts/tensions; continuityAudit checks; EvidencePack facets conflictId/throughlineId.
