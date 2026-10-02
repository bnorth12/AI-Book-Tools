# Paste-Bridge Playbook — first-class no-extra-key mode

**Status:** docs-only  
**Date:** 2026-09-27 ~00:12 CDT  
**Primary consumer:** HerbalBookForge (Nonfiction)  
**Shared pattern:** Fiction tools (NovelWriter / BookEditor / BookDecomposer) use the same `PasteBridgePacket` shape  
**Default config:** `providerConfig.mode: "none"`

User already pays Grok Bot + grok.com Chat + Copilot. Paste-bridge is the **supported** path when no tool API key is present — not a workaround.

---

## 1. When to use

Use paste-bridge when **any** of:

- No xAI (or other) API key in the tool Setup panel.
- CoS / user policy: avoid extra xAI API tokens.
- Task fits Bot Fiction/Nonfiction or Chat sticky desk better than in-app Generate.
- Offline / air-gapped editing with later paste-back.
- `providerConfig.mode === "none"` (book-schema-1.1 / HBF export).

Do **not** treat missing key as “silently skip generate” with no export path — surface paste-bridge UI/checklist instead (impl later; this doc defines the contract).

---

## 2. Checklist (HBF — canonical)

1. **Export project** from HBF (native JSON + optional book-1.1 sidecar when available).
2. **Build `PasteBridgePacket`** (app-assisted later; manual OK now):
   - `layer1` — herbal L1 digest: Taxon / Preparation / Contraindication / SafetyTopic + key ReferenceDoc titles/ids (`kind=safety` first).
   - `layer2` — BookState digest: goals, outline digest, draft summaries, `safetyReport` summary, openThreads, lastAcceptedCanon.
   - `layer3` — EvidencePack (or ranked excerpts) for this task’s filters (`safetyTopics`, `taxonIds`, `domain: nonfiction`). Empty allowed if `kbEnabled: false` or no hits.
   - `task` + `instructions` + `returnShape` + `tokenBudgetHint`.
3. **Paste into Chat / Bot desk** using the prompt template below (Layer1+2 always; Layer3 block only if non-empty).
4. **Run model on desk** (user’s existing Bot/Chat spend).
5. **Paste draft / structured result back** into HBF (chapter body → `drafts[]`; safety JSON → validate offline).
6. **Validate / safety offline** in-app (heuristics, disclaimer gates, schema checks) — no network required.
7. **Update BookState** (lastAcceptedCanon, draftSummaries, safetyReportSummary, openThreads).

Fiction trio: same checklist with L1=`SeriesBible` digest, L2=`BookState`, L3=fiction EvidencePack entities; paste back into novelData chapter / improvements fields.

---

## 3. Desk prompt template (skeleton)

```text
# Task
{{task}}   # e.g. draft section | safety review | outline improve

# Return shape
{{returnShape}}

# Layer1 — canon / goals (ALWAYS)
{{layer1}}

# Layer2 — book state (ALWAYS)
{{layer2}}

# Layer3 — EvidencePack excerpts (ONLY if present; do not invent sources)
{{#if layer3}}
{{layer3}}
{{else}}
(No retrieved excerpts. Do not invent citations. Mark gaps explicitly.)
{{/if}}

# Instructions
{{instructions}}
```

**Hard rules in instructions for herbal safety tasks:**

- Prefer / require citations that appear in Layer3 as `ReferenceDoc` with `kind=safety` (or linked SafetyTopic).
- If Layer3 empty: output “insufficient evidence — no safety claim” rather than free-hallucinated contraindications.
- Do not request or assume the full manuscript.

---

## 4. What stays in-app without a key

