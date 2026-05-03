# BookEditor Schema Audit

## Current BookEditor Fields (by Tab)

### Tab 1: Project Setup

- `apiKey` ✓ (Tool-specific, not in shared schema)
- `model` ✓ (Tool-specific, not in shared schema)
- `maxTokens` ✓ (Tool-specific, not in shared schema)
- `genre` ✓ (In shared schema)
- Export/Import buttons

### Tab 2: Book Input

- `bookText` ✓ (In shared schema)
- `bookURL` ✗ (Not in shared schema, tool-specific)
- `inputMethod` ✗ (Not in shared schema, tool-specific)
- `chapters` (internal array, parsed from bookText) ✓
- `editedChapters` (internal array) ✓

### Tab 3: Chat Bot

- `chatQuestion` ✗ (Not in shared schema)
- `chatResponse` ✗ (Not in shared schema)

### Tab 4: Improvements List

- `improvements` array → should map to `bookImprovementsWithStatus` ✓

### Tab 5: Edited Output

- `editedChapters` ✓ (In shared schema)

### Tab 6: Request Log

- `requestLog` ✓ (In shared schema)

---

## Missing from BookEditor (shared schema fields)

| Field | Shared Schema | Current BookEditor | Status |
| ----- | ------------- | ------------------ | ------ |
| title | Required | ✗ Missing | ADD |
| storyArc | Required | ✗ Missing | ADD |
| generalPlot | Required | ✗ Missing | ADD |
| setting | Required | ✗ Missing | ADD |
| numChapters | Required | ✗ Implicit (calculated) | ADD |
| chapterLength | Required | ✗ Missing | ADD |
| authorStyle | Required | ✗ Missing | ADD |
| styleGuide | Required | ✗ Missing | ADD |
| author | Required | ✗ Missing | ADD |
| characters | Required | ✗ Missing | ADD |
| subplots | Required | ✗ Missing | ADD |
| chapterOutlines | Required | ✗ Missing | ADD (read-only from import) |
| chapterArcs | Required | ✗ Missing | ADD (read-only from import) |
| bookImprovementsWithStatus | Required | Partial (just array of text) | ENHANCE |
| outlineImprovements | Optional | ✗ Missing | ADD |

---

## Recommendations

### Priority 1: Minimal Changes (for import/export compatibility)

1. Add story metadata tab or section:
   - `title`
   - `storyArc`
   - `generalPlot`
   - `setting`

2. Enhance improvements structure:
   - Change from simple string array
   - Use: `{ text: "", status: "", breakdown: null }` format

3. Add optional fields for imported data (read-only or hidden):
   - `characters`, `subplots`, `chapterOutlines`, `chapterArcs`
   - These would be populated if importing from NovelWriter or BookDecomposer

### Priority 2: UI Enhancements

- Add a "Story Metadata" tab to capture/display story info
- Display imported character and subplot data in a collapsible view
- Map improvements status column to BookEditor's workflow

### Priority 3: Long-term

- Integrate character/subplot display in the main UI
- Allow BookEditor to edit more story elements, not just chapters

---

## Approach for Implementation

1. **Phase 1**: Add story metadata fields (title, arc, plot, setting) as:
   - Hidden fields for import/export (minimal UI change)
   - Optional input in Tab 1 for manual entry

2. **Phase 2**: Update export/import to use shared schema:
   - Detect and migrate legacy session format
   - Export with `schemaVersion: "1.0"` and `sourceTool: "BookEditor"`

3. **Phase 3**: Enhance UI to display more story data when imported:
   - Show character list
   - Show subplots
   - Display outlines as reference

---

## Implementation Checklist

- [ ] Add hidden fields for: title, storyArc, generalPlot, setting, numChapters, chapterLength, authorStyle, styleGuide, author
- [ ] Convert improvements array to { text, status, breakdown } structure
- [ ] Add support for: characters, subplots, chapterOutlines, chapterArcs (optional, read-only)
- [ ] Update exportSession() to emit shared schema format
- [ ] Update importSession() to:
  - Detect shared schema vs legacy format
  - Populate all shared fields
  - Maintain backward compatibility
- [ ] Test round-trip: NovelWriter → BookEditor → export
- [ ] Test round-trip: BookDecomposer → BookEditor → export
