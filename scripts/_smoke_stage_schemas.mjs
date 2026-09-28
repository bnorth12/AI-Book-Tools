/**
 * Offline smoke: stage schemas + bidirectional normalize.
 * Run: node scripts/_smoke_stage_schemas.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, '..', 'NovelWriter', 'NovelWriter.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const begin = html.indexOf('// === STAGE_SCHEMA_BEGIN ===');
const end = html.indexOf('// === STAGE_SCHEMA_END ===');
if (begin < 0 || end < 0) {
  console.error('STAGE_SCHEMA markers missing');
  process.exit(1);
}
const block = html.slice(begin, end + '// === STAGE_SCHEMA_END ==='.length);
// Minimal stubs the schema may call
const sandbox = {
  console,
  window: {},
  NW_DENSITY: { castBackstoryMinWords: 80, castArcMinWords: 60, subplotMinWords: 120, stubCharLimit: 40, outlinePlotMinChars: 120 },
  densityFloorsForBook: () => ({ backstory: 80, arc: 60, subplot: 120 }),
  nwWordCount: (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length,
};
vm.createContext(sandbox);
vm.runInContext(block.replace(/^\t\t/gm, ''), sandbox);

const {
  normalizeInbound, normalizeOutbound, validateAgainstStageSchema,
  schemaPromptLines, exportStageSchemas, getStageSchema, skillIdToStageId
} = sandbox;

let fails = [];
function assert(cond, msg) { if (!cond) fails.push(msg); }

const exported = exportStageSchemas();
assert(exported.schemaVersion === 1, 'schemaVersion');
assert(Object.keys(exported.stages).length >= 10, 'stage count');
assert(getStageSchema('tab2.enrichCharacters').failClosed === true, 'enrich failClosed');
assert(getStageSchema('tab2.suggestCharacters').strict === false, 'suggest soft');
assert(skillIdToStageId('tab1.suggestStoryArc') === 'tab1.storyInfo', 'skill map');

// Alias unwrap: cast → characters, backStory → backstory
const n1 = normalizeInbound('tab2.enrichCharacters', {
  cast: [{ Name: 'Ada', backStory: 'x '.repeat(90), characterArc: 'y '.repeat(70) }]
});
assert(n1.characters && n1.characters.length === 1, 'alias cast');
assert(n1.characters[0].name === 'Ada', 'alias name');
assert(n1.characters[0].backstory.includes('x'), 'alias backstory');
assert(n1.characters[0].arc.includes('y'), 'alias arc');

// chapter-wrapped JSON (the production failure mode)
const inner = JSON.stringify({
  characters: [
    { name: 'Ada', backstory: ('motive wound relation beat '.repeat(20)).trim(), arc: ('subplot pressure world hook '.repeat(15)).trim() },
    { name: 'Bo', backstory: ('motive wound relation beat '.repeat(20)).trim(), arc: ('subplot pressure world hook '.repeat(15)).trim() }
  ]
});
const n2 = normalizeInbound('tab2.enrichCharacters', { chapter: inner, _jsonParseError: true });
assert(n2.characters && n2.characters.length === 2, 'unwrap chapter JSON got ' + (n2.characters||[]).length);

const n3 = normalizeInbound('tab2.enrichCharacters', { chapter: inner }); // without _jsonParseError
assert(n3.characters && n3.characters.length === 2, 'unwrap chapter JSON even without parseError flag');

const vOk = validateAgainstStageSchema('tab2.enrichCharacters', n2, {});
assert(vOk.ok, 'dense cast validates: ' + (vOk.failures||[]).join(','));

const vThin = validateAgainstStageSchema('tab2.enrichCharacters', {
  characters: [{ name: 'Z', backstory: 'short', arc: 'x' }]
}, {});
assert(!vThin.ok && vThin.failClosed, 'thin cast fails closed');

const vSuggest = validateAgainstStageSchema('tab2.suggestCharacters', {
  characters: [{ name: 'Z', backstory: '', arc: '' }]
}, {});
assert(vSuggest.ok, 'suggest allows thin name-only');

const out = normalizeOutbound('tab2.enrichCharacters', {
  characters: [{ name: 'Ada', backstory: 'bio', arc: 'arc1' }],
  subplots: ['thread'],
  title: 'T', genre: 'scifi'
});
assert(out.phase === 'enrich', 'outbound phase');
assert(out.characters[0].name === 'Ada', 'outbound cast');
assert(schemaPromptLines('tab2.enrichCharacters').some(l => /Return JSON only/.test(l)), 'schema prompt');

const nSub = normalizeInbound('tab3.enrichSubplots', { threads: ['a long subplot '.repeat(30)] });
assert(nSub.subplots && nSub.subplots.length === 1, 'subplot alias threads');

if (fails.length) {
  console.error('SMOKE_STAGE_SCHEMAS FAIL');
  fails.forEach(f => console.error(' -', f));
  process.exit(1);
}
console.log('SMOKE_STAGE_SCHEMAS PASS');
console.log(JSON.stringify({
  stages: Object.keys(exported.stages).length,
  enrichRequired: getStageSchema('tab2.enrichCharacters').itemRequired,
  suggestStrict: getStageSchema('tab2.suggestCharacters').strict,
  unwrapChars: n3.characters.length
}));
