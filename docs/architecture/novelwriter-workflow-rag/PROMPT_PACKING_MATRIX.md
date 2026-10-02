# Prompt packing matrix (methods)

Normative assembly for future `callAI` / paste-bridge. Do not implement until go-ahead.

| Agent | A L1 | B L2 | C L3 retrieve query | D task | Kill |
| --- | --- | --- | --- | --- | --- |
| suggestStoryArc | genre, style | — | — | arc instructions | — |
| suggestGeneralPlot | + storyArc | — | — | plot instructions | — |
| suggestSetting | + arc/plot | — | — | setting instructions | — |
| suggestCharacters | story digest | — | optional StyleExemplar | blank slots JSON | full subplot dump if unused |
| refineCharacters | cast cards | subplot throughlines | Motif? | refine instructions | — |
| suggestSubplots | cast+plot+setting | standing conflicts | — | subplot count | — |
| generateNovelOutlines | full L1 | open threads | — | outline schema | raw prior chapters |
| generateChapterOutline | L1 thin | beats so far + open conflicts | prior/next beat neighbors | chapter n goals | full manuscript |
| **generateChapter** | **yes** | **yes (incl. conflicts/tensions)** | **chapter+chars+conflictId+throughlineId** | chapter outline + prior beat summary | **prior full chapters / whole novelData dump** |
| continuityAudit | cast+world digest | tracker + open conflicts | related beats | audit JSON schema | full book text |
| updateChapter | voice card | — | character+motif for scene | improvement directives + chapter text | unrelated cast |
| suggestBookImprovements | L1 | open conflicts / weak resolutions | sample Motif/PlotBeat issues | critique rubric | **full book upload** |
| integrateBreakdown | — | — | — | chapter text + instructions | other chapters |

Default token targets: L1+L2 ≤ ~800–1200; L3 per packing policy (draft 1500–2500).
