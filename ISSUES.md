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
