// SEC-SWEEP #180 HBF app harness for behavior tests (CACHE-07): the whole page (every inline <script>, unmodified) runs in
// node:vm via _hbf-env.mjs, with the ordered effect log (localStorage, Blob, URL.createObjectURL/revoke, <a>.click, alert,
// fake timers). Functions are read off the context as top-level bindings only. `project` (a top-level let) is read and
// replaced through the export shim. Missing names that exist today and the tests depend on are a LoaderError; names the
// fix adds (scheduleProjectSave, flushPendingSave, ...) stay undefined so the test reports them ABSENT.
import { runPage, readHBF, requireNames, LoaderError } from './_hbf-env.mjs';

export { LoaderError };
export const APP_REQUIRED = ['exportProject', 'saveProject', 'getStoredProject', 'stripSecretFields', 'isSecretField'];
export const APP_OPTIONAL = ['scheduleProjectSave', 'showExportNotice', 'flushPendingSave', 'makeProjectStorageSaver', 'exportNotice', 'loadProject', 'handleImport', 'findRemovedSecretFields', 'initializeApp'];

export function loadHBFApp(project, { src } = {}) {
  const P = runPage(src === undefined ? readHBF() : src, { names: [...APP_REQUIRED, ...APP_OPTIONAL] });
  requireNames(P.found, APP_REQUIRED);
  if (!P.project) throw new LoaderError('loader could not find project');
  if (project !== undefined) P.project.set(P.JP(JSON.stringify(project)));
  const has = (n) => typeof P.found[n] === 'function';
  const call = (n, ...a) => P.found[n](...a);
  const mark = () => P.log.length;
  return { ...P, has, call, mark, getProject: () => P.project.get() };
}
