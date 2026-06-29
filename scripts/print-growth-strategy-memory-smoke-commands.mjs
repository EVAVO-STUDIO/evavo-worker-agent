const commands = String.raw`
# Growth Strategy Memory smoke checks
# Run from PowerShell after deploy and after applying migration 0016.

if (-not $env:WORKER_URL) { throw "Set WORKER_URL first." }
if (-not $env:ADMIN_TOKEN) { throw "Set ADMIN_TOKEN first." }

$headers = @{ Authorization = "Bearer $env:ADMIN_TOKEN" }
$base = $env:WORKER_URL.TrimEnd('/')

Write-Host "Read strategy memory before seed" -ForegroundColor Cyan
Invoke-RestMethod "$base/admin/growth/strategy-memory" -Headers $headers | ConvertTo-Json -Depth 100

Write-Host "Seed objective" -ForegroundColor Cyan
$objectiveBody = @{
  confirm = $true
  name = "Generate qualified EVAVO opportunities"
  description = "Build a governed autonomous growth system that finds and prepares high-fit opportunities for EVAVO web, UX, automation, and AI services."
  status = "active"
  priority = 90
  successMetric = "qualified replies, discovery calls, and approved opportunities"
} | ConvertTo-Json -Depth 20
$objectiveResult = Invoke-RestMethod "$base/admin/growth/objectives?confirm=1" -Headers $headers -Method POST -Body $objectiveBody -ContentType "application/json"
$objectiveResult | ConvertTo-Json -Depth 100
$objectiveId = $objectiveResult.objective.id

Write-Host "Seed key result" -ForegroundColor Cyan
$keyResultBody = @{
  confirm = $true
  objectiveId = $objectiveId
  name = "Create reviewed opportunity pipeline"
  metricName = "reviewed_high_fit_opportunities"
  targetValue = 20
  currentValue = 0
  unit = "opportunities"
  status = "active"
} | ConvertTo-Json -Depth 20
Invoke-RestMethod "$base/admin/growth/key-results?confirm=1" -Headers $headers -Method POST -Body $keyResultBody -ContentType "application/json" | ConvertTo-Json -Depth 100

Write-Host "Seed target segment" -ForegroundColor Cyan
$segmentBody = @{
  confirm = $true
  name = "Australian B2B services with weak conversion sites"
  description = "Established Australian B2B services firms whose websites, UX, automation, analytics, or lead conversion paths can be improved."
  geography = "Australia"
  industry = "B2B services"
  companySize = "10-250 employees"
  buyerRoles = "Founder, Managing Director, Marketing Manager, Operations Lead"
  painPoints = @("weak website conversion", "manual lead handling", "unclear service positioning", "limited automation")
  priority = 85
  status = "active"
} | ConvertTo-Json -Depth 20
Invoke-RestMethod "$base/admin/growth/segments?confirm=1" -Headers $headers -Method POST -Body $segmentBody -ContentType "application/json" | ConvertTo-Json -Depth 100

Write-Host "Seed offer profile" -ForegroundColor Cyan
$offerBody = @{
  confirm = $true
  name = "Website, UX, and AI automation review"
  description = "A practical review of website conversion, UX gaps, analytics, automation opportunities, and AI assistant/workflow potential."
  offerType = "consultative_review"
  proofPoints = @("EVAVO builds websites/apps", "EVAVO supports UX/UI, motion, Three.js, AI products, and automation", "Opportunity agent Worker is an internal proof point")
  bestForSegments = @("Australian B2B services with weak conversion sites")
  riskNotes = "Do not overclaim results. Use evidence-based review framing."
  priority = 88
  status = "active"
} | ConvertTo-Json -Depth 20
Invoke-RestMethod "$base/admin/growth/offers?confirm=1" -Headers $headers -Method POST -Body $offerBody -ContentType "application/json" | ConvertTo-Json -Depth 100

Write-Host "Seed positioning profile" -ForegroundColor Cyan
$positioningBody = @{
  confirm = $true
  name = "EVAVO calm premium practical"
  voiceNotes = "Concise, premium, practical, low-fluff, no hype. Position EVAVO as a sharp digital product and automation studio."
  valueProp = "EVAVO helps businesses improve digital experiences, conversion, automation, and AI-enabled workflows with design and build capability."
  avoidPhrases = @("guaranteed growth", "revolutionary", "spam", "just checking in", "AI magic")
  preferredAngles = @("specific website improvement", "practical automation", "useful audit", "design and build credibility")
  proofAssets = @("evavo.com.au", "EVAVO opportunity agent Worker", "EVAVO service pages")
  status = "active"
} | ConvertTo-Json -Depth 20
Invoke-RestMethod "$base/admin/growth/positioning?confirm=1" -Headers $headers -Method POST -Body $positioningBody -ContentType "application/json" | ConvertTo-Json -Depth 100

Write-Host "Seed runtime constraint" -ForegroundColor Cyan
$constraintBody = @{
  confirm = $true
  name = "No external action without explicit approval"
  constraintType = "safety_policy"
  description = "The Worker may analyse, store metadata, prepare drafts, and request approval, but must not send, post, submit, browse, spend, or modify external systems without explicit approved execution controls."
  severity = "hard"
  rule = @{ externalStateChangeAllowed = $false; requiresApproval = $true; maxAutonomyLevel = 1 }
  status = "active"
} | ConvertTo-Json -Depth 20
Invoke-RestMethod "$base/admin/growth/runtime-constraints?confirm=1" -Headers $headers -Method POST -Body $constraintBody -ContentType "application/json" | ConvertTo-Json -Depth 100

Write-Host "Read strategy memory after seed" -ForegroundColor Cyan
Invoke-RestMethod "$base/admin/growth/strategy-memory" -Headers $headers | ConvertTo-Json -Depth 100

Write-Host "Read autonomy after strategy seed" -ForegroundColor Cyan
Invoke-RestMethod "$base/admin/growth/autonomy" -Headers $headers | ConvertTo-Json -Depth 100

Write-Host "Growth Strategy Memory smoke checks complete." -ForegroundColor Green
`;

console.log(commands.trim());
