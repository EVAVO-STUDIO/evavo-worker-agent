#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing ${relativePath}`);
    return '';
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function requireTokens(label, text, tokens) {
  for (const token of tokens) {
    if (!text.includes(token)) errors.push(`${label} missing ${token}`);
  }
}

function forbidTokens(label, text, tokens) {
  for (const token of tokens) {
    if (text.includes(token)) errors.push(`${label} contains active historical capability ${token}`);
  }
}

const types = read('src/core/businessAutopilotTypes.ts');
const draftBuilder = read('src/core/businessAutopilotActionDraftBuilder.ts');
const approvalBuilder = read('src/core/businessAutopilotApprovalBuilder.ts');
const bundle = read('src/core/businessAutopilotDraftReviewBundle.ts');
const route = read('src/routes/businessAutopilotAdmin.ts');
const packageSource = read('package.json');

requireTokens('Business type compatibility boundary', types, [
  'export type BusinessActiveStatus =',
  'export type BusinessActiveApprovalStatus =',
  'export type BusinessActiveComplianceStatus =',
  'export type BusinessHistoricalStatus = BusinessActiveStatus | \'approved\';',
  'export type BusinessHistoricalApprovalStatus = BusinessActiveApprovalStatus | \'approved\';',
  'export type BusinessHistoricalComplianceStatus =',
  "| 'draft_only'",
  "| 'consent_verified'",
  "| 'approved_to_send';",
  'Historical values remain decode-only so existing D1 rows and old clients can be read.',
  'They are not valid authority for active builders, delivery, approval-to-execution or external action.',
  'New builder code must use',
  'the BusinessActive* types above for emitted status fields.',
  "status: 'new' as BusinessActiveStatus",
  "complianceStatus: 'not_required_internal' as BusinessActiveComplianceStatus",
  "approvalStatus: 'needs_review' as BusinessActiveApprovalStatus",
  "status: 'needs_review' as BusinessActiveStatus",
  "status: 'needs_review' as BusinessActiveApprovalStatus",
  "draftType: 'crm_note' as BusinessActionDraftType",
  "channel: 'internal'",
  'historicalOnly: true',
  'executable: false',
  'deliverable: false',
  'authoritativeForExecution: false',
]);

for (const unsafeActiveUnion of [
  "export type BusinessActiveStatus = 'new' | 'active' | 'needs_review' | 'approved'",
  "export type BusinessActiveApprovalStatus = 'needs_review' | 'approved'",
  "export type BusinessActiveComplianceStatus = 'approved_to_send'",
  "export type BusinessActiveComplianceStatus = 'draft_only'",
]) {
  if (types.includes(unsafeActiveUnion)) {
    errors.push(`Active Business type must not include historical delivery value: ${unsafeActiveUnion}`);
  }
}

forbidTokens('Active draft builder', draftBuilder, [
  "draftType: 'email'",
  "draftType: 'linkedin_dm'",
  "channel: 'email'",
  "channel: 'linkedin'",
  'requiresApproval: true',
  'approved_to_send',
]);
requireTokens('Active draft builder', draftBuilder, [
  "draftType: 'crm_note'",
  "channel: 'internal'",
  'requiresApproval: false',
  'deliverable: false',
  'authoritativeForExecution: false',
]);

forbidTokens('Approval builder', approvalBuilder, [
  "status: 'approved'",
  'approved_to_send',
  'externalExecutionAllowed: true',
  'authoritativeForExecution: true',
]);
requireTokens('Approval builder', approvalBuilder, [
  'historicalOnly: true',
  'executable: false',
  'deliverable: false',
  'authoritativeForExecution: false',
  'externalExecutionAllowed: false',
]);

forbidTokens('Review bundle', bundle, [
  'needsApproval: true',
  'externalExecutionAllowed: true',
  '? buildBusinessActionDraftApproval({',
]);
requireTokens('Review bundle', bundle, [
  'approvalBuild: null',
  'needsApproval: false',
  'deliverable: false',
  'authoritativeForExecution: false',
]);

requireTokens('Business admin route', route, [
  'historical_record_write_disabled',
  'business_action_draft_write_disabled',
  'business_approval_request_write_disabled',
  '{ status: 410 }',
]);

const packageJson = packageSource ? JSON.parse(packageSource) : {};
const expected = 'node scripts/check-business-historical-type-isolation.mjs';
if (packageJson.scripts?.['business:historical-type-isolation:check'] !== expected) {
  errors.push(`package.json must expose business:historical-type-isolation:check as ${expected}`);
}
if (!String(packageJson.scripts?.['check:local'] || '').includes('npm run business:historical-type-isolation:check')) {
  errors.push('check:local must include business:historical-type-isolation:check');
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: 'EVAVO-STUDIO/evavo-worker-agent',
  contract: 'business-historical-type-isolation-v2-active-unions',
  historicalEnumsDecodeOnly: true,
  activeStatusUnionsExcludeApprovalAndDeliveryValues: true,
  activeBuildersUseActiveStatusTypes: true,
  activeBuildersEmitInternalReviewMetadataOnly: true,
  approvalToExecutionDisabled: true,
  retiredDirectWritesExpectedStatus: 410,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
