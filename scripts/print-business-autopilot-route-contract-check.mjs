const commands = String.raw`
# EVAVO Business Autopilot route-contract smoke check
# Run from PowerShell after setting ADMIN_TOKEN and WORKER_URL.
# This validates Business Autopilot metadata routes only. It does not send, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems.

cd C:\GitRepos\evavo-worker-agent

git pull
npm run typecheck

if (-not $env:WORKER_URL) { throw "Set WORKER_URL first." }
if (-not $env:ADMIN_TOKEN) { throw "Set ADMIN_TOKEN first." }

$headers = @{ Authorization = "Bearer $env:ADMIN_TOKEN" }
$base = $env:WORKER_URL.TrimEnd('/')
$routePayload = Invoke-RestMethod "$base/admin/planner/routes" -Headers $headers

$businessReadRouteIds = @(
  "business_organizations",
  "business_websites",
  "business_pages",
  "business_signals",
  "business_opportunities",
  "business_service_matches",
  "business_audit_packs",
  "business_action_drafts",
  "business_approval_requests",
  "business_suppression_list",
  "business_content_ideas",
  "business_followups",
  "business_learning_events"
)

$businessConfirmRouteIds = @(
  "business_organization_save",
  "business_website_save",
  "business_page_save",
  "business_signal_save",
  "business_opportunity_save",
  "business_service_match_save",
  "business_audit_pack_save",
  "business_action_draft_build",
  "business_action_draft_save",
  "business_approval_request_save",
  "business_suppression_save",
  "business_content_idea_save",
  "business_followup_save",
  "business_learning_event_save"
)

$businessReadPaths = @(
  "/admin/business/organizations?limit=5",
  "/admin/business/websites?limit=5",
  "/admin/business/pages?limit=5",
  "/admin/business/signals?limit=5",
  "/admin/business/opportunities?limit=5",
  "/admin/business/service-matches?limit=5",
  "/admin/business/audit-packs?limit=5",
  "/admin/business/action-drafts?limit=5",
  "/admin/business/approval-requests?limit=5",
  "/admin/business/suppression?limit=5",
  "/admin/business/content-ideas?limit=5",
  "/admin/business/followups?limit=5",
  "/admin/business/learning?limit=5"
)

$expectedBusinessRouteIds = @($businessReadRouteIds + $businessConfirmRouteIds | Select-Object -Unique)

$allRoutes = @()
if ($routePayload.groups) {
  $routePayload.groups.PSObject.Properties | ForEach-Object { $allRoutes += $_.Value }
} elseif ($routePayload.routes) {
  $allRoutes = $routePayload.routes
}

$businessRoutes = $allRoutes | Where-Object { $expectedBusinessRouteIds -contains $_.id }
$readRoutes = $businessRoutes | Where-Object { $businessReadRouteIds -contains $_.id }
$confirmRoutes = $businessRoutes | Where-Object { $businessConfirmRouteIds -contains $_.id }
$missing = $expectedBusinessRouteIds | Where-Object { $id = $_; -not ($businessRoutes | Where-Object { $_.id -eq $id }) }
$unsafeReads = $readRoutes | Where-Object { -not $_.readOnly -or $_.callsNetwork -or $_.callsAI -or $_.canSendEmail -or $_.canPostSocial -or $_.canSubmitForms -or $_.costRisk -ne "none" -or ($_.writesTables -and $_.writesTables.Count -gt 0) }
$badConfirm = $confirmRoutes | Where-Object { -not $_.requiresConfirm -or $_.readOnly -or $_.safety -ne "confirm_required" -or $_.canSendEmail -or $_.canPostSocial -or $_.canSubmitForms -or $_.callsAI -or $_.callsNetwork }
$contractFailed = $false

if ($missing.Count -gt 0) {
  $contractFailed = $true
  Write-Host "Missing Business Autopilot route ids:" -ForegroundColor Yellow
  $missing
} else {
  Write-Host "All expected Business Autopilot route ids are advertised by the Worker route catalogue." -ForegroundColor Green
}

if ($unsafeReads.Count -gt 0) {
  $contractFailed = $true
  Write-Host "Unsafe Business Autopilot read-route metadata found:" -ForegroundColor Red
  $unsafeReads | Select-Object id,readOnly,callsNetwork,callsAI,canSendEmail,canPostSocial,canSubmitForms,costRisk,writesTables | Format-Table -AutoSize
} else {
  Write-Host "All Business Autopilot read routes advertise readOnly, no network, no AI, no email, no social posting, no form submission, cost none, and no write tables." -ForegroundColor Green
}

if ($badConfirm.Count -gt 0) {
  $contractFailed = $true
  Write-Host "Business Autopilot metadata-write routes missing confirm_required or safe metadata posture:" -ForegroundColor Red
  $badConfirm | Select-Object id,safety,readOnly,requiresConfirm,callsNetwork,callsAI,canSendEmail,canPostSocial,canSubmitForms | Format-Table -AutoSize
} else {
  Write-Host "All Business Autopilot metadata-write routes advertise confirm_required metadata-only posture." -ForegroundColor Green
}

Write-Host "Read and verify Business Autopilot metadata route family" -ForegroundColor Cyan
foreach ($path in $businessReadPaths) {
  try {
    $payload = Invoke-RestMethod "$base$path" -Headers $headers
    if ($payload.ok -ne $true) {
      $contractFailed = $true
      Write-Host "Business Autopilot route failed: $path" -ForegroundColor Red
    }
    if (-not $payload.safety -or -not $payload.safety.readOnly -or -not $payload.safety.internalMetadataOnly -or $payload.safety.externalStateChange -or $payload.safety.callsAI -or $payload.safety.callsNetwork -or $payload.safety.canSendEmail -or $payload.safety.canPostSocial -or $payload.safety.canSubmitForms) {
      $contractFailed = $true
      Write-Host "Business Autopilot route has missing or unsafe read safety: $path" -ForegroundColor Red
    }
  } catch {
    $contractFailed = $true
    Write-Host "Business Autopilot route threw: $path :: $($_.Exception.Message)" -ForegroundColor Red
  }
}

Write-Host "Check draft-only action builder confirm route is blocked without confirm" -ForegroundColor Cyan
try {
  Invoke-RestMethod "$base/admin/business/action-drafts/build" -Method POST -Headers $headers -ContentType "application/json" -Body '{"organizationName":"Demo","recommendedService":"website_rebuild","evidenceSummary":"Demo evidence"}' | Out-Null
  $contractFailed = $true
  Write-Host "Draft builder unexpectedly allowed unconfirmed write." -ForegroundColor Red
} catch {
  Write-Host "Draft builder blocks unconfirmed writes as expected." -ForegroundColor Green
}

if ($contractFailed) {
  Write-Host "Business Autopilot route contract smoke check failed." -ForegroundColor Red
  exit 1
}

Write-Host "Business Autopilot route contract is valid." -ForegroundColor Green
`;

console.log(commands.trim());
