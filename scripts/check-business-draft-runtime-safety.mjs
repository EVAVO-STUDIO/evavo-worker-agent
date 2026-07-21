#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];

const files = {
  builder: 'src/core/businessAutopilotActionDraftBuilder.ts',
  approval: 'src/core/businessAutopilotApprovalBuilder.ts',
  bundle: 'src/core/businessAutopilotDraftReviewBundle.ts',
  route: 'src/routes/businessAutopilotAdmin.ts',
  catalogue: 'src/routes/businessAutopilotRouteCatalogue.ts',
  package: 'package.json',
};

const source = {};
for (const [key, relativePath] of Object.entries(files)) {
  const absolutePath = path.join(root, relativePath);
  source[key] = fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : '';
  if (!source[key]) errors.push(`Missing ${relativePath}`);
}

function requireTokens(label, text, tokens) {
  for (const token of tokens) {
    if (!text.includes(token)) errors.push(`${label} missing ${token}`);
  }
}

function forbidTokens(label, text, tokens) {
  for (const token of tokens) {
    if (text.includes(token)) errors.push(`${label} contains unsafe token ${token}`);
  }
}

requireTokens('builder', source.builder, [
  "draftType: 'crm_note'",
  "channel: 'internal'",
  "contract: 'business_historical_review_record_v2'",
  'historicalOnly: true',
  'reviewOnly: true',
  'executable: false',
  'deliverable: false',
  'authoritativeForExecution: false',
  'requiresApproval: false',
  'This record is not a message, draft, approval or delivery instruction.',
]);

forbidTokens('builder', source.builder, [
  "return `Following up on ${organization}`",
  "return `Quick thought for ${organization}`",
  "'Greg',",
  'Happy to send a short practical teardown if helpful.',
]);

requireTokens('approval builder', source.approval, [
  "contract: 'business_historical_review_approval_v2'",
  'historicalOnly: true',
  'reviewOnly: true',
  'executable: false',
  'deliverable: false',
  'authoritativeForExecution: false',
  'externalExecutionAllowed: false',
  'This approval request cannot authorise delivery or external mutation.',
]);

requireTokens('bundle', source.bundle, [
  'approvalBuild: null',
  'needsApproval: false',
  'draftOnly: false',
  'historicalOnly: true',
  'deliverable: false',
  'authoritativeForExecution: false',
  'externalExecutionAllowed: false',
  "'create_executable_approval'",
]);

forbidTokens('bundle', source.bundle, [
  'const createApprovalRequest = input.createApprovalRequest !== false',
  '? buildBusinessActionDraftApproval({',
]);

requireTokens('route', source.route, [
  'historical_record_write_disabled',
  'business_action_draft_write_disabled',
  'business_approval_request_write_disabled',
  '{ status: 410 }',
  'mode: "business_historical_review_record_saved"',
  'legacyMode: "business_action_draft_built"',
  'historicalOnly: true',
  'deliverable: false',
  'authoritativeForExecution: false',
  'externalExecutionAllowed: false',
]);

forbidTokens('route', source.route, [
  'const draft = await saveBusinessActionDraft(env, body.draft || body);',
  'const approvalRequest = await saveBusinessApprovalRequest(env, body.approvalRequest || body);',
  'mode: "business_action_draft_saved"',
  'mode: "business_approval_request_saved"',
]);

requireTokens('route catalogue', source.catalogue, [
  'disabledBusinessAutopilotWriteRouteIds',
  '"business_action_draft_save"',
  '"business_approval_request_save"',
  'They are intentionally not included in businessAutopilotRouteCatalogue.',
  'Save internal historical review record',
  'does not create deliverable copy, approvals, external execution permission, network activity or third-party state changes',
]);

const catalogueBody = source.catalogue.split('export const businessAutopilotRouteCatalogue: RouteCatalogueItem[] = [')[1]?.split('];')[0] || '';
for (const disabledId of ['business_action_draft_save', 'business_approval_request_save']) {
  if (catalogueBody.includes(`writeRoute("${disabledId}"`)) {
    errors.push(`route catalogue advertises disabled write route ${disabledId}`);
  }
}

const packageJson = source.package ? JSON.parse(source.package) : {};
const expected = 'node scripts/check-business-draft-runtime-safety.mjs';
if (packageJson.scripts?.['business:draft-runtime-safety:check'] !== expected) {
  errors.push(`package.json must expose business:draft-runtime-safety:check as ${expected}`);
}
if (!String(packageJson.scripts?.['check:local'] || '').includes('npm run business:draft-runtime-safety:check')) {
  errors.push('check:local must include business:draft-runtime-safety:check');
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: 'EVAVO-STUDIO/evavo-worker-agent',
  contract: 'business-draft-runtime-safety',
  sendableCopyGenerationDisabled: true,
  approvalBundleCreationDisabled: true,
  arbitraryDraftWritesDisabled: true,
  arbitraryApprovalWritesDisabled: true,
  disabledWriteRoutesNotAdvertised: true,
  historicalReadsRemainAvailable: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
