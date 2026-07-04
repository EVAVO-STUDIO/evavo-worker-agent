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

const readRouteIds = [
  'business_organizations',
  'business_signals',
  'business_opportunities',
  'business_service_matches',
  'business_action_drafts',
  'business_approval_requests',
  'business_suppression_list',
  'business_content_ideas',
  'business_followups',
  'business_learning_events',
];

const confirmRouteIds = [
  'business_organization_save',
  'business_signal_save',
  'business_opportunity_save',
  'business_action_draft_save',
  'business_approval_request_save',
  'business_suppression_save',
  'business_content_idea_save',
  'business_followup_save',
  'business_learning_event_save',
];

const safetyTokens = [
  'externalStateChange: false',
  'callsAI: false',
  'callsNetwork: false',
  'canSendEmail: false',
  'canPostSocial: false',
  'canCommentSocial: false',
  'canSubmitForms: false',
  'canExecuteBrowserActions: false',
  'canBuyAds: false',
  'canMutateExternalSystems: false',
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
  'src/core/businessAutopilotSafety.ts': [
    'BusinessAutopilotSafety',
    'BUSINESS_AUTOPILOT_BLOCKED_EXTERNAL_ACTIONS',
    'BUSINESS_AUTOPILOT_EXECUTION_LEVELS',
    'businessAutopilotReadSafety',
    'businessAutopilotMetadataWriteSafety',
    'assertBusinessAutopilotReadSafety',
    'assertBusinessAutopilotMetadataWriteSafety',
    ...safetyTokens,
  ],
  'src/core/businessAutopilotTypes.ts': [
    'BusinessOrganizationInput',
    'BusinessOpportunityInput',
    'BusinessActionDraftInput',
    'BusinessApprovalRequestInput',
    'BusinessSignalInput',
    'BusinessServiceMatchInput',
    'buildBusinessOrganization',
    'buildBusinessSignal',
    'buildBusinessOpportunity',
    'buildBusinessServiceMatch',
    'buildBusinessActionDraft',
    'buildBusinessApprovalRequest',
    'draft_only',
    'needs_review',
    'BUSINESS_AUTOPILOT_BLOCKED_EXTERNAL_ACTIONS',
  ],
  'src/core/businessAutopilotRecords.ts': [
    'listBusinessOrganizations',
    'saveBusinessOrganization',
    'listBusinessSignals',
    'saveBusinessSignal',
    'listBusinessOpportunities',
    'saveBusinessOpportunity',
    'listBusinessServiceMatches',
    'saveBusinessServiceMatch',
    'listBusinessActionDrafts',
    'saveBusinessActionDraft',
    'listBusinessApprovalRequests',
    'saveBusinessApprovalRequest',
    'listBusinessSuppression',
    'saveBusinessSuppression',
    'listBusinessContentIdeas',
    'saveBusinessContentIdea',
    'listBusinessFollowups',
    'saveBusinessFollowup',
    'listBusinessLearningEvents',
    'saveBusinessLearningEvent',
    'businessAutopilotReadSafety',
    'businessAutopilotMetadataWriteSafety',
  ],
  'src/routes/businessAutopilotRouteCatalogue.ts': [
    'businessAutopilotRouteCatalogue',
    'businessAutopilotReadRouteIds',
    'businessAutopilotConfirmRouteIds',
    ...readRouteIds,
    ...confirmRouteIds,
    'safety: "read_only"',
    'safety: "confirm_required"',
    'callsNetwork: false',
    'callsAI: false',
    'canSendEmail: false',
    'does not send, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems',
  ],
  'src/routes/businessAutopilotAdmin.ts': [
    'handleBusinessAutopilotAdmin',
    'Business Autopilot writes require confirmation',
    '0021_business_autopilot_foundation.sql',
    '/admin/business/organizations',
    '/admin/business/signals',
    '/admin/business/opportunities',
    '/admin/business/action-drafts',
    '/admin/business/approval-requests',
    '/admin/business/suppression',
    '/admin/business/content-ideas',
    '/admin/business/followups',
    '/admin/business/learning',
    ...readRouteIds,
  ],
  'src/index.ts': [
    'handleBusinessAutopilotAdmin',
    'pathname === "/admin/business" || pathname.startsWith("/admin/business/")',
  ],
  'scripts/apply-business-autopilot-route-catalogue.mjs': [
    'businessAutopilotRouteCatalogue',
    'routeCataloguePlanner.ts',
    'Applied Business Autopilot route catalogue wiring.',
    'zero_source_route_map',
  ],
  'scripts/print-business-autopilot-route-contract-check.mjs': [
    'EVAVO Business Autopilot route-contract smoke check',
    'Business Autopilot route contract is valid.',
    ...readRouteIds,
    ...confirmRouteIds,
    '/admin/business/organizations?limit=5',
    '/admin/business/learning?limit=5',
    'Business Autopilot route has missing or unsafe read safety',
    'does not send, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems',
  ],
  'scripts/check-business-autopilot.mjs': [
    'Business Autopilot foundation check passed.',
    'src/core/businessAutopilotSafety.ts',
    'src/core/businessAutopilotTypes.ts',
    'src/core/businessAutopilotRecords.ts',
    'src/routes/businessAutopilotAdmin.ts',
    'src/routes/businessAutopilotRouteCatalogue.ts',
    'scripts/print-business-autopilot-route-contract-check.mjs',
    '0021_business_autopilot_foundation.sql',
  ],
  'scripts/check-migrations-present.mjs': [
    '0021_business_autopilot_foundation.sql',
  ],
  'migrations/README.md': [
    '0021_business_autopilot_foundation.sql',
    'Business Autopilot metadata foundation',
    'does not enable sending, social posting, commenting, contact-form submission, browser automation, AI calls, ad buying, or external execution',
  ],
  'package.json': [
    'business:autopilot:check',
    'node scripts/check-business-autopilot.mjs',
    'node scripts/apply-business-autopilot-route-catalogue.mjs',
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
