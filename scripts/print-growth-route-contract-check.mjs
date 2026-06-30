const commands = String.raw`
# EVAVO Growth route-contract smoke check
# Run from PowerShell after setting ADMIN_TOKEN and WORKER_URL.
# This validates the route catalogue and read-only Growth runtime contracts. It does not write Growth metadata.

cd C:\GitRepos\evavo-worker-agent

git pull
npm run typecheck

if (-not $env:WORKER_URL) { throw "Set WORKER_URL first." }
if (-not $env:ADMIN_TOKEN) { throw "Set ADMIN_TOKEN first." }

$headers = @{ Authorization = "Bearer $env:ADMIN_TOKEN" }
$base = $env:WORKER_URL.TrimEnd('/')
$routePayload = Invoke-RestMethod "$base/admin/planner/routes" -Headers $headers
$expectedGrowthRouteIds = @(
  "growth_overview",
  "growth_brief",
  "growth_capabilities",
  "growth_operator",
  "growth_autonomy",
  "growth_blackboard",
  "growth_blackboard_facts",
  "growth_blackboard_fact_save",
  "growth_entities",
  "growth_entity_save",
  "growth_entity_relationships",
  "growth_entity_relationship_save",
  "growth_market_signals",
  "growth_market_signal_save",
  "growth_assets",
  "growth_asset_save",
  "growth_strategy_memory",
  "growth_objectives",
  "growth_objective_save",
  "growth_key_results",
  "growth_key_result_save",
  "growth_segments",
  "growth_segment_save",
  "growth_offers",
  "growth_offer_save",
  "growth_positioning",
  "growth_positioning_save",
  "growth_runtime_constraints",
  "growth_runtime_constraint_save",
  "growth_cycle",
  "growth_cycle_events",
  "growth_cycle_record",
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
$badConfirm = $growthRoutes | Where-Object { $_.id -like "*_save" -or $_.id -like "*_status" -or $_.id -eq "growth_action_plan" -or $_.id -eq "growth_decision_plan" -or $_.id -eq "growth_cycle_record" -or $_.id -eq "growth_key_result_save" -or $_.id -eq "growth_segment_save" -or $_.id -eq "growth_offer_save" -or $_.id -eq "growth_positioning_save" -or $_.id -eq "growth_runtime_constraint_save" -or $_.id -eq "growth_entity_relationship_save" -or $_.id -eq "growth_market_signal_save" -or $_.id -eq "growth_asset_save" } | Where-Object { -not $_.requiresConfirm -or $_.readOnly -or $_.safety -ne "confirm_required" }
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

Write-Host "Read and verify Growth v3 cycle contract" -ForegroundColor Cyan
$cycle = Invoke-RestMethod "$base/admin/growth/cycle" -Headers $headers
if ($cycle.contractVersion -ne "growth_operator_cycle_v3_strategy_blackboard_read_only") {
  $contractFailed = $true
  Write-Host "Unexpected Growth cycle contractVersion: $($cycle.contractVersion)" -ForegroundColor Red
}
if (-not $cycle.strategy) {
  $contractFailed = $true
  Write-Host "Growth cycle is missing strategy section." -ForegroundColor Red
}
if (-not $cycle.blackboard) {
  $contractFailed = $true
  Write-Host "Growth cycle is missing blackboard section." -ForegroundColor Red
}
if (-not $cycle.safety -or $cycle.safety.callsNetwork -or $cycle.safety.callsAI -or $cycle.safety.externalStateChange) {
  $contractFailed = $true
  Write-Host "Growth cycle safety contract is unsafe or missing." -ForegroundColor Red
}

Write-Host "Read and verify Growth v3 autonomy contract" -ForegroundColor Cyan
$autonomy = Invoke-RestMethod "$base/admin/growth/autonomy" -Headers $headers
if ($autonomy.contractVersion -ne "growth_autonomous_runtime_v3_strategy_blackboard") {
  $contractFailed = $true
  Write-Host "Unexpected Growth autonomy contractVersion: $($autonomy.contractVersion)" -ForegroundColor Red
}
if (-not $autonomy.strategicIntent) {
  $contractFailed = $true
  Write-Host "Growth autonomy is missing strategicIntent." -ForegroundColor Red
}
if (-not $autonomy.knowledgeSubstrate) {
  $contractFailed = $true
  Write-Host "Growth autonomy is missing knowledgeSubstrate." -ForegroundColor Red
}
if (-not $autonomy.safety -or $autonomy.safety.callsNetwork -or $autonomy.safety.callsAI -or $autonomy.safety.externalStateChange) {
  $contractFailed = $true
  Write-Host "Growth autonomy safety contract is unsafe or missing." -ForegroundColor Red
}

Write-Host "Read Growth cycle events and verify snapshot hydration when events exist" -ForegroundColor Cyan
$eventsPayload = Invoke-RestMethod "$base/admin/growth/cycle/events?limit=5" -Headers $headers
$latestEvent = @($eventsPayload.events)[0]
if ($latestEvent) {
  if (-not $latestEvent.strategy) {
    $contractFailed = $true
    Write-Host "Latest Growth cycle event is missing hydrated strategy snapshot." -ForegroundColor Red
  }
  if (-not $latestEvent.blackboard) {
    $contractFailed = $true
    Write-Host "Latest Growth cycle event is missing hydrated blackboard snapshot." -ForegroundColor Red
  }
  if (-not $latestEvent.strategy_json) {
    $contractFailed = $true
    Write-Host "Latest Growth cycle event is missing raw strategy_json column." -ForegroundColor Red
  }
  if (-not $latestEvent.blackboard_json) {
    $contractFailed = $true
    Write-Host "Latest Growth cycle event is missing raw blackboard_json column." -ForegroundColor Red
  }
} else {
  Write-Host "No Growth cycle events found yet; snapshot hydration check skipped until a cycle is recorded." -ForegroundColor Yellow
}

if ($contractFailed) {
  Write-Host "Growth route contract smoke check failed." -ForegroundColor Red
  exit 1
}

Write-Host "Growth v3 runtime contracts are valid." -ForegroundColor Green
`;

console.log(commands.trim());
