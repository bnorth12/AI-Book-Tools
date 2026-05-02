$branch = "feature/herbalbookforge-sprint-2-drafting"
$prTitle = "Sprint 2: Drafting tab generation, revision, validation, and closeout"
$prBodyPath = ".github/pr-sprint-2-shell.md"

git checkout main
git pull
git checkout -b $branch
git push -u origin $branch

$prBody = @'
## Summary
Sprint 2 implementation shell for HerbalBookForge Drafting tab work.

## Scope
- Draft generation from chapter outline + book goals
- Draft revise loop with user instruction input
- Draft validation workflow and persistence
- Tests and documentation updates
- Sprint closeout evidence

## Requirements Traceability
- HBF.DR1, HBF.DR2
- HBF.DR3, HBF.DR4, HBF.DR5, HBF.DR6, HBF.DR7, HBF.DR8
- HBFIT.9, HBFIT.10, HBFIT.11, HBFIT.12, HBFIT.13
- HBF.UNI1, HBF.UNI4, HBF.UNI4.1

## Sprint 2 Issues
- Closes #ISSUE_01
- Closes #ISSUE_02
- Closes #ISSUE_03
- Closes #ISSUE_04
- Closes #ISSUE_05
- Closes #ISSUE_06
- Closes #ISSUE_07
- Closes #ISSUE_08
- Closes #ISSUE_09
- Closes #ISSUE_10
- Closes #ISSUE_11
- Closes #ISSUE_12

## Test Plan
- Smoke: herbalbookforge-smoke
- Integration: herbalbookforge-integration
- Regression updates where selectors/flows changed

## Evidence
- docs/releases/evidence/HBF-SPRINT-2-PR-DESCRIPTION.md
- docs/releases/evidence/HBF-SPRINT-2-TEST-RESULTS.md

## Risks and Rollback
- Risk:
- Mitigation:
- Rollback:
'@

$dir = Split-Path $prBodyPath -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
Set-Content -Path $prBodyPath -Value $prBody -NoNewline

gh pr create --repo bnorth12/AI-Book-Tools --base main --head $branch --title $prTitle --body-file $prBodyPath --draft

Write-Host "Done. Branch created and draft PR opened. Replace ISSUE_01..ISSUE_12 in $prBodyPath, then run:"
Write-Host "gh pr edit --repo bnorth12/AI-Book-Tools --body-file $prBodyPath"
