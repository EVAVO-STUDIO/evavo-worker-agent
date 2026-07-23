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

function requireTokens(label, source, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) errors.push(`${label} missing ${token}`);
  }
}

function forbidTokens(label, source, tokens) {
  for (const token of tokens) {
    if (source.includes(token)) errors.push(`${label} contains unsafe token ${token}`);
  }
}

const normalizer = read('src/core/businessLearningEventSafety.ts');
const route = read('src/routes/businessAutopilotAdmin.ts');
const packageJson = JSON.parse(read('package.json') || '{}');

requireTokens('Learning normalizer', normalizer, [
  'normalizeBusinessLearningEventInput',
  'markBusinessLearningEventRecord',
  "eventType: 'operator_feedback'",
  "outcome = requestedOutcome && allowedOutcomes.has(requestedOutcome)",
  "entityType = requestedEntityType && allowedEntityTypes.has(requestedEntityType)",
  'Math.max(-10, Math.min(10',
  "contract: 'business_internal_learning_event_v2'",
  'requestedEventType',
  'requestedOutcome',
  'requestedScoreDelta',
  'scoreDeltaMinimum: -10',
  'scoreDeltaMaximum: 10',
  'internalMetadataOnly: true',
  'reviewOnly: true',
  'executable: false',
  'deliverable: false',
  'authoritativeForExecution: false',
  'externalExecutionAllowed: false',
]);

requireTokens('Business admin route', route, [
  'normalizeBusinessLearningEventInput',
  'markBusinessLearningEventRecord',
  'const normalized = normalizeBusinessLearningEventInput(body.learningEvent || body)',
  'markBusinessLearningEventRecord(await saveBusinessLearningEvent(env, normalized))',
  'contract: "business_internal_learning_event_v2"',
  'reviewOnly: true',
  'executable: false',
  'deliverable: false',
  'authoritativeForExecution: false',
  'externalExecutionAllowed: false',
]);

forbidTokens('Business admin route', route, [
  'saveBusinessLearningEvent(env, body.learningEvent || body)',
]);

const expectedCommand = 'node scripts/check-business-learning-event-safety.mjs';
if (packageJson.scripts?.['business:learning-event-safety:check'] !== expectedCommand) {
  errors.push(`package.json must expose business:learning-event-safety:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.['check:local'] || '').includes('npm run business:learning-event-safety:check')) {
  errors.push('check:local must include business:learning-event-safety:check');
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: 'EVAVO-STUDIO/evavo-worker-agent',
  contract: 'business-learning-event-safety-v1',
  eventTypeForcedToOperatorFeedback: true,
  entityTypesAllowlisted: true,
  outcomesAllowlisted: true,
  scoreDeltaMinimum: -10,
  scoreDeltaMaximum: 10,
  callerRequestedValuesNonAuthoritative: true,
  reviewOnly: true,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
