// SEC-SWEEP #180 (LOCKED-RULE-v2.2 r2, 5236f45a), HerbalBookForge UI items. Red today (0eac64f).
// - #api-key: the password input must not be autofilled or spell-checked (autocomplete="off", spellcheck="false"). Read off
//   the real element with the HTML tokenizer (_hbf-html.mjs: comments, raw text, attribute values and JS strings are not
//   elements; first attribute wins), never a first-match text search; UI-APIKEY-DECOY proves it.
// - D7 export notice (plan step 5, spec section 7): exactly
//   `Removed before export (N fields): D. Credential links redacted in: R. The exported file does not contain them.`
//   empty clauses left out, no notice at N=0, field paths only, shown before the download starts through the single
//   top-level hook showExportNotice(text) (CoS ruling; it may call alert()). D7f is a behavior test (_d7-checks.mjs):
//   the real exportProject runs in the vm page with the hook replaced by a recording stub. D7-FX fixtures prove the check.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHBF, readHBF } from './_hbf-load.mjs';
import { loadHBFApp } from './_hbf-app.mjs';
import { checkExportNotice } from './_d7-checks.mjs';
import { getElementById, elements } from './_hbf-html.mjs';

const src = readHBF();
const apiKeyEl = (s = src) => { const e = getElementById(s, 'api-key'); assert.ok(e, 'no element with id="api-key"'); assert.equal(e.tag, 'input', '#api-key is not an <input>'); return e; };
const attr = (el, a) => (el.attrs.has(a) ? el.attrs.get(a) : null);

