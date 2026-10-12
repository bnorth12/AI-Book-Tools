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

if (mutation === 'M6') {
  schema.properties.ext.additionalProperties = false;
}
if (mutation === 'M7') {
  schema.properties.novelData.properties.story.required.push('characters');
}

function removeDenylistRef(node) {
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    if (key === '$ref' && value === '#/$defs/noSecrets') delete node[key];
    else removeDenylistRef(value);
  }
}

if (schemaMutation === 'drop-denylist') removeDenylistRef(schema);

function valuesHaveSecretLookingText(value) {
  if (typeof value === 'string') {
    return value.includes('xai-') || value.includes('sk-') || value.includes('Bearer ');
  }
  if (Array.isArray(value)) return value.some(valuesHaveSecretLookingText);
  if (value && typeof value === 'object') return Object.values(value).some(valuesHaveSecretLookingText);
  return false;
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
  !valuesHaveSecretLookingText(schema) && [...fixtures].every(([name, value]) => {
    if (!valuesHaveSecretLookingText(value)) return true;
    return permittedRedactionFiles.has(name) && JSON.stringify(value).includes('REDACTED-TEST-VALUE');
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
    const key = error.params?.propertyName || error.params?.additionalProperty;
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
  'secret-import-stripped.expected.json'
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

const unknown = fixtures.get('unknown-ext-roundtrip.json');
check('unknown extension and core keys survive round-trip', equal(JSON.parse(JSON.stringify(unknown)), unknown));

function applyMutation(id) {
  const fixture = {
    M1: 'mutations/M1-source-model.json',
    M2: 'mutations/M2-missing-breakApproved.json',
    M3: 'mutations/M3-array-apiKey.json',
    M4: 'mutations/M4-uppercase-API_KEY.json',
    M6: 'mutations/M6-unknown-extension.json',
    M7: 'mutations/M7-hbf-no-fiction-fields.json'
  }[id];
  if (!fixture) throw new Error(`Unknown mutation: ${id}`);
  const document = fixtures.get(fixture);
  if (id === 'M4') expectValid('mutation M4: uppercase API_KEY must be rejected', document);
  else if (id === 'M3') expectValid('mutation M3: array apiKey must be rejected', document);
  else if (id === 'M7') expectValid('mutation M7: nonfiction without fiction fields must remain valid', document);
  else expectValid(`mutation ${id}: intentionally mutated valid fixture`, document);
}

if (schemaMutation === 'drop-denylist') {
  for (const [name] of failFiles) expectDenylisted(`schema mutation: denylist remains active for ${name}`, fixtures.get(name), '');
  expectDenylisted('schema mutation: M3 array apiKey remains blocked', fixtures.get('mutations/M3-array-apiKey.json'), '');
} else if (mutation) {
  applyMutation(mutation);
}

const failed = checks.filter((item) => !item.ok);
console.log(`Story Core 2.0 contract smoke: ${checks.length - failed.length} passed, ${failed.length} failed`);
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}${item.ok ? '' : ` :: ${item.detail}`}`);
}
if (failed.length) process.exitCode = 1;
