# NovelWriter Workflow RAG Audit — Summary

**App:** NovelWriter v0.3.4 · **Source:** `NovelWriter.html` (~5097 lines) · **Docs only** (HTML untouched).

## Findings

NovelWriter is a linear 11-tab browser app: bootstrap (Tab1) → characters → subplots → outlines/blueprints → two-pass chapter generation with **continuity packets/audits** → edit → full-book critique → breakdown integrate. All LLM traffic uses `callAI` + Tab11-editable **system** prompts (`defaultPromptCatalog`, **21** agents). User message templates are hardcoded and routinely **full-dump** session fields (cast JSON, styleGuide essays, all subplots, macro outlines, entire manuscript).

Continuity is the most RAG-ready subsystem already present: `buildChapterContinuityPacket` trims prev chapter / arc anchors and carries unresolved threads + character states from audits — but still embeds up to **8 full subplot texts**, and audits **overwrite** global `characterArcProgress` instead of merging. Style guide is oddly **omitted** from `generateChapter` user prompts while stuffed elsewhere. Conflict/tension/resolution appear as prose and blueprint fields (`allowedPayoffs`, `deferredThreads`), not first-class entities — fits Phase 0 locks (PlotBeat/Character/L2 BookState only).

## Top 5 RAG hook points

1. **`generateChapter` (Tab5, 2-pass)** — Inject EvidencePack + L1 digests + L2 packet; kill full cast/subplot/arc dumps.  
2. **`continuityAudit` / packet rebuild** — Primary L2 write-back (threads, risks, arc progress); fix merge semantics.  
3. **`generateNovelOutlines` → `chapterBlueprints`** — Seed Phase 0 **PlotBeat** graph + BookState.  
4. **`updateChapter` (Tab6)** — Second-worst dump site; swap outlines/cast for L1/L2 + facets.  
5. **`suggestBookImprovements` (Tab7)** — Kill full-manuscript prompt; retrieve by chapter/motif/conflict facets.

## Risks

- Token blowups / quality loss from full dumps as books grow.  
- Continuity tracker last-write-wins on character arcs → false “current state.”  
- Packet vs outer prompt duplication (arc/subplots twice).  
- Tab11 edits system prompts only — RAG injection must land in message builders / `callAI`, not prompt catalog alone.  
- Phase 0 lock temptation: do not add Conflict entityType; keep CTR on PlotBeat/Character/L2.

## Files written

`/workspace/plans/novelwriter-workflow-rag/{CURRENT_WORKFLOW,PROMPT_INVENTORY,RAG_HOOK_CANDIDATES,SUMMARY}.md`
