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
  'Historical values remain in these unions so existing D1 rows can be decoded.',
  'Builders in the active Worker must not use approval or delivery-shaped values as authority.',
  "'approved_to_send'",
  "'email'",
  "'linkedin_dm'",
  "draftType: 'crm_note' as BusinessActionDraftType",
  "channel: 'internal'",
  "complianceStatus: 'not_required_internal' as BusinessComplianceStatus",
  "approvalStatus: 'needs_review' as BusinessApprovalStatus",
  'historicalOnly: true',
  'executable: false',
  'deliverable: false',
  'authoritativeForExecution: false',
]);

forbidTokens('Active draft builder', draftBuilder, [
  "draftType: 'email'",
  "draftType: 'linkedin_dm'",
  "channel: 'email'",
  "channel: 'linkedin'",
  "requiresApproval: true",
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
  contract: 'business-historical-type-isolation',
  historicalEnumsDecodeOnly: true,
  activeBuildersEmitInternalReviewMetadataOnly: true,
  approvalToExecutionDisabled: true,
  retiredDirectWritesExpectedStatus: 410,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
