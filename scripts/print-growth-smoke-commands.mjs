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

Invoke-RestMethod "$env:WORKER_URL/admin/growth/strategy?limit=25" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/channels?limit=50" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/signals?limit=50" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/actions?limit=50" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/audit?limit=50" -Headers $headers |
  ConvertTo-Json -Depth 100

Invoke-RestMethod "$env:WORKER_URL/admin/growth/budget?profile=free_safe" -Headers $headers |
  ConvertTo-Json -Depth 100
`;

console.log(commands.trim());
