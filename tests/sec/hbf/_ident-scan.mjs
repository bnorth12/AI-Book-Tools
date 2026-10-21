// SEC-SWEEP #180 (Reviewer NO-GO on 1e897af1, MF1-MF3; Engineering recheck scan): dependency-free static scan of the HBF
// page script for identifiers that are referenced but never declared anywhere in the page and are not browser/JS globals.
// A small JS tokenizer (comments, strings, template literals with ${} nesting, regex literals) feeds a conservative
// declaration collector: function/class names, params (function and arrow), catch params, and every const/let/var
// declarator pattern count as declared ANYWHERE in the page (scope-insensitive, so it can miss a reference that is out of
// scope, never invent one). References are identifiers not after `.`/`?.`, not object keys, not labels.
// No allowlist of page names: the only exemptions are the language keywords and the browser/JS globals below.
const KEYWORDS = new Set(('break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield await async of get set static null true false undefined NaN Infinity arguments').split(' '));
// Browser globals the page may use (DOM/BOM). JS built-ins come from the Node realm's globalThis.
const BROWSER = new Set(('window document localStorage sessionStorage alert confirm prompt FileReader Blob URL URLSearchParams fetch navigator location history ' +
  'setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame console performance Event CustomEvent ' +
  'HTMLElement Element Node NodeList DOMParser XMLSerializer MutationObserver IntersectionObserver ResizeObserver getComputedStyle ' +
  'AbortController AbortSignal Headers Request Response FormData TextEncoder TextDecoder structuredClone queueMicrotask atob btoa crypto ' +
  'self globalThis Image Audio Option KeyboardEvent MouseEvent InputEvent ClipboardItem matchMedia scrollTo open close print').split(' '));
const isIdStart = (c) => /[A-Za-z_$\u00C0-\uFFFF]/.test(c);
const isId = (c) => /[\w$\u00C0-\uFFFF]/.test(c);
const REGEX_AFTER_KW = new Set(['return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'throw', 'else', 'do', 'instanceof', 'yield', 'await']);

export function tokenize(src) {
  const toks = []; let i = 0; const L = src.length; const tplStack = []; // brace depth at each open ${
  let brace = 0; let line = 1;
  let tokStart = 0; const push = (o) => { o.s = tokStart; toks.push(o); };
  const prevSig = () => toks[toks.length - 1];
  const regexOk = () => { const p = prevSig(); if (!p) return true; if (p.t === 'id') return REGEX_AFTER_KW.has(p.v); if (p.t === 'num' || p.t === 'str' || p.t === 're' || p.t === 'tpl') return false; return !(p.v === ')' || p.v === ']' || p.v === '}'); };
  const readTpl = () => { // at a char after ` or after } closing ${...}
    while (i < L) { const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '\n') line++;
      if (c === '`') { tokStart = i; i++; push({ t: 'tpl', v: '`', line }); return; }
      if (c === '$' && src[i + 1] === '{') { tokStart = i; i += 2; tplStack.push(brace); brace++; push({ t: 'p', v: '${', line }); return; }
      i++; }
    throw new Error('unterminated template');
  };
  while (i < L) {
    const c = src[i]; tokStart = i;
    if (c === '\n') { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < L && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); for (let k = i; k < e; k++) if (src[k] === '\n') line++; i = e + 2; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < L && src[j] !== c) { if (src[j] === '\\') j++; j++; } push({ t: 'str', v: src.slice(i, j + 1), line }); i = j + 1; continue; }
    if (c === '`') { i++; readTpl(); continue; }
    if (c === '/' && regexOk()) { let j = i + 1, cls = false; while (j < L) { const d = src[j]; if (d === '\\') { j += 2; continue; } if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls) break; else if (d === '\n') throw new Error(`regex scan ran past a line at ${line}`); j++; } j++; while (j < L && isId(src[j])) j++; push({ t: 're', v: src.slice(i, j), line }); i = j; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) { let j = i + 1; while (j < L && /[\w.]/.test(src[j])) j++; push({ t: 'num', v: src.slice(i, j), line }); i = j; continue; }
    if (isIdStart(c)) { let j = i + 1; while (j < L && isId(src[j])) j++; push({ t: 'id', v: src.slice(i, j), line }); i = j; continue; }
    if (c === '{') { brace++; push({ t: 'p', v: '{', line }); i++; continue; }
    if (c === '}') { if (tplStack.length && tplStack[tplStack.length - 1] === brace - 1) { tplStack.pop(); brace--; push({ t: 'p', v: '}', line }); i++; readTpl(); continue; } brace--; push({ t: 'p', v: '}', line }); i++; continue; }
    const three = src.slice(i, i + 3), two = src.slice(i, i + 2);
    if (three === '...' || three === '===' || three === '!==' || three === '>>>' || three === '**=' || three === '&&=' || three === '||=' || three === '??=') { push({ t: 'p', v: three, line }); i += 3; continue; }
    if (['=>', '?.', '==', '!=', '<=', '>=', '&&', '||', '??', '++', '--', '+=', '-=', '*=', '/=', '%=', '|=', '&=', '^=', '<<', '>>', '**'].includes(two)) { push({ t: 'p', v: two, line }); i += 2; continue; }
    push({ t: 'p', v: c, line }); i++;
  }
  return toks;
}

