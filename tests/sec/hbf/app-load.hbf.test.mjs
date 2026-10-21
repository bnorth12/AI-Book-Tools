// SEC-SWEEP #180 (Reviewer NO-GO on 1e897af1, MF1-MF3; Engineering recheck): the load, startup and import paths run in the
// vm page (_hbf-app.mjs) instead of being optional names the suite never calls. Plus an off-list guard: the page script
// references no identifier that is declared nowhere (static scan, _ident-scan.mjs, no allowlist of page names), and the
// shared copy's inlined SRC306 still equals the schema's :306 pattern (the reference's dropped `schema drift` guard).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadHBFApp } from './_hbf-app.mjs';
import { readHBF } from './_hbf-load.mjs';
import { inlineScriptBodies } from './_hbf-html.mjs';
import { undefinedIdentifiers } from './_ident-scan.mjs';
import { markedBlock, REPO } from '../_load.mjs';

const KEY = 'herbalBookForgeProject_v1.0.0';
const STORED = {
  meta: { name: 'MyBook', version: '1.0.0' },
  setup: { title: 'Calm Herbs', apiKey: 'xai-SEKRIT-1', clientSecret: 'SEKRIT-2', preferredModel: 'grok-4.7', collectionIds: ['c1'] },
  goals: { mainGoal: 'calm', chatHistory: [] }, prompts: {}, outline: '', chapterOutlines: [],
  drafts: [{ chapterId: 'c1', draftText: 'Dose 1-3 mL; see https://e.com/a.pdf?token=SEKRIT-3 for the chart.', sources: ['https://user:SEKRIT-4@e.com/x', 'https://doi.org/10.1/x'] }],
};
const app = () => loadHBFApp(undefined);
function intact(A, label) {
  const p = A.getProject();
  assert.equal(p.meta.name, 'MyBook', `${label}: stored project not loaded (meta.name ${JSON.stringify(p.meta?.name)})`);
  assert.equal(p.setup.title, 'Calm Herbs', `${label}: setup.title lost`);
  assert.equal(p.drafts.length, 1, `${label}: drafts lost`);
  assert.ok(p.drafts[0].draftText.startsWith('Dose 1-3 mL; see '), `${label}: draft text lost`);
  assert.ok(p.drafts[0].sources.includes('https://doi.org/10.1/x'), `${label}: safe citation lost`);
  const all = A.JS(p);
  assert.ok(!/SEKRIT/.test(all), `${label}: a secret survived in the loaded project: ${(all.match(/.{0,30}SEKRIT.{0,8}/) || [''])[0]}`);
  assert.ok(!('clientSecret' in p.setup), `${label}: clientSecret kept`);
  const stored = A.store.get(KEY);
  assert.ok(stored && !/SEKRIT|"apiKey":"xai|"clientSecret"/.test(stored), `${label}: the re-saved project holds a secret`);
  assert.ok(stored.includes('"MyBook"'), `${label}: the re-saved project is not the stored one (default project written over it)`);
}

describe('HBF app load/import paths', () => {
  test('HBF/APP-LOAD-1 loadProject() with a stored project: loads intact, secrets stripped, re-saved without secrets', () => {
    const A = app(); assert.ok(A.has('loadProject'), 'ABSENT loadProject');
    A.store.set(KEY, JSON.stringify(STORED));
    A.call('loadProject');
    intact(A, 'loadProject');
  });

  test('HBF/APP-LOAD-2 initializeApp() with a stored project: no throw, project intact, secrets stripped', () => {
    const A = app(); assert.ok(A.has('initializeApp'), 'ABSENT initializeApp');
    A.store.set(KEY, JSON.stringify(STORED));
    A.call('initializeApp');
    intact(A, 'initializeApp');
  });

  test('HBF/APP-IMPORT-1 handleImport() of a file with secrets: imports, secrets stripped, notice lists field paths only', () => {
    const A = app(); assert.ok(A.has('handleImport'), 'ABSENT handleImport');
    A.ctx.FileReader = function FileReader() { const r = { onload: null, readAsText(text) { r.onload({ target: { result: text } }); } }; return r; };
    const ev = { target: { files: [JSON.stringify(STORED)], value: 'x' } };
    const m = A.mark();
    A.call('handleImport', ev);
    const alerts = A.log.slice(m).filter((e) => e.ev === 'alert').map((e) => e.text);
    assert.equal(alerts.length, 1, `expected one import alert, got ${JSON.stringify(alerts)}`);
    assert.ok(alerts[0].startsWith('Project imported successfully.'), `import failed: ${alerts[0]}`);
    assert.ok(!/SEKRIT/.test(alerts[0]), 'the import notice holds a secret value');
    for (const pth of ['setup.apiKey', 'setup.clientSecret']) assert.ok(alerts[0].includes(pth), `the import notice does not list ${pth}`);
    intact(A, 'handleImport');
  });

  test('HBF/APP-SCAN-1 the page script references no undeclared identifier (static scan, no page-name allowlist)', () => {
    const code = inlineScriptBodies(readHBF()).join('\n;\n');
    const bad = [...undefinedIdentifiers(code)].map(([n, lines]) => `${n} (script line ${lines.join(', ')})`);
    assert.deepEqual(bad, [], `undeclared identifiers: ${bad.join('; ')}`);
  });

  test('HBF/APP-SCAN-1a scanner self-check: finds a planted undeclared call, ignores members, keys, strings, comments and locals', () => {
    const code = `function f(a, { b }) { const c = (d) => d + a + b; return c(1); }\nconst o = { zz1: 1, m() { return 2; } }; o.zz2(); // zz3()\nconst s = 'zz4()' + \`\${f(1)} zz5()\`;\nconst re = /zz6()/g; plantedZZ(); try { f(); } catch (err) { err.x; }\nlet x = 1 ? f : o; label1: for (const k of [1]) { k; }`;
    assert.deepEqual([...undefinedIdentifiers(code).keys()], ['plantedZZ']);
  });

  test('HBF/APP-SCHEMA-1 the shared copy\'s inlined SRC306 equals schema/story-core-2.0.json :306 (ref-v2.2 schema drift guard)', () => {
    const block = markedBlock(readHBF());
    assert.ok(block !== null, 'no SEC-SWEEP #180 shared-copy markers in the page');
    const pageSrc306 = vm.runInNewContext(block + '\n;SRC306');
    const lines = fs.readFileSync(path.join(REPO, 'schema', 'story-core-2.0.json'), 'utf8').split('\n');
    const m306 = lines[305].match(/"pattern": "(.*)"\s*$/);
    assert.ok(m306, 'schema :306 is not a "pattern" line');
    const V1 = vm.runInNewContext(block + '\n;V1_USERINFO');
    const m261 = lines[260].match(/"pattern": "(.*)"\s*$/);
    assert.equal(pageSrc306, JSON.parse('"' + m306[1] + '"'), 'page SRC306 != schema :306');
    assert.ok(m261 && JSON.parse('"' + m261[1] + '"') === V1, 'schema :261 != V1_USERINFO');
  });
});
