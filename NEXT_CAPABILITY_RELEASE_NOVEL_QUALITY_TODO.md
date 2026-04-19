# Post-UI Capability Release Todo: Novel Quality and Narrative Intelligence

## Release Positioning

This release is planned after the UI unification release in NEXT_MINOR_RELEASE_UI_UNIFICATION_TODO.md is completed and closed.

Primary goal:

- Improve the quality of generated novels (coherence, voice consistency, pacing, continuity, and readability).

Out of scope for this release:

- Major visual redesign or CSS system changes (already scoped to prior release)
- New cross-tool schema breaking changes

## Outcomes and Success Criteria

- [ ] Generated drafts show reduced repetition and stronger chapter-to-chapter progression.
- [ ] Character voice and arc consistency improve across full-book generation.
- [ ] Continuity contradictions are detected and resolved earlier in the workflow.
- [ ] Users can run structured quality checks before final book export.
- [ ] Smoke and regression automation remains stable after feature additions.

## Capability Workstreams

### 1) Novel Blueprint and Intent Layer

- [ ] Add a structured Novel Intent object (theme, emotional promise, pacing target, style target, audience assumptions).
- [ ] Add chapter-level intent fields (goal, conflict, turn, consequence, carry-forward hooks).
- [ ] Require chapter generation to reference the chapter intent before writing prose.

### 2) Character and Voice Consistency Engine

- [ ] Add character voice cards (lexicon, cadence, taboo phrases, emotional baseline).
- [ ] Add character memory packets by chapter (state, motivation shifts, unresolved tensions).
- [ ] Enforce voice-card checks during chapter drafting and chapter editing passes.

### 3) Anti-Repetition and Language Variety Controls

- [ ] Add repeated phrase detection across chapter and book scope.
- [ ] Add overused motif detection for imagery and sentence templates.
- [ ] Add rewrite pass options: preserve meaning while varying diction, rhythm, and imagery.
- [ ] Add user-facing repetition severity report before export.

### 4) Continuity and Logic Audit Pass

- [ ] Add continuity scan for timeline, geography, causality, and relationship state.
- [ ] Flag contradiction candidates with chapter references and confidence score.
- [ ] Provide targeted rewrite suggestions tied to specific contradictions.
- [ ] Track open continuity findings until resolved or explicitly accepted.

### 5) Pacing and Arc Health Diagnostics

- [ ] Add chapter pacing indicators (slow, balanced, rushed) based on scene transitions and stakes movement.
- [ ] Add arc momentum tracking for plot and subplots by chapter.
- [ ] Add dead-zone detection for threads that disappear too long without payoff.
- [ ] Add chapter-level summary heatmap for arc progress.

### 6) Multi-Pass Draft Pipeline

- [ ] Introduce explicit generation pipeline stages:
  - draft
  - structural revise
  - voice/line revise
  - continuity finalize
- [ ] Persist stage outputs so users can compare revisions.
- [ ] Allow selective re-run of a single stage at chapter or full-book scope.

### 7) Quality Gate Before Export

- [ ] Add a pre-export quality checklist with pass/fail status.
- [ ] Require user acknowledgment for unresolved high-severity findings.
- [ ] Include quality summary in session export metadata.

## UX Additions (Minimal Surface, High Utility)

- [ ] Add a dedicated Quality tab with:
  - quality findings table
  - continuity findings table
  - repetition report
  - pacing and arc summary
- [ ] Add Explain Why for each finding to show evidence from source chapters.
- [ ] Add one-click jump links from findings to chapter editor sections.

## Testing and Validation

- [ ] Add deterministic fixture prompts for quality regression tests.
- [ ] Extend smoke-full with one quality-gate verification checkpoint.
- [ ] Add regression assertions for:
  - continuity findings generation
  - repetition detection output
  - quality summary export integrity
- [ ] Validate no regression in export/import and existing tab workflows.

## Metrics and Evidence

- [ ] Define objective quality metrics tracked per run:
  - repeated phrase density
  - unresolved continuity findings count
  - arc gap count
  - chapters requiring heavy rewrite
- [ ] Capture before/after comparisons against baseline runs from current release.
- [ ] Record evidence links in release notes and closeout docs.

## Rollout and Risk Controls

- [ ] Ship with feature flags for high-risk quality passes.
- [ ] Default to conservative thresholds to avoid over-editing voice.
- [ ] Add fallback mode that bypasses advanced passes if model responses degrade.
- [ ] Monitor API cost/runtime impact of multi-pass pipeline and tune limits.

## Release Closeout

- [ ] Run full required test suites and store artifacts.
- [ ] Confirm quality-gate outputs are stable across repeated runs.
- [ ] Update changelog and docs with quality feature usage guidance.
- [ ] Tag release from exact validated commit per release provenance policy.