describe('HBF api-key input', () => {
  test('HBF/UI-APIKEY-1 #api-key has autocomplete="off"', () => { assert.equal(attr(apiKeyEl(), 'autocomplete'), 'off'); });
  test('HBF/UI-APIKEY-2 #api-key has spellcheck="false"', () => { assert.equal(attr(apiKeyEl(), 'spellcheck'), 'false'); });
  test('HBF/UI-APIKEY-DECOY decoys (comment, attribute value, <textarea>, JS string, repeated attribute) never stand in for the real #api-key', () => {
    const real = apiKeyEl();
    const D = '<input id="api-key" autocomplete="off" spellcheck="false">';
    const decoys = `<!-- ${D} -->\n<div data-x='${D}'></div>\n<textarea>${D}</textarea>\n<script>var __apiKeyDecoy = '${D}';</script>\n`;
    const page = src.slice(0, real.start) + decoys + src.slice(real.start);
    const naive = page.match(/<input\b[^>]*\bid\s*=\s*["']api-key["'][^>]*>/i);
    assert.ok(naive && naive.index < real.start + decoys.length, 'fixture: a first-match text search would take a decoy');
    const el = apiKeyEl(page);
    assert.equal(el.start, real.start + decoys.length, 'parser took a decoy, not the real #api-key');
    assert.deepEqual([...el.attrs], [...real.attrs], 'real #api-key attributes changed under decoys');
    assert.equal(elements(page).filter((e) => e.attrs.get('id') === 'api-key').length, 1, 'a decoy was parsed as an element');
    const dup = getElementById('<input id="api-key" autocomplete="on" autocomplete="off" spellcheck="true" spellcheck="false">', 'api-key');
    assert.equal(attr(dup, 'autocomplete'), 'on'); assert.equal(attr(dup, 'spellcheck'), 'true'); // first attribute wins, as in browsers
  });
});

describe('HBF D7 export notice', () => {
  const H = loadHBF();
  const N = () => { if (typeof H.exportNotice !== 'function') assert.fail('ABSENT exportNotice: HBF export has no notice (D7)'); return H.exportNotice; };
  test('HBF/D7a dropped + redacted', () => {
    const ex = N()({ dropped: ['apiKey', 'ch[2]'], redacted: ['ch[1]'] });
    assert.equal(ex, 'Removed before export (3 fields): apiKey, ch[2]. Credential links redacted in: ch[1]. The exported file does not contain them.');
  });
  test('HBF/D7b nothing removed: no notice', () => { assert.equal(N()({ dropped: [], redacted: [] }), null); });
  test('HBF/D7c singular', () => { assert.equal(N()({ dropped: ['a'], redacted: [] }), 'Removed before export (1 field): a. The exported file does not contain them.'); });
  test('HBF/D7d redacted only', () => { assert.equal(N()({ dropped: [], redacted: ['x', 'y'] }), 'Removed before export (2 fields): Credential links redacted in: x, y. The exported file does not contain them.'); });
  test('HBF/D7e notice lists field paths, never values', () => {
    const p = H.clone({ setup: { apiKey: 'xai-SEKRIT' }, drafts: [{ draftText: 'see https://e.com/?token=SEKRIT ok', src: 'https://e.com/?sig=SEKRIT' }] });
    const rep = { dropped: [], redacted: [] };
    const out = H.stripSecretFields(p, '', rep);
    assert.ok(rep.dropped.length + rep.redacted.length > 0, 'stripSecretFields(value, path, report) fills no report');
    const ex = N()(rep);
    assert.ok(ex && !ex.includes('SEKRIT') && !ex.includes('https://'), `notice leaks a value: ${ex}`);
    assert.ok(!JSON.stringify(out).includes('SEKRIT'));
  });
  test('HBF/D7f exportProject calls the showExportNotice(text) hook (looked up at call time) once, before the download', () => {
    checkExportNotice(src);
  });
});

// D7-FX: export-wiring fixtures. Base = the shipped page when it already has the hook (green), else today's page plus a
// test-only stand-in (report-filling stripSecretFields, exportNotice in the spec section 7 text, the hook). Each variant
// appends a top-level exportProject that overrides the page's.
const HAS_HOOK = /function\s+showExportNotice\s*\(/.test(src) && /function\s+exportNotice\s*\(/.test(src);
const STANDIN = `
function stripSecretFields(value, path = '', report = { dropped: [], redacted: [] }) {
  if (Array.isArray(value)) return value.map((v, i) => stripSecretFields(v, path + '[' + i + ']', report));
  if (typeof value === 'string') { const r = value.replace(/https?:\\/\\/\\S*[?&;](?:token|sig|key)(?:=[^\\s)]*)?/gi, '[credential link removed]');
    if (r !== value) report.redacted.push(path); return r; }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([k]) => { const p = path ? path + '.' + k : k; if (isSecretField(k)) { report.dropped.push(p); return false; } return true; })
    .map(([k, v]) => [k, stripSecretFields(v, path ? path + '.' + k : k, report)]));
}
function exportNotice(rep) { const n = rep.dropped.length + rep.redacted.length; if (!n) return null;
  return 'Removed before export (' + n + ' field' + (n === 1 ? '' : 's') + '): ' + (rep.dropped.length ? rep.dropped.join(', ') + '. ' : '')
    + (rep.redacted.length ? 'Credential links redacted in: ' + rep.redacted.join(', ') + '. ' : '') + 'The exported file does not contain them.'; }
function showExportNotice(text) { alert(text); }
`;
const withScript = (s, code) => `${s}\n<script>\n${code}\n</script>\n`;
const FX_BASE = HAS_HOOK ? src : withScript(src, STANDIN);
const exportVariant = (notify, after = '') => `
function exportProject() {
  const rep = { dropped: [], redacted: [] }; const clean = stripSecretFields(project, '', rep); const n = exportNotice(rep);
  ${notify}
  const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'x_session.json'; a.click(); ${after} URL.revokeObjectURL(url);
}`;
describe('HBF D7 export-notice fixtures', () => {
  test('HBF/D7-FX1 page wired through the hook passes', () => {
    checkExportNotice(FX_BASE === src ? src : withScript(FX_BASE, exportVariant('if (n) showExportNotice(n);')));
    checkExportNotice(withScript(FX_BASE, exportVariant('if (n) showExportNotice(n);')));
  });
  for (const [id, label, code, re] of [
    ['D7-FX2', 'alert() called directly, no hook', exportVariant('if (n) alert(n);'), /showExportNotice called 0 times.*alert\(\) was called directly/],
    ['D7-FX3', 'hook called after the download', exportVariant('', 'if (n) showExportNotice(n);'), /after the download started/],
    ['D7-FX4', 'values passed in the notice text', exportVariant('if (n) showExportNotice(n + " " + JSON.stringify(project.setup) + " " + project.drafts[0].draftText);'), /carries a value/],
    ['D7-FX5', 'hook bound early (captured at load)', 'const __boundNotice = showExportNotice;\n' + exportVariant('if (n) __boundNotice(n);'), /showExportNotice called 0 times/],
    ['D7-FX6', 'hook called on a clean export too', exportVariant('showExportNotice(n || "Nothing removed.");'), /clean project: showExportNotice called/],
  ]) {
    test(`HBF/${id} ${label} fails D7f`, () => {
      assert.throws(() => checkExportNotice(withScript(FX_BASE, code)), (e) => re.test(e.message) && !/ABSENT/.test(e.message));
    });
  }
});
