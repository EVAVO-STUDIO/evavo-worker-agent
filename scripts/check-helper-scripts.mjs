import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const helperScripts = [
  'scripts/apply-growth-autonomous-discovery-route-catalogue.mjs',
  'scripts/apply-growth-campaign-analytics-route-catalogue.mjs',
  'scripts/apply-business-autopilot-route-catalogue.mjs',
  'scripts/apply-growth-operator-route-wiring.mjs',
  'scripts/apply-one-migration.mjs',
  'scripts/check-business-autopilot.mjs',
  'scripts/check-business-autopilot-raw-error-safety.mjs',
  'scripts/check-business-people-docs.mjs',
  'scripts/check-business-website-page-docs.mjs',
  'scripts/check-generated-route-wiring-clean.mjs',
  'scripts/check-growth-autonomous-discovery.mjs',
  'scripts/check-growth-backend-aggregate-command.mjs',
  'scripts/check-growth-blackboard.mjs',
  'scripts/check-growth-campaign-intelligence.mjs',
  'scripts/check-growth-capability-registry.mjs',
  'scripts/check-growth-review-queue.mjs',
  'scripts/check-growth-route-delegates.mjs',
  'scripts/check-growth-route-safety-flags.mjs',
  'scripts/check-growth-strategy-memory.mjs',
  'scripts/check-helper-scripts.mjs',
  'scripts/check-migrations-present.mjs',
  'scripts/check-repo-sync-status.mjs',
  'scripts/check-worker-powershell-runners.mjs',
  'scripts/print-business-autopilot-readonly-verify-commands.mjs',
  'scripts/print-business-autopilot-route-contract-check.mjs',
  'scripts/print-business-operator-worker-runbook.mjs',
  'scripts/print-d1-verification-commands.mjs',
  'scripts/print-generated-route-drift-resolution.mjs',
  'scripts/print-growth-backend-workflow-gate.mjs',
  'scripts/print-growth-blackboard-smoke-commands.mjs',
  'scripts/print-growth-campaign-intelligence-smoke-commands.mjs',
  'scripts/print-growth-final-backend-validation.mjs',
  'scripts/print-growth-route-contract-check.mjs',
  'scripts/print-growth-smoke-commands.mjs',
  'scripts/print-growth-strategy-memory-smoke-commands.mjs',
  'scripts/print-main-branch-audit.mjs',
  'scripts/print-migration-commands.mjs',
  'scripts/print-next-ops-smoke-commands.mjs',
  'scripts/print-worker-final-local-gate.mjs',
];

const powerShellRunners = [
  'Run-BusinessOperatorWorkerRunbook.ps1',
  'Run-WorkerFinalGate.ps1',
];

const sourceFiles = [
  'src/core/businessAutopilotPeopleRecords.ts',
  'src/core/businessAutopilotWebsiteRecords.ts',
  'src/routes/businessAutopilotPeopleAdmin.ts',
  'src/routes/businessAutopilotWebsiteAdmin.ts',
  'src/routes/businessAutopilotRouteCatalogue.ts',
  'src/core/growthApprovalRequests.ts',
  'src/core/growthAutonomousDiscovery.ts',
  'src/core/growthAutonomousDiscoveryRecords.ts',
  'src/core/growthAutonomousRuntime.ts',
  'src/core/growthBlackboard.ts',
  'src/core/growthCapabilities.ts',
  'src/core/growthCampaignAnalysis.ts',
  'src/core/growthCampaignIntelligence.ts',
  'src/core/growthCampaignDecisions.ts',
  'src/core/growthCampaignRecords.ts',
  'src/core/growthOperatorCycle.ts',
  'src/core/growthOperatorCycleEvents.ts',
  'src/core/growthOperatorLoop.ts',
  'src/core/growthStrategyMemory.ts',
  'src/routes/growthAdmin.ts',
  'src/routes/growthApprovalRequestsAdmin.ts',
  'src/routes/growthAutonomousDiscoveryAdmin.ts',
  'src/routes/growthAutonomousDiscoveryRouteCatalogue.ts',
  'src/routes/growthBlackboardAdmin.ts',
  'src/routes/growthCapabilitiesAdmin.ts',
  'src/routes/growthCampaignIntelligenceAdmin.ts',
  'src/routes/growthStrategyMemoryAdmin.ts',
  'src/routes/routeCataloguePlanner.ts',
  'src/routes/routeCatalogueTypes.ts',
];

