// CANONICAL PIN = sep-codepoints.txt (a7ab70b1…, CoS r6 ruling). This file is the spec expected regex form; Nonfiction's ref-nel-fix/ copy must yield the same set.
// Expected class = every code point JS \s matches, plus U+0085 U+00AD U+180E U+200B U+200C U+200D U+2060. No \s, no \p{White_Space}.
export const SEP_CLASS = '[\\t\\n\\v\\f\\r \\u0085\\u00a0\\u00ad\\u1680\\u180e\\u2000-\\u200d\\u2028\\u2029\\u202f\\u205f\\u2060\\u3000\\ufeff]';
