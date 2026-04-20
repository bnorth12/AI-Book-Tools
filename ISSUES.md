# Proposed Issues for AI Book Tools

## Issue 1: Define and publish shared novel schema v1.0

### Issue 1 Summary

Create and publish a versioned shared novel JSON schema for `NovelWriter`, `BookEditor`, and `BookDecomposer`.

### Issue 1 Problem

The three tools currently use different JSON formats for describing and exchanging story data. This prevents seamless import/export workflows between analysis, editing, and authoring.

### Issue 1 Proposed Solution

- Publish the shared schema in `schema/novel-schema-1.0.json`
- Treat `NovelWriter` as the canonical reference for the initial schema
- Include `schemaVersion`, `sourceTool`, `sourceVersion`, and a `novelData` object
- Allow optional fields so all tools can use the same format even if some fields are not populated

### Issue 1 Acceptance Criteria

- `schema/novel-schema-1.0.json` exists and is documented
- `schema/novel-schema-1.0-tasks.md` lists implementation tasks
- The schema is referenced in repo documentation and issue templates

---

## Issue 2: Update BookEditor to import and export the shared schema

### Issue 2 Summary

Modify `BookEditor` so it can accept the shared schema from `NovelWriter` and `BookDecomposer`, while preserving backward compatibility with its existing session format.

### Issue 2 Problem

BookEditor currently uses its own flat JSON session model, which is incompatible with the other tools.

### Issue 2 Proposed Solution

- Add import support for `schema/novel-schema-1.0.json`-compatible files
- Normalize imported data into BookEditor’s internal state
- Export edited sessions using the shared schema with `schemaVersion: "1.0"` and `sourceTool: "BookEditor"`
- Continue supporting legacy BookEditor session JSON for compatibility

### Issue 2 Acceptance Criteria

- BookEditor can import shared-schema JSON exported by NovelWriter or BookDecomposer
- Exported BookEditor JSON matches the shared schema format
- Documentation is updated in `BookEditor/README.md`

---

## Issue 3: Update BookDecomposer output to emit the shared schema

### Issue 3 Summary

Change `BookDecomposer` so its analysis export uses the shared versioned novel schema.

### Issue 3 Problem

BookDecomposer currently emits a custom JSON output that is not directly compatible with the other tools.

### Issue 3 Proposed Solution

- Output `schemaVersion: "1.0"`, `sourceTool: "BookDecomposer"`, and `sourceVersion`
- Export analysis under `novelData` using the shared field names
- Preserve optional decomposition-specific metadata when possible

### Issue 3 Acceptance Criteria

- BookDecomposer export JSON validates against `schema/novel-schema-1.0.json`
- Output documentation is updated in `BookDecomposer/README.md`

---

## Issue 4: Sync NovelWriter with shared schema versioning

### Issue 4 Summary

Ensure `NovelWriter` exports and documentation are aligned to the shared novel schema version 1.0.

### Issue 4 Problem

NovelWriter is the most mature tool, but it does not currently carry an explicit shared schema version marker.

### Issue 4 Proposed Solution

- Add `schemaVersion: "1.0"` and `sourceTool: "NovelWriter"` to exports
- Ensure optional edit fields such as `bookText`, `editedChapters`, and `bookImprovementsWithStatus` are available
- Document the shared schema relationship in `NovelWriter` docs and comments

### Issue 4 Acceptance Criteria

- NovelWriter export JSON is explicitly tagged with the schema version
- `novelData` includes the shared field set
- Schema reference is documented in repo docs

---

## Top-Level Repo Todo (Separate Scope, Not Today's Work)

### Continuity Analytics Parity Backlog

- [ ] BookEditor: Add continuity analysis view that reports story arc progression, plot/subplot thread status, and per-character arc state based on imported chapter text.
- [ ] BookEditor: Add optional continuity audit action that flags chapter-to-chapter contradictions and recommends targeted edits without mutating source content automatically.
- [ ] BookEditor: Support optional shared-schema continuity fields (`chapterContinuityPackets`, `continuityTracker`, `continuityFindings`) during import/export.
- [ ] BookDecomposer: Add decomposition-time continuity tracker output for story arc, subplot lifecycle, and character arc transitions per chapter.
- [ ] BookDecomposer: Add explicit unresolved-thread extraction and chapter risk scoring in analysis output.
- [ ] BookDecomposer: Emit continuity analytics in shared-schema-compatible optional fields to interoperate with NovelWriter and BookEditor.
- [ ] Repo-level: Define which continuity fields are canonical in shared schema vs tool-specific optional extensions and document this boundary in schema docs.

### Release Closeout Checklist (Execute After Clean Test Pass)

- [x] Use `CURRENT_RELEASE_SSDL_STATUS.md` as the active backfilled SSDLC tracker for this release and close any open gap items before final tagging.

- [ ] Confirm clean pass evidence for required suites and archive links/artifacts (terminal output summary, `playwright-report/`, and key `test-results/` folders).
- [ ] Move version up one minor release for impacted tool(s) and repo-facing version references.
- [ ] For this cycle specifically, promote suite version from `V0.5.0` to `V0.6.0` at release closeout.
- [ ] Freeze and record final component version numbers included in suite `V0.6.0`.
- [ ] Update release notes/changelog entries from Unreleased to the new version section.
- [ ] Review open issues and close the ones fully addressed by merged code.
- [ ] Create new issues for completed-but-not-tracked work so history remains auditable.
- [ ] Ensure each addressed issue is linked to an active PR (open a new PR or update an existing PR).
- [ ] Confirm each PR description includes issue links, test evidence, and a concise change summary.
- [ ] Close PRs that are superseded/obsolete and keep one canonical PR path per issue.
- [x] Merge all approved feature branch PRs into trunk in dependency-safe order.
- [ ] Run a final post-merge smoke/regression verification on trunk.
- [ ] Tag the release using the exact commit that passed the final required test suites.
- [ ] If any commit is added after final test pass, rerun required release validation before tagging.
- [ ] Publish release notes linked to the release tag and test evidence.
- [ ] Close the release milestone and clean up fully merged feature branches.

Closeout note (2026-04-19): `feature/novelwriter-schema-stabilization` was
merged into `main` and deleted from origin. Remaining open closeout items are
blocked on GitHub token permissions (issue closure/milestone ops) and missing
local `XAI_API_KEY` for final trunk smoke/regression execution.

### Next Minor Capability Release Planning

- [ ] Execute the dedicated next-release UI unification plan in `NEXT_MINOR_RELEASE_UI_UNIFICATION_TODO.md` after the current release is fully closed and pushed to GitHub.
- [ ] After UI unification closes, execute the post-UI novel quality capability plan in `NEXT_CAPABILITY_RELEASE_NOVEL_QUALITY_TODO.md`.
