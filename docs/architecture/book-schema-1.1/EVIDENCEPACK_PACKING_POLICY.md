# EvidencePack Packing Policy

**Status:** docs-only · CoS / Fiction / Nonfiction P0  
**Date:** 2026-09-27 ~00:12 CDT  
**Contract:** Phase 0 `EvidencePack` (`schema/evidence-pack-0.1.json`) — no parallel pack types  
**Rule of thumb:** Always attach Layer1+Layer2; retrieve Layer3; never default full `chapters[]` / `drafts[]` / manuscript.

---

## 1. Layer assembly (normative)

| Layer | Source | Attach policy |
| --- | --- | --- |
| **Layer1** | Fiction: `SeriesBible` canon summary. Nonfiction: Taxon/Preparation/Contraindication/SafetyTopic + ReferenceDoc digest | **ALWAYS** |
| **Layer2** | `BookState`: rollingSynopsis, openThreads, lastAcceptedCanon, draftSummaries, safetyReportSummary, goals/outlineDigest | **ALWAYS** |
| **Layer3** | Local retrieve → `EvidencePack` excerpts (ranked, token-budgeted) | **RETRIEVE only** — omit or empty pack if no hits / `kbEnabled: false` |

Paste-bridge and in-app Generate (when provider ≠ none) use the **same** assembly rules.

---

## 2. Never default to full body dumps

| Anti-pattern | Replace with |
| --- | --- |
| Full `novelData.chapters[]` / `editedChapters` / `bookText` | Layer2 synopsis + Layer3 excerpts + optional single-chapter facet |
| Full HBF `drafts[]` bodies | `draftSummaries` in Layer2; retrieve prior section excerpts into Layer3 if needed |
| Full series bible prose dump beyond Layer1 budget | Trim `canonSummary`; move detail to ReferenceDoc + retrieve |
| Whole-book upload for “analysis” (BookEditor pattern) | Pack Layer1+2; retrieve Layer3; multi-pass by chapter facet |

**Kill target (Fiction P0):** full-manuscript upload → EvidencePack packing as default path.

---

## 3. `kbEnabled` ⊥ provider

| `kbEnabled` | `providerConfig.mode` | Pack behavior |
| --- | --- | --- |
| true | xai / ollama / external / **none** | Build EvidencePack locally; inject Layer3 into prompt **or** PasteBridgePacket |
| false | any | `excerpts: []`; still attach Layer1+2; fall back to session-field prompting without KB neighbors |
| true/false | `none` | No remote call from app; user pastes packet to Bot/Chat |

KB never implies a vendor. Provider never implies KB on/off.

---

## 4. Ranking, budget, expand/narrow

Follow Phase 0 EvidencePack rules:

1. Rank excerpts by score descending; greedy-fill to `tokenBudgetHint`.
2. Prefer higher-score + shorter near budget.
3. **Herbal / safety:** always prefer `ReferenceDoc` with `kind: "safety"` when filters include safety topics — do not drop safety for style fluff.
4. `expandOrNarrow`: `expand` \| `narrow` \| `hold` as next-retrieve hint.
5. Log pack size (count + est. tokens) in `requestLog` when wiring Phase 3+ (fiction) / Phase 5 (HBF).

**Default budgets (tunable):**

| Task | Layer3 hint (tokens) | Notes |
| --- | --- | --- |
| Fiction chapter draft | 1500–2500 | Character/PlotBeat/Motif/StyleExemplar |
| Fiction continuity check | 1200–2000 | Open threads + related beats |
| Nonfiction section draft | 800–1500 | Taxon/Prep + domain refs |
| Nonfiction safety review | 800–1500 | **Safety ReferenceDocs first**; Contraindication/SafetyTopic |

Layer1+2 should stay small (target combined ≤ ~800–1200 tokens) so Layer3 has room.

---

## 5. EntityType allow-list (Phase 0)

Layer3 excerpt `entityType` MUST be one of:

- Fiction: `Character`, `PlotBeat`, `Motif`, `StyleExemplar`
- Shared: `ReferenceDoc`
- Nonfiction: `Taxon`, `Preparation`, `Contraindication`, `SafetyTopic`

**Not** excerpt entityTypes: `ChapterNode`, `QualityFinding`, `ProjectGoal`, `WorldRule`, `TimelineEvent`, `SeriesBible`, `BookState`.  
Use query facets (`filters.chapter`, `filters.projectGoal`, …) and Layer1/2 text instead.

---

## 6. Herbal safety citation rule

For any safety-claiming generation or paste-bridge safety task:

1. Filters SHOULD set `domain: "nonfiction"` and relevant `safetyTopics` / `taxonIds`.
2. Packer MUST prioritize `ReferenceDoc` with `kind: "safety"` (then `domain`, then `citation`).
3. Model instructions: cite only pack refs; if none, refuse invented contraindications.
4. Offline HBF safety gate still runs on paste-back — pack citations are necessary but not sufficient.

---

## 7. Fiction soft-deferred content

`WorldRule` / `TimelineEvent` are **not** Phase 0 entities. Until Engineering unlock:

- Encode durable rules/events as Layer1/2 prose or `ReferenceDoc kind=note|domain`.
- Do not emit them as EvidencePack `entityType` values.

---

## 8. Acceptance checks (docs → later tests)

- [ ] Packer unit: Layer1+2 always non-empty when BookState/SeriesBible (or HBF L1) present.
- [ ] Packer unit: full chapters[] not included even if present on session.
- [ ] `kbEnabled: false` → empty excerpts; Layer1+2 still attached.
- [ ] Safety filter → at least one safety ReferenceDoc wins over lower-score style excerpt when both compete under budget (or explicit safety reservation).
- [ ] PasteBridgePacket with `mode: none` contains same Layer policy as Generate path.

---

## 9. Related

- `/workspace/rag-phase0/docs/architecture/rag/EVIDENCE_PACK.md`
- [BOOK_SCHEMA_1.1_DESIGN.md](./BOOK_SCHEMA_1.1_DESIGN.md) §6  
- [PASTE_BRIDGE_PLAYBOOK.md](./PASTE_BRIDGE_PLAYBOOK.md)
