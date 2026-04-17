# Shared Novel Schema v1.0 Tasks

This document describes the initial shared schema and the implementation tasks for each tool.

## Purpose

Create a shared, versioned JSON schema for `NovelWriter`, `BookEditor`, and `BookDecomposer`.

- File: `schema/novel-schema-1.0.json`
- Version: `1.0`
- Owner: `NovelWriter` as the canonical reference implementation
- Goal: enable BookDecomposer analysis exports and BookEditor imports to use the same story model

## Canonical Schema Highlights

The shared schema includes:

- `schemaVersion`: required root version string
- `sourceTool`: optional producer name
- `sourceVersion`: optional producer version
- `novelData`: core story and edit state
  - `genre`, `title`, `storyArc`, `generalPlot`, `setting`
  - `numChapters`, `chapterLength`
  - `authorStyle`, `styleGuide`, `author`
  - `characters`, `subplots`, `chapterOutlines`, `chapterArcs`, `chapters`
  - `editedChapters`, `bookText`, `outlineImprovements`, `bookImprovementsWithStatus`
  - `requestLog`

## Implementation Tasks by Tool

### NovelWriter

1. Confirm current `novelData` export shape matches the schema fields.
2. Export JSON with root `schemaVersion: "1.0"` and `sourceTool: "NovelWriter"`.
3. Add optional properties where missing:
   - `bookText`
   - `editedChapters`
   - `bookImprovementsWithStatus`
   - `outlineImprovements`
4. Preserve story arrays as:
   - `characters`
   - `subplots`
   - `chapterOutlines`
   - `chapterArcs`
   - `chapters`
5. Keep `requestLog` as a structured object within `novelData`.
6. Document the export format and schema version in the code or docs.

### BookDecomposer

1. Update output to emit the shared schema file format.
2. Add top-level `schemaVersion: "1.0"` and `sourceTool: "BookDecomposer"`.
3. Ensure analysis results are output under `novelData`.
4. Make sure `chapters` is an array of strings and that optional analysis metadata is preserved.
5. Support the same field names as NovelWriter for compatibility.
6. Document the new export format in `BookDecomposer/README.md`.

### BookEditor

1. Add import support for shared schema JSON files.
2. Normalize imported `novelData` into the editor's internal session state.
3. Export edited sessions using the shared schema with `schemaVersion: "1.0"` and `sourceTool: "BookEditor"`.
4. Preserve `editedChapters`, `bookText`, and `bookImprovementsWithStatus`.
5. Keep backward compatibility for existing flat legacy session JSON.
6. Document the import/export expectations in `BookEditor/README.md`.

## Suggested Implementation Phases

1. Create and publish the shared schema file (`schema/novel-schema-1.0.json`).
2. Update documentation and issue templates to reference the schema.
3. Implement BookEditor import/export support.
4. Implement BookDecomposer export support.
5. Sync NovelWriter to the schema and add versioning.

## Cross-tool Compatibility Notes

- Use `schemaVersion` to detect compatible imports.
- Keep unknown fields allowed so tools can evolve without breaking older exports.
- Preserve a single canonical field naming set across all three apps.
