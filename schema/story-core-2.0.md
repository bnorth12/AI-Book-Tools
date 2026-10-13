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
including `ext.*` and arrays. The case-insensitive denylist includes exact
names `api[_-]?key`, `apikey`, `auth[_-]?token`, `passwd`, `authorization`,
`access[_-]?token`, `refresh[_-]?token`, `id[_-]?token`, `private[_-]?key`,
and `x-api-key`; any key containing `secret` or `password`; and any key
starting with `bearer`. This includes the `refreshToken` and `idToken` cases
aligned with issues #157 and #166. Any string value is rejected if it contains
URL userinfo (`://user:pass@` form) or a query parameter whose name matches
the denylist, regardless of the containing property name. Query checks also
cover the explicit names `token` and `key`; a bare property named `token`
remains allowed. Usage metadata such as `tokenCounts`, `promptTokens`,
`completionTokens`, and `maxTokens`, and ordinary names such as `api`,
`keywords`, and `keyBeats`, are not secret keys. The denylist applies to
property names, not prose values (for example, a `passwordHint` in prose).

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
