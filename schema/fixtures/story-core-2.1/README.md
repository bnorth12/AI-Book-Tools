# Story Core 2.1 fixtures

2.1 adds optional `novelData.story.chapterPlans[]` (`$defs/chapterPlan`, `$defs/sceneCard`) from
NovelWriter scaffold PLAN-v1.2 §9(a), with the character PLAN-v1.2.4 §6a fixes (outcome `yes`,
part `p1`-`p4`, documented no-double-quote beat rule). All 2.0 fixtures in `../story-core-2.0/`
must get the same verdict under 2.1. Checked by `scripts/_smoke_nw_story_core_21.mjs`.

| Fixture | Result | What it proves |
| --- | --- | --- |
| `2.1-sf-ch2-scene-cards.json` | Pass | SF chapter plan (TEST DATA: hand-written Quantum Cats ch2 cards, p1/p2) |
| `2.1-nonsf-cozy-mystery.json` | Pass | Non-SF chapter plan: p1-p4, outcome `yes`, subplotBeat, charArcStep, sequel, sourceRefs |
| `invalid-missing-beat.json` | Fail | `beat` is required |
| `invalid-beat-double-quote.json` | Fail | Straight double quote in `beat` |
| `invalid-beat-curly-quote.json` | Fail | Curly double quotes in `beat` |
| `invalid-part-p5.json` | Fail | `part` is limited to `p1`-`p4` |
| `invalid-outcome.json` | Fail | `outcome` outside `yes`/`no`/`yes-but`/`no-and` |

Fixture values are synthetic; none are secrets.
