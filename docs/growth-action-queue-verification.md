# Growth Action Queue verification

This guide verifies the metadata-only Growth action queue.

## Scope

The Growth action queue stores recommended next-step records only.

It does not generate drafts, call AI, send email, post publicly, submit forms, approve actions, or perform external work.

## Prerequisites

```powershell
cd C:\GitRepos\evavo-worker-agent

git pull
npm run check:local
npm run db:migration:one -- 0013 --execute
npm run deploy
```

Set local smoke-test variables:

```powershell
$env:WORKER_URL="https://<worker-url>"
$env:ADMIN_TOKEN="<admin-token>"
$headers = @{ Authorization = "Bearer $env:ADMIN_TOKEN" }
```

## Save a safe signal first

```powershell
$signalBody = @{
  confirm = $true
  signal = @{
    sourceUrl = "https://evavo.com.au/work/opportunity-agent"
    sourceTitle = "EVAVO Opportunity Agent case study"
    signalType = "owned_content_opportunity"
    serviceMatch = @("AI automation", "growth intelligence", "operations automation")
    audienceMatch = @("Australian SMEs", "service businesses", "founders")
    evidence = "Safe test Growth signal for validating the queue and audit trail after migration 0013. This is an owned EVAVO URL."
    urgency = 30
    fitScore = 80
    riskScore = 5
    costScore = 100
    status = "new"
  }
} | ConvertTo-Json -Depth 20

$signalResult = Invoke-RestMethod "$env:WORKER_URL/admin/growth/signals?confirm=1" -Headers $headers -Method POST -ContentType "application/json" -Body $signalBody
$signalResult | ConvertTo-Json -Depth 100
```

## Save a queued action record

```powershell
$actionBody = @{
  confirm = $true
  action = @{
    signalId = $signalResult.signal.id
    actionType = "draft_blog_outline"
    recommendedMode = "assist"
    reason = "Create a safe owned-channel content idea from the EVAVO-owned Opportunity Agent case study signal."
    contextEvidence = "The signal is from an owned EVAVO case-study URL."
    evavoFitExplanation = "Matches EVAVO AI automation, growth intelligence, and operations automation positioning."
    channelPolicyResult = @{ channelClass = "owned"; allowed = $true; execution = "queue_only" }
    linkPolicyResult = @{ allowed = $true; reason = "Owned EVAVO URL used as source context" }
    disclosurePolicyResult = @{ required = $false; reason = "Internal queue item" }
    costEstimate = @{ aiCalls = 0; networkFetches = 0; publicActions = 0; contactActions = 0 }
    riskFlags = @()
    status = "queued"
  }
} | ConvertTo-Json -Depth 20

Invoke-RestMethod "$env:WORKER_URL/admin/growth/actions?confirm=1" -Headers $headers -Method POST -ContentType "application/json" -Body $actionBody |
  ConvertTo-Json -Depth 100
```

## Verify queue and audit

```powershell
Invoke-RestMethod "$env:WORKER_URL/admin/growth/signals?limit=50" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/actions?limit=50" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/audit?limit=50" -Headers $headers |
  ConvertTo-Json -Depth 100
```

Expected result:

- signal response includes `mode: growth_signal_saved`
- action response includes `mode: growth_action_saved`
- action appears in `GET /admin/growth/actions?limit=50`
- audit includes `growth_signal_saved` and `growth_action_saved`
- safety metadata shows queue writes only
