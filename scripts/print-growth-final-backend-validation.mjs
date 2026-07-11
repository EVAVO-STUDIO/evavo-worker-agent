const commands = String.raw`
# EVAVO Growth backend final validation
# Run from PowerShell after migrations 0014 through 0022 are applied.
# This prints read-only contract checks plus optional metadata-only smoke flows, including route delegate checks, route safety flag checks, autonomous discovery metadata checks, autonomous discovery route-contract checks, Business Autopilot checks, Business Autopilot raw-error safety checks, Business people docs checks, Business website/page/audit docs checks, and the internal review queue persistence check.
# Business operator model: the Worker is the metadata and reasoning foundation for a combined business analyst, sales strategist, BDM, growth manager and operator brain.
# Safe automation boundary: the Worker may automate internal discovery planning, scoring, prioritisation, audit observations, draft preparation, next-move reasoning and learning, but external execution remains confirm-gated and disabled by default.
# Two-layer safety note: the Worker supplies the inner payload safety posture consumed by the Next read-only proxy UI and smoke checks.
# Worker error-safety note: Business Autopilot Worker routes must return generic browser/API-safe errors, not raw thrown database/runtime error messages.
# Autonomous discovery note: Worker owns zero-source discovery storage, read routes, confirm-required metadata routes, and route catalogue metadata. The Worker route-contract smoke now verifies autonomous discovery read IDs, confirm IDs, delegated read paths, and safe no-network / no-AI / no-email / no-social / no-form posture.
# Business Autopilot note: Worker owns Business agency memory, people metadata, website/page metadata, website/funnel audit metadata, audit observation metadata, read routes, confirm-required metadata routes, computed observation candidates, and route catalogue metadata. People routes are contact-context metadata only. Website/page/audit routes are metadata-only and do not crawl, fetch, send, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems.
# It does not send, post, submit, browse, call AI, execute browser actions, or perform external state changes.
# Aggregate expansion note: npm run growth:backend:check:local wraps the existing full local backend check.
# Existing full local backend check includes:
# npm run business:autopilot:check
# npm run business:autopilot:raw-error-safety:check
# npm run business:people:docs:check
# npm run business:website-pages:docs:check
# npm run growth:route-delegates:check
# npm run growth:route-safety-flags:check
# npm run growth:review-queue:check
# npm run growth:autonomous-discovery:check
# npm run check:local

cd C:\GitRepos\evavo-worker-agent

git pull
npm run growth:backend:workflow:print
npm run db:migrations:check
npm run db:migrations:print
npm run growth:wiring:apply
npm run growth:route-catalogue:apply
npm run business:autopilot:check
npm run business:autopilot:raw-error-safety:check
npm run business:people:docs:check
npm run business:website-pages:docs:check
npm run growth:backend:check:local

Write-Host "Confirm Business Autopilot backend checks are included:" -ForegroundColor Cyan
Write-Host "- migrations/0021_business_autopilot_foundation.sql" -ForegroundColor Gray
Write-Host "- migrations/0022_business_website_audit_records.sql" -ForegroundColor Gray
Write-Host "- npm run db:migrations:check" -ForegroundColor Gray
Write-Host "- npm run db:migrations:print" -ForegroundColor Gray
Write-Host "- npm run business:autopilot:check" -ForegroundColor Gray
Write-Host "- npm run business:autopilot:raw-error-safety:check" -ForegroundColor Gray
Write-Host "- generic Worker root and Business Autopilot route errors" -ForegroundColor Gray
Write-Host "- no raw String(error), String(err), error.message or err.message public error payloads" -ForegroundColor Gray
Write-Host "- npm run business:people:docs:check" -ForegroundColor Gray
Write-Host "- npm run business:website-pages:docs:check" -ForegroundColor Gray
Write-Host "- business_people" -ForegroundColor Gray
Write-Host "- business_person_save" -ForegroundColor Gray
Write-Host "- business_websites" -ForegroundColor Gray
Write-Host "- business_pages" -ForegroundColor Gray
Write-Host "- business_website_audit_runs" -ForegroundColor Gray
Write-Host "- business_audit_observations" -ForegroundColor Gray
Write-Host "- business_audit_observation_candidates" -ForegroundColor Gray
Write-Host "- business_website_save" -ForegroundColor Gray
Write-Host "- business_page_save" -ForegroundColor Gray
Write-Host "- business_website_audit_run_save" -ForegroundColor Gray
Write-Host "- business_audit_observation_save" -ForegroundColor Gray
Write-Host "- /admin/business/people?limit=5" -ForegroundColor Gray
Write-Host "- /admin/business/websites?limit=5" -ForegroundColor Gray
Write-Host "- /admin/business/pages?limit=5" -ForegroundColor Gray
Write-Host "- /admin/business/website-audit-runs?limit=5" -ForegroundColor Gray
Write-Host "- /admin/business/audit-observations?limit=5" -ForegroundColor Gray
Write-Host "- /admin/business/audit-observation-candidates?limit=5" -ForegroundColor Gray
Write-Host "- metadata-only people, website/page, website/funnel audit, audit observation and observation candidate routes" -ForegroundColor Gray
Write-Host "- business analyst / sales strategist / BDM / growth manager / operator brain role" -ForegroundColor Gray
Write-Host "- internal automation can reason, score, prioritise, draft and learn" -ForegroundColor Gray
Write-Host "- external execution remains confirm-gated and disabled by default" -ForegroundColor Gray

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