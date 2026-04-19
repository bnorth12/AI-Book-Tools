"""Apply remaining chapterBlueprints patches to NovelWriter.html"""

file_path = 'c:/NovelWriterSite/NovelWriter/NovelWriter.html'
content = open(file_path, encoding='utf-8').read()

# PATCH 2: upgrade the Return-as-JSON line in generateNovelOutlines prompt
old2 = """'Return as JSON: {"novelOutline": "<outline>", "plotOutline": "<plot outline>", "storyArcOutline": "<arc outline>"}.',"""

new2 = """`- Chapter Blueprints: one entry per chapter (1 through ${novelData.numChapters || 10}). For each chapter specify: role (e.g. 'opening setup', 'midpoint reversal', 'climax'), arcStep (the story-arc beat this chapter must advance), subplotPressure (subplots active and what they must accomplish), characterBeats (named characters and the internal shift they undergo), allowedPayoffs (what may be resolved this chapter), and deferredThreads (what must remain open for later chapters). Enforce escalation discipline: early chapters seed and complicate; middle chapters escalate and reframe; late chapters execute payoffs only. Never allow climax-grade resolutions in opening chapters.`,
                'Minimum word counts for depth, reflecting style\\'s tone, structure, and prose for a novel with vivid world, plot, and character synergy.',
                'Return as JSON: {"novelOutline": "<outline>", "plotOutline": "<plot outline>", "storyArcOutline": "<arc outline>", "chapterBlueprints": [{"chapter": 1, "role": "...", "arcStep": "...", "subplotPressure": ["..."], "characterBeats": [{"name": "...", "beat": "..."}], "allowedPayoffs": ["..."], "deferredThreads": ["..."]}]}.',"""

if old2 in content:
    content = content.replace(old2, new2, 1)
    print('P2: applied')
else:
    print('P2: FAILED - searching for fragment...')
    idx = content.find('Return as JSON: {"novelOutline"')
    if idx >= 0:
        print('  Found at:', idx, '| snippet:', repr(content[idx:idx+80]))
    else:
        print('  Not found at all')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Saved.')
