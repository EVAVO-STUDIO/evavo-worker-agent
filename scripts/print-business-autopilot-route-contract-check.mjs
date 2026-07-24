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
  "business_people",
  "business_websites",
  "business_pages",
  "business_website_audit_runs",
  "business_audit_observations",
  "business_audit_observation_candidates",
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

$historicalBusinessReadRouteIds = @(
  "business_action_drafts",
  "business_approval_requests"
)

$businessConfirmRouteIds = @(
  "business_organization_save",
  "business_person_save",
  "business_website_save",
  "business_page_save",
  "business_website_audit_run_save",
  "business_audit_observation_save",
  "business_signal_save",
  "business_opportunity_save",
  "business_service_match_save",
  "business_audit_pack_save",
  "business_action_draft_build",
  "business_suppression_save",
  "business_content_idea_save",
  "business_followup_save",
  "business_learning_event_save"
)

$historicalBusinessWriteRouteIds = @(
  "business_action_draft_build"
)

$disabledBusinessWriteRouteIds = @(
  "business_action_draft_save",
  "business_approval_request_save"
)

$disabledBusinessWritePaths = @(
  "/admin/business/action-drafts",
  "/admin/business/approval-requests"
)

$businessReadPaths = @(
  "/admin/business/organizations?limit=5",
  "/admin/business/people?limit=5",
  "/admin/business/websites?limit=5",
  "/admin/business/pages?limit=5",
  "/admin/business/website-audit-runs?limit=5",
  "/admin/business/audit-observations?limit=5",
  "/admin/business/audit-observation-candidates?limit=5",
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

$historicalBusinessReadPaths = @(
  "/admin/business/action-drafts?limit=5",
  "/admin/business/approval-requests?limit=5"
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
$historicalReadRoutes = $businessRoutes | Where-Object { $historicalBusinessReadRouteIds -contains $_.id }
$confirmRoutes = $businessRoutes | Where-Object { $businessConfirmRouteIds -contains $_.id }
$historicalWriteRoutes = $businessRoutes | Where-Object { $historicalBusinessWriteRouteIds -contains $_.id }
$missing = $expectedBusinessRouteIds | Where-Object { $id = $_; -not ($businessRoutes | Where-Object { $_.id -eq $id }) }
$unexpectedDisabled = $allRoutes | Where-Object { $disabledBusinessWriteRouteIds -contains $_.id }
$unsafeReads = $readRoutes | Where-Object { -not $_.readOnly -or $_.callsNetwork -or $_.callsAI -or $_.canSendEmail -or $_.canPostSocial -or $_.canSubmitForms -or $_.costRisk -ne "none" -or ($_.writesTables -and $_.writesTables.Count -gt 0) }
$unsafeHistoricalReads = $historicalReadRoutes | Where-Object {
  $_.operationsHubRecommended -ne $false -or
  $_.label -notmatch "^Historical Business" -or
  $_.description -notmatch "non-deliverable" -or
  $_.description -notmatch "non-executable" -or
  $_.description -notmatch "non-authoritative"
}
$unsafeHistoricalWrites = $historicalWriteRoutes | Where-Object {
  $_.operationsHubRecommended -ne $false -or
  $_.label -notmatch "internal historical review record" -or
  $_.description -notmatch "historical review record" -or
  $_.description -notmatch "does not create deliverable copy" -or
  $_.description -notmatch "external execution permission"
}
$badConfirm = $confirmRoutes | Where-Object { -not $_.requiresConfirm -or $_.readOnly -or $_.safety -ne "confirm_required" -or $_.canSendEmail -or $_.canPostSocial -or $_.canSubmitForms -or $_.callsAI -or $_.callsNetwork }
$contractFailed = $false

if ($missing.Count -gt 0) {
  $contractFailed = $true
  Write-Host "Missing Business Autopilot route ids:" -ForegroundColor Yellow
  $missing
} else {
  Write-Host "All expected Business Autopilot route ids are advertised by the Worker route catalogue." -ForegroundColor Green
}

if ($unexpectedDisabled.Count -gt 0) {
  $contractFailed = $true
  Write-Host "Disabled Business draft/approval write routes are still advertised:" -ForegroundColor Red
  $unexpectedDisabled | Select-Object id,path,safety | Format-Table -AutoSize
} else {
  Write-Host "Disabled direct draft and approval write routes are not advertised." -ForegroundColor Green
}

if ($unsafeReads.Count -gt 0) {
  $contractFailed = $true
  Write-Host "Unsafe Business Autopilot read-route metadata found:" -ForegroundColor Red
  $unsafeReads | Select-Object id,readOnly,callsNetwork,callsAI,canSendEmail,canPostSocial,canSubmitForms,costRisk,writesTables | Format-Table -AutoSize
} else {
  Write-Host "All Business Autopilot read routes advertise readOnly, no network, no AI, no email, no social posting, no form submission, cost none, and no write tables." -ForegroundColor Green
}

if ($unsafeHistoricalReads.Count -gt 0 -or $historicalReadRoutes.Count -ne $historicalBusinessReadRouteIds.Count) {
  $contractFailed = $true
  Write-Host "Historical Business read routes are missing explicit non-executing catalogue posture:" -ForegroundColor Red
  $historicalReadRoutes | Select-Object id,label,operationsHubRecommended,description | Format-Table -Wrap
} else {
  Write-Host "Historical Business read routes are clearly labelled and not recommended as ordinary Operations Hub actions." -ForegroundColor Green
}

if ($unsafeHistoricalWrites.Count -gt 0 -or $historicalWriteRoutes.Count -ne $historicalBusinessWriteRouteIds.Count) {
  $contractFailed = $true
  Write-Host "Historical Business review-write routes are missing explicit non-recommended catalogue posture:" -ForegroundColor Red
  $historicalWriteRoutes | Select-Object id,label,operationsHubRecommended,description | Format-Table -Wrap
} else {
  Write-Host "Historical Business review-write routes are not recommended as ordinary Operations Hub actions." -ForegroundColor Green
}

if ($badConfirm.Count -gt 0) {
  $contractFailed = $true
  Write-Host "Business Autopilot metadata-write routes missing confirm_required or safe metadata posture:" -ForegroundColor Red
  $badConfirm | Select-Object id,safety,readOnly,requiresConfirm,callsNetwork,callsAI,canSendEmail,canPostSocial,canSubmitForms | Format-Table -AutoSize
} else {
  Write-Host "All advertised Business Autopilot metadata-write routes use confirm_required and non-executing posture." -ForegroundColor Green
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
    Write-Host "Business Autopilot route threw: $path" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
  }
}

Write-Host "Verify historical Business read responses remain review-only and non-executable" -ForegroundColor Cyan
foreach ($path in $historicalBusinessReadPaths) {
  try {
    $payload = Invoke-RestMethod "$base$path" -Headers $headers
    if ($payload.historicalOnly -ne $true -or $payload.reviewOnly -ne $true -or $payload.executable -ne $false -or $payload.deliverable -ne $false -or $payload.authoritativeForExecution -ne $false -or $payload.externalExecutionAllowed -ne $false) {
      $contractFailed = $true
      Write-Host "Historical Business read response is missing required review-only non-execution flags: $path" -ForegroundColor Red
    }
  } catch {
    $contractFailed = $true
    Write-Host "Historical Business read verification threw: $path" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
  }
}

function Assert-DisabledBusinessWrite([string]$Path) {
  try {
    Invoke-WebRequest "$base$Path" -Method POST -Headers $headers -ContentType "application/json" -Body '{"confirm":true}' -ErrorAction Stop | Out-Null
    Write-Host "Disabled Business write unexpectedly succeeded: $Path" -ForegroundColor Red
    return $false
  } catch {
    $statusCode = 0
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $statusCode = [int]$_.Exception.Response.StatusCode
    }
    if ($statusCode -ne 410) {
      Write-Host "Disabled Business write returned $statusCode instead of 410: $Path" -ForegroundColor Red
      return $false
    }
    Write-Host "Disabled Business write correctly returned 410 Gone: $Path" -ForegroundColor Green
    return $true
  }
}

Write-Host "Verify retired Business write endpoints fail closed" -ForegroundColor Cyan
foreach ($path in $disabledBusinessWritePaths) {
  if (-not (Assert-DisabledBusinessWrite $path)) {
    $contractFailed = $true
  }
}

if ($contractFailed) { throw "Business Autopilot route contract failed." }
Write-Host "Business Autopilot route contract is valid." -ForegroundColor Green
`;

console.log(commands.trim());