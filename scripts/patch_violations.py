from dotenv import load_dotenv
load_dotenv()
import os

api_key = os.getenv("XAI_API_KEY")
"""
Patch script for NovelWriter.html:
1. Add Integrate Suggestions button + loading div to Tab 8 HTML
2. Fix V1: suggestStoryInfo overwrites user fields -> guard with existing value
3. Fix V3: API key exposed in Tab 10 -> mask it
4. Fix V4: checkSpellingAndGrammar only shows alert -> apply corrections
5. Fix V6: scrapeBookInfoForCharacters uses hardcoded prompt -> use getAgentPrompt
6. Fix V8: resetState writes API key to localStorage -> remove
7. Fix V9: exportSession strips outline fields -> include them
8. Fix V2/WA8: update requirement comment NW.T7.4 to match actual status values
9. Add 'tab8'/'integrateBreakdown' to defaultPromptCatalog
"""

with open('c:/NovelWriterSite/NovelWriter/NovelWriter.html', encoding='utf-8') as f:
    content = f.read()

original_len = len(content)
patches_applied = []

# ---------------------------------------------------------------
# 1. Tab 8 HTML: add description, loading div, rename button, add Integrate button
# ---------------------------------------------------------------
old = '''\t<div id="tab8" class="tab">
\t\t<h2>Consolidated Breakdown Suggestions</h2>
\t\t<label for="consolidatedCharacters">Characters:</label>'''

new = '''\t<div id="tab8" class="tab">
\t\t<h2>Consolidated Breakdown Suggestions</h2>
\t\t<p>Shows breakdowns for improvements marked <strong>To Incorporate</strong> only. Review the suggestions below, then click <strong>Integrate Suggestions</strong> to apply all breakdowns to your chapters, outlines, and characters.</p>
\t\t<label for="consolidatedCharacters">Characters:</label>'''

if old in content:
    content = content.replace(old, new, 1)
    patches_applied.append('Tab8 description added')
else:
    print('WARN: Tab8 description patch not applied - old text not found')

old2 = '''\t\t<button onclick="populateConsolidatedBreakdowns()">Consolidate Breakdowns</button>
\t\t<button onclick="showTab(7)">Back</button>
\t\t<button onclick="showTab(9)">Next: Request Log</button>
\t</div>'''

new2 = '''\t\t<div class="loading-indicator" style="display:none;">Processing integrations... This may take several minutes for large novels.</div>
\t\t<button onclick="populateConsolidatedBreakdowns()">Refresh Breakdowns</button>
\t\t<button onclick="integrateBreakdownSuggestions()">Integrate Suggestions</button>
\t\t<button onclick="showTab(7)">Back</button>
\t\t<button onclick="showTab(9)">Next: Request Log</button>
\t</div>'''

if old2 in content:
    content = content.replace(old2, new2, 1)
    patches_applied.append('Tab8 Integrate button added')
else:
    print('WARN: Tab8 button patch not applied')

# ---------------------------------------------------------------
# 2. V3: Mask API key in Tab 10 displayElementValues
# ---------------------------------------------------------------
old_key = "    output += `apiKey: ${document.getElementById('apiKey')?.value || ''}\\n\\n`;"
new_key = "    output += `apiKey: ${'*'.repeat((document.getElementById('apiKey')?.value || '').length)}\\n\\n`;"

if old_key in content:
    content = content.replace(old_key, new_key, 1)
    patches_applied.append('V3 API key masked in Tab 10')
else:
    print('WARN: V3 API key mask patch not applied')

# ---------------------------------------------------------------
# 3. V4: checkSpellingAndGrammar - apply corrections instead of only alert
# ---------------------------------------------------------------
old_spell = """    \t\tcallAI(messages, document.getElementById(`tab6`), (response) => {
\t\t    const corrections = response.corrections || response.corrected_text || JSON.stringify(response);
\t\t    alert(`Spelling and Grammar Suggestions for Chapter ${chapterNum}:\\n\\n${corrections}`);
\t\t});"""

new_spell = """    \t\tcallAI(messages, document.getElementById(`tab6`), (response) => {
\t\t    const corrected = response.corrected_text || response.corrections || null;
\t\t    if (corrected && typeof corrected === 'string' && corrected.trim().length > 50) {
\t\t        const contentElement = document.getElementById(`chapterEditContent${chapterNum}`);
\t\t        if (contentElement) {
\t\t            contentElement.value = corrected.trim();
\t\t            syncChapterContent(chapterNum, 'edit');
\t\t        }
\t\t        alert(`Spelling and grammar corrections applied to Chapter ${chapterNum}.`);
\t\t    } else {
\t\t        const suggestions = response.suggestions || response.corrections || JSON.stringify(response);
\t\t        alert(`Spelling and Grammar Suggestions for Chapter ${chapterNum}:\\n\\n${suggestions}\\n\\n(No corrected full text returned — apply manually.)`);
\t\t    }
\t\t});"""

