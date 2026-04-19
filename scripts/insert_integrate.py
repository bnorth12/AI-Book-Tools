import re

with open('c:/NovelWriterSite/NovelWriter/NovelWriter.html', encoding='utf-8') as f:
    content = f.read()

marker = '\t\t\t// Tab 10 debug values population'

new_func = """
\t\t    // ---- NW.T8: Integrate Suggestions Function ----
\t\t    // NW.T8.F3: integrateBreakdownSuggestions() SHALL gather all "To Incorporate" breakdowns, apply chapter content changes chapter-by-chapter via one LLM call per chapter, append outline notes, then flip each processed improvement status to "Incorporated".
\t\t    // NW.T8.F4: integrateBreakdownSuggestions() SHALL skip chapters that have no breakdown instructions targeting them.
\t\t    // NW.T8.F5: integrateBreakdownSuggestions() SHALL update novelData.chapters, sync Tab 5 and Tab 6 textareas, update the Book tab, and refresh Tab 7 status dropdowns after all integrations complete.
\t\t    async function integrateBreakdownSuggestions() {
\t\t        collectData();

\t\t        const toIntegrate = novelData.bookImprovementsWithStatus
\t\t            .map((item, idx) => ({ ...item, _idx: idx }))
\t\t            .filter(item => item.status === 'To Incorporate' && item.breakdown);

\t\t        if (toIntegrate.length === 0) {
\t\t            alert('No "To Incorporate" breakdowns found. Use the Breakdown button on Tab 7 to generate breakdowns first, then return here.');
\t\t            return;
\t\t        }

\t\t        const tab8El = document.getElementById('tab8');
\t\t        const loadingDiv = tab8El.querySelector('.loading-indicator');
\t\t        if (loadingDiv) loadingDiv.style.display = 'block';

\t\t        const numChapters = novelData.numChapters || novelData.chapters.length;
\t\t        let integratedCount = 0;

\t\t        try {
\t\t            // Integrate chapter content: one LLM call per chapter
\t\t            for (let chNum = 1; chNum <= numChapters; chNum++) {
\t\t                const chKey = 'Chapter ' + chNum;
\t\t                const chapterInstructions = toIntegrate
\t\t                    .filter(item => item.breakdown.chapters && item.breakdown.chapters[chKey])
\t\t                    .map(item => '- ' + item.text + ':\\n  ' + item.breakdown.chapters[chKey])
\t\t                    .join('\\n');

\t\t                if (!chapterInstructions) continue;

\t\t                const currentText = novelData.chapters[chNum - 1] || '';
\t\t                if (!currentText.trim()) continue;

\t\t                const messages = [
\t\t                    { role: 'system', content: getAgentPrompt('tab8', 'integrateBreakdown', 'You are a skilled fiction editor. Revise the provided chapter text to incorporate the listed improvements. Return ONLY the revised chapter text with no commentary, headers, or markdown code fences.') },
\t\t                    { role: 'user', content: 'Revise ' + chKey + ' of the ' + (novelData.genre || '') + ' novel "' + (novelData.title || 'Untitled') + '" to incorporate these improvements:\\n\\n' + chapterInstructions + '\\n\\nCurrent ' + chKey + ' text:\\n' + currentText }
\t\t                ];

\t\t                requestLog.originTab = 'tab8';
\t\t                const revisedText = await new Promise((resolve) => {
\t\t                    callAI(messages, tab8El, (response) => {
\t\t                        if (typeof response === 'string') resolve(response.trim());
\t\t                        else if (response && response.content) resolve(String(response.content).trim());
\t\t                        else if (response && response.revised_chapter) resolve(String(response.revised_chapter).trim());
\t\t                        else resolve(currentText);
\t\t                    }, { operationName: 'Integrate Ch.' + chNum, max_tokens: 30000 });
\t\t                }).catch(err => { console.error('Error integrating ' + chKey + ':', err); return null; });

\t\t                if (revisedText && revisedText.trim() && revisedText !== currentText) {
\t\t                    novelData.chapters[chNum - 1] = revisedText;
\t\t                    const genEl = document.getElementById('chapterContent' + chNum);
\t\t                    if (genEl) genEl.value = revisedText;
\t\t                    const editEl = document.getElementById('chapterEditContent' + chNum);
\t\t                    if (editEl) editEl.value = revisedText;
\t\t                    integratedCount++;
\t\t                }
\t\t            }

\t\t            // Append chapter outline integration notes to Tab 4 textareas
\t\t            for (let chNum = 1; chNum <= numChapters; chNum++) {
\t\t                const chKey = 'Chapter ' + chNum;
\t\t                const outlineNotes = toIntegrate
\t\t                    .filter(item => item.breakdown.chapterOutlines && item.breakdown.chapterOutlines[chKey])
\t\t                    .map(item => item.breakdown.chapterOutlines[chKey])
\t\t                    .join('\\n');
\t\t                if (!outlineNotes) continue;
\t\t                const existingOutline = novelData.chapterOutlines[chNum - 1] || '';
\t\t                const updatedOutline = existingOutline ? existingOutline + '\\n\\n[Integration Notes]\\n' + outlineNotes : outlineNotes;
\t\t                novelData.chapterOutlines[chNum - 1] = updatedOutline;
\t\t                const outlineEl = document.getElementById('chapterOutline' + chNum);
\t\t                if (outlineEl) outlineEl.value = updatedOutline;
\t\t            }

\t\t            // Append novel outline integration notes
\t\t            const novelOutlineNotes = toIntegrate
\t\t                .filter(item => item.breakdown.novelOutlines)
\t\t                .map(item => typeof item.breakdown.novelOutlines === 'string'
\t\t                    ? item.breakdown.novelOutlines
\t\t                    : (Array.isArray(item.breakdown.novelOutlines)
\t\t                        ? item.breakdown.novelOutlines.join('\\n')
\t\t                        : JSON.stringify(item.breakdown.novelOutlines)))
\t\t                .join('\\n');
\t\t            if (novelOutlineNotes) {
\t\t                const existing = novelData.novelOutline || '';
\t\t                const updated = existing ? existing + '\\n\\n[Integration Notes]\\n' + novelOutlineNotes : novelOutlineNotes;
\t\t                novelData.novelOutline = updated;
\t\t                const el = document.getElementById('novelOutline');
\t\t                if (el) el.value = updated;
\t\t            }

\t\t            // Flip status to Incorporated for all processed improvements
\t\t            toIntegrate.forEach(item => { novelData.bookImprovementsWithStatus[item._idx].status = 'Incorporated'; });

\t\t            // Refresh Tab 7 status dropdowns
\t\t            const tableBody = document.getElementById('improvementsTableBody');
\t\t            if (tableBody) {
\t\t                const mainRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => row.querySelector('select'));
\t\t                mainRows.forEach((row, idx) => {
\t\t                    const item = novelData.bookImprovementsWithStatus[idx];
\t\t                    if (item) { const sel = row.querySelector('select'); if (sel) sel.value = item.status; }
\t\t                });
\t\t            }

\t\t            updateBookTab();
\t\t            populateConsolidatedBreakdowns();
\t\t            alert('Integration complete. ' + integratedCount + ' chapter(s) revised. ' + toIntegrate.length + ' improvement(s) marked as Incorporated.');

\t\t        } catch (err) {
\t\t            console.error('Integration error:', err);
\t\t            alert('Integration failed partway through. Check console for details. Chapters processed so far have been saved.');
\t\t        } finally {
\t\t            if (loadingDiv) loadingDiv.style.display = 'none';
\t\t        }
\t\t    }


"""

idx = content.find(marker)
if idx == -1:
    print('ERROR: marker not found')
else:
    new_content = content[:idx] + new_func + content[idx:]
    with open('c:/NovelWriterSite/NovelWriter/NovelWriter.html', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('Done. New length:', len(new_content))
