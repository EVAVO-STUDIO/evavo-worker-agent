import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const errors = [];

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

const activeReadRouteIds = [
  'business_organizations',
  'business_people',
  'business_websites',
  'business_pages',
  'business_website_audit_runs',
  'business_audit_observations',
  'business_audit_observation_candidates',
  'business_signals',
  'business_opportunities',
  'business_service_matches',
  'business_audit_packs',
  'business_action_drafts',
  'business_approval_requests',
  'business_suppression_list',
  'business_content_ideas',
  'business_followups',
  'business_learning_events',
];

const activeConfirmRouteIds = [
  'business_organization_save',
  'business_person_save',
  'business_website_save',
  'business_page_save',
  'business_website_audit_run_save',
  'business_audit_observation_save',
  'business_signal_save',
  'business_opportunity_save',
  'business_service_match_save',
  'business_audit_pack_save',
  'business_action_draft_build',
  'business_suppression_save',
  'business_content_idea_save',
  'business_followup_save',
  'business_learning_event_save',
];

const disabledWriteRouteIds = [
  'business_action_draft_save',
  'business_approval_request_save',
];

function read(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`${relativePath} is missing`);
    return '';
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function requireTokens(relativePath, tokens) {
  const content = read(relativePath);
  for (const token of tokens) {
    if (!content.includes(token)) errors.push(`${relativePath} missing ${token}`);
  }
  return content;
}

function forbidTokens(relativePath, tokens) {
  const content = read(relativePath);
  for (const token of tokens) {
    if (content.includes(token)) errors.push(`${relativePath} contains stale or unsafe token ${token}`);
  }
}

requireTokens('README.md', [
  'EVAVO Business Autopilot',
  'Growth Operator and Business Autopilot read routes and confirmed metadata-write routes do not send, post, comment, submit forms, execute browser actions, browse, spend, mutate external systems, or call AI',
  'docs/business-autopilot-validation.md',
  'Run-WorkerFinalGate.ps1',
]);

requireTokens('docs/business-autopilot-architecture.md', [
  'Evidence-backed internal decisions and review metadata only.',
  'There is no active execution layer.',
  'No approval, policy, stored setting, budget profile or historical status may activate these capabilities.',
  ...tables,
]);

requireTokens('docs/business-autopilot-governance-policy.md', [
  'Research manually when explicitly confirmed. Store internal review metadata. Never execute externally.',
  'No approval record, historical status, budget profile, channel policy, operator preference or stored setting may activate a blocked action.',
  'The effective external-execution kill switch is permanently on.',
]);

requireTokens('docs/business-autopilot-compliance-policy.md', [
  'The active Worker is internal, authenticated, review-first and non-executing.',
  'authoritativeForExecution: false',
  'externalUseAllowed: false',
  'Nothing in this policy is a checklist for enabling delivery.',
]);

requireTokens('docs/business-autopilot-draft-review-route-plan.md', [
  'Business Autopilot historical review-record plan',
  'It is not an active roadmap for drafting or delivery.',
  'historicalOnly: true',
  'executable: false',
  'deliverable: false',
  'authoritativeForExecution: false',
  'No future implementation is authorised by this document.',
]);

requireTokens('migrations/0021_business_autopilot_foundation.sql', [
  'Business Autopilot foundation metadata schema',
  ...tables.map((table) => `CREATE TABLE IF NOT EXISTS ${table}`),
]);

requireTokens('migrations/0022_business_website_audit_records.sql', [
  'Business website/funnel audit metadata schema',
  'CREATE TABLE IF NOT EXISTS business_website_audit_runs',
  'CREATE TABLE IF NOT EXISTS business_audit_observations',
]);

requireTokens('src/core/businessAutopilotSafety.ts', [
  'businessAutopilotReadSafety',
  'businessAutopilotMetadataWriteSafety',
  'externalStateChange: false',
  'callsAI: false',
  'callsNetwork: false',
  'canSendEmail: false',
  'canPostSocial: false',
  'canSubmitForms: false',
]);

