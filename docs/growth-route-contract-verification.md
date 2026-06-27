# Growth route contract verification

This guide verifies that the Worker advertises the full Growth Autonomy route contract through the route catalogue.

## Scope

The route catalogue is read-only metadata for operator tools. It should describe which Growth routes exist, whether they are read-only or confirmation-gated, what tables they can write, and whether they can call AI, network, email, or external actions.

The route catalogue itself does not run discovery, generate drafts, send email, post publicly, submit forms, or execute Growth actions.

## Prerequisites

```powershell
cd C:\GitRepos\evavo-worker-agent

git pull
npm run check:local
npm run deploy

$env:WORKER_URL="https://<worker-url>"
$env:ADMIN_TOKEN="<admin-token>"
$headers = @{ Authorization = "Bearer $env:ADMIN_TOKEN" }
```

## Read the route catalogue

```powershell
$routes = Invoke-RestMethod "$env:WORKER_URL/admin/planner/routes" -Headers $headers
$routes | ConvertTo-Json -Depth 100
```

## Expected Growth route IDs

```text
growth_overview
growth_brief
growth_strategy
growth_strategy_save
growth_channels
growth_channels_save
growth_signals
growth_signal_save
growth_signal_status
growth_actions
growth_action_save
growth_action_plan
growth_action_status
growth_audit
growth_budget
```

## Quick PowerShell check

```powershell
$expectedGrowthRouteIds = @(
  "growth_overview",
  "growth_brief",
  "growth_strategy",
  "growth_strategy_save",
  "growth_channels",
  "growth_channels_save",
  "growth_signals",
  "growth_signal_save",
  "growth_signal_status",
  "growth_actions",
  "growth_action_save",
  "growth_action_plan",
  "growth_action_status",
  "growth_audit",
  "growth_budget"
)

$allRoutes = @()
if ($routes.groups) {
  $routes.groups.PSObject.Properties | ForEach-Object { $allRoutes += $_.Value }
} elseif ($routes.routes) {
  $allRoutes = $routes.routes
}

$growthRoutes = $allRoutes | Where-Object { $_.section -eq "growth" }
$missing = $expectedGrowthRouteIds | Where-Object { $id = $_; -not ($growthRoutes | Where-Object { $_.id -eq $id }) }

if ($missing.Count -gt 0) {
  Write-Host "Missing Growth route ids:" -ForegroundColor Yellow
  $missing
} else {
  Write-Host "All expected Growth route ids are advertised." -ForegroundColor Green
}
```

## Expected safety posture

Every Growth route should report:

```text
callsNetwork: false
callsAI: false
canSendEmail: false
costRisk: none
```

Read-only Growth routes should report:

```text
safety: read_only
readOnly: true
requiresConfirm: false
```

Confirmed metadata-write Growth routes should report:

```text
safety: confirm_required
readOnly: false
requiresConfirm: true
```

## Confirmed metadata-write routes

```text
growth_strategy_save    -> growth_goals, growth_audit_events
growth_channels_save    -> growth_channels, growth_audit_events
growth_signal_save      -> growth_signals, growth_audit_events
growth_signal_status    -> growth_signals, growth_audit_events
growth_action_save      -> growth_actions, growth_audit_events
growth_action_plan      -> growth_actions, growth_audit_events
growth_action_status    -> growth_actions, growth_audit_events
```

These routes write metadata and audit records only. They do not generate draft text, call AI, contact anyone, publish anything, submit forms, or execute Growth actions.

## Next UI verification

After deploying the Worker and pulling the Next repo, open:

```text
http://localhost:3000/ops/outbound-agent-config#routes
```

Expected UI state:

```text
Full Growth route contract advertised
```

The Growth route card should show the read route count, confirm-write route count, no AI, and no network.
