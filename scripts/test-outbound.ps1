param(
  [string]$Base = "https://evavo-outbound-agent.evavo-studio.workers.dev",
  [string]$Token = "Pongoman"
)

$ErrorActionPreference = "Stop"
$Headers = @{ Authorization = "Bearer $Token" }

Write-Host "`n== RUN SCAN ==" -ForegroundColor Cyan
Invoke-RestMethod "$Base/admin/run" -Method POST -ContentType "application/json" -Headers $Headers -Body '{"kind":"scan"}'

Write-Host "`n== OVERVIEW ==" -ForegroundColor Cyan
Invoke-RestMethod "$Base/admin/overview" -Headers $Headers

Write-Host "`n== LEADS (TOP 40) ==" -ForegroundColor Cyan
Invoke-RestMethod "$Base/admin/leads?limit=40" -Headers $Headers

Write-Host "`n== EVENTS (TOP 30) ==" -ForegroundColor Cyan
Invoke-RestMethod "$Base/admin/events?limit=30" -Headers $Headers

Write-Host "`n== RUN DRAFT ==" -ForegroundColor Cyan
Invoke-RestMethod "$Base/admin/run" -Method POST -ContentType "application/json" -Headers $Headers -Body '{"kind":"draft"}'

Write-Host "`n== DRAFTS (TOP 20) ==" -ForegroundColor Cyan
Invoke-RestMethod "$Base/admin/drafts?limit=20" -Headers $Headers

Write-Host "`n== INSIGHTS ==" -ForegroundColor Cyan
Invoke-RestMethod "$Base/admin/insights" -Headers $Headers
