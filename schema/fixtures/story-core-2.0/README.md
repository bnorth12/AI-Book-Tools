# Story Core 2.0 fixtures

| Fixture | Result | What it proves | Mutation partner |
| --- | --- | --- | --- |
| `2.0-minimal.json` | Pass | Small fiction wrapper and required scene fields | M2: drop `breakApproved` |
| `2.0-full.json` | Pass | Shared entities, scene approvals, templates, and tool extensions | M1: use `source: "model"` |
| `hbf-core-only.json` | Pass | Nonfiction book has no fiction-only core fields or stubs | M7: require a fiction extension in core |
| `unknown-ext-roundtrip.json` | Pass | Unknown core and future-tool keys are preserved | M6: reject unknown extension fields |
| `token-counts-pass.json` | Pass | Usage counts are allowed secret-adjacent fields | M3: add `apiKey` in an extension array |
| `secret-import-stripped.json` | Fail | Raw import still contains denylisted keys and URL credentials | M5: remove schema denylist |
| `secret-import-stripped.expected.json` | Pass | Reference import stripper output and pointer list validate | M5: remove schema denylist |
| `secret-export-stripped.json` | Fail | Denylist catches API keys at wrapper and extension depth | M4: change `apiKey` to `API_KEY` |
| `authorization-export-stripped.json` | Fail | Denylist catches authorization fields and URL userinfo | M5: remove schema denylist |

Files named `*-export-stripped.json` represent attempted exports that the schema
rejects; an actual writer must strip and notify before writing.
