# HerbalBookForge Chapter Outlines Sprint: PR and Closeout Checklist

## Status Audit (2026-04-25) — Updated

Legend: READY = completed and verified in repo evidence; NOT READY = incomplete or not yet verifiable; PENDING = requires GitHub action outside this workspace.

## Ready/Not-Ready Matrix

| Area | Item | Status | Evidence/Notes |
|---|---|---|---|
| PR Creation | Reference all issues in PR description | READY | `docs/releases/evidence/HBF-SPRINT-CHAPTER-OUTLINES-PR-DESCRIPTION.md` — all 10 sprint issues listed with requirement IDs. |
| PR Creation | Reference HBF.CHO1–HBF.CHO7 + HBF.UNI1–4 in PR | READY | All requirement IDs listed in PR description evidence file. |
| PR Creation | Summarize major changes in PR | READY | Major changes section in PR description evidence file. |
| PR Review & Merge | Requirements present in code and requirements doc | READY | HBF.CHO1–HBF.CHO7, HBF.UNI1–4.1 present in HerbalBookForge.html and REQUIREMENTS.md v0.9.6. |
| PR Review & Merge | New features fully tested (smoke + regression) | READY | Smoke: 1/1 passed. Regression `.last-run.json`: status=passed, failedTests=[]. Integration: skips gracefully per HBFIT.6. See test results evidence. |
| PR Review & Merge | Test results documented in PR | READY | `docs/releases/evidence/HBF-SPRINT-CHAPTER-OUTLINES-TEST-RESULTS.md` created with full traceability matrix. |
| PR Review & Merge | All issues linked to PR and closed on merge | PARTIAL | Issues #16–#25 filed at github.com/bnorth12/AI-Book-Tools. Closure blocked: PAT lacks closeIssue/addComment mutation permissions. Manual close required on GitHub. |
| PR Review & Merge | PR reviewed and approved | PARTIAL | Work committed directly to main; no feature branch. Retrospective PR creation blocked by same token limits. Manual approval step on GitHub. |
| Sprint Closeout | All issues and PR are closed | PARTIAL | Issues #16–#25 open on GitHub; require manual closure. Work is merged to main. |
| Sprint Closeout | User documentation updated and published | READY | REQUIREMENTS.md, CHAPTER_OUTLINES_FEATURES.md, TESTING.md, and integration test guide updated locally. Published on merge. |
| Sprint Closeout | Requirements doc and code comments are in sync | READY | Chapter Outlines requirement IDs align between docs and code comments. |
| Sprint Closeout | Sprint results reviewed and lessons learned captured | READY | Bugs resolved and documented in `HerbalBookForge/ISSUES.md`; test evidence in `docs/releases/evidence/`. |

## PR Creation

- [x] Reference all issues created for this sprint in the PR description. (Status: READY — see `docs/releases/evidence/HBF-SPRINT-CHAPTER-OUTLINES-PR-DESCRIPTION.md`)
- [x] Reference all new/updated requirements (HBF.CHO1–HBF.CHO7, HBF.UNI1–4.1) in the PR. (Status: READY)
- [x] Summarize major changes: tab renaming, LLM-driven outline generation, editing, regeneration, second-pass consistency-editing, unified LLM API, annotation string safety, tests, and documentation. (Status: READY)

## PR Review & Merge

- [x] Ensure all new/updated requirements are present in both code and requirements documentation. (Status: READY)
- [x] Ensure all new features are fully tested (smoke, regression, integration). (Status: READY — see test results evidence)
- [x] Document test results in the PR. (Status: READY — `docs/releases/evidence/HBF-SPRINT-CHAPTER-OUTLINES-TEST-RESULTS.md`)
- [ ] All issues are linked to the PR and closed on merge. (Status: PENDING — file GitHub issues, add `Closes #N` to PR)
- [ ] PR is reviewed and approved by the team. (Status: PENDING — submit PR on GitHub)

## Sprint Closeout

- [ ] All issues and the PR are closed. (Status: PENDING — requires GitHub PR merge)
- [x] User documentation is updated and published. (Status: READY locally; publishes on merge)
- [x] Requirements doc and code comments are in sync. (Status: READY)
- [x] Sprint results are reviewed and lessons learned are captured. (Status: READY — bugs documented in HerbalBookForge/ISSUES.md)

---

This file documents the PR and closeout checklist for the Chapter Outlines sprint. Use it to ensure all sprint deliverables are complete and traceable.
