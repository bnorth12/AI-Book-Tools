# NovelWriter Prompt Inventory

**Source of truth:** `defaultPromptCatalog` L711–749 + per-function user message builders.  
**Editable via Tab 11:** Yes for **system** prompts only (`getAgentPrompt`). User templates are hardcoded.  
**Gateway:** Every site → `callAI()` L919. Sci-fi genre adds an extra system message when `genre === 'scifi'`.

**Prompt site count:** **21** catalog agent keys / unique LLM call functions.  
(`generateChapter` issues **2** `callAI` invocations per chapter — same agent key.)

Relevance legend: **W**orld · **C**haracter · **S**tory · **A**rc · **CTR** conflict/tension/resolution · **N/A**

---

## Tab 1 — API & Story Info

### 1. `fetchAuthors` — Fetch Authors
- **Lines:** L1054–1208 · catalog L713
- **System (default):** *"You are a literature researcher helping a novelist find high-signal author references by genre…"*
- **User (approx):** List 100 notable authors for `${genre}` (20 recent / 80 historical); JSON `{"authors":[{"value","name"}]}`.
- **Session concat:** `genre` only.
- **Tab 11 editable:** Yes
- **Map:** W N/A · C N/A · S N/A · A N/A · CTR N/A (meta/style discovery)

### 2. `fetchStyleGuide` — Fetch Style Guide
- **Lines:** L1214–1300 · catalog L714
- **System:** *"You are a literary style analyst. Produce concrete, reusable style guidance covering voice, sentence rhythm…"*
- **User:** Detailed style guide (300–400 words) for `${author}` covering Tone, Structure, Themes, Narrative Approach, Distinctive Traits, World-Building, Prose; JSON `{"styleGuide"}`. Default authors short-circuit without LLM (L1220).
- **Session concat:** selected `authorStyle` value.
- **Tab 11:** Yes
- **Map:** W (style world-building cues) · C N/A · S N/A · A N/A · CTR N/A — primarily **StyleExemplar** fodder

### 3. `suggestStoryArc` — Suggest Story Arc
- **Lines:** L1307–1384 · catalog L715
- **System:** *"You are a story architect designing emotionally coherent long-form arcs…"*
- **User:** Generate 300–400 word arc for genre/title/style/styleGuide; Core Concept, Progression, Themes; JSON `{"storyArc"}`. Distinctive: *"free of specific characters or settings."*
- **Session:** genre, title, authorStyle, styleGuide.
- **Tab 11:** Yes
- **Map:** W N/A · C N/A · **S** · **A** · **CTR** (stakes/themes)

### 4. `suggestGeneralPlot` — Suggest General Plot
- **Lines:** L1391–1481 · catalog L716
- **System:** *"You are a plot designer for serialized novels…"*
- **User:** 400–500 word plot across `numChapters`; Main Conflict, Key Events, Stakes, Subplot Threads; JSON `{"generalPlot"}`.
- **Session:** genre, title, storyArc, numChapters, authorStyle, styleGuide.
- **Tab 11:** Yes
- **Map:** W light · C light · **S** · **A** · **CTR** (main conflict + stakes)

### 5. `suggestSetting` — Suggest Setting
- **Lines:** L1489–1568 · catalog L717
- **System:** *"You are a world-building specialist…"*
- **User:** 300–400 word setting; Backdrop, Unique Features, Thematic Ties; JSON `{"setting"}`.
- **Session:** genre, title, storyArc, generalPlot, authorStyle, styleGuide.
- **Tab 11:** Yes
- **Map:** **W** · C N/A · S · A themes · CTR via conflict-tied features

### 6. `suggestStoryInfo` — AI Suggest Story Info
- **Lines:** L4145+ · catalog L718
- **System:** *"You are a novel development lead synthesizing title, arc, plot, and setting…"*
- **User:** Fill/suggest title, storyArc, generalPlot, setting, styleGuide with word-count floors; JSON with all five fields.
- **Session:** genre, existing title/arc/plot/setting, authorStyle, numChapters.
- **Tab 11:** Yes
- **Map:** **W** · C N/A · **S** · **A** · **CTR**

---

## Tab 2 — Characters

### 7. `scrapeBookInfoForCharacters` — Scrape Book Info for Characters
- **Lines:** L1583–1656 · catalog L721
- **System:** *"You are an entity extraction specialist for fiction planning. Identify likely character names only…"*
- **User:** Extract character names from book info; JSON `{"characters":[{"name"}]}`. Distinctive: not locations/orgs/concepts.
- **Session:** title, storyArc, generalPlot, setting (selective join).
- **Tab 11:** Yes
- **Map:** W N/A · **C** · S N/A · A N/A · CTR N/A

