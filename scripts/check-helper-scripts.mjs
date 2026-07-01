import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const helperScripts = [
  'scripts/apply-growth-campaign-analytics-route-catalogue.mjs',
  'scripts/apply-growth-operator-route-wiring.mjs',
  'scripts/apply-one-migration.mjs',
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
  'src/routes/growthBlackboardAdmin.ts',
  'src/routes/growthCapabilitiesAdmin.ts',
  'src/routes/growthCampaignIntelligenceAdmin.ts',
  'src/routes/growthStrategyMemoryAdmin.ts',
  'src/routes/routeCataloguePlanner.ts',
  'src/routes/routeCatalogueTypes.ts',
];

const docs = [
  'docs/growth-blackboard.md',
  'docs/growth-capability-registry.md',
  'docs/growth-campaign-intelligence.md',
  'docs/growth-strategy-memory.md',
];

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

const requiredTokens = {
  'src/routes/routeCatalogueTypes.ts': [
    'canSendEmail: boolean',
    'canPostSocial: boolean',
    'canSubmitForms: boolean',
    'RouteCatalogueInput',
    'canPostSocial: false',
    'canSubmitForms: false',
  ],
  'src/routes/growthAdmin.ts': [
    'handleGrowthCapabilitiesAdmin',
    'handleGrowthCampaignIntelligenceAdmin',
    'handleGrowthStrategyMemoryAdmin',
    'handleGrowthBlackboardAdmin',
    'campaignIntelligencePrefixes',
    'strategyMemoryPrefixes',
    'blackboardPrefixes',
    'pathMatches(pathname, campaignIntelligencePrefixes)',
    'pathMatches(pathname, strategyMemoryPrefixes)',
    'pathMatches(pathname, blackboardPrefixes)',
    '/admin/growth/capabilities',
    '/admin/growth/autonomy',
    '/admin/growth/cycle',
    '/admin/growth/operator',
    '/admin/growth/strategy-memory',
    '/admin/growth/blackboard',
  ],
  'src/routes/growthCapabilitiesAdmin.ts': [
    'handleGrowthCapabilitiesAdmin',
    'listGrowthCapabilities',
    'safety: readSafety',
    ...fullSafetyTokens,
  ],
  'src/routes/growthCampaignIntelligenceAdmin.ts': [
    'handleGrowthCampaignIntelligenceAdmin',
    'readSafety',
    'writeSafety',
    'safety: readSafety',
    'safety: writeSafety',
    ...fullSafetyTokens,
  ],
  'src/routes/growthStrategyMemoryAdmin.ts': [
    'handleGrowthStrategyMemoryAdmin',
    'readSafety',
    'writeSafety',
    'safety: readSafety',
    'safety: writeSafety',
    ...fullSafetyTokens,
  ],
  'src/routes/growthBlackboardAdmin.ts': [
    'handleGrowthBlackboardAdmin',
    'readSafety',
    'writeSafety',
    'safety: readSafety',
    'safety: writeSafety',
    ...fullSafetyTokens,
  ],
  'src/core/growthApprovalRequests.ts': [
    'GrowthApprovalRequestInput',
    'GrowthApprovalStatus',
    'listGrowthApprovalRequests',
    'saveGrowthApprovalRequest',
    'updateGrowthApprovalRequestStatus',
    'hydrateGrowthApprovalRequest',
    'growth_approval_requests',
  ],
  'src/routes/growthApprovalRequestsAdmin.ts': [
    'handleGrowthApprovalRequestsAdmin',
    'listGrowthApprovalRequests',
    'saveGrowthApprovalRequest',
    'updateGrowthApprovalRequestStatus',
    '0019_growth_approval_requests.sql',
  ],
  'src/core/growthOperatorLoop.ts': [
    'GrowthNextStepApprovalPack',
    'approvalPack',
    'buildApprovalPack',
    'reviewChecklist',
    'explicitBlocks',
    'auditReason',
    'canSendEmail: false',
    'canPostSocial: false',
    'canSubmitForms: false',
    'recommendedPayloadHint',
    'dashboardAnchor',
    'setupGap',
  ],
  'src/core/growthOperatorCycle.ts': [
    'nextBestInternalStep',
    'approvalPack',
    'recommendedPayloadHint',
    'dashboardAnchor',
    'setupGap',
    'externalStateChange: false',
    'callsAI: false',
    'callsNetwork: false',
  ],
  'src/core/growthAutonomousRuntime.ts': [
    'nextBestInternalStep',
    'approvalPack',
    'chooseNextStep',
    'nextStepRequiresConfirmation',
    'Plan next-best internal step',
    'approval pack',
    'review checklist',
    'recommended command',
    'payload hint',
    'externalStateChange: false',
    'callsAI: false',
    'callsNetwork: false',
  ],
  'src/routes/routeCataloguePlanner.ts': [
    'growth_brief',
    'writesTables: []',
    'growth_budget',
    'does not advertise write side effects',
    'does not expose write capability',
    'growth_autonomy',
    'growth_blackboard',
    'growth_strategy_memory',
    'growth_cycle',
    'growth_approval_requests',
    'growth_approval_request_save',
    'growth_approval_request_status',
  ],
  'scripts/check-growth-route-delegates.mjs': [
    'Growth route delegate check passed.',
    'src/routes/growthAdmin.ts',
    'handleGrowthCapabilitiesAdmin',
    'handleGrowthCampaignIntelligenceAdmin',
    'handleGrowthStrategyMemoryAdmin',
    'handleGrowthBlackboardAdmin',
  ],
  'scripts/check-growth-route-safety-flags.mjs': [
    'Growth route safety flag check passed.',
    'src/routes/routeCatalogueTypes.ts',
    'src/routes/growthCampaignIntelligenceAdmin.ts',
    'src/routes/growthStrategyMemoryAdmin.ts',
    'src/routes/growthBlackboardAdmin.ts',
    'canSendEmail: false',
    'canPostSocial: false',
    'canSubmitForms: false',
  ],
  'scripts/check-growth-review-queue.mjs': [
    'Growth review queue check passed.',
    'migrations/0019_growth_approval_requests.sql',
    'src/core/growthApprovalRequests.ts',
    'src/routes/growthApprovalRequestsAdmin.ts',
    'growth_approval_requests',
    'growth_approval_request_save',
    'growth_approval_request_status',
  ],
  'scripts/print-growth-final-backend-validation.mjs': [
    'EVAVO Growth backend final validation',
    'npm run growth:wiring:apply',
    'npm run growth:route-catalogue:apply',
    'npm run growth:route-delegates:check',
    'npm run growth:route-safety-flags:check',
    'npm run growth:review-queue:check',
    'npm run check:local',
    'npm run deploy',
    'npm run growth:route-contract:print',
  ],
  'scripts/print-growth-route-contract-check.mjs': [
    'Growth v3 runtime route contract is valid.',
    'delegated Growth v3 read routes',
    '$delegatedReadPaths',
    'Read and verify delegated Growth v3 route families',
    'Delegated Growth route failed:',
    'Delegated Growth route has missing or unsafe read safety:',
    'Delegated Growth route threw:',
    'canSendEmail',
    'canPostSocial',
    'canSubmitForms',
    'no social posting',
    'no form submission',
    'metadata-only posture',
    'Growth metadata-write routes missing confirm_required or safe metadata posture',
    '/admin/growth/capabilities',
    '/admin/growth/operator',
    '/admin/growth/campaigns?limit=5',
    '/admin/growth/strategy-memory',
    '/admin/growth/blackboard/facts?limit=5',
    'growth_operator_cycle_v3_strategy_blackboard_read_only',
    'growth_autonomous_runtime_v3_strategy_blackboard',
    'growth_approval_requests',
    'growth_approval_request_save',
    'growth_approval_request_status',
    'Read Growth approval requests',
  ],
  'scripts/print-growth-smoke-commands.mjs': [
    'growth:route-safety-flags:check',
    '$readGrowthRouteIds',
    '$confirmRequiredGrowthRouteIds',
    'growth_approval_requests',
    'growth_approval_request_save',
    'growth_approval_request_status',
    'canPostSocial',
    'canSubmitForms',
    'no social posting',
    'no form submission',
    'metadata-only posture',
    'Growth metadata-write routes missing confirm_required or safe metadata posture',
  ],
};

