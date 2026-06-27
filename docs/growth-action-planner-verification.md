# Growth Action Planner verification

This guide verifies deterministic queue planning from an existing Growth signal.

## Scope

The planner reads a saved Growth signal and creates one queued Growth action record.

It does not generate draft text, call AI, send email, post publicly, submit forms, approve work, or perform external actions.

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

## Plan from a saved signal

Replace `<growth-signal-id>` with an existing signal id from `GET /admin/growth/signals?limit=50`.

```powershell
$planBody = @{
  confirm = $true
  signalId = "<growth-signal-id>"
} | ConvertTo-Json -Depth 20

Invoke-RestMethod "$env:WORKER_URL/admin/growth/actions/plan?confirm=1" -Headers $headers -Method POST -ContentType "application/json" -Body $planBody |
  ConvertTo-Json -Depth 100
```

## Verify result

```powershell
Invoke-RestMethod "$env:WORKER_URL/admin/growth/actions?limit=50" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/audit?limit=50" -Headers $headers |
  ConvertTo-Json -Depth 100
```

Expected result:

- response mode is `growth_action_planned`
- action appears in `GET /admin/growth/actions?limit=50`
- audit contains `growth_action_planned`
- budget result records zero AI calls, zero network fetches, zero public actions, and zero contact actions

## Deterministic mapping

The planner currently maps signal type to action type like this:

```text
owned_content_*      -> draft_blog_outline
directory/listing    -> draft_directory_profile
procurement/tender   -> watch_procurement_opportunity
community            -> draft_community_reply
contact/direct       -> draft_contact_note
fallback             -> save_signal_insight
```

Recommended mode and status are conservative:

- high-risk signals stay observe/blocked
- owned content and directory/listing signals can become assist-mode queue items
- low-fit signals remain queued rather than promoted
