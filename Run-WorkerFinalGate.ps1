# EVAVO Worker final local gate runner
# Run from PowerShell in C:\GitRepos\evavo-worker-agent after git pull.
# This script intentionally does not run migrations. Migrations 0021 and 0022 should not be rerun after they have applied successfully.

$ErrorActionPreference = "Stop"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
  )

  & $Command @Arguments
  $exitCode = $LASTEXITCODE
  if ($null -ne $exitCode -and $exitCode -ne 0) {
    throw "Command failed with exit code ${exitCode}: $Command $($Arguments -join ' ')"
  }
}

Write-Host "EVAVO Worker final local gate" -ForegroundColor Cyan
Write-Host "This runs final local checks, confirms generated route files are clean, prints D1 verification commands, and stops before deploy." -ForegroundColor Gray
Write-Host "It does not rerun migrations." -ForegroundColor Gray
Write-Host ""

if (-not (Test-Path "package.json")) {
  throw "package.json not found. Run this from C:\GitRepos\evavo-worker-agent."
}

Write-Host "Repository state" -ForegroundColor Cyan
Invoke-Checked git status --short
Invoke-Checked git branch --show-current
Invoke-Checked git log -1 --oneline
Write-Host ""

Write-Host "Sync latest code" -ForegroundColor Cyan
Invoke-Checked git pull
Write-Host ""

Write-Host "Final local checks" -ForegroundColor Cyan
Invoke-Checked npm run scripts:check
Invoke-Checked npm run db:migrations:check
Invoke-Checked npm run business:autopilot:check
Invoke-Checked npm run business:autopilot:raw-error-safety:check
Invoke-Checked npm run business:people:docs:check
Invoke-Checked npm run business:website-pages:docs:check
Invoke-Checked npm run growth:backend:aggregate:check
Invoke-Checked npm run check:local
Invoke-Checked npm run growth:backend:check:local
Write-Host ""

Write-Host "Confirm generated route wiring files are clean" -ForegroundColor Cyan
Invoke-Checked npm run growth:generated-routes:check
Write-Host ""

Write-Host "Print D1 verification commands" -ForegroundColor Cyan
Invoke-Checked npm run db:verify:print
Write-Host ""

Write-Host "Final gate passed. Review any D1 verification commands above, then deploy the Cloudflare Worker through the guarded npm wrapper:" -ForegroundColor Green
Write-Host "npm run deploy" -ForegroundColor Cyan
Write-Host "That command runs npm predeploy first, then executes the real Worker command: wrangler deploy." -ForegroundColor Gray
Write-Host "Direct wrangler deploy also deploys the Worker, but bypasses npm predeploy safety checks, so only use it intentionally." -ForegroundColor Yellow