if old_spell in content:
    content = content.replace(old_spell, new_spell, 1)
    patches_applied.append('V4 checkSpelling applies corrections')
else:
    # Try a simpler search
    alert_str = "alert(`Spelling and Grammar Suggestions for Chapter ${chapterNum}:\\n\\n${corrections}`);"
    if alert_str in content:
        old_simple = "        const corrections = response.corrections || response.corrected_text || JSON.stringify(response);\n\t\t    alert(`Spelling and Grammar Suggestions for Chapter ${chapterNum}:\\n\\n${corrections}`);"
        new_simple = """        const corrected = response.corrected_text || null;
\t\t    if (corrected && typeof corrected === 'string' && corrected.trim().length > 50) {
\t\t        const contentElement = document.getElementById(`chapterEditContent${chapterNum}`);
\t\t        if (contentElement) { contentElement.value = corrected.trim(); syncChapterContent(chapterNum, 'edit'); }
\t\t        alert(`Spelling and grammar corrections applied to Chapter ${chapterNum}.`);
\t\t    } else {
\t\t        const suggestions = response.corrections || response.suggestions || JSON.stringify(response);
\t\t        alert(`Spelling and Grammar Suggestions for Chapter ${chapterNum}:\\n\\n${suggestions}\\n\\n(No corrected full text returned — apply manually.)`);
\t\t    }"""
        if old_simple in content:
            content = content.replace(old_simple, new_simple, 1)
            patches_applied.append('V4 checkSpelling applies corrections (simple match)')
        else:
            print('WARN: V4 spelling patch not applied - no match found')
    else:
        print('WARN: V4 spelling patch not applied')

# ---------------------------------------------------------------
# 4. V6: scrapeBookInfoForCharacters - use getAgentPrompt
# ---------------------------------------------------------------
old_scrape = "{ role: 'system', content: 'You are a helpful assistant that identifies character names in story descriptions.' }"
new_scrape = "{ role: 'system', content: getAgentPrompt('tab2', 'scrapeBookInfoForCharacters', 'You are a helpful assistant that identifies character names in story descriptions.') }"

if old_scrape in content:
    content = content.replace(old_scrape, new_scrape, 1)
    patches_applied.append('V6 scrapeBookInfo uses getAgentPrompt')
else:
    print('WARN: V6 scrapeBookInfo patch not applied')

# ---------------------------------------------------------------
# 5. V8: Remove localStorage API key read/write from resetState
# ---------------------------------------------------------------
old_local1 = "document.getElementById('apiKey').value = localStorage.getItem('xaiApiKey') || '';"
new_local1 = "// API key is not persisted to localStorage per NW.GEN8"

if old_local1 in content:
    content = content.replace(old_local1, new_local1, 1)
    patches_applied.append('V8 localStorage read removed from resetState')
else:
    print('WARN: V8 localStorage read not found')

old_local2 = "localStorage.setItem('xaiApiKey', apiKey);"
new_local2 = "// API key not stored to localStorage per NW.GEN8"

if old_local2 in content:
    content = content.replace(old_local2, new_local2, 1)
    patches_applied.append('V8 localStorage write removed')
else:
    print('WARN: V8 localStorage write not found')

# ---------------------------------------------------------------
# 6. V9: exportSession - restore outline fields to export
# ---------------------------------------------------------------
old_export = """    const {
\t\t\t\tnovelOutline: _novelOutline,
\t\t\t\tplotOutline: _plotOutline,
\t\t\t\tstoryArcOutline: _storyArcOutline,
\t\t\t\tbookImprovements: _bookImprovements,
\t\t\t\tchapterImprovements: _chapterImprovements,
\t\t\t\t...exportableNovelData
\t\t\t} = novelData;"""

new_export = """    // NW.GEN5: All novelData fields including outlines are included in the export envelope
\t\t\t\tconst exportableNovelData = { ...novelData };"""

if old_export in content:
    content = content.replace(old_export, new_export, 1)
    patches_applied.append('V9 exportSession includes outline fields')
else:
    # Try without leading spaces
    old_export2 = "const {\n\t\t\t\tnovelOutline: _novelOutline,"
    if old_export2 in content:
        print('WARN: V9 found partial match - manual fix needed')
    else:
        print('WARN: V9 exportSession patch not applied')

# ---------------------------------------------------------------
# 7. V1: suggestStoryInfo - preserve existing field values
# ---------------------------------------------------------------
# Find the callback that overwrites all fields and add guards
old_suggest = "document.getElementById('title').value = response.title;"
new_suggest = "document.getElementById('title').value = response.title || document.getElementById('title').value;"

