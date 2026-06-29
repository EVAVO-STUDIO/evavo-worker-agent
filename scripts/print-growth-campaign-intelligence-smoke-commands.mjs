const commands = String.raw`
# Growth Campaign Intelligence smoke checks
# Run from PowerShell after deploy and after applying migration 0014.

if (-not $env:WORKER_URL) { throw "Set WORKER_URL first." }
if (-not $env:ADMIN_TOKEN) { throw "Set ADMIN_TOKEN first." }

$headers = @{ Authorization = "Bearer $env:ADMIN_TOKEN" }
$base = $env:WORKER_URL.TrimEnd('/')

Write-Host "Read Growth operator overview" -ForegroundColor Cyan
Invoke-RestMethod "$base/admin/growth/operator" -Headers $headers | ConvertTo-Json -Depth 100

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

Write-Host "Growth Campaign Intelligence smoke checks complete." -ForegroundColor Green
`;

console.log(commands.trim());
