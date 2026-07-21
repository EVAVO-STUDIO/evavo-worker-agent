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

const normalizer = read('src/core/businessInternalPlanningSafety.ts');
const route = read('src/routes/businessAutopilotAdmin.ts');
const packageJson = JSON.parse(read('package.json') || '{}');

requireTokens('Planning normalizer', normalizer, [
  'normalizeBusinessContentIdeaInput',
  "contentType: 'internal_idea'",
  "recommendedChannel: 'internal_review'",
  "status: 'needs_review'",
  'publishable: false',
  'normalizeBusinessFollowupInput',
  "followupType: 'manual_internal_review'",
  'actionDraftId: null',
  'requestedFollowupType',
  'requestedActionDraftId',
  'internalMetadataOnly: true',
  'reviewOnly: true',
  'executable: false',
  'deliverable: false',
  'authoritativeForExecution: false',
  'externalExecutionAllowed: false',
]);

requireTokens('Business admin route', route, [
  'normalizeBusinessContentIdeaInput',
  'normalizeBusinessFollowupInput',
  'markBusinessInternalPlanningRecord',
  'const internalIdeas = ideas.map(markBusinessInternalPlanningRecord)',
  'const internalFollowups = followups.map(markBusinessInternalPlanningRecord)',
  'const normalized = normalizeBusinessContentIdeaInput(body.contentIdea || body)',
  'const normalized = normalizeBusinessFollowupInput(body.followup || body)',
  'reviewOnly: true',
  'executable: false',
  'deliverable: false',
  'authoritativeForExecution: false',
]);

forbidTokens('Business admin route', route, [
  'saveBusinessContentIdea(env, body.contentIdea || body)',
  'saveBusinessFollowup(env, body.followup || body)',
]);

const expectedCommand = 'node scripts/check-business-internal-planning-safety.mjs';
if (packageJson.scripts?.['business:internal-planning-safety:check'] !== expectedCommand) {
  errors.push(`package.json must expose business:internal-planning-safety:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.['check:local'] || '').includes('npm run business:internal-planning-safety:check')) {
  errors.push('check:local must include business:internal-planning-safety:check');
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: 'EVAVO-STUDIO/evavo-worker-agent',
  contract: 'business-internal-planning-safety-v1',
  contentIdeasInternalReviewOnly: true,
  followupsInternalReviewOnly: true,
  callerRequestedExecutionFieldsNonAuthoritative: true,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
