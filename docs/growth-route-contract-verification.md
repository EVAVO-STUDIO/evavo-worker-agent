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

## Full PowerShell contract check

This check is fail-hard. If the Growth route contract is missing or unsafe, it exits with code `1`.

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
$unsafe = $growthRoutes | Where-Object { $_.callsNetwork -or $_.callsAI -or $_.canSendEmail -or $_.costRisk -ne "none" }
$badConfirm = $growthRoutes | Where-Object { $_.id -like "*_save" -or $_.id -like "*_status" -or $_.id -eq "growth_action_plan" } | Where-Object { -not $_.requiresConfirm -or $_.readOnly -or $_.safety -ne "confirm_required" }
$contractFailed = $false

if ($missing.Count -gt 0) {
  $contractFailed = $true
  Write-Host "Missing Growth route ids:" -ForegroundColor Yellow
  $missing
} else {
  Write-Host "All expected Growth route ids are advertised." -ForegroundColor Green
}

if ($unsafe.Count -gt 0) {
  $contractFailed = $true
  Write-Host "Unsafe Growth route metadata found:" -ForegroundColor Red
  $unsafe | Select-Object id,callsNetwork,callsAI,canSendEmail,costRisk | Format-Table -AutoSize
} else {
  Write-Host "All Growth routes advertise no network, no AI, no email, and cost none." -ForegroundColor Green
}

if ($badConfirm.Count -gt 0) {
  $contractFailed = $true
  Write-Host "Growth metadata-write routes missing confirm_required posture:" -ForegroundColor Red
  $badConfirm | Select-Object id,safety,readOnly,requiresConfirm | Format-Table -AutoSize
} else {
  Write-Host "All Growth metadata-write routes advertise confirm_required posture." -ForegroundColor Green
}

if ($contractFailed) {
  Write-Host "Growth route contract smoke check failed." -ForegroundColor Red
  exit 1
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

## Smoke printer shortcuts

For a route-contract-only check that does not write Growth metadata, print and run:

```powershell
npm run growth:route-contract:print
```

For the broader Growth smoke flow, including the optional safe owned-site test signal write, print and run:

```powershell
npm run growth:smoke:print
```

Both shortcuts include the same fail-hard route-contract checks.

Expected pass messages:

```text
All expected Growth route ids are advertised by the Worker.
All Growth routes advertise no network, no AI, no email, and cost none.
All Growth metadata-write routes advertise confirm_required posture.
```

Expected fail message:

```text
Growth route contract smoke check failed.
```

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
