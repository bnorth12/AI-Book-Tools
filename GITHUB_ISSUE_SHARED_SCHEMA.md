# Issue: Define and implement shared versioned novel schema

## Summary
Create a shared, versioned novel JSON schema for `NovelWriter`, `BookEditor`, and `BookDecomposer`, and implement task plans for each tool to adopt it.

## Problem
The three tools currently use different JSON formats for story data, making import/export workflows inconsistent and fragile.

## Proposed Solution
1. Publish a shared schema file at `schema/novel-schema-1.0.json`.
2. Use `NovelWriter` as the canonical reference for the initial schema.
3. Add explicit `schemaVersion`, `sourceTool`, and optional `sourceVersion` metadata.
4. Define a normalized `novelData` payload that includes:
   - `genre`, `title`, `storyArc`, `generalPlot`, `setting`
   - `numChapters`, `chapterLength`
   - `authorStyle`, `styleGuide`, `author`
   - `characters`, `subplots`, `chapterOutlines`, `chapterArcs`, `chapters`
   - `editedChapters`, `bookText`, `outlineImprovements`, `bookImprovementsWithStatus`
   - `requestLog`
5. Create an implementation task list in `schema/novel-schema-1.0-tasks.md`.

## Acceptance Criteria
- `schema/novel-schema-1.0.json` exists and is documented.
- `schema/novel-schema-1.0-tasks.md` exists and lists tasks for each tool.
- `BookEditor` can import/export the shared schema and preserve backward compatibility.
- `BookDecomposer` can export analysis using the shared schema.
- `NovelWriter` exports are tagged with `schemaVersion: "1.0"` and use shared field names.
- Documentation is updated in `README.md`, `CONTRIBUTING.md`, and relevant tool README files.

## Implementation Notes
- `BookEditor` should accept shared-schema JSON from both `NovelWriter` and `BookDecomposer`.
- `BookDecomposer` output should validate against `schema/novel-schema-1.0.json`.
- `NovelWriter` should support the shared schema without losing its mature authoring capabilities.
- Keep `additionalProperties: true` in the schema so tools can evolve without breaking compatibility.

## Related Files
- `schema/novel-schema-1.0.json`
- `schema/novel-schema-1.0-tasks.md`
- `README.md`
- `BookEditor/README.md`
- `BookDecomposer/README.md`
- `.github/ISSUE_TEMPLATE/feature-request.md`
