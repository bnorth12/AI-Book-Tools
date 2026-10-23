// ref-v2.3 NEL fix: Fiction r4 BROKEN probe (U+0085), moved into the passing suite. Fiction r4 3 rows + 4 added (Bearer, Authorization:, x-api-key, JSON_PAIR) x 3 paths. RED on 8f1f9993, GREEN on the fix.
// HBF_HTML=<path> overrides the page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadHBF, own, PATHS, MARK } from './_hbf-load.mjs';
const H = process.env.HBF_HTML ? loadHBF({ fresh: true, src: fs.readFileSync(process.env.HBF_HTML, 'utf8') }) : loadHBF(); // r4 passed a string, so HBF_HTML was ignored
const ROWS = [['NEL-bare', 'use Basic\u0085YTpi please', 'YTpi'], ['NEL-hdr', 'Authorization: Basic\u0085dXNlcjpwYXNz ok', 'dXNlcjpwYXNz'],
  ['NEL-long', 'use Basic\u0085abcd1234efgh5678ijkl9012 please', 'abcd1234efgh5678ijkl9012'],
  // added in the NEL fix: r4 CHANGES claimed Bearer coverage but the r4 probe was Basic only (Bearer, :803 colon, x-api-key, JSON_PAIR now covered)
  ['NEL-bearer', 'use Bearer\u0085SYNTHaaaaBBBB1234cccc5678dddd please', 'SYNTHaaaaBBBB1234cccc5678dddd'],
  ['NEL-auth-colon', 'Authorization:\u0085SYNTHaaaaBBBB1234cccc5678dddd ok', 'SYNTHaaaaBBBB1234cccc5678dddd'],
  ['NEL-xapikey', 'x-api-key:\u0085SYNTHaaaaBBBB1234cccc5678dddd ok', 'SYNTHaaaaBBBB1234cccc5678dddd'],
  ['NEL-json', 'cfg "apiToken"\u0085:\u0085"SYNTHtok1234" end', 'SYNTHtok1234']];
for (const p of PATHS) for (const [id, s, sec] of ROWS) test(`HBF-NEL/probe/${p}/${id} must not leak`, () => {
  const o = H.paths[p](H.clone({ f: s, ok: 1 })); const v = own(o, 'f') ? String(o.f) : '';
  assert.ok(!v.includes(sec), `LEAK ${id}: ${JSON.stringify(v)}`);
});
