import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const requiredFiles = [
  'migrations/0014_growth_campaign_intelligence.sql',
  'src/core/growthCampaignIntelligence.ts',
  'src/core/growthCampaignDecisions.ts',
  'src/core/growthCampaignRecords.ts',
  'src/routes/growthCampaignIntelligenceAdmin.ts',
  'docs/growth-campaign-intelligence.md',
];

const requiredTokens = {
  'migrations/0014_growth_campaign_intelligence.sql': [
    'growth_campaigns',
    'growth_experiments',
    'growth_campaign_metrics',
    'growth_decisions',
    'growth_candidate_actions',
    'growth_evidence_items',
    'growth_learning_notes',
  ],
  'src/core/growthCampaignIntelligence.ts': [
    'upsertGrowthCampaign',
    'upsertGrowthExperiment',
    'assessCampaignHealth',
    'listGrowthCampaigns',
    'listGrowthExperiments',
  ],
  'src/core/growthCampaignDecisions.ts': [
    'planGrowthCampaignDecision',
    'saveGrowthDecision',
    'listGrowthDecisions',
    'utilityScore',
    'riskScore',
  ],
  'src/core/growthCampaignRecords.ts': [
    'upsertGrowthCampaignMetric',
    'listGrowthCampaignMetrics',
    'createGrowthEvidenceItem',
    'listGrowthEvidenceItems',
    'createGrowthLearningNote',
    'listGrowthLearningNotes',
  ],
  'src/routes/growthCampaignIntelligenceAdmin.ts': [
    'growth_operator_intelligence',
    'growth_campaigns',
    'growth_experiments',
    'growth_decisions',
    'growth_campaign_metrics',
    'growth_evidence_items',
    'growth_learning_notes',
    'growth_decision_planned',
    'externalStateChange: false',
  ],
  'docs/growth-campaign-intelligence.md': [
    'Growth Campaign Intelligence Brain',
    'metadata only',
    '/admin/growth/operator',
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
  console.error('Growth campaign intelligence check failed.');
  process.exit(1);
}

console.log('Growth campaign intelligence check passed.');
