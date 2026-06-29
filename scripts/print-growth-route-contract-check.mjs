const commands = String.raw`
# EVAVO Growth route-contract smoke check
# Run from PowerShell after setting ADMIN_TOKEN and WORKER_URL.
# This validates the route catalogue only. It does not write Growth metadata.

cd C:\GitRepos\evavo-worker-agent

git pull
npm run typecheck

$headers = @{ Authorization = "Bearer $env:ADMIN_TOKEN" }
$routePayload = Invoke-RestMethod "$env:WORKER_URL/admin/planner/routes" -Headers $headers
$expectedGrowthRouteIds = @(
  "growth_overview",
  "growth_brief",
  "growth_capabilities",
  "growth_operator",
  "growth_cycle",
  "growth_campaigns",
  "growth_campaign_save",
  "growth_experiments",
  "growth_experiment_save",
  "growth_decisions",
  "growth_decision_plan",
  "growth_metrics",
  "growth_metric_save",
  "growth_evidence",
  "growth_evidence_save",
  "growth_learning",
  "growth_learning_save",
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
$badConfirm = $growthRoutes | Where-Object { $_.id -like "*_save" -or $_.id -like "*_status" -or $_.id -eq "growth_action_plan" -or $_.id -eq "growth_decision_plan" } | Where-Object { -not $_.requiresConfirm -or $_.readOnly -or $_.safety -ne "confirm_required" }
$contractFailed = $false

if ($missing.Count -gt 0) {
  $contractFailed = $true
  Write-Host "Missing Growth route ids:" -ForegroundColor Yellow
  $missing
} else {
  Write-Host "All expected Growth route ids are advertised by the Worker." -ForegroundColor Green
}

if ($unsafe.Count -gt 0) {
  $contractFailed = $true
  Write-Host "Unsafe Growth route metadata found:" -ForegroundColor Red
  $unsafe | Select-Object id,callsNetwork,callsAI,canSendEmail,costRisk | Format-Table -AutoSize
} else {
  Write-Host "All Growth routes advertise no network, no AI, no email, and cost none." -ForegroundColor Green
}

if ($badConfirm.Count -gt 0) {
  $contractFailed = $true
  Write-Host "Growth metadata-write routes missing confirm_required posture:" -ForegroundColor Red
  $badConfirm | Select-Object id,safety,readOnly,requiresConfirm | Format-Table -AutoSize
} else {
  Write-Host "All Growth metadata-write routes advertise confirm_required posture." -ForegroundColor Green
}

if ($contractFailed) {
  Write-Host "Growth route contract smoke check failed." -ForegroundColor Red
  exit 1
}
`;

console.log(commands.trim());
