import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const requiredFiles = [
  'migrations/0017_growth_blackboard.sql',
  'src/core/growthBlackboard.ts',
  'src/routes/growthBlackboardAdmin.ts',
  'scripts/apply-growth-operator-route-wiring.mjs',
];

const requiredTokens = {
  'migrations/0017_growth_blackboard.sql': [
    'growth_blackboard_facts',
    'growth_entities',
    'growth_entity_relationships',
    'growth_market_signals',
    'growth_asset_inventory',
  ],
  'src/core/growthBlackboard.ts': [
    'upsertGrowthBlackboardFact',
    'upsertGrowthEntity',
    'upsertGrowthEntityRelationship',
    'upsertGrowthMarketSignal',
    'upsertGrowthAsset',
    'loadGrowthBlackboard',
  ],
  'src/routes/growthBlackboardAdmin.ts': [
    '/admin/growth/blackboard',
    '/admin/growth/blackboard/facts',
    '/admin/growth/blackboard/entities',
    '/admin/growth/blackboard/relationships',
    '/admin/growth/blackboard/signals',
    '/admin/growth/blackboard/assets',
    'growth_blackboard',
    'growth_blackboard_fact_saved',
    'growth_entity_saved',
    'growth_market_signal_saved',
    'growth_asset_saved',
    'externalStateChange: false',
  ],
  'scripts/apply-growth-operator-route-wiring.mjs': [
    'handleGrowthBlackboardAdmin',
    '/admin/growth/blackboard',
    '/admin/growth/blackboard/facts',
    '/admin/growth/blackboard/assets',
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
  console.error('Growth blackboard check failed.');
  process.exit(1);
}

console.log('Growth blackboard check passed.');
