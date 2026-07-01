const commands = String.raw`
# EVAVO Growth Autonomy smoke checks
# Run from PowerShell after setting ADMIN_TOKEN and WORKER_URL.

cd C:\GitRepos\evavo-worker-agent

git pull
npm run typecheck
npm run db:migrations:check
npm run growth:route-safety-flags:check

$headers = @{ Authorization = "Bearer $env:ADMIN_TOKEN" }

Invoke-RestMethod "$env:WORKER_URL/admin/growth/overview" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/brief?profile=free_safe" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/capabilities" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/operator" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/strategy?limit=25" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/channels?limit=50" -Headers $headers |
  ConvertTo-Json -Depth 100

# Route contract check: confirms the Worker catalogue advertises every expected Growth route id with safe metadata posture.
$routePayload = Invoke-RestMethod "$env:WORKER_URL/admin/planner/routes" -Headers $headers
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
  "growth_approval_requests",
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
  "growth_learning_save",
  "growth_approval_request_save",
  "growth_approval_request_status"
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
$unsafe = $readRoutes | Where-Object { -not $_.readOnly -or $_.callsNetwork -or $_.callsAI -or $_.canSendEmail -or $_.canPostSocial -or $_.canSubmitForms -or $_.costRisk -ne "none" -or ($_.writesTables -and $_.writesTables.Count -gt 0) }
$badConfirm = $confirmRoutes | Where-Object { -not $_.requiresConfirm -or $_.readOnly -or $_.safety -ne "confirm_required" -or $_.callsNetwork -or $_.callsAI -or $_.canSendEmail -or $_.canPostSocial -or $_.canSubmitForms }
$contractFailed = $false

if ($missing.Count -gt 0) {
  $contractFailed = $true
  Write-Host "Missing Growth route ids:" -ForegroundColor Yellow
  $missing
} else {
  Write-Host "All expected Growth route ids are advertised by the Worker route catalogue." -ForegroundColor Green
}

if ($unsafe.Count -gt 0) {
  $contractFailed = $true
  Write-Host "Unsafe Growth read-route metadata found:" -ForegroundColor Red
  $unsafe | Select-Object id,readOnly,callsNetwork,callsAI,canSendEmail,canPostSocial,canSubmitForms,costRisk,writesTables | Format-Table -AutoSize
} else {
  Write-Host "All Growth read routes advertise readOnly, no network, no AI, no email, no social posting, no form submission, cost none, and no write tables." -ForegroundColor Green
}

if ($badConfirm.Count -gt 0) {
  $contractFailed = $true
  Write-Host "Growth metadata-write routes missing confirm_required or safe metadata posture:" -ForegroundColor Red
  $badConfirm | Select-Object id,safety,readOnly,requiresConfirm,callsNetwork,callsAI,canSendEmail,canPostSocial,canSubmitForms | Format-Table -AutoSize
} else {
  Write-Host "All Growth metadata-write routes advertise confirm_required metadata-only posture." -ForegroundColor Green
}

if ($contractFailed) {
  Write-Host "Growth route contract smoke check failed." -ForegroundColor Red
  exit 1
}

# Optional test signal save. This writes internal metadata only.
$signalBody = @{
  confirm = $true
  signal = @{
    sourceUrl = "https://evavo.com.au/work/opportunity-agent"
    sourceTitle = "EVAVO Opportunity Agent case study"
    signalType = "owned_content_opportunity"
    serviceMatch = @("AI automation", "growth intelligence", "operations automation")
    audienceMatch = @("Australian SMEs", "service businesses", "founders")
    evidence = "EVAVO-owned URL for validating Growth queue and audit metadata after migration 0013."
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
