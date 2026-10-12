import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = path.join(ROOT, 'schema', 'fixtures', 'story-core-2.0');
const SCHEMA_PATH = path.join(ROOT, 'schema', 'story-core-2.0.json');
const NW_S1_EXPECTED = path.join(ROOT, 'NovelWriter', 'fixtures', 'nw-s1', 'expected.json');
const NW_S1_SHA256 = '893ca65ff791c11354849c129f51252a78ff53ef84e9c64577a7423bb60461ec';
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const [key, ...parts] = process.argv[index].replace(/^--/, '').split('=');
  const value = parts.length ? parts.join('=') : process.argv[index + 1]?.startsWith('--') ? '' : process.argv[++index] || '';
  args.set(key, value);
}
let mutation = args.get('mutation')?.toUpperCase();
const schemaMutation = args.get('mutate-schema');
const SECRET_KEY = /^(?:api[_-]?key|apikey|secret|client[_-]?secret|password|passwd|authorization|bearer|access[_-]?token|refresh[_-]?token|id[_-]?token|private[_-]?key|x-api-key)$/i;
const URL_USERINFO = /:\/\/[^/@\s]+:[^/@\s]*@/;
const CASE_SENSITIVE_DENYLIST = '^(?:apiKey|apikey|secret|client[_-]?secret|password|passwd|authorization|bearer|access[_-]?token|refresh[_-]?token|id[_-]?token|private[_-]?key|x-api-key)$';
const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const timeout = setTimeout(() => {
  console.error('FAIL timeout: Story Core contract smoke exceeded 240 seconds');
  process.exit(1);
}, 240_000);

if (!fs.existsSync(SCHEMA_PATH)) {
  console.error('FAIL schema: schema/story-core-2.0.json missing');
  process.exit(1);
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const fixtures = new Map(
  fs.readdirSync(FIXTURES, { recursive: true })
    .filter((file) => file.endsWith('.json'))
    .map((file) => [file.replaceAll(path.sep, '/'), readJson(path.join(FIXTURES, file))])
);
const requiredFixture = (name) => {
  const fixture = fixtures.get(name);
  if (!fixture) throw new Error(`Missing Story Core fixture: ${name}`);
  return fixture;
};
let schema = readJson(SCHEMA_PATH);

if (schemaMutation && schemaMutation !== 'drop-denylist') {
  throw new Error(`Unknown schema mutation: ${schemaMutation}`);
}
if (schemaMutation) mutation = 'M5';
if (mutation && !/^M[1-7]$/.test(mutation)) throw new Error(`Unknown mutation: ${mutation}`);

const mutatedPasses = [];
if (mutation === 'M1') {
  const fixture = structuredClone(requiredFixture('2.0-full.json'));
  fixture.novelData.story.scenes[0].source = 'model';
  mutatedPasses.push(['temporary mutation M1 uses source model', fixture]);
}
if (mutation === 'M2') {
  const fixture = structuredClone(requiredFixture('2.0-minimal.json'));
  fixture.novelData.story.scenes.push({
    id: 'sc_mutation_missing_break_approved',
    chapterId: 'ch_mutation',
    order: 1
  });
  mutatedPasses.push(['temporary mutation M2 omits breakApproved', fixture]);
}
if (mutation === 'M3') {
  const fixture = structuredClone(requiredFixture('token-counts-pass.json'));
  fixture.ext.novelWriter.requestLog[0].apiKey = 'REDACTED-TEST-VALUE';
  mutatedPasses.push(['temporary mutation M3 adds apiKey in an extension array', fixture]);
}

if (mutation === 'M4') {
  schema.$defs.noSecrets.allOf[0].then.patternProperties = {
    [CASE_SENSITIVE_DENYLIST]: false
  };
}

function removeDenylistRefs(node) {
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    if (key === '$ref' && value === '#/$defs/noSecrets') delete node[key];
    else removeDenylistRefs(value);
  }
}

if (mutation === 'M5') removeDenylistRefs(schema);
if (mutation === 'M6') schema.properties.ext.additionalProperties = false;
if (mutation === 'M7') {
  schema.$defs.story.properties.characters = { type: 'array' };
  schema.$defs.story.required.push('characters');
}

function secretLookingValues(value) {
  if (typeof value === 'string') return [value].filter((item) => item.includes('xai-') || item.includes('sk-') || item.includes('Bearer '));
  if (Array.isArray(value)) return value.flatMap(secretLookingValues);
  if (value && typeof value === 'object') return Object.values(value).flatMap(secretLookingValues);
  return [];
}

const permittedRedactionFiles = new Set([
  'secret-export-stripped.json',
  'authorization-export-stripped.json',
  'secret-import-stripped.json'
]);
check(
  'schema and fixture values contain no secret-looking strings',
  secretLookingValues(schema).length === 0 && [...fixtures].every(([name, value]) => {
    const suspicious = secretLookingValues(value);
    if (suspicious.length === 0) return true;
    return permittedRedactionFiles.has(name) && suspicious.every((item) => item.includes('REDACTED-TEST-VALUE'));
  })
);