### 8. `suggestCharacters` — Suggest Characters
- **Lines:** L1659–1835 · catalog L722
- **System:** *"You are a character development specialist for long-form fiction…"*
- **User:** Large template — locked complete chars JSON, name-only completions, blank-slot generation; backstory 200–250w, arc 150–200w; return `{"characters":[…]}`. Distinctive: *"Do NOT return extra characters beyond needed completions and blank slots."*
- **Session:** genre, title, authorStyle, **full styleGuide**, storyArc, generalPlot, setting, completeCharacters, nameOnlyCharacters, blankCount/numCharacters.
- **Tab 11:** Yes
- **Map:** W (setting ties) · **C** · **S** · **A** · **CTR** (conflict hooks in arcs)

### 9. `refineCharacters` — Refine Characters with Subplots
- **Lines:** L1850–1921 · catalog L723
- **System:** *"You are a character arc editor…"*
- **User:** Refine exactly N characters; retain name+backstory; update arcs with subplot integration; JSON characters array.
- **Session:** **Full dump** — storyArc, plot, setting, `JSON.stringify(characters)`, `subplots.join`, authorStyle, styleGuide.
- **Tab 11:** Yes
- **Map:** W · **C** · S · **A** · **CTR** (subplot-driven conflicts)

---

## Tab 3 — Subplots

### 10. `suggestSubplots` — AI Suggest Subplots
- **Lines:** L1930–2050 · catalog L726
- **System:** *"You are a subplot strategist…"*
- **User:** Generate N subplots (300–400w each); Narrative Thread, Setting Immersion, Character Development, Thematic Resonance; JSON `{"subplots":["…"]}`.
- **Session:** genre, title, storyArc, plot, setting, **complete characters JSON**, authorStyle, styleGuide, numChapters.
- **Tab 11:** Yes
- **Map:** W · **C** · **S** · **A** · **CTR**

---

## Tab 4 — Outlines

### 11. `generateNovelOutlines` — AI Suggest Novel Outline
- **Lines:** L3497–3655 · catalog L729
- **System:** *"You are a structural narrative planner for full-length novels…"*
- **User:** Novel Outline 500–600w, Annotated Plot 600–750w, Annotated Story Arc 500–600w, **plus chapterBlueprints** with role/arcStep/subplotPressure/characterBeats/allowedPayoffs/deferredThreads. Escalation discipline language.
- **Session:** **Full dump** — genre, numChapters, title, storyArc, plot, setting, `JSON.stringify(characters)`, subplots joined, authorStyle, styleGuide, existing three outlines.
- **Tab 11:** Yes
- **Map:** W · C · **S** · **A** · **CTR** (payoffs/deferred = beat-level CTR)

### 12. `generateChapterOutline` — Generate Chapter Outline & Arc
- **Lines:** L3663–3810 · catalog L730
- **System:** *"You are a chapter planning specialist…"*
- **User:** Outline 300–400w + Arc 200–300w; structural stage rules OR blueprint block; must preserve unresolved thread unless final chapter.
- **Session:** genre, title, style, storyArc, plot, setting, filtered characters JSON, subplots, three macro outlines, existing chapter outline/arc, blueprint fields.
- **Tab 11:** Yes
- **Map:** W · C · **S** · **A** · **CTR**

### 13. `updateChapterOutline` — Update (chapter)
- **Lines:** L3816–3880 · catalog L731
- **System:** *"You are an outline revision editor…"*
- **User:** Update outline+arc with improvements; consistency instruction; JSON `{"outline","arc"}`.
- **Session:** Same family as generate + current combined outline/arc + improvements + styleGuide.
- **Tab 11:** Yes
- **Map:** W · C · **S** · **A** · **CTR**

### 14. `incorporateOutlineSuggestions` — Incorporate Suggestions
- **Lines:** L3193–3233 · catalog L732
- **System:** *"You are a narrative restructuring assistant…"*
- **User:** Incorporate improvements into novel/plot/storyArc outlines; JSON three fields.
- **Session:** improvements + three existing outlines + genre (selective).
- **Tab 11:** Yes
- **Map:** W light · C N/A · **S** · **A** · CTR light

---

## Tab 5 — Generate Chapters

### 15. `generateChapter` — Generate Chapter (2-pass)
- **Lines:** Part1 L3916–3959 · Part2 L3983–4026 · catalog L735
- **System:** *"You are a chapter drafting specialist for commercial fiction…"* (fallback embeds authorStyle).
- **User Part1:** First half ~1600–2000w; structure/character/world/plot/tone requirements; optional Strict Continuity bullets; JSON `{"chapter"}`.
- **User Part2:** Continue from first half; conclude with cliffhanger; same context + full part1 text.
- **Session:** storyArc, plot, setting, complete characters JSON, all subplots, chapter outline/arc, **Continuity Packet JSON**, (part2: first half prose). Strict mode flag.
- **Tab 11:** Yes (system only; both passes share key)
- **Map:** **W** · **C** · **S** · **A** · **CTR**

