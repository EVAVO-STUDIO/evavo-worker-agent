const commands = String.raw`
# EVAVO Growth backend final validation
# Run from PowerShell after migrations 0014 through 0020 are applied.
# This prints read-only contract checks plus optional metadata-only smoke flows, including route delegate checks, route safety flag checks, autonomous discovery metadata checks, autonomous discovery route-contract checks, and the internal review queue persistence check.
# Two-layer safety note: the Worker supplies the inner payload safety posture consumed by the Next read-only proxy UI and smoke checks.
# Autonomous discovery note: Worker owns zero-source discovery storage, read routes, confirm-required metadata routes, and route catalogue metadata. The Worker route-contract smoke now verifies autonomous discovery read IDs, confirm IDs, delegated read paths, and safe no-network / no-AI / no-email / no-social / no-form posture.
# It does not send, post, submit, browse, call AI, execute browser actions, or perform external state changes.
# Aggregate expansion note: npm run growth:backend:check:local wraps the existing full local backend check.
# Existing full local backend check includes:
# npm run growth:route-delegates:check
# npm run growth:route-safety-flags:check
# npm run growth:review-queue:check
# npm run growth:autonomous-discovery:check
# npm run check:local

cd C:\GitRepos\evavo-worker-agent

git pull
npm run growth:backend:workflow:print
npm run growth:wiring:apply
npm run growth:route-catalogue:apply
npm run growth:backend:check:local

Write-Host "Confirm autonomous discovery backend checks are included:" -ForegroundColor Cyan
Write-Host "- migrations/0020_growth_autonomous_discovery.sql" -ForegroundColor Gray
Write-Host "- npm run growth:autonomous-discovery:check" -ForegroundColor Gray
Write-Host "- growth_research_runs" -ForegroundColor Gray
Write-Host "- growth_source_candidates" -ForegroundColor Gray
Write-Host "- growth_extracted_signals" -ForegroundColor Gray
Write-Host "- growth_opportunity_scores" -ForegroundColor Gray
Write-Host "- growth_agent_decisions" -ForegroundColor Gray
Write-Host "- growth_discovery_feedback" -ForegroundColor Gray
Write-Host "- growth_research_run_plan" -ForegroundColor Gray
Write-Host "- growth_source_candidate_save" -ForegroundColor Gray
Write-Host "- growth_fetch_queue_enqueue" -ForegroundColor Gray
Write-Host "- growth_agent_decision_record" -ForegroundColor Gray
Write-Host "- growth_discovery_feedback_save" -ForegroundColor Gray
Write-Host "- canPostSocial false and canSubmitForms false route defaults" -ForegroundColor Gray

if (-not $env:WORKER_URL) { $env:WORKER_URL = "https://evavo-outbound-agent.evavo-studio.workers.dev" }
if (-not $env:ADMIN_TOKEN) { throw "Set ADMIN_TOKEN first." }

Write-Host "Deploy current Worker" -ForegroundColor Cyan
npm run deploy

Write-Host "Print route contract smoke" -ForegroundColor Cyan
npm run growth:route-contract:print

Write-Host "Print campaign intelligence smoke" -ForegroundColor Cyan
npm run growth:campaigns:smoke:print

Write-Host "Print strategy memory smoke" -ForegroundColor Cyan
npm run growth:strategy:smoke:print

Write-Host "Print blackboard smoke" -ForegroundColor Cyan
npm run growth:blackboard:smoke:print

Write-Host "Final backend validation command print complete." -ForegroundColor Green
Write-Host "Copy and run the printed smoke command blocks above in this same PowerShell session." -ForegroundColor Yellow
`;

console.log(commands.trim());
