# BookEditor Requirements

Date: 2026-04-19
Application: BookEditor
Source File: BookEditor.html

## Executive Summary

BookEditor provides a human-in-the-loop editing pipeline for importing book content, generating and curating improvements, and exporting edited outputs while preserving legacy tab behavior and selectors.

## Functional Requirements

- UIU.BE.F1: The application shall provide six stable tabs with unchanged visible labels and IDs.
- UIU.BE.F2: The Project Setup tab shall support API/model/token controls plus session import/export.
- UIU.BE.F3: The Book Input tab shall support text and URL ingestion and trigger improvement suggestion flow.
- UIU.BE.F4: The Chat Bot tab shall support interactive question/answer on the active book context.
- UIU.BE.F5: The Improvements workflow shall support add/edit/delete/select and feed edited output generation.

## Nonfunctional Requirements

- UIU.BE.NF1: The shell shall use shared UI tokens and standardized shell/nav/panel classes.
- UIU.BE.NF2: The layout shall remain responsive at smaller viewports (including <=900px rules).
- UIU.BE.NF3: Request logging shall preserve traceability without exposing secrets in source.
- UIU.BE.NF4: Data-testid attributes and key selectors shall remain stable for smoke coverage.

## Inline Sync Mapping

- Executive summary and top sync block: top comments in BookEditor.html.
- Tab-level functional comments: UIU.BE.F1-F5 above nav/tab sections.
- Nonfunctional comments: UIU.BE.NF1-NF4 in top/request-log sections.

## Sync Status

- Synced with BookEditor.html inline annotations: Yes
- Last sync date: 2026-04-19
