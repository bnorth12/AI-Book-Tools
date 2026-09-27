# EvidencePack — Local Retrieve Contract v0.1

**Schema:** `schema/evidence-pack-0.1.json`  
**Shared type:** `EvidencePack` (only shared retrieve object — no parallel pack types)  
**Pattern:** Local retrieve → pack → remote LLM complete from pack only

---

## 1. Purpose

An EvidencePack is a **bounded, ranked set of excerpts** built locally from the project knowledge graph and source index. Generation prompts receive this pack — not the full KB, not the full novel session dump.

Rules:

1. Retrieval builds EvidencePack **locally** (keyword + optional embeddings later).
2. Generation prompts receive EvidencePack excerpts only.
3. `kbEnabled` toggle is independent of API provider / model selection.
4. Recommend / retrieve / expand-or-narrow along goals: genre, chapter theme, character, safety topic (herbal), motif.

---

## 2. Shape

```json
{
  "schemaVersion": "0.1",
  "projectId": "string",
  "query": {
    "goal": "string",
    "filters": {
      "genre": "",
      "chapter": 0,
      "characterIds": [],
      "themes": [],
      "domain": "fiction",
      "projectGoal": "",
      "safetyTopics": [],
      "taxonIds": []
    }
  },
  "excerpts": [
    {
      "refId": "string",
      "entityType": "Character",
      "text": "string",
      "score": 0.0,
      "citations": ["string"]
    }
  ],
  "graphPath": ["entityId", "..."],
  "expandOrNarrow": "hold",
  "tokenBudgetHint": 0
}
```

### Field notes

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Always `"0.1"` for this contract |
| `projectId` | Owning project / session id |
| `query.goal` | Natural-language retrieve goal |
| `query.filters` | Structured narrowers (fiction + nonfiction fields coexist; unused keys omitted or empty) |
| `excerpts[].refId` | Source entity or ReferenceDoc id |
| `excerpts[].entityType` | Discriminator — see enum below |
| `excerpts[].text` | Trimmed excerpt for the prompt |
| `excerpts[].score` | Local relevance score (higher = better) |
| `excerpts[].citations` | Optional provenance strings / ReferenceDoc ids |
| `graphPath` | Ordered neighbor walk that justified inclusion |
| `expandOrNarrow` | `expand` \| `narrow` \| `hold` — next retrieve hint |
| `tokenBudgetHint` | Soft cap for total excerpt tokens injected into the prompt |

---

## 3. entityType enum (required)

EvidencePack excerpts MUST use one of:

**Fiction (Phase 0 KB):** `Character`, `PlotBeat`, `Motif`, `StyleExemplar`  
**Shared:** `ReferenceDoc` (graph); `EvidencePack` is this pack contract itself (not an excerpt entityType)  
**Nonfiction:** `Taxon`, `Preparation`, `Contraindication`, `SafetyTopic`

**Not Phase 0 excerpt entityTypes** (later / non-KB): `ChapterNode`, `QualityFinding`, `ProjectGoal`. Use `filters.chapter` and `filters.projectGoal` as query facets instead.

No aliases. If a new type is needed, ping Engineering first and bump schema deliberately.

---

## 4. Token budget & ranking

1. Rank excerpts by score descending.
2. Greedily include until `tokenBudgetHint` would be exceeded (estimate ~4 chars/token or project tokenizer).
3. Prefer higher-score + shorter excerpts when near budget.
4. Always prefer `ReferenceDoc` with `kind: "safety"` when filters include safety topics (nonfiction) — do not drop safety for style fluff.
5. Log pack size (excerpt count + estimated tokens) in requestLog when wiring Phase 3+.

Default recommendation (tunable later): fiction chapter draft ~1500–2500 tokens; nonfiction safety-aware section ~800–1500 tokens.

---

## 5. Expand / narrow / hold

| Mode | Behavior |
| --- | --- |
| `expand` | Widen filters (more neighbors on `graphPath`, relax theme/character) |
| `narrow` | Tighten to current characterIds / chapter / safetyTopics / taxonIds |
| `hold` | Reuse current filter set; re-rank only |

UI surfaces (Phase 3+) expose recommend actions: "narrow to this character", "expand motif", "focus safety topic".

---

## 6. kbEnabled orthogonality

| `kbEnabled` | Provider | Result |
| --- | --- | --- |
| `true` | any | Build EvidencePack; inject into prompt |
| `false` | any | Empty pack (`excerpts: []`); fall back to current session-field prompting |
| `true` / `false` | local mock / remote API | Behavior identical w.r.t. pack construction |

KB never implies a particular model vendor.

---

## 7. Empty / error packs

- Empty excerpts with `kbEnabled: true` is valid (no hits) — generation proceeds with a "no references" note, not a full dump.
- Malformed packs MUST fail schema validation in tests; runtime should refuse to inject unvalidated packs once Phase 1 lands.

---

## 8. Related

- [PHASE0_CONTRACT.md](./PHASE0_CONTRACT.md)
- [ENTITY_MODEL.md](./ENTITY_MODEL.md)
- [SOURCE_ORG.md](./SOURCE_ORG.md)
- Sample: `schema/samples/rag/minimal-evidence-pack.json`
