import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const tables = [
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

const required = {
  'docs/business-autopilot-architecture.md': [
    'EVAVO Business Autopilot architecture',
    'Evidence-backed decisions and approved actions',
    'Intelligence layer',
    'Evaluation layer',
    'Strategy layer',
    'Action-preparation layer',
    'Governance layer',
    'Execution layer',
    'Level 0: Read-only intelligence',
    'Level 1: Draft-only',
    'Level 2: Approval-required execution',
    'Level 3: Rules-approved internal actions',
    'Level 4: Capped campaign mode',
    'Level 5: Broad external autonomy',
    ...tables,
  ],
  'docs/business-autopilot-governance-policy.md': [
    'EVAVO Business Autopilot governance policy',
    'Research autonomously. Draft helpfully. Execute only under governed approval.',
    'send_email',
    'post_social',
    'comment_social',
    'submit_form',
    'mutate_external_system',
    'execute_browser_action',
    'ignore_suppression',
    'Approval records must capture',
    'Suppression wins over approval.',
    'kill switch',
    'The browser must not receive',
  ],
  'docs/business-autopilot-compliance-policy.md': [
    'EVAVO Business Autopilot compliance policy',
    'The first implementation is metadata-only and draft-only.',
    'Email compliance gates',
    'Social compliance gates',
    'Contact-form policy',
    'Suppression records must be treated as higher priority than approval records.',
    'compliance gate',
    'suppression gate',
    'approval gate',
    'rate/cap gate',
    'audit gate',
    'kill switch gate',
  ],
  'docs/business-autopilot-data-model.md': [
    'EVAVO Business Autopilot data model',
    'business intelligence',
    'opportunity scoring',
    'website audit packs',
    'service matching',
    'action drafts',
    'approval records',
    'execution records',
    'suppression records',
    'migrations/0021_business_autopilot_foundation.sql',
    ...tables,
  ],
  'migrations/0021_business_autopilot_foundation.sql': [
    'Business Autopilot foundation metadata schema',
    'does not enable email sending, social posting',
    ...tables.map((table) => `CREATE TABLE IF NOT EXISTS ${table}`),
    'compliance_status TEXT NOT NULL DEFAULT',
    'approval_status TEXT NOT NULL DEFAULT',
    'execution_type TEXT NOT NULL',
    'active INTEGER NOT NULL DEFAULT 1',
  ],
  'scripts/check-migrations-present.mjs': [
    '0021_business_autopilot_foundation.sql',
  ],
  'migrations/README.md': [
    '0021_business_autopilot_foundation.sql',
    'Business Autopilot metadata foundation',
    'does not enable sending, social posting, commenting, contact-form submission, browser automation, AI calls, ad buying, or external execution',
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

for (const [relativePath, tokens] of Object.entries(required)) {
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
  console.error('Business Autopilot foundation check failed.');
  process.exit(1);
}

console.log('Business Autopilot foundation check passed.');
