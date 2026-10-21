// SEC-SWEEP ref-v2.3 (plan REF-V2.3-N2 v1.1 T1): deterministic fuzz corpus for the tighten-only superset guard. The same
// seed and generator produce the corpus here and in the box fixture generator, so the frozen ref-v2.2 spans line up.
// Fake key only: 'xai-' + 24 chars, built at runtime (T2: no key literal in any file).
export const FAKE_KEY = 'xai-' + ['FAKEfake', 'FAKEfake', '01234567'].join('');
export const FUZZ_SEED = 0x5ec23;
export const FUZZ_N = 5000;
function rng(seed) { let s = seed >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const FRAG = ['https://e.com/?token=abc', 'https://e.com/?key=1', 'https://u:p@h.example/x', 'see ', ' ok', 'Authorization: Bearer ', 'Bearer ',
  'Cookie: sid=abc123; ', 'Set-Cookie: ', '?auth=', '?code=', '&', '#id_token=', 'https://a.example.com/cb', ' the bearer of ', 'xai-',
  'abcdefghij0123456789', 'Cookie recipe: ', '\n', '"', "'", ':', '=', ';', 'zipcode', 'author', 'https:\\/\\/e.com\\/?token=x', '%61uth=', '%2D',
  'X-Api-Key: ', 'q=', 'https://doi.org/10.1/x', '1-3 mL tincture', '{"auth":"', '"}', 'password', 'sessionCookie=', ' ', ' ', 'k'];
export function fuzzCorpus(n = FUZZ_N, seed = FUZZ_SEED) {
  const r = rng(seed); const out = [];
  for (let i = 0; i < n; i++) { let s = ''; const L = 1 + Math.floor(r() * 9);
    for (let j = 0; j < L; j++) { const f = FRAG[Math.floor(r() * FRAG.length)]; s += f === 'xai-' ? FAKE_KEY.slice(0, 4 + Math.floor(r() * 25)) : f; }
    out.push(s); }
  return out;
}
// Kept raw indices of `input` in a stripped `out` (null = field dropped): out = kept slices of input, in order, joined by MARK.
export function keptIndices(input, out, MARK) {
  const kept = new Set(); if (out === null || out === undefined) return kept;
  let cur = 0;
  for (const piece of String(out).split(MARK)) { if (piece === '') continue; const at = input.indexOf(piece, cur); if (at < 0) return null; for (let i = at; i < at + piece.length; i++) kept.add(i); cur = at + piece.length; }
  return kept;
}
