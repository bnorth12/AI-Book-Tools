import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

function runWorker(workerArgs, timeout = 240_000) {
  return spawnSync(process.execPath, workerArgs, {
    env: { ...process.env, STORY_CORE_SMOKE_WORKER: '1' },
    stdio: 'inherit',
    timeout,
    killSignal: 'SIGKILL'
  });
}

if (process.env.STORY_CORE_SMOKE_WORKER !== '1') {
  const result = runWorker([fileURLToPath(import.meta.url), ...process.argv.slice(2)]);
  if (result.error) console.error(`FAIL smoke watchdog: ${result.error.message}`);
  process.exit(result.status ?? 1);
}

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
const normalizeKey = (k) => k.toLowerCase().replace(/[-_\r\n\u2028\u2029]/g, '');
const SECRET_KEY = {
  test: (k) => {
    const n = normalizeKey(k);
    return n.endsWith('token') || n.includes('apikey') ||
      n === 'openaikey' || n === 'xaikey' || n === 'anthropickey' || n === 'geminikey' ||
      n === 'githubkey' || n === 'googlekey' || n === 'awskey' || n === 'privatekey' || n === 'secretkey' ||
      n.includes('secret') || n.includes('password') || n === 'passwd' || n === 'authorization' || n.startsWith('bearer');
  }
};
const URL_CREDENTIAL = /:\/\/[^/@\s]+:[^/@\s]*@|[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s?#]*\?(?:[^\s#&]*&)*(?!tokens(?:=|&|#|$))(?:api_key|apikey|access_key|authorization|[^?&=#]*(?:secret|password|token)[^?&=#]*)(?:[=&#\s]|$)/i;
const URL_QUERY_SCHEMA_PATTERN = "[a-zA-Z][a-zA-Z0-9+.-]*://[^\\s?#]*\\?(?:[^\\s#&]*&)*(?![tT][oO][kK][eE][nN][sS](?:=|&|#|$))(?:[aA][pP][iI]_[kK][eE][yY]|[aA][pP][iI][kK][eE][yY]|[aA][cC][cC][eE][sS][sS]_[kK][eE][yY]|[aA][uU][tT][hH][oO][rR][iI][zZ][aA][tT][iI][oO][nN]|[^?&=#]*(?:[sS][eE][cC][rR][eE][tT]|[pP][aA][sS][sS][wW][oO][rR][dD]|[tT][oO][kK][eE][nN])[^?&=#]*)(?:=|&|#|$)";
const URL_USERINFO_SCHEMA_PATTERN = '://[^/@\\s]+:[^/@\\s]*@';
const CASE_SENSITIVE_DENYLIST = "^(?:[\\s\\S]*[-_\\r\\n\\u2028\\u2029]*t[-_\\r\\n\\u2028\\u2029]*o[-_\\r\\n\\u2028\\u2029]*k[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*n[-_\\r\\n\\u2028\\u2029]*|[\\s\\S]*[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*p[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*k[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*[\\s\\S]*|[-_\\r\\n\\u2028\\u2029]*o[-_\\r\\n\\u2028\\u2029]*p[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*n[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*k[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*x[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*k[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*n[-_\\r\\n\\u2028\\u2029]*t[-_\\r\\n\\u2028\\u2029]*h[-_\\r\\n\\u2028\\u2029]*r[-_\\r\\n\\u2028\\u2029]*o[-_\\r\\n\\u2028\\u2029]*p[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*c[-_\\r\\n\\u2028\\u2029]*k[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*g[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*m[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*n[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*k[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*g[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*t[-_\\r\\n\\u2028\\u2029]*h[-_\\r\\n\\u2028\\u2029]*u[-_\\r\\n\\u2028\\u2029]*b[-_\\r\\n\\u2028\\u2029]*k[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*g[-_\\r\\n\\u2028\\u2029]*o[-_\\r\\n\\u2028\\u2029]*o[-_\\r\\n\\u2028\\u2029]*g[-_\\r\\n\\u2028\\u2029]*l[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*k[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*w[-_\\r\\n\\u2028\\u2029]*s[-_\\r\\n\\u2028\\u2029]*k[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*p[-_\\r\\n\\u2028\\u2029]*r[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*v[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*t[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*k[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*s[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*c[-_\\r\\n\\u2028\\u2029]*r[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*t[-_\\r\\n\\u2028\\u2029]*k[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[\\s\\S]*[-_\\r\\n\\u2028\\u2029]*s[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*c[-_\\r\\n\\u2028\\u2029]*r[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*t[-_\\r\\n\\u2028\\u2029]*[\\s\\S]*|[\\s\\S]*[-_\\r\\n\\u2028\\u2029]*p[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*s[-_\\r\\n\\u2028\\u2029]*s[-_\\r\\n\\u2028\\u2029]*w[-_\\r\\n\\u2028\\u2029]*o[-_\\r\\n\\u2028\\u2029]*r[-_\\r\\n\\u2028\\u2029]*d[-_\\r\\n\\u2028\\u2029]*[\\s\\S]*|[-_\\r\\n\\u2028\\u2029]*p[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*s[-_\\r\\n\\u2028\\u2029]*s[-_\\r\\n\\u2028\\u2029]*w[-_\\r\\n\\u2028\\u2029]*d[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*u[-_\\r\\n\\u2028\\u2029]*t[-_\\r\\n\\u2028\\u2029]*h[-_\\r\\n\\u2028\\u2029]*o[-_\\r\\n\\u2028\\u2029]*r[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*z[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*t[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*o[-_\\r\\n\\u2028\\u2029]*n[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*b[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*r[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*r[-_\\r\\n\\u2028\\u2029]*[\\s\\S]*)$";
const BENIGN_NAME_OVERBLOCK = '^(?:.*[tT][oO][kK][eE][nN].*|[aA][pP][iI]|[kK][eE][yY][wW][oO][rR][dD][sS]|[kK][eE][yY][bB][eE][aA][tT][sS])$';
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
if (mutation && !/^M(?:[1-9]|1[0-7])$/.test(mutation)) throw new Error(`Unknown mutation: ${mutation}`);

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
if (mutation === 'M12') {
  schema.$defs.noSecrets.allOf[2].then.not.pattern += '|[?&](?:[kK][eE][yY]|[tT][oO][kK][eE][nN][sS])=';
}
if (mutation === 'M13') {
  schema.$defs.noSecrets.allOf[2].then.not.pattern = `${URL_USERINFO_SCHEMA_PATTERN}|[?&](?:api_key|apikey|authorization|token)=`;
}
if (mutation === 'M17') {
  schema.$defs.noSecrets.allOf[2].then.not.pattern =
    `${URL_USERINFO_SCHEMA_PATTERN}|${URL_QUERY_SCHEMA_PATTERN.replace(/\(\?:=\|&\|#\|\$\)$/, '=')}`;
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
  if (typeof value === 'string') return [value].filter((item) =>
    (mutation === 'M14' ? /xai-|sk-|bearer\s/i : /xai-|sk-|bearer\s|\*{6}/i).test(item) || URL_CREDENTIAL.test(item));
  if (Array.isArray(value)) return value.flatMap(secretLookingValues);
  if (value && typeof value === 'object') return Object.values(value).flatMap(secretLookingValues);
  return [];
}

const permittedRedactionFiles = new Set([
  'secret-export-stripped.json',
  'authorization-export-stripped.json',
  'secret-import-stripped.json',
  'credential-url-userinfo.json',
  'credential-url-query-token.json',
  'credential-url-query-secret.json'
]);
const isPermittedRedaction = (file, value) => {
  if (!permittedRedactionFiles.has(file)) return false;
  if (mutation === 'M10') return value.includes('REDACTED-TEST-VALUE');
  return value === 'REDACTED-TEST-VALUE' ||
    value === '******' ||
    value === ['Bearer', 'REDACTED-TEST-VALUE'].join(' ') ||
    /^https:\/\/user:REDACTED-TEST-VALUE@(?:provider\.example\.test\/v1|example\.test\/book)$/.test(value) ||
    /^https:\/\/example\.test\/book\?token=REDACTED-TEST-VALUE$/.test(value) ||
    /^https:\/\/example\.test\/book\?(?:client_secret|authorization|authToken|access_token|access_key)=?$/.test(value);
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
        stripSecrets(value[index], `${pointer}/${mutation === 'M15' ? index : index + removed}`, foundPointers);
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
  'credential-url-pass.json',
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

const SPEC_DENY_KEYS = [
  'xaiApiKey', 'sessionToken', 'session_token', 'token', 'apiToken', 'api_token', 'githubToken',
  'X_API_KEY', 'x_api_key', 'XAI-API-KEY', 'Api-Key', 'apiKeyValue', 'openaiKey', 'xaiKey',
  'anthropicKey', 'geminiKey', 'githubKey', 'googleKey', 'awsKey', 'AwsKey', 'privateKey', 'secretKey',
  'csrfToken', 'SESSION_TOKEN'
];
// Keys carrying line terminators must never slip through: the rule strips them before matching (pinned).
const LINE_TERMINATOR_KEYS = [
  'api\nKey', 'session\u2028Token', 'my\nSecretValue', 'bearer\nToken', 'db\nPassword',
  'x\rApiKey', 'csrf\u2029Token', 'xai\r\nKey', 'private\u2028Key'
];
const SPEC_ALLOW_KEYS = [
  'tokens', 'promptTokens', 'maxTokens', 'tokenCount', 'tokenizer', 'tokenBudget', 'keyword',
  'keywords', 'monkey', 'sessionId', 'sortKey', 'primaryKey', 'donkey'
];
const denylistedKeys = [
  'apiKey', 'api_key', 'api-key', 'apikey', 'API_KEY', 'APIKEY', 'secret',
  'clientSecret', 'client_secret', 'client-secret', 'password', 'passwd',
  'authorization', 'bearer', 'accessToken', 'access_token', 'access-token',
  'authToken', 'AUTHTOKEN', 'bearerToken', 'mySecretValue', 'dbPassword',
  'userPassword', 'refreshToken', 'refresh_token', 'refresh-token', 'idToken', 'id_token',
  'id-token', 'privateKey', 'private_key', 'private-key', 'x-api-key',
  // #170 round 3 DENY cases (normalize: lowercase, strip _ and -; deny *token, *apikey*, provider names)
  ...SPEC_DENY_KEYS, ...LINE_TERMINATOR_KEYS
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

for (const key of denylistedKeys) {
  check(`harness SECRET_KEY denies ${JSON.stringify(key)}`, SECRET_KEY.test(key));
  const fixture = structuredClone(requiredFixture('2.0-minimal.json'));
  fixture[key] = 'REDACTED-TEST-VALUE';
  fixture.novelData.testContainer = { [key]: 'REDACTED-TEST-VALUE', keep: 1 };
  fixture.ext = { futureTool: { [key]: 'REDACTED-TEST-VALUE', nested: [{ [key]: 'REDACTED-TEST-VALUE', keep: 1 }] } };
  const pointers = [];
  stripSecrets(fixture, '', pointers);
  const k = escapePointer(key);
  check(`import stripper removes ${JSON.stringify(key)} at every depth`,
    equal([...pointers].sort(), [`/${k}`, `/novelData/testContainer/${k}`, `/ext/futureTool/${k}`, `/ext/futureTool/nested/0/${k}`].sort()) &&
      equal(fixture.novelData.testContainer, { keep: 1 }) && equal(fixture.ext.futureTool.nested, [{ keep: 1 }]),
    JSON.stringify(pointers));
}
for (const key of SPEC_ALLOW_KEYS) check(`harness SECRET_KEY allows ${key}`, !SECRET_KEY.test(key));

const urlSecretParameters = [
  'api_key', 'apikey', 'access_key', 'authorization', 'authToken', 'auth_token',
  'access_token', 'token', 'secret', 'password', 'bearerToken', 'refreshToken',
  'idToken', 'client_secret', 'clientSecret', 'sessionToken', 'api-key', 'sig_token',
  'dbPassword', 'mySecretValue', 'API_KEY', 'ACCESS_KEY', 'AUTHORIZATION',
  'SESSIONTOKEN', 'CLIENT_SECRET', 'DBPASSWORD'
];
const queryFixture = structuredClone(requiredFixture('2.0-minimal.json'));
queryFixture.ext = {
  futureTool: {
    links: urlSecretParameters.map((parameter) => `https://example.test/item?${parameter}=REDACTED-TEST-VALUE`)
  }
};
const expectedUrlPointers = urlSecretParameters.map((_, index) => `/ext/futureTool/links/${index}`);
for (const pointer of expectedUrlPointers) {
  expectDenylisted(`credential URL query parameter ${urlSecretParameters[expectedUrlPointers.indexOf(pointer)]} rejected at ${pointer}`, queryFixture, pointer);
}
const strippedQueryFixture = structuredClone(queryFixture);
const strippedQueryPointers = [];
stripSecrets(strippedQueryFixture, '', strippedQueryPointers);
check(
  'reference stripper removes all denylisted credential URL query parameters',
  equal(strippedQueryPointers, expectedUrlPointers) && strippedQueryFixture.ext.futureTool.links.length === 0,
  JSON.stringify(strippedQueryPointers)
);

for (const [name, url] of Object.entries(requiredFixture('credential-url-pass.json').ext.futureTool)) {
  const fixture = structuredClone(requiredFixture('2.0-minimal.json'));
  fixture.link = url;
  fixture.novelData.sourceUrl = url;
  fixture.ext = { futureTool: { url, links: [url] } };
  expectValid(`benign URL ${name} passes at every depth`, fixture);
  const before = structuredClone(fixture);
  const pointers = [];
  stripSecrets(fixture, '', pointers);
  check(`benign URL ${name} remains unchanged`, equal(fixture, before) && pointers.length === 0);
  check(`value scan allows benign URL ${name}`, secretLookingValues(url).length === 0);
}
for (const parameter of ['KEY', 'TOKENS', 'access_key_hint', 'authorizations', 'myTokenValue', 'tokenCount', 'token_budget', 'tokenizer', 'keywords']) {
  const fixture = structuredClone(requiredFixture('2.0-minimal.json'));
  fixture.link = `https://example.test/book?${parameter}=benign`;
  expectValid(`benign query parameter ${parameter} passes`, fixture);
  const before = structuredClone(fixture);
  const pointers = [];
  stripSecrets(fixture, '', pointers);
  check(`benign query parameter ${parameter} remains unchanged`, equal(fixture, before) && pointers.length === 0);
}
for (const parameter of ['key', 'tokens', 'TOKENS']) {
  for (const suffix of ['', '&page=2', '#section']) {
    const fixture = structuredClone(requiredFixture('2.0-minimal.json'));
    fixture.link = `https://example.test/book?${parameter}${suffix}`;
    expectValid(`benign valueless query ${parameter}${suffix} passes`, fixture);
    const before = structuredClone(fixture);
    const pointers = [];
    stripSecrets(fixture, '', pointers);
    check(`benign valueless query ${parameter}${suffix} remains unchanged`, equal(fixture, before) && pointers.length === 0);
  }
}
for (const parameter of urlSecretParameters) {
  for (const suffix of ['', '&page=2', '#section']) {
    const fixture = structuredClone(requiredFixture('2.0-minimal.json'));
    fixture.link = `https://example.test/book?${parameter}${suffix}`;
    expectDenylisted(`credential valueless query ${parameter}${suffix} rejected`, fixture, '/link');
    check(`value scan detects valueless query ${parameter}${suffix}`, secretLookingValues(fixture.link).length === 1);
    const pointers = [];
    stripSecrets(fixture, '', pointers);
    check(`reference stripper removes valueless query ${parameter}${suffix}`, !('link' in fixture) && equal(pointers, ['/link']));
  }
}

const secretUrlFixture = requiredFixture('credential-url-query-secret.json');
const secretUrlCases = [
  ['/link', secretUrlFixture.link],
  ['/sourceUrl', secretUrlFixture.sourceUrl],
  ...secretUrlFixture.ext.futureTool.links.map((url, index) => [`/ext/futureTool/links/${index}`, url])
];
for (const [pointer, url] of secretUrlCases) {
  expectDenylisted(`must strip credential query ${url} at ${pointer}`, secretUrlFixture, pointer);
  const fixture = structuredClone(requiredFixture('2.0-minimal.json'));
  fixture.link = url;
  const pointers = [];
  stripSecrets(fixture, '', pointers);
  check(`reference stripper removes credential query ${url}`, !('link' in fixture) && equal(pointers, ['/link']));
  check(`value scan detects credential query ${url}`, secretLookingValues(url).length === 1);
}
const mixedArray = ['https://example.test/?token=', { link: 'https://example.test/?access_key=' }, 'https://example.test/?page=2'];
const mixedArrayPointers = [];
stripSecrets(mixedArray, '/links', mixedArrayPointers);
check(
  'reference stripper reports original pointers after array removals',
  equal(mixedArrayPointers, ['/links/0', '/links/1/link']) &&
    equal(mixedArray, [{}, 'https://example.test/?page=2'])
);

const mustPassKeys = [
  'tokenCounts', 'completionTokens', 'api', 'keyBeats', ...SPEC_ALLOW_KEYS
];
const benignValues = Object.fromEntries(mustPassKeys.map((key) => [
  key,
  key === 'keywords' || key === 'keyword' || key === 'keyBeats' ? ['benign'] : 1
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

// HBF reference links pass the schema and the import stripper byte-for-byte under sources[].url and ext.*, top-level and nested.
const HBF_ALLOW_URLS = {
  libraryCatalogKey: 'https://catalog.library.example/search?key=abc&term=echinacea',
  sheetsKey: 'https://docs.google.com/spreadsheet/ccc?key=0AbCdEfGhIjKlMnOp&output=csv',
  pubmedTerm: 'https://pubmed.ncbi.nlm.nih.gov/?term=echinacea+purpurea',
  doi: 'https://doi.org/10.1016/j.jep.2006.01.001',
  tokensParam: 'https://example.org/report?tokens=5',
  termThenKey: 'https://catalog.library.example/search?term=valerian+sleep&key=X'
};
for (const [name, url] of Object.entries(HBF_ALLOW_URLS)) {
  const fixture = structuredClone(requiredFixture('hbf-core-only.json'));
  fixture.sources = [{ title: name, url }];
  fixture.novelData.sources = [{ title: name, url }];
  fixture.ext = { herbalBookForge: { url, sources: [{ url }], nested: { deeper: [{ sources: [{ title: name, url }], link: url }] } } };
  const bytesBefore = JSON.stringify(fixture);
  expectValid(`HBF URL ${name} passes under sources[].url and ext.* at every depth`, fixture);
  const pointers = [];
  stripSecrets(fixture, '', pointers);
  check(`HBF URL ${name} passes the import stripper byte-for-byte`, JSON.stringify(fixture) === bytesBefore && pointers.length === 0, JSON.stringify(pointers));
  check(`value scan allows HBF URL ${name}`, secretLookingValues(url).length === 0);
}
{
  const doiTokenUrl = 'https://doi.org/10.1016/j.jep.2006.01.001?access_token=REDACTED-TEST-VALUE';
  const fixture = structuredClone(requiredFixture('hbf-core-only.json'));
  fixture.sources = [{ title: 'keep', url: doiTokenUrl }];
  fixture.ext = { herbalBookForge: { url: doiTokenUrl, nested: { links: [doiTokenUrl, HBF_ALLOW_URLS.doi] } } };
  const doiPointers = ['/sources/0/url', '/ext/herbalBookForge/url', '/ext/herbalBookForge/nested/links/0'];
  for (const pointer of doiPointers) expectDenylisted(`DOI ?access_token= rejected at ${pointer}`, fixture, pointer);
  const pointers = [];
  stripSecrets(fixture, '', pointers);
  check('import stripper removes DOI ?access_token= links and keeps siblings',
    equal(pointers, doiPointers) && equal(fixture.sources, [{ title: 'keep' }]) &&
      equal(fixture.ext.herbalBookForge, { nested: { links: [HBF_ALLOW_URLS.doi] } }),
    JSON.stringify(pointers));
}
// r4257680868: URL credential checks apply to URLs only; prose in unknown fields that merely looks like a query is preserved.
for (const prose of [
  'Chapter beat: what?token=1 means to the villain',
  'Old form label &password= appears in chapter 3',
  'Ask?secret=later is the working title'
]) {
  const fixture = structuredClone(requiredFixture('2.0-minimal.json'));
  fixture.novelData.testContainer = { note: prose };
  fixture.ext = { futureTool: { note: prose, nested: [{ note: prose }], list: [prose] } };
  const bytesBefore = JSON.stringify(fixture);
  expectValid(`non-URL prose ${JSON.stringify(prose)} passes in unknown fields`, fixture);
  const pointers = [];
  stripSecrets(fixture, '', pointers);
  check(`import stripper preserves non-URL prose ${JSON.stringify(prose)}`, JSON.stringify(fixture) === bytesBefore && pointers.length === 0, JSON.stringify(pointers));
}
for (const text of [
  'Draft at https://example.test/book?token=REDACTED-TEST-VALUE for review',
  'https://example.test/book?page=2&client_secret=REDACTED-TEST-VALUE'
]) {
  const fixture = structuredClone(requiredFixture('2.0-minimal.json'));
  fixture.ext = { futureTool: { note: text } };
  expectDenylisted(`credential URL inside text rejected: ${text}`, fixture, '/ext/futureTool/note');
  const pointers = [];
  stripSecrets(fixture, '', pointers);
  check(`import stripper removes credential URL inside text: ${text}`, equal(pointers, ['/ext/futureTool/note']));
}

// F6 (#170 r4): scheme-less, protocol-relative and www. URLs and #fragment params are URLs too.
const F6_DENY_URLS = {
  doiNoScheme: 'doi.org/10.1000/xyz?access_token=REDACTED-TEST-VALUE',
  protocolRelative: '//cdn.example.com/a?token=REDACTED-TEST-VALUE',
  wwwApiKey: 'www.example.com/p?api_key=REDACTED-TEST-VALUE',
  fragmentWithScheme: 'https://example.com/callback#access_token=REDACTED-TEST-VALUE',
  fragmentNoScheme: 'example.com/callback#access_token=REDACTED-TEST-VALUE',
  fragmentProtocolRelative: '//example.com/callback#state=1&access_token=REDACTED-TEST-VALUE'
};
for (const [name, url] of Object.entries(F6_DENY_URLS)) {
  const fixture = structuredClone(requiredFixture('hbf-core-only.json'));
  fixture.link = url;
  fixture.sources = [{ title: 'keep', url }];
  fixture.ext = { herbalBookForge: { url, nested: { deeper: [{ url, keep: 1 }] } } };
  const f6Pointers = ['/link', '/sources/0/url', '/ext/herbalBookForge/url', '/ext/herbalBookForge/nested/deeper/0/url'];
  for (const pointer of f6Pointers) expectDenylisted(`F6 ${name} rejected at ${pointer}`, fixture, pointer);
  const pointers = [];
  stripSecrets(fixture, '', pointers);
  check(`F6 import stripper removes ${name} top-level, under sources[].url and nested ext.*`,
    equal([...pointers].sort(), [...f6Pointers].sort()) && equal(fixture.sources, [{ title: 'keep' }]) &&
      equal(fixture.ext.herbalBookForge, { nested: { deeper: [{ keep: 1 }] } }),
    JSON.stringify(pointers));
  check(`F6 value scan detects ${name}`, secretLookingValues(url).length === 1);
}
// F6 ALLOW: scheme-less HBF links and usage-count parameters pass byte-for-byte at every depth.
const F6_ALLOW_URLS = {
  bareDoi: 'doi.org/10.1000/xyz',
  barePubmed: 'pubmed.ncbi.nlm.nih.gov/?term=valerian+sleep',
  bareCatalogKey: 'catalog.library.example/search?key=abc&term=echinacea',
  bareSheetsKey: 'docs.google.com/spreadsheet/ccc?key=0AbCdEfGhIjKlMnOp',
  bareTokens: 'example.org/report?tokens=5',
  wwwTermKey: 'www.catalog.example/search?term=valerian+sleep&key=X',
  protocolRelativeTerm: '//pubmed.ncbi.nlm.nih.gov/?term=valerian',
  tokenCount: 'https://example.org/usage?tokenCount=3',
  tokenBudget: 'https://example.org/usage?token_budget=1',
  tokenizer: 'https://example.org/usage?tokenizer=x',
  tokensFive: 'https://example.org/usage?tokens=5',
  bareTokenCount: 'example.org/usage?tokenCount=3&token_budget=1&tokenizer=x&tokens=5',
  fragmentSection: 'https://example.org/guide#section-2',
  sourceNoteProse: 'see doi.org/10.1/abc and www.example.com/page for the valerian sleep trial'
};
for (const [name, url] of Object.entries(F6_ALLOW_URLS)) {
  const fixture = structuredClone(requiredFixture('hbf-core-only.json'));
  fixture.link = url;
  fixture.sources = [{ title: name, url, note: url }];
  fixture.ext = { herbalBookForge: { url, note: url, nested: { deeper: [{ sources: [{ url }], note: url }] } } };
  const bytesBefore = JSON.stringify(fixture);
  expectValid(`F6 allow ${name} passes top-level, under sources[].url and nested ext.*`, fixture);
  const pointers = [];
  stripSecrets(fixture, '', pointers);
  check(`F6 allow ${name} passes the import stripper byte-for-byte`, JSON.stringify(fixture) === bytesBefore && pointers.length === 0, JSON.stringify(pointers));
  check(`F6 value scan allows ${name}`, secretLookingValues(url).length === 0);
}
// F6 linearity: long single-run inputs finish quickly in both the schema and the harness.
for (const [name, text] of [
  ['long prose run', 'a.bc/' + '?&#x'.repeat(20000)],
  ['long query run', 'https://example.org/p?' + 'tokenx&'.repeat(20000)],
  ['long name run', 'www.example.org/p?' + 'to'.repeat(30000)]
]) {
  const fixture = structuredClone(requiredFixture('2.0-minimal.json'));
  fixture.ext = { futureTool: { note: text } };
  const started = Date.now();
  validate(fixture);
  URL_CREDENTIAL.test(text);
  check(`F6 URL matching stays linear on ${name}`, Date.now() - started < 2000, `${Date.now() - started} ms`);
}

const placeholderAttack = ['Bearer', 'real-key', 'REDACTED-TEST-VALUE'].join(' ');
check(
  'redaction gate rejects appended placeholder',
  !isPermittedRedaction('secret-export-stripped.json', placeholderAttack)
);
for (const value of ['xai-example', 'sk-example', '******', '****** REDACTED-TEST-VALUE', placeholderAttack]) {
  check(`value scan detects suspicious value ${value}`, secretLookingValues(value).length === 1);
}
check(
  'redaction gate rejects masked value with appended placeholder',
  !isPermittedRedaction('secret-export-stripped.json', '****** REDACTED-TEST-VALUE')
);
for (const value of [
  'REDACTED-TEST-VALUE', '******', ['Bearer', 'REDACTED-TEST-VALUE'].join(' '),
  ['https://user:', 'REDACTED-TEST-VALUE', '@example.test/book'].join('')
]) {
  check(`redaction gate permits exact synthetic form ${value}`, isPermittedRedaction('secret-export-stripped.json', value));
  check(`redaction gate rejects synthetic form in pass fixture ${value}`, !isPermittedRedaction('credential-url-pass.json', value));
}
const watchdogProbe = runWorker(
  ['-e', 'const stop = Date.now() + 250; while (Date.now() < stop) {}'],
  mutation === 'M16' ? 0 : 100
);
check(
  'process watchdog interrupts synchronous work',
  watchdogProbe.error?.code === 'ETIMEDOUT' && watchdogProbe.signal === 'SIGKILL'
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
if (failed.length) process.exitCode = 1;
