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
const SECRET_KEY = /^(?:api[_-]?key|apikey|auth[_-]?token|.*secret.*|.*password.*|passwd|authorization|bearer.*|access[_-]?token|refresh[_-]?token|id[_-]?token|private[_-]?key|x-api-key)$/i;
const URL_CREDENTIAL = /:\/\/[^/@\s]+:[^/@\s]*@|[?&](?:api[_-]?key|auth[_-]?token|access[_-]?token|refresh[_-]?token|id[_-]?token|private[_-]?key|x-api-key|authorization|passwd|token|key|[^?&=]*secret[^?&=]*|[^?&=]*password[^?&=]*|bearer[^?&=]*)=/i;
const URL_QUERY_SCHEMA_PATTERN = '[?&](?:[aA][pP][iI][_-]?[kK][eE][yY]|[aA][uU][tT][hH][_-]?[tT][oO][kK][eE][nN]|[aA][cC][cC][eE][sS][sS][_-]?[tT][oO][kK][eE][nN]|[rR][eE][fF][rR][eE][sS][hH][_-]?[tT][oO][kK][eE][nN]|[iI][dD][_-]?[tT][oO][kK][eE][nN]|[pP][rR][iI][vV][aA][tT][eE][_-]?[kK][eE][yY]|[xX]-[aA][pP][iI]-[kK][eE][yY]|[aA][uU][tT][hH][oO][rR][iI][zZ][aA][tT][iI][oO][nN]|[pP][aA][sS][sS][wW][dD]|[tT][oO][kK][eE][nN]|[kK][eE][yY]|[^?&=]*[sS][eE][cC][rR][eE][tT][^?&=]*|[^?&=]*[pP][aA][sS][sS][wW][oO][rR][dD][^?&=]*|[bB][eE][aA][rR][eE][rR][^?&=]*)=';
const URL_USERINFO_SCHEMA_PATTERN = '://[^/@\\s]+:[^/@\\s]*@';
const CASE_SENSITIVE_DENYLIST = '^(?:api[_-]?key|apikey|auth[_-]?token|.*secret.*|.*password.*|passwd|authorization|bearer.*|access[_-]?token|refresh[_-]?token|id[_-]?token|private[_-]?key|x-api-key)$';
const BENIGN_NAME_OVERBLOCK = '^(?:.*[tT][oO][kK][eE][nN].*|[aA][pP][iI]|[kK][eE][yY][wW][oO][rR][dD][sS]|[kK][eE][yY][bB][eE][aA][tT][sS])$';
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
if (mutation && !/^M(?:[1-9]|1[01])$/.test(mutation)) throw new Error(`Unknown mutation: ${mutation}`);

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
if (mutation === 'M11') {
  schema.$defs.noSecrets.allOf[0].then.patternProperties = {
    [BENIGN_NAME_OVERBLOCK]: false
  };
}
if (mutation === 'M8') {
  schema.$defs.noSecrets.allOf[2].then.not.pattern = URL_QUERY_SCHEMA_PATTERN;
}
if (mutation === 'M9') {
  schema.$defs.noSecrets.allOf[2].then.not.pattern = URL_USERINFO_SCHEMA_PATTERN;
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
  if (typeof value === 'string') return [value].filter((item) => /xai-|sk-|bearer\s/i.test(item) || URL_CREDENTIAL.test(item));
  if (Array.isArray(value)) return value.flatMap(secretLookingValues);
  if (value && typeof value === 'object') return Object.values(value).flatMap(secretLookingValues);
  return [];
}