const ajv = new Ajv2020({ allErrors: true, strict: true });
check('schema meta-validates and compiles in strict mode', ajv.validateSchema(schema));
const validate = ajv.compile(schema);

function failDetails(errors) {
  return (errors || []).map(({ instancePath, keyword, params }) => ({
    instancePath, keyword, params
  }));
}

function expectValid(name, document) {
  const result = validate(document);
  check(name, result, result ? '' : JSON.stringify(failDetails(validate.errors)));
}

function escapePointer(value) {
  return String(value).replaceAll('~', '~0').replaceAll('/', '~1');
}

function expectDenylisted(name, document, pointer) {
  const result = validate(document);
  const found = (validate.errors || []).some((error) => {
    const key = error.params?.propertyName || error.params?.additionalProperty || error.params?.missingProperty;
    return error.instancePath === pointer || `${error.instancePath}/${escapePointer(key || '')}` === pointer;
  });
  check(name, !result && found, result ? 'unexpectedly valid' : JSON.stringify(failDetails(validate.errors)));
}

function stripSecrets(value, pointer = '', foundPointers = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => stripSecrets(item, `${pointer}/${index}`, foundPointers));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    const childPointer = `${pointer}/${escapePointer(key)}`;
    const child = value[key];
    if (SECRET_KEY.test(key) || ((key === 'endpoint' || key === 'url') && typeof child === 'string' && URL_USERINFO.test(child))) {
      delete value[key];
      foundPointers.push(childPointer);
    } else {
      stripSecrets(child, childPointer, foundPointers);
    }
  }
}

const strippedPointers = [];
const importOutput = structuredClone(requiredFixture('secret-import-stripped.json'));
stripSecrets(importOutput, '', strippedPointers);
importOutput.strippedPointers = strippedPointers;
const expectedImport = requiredFixture('secret-import-stripped.expected.json');
check('reference import stripper matches expected document and pointers', equal(importOutput, expectedImport));
const benignApiFixture = structuredClone(requiredFixture('token-counts-pass.json'));
const benignApiBeforeStrip = structuredClone(benignApiFixture);
const benignApiPointers = [];
stripSecrets(benignApiFixture, '', benignApiPointers);
check('reference import stripper preserves benign api and token metadata', equal(benignApiFixture, benignApiBeforeStrip) && benignApiPointers.length === 0);

const passFiles = [
  '2.0-minimal.json',
  '2.0-full.json',
  'hbf-core-only.json',
  'unknown-ext-roundtrip.json',
  'token-counts-pass.json',
  'secret-import-stripped.expected.json'
];
for (const name of passFiles) expectValid(`must pass ${name}`, requiredFixture(name));
for (const [name, fixture] of mutatedPasses) expectValid(name, fixture);

const failFiles = [
  ['secret-export-stripped.json', ['/apiKey', '/ext/bookEditor/apiKey']],
  ['authorization-export-stripped.json', ['/ext/futureTool/headers/Authorization', '/providerConfig/endpoint']],
  ['secret-import-stripped.json', [
    '/apiKey',
    '/novelData/refreshToken',
    '/novelData/story/chapters/0/notes/idToken',
    '/ext/bookEditor/Authorization',
    '/ext/novelWriter/requestLog/0/privateKey',
    '/providerConfig/endpoint'
  ]]
];
for (const [name, pointers] of failFiles) {
  for (const pointer of pointers) expectDenylisted(`must reject ${name} at ${pointer}`, requiredFixture(name), pointer);
}

const denylistedKeys = [
  'apiKey', 'api_key', 'api-key', 'apikey', 'API_KEY', 'APIKEY', 'secret',
  'clientSecret', 'client_secret', 'client-secret', 'password', 'passwd',
  'authorization', 'bearer', 'accessToken', 'access_token', 'access-token',
  'refreshToken', 'refresh_token', 'refresh-token', 'idToken', 'id_token',
  'id-token', 'privateKey', 'private_key', 'private-key', 'x-api-key'
];
for (const key of denylistedKeys) {
  const fixture = structuredClone(requiredFixture('2.0-minimal.json'));
  fixture.ext = { futureTool: { nested: [{ [key]: 'REDACTED-TEST-VALUE' }] } };
  expectDenylisted(`denylist rejects ${key} in nested extension array`, fixture, `/ext/futureTool/nested/0/${escapePointer(key)}`);
}

const unknown = requiredFixture('unknown-ext-roundtrip.json');
check('unknown extension and core keys survive round-trip', equal(JSON.parse(JSON.stringify(unknown)), unknown));
const nwS1Hash = createHash('sha256').update(fs.readFileSync(NW_S1_EXPECTED)).digest('hex');
check('nw-s1 expected fixture hash matches 3259d1e', nwS1Hash === NW_S1_SHA256, nwS1Hash);

const failed = checks.filter((item) => !item.ok);
console.log(`Story Core 2.0 contract smoke${mutation ? ` (${mutation} injected)` : ''}: ${checks.length - failed.length} passed, ${failed.length} failed`);
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}${item.ok ? '' : ` :: ${item.detail}`}`);
}
clearTimeout(timeout);
if (failed.length) process.exitCode = 1;
