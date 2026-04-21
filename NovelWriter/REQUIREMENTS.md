# NovelWriter Requirements

Date: 2026-04-19
Application: NovelWriter
Source File: NovelWriter.html

## Executive Summary

NovelWriter provides a browser-based end-to-end novel authoring workflow with tab-based planning, generation, editing, and export while preserving user control over all final content decisions.

## Functional Requirements

- UIU.NW.F1: The application shall provide 11 primary workflow tabs plus Help with stable labels and showTab behavior.
- UIU.NW.F2: The application shall support schema-versioned session import/export compatible with novel-schema-1.0.
- UIU.NW.F3: The application shall route AI requests through the central callAI gateway for consistent execution state handling.
- UIU.NW.F4: The application shall maintain chapter generation/edit workflows without changing established tab semantics.
- UIU.NW.F5: The application shall expose request history and prompt management surfaces for traceability.

## Nonfunctional Requirements

- UIU.NW.NF1: The shell shall use shared UI token styling from shared/ui-unification-tokens.css.
- UIU.NW.NF2: The UI shall provide viewport-responsiveness and readable layout at mobile and desktop widths.
- UIU.NW.NF3: Selectors and IDs required by smoke/regression suites shall remain stable.
- UIU.NW.NF4: Keyboard users shall retain visible focus cues on key interactive controls.

## Inline Sync Mapping

- Executive summary and UIU sync block: top comments in NovelWriter.html.
- Functional mapping in nav/tab comments: UIU.NW.F1-F5.
- Nonfunctional mapping in sync comments and shared token adoption: UIU.NW.NF1-NF4.

## Sync Status

- Synced with NovelWriter.html inline annotations: Yes
- Last sync date: 2026-04-19
