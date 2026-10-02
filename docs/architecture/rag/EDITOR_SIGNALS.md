# Editor Signals — Quality Review Mapping

**Maps to:** `scripts/quality_judge.js` rubric; `docs/roadmap/NEXT_CAPABILITY_RELEASE_NOVEL_QUALITY_TODO.md`  
**Persistence:** Later / non-KB — findings may be stored as optional session-export fields in the **quality-editor phase**; `QualityFinding` is **not** a Phase 0 KB `entityType` (Engineering lock 2026-09-16).  
**Surfaces:** BookEditor quality UI; NovelWriter Quality tab (later)

---

## 1. Fiction signals

| Signal | Source | Mitigation | Finding `type` |
| --- | --- | --- | --- |
| Interest / emotionalImpact | quality_judge + pacing heuristics | Suggest stakes / turn rewrite | `interest` / `emotionalImpact` |
| Readability / sceneClarity | quality_judge + local metrics (sentence length, passive density) | Line-revise pass | `readability` / `sceneClarity` |
| Human-vs-AI patterns | Lexical tells (stock metaphors, template openers, name leakage) | Targeted rewrite; reuse HBF author-name guard pattern | `humanVsAi` |
| CharacterConsistency | voiceCard vs chapter text | Voice revise stage | `characterConsistency` |
| ContinuityIntegrity | continuity packets + graph | Continuity finalize stage | `continuityIntegrity` |
| Motif / repetition | Motif graph + n-gram scan | Anti-repetition rewrite | `motifRepetition` |
| proseSpecificity | quality_judge | Concrete detail prompts | `proseSpecificity` |

---

## 2. Finding shape (future persistence — not Phase 0 KB)

Signal docs stay here for quality-editor work. The illustrative object below is a **future / session-export** shape. It is **not** a Phase 0 knowledge-graph entity and MUST NOT be added to `schema/*-0.1.json` entityType enums without a new Engineering lock.

```json
{
  "id": "qf-1",
  "domain": "fiction",
  "type": "characterConsistency",
  "severity": "warn",
  "evidenceRefs": ["char-aria"],
  "chapter": 3,
  "status": "open",
  "message": "VoiceCard taboo phrase appears in chapter 3 dialogue."
}
```

Use `chapter` as a **facet** (number), not a `ChapterNode` id. Link findings to Phase 0 KB entities via `evidenceRefs` (Character / PlotBeat / Motif / …).

Severity:

| severity | Meaning |
| --- | --- |
| `info` | Advisory; no gate |
| `warn` | Should review before export |
| `block` | Feature-flagged hard gate (conservative defaults off until quality-editor phase) |

Status: `open` → `acked` → `resolved`.

---

## 3. Nonfiction / shared safety signals (Phase 5 alignment)

BookEditor shared quality path may later surface factual/safety signals using the **same** finding shape (no parallel finding type; still **not** a Phase 0 KB entity):

| Signal | Source | Notes |
| --- | --- | --- |
| Safety coverage | SafetyTopic + ReferenceDoc kind=safety | Missing evidenceRefs on Contraindication |
| Overclaim / advice tone | Heuristic + optional LLM explain | No medical advice claims in generated copy |
| Citation gaps | Taxon / Preparation without SUPPORTS ReferenceDoc | Retrieve-driven |

Ping Engineering before adding new shared signal `type` strings used across tools.

---

## 4. Mapping to quality_judge.js

Phase 0 does not port code. Contract for later phases:

1. Offline `scripts/quality_judge.js` remains the rubric source of truth for batch/CI scoring.
2. In-browser review (quality-editor phase) ports **concepts** (dimensions + thresholds), not a blind copy-paste of Node-only APIs.
3. When an LLM explain pass is used, it receives EvidencePack / finding context only — never the full manuscript + full KB.
4. Novel-quality multipass pipeline stages (draft → structural → voice → continuity) consume findings per stage; stage isolation avoids over-editing voice.

---

## 5. UI expectations (quality-editor phase+)

- Findings table: type, severity, chapter/entity jump, status, ack control.
- Export gate (optional, flagged): block on unresolved `block` severity.
- Conservative thresholds default **on** for detection, **off** for hard export block until calibrated.
- Feature-flagged; no Phase 0 runtime UI.

---

## 6. Related

- [PHASE0_CONTRACT.md](./PHASE0_CONTRACT.md)
- [ENTITY_MODEL.md](./ENTITY_MODEL.md) §7 Later / non-KB
- Roadmap: `docs/roadmap/RAG_IMPLEMENTATION_TODO.md` Phase 4