### 16. `continuityAudit` — Continuity Audit
- **Lines:** `runChapterContinuityAudit` L2341–2398 · catalog L736 · also `runContinuityAuditAll` L2400
- **System:** *"You are a continuity QA editor… return precise, actionable fixes in strict JSON."*
- **User:** Audit chapter N; mode; storyArc; plot; characters JSON; continuity packet; **full chapter text**; required JSON schema with chapterSummary, unresolvedThreads, storyArcProgress, characterArcProgress, continuityRisks, recommendedFixes.
- **Session:** As above + rebuilt packet.
- **Tab 11:** Yes
- **Map:** W (world state risks) · **C** · **S** · **A** · **CTR** (threads/risks)

---

## Tab 6 — Edit Chapters

### 17. `updateChapter` — Update Chapter
- **Lines:** L4086–4139 · catalog L739
- **System:** *"You are a revision editor focused on preserving authorial intent…"*
- **User:** Update chapter with improvements; maintain consistency; JSON `{"chapter"}`.
- **Session:** **Heavy dump** — title, storyArc, plot, setting, all characters, subplots, three macro outlines, chapter outline/arc, trimmed previous chapters (~4k chars), current content, improvements, authorStyle, styleGuide, chapterLength.
- **Tab 11:** Yes
- **Map:** W · C · S · A · CTR

### 18. `checkSpellingAndGrammar` — Check Spelling & Grammar
- **Lines:** L2417–2459 · catalog L740
- **System:** *"You are a professional copy editor…"*
- **User:** Check text; JSON `{"corrections"}` (code also accepts `corrected_text` for auto-apply).
- **Session:** chapter edit textarea only.
- **Tab 11:** Yes
- **Map:** N/A (copyedit)

---

## Tab 7 — Book

### 19. `suggestBookImprovements` — Suggest Improvements
- **Lines:** L2513–2616 · catalog L743
- **System:** *"You are a developmental editor evaluating full-manuscript quality…"*
- **User:** Review book; 7–10 improvements (100–150w each) for coherence/pacing/character/plot; JSON `{"improvements":[…]}`.
- **Session:** **Full concatenated book** + genre/storyArc snippets in example only.
- **Tab 11:** Yes
- **Map:** W · C · **S** · A · **CTR**

### 20. `breakdownImprovement` — Break Down
- **Lines:** L2696–2859 · catalog L744
- **System:** *"You are an editorial operations planner…"*
- **User:** Break improvement into characters/subplots/novelOutlines/chapterOutlines/chapters; JSON `{"breakdown":{…}}`.
- **Session:** improvement text + affected (or all) chapter prose + characters JSON + subplots + novelOutline + chapterOutlines.
- **Tab 11:** Yes
- **Map:** W · C · S · A · CTR

---

## Tab 8 — Consolidated Breakdowns

### 21. `integrateBreakdown` — Integrate Suggestions
- **Lines:** L2946–3059 · catalog L747
- **System:** *"You are a fiction line-and-structure integration editor… Return ONLY revised chapter text…"*
- **User:** Revise Chapter N with listed improvement instructions + current chapter text.
- **Session:** genre, title, chapterInstructions from To-Incorporate breakdowns, current chapter prose.
- **Tab 11:** Yes
- **Map:** W · C · S · A · CTR (applies prior critique)

---

## Implicit / non-catalog prompts

| Site | Notes | Tab 11 |
|------|-------|--------|
| Sci-fi hard-science prepend in `callAI` L942–946 | Extra system message when genre=scifi | **No** |
| Fallback strings in `getAgentPrompt(…, fallback)` | Used if catalog key missing | N/A |

---

## Coverage matrix (quick)

| Agent key | W | C | S | A | CTR |
|-----------|---|---|---|---|-----|
| fetchAuthors | — | — | — | — | — |
| fetchStyleGuide | ○ | — | — | — | — |
| suggestStoryArc | — | — | ● | ● | ● |
| suggestGeneralPlot | ○ | ○ | ● | ● | ● |
| suggestSetting | ● | — | ○ | ○ | ○ |
| suggestStoryInfo | ● | — | ● | ● | ● |
| scrapeBookInfoForCharacters | — | ● | — | — | — |
| suggestCharacters | ○ | ● | ● | ● | ● |
| refineCharacters | ○ | ● | ○ | ● | ● |
| suggestSubplots | ○ | ● | ● | ● | ● |
| generateNovelOutlines | ○ | ○ | ● | ● | ● |
| generateChapterOutline | ○ | ○ | ● | ● | ● |
| updateChapterOutline | ○ | ○ | ● | ● | ● |
| incorporateOutlineSuggestions | ○ | — | ● | ● | ○ |
| generateChapter | ● | ● | ● | ● | ● |
| continuityAudit | ○ | ● | ● | ● | ● |
| updateChapter | ● | ● | ● | ● | ● |
| checkSpellingAndGrammar | — | — | — | — | — |
| suggestBookImprovements | ○ | ● | ● | ○ | ● |
| breakdownImprovement | ○ | ● | ● | ○ | ● |
| integrateBreakdown | ○ | ○ | ● | ○ | ● |

● = primary · ○ = secondary · — = N/A
