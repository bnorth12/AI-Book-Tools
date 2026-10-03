# Repo ingest → packs

Map project trees into Layer 3 retrieve packs (and optional attached EvidencePacks), never wholesale prompt dumps.

## Typical path mapping

| Repo area | Pack / ReferenceDoc kind |
| --- | --- |
| `docs/**/ARCHITECTURE*`, `docs/**/ICD*` | architecture / icd |
| `docs/**/REQUIREMENTS*`, issue/milestone exports | requirement |
| Design notes, ADRs | adr / design |
| `firmware/**`, `src/**` (summaries, not full trees) | component-note |
| `tests/**`, CI logs, soak reports | test-evidence |
| CHANGELOG / release notes | release-note |

## Rules

1. Prefer **summaries + locators** (path, SHA, symbol) over pasting whole files.  
2. Always attach L1 SeriesBible + L2 BookState; retrieve L3 for the chapter goal.  
3. One turn = one RetrievalHook (goal facets: componentId, interfaceId, requirementId, …).  
4. Domain owner (e.g. RTK GNSS) owns factual correctness of cited packs.
