#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing suppression safety source: ${relativePath}`);
    return '';
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function requireTokens(label, source, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) errors.push(`${label} is missing ${token}`);
  }
}

function forbidTokens(label, source, tokens) {
  for (const token of tokens) {
    if (source.includes(token)) errors.push(`${label} contains unsafe suppression posture ${token}`);
  }
}

const normalizer = read('src/core/businessSuppressionSafety.ts');
const route = read('src/routes/businessAutopilotAdmin.ts');
const packageText = read('package.json');

requireTokens('Business suppression normalizer', normalizer, [
  'normalizeBusinessSuppressionInput',
  'markBusinessSuppressionRecord',
  "contract: 'business_suppression_integrity_v2'",
  'forcedActive: true',
  'automaticExpiryAllowed: false',
  'active: true',
  'expiresAt: null',
  'requestedActive:',
  'requestedExpiresAt:',
  'internalMetadataOnly: true',
  'reviewOnly: true',
  'executable: false',
  'deliverable: false',
  'authoritativeForExecution: false',
  'externalExecutionAllowed: false',
]);

for (const value of [
  'organization',
  'domain',
  'person',
  'email',
  'channel',
  'campaign',
  'source',
  'manual_do_not_contact',
  'unsubscribe',
  'bounce',
  'complaint',
  'bad_fit',
  'competitor',
  'existing_client',
  'legal_risk',
  'brand_risk',
  'duplicate',
]) {
  if (!normalizer.includes(`'${value}'`)) errors.push(`Suppression allow-list is missing ${value}`);
}

requireTokens('Business suppression route', route, [
  'normalizeBusinessSuppressionInput',
  'markBusinessSuppressionRecord',
  'const normalized = normalizeBusinessSuppressionInput(body.suppression || body);',
  'markBusinessSuppressionRecord(await saveBusinessSuppression(env, normalized))',
  'contract: "business_suppression_integrity_v2"',
  'safetyCritical: true',
  'forcedActive: true',
  'automaticExpiryAllowed: false',
  'contract: "business_suppression_reads_v2"',
  'authoritativeForExecution: false',
  'externalExecutionAllowed: false',
]);

forbidTokens('Business suppression route', route, [
  'saveBusinessSuppression(env, body.suppression || body)',
]);

if (!packageText.includes('business:suppression-integrity:check')) {
  errors.push('package.json must expose business:suppression-integrity:check');
}
if (!packageText.includes('npm run business:suppression-integrity:check')) {
  errors.push('check:local must include business:suppression-integrity:check');
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: 'EVAVO-STUDIO/evavo-worker-agent',
  contract: 'business-suppression-integrity-v2',
  suppressionWritesForcedActive: true,
  automaticSuppressionExpiryAllowed: false,
  arbitrarySuppressionScopeAllowed: false,
  arbitrarySuppressionReasonAllowed: false,
  outboundExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
