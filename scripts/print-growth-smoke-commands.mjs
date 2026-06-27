const commands = String.raw`
# EVAVO Growth Autonomy smoke checks
# Run from PowerShell after setting ADMIN_TOKEN and WORKER_URL.

cd C:\GitRepos\evavo-worker-agent

git pull
npm run typecheck
npm run db:migrations:check

$headers = @{ Authorization = "Bearer $env:ADMIN_TOKEN" }

Invoke-RestMethod "$env:WORKER_URL/admin/growth/overview" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/brief?profile=free_safe" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/strategy?limit=25" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/channels?limit=50" -Headers $headers |
  ConvertTo-Json -Depth 100

# Optional safe test signal save. This writes metadata only.
$signalBody = @{
  confirm = $true
  signal = @{
    sourceUrl = "https://evavo.com.au/work/opportunity-agent"
    sourceTitle = "EVAVO Opportunity Agent case study"
    signalType = "owned_content_opportunity"
    serviceMatch = @("AI automation", "growth intelligence", "operations automation")
    audienceMatch = @("Australian SMEs", "service businesses", "founders")
    evidence = "Safe test Growth signal for validating the queue and audit trail after migration 0013. This is an owned EVAVO URL and does not contact anyone."
    urgency = 30
    fitScore = 80
    riskScore = 5
    costScore = 100
    status = "new"
  }
} | ConvertTo-Json -Depth 20

Invoke-RestMethod "$env:WORKER_URL/admin/growth/signals?confirm=1" -Headers $headers -Method POST -ContentType "application/json" -Body $signalBody |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/signals?limit=50" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/actions?limit=50" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/audit?limit=50" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/budget?profile=free_safe" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/brief?profile=free_safe" -Headers $headers |
  ConvertTo-Json -Depth 100
`;

console.log(commands.trim());
