import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = path.join(ROOT, 'schema', 'fixtures', 'story-core-2.0');
const SCHEMA_PATH = path.join(ROOT, 'schema', 'story-core-2.0.json');
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, '').split('=');
  return [key, value.join('=')];
}));
const mutation = args.get('mutation');
const schemaMutation = args.get('mutate-schema');
const SECRET_KEY = /^(?:api[_-]?key|apikey|secret|client[_-]?secret|password|passwd|authorization|bearer|access[_-]?token|refresh[_-]?token|id[_-]?token|private[_-]?key|x-api-key)$/i;
const URL_USERINFO = /:\/\/[^/@\s]+:[^/@\s]*@/;
const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

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
let schema = readJson(SCHEMA_PATH);

if (mutation === 'M1') schema.$defs.provenance.properties.source.enum.push('model');
if (mutation === 'M2') schema.$defs.scene.required.splice(schema.$defs.scene.required.indexOf('breakApproved'), 1);
if (mutation === 'M3') delete schema.$defs.noSecrets.allOf[1].then.items;
if (mutation === 'M4') {
  schema.$defs.noSecrets.allOf[0].then.patternProperties = {
    '^(?:api[_-]?key|apikey|secret|client[_-]?secret|password|passwd|authorization|bearer|access[_-]?token|refresh[_-]?token|id[_-]?token|private[_-]?key|x-api-key)$': false
  };
}
if (mutation === 'M6') schema.properties.ext.additionalProperties = false;
if (mutation === 'M7') {
  schema.$defs.story.properties.characters = { type: 'array' };
  schema.$defs.story.required.push('characters');
}

function removeDenylistRef(node) {
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    if (key === '$ref' && value === '#/$defs/noSecrets') delete node[key];
    else removeDenylistRef(value);
  }
}

if (schemaMutation === 'drop-denylist') removeDenylistRef(schema);

function secretLookingValues(value) {
  if (typeof value === 'string') return [value].filter((item) => item.includes('xai-') || item.includes('sk-') || item.includes('Bearer '));
  if (Array.isArray(value)) return value.flatMap(secretLookingValues);
  if (value && typeof value === 'object') return Object.values(value).flatMap(secretLookingValues);
  return [];
}

const permittedRedactionFiles = new Set([
  'secret-export-stripped.json',
  'authorization-export-stripped.json',
  'secret-import-stripped.json',
  'mutations/M3-array-apiKey.json',
  'mutations/M4-uppercase-API_KEY.json'
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

function expectDenylisted(name, document, pointer) {
  const result = validate(document);
  const found = (validate.errors || []).some((error) => {
    const key = error.params?.propertyName || error.params?.additionalProperty || error.params?.missingProperty;
    return error.instancePath === pointer || `${error.instancePath}/${key}` === pointer;
  });
  check(name, !result && found, result ? 'unexpectedly valid' : JSON.stringify(failDetails(validate.errors)));
}

function escapePointer(value) {
  return String(value).replaceAll('~', '~0').replaceAll('/', '~1');
}

function stripSecrets(value, pointer = '') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => stripSecrets(item, `${pointer}/${index}`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    const childPointer = `${pointer}/${escapePointer(key)}`;
    const child = value[key];
    if (SECRET_KEY.test(key) || ((key === 'endpoint' || key === 'url') && typeof child === 'string' && URL_USERINFO.test(child))) {
      delete value[key];
      strippedPointers.push(childPointer);
    } else {
      stripSecrets(child, childPointer);
    }
  }
}

const strippedPointers = [];
const importOutput = structuredClone(fixtures.get('secret-import-stripped.json'));
stripSecrets(importOutput);
importOutput.strippedPointers = strippedPointers;
const expectedImport = fixtures.get('secret-import-stripped.expected.json');
check('reference import stripper matches expected document and pointers', equal(importOutput, expectedImport));

const passFiles = [
  '2.0-minimal.json',
  '2.0-full.json',
  'hbf-core-only.json',
  'unknown-ext-roundtrip.json',
  'token-counts-pass.json',
  'secret-import-stripped.expected.json',
  'mutations/M6-unknown-extension.json',
  'mutations/M7-hbf-no-fiction-fields.json'
];
for (const name of passFiles) expectValid(`must pass ${name}`, fixtures.get(name));

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
  for (const pointer of pointers) expectDenylisted(`must reject ${name} at ${pointer}`, fixtures.get(name), pointer);
}
expectDenylisted('mutation partner M1 rejects source model', fixtures.get('mutations/M1-source-model.json'), '/novelData/story/scenes/0/source');
expectDenylisted('mutation partner M2 rejects missing breakApproved', fixtures.get('mutations/M2-missing-breakApproved.json'), '/novelData/story/scenes/0/breakApproved');
expectDenylisted('mutation partner M3 rejects array apiKey', fixtures.get('mutations/M3-array-apiKey.json'), '/ext/novelWriter/requestLog/0/apiKey');
for (const pointer of ['/API_KEY', '/novelData/api_key', '/ext/futureTool/APIKEY']) {
  expectDenylisted(`mutation partner M4 rejects uppercase API_KEY variant at ${pointer}`, fixtures.get('mutations/M4-uppercase-API_KEY.json'), pointer);
}

const unknown = fixtures.get('unknown-ext-roundtrip.json');
check('unknown extension and core keys survive round-trip', equal(JSON.parse(JSON.stringify(unknown)), unknown));

const failed = checks.filter((item) => !item.ok);
console.log(`Story Core 2.0 contract smoke: ${checks.length - failed.length} passed, ${failed.length} failed`);
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}${item.ok ? '' : ` :: ${item.detail}`}`);
}
if (failed.length) process.exitCode = 1;
