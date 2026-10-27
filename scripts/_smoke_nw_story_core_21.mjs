// Story Core 2.1 (NovelWriter C4 / scaffold PLAN-v1.2 §9(a) + character PLAN-v1.2.4 §6a): optional
// novelData.story.chapterPlans[] of chapterPlan/sceneCard. Offline, 0 tokens, no network.
//   node scripts/_smoke_nw_story_core_21.mjs            (TAP: node --test-reporter=tap scripts/_smoke_nw_story_core_21.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S20_PATH = path.join(ROOT, 'schema', 'story-core-2.0.json');
const S21_PATH = path.join(ROOT, 'schema', 'story-core-2.1.json');
const F20 = path.join(ROOT, 'schema', 'fixtures', 'story-core-2.0');
const F21 = path.join(ROOT, 'schema', 'fixtures', 'story-core-2.1');
// sha256 of schema/story-core-2.0.json at main 758b44d. 2.0 is frozen; 2.1 is a new file.
const S20_SHA256 = '0c9b7b9406fcf9ff16a7fe1e3c08ad3fe867d875ac16901cf2fefea89aafe9d9';

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const clone = (v) => structuredClone(v);
const load21 = () => {
  assert.ok(fs.existsSync(S21_PATH), 'schema/story-core-2.1.json is missing');
  return readJson(S21_PATH);
};
const compile = (schema) => {
  const ajv = new Ajv2020({ allErrors: true, strict: true, logger: false });
  assert.ok(ajv.validateSchema(schema), 'schema does not meta-validate: ' + JSON.stringify(ajv.errors));
  return ajv.compile(schema);
};
const errs = (v) => (v.errors || []).map(({ instancePath, keyword, params }) => ({ instancePath, keyword, params }));
const fx21 = (name) => readJson(path.join(F21, name));
const fx20Names = fs.readdirSync(F20).filter((f) => f.endsWith('.json')).sort();

// HBF denylist: the patternProperties key at schema/story-core-2.0.json:253 (read by line, like the HBF drift guards).
const s20Lines = fs.readFileSync(S20_PATH, 'utf8').split('\n');
const m253 = s20Lines[252].match(/^\s*"((?:[^"\\]|\\.)*)": false\s*$/);
const DENYLIST_SRC = m253 ? JSON.parse('"' + m253[1] + '"') : null;
const DENYLIST = DENYLIST_SRC ? new RegExp(DENYLIST_SRC, 'u') : null;
// Stricter NW lint for names the 2.1 schema itself declares: the HBF denylist plus any substring of these stems
// (PLAN-v1.2.4 C4: `tokenBudget` passes the end-anchored denylist but is still discouraged).
const STEMS = ['token', 'apikey', 'secret', 'password', 'passwd', 'bearer', 'authorization', 'credential', 'privatekey', 'accesskey'];
const norm = (k) => k.normalize('NFKC').toLowerCase().replace(/[-_\s\r\n\u2028\u2029]/g, '');
export const nwFieldNameLint = (name) => DENYLIST.test(name) || STEMS.some((s) => norm(name).includes(s));

const declaredNames = (node, out = new Set()) => {
  if (Array.isArray(node)) node.forEach((n) => declaredNames(n, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'properties' && v && typeof v === 'object') Object.keys(v).forEach((n) => out.add(n));
      if (k === 'required' && Array.isArray(v)) v.forEach((n) => out.add(n));
      if (k !== 'patternProperties') declaredNames(v, out);
    }
  }
  return out;
};

test('SC21-00 story-core-2.0.json is untouched (sha256 at main 758b44d)', () => {
  assert.equal(createHash('sha256').update(fs.readFileSync(S20_PATH)).digest('hex'), S20_SHA256);
});

test('SC21-01 2.1 meta-validates and compiles under Ajv2020 strict; $id/title/schemaVersion bumped', () => {
  const s = load21();
  compile(s);
  assert.equal(s.$id, 'schema/story-core-2.1.json');
  assert.equal(s.title, 'AI Book Tools Story Core 2.1');
  assert.deepEqual(s.properties.schemaVersion, { enum: ['2.0', '2.1'] });
});

test('SC21-02 chapterPlans is optional on the shared story def and points at $defs/chapterPlan', () => {
  const s = load21();
  assert.deepEqual(s.$defs.story.properties.chapterPlans, { type: 'array', items: { $ref: '#/$defs/chapterPlan' } });
  assert.ok(!s.$defs.story.required.includes('chapterPlans'));
  assert.deepEqual(s.$defs.sceneCard.required, ['part', 'order', 'beat']);
  assert.equal(s.$defs.sceneCard.additionalProperties, false);
  assert.equal(s.$defs.chapterPlan.additionalProperties, false);
});

