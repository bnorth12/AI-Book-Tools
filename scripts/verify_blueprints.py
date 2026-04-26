from dotenv import load_dotenv
load_dotenv()
import os

api_key = os.getenv("XAI_API_KEY")
import re
content = open('c:/NovelWriterSite/NovelWriter/NovelWriter.html', encoding='utf-8').read()

checks = [
    ('P1 state init', 'chapterBlueprints: [],'),
    ('P2 prompt blueprints req', '- Chapter Blueprints: one entry per chapter'),
    ('P2 prompt JSON schema updated', r'chapterBlueprints.*chapter.*role.*arcStep'),
    ('P3 parse and store', 'novelData.chapterBlueprints = outlines.chapterBlueprints'),
    ('P3 console warn fallback', 'no chapterBlueprints in response'),
    ('P4 blueprint injection', 'novelData.chapterBlueprints.find(b => b.chapter === chapterNum)'),
    ('Tab4 UI textarea', 'id="chapterBlueprints"'),
    ('No dup Minimum word counts', None),
]

for name, pat in checks:
    if pat is None:
        ok = content.count('Minimum word counts for depth') == 1
    elif '.*' in pat or '\\' in pat:
        ok = bool(re.search(pat, content))
    else:
        ok = pat in content
    print(f'{name}: {"OK" if ok else "FAIL"}')
