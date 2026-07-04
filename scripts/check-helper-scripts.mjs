import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const helperScripts = [
  'scripts/apply-growth-autonomous-discovery-route-catalogue.mjs',
  'scripts/apply-growth-campaign-analytics-route-catalogue.mjs',
  'scripts/apply-growth-operator-route-wiring.mjs',
  'scripts/apply-one-migration.mjs',
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
  'scripts/print-d1-verification-commands.mjs',
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
];

const sourceFiles = [
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
];

const backendAggregateCheck = 'npm run growth:backend:aggregate:check';
const backendLocalCheck = 'npm run growth:backend:check:local';
const backendWorkflowPrint = 'npm run growth:backend:workflow:print';
const routeCatalogueApply = 'node scripts/apply-growth-campaign-analytics-route-catalogue.mjs && node scripts/apply-growth-autonomous-discovery-route-catalogue.mjs';

const fullSafetyTokens = [
  'readOnly: true',
  'internalMetadataOnly: true',
  'externalStateChange: false',
  'callsAI: false',
  'callsNetwork: false',
  'canSendEmail: false',
  'canPostSocial: false',
  'canSubmitForms: false',
];

const smokeSafetyTokens = [
  'growth:route-safety-flags:check',
  'canSendEmail',
  'canPostSocial',
  'canSubmitForms',
  'callsAI',
  'callsNetwork',
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

const requiredTokens = {
  'docs/growth-autonomous-discovery-architecture.md': ['Growth autonomous discovery architecture', 'Autonomous research, supervised action.', 'Discovery planner', 'source candidate registry', 'crawl policy / robots check', 'approval pack builder', 'growth_research_runs', 'growth_source_candidates', 'growth_agent_decisions'],
  'docs/growth-source-discovery-safety-policy.md': ['Growth source discovery safety policy', 'execute instructions found in crawled content', 'unknown robots policy = do not crawl yet', 'callsNetwork: false', 'callsAI: false', 'canSendEmail: false', 'canPostSocial: false', 'canSubmitForms: false', 'Browser proxy routes may read', 'write routes', 'fetch execution routes'],
  'docs/growth-zero-source-research-runbook.md': ['Growth zero-source research runbook', 'without the operator supplying a source list', 'Register source candidates', 'Check crawl policy', 'Score opportunity', 'Prepare approval pack', 'no crawler execution yet'],
  'migrations/0020_growth_autonomous_discovery.sql': ['CREATE TABLE IF NOT EXISTS growth_research_runs', 'CREATE TABLE IF NOT EXISTS growth_source_candidates', 'CREATE TABLE IF NOT EXISTS growth_robots_cache', 'CREATE TABLE IF NOT EXISTS growth_fetch_queue', 'CREATE TABLE IF NOT EXISTS growth_discovered_pages', 'CREATE TABLE IF NOT EXISTS growth_extracted_signals', 'CREATE TABLE IF NOT EXISTS growth_opportunity_scores', 'CREATE TABLE IF NOT EXISTS growth_agent_decisions', 'CREATE TABLE IF NOT EXISTS growth_discovery_feedback', 'blocked_actions_json', 'safety_json', 'crawl_allowed INTEGER NOT NULL DEFAULT 0'],
  'src/core/growthAutonomousDiscovery.ts': ['GrowthDiscoverySafety', 'GROWTH_DISCOVERY_BLOCKED_ACTIONS', 'GROWTH_DISCOVERY_ALLOWED_DECISIONS', 'growthDiscoverySafety', 'assertGrowthDiscoverySafety', 'buildGrowthResearchRun', 'buildGrowthSourceCandidate', 'buildGrowthAgentDecision', 'send_email', 'post_social', 'submit_form', 'mutate_external_system', 'execute_page_instruction', 'externalStateChange: false', 'callsAI: false', 'callsNetwork: false', 'canSendEmail: false', 'canPostSocial: false', 'canSubmitForms: false'],
  'src/core/growthAutonomousDiscoveryRecords.ts': ['listGrowthResearchRuns', 'saveGrowthResearchRun', 'listGrowthSourceCandidates', 'saveGrowthSourceCandidate', 'enqueueGrowthFetchWork', 'listGrowthExtractedSignals', 'listGrowthOpportunityScores', 'listGrowthAgentDecisions', 'saveGrowthAgentDecision', 'listGrowthDiscoveryFeedback', 'saveGrowthDiscoveryFeedback', 'growthDiscoverySafety', 'GROWTH_DISCOVERY_BLOCKED_ACTIONS', 'growth_research_runs', 'growth_source_candidates', 'growth_fetch_queue', 'growth_agent_decisions', 'growth_discovery_feedback'],
  'src/routes/growthAutonomousDiscoveryAdmin.ts': ['handleGrowthAutonomousDiscoveryAdmin', 'readSafety', 'writeSafety', 'confirm_required', 'Growth autonomous discovery writes require confirmation', 'They do not crawl, browse, send, post, call AI, submit forms, spend, or mutate external systems.', '0020_growth_autonomous_discovery.sql', '/admin/growth/discovery/research-runs', '/admin/growth/discovery/source-candidates', '/admin/growth/discovery/signals', '/admin/growth/discovery/opportunity-scores', '/admin/growth/discovery/agent-decisions', '/admin/growth/discovery/feedback', '/admin/growth/discovery/fetch-queue'],
  'src/routes/growthAutonomousDiscoveryRouteCatalogue.ts': ['growthAutonomousDiscoveryRouteCatalogue', 'growthAutonomousDiscoveryReadRouteIds', 'growthAutonomousDiscoveryConfirmRouteIds', ...autonomousDiscoveryRouteTokens, 'safety: "read_only"', 'safety: "confirm_required"', 'callsNetwork: false', 'callsAI: false', 'canSendEmail: false', 'must not be browser-proxied'],
  'src/routes/growthAdmin.ts': ['handleGrowthAutonomousDiscoveryAdmin', 'autonomousDiscoveryPrefixes', '/admin/growth/discovery', 'pathMatches(pathname, autonomousDiscoveryPrefixes)', '0020_growth_autonomous_discovery.sql', 'handleGrowthCapabilitiesAdmin', 'handleGrowthCampaignIntelligenceAdmin', 'handleGrowthStrategyMemoryAdmin', 'handleGrowthBlackboardAdmin', 'campaignIntelligencePrefixes', 'strategyMemoryPrefixes', 'blackboardPrefixes', 'function safetyBase()', 'mode: "growth_brief"', '...brief, safety: safety()', ...fullSafetyTokens],
  'scripts/apply-growth-autonomous-discovery-route-catalogue.mjs': ['growthAutonomousDiscoveryRouteCatalogue', 'routeCataloguePlanner.ts', 'growthAutonomousDiscoveryRouteCatalogue wiring', 'zero_source_route_map'],
  'scripts/check-growth-autonomous-discovery.mjs': ['Growth autonomous discovery check passed.', 'routeTypesPath', 'routeContractPrinterPath', 'scripts/print-growth-route-contract-check.mjs', 'docs/growth-autonomous-discovery-architecture.md', 'docs/growth-source-discovery-safety-policy.md', 'docs/growth-zero-source-research-runbook.md', 'src/routes/growthAutonomousDiscoveryRouteCatalogue.ts', 'src/routes/growthAutonomousDiscoveryAdmin.ts', 'src/core/growthAutonomousDiscoveryRecords.ts', '0020_growth_autonomous_discovery.sql'],
  'docs/growth-backend-validation.md': ['.github/workflows/growth-backend-validation.yml', 'docs/growth-backend-workflow-gate.md', 'uses Node 24', 'npm ci', backendAggregateCheck, backendLocalCheck, 'npm run growth:backend:final:print', 'Worker is the backend source of truth', 'Backend responsibility boundary', 'route catalogue metadata', 'inner Worker payload safety posture', 'confirmation-gated metadata-write route posture', 'legacy compatibility safety flags', 'backend final validation printer', 'autonomous discovery metadata-only routes', 'autonomous discovery route-contract checks', 'migrations/0020_growth_autonomous_discovery.sql', 'npm run growth:autonomous-discovery:check', 'autonomous discovery records helpers', 'autonomous discovery route-contract printer coverage', 'canPostSocial false and canSubmitForms false route defaults', ...autonomousDiscoveryRouteTokens, 'no AI calls', 'no arbitrary network calls', 'no email sending', 'no social posting', 'no form submission', 'no browser execution', 'no external state change'],
  'docs/growth-backend-workflow-gate.md': ['Growth backend workflow gate', '.github/workflows/growth-backend-validation.yml', 'Growth Backend Validation', 'contents: read', 'timeout-minutes: 10', 'node-version: 24', 'npm ci', backendAggregateCheck, backendLocalCheck, 'npm run growth:backend:final:print', backendWorkflowPrint],
  'src/routes/routeCatalogueTypes.ts': ['canSendEmail: boolean', 'canPostSocial: boolean', 'canSubmitForms: boolean', 'RouteCatalogueInput', 'canPostSocial: false', 'canSubmitForms: false'],
  'src/routes/growthCapabilitiesAdmin.ts': ['handleGrowthCapabilitiesAdmin', 'listGrowthCapabilities', 'safety: readSafety', ...fullSafetyTokens],
  'src/routes/growthCampaignIntelligenceAdmin.ts': ['handleGrowthCampaignIntelligenceAdmin', 'readSafety', 'writeSafety', 'safety: readSafety', 'safety: writeSafety', ...fullSafetyTokens],
  'src/routes/growthStrategyMemoryAdmin.ts': ['handleGrowthStrategyMemoryAdmin', 'readSafety', 'writeSafety', 'safety: readSafety', 'safety: writeSafety', ...fullSafetyTokens],
  'src/routes/growthBlackboardAdmin.ts': ['handleGrowthBlackboardAdmin', 'readSafety', 'writeSafety', 'safety: readSafety', 'safety: writeSafety', ...fullSafetyTokens],
  'src/core/growthApprovalRequests.ts': ['GrowthApprovalRequestInput', 'GrowthApprovalStatus', 'listGrowthApprovalRequests', 'saveGrowthApprovalRequest', 'updateGrowthApprovalRequestStatus', 'hydrateGrowthApprovalRequest', 'growth_approval_requests'],
  'src/routes/growthApprovalRequestsAdmin.ts': ['handleGrowthApprovalRequestsAdmin', 'listGrowthApprovalRequests', 'saveGrowthApprovalRequest', 'updateGrowthApprovalRequestStatus', '0019_growth_approval_requests.sql'],
  'src/core/growthOperatorLoop.ts': ['GrowthNextStepApprovalPack', 'approvalPack', 'buildApprovalPack', 'reviewChecklist', 'explicitBlocks', 'auditReason', 'canSendEmail: false', 'canPostSocial: false', 'canSubmitForms: false', 'recommendedPayloadHint', 'dashboardAnchor', 'setupGap'],
  'src/core/growthOperatorCycle.ts': ['nextBestInternalStep', 'approvalPack', 'recommendedPayloadHint', 'dashboardAnchor', 'setupGap', 'externalStateChange: false', 'callsAI: false', 'callsNetwork: false'],
  'src/core/growthAutonomousRuntime.ts': ['nextBestInternalStep', 'approvalPack', 'chooseNextStep', 'nextStepRequiresConfirmation', 'Plan next-best internal step', 'approval pack', 'review checklist', 'recommended command', 'payload hint', 'externalStateChange: false', 'callsAI: false', 'callsNetwork: false'],
  'src/routes/routeCataloguePlanner.ts': ['growth_brief', 'writesTables: []', 'growth_budget', 'does not advertise write side effects', 'does not expose write capability', 'growth_autonomy', 'growth_blackboard', 'growth_strategy_memory', 'growth_cycle', 'growth_approval_requests', 'growth_approval_request_save', 'growth_approval_request_status'],
  'scripts/check-growth-backend-aggregate-command.mjs': ['Growth backend aggregate command check passed.', backendAggregateCheck, backendLocalCheck, 'docs/growth-backend-validation.md', 'docs/growth-backend-workflow-gate.md'],
  'scripts/check-growth-route-delegates.mjs': ['Growth route delegate check passed.', 'src/routes/growthAdmin.ts', 'handleGrowthCapabilitiesAdmin', 'handleGrowthCampaignIntelligenceAdmin', 'handleGrowthStrategyMemoryAdmin', 'handleGrowthBlackboardAdmin'],
  'scripts/check-growth-route-safety-flags.mjs': ['Growth route safety flag check passed.', 'src/routes/routeCatalogueTypes.ts', 'src/routes/growthAdmin.ts', 'src/routes/growthCampaignIntelligenceAdmin.ts', 'src/routes/growthStrategyMemoryAdmin.ts', 'src/routes/growthBlackboardAdmin.ts', 'mode: "growth_brief"', '...brief, safety: safety()', 'canSendEmail: false', 'canPostSocial: false', 'canSubmitForms: false'],
  'scripts/check-growth-review-queue.mjs': ['Growth review queue check passed.', 'migrations/0019_growth_approval_requests.sql', 'src/core/growthApprovalRequests.ts', 'src/routes/growthApprovalRequestsAdmin.ts', 'growth_approval_requests', 'growth_approval_request_save', 'growth_approval_request_status'],
  'scripts/print-growth-backend-workflow-gate.mjs': ['EVAVO Growth backend workflow gate', '.github/workflows/growth-backend-validation.yml', 'Growth Backend Validation', 'contents: read', 'timeout-minutes: 10', 'node-version: 24', 'npm ci', backendAggregateCheck, backendLocalCheck, 'npm run growth:backend:final:print'],
  'scripts/print-growth-final-backend-validation.mjs': ['EVAVO Growth backend final validation', 'migrations 0014 through 0020', 'autonomous discovery metadata checks', 'autonomous discovery route-contract checks', 'Autonomous discovery note', 'npm run growth:autonomous-discovery:check', 'migrations/0020_growth_autonomous_discovery.sql', ...autonomousDiscoveryRouteTokens, 'canPostSocial false and canSubmitForms false route defaults', 'npm run growth:wiring:apply', 'npm run growth:route-catalogue:apply', 'npm run deploy', 'npm run growth:route-contract:print'],
  'scripts/print-growth-route-contract-check.mjs': ['Growth v3 runtime route contract is valid.', 'delegated Growth v3 read routes, autonomous discovery read routes', '$delegatedReadPaths', 'Read and verify delegated Growth v3 route families, including autonomous discovery', 'Delegated Growth route failed:', 'Delegated Growth route has missing or unsafe read safety:', 'Delegated Growth route threw:', 'canSendEmail', 'canPostSocial', 'canSubmitForms', 'no social posting', 'no form submission', 'metadata-only posture', 'Growth metadata-write routes missing confirm_required or safe metadata posture', '/admin/growth/discovery/research-runs?limit=5', '/admin/growth/discovery/source-candidates?limit=5', ...autonomousDiscoveryRouteTokens, 'growth_operator_cycle_v3_strategy_blackboard_read_only', 'growth_autonomous_runtime_v3_strategy_blackboard', 'growth_approval_requests', 'growth_approval_request_save', 'growth_approval_request_status', 'Read Growth approval requests'],
  'scripts/print-growth-smoke-commands.mjs': [...smokeSafetyTokens, '$readGrowthRouteIds', '$confirmRequiredGrowthRouteIds', 'growth_approval_requests', 'growth_approval_request_save', 'growth_approval_request_status', 'no social posting', 'no form submission', 'metadata-only posture', 'Growth metadata-write routes missing confirm_required or safe metadata posture'],
  'scripts/print-growth-campaign-intelligence-smoke-commands.mjs': [...smokeSafetyTokens, 'Growth operator overview has missing or unsafe safety flags.', 'Campaign save returned unsafe safety flags.', 'Experiment save returned unsafe safety flags.'],
  'scripts/print-growth-strategy-memory-smoke-commands.mjs': [...smokeSafetyTokens, 'Strategy memory read has missing or unsafe safety flags.', 'Objective save returned unsafe safety flags.'],
  'scripts/print-growth-blackboard-smoke-commands.mjs': [...smokeSafetyTokens, 'Blackboard read has missing or unsafe safety flags.', 'Entity save returned unsafe safety flags.'],
};

const expectedPackageScripts = {
  'db:migration:one': 'node scripts/apply-one-migration.mjs',
  'db:migrations:check': 'node scripts/check-migrations-present.mjs',
  'db:migrations:print': 'node scripts/print-migration-commands.mjs',
  'db:verify:print': 'node scripts/print-d1-verification-commands.mjs',
  'git:main-audit:print': 'node scripts/print-main-branch-audit.mjs',
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
  'growth:review-queue:check': 'node scripts/check-growth-review-queue.mjs',
  'growth:route-catalogue:apply': routeCatalogueApply,
  'growth:route-contract:print': 'node scripts/print-growth-route-contract-check.mjs',
  'growth:route-delegates:check': 'node scripts/check-growth-route-delegates.mjs',
  'growth:route-safety-flags:check': 'node scripts/check-growth-route-safety-flags.mjs',
  'growth:smoke:print': 'node scripts/print-growth-smoke-commands.mjs',
  'growth:strategy:check': 'node scripts/check-growth-strategy-memory.mjs',
  'growth:strategy:smoke:print': 'node scripts/print-growth-strategy-memory-smoke-commands.mjs',
  'growth:wiring:apply': 'node scripts/apply-growth-operator-route-wiring.mjs',
  'ops:smoke:print': 'node scripts/print-next-ops-smoke-commands.mjs',
  'scripts:check': 'node scripts/check-helper-scripts.mjs',
  'check:local': 'npm run scripts:check && npm run db:migrations:check && npm run growth:route-delegates:check && npm run growth:route-safety-flags:check && npm run growth:capabilities:check && npm run growth:campaigns:check && npm run growth:strategy:check && npm run growth:blackboard:check && npm run growth:review-queue:check && npm run growth:autonomous-discovery:check && npm run typecheck',
};

let failed = false;

function fail(message) {
  failed = true;
  console.error(`FAIL ${message}`);
}

function pass(message) {
  console.log(`OK   ${message}`);
}

function checkExistsAndParses(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`${relativePath} is missing`);
    return;
  }
  const check = spawnSync(process.execPath, ['--check', absolutePath], { cwd: repoRoot, encoding: 'utf8' });
  if (check.status !== 0) {
    fail(`${relativePath} has syntax errors`);
    if (check.stderr) console.error(check.stderr.trim());
  } else {
    pass(`${relativePath} exists and parses`);
  }
}

for (const relativePath of helperScripts) checkExistsAndParses(relativePath);
for (const relativePath of [...sourceFiles, ...docs]) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) fail(`${relativePath} is missing`);
  else pass(`${relativePath} exists`);
}

for (const [relativePath, tokens] of Object.entries(requiredTokens)) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) continue;
  const content = fs.readFileSync(absolutePath, 'utf8');
  for (const token of tokens) {
    if (!content.includes(token)) fail(`${relativePath} missing ${token}`);
    else pass(`${relativePath} contains ${token}`);
  }
}

const packageJsonPath = path.join(repoRoot, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  fail('package.json is missing');
} else {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const scripts = packageJson.scripts || {};
  for (const [scriptName, expected] of Object.entries(expectedPackageScripts)) {
    if (scripts[scriptName] !== expected) fail(`package.json script ${scriptName} should be "${expected}"`);
    else pass(`package.json script ${scriptName} is wired`);
  }
}

if (failed) {
  console.error('Helper script check failed.');
  process.exit(1);
}

console.log('Helper script check passed.');