test('SC21-03 §6a fixes: outcome adds yes, part allows p1-p4, beat quote rule documented', () => {
  const s = load21();
  const card = s.$defs.sceneCard.properties;
  assert.deepEqual(card.outcome.enum, ['yes', 'no', 'yes-but', 'no-and']);
  assert.deepEqual(card.part.enum, ['p1', 'p2', 'p3', 'p4']);
  assert.deepEqual(s.$defs.chapterPlan.properties.parts.items.properties.id.enum, ['p1', 'p2', 'p3', 'p4']);
  assert.equal(card.beat.pattern, '^[^"\u201C\u201D]*$');
  assert.match(card.beat.description || '', /double quote/i);
  assert.match(card.beat.description || '', /title/i);
});

for (const name of ['2.1-sf-ch2-scene-cards.json', '2.1-nonsf-cozy-mystery.json']) {
  test(`SC21-04 valid fixture ${name}`, () => {
    const v = compile(load21());
    const doc = fx21(name);
    assert.ok(v(doc), JSON.stringify(errs(v)));
  });
}

test('SC21-04b non-SF fixture exercises p3/p4 and outcome yes', () => {
  const scenes = fx21('2.1-nonsf-cozy-mystery.json').novelData.story.chapterPlans[0].scenes;
  assert.ok(scenes.some((c) => c.part === 'p3') && scenes.some((c) => c.part === 'p4'));
  assert.ok(scenes.some((c) => c.outcome === 'yes'));
});

const P = '/novelData/story/chapterPlans/0/scenes/0';
const INVALID = [
  ['invalid-missing-beat.json', P, 'required', (e) => e.params.missingProperty === 'beat'],
  ['invalid-beat-double-quote.json', `${P}/beat`, 'pattern', () => true],
  ['invalid-beat-curly-quote.json', `${P}/beat`, 'pattern', () => true],
  ['invalid-part-p5.json', `${P}/part`, 'enum', () => true],
  ['invalid-outcome.json', `${P}/outcome`, 'enum', () => true],
];
for (const [name, at, keyword, extra] of INVALID) {
  test(`SC21-05 invalid fixture ${name} fails at ${at} (${keyword})`, () => {
    const v = compile(load21());
    assert.equal(v(fx21(name)), false, `${name} validated`);
    assert.ok(errs(v).some((e) => e.instancePath === at && e.keyword === keyword && extra(e)), JSON.stringify(errs(v)));
  });
}

// PLAN-v1.2 §9(e) rejects, as in-memory mutations of the non-SF fixture.
const card0 = (doc) => doc.novelData.story.chapterPlans[0].scenes[0];
const NE = '/novelData/story/chapterPlans/0/scenes/0';
const SE = [
  ['extra property dialogueTurn', (d) => { card0(d).dialogueTurn = 'x'; }, NE, 'additionalProperties'],
  ['order 0', (d) => { card0(d).order = 0; }, `${NE}/order`, 'minimum'],
  ['sourceRef without kind', (d) => { delete card0(d).sourceRefs[0].kind; }, `${NE}/sourceRefs/0`, 'required'],
  ['chapterPlan without scenes', (d) => { delete d.novelData.story.chapterPlans[0].scenes; }, '/novelData/story/chapterPlans/0', 'required'],
];
for (const [label, mut, at, keyword] of SE) {
  test(`SC21-06 §9(e) reject: ${label}`, () => {
    const v = compile(load21());
    const doc = clone(fx21('2.1-nonsf-cozy-mystery.json'));
    mut(doc);
    assert.equal(v(doc), false);
    assert.ok(errs(v).some((e) => e.instancePath === at && e.keyword === keyword), JSON.stringify(errs(v)));
  });
}

test('SC21-07 compat: every 2.0 fixture gets the same verdict under 2.1 as under 2.0, unmodified', () => {
  const v20 = compile(readJson(S20_PATH));
  const v21 = compile(load21());
  assert.ok(fx20Names.length >= 13, `only ${fx20Names.length} 2.0 fixtures`);
  for (const name of fx20Names) {
    const doc = readJson(path.join(F20, name));
    const before = JSON.stringify(doc);
    assert.equal(v21(doc), v20(doc), `${name}: 2.0/2.1 verdicts differ`);
    assert.equal(JSON.stringify(doc), before, `${name} mutated by validation`);
  }
  for (const name of ['2.0-minimal.json', '2.0-full.json', 'hbf-core-only.json', 'unknown-ext-roundtrip.json']) {
    assert.ok(v21(readJson(path.join(F20, name))), `${name} must validate under 2.1`);
  }
  for (const name of fx20Names.filter((n) => n.startsWith('credential-url-') && n !== 'credential-url-pass.json')) {
    assert.equal(v21(readJson(path.join(F20, name))), false, `${name} must stay red under 2.1`);
  }
});

