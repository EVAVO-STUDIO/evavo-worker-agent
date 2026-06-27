# Growth Brief verification

This guide verifies the read-only Growth brief endpoint.

## Scope

The Growth brief endpoint returns a single backend summary for operator review.

It reads budget, signals, actions, and recent audit events. It does not generate drafts, call AI, send email, post publicly, submit forms, write queue items, approve work, or perform external actions.

## Endpoint

```text
GET /admin/growth/brief?profile=free_safe
```

## Run

```powershell
cd C:\GitRepos\evavo-worker-agent

git pull
npm run check:local
npm run db:migration:one -- 0013 --execute
npm run deploy

$env:WORKER_URL="https://<worker-url>"
$env:ADMIN_TOKEN="<admin-token>"
$headers = @{ Authorization = "Bearer $env:ADMIN_TOKEN" }

Invoke-RestMethod "$env:WORKER_URL/admin/growth/brief?profile=free_safe" -Headers $headers |
  ConvertTo-Json -Depth 100
```

## Expected fields

```text
day
profileId
budget
budgetAssessment
signalSummary
actionSummary
latestAuditEvents
suggestedFocus
safety
```

Expected safety posture:

```text
readOnly: true
callsAI: false
sendsEmail: false
postsPublicly: false
submitsForms: false
executesGrowthActions: false
```

## Suggested focus examples

The brief can recommend operator attention when:

- budget/rest policy recommends pausing
- new signals need triage
- actions need review
- queued actions are waiting
- no urgent queue decision is detected