const docs = [
  'README.md',
  'docs/business-autopilot-architecture.md',
  'docs/business-autopilot-governance-policy.md',
  'docs/business-autopilot-compliance-policy.md',
  'docs/business-autopilot-data-model.md',
  'docs/business-autopilot-validation.md',
  'docs/business-autopilot-people-routes.md',
  'docs/business-autopilot-website-page-routes.md',
  'docs/growth-autonomous-discovery-architecture.md',
  'docs/growth-backend-validation.md',
  'docs/growth-backend-workflow-gate.md',
  'docs/growth-blackboard.md',
  'docs/growth-capability-registry.md',
  'docs/growth-campaign-intelligence.md',
  'docs/growth-source-discovery-safety-policy.md',
  'docs/growth-strategy-memory.md',
  'docs/growth-zero-source-research-runbook.md',
  'migrations/0020_growth_autonomous_discovery.sql',
  'migrations/0021_business_autopilot_foundation.sql',
  'migrations/0022_business_website_audit_records.sql',
];

const businessAutopilotTableTokens = [
  'business_organizations',
  'business_people',
  'business_websites',
  'business_pages',
  'business_signals',
  'business_opportunities',
  'business_service_matches',
  'business_audit_packs',
  'business_action_drafts',
  'business_approval_requests',
  'business_execution_records',
  'business_suppression_list',
  'business_content_ideas',
  'business_content_calendar',
  'business_followups',
  'business_learning_events',
];

const autonomousDiscoveryRouteTokens = [
  'growth_research_runs',
  'growth_source_candidates',
  'growth_extracted_signals',
  'growth_opportunity_scores',
  'growth_agent_decisions',
  'growth_discovery_feedback',
  'growth_research_run_plan',
  'growth_source_candidate_save',
  'growth_fetch_queue_enqueue',
  'growth_agent_decision_record',
  'growth_discovery_feedback_save',
];

const predeployCommand = 'npm run git:sync:check && npm run growth:generated-routes:check && npm run worker:powershell:check && npm run growth:backend:aggregate:check && npm run check:local';

