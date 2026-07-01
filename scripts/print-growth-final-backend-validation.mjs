const commands = String.raw`
# EVAVO Growth backend final validation
# Run from PowerShell after migrations 0014 through 0019 are applied.
# This prints read-only contract checks plus optional metadata-only smoke flows, including the internal review queue persistence check.
# It does not send, post, submit, browse, call AI, or execute external actions.

cd C:\GitRepos\evavo-worker-agent

git pull
npm run growth:wiring:apply
npm run growth:route-catalogue:apply
npm run growth:review-queue:check
npm run check:local

if (-not $env:WORKER_URL) { $env:WORKER_URL = "https://evavo-outbound-agent.evavo-studio.workers.dev" }
if (-not $env:ADMIN_TOKEN) { throw "Set ADMIN_TOKEN first." }

Write-Host "Deploy current Worker" -ForegroundColor Cyan
npm run deploy

Write-Host "Print route contract smoke" -ForegroundColor Cyan
npm run growth:route-contract:print

Write-Host "Print campaign intelligence smoke" -ForegroundColor Cyan
npm run growth:campaigns:smoke:print

Write-Host "Print strategy memory smoke" -ForegroundColor Cyan
npm run growth:strategy:smoke:print

Write-Host "Print blackboard smoke" -ForegroundColor Cyan
npm run growth:blackboard:smoke:print

Write-Host "Final backend validation command print complete." -ForegroundColor Green
Write-Host "Copy and run the printed smoke command blocks above in this same PowerShell session." -ForegroundColor Yellow
`;

console.log(commands.trim());
