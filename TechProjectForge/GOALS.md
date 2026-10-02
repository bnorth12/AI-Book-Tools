# Goals — TechProjectForge

Measurable outcomes for the engine (not for any single book). Docs/design phase until CoS + Eng green-light runtime.

| ID | Goal | Measure |
| --- | --- | --- |
| G1 | **Cite-the-repo** | ≥90% of normative chapter claims map to a `ReferenceDoc` id or EvidencePack item locator (path+SHA/symbol); uncited claims flagged before promote |
| G2 | **Low-slop / human-relatable** | Promote blocked unless anti-slop checklist passes (see `SHARED_CORE_ALIGNMENT.md`); domain owner can lightly edit rather than rewrite |
| G3 | **Paste-bridge default** | Happy path uses `providerConfig.mode: none` + shared `PasteBridgePacket`; no extra xAI console key required |
| G4 | **Reusable across projects** | Same engine docs + packs work for ≥2 unrelated technical projects without renaming the product or forking HBF |
| G5 | **Layered memory** | Generate/bridge turns ship L1+L2 always and L3 retrieve only — never default full-repo or full-MS injection |
| G6 | **Scoping-first workflow** | Every book run produces problem statement + top-level scoping docs before chapter prose; annotated full outline is preferred when it fits, not mandatory (see `WORKFLOW.md`) |
| G7 | **No core fork** | TBF consumes shared book-schema 1.1 packages + packing/playbook; Fiction lane owns alignment (`SHARED_CORE_ALIGNMENT.md`) |
| G8 | **Multi-start + optional SDLC gap-fill** | Engine documents ≥ repo-ingest plus alternate starts (blank vision, import, interview, standards-first, reverse-outline); SDLC coverage checks available, **not** required for every book (`WORKFLOW.md`) |

## Non-measures (explicit)

- Token spend on optional in-app xAI is not a success metric.
- GNSS/RTK book completion alone does not prove G4.
- SDLC completeness is not a success metric; gap-fill is optional coverage, not a forced template.
