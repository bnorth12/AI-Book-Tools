// fix7.5 (PR #185 T1/T2, CoS ruling on a079c774). Red-first rows.
// T1: line-terminator (LT) runs around the userinfo body must stay linear. Every userinfo pattern (page V1_USERINFO, V2_USERINFO,
// SRC306, CREDENTIAL_URL_SOURCE; schema :261/:274/:306; smoke harness URL_CREDENTIAL / URL_USERINFO_SCHEMA_PATTERN) on
// "//"+"\n"*N+"x" and "://a:"+LT*N (LT = \n, \u2028, \r), N = 2048/8192/32768, (t4N+1)/(tN+1) < 8 (Engineering spec).
// redactAll("//"+"\n"*32768) has a fixed budget REDACTALL_BUDGET_MS (justification below). Probe https://u\n\n:p@x.com stays redacted.
// T2: the free-text JSON pair pass must decode the JSON key before isSecretField; undecodable keys fail closed.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { markedBlock, REPO } from '../_load.mjs';
import { loadHBF, readHBF } from './_hbf-load.mjs';

const block = markedBlock(readHBF());
const ctx = vm.createContext({});
vm.runInContext(block + '\n;globalThis.__x = { V1_USERINFO, V2_USERINFO, SRC306, CREDENTIAL_URL_SOURCE, redactAll };', ctx);
const PG = ctx.__x;
const schemaLines = fs.readFileSync(path.join(REPO, 'schema', 'story-core-2.0.json'), 'utf8').split('\n');
const schemaPat = (n) => { const m = schemaLines[n - 1].match(/"pattern": "(.*)"\s*$/); assert.ok(m, 'schema :' + n + ' is not a pattern line'); return JSON.parse('"' + m[1] + '"'); };
const smoke = fs.readFileSync(path.join(REPO, 'scripts', '_smoke_story_core_contract.mjs'), 'utf8');
const smokeStr = (re) => { const m = re.exec(smoke); assert.ok(m, 'smoke constant not found ' + re); return JSON.parse(m[1]); };
const PATTERNS = [
  ['page V1_USERINFO', PG.V1_USERINFO], ['page V2_USERINFO', PG.V2_USERINFO], ['page SRC306', PG.SRC306], ['page CREDENTIAL_URL_SOURCE', PG.CREDENTIAL_URL_SOURCE],
  ['schema :261', schemaPat(261)], ['schema :274', schemaPat(274)], ['schema :306', schemaPat(306)],
  ['smoke URL_CREDENTIAL', smokeStr(/^const URL_CREDENTIAL = new RegExp\(("(?:[^"\\]|\\.)*"), 'u'\);$/m)],
  ['smoke URL_USERINFO_SCHEMA_PATTERN', smokeStr(/^const URL_USERINFO_SCHEMA_PATTERN = ("(?:[^"\\]|\\.)*");$/m)],
];
const SHAPES = [
  ["'//'+'\\n'*N+'x'", (n) => '//' + '\n'.repeat(n) + 'x'],
  ["'://a:'+'\\n'*N", (n) => '://a:' + '\n'.repeat(n)],
  ["'://a:'+'\\u2028'*N", (n) => '://a:' + '\u2028'.repeat(n)],
  ["'://a:'+'\\r'*N", (n) => '://a:' + '\r'.repeat(n)],
];
const best3 = (fn) => { let b = Infinity; for (let r = 0; r < 3; r++) { const t0 = performance.now(); fn(); b = Math.min(b, performance.now() - t0); } return b; };
// Budget: a079c774 takes ~6.5 s here (Engineering: 2.5 s @20k, 9.8 s @40k, x4 per doubling). 2000 ms is under 1/3 of that, so the
// quadratic shape is always red, and it is a hard cap on a one-string main-thread freeze on save/export/import. Set before the fix; not tuned.
export const REDACTALL_BUDGET_MS = 2000;

describe('HBF fix7.5 T1 LT-run userinfo linear (red on a079c774)', () => {
  for (const [pn, src] of PATTERNS) for (const [sn, mk] of SHAPES) {
    test(`T1-LT ${pn} ${sn} linear 2048->8192->32768: (t4N+1)/(tN+1) < 8`, () => {
      const re = new RegExp(src, 'u'); re.test(mk(256));
      const t = Object.fromEntries([2048, 8192, 32768].map((n) => { const s = mk(n); return [n, best3(() => re.test(s))]; }));
      const r1 = (t[8192] + 1) / (t[2048] + 1), r2 = (t[32768] + 1) / (t[8192] + 1);
      console.log(`# TIMING ${pn} | ${sn} | t2048=${t[2048].toFixed(2)} t8192=${t[8192].toFixed(2)} t32768=${t[32768].toFixed(2)} ms | r1=${r1.toFixed(2)} r2=${r2.toFixed(2)}`);
      assert.ok(r1 < 8, `2048->8192 ratio ${r1.toFixed(2)}`); assert.ok(r2 < 8, `8192->32768 ratio ${r2.toFixed(2)}`);
    });
  }
  test(`T1-LT redactAll('//'+'\\n'*32768+'x') under ${REDACTALL_BUDGET_MS} ms`, () => {
    const s = '//' + '\n'.repeat(32768) + 'x'; const t0 = performance.now(); PG.redactAll(s); const t = performance.now() - t0;
    console.log(`# TIMING redactAll | '//'+'\\n'*32768+'x' | ${t.toFixed(1)} ms | budget ${REDACTALL_BUDGET_MS}`);
    assert.ok(t < REDACTALL_BUDGET_MS, `redactAll took ${t.toFixed(1)} ms`);
  });
  test('T1-LT off-list probe https://u\\n\\n:p@x.com is redacted (every strip path)', () => {
    const H = loadHBF(); const probe = 'https://u\n\n:p@x.com';
    for (const [p, f] of Object.entries(H.paths)) { const o = f(H.clone({ n: probe })); const v = o && o.n;
      assert.ok(v === undefined || !String(v).includes(':p@'), `${p}: ${JSON.stringify(v)}`); }
    assert.ok(new RegExp(PG.CREDENTIAL_URL_SOURCE, 'u').test(probe));
  });
});

describe('HBF fix7.5 T2 JSON-escaped keys in free text (red on a079c774)', () => {
  const V = 'SYNTHaaaaBBBB1234cccc5678dddd';
  const rows = [
    ['escaped k: api\\u004bey', '{"api\\u004bey":"' + V + '"}', true],
    ['escaped K: api\\u004Bey', '{"api\\u004Bey":"' + V + '"}', true],
    ['escaped _: api\\u005fkey', '{"api\\u005fkey":"' + V + '"}', true],
    ['escaped t: \\u0074oken', '{"\\u0074oken":"' + V + '"}', true],
    ['escaped o: passw\\u006frd', '{"passw\\u006frd":"' + V + '"}', true],
    ['fully escaped apiKey', '{"\\u0061\\u0070\\u0069\\u004b\\u0065\\u0079":"' + V + '"}', true],
    ['Kelvin sign escaped api\\u212Aey', '{"api\\u212Aey":"' + V + '"}', true],
    ['Kelvin sign literal api\u212Aey', '{"api\u212Aey":"' + V + '"}', true],
    ['undecodable key \\u00zz-apikey fails closed', '{"\\u00zzname":"' + V + '"}', true],
    ['off-list escaped key \\u0074itle stays', '{"\\u0074itle":"' + V + '"}', false],
  ];
  for (const [id, text, secret] of rows) test(`T2-JK ${id} -> ${secret ? 'redacted' : 'kept'}`, () => {
    const H = loadHBF();
    for (const [p, f] of Object.entries(H.paths)) { const o = f(H.clone({ notes: 'pasted ' + text })); const v = o && o.notes;
      const leaked = typeof v === 'string' && v.includes(V);
      if (secret) assert.ok(!leaked, `${p}: value leaked: ${JSON.stringify(v)}`); else assert.equal(v, 'pasted ' + text, `${p}: off-list key changed`); }
  });
});
