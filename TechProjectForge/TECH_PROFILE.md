# Tech nonfiction profile (Nonfiction lane)

**Product:** TechProjectForge — general technical-*project* book engine.  
**Not:** HerbalBookForge reskin. **Not:** GNSS/RTK product name (first *content* series only).

## Discriminant vs HBF

| | HerbalBookForge | TechProjectForge |
| --- | --- | --- |
| Domain | Herbal / botanical nonfiction | Engineering project handbooks |
| Phase 0 KB entities | Taxon, Preparation, Contraindication, SafetyTopic | None new — use `ReferenceDoc` kinds + facets (`L1_ENTITY_SKETCH.md`) |
| Safety model | Herbal contraindications / dosage honesty | Cite-the-repo + domain-owner honesty (Hazard notes ≠ herbal SafetyTopic) |
| Evidence source | Citations, materia notes | Living repo (ICD, ARCH, requirements, tests/CI) |
| Shared core | Same paste-bridge / EvidencePack / anti-slop / book-schema 1.1 packages | Same — see `SHARED_CORE_ALIGNMENT.md` |

## book-schema 1.1 mapping (docs)

- `workType: nonfiction`
- `providerConfig.mode: none` default
- L1 SeriesBible: project/program canon + accepted scoping (problem, audience, success, non-goals, evidence boundaries)
- L2 BookState: rollingSynopsis, openThreads, chapterSummaries / thin map, structureChoice (`annotated-outline` \| `spiral` \| `theme` \| `faq` \| `field-guide`)
- L3 EvidencePack: retrieved repo excerpts only (`REPO_INGEST.md`)
- `nonfictionExt` (tech): optional `repos[]` `{ remote, sha, role }`, `ingestIndexId`, `structureChoice` — not new shared KB types

## Quality / promote (P0)

Same gate as fiction + herbal before promote L3→L2→L1: specificity, cite-the-repo, interest/readability, human-vs-AI patterns, domain honesty (`SHARED_CORE_ALIGNMENT.md` + `WORKFLOW.md` promote loop).

## Sequencing

Fiction-first vertical prove-out → HBF Phase 5 path → TBF thin HTML scaffold (separate go-ahead). Runtime Generate UI parked until CoS + Eng green-light.

## Start methods + SDLC gap-fill

See `WORKFLOW.md`: multi-start (A–F); repo-ingest is a required *capability*, not the sole entry. Optional SDLC gap-fill (needs→…→release) as missing-pack prompts — available, not a forced template (`GOALS` G8 / `NON_GOALS`).