test('SC21-08 schemaVersion: 2.0 and 2.1 accepted, 2.2 rejected', () => {
  const v = compile(load21());
  const doc = clone(fx21('2.1-sf-ch2-scene-cards.json'));
  for (const [ver, ok] of [['2.0', true], ['2.1', true], ['2.2', false]]) {
    doc.schemaVersion = ver;
    assert.equal(v(doc), ok, `${ver}: ${JSON.stringify(errs(v))}`);
  }
});

test('SC21-09 field-name lint: 2.1 carries the HBF denylist from 2.0:253 byte-for-byte', () => {
  assert.ok(DENYLIST_SRC, 'schema/story-core-2.0.json:253 is not the patternProperties denylist line');
  const s = load21();
  assert.deepEqual(Object.keys(s.$defs.noSecrets.allOf[0].then.patternProperties), [DENYLIST_SRC]);
  assert.deepEqual(s.$defs.noSecrets, readJson(S20_PATH).$defs.noSecrets);
});

test('SC21-10 field-name lint: no property name declared by 2.1 is secret-like (denylist or stem)', () => {
  const names = [...declaredNames(load21())];
  assert.ok(names.includes('beatsCovered') && names.includes('quoteHash') && names.includes('wordBudget'));
  assert.deepEqual(names.filter(nwFieldNameLint), []);
  assert.equal(nwFieldNameLint('tokenBudget'), true, 'lint self-check: tokenBudget must be flagged');
});

// Secret-like names the 2.1 schema must reject wherever they appear. apiKeyHint/sessionToken first, then case
// variants, prefixes and substrings not listed in any existing fixture or test.
const SECRET_NAMES = ['apiKeyHint', 'sessionToken', 'APIKEYHINT', 'api_key_hint', 'Api-Key-Hint', 'xApiKeyHint',
  'beatApiKeyNote', 'API\u212AEYHINT', 'SessionTOKEN', 'Session-Token', 'session__token_', 'cardSessionToken',
  'sceneSecretNote', 'beatPassword'];
const LOCATIONS = [
  ['wrapper', (d) => d, ''],
  ['ext.novelWriter', (d) => d.ext.novelWriter, '/ext/novelWriter'],
  ['chapterPlan', (d) => d.novelData.story.chapterPlans[0], '/novelData/story/chapterPlans/0'],
  ['sceneCard', (d) => card0(d), NE],
  ['sceneCard.sourceRefs[0]', (d) => card0(d).sourceRefs[0], `${NE}/sourceRefs/0`],
];
for (const name of SECRET_NAMES) {
  test(`SC21-11 field-name lint rejects ${JSON.stringify(name)} at every depth`, () => {
    assert.equal(nwFieldNameLint(name), true, `${name} not flagged by lint`);
    const v = compile(load21());
    for (const [label, at, ptr] of LOCATIONS) {
      const doc = clone(fx21('2.1-nonsf-cozy-mystery.json'));
      doc.ext = { novelWriter: {} };
      at(doc)[name] = 'REDACTED-TEST-VALUE';
      assert.equal(v(doc), false, `${name} accepted at ${label}`);
      const hit = errs(v).some((e) => e.instancePath === `${ptr}/${name}` && e.keyword === 'false schema');
      assert.ok(hit, `${name} at ${label} not rejected by the denylist (only additionalProperties?): ${JSON.stringify(errs(v))}`);
    }
  });
}

test('SC21-12 mutation: dropping sceneCard additionalProperties:false or the beat pattern turns rejects green', () => {
  const s = load21();
  const extra = clone(fx21('2.1-nonsf-cozy-mystery.json'));
  card0(extra).dialogueTurn = 'x';
  const m1 = clone(s); delete m1.$defs.sceneCard.additionalProperties;
  assert.equal(compile(m1)(extra), true, 'mutation M-AP did not let dialogueTurn through');
  const m2 = clone(s); delete m2.$defs.sceneCard.properties.beat.pattern;
  assert.equal(compile(m2)(fx21('invalid-beat-double-quote.json')), true, 'mutation M-QUOTE did not let a quoted beat through');
  const m3 = clone(s); m3.$defs.sceneCard.properties.outcome.enum = ['no', 'yes-but', 'no-and'];
  assert.equal(compile(m3)(fx21('2.1-nonsf-cozy-mystery.json')), false, 'mutation M-YES: pre-§6a enum still accepts outcome yes');
});
