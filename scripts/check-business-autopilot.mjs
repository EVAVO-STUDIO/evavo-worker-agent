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
  'business_people',
  'business_websites',
  'business_pages',
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

const confirmRouteIds = [
  'business_organization_save',
  'business_person_save',
  'business_website_save',
  'business_page_save',
  'business_signal_save',
  'business_opportunity_save',
  'business_service_match_save',
  'business_audit_pack_save',
  'business_action_draft_build',
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
  'README.md': ['EVAVO Business Autopilot', 'Business Autopilot summary', 'Business Autopilot validation commands', 'Business Autopilot:', 'business_action_draft_build', 'business:autopilot:readonly:print', 'business:route-contract:print', 'docs/business-autopilot-validation.md', 'no third-party commenting', 'no contact-form submission', 'no browser execution', 'no external mutation'],
  'docs/business-autopilot-architecture.md': ['EVAVO Business Autopilot architecture', 'Evidence-backed decisions and approved actions', 'Intelligence layer', 'Evaluation layer', 'Strategy layer', 'Action-preparation layer', 'Governance layer', 'Execution layer', 'Level 0: Read-only intelligence', 'Level 1: Draft-only', 'Level 2: Approval-required execution', 'Level 3: Rules-approved internal actions', 'Level 4: Capped campaign mode', 'Level 5: Broad external autonomy', ...tables],
  'docs/business-autopilot-governance-policy.md': ['EVAVO Business Autopilot governance policy', 'Research autonomously. Draft helpfully. Execute only under governed approval.', 'send_email', 'post_social', 'comment_social', 'submit_form', 'mutate_external_system', 'execute_browser_action', 'ignore_suppression', 'Approval records must capture', 'Suppression wins over approval.', 'kill switch', 'The browser must not receive'],
  'docs/business-autopilot-compliance-policy.md': ['EVAVO Business Autopilot compliance policy', 'The first implementation is metadata-only and draft-only.', 'Email compliance gates', 'Social compliance gates', 'Contact-form policy', 'Suppression records must be treated as higher priority than approval records.', 'compliance gate', 'suppression gate', 'approval gate', 'rate/cap gate', 'audit gate', 'kill switch gate'],
  'docs/business-autopilot-data-model.md': ['EVAVO Business Autopilot data model', 'business intelligence', 'opportunity scoring', 'website audit packs', 'service matching', 'action drafts', 'approval records', 'execution records', 'suppression records', 'migrations/0021_business_autopilot_foundation.sql', ...tables],
  'docs/business-autopilot-draft-review-route-plan.md': ['Business Autopilot draft review route plan', 'buildBusinessDraftReviewBundle(input)', 'saveBusinessActionDraft(env, bundle.draftBuild.draft)', 'saveBusinessApprovalRequest(env', 'business_action_draft_review', 'external_use_not_allowed_by_this_record', 'no email sending', 'no social posting', 'no contact-form submission', 'no browser execution', 'createApprovalRequest: false'],
  'docs/business-autopilot-validation.md': ['Business Autopilot validation workflow', 'npm run business:autopilot:check', 'npm run business:route-contract:print', 'npm run business:autopilot:readonly:print', 'business_websites', 'business_pages', 'business_website_save', 'business_page_save', 'safety.readOnly: true', 'safety.internalMetadataOnly: true', 'does not perform external execution'],
  'docs/business-autopilot-website-page-routes.md': ['Business Autopilot website and page routes', 'business_websites', 'business_pages', 'business_website_save', 'business_page_save', 'GET /admin/business/websites?limit=25', 'GET /admin/business/pages?limit=25', 'POST /admin/business/websites?confirm=1', 'POST /admin/business/pages?confirm=1', 'do not crawl, fetch, send, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems'],
  'migrations/0021_business_autopilot_foundation.sql': ['Business Autopilot foundation metadata schema', 'does not enable email sending, social posting', ...tables.map((table) => `CREATE TABLE IF NOT EXISTS ${table}`), 'compliance_status TEXT NOT NULL DEFAULT', 'approval_status TEXT NOT NULL DEFAULT', 'execution_type TEXT NOT NULL', 'active INTEGER NOT NULL DEFAULT 1'],
  'src/core/businessAutopilotSafety.ts': ['BusinessAutopilotSafety', 'BUSINESS_AUTOPILOT_BLOCKED_EXTERNAL_ACTIONS', 'BUSINESS_AUTOPILOT_EXECUTION_LEVELS', 'businessAutopilotReadSafety', 'businessAutopilotMetadataWriteSafety', 'assertBusinessAutopilotReadSafety', 'assertBusinessAutopilotMetadataWriteSafety', ...safetyTokens],
  'src/core/businessAutopilotTypes.ts': ['BusinessOrganizationInput', 'BusinessOpportunityInput', 'BusinessActionDraftInput', 'BusinessApprovalRequestInput', 'BusinessSignalInput', 'BusinessServiceMatchInput', 'buildBusinessOrganization', 'buildBusinessSignal', 'buildBusinessOpportunity', 'buildBusinessServiceMatch', 'buildBusinessActionDraft', 'buildBusinessApprovalRequest', 'draft_only', 'needs_review', 'BUSINESS_AUTOPILOT_BLOCKED_EXTERNAL_ACTIONS'],
  'src/core/businessAutopilotServiceMatcher.ts': ['BusinessServiceMatchSuggestion', 'listEvavoServiceDefinitions', 'matchEvavoServicesFromSignals', 'primaryServiceFromSignals', 'website_rebuild', 'ux_ui', 'analytics_seo', 'ai_chatbot', 'automation', 'three_d_interactive', 'gamification', 'funnels', 'hotspot', 'ecommerce', 'performance_maintenance', 'content_strategy'],
  'src/core/businessAutopilotOpportunityScoring.ts': ['BusinessOpportunityScoreInput', 'BusinessOpportunityScore', 'scoreBusinessOpportunity', 'fitScore', 'needScore', 'urgencyScore', 'budgetLikelihoodScore', 'contactabilityScore', 'evidenceQualityScore', 'riskScore', 'confidenceScore', 'recommendedService', 'recommendedAngle', 'Prepare an evidence-backed audit pack'],
  'src/core/businessAutopilotAuditPacks.ts': ['BusinessAuditPackInput', 'BusinessAuditPack', 'buildBusinessAuditPack', 'opportunity_teardown', 'scoreBusinessOpportunity', 'matchEvavoServicesFromSignals', 'Governance requirement', 'send_email', 'post_social', 'comment_social', 'submit_form'],
  'src/core/businessAutopilotActionDraftBuilder.ts': ['BusinessDraftBuildIntent', 'BusinessDraftBuildInput', 'BusinessDraftBuildResult', 'buildBusinessDraftOnlyAction', 'draft_only', 'approval_required', 'suppression_check_required', 'contactability_check_required', 'Do not send email from this route.', 'Do not post on social platforms from this route.', 'Do not submit contact forms from this route.', 'Get explicit operator approval before any external action.'],
  'src/core/businessAutopilotApprovalBuilder.ts': ['BusinessApprovalBuildInput', 'BusinessApprovalBuildResult', 'buildBusinessActionDraftApproval', 'business_action_draft_review', 'external_use_not_allowed_by_this_record', 'This approval request does not send email.', 'This approval request does not post on social platforms.', 'This approval request does not submit forms.', 'This approval request does not execute browser actions.'],
  'src/core/businessAutopilotDraftReviewBundle.ts': ['BusinessDraftReviewBundleInput', 'BusinessDraftReviewBundle', 'buildBusinessDraftReviewBundle', 'buildBusinessDraftOnlyAction', 'buildBusinessActionDraftApproval', 'externalExecutionAllowed: false', 'send_email', 'post_social', 'submit_form', 'execute_browser_action'],
  'src/core/businessAutopilotPeopleRecords.ts': ['BusinessPersonInput', 'businessPeopleReadPayload', 'businessPersonWritePayload', 'listBusinessPeople', 'saveBusinessPerson', 'business_people', 'allowedUse', 'contactStatus', 'businessAutopilotReadSafety', 'businessAutopilotMetadataWriteSafety'],
  'src/core/businessAutopilotWebsiteRecords.ts': ['BusinessWebsiteInput', 'BusinessPageInput', 'listBusinessWebsites', 'saveBusinessWebsite', 'listBusinessPages', 'saveBusinessPage', 'business_websites', 'business_pages', 'crawlAllowed', 'businessAutopilotReadSafety', 'businessAutopilotMetadataWriteSafety'],
  'src/core/businessAutopilotAuditPackRecords.ts': ['listBusinessAuditPacks', 'saveBusinessAuditPack', 'businessAuditPackReadPayload', 'business_audit_packs', 'buildBusinessAuditPack', 'businessAutopilotReadSafety', 'businessAutopilotMetadataWriteSafety'],
  'src/core/businessAutopilotRecords.ts': ['listBusinessOrganizations', 'saveBusinessOrganization', 'listBusinessSignals', 'saveBusinessSignal', 'listBusinessOpportunities', 'saveBusinessOpportunity', 'listBusinessServiceMatches', 'saveBusinessServiceMatch', 'listBusinessActionDrafts', 'saveBusinessActionDraft', 'listBusinessApprovalRequests', 'saveBusinessApprovalRequest', 'listBusinessSuppression', 'saveBusinessSuppression', 'listBusinessContentIdeas', 'saveBusinessContentIdea', 'listBusinessFollowups', 'saveBusinessFollowup', 'listBusinessLearningEvents', 'saveBusinessLearningEvent', 'businessAutopilotReadSafety', 'businessAutopilotMetadataWriteSafety'],
  'src/routes/businessAutopilotRouteCatalogue.ts': ['businessAutopilotRouteCatalogue', 'businessAutopilotReadRouteIds', 'businessAutopilotConfirmRouteIds', ...readRouteIds, ...confirmRouteIds, 'safety: "read_only"', 'safety: "confirm_required"', 'callsNetwork: false', 'callsAI: false', 'canSendEmail: false', 'does not send, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems'],
  'src/routes/businessAutopilotPeopleAdmin.ts': ['handleBusinessAutopilotPeopleAdmin', '/admin/business/people', 'business_people', 'Business people writes require confirmation', 'do not enrich contacts, scrape profiles, send email, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems'],
  'src/routes/businessAutopilotWebsiteAdmin.ts': ['handleBusinessAutopilotWebsiteAdmin', '/admin/business/websites', '/admin/business/pages', 'business_websites', 'business_pages', 'Business website/page writes require confirmation', 'do not crawl, fetch, send, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems'],
  'src/routes/businessAutopilotAdmin.ts': ['handleBusinessAutopilotAdmin', 'buildBusinessDraftOnlyAction', 'business_action_draft_built', 'Business Autopilot writes require confirmation', '0021_business_autopilot_foundation.sql', '/admin/business/organizations', '/admin/business/signals', '/admin/business/opportunities', '/admin/business/service-matches', '/admin/business/audit-packs', '/admin/business/action-drafts/build', '/admin/business/action-drafts', '/admin/business/approval-requests', '/admin/business/suppression', '/admin/business/content-ideas', '/admin/business/followups', '/admin/business/learning', 'listBusinessAuditPacks', 'saveBusinessAuditPack'],
  'src/index.ts': ['handleBusinessAutopilotAdmin', 'handleBusinessAutopilotWebsiteAdmin', 'handleBusinessAutopilotPeopleAdmin', 'pathname === "/admin/business/people"', 'pathname === "/admin/business/websites" || pathname === "/admin/business/pages"', 'pathname === "/admin/business" || pathname.startsWith("/admin/business/")'],
  'scripts/apply-business-autopilot-route-catalogue.mjs': ['businessAutopilotRouteCatalogue', 'routeCataloguePlanner.ts', 'Applied Business Autopilot route catalogue wiring.', 'zero_source_route_map'],
  'scripts/print-business-autopilot-route-contract-check.mjs': ['EVAVO Business Autopilot route-contract smoke check', 'Business Autopilot route contract is valid.', ...readRouteIds, ...confirmRouteIds, '/admin/business/organizations?limit=5', '/admin/business/people?limit=5', '/admin/business/websites?limit=5', '/admin/business/pages?limit=5', '/admin/business/audit-packs?limit=5', '/admin/business/learning?limit=5', 'Business Autopilot route has missing or unsafe read safety', 'does not send, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems'],
  'scripts/print-business-autopilot-readonly-verify-commands.mjs': ['EVAVO Business Autopilot read-only verification', 'Assert-BusinessRead', '/admin/business/organizations?limit=5', '/admin/business/people?limit=5', '/admin/business/websites?limit=5', '/admin/business/pages?limit=5', '/admin/business/audit-packs?limit=5', '/admin/business/learning?limit=5', 'Business Autopilot read-only verification complete.', 'does not send, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems'],
  'scripts/check-business-autopilot.mjs': ['Business Autopilot foundation check passed.', 'src/core/businessAutopilotSafety.ts', 'src/core/businessAutopilotTypes.ts', 'src/core/businessAutopilotRecords.ts', 'src/core/businessAutopilotPeopleRecords.ts', 'src/routes/businessAutopilotPeopleAdmin.ts', 'src/core/businessAutopilotServiceMatcher.ts', 'src/core/businessAutopilotOpportunityScoring.ts', 'src/core/businessAutopilotAuditPacks.ts', 'src/core/businessAutopilotActionDraftBuilder.ts', 'src/core/businessAutopilotApprovalBuilder.ts', 'src/core/businessAutopilotDraftReviewBundle.ts', 'src/core/businessAutopilotWebsiteRecords.ts', 'src/routes/businessAutopilotWebsiteAdmin.ts', 'docs/business-autopilot-draft-review-route-plan.md', 'docs/business-autopilot-validation.md', 'docs/business-autopilot-website-page-routes.md', 'scripts/print-business-autopilot-readonly-verify-commands.mjs', 'src/core/businessAutopilotAuditPackRecords.ts', 'src/routes/businessAutopilotAdmin.ts', 'src/routes/businessAutopilotRouteCatalogue.ts', 'scripts/print-business-autopilot-route-contract-check.mjs', '0021_business_autopilot_foundation.sql'],
  'scripts/check-migrations-present.mjs': ['0021_business_autopilot_foundation.sql'],
  'migrations/README.md': ['0021_business_autopilot_foundation.sql', 'Business Autopilot metadata foundation', 'does not enable sending, social posting, commenting, contact-form submission, browser automation, AI calls, ad buying, or external execution'],
  'package.json': ['business:autopilot:check', 'business:autopilot:readonly:print', 'business:route-contract:print', 'node scripts/check-business-autopilot.mjs', 'node scripts/print-business-autopilot-readonly-verify-commands.mjs', 'node scripts/print-business-autopilot-route-contract-check.mjs', 'node scripts/apply-business-autopilot-route-catalogue.mjs'],
};

let failed = false;
function fail(message) { failed = true; console.error(`FAIL ${message}`); }
function pass(message) { console.log(`OK   ${message}`); }

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
