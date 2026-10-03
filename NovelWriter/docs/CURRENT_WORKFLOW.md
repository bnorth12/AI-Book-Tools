


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
4. Each chapter runs `generateChapter(n, { batch: true })`, so the PR1 gate applies to chapters n and n+1. A gate, coverage, provider or Part 1/2 parse failure stops the run and records `novelData.batchRun.stoppedAt / reason / detail`. Provider errors (HTTP 429/5xx, network) get one retry after 2 s. Other provider errors (HTTP 400/401/403, missing API key) stop with reason `provider` and no retry; 401/403/missing key say "Check your API key in Setup". A parse failure (including callAI's `_jsonParseError` marker) stops with reason `parse` and no retry. Resume after a parse or provider stop regenerates that chapter (only a coverage stop is skipped). A coverage stop with "Regenerate existing" on restores the old text and keeps the rejected draft in `batchRun.rejectedDraft` (latest only; in the session export, never in the checkpoint). Quality-gate errors are noted on the status line and the run continues.
5. An IndexedDB checkpoint is written to db `novelwriter`, store `checkpoints`, when a chapter starts and when it finishes. The key is the title plus `startedAt`, and the apiKey is not saved. If a write fails (including the final one after the last chapter), the run stops with reason `checkpoint` and shows "Checkpoint failed: run stopped. Export your session now."
6. While a run is active, per-chapter Generate, the Tab 6 editors, Update Chapter / Spelling, import and `resetState` are locked, as are `numChapters`, Tab 7 Apply and Tab 8 Integrate Suggestions. A run will not start while another AI request is in flight. After a reload, "Restore interrupted batch run" brings the run back; the in-flight chapter is not done and Resume continues from it.
7. The cap is checked against the real `tokenUsage` delta after every chapter and again before each chapter ("Token cap reached (used/cap). Raise the cap to continue.", no provider call). Resume keeps the run's saved cap, also after restore or import, unless you edit the cap. The estimate is used only when the provider returned no usage, and that chapter is listed in `usageEstimated`. The session is auto-exported once when the run stops or a checkpoint write fails; a clean finish does not export. Per-chapter downloads are opt-in.
8. No alert, confirm or prompt opens during a batch: `nwNotify` sends those messages to the status line. Single-chapter Generate still alerts as before.
9. AI call timeout (slot 8b, plan §3a): <!-- NW.GEN.TO.1 --> every `callAI` request is aborted with an AbortController after **Setup (Advanced) > AI call timeout (s)** (default 300 s; page setting, not saved in the session). The HUD shows "Timed out after N s (operation)" and the request log row is marked failed. <!-- NW.GEN.TO.2 --> A response that arrives after the abort is ignored: it never writes a chapter or a usage row, and `activeAICallCount` returns to 0. In a batch a timeout is a retryable provider failure: one retry after 2 s, then the run stops with reason `provider`, detail `timeout` ("Stopped at chN (provider): timeout. Part P timed out after N s (operation) twice (1 retry); Resume regenerates chN."). Usage already recorded for the chapter counts as before; no dialogs.
10. Progress: <!-- NW.GEN.HUD.4 --> while a call is in flight the HUD shows its elapsed time and which call it is ("Waiting on LLM response... 1m 05s (Part 1 of 2)"). <!-- NW.T5.13 --> Under the batch status line a sub-step line shows "Chapter n of N: Part 1 (call 1 of 2) / Part 2 (call 2 of 2) / audit / revise (revise a/max)" with the elapsed time; it clears when the run ends. Stop lines end in one period, and a 401/403/missing-key stop says "not retried" once: "Stopped at ch2 (provider): Part 1 provider error (HTTP 401, not retried): Check your API key in Setup. Resume regenerates ch2."
