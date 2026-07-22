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

function requireTokens(label, source, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) errors.push(`${label} is missing: ${token}`);
  }
}

function forbidTokens(label, source, tokens) {
  for (const token of tokens) {
    if (source.includes(token)) errors.push(`${label} contains stale execution-oriented wording: ${token}`);
  }
}

const scoring = read("src/core/businessAutopilotOpportunityScoring.ts");
const auditPacks = read("src/core/businessAutopilotAuditPacks.ts");
const packageJson = JSON.parse(read("package.json") || "{}");

requireTokens("Opportunity scoring", scoring, [
  "Prepare an evidence-backed audit pack for internal operator review and record a manual disposition.",
  "Collect more evidence, then decide whether an internal audit pack is justified.",
  "The recommended next step is internal review metadata only and does not authorise drafting, outreach or external action.",
]);

forbidTokens("Opportunity scoring", scoring, [
  "draft-only outreach",
  "before preparing outreach",
  "prepare outreach",
  "send email",
  "contact-form message",
]);

requireTokens("Audit-pack builder", auditPacks, [
  "status: 'needs_review'",
  "business_audit_pack_v2_internal_review_only",
  "reviewOnly: true",
  "executable: false",
  "deliverable: false",
  "authoritativeForExecution: false",
  "externalExecutionAllowed: false",
  "type: 'internal_review_step'",
  "externalActionAllowed: false",
  "approval or confirmation cannot enable them",
  "generate_deliverable_draft",
  "approve_for_delivery",
]);

forbidTokens("Audit-pack builder", auditPacks, [
  "status: 'draft'",
  "must remain draft-only until approval",
  "prepare outreach",
  "approval can enable",
  "externalActionAllowed: true",
  "executable: true",
  "deliverable: true",
]);

const expectedCommand = "node scripts/check-business-opportunity-review-safety.mjs";
if (packageJson.scripts?.["business:opportunity-review-safety:check"] !== expectedCommand) {
  errors.push(`package.json must expose business:opportunity-review-safety:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run business:opportunity-review-safety:check")) {
  errors.push("check:local must include business:opportunity-review-safety:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "business-opportunity-review-safety-v1-internal-only",
  opportunityRecommendationsInternalOnly: true,
  auditPackStatus: "needs_review",
  auditPacksDeliverable: false,
  approvalCanEnableExternalAction: false,
  outreachRecommendationEnabled: false,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