requireTokens('src/core/businessAutopilotActionDraftBuilder.ts', [
  'business_historical_review_record_v2',
  "draftType: 'crm_note'",
  "channel: 'internal'",
  'historicalOnly: true',
  'executable: false',
  'deliverable: false',
  'authoritativeForExecution: false',
  'requiresApproval: false',
]);

requireTokens('src/core/businessAutopilotApprovalBuilder.ts', [
  'business_historical_review_approval_v2',
  'historicalOnly: true',
  'executable: false',
  'deliverable: false',
  'authoritativeForExecution: false',
  'externalExecutionAllowed: false',
]);

requireTokens('src/core/businessAutopilotDraftReviewBundle.ts', [
  'approvalBuild: null',
  'needsApproval: false',
  'historicalOnly: true',
  'deliverable: false',
  'authoritativeForExecution: false',
  'externalExecutionAllowed: false',
]);

const catalogue = requireTokens('src/routes/businessAutopilotRouteCatalogue.ts', [
  'businessAutopilotRouteCatalogue',
  'disabledBusinessAutopilotWriteRouteIds',
  'Confirm-saves one internal historical review record only.',
  'Historical Business review records',
  'Historical Business approval-shaped records',
  ...activeReadRouteIds.map((id) => `"${id}"`),
  ...activeConfirmRouteIds.map((id) => `"${id}"`),
]);

for (const id of disabledWriteRouteIds) {
  const activeRoutePattern = new RegExp(`(?:readRoute|writeRoute)\\(\\s*["']${id}["']`);
  if (activeRoutePattern.test(catalogue)) errors.push(`Route catalogue must not advertise disabled route ${id}`);
}

const adminRoute = requireTokens('src/routes/businessAutopilotAdmin.ts', [
  'historical_record_write_disabled',
  'historical_record_write_disabled',
  '{ status: 410 }',
  'business_historical_review_record_saved',
  'historicalOnly: true',
  'deliverable: false',
  'authoritativeForExecution: false',
]);
if ((adminRoute.match(/historical_record_write_disabled/g) || []).length < 2) {
  errors.push('Business admin route must disable both direct draft and approval writes');
}

requireTokens('scripts/print-business-autopilot-route-contract-check.mjs', [
  'EVAVO Business Autopilot route-contract smoke check',
  '$disabledBusinessWriteRouteIds',
  '$disabledBusinessWritePaths',
  'Disabled direct draft and approval write routes are not advertised.',
  'All advertised Business Autopilot metadata-write routes use confirm_required and non-executing posture.',
  'function Assert-DisabledBusinessWrite',
  '-Method POST',
  '-Body \'{"confirm":true}\'',
  '$statusCode -ne 410',
  'Disabled Business write correctly returned 410 Gone',
  'Verify retired Business write endpoints fail closed',
]);

requireTokens('package.json', [
  'business:autopilot:check',
  'business:draft-runtime-safety:check',
  'business:historical-record-posture:check',
  'business:route-contract:print',
]);

forbidTokens('docs/business-autopilot-architecture.md', [
  '### Level 1: Draft-only',
  '### Level 2: Approval-required execution',
  '### Level 4: Capped campaign mode',
  'send approved email',
]);

forbidTokens('docs/business-autopilot-governance-policy.md', [
  'Research autonomously. Draft helpfully. Execute only under governed approval.',
  'approved_to_send',
  'External actions must support caps before execution is enabled',
]);

forbidTokens('docs/business-autopilot-compliance-policy.md', [
  'Before any email send endpoint can be enabled',
  'Owned social publishing requires:',
  'Draft generation may occur without consent checks',
]);

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: 'EVAVO-STUDIO/evavo-worker-agent',
  contract: 'business-autopilot-foundation-v3-deployed-retirement-check',
  activeReadRouteIds,
  activeConfirmRouteIds,
  disabledWriteRouteIds,
  retiredWriteEndpointsExpectedStatus: 410,
  deployedRetiredWriteChecksRequired: true,
  externalExecutionEnabled: false,
  deliverableDraftGenerationEnabled: false,
  approvalToExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) {
  console.error('Business Autopilot foundation check failed.');
  process.exitCode = 1;
} else {
  console.log('Business Autopilot foundation check passed.');
}
