# Workflow — TechProjectForge

**Default desk:** paste-bridge (`providerConfig.mode: none`) using the shared `PasteBridgePacket` — see `SHARED_CORE_ALIGNMENT.md` and suite `PASTE_BRIDGE_PLAYBOOK.md`.

---

## Getting started (multiple first-class paths)

Pick **one** start method. Repo-ingest is a **required method the engine must support**, not the only allowed entry.

| Start method | What you begin with | First artifacts |
| --- | --- | --- |
| **A. Repo ingest** | One or more git remotes / checkouts | RetrievalIndex → `ReferenceDoc` / `EvidencePack` (`REPO_INGEST.md`); **no full-tree embed** |
| **B. Blank problem / vision** | Author intent only | Problem statement, audience, success/non-goals → L1/L2; packs added later |
| **C. Existing draft / outline import** | Rough MS, TOC, or notes dump | Import → thin BookState map; reverse-outline optional; cite gaps flagged |
| **D. Interview / stakeholder notes** | Transcripts, emails, workshop notes | Theme/openThreads in L2; promote locked facts to L1 after domain confirm |
| **E. Standards / RFCs research-first** | External norms before code | ReferenceDocs (kind standards/rfc); then optional repo ingest for conformance |
| **F. Reverse-outline from rough MS** | Nearly complete prose | ChapterSummaries + missing-pack prompts; do not re-upload full MS each turn |

Record `startMethod` in BookState. Any path still uses L1+L2 always and L3 retrieve only.

---

## Common spine (after start)

Regardless of start method, move toward this spine before heavy chapter prose:

1. **Research / evidence gather** — retrieve or create packs; reconcile with domain owner; no invented APIs/tests.  
2. **Problem statement + top-level scoping docs** — audience, success criteria, book non-goals, evidence boundaries (repos/SHAs **or** “no repo yet”).  
3. **Structure choice** — annotated full outline (**strong default** when it fits) **or** spiral / theme / FAQ / field-guide thin map.  
4. **Draft via paste-bridge** (or later in-app Generate), one scoped turn at a time.  
5. **Promote loop** with quality gate (below).

Annotated outlines remain preferred for handbook / deep-dive / build-log layouts; not mandatory for every book.

---

## SDLC gap-fill (optional coverage — not a forced template)

Across **any** start path, the engine should offer **optional** coverage checks for a full system development lifecycle. Missing phases become **missing-pack prompts** / openThreads — never a requirement that every book cover every phase.

| Phase | Typical pack / doc kinds | Gap-fill prompt (example) |
| --- | --- | --- |
| Needs / problem | vision, stakeholder notes | “Is the problem statement accepted in L1?” |
| Requirements | requirement ReferenceDocs | “Any normative shall without a Requirement pack?” |
| Architecture / design | architecture, icd, adr | “Interfaces cited without ICD/ADR locators?” |
| Implementation | component-note (summaries) | “Claims about code with no path+SHA/symbol?” |
| Test / V&V | test-evidence | “Acceptance claims without test/CI evidence?” |
| Ops / field | soak/field notes | “Field behavior claimed without ops evidence?” |
| Release | release-note, changelog | “Version story without release artifact?” |

**Rules:** gap-fill is **available**, not mandatory. Authors may intentionally omit phases (e.g. field-guide-only). Do not fail promote solely for incomplete SDLC coverage — fail on anti-slop / cite rules for claims that *are* made.

---

## Promote loop (every draft turn)

1. Export `PasteBridgePacket` (task + L1+L2 + optional L3).  
2. Run turn at Grok Bot / grok.com / Copilot.  
3. Paste response into target field.  
4. **Quality gate (P0, fail closed):** anti-slop / interest / readability / human-vs-AI patterns + cite check for claims made (`SHARED_CORE_ALIGNMENT.md`).  
5. **Promote:** accepted prose → L2; locked facts → L1; rejects stay on desk with openThreads updated.  
6. **Optional:** run SDLC gap-fill checklist; add missing-pack prompts without blocking.

---

## Alternatives (structure & desk)

| Path | When | Still required |
| --- | --- | --- |
| Annotated full outline | Default for linear handbooks | Scoping + quality gate |
| Spiral / theme / FAQ / field-guide | Outline-heavy TOC fights the material | Thin map; same packing rules |
| Multi-repo series | Program books | Shared SeriesBible; per-book BookState; ingest remotes when used |
| Optional later in-app Generate | After shared provider adapter | Same packing + gates; mode may be `xai`/`ollama`/`external` |

---

## Desk checklist (short)

- [ ] `startMethod` recorded (A–F or named custom)  
- [ ] Problem statement + scoping docs in L1/L2  
- [ ] Structure choice recorded (annotated outline **or** named alternative)  
- [ ] Packet has no full-repo / full-MS dump  
- [ ] Quality gate passed before promote  
- [ ] (Optional) SDLC gap-fill reviewed; missing packs noted, not forced  
