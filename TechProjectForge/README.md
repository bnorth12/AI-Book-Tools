# TechProjectForge (TBF)

**Status:** docs framing · expanded 2026-09-27  
**Suite:** AI Book Tools (`v1.3.0` baseline tip `924a312`; TBF park `5ca7751`+)  
**Not:** HerbalBookForge fork · Not GNSS/RTK-only product

General **technical-project nonfiction** writing engine: turn a project’s living artifacts (architecture, requirements, design, implementation, tests/CI) into low-slop technical books. Multiple projects over time; GNSS / ground stations / roamers is the first *content* candidate, not the product name.

## Depends on (shared — do not fork)

- book-schema 1.1 packages (additive; Engineering review before JSON Schema land)
- paste-bridge / `providerConfig: none` (no extra xAI API key)
- EvidencePack packing (L1+L2 always; retrieve L3; never default full repo or full MS)
- anti-slop / human-relatable quality gates (P0 with paste-bridge)

See **[SHARED_CORE_ALIGNMENT.md](./SHARED_CORE_ALIGNMENT.md)** (Fiction lane) for how TBF binds to that core.

CoS durable notes (mirror): agent shared workstream `tech-project-book-forge/`.

## Framing docs in this folder

| File | Purpose | Owner |
| --- | --- | --- |
| [VISION.md](./VISION.md) | Audience, book shapes, success | Nonfiction |
| [GOALS.md](./GOALS.md) | Measurable engine outcomes | Nonfiction (+ Fiction on G3/G7) |
| [NON_GOALS.md](./NON_GOALS.md) | Explicit non-goals / locks | Nonfiction |
| [WORKFLOW.md](./WORKFLOW.md) | Required ingest→research→scope→(outline?) + promote gates | Nonfiction |
| [SHARED_CORE_ALIGNMENT.md](./SHARED_CORE_ALIGNMENT.md) | Paste-bridge / EvidencePack / anti-slop — no core fork | **Fiction** |
| [L1_ENTITY_SKETCH.md](./L1_ENTITY_SKETCH.md) | Tech profile vs Phase 0 KB lock | Nonfiction |
| [REPO_INGEST.md](./REPO_INGEST.md) | Repo paths → ReferenceDoc / EvidencePack | Nonfiction |
| [TECH_PROFILE.md](./TECH_PROFILE.md) | Tech vs HBF discriminant + 1.1 mapping | **Nonfiction** |

## Owners

| Role | Owner |
| --- | --- |
| Engine / nonfiction profile | Nonfiction |
| Shared paste-bridge / EvidencePack / anti-slop alignment | Fiction |
| Shared schema / provider adapter | Engineering (when coding) |
| Portfolio sequencing / spend | Chief of Staff |
| Per-book technical truth | Domain owner (e.g. RTK GNSS for first series) |

## Sequencing

1. Shared paste-bridge + anti-slop + fiction-first prove-out  
2. HBF Phase 5 path (herbal)  
3. This vertical: design lock → thin HTML scaffold (separate go-ahead)  
4. First book pilot from existing GNSS/base/rover repos as evidence packs  

Runtime / Generate UI: **not started**. Docs only until CoS + Eng green-light.

## Hard locks

- No extra xAI API tokens by default  
- Anti-slop / human-relatable quality is P0  
- Never default full manuscript or full codebase into a turn  
- Phase 0 shared KB types remain EvidencePack + ReferenceDoc until Engineering expands  
