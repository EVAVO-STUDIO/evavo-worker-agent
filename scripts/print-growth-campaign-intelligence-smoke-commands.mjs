const commands = String.raw`
# Growth Campaign Intelligence smoke checks
# Run from PowerShell after deploy and after applying migration 0014.

if (-not $env:WORKER_URL) { throw "Set WORKER_URL first, e.g. `$env:WORKER_URL='https://...'" }
if (-not $env:ADMIN_TOKEN) { throw "Set ADMIN_TOKEN first, e.g. `$env:ADMIN_TOKEN='...'" }

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
Invoke-RestMethod "$base/admin/growth/experiments?confirm=1" -Headers $headers -Method POST -Body $experimentBody -ContentType "application/json" | ConvertTo-Json -Depth 100

Write-Host "List campaigns" -ForegroundColor Cyan
Invoke-RestMethod "$base/admin/growth/campaigns?limit=10" -Headers $headers | ConvertTo-Json -Depth 100

Write-Host "List experiments" -ForegroundColor Cyan
Invoke-RestMethod "$base/admin/growth/experiments?campaignId=$campaignId" -Headers $headers | ConvertTo-Json -Depth 100

Write-Host "Plan metadata-only next-best campaign decision" -ForegroundColor Cyan
$decisionBody = @{
  confirm = $true
  campaignId = $campaignId
  pendingReviewCount = 0
  evidenceCount = 0
} | ConvertTo-Json -Depth 20
Invoke-RestMethod "$base/admin/growth/decisions/plan?confirm=1" -Headers $headers -Method POST -Body $decisionBody -ContentType "application/json" | ConvertTo-Json -Depth 100

Write-Host "List decisions" -ForegroundColor Cyan
Invoke-RestMethod "$base/admin/growth/decisions?campaignId=$campaignId" -Headers $headers | ConvertTo-Json -Depth 100

Write-Host "Growth Campaign Intelligence smoke checks complete." -ForegroundColor Green
`;

console.log(commands.trim());
