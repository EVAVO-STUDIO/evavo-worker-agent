const commands = String.raw`
# EVAVO Growth Autonomy smoke checks
# Run from PowerShell after setting ADMIN_TOKEN and WORKER_URL.

cd C:\GitRepos\evavo-worker-agent

git pull
npm run typecheck
npm run db:migrations:check

$headers = @{ Authorization = "Bearer $env:ADMIN_TOKEN" }

Invoke-RestMethod "$env:WORKER_URL/admin/growth/overview" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/brief?profile=free_safe" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/strategy?limit=25" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/channels?limit=50" -Headers $headers |
  ConvertTo-Json -Depth 100

# Route contract check: confirms the Worker catalogue advertises every expected Growth route id.
$routePayload = Invoke-RestMethod "$env:WORKER_URL/admin/planner/routes" -Headers $headers
$expectedGrowthRouteIds = @(
  "growth_overview",
  "growth_brief",
  "growth_strategy",
  "growth_strategy_save",
  "growth_channels",
  "growth_channels_save",
  "growth_signals",
  "growth_signal_save",
  "growth_signal_status",
  "growth_actions",
  "growth_action_save",
  "growth_action_plan",
  "growth_action_status",
  "growth_audit",
  "growth_budget"
)

$allRoutes = @()
if ($routePayload.groups) {
  $routePayload.groups.PSObject.Properties | ForEach-Object { $allRoutes += $_.Value }
} elseif ($routePayload.routes) {
  $allRoutes = $routePayload.routes
}

$growthRoutes = $allRoutes | Where-Object { $_.section -eq "growth" }
$missing = $expectedGrowthRouteIds | Where-Object { $id = $_; -not ($growthRoutes | Where-Object { $_.id -eq $id }) }
$unsafe = $growthRoutes | Where-Object { $_.callsNetwork -or $_.callsAI -or $_.canSendEmail -or $_.costRisk -ne "none" }
$badConfirm = $growthRoutes | Where-Object { $_.id -like "*_save" -or $_.id -like "*_status" -or $_.id -eq "growth_action_plan" } | Where-Object { -not $_.requiresConfirm -or $_.readOnly -or $_.safety -ne "confirm_required" }

if ($missing.Count -gt 0) {
  Write-Host "Missing Growth route ids:" -ForegroundColor Yellow
  $missing
} else {
  Write-Host "All expected Growth route ids are advertised by the Worker." -ForegroundColor Green
}

if ($unsafe.Count -gt 0) {
  Write-Host "Unsafe Growth route metadata found:" -ForegroundColor Red
  $unsafe | Select-Object id,callsNetwork,callsAI,canSendEmail,costRisk | Format-Table -AutoSize
} else {
  Write-Host "All Growth routes advertise no network, no AI, no email, and cost none." -ForegroundColor Green
}

if ($badConfirm.Count -gt 0) {
  Write-Host "Growth metadata-write routes missing confirm_required posture:" -ForegroundColor Red
  $badConfirm | Select-Object id,safety,readOnly,requiresConfirm | Format-Table -AutoSize
} else {
  Write-Host "All Growth metadata-write routes advertise confirm_required posture." -ForegroundColor Green
}

# Optional safe test signal save. This writes metadata only.
$signalBody = @{
  confirm = $true
  signal = @{
    sourceUrl = "https://evavo.com.au/work/opportunity-agent"
    sourceTitle = "EVAVO Opportunity Agent case study"
    signalType = "owned_content_opportunity"
    serviceMatch = @("AI automation", "growth intelligence", "operations automation")
    audienceMatch = @("Australian SMEs", "service businesses", "founders")
    evidence = "Safe test Growth signal for validating the queue and audit trail after migration 0013. This is an owned EVAVO URL and does not contact anyone."
    urgency = 30
    fitScore = 80
    riskScore = 5
    costScore = 100
    status = "new"
  }
} | ConvertTo-Json -Depth 20

Invoke-RestMethod "$env:WORKER_URL/admin/growth/signals?confirm=1" -Headers $headers -Method POST -ContentType "application/json" -Body $signalBody |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/signals?limit=50" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/actions?limit=50" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/audit?limit=50" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/budget?profile=free_safe" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/brief?profile=free_safe" -Headers $headers |
  ConvertTo-Json -Depth 100
`;

console.log(commands.trim());
