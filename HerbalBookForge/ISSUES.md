# HerbalBookForge Issue: Only One Chapter Outline Generated

## Problem
When accepting an outline, only a single chapter outline is generated, even if the outline contains multiple chapters.

## Root Cause
- The regex in `parseChaptersFromOutline` was not robust enough to match all chapter heading styles (e.g., colons, dashes, en/em dashes, or nothing).
- If the regex failed, the fallback was to return only one chapter.

## Solution
- The regex was updated to match all common heading styles.

---

# HerbalBookForge Issue: Outline Q&A Chat Throws `useFullOutline is not defined`

## Problem
When using the Outline Q&A chat, a ReferenceError is thrown: `useFullOutline is not defined`.

## Root Cause
- The variable `useFullOutline` was referenced but never defined in `sendSpecificOutlineQuestion`.

## Solution
- The code was updated to define `useFullOutline` by reading the checkbox state.

---

# HerbalBookForge Issue: 422 Error on Outline Q&A Chat

## Problem
Outline Q&A chat requests to the LLM API returned a 422 error.

## Root Cause
- The payload included a `tools` array, which the API did not accept for this type of request.

## Solution
- The code was updated to remove the `tools` array from all Outline Q&A payloads.

---

# HerbalBookForge Issue: Tab Switching Broken After Edit

## Problem
After removing `tools` from the payload, a JavaScript syntax error broke tab switching and global functions.

## Root Cause
- A syntax error was introduced in the `sendSpecificOutlineQuestion` function.

## Solution
- The syntax error was fixed and global functions restored.

---

# HerbalBookForge Issue: Playwright Tests Out of Sync with Unified LLM API

## Problem
Playwright tests for HerbalBookForge are not aligned with the new unified LLM API/state architecture.

## Solution
- Playwright tests need to be updated to match the new payload structure and logic.

---

# HerbalBookForge Issue: Defensive Coding for LLM Payloads

## Problem
LLM payloads were not always validated or logged, making debugging difficult.

## Solution
- Defensive checks and debug logging were added to all LLM API calls.

---

# HerbalBookForge Issue: Outline Q&A Sends Too Much Context

## Problem
Sending the full outline in Outline Q&A chat can cause API errors due to context size.

## Solution
- A toggle was added to allow sending either the full outline or a minimized context.

---

# HerbalBookForge Issue: Tools Array in Payload Causes API Errors

## Problem
Including a `tools` array in the payload for Outline Q&A chat caused 422 errors.

## Solution
- The `tools` array is now removed from all Outline Q&A payloads.

---

# HerbalBookForge Issue: Duplicate Imports and Helper Placement in Playwright Tests

## Problem
Playwright test files had duplicate imports and helper functions defined after use.

## Solution
- Imports and helpers were reorganized and deduplicated.

---

# HerbalBookForge Issue: Book Goals Chat 422 Error

## Problem
Book Goals chat requests returned a 422 error due to payload structure.

## Solution
- The payload was updated to match API requirements, and debug logging was added.

---

# HerbalBookForge Issue: Defensive Checks for User Message Content

## Problem
Control strings like 'specificQA' were included in user message content, causing API errors.

## Solution
- The code was updated to ensure only the intended user message is sent.

---

# HerbalBookForge Issue: Outline Q&A Toggle for Full Outline

## Problem
There was no way to control whether the full outline or a minimized context was sent in Outline Q&A chat.

## Solution
- A toggle was added to the UI to allow users to choose.

---

# HerbalBookForge Issue: Minimized Outline Context for Q&A

## Problem
Outline Q&A chat sometimes sent too much context, causing errors or poor responses.

## Solution
- The code was updated to extract only the relevant chapter or table of contents for minimized context.

---

# HerbalBookForge Issue: Defensive Checks for Outline Extraction

## Problem
Outline extraction logic was not robust to all LLM output formats.

## Solution
- Defensive checks and improved regex were added.

---

# HerbalBookForge Issue: Debug Logging for LLM API Calls

## Problem
Lack of debug logging made it hard to diagnose API errors.

## Solution
- Debug logging was added to all LLM API calls.

---

# HerbalBookForge Issue: Playwright Test Failures Due to Mock Logic

