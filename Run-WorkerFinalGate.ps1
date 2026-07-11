# EVAVO Worker final local gate runner
# Run from PowerShell in C:\GitRepos\evavo-worker-agent after git pull.
# This script intentionally does not run migrations. Migrations 0021 and 0022 should not be rerun after they have applied successfully.

$ErrorActionPreference = "Stop"

Write-Host "EVAVO Worker final local gate" -ForegroundColor Cyan
Write-Host "This runs final local checks, confirms generated route files are clean, prints D1 verification commands, and stops before deploy." -ForegroundColor Gray
Write-Host "It does not rerun migrations." -ForegroundColor Gray
Write-Host ""

if (-not (Test-Path "package.json")) {
  throw "package.json not found. Run this from C:\GitRepos\evavo-worker-agent."
}

Write-Host "Repository state" -ForegroundColor Cyan
git status --short
git branch --show-current
git log -1 --oneline
Write-Host ""

Write-Host "Sync latest code" -ForegroundColor Cyan
git pull
Write-Host ""

Write-Host "Final local checks" -ForegroundColor Cyan
npm run scripts:check
npm run db:migrations:check
npm run business:autopilot:check
npm run business:autopilot:raw-error-safety:check
npm run business:people:docs:check
npm run business:website-pages:docs:check
npm run growth:backend:aggregate:check
npm run check:local
npm run growth:backend:check:local
Write-Host ""

Write-Host "Confirm generated route wiring files are clean" -ForegroundColor Cyan
npm run growth:generated-routes:check
Write-Host ""

Write-Host "Print D1 verification commands" -ForegroundColor Cyan
npm run db:verify:print
Write-Host ""

Write-Host "Final gate passed. Review any D1 verification commands above, then deploy the Cloudflare Worker through the guarded npm wrapper:" -ForegroundColor Green
Write-Host "npm run deploy" -ForegroundColor Cyan
Write-Host "That command runs npm predeploy first, then executes the real Worker command: wrangler deploy." -ForegroundColor Gray
Write-Host "Direct wrangler deploy also deploys the Worker, but bypasses npm predeploy safety checks, so only use it intentionally." -ForegroundColor Yellow