const expectedPackageScripts = {
  predeploy: predeployCommand,
  deploy: 'wrangler deploy',
  'db:migration:one': 'node scripts/apply-one-migration.mjs',
  'db:migrations:check': 'node scripts/check-migrations-present.mjs',
  'db:migrations:print': 'node scripts/print-migration-commands.mjs',
  'db:verify:print': 'node scripts/print-d1-verification-commands.mjs',
  'git:main-audit:print': 'node scripts/print-main-branch-audit.mjs',
  'git:sync:check': 'node scripts/check-repo-sync-status.mjs',
  'business:autopilot:check': 'node scripts/check-business-autopilot.mjs',
  'business:autopilot:raw-error-safety:check': 'node scripts/check-business-autopilot-raw-error-safety.mjs',
  'business:autopilot:readonly:print': 'node scripts/print-business-autopilot-readonly-verify-commands.mjs',
  'business:operator:runbook:print': 'node scripts/print-business-operator-worker-runbook.mjs',
  'business:people:docs:check': 'node scripts/check-business-people-docs.mjs',
  'business:route-contract:print': 'node scripts/print-business-autopilot-route-contract-check.mjs',
  'business:website-pages:docs:check': 'node scripts/check-business-website-page-docs.mjs',
  'growth:autonomous-discovery:check': 'node scripts/check-growth-autonomous-discovery.mjs',
  'growth:backend:aggregate:check': 'node scripts/check-growth-backend-aggregate-command.mjs',
  'growth:backend:check:local': 'npm run growth:backend:aggregate:check && npm run check:local',
  'growth:backend:final:print': 'node scripts/print-growth-final-backend-validation.mjs',
  'growth:backend:workflow:print': 'node scripts/print-growth-backend-workflow-gate.mjs',
  'growth:blackboard:check': 'node scripts/check-growth-blackboard.mjs',
  'growth:blackboard:smoke:print': 'node scripts/print-growth-blackboard-smoke-commands.mjs',
  'growth:campaigns:check': 'node scripts/check-growth-campaign-intelligence.mjs',
  'growth:campaigns:smoke:print': 'node scripts/print-growth-campaign-intelligence-smoke-commands.mjs',
  'growth:capabilities:check': 'node scripts/check-growth-capability-registry.mjs',
  'growth:generated-routes:check': 'node scripts/check-generated-route-wiring-clean.mjs',
  'growth:generated-routes:resolve:print': 'node scripts/print-generated-route-drift-resolution.mjs',
  'growth:review-queue:check': 'node scripts/check-growth-review-queue.mjs',
  'growth:route-catalogue:apply': 'node scripts/apply-growth-campaign-analytics-route-catalogue.mjs && node scripts/apply-growth-autonomous-discovery-route-catalogue.mjs && node scripts/apply-business-autopilot-route-catalogue.mjs',
  'growth:route-contract:print': 'node scripts/print-growth-route-contract-check.mjs',
  'growth:route-delegates:check': 'node scripts/check-growth-route-delegates.mjs',
  'growth:route-safety-flags:check': 'node scripts/check-growth-route-safety-flags.mjs',
  'growth:smoke:print': 'node scripts/print-growth-smoke-commands.mjs',
  'growth:strategy:check': 'node scripts/check-growth-strategy-memory.mjs',
  'growth:strategy:smoke:print': 'node scripts/print-growth-strategy-memory-smoke-commands.mjs',
  'growth:wiring:apply': 'node scripts/apply-growth-operator-route-wiring.mjs',
  'ops:smoke:print': 'node scripts/print-next-ops-smoke-commands.mjs',
  'worker:final-gate:print': 'node scripts/print-worker-final-local-gate.mjs',
  'worker:powershell:check': 'node scripts/check-worker-powershell-runners.mjs',
  'scripts:check': 'node scripts/check-helper-scripts.mjs',
  'check:local': 'npm run scripts:check && npm run db:migrations:check && npm run business:autopilot:check && npm run business:autopilot:raw-error-safety:check && npm run business:people:docs:check && npm run business:website-pages:docs:check && npm run worker:powershell:check && npm run growth:route-delegates:check && npm run growth:route-safety-flags:check && npm run growth:capabilities:check && npm run growth:campaigns:check && npm run growth:strategy:check && npm run growth:blackboard:check && npm run growth:review-queue:check && npm run growth:autonomous-discovery:check && npm run typecheck',
};

