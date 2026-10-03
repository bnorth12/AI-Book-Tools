# rich-scifi-v1 — reusable NovelWriter stress fixture

## Purpose
Lean Tracked E2E (2 chapters / 3 characters) stays the PR smoke.
This fixture is **Track B**: bigger world, cast, arcs, and reusable bible content so quality/RAG/edit loops can be evaluated under load without regenerating the world every run.

## Contents
| File | Role |
| --- | --- |
| `novelData.seed.json` | Importable seed (cast, world, arcs, motifs, 8 outlines, 2 chapter digests) |
| `world.md` | Human-readable bible excerpt |
| `manifest.json` | Counts + reuse notes |

## Counts
- **10** characters (incl. motif/mystery)
- **4** subplots
- **8** chapter outlines (digests seeded for Ch1–2 only)
- `seriesId: conduit-cycle` reserved for future SeriesBible / KG (not live yet)
- `kbEnabled: true` so EvidencePack local retrieve exercises denser packs

## How to run (stress)
```bash
# from AI-Book-Tools repo
set NW_E2E_FIXTURE=NovelWriter/fixtures/rich-scifi-v1/novelData.seed.json
node scripts/run-tracked-e2e.mjs
```
When `NW_E2E_FIXTURE` is set, the runner loads the seed after page open (before generate), sets numChapters from seed, and skips suggestStoryInfo / suggestCharacters / suggestSubplots / novel outline regen unless `NW_E2E_REGEN_BIBLE=1`.

Lean mode: omit `NW_E2E_FIXTURE` (default).

## Versioning
Bump to `rich-scifi-v2` if cast/world changes break compare-across-runs. Keep v1 immutable once stress baselines exist.

## Longer chapters (token-burn / quality)
`ash
set NW_E2E_FIXTURE=NovelWriter/fixtures/rich-scifi-v1/novelData.seed.json
set NW_E2E_CHAPTERS=4
set NW_E2E_CHAPTER_LENGTH=3200
set NW_E2E_MAX_TOKENS=14000
set NW_E2E_FORCE_MULTIPASS=1
node scripts/run-tracked-e2e.mjs
`
NW_E2E_CHAPTER_LENGTH maps to product Target Chapter Length (words); half-chapter prompts use a derived band. NW_E2E_MAX_TOKENS raises UI maxTokens so completions are not truncated mid-half.
