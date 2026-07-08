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

function Assert-BusinessRead($path) {
  Write-Host "Reading $path" -ForegroundColor Cyan
  $payload = Invoke-RestMethod "$base$path" -Headers $headers
  $payload | ConvertTo-Json -Depth 50
  if ($payload.ok -ne $true) { throw "GET $path failed." }
  if (-not $payload.safety) { throw "GET $path missing safety." }
  if (-not $payload.safety.readOnly) { throw "GET $path is not read-only." }
  if (-not $payload.safety.internalMetadataOnly) { throw "GET $path is not marked internal metadata only." }
  if ($payload.safety.externalStateChange -or $payload.safety.callsAI -or $payload.safety.callsNetwork -or $payload.safety.canSendEmail -or $payload.safety.canPostSocial -or $payload.safety.canSubmitForms) { throw "GET $path safety is unsafe." }
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
  "/admin/business/action-drafts?limit=5",
  "/admin/business/approval-requests?limit=5",
  "/admin/business/suppression?limit=5",
  "/admin/business/content-ideas?limit=5",
  "/admin/business/followups?limit=5",
  "/admin/business/learning?limit=5"
)

foreach ($path in $paths) {
  Assert-BusinessRead $path
}

Write-Host "Business Autopilot read-only verification complete." -ForegroundColor Green
Write-Host "Open the Next Operations Hub and inspect http://localhost:3000/ops/outbound-agent-config#business-autopilot after the Next dev server is running." -ForegroundColor Yellow
`;

console.log(commands.trim());
