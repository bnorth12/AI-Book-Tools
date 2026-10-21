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
      n === 'githubkey' || n === 'googlekey' || n === 'awskey' || n === 'privatekey' || n === 'secretkey' || n === 'accesskey' || n === 'accesskey' || n === 'accesskey' ||
      n.includes('secret') || n.includes('password') || n === 'passwd' || n === 'authorization' || n.startsWith('bearer');
  }
};
const URL_CREDENTIAL = new RegExp("://(?=[^/@])[\\r\\n\\u2028\\u2029]*[^/@\\r\\n\\u2028\\u2029][^/@\\r\\n\\u2028\\u2029:]*[\\r\\n\\u2028\\u2029]*:[\\r\\n\\u2028\\u2029]*[^/@\\r\\n\\u2028\\u2029]*[\\r\\n\\u2028\\u2029]*@|(?://|(?<![A-Za-z0-9._~%+/@-])[A-Za-z0-9-]+\\.[A-Za-z]{2})(?:(?!//|(?<![A-Za-z0-9._~%+/@-])[A-Za-z0-9-]+\\.[A-Za-z]{2})[^\\r\\n\\u2028\\u2029])*?[?&#](?=[^?&=#\\r\\n\\u2028\\u2029]*[\\r\\n\\u2028\\u2029]*=)[^?&=#\\r\\n\\u2028\\u2029]*?(?:(?<![A-Za-z0-9_-])[A-Za-z0-9_-]*?[tT][-_]*[oO][-_]*[kK\\u212A][-_]*[eE][-_]*[nN][-_]*(?![A-Za-z0-9_-])|[aA][-_]*[pP][-_]*[iI][-_]*[kK\\u212A][-_]*[eE][-_]*[yY]|[sS][-_]*[eE][-_]*[cC][-_]*[rR][-_]*[eE][-_]*[tT]|[pP][-_]*[aA][-_]*[sS][-_]*[sS][-_]*[wW][-_]*[oO][-_]*[rR][-_]*[dD]|(?<![A-Za-z0-9_-])(?:[-_]*[oO][-_]*[pP][-_]*[eE][-_]*[nN][-_]*[aA][-_]*[iI][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[xX][-_]*[aA][-_]*[iI][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[aA][-_]*[nN][-_]*[tT][-_]*[hH][-_]*[rR][-_]*[oO][-_]*[pP][-_]*[iI][-_]*[cC][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[gG][-_]*[eE][-_]*[mM][-_]*[iI][-_]*[nN][-_]*[iI][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[gG][-_]*[iI][-_]*[tT][-_]*[hH][-_]*[uU][-_]*[bB][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[gG][-_]*[oO][-_]*[oO][-_]*[gG][-_]*[lL][-_]*[eE][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[aA][-_]*[wW][-_]*[sS][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[pP][-_]*[rR][-_]*[iI][-_]*[vV][-_]*[aA][-_]*[tT][-_]*[eE][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[sS][-_]*[eE][-_]*[cC][-_]*[rR][-_]*[eE][-_]*[tT][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[aA][-_]*[cC][-_]*[cC][-_]*[eE][-_]*[sS][-_]*[sS][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[aA][-_]*[uU][-_]*[tT][-_]*[hH][-_]*[oO][-_]*[rR][-_]*[iI][-_]*[zZ][-_]*[aA][-_]*[tT][-_]*[iI][-_]*[oO][-_]*[nN][-_]*|[-_]*[pP][-_]*[aA][-_]*[sS][-_]*[sS][-_]*[wW][-_]*[dD][-_]*)(?![A-Za-z0-9_-])|(?<![A-Za-z0-9_-])[-_]*[bB][-_]*[eE][-_]*[aA][-_]*[rR][-_]*[eE][-_]*[rR])|(?://|(?<![A-Za-z0-9._~%+/@-])[A-Za-z0-9-]+\\.[A-Za-z]{2})(?:(?!//|(?<![A-Za-z0-9._~%+/@-])[A-Za-z0-9-]+\\.[A-Za-z]{2})[^\\r\\n\\u2028\\u2029])*?[?&](?:(?=[^?&=#\\r\\n\\u2028\\u2029]*(?:[aA][-_]*[pP][-_]*[iI][-_]*[kK\\u212A][-_]*[eE][-_]*[yY]|[sS][-_]*[eE][-_]*[cC][-_]*[rR][-_]*[eE][-_]*[tT]|[pP][-_]*[aA][-_]*[sS][-_]*[sS][-_]*[wW][-_]*[oO][-_]*[rR][-_]*[dD]))(?=([^?&=#\\r\\n\\u2028\\u2029]*))\\1|[^?&=#\\r\\n\\u2028\\u2029]*[tT][-_]*[oO][-_]*[kK\\u212A][-_]*[eE][-_]*[nN][-_]*|(?:[-_]*[oO][-_]*[pP][-_]*[eE][-_]*[nN][-_]*[aA][-_]*[iI][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[xX][-_]*[aA][-_]*[iI][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[aA][-_]*[nN][-_]*[tT][-_]*[hH][-_]*[rR][-_]*[oO][-_]*[pP][-_]*[iI][-_]*[cC][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[gG][-_]*[eE][-_]*[mM][-_]*[iI][-_]*[nN][-_]*[iI][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[gG][-_]*[iI][-_]*[tT][-_]*[hH][-_]*[uU][-_]*[bB][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[gG][-_]*[oO][-_]*[oO][-_]*[gG][-_]*[lL][-_]*[eE][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[aA][-_]*[wW][-_]*[sS][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[pP][-_]*[rR][-_]*[iI][-_]*[vV][-_]*[aA][-_]*[tT][-_]*[eE][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[sS][-_]*[eE][-_]*[cC][-_]*[rR][-_]*[eE][-_]*[tT][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[aA][-_]*[cC][-_]*[cC][-_]*[eE][-_]*[sS][-_]*[sS][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[aA][-_]*[uU][-_]*[tT][-_]*[hH][-_]*[oO][-_]*[rR][-_]*[iI][-_]*[zZ][-_]*[aA][-_]*[tT][-_]*[iI][-_]*[oO][-_]*[nN][-_]*|[-_]*[pP][-_]*[aA][-_]*[sS][-_]*[sS][-_]*[wW][-_]*[dD][-_]*)|[-_]*[bB][-_]*[eE][-_]*[aA][-_]*[rR][-_]*[eE][-_]*[rR](?=([^?&=#\\r\\n\\u2028\\u2029]*))\\2)(?=[\\t\\n\\v\\f\\r \\u0085\\u00a0\\u00ad\\u1680\\u180e\\u2000-\\u200d\\u2028\\u2029\\u202f\\u205f\\u2060\\u3000\\ufeff]|[/@?#&=\\u0022\\u0027]|;(?!$)|$)|(?://|(?<![A-Za-z0-9._~%+/@-])[A-Za-z0-9-]+\\.[A-Za-z]{2})(?:(?!//|(?<![A-Za-z0-9._~%+/@-])[A-Za-z0-9-]+\\.[A-Za-z]{2})[^\\r\\n\\u2028\\u2029])*?[?&](?:(?=[^?&=#\\r\\n\\u2028\\u2029]*(?:[aA][-_]*[pP][-_]*[iI][-_]*[kK\\u212A][-_]*[eE][-_]*[yY]|[sS][-_]*[eE][-_]*[cC][-_]*[rR][-_]*[eE][-_]*[tT]|[pP][-_]*[aA][-_]*[sS][-_]*[sS][-_]*[wW][-_]*[oO][-_]*[rR][-_]*[dD]))(?=([^?&=#\\r\\n\\u2028\\u2029]*))\\3|[^?&=#\\r\\n\\u2028\\u2029]*[tT][-_]*[oO][-_]*[kK\\u212A][-_]*[eE][-_]*[nN][-_]*|(?:[-_]*[oO][-_]*[pP][-_]*[eE][-_]*[nN][-_]*[aA][-_]*[iI][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[xX][-_]*[aA][-_]*[iI][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[aA][-_]*[nN][-_]*[tT][-_]*[hH][-_]*[rR][-_]*[oO][-_]*[pP][-_]*[iI][-_]*[cC][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[gG][-_]*[eE][-_]*[mM][-_]*[iI][-_]*[nN][-_]*[iI][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[gG][-_]*[iI][-_]*[tT][-_]*[hH][-_]*[uU][-_]*[bB][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[gG][-_]*[oO][-_]*[oO][-_]*[gG][-_]*[lL][-_]*[eE][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[aA][-_]*[wW][-_]*[sS][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[pP][-_]*[rR][-_]*[iI][-_]*[vV][-_]*[aA][-_]*[tT][-_]*[eE][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[sS][-_]*[eE][-_]*[cC][-_]*[rR][-_]*[eE][-_]*[tT][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[aA][-_]*[cC][-_]*[cC][-_]*[eE][-_]*[sS][-_]*[sS][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[aA][-_]*[uU][-_]*[tT][-_]*[hH][-_]*[oO][-_]*[rR][-_]*[iI][-_]*[zZ][-_]*[aA][-_]*[tT][-_]*[iI][-_]*[oO][-_]*[nN][-_]*|[-_]*[pP][-_]*[aA][-_]*[sS][-_]*[sS][-_]*[wW][-_]*[dD][-_]*)|[-_]*[bB][-_]*[eE][-_]*[aA][-_]*[rR][-_]*[eE][-_]*[rR](?=([^?&=#\\r\\n\\u2028\\u2029]*))\\4)(?:[\\r\\n\\u2028\\u2029]*=|&|#|$)", 'u');
const URL_QUERY_SCHEMA_PATTERN = "(?://|(?<![A-Za-z0-9._~%+/@-])[A-Za-z0-9-]+\\.[A-Za-z]{2})(?:(?!//|(?<![A-Za-z0-9._~%+/@-])[A-Za-z0-9-]+\\.[A-Za-z]{2})[^\\r\\n\\u2028\\u2029])*?[?&#](?=[^?&=#\\r\\n\\u2028\\u2029]*[\\r\\n\\u2028\\u2029]*=)[^?&=#\\r\\n\\u2028\\u2029]*?(?:(?<![A-Za-z0-9_-])[A-Za-z0-9_-]*?[tT][-_]*[oO][-_]*[kK\\u212A][-_]*[eE][-_]*[nN][-_]*(?![A-Za-z0-9_-])|[aA][-_]*[pP][-_]*[iI][-_]*[kK\\u212A][-_]*[eE][-_]*[yY]|[sS][-_]*[eE][-_]*[cC][-_]*[rR][-_]*[eE][-_]*[tT]|[pP][-_]*[aA][-_]*[sS][-_]*[sS][-_]*[wW][-_]*[oO][-_]*[rR][-_]*[dD]|(?<![A-Za-z0-9_-])(?:[-_]*[oO][-_]*[pP][-_]*[eE][-_]*[nN][-_]*[aA][-_]*[iI][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[xX][-_]*[aA][-_]*[iI][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[aA][-_]*[nN][-_]*[tT][-_]*[hH][-_]*[rR][-_]*[oO][-_]*[pP][-_]*[iI][-_]*[cC][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[gG][-_]*[eE][-_]*[mM][-_]*[iI][-_]*[nN][-_]*[iI][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[gG][-_]*[iI][-_]*[tT][-_]*[hH][-_]*[uU][-_]*[bB][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[gG][-_]*[oO][-_]*[oO][-_]*[gG][-_]*[lL][-_]*[eE][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[aA][-_]*[wW][-_]*[sS][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[pP][-_]*[rR][-_]*[iI][-_]*[vV][-_]*[aA][-_]*[tT][-_]*[eE][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[sS][-_]*[eE][-_]*[cC][-_]*[rR][-_]*[eE][-_]*[tT][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[aA][-_]*[cC][-_]*[cC][-_]*[eE][-_]*[sS][-_]*[sS][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[aA][-_]*[uU][-_]*[tT][-_]*[hH][-_]*[oO][-_]*[rR][-_]*[iI][-_]*[zZ][-_]*[aA][-_]*[tT][-_]*[iI][-_]*[oO][-_]*[nN][-_]*|[-_]*[pP][-_]*[aA][-_]*[sS][-_]*[sS][-_]*[wW][-_]*[dD][-_]*)(?![A-Za-z0-9_-])|(?<![A-Za-z0-9_-])[-_]*[bB][-_]*[eE][-_]*[aA][-_]*[rR][-_]*[eE][-_]*[rR])|(?://|(?<![A-Za-z0-9._~%+/@-])[A-Za-z0-9-]+\\.[A-Za-z]{2})(?:(?!//|(?<![A-Za-z0-9._~%+/@-])[A-Za-z0-9-]+\\.[A-Za-z]{2})[^\\r\\n\\u2028\\u2029])*?[?&](?:(?=[^?&=#\\r\\n\\u2028\\u2029]*(?:[aA][-_]*[pP][-_]*[iI][-_]*[kK\\u212A][-_]*[eE][-_]*[yY]|[sS][-_]*[eE][-_]*[cC][-_]*[rR][-_]*[eE][-_]*[tT]|[pP][-_]*[aA][-_]*[sS][-_]*[sS][-_]*[wW][-_]*[oO][-_]*[rR][-_]*[dD]))(?=([^?&=#\\r\\n\\u2028\\u2029]*))\\1|[^?&=#\\r\\n\\u2028\\u2029]*[tT][-_]*[oO][-_]*[kK\\u212A][-_]*[eE][-_]*[nN][-_]*|(?:[-_]*[oO][-_]*[pP][-_]*[eE][-_]*[nN][-_]*[aA][-_]*[iI][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[xX][-_]*[aA][-_]*[iI][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[aA][-_]*[nN][-_]*[tT][-_]*[hH][-_]*[rR][-_]*[oO][-_]*[pP][-_]*[iI][-_]*[cC][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[gG][-_]*[eE][-_]*[mM][-_]*[iI][-_]*[nN][-_]*[iI][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[gG][-_]*[iI][-_]*[tT][-_]*[hH][-_]*[uU][-_]*[bB][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[gG][-_]*[oO][-_]*[oO][-_]*[gG][-_]*[lL][-_]*[eE][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[aA][-_]*[wW][-_]*[sS][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[pP][-_]*[rR][-_]*[iI][-_]*[vV][-_]*[aA][-_]*[tT][-_]*[eE][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[sS][-_]*[eE][-_]*[cC][-_]*[rR][-_]*[eE][-_]*[tT][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[aA][-_]*[cC][-_]*[cC][-_]*[eE][-_]*[sS][-_]*[sS][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[aA][-_]*[uU][-_]*[tT][-_]*[hH][-_]*[oO][-_]*[rR][-_]*[iI][-_]*[zZ][-_]*[aA][-_]*[tT][-_]*[iI][-_]*[oO][-_]*[nN][-_]*|[-_]*[pP][-_]*[aA][-_]*[sS][-_]*[sS][-_]*[wW][-_]*[dD][-_]*)|[-_]*[bB][-_]*[eE][-_]*[aA][-_]*[rR][-_]*[eE][-_]*[rR](?=([^?&=#\\r\\n\\u2028\\u2029]*))\\2)(?=[\\t\\n\\v\\f\\r \\u0085\\u00a0\\u00ad\\u1680\\u180e\\u2000-\\u200d\\u2028\\u2029\\u202f\\u205f\\u2060\\u3000\\ufeff]|[/@?#&=\\u0022\\u0027]|;(?!$)|$)|(?://|(?<![A-Za-z0-9._~%+/@-])[A-Za-z0-9-]+\\.[A-Za-z]{2})(?:(?!//|(?<![A-Za-z0-9._~%+/@-])[A-Za-z0-9-]+\\.[A-Za-z]{2})[^\\r\\n\\u2028\\u2029])*?[?&](?:(?=[^?&=#\\r\\n\\u2028\\u2029]*(?:[aA][-_]*[pP][-_]*[iI][-_]*[kK\\u212A][-_]*[eE][-_]*[yY]|[sS][-_]*[eE][-_]*[cC][-_]*[rR][-_]*[eE][-_]*[tT]|[pP][-_]*[aA][-_]*[sS][-_]*[sS][-_]*[wW][-_]*[oO][-_]*[rR][-_]*[dD]))(?=([^?&=#\\r\\n\\u2028\\u2029]*))\\3|[^?&=#\\r\\n\\u2028\\u2029]*[tT][-_]*[oO][-_]*[kK\\u212A][-_]*[eE][-_]*[nN][-_]*|(?:[-_]*[oO][-_]*[pP][-_]*[eE][-_]*[nN][-_]*[aA][-_]*[iI][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[xX][-_]*[aA][-_]*[iI][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[aA][-_]*[nN][-_]*[tT][-_]*[hH][-_]*[rR][-_]*[oO][-_]*[pP][-_]*[iI][-_]*[cC][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[gG][-_]*[eE][-_]*[mM][-_]*[iI][-_]*[nN][-_]*[iI][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[gG][-_]*[iI][-_]*[tT][-_]*[hH][-_]*[uU][-_]*[bB][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[gG][-_]*[oO][-_]*[oO][-_]*[gG][-_]*[lL][-_]*[eE][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[aA][-_]*[wW][-_]*[sS][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[pP][-_]*[rR][-_]*[iI][-_]*[vV][-_]*[aA][-_]*[tT][-_]*[eE][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[sS][-_]*[eE][-_]*[cC][-_]*[rR][-_]*[eE][-_]*[tT][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[aA][-_]*[cC][-_]*[cC][-_]*[eE][-_]*[sS][-_]*[sS][-_]*[kK\\u212A][-_]*[eE][-_]*[yY][-_]*|[-_]*[aA][-_]*[uU][-_]*[tT][-_]*[hH][-_]*[oO][-_]*[rR][-_]*[iI][-_]*[zZ][-_]*[aA][-_]*[tT][-_]*[iI][-_]*[oO][-_]*[nN][-_]*|[-_]*[pP][-_]*[aA][-_]*[sS][-_]*[sS][-_]*[wW][-_]*[dD][-_]*)|[-_]*[bB][-_]*[eE][-_]*[aA][-_]*[rR][-_]*[eE][-_]*[rR](?=([^?&=#\\r\\n\\u2028\\u2029]*))\\4)(?:[\\r\\n\\u2028\\u2029]*=|&|#|$)";
const URL_USERINFO_SCHEMA_PATTERN = "://(?=[^/@])[\\r\\n\\u2028\\u2029]*[^/@\\r\\n\\u2028\\u2029][^/@\\r\\n\\u2028\\u2029:]*[\\r\\n\\u2028\\u2029]*:[\\r\\n\\u2028\\u2029]*[^/@\\r\\n\\u2028\\u2029]*[\\r\\n\\u2028\\u2029]*@";
const CASE_SENSITIVE_DENYLIST = "^(?:[^]*t[-_\\r\\n\\u2028\\u2029]*o[-_\\r\\n\\u2028\\u2029]*[k\\u212A][-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*n[-_\\r\\n\\u2028\\u2029]*|[^]*a[-_\\r\\n\\u2028\\u2029]*p[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*[k\\u212A][-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[^]*|[-_\\r\\n\\u2028\\u2029]*o[-_\\r\\n\\u2028\\u2029]*p[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*n[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*[k\\u212A][-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*x[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*[k\\u212A][-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*n[-_\\r\\n\\u2028\\u2029]*t[-_\\r\\n\\u2028\\u2029]*h[-_\\r\\n\\u2028\\u2029]*r[-_\\r\\n\\u2028\\u2029]*o[-_\\r\\n\\u2028\\u2029]*p[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*c[-_\\r\\n\\u2028\\u2029]*[k\\u212A][-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*g[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*m[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*n[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*[k\\u212A][-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*g[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*t[-_\\r\\n\\u2028\\u2029]*h[-_\\r\\n\\u2028\\u2029]*u[-_\\r\\n\\u2028\\u2029]*b[-_\\r\\n\\u2028\\u2029]*[k\\u212A][-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*g[-_\\r\\n\\u2028\\u2029]*o[-_\\r\\n\\u2028\\u2029]*o[-_\\r\\n\\u2028\\u2029]*g[-_\\r\\n\\u2028\\u2029]*l[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*[k\\u212A][-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*w[-_\\r\\n\\u2028\\u2029]*s[-_\\r\\n\\u2028\\u2029]*[k\\u212A][-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*p[-_\\r\\n\\u2028\\u2029]*r[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*v[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*t[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*[k\\u212A][-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*s[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*c[-_\\r\\n\\u2028\\u2029]*r[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*t[-_\\r\\n\\u2028\\u2029]*[k\\u212A][-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*c[-_\\r\\n\\u2028\\u2029]*c[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*s[-_\\r\\n\\u2028\\u2029]*s[-_\\r\\n\\u2028\\u2029]*[k\\u212A][-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[^]*s[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*c[-_\\r\\n\\u2028\\u2029]*r[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*t[^]*|[^]*p[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*s[-_\\r\\n\\u2028\\u2029]*s[-_\\r\\n\\u2028\\u2029]*w[-_\\r\\n\\u2028\\u2029]*o[-_\\r\\n\\u2028\\u2029]*r[-_\\r\\n\\u2028\\u2029]*d[^]*|[-_\\r\\n\\u2028\\u2029]*p[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*s[-_\\r\\n\\u2028\\u2029]*s[-_\\r\\n\\u2028\\u2029]*w[-_\\r\\n\\u2028\\u2029]*d[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*u[-_\\r\\n\\u2028\\u2029]*t[-_\\r\\n\\u2028\\u2029]*h[-_\\r\\n\\u2028\\u2029]*o[-_\\r\\n\\u2028\\u2029]*r[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*z[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*t[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*o[-_\\r\\n\\u2028\\u2029]*n[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*b[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*r[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*r[^]*)$";
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
    (mutation === 'M14' ? /xai-|sk-|bearer[\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/i : /xai-|sk-|bearer[\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]|\*{6}/i).test(item) || URL_CREDENTIAL.test(item));
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
  'csrfToken', 'SESSION_TOKEN', 'accessKey', 'ACCESS_KEY', 'access-key'
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
  sourceNoteProse: 'see doi.org/10.1/abc and www.example.com/page for the valerian sleep trial',
  // Reviewer must-fix: after '#', a name is a parameter only when '=' follows it (doc anchors pass).
  anchorApiKeys: 'https://docs.x.ai/docs/quickstart#api-keys',
  anchorPasswordReset: 'https://help.example.com/faq#password-reset',
  anchorPersonalAccessToken: 'https://docs.github.com/en/authentication#personal-access-token',
  anchorToken: 'https://e.com/guide#token',
  ncbiBookAnchor: 'https://www.ncbi.nlm.nih.gov/books/NBK92774/#ch5.s3',
  monographAnchor: 'https://example.org/monograph#contraindications',
  longProseTokenizer: 'Source doi.org/10.1/abc first. ' + 'Valerian and sleep notes. '.repeat(190) + 'Then example.org/usage?tokenizer=5 late.',
  longRunTokenizer: 'doi.org/10.1/' + 'a'.repeat(5000) + '?tokenizer=5'
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
// F6c: scheme:// and // start URL context at any position in a run (as at 10d0045); a bare name.tld starts it after any
// non-URL character. The schema pattern on its own must reject these, not only the stripper.
const F6_MIDRUN_DENY = [
  '[docs](https://e.com/?token=1)', 'see the [link](https://e.com/?api_key=1).', '<a href="https://e.com/?token=1">x</a>',
  '**https://e.com/?token=1**', 'url=https://e.com/?token=1', 'see:https://ex.com/?token=1', 'foo:https://e.com/?password=1',
  'text,https://e.com/?token=1', 'x,https://ex.com/?password=1', 'src=//cdn.ex.com/?token=1',
  'see:https://x.example/a?access_token=abc', 'url=https://x.example/a?client_secret=abc',
  'see:example.com/x?api_key=1', '(www.example.com/p?api_key=a)', 'https://e.com/?token next'
];
const schemaUrlOnly = new RegExp(readJson(SCHEMA_PATH).$defs.noSecrets.allOf[2].then.not.pattern, 'u');
for (const text of F6_MIDRUN_DENY) {
  check(`F6c schema :306 alone rejects ${JSON.stringify(text)}`, schemaUrlOnly.test(text));
  const fixture = structuredClone(requiredFixture('hbf-core-only.json'));
  fixture.link = text;
  fixture.sources = [{ title: 'keep', url: text }];
  fixture.ext = { herbalBookForge: { url: text, nested: { deeper: [{ url: text, keep: 1 }] } } };
  const midPointers = ['/link', '/sources/0/url', '/ext/herbalBookForge/url', '/ext/herbalBookForge/nested/deeper/0/url'];
  for (const pointer of midPointers) expectDenylisted(`F6c mid-run ${JSON.stringify(text)} rejected at ${pointer}`, fixture, pointer);
  const pointers = [];
  stripSecrets(fixture, '', pointers);
  check(`F6c import stripper removes mid-run ${JSON.stringify(text)} at every depth`, equal([...pointers].sort(), [...midPointers].sort()), JSON.stringify(pointers));
}
const F6_MIDRUN_ALLOW = [
  'see:https://ncbi.nlm.nih.gov/books/NBK92774/#ch5.s3', 'url=https://e.com/a?tokenizer=5&key=abc',
  'what?token=1', 'e.g.?token=1', 'Fig.2?token=x', ...Object.values(HBF_ALLOW_URLS).map((u) => `see:${u}`)
];
for (const text of F6_MIDRUN_ALLOW) {
  check(`F6c schema :306 alone allows ${JSON.stringify(text)}`, !schemaUrlOnly.test(text));
  const fixture = structuredClone(requiredFixture('hbf-core-only.json'));
  fixture.link = text;
  fixture.sources = [{ title: 'keep', url: text }];
  fixture.ext = { herbalBookForge: { url: text, nested: { deeper: [{ url: text, note: text }] } } };
  const bytesBefore = JSON.stringify(fixture);
  expectValid(`F6c must-pass ${JSON.stringify(text)} at every depth`, fixture);
  const pointers = [];
  stripSecrets(fixture, '', pointers);
  check(`F6c must-pass ${JSON.stringify(text)} byte-for-byte through the stripper`, JSON.stringify(fixture) === bytesBefore && pointers.length === 0, JSON.stringify(pointers));
}
// M1 (corrected, CoS must-fix): when a parameter has a value, its name is split on [^A-Za-z0-9_-] (empty pieces ignored) and denied
// if the whole name or any piece matches the locked rule. Applies after '?', '&' and '#'. No percent-decoding. Valueless names unchanged.
const M1_BASE = 'https://x.example/a';
const M1_DENY = [
  '?token;=abc', '?p=1&token;=abc', '?token)=abc', '?token,=abc', '?token.=abc', '?token!=abc', '?token:=abc', "?token'=abc", '?token%3B=abc', '?token;x=abc',
  '?authorization;=abc', '#access_token;=abc', '?access_token;=abc', '?access_token)=abc', '?sessionToken;=abc', '?sessionToken)=abc',
  '?bearer_x;=1', '?passwd)=1', '?a=1&token;=abc&page=2', '?auth[token]=abc'
];
const M1_STAY_STRIPPED = [
  '?x;password=abc', '?x:token=abc', '?a.client_secret=abc', '?cfg.access_token=abc', '?x%3Bpassword=abc', '?my.api_key=abc',
  '?user.token=abc', '?oauth.access_token=abc', '?password;=abc', '?api_key;=abc', '?client_secret;=abc'
];
for (const [label, list] of [['M1 deny', M1_DENY], ['M1 must-stay-stripped', M1_STAY_STRIPPED]]) {
  for (const q of list) {
    const text = M1_BASE + q;
    check(`${label} schema :306 alone rejects ${JSON.stringify(text)}`, schemaUrlOnly.test(text));
    const fixture = structuredClone(requiredFixture('hbf-core-only.json'));
    fixture.link = text;
    fixture.sources = [{ title: 'keep', url: text }];
    fixture.ext = { herbalBookForge: { url: text, nested: { deeper: [{ url: text, keep: 1 }] } } };
    const m1Pointers = ['/link', '/sources/0/url', '/ext/herbalBookForge/url', '/ext/herbalBookForge/nested/deeper/0/url'];
    for (const pointer of m1Pointers) expectDenylisted(`${label} ${JSON.stringify(text)} rejected at ${pointer}`, fixture, pointer);
    const pointers = [];
    stripSecrets(fixture, '', pointers);
    check(`${label} import stripper removes ${JSON.stringify(text)} at every depth`, equal([...pointers].sort(), [...m1Pointers].sort()), JSON.stringify(pointers));
  }
}
const M1_ALLOW = [
  ...['?tokenizer=x', '?tokens=5', '?tokenCount=3', '?token_budget=1', '?myTokenValue=1', '?accessKeyId=1', '?tokenizer;=x', '?token;'].map((q) => M1_BASE + q),
  ...Object.values(HBF_ALLOW_URLS), ...Object.values(F6_ALLOW_URLS)
];
for (const text of M1_ALLOW) {
  check(`M1 schema :306 alone allows ${JSON.stringify(text)}`, !schemaUrlOnly.test(text));
  const fixture = structuredClone(requiredFixture('hbf-core-only.json'));
  fixture.link = text;
  fixture.sources = [{ title: 'keep', url: text }];
  fixture.ext = { herbalBookForge: { url: text, nested: { deeper: [{ url: text, note: text }] } } };
  const bytesBefore = JSON.stringify(fixture);
  expectValid(`M1 must-pass ${JSON.stringify(text)} at every depth`, fixture);
  const pointers = [];
  stripSecrets(fixture, '', pointers);
  check(`M1 must-pass ${JSON.stringify(text)} byte-for-byte through the stripper`, JSON.stringify(fixture) === bytesBefore && pointers.length === 0, JSON.stringify(pointers));
}// F6 distance: a credential parameter is caught however far into the URL-like run it sits (no look-back cap).
for (const distance of [4095, 4096, 4097, 65536]) {
  for (const [prefix, label] of [['https://example.org/', 'scheme'], ['//cdn.example.org/', 'protocol-relative'], ['doi.org/', 'bare domain']]) {
    const deny = prefix + 'a'.repeat(distance) + '?access_token=REDACTED-TEST-VALUE';
    const allow = prefix + 'a'.repeat(distance) + '?tokenizer=5';
    const fixture = structuredClone(requiredFixture('2.0-minimal.json'));
    fixture.ext = { futureTool: { url: deny, nested: [{ url: deny }], keep: allow } };
    expectDenylisted(`F6 ${label} credential at distance ${distance} rejected`, fixture, '/ext/futureTool/url');
    const pointers = [];
    stripSecrets(fixture, '', pointers);
    check(`F6 ${label} credential at distance ${distance} stripped, benign sibling kept`,
      equal(pointers, ['/ext/futureTool/url', '/ext/futureTool/nested/0/url']) && fixture.ext.futureTool.keep === allow);
    const allowFixture = structuredClone(requiredFixture('2.0-minimal.json'));
    allowFixture.ext = { futureTool: { url: allow } };
    expectValid(`F6 ${label} benign param at distance ${distance} passes`, allowFixture);
  }
}
// ReDoS (Copilot r4300894368, r4300894384, r4300929421): the key rule (:253) on underscore runs and every userinfo pattern
// (:261 endpoint, :274 url, :306, harness URL_CREDENTIAL / URL_USERINFO_SCHEMA_PATTERN) on colon runs stay linear:
// (t(4N)+1)/(t(N)+1) < 8 for N = 2k -> 8k and 8k -> 32k, schema-alone and harness copies separately.
{
  const schemaDoc = readJson(SCHEMA_PATH);
  const schemaKeyRe = new RegExp(Object.keys(schemaDoc.$defs.noSecrets.allOf[0].then.patternProperties)[0], 'u');
  const fileText = fs.readFileSync(SCHEMA_PATH, 'utf8').split(/\r?\n/);
  const userinfoLines = fileText.map((l, i) => [i + 1, l.trim()]).filter(([, l]) => /^"pattern": "::?\/\/\[\^\/@/.test(l) || /^"pattern": ":\/\/\(\?=/.test(l) || /^"pattern": ":\/\/\[/.test(l));
  check('ReDoS: schema has userinfo patterns at the endpoint, url and string-rule lines', userinfoLines.length >= 3, JSON.stringify(userinfoLines.map(([n]) => n)));
  const reTime = (re, s) => { let best = Infinity; for (let r = 0; r < 3; r += 1) { const t0 = performance.now(); re.test(s); best = Math.min(best, performance.now() - t0); } return best; };
  const rows = [
    ['schema :253 key rule', schemaKeyRe, (n) => '_'.repeat(n) + 'x'],
    ['harness CASE_SENSITIVE_DENYLIST (M4 copy of :253)', new RegExp(CASE_SENSITIVE_DENYLIST, 'u'), (n) => '_'.repeat(n) + 'x'],
    ...userinfoLines.flatMap(([line, l]) => {
      const re = new RegExp(JSON.parse(l.replace(/^"pattern": /, '').replace(/,$/, '')), 'u');
      return [[`schema :${line} userinfo`, re, (n) => 'https://a' + ':'.repeat(n)], [`schema :${line} userinfo (query note)`, re, (n) => 'https://example.test?note=' + ':'.repeat(n)]];
    }),
    ['harness URL_CREDENTIAL userinfo', URL_CREDENTIAL, (n) => 'https://a' + ':'.repeat(n)],
    ['harness URL_CREDENTIAL userinfo (query note)', URL_CREDENTIAL, (n) => 'https://example.test?note=' + ':'.repeat(n)],
    ['harness URL_USERINFO_SCHEMA_PATTERN', new RegExp(URL_USERINFO_SCHEMA_PATTERN, 'u'), (n) => 'https://a' + ':'.repeat(n)]
  ];
  for (const [name, re, make] of rows) {
    re.test(make(256));
    const t = Object.fromEntries([2048, 8192, 32768].map((n) => [n, reTime(re, make(n))]));
    for (const [a, b] of [[2048, 8192], [8192, 32768]]) {
      const ratio = (t[b] + 1) / (t[a] + 1);
      check(`ReDoS ${name} linear ${a}->${b}: (t4N+1)/(tN+1) < 8`, ratio < 8, `t(${a})=${t[a].toFixed(1)} ms, t(${b})=${t[b].toFixed(1)} ms, ratio ${ratio.toFixed(2)}`);
    }
  }
  // meaning unchanged on the shapes the rows use: none of these is a secret key or a userinfo URL
  check('ReDoS: underscore-run key normalizes to an allowed name', !schemaKeyRe.test('_'.repeat(2048) + 'x'));
  check('ReDoS: colon run without @ is not userinfo', !URL_CREDENTIAL.test('https://a' + ':'.repeat(2048)));
}// ReDoS round 2 (CoS 10:05 PM): userinfo meaning is unchanged for empty or ':'-led user parts, more separator shapes stay linear,
// and a seeded fuzz shows the rewritten key and userinfo patterns match exactly what the 735eb4f patterns matched.
{
  const REF_KEY_735EB4F = "^(?:[^]*[-_\\r\\n\\u2028\\u2029]*[tT][-_\\r\\n\\u2028\\u2029]*[oO][-_\\r\\n\\u2028\\u2029]*[kK][-_\\r\\n\\u2028\\u2029]*[eE][-_\\r\\n\\u2028\\u2029]*[nN][-_\\r\\n\\u2028\\u2029]*|[^]*[-_\\r\\n\\u2028\\u2029]*[aA][-_\\r\\n\\u2028\\u2029]*[pP][-_\\r\\n\\u2028\\u2029]*[iI][-_\\r\\n\\u2028\\u2029]*[kK][-_\\r\\n\\u2028\\u2029]*[eE][-_\\r\\n\\u2028\\u2029]*[yY][-_\\r\\n\\u2028\\u2029]*[^]*|[-_\\r\\n\\u2028\\u2029]*[oO][-_\\r\\n\\u2028\\u2029]*[pP][-_\\r\\n\\u2028\\u2029]*[eE][-_\\r\\n\\u2028\\u2029]*[nN][-_\\r\\n\\u2028\\u2029]*[aA][-_\\r\\n\\u2028\\u2029]*[iI][-_\\r\\n\\u2028\\u2029]*[kK][-_\\r\\n\\u2028\\u2029]*[eE][-_\\r\\n\\u2028\\u2029]*[yY][-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*[xX][-_\\r\\n\\u2028\\u2029]*[aA][-_\\r\\n\\u2028\\u2029]*[iI][-_\\r\\n\\u2028\\u2029]*[kK][-_\\r\\n\\u2028\\u2029]*[eE][-_\\r\\n\\u2028\\u2029]*[yY][-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*[aA][-_\\r\\n\\u2028\\u2029]*[nN][-_\\r\\n\\u2028\\u2029]*[tT][-_\\r\\n\\u2028\\u2029]*[hH][-_\\r\\n\\u2028\\u2029]*[rR][-_\\r\\n\\u2028\\u2029]*[oO][-_\\r\\n\\u2028\\u2029]*[pP][-_\\r\\n\\u2028\\u2029]*[iI][-_\\r\\n\\u2028\\u2029]*[cC][-_\\r\\n\\u2028\\u2029]*[kK][-_\\r\\n\\u2028\\u2029]*[eE][-_\\r\\n\\u2028\\u2029]*[yY][-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*[gG][-_\\r\\n\\u2028\\u2029]*[eE][-_\\r\\n\\u2028\\u2029]*[mM][-_\\r\\n\\u2028\\u2029]*[iI][-_\\r\\n\\u2028\\u2029]*[nN][-_\\r\\n\\u2028\\u2029]*[iI][-_\\r\\n\\u2028\\u2029]*[kK][-_\\r\\n\\u2028\\u2029]*[eE][-_\\r\\n\\u2028\\u2029]*[yY][-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*[gG][-_\\r\\n\\u2028\\u2029]*[iI][-_\\r\\n\\u2028\\u2029]*[tT][-_\\r\\n\\u2028\\u2029]*[hH][-_\\r\\n\\u2028\\u2029]*[uU][-_\\r\\n\\u2028\\u2029]*[bB][-_\\r\\n\\u2028\\u2029]*[kK][-_\\r\\n\\u2028\\u2029]*[eE][-_\\r\\n\\u2028\\u2029]*[yY][-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*[gG][-_\\r\\n\\u2028\\u2029]*[oO][-_\\r\\n\\u2028\\u2029]*[oO][-_\\r\\n\\u2028\\u2029]*[gG][-_\\r\\n\\u2028\\u2029]*[lL][-_\\r\\n\\u2028\\u2029]*[eE][-_\\r\\n\\u2028\\u2029]*[kK][-_\\r\\n\\u2028\\u2029]*[eE][-_\\r\\n\\u2028\\u2029]*[yY][-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*[aA][-_\\r\\n\\u2028\\u2029]*[wW][-_\\r\\n\\u2028\\u2029]*[sS][-_\\r\\n\\u2028\\u2029]*[kK][-_\\r\\n\\u2028\\u2029]*[eE][-_\\r\\n\\u2028\\u2029]*[yY][-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*[pP][-_\\r\\n\\u2028\\u2029]*[rR][-_\\r\\n\\u2028\\u2029]*[iI][-_\\r\\n\\u2028\\u2029]*[vV][-_\\r\\n\\u2028\\u2029]*[aA][-_\\r\\n\\u2028\\u2029]*[tT][-_\\r\\n\\u2028\\u2029]*[eE][-_\\r\\n\\u2028\\u2029]*[kK][-_\\r\\n\\u2028\\u2029]*[eE][-_\\r\\n\\u2028\\u2029]*[yY][-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*[sS][-_\\r\\n\\u2028\\u2029]*[eE][-_\\r\\n\\u2028\\u2029]*[cC][-_\\r\\n\\u2028\\u2029]*[rR][-_\\r\\n\\u2028\\u2029]*[eE][-_\\r\\n\\u2028\\u2029]*[tT][-_\\r\\n\\u2028\\u2029]*[kK][-_\\r\\n\\u2028\\u2029]*[eE][-_\\r\\n\\u2028\\u2029]*[yY][-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*[aA][-_\\r\\n\\u2028\\u2029]*[cC][-_\\r\\n\\u2028\\u2029]*[cC][-_\\r\\n\\u2028\\u2029]*[eE][-_\\r\\n\\u2028\\u2029]*[sS][-_\\r\\n\\u2028\\u2029]*[sS][-_\\r\\n\\u2028\\u2029]*[kK][-_\\r\\n\\u2028\\u2029]*[eE][-_\\r\\n\\u2028\\u2029]*[yY][-_\\r\\n\\u2028\\u2029]*|[^]*[-_\\r\\n\\u2028\\u2029]*[sS][-_\\r\\n\\u2028\\u2029]*[eE][-_\\r\\n\\u2028\\u2029]*[cC][-_\\r\\n\\u2028\\u2029]*[rR][-_\\r\\n\\u2028\\u2029]*[eE][-_\\r\\n\\u2028\\u2029]*[tT][-_\\r\\n\\u2028\\u2029]*[^]*|[^]*[-_\\r\\n\\u2028\\u2029]*[pP][-_\\r\\n\\u2028\\u2029]*[aA][-_\\r\\n\\u2028\\u2029]*[sS][-_\\r\\n\\u2028\\u2029]*[sS][-_\\r\\n\\u2028\\u2029]*[wW][-_\\r\\n\\u2028\\u2029]*[oO][-_\\r\\n\\u2028\\u2029]*[rR][-_\\r\\n\\u2028\\u2029]*[dD][-_\\r\\n\\u2028\\u2029]*[^]*|[-_\\r\\n\\u2028\\u2029]*[pP][-_\\r\\n\\u2028\\u2029]*[aA][-_\\r\\n\\u2028\\u2029]*[sS][-_\\r\\n\\u2028\\u2029]*[sS][-_\\r\\n\\u2028\\u2029]*[wW][-_\\r\\n\\u2028\\u2029]*[dD][-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*[aA][-_\\r\\n\\u2028\\u2029]*[uU][-_\\r\\n\\u2028\\u2029]*[tT][-_\\r\\n\\u2028\\u2029]*[hH][-_\\r\\n\\u2028\\u2029]*[oO][-_\\r\\n\\u2028\\u2029]*[rR][-_\\r\\n\\u2028\\u2029]*[iI][-_\\r\\n\\u2028\\u2029]*[zZ][-_\\r\\n\\u2028\\u2029]*[aA][-_\\r\\n\\u2028\\u2029]*[tT][-_\\r\\n\\u2028\\u2029]*[iI][-_\\r\\n\\u2028\\u2029]*[oO][-_\\r\\n\\u2028\\u2029]*[nN][-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*[bB][-_\\r\\n\\u2028\\u2029]*[eE][-_\\r\\n\\u2028\\u2029]*[aA][-_\\r\\n\\u2028\\u2029]*[rR][-_\\r\\n\\u2028\\u2029]*[eE][-_\\r\\n\\u2028\\u2029]*[rR][-_\\r\\n\\u2028\\u2029]*[^]*)$";
  const REF_KEY_CS_735EB4F = "^(?:[^]*[-_\\r\\n\\u2028\\u2029]*t[-_\\r\\n\\u2028\\u2029]*o[-_\\r\\n\\u2028\\u2029]*k[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*n[-_\\r\\n\\u2028\\u2029]*|[^]*[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*p[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*k[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*[^]*|[-_\\r\\n\\u2028\\u2029]*o[-_\\r\\n\\u2028\\u2029]*p[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*n[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*k[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*x[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*k[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*n[-_\\r\\n\\u2028\\u2029]*t[-_\\r\\n\\u2028\\u2029]*h[-_\\r\\n\\u2028\\u2029]*r[-_\\r\\n\\u2028\\u2029]*o[-_\\r\\n\\u2028\\u2029]*p[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*c[-_\\r\\n\\u2028\\u2029]*k[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*g[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*m[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*n[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*k[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*g[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*t[-_\\r\\n\\u2028\\u2029]*h[-_\\r\\n\\u2028\\u2029]*u[-_\\r\\n\\u2028\\u2029]*b[-_\\r\\n\\u2028\\u2029]*k[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*g[-_\\r\\n\\u2028\\u2029]*o[-_\\r\\n\\u2028\\u2029]*o[-_\\r\\n\\u2028\\u2029]*g[-_\\r\\n\\u2028\\u2029]*l[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*k[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*w[-_\\r\\n\\u2028\\u2029]*s[-_\\r\\n\\u2028\\u2029]*k[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*p[-_\\r\\n\\u2028\\u2029]*r[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*v[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*t[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*k[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*s[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*c[-_\\r\\n\\u2028\\u2029]*r[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*t[-_\\r\\n\\u2028\\u2029]*k[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*c[-_\\r\\n\\u2028\\u2029]*c[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*s[-_\\r\\n\\u2028\\u2029]*s[-_\\r\\n\\u2028\\u2029]*k[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*y[-_\\r\\n\\u2028\\u2029]*|[^]*[-_\\r\\n\\u2028\\u2029]*s[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*c[-_\\r\\n\\u2028\\u2029]*r[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*t[-_\\r\\n\\u2028\\u2029]*[^]*|[^]*[-_\\r\\n\\u2028\\u2029]*p[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*s[-_\\r\\n\\u2028\\u2029]*s[-_\\r\\n\\u2028\\u2029]*w[-_\\r\\n\\u2028\\u2029]*o[-_\\r\\n\\u2028\\u2029]*r[-_\\r\\n\\u2028\\u2029]*d[-_\\r\\n\\u2028\\u2029]*[^]*|[-_\\r\\n\\u2028\\u2029]*p[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*s[-_\\r\\n\\u2028\\u2029]*s[-_\\r\\n\\u2028\\u2029]*w[-_\\r\\n\\u2028\\u2029]*d[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*u[-_\\r\\n\\u2028\\u2029]*t[-_\\r\\n\\u2028\\u2029]*h[-_\\r\\n\\u2028\\u2029]*o[-_\\r\\n\\u2028\\u2029]*r[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*z[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*t[-_\\r\\n\\u2028\\u2029]*i[-_\\r\\n\\u2028\\u2029]*o[-_\\r\\n\\u2028\\u2029]*n[-_\\r\\n\\u2028\\u2029]*|[-_\\r\\n\\u2028\\u2029]*b[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*a[-_\\r\\n\\u2028\\u2029]*r[-_\\r\\n\\u2028\\u2029]*e[-_\\r\\n\\u2028\\u2029]*r[-_\\r\\n\\u2028\\u2029]*[^]*)$";
  const REF_USERINFO_735EB4F = "://[^/@\\t\\n\\v\\f\\r \\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+:[^/@\\t\\n\\v\\f\\r \\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*@";
  const schemaDoc = readJson(SCHEMA_PATH);
  const schemaText = fs.readFileSync(SCHEMA_PATH, 'utf8').split(/\r?\n/);
  const userinfoSchema = schemaText.map((l, i) => [i + 1, l.trim()]).filter(([, l]) => /^"pattern": ":\/\//.test(l))
    .map(([line, l]) => [`schema :${line}`, new RegExp(JSON.parse(l.replace(/^"pattern": /, '').replace(/,$/, '')), 'u')]);
  const userinfoAll = [...userinfoSchema, ['harness URL_CREDENTIAL', URL_CREDENTIAL], ['harness URL_USERINFO_SCHEMA_PATTERN', new RegExp(URL_USERINFO_SCHEMA_PATTERN, 'u')]];
  check('ReDoS2: five userinfo-bearing patterns found (schema :261, :274, :306, harness x2)', userinfoAll.length === 5, JSON.stringify(userinfoAll.map(([n]) => n)));
  for (const text of ['https://::pass@h', 'https://:::p@h', 'redis://:pa:ss@host', 'x://::@']) {
    for (const [name, re] of userinfoAll) check(`ReDoS2 must-stay-stripped ${JSON.stringify(text)}: ${name} rejects`, re.test(text));
    const fixture = structuredClone(requiredFixture('hbf-core-only.json'));
    fixture.link = text;
    fixture.sources = [{ title: 'keep', url: text }];
    fixture.ext = { herbalBookForge: { url: text, nested: { deeper: [{ url: text, keep: 1 }] } } };
    const uiPointers = ['/link', '/sources/0/url', '/ext/herbalBookForge/url', '/ext/herbalBookForge/nested/deeper/0/url'];
    for (const pointer of uiPointers) expectDenylisted(`ReDoS2 must-stay-stripped ${JSON.stringify(text)} rejected at ${pointer}`, fixture, pointer);
    const pointers = [];
    stripSecrets(fixture, '', pointers);
    check(`ReDoS2 import stripper removes ${JSON.stringify(text)} at every depth`, equal([...pointers].sort(), [...uiPointers].sort()), JSON.stringify(pointers));
  }
  const reTime = (re, s) => { let best = Infinity; for (let r = 0; r < 3; r += 1) { const t0 = performance.now(); re.test(s); best = Math.min(best, performance.now() - t0); } return best; };
  const keyRes = [['schema :253 key rule', new RegExp(Object.keys(schemaDoc.$defs.noSecrets.allOf[0].then.patternProperties)[0], 'u')],
    ['harness CASE_SENSITIVE_DENYLIST (smoke M4 copy)', new RegExp(CASE_SENSITIVE_DENYLIST, 'u')]];
  const keyShapes = [["'-'*N+'x'", (n) => '-'.repeat(n) + 'x'], ["'\\n'*N+'x'", (n) => '\n'.repeat(n) + 'x'], ["'\\u2028'*N+'x'", (n) => '\u2028'.repeat(n) + 'x'],
    ["'_-'*N/2+'x'", (n) => '_-'.repeat(n / 2) + 'x']];
  const rows = [...keyRes.flatMap(([name, re]) => keyShapes.map(([sn, mk]) => [`${name} ${sn}`, re, mk])),
    ...userinfoAll.map(([name, re]) => [`${name} 'a:'*N/2`, re, (n) => 'a:'.repeat(n / 2)])];
  for (const [name, re, make] of rows) {
    re.test(make(256));
    const t = Object.fromEntries([2048, 8192, 32768].map((n) => [n, reTime(re, make(n))]));
    for (const [a, b] of [[2048, 8192], [8192, 32768]]) {
      const ratio = (t[b] + 1) / (t[a] + 1);
      check(`ReDoS2 ${name} linear ${a}->${b}: (t4N+1)/(tN+1) < 8`, ratio < 8, `t(${a})=${t[a].toFixed(1)} ms, t(${b})=${t[b].toFixed(1)} ms, ratio ${ratio.toFixed(2)}`);
    }
  }
  // Seeded fuzz: same verdict as the 735eb4f patterns on every string (short strings, so the old patterns stay fast).
  let seed = 170170;
  const rand = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gen = (parts, max) => { let s = ''; for (let j = 0, L = Math.floor(rand() * max); j < L; j += 1) s += parts[Math.floor(rand() * parts.length)]; return s; };
  const keyParts = ['a', 'x', '_', '-', '\n', '\r', '\u2028', '\u2029', 't', 'token', 'Token', 'TOKEN', 'api', 'Key', 'apikey', 'secret', 'Secret', 'password', 'passwd',
    'bearer', 'authorization', 'xai', 'openai', 'aws', 'private', 'access', 'accesskey', 's', 'Id', ' ', '!'];
  const uiParts = ['://', 'https://', 'a', 'u', ':', '::', '@', '/', '_', '-', ' ', '?', '&', '#', '=', 'token', 'x.com', 'p', '.', '%3A'];
  const refKey = new RegExp(REF_KEY_735EB4F, 'u'), refKeyCs = new RegExp(REF_KEY_CS_735EB4F, 'u'), refUi = new RegExp(REF_USERINFO_735EB4F, 'u');
  const refFull = new RegExp(`${REF_USERINFO_735EB4F}|${URL_QUERY_SCHEMA_PATTERN}`, 'u');
  let keyDiff = 0, uiDiff = 0; const examples = []; const uiDiffs = Object.fromEntries(userinfoAll.map(([n]) => [n, []]));
  const uiWant = (name, u) => (name === 'harness URL_CREDENTIAL' || name === 'schema :306' ? refFull.test(u) : refUi.test(u)); // :769 split kept
  const uiDiffOf = (u) => userinfoAll.flatMap(([name, re]) => (re.test(u) !== uiWant(name, u) ? [[name, { s: u, dir: re.test(u) ? 'TIGHTEN' : 'LOOSEN' }]] : []));
  for (let i = 0; i < 40000; i += 1) {
    const k = gen(keyParts, 8);
    if (refKey.test(k) !== keyRes[0][1].test(k) || refKeyCs.test(k) !== keyRes[1][1].test(k)) { keyDiff += 1; if (examples.length < 5) examples.push(JSON.stringify(k)); }
    const u = gen(uiParts, 12);
    for (const [name, re] of userinfoAll) {
      const want = name === 'harness URL_CREDENTIAL' || name === 'schema :306' ? refFull.test(u) : refUi.test(u);
      if (re.test(u) !== want) { uiDiff += 1; uiDiffs[name].push({ s: u, dir: re.test(u) ? 'TIGHTEN' : 'LOOSEN' }); if (examples.length < 5) examples.push(`${name} ${JSON.stringify(u)}`); }
    }
  }
  check('ReDoS2 seeded fuzz: key rule (:253 and M4 copy) matches the 735eb4f patterns on 40000 keys', keyDiff === 0, examples.join(' ; '));
  // fix7.4: the userinfo verdict rule, applied to the per-pattern diff sets (current rule: no diff at all).
  const uiRuleAccepts = (d) => Object.values(d).every((l) => l.length === 0);
  check('ReDoS2 seeded fuzz: every userinfo pattern matches the 735eb4f pattern on 40000 strings', uiRuleAccepts(uiDiffs), examples.join(' ; '));
  // Red-first probe (fix7.4): PROBE is not in the pinned set and every userinfo pattern tightens on it, so the rule must accept the
  // fuzz diff sets as they are and reject them once PROBE's diffs are added.
  const PROBE = 'https://u :p@x.com'; const withProbe = structuredClone(uiDiffs); for (const [n, d] of uiDiffOf(PROBE)) withProbe[n].push(d);
  check('ReDoS2 pin probe: out-of-pin diff "https://u :p@x.com" is rejected while the fuzz diff sets are accepted',
    uiDiffOf(PROBE).length === userinfoAll.length && uiRuleAccepts(uiDiffs) && !uiRuleAccepts(withProbe), `probe diffs ${uiDiffOf(PROBE).length}, fuzz accepted ${uiRuleAccepts(uiDiffs)}`);
}
// Round 3 (Copilot on ca62ec4, CoS rulings 11:45 PM): (a) r4301070240: U+212A KELVIN SIGN lowercases to 'k' in JS, so the stripper
// denies 'api\u212Aey'; the schema :253 key rule must deny it too. (b) r4301070268: the query-name branches of schema :306,
// harness URL_CREDENTIAL and URL_QUERY_SCHEMA_PATTERN stay linear on repeated apikey/secret/password names with a non-matching tail.
{
  const schemaDoc3 = readJson(SCHEMA_PATH);
  const keyRule3 = new RegExp(Object.keys(schemaDoc3.$defs.noSecrets.allOf[0].then.patternProperties)[0], 'u');
  const kelvinKeys = ['api\u212Aey', 'API\u212AEY', 'x_api_\u212Aey', 'private\u212Aey', 'private_\u212Aey', 'PRIVATE\u212AEY',
    'access\u212Aey', 'secret\u212Aey', 'openai\u212Aey', 'xai\u212Aey', 'anthropic\u212Aey', 'gemini\u212Aey', 'github\u212Aey',
    'google\u212Aey', 'aws\u212Aey', 'to\u212Aen', 'access_to\u212Aen', 'TO\u212AEN'];
  for (const key of kelvinKeys) {
    check(`Kelvin ${JSON.stringify(key)}: harness SECRET_KEY denies (JS lowercase)`, SECRET_KEY.test(key));
    check(`Kelvin ${JSON.stringify(key)}: schema :253 key rule denies`, keyRule3.test(key));
    for (const [location, place] of [
      ['wrapper', (f) => { f[key] = 'REDACTED-TEST-VALUE'; return `/${escapePointer(key)}`; }],
      ['extension', (f) => { f.ext = { futureTool: { [key]: 'REDACTED-TEST-VALUE' } }; return `/ext/futureTool/${escapePointer(key)}`; }],
      ['array', (f) => { f.ext = { futureTool: { nested: [{ [key]: 'REDACTED-TEST-VALUE' }] } }; return `/ext/futureTool/nested/0/${escapePointer(key)}`; }]
    ]) {
      const fixture = structuredClone(requiredFixture('2.0-minimal.json'));
      const pointer = place(fixture);
      expectDenylisted(`Kelvin denylist rejects ${JSON.stringify(key)} at ${location}`, fixture, pointer);
      const pointers = [];
      stripSecrets(fixture, '', pointers);
      check(`Kelvin import stripper removes ${JSON.stringify(key)} at ${location}`, equal(pointers, [pointer]), JSON.stringify(pointers));
    }
  }
  for (const key of ['api\u212A', '\u212Aey', 'monkey', 'K', '\u212A', 'apiK', 'donkey']) {
    check(`Kelvin ${JSON.stringify(key)}: schema and SECRET_KEY agree`, keyRule3.test(key) === SECRET_KEY.test(key));
  }
  // schema :253 and the reference stripper give the same verdict on random keys, including U+212A (U+0130/U+017F: SEC-SWEEP)
  let seed3 = 170170;
  const rand3 = () => { seed3 = (seed3 + 0x6D2B79F5) | 0; let t = Math.imul(seed3 ^ (seed3 >>> 15), 1 | seed3); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const parts3 = ['api', 'private', 'access', 'secret', 'to', 'en', 'ey', 'k', 'K', '\u212A', 'i', 'I', '_', '-', '\n', 'x', 'pass', 'word', 'bearer', 'aws', 'xai', ' '];
  let agreeDiff = 0; const agreeEx = [];
  for (let i = 0; i < 40000; i += 1) {
    let k = ''; for (let j = 0, L = Math.floor(rand3() * 6); j < L; j += 1) k += parts3[Math.floor(rand3() * parts3.length)];
    if (keyRule3.test(k) !== SECRET_KEY.test(k)) { agreeDiff += 1; if (agreeEx.length < 5) agreeEx.push(JSON.stringify(k)); }
  }
  check('Kelvin seeded fuzz: schema :253 and harness SECRET_KEY agree on 40000 keys (U+212A included)', agreeDiff === 0, agreeEx.join(' ; '));
  // r4301070268 timing rows
  const reTime3 = (re, s) => { let best = Infinity; for (let r = 0; r < 3; r += 1) { const t0 = performance.now(); re.test(s); best = Math.min(best, performance.now() - t0); } return best; };
  const queryRes = [['schema :306', new RegExp(schemaDoc3.$defs.noSecrets.allOf[2].then.not.pattern, 'u')],
    ['harness URL_CREDENTIAL', URL_CREDENTIAL], ['harness URL_QUERY_SCHEMA_PATTERN', new RegExp(URL_QUERY_SCHEMA_PATTERN, 'u')]];
  for (const [name, re] of queryRes) {
    for (const stem of ['apikey', 'secret', 'password']) {
      for (const tail of ['', '?x=1']) {
        const make = (n) => 'https://example.test/?' + stem.repeat(Math.ceil(n / stem.length)) + tail;
        re.test(make(256));
        const t = Object.fromEntries([2048, 8192, 32768].map((n) => [n, reTime3(re, make(n))]));
        for (const [a, b] of [[2048, 8192], [8192, 32768]]) {
          const ratio = (t[b] + 1) / (t[a] + 1);
          check(`ReDoS3 ${name} '?'+'${stem}'*N+${JSON.stringify(tail)} linear ${a}->${b}: (t4N+1)/(tN+1) < 8`, ratio < 8, `t(${a})=${t[a].toFixed(1)} ms, t(${b})=${t[b].toFixed(1)} ms, ratio ${ratio.toFixed(2)}`);
        }
      }
    }
    // meaning on those shapes: no tail / '?x=1' = valueless name at end or before '?': stripped iff a stem is present and the name ends at $ / '='/'&'/'#'
    check(`ReDoS3 ${name}: '?apikey' x N at end of string is still denied`, re.test('https://example.test/?' + 'apikey'.repeat(4)));
    check(`ReDoS3 ${name}: '?secret' x N then space is still denied`, re.test('https://example.test/?' + 'secret'.repeat(4) + ' next'));
    check(`ReDoS3 ${name}: '?password' x N then '?x=1' is not a valueless-name match`, re.test('https://example.test/?' + 'password'.repeat(4) + '?x=1') === re.test('https://example.test/?' + 'password' + '?x=1'));
  }
  // Round 3b (CoS 11:45 PM ruling 2, probe a409edbc section 11): U+212A wherever the key rule's k is matched, including its copies:
  // the query-name stems of schema :306 / harness URL_CREDENTIAL / URL_QUERY_SCHEMA_PATTERN, and the smoke M4 copy (lowercase names only;
  // M4 stays case-sensitive by design, so 'API\u212AEY' is not expected there).
  const urlKelvin = ['api\u212Aey', 'private\u212Aey', 'to\u212Aen', 'access_to\u212Aen', 'To\u212AEN', 'access\u212Aey', 'my_api\u212Aey'];
  for (const n of urlKelvin) {
    for (const url of [`https://x.example/a?${n}=abc`, `https://x.example/a?x=1&${n}=abc`]) {
      for (const [name, re] of queryRes) check(`Kelvin URL ${JSON.stringify(url)}: ${name} denies`, re.test(url));
      const fixture = structuredClone(requiredFixture('2.0-minimal.json'));
      fixture.ext = { futureTool: { url, nested: [{ link: url, keep: 1 }] } };
      expectDenylisted(`Kelvin URL ${JSON.stringify(url)} rejected at /ext/futureTool/url`, fixture, '/ext/futureTool/url');
      const pointers = [];
      stripSecrets(fixture, '', pointers);
      check(`Kelvin URL import stripper removes ${JSON.stringify(url)} at every depth`, equal([...pointers].sort(), ['/ext/futureTool/nested/0/link', '/ext/futureTool/url']), JSON.stringify(pointers));
    }
  }
  for (const url of ['https://x.example/a?ta\u212Ae=abc', 'https://x.example/a?\u212Aelvin=abc']) {
    for (const [name, re] of queryRes) check(`Kelvin URL must-pass ${JSON.stringify(url)}: ${name} allows`, !re.test(url));
  }
  const m4Copy = new RegExp(CASE_SENSITIVE_DENYLIST, 'u');
  for (const n of ['api\u212Aey', 'my_api\u212Aey', 'private\u212Aey', 'access\u212Aey', 'openai\u212Aey', 'github\u212Aey', 'to\u212Aen', 'auth_to\u212Aen', 'access_to\u212Aen']) {
    check(`Kelvin smoke M4 copy (CASE_SENSITIVE_DENYLIST) denies ${JSON.stringify(n)}`, m4Copy.test(n));
  }
  for (const n of ['\u212Aelvin', 'ta\u212Ae']) check(`Kelvin must-pass ${JSON.stringify(n)}: schema :253 allows`, !keyRule3.test(n));
}
// F6 linearity: time(4N)/time(N) stays well under quadratic growth (16x). Ratio, not wall clock, so slow runners do not flake.
function timeIt(text) {
  const fixture = structuredClone(requiredFixture('2.0-minimal.json'));
  fixture.ext = { futureTool: { note: text } };
  let best = Infinity;
  for (let run = 0; run < 3; run += 1) {
    const started = performance.now();
    for (let i = 0; i < 5; i += 1) { validate(fixture); URL_CREDENTIAL.test(text); }
    best = Math.min(best, performance.now() - started);
  }
  return best;
}
for (const [name, make] of [
  ['long prose run', (n) => 'a.bc/' + '?&#x'.repeat(n / 4)],
  ['long query run', (n) => 'https://example.org/p?' + 'tokenx&'.repeat(Math.ceil(n / 7))],
  ['long name run', (n) => 'www.example.org/p?' + 'to'.repeat(n / 2)],
  ['many domains run', (n) => 'a.bc.'.repeat(n / 5) + '?x'],
  ['many spaced domains', (n) => 'a.bc/?tok '.repeat(n / 10)],
  ['x=http:// repeats', (n) => 'x=http://'.repeat(Math.ceil(n / 9))],
  ['comma host repeats', (n) => ',a.bc'.repeat(n / 5) + '?x'],
  ['//a.bc repeats', (n) => '//a.bc'.repeat(Math.ceil(n / 6))]
]) {
  const small = timeIt(make(16384));
  const large = timeIt(make(65536));
  const ratio = (large + 1) / (small + 1);
  check(`F6 URL matching stays linear on ${name}: time(4N)/time(N) < 8`, ratio < 8, `N=${Math.round(small)} ms, 4N=${Math.round(large)} ms, ratio ${ratio.toFixed(2)}`);
}

{
  const fileUrlPattern = readJson(SCHEMA_PATH).$defs.noSecrets.allOf[2].then.not.pattern;
  check('schema URL pattern equals harness URL_USERINFO_SCHEMA_PATTERN|URL_QUERY_SCHEMA_PATTERN',
    fileUrlPattern === `${URL_USERINFO_SCHEMA_PATTERN}|${URL_QUERY_SCHEMA_PATTERN}`);
  check('harness URL_CREDENTIAL equals the schema URL pattern (source and u flag)',
    URL_CREDENTIAL.source === new RegExp(fileUrlPattern, 'u').source && URL_CREDENTIAL.flags === 'u');
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
