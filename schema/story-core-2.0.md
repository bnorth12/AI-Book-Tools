# Story Core 2.0

Story Core 2.0 is the additive shared contract for fiction and nonfiction book
documents. Its JSON Schema is `schema/story-core-2.0.json` (JSON Schema
2020-12). The wrapper identifies the document and carries a `novelData` object;
the shared book model is nested at `novelData.story`.

## Wrapper and dual form

| Field | Requirement | Meaning |
| --- | --- | --- |
| `schemaVersion` | Required, constant `"2.0"` | Envelope version |
| `coreVersion` | Required string | Shared core version |
| `sourceTool` | Required string | Producing application |
| `sourceVersion` | Required string | Producing application version |
| `exportedAt` | Required string | Export timestamp |
| `workType` | Required: `fiction` or `nonfiction` | Selects the applicable profile |
| `novelData` | Required object | Preserves existing 1.x flat fields and contains `story` for fiction |

The existing flat 1.x data shape is not re-required or removed. Fiction
documents require `novelData.story`; nonfiction documents may use the shared
Book and Chapter core without any fiction entities, `story` is not required for
nonfiction. Unrecognized keys at the wrapper, `novelData`, story, and core
entity levels remain valid and are preserved by readers and writers.

## Shared entities

| Entity | Contract fields | Notes |
| --- | --- | --- |
| `Book` (`novelData.story.book`) | Required `id`, `title`; optional `synopsis`, `seriesId`, `bookNumber` | `synopsis` is optional; there is no Series entity. A book may reference a series without defining one. |
| `Chapter` (`novelData.story.chapters[]`) | Required `id` matching `^ch_`; optional `number`, `title`, `summary` | Unknown chapter keys are retained. |
| `Scene` (`novelData.story.scenes[]`) | Required exactly `id`, `chapterId`, `order`, `breakApproved`; `id` matches `^sc_`, `chapterId` matches `^ch_` | `source` is optional and uses the provenance enum. Scene-level `migratedBy` is not defined. |

Fiction-only Characters, Arcs, and the setup/payoff ledger are owned by
`ext.novelWriter`, never by the shared core. `setupPayoff` may be `null` until
NovelWriter's L1 ledger exists. Nonfiction books do not need fiction fields or
empty fiction stubs in either `novelData.story` or the shared core. Tool-local
data belongs under `ext.novelWriter`, `ext.bookEditor`, or
`ext.bookDecomposer`; a tool owns its namespace, and each extension accepts
unknown keys. New tools use their own namespace, such as `ext.futureTool`.

## Scene rules and provenance

Scene IDs use the opaque `sc_` prefix and Chapter IDs use `ch_`. The only
required Scene fields are `id`, `chapterId`, `order`, and `breakApproved`.
`breakApproved` records the user's approval of a scene boundary; `false` is a
valid, explicitly unapproved proposal and must not be treated as authoritative.
`order` is a positive integer. No `migratedBy` field is defined for a Scene;
migration provenance belongs at the owning tool's extension scope.

Book, Chapter, and Scene objects may use the provenance mixin:

| Field | Type | Meaning |
| --- | --- | --- |
| `source` | `ai`, `user`, or `import` | Origin of the item |
| `confidence` | Number from 0 through 1 | Optional confidence |
| `approved` | Boolean | Optional approval state |
| `approvedAt` | String | Optional approval timestamp |
| `locked` | Boolean | Optional lock state |
| `span` | Object | Optional `{ "chapter": string, "start": integer, "end": integer }` range |

All mixin fields are optional. Unknown entity and nested-object keys remain
valid so that newer data can round-trip through older readers. `ext` is
namespaced and app-owned, not a shared dumping ground.

## No-secrets hard rule

The schema recursively rejects secret-bearing property names at every depth,
including `ext.*` and arrays. A property name is normalized by lowercasing it
and stripping every `_`, `-`, and line terminator (`\n`, `\r`, `\u2028`,
`\u2029`). The normalized name is denied if it ends with `token`; contains
`apikey`; is exactly one of `openaikey`, `xaikey`, `anthropickey`,
`geminikey`, `githubkey`, `googlekey`, `awskey`, `privatekey`, `secretkey`, `accesskey`;
contains `secret`; contains `password`; is exactly `passwd`; is exactly
`authorization`; or starts with `bearer`. That includes `refreshToken` and
`idToken` from issues #157 and #166, plus `sessionToken`, `apiKey`,
`X_API_KEY`, `openaiKey`, `csrfToken`, and keys that hide the match behind
`_`, `-`, or a line terminator such as `api\nKey`. Usage metadata such as
`tokens`, `promptTokens`, `maxTokens`, `tokenCount`, `tokenizer`,
`tokenBudget`, `tokenCounts`, and `completionTokens`, and ordinary names such
as `keyword`, `keywords`, `monkey`, `sessionId`, `sortKey`, `primaryKey`,
`donkey`, `api`, and `keyBeats`, are not secret keys.

Any string value is rejected if it contains URL userinfo (`://user:pass@`
form), regardless of the containing property name. A credential query or
fragment parameter counts only inside URL context. URL context starts at
`scheme://` or protocol-relative `//` at any position (so `[docs](https://...)`,
`url=https://...`, `see:https://...`, `text,https://...`, and `src=//cdn...`
are covered), or at a host-like `name.tld` (`www.` and bare `domain.tld/path`
links such as `doi.org/x`) whose first label is not preceded by a URL character
(letter, digit, or `._~%+/@-`). Context runs forward to the next whitespace, so a
credential is caught however far into the run it appears. A valueless parameter
followed by whitespace also counts. After `?` or `&`, a matching
parameter name counts with or without a value; after `#`, it counts only when
`=` follows, so OAuth-style `#access_token=` fragments are stripped while
document anchors such as `#api-keys`, `#password-reset`, or `#token` are
preserved. A parameter name is normalized like a property name (lowercase,
strip `_` and `-`) and denied if it ends with `token`; contains `apikey`,
`secret`, or `password`; starts with `bearer`; or is exactly one of the
provider names above (including `accesskey`), `authorization`, or `passwd`.
So `access_token`, `api_key`, `api-key`, `access_key`, `sig_token`, and
`client_secret` are denied, while `key`, `tokens`, `tokenCount`,
`token_budget`, `tokenizer`, `keywords`, and `term` are preserved.
`accessKeyId` is not an exact provider name and is preserved. Query checks also
cover valueless parameters, terminated by `=`, `&`, `#`, or the end of the
string. Ordinary HTTPS/mailto links, pagination, search terms, and `@` in paths
are preserved. Prose that only resembles a query string, with no URL-like run
(for example `what?token=1`), is preserved. Matching is linear: the scan from one start stops at the next start, so each
character is scanned once, and name matching does not backtrack. The denylist applies to property
names, not prose values (for example, a `passwordHint` in prose).

**A file that has been written must contain no denylisted key or credential.**
Exporting tools strip those fields and notify the user before writing, using
`secret-export-stripped` for denylisted keys and
`authorization-export-stripped` for authorization credentials. Schema
validation guards the sanitized outgoing document so no file containing them
is written. On import, tools strip matching keys and URL credentials, show a
warning listing the stripped JSON Pointers, and then validate the sanitized
document. The export fixtures are synthetic, unstripped attempts, not files a
conforming tool may write.

The hard-rule instruction in plan §0 (strip and notify on export) takes
precedence over plan §4.4's older "reject on export" wording.

## Versioning

Story Core 2.0 is additive: legacy flat `novelData` fields are preserved and
unknown fields are accepted. Readers must accept every prior format forever;
new format support must not retire or invalidate a prior reader path.