const requiredTokens = {
  'README.md': ['Autonomous discovery is research-memory-first and supervised-action only.', 'Business Autopilot agency memory', 'business:operator:runbook:print', 'node scripts/print-business-operator-worker-runbook.mjs', 'business analyst / sales strategist / BDM / growth manager / operator brain', 'Internal automation can reason, score, prioritise, draft and learn; external execution remains confirm-gated and disabled by default.', 'Run-WorkerFinalGate.ps1'],
  'docs/business-autopilot-data-model.md': ['EVAVO Business Autopilot data model', 'Website/page relationship layer', 'People route layer', 'business_people', 'business_person_save', 'allowed_use', 'contact_status', 'People/contact-context relationship', 'business_websites', 'business_pages', 'business_website_save', 'business_page_save', 'business_website_audit_runs', 'business_audit_observations', 'business_audit_observation_candidates', 'no crawling', 'no fetching', ...businessAutopilotTableTokens],
  'docs/business-autopilot-validation.md': ['Business Autopilot validation workflow', 'business_people', 'business_person_save', '/admin/business/people?limit=5', 'business:website-pages:docs:check', 'business_websites', 'business_pages', 'business_website_save', 'business_page_save'],
  'docs/business-autopilot-people-routes.md': ['Business Autopilot people routes', 'business_people', 'business_person_save', 'GET /admin/business/people?limit=25', 'POST /admin/business/people?confirm=1', 'allowed_use', 'contact_status'],
  'docs/business-autopilot-website-page-routes.md': ['Business Autopilot website and page routes', 'business_websites', 'business_pages', 'business_website_save', 'business_page_save', 'GET /admin/business/websites?limit=25', 'GET /admin/business/pages?limit=25', 'GET /admin/business/audit-observation-candidates?limit=25'],
  'docs/growth-backend-validation.md': ['Business website/page docs checks', 'npm run business:website-pages:docs:check', 'Business website/page metadata route docs', 'npm run worker:powershell:check', 'npm run growth:generated-routes:check', 'worker:final-gate:print', 'Run-WorkerFinalGate.ps1'],
  'docs/business-autopilot-architecture.md': ['EVAVO Business Autopilot architecture', ...businessAutopilotTableTokens],
  'migrations/0021_business_autopilot_foundation.sql': ['Business Autopilot foundation metadata schema', ...businessAutopilotTableTokens.map((table) => `CREATE TABLE IF NOT EXISTS ${table}`)],
  'migrations/0022_business_website_audit_records.sql': ['Business website/funnel audit metadata schema', 'CREATE TABLE IF NOT EXISTS business_website_audit_runs', 'CREATE TABLE IF NOT EXISTS business_audit_observations'],
  'scripts/check-business-people-docs.mjs': ['Business people docs check passed.', 'docs/business-autopilot-people-routes.md', 'docs/business-autopilot-data-model.md', 'docs/business-autopilot-validation.md'],
  'scripts/check-business-website-page-docs.mjs': ['Business website/page docs check passed.', 'docs/business-autopilot-data-model.md', 'docs/business-autopilot-website-page-routes.md', 'docs/business-autopilot-validation.md', 'audit-observation-candidates'],
  'scripts/check-business-autopilot.mjs': ['Business Autopilot foundation check passed.', 'business_people', 'business_person_save', 'src/core/businessAutopilotPeopleRecords.ts', 'src/routes/businessAutopilotPeopleAdmin.ts', 'business_websites', 'business_pages', 'docs/business-autopilot-website-page-routes.md', 'record.contentHash'],
  'scripts/check-business-autopilot-raw-error-safety.mjs': ['Business Autopilot raw-error safety check passed.', 'Business website/page route failed before a safe response could be returned.', 'business_website_failed'],
  'scripts/check-generated-route-wiring-clean.mjs': ['Generated route wiring clean check passed.', 'src/index.ts', 'src/routes/routeCataloguePlanner.ts', 'generated route wiring files are clean'],
  'scripts/check-repo-sync-status.mjs': ['Repository sync check passed.', 'git', 'fetch', 'origin', 'Local HEAD matches origin branch'],
  'scripts/check-worker-powershell-runners.mjs': ['Worker PowerShell runner check passed.', 'Run-BusinessOperatorWorkerRunbook.ps1', 'Run-WorkerFinalGate.ps1', 'Invoke-Checked npm run git:sync:check', 'Migrations 0021 and 0022 should not be rerun'],
  'scripts/check-migrations-present.mjs': ['0021_business_autopilot_foundation.sql', '0022_business_website_audit_records.sql'],
  'migrations/README.md': ['0021_business_autopilot_foundation.sql', '0022_business_website_audit_records.sql', 'Business Autopilot metadata foundation', 'Business website/funnel audit metadata'],
  'scripts/print-business-autopilot-readonly-verify-commands.mjs': ['EVAVO Business Autopilot read-only verification', 'Assert-BusinessRead', '/admin/business/audit-observation-candidates?limit=5', 'does not send, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems'],
  'scripts/print-business-autopilot-route-contract-check.mjs': ['EVAVO Business Autopilot route-contract smoke check', 'business_audit_observation_candidates', '/admin/business/audit-observation-candidates?limit=5', 'All Business Autopilot read routes advertise readOnly'],
  'scripts/print-business-operator-worker-runbook.mjs': ['EVAVO Business Operator Worker runbook', 'business analyst / sales strategist / BDM / growth manager / operator brain', 'npm run db:migration:one -- 0021 --execute', 'npm run db:migration:one -- 0022 --execute', 'node scripts/print-business-autopilot-readonly-verify-commands.mjs', 'npm run business:autopilot:readonly:print', 'external execution remains confirm-gated and disabled by default'],
  'scripts/print-generated-route-drift-resolution.mjs': ['EVAVO generated route wiring drift resolution', 'npm run growth:wiring:apply', 'npm run growth:route-catalogue:apply', 'git restore src/index.ts src/routes/routeCataloguePlanner.ts'],
  'scripts/print-worker-final-local-gate.mjs': ['EVAVO Worker final local gate', 'Do not rerun 0021 or 0022', 'npm run check:local', 'npm run growth:backend:check:local', 'npm run db:verify:print', 'npm run deploy'],
  'Run-WorkerFinalGate.ps1': ['EVAVO Worker final local gate', 'does not run migrations', 'Invoke-Checked npm run git:sync:check', 'npm run scripts:check', 'npm run growth:backend:check:local', 'npm run growth:generated-routes:check', 'npm run db:verify:print', 'npm run deploy'],
  'Run-BusinessOperatorWorkerRunbook.ps1': ['EVAVO Business Operator Worker runbook', 'npm run growth:backend:check:local', 'npm run db:verify:print', 'npm run deploy'],
  'docs/growth-autonomous-discovery-architecture.md': ['Growth autonomous discovery architecture', 'source candidate registry', ...autonomousDiscoveryRouteTokens],
  'migrations/0020_growth_autonomous_discovery.sql': ['CREATE TABLE IF NOT EXISTS growth_research_runs', 'CREATE TABLE IF NOT EXISTS growth_source_candidates'],
};

