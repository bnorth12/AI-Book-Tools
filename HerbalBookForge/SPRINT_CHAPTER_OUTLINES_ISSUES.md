# HerbalBookForge Chapter Outlines Sprint: Issue Breakdown

## Issues to Create

1. **Refactor Tab and Navigation**
   - Rename "Chapters" tab to "Chapter Outlines" in UI and code.
   - Update navigation and selectors accordingly.

2. **Implement Annotated Outline Cards/Sub-Tabs**
   - Display one annotated card or sub-tab per chapter.
   - Ensure UI structure matches requirements and is documented.

3. **Integrate LLM/Agent for Outline Generation**
   - Use Chapter Annotator Agent to generate each chapter outline from the book outline.
   - Show progress/status for generation.

4. **Enable Inline Editing and Save**
   - Allow user to edit each chapter outline inline.
   - Add explicit save for each chapter outline.

5. **Support Per-Chapter Regeneration**
   - Allow user to regenerate any chapter outline via the agent.

6. **Implement Second-Pass Consistency-Editing**
   - When the last chapter outline is created, resubmit all outlines to the agent for a consistency-editing pass.
   - Harmonize style, structure, and cross-references.

7. **Update Requirements in Code and Docs**
   - Ensure all new/updated requirements are present in both code comments and requirements documentation.

8. **Write/Expand Tests**
   - Add/expand unit, integration, and UI tests for new features.
   - Ensure regression coverage for all tabs.

9. **Update User Documentation**
   - Update user guide and help content to reflect new/changed features.

10. **Sprint PR and Closeout**
    - Create a PR referencing all issues and requirements.
    - Link issues to PR.
    - On completion, ensure all tests pass, document results, and close issues/PR.

---

This file documents the issue breakdown for the Chapter Outlines sprint. Each issue should reference the relevant requirement IDs (HBF.CHO1–HBF.CHO6) and be linked to the sprint PR.
