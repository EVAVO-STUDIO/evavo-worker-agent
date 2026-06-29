import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const requiredFiles = [
  'migrations/0014_growth_campaign_intelligence.sql',
  'migrations/0015_growth_operator_cycle_events.sql',
  'src/core/growthCampaignAnalysis.ts',
  'src/core/growthOperatorLoop.ts',
  'src/core/growthOperatorCycle.ts',
  'src/core/growthOperatorCycleEvents.ts',
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
  'migrations/0015_growth_operator_cycle_events.sql': [
    'growth_operator_cycle_events',
    'selected_step',
    'target_campaign_id',
    'readiness_json',
    'loop_plan_json',
    'safety_json',
  ],
  'src/core/growthCampaignAnalysis.ts': [
    'analyzeGrowthCampaign',
    'summarizeGrowthOperatorReadiness',
    'signalScore',
    'riskScore',
    'readinessScore',
    'recommendedNextActions',
  ],
  'src/core/growthOperatorLoop.ts': [
    'planGrowthOperatorLoop',
    'selectedStep',
    'recommendedCommand',
    'add_metric_snapshot',
    'add_evidence',
    'plan_decision',
    'record_learning',
  ],
  'src/core/growthOperatorCycle.ts': [
    'buildGrowthOperatorCycle',
    'growth_operator_cycle',
    'campaignBriefs',
    'capabilitySummary',
    'blocked',
    'callsNetwork: false',
  ],
  'src/core/growthOperatorCycleEvents.ts': [
    'saveGrowthOperatorCycleEvent',
    'listGrowthOperatorCycleEvents',
    'growth_operator_cycle_events',
    'read_only_snapshot',
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
    '/admin/growth/cycle',
    '/admin/growth/cycle/events',
    '/admin/growth/cycle/record',
    'growth_operator_cycle_events',
    'growth_operator_cycle_recorded',
    'growth_operator_intelligence',
    'growth_campaigns',
    'growth_experiments',
    'growth_decisions',
    'growth_campaign_metrics',
    'growth_evidence_items',
    'growth_learning_notes',
    'growth_decision_planned',
    'analyses',
    'readiness',
    'loopPlan',
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
