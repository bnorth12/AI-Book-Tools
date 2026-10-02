# Vision — TechProjectForge

## Problem

Technical projects accumulate truth in repos (ICD, ARCHITECTURE, requirements, design notes, code, tests, CI) while books and guides are written separately and drift. HerbalBookForge covers herbal nonfiction; it is the wrong domain model for engineering handbooks. Fiction tools (NovelWriter et al.) already invest in layered memory, paste-bridge, and anti-slop — TBF should **reuse that core**, not fork it.

## Product

A reusable **technical-project nonfiction engine** that authors books (or series) by citing living project artifacts. Multi-project over time. **GNSS / ground stations / roamers (RTK)** is the first *content* series only — not the product name and not a hard-coded vertical.

## Audience

- Builder-authors who already live in git and want a handbook / deep-dive / field guide without retyping the repo into Chat each time
- Domain owners who must keep technical claims honest
- Readers who need operable specificity (citeable paths, interfaces, test evidence), not blog-shaped filler

## Book shapes (examples)

| Shape | When |
| --- | --- |
| Field guide / operator handbook | Procedures, checklists, failure modes |
| Architecture deep-dive | System context, ICDs, ADRs |
| Build log → polished book | Chronological program narrative |
| Multi-repo program series | Shared SeriesBible; per-book BookState |
| Spiral / theme / FAQ | When a full annotated outline does not fit (see `WORKFLOW.md`) |

## Success

- Chapters cite EvidencePack / ReferenceDoc ids from the repo
- Promote to L1/L2 only after quality gate (same P0 anti-slop bar as fiction/herbal)
- Works for **any** technical project (firmware, cloud, agent platforms, farm hardware)
- Default path: paste-bridge (Bot / Chat / Copilot); no extra xAI console key
- Shared packing + packet + provider policy with the rest of AI-Book-Tools (`SHARED_CORE_ALIGNMENT.md`)
