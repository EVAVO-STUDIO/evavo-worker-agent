#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function requireTokens(label, source, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) errors.push(`${label} missing ${token}`);
  }
}

const projection = read("src/core/businessHistoricalReadProjection.ts");
const route = read("src/routes/businessAutopilotAdmin.ts");
const packageJson = JSON.parse(read("package.json") || "{}");

requireTokens("historical projection", projection, [
  "projectHistoricalBusinessDraft",
  "projectHistoricalBusinessApproval",
  "payload: payloadPresent ? { redacted: true } : {}",
  "reviewChecklist: checklistPresent ? [historicalContentRedaction] : []",
  "approvalReason: reasonPresent ? historicalContentRedaction : null",
  "approvedBy: null",
  "approvedAt: null",
  "historicalIdentityRedacted: identityPresent",
  "historicalOnly: true",
  "executable: false",
  "deliverable: false",
  "authoritativeForExecution: false",
]);

requireTokens("Business admin route", route, [
  'from "../core/businessHistoricalReadProjection"',
  "projectHistoricalBusinessDraft(record)",
  "projectHistoricalBusinessApproval(record)",
  'contract: "business_historical_draft_reads_v3_minimized"',
  'contract: "business_historical_approval_reads_v3_minimized"',
  "historicalIdentityRedacted: true",
]);

for (const stale of [
  "drafts.map(markHistoricalBusinessRecord)",
  "approvals.map(markHistoricalBusinessRecord)",
]) {
  if (route.includes(stale)) errors.push(`Business admin route contains stale broad projection ${stale}`);
}

const expectedCommand = "node scripts/check-business-historical-read-minimisation.mjs";
if (packageJson.scripts?.["business:historical-read-minimisation:check"] !== expectedCommand) {
  errors.push(`package.json must expose business:historical-read-minimisation:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run business:historical-read-minimisation:check")) {
  errors.push("check:local must include business:historical-read-minimisation:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "business-historical-read-minimisation-v1",
  historicalDraftPayloadRedacted: true,
  historicalApprovalIdentityRedacted: true,
  historicalApprovalFreeTextRedacted: true,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