const expectedPackageScripts = {
  'db:migration:one': 'node scripts/apply-one-migration.mjs',
  'db:migrations:check': 'node scripts/check-migrations-present.mjs',
  'db:migrations:print': 'node scripts/print-migration-commands.mjs',
  'db:verify:print': 'node scripts/print-d1-verification-commands.mjs',
  'git:main-audit:print': 'node scripts/print-main-branch-audit.mjs',
  'growth:backend:final:print': 'node scripts/print-growth-final-backend-validation.mjs',
  'growth:blackboard:check': 'node scripts/check-growth-blackboard.mjs',
  'growth:blackboard:smoke:print': 'node scripts/print-growth-blackboard-smoke-commands.mjs',
  'growth:campaigns:check': 'node scripts/check-growth-campaign-intelligence.mjs',
  'growth:campaigns:smoke:print': 'node scripts/print-growth-campaign-intelligence-smoke-commands.mjs',
  'growth:capabilities:check': 'node scripts/check-growth-capability-registry.mjs',
  'growth:review-queue:check': 'node scripts/check-growth-review-queue.mjs',
  'growth:route-catalogue:apply': 'node scripts/apply-growth-campaign-analytics-route-catalogue.mjs',
  'growth:route-contract:print': 'node scripts/print-growth-route-contract-check.mjs',
  'growth:route-delegates:check': 'node scripts/check-growth-route-delegates.mjs',
  'growth:route-safety-flags:check': 'node scripts/check-growth-route-safety-flags.mjs',
  'growth:smoke:print': 'node scripts/print-growth-smoke-commands.mjs',
  'growth:strategy:check': 'node scripts/check-growth-strategy-memory.mjs',
  'growth:strategy:smoke:print': 'node scripts/print-growth-strategy-memory-smoke-commands.mjs',
  'growth:wiring:apply': 'node scripts/apply-growth-operator-route-wiring.mjs',
  'ops:smoke:print': 'node scripts/print-next-ops-smoke-commands.mjs',
  'scripts:check': 'node scripts/check-helper-scripts.mjs',
  'check:local': 'npm run scripts:check && npm run db:migrations:check && npm run growth:route-delegates:check && npm run growth:route-safety-flags:check && npm run growth:capabilities:check && npm run growth:campaigns:check && npm run growth:strategy:check && npm run growth:blackboard:check && npm run growth:review-queue:check && npm run typecheck',
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
    fail(`${relativePath} has a syntax error`);
    if (check.stderr) console.error(check.stderr.trim());
  } else {
    pass(`${relativePath} exists and parses`);
  }
}

function checkRequiredTokens(relativePath) {
  const tokens = requiredTokens[relativePath] || [];
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`${relativePath} is missing`);
    return;
  }
  pass(`${relativePath} exists`);
  const content = fs.readFileSync(absolutePath, 'utf8');
  for (const token of tokens) {
    if (!content.includes(token)) fail(`${relativePath} missing ${token}`);
    else pass(`${relativePath} contains ${token}`);
  }
}

for (const script of helperScripts) {
  checkExistsAndParses(script);
  checkRequiredTokens(script);
}

for (const relativePath of [...sourceFiles, ...docs]) {
  checkRequiredTokens(relativePath);
}

const packageJsonPath = path.join(repoRoot, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  fail('package.json is missing');
} else {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const scripts = packageJson.scripts || {};
  for (const [name, expected] of Object.entries(expectedPackageScripts)) {
    if (scripts[name] !== expected) fail(`package.json script ${name} should be "${expected}"`);
    else pass(`package.json script ${name} is wired`);
  }
}

if (failed) {
  console.error('Helper script check failed.');
  process.exit(1);
}

console.log('Helper script check passed.');
