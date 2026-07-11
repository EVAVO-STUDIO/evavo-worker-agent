const commands = String.raw`
# EVAVO Worker final local gate
# Run this only after migrations 0021 and 0022 have already been applied.
# Do not rerun 0021 or 0022 from this gate.

cd C:\GitRepos\evavo-worker-agent

git pull
npm run scripts:check
npm run db:migrations:check
npm run business:autopilot:check
npm run business:autopilot:raw-error-safety:check
npm run business:people:docs:check
npm run business:website-pages:docs:check
npm run growth:backend:aggregate:check
npm run check:local
npm run growth:backend:check:local
npm run growth:generated-routes:check
npm run db:verify:print

Write-Host "If every command above passes, deploy the Cloudflare Worker through the guarded npm wrapper:" -ForegroundColor Green
Write-Host "npm run deploy" -ForegroundColor Cyan
Write-Host "That command runs npm predeploy first, then executes the real Worker command: wrangler deploy." -ForegroundColor Gray
Write-Host "Direct wrangler deploy also deploys the Worker, but bypasses npm predeploy safety checks, so only use it intentionally." -ForegroundColor Yellow

Write-Host "Do not rerun migrations 0021 or 0022 here. They were already applied successfully." -ForegroundColor Yellow
`;

console.log(commands.trim());