# L1 entity sketch (docs only)

**Phase 0 lock:** shared KB types remain **only** `EvidencePack` + `ReferenceDoc` until Engineering mediates new shared types.

Until then, tech-project concepts live as:

- `ReferenceDoc` kinds / tags (e.g. `requirement`, `architecture`, `icd`, `adr`, `test-evidence`, `component-note`)
- BookState fields (outline, chapterSummaries, openThreads)
- Freeform continuityNotes—not new Phase 0 entityType enums

## Candidate profile concepts (packages / facets — not new KB without Eng)

| Concept | Role |
| --- | --- |
| Requirement | Normative “shall” / acceptance |
| DesignDecision (ADR) | Why this shape |
| Interface | ICD / API / protocol boundary |
| Component | Board, firmware image, service |
| TestEvidence | Test id, CI run, soak result |
| Hazard / SafetyNote | Optional; distinct from herbal Contraindication |

Herbal Taxon/Preparation/Contraindication/SafetyTopic stay on the HBF profile. Do not reuse herbal safety semantics for engineering claims.
