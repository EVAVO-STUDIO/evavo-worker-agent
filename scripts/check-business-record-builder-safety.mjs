#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

const types = read("src/core/businessAutopilotTypes.ts");
const packageJson = JSON.parse(read("package.json") || "{}");

for (const token of [
  "Historical values remain in these unions so existing D1 rows can be decoded.",
  "business_historical_record_v2",
  "historicalOnly: true",
  "reviewOnly: true",
  "executable: false",
  "deliverable: false",
  "authoritativeForExecution: false",
  "externalExecutionAllowed: false",
  "draftType: 'crm_note' as BusinessActionDraftType",
  "channel: 'internal'",
  "complianceStatus: 'not_required_internal' as BusinessComplianceStatus",
  "status: 'needs_review' as BusinessStatus",
  "requestType: clean(input.requestType) || 'historical_review'",
  "approval_cannot_enable_execution",
  "external_use_not_allowed_by_this_record",
  "blockedActions: [...BUSINESS_AUTOPILOT_BLOCKED_EXTERNAL_ACTIONS]",
]) {
  if (!types.includes(token)) errors.push(`Business record builders missing safe posture: ${token}`);
}

for (const unsafe of [
  "complianceStatus: 'draft_only' as BusinessComplianceStatus",
  "status: 'draft' as BusinessStatus",
  "draftType: input.draftType,",
  "channel: clean(input.channel) || 'internal',",
  "requestType: clean(input.requestType) || 'action_draft'",
]) {
  if (types.includes(unsafe)) errors.push(`Business record builders contain stale authoritative default: ${unsafe}`);
}

const expectedCommand = "node scripts/check-business-record-builder-safety.mjs";
const scripts = packageJson.scripts || {};
if (scripts["business:record-builder-safety:check"] !== expectedCommand) {
  errors.push(`package.json must expose business:record-builder-safety:check as ${expectedCommand}`);
}
if (!String(scripts["check:local"] || "").includes("npm run business:record-builder-safety:check")) {
  errors.push("check:local must include business:record-builder-safety:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "business-record-builder-safety-v1",
  historicalUnionValuesCompatibilityOnly: true,
  actionRecordsInternalOnly: true,
  approvalRecordsNonAuthoritative: true,
  deliverableDraftGenerationEnabled: false,
  approvalToExecutionEnabled: false,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
