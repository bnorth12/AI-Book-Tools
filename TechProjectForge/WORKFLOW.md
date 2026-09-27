# Workflow (paste-bridge first)

1. **Select project** — seriesId + bookId; point at one or more git remotes / local checkouts.  
2. **Ingest index** — build RetrievalIndex (paths, SHAs, doc kinds); no full-tree embed.  
3. **Outline** — BookState goals + chapterSummaries from L1+L2 (+ retrieved L3).  
4. **Draft chapter** — export PasteBridgePacket → Grok Bot / grok.com / Copilot → paste draft back.  
5. **Quality gate** — anti-slop / interest / readability / human-vs-AI patterns; cite check vs pack ids.  
6. **Promote** — accepted text → L2; locked facts → L1; reject returns to desk.

`providerConfig.mode` default: **`none`**. In-app Generate optional later via shared provider adapter.
