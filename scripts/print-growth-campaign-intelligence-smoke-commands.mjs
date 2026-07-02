const commands = String.raw`
# Growth Campaign Intelligence smoke checks
# Run from PowerShell after deploy and after applying migrations 0014 through 0018.

cd C:\GitRepos\evavo-worker-agent

git pull
npm run typecheck
npm run db:migrations:check
npm run growth:route-safety-flags:check

if (-not $env:WORKER_URL) { throw "Set WORKER_URL first." }
if (-not $env:ADMIN_TOKEN) { throw "Set ADMIN_TOKEN first." }

$headers = @{ Authorization = "Bearer $env:ADMIN_TOKEN" }
$base = $env:WORKER_URL.TrimEnd('/')

Write-Host "Read Growth operator overview" -ForegroundColor Cyan
$operatorOverview = Invoke-RestMethod "$base/admin/growth/operator" -Headers $headers
$operatorOverview | ConvertTo-Json -Depth 100
if (-not $operatorOverview.safety -or -not $operatorOverview.safety.readOnly -or $operatorOverview.safety.callsAI -or $operatorOverview.safety.callsNetwork -or $operatorOverview.safety.canSendEmail -or $operatorOverview.safety.canPostSocial -or $operatorOverview.safety.canSubmitForms) { throw "Growth operator overview has missing or unsafe safety flags." }

Write-Host "Read Growth operator cycle" -ForegroundColor Cyan
$cycleBefore = Invoke-RestMethod "$base/admin/growth/cycle" -Headers $headers
$cycleBefore | ConvertTo-Json -Depth 100
if ($cycleBefore.contractVersion -ne "growth_operator_cycle_v3_strategy_blackboard_read_only") { throw "Unexpected cycle contractVersion: $($cycleBefore.contractVersion)" }
if (-not $cycleBefore.strategy) { throw "Cycle is missing strategy section." }
if (-not $cycleBefore.blackboard) { throw "Cycle is missing blackboard section." }

Write-Host "Create metadata-only campaign" -ForegroundColor Cyan
$campaignBody = @{
  confirm = $true
  name = "EVAVO Premium B2B Site Audit"
  goal = "Find and review high-fit B2B website improvement opportunities for EVAVO."
  hypothesis = "Premium B2B firms with unclear conversion paths may respond to a useful website audit angle."
  targetSegment = "Australian B2B services"
  primaryOffer = "Website, UX, and automation review"
  status = "active"
  priority = 75
  successMetric = "qualified reply or discovery call"
} | ConvertTo-Json -Depth 20
$campaignResult = Invoke-RestMethod "$base/admin/growth/campaigns?confirm=1" -Headers $headers -Method POST -Body $campaignBody -ContentType "application/json"
$campaignResult | ConvertTo-Json -Depth 100
if ($campaignResult.safety.canSendEmail -or $campaignResult.safety.canPostSocial -or $campaignResult.safety.canSubmitForms -or $campaignResult.safety.callsAI -or $campaignResult.safety.callsNetwork) { throw "Campaign save returned unsafe safety flags." }
$campaignId = $campaignResult.campaign.id

Write-Host "Create metadata-only experiment" -ForegroundColor Cyan
$experimentBody = @{
  confirm = $true
  campaignId = $campaignId
  name = "Audit angle versus automation angle"
  hypothesis = "A concrete website audit angle may outperform a broad AI automation angle for first contact."
  variantA = "Website conversion audit"
  variantB = "AI workflow automation"
  sampleSizeTarget = 10
  decisionRule = "Continue the stronger angle after enough reviewed outcomes."
  status = "testing"
} | ConvertTo-Json -Depth 20
$experimentResult = Invoke-RestMethod "$base/admin/growth/experiments?confirm=1" -Headers $headers -Method POST -Body $experimentBody -ContentType "application/json"
$experimentResult | ConvertTo-Json -Depth 100
if ($experimentResult.safety.canSendEmail -or $experimentResult.safety.canPostSocial -or $experimentResult.safety.canSubmitForms -or $experimentResult.safety.callsAI -or $experimentResult.safety.callsNetwork) { throw "Experiment save returned unsafe safety flags." }
$experimentId = $experimentResult.experiment.id

Write-Host "Save campaign metric snapshot" -ForegroundColor Cyan
$metricBody = @{
  confirm = $true
  campaignId = $campaignId
  experimentId = $experimentId
  preparedCount = 4
  reviewedCount = 2
  positiveCount = 1
  negativeCount = 0
  meetingCount = 0
  contentCount = 1
  engagementCount = 3
  costUnits = 0
  healthState = "amber"
  notes = "Smoke metric snapshot for validating campaign analytics records."
} | ConvertTo-Json -Depth 20
Invoke-RestMethod "$base/admin/growth/metrics?confirm=1" -Headers $headers -Method POST -Body $metricBody -ContentType "application/json" | ConvertTo-Json -Depth 100

Write-Host "Save campaign evidence item" -ForegroundColor Cyan
$evidenceBody = @{
  confirm = $true
  campaignId = $campaignId
  experimentId = $experimentId
  targetRef = "evavo-owned-case-study"
  evidenceType = "owned_content_signal"
  sourceUrl = "https://evavo.com.au/work/opportunity-agent"
  summary = "Owned EVAVO case-study page provides safe evidence for testing the campaign brain."
  snapshot = @{ source = "smoke"; risk = "low" }
} | ConvertTo-Json -Depth 20
Invoke-RestMethod "$base/admin/growth/evidence?confirm=1" -Headers $headers -Method POST -Body $evidenceBody -ContentType "application/json" | ConvertTo-Json -Depth 100

Write-Host "Save campaign learning note" -ForegroundColor Cyan
$learningBody = @{
  confirm = $true
  campaignId = $campaignId
  experimentId = $experimentId
  noteType = "smoke_learning"
  summary = "The campaign brain can now store campaign, experiment, metric, evidence, learning, and decision records together."
  recommendation = "Use this structure for future campaign monitoring and next-best-action planning."
  confidenceScore = 70
} | ConvertTo-Json -Depth 20
Invoke-RestMethod "$base/admin/growth/learning?confirm=1" -Headers $headers -Method POST -Body $learningBody -ContentType "application/json" | ConvertTo-Json -Depth 100

Write-Host "List campaigns" -ForegroundColor Cyan
Invoke-RestMethod "$base/admin/growth/campaigns?limit=10" -Headers $headers | ConvertTo-Json -Depth 100

Write-Host "List experiments" -ForegroundColor Cyan
Invoke-RestMethod "$base/admin/growth/experiments?campaignId=$campaignId" -Headers $headers | ConvertTo-Json -Depth 100

Write-Host "List metrics" -ForegroundColor Cyan
Invoke-RestMethod "$base/admin/growth/metrics?campaignId=$campaignId" -Headers $headers | ConvertTo-Json -Depth 100

Write-Host "List evidence" -ForegroundColor Cyan
Invoke-RestMethod "$base/admin/growth/evidence?campaignId=$campaignId" -Headers $headers | ConvertTo-Json -Depth 100

Write-Host "List learning" -ForegroundColor Cyan
Invoke-RestMethod "$base/admin/growth/learning?campaignId=$campaignId" -Headers $headers | ConvertTo-Json -Depth 100

Write-Host "Plan metadata-only next-best campaign decision" -ForegroundColor Cyan
$decisionBody = @{
  confirm = $true
  campaignId = $campaignId
  pendingReviewCount = 0
} | ConvertTo-Json -Depth 20
Invoke-RestMethod "$base/admin/growth/decisions/plan?confirm=1" -Headers $headers -Method POST -Body $decisionBody -ContentType "application/json" | ConvertTo-Json -Depth 100

Write-Host "List decisions" -ForegroundColor Cyan
Invoke-RestMethod "$base/admin/growth/decisions?campaignId=$campaignId" -Headers $headers | ConvertTo-Json -Depth 100

Write-Host "Read Growth operator overview after analytics records" -ForegroundColor Cyan
Invoke-RestMethod "$base/admin/growth/operator" -Headers $headers | ConvertTo-Json -Depth 100

Write-Host "Read Growth operator cycle after analytics records" -ForegroundColor Cyan
$cycleAfter = Invoke-RestMethod "$base/admin/growth/cycle" -Headers $headers
$cycleAfter | ConvertTo-Json -Depth 100
if ($cycleAfter.contractVersion -ne "growth_operator_cycle_v3_strategy_blackboard_read_only") { throw "Unexpected cycle contractVersion after records: $($cycleAfter.contractVersion)" }
if (-not $cycleAfter.strategy) { throw "Cycle after records is missing strategy section." }
if (-not $cycleAfter.blackboard) { throw "Cycle after records is missing blackboard section." }

Write-Host "Record current Growth operator cycle" -ForegroundColor Cyan
$recorded = Invoke-RestMethod "$base/admin/growth/cycle/record?confirm=1" -Headers $headers -Method POST -Body '{"confirm":true}' -ContentType "application/json"
$recorded | ConvertTo-Json -Depth 100
if (-not $recorded.event.strategy) { throw "Recorded cycle event is missing hydrated strategy snapshot." }
if (-not $recorded.event.blackboard) { throw "Recorded cycle event is missing hydrated blackboard snapshot." }
if (-not $recorded.event.strategy_json) { throw "Recorded cycle event is missing raw strategy_json column." }
if (-not $recorded.event.blackboard_json) { throw "Recorded cycle event is missing raw blackboard_json column." }

Write-Host "List Growth operator cycle events" -ForegroundColor Cyan
$eventsResult = Invoke-RestMethod "$base/admin/growth/cycle/events?limit=10" -Headers $headers
$eventsResult | ConvertTo-Json -Depth 100
$latestEvent = @($eventsResult.events)[0]
if (-not $latestEvent) { throw "Expected at least one recorded cycle event." }
if (-not $latestEvent.strategy) { throw "Latest cycle event is missing hydrated strategy snapshot." }
if (-not $latestEvent.blackboard) { throw "Latest cycle event is missing hydrated blackboard snapshot." }
if (-not $latestEvent.strategy_json) { throw "Latest cycle event is missing raw strategy_json column." }
if (-not $latestEvent.blackboard_json) { throw "Latest cycle event is missing raw blackboard_json column." }

Write-Host "Growth Campaign Intelligence smoke checks complete." -ForegroundColor Green
`;

console.log(commands.trim());
