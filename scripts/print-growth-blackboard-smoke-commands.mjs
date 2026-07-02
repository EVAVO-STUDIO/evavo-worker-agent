const commands = String.raw`
# Growth Blackboard smoke checks
# Run from PowerShell after deploy and after applying migration 0017.
# This writes internal metadata only.

cd C:\GitRepos\evavo-worker-agent

git pull
npm run typecheck
npm run db:migrations:check
npm run growth:route-safety-flags:check

if (-not $env:WORKER_URL) { throw "Set WORKER_URL first." }
if (-not $env:ADMIN_TOKEN) { throw "Set ADMIN_TOKEN first." }

$headers = @{ Authorization = "Bearer $env:ADMIN_TOKEN" }
$base = $env:WORKER_URL.TrimEnd('/')

Write-Host "Read blackboard before seed" -ForegroundColor Cyan
$blackboardBefore = Invoke-RestMethod "$base/admin/growth/blackboard" -Headers $headers
$blackboardBefore | ConvertTo-Json -Depth 100
if (-not $blackboardBefore.safety -or -not $blackboardBefore.safety.readOnly -or $blackboardBefore.safety.callsAI -or $blackboardBefore.safety.callsNetwork -or $blackboardBefore.safety.canSendEmail -or $blackboardBefore.safety.canPostSocial -or $blackboardBefore.safety.canSubmitForms) { throw "Blackboard read has missing or unsafe safety flags." }

Write-Host "Create studio entity" -ForegroundColor Cyan
$studioBody = @{
  confirm = $true
  entityType = "studio"
  name = "EVAVO"
  description = "Internal metadata record for EVAVO studio capability and positioning."
  attributes = @{ geography = "Australia"; tone = "calm premium practical" }
  status = "active"
} | ConvertTo-Json -Depth 20
$studio = Invoke-RestMethod "$base/admin/growth/blackboard/entities?confirm=1" -Headers $headers -Method POST -Body $studioBody -ContentType "application/json"
$studio | ConvertTo-Json -Depth 100
if ($studio.safety.canSendEmail -or $studio.safety.canPostSocial -or $studio.safety.canSubmitForms -or $studio.safety.callsAI -or $studio.safety.callsNetwork) { throw "Entity save returned unsafe safety flags." }
$studioId = $studio.entity.id

Write-Host "Create segment entity" -ForegroundColor Cyan
$segmentBody = @{
  confirm = $true
  entityType = "target_segment"
  name = "Australian B2B services"
  description = "Internal target-segment metadata for strategy and campaign reasoning."
  attributes = @{ geography = "Australia"; kind = "B2B services" }
  status = "active"
} | ConvertTo-Json -Depth 20
$segment = Invoke-RestMethod "$base/admin/growth/blackboard/entities?confirm=1" -Headers $headers -Method POST -Body $segmentBody -ContentType "application/json"
$segment | ConvertTo-Json -Depth 100
if ($segment.safety.canSendEmail -or $segment.safety.canPostSocial -or $segment.safety.canSubmitForms -or $segment.safety.callsAI -or $segment.safety.callsNetwork) { throw "Entity save returned unsafe safety flags." }
$segmentId = $segment.entity.id

Write-Host "Create relationship" -ForegroundColor Cyan
$relationshipBody = @{
  confirm = $true
  fromEntityId = $studioId
  toEntityId = $segmentId
  relationshipType = "strategy_fit"
  summary = "Internal metadata relationship between EVAVO and the target segment."
  confidenceScore = 80
  status = "active"
} | ConvertTo-Json -Depth 20
Invoke-RestMethod "$base/admin/growth/blackboard/relationships?confirm=1" -Headers $headers -Method POST -Body $relationshipBody -ContentType "application/json" | ConvertTo-Json -Depth 100

Write-Host "Create fact" -ForegroundColor Cyan
$factBody = @{
  confirm = $true
  factType = "positioning_note"
  subjectType = "studio"
  subjectId = $studioId
  subjectName = "EVAVO"
  predicate = "uses_positioning"
  objectType = "positioning"
  objectName = "calm premium practical"
  summary = "EVAVO positioning should stay calm, premium, practical, concise, and evidence-led."
  evidenceRefs = @("internal_seed")
  confidenceScore = 85
  source = "internal_seed"
  status = "active"
} | ConvertTo-Json -Depth 20
Invoke-RestMethod "$base/admin/growth/blackboard/facts?confirm=1" -Headers $headers -Method POST -Body $factBody -ContentType "application/json" | ConvertTo-Json -Depth 100

Write-Host "Create market signal" -ForegroundColor Cyan
$signalBody = @{
  confirm = $true
  signalType = "segment_note"
  segmentName = "Australian B2B services"
  offerName = "Digital review"
  summary = "Internal metadata signal connecting the segment to a practical review offer."
  evidenceRefs = @("internal_seed")
  strengthScore = 70
  freshnessScore = 60
  status = "active"
} | ConvertTo-Json -Depth 20
Invoke-RestMethod "$base/admin/growth/blackboard/signals?confirm=1" -Headers $headers -Method POST -Body $signalBody -ContentType "application/json" | ConvertTo-Json -Depth 100

Write-Host "Create asset" -ForegroundColor Cyan
$assetBody = @{
  confirm = $true
  assetType = "proof_asset"
  name = "EVAVO public site"
  summary = "Internal metadata record for the primary public EVAVO proof asset."
  bestForSegments = @("Australian B2B services")
  bestForOffers = @("Digital review")
  proofPoints = @("web", "design", "automation", "digital product")
  status = "active"
} | ConvertTo-Json -Depth 20
Invoke-RestMethod "$base/admin/growth/blackboard/assets?confirm=1" -Headers $headers -Method POST -Body $assetBody -ContentType "application/json" | ConvertTo-Json -Depth 100

Write-Host "Read blackboard after seed" -ForegroundColor Cyan
$blackboard = Invoke-RestMethod "$base/admin/growth/blackboard" -Headers $headers
$blackboard | ConvertTo-Json -Depth 100
if (-not $blackboard.blackboard) { throw "Missing blackboard payload." }
if ($blackboard.blackboard.counts.facts -lt 1) { throw "Expected at least one blackboard fact." }
if ($blackboard.blackboard.counts.entities -lt 2) { throw "Expected at least two blackboard entities." }
if ($blackboard.blackboard.counts.relationships -lt 1) { throw "Expected at least one entity relationship." }
if ($blackboard.blackboard.counts.marketSignals -lt 1) { throw "Expected at least one market signal." }
if ($blackboard.blackboard.counts.assets -lt 1) { throw "Expected at least one asset." }
Write-Host "Growth Blackboard smoke checks complete." -ForegroundColor Green
`;

console.log(commands.trim());
