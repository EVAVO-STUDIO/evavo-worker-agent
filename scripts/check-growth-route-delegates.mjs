import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const required = {
  'src/routes/growthAdmin.ts': [
    'handleGrowthCapabilitiesAdmin',
    'handleGrowthAutonomousDiscoveryAdmin',
    'handleGrowthCampaignIntelligenceAdmin',
    'handleGrowthStrategyMemoryAdmin',
    'handleGrowthBlackboardAdmin',
    'autonomousDiscoveryPrefixes',
    'campaignIntelligencePrefixes',
    'strategyMemoryPrefixes',
    'blackboardPrefixes',
    'pathMatches(pathname, autonomousDiscoveryPrefixes)',
    'pathMatches(pathname, campaignIntelligencePrefixes)',
    'pathMatches(pathname, strategyMemoryPrefixes)',
    'pathMatches(pathname, blackboardPrefixes)',
    '/admin/growth/capabilities',
    '/admin/growth/discovery',
    '/admin/growth/autonomy',
    '/admin/growth/cycle',
    '/admin/growth/operator',
    '/admin/growth/campaigns',
    '/admin/growth/strategy-memory',
    '/admin/growth/objectives',
    '/admin/growth/blackboard',
  ],
  'src/index.ts': [
    'handleGrowthAdmin',
    'handleGrowthInternalOperatorPackAdmin',
    'case "operator-artifacts":',
    'handleGrowthInternalOperatorPackAdmin(req, env, pathname, jsonResponse)',
    '/admin/growth',
  ],
  'src/routes/growthInternalOperatorPackAdmin.ts': [
    'GROWTH_INTERNAL_OPERATOR_PACK_ROUTE',
    '"/admin/growth/operator/artifacts"',
    'handleGrowthInternalOperatorPackAdmin',
    'isAdminRequestAuthorized',
    'claimGrowthActivityBudget',
    'completeGrowthActivityBudgetClaim',
    'action: "owner_brief_generate"',
    'listGrowthSignals',
    'listGrowthActions',
    'composeGrowthInternalOperatorPack',
    'externalExecutionRequested: false',
    'canonicalPromotionRequested: false',
    'automaticRetryAllowed: false',
  ],
  'src/routes/growthCapabilitiesAdmin.ts': [
    'handleGrowthCapabilitiesAdmin',
    'listGrowthCapabilities',
  ],
  'src/routes/growthAutonomousDiscoveryAdmin.ts': [
    'handleGrowthAutonomousDiscoveryAdmin',
    '/admin/growth/discovery/research-runs',
    '/admin/growth/discovery/source-candidates',
    '/admin/growth/discovery/signals',
    '/admin/growth/discovery/opportunity-scores',
    '/admin/growth/discovery/agent-decisions',
    '/admin/growth/discovery/feedback',
    '/admin/growth/discovery/fetch-queue',
  ],
  'src/routes/growthCampaignIntelligenceAdmin.ts': [
    'handleGrowthCampaignIntelligenceAdmin',
    '/admin/growth/autonomy',
    '/admin/growth/cycle',
    '/admin/growth/operator',
    '/admin/growth/campaigns',
    '/admin/growth/decisions',
  ],
  'src/routes/growthStrategyMemoryAdmin.ts': [
    'handleGrowthStrategyMemoryAdmin',
    '/admin/growth/strategy-memory',
    '/admin/growth/objectives',
    '/admin/growth/key-results',
    '/admin/growth/runtime-constraints',
  ],
  'src/routes/growthBlackboardAdmin.ts': [
    'handleGrowthBlackboardAdmin',
    '/admin/growth/blackboard',
    '/admin/growth/blackboard/facts',
    '/admin/growth/blackboard/entities',
    '/admin/growth/blackboard/assets',
  ],
};

let failed = false;
for (const [file, tokens] of Object.entries(required)) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    failed = true;
    console.error(`FAIL ${file} is missing`);
    continue;
  }
  console.log(`OK   ${file} exists`);
  const text = fs.readFileSync(full, 'utf8');
  for (const token of tokens) {
    if (!text.includes(token)) {
      failed = true;
      console.error(`FAIL ${file} missing ${token}`);
    } else {
      console.log(`OK   ${file} contains ${token}`);
    }
  }
}

if (failed) {
  console.error('Growth route delegate check failed.');
  process.exit(1);
}

console.log('Growth route delegate check passed.');
