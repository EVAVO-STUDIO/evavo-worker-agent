const commands = String.raw`
# EVAVO Business Operator Worker runbook
# Use this when local npm aliases look stale or when you need a clean Worker refresh path.
# This is a print-only helper. It does not run migrations, deploy, send, post, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems.
# Operator model: business analyst / sales strategist / BDM / growth manager / operator brain.
# Safe automation model: internal automation can reason, score, prioritise, draft and learn; external execution remains confirm-gated and disabled by default.

cd C:\GitRepos\evavo-worker-agent

git status
git branch --show-current
git remote -v
git pull
npm ci

Write-Host "Confirm package aliases from the checked-out repo:" -ForegroundColor Cyan
npm run

Write-Host "Check migrations and print the migration order:" -ForegroundColor Cyan
npm run db:migrations:check
npm run db:migrations:print

Write-Host "Apply Business Autopilot migrations when they have not already been applied:" -ForegroundColor Cyan
npm run db:migration:one -- 0021 --execute
npm run db:migration:one -- 0022 --execute

Write-Host "Refresh Worker route wiring and route catalogue metadata:" -ForegroundColor Cyan
npm run growth:wiring:apply
npm run growth:route-catalogue:apply

Write-Host "Run Business Operator / Growth backend checks:" -ForegroundColor Cyan
npm run business:autopilot:check
npm run business:autopilot:raw-error-safety:check
npm run business:people:docs:check
npm run business:website-pages:docs:check
npm run scripts:check
npm run check:local
npm run growth:backend:check:local

Write-Host "Print direct fallback verification commands if npm aliases ever look stale:" -ForegroundColor Cyan
node scripts/print-business-autopilot-readonly-verify-commands.mjs
node scripts/print-business-autopilot-route-contract-check.mjs
node scripts/print-growth-final-backend-validation.mjs

Write-Host "Print npm alias verification commands when package.json is current:" -ForegroundColor Cyan
npm run business:autopilot:readonly:print
npm run business:route-contract:print
npm run growth:backend:final:print

Write-Host "Deploy current Worker after checks pass:" -ForegroundColor Cyan
npm run deploy

Write-Host "Business Operator Worker runbook print complete." -ForegroundColor Green
`;

console.log(commands.trim());
