# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: novelwriter.smoke.spec.js >> SMOKE-01 Additive full end-to-end flow preserves prior tab state
- Location: tests\e2e\novelwriter.smoke.spec.js:113:1

# Error details

```
Error: expect(locator).not.toHaveValue(expected) failed

Locator:  locator('#novelOutline')
Expected: not ""
Received: ""
Timeout:  10000ms

Call log:
  - Expect "not toHaveValue" with timeout 10000ms
  - waiting for locator('#novelOutline')
    13 × locator resolved to <textarea id="novelOutline" placeholder="Generated or manual novel outline"></textarea>
       - unexpected value ""

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - heading "Novel Writer" [level=1] [ref=e2]
  - generic:
    - generic: Execution Status
    - generic: "Function: Idle"
    - generic:
      - text: "State:"
      - generic: Idle
    - generic: Waiting for next action.
  - generic [ref=e3]:
    - button "1. API & Story Info" [ref=e4] [cursor=pointer]
    - button "2. Characters" [ref=e5] [cursor=pointer]
    - button "3. Subplots" [ref=e6] [cursor=pointer]
    - button "4. Outlines" [ref=e7] [cursor=pointer]
    - button "5. Generate Chapters" [ref=e8] [cursor=pointer]
    - button "6. Edit Chapters" [ref=e9] [cursor=pointer]
    - button "7. Book" [ref=e10] [cursor=pointer]
    - button "8. Consolidated Breakdowns" [ref=e11] [cursor=pointer]
    - button "9. Request Log" [ref=e12] [cursor=pointer]
    - button "10. Element Values" [ref=e13] [cursor=pointer]
    - button "11. Agent Prompts" [ref=e14] [cursor=pointer]
    - button "Help" [ref=e15] [cursor=pointer]
  - generic [ref=e16]:
    - heading "Outlines" [level=2] [ref=e17]
    - generic [ref=e18]:
      - generic [ref=e19]: "Novel Outline:"
      - textbox "Novel Outline:" [ref=e20]:
        - /placeholder: Generated or manual novel outline
      - generic [ref=e21]: "Annotated Plot Outline:"
      - textbox "Annotated Plot Outline:" [ref=e22]:
        - /placeholder: Key plot events
      - generic [ref=e23]: "Annotated Story Arc Outline:"
      - textbox "Annotated Story Arc Outline:" [ref=e24]:
        - /placeholder: Thematic/emotional journey
      - generic [ref=e25]: "Chapter Blueprints:"
      - textbox "Chapter Blueprints:" [ref=e26]:
        - /placeholder: Chapter-by-chapter structural plan — generated with Novel Outline
      - generic [ref=e27]: "Improvements to Implement:"
      - textbox "Improvements to Implement:" [ref=e28]:
        - /placeholder: Enter improvements to incorporate into the outlines
      - button "AI Suggest Novel Outline" [active] [ref=e29] [cursor=pointer]
      - button "Incorporate Suggestions" [ref=e30] [cursor=pointer]
    - generic [ref=e31]:
      - button "Main" [ref=e32] [cursor=pointer]
      - button "Chapter 1" [ref=e33] [cursor=pointer]
      - button "Chapter 2" [ref=e34] [cursor=pointer]
      - button "Chapter 3" [ref=e35] [cursor=pointer]
      - button "Chapter 4" [ref=e36] [cursor=pointer]
      - button "Chapter 5" [ref=e37] [cursor=pointer]
      - button "Chapter 6" [ref=e38] [cursor=pointer]
      - button "Chapter 7" [ref=e39] [cursor=pointer]
      - button "Chapter 8" [ref=e40] [cursor=pointer]
      - button "Chapter 9" [ref=e41] [cursor=pointer]
      - button "Chapter 10" [ref=e42] [cursor=pointer]
      - button "Chapter 11" [ref=e43] [cursor=pointer]
      - button "Chapter 12" [ref=e44] [cursor=pointer]
      - button "Chapter 13" [ref=e45] [cursor=pointer]
      - button "Chapter 14" [ref=e46] [cursor=pointer]
      - button "Chapter 15" [ref=e47] [cursor=pointer]
    - button "Back" [ref=e48] [cursor=pointer]
    - 'button "Next: Generate Chapters" [ref=e49] [cursor=pointer]'
```

