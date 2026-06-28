const commands = String.raw`
# EVAVO Worker main-branch audit
# Run from PowerShell.

cd C:\GitRepos\evavo-worker-agent

git fetch --all --prune

Write-Host "Current branch:" -ForegroundColor Cyan
git branch --show-current

Write-Host "Default remote HEAD:" -ForegroundColor Cyan
git symbolic-ref refs/remotes/origin/HEAD

Write-Host "Working tree status:" -ForegroundColor Cyan
git status --short --branch

Write-Host "Latest main commits:" -ForegroundColor Cyan
git log origin/main --oneline -10

Write-Host "Local branches not merged into main:" -ForegroundColor Cyan
git branch --no-merged main

Write-Host "Remote branches not merged into origin/main:" -ForegroundColor Cyan
git branch -r --no-merged origin/main

Write-Host "Branches containing HEAD:" -ForegroundColor Cyan
git branch -a --contains HEAD
`;

console.log(commands.trim());
