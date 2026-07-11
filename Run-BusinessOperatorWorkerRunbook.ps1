# EVAVO Business Operator Worker runbook runner
# Run from PowerShell in C:\GitRepos\evavo-worker-agent after git pull.

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

Write-Host "EVAVO Business Operator Worker runbook" -ForegroundColor Cyan
Write-Host "Role: business analyst / sales strategist / BDM / growth manager / operator brain" -ForegroundColor Gray
Write-Host "Safe automation: internal automation can reason, score, prioritise, draft and learn; external execution remains confirm-gated and disabled by default." -ForegroundColor Gray
Write-Host ""

if (-not (Test-Path "package.json")) {
  throw "package.json not found. Run this from C:\GitRepos\evavo-worker-agent."
}

Write-Host "Repository state" -ForegroundColor Cyan
Invoke-Checked git status --short
Invoke-Checked git branch --show-current
Invoke-Checked git log -1 --oneline
Write-Host ""

Write-Host "Available Business/Growth npm scripts" -ForegroundColor Cyan
$scriptList = (& npm run)
if ($LASTEXITCODE -ne 0) { throw "Command failed with exit code ${LASTEXITCODE}: npm run" }
$scriptList | Select-String "business:|growth:backend|growth:route|scripts:check|check:local|db:migration|db:migrations|db:verify|worker:" | ForEach-Object { $_.Line }
Write-Host ""

Write-Host "Migration checks" -ForegroundColor Cyan
Invoke-Checked npm run db:migrations:check
Invoke-Checked npm run db:migrations:print
Write-Host ""

Write-Host "Apply latest Business Autopilot migrations if needed" -ForegroundColor Cyan
Write-Host "If either migration reports already applied or duplicate columns/tables, stop and inspect before retrying." -ForegroundColor Yellow
Invoke-Checked npm run db:migration:one -- 0021 --execute
Invoke-Checked npm run db:migration:one -- 0022 --execute
Write-Host ""

Write-Host "Print post-migration D1 verification commands" -ForegroundColor Cyan
Write-Host "Copy and run the Business table checks if you need to confirm remote D1 schema state." -ForegroundColor Yellow
Invoke-Checked npm run db:verify:print
Write-Host ""

Write-Host "Refresh Worker route wiring and route catalogue" -ForegroundColor Cyan
Invoke-Checked npm run growth:wiring:apply
Invoke-Checked npm run growth:route-catalogue:apply
Write-Host ""

Write-Host "Run guarded local checks" -ForegroundColor Cyan
Invoke-Checked npm run scripts:check
Invoke-Checked npm run check:local
Invoke-Checked npm run growth:backend:check:local
Write-Host ""

Write-Host "Print verification commands with npm aliases if available" -ForegroundColor Cyan
$scriptNames = (node -e "const p=require('./package.json'); console.log(Object.keys(p.scripts||{}).join('\n'))")
if ($LASTEXITCODE -ne 0) { throw "Command failed with exit code ${LASTEXITCODE}: node package script list" }

if ($scriptNames -match "business:operator:runbook:print") { Invoke-Checked npm run business:operator:runbook:print }
else { Invoke-Checked node scripts/print-business-operator-worker-runbook.mjs }

if ($scriptNames -match "business:autopilot:readonly:print") { Invoke-Checked npm run business:autopilot:readonly:print }
else { Invoke-Checked node scripts/print-business-autopilot-readonly-verify-commands.mjs }

if ($scriptNames -match "business:route-contract:print") { Invoke-Checked npm run business:route-contract:print }
else { Invoke-Checked node scripts/print-business-autopilot-route-contract-check.mjs }

if ($scriptNames -match "worker:final-gate:print") { Invoke-Checked npm run worker:final-gate:print }
else { Invoke-Checked node scripts/print-worker-final-local-gate.mjs }

if ($scriptNames -match "growth:backend:final:print") { Invoke-Checked npm run growth:backend:final:print }
else { Invoke-Checked node scripts/print-growth-final-backend-validation.mjs }

Write-Host ""
Write-Host "Runbook complete. Deploy only after the checks above pass." -ForegroundColor Green
Write-Host "Deploy command:" -ForegroundColor Cyan
Write-Host "npm run deploy" -ForegroundColor Gray
