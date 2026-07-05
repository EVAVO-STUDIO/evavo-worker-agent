const commands = String.raw`
# EVAVO Growth backend final validation
# Run from PowerShell after migrations 0014 through 0021 are applied.
# This prints read-only contract checks plus optional metadata-only smoke flows, including route delegate checks, route safety flag checks, autonomous discovery metadata checks, autonomous discovery route-contract checks, Business Autopilot checks, Business website/page docs checks, and the internal review queue persistence check.
# Two-layer safety note: the Worker supplies the inner payload safety posture consumed by the Next read-only proxy UI and smoke checks.
# Autonomous discovery note: Worker owns zero-source discovery storage, read routes, confirm-required metadata routes, and route catalogue metadata. The Worker route-contract smoke now verifies autonomous discovery read IDs, confirm IDs, delegated read paths, and safe no-network / no-AI / no-email / no-social / no-form posture.
# Business Autopilot note: Worker owns Business agency memory, website/page metadata, read routes, confirm-required metadata routes, and route catalogue metadata. Website/page routes are metadata-only and do not crawl, fetch, send, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems.
# It does not send, post, submit, browse, call AI, execute browser actions, or perform external state changes.
# Aggregate expansion note: npm run growth:backend:check:local wraps the existing full local backend check.
# Existing full local backend check includes:
# npm run business:autopilot:check
# npm run business:website-pages:docs:check
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
npm run business:autopilot:check
npm run business:website-pages:docs:check
npm run growth:backend:check:local

Write-Host "Confirm Business Autopilot backend checks are included:" -ForegroundColor Cyan
Write-Host "- migrations/0021_business_autopilot_foundation.sql" -ForegroundColor Gray
Write-Host "- npm run business:autopilot:check" -ForegroundColor Gray
Write-Host "- npm run business:website-pages:docs:check" -ForegroundColor Gray
Write-Host "- business_websites" -ForegroundColor Gray
Write-Host "- business_pages" -ForegroundColor Gray
Write-Host "- business_website_save" -ForegroundColor Gray
Write-Host "- business_page_save" -ForegroundColor Gray
Write-Host "- /admin/business/websites?limit=5" -ForegroundColor Gray
Write-Host "- /admin/business/pages?limit=5" -ForegroundColor Gray
Write-Host "- metadata-only website/page routes" -ForegroundColor Gray

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
npm run business:route-contract:print

Write-Host "Print Business Autopilot read-only verification" -ForegroundColor Cyan
npm run business:autopilot:readonly:print

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
