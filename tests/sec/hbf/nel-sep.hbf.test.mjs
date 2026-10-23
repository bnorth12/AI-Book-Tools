// ref-v2.3 NEL fix (v1.2.4): static pin for the ONE redaction separator class (REDACT_SEP).
//   PIN   sha256 of the REDACT_SEP runtime string === sha256 of sep-class.js.txt (byte-exact snippet).
//   SET   code points matched by REDACT_SEP (all of U+0000..U+10FFFF) === fixtures/sep-codepoints.txt (sha256 pinned; CoS pin for every copy).
//   SRC   every redaction source uses REDACT_SEP, keeps %20, and holds no \s and no \p{White_Space}; no inline basic/bearer \s literal left in the page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { runPage, readHBF } from './_hbf-env.mjs';
const CLASS_SHA = '80a940215c112281eaff20ca0364affd24d01e59d022dfc284fb2f9998248860';
const LIST_SHA = 'a7ab70b177476db361ee09994277bbe630b3de4583410517be76fbc83fcd17b3';
const SRCS = ['BEARER_SOURCE', 'HEADER_SOURCE', 'COOKIE_SOURCE', 'BASIC_SOURCE', 'JSON_PAIR_SOURCE', 'V2_KEYPARAM'];
const html = readHBF(); const P = runPage(html, { names: ['REDACT_SEP', 'COOKIE_GAP', 'SEP_TRIM', 'JS_WS', ...SRCS] }); const sep = P.found.REDACT_SEP;
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
test('HBF-NEL/PIN REDACT_SEP bytes match sep-class.js.txt', () => {
  assert.equal(typeof sep, 'string', 'REDACT_SEP ABSENT'); assert.equal(sha(Buffer.from(sep, 'utf8')), CLASS_SHA);
});
test('HBF-NEL/SET REDACT_SEP code points === sep-codepoints.txt', () => {
  const raw = fs.readFileSync(new URL('./fixtures/sep-codepoints.txt', import.meta.url)); assert.equal(sha(raw), LIST_SHA, 'sep-codepoints.txt drifted');
  const lines = raw.toString('utf8').split('\n'); assert.equal(lines.pop(), '', 'list must end in LF'); assert.equal(lines.pop(), '%20', 'last line must be %20');
  const want = lines.map((h) => { assert.match(h, /^[0-9A-F]{4,6}$/); return parseInt(h, 16); });
  assert.deepEqual([...want].sort((a, b) => a - b), want, 'list not sorted');
  const re = new RegExp('^' + sep + '$', 'u'); const got = [];
  for (let i = 0; i <= 0x10ffff; i++) { if (i >= 0xd800 && i <= 0xdfff) continue; if (re.test(String.fromCodePoint(i))) got.push(i); }
  assert.deepEqual(got.map((x) => x.toString(16)), want.map((x) => x.toString(16)));
});
test('HBF-NEL/SRC every redaction source uses REDACT_SEP, keeps %20, no \\s or \\p{White_Space}', () => {
  for (const n of SRCS) { const s = P.found[n]; assert.equal(typeof s, 'string', n + ' ABSENT');
    assert.ok(s.includes(sep), n + ' does not use REDACT_SEP');
    assert.ok(!/\\s|\\p\{White_Space\}|\\p\{space\}/i.test(s.split(sep).join('')), n + ' still holds \\s or \\p{White_Space}'); }
  for (const n of ['BEARER_SOURCE', 'HEADER_SOURCE', 'BASIC_SOURCE']) assert.ok(P.found[n].includes('(?:' + sep + '|%20)+') || P.found[n].includes('((?:' + sep + '|%20)+)'), n + ' lost %20');
  assert.ok(!/(?:basic|bearer|token|digest)\(\?:\\\\?s\|%20\)/i.test(html), 'an inline scheme \\s separator is left in the page');
});
test('HBF-NEL/COOKIE COOKIE_GAP = sep-codepoints.txt minus CR LF U+2028 U+2029; SEP_TRIM strips exactly sep-codepoints.txt', () => {
  const raw = fs.readFileSync(new URL('./fixtures/sep-codepoints.txt', import.meta.url)); assert.equal(sha(raw), LIST_SHA);
  const want = raw.toString('utf8').split('\n').filter((h) => /^[0-9A-F]{4,6}$/.test(h)).map((h) => parseInt(h, 16));
  const gap = P.found.COOKIE_GAP; assert.equal(typeof gap, 'string', 'COOKIE_GAP ABSENT'); assert.ok(gap.includes(sep), 'COOKIE_GAP not derived from REDACT_SEP');
  const re = new RegExp('^' + gap + '$', 'u'), tr = P.found.SEP_TRIM; assert.ok(tr && typeof tr.source === 'string', 'SEP_TRIM ABSENT'); assert.ok(tr.source.includes(sep), 'SEP_TRIM not built from REDACT_SEP');
  const g = [], t = [];
  for (let i = 0; i <= 0x10ffff; i++) { if (i >= 0xd800 && i <= 0xdfff) continue; const c = String.fromCodePoint(i);
    if (re.test(c)) g.push(i); if (('a' + c + 'b' + c).replace(tr, '') === 'a' + c + 'b' && (c + 'x').replace(tr, '') === 'x') t.push(i); }
  assert.deepEqual(g, want.filter((x) => ![0x0a, 0x0d, 0x2028, 0x2029].includes(x)));
  assert.deepEqual(t, want);
});
test('HBF-NEL/JSWS JS_WS (negated-set body) is exactly the JS \\s set, and is used only inside [^...]', () => {
  const j = P.found.JS_WS; assert.equal(typeof j, 'string', 'JS_WS ABSENT'); const re = new RegExp('^[' + j + ']$', 'u'); const bad = [];
  for (let i = 0; i <= 0x10ffff; i++) { if (i >= 0xd800 && i <= 0xdfff) continue; const c = String.fromCodePoint(i); if (re.test(c) !== /\s/u.test(c)) bad.push(i.toString(16)); }
  assert.deepEqual(bad, []);
  const uses = html.split("' + JS_WS + '").length - 1, negated = (html.match(/\[\^[^\[\]']*' \+ JS_WS \+ '/g) || []).length;
  assert.ok(uses > 0 && uses === negated, `JS_WS used ${uses}x, only ${negated}x right inside [^...]`);
});
