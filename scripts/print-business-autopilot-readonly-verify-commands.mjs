const commands = String.raw`
# EVAVO Business Autopilot read-only verification
# Run from PowerShell after setting ADMIN_TOKEN and WORKER_URL.
# This reads internal metadata only. It does not send, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems.

cd C:\GitRepos\evavo-worker-agent

git pull
npm run business:autopilot:check
npm run typecheck

if (-not $env:WORKER_URL) { throw "Set WORKER_URL first." }
if (-not $env:ADMIN_TOKEN) { throw "Set ADMIN_TOKEN first." }

$headers = @{ Authorization = "Bearer $env:ADMIN_TOKEN" }
$base = $env:WORKER_URL.TrimEnd('/')

function Assert-BusinessRead([string]$Path, [bool]$HistoricalOnly = $false) {
  Write-Host "Reading $Path" -ForegroundColor Cyan
  $payload = Invoke-RestMethod "$base$Path" -Headers $headers
  $payload | ConvertTo-Json -Depth 50
  if ($payload.ok -ne $true) { throw "GET $Path failed." }
  if (-not $payload.safety) { throw "GET $Path missing safety." }
  if (-not $payload.safety.readOnly) { throw "GET $Path is not read-only." }
  if (-not $payload.safety.internalMetadataOnly) { throw "GET $Path is not marked internal metadata only." }
  if ($payload.safety.externalStateChange -or $payload.safety.callsAI -or $payload.safety.callsNetwork -or $payload.safety.canSendEmail -or $payload.safety.canPostSocial -or $payload.safety.canSubmitForms) { throw "GET $Path safety is unsafe." }
  if ($HistoricalOnly) {
    if ($payload.historicalOnly -ne $true) { throw "GET $Path is not marked historicalOnly." }
    if ($payload.executable -ne $false) { throw "GET $Path is not marked executable false." }
    if ($payload.deliverable -ne $false) { throw "GET $Path is not marked deliverable false." }
    if ($payload.authoritativeForExecution -ne $false) { throw "GET $Path is not marked authoritativeForExecution false." }
  }
}

$paths = @(
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
  "/admin/business/suppression?limit=5",
  "/admin/business/content-ideas?limit=5",
  "/admin/business/followups?limit=5",
  "/admin/business/learning?limit=5"
)

foreach ($path in $paths) {
  Assert-BusinessRead $path
}

$historicalPaths = @(
  "/admin/business/action-drafts?limit=5",
  "/admin/business/approval-requests?limit=5"
)

foreach ($path in $historicalPaths) {
  Assert-BusinessRead $path $true
}

Write-Host "Business Autopilot read-only verification complete." -ForegroundColor Green
Write-Host "Open the Next Operations Hub and inspect http://localhost:3000/ops/outbound-agent-config#business-autopilot after the Next dev server is running." -ForegroundColor Yellow
`;

console.log(commands.trim());