# Test source

```ts
  195 |     await clickButton(page, 'Suggest Characters');
  196 |     await waitForLLM(page, 'SMOKE Additive Suggest Characters');
  197 | 
  198 |     const charNames = await page.locator('#characterList .charName').evaluateAll(nodes => nodes.map(n => n.value || ''));
  199 |     const hasAnyCharacter = charNames.some(v => v.trim().length > 0);
  200 |     if (!hasAnyCharacter) {
  201 |       const first = page.locator('#characterList .character').first();
  202 |       await first.locator('.charName').fill('Ari Kade');
  203 |       await first.locator('.charBackstory').fill('A systems analyst haunted by a past containment failure.');
  204 |       await first.locator('.charArc').fill('Learns to trust a team under extreme pressure.');
  205 |     }
  206 | 
  207 |     await clickButton(page, 'Add Another Character');
  208 |     await expect(page.locator('#characterList .character')).toHaveCount(7);
  209 | 
  210 |     const lastChar = page.locator('#characterList .character').last();
  211 |     await lastChar.locator('.charName').fill('Kael Voss');
  212 |     await lastChar.locator('.charBackstory').fill('A rogue engineer who sabotaged the failed terraforming experiment.');
  213 |     await lastChar.locator('.charArc').fill('Seeks redemption by becoming the key to containing the anomaly.');
  214 | 
  215 |     // Ensure all character slots are fully populated for downstream additive dependencies.
  216 |     const characterRows = page.locator('#characterList .character');
  217 |     const totalRows = await characterRows.count();
  218 |     for (let i = 0; i < totalRows; i++) {
  219 |       const row = characterRows.nth(i);
  220 |       const nameInput = row.locator('.charName');
  221 |       const backstoryInput = row.locator('.charBackstory');
  222 |       const arcInput = row.locator('.charArc');
  223 | 
  224 |       const currentName = (await nameInput.inputValue()).trim();
  225 |       const currentBackstory = (await backstoryInput.inputValue()).trim();
  226 |       const currentArc = (await arcInput.inputValue()).trim();
  227 | 
  228 |       if (!currentName) {
  229 |         await nameInput.fill(`Character ${i + 1}`);
  230 |       }
  231 |       if (!currentBackstory) {
  232 |         await backstoryInput.fill(`Character ${i + 1} has a critical technical role tied to station containment operations.`);
  233 |       }
  234 |       if (!currentArc) {
  235 |         await arcInput.fill(`Character ${i + 1} moves from uncertainty to decisive collaboration under pressure.`);
  236 |       }
  237 |     }
  238 |   });
  239 | 
  240 |   await runStep('Tab 3 subplots build on prior setup', async () => {
  241 |     await gotoTab(page, 3);
  242 |     await page.fill('#minSubplots', '4');
  243 |     await clickButton(page, 'AI Suggest Subplots');
  244 |     await waitForLLM(page, 'SMOKE Additive Suggest Subplots initial');
  245 |     let subplotCount = await page.locator('#subplotList .subplot-section').count();
  246 |     if (subplotCount < 4) {
  247 |       // Seed minimum deterministic subplots if LLM returns sparse output.
  248 |       for (let i = subplotCount; i < 4; i++) {
  249 |         await clickButton(page, 'Add Another Subplot');
  250 |       }
  251 |       const subplotInputs = page.locator('#subplotList .subplot');
  252 |       const seedTexts = [
  253 |         'Power-grid sabotage threatens containment operations.',
  254 |         'Crew trust fracture between command and engineering.',
  255 |         'External salvage team attempts opportunistic docking.',
  256 |         'A hidden maintenance log reveals prior anomaly exposure.'
  257 |       ];
  258 |       const total = await subplotInputs.count();
  259 |       for (let i = 0; i < Math.min(total, seedTexts.length); i++) {
  260 |         const val = await subplotInputs.nth(i).inputValue();
  261 |         if (!val.trim()) await subplotInputs.nth(i).fill(seedTexts[i]);
  262 |       }
  263 |       subplotCount = await page.locator('#subplotList .subplot-section').count();
  264 |     }
  265 |     expect(subplotCount).toBeGreaterThanOrEqual(4);
  266 | 
  267 |     await clickButton(page, 'Add Another Subplot');
  268 |     await clickButton(page, 'AI Suggest Subplots');
  269 |     await waitForLLM(page, 'SMOKE Additive Suggest Subplots after add');
  270 | 
  271 |     await gotoTab(page, 2);
  272 |     await clickButton(page, 'Refine Characters with Subplots');
  273 |     await waitForLLM(page, 'SMOKE Additive Refine Characters with Subplots');
  274 |     await gotoTab(page, 3);
  275 |   });
  276 | 
  277 |   await runStep('Tab 4 outlines + all chapter outlines/arcs', async () => {
  278 |     // Ensure additive prerequisites are present before outline generation.
  279 |     await gotoTab(page, 1);
  280 |     await expect(page.locator('#storyArc')).not.toHaveValue('');
  281 |     await expect(page.locator('#generalPlot')).not.toHaveValue('');
  282 |     await expect(page.locator('#setting')).not.toHaveValue('');
  283 | 
  284 |     await gotoTab(page, 2);
  285 |     const namesBeforeTab4 = await page.locator('#characterList .charName').evaluateAll(nodes => nodes.map(n => n.value || ''));
  286 |     expect(namesBeforeTab4.some(v => v.trim().length > 0)).toBeTruthy();
  287 | 
  288 |     await gotoTab(page, 3);
  289 |     const subplotCountBeforeTab4 = await page.locator('#subplotList .subplot-section').count();
  290 |     expect(subplotCountBeforeTab4).toBeGreaterThanOrEqual(4);
  291 | 
  292 |     await gotoTab(page, 4);
  293 |     await clickButton(page, 'AI Suggest Novel Outline');
  294 |     await waitForLLM(page, 'SMOKE Additive Suggest Novel Outline');
> 295 |     await expect(page.locator('#novelOutline')).not.toHaveValue('');
      |                                                     ^ Error: expect(locator).not.toHaveValue(expected) failed
  296 | 
  297 |     await page.fill('#outlineImprovements', 'Strengthen the theme of unity vs isolation in each act transition.');
  298 |     await clickButton(page, 'Incorporate Suggestions');
  299 |     await waitForLLM(page, 'SMOKE Additive Incorporate Outline Suggestions');
  300 | 
  301 |     const outlineNavButtons = page.locator('#chapterOutlinesNav button');
  302 |     for (let i = 1; i <= NUM_CHAPTERS; i++) {
  303 |       await expect(outlineNavButtons.nth(i)).toBeAttached();
  304 |       await page.evaluate((chapterNum) => {
  305 |         if (typeof window.showChapterSubpage === 'function') {
  306 |           window.showChapterSubpage(chapterNum);
  307 |         }
  308 |       }, i);
  309 |       await page.waitForTimeout(200);
  310 | 
  311 |       await page.evaluate(async (chapterNum) => {
  312 |         if (typeof window.generateChapterOutline === 'function') {
  313 |           await window.generateChapterOutline(chapterNum);
  314 |         }
  315 |       }, i);
  316 |       await waitForLLM(page, `SMOKE Additive Generate Outline & Arc Ch ${i}`);
  317 | 
  318 |       if ([3, 7, 12].includes(i)) {
  319 |         const impInput = page.locator(`#chapterImprovement${i}`);
  320 |         await impInput.fill(`Deepen the tension and add a character-specific reveal for chapter ${i}.`);
  321 |         await page.evaluate(async (chapterNum) => {
  322 |           if (typeof window.updateChapterOutline === 'function') {
  323 |             await window.updateChapterOutline(chapterNum);
  324 |           }
  325 |         }, i);
  326 |         await waitForLLM(page, `SMOKE Additive Update Outline Ch ${i}`);
  327 |       }
  328 |     }
  329 |   });
  330 | 
  331 |   await runStep('Tab 5 generate all chapters', async () => {
  332 |     await gotoTab(page, 5);
  333 |     for (let i = 1; i <= NUM_CHAPTERS; i++) {
  334 |       const chapterGenNavButtons = page.locator('#chapterGenNav button');
  335 |       await expect(chapterGenNavButtons.nth(i - 1)).toBeAttached();
  336 |       await page.evaluate((chapterNum) => {
  337 |         if (typeof window.showGenChapterSubpage === 'function') {
  338 |           window.showGenChapterSubpage(chapterNum);
  339 |         }
  340 |       }, i);
  341 |       await page.waitForTimeout(200);
  342 | 
  343 |       await page.evaluate(async (chapterNum) => {
  344 |         if (typeof window.generateChapter === 'function') {
  345 |           window.generateChapter(chapterNum);
  346 |         }
  347 |       }, i);
  348 |       await waitForLLM(page, `SMOKE Additive Generate Chapter ${i}`);
  349 | 
  350 |       const content = await page.locator(`#chapterGenContent${i}`).inputValue();
  351 |       expect(content.length).toBeGreaterThan(50);
  352 |     }
  353 |   });
  354 | 
  355 |   await runStep('Tab 6 edit + spell-check chapters', async () => {
  356 |     await gotoTab(page, 6);
  357 |     const half = Math.ceil(NUM_CHAPTERS / 2);
  358 | 
  359 |     for (let i = 1; i <= NUM_CHAPTERS; i++) {
  360 |       const chapterEditNavButtons = page.locator('#chapterEditNav button');
  361 |       await expect(chapterEditNavButtons.nth(i - 1)).toBeAttached();
  362 |       await page.evaluate((chapterNum) => {
  363 |         if (typeof window.showEditChapterSubpage === 'function') {
  364 |           window.showEditChapterSubpage(chapterNum);
  365 |         }
  366 |       }, i);
  367 |       await page.waitForTimeout(200);
  368 | 
  369 |       await expect(page.locator(`#chapterEditContent${i}`)).toBeVisible();
  370 | 
  371 |       if ([2, 8, 14].includes(i)) {
  372 |         const impInput = page.locator(`#chapterEditImprovement${i}`);
  373 |         if (await impInput.count() > 0) {
  374 |           await impInput.fill(`Improve pacing and add stronger sensory detail in chapter ${i}.`);
  375 |         }
  376 |         await page.evaluate(async (chapterNum) => {
  377 |           if (typeof window.updateChapter === 'function') {
  378 |             window.updateChapter(chapterNum);
  379 |           }
  380 |         }, i);
  381 |         await waitForLLM(page, `SMOKE Additive Update Chapter ${i}`);
  382 |       }
  383 | 
  384 |       if (i <= half) {
  385 |         await page.evaluate(async (chapterNum) => {
  386 |           if (typeof window.checkSpellingAndGrammar === 'function') {
  387 |             window.checkSpellingAndGrammar(chapterNum, 'edit');
  388 |           }
  389 |         }, i);
  390 |         await waitForLLM(page, `SMOKE Additive Spell Check Chapter ${i}`);
  391 |       }
  392 |     }
  393 |   });
  394 | 
  395 |   await runStep('Tab 7 book improvements + status + breakdown', async () => {
```