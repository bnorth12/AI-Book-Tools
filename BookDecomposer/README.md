# Book Decomposer

An AI-powered tool that analyzes existing books and breaks them down into structured components for study, analysis, or reuse.

## Features

- **Book Input**: Upload text files of complete books or manuscripts
- **Chapter Detection**: Automatically identify and extract individual chapters
- **Element Extraction**: Use AI to analyze and extract key story elements:
  - Genre classification
  - Story arc and plot summary
  - Character profiles and development arcs
  - Setting descriptions
  - Subplot identification
  - Chapter outlines and arcs
  - Author style analysis
- **JSON Output**: Export structured analysis data for further processing
- **Preview System**: Review extracted chapters and elements before final output

## Usage

1. Open `BookDecomposer.html` in your web browser
2. Enter your book title and xAI API key
3. Upload your book text file (.txt format)
4. Click "Process Book" to begin AI analysis
5. Review extracted chapters and elements in the preview tabs
6. Export the complete analysis as JSON

## Requirements

- Modern web browser with JavaScript enabled
- xAI API key for AI analysis
- Book content in plain text format (.txt files)
- Books should have clear chapter markers (e.g., "Chapter 1", "1. Title", etc.)

## File Structure

- `BookDecomposer.html` - Main analysis interface
- `BookDecomposer.js` - Core processing logic and AI integration

## Output Format

The tool generates a comprehensive JSON structure containing:
- Book metadata (title, chapter count, length estimates)
- Complete chapter breakdowns
- Character profiles with backstories and arcs
- Plot summaries and story arcs
- Setting descriptions
- Subplot analysis
- Chapter-by-chapter outlines
- Author style recommendations

This tool will align its JSON export with the shared schema in `schema/novel-schema-1.0.json` to support compatibility with `BookEditor` and `NovelWriter`.

## Version

Current version: 0.X.0