// SEC-SWEEP #180 HBF: a small HTML tokenizer (enough of the HTML parsing rules for these tests), so markup checks look at
// real elements, not first-match text: comments are skipped; <script>/<style> are raw text and <textarea>/<title> are
// escapable raw text up to their own end tag (markup-looking text inside them, or inside a JS string, is not an
// element); attribute values may hold '>' and markup; a repeated attribute keeps the FIRST value (as browsers do).
// elements() lists start tags in document order; getElementById() returns the first, like the DOM.
const RAW = new Set(['script', 'style', 'textarea', 'title']);

function readTag(src, i) { // src[i] === '<', followed by a letter
  let j = i + 1; while (j < src.length && !/[\s/>]/.test(src[j])) j++;
  const tag = src.slice(i + 1, j).toLowerCase(); const attrs = new Map();
  for (;;) {
    while (j < src.length && /[\s/]/.test(src[j])) j++;
    if (j >= src.length || src[j] === '>') break;
    let k = j; while (k < src.length && !/[\s/>=]/.test(src[k])) k++;
    if (k === j) k++; // a stray '=' starts a name, as in the spec
    const name = src.slice(j, k).toLowerCase(); j = k;
    while (j < src.length && /\s/.test(src[j])) j++;
    let value = '';
    if (src[j] === '=') {
      j++; while (j < src.length && /\s/.test(src[j])) j++;
      if (src[j] === '"' || src[j] === "'") { const q = src[j]; const e = src.indexOf(q, j + 1); value = src.slice(j + 1, e < 0 ? src.length : e); j = e < 0 ? src.length : e + 1; }
      else { let e = j; while (e < src.length && !/[\s>]/.test(src[e])) e++; value = src.slice(j, e); j = e; }
    }
    if (!attrs.has(name)) attrs.set(name, value);
  }
  return { tag, attrs, start: i, end: Math.min(j + 1, src.length) };
}

export function elements(src) {
  const out = []; let i = 0;
  while (i < src.length) {
    const lt = src.indexOf('<', i); if (lt < 0) break;
    if (src.startsWith('<!--', lt)) { const e = src.indexOf('-->', lt + 4); i = e < 0 ? src.length : e + 3; continue; }
    if (src[lt + 1] === '!' || src[lt + 1] === '?') { const e = src.indexOf('>', lt); i = e < 0 ? src.length : e + 1; continue; }
    if (src[lt + 1] === '/') { const e = src.indexOf('>', lt); i = e < 0 ? src.length : e + 1; continue; }
    if (!/[A-Za-z]/.test(src[lt + 1] || '')) { i = lt + 1; continue; }
    const el = readTag(src, lt); out.push(el); i = el.end;
    if (RAW.has(el.tag)) {
      const re = new RegExp(`</${el.tag}[\\s/>]`, 'ig'); re.lastIndex = i; const m = re.exec(src);
      const stop = m ? m.index : src.length; el.text = src.slice(i, stop);
      const e = m ? src.indexOf('>', stop) : -1; i = e < 0 ? src.length : e + 1;
    }
  }
  return out;
}
export const getElementById = (src, id) => elements(src).find((e) => e.attrs.get('id') === id) || null;
// Inline scripts (no src attribute) in document order: what a browser would run.
export const inlineScriptBodies = (src) => elements(src).filter((e) => e.tag === 'script' && !e.attrs.has('src')).map((e) => e.text);