| Capability | HBF | Fiction tools |
| --- | --- | --- |
| Load / edit goals, outlines, drafts, metadata | Yes | Yes (session JSON / novelData) |
| Import / export project JSON | Yes | Yes (schema import/export) |
| Offline safety / disclaimer edit + local heuristics | Yes | Continuity notes / local quality heuristics where present |
| Assemble Layer1+2 (+ Layer3 if kb local) into PasteBridgePacket | Yes (target) | Yes (target) |
| Paste-back fields + BookState update | Yes | Yes |
| Chapter-split / structure heuristics (no LLM) | If present | Decomposer local split if any |
| Preview / assemble book | Yes | Assemble from chapters |

---

## 5. What must not happen

| Forbidden | Why |
| --- | --- |
| Silently calling xAI (or any remote LLM) when `mode: none` or no key | Violates spend policy; breaks trust |
| Dumping full manuscript / full `drafts[]` / full `chapters[]` into Chat | Breaks coherence budget; defeats layered memory |
| Inventing a second paste packet type per tool | `PasteBridgePacket` is shared |
| Treating paste-bridge as undocumented “advanced” only | It is **first-class** for no-key users |
| Auto-enabling `mode: xai` because kbEnabled is true | `kbEnabled ⊥ provider` |
| Shipping API keys inside exported JSON / PasteBridgePacket | Secrets stay local |

---

## 6. `PasteBridgePacket` shape (normative sketch)

```json
{
  "schemaVersion": "paste-bridge-0.1",
  "workType": "nonfiction",
  "task": "draft",
  "layer1": "…",
  "layer2": "…",
  "layer3": { "schemaVersion": "0.1", "projectId": "…", "query": { "goal": "…" }, "excerpts": [], "graphPath": [], "expandOrNarrow": "hold", "tokenBudgetHint": 1200 },
  "instructions": "…",
  "returnShape": "markdown section for drafts[n].body",
  "tokenBudgetHint": 2000
}
```

`layer3` MAY be an EvidencePack object or a pre-rendered excerpt block; validators should accept both once schema lands. Until then: treat as opaque text + optional JSON attach.

---

## 7. Provider matrix (paste-bridge row)

| `providerConfig.mode` | In-app Generate | Paste-bridge |
| --- | --- | --- |
| `none` | Disabled / hidden | **Primary** |
| `xai` | Allowed if key present | Still useful for sticky long-context desks |
| `ollama` | Local endpoint (P2) | Optional |
| `external` | OpenAI-compat endpoint | Optional |

---

## 8. Related

- [BOOK_SCHEMA_1.1_DESIGN.md](./BOOK_SCHEMA_1.1_DESIGN.md) §3.5–3.4  
- [EVIDENCEPACK_PACKING_POLICY.md](./EVIDENCEPACK_PACKING_POLICY.md)  
- Phase 0: `/workspace/rag-phase0/docs/architecture/rag/EVIDENCE_PACK.md`  
- CoS P0.1: document paste-bridge / Bot-desk mode

## Nonfiction (HBF) — shared pattern

`providerConfig.mode: none` default. Same `PasteBridgePacket` shape as fiction.

### In-app without key
- Setup (credentials unused), Goals / outline edit, Preview, Safety review of **pasted** text, JSON export/import, project state persistence.
- Generate / Drafter / live Safety Agent calls: **disabled or labeled Bridge**.

### Bridge checklist (HBF)
1. Export packet: L1 SeriesBible slice (taxons/safety topics + ReferenceDoc ids) + L2 BookState (goals, outlineSummary, draftSummaries for **selected** chapters, openThreads, safetyReportSummary) + optional L3 EvidencePack.
2. Paste into Grok Bot / grok.com / Copilot with `task` + `expectedOutputShape` (e.g. chapter markdown or JSON draft patch).
3. Paste response into target chapter `draftText` (or goals/outline field).
4. Offline validate: structure, no overclaim; refresh safetyReportSummary only when citing ReferenceDoc ids.
5. Must not: auto-call xAI; dump full `drafts[]`; invent a second citation type.

### Safety task
Prefer `task: safety-review` with L1 safety ReferenceDocs + L2 chapterSummaries only — not full manuscript — then navigate flags back to Drafting offline.
