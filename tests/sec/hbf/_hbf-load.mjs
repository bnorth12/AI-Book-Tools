// SEC-SWEEP #180 (LOCKED-RULE-v2.2 r2, 5236f45a), HerbalBookForge. Loads HBF's shipped page code, unmodified, into node:vm
// (_hbf-env.mjs runs every inline <script> with a stub browser) and reads the rule functions off the context as TOP-LEVEL
// bindings. No name or indentation matching on the source text: a nested same-named function is never picked up, and
// re-indenting the page changes nothing (loader.hbf.test.mjs). When the SEC-SWEEP #180 shared-copy markers are present they
// must be balanced (markedBlock throws otherwise); the rule still loads from the running page, so via is 'markers' or 'script'.
// Three HBF strip paths (spec erratum E2: every row runs through every path):
//   export  = stripSecretFields(project)                          (exportProject :959)
//   import  = stripSecretFieldsInPlace(raw), else stripSecretFields(raw, '', report)   (handleImport :975-976, loadProject :882)
//   storage = the localStorage payload: makeProjectStorageSaver()(project) when the page defines it (C2 memoized save),
//             else JSON.stringify(project, projectStorageReplacer)  (saveProject :935, loadProject :911)
// HBF is not in the shared TOOLS. A missing name the rows depend on is a LoaderError ('loader could not find X'), not a row failure.
import { markedBlock, MARK, BEGIN, END, own } from '../_load.mjs';
import { runPage, readHBF, HBF_FILE, LoaderError, requireNames } from './_hbf-env.mjs';

export { MARK, BEGIN, END, own, readHBF, HBF_FILE, LoaderError };
// Today's rule names (plan T1). SECRET_FIELD_DENYLIST, isSensitiveUrl and stripSecretFieldsInPlace are optional after the fix.
export const RULE_NAMES = ['SECRET_FIELD_DENYLIST', 'isSecretField', 'isSensitiveUrl', 'findRemovedSecretFields', 'stripSecretFields', 'stripSecretFieldsInPlace', 'projectStorageReplacer'];
// Names the fixed page may add (r2 shared copy + HBF C2). Missing ones come back undefined (test-level ABSENT).
export const EXTRA_NAMES = ['isSecretParam', 'foldCase', 'sanitizeString', 'exportNotice', 'CREDENTIAL_URL', 'makeProjectStorageSaver', 'secRuleId', 'CRED_EXACT', 'isSensitiveWholeUrl'];
// Required by the loader: exist today and every row depends on them. Storage needs one of the two save forms.
export const REQUIRED = ['isSecretField', 'stripSecretFields', 'projectStorageReplacer|makeProjectStorageSaver'];

let cached = null;
// fresh: a new vm context (tests that patch globals). src: page text to load instead of the shipped file (loader fixtures).
export function loadHBF({ fresh = false, src } = {}) {
  if (cached && !fresh && src === undefined) return cached;
  const text = src === undefined ? readHBF() : src;
  const via = markedBlock(text) !== null ? 'markers' : 'script';
  const P = runPage(text, { names: [...RULE_NAMES, ...EXTRA_NAMES] });
  requireNames(P.found, REQUIRED);
  const H = { ...Object.fromEntries([...RULE_NAMES, ...EXTRA_NAMES].map((n) => [n, P.found[n]])), via, ctx: P.ctx, page: P, OP: P.OP, JP: P.JP, JS: P.JS };
  const clone = (o) => H.JP(JSON.stringify(o));
  const storageSave = () => (typeof H.makeProjectStorageSaver === 'function' ? H.makeProjectStorageSaver() : (o) => H.JS(o, H.projectStorageReplacer));
  H.paths = {
    export: (o) => H.stripSecretFields(o),
    import: (o) => { if (typeof H.stripSecretFieldsInPlace === 'function') { H.stripSecretFieldsInPlace(o); return o; } return H.stripSecretFields(o, '', { dropped: [], redacted: [] }); },
    storage: (o) => { const s = storageSave()(o); return s === undefined ? undefined : H.JP(s); },
  };
  H.storageSave = storageSave;
  H.clone = clone; // JSON round trip inside the vm realm, so prototypes match H.OP
  if (!fresh && src === undefined) cached = H;
  return H;
}
export const PATHS = ['export', 'import', 'storage'];
