const commands = String.raw`
# EVAVO Growth route-contract smoke check
# Run from PowerShell after setting ADMIN_TOKEN and WORKER_URL.
# This validates the Worker route catalogue, read-only Growth runtime contracts, next-best internal step approval packs, and confirmation-gated Growth metadata routes. It does not write Growth metadata.

cd C:\GitRepos\evavo-worker-agent

git pull
npm run typecheck

if (-not $env:WORKER_URL) { throw "Set WORKER_URL first." }
if (-not $env:ADMIN_TOKEN) { throw "Set ADMIN_TOKEN first." }

$headers = @{ Authorization = "Bearer $env:ADMIN_TOKEN" }
$base = $env:WORKER_URL.TrimEnd('/')
$routePayload = Invoke-RestMethod "$base/admin/planner/routes" -Headers $headers
$readGrowthRouteIds = @(
  "growth_overview",
  "growth_brief",
  "growth_capabilities",
  "growth_operator",
  "growth_strategy",
  "growth_channels",
  "growth_signals",
  "growth_actions",
  "growth_audit",
  "growth_budget",
  "growth_cycle",
  "growth_autonomy",
  "growth_blackboard",
  "growth_cycle_events",
  "growth_campaigns",
  "growth_experiments",
  "growth_decisions",
  "growth_metrics",
  "growth_evidence",
  "growth_learning",
  "growth_strategy_memory",
  "growth_objectives",
  "growth_key_results",
  "growth_segments",
  "growth_offers",
  "growth_positioning",
  "growth_runtime_constraints",
  "growth_blackboard_facts",
  "growth_entities",
  "growth_entity_relationships",
  "growth_market_signals",
  "growth_assets"
)
$confirmRequiredGrowthRouteIds = @(
  "growth_strategy_save",
  "growth_channels_save",
  "growth_signal_save",
  "growth_signal_status",
  "growth_action_save",
  "growth_action_plan",
  "growth_action_status",
  "growth_blackboard_fact_save",
  "growth_entity_save",
  "growth_entity_relationship_save",
  "growth_market_signal_save",
  "growth_asset_save",
  "growth_objective_save",
  "growth_key_result_save",
  "growth_segment_save",
  "growth_offer_save",
  "growth_positioning_save",
  "growth_runtime_constraint_save",
  "growth_cycle_record",
  "growth_campaign_save",
  "growth_experiment_save",
  "growth_decision_plan",
  "growth_metric_save",
  "growth_evidence_save",
  "growth_learning_save"
)
$expectedGrowthRouteIds = @($readGrowthRouteIds + $confirmRequiredGrowthRouteIds | Select-Object -Unique)

$allRoutes = @()
if ($routePayload.groups) {
  $routePayload.groups.PSObject.Properties | ForEach-Object { $allRoutes += $_.Value }
} elseif ($routePayload.routes) {
  $allRoutes = $routePayload.routes
}

$growthRoutes = $allRoutes | Where-Object { $expectedGrowthRouteIds -contains $_.id }
$readRoutes = $growthRoutes | Where-Object { $readGrowthRouteIds -contains $_.id }
$confirmRoutes = $growthRoutes | Where-Object { $confirmRequiredGrowthRouteIds -contains $_.id }
$missing = $expectedGrowthRouteIds | Where-Object { $id = $_; -not ($growthRoutes | Where-Object { $_.id -eq $id }) }
$unsafeReads = $readRoutes | Where-Object { -not $_.readOnly -or $_.callsNetwork -or $_.callsAI -or $_.canSendEmail -or $_.costRisk -ne "none" -or ($_.writesTables -and $_.writesTables.Count -gt 0) }
$badConfirm = $confirmRoutes | Where-Object { -not $_.requiresConfirm -or $_.readOnly -or $_.safety -ne "confirm_required" }
$contractFailed = $false

if ($missing.Count -gt 0) {
  $contractFailed = $true
  Write-Host "Missing Growth route ids:" -ForegroundColor Yellow
  $missing
} else {
  Write-Host "All expected Growth route ids are advertised by the Worker route catalogue." -ForegroundColor Green
}

if ($unsafeReads.Count -gt 0) {
  $contractFailed = $true
  Write-Host "Unsafe Growth read-route metadata found:" -ForegroundColor Red
  $unsafeReads | Select-Object id,readOnly,callsNetwork,callsAI,canSendEmail,costRisk,writesTables | Format-Table -AutoSize
} else {
  Write-Host "All Growth read routes advertise readOnly, no network, no AI, no email, cost none, and no write tables." -ForegroundColor Green
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
if (-not $cycle.nextBestInternalStep) {
  $contractFailed = $true
  Write-Host "Growth cycle is missing nextBestInternalStep." -ForegroundColor Red
}
if (-not $cycle.approvalPack) {
  $contractFailed = $true
  Write-Host "Growth cycle is missing approvalPack." -ForegroundColor Red
}
if ($cycle.approvalPack -and $cycle.approvalPack.safety) {
  if ($cycle.approvalPack.safety.externalStateChange -or $cycle.approvalPack.safety.callsAI -or $cycle.approvalPack.safety.callsNetwork -or $cycle.approvalPack.safety.canSendEmail -or $cycle.approvalPack.safety.canPostSocial -or $cycle.approvalPack.safety.canSubmitForms) {
    $contractFailed = $true
    Write-Host "Growth cycle approvalPack safety is unsafe." -ForegroundColor Red
  }
}
if ($cycle.nextBestInternalStep -and $cycle.nextBestInternalStep.safety) {
  if ($cycle.nextBestInternalStep.safety.externalStateChange -or $cycle.nextBestInternalStep.safety.callsAI -or $cycle.nextBestInternalStep.safety.callsNetwork) {
    $contractFailed = $true
    Write-Host "Growth cycle nextBestInternalStep safety is unsafe." -ForegroundColor Red
  }
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
if (-not $autonomy.nextBestInternalStep) {
  $contractFailed = $true
  Write-Host "Growth autonomy is missing nextBestInternalStep." -ForegroundColor Red
}
if (-not $autonomy.approvalPack) {
  $contractFailed = $true
  Write-Host "Growth autonomy is missing approvalPack." -ForegroundColor Red
}
if ($autonomy.approvalPack -and $autonomy.approvalPack.safety) {
  if ($autonomy.approvalPack.safety.externalStateChange -or $autonomy.approvalPack.safety.callsAI -or $autonomy.approvalPack.safety.callsNetwork -or $autonomy.approvalPack.safety.canSendEmail -or $autonomy.approvalPack.safety.canPostSocial -or $autonomy.approvalPack.safety.canSubmitForms) {
    $contractFailed = $true
    Write-Host "Growth autonomy approvalPack safety is unsafe." -ForegroundColor Red
  }
}
if ($autonomy.nextBestInternalStep -and $autonomy.nextBestInternalStep.safety) {
  if ($autonomy.nextBestInternalStep.safety.externalStateChange -or $autonomy.nextBestInternalStep.safety.callsAI -or $autonomy.nextBestInternalStep.safety.callsNetwork) {
    $contractFailed = $true
    Write-Host "Growth autonomy nextBestInternalStep safety is unsafe." -ForegroundColor Red
  }
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

Write-Host "Growth v3 runtime route contract is valid." -ForegroundColor Green
`;

console.log(commands.trim());
