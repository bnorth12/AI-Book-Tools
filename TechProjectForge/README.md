# TechProjectForge (TBF)

**Status:** docs-only framing · parked 2026-09-27  
**Suite:** AI Book Tools (`v1.3.0` baseline = pre-improvement tip)  
**Not:** HerbalBookForge fork · Not GNSS/RTK-only product

General **technical-project nonfiction** writing engine: turn a project’s living artifacts (architecture, requirements, design, implementation, tests/CI) into low-slop technical books. Multiple projects over time; GNSS / ground stations / roamers is the first *content* candidate, not the product name.

## Depends on (shared)

- book-schema 1.1 packages (additive; Engineering review before JSON Schema land)
- paste-bridge / `providerConfig: none` (no extra xAI API key)
- EvidencePack packing (L1+L2 always; retrieve L3; never default full repo or full MS)
- anti-slop / human-relatable quality gates (P0 with paste-bridge)

CoS durable notes (mirror): agent shared workstream `tech-project-book-forge/`.

## Framing docs in this folder

| File | Purpose |
| --- | --- |
| [VISION.md](./VISION.md) | Audience, book shapes, success criteria |
| [L1_ENTITY_SKETCH.md](./L1_ENTITY_SKETCH.md) | Tech profile entities vs Phase 0 KB lock |
| [REPO_INGEST.md](./REPO_INGEST.md) | Repo paths → ReferenceDoc / EvidencePack |
| [WORKFLOW.md](./WORKFLOW.md) | Paste-bridge desk flow + promote rules |
| [NON_GOALS.md](./NON_GOALS.md) | Explicit non-goals |

## Owners (proposed)

| Role | Owner |
| --- | --- |
| Engine / nonfiction profile | Nonfiction |
| Shared schema / provider adapter | Engineering (when coding) |
| Portfolio sequencing / spend | Chief of Staff |
| Per-book technical truth | Domain owner (e.g. RTK GNSS for first series) |

## Sequencing

1. Shared paste-bridge + anti-slop + fiction-first prove-out  
2. HBF Phase 5 path (herbal)  
3. This vertical: design lock → thin HTML scaffold (separate go-ahead)  
4. First book pilot from existing GNSS/base/rover repos as evidence packs  

Runtime / Generate UI: **not started**. Docs only until CoS + Eng green-light.
