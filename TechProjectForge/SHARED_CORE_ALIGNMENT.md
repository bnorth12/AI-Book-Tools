# Shared core alignment (Fiction lane)

**Purpose:** TechProjectForge reuses the same paste-bridge / EvidencePack / anti-slop core as NovelWriter · BookEditor · BookDecomposer · HerbalBookForge. **Do not fork** a second packing policy, packet shape, or quality bar.

**Source of truth (docs):** `../` suite plans mirrored under agent `shared/workstreams/book-schema-1.1/` and `/workspace/plans/book-schema-1.1/` on the box:
- `PASTE_BRIDGE_PLAYBOOK.md`
- `EVIDENCEPACK_PACKING_POLICY.md`
- `BOOK_SCHEMA_1.1_DESIGN.md`

---

## Paste-bridge (identical happy path)

| Rule | TBF behavior |
| --- | --- |
| Default provider | `providerConfig.mode: "none"` |
| Packet | Shared `PasteBridgePacket` (`schemaHint: paste-bridge-1`) |
| Desks | Grok Bot / grok.com / GitHub Copilot (already paid) |
| In-app Generate | Optional later via **shared** provider adapter — not a TBF-only `callAI` |
| Must not | Auto-call xAI while mode is `none`; invent a TBF-only bridge format |

Fiction trio checklists (NW/BE/BD) and HBF notes in the playbook apply by analogy: export L1+L2 (+ optional L3) → desk → paste back → update BookState offline.

---

## EvidencePack packing (identical)

1. Always L1 (SeriesBible / accepted canon + goals) + L2 (BookState).
2. Retrieve L3 (`EvidencePack` excerpts) — never default full repo tree or full manuscript.
3. `kbEnabled` ⊥ provider.
4. Phase 0 shared KB types remain **only** `EvidencePack` + `ReferenceDoc`. Tech concepts (Requirement, ADR, Interface, …) stay `ReferenceDoc` kinds / BookState fields until Engineering mediates new shared types (`L1_ENTITY_SKETCH.md`).

TBF goalFacets (examples): `componentId | interfaceId | requirementId | adrId | testEvidenceId` — facets/tags, not new entityTypes.

---

## Anti-slop / human-relatable quality gates (P0)

Same bar as fiction + herbal. Gate **before promote** L3 draft → L2 BookState → L1 SeriesBible.

| Check | Fail closed if… |
| --- | --- |
| Specificity | Vague filler, no citeable pack/locator |
| Cite-the-repo | Claims without `ReferenceDoc` / EvidencePack item ids (or explicit “needs domain confirm”) |
| Interest / readability | Dense AI cadence, empty section padding |
| Human-vs-AI patterns | Stock transitions, repeated hedge stacks, generic “in today’s world” |
| Domain honesty | Invented APIs, versions, or test results |

`QualityFinding` remains **deferred** as a KB entityType (editor phase). Until then: checklist + paste-bridge continuity/quality task; optional later BookEditor pass on TBF chapters.

---

## What TBF may specialize (profile only)

- `workType: nonfiction` + tech `nonfictionExt` / ReferenceDoc kinds (`REPO_INGEST.md`)
- Repo ingest index (paths → locators) — still emits shared EvidencePack / ReferenceDoc shapes
- Content series (e.g. GNSS/RTK) owned by domain agents — not a forked engine

## What TBF must not specialize

- Second paste packet schema
- Second EvidencePack packing policy
- Second provider stack
- Herbal Contraindication/SafetyTopic semantics for engineering claims
