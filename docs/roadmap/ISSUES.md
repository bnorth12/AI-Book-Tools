# Proposed Issues for AI Book Tools

## HerbalBookForge Sprint 5 Local Tracker (Quality, Workflow & Test Coverage — v0.13.0)

Use this section as the local execution checklist in VS Code. GitHub issues remain the source of truth.

- [x] #67 Sprint 5 requirements lock (v0.13.0 scope and acceptance criteria)
- [x] #68 Fix and formalize safety flag content rendering — regression test for parseSafetyReport coerceStr (closes #53)
- [x] #69 Implement "Apply suggestion to draft" action on safety flags (closes #52)
- [x] #70 Add "Generate Remaining Chapters" to Drafting tab
- [x] #71 Add smoke test coverage for revision controls and validate-draft-btn (DR8 gaps)
- [x] #72 Add integration test asserting flaggedText/suggestion content in safety flag rendering (HBFIT.22)
- [x] #73 Add export/import round-trip smoke test
- [x] #74 Update TESTING.md and REQUIREMENTS.md for v0.13.0
- [x] #75 Sprint 5 closeout and PR packaging

Notes:
- DOCX export (#71 was reassigned — DOCX is deferred beyond v0.13.0, tracked separately)
- #52 and #53 are existing GitHub issues; Sprint 5 closes both.
- parseSafetyReport coerceStr code fix already landed on main (2026-05-02); #68 adds the formal test and requirement trace.

## HerbalBookForge Next Sprint Analysis (Planning Only, from #102)

Scope rule for this analysis:
- Includes open sprint issues captured in #102
- Excludes deferred DOCX export requirement HBF.PR3.D1
- Planning only; implementation not started

### Canonical Issues and Dedupe Map

- #80 Generate Remaining status appears capped at chapter 10; safety cards still empty
- #82 Safety scan chapter scope off-by-one and issue text not displayed
	- duplicates: #79, #81
- #86 Outline generation/improvement truncation risk (token limit / incomplete response)
- #88 Export/Import arrow icons reversed
	- duplicate: #87
- #91 Bottom status label clarity (developer vs author language)
	- duplicates: #89, #90
- #94 Outline edit returns raw JSON/markup instead of readable text
	- duplicates: #92, #93
- #95 Move Prompts tab to right of Preview (workflow order)
- #98 Prevent author names in generated output text
	- duplicates: #96, #97
- #99 Drafting progress status off-by-one
- #101 Assemble manuscript duplicates chapter heading line
	- duplicate: #100

### Issue Analysis: Potential Cause, Related Requirement, Potential Fix

| Issue | Potential Cause | Related Requirement(s) | Potential Fix |
|---|---|---|---|
| #80, #99 | Mixed 0-based vs 1-based chapter indexing in status formatting; progress variable likely derived from array index while UI expects human chapter number | HBF.DR9 | Normalize status display to 1-based chapter numbering everywhere; centralize `toDisplayChapterNumber(index)` helper; add progress assertions for chapters >10 and chapter-specific runs |
| #82 | Safety scope label built from array index (N-1); parser/render contract mismatch for flag text fields (`flaggedText`/`issue`, `suggestion`/`recommendation`) still leaks blank values in some paths | HBF.SA2, HBF.SA3, HBF.SA6, HBFIT.22 | Enforce strict output contract for safety flags; require normalized fallback map in parser for all render paths; hard-fail malformed flags with visible warning; include chapterNumber per flag in full-book scans |
| #86 | Outliner/improve calls may hit response token ceiling; no finish-reason handling or truncation guard before accepting output | HBF.BG.G2, HBF.CHO5, HBF.UNI4.1 | Increase max token budget for outline/improve calls; check finish reason and trailing-structure completeness; auto-retry continuation or block accept with actionable warning |
| #94 | Output parser displays raw JSON/escaped markup when response shape differs from expected text payload; normalization stage may be bypassed in some edit/improve flow | HBF.CHO3, HBF.CHO5, HBF.UNI4.1 | Add canonical outline normalization stage before render/save; strip code fences/escaped newline artifacts; validate readable outline format before enabling accept action |
| #95 | Top-nav order optimized for implementation chronology, not author workflow sequencing | UIU.HBF.NF3 (UX consistency), HBF.PR1 | Reorder tab controls so Prompts follows Preview; keep selector IDs stable and update smoke expectations for order |
| #88 | Iconography semantics reversed relative to action labels (export/import mental model) | UIU.HBF.NF3, HBF.PR3 | Swap arrow directions or replace with unambiguous icons; add tooltip/aria-label clarity; retain existing button behavior and test IDs |
| #91 | Status copy is developer-centric and lacks mode semantics for fielded author use | UIU.HBF.NF3 | Replace with user-facing status taxonomy (Role, Mode, Agent Scope); make role label configurable (`Developer`, `Author`, `Editor`) via project setting/env flag |
| #98 | Prompt instructions allow style-reference names to leak into output prose; no explicit "style-only reference" constraint | HBF.DR1, HBF.CHO5, HBF.UNI4, HBF.UNI4.1 | Add prompt guardrail: named authors may guide style but must not appear in generated prose unless explicitly requested; add lexical post-check to flag accidental name leakage |
| #101 | Assemble routine likely concatenates chapter heading from both outline metadata and draft body preamble without dedupe | HBF.PR1, HBF.PR2, HBFIT.18 | Canonicalize one heading source during assembly; strip duplicate heading prefix from draft body when matching chapter title; add regression test for one-heading-per-chapter |

### Cross-Issue Root Cause Themes

- Indexing inconsistency: chapter display logic duplicated across Drafting and Safety flows
- Schema-contract drift: prompt examples and parser/render expectations diverge over time
- Output normalization gaps: malformed/escaped LLM output is rendered without a strict sanitize/validate stage
- UX semantics drift: control order and status copy reflect internal implementation rather than author-facing mental model

### Proposed Requirement Updates for Next Sprint (Draft)

These are proposed requirement changes to be added to `HerbalBookForge/REQUIREMENTS.md` during sprint execution:

- HBF.DR10 (new): Drafting progress and status displays SHALL use 1-based chapter numbering and SHALL match the chapter currently being generated for both single-chapter and batch generation actions.
- HBF.SA7 (new): Safety scan scope labels SHALL display the exact user-selected chapter number for chapter-scoped scans, and full-book findings SHALL include chapter number per flag.
- HBF.SA8 (new): Safety prompt/output contract SHALL require per-flag `chapterNumber`, `issue` (or normalized equivalent), and `suggestion` (or normalized equivalent); UI SHALL surface a user-visible parse warning for malformed flags.
- HBF.CHO8 (new): Outline improve/edit outputs SHALL be normalized to human-readable outline text before render/save; raw JSON/escaped markup SHALL not be displayed in the chapter-outline editor.
- HBF.CHO9 (new): Outline generation/improve flows SHALL detect truncation and SHALL retry/continue or block acceptance with a clear warning if output is incomplete.
- HBF.PR5 (new): Assembled manuscript output SHALL contain exactly one chapter heading per chapter section.
- HBF.UI1 (new): Top navigation order SHALL reflect author workflow: Goals -> Outline -> Chapter Outlines -> Drafting -> Safety -> Preview -> Prompts.
- HBF.UI2 (new): Header Export/Import icons SHALL align with action semantics and accessible labels.
- HBF.UI3 (new): Footer status copy SHALL be user-facing, include explicit role/mode semantics, and support configurable role labels for fielded author usage.
- HBF.POL1 (new): Style-reference author names in prompts SHALL not appear in generated chapter/outline prose unless explicitly requested by the user.

### Proposed Test Additions (Sprint Planning)

- HBFIT.25: Generate Remaining and single draft status numbering is accurate for chapters >10 and matches active chapter.
- HBFIT.26: Safety chapter-scoped scan label matches selected chapter; full-book flags include chapter number.
- HBFIT.27: Safety rendering path shows issue/suggestion text for canonical and alternate key names; malformed flags trigger warning.
- HBFIT.28: Outline improve/edit output normalization strips JSON/escaped markup and preserves readable structure.
- HBFIT.29: Outline truncation detection blocks acceptance or auto-recovers continuation path.
- HBFIT.30: Assembled manuscript contains one heading per chapter in preview/export outputs.
- HBFST.7 (smoke): Nav order check includes Prompts after Preview and validates footer status element semantics.
- HBFST.8 (smoke): Export/Import icon semantics and accessible labels present.

Planning outcome target:
- Sprint kickoff starts only after dedupe closure and requirement IDs are finalized in REQUIREMENTS.md.

## HerbalBookForge Sprint 4 Local Tracker (Preview Tab) — COMPLETE

- [x] #54 Requirements and acceptance criteria (HBF.PR1-HBF.PR4, HBFIT.18-HBFIT.21)
- [x] #55 Preview state model and localStorage v0.12.0 migration
- [x] #56 Preview tab UI shell with test ids and empty state
- [x] #57 Implement assembleManuscript from chapter drafts in outline order
- [x] #58 Implement rendered manuscript preview and refresh behavior
- [x] #59 Add Markdown export for assembled manuscript
- [x] #60 Add printable HTML export for print-to-PDF workflow
- [x] #61 Add RTF export for Word-friendly editing workflow
- [x] #62 Add smoke coverage for Preview tab controls
- [x] #63 Add integration tests HBFIT.18-HBFIT.21 for Preview flow
- [x] #64 Update TESTING and REQUIREMENTS for Preview v0.12.0
- [x] #65 Sprint 4 Preview closeout and PR packaging

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

- [x] Use `docs/governance/CURRENT_RELEASE_SSDL_STATUS.md` as the active backfilled SSDLC tracker for this release and close any open gap items before final tagging.

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

- [ ] Execute the dedicated next-release UI unification plan in `docs/roadmap/NEXT_MINOR_RELEASE_UI_UNIFICATION_TODO.md` after the current release is fully closed and pushed to GitHub.
- [ ] After UI unification closes, execute the post-UI novel quality capability plan in `docs/roadmap/NEXT_CAPABILITY_RELEASE_NOVEL_QUALITY_TODO.md`.
