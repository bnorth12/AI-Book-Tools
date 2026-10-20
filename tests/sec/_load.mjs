// SEC-SWEEP #180 (LOCKED-RULE-v2.2 r2, 5236f45a): load the stripper block shipped in each tool, unmodified, into node:vm.
// After the fix the block sits between the markers below (plan section 3). Until then (the parent commit has no markers)
// the block is the span from `const SECRET_FIELD_DENYLIST` through the end of `function stripSecretFields`, the same
// span the probes used. A load failure throws from loadTool(), so a red row is never a load error (see SS-LOAD).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const TOOLS = {
  BE: path.join(REPO, 'BookEditor', 'BookEditor.html'),
  BD: path.join(REPO, 'BookDecomposer', 'BookDecomposer.js'),
};
export const BEGIN = '// SEC-SWEEP #180 shared copy: begin';
export const END = '// SEC-SWEEP #180 shared copy: end';
export const MARK = '[credential link removed]';
// Names the block may define. Missing ones come back undefined (today: exportNotice, CREDENTIAL_URL, sanitizeString).
const NAMES = ['isSecretField', 'isSecretParam', 'foldCase', 'sanitizeString', 'stripSecretFields', 'findRemovedSecretFields', 'exportNotice', 'CREDENTIAL_URL'];

export const readTool = (tool) => fs.readFileSync(TOOLS[tool], 'utf8');

// Body of `function name(...) {...}` or `name = function(...) {...}`, by brace matching from the first `{`.
export function extractFn(src, name, from = 0) {
  let s = src.indexOf('function ' + name + '(', from);
  if (s < 0) s = src.indexOf(name + ' = function', from);
  if (s < 0) throw new Error(`extract: ${name} not found`);
  let i = src.indexOf('{', s), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) break; }
  if (d !== 0) throw new Error(`extract: unbalanced braces in ${name}`);
  return src.slice(s, i + 1);
}

export function markedBlock(src) {
  const a = src.indexOf(BEGIN);
  if (a < 0) return null;
  const b = src.indexOf(END, a);
  if (b < 0 || src.indexOf(BEGIN, a + 1) >= 0) throw new Error('extract: markers unbalanced');
  return src.slice(a + BEGIN.length, b);
}

export function stripperBlock(src) {
  const marked = markedBlock(src);
  if (marked !== null) return { block: marked, via: 'markers' };
  const a = src.indexOf('const SECRET_FIELD_DENYLIST');
  if (a < 0) throw new Error('extract: no markers and no SECRET_FIELD_DENYLIST');
  const s = src.indexOf('function stripSecretFields', a);
  if (s < 0) throw new Error('extract: no stripSecretFields after SECRET_FIELD_DENYLIST');
  return { block: src.slice(a, s) + extractFn(src, 'stripSecretFields', a), via: 'span' };
}

const cache = new Map();
export function loadTool(tool) {
  if (cache.has(tool)) return cache.get(tool);
  const { block, via } = stripperBlock(readTool(tool));
  const ctx = { URL, URLSearchParams };
  vm.createContext(ctx);
  const expose = NAMES.map((n) => `${n}: typeof ${n} === 'undefined' ? undefined : ${n}`).join(', ');
  vm.runInContext(`${block}\n;globalThis.__sec = { ${expose}, OP: Object.prototype, JP: (s) => JSON.parse(s) };`, ctx, { filename: `${tool}-stripper-block` });
  const api = { ...ctx.__sec, tool, via };
  if (typeof api.stripSecretFields !== 'function' || typeof api.isSecretField !== 'function') throw new Error(`load: ${tool} block has no stripSecretFields/isSecretField`);
  cache.set(tool, api);
  return api;
}

export const own = (o, k) => o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
export const fixture = (name) => JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'sec', 'fixtures', name), 'utf8'));
