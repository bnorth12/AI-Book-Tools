/**
 * Offline smoke: Agent Skills catalog + pack/validate + system prompt layering.
 * Playwright against live site HTML. No API burn.
 */
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const LIVE = 'file:///C:/NovelWriterSite/NovelWriter/NovelWriter.html';
const FIXTURE = path.resolve('NovelWriter/fixtures/rich-scifi-v1/novelData.seed.json');
const PLAN = 'C:/Users/brian/grok-build-queue/plans/ai-book-tools-2026-09-27/novelwriter';
const OUT = path.join(PLAN, 'SMOKE_AGENT_SKILLS_REPORT.json');

const EXPECTED = [
  'tab1.fetchAuthors','tab1.fetchStyleGuide','tab1.suggestStoryArc','tab1.suggestGeneralPlot',
  'tab1.suggestSetting','tab1.suggestStoryInfo',
  'tab2.scrapeBookInfoForCharacters','tab2.suggestCharacters','tab2.refineCharacters','tab2.enrichCharacters',
  'tab3.suggestSubplots','tab3.enrichSubplots',
  'tab4.generateNovelOutlines','tab4.generateChapterOutline','tab4.updateChapterOutline','tab4.incorporateOutlineSuggestions',
  'tab5.generateChapter','tab5.continuityAudit','tab5.reviseChapterForQuality',
  'tab6.checkSpellingAndGrammar','tab6.updateChapter',
  'tab7.suggestBookImprovements','tab7.breakdownImprovement',
  'tab8.integrateBreakdown'
];

const seed = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
await page.goto(LIVE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof listAgentSkills === 'function' && typeof packSkillInputs === 'function', null, { timeout: 30000 });

const result = await page.evaluate(async ({ data, expected }) => {
  const keys = ['title','genre','storyArc','generalPlot','setting','characters','subplots','world','worldBible','authorStyle','styleGuide','numChapters','chapterLength','novelOutline','plotOutline','storyArcOutline','chapterBlueprints','chapterOutlines','chapters'];
  keys.forEach((k) => { if (data[k] != null) novelData[k] = data[k]; });

  const listed = listAgentSkills().sort();
  const missingSkills = expected.filter((id) => !listed.includes(id));
  const extraSkills = listed.filter((id) => !expected.includes(id));

  const enrichPack = packSkillInputs('tab2.enrichCharacters', { novelData });
  const draftPack = packSkillInputs('tab5.generateChapter', { novelData, chapterNum: 1 });
  const sys = getSkillSystemPrompt('tab2.enrichCharacters', 'BASE');
  const hasAbility = sys.includes('Skill ability:') && sys.includes('Densify EXISTING cast');

  // thin cast should fail castDensity validator
  const thinVal = validateSkillOutput('tab2.enrichCharacters', { characters: novelData.characters || [] }, { novelData });

  const richChars = (novelData.characters || []).slice(0, 3).map((c, i) => ({
    name: c.name || ('Hero' + i),
    backstory: Array(90).fill('word').map((w, n) => w + n).join(' ') + ' motive wound relationship subplot pressure location faction.',
    arc: Array(70).fill('arc').map((w, n) => w + n).join(' ') + ' starting flaw subplot events sensory end-state resolution.'
  }));
  const richVal = validateSkillOutput('tab2.enrichCharacters', { characters: richChars }, { novelData });

  const richSubs = [
    Array(130).fill('thread').map((w, n) => w + n).join(' ') + ' named cast chapter span sensory docks faction stakes resolution.',
    Array(130).fill('thread').map((w, n) => w + n).join(' ') + ' rival arc Lofoten blocks conflict payoff foreshadow.'
  ];
  const subThin = validateSkillOutput('tab3.enrichSubplots', { subplots: novelData.subplots || [] }, { novelData });
  const subRich = validateSkillOutput('tab3.enrichSubplots', { subplots: richSubs }, { novelData });

  // UI hook
  let skillRows = 0;
  if (typeof renderSkillManagerTable === 'function') {
    renderSkillManagerTable();
    skillRows = document.querySelectorAll('#skillManagerBody tr').length;
  }

  return {
    listedCount: listed.length,
    missingSkills,
    extraSkills,
    enrichPackOk: enrichPack.ok,
    enrichPackHasChars: !!(enrichPack.packed && enrichPack.packed.characters),
    draftPackSkill: draftPack.skillId,
    draftMissing: draftPack.missingRequired || [],
    hasAbility,
    thinCastFailed: !thinVal.ok,
    richCastPassed: richVal.ok,
    thinSubFailed: !subThin.ok,
    richSubPassed: subRich.ok,
    skillRows,
    sampleFailures: { thin: thinVal.failures, subThin: subThin.failures }
  };
}, { data: seed, expected: EXPECTED });

await browser.close();

const pass =
  result.missingSkills.length === 0 &&
  result.listedCount >= 24 &&
  result.hasAbility &&
  result.thinCastFailed &&
  result.richCastPassed &&
  result.thinSubFailed &&
  result.richSubPassed &&
  result.skillRows >= 24 &&
  pageErrors.length === 0;

const report = {
  pass,
  label: pass ? 'SMOKE_AGENT_SKILLS PASS' : 'SMOKE_AGENT_SKILLS FAIL',
  pageErrors,
  result,
  expectedCount: EXPECTED.length,
  at: new Date().toISOString()
};
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(report.label);
console.log(JSON.stringify(result, null, 2));
if (pageErrors.length) console.error('PAGE_ERRORS', pageErrors);
process.exit(pass ? 0 : 1);
