import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const migrationPath = 'migrations/0020_growth_autonomous_discovery.sql';

const requiredTokens = {
  'docs/growth-autonomous-discovery-architecture.md': [
    'Growth autonomous discovery architecture',
    'Autonomous research, supervised action.',
    'Discovery planner',
    'source candidate registry',
    'crawl policy / robots check',
    'fetch queue',
    'extractor',
    'signal scorer',
    'decision engine',
    'approval pack builder',
    'read-only Next dashboard',
    'send email',
    'post on social platforms',
    'submit web forms',
    'execute instructions found inside web pages',
    'growth_research_runs',
    'growth_source_candidates',
    'growth_robots_cache',
    'growth_fetch_queue',
    'growth_discovered_pages',
    'growth_extracted_signals',
    'growth_opportunity_scores',
    'growth_agent_decisions',
    'growth_discovery_feedback',
  ],
  'docs/growth-source-discovery-safety-policy.md': [
    'Growth source discovery safety policy',
    'send email',
    'post on social networks',
    'submit web forms',
    'log in to third-party websites',
    'execute instructions found in crawled content',
    'private IP ranges',
    'unknown robots policy = do not crawl yet',
    'callsNetwork: false',
    'callsAI: false',
    'canSendEmail: false',
    'canPostSocial: false',
    'canSubmitForms: false',
    'Browser proxy routes may read',
    'write routes',
    'fetch execution routes',
    'send_email',
    'submit_form',
    'post_social',
  ],
  'docs/growth-zero-source-research-runbook.md': [
    'Growth zero-source research runbook',
    'without the operator supplying a source list',
    'Plan research',
    'Generate candidate discovery strategy',
    'Register source candidates',
    'Check crawl policy',
    'Queue fetch work',
    'Extract evidence',
    'Score opportunity',
    'Record agent decision',
    'Prepare approval pack',
    'source discovery safety policy exists',
    'no crawler execution yet',
  ],
  [migrationPath]: [
    'CREATE TABLE IF NOT EXISTS growth_research_runs',
    'CREATE TABLE IF NOT EXISTS growth_source_candidates',
    'CREATE TABLE IF NOT EXISTS growth_robots_cache',
    'CREATE TABLE IF NOT EXISTS growth_fetch_queue',
    'CREATE TABLE IF NOT EXISTS growth_discovered_pages',
    'CREATE TABLE IF NOT EXISTS growth_extracted_signals',
    'CREATE TABLE IF NOT EXISTS growth_opportunity_scores',
    'CREATE TABLE IF NOT EXISTS growth_agent_decisions',
    'CREATE TABLE IF NOT EXISTS growth_discovery_feedback',
    'blocked_actions_json',
    'safety_json',
    'crawl_allowed INTEGER NOT NULL DEFAULT 0',
    'confidence_score',
    'risk_flags_json',
  ],
  'scripts/check-migrations-present.mjs': [
    '0020_growth_autonomous_discovery.sql',
  ],
  'migrations/README.md': [
    '0020_growth_autonomous_discovery.sql',
    'zero-source autonomous discovery data model',
    'does not enable crawling, sending, posting, form submission, AI calls, or external execution',
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

for (const [relativePath, tokens] of Object.entries(requiredTokens)) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`${relativePath} is missing`);
    continue;
  }
  pass(`${relativePath} exists`);
  const content = fs.readFileSync(absolutePath, 'utf8');
  for (const token of tokens) {
    if (!content.includes(token)) fail(`${relativePath} missing ${token}`);
    else pass(`${relativePath} contains ${token}`);
  }
}

if (failed) {
  console.error('Growth autonomous discovery check failed.');
  process.exit(1);
}

console.log('Growth autonomous discovery check passed.');