const permittedRedactionFiles = new Set([
  'secret-export-stripped.json',
  'authorization-export-stripped.json',
  'secret-import-stripped.json',
  'credential-url-userinfo.json',
  'credential-url-query-token.json'
]);
const isPermittedRedaction = (file, value) => {
  if (!permittedRedactionFiles.has(file)) return false;
  if (mutation === 'M10') return value.includes('REDACTED-TEST-VALUE');
  return value === 'REDACTED-TEST-VALUE' ||
    value === '******' ||
    value === ['Bearer', 'REDACTED-TEST-VALUE'].join(' ') ||
    /^https:\/\/user:REDACTED-TEST-VALUE@(?:provider\.example\.test\/v1|example\.test\/book)$/.test(value) ||
    /^https:\/\/example\.test\/book\?token=REDACTED-TEST-VALUE$/.test(value);
};
check(
  'schema and fixture values contain no secret-looking strings',
  secretLookingValues(schema).length === 0 && [...fixtures].every(([name, value]) => {
    const suspicious = secretLookingValues(value);
    if (suspicious.length === 0) return true;
    return suspicious.every((item) => isPermittedRedaction(name, item));
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
    let removed = 0;
    for (let index = 0; index < value.length;) {
      if (typeof value[index] === 'string' && URL_CREDENTIAL.test(value[index])) {
        value.splice(index, 1);
        foundPointers.push(`${pointer}/${index + removed}`);
        removed += 1;
      } else {
        stripSecrets(value[index], `${pointer}/${index}`, foundPointers);
        index += 1;
      }
    }
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    const childPointer = `${pointer}/${escapePointer(key)}`;
    const child = value[key];
    if (SECRET_KEY.test(key) || (typeof child === 'string' && URL_CREDENTIAL.test(child))) {
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

for (const [name, pointer] of [
  ['credential-url-userinfo.json', '/link'],
  ['credential-url-query-token.json', '/sourceUrl']
]) {
  const fixture = requiredFixture(name);
  expectDenylisted(`must reject credential URL ${name} at ${pointer}`, fixture, pointer);
  const stripped = structuredClone(fixture);
  const pointers = [];
  stripSecrets(stripped, '', pointers);
  check(
    `reference stripper strips credential URL ${name}`,
    pointers.includes(pointer) && !(pointer.slice(1) in stripped),
    JSON.stringify(pointers)
  );
}

const denylistedKeys = [
  'apiKey', 'api_key', 'api-key', 'apikey', 'API_KEY', 'APIKEY', 'secret',
  'clientSecret', 'client_secret', 'client-secret', 'password', 'passwd',
  'authorization', 'bearer', 'accessToken', 'access_token', 'access-token',
  'authToken', 'AUTHTOKEN', 'bearerToken', 'mySecretValue', 'dbPassword',
  'userPassword', 'refreshToken', 'refresh_token', 'refresh-token', 'idToken', 'id_token',
  'id-token', 'privateKey', 'private_key', 'private-key', 'x-api-key'
];
for (const key of denylistedKeys) {
  const placements = [
    ['wrapper', (fixture) => { fixture[key] = 'REDACTED-TEST-VALUE'; return `/${escapePointer(key)}`; }],
    ['novelData', (fixture) => { fixture.novelData.testContainer = { [key]: 'REDACTED-TEST-VALUE' }; return `/novelData/testContainer/${escapePointer(key)}`; }],
    ['extension', (fixture) => { fixture.ext = { futureTool: { [key]: 'REDACTED-TEST-VALUE' } }; return `/ext/futureTool/${escapePointer(key)}`; }],
    ['array', (fixture) => { fixture.ext = { futureTool: { nested: [{ [key]: 'REDACTED-TEST-VALUE' }] } }; return `/ext/futureTool/nested/0/${escapePointer(key)}`; }]
  ];
  for (const [location, place] of placements) {
    const fixture = structuredClone(requiredFixture('2.0-minimal.json'));
    const pointer = place(fixture);
    expectDenylisted(`denylist rejects ${key} at ${location}`, fixture, pointer);
  }
}

const urlSecretParameters = [
  'api_key', 'apikey', 'api-key', 'authToken', 'auth_token', 'access_token',
  'token', 'key', 'secret', 'password', 'bearerToken', 'refreshToken',
  'idToken', 'privateKey', 'x-api-key', 'authorization', 'passwd', 'clientSecret'
];
const queryFixture = structuredClone(requiredFixture('2.0-minimal.json'));
queryFixture.ext = {
  futureTool: {
    links: urlSecretParameters.map((parameter) => `https://example.test/item?${parameter}=REDACTED-TEST-VALUE`)
  }
};
const expectedUrlPointers = urlSecretParameters.map((_, index) => `/ext/futureTool/links/${index}`);
for (const pointer of expectedUrlPointers) {
  expectDenylisted(`credential URL query parameter rejected at ${pointer}`, queryFixture, pointer);
}
const strippedQueryFixture = structuredClone(queryFixture);
const strippedQueryPointers = [];
stripSecrets(strippedQueryFixture, '', strippedQueryPointers);
check(
  'reference stripper removes all denylisted credential URL query parameters',
  equal(strippedQueryPointers, expectedUrlPointers) && strippedQueryFixture.ext.futureTool.links.length === 0,
  JSON.stringify(strippedQueryPointers)
);

const mustPassKeys = [
  'sessionToken', 'token', 'tokenCounts', 'promptTokens', 'completionTokens',
  'maxTokens', 'api', 'keywords', 'keyBeats'
];
const benignValues = Object.fromEntries(mustPassKeys.map((key) => [
  key,
  key === 'keywords' || key === 'keyBeats' ? ['benign'] : 1
]));
const benignKeyFixture = structuredClone(requiredFixture('2.0-minimal.json'));
Object.assign(benignKeyFixture, structuredClone(benignValues));
Object.assign(benignKeyFixture.novelData, structuredClone(benignValues));
benignKeyFixture.ext = {
  futureTool: {
    ...structuredClone(benignValues),
    nested: [structuredClone(benignValues)]
  }
};
expectValid('must preserve benign token and metadata names at every depth', benignKeyFixture);
const benignKeyBeforeStrip = structuredClone(benignKeyFixture);
const benignKeyPointers = [];
stripSecrets(benignKeyFixture, '', benignKeyPointers);
check(
  'reference stripper preserves benign token and metadata names',
  equal(benignKeyFixture, benignKeyBeforeStrip) && benignKeyPointers.length === 0
);

const placeholderAttack = ['Bearer', 'real-key', 'REDACTED-TEST-VALUE'].join(' ');
check(
  'redaction gate rejects appended placeholder',
  !isPermittedRedaction('secret-export-stripped.json', placeholderAttack)
);

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
