# HBF redaction tests (tests/sec/hbf)

These tests run HerbalBookForge's redaction on all three strip paths: export, import and storage.

## Deferred: multi-user/auth (docs note only)

The tests for two redaction cases are deferred:

- **(a) Password-in-link:** username/password (userinfo) in a link, including escaped forms.
- **(c) Long or escaped key names:** secret key names over 64 characters, raw or escaped.

- **Status:** (a) and (c) are **known open gaps**. They are **not fixed**, and no test in this folder claims they are.
- **Trigger:** these tests stay deferred until multi-user/auth is built. Backlog item: MULTIUSER-BACKLOG
- **Gates:** until then, the deferred cases do not block CI or review gates.

This note adds no code, no test rows and no pin changes.