## Problem
Playwright tests failed due to outdated or incorrect mock logic.

## Solution
- Mocks were updated to match the new app logic and payloads.

---

# HerbalBookForge Issue: Defensive Checks for Project State

## Problem
Project state was not always validated before use, leading to errors.

## Solution
- Defensive checks were added throughout the codebase.

---

# HerbalBookForge Issue: UI/UX Consistency for Outline Q&A

## Problem
Outline Q&A UI was not consistent with requirements or user expectations.

## Solution
- UI was updated for clarity and consistency.

---

# HerbalBookForge Issue: Requirements Documentation Not Updated

## Problem
REQUIREMENTS.md was not updated to reflect the new unified LLM API/state architecture.

## Solution
- REQUIREMENTS.md was updated.

---

# HerbalBookForge Issue: Global Functions Broken by Syntax Error

## Problem
A syntax error in the code broke global functions and tab switching.

## Solution
- The syntax error was fixed and global functions restored.

---

# HerbalBookForge Issue: Defensive Checks for Outline Q&A Context

## Problem
Outline Q&A context extraction was not robust to all LLM output formats.

## Solution
- Defensive checks and improved regex were added.

---

# HerbalBookForge Issue: Playwright Test Automation

## Problem
Playwright test automation was not fully aligned with the new app logic.

## Solution
- Test automation scripts and tasks were updated.

---

# HerbalBookForge Issue: Debug Logging for Payload Inspection

## Problem
Lack of debug logging made it hard to inspect payloads during troubleshooting.

## Solution
- Debug logging was added to all LLM API calls.

---

# HerbalBookForge Issue: Control Strings in User Message Content

## Problem
Control strings like 'specificQA' were included in user message content, causing API errors.

## Solution
- The code was updated to ensure only the intended user message is sent.

---

# HerbalBookForge Issue: Defensive Checks for Outline Q&A

## Problem
Outline Q&A logic was not robust to all LLM output formats and user questions.

## Solution
- Defensive checks and improved context extraction were added.

---

# HerbalBookForge Issue: UI/UX Consistency for Outline Q&A Toggle

## Problem
The UI for the Outline Q&A toggle was not consistent or clear.

## Solution
- The UI was updated for clarity and consistency.

---

# HerbalBookForge Issue: Requirements Traceability

## Problem
Requirements traceability was not maintained for new features and bug fixes.

## Solution
- REQUIREMENTS.md and related documentation were updated.

---

# HerbalBookForge Issue: Defensive Checks for Project State in Playwright Tests

## Problem
Playwright tests did not always validate project state before use.

## Solution
- Defensive checks were added to Playwright test logic.

---

# HerbalBookForge Issue: Debug Logging for Playwright Test Automation

## Problem
Lack of debug logging made it hard to diagnose Playwright test failures.

## Solution
- Debug logging was added to Playwright test automation scripts.

---

# HerbalBookForge Issue: UI/UX Consistency for Tab Switching

## Problem
Tab switching UI was not consistent after recent code changes.

## Solution
- The UI was updated for consistency and robustness.

---

# HerbalBookForge Issue: Defensive Checks for Outline Q&A Toggle State

## Problem
The state of the Outline Q&A toggle was not always validated before use.

## Solution
- Defensive checks were added to ensure the toggle state is always read before use.

---

# HerbalBookForge Issue: Playwright Test Automation for Unified LLM API

## Problem
Playwright test automation was not fully aligned with the new unified LLM API/state architecture.

## Solution
- Test automation scripts and tasks were updated.

---

# HerbalBookForge Issue: Debug Logging for Outline Q&A

## Problem
Lack of debug logging made it hard to diagnose Outline Q&A issues.

## Solution
- Debug logging was added to Outline Q&A logic.

---

# HerbalBookForge Issue: Defensive Checks for Outline Q&A Context Extraction

## Problem
Outline Q&A context extraction was not robust to all LLM output formats.

## Solution
- Defensive checks and improved regex were added.

---

# HerbalBookForge Issue: UI/UX Consistency for Outline Q&A Chat

## Problem
Outline Q&A chat UI was not consistent with requirements or user expectations.

## Solution
- UI was updated for clarity and consistency.

---
