import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const requiredFiles = [
  'migrations/0016_growth_strategy_memory.sql',
  'src/core/growthStrategyMemory.ts',
  'src/routes/growthStrategyMemoryAdmin.ts',
  'src/core/growthAutonomousRuntime.ts',
  'src/core/growthOperatorCycle.ts',
  'src/routes/growthCampaignIntelligenceAdmin.ts',
];

const requiredTokens = {
  'migrations/0016_growth_strategy_memory.sql': [
    'growth_objectives',
    'growth_key_results',
    'growth_target_segments',
    'growth_offer_profiles',
    'growth_positioning_profiles',
    'growth_runtime_constraints',
  ],
  'src/core/growthStrategyMemory.ts': [
    'upsertGrowthObjective',
    'upsertGrowthKeyResult',
    'upsertGrowthTargetSegment',
    'upsertGrowthOfferProfile',
    'upsertGrowthPositioningProfile',
    'upsertGrowthRuntimeConstraint',
    'loadGrowthStrategyMemory',
  ],
  'src/routes/growthStrategyMemoryAdmin.ts': [
    '/admin/growth/strategy-memory',
    '/admin/growth/objectives',
    '/admin/growth/key-results',
    '/admin/growth/segments',
    '/admin/growth/offers',
    '/admin/growth/positioning',
    '/admin/growth/runtime-constraints',
    'growth_strategy_memory',
    'growth_objective_saved',
    'growth_runtime_constraint_saved',
    'externalStateChange: false',
  ],
  'src/core/growthAutonomousRuntime.ts': [
    'strategicIntent',
    'knowledgeSubstrate',
    'missing_objectives',
    'missing_target_segments',
    'missing_offer_profiles',
    'missing_positioning_profiles',
    'missing_runtime_constraints',
    'missing_knowledge_substrate',
    'growth_autonomous_runtime_v3_strategy_blackboard',
  ],
  'src/core/growthOperatorCycle.ts': [
    'strategyMemory',
    'strategySetup',
    'blackboardSetup',
    'growth_operator_cycle_v3_strategy_blackboard_read_only',
    'missing_objectives',
    'missing_blackboard_facts',
    'targetSegments',
    'runtimeConstraints',
  ],
  'src/routes/growthCampaignIntelligenceAdmin.ts': [
    'loadGrowthStrategyMemory',
    'loadGrowthBlackboard',
    'loadGrowthCycleState',
    'buildGrowthOperatorCycle(await loadGrowthCycleState(env, url))',
    'buildGrowthAutonomousRuntime({ operatorCycle: cycle, strategyMemory: cycleState.strategyMemory })',
  ],
};

let failed = false;

function fail(message) {
  failed = true;
  console.error(`FAIL ${message}`);
}

function pass(message) {
  console.log(`OK   ${message}`);
}

for (const relativePath of requiredFiles) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`${relativePath} is missing`);
    continue;
  }
  pass(`${relativePath} exists`);
  const content = fs.readFileSync(absolutePath, 'utf8');
  for (const token of requiredTokens[relativePath] || []) {
    if (!content.includes(token)) fail(`${relativePath} missing ${token}`);
    else pass(`${relativePath} contains ${token}`);
  }
}

if (failed) {
  console.error('Growth strategy memory check failed.');
  process.exit(1);
}

console.log('Growth strategy memory check passed.');
