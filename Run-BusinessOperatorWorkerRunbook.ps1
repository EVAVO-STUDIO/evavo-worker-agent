# EVAVO Business Operator Worker runbook runner
# Run from PowerShell in C:\GitRepos\evavo-worker-agent after git pull.

$ErrorActionPreference = "Stop"

Write-Host "EVAVO Business Operator Worker runbook" -ForegroundColor Cyan
Write-Host "Role: business analyst / sales strategist / BDM / growth manager / operator brain" -ForegroundColor Gray
Write-Host "Safe automation: internal automation can reason, score, prioritise, draft and learn; external execution remains confirm-gated and disabled by default." -ForegroundColor Gray
Write-Host ""

if (-not (Test-Path "package.json")) {
  throw "package.json not found. Run this from C:\GitRepos\evavo-worker-agent."
}

Write-Host "Repository state" -ForegroundColor Cyan
git status --short
git branch --show-current
git log -1 --oneline
Write-Host ""

Write-Host "Available Business/Growth npm scripts" -ForegroundColor Cyan
npm run | Select-String "business:|growth:backend|growth:route|scripts:check|check:local|db:migration|db:migrations" | ForEach-Object { $_.Line }
Write-Host ""

Write-Host "Migration checks" -ForegroundColor Cyan
npm run db:migrations:check
npm run db:migrations:print
Write-Host ""

Write-Host "Apply latest Business Autopilot migrations if needed" -ForegroundColor Cyan
Write-Host "If either migration reports already applied or duplicate columns/tables, stop and inspect before retrying." -ForegroundColor Yellow
npm run db:migration:one -- 0021 --execute
npm run db:migration:one -- 0022 --execute
Write-Host ""

Write-Host "Refresh Worker route wiring and route catalogue" -ForegroundColor Cyan
npm run growth:wiring:apply
npm run growth:route-catalogue:apply
Write-Host ""

Write-Host "Run guarded local checks" -ForegroundColor Cyan
npm run scripts:check
npm run check:local
Write-Host ""

Write-Host "Print verification commands with npm aliases if available" -ForegroundColor Cyan
$scriptNames = (node -e "const p=require('./package.json'); console.log(Object.keys(p.scripts||{}).join('\n'))")

if ($scriptNames -match "business:operator:runbook:print") { npm run business:operator:runbook:print }
else { node scripts/print-business-operator-worker-runbook.mjs }

if ($scriptNames -match "business:autopilot:readonly:print") { npm run business:autopilot:readonly:print }
else { node scripts/print-business-autopilot-readonly-verify-commands.mjs }

if ($scriptNames -match "business:route-contract:print") { npm run business:route-contract:print }
else { node scripts/print-business-autopilot-route-contract-check.mjs }

if ($scriptNames -match "growth:backend:final:print") { npm run growth:backend:final:print }
else { node scripts/print-growth-final-backend-validation.mjs }

Write-Host ""
Write-Host "Runbook complete. Deploy only after the checks above pass." -ForegroundColor Green
Write-Host "Deploy command:" -ForegroundColor Cyan
Write-Host "npm run deploy" -ForegroundColor Gray