if old_suggest in content:
    content = content.replace(old_suggest, new_suggest, 1)
    patches_applied.append('V1 suggestStoryInfo title preservation')
else:
    print('WARN: V1 title field patch not applied')

# storyArc
old_arc = "document.getElementById('storyArc').value = response.storyArc;"
new_arc = "document.getElementById('storyArc').value = response.storyArc || document.getElementById('storyArc').value;"
if old_arc in content:
    content = content.replace(old_arc, new_arc, 1)
    patches_applied.append('V1 suggestStoryInfo storyArc preservation')

# generalPlot
old_plot = "document.getElementById('generalPlot').value = response.generalPlot;"
new_plot = "document.getElementById('generalPlot').value = response.generalPlot || document.getElementById('generalPlot').value;"
if old_plot in content:
    content = content.replace(old_plot, new_plot, 1)
    patches_applied.append('V1 suggestStoryInfo generalPlot preservation')

# setting
old_setting = "document.getElementById('setting').value = response.setting;"
new_setting = "document.getElementById('setting').value = response.setting || document.getElementById('setting').value;"
if old_setting in content:
    content = content.replace(old_setting, new_setting, 1)
    patches_applied.append('V1 suggestStoryInfo setting preservation')

# ---------------------------------------------------------------
# 8. Add tab8/integrateBreakdown to defaultPromptCatalog
# ---------------------------------------------------------------
old_catalog_tab7_end = "{ tabId: 'tab7', agentId: 'breakdownImprovement',"
# Find tab8 in catalog or add after tab7 breakdownImprovement entry
# First check if tab8 already exists in catalog
if "'tab8'" in content and "integrateBreakdown" in content and "defaultPromptCatalog" in content:
    # Check if it's already in the catalog
    catalog_idx = content.find('const defaultPromptCatalog')
    tab8_in_catalog_idx = content.find("{ tabId: 'tab8'", catalog_idx)
    if tab8_in_catalog_idx != -1:
        patches_applied.append('tab8 already in defaultPromptCatalog - skipped')
    else:
        # Add tab8 entry after the last tab7 entry
        old_tab7_last = "{ tabId: 'tab7', agentId: 'breakdownImprovement',"
        idx = content.find(old_tab7_last)
        if idx != -1:
            # Find end of this entry (closing brace + comma or just closing brace)
            end_idx = content.find('\n', content.find('}', idx)) + 1
            insert_entry = "\t\t{ tabId: 'tab8', agentId: 'integrateBreakdown', name: 'Integrate Breakdowns', systemPrompt: 'You are a skilled fiction editor. Revise the provided chapter text to incorporate the listed improvements. Return ONLY the revised chapter text with no commentary, headers, or markdown code fences.' },\n"
            content = content[:end_idx] + insert_entry + content[end_idx:]
            patches_applied.append('tab8 integrateBreakdown added to defaultPromptCatalog')
        else:
            print('WARN: Could not find tab7 breakdownImprovement in catalog to insert after')

# ---------------------------------------------------------------
# 9. Update NW.T7.4 requirement comment to match actual status values
# ---------------------------------------------------------------
old_req = "<!-- NW.T7.4: Each improvement row SHALL have a status selector (Pending/Accepted/Rejected/Done), a \"Breakdown\" button that decomposes the improvement into actionable chapter-level steps, and an editable breakdown textarea. -->"
new_req = "<!-- NW.T7.4: Each improvement row SHALL have a status selector (To Incorporate/Incorporated/Ignored), a \"Breakdown\" button that decomposes the improvement into actionable chapter-level steps, and an editable breakdown textarea. -->"

if old_req in content:
    content = content.replace(old_req, new_req, 1)
    patches_applied.append('NW.T7.4 status vocabulary aligned')
else:
    print('WARN: NW.T7.4 requirement comment not found')

# Also update NW.T8.1 to use same vocabulary
old_req8 = '<!-- NW.T8.1: Tab 8 SHALL aggregate all accepted improvement breakdowns across Tab 7 into a single consolidated view. -->'
new_req8 = '<!-- NW.T8.1: Tab 8 SHALL aggregate breakdowns for improvements with status "To Incorporate" from Tab 7 into a single consolidated view. -->'
if old_req8 in content:
    content = content.replace(old_req8, new_req8, 1)
    patches_applied.append('NW.T8.1 status vocabulary aligned')

# ---------------------------------------------------------------
# Write output
# ---------------------------------------------------------------
with open('c:/NovelWriterSite/NovelWriter/NovelWriter.html', 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Original length: {original_len}')
print(f'New length: {len(content)}')
print(f'Patches applied ({len(patches_applied)}):')
for p in patches_applied:
    print(f'  + {p}')
