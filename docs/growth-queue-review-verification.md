# Growth Queue Review verification

This guide verifies metadata-only review/status updates for Growth signals and queued Growth actions.

## Scope

These review routes update queue status only. They do not generate drafts, call AI, send email, post publicly, submit forms, approve external work, or run any external action.

## Prerequisites

```powershell
cd C:\GitRepos\evavo-worker-agent

git pull
npm run check:local
npm run db:migration:one -- 0013 --execute
npm run deploy
```

Set variables:

```powershell
$env:WORKER_URL="https://<worker-url>"
$env:ADMIN_TOKEN="<admin-token>"
$headers = @{ Authorization = "Bearer $env:ADMIN_TOKEN" }
```

## Signal status update

Allowed signal statuses:

```text
new
triaged
watch
ignored
duplicate
converted_to_action
blocked
```

Example:

```powershell
$signalReviewBody = @{
  confirm = $true
  id = "<growth-signal-id>"
  status = "watch"
  reason = "Safe metadata-only review update after validating the signal."
} | ConvertTo-Json -Depth 20

Invoke-RestMethod "$env:WORKER_URL/admin/growth/signals/status?confirm=1" -Headers $headers -Method POST -ContentType "application/json" -Body $signalReviewBody |
  ConvertTo-Json -Depth 100
```

## Action status update

Allowed action statuses:

```text
queued
needs_review
approved
rejected
blocked
archived
```

Example:

```powershell
$actionReviewBody = @{
  confirm = $true
  id = "<growth-action-id>"
  status = "needs_review"
  reason = "Safe metadata-only review update."
} | ConvertTo-Json -Depth 20

Invoke-RestMethod "$env:WORKER_URL/admin/growth/actions/status?confirm=1" -Headers $headers -Method POST -ContentType "application/json" -Body $actionReviewBody |
  ConvertTo-Json -Depth 100
```

Blocked action example:

```powershell
$blockedActionBody = @{
  confirm = $true
  id = "<growth-action-id>"
  status = "blocked"
  blockedReason = "Policy or channel rule requires blocking this queue item."
  reason = "Safe metadata-only block decision."
} | ConvertTo-Json -Depth 20

Invoke-RestMethod "$env:WORKER_URL/admin/growth/actions/status?confirm=1" -Headers $headers -Method POST -ContentType "application/json" -Body $blockedActionBody |
  ConvertTo-Json -Depth 100
```

## Verify audit

```powershell
Invoke-RestMethod "$env:WORKER_URL/admin/growth/audit?limit=50" -Headers $headers |
  ConvertTo-Json -Depth 100
```

Expected audit events:

- `growth_signal_status_updated`
- `growth_action_status_updated`

Expected safety posture:

- metadata queue write only
- no AI call
- no email
- no public post
- no form submission
- no external action
