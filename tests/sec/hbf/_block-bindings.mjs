// SEC-SWEEP #180 CACHE-04c source of truth (Reviewer N1 / NO-GO on 1e897af1): the top-level bindings of the SEC-SWEEP #180
// shared copy, read from the page text being loaded (never from secRuleId's own name list). Every depth-0 statement
// between the markers is classified: `function NAME(` declarations, and each declarator of `const|let|var A = ..., B = ...`.
// Any other depth-0 statement (today only the `tail prefix drift` guard) is returned in `other`, so a new kind of
// statement can't slip through unclassified.
import { markedBlock, BEGIN } from '../_load.mjs';
import { tokenize, matchClose, OPEN } from './_ident-scan.mjs';

// Pure UI binding that does not feed the strip (D7 export notice text from a finished report): excluded from coverage.
export const UI_ONLY = ['exportNotice'];

export function blockBindings(pageSrc) {
  const block = markedBlock(pageSrc);
  if (block === null) throw new Error('CACHE-04c: the page has no SEC-SWEEP #180 shared-copy markers');
  const base = pageSrc.indexOf(BEGIN) + BEGIN.length; // block offsets -> page offsets
  const toks = tokenize(block);
  const out = []; const other = [];
  const depth0End = (k) => { let d = 0; for (let j = k; j < toks.length; j++) { const v = toks[j].v; if (toks[j].t === 'p' && OPEN[v]) d++; else if (v === ')' || v === ']' || v === '}') d--; else if (d === 0 && (v === ';' || v === ',')) return j; } return toks.length; };
  for (let k = 0; k < toks.length;) {
    const t = toks[k];
    if (t.t === 'id' && t.v === 'function') {
      const name = toks[k + 1].v; const po = k + 2;
      if (toks[po].v !== '(') throw new Error(`CACHE-04c: unexpected function form for ${name}`);
      const pc = matchClose(toks, po); let bo = pc + 1; while (toks[bo].v !== '{') bo++;
      const bc = matchClose(toks, bo);
      out.push({ name, kind: 'function', at: base + toks[po].s + 1, start: base + t.s, end: base + toks[bc].s + 1 });
      k = bc + 1; continue;
    }
    if (t.t === 'id' && (t.v === 'const' || t.v === 'let' || t.v === 'var')) {
      let j = k + 1;
      for (;;) {
        const name = toks[j].v; if (toks[j].t !== 'id' || toks[j + 1].v !== '=') throw new Error(`CACHE-04c: unsupported declarator near ${name}`);
        const vs = j + 2; const ve = depth0End(vs);
        const arrow = toks.slice(vs, ve).findIndex((x) => x.v === '=>');
        out.push({ name, kind: t.v, valueStart: base + toks[vs].s, valueEnd: base + (ve < toks.length ? toks[ve].s : block.length), arrowAt: arrow >= 0 ? base + toks[vs + arrow].s + 2 : -1 });
        if (ve < toks.length && toks[ve].v === ',') { j = ve + 1; continue; }
        k = ve + 1; break;
      }
      continue;
    }
    const e = depth0End(k); other.push(block.slice(t.s, e < toks.length ? toks[e].s + 1 : block.length).trim()); k = e + 1;
  }
  return { bindings: out, other };
}
