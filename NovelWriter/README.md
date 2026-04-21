# Novel Writer

A comprehensive AI-assisted novel writing tool that guides you through the entire creative process from concept to completion.

## Features

- **Story Planning**: Define genre, author style, story arc, general plot, and setting
- **Character Development**: Create detailed characters with backstories and arcs
- **Subplot Management**: Generate and manage multiple story subplots
- **Outline Creation**: Build novel and chapter outlines with AI assistance
- **Chapter Generation**: Automatically generate chapters based on your outlines
- **Chapter Editing**: Refine and improve generated chapters
- **Book Assembly**: Combine all chapters into a complete novel
- **Style Guide**: Maintain consistent writing style throughout your work
- **Request Logging**: Track all AI interactions and API usage
- **Shared Schema Export**: Session exports include `schemaVersion`, `sourceTool`, and `sourceVersion` metadata for cross-tool compatibility
- **Hybrid Import Validation**: Supports strict shared-schema imports and best-effort migration for legacy NovelWriter session files
- **Agent Prompt Manager (Tab 11)**: Edit system prompts by tab/agent and import/export prompt profiles independently of session files
- **Counter Synchronization**: Character and subplot counters now stay aligned when adding entries, importing sessions, and running AI generation

## Usage

1. Open `NovelWriter.html` in your web browser
2. Enter your xAI API key in the first tab
3. Configure your story basics (genre, author style, etc.)
4. Work through each tab in order to build your novel
5. Use the Help button to access the detailed user guide

## Regression Workflow Guidance

Use the advanced workflow regression path for realistic smoke testing:

1. Set a unique title (for example, `Smoke Test Novel YYYY-MM-DD`)
2. Use non-default complexity values (`numChapters`, `numCharacters`, `minSubplots`)
3. Fetch authors and select a fetched author where available
4. Fetch style guide, run AI suggest on tab 1, then continue left-to-right
5. Exercise add-character/add-subplot, refine-with-subplots, outline incorporation, chapter edit improvements, and spelling/grammar
6. Apply mixed book improvement statuses before breakdown and consolidated breakdown checks
7. Exercise element values
8. Export/import session only near the end of the run

## UI Unification Conventions

- Uses shared shell token classes (`ui-shell`, `ui-nav`, `ui-tab-btn`, `ui-panel`) for cross-tool consistency.
- Preserves existing tab labels/IDs and `showTab` semantics for compatibility.
- Maintains stable selectors (`data-testid`) for smoke/regression automation.
- UI unification references:
	- `docs/architecture/ui-unification/UI_UNIFICATION_REQUIREMENT_INDEX.md`
	- `docs/architecture/ui-unification/UI_UNIFICATION_MIGRATION_NOTES.md`
	- `docs/architecture/ui-unification/UI_UNIFICATION_VISUAL_CONSISTENCY_CHECKLIST.md`

## Requirements

- Modern web browser with JavaScript enabled
- xAI API key for AI functionality
- Text editor for any manual file operations

## File Structure

- `NovelWriter.html` - Main application interface
- `user_guide.html` - Comprehensive usage instructions and tips

## Version

Current version: 0.3.4
