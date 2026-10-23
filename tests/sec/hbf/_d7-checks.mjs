// SEC-SWEEP #180 HBF D7 export-notice wiring check (CoS ruling): the contract is ONE top-level hook showExportNotice(text)
// (it may call alert() today). After the page loads and before exportProject runs, the test replaces the context's
// showExportNotice with a recording stub, so exportProject must look the hook up at call time: a fix that calls alert()
// directly, or binds the hook early, records nothing and fails. Asserted on an export that removes something: the hook is
// called exactly once, text === exportNotice(report) for the same project, no secret value in the text, recorded before the
// download event. On a clean project the hook is not called and the download still happens.
// Shared by D7f (shipped page) and the D7-FX fixtures (ui.hbf.test.mjs). Throws an AssertionError listing every problem.
import assert from 'node:assert/strict';
import { loadHBFApp } from './_hbf-app.mjs';
import { featureFn } from './_hbf-env.mjs';

const DIRTY = { meta: { name: 'Valerian', version: '1.0.0' }, setup: { apiKey: 'xai-SEKRIT', preferredModel: 'grok-4.7', collectionIds: ['c1'] },
  goals: { chatHistory: [] }, chapterOutlines: [], drafts: [{ chapterId: 'c1', draftText: 'see https://e.com/?token=SEKRIT ok', sources: ['https://doi.org/10.1/x'] }] };
const CLEAN = { meta: { name: 'Clean', version: '1.0.0' }, setup: { preferredModel: 'grok-4.7', collectionIds: ['c1'] }, goals: { chatHistory: [] }, chapterOutlines: [], drafts: [{ chapterId: 'c1', draftText: 'Dose 1-3 mL.' }] };

function run(project, src, errs, label) {
  const A = loadHBFApp(project, { src });
  const hook = featureFn(A.found, 'showExportNotice');
  if (!hook && label === 'dirty') errs.push('ABSENT showExportNotice(text) hook');
  const calls = [];
  A.ctx.showExportNotice = function recordingShowExportNotice(text) { calls.push(text); A.log.push({ ev: 'showExportNotice', text: String(text) }); };
  const m = A.mark();
  try { A.call('exportProject'); } catch (e) { errs.push(`${label} exportProject() threw: ${e.message}`); }
  return { A, calls, ev: A.log.slice(m) };
}

export function checkExportNotice(src) {
  const errs = [];
  const d = run(DIRTY, src, errs, 'dirty');
  const notice = featureFn(d.A.found, 'exportNotice');
  if (!notice) errs.push('ABSENT exportNotice()');
  const dl = d.ev.findIndex((e) => e.ev === 'download'); const hk = d.ev.findIndex((e) => e.ev === 'showExportNotice');
  if (dl < 0) errs.push('exportProject() started no download');
  if (d.calls.length !== 1) errs.push(`showExportNotice called ${d.calls.length} times on an export that removed apiKey and a credential link (want exactly 1)${d.ev.some((e) => e.ev === 'alert') ? '; alert() was called directly instead of the hook' : ''}`);
  if (hk >= 0) {
    if (dl >= 0 && hk > dl) errs.push('showExportNotice was called after the download started');
    const text = String(d.calls[0]);
    if (/SEKRIT|xai-|https?:/.test(text)) errs.push(`the notice text carries a value: ${text}`);
    if (notice) { const rep = { dropped: [], redacted: [] }; d.A.found.stripSecretFields(d.A.JP(JSON.stringify(d.A.getProject())), '', rep);
      const want = notice(rep); if (text !== want) errs.push(`notice ${JSON.stringify(text)} != exportNotice(report) ${JSON.stringify(want)}`); }
  }
  const c = run(CLEAN, src, errs, 'clean');
  if (!c.ev.some((e) => e.ev === 'download')) errs.push('clean project: no download');
  if (c.calls.length) errs.push(`clean project: showExportNotice called ${c.calls.length} time(s) with nothing removed`);
  if (errs.length) assert.fail('D7f: ' + errs.join('; '));
}