let failed = false;
const fail = (message) => { failed = true; console.error(`FAIL ${message}`); };
const pass = (message) => console.log(`OK   ${message}`);

for (const relativePath of [...helperScripts, ...powerShellRunners, ...sourceFiles, ...docs]) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) fail(`${relativePath} is missing`);
  else pass(`${relativePath} exists`);
}

for (const relativePath of helperScripts) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) continue;
  const result = spawnSync(process.execPath, ['--check', absolutePath], { encoding: 'utf8' });
  if (result.status === 0) pass(`${relativePath} parses`);
  else fail(`${relativePath} does not parse: ${result.stderr || result.stdout}`);
}

for (const [relativePath, tokens] of Object.entries(requiredTokens)) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) continue;
  const content = fs.readFileSync(absolutePath, 'utf8');
  for (const token of tokens) {
    if (content.includes(token)) pass(`${relativePath} contains ${token}`);
    else fail(`${relativePath} missing ${token}`);
  }
}

const packageJsonPath = path.join(repoRoot, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const scripts = packageJson.scripts || {};
  for (const [scriptName, expectedCommand] of Object.entries(expectedPackageScripts)) {
    if (scripts[scriptName] === expectedCommand) pass(`package.json script ${scriptName} is wired`);
    else fail(`package.json script ${scriptName} is not wired to ${expectedCommand}`);
  }
  for (const step of ['npm run git:sync:check', 'npm run growth:generated-routes:check', 'npm run worker:powershell:check', 'npm run growth:backend:aggregate:check', 'npm run check:local']) {
    if (scripts.predeploy?.includes(step)) pass(`predeploy includes ${step}`);
    else fail(`predeploy missing ${step}`);
  }
}

if (failed) {
  console.error('Helper script check failed.');
  process.exit(1);
}

console.log('Helper script check passed.');
