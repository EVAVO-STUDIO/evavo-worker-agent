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

const typeScriptFiles = [
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
  'src/routes/growthBlackboardAdmin.ts',
  'src/routes/growthCapabilitiesAdmin.ts',
  'src/routes/growthCampaignIntelligenceAdmin.ts',
  'src/routes/growthStrategyMemoryAdmin.ts',
  'src/routes/routeCataloguePlanner.ts',
];

const docs = [
  'docs/growth-blackboard.md',
  'docs/growth-capability-registry.md',
  'docs/growth-campaign-intelligence.md',
  'docs/growth-strategy-memory.md',
];

const requiredFileTokens = {
  'src/core/growthOperatorLoop.ts': [
    'seed_objective',
    'seed_segment',
    'seed_offer',
    'seed_positioning',
    'seed_runtime_constraint',
    'seed_blackboard_fact',
    'seed_entity',
    'seed_relationship',
    'seed_market_signal',
    'seed_asset',
    'recommendedPayloadHint',
    'dashboardAnchor',
    'setupGap',
    'POST /admin/growth/objectives?confirm=1',
    'POST /admin/growth/blackboard/facts?confirm=1',
  ],
  'src/core/growthOperatorCycle.ts': [
    'nextBestInternalStep',
    'recommendedPayloadHint',
    'dashboardAnchor',
    'setupGap',
    'externalStateChange: false',
    'callsAI: false',
    'callsNetwork: false',
  ],
  'src/core/growthAutonomousRuntime.ts': [
    'nextBestInternalStep',
    'chooseNextStep',
    'nextStepRequiresConfirmation',
    'Plan next-best internal step',
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
    'growth_blackboard_facts',
    'growth_entity_relationships',
    'growth_market_signals',
    'growth_strategy_memory',
    'growth_objectives',
    'growth_key_results',
    'growth_segments',
    'growth_offers',
    'growth_positioning',
    'growth_runtime_constraints',
    'growth_cycle',
    'growth_cycle_events',
    'growth_cycle_record',
    'growth_metrics',
    'growth_evidence',
    'growth_learning',
  ],
  'scripts/print-growth-final-backend-validation.mjs': [
    'EVAVO Growth backend final validation',
    'npm run growth:wiring:apply',
    'npm run growth:route-catalogue:apply',
    'npm run check:local',
    'npm run deploy',
    'npm run growth:route-contract:print',
    'npm run growth:campaigns:smoke:print',
    'npm run growth:strategy:smoke:print',
    'npm run growth:blackboard:smoke:print',
  ],
  'scripts/print-growth-route-contract-check.mjs': [
    'Growth v3 runtime route contract is valid.',
    'growth_operator_cycle_v3_strategy_blackboard_read_only',
    'growth_autonomous_runtime_v3_strategy_blackboard',
    '/admin/growth/cycle/events?limit=5',
    '$readGrowthRouteIds',
    '$confirmRequiredGrowthRouteIds',
    '$readRoutes',
    '$confirmRoutes',
    'Unsafe Growth read-route metadata found:',
    'All Growth read routes advertise readOnly, no network, no AI, no email, cost none, and no write tables.',
    'All Growth metadata-write routes advertise confirm_required posture.',
    'Growth cycle is missing nextBestInternalStep.',
    'Growth cycle nextBestInternalStep safety is unsafe.',
    'Growth autonomy is missing nextBestInternalStep.',
    'Growth autonomy nextBestInternalStep safety is unsafe.',
    'Latest Growth cycle event is missing hydrated strategy snapshot.',
    'Latest Growth cycle event is missing hydrated blackboard snapshot.',
    'Latest Growth cycle event is missing raw strategy_json column.',
    'Latest Growth cycle event is missing raw blackboard_json column.',
  ],
};

const packageJsonPath = path.join(repoRoot, 'package.json');
let failed = false;

function fail(message) {
  failed = true;
  console.error(`FAIL ${message}`);
}

function pass(message) {
  console.log(`OK   ${message}`);
}

function checkRequiredTokens(relativePath) {
  const tokens = requiredFileTokens[relativePath] || [];
  if (!tokens.length) return;
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) return;
  const content = fs.readFileSync(absolutePath, 'utf8');
  for (const token of tokens) {
    if (!content.includes(token)) fail(`${relativePath} missing ${token}`);
    else pass(`${relativePath} contains ${token}`);
  }
}

for (const relativePath of helperScripts) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`${relativePath} is missing`);
    continue;
  }

  const check = spawnSync(process.execPath, ['--check', absolutePath], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (check.status !== 0) {
    fail(`${relativePath} has a syntax error`);
    if (check.stderr) console.error(check.stderr.trim());
    continue;
  }

  pass(`${relativePath} exists and parses`);
  checkRequiredTokens(relativePath);
}

for (const relativePath of typeScriptFiles) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`${relativePath} is missing`);
  } else {
    pass(`${relativePath} exists`);
    checkRequiredTokens(relativePath);
  }
}

for (const relativePath of docs) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`${relativePath} is missing`);
  } else {
    pass(`${relativePath} exists`);
  }
}

if (!fs.existsSync(packageJsonPath)) {
  fail('package.json is missing');
} else {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const scripts = packageJson.scripts || {};
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
    'growth:route-catalogue:apply': 'node scripts/apply-growth-campaign-analytics-route-catalogue.mjs',
    'growth:route-contract:print': 'node scripts/print-growth-route-contract-check.mjs',
    'growth:smoke:print': 'node scripts/print-growth-smoke-commands.mjs',
    'growth:strategy:check': 'node scripts/check-growth-strategy-memory.mjs',
    'growth:strategy:smoke:print': 'node scripts/print-growth-strategy-memory-smoke-commands.mjs',
    'growth:wiring:apply': 'node scripts/apply-growth-operator-route-wiring.mjs',
    'ops:smoke:print': 'node scripts/print-next-ops-smoke-commands.mjs',
    'scripts:check': 'node scripts/check-helper-scripts.mjs',
    'check:local': 'npm run scripts:check && npm run db:migrations:check && npm run growth:capabilities:check && npm run growth:campaigns:check && npm run growth:strategy:check && npm run growth:blackboard:check && npm run typecheck',
  };

  for (const [name, expected] of Object.entries(expectedPackageScripts)) {
    if (scripts[name] !== expected) {
      fail(`package.json script ${name} should be "${expected}"`);
    } else {
      pass(`package.json script ${name} is wired`);
    }
  }
}

if (failed) {
  console.error('Helper script check failed.');
  process.exit(1);
}

console.log('Helper script check passed.');