export const OPEN = { '(': ')', '[': ']', '{': '}', '${': '}' };
export function matchClose(toks, k) { // index of the token closing the bracket at k
  let d = 0; for (let j = k; j < toks.length; j++) { const v = toks[j].t === 'p' ? toks[j].v : null; if (v && OPEN[v]) d++; else if (v === ')' || v === ']' || v === '}') { d--; if (d === 0) return j; } } return -1;
}
const idsIn = (toks, a, b, out) => { for (let j = a; j <= b; j++) if (toks[j].t === 'id' && !KEYWORDS.has(toks[j].v) && !(j > 0 && (toks[j - 1].v === '.' || toks[j - 1].v === '?.'))) out.add(toks[j].v); };

export function undefinedIdentifiers(code, extraGlobals = []) {
  const toks = tokenize(code);
  const declared = new Set();
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k]; const nx = toks[k + 1];
    if (t.t !== 'id') continue;
    if ((t.v === 'function' || t.v === 'class') && nx) { let j = k + 1; if (nx.v === '*') j++; if (toks[j].t === 'id') { declared.add(toks[j].v); j++; }
      if (t.v === 'function' && toks[j] && toks[j].v === '(') idsIn(toks, j, matchClose(toks, j), declared); continue; }
    if (t.v === 'catch' && nx && nx.v === '(') { idsIn(toks, k + 1, matchClose(toks, k + 1), declared); continue; }
    if (t.v === 'const' || t.v === 'let' || t.v === 'var') { // declarator patterns: up to = / of / in / ; at depth 0, then skip the initializer to a depth-0 comma
      let j = k + 1;
      for (;;) {
        let d = 0;
        for (; j < toks.length; j++) { const v = toks[j].v; if (toks[j].t === 'p' && OPEN[v]) d++; else if (v === ')' || v === ']' || v === '}') { if (d === 0) break; d--; }
          if (d === 0 && (v === '=' || v === ';' || v === ',' || (toks[j].t === 'id' && (v === 'of' || v === 'in')))) break;
          if (toks[j].t === 'id' && !(d > 0 && toks[j + 1] && toks[j + 1].v === ':' )) declared.add(v); }
        if (!toks[j] || toks[j].v !== '=') { if (toks[j] && toks[j].v === ',') { j++; continue; } break; }
        d = 0; j++;
        for (; j < toks.length; j++) { const v = toks[j].v; if (toks[j].t === 'p' && OPEN[v]) d++; else if (v === ')' || v === ']' || v === '}') { if (d === 0) break; d--; }
          if (d === 0 && (v === ',' || v === ';')) break;
          if (d === 0 && toks[j].t === 'id' && ['const', 'let', 'var', 'function', 'if', 'for', 'return', 'class'].includes(v) && toks[j].line > toks[j - 1].line) { j--; break; } }
        if (toks[j] && toks[j].v === ',') { j++; continue; } break;
      }
      continue;
    }
    if (nx && nx.v === '=>') declared.add(t.v); // x => ...
  }
  for (let k = 0; k < toks.length; k++) if (toks[k].v === '=>' && toks[k - 1] && toks[k - 1].v === ')') { // (a, {b}) => ...
    let d = 0, j = k - 1; for (; j >= 0; j--) { const v = toks[j].v; if (v === ')' || v === ']' || v === '}') d++; else if (toks[j].t === 'p' && OPEN[v]) { d--; if (d === 0) break; } }
    idsIn(toks, j, k - 1, declared);
  }
  // method shorthand / class members: name ( ... ) {  inside an object literal or class body -> a key, not a reference
  const isMethodKey = (k) => { if (!toks[k + 1] || toks[k + 1].v !== '(') return false; const c = matchClose(toks, k + 1); if (c < 0 || !toks[c + 1] || toks[c + 1].v !== '{') return false;
    const p = toks[k - 1]; return !!p && (p.v === ',' || p.v === '{' || p.v === '}' || p.v === ';' || p.v === 'get' || p.v === 'set' || p.v === 'static' || p.v === 'async') && !['if', 'for', 'while', 'switch', 'catch', 'function', 'with'].includes(toks[k].v); };
  const globals = new Set([...Object.getOwnPropertyNames(globalThis), ...BROWSER, ...extraGlobals]);
  const out = new Map(); const tern = []; // depth bookkeeping for `?` ... `:`
  let depth = 0;
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.t === 'p') { if (OPEN[t.v]) depth++; else if (t.v === ')' || t.v === ']' || t.v === '}') { depth--; while (tern.length && tern[tern.length - 1] > depth) tern.pop(); }
      else if (t.v === '?') tern.push(depth); else if (t.v === ':' && tern.length && tern[tern.length - 1] === depth) tern.pop(); continue; }
    if (t.t !== 'id' || KEYWORDS.has(t.v)) continue;
    const p = toks[k - 1], n = toks[k + 1];
    if (p && (p.v === '.' || p.v === '?.')) continue;
    if (n && n.v === ':' && !(tern.length && tern[tern.length - 1] === depth) && !(p && p.v === 'case')) continue; // object key or label
    if (isMethodKey(k)) continue;
    if (declared.has(t.v) || globals.has(t.v)) continue;
    if (!out.has(t.v)) out.set(t.v, []); out.get(t.v).push(t.line);
  }
  return out;
}
