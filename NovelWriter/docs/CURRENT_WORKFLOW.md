


## Agent Skills (I/O around prompts)

Skills sit between Tab11 system prompts and callAI:

1. `packSkillInputs(skillId, ctx)` binds digests / floors / blueprints / evidence into user content.
2. `getSkillSystemPrompt(skillId)` = system prompt + skill ability.
3. `validateSkillOutput(skillId, response)` runs declared validators (density, obligations, …).

Full catalog covers Pass0 invent → enrich → outlines → draft → continuity → QE/edit → improvements.
Fail-closed gates (density / Tab5 readiness / obligation coverage) remain authoritative over soft skill validation warnings.

## Generate All Chapters (Tab 5, optional)

`generateAllChapters()` drafts prose for chapters that already have outlines. It does not generate outlines; the per-chapter Generate buttons stay. See `NW_GENERATE_ALL_SPEC` (slot 8) and `scripts/_smoke_nw_generate_all.mjs`.

1. Preflight, with no API calls: `assertAdvanceToTab5ReadinessOrThrow` checks all chapters, plus the 80-word chapter outline floor for each planned chapter. On a failure the run does not start. The status line lists the deduped failures, names **Enrich Chapter Blueprints (six beats)** when beats fail, and shows Go to Tab 4.
2. Plan: chapters in the from/to range. Chapters that already have text are skipped unless "Regenerate existing chapters" is on.
3. Estimate: the mean real tokens per batch chapter in this session, or `maxTokens x (2 + audit + maxAutoPasses)`. The token cap defaults to `ceil(estimate x 1.25)` and can be edited.
4. Each chapter runs `generateChapter(n, { batch: true })`, so the PR1 gate applies to chapters n and n+1. A gate, coverage, provider or Part 1/2 parse failure stops the run and records `novelData.batchRun.stoppedAt / reason / detail`. Provider errors (HTTP 429/5xx, network) get one retry after 2 s. Quality-gate errors are noted on the status line and the run continues.
5. An IndexedDB checkpoint is written to db `novelwriter`, store `checkpoints`, when a chapter starts and when it finishes. The key is the title plus `startedAt`, and the apiKey is not saved. If a write fails, the run stops and shows "Checkpoint failed: run stopped. Export your session now."
6. While a run is active, per-chapter Generate, the Tab 6 editors, Update Chapter / Spelling, import and `resetState` are locked. After a reload, "Restore interrupted batch run" brings the run back; the in-flight chapter is not done and Resume continues from it.
7. The cap is checked against the real `tokenUsage` delta after every chapter. The estimate is used only when the provider returned no usage, and that chapter is listed in `usageEstimated`. There is one session export at the end or on any stop. Per-chapter downloads are opt-in.
8. No alert, confirm or prompt opens during a batch: `nwNotify` sends those messages to the status line. Single-chapter Generate still alerts as before.
