# BookDecomposer Requirements

Date: 2026-04-19
Application: BookDecomposer
Source File: BookDecomposer.html

## Executive Summary

BookDecomposer provides a structured decomposition workflow that transforms source book text into chapter previews, extracted element tables, and JSON outputs while preserving existing tab/showTab behavior.

## Functional Requirements

- UIU.BD.F1: The application shall provide four stable decomposition workflow tabs with unchanged labels.
- UIU.BD.F2: The Input tab shall capture title, file upload, API key, and model details before processing.
- UIU.BD.F3: The Chapters Preview tab shall render parsed chapter data in table form.
- UIU.BD.F4: The Extracted Elements tab shall render extracted field/value data in table form.
- UIU.BD.F5: The Output JSON tab shall support export and import operations.

## Nonfunctional Requirements

- UIU.BD.NF1: The shell shall use shared token-based visual styling.
- UIU.BD.NF2: The .tab and .tabcontent class contracts shall remain stable for smoke selectors and JS compatibility.
- UIU.BD.NF3: Output rendering shall remain readable with scroll-safe JSON presentation.
- UIU.BD.NF4: Data-testid hooks shall remain stable for selector hardening.

## Inline Sync Mapping

- Executive summary and top sync block: top comments in BookDecomposer.html.
- Tab-level functional comments: UIU.BD.F1-F5 near nav/tab containers.
- Nonfunctional comments: UIU.BD.NF1-NF4 in top and output sections.

## Sync Status

- Synced with BookDecomposer.html inline annotations: Yes
- Last sync date: 2026-04-19
