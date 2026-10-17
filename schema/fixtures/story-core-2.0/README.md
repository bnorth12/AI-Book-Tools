# Story Core 2.0 fixtures

| Fixture | Result | What it proves | Mutation partner |
| --- | --- | --- | --- |
| `2.0-minimal.json` | Pass | Small fiction wrapper and required scene fields | M2: drop `breakApproved` |
| `2.0-full.json` | Pass | Shared entities, scene approvals, templates, and tool extensions | M1: use `source: "model"` |
| `hbf-core-only.json` | Pass | Nonfiction book has no fiction-only core fields or stubs | M7: require a fiction field in core |
| `unknown-ext-roundtrip.json` | Pass | Unknown core and future-tool keys are preserved | M6: reject unknown extension fields |
| `token-counts-pass.json` | Pass | Benign `api`, usage counts, keywords, and key beats remain valid | M3: add `apiKey` in an extension array; M11: over-block benign names |
| `secret-import-stripped.json` | Fail | Raw import still contains denylisted keys and URL credentials | M5: remove schema denylist |
| `secret-import-stripped.expected.json` | Pass | Reference import stripper output and pointer list validate | M5: remove schema denylist |
| `secret-export-stripped.json` | Fail | Denylist catches API keys at wrapper and extension depth | M4: case-sensitive denylist misses mixed/uppercase variants |
| `authorization-export-stripped.json` | Fail | Denylist catches authorization fields and URL userinfo | M5: remove schema denylist |
| `credential-url-userinfo.json` | Fail | Userinfo is forbidden under an arbitrary `link` property | M8: remove userinfo URL check |
| `credential-url-query-token.json` | Fail | Query credentials are forbidden under an arbitrary `sourceUrl` property | M9: remove query-parameter URL check |
| `credential-url-pass.json` | Pass | Ordinary links, bare `key`, and `tokens` query parameters are preserved | M12: over-block `key`/`tokens` |
| `credential-url-query-secret.json` | Fail | Empty/valueless secret queries are rejected at wrapper and extension-array depth | M13: omit substring and `access_key` checks; M17: require `=` |

The export fixtures are synthetic, unstripped attempts. A conforming exporter
removes their sensitive fields and notifies using `secret-export-stripped` or
`authorization-export-stripped` before writing. M1–M7 are generated as temporary
in-memory copies by `scripts/_smoke_story_core_contract.mjs`; M8–M17 additionally
mutate the URL checks, redaction exception, benign-name allowlist, and masked-value
scan. M10 rejects appended placeholders; M14 proves `******` detection is active.
M15 restores shifted array pointers; M16 disables the synchronous-work watchdog
probe's timeout. Both must make their targeted assertions fail.
M17 restores the valueless-query bypass.
No mutation files are shipped with the fixtures.
