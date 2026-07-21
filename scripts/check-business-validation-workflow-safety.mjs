#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const documentPath = path.join(root, "docs", "business-autopilot-validation.md");
const packagePath = path.join(root, "package.json");

const document = fs.existsSync(documentPath)
  ? fs.readFileSync(documentPath, "utf8")
  : "";
const packageJson = fs.existsSync(packagePath)
  ? JSON.parse(fs.readFileSync(packagePath, "utf8"))
  : {};

if (!document) errors.push("Missing docs/business-autopilot-validation.md");
if (!fs.existsSync(packagePath)) errors.push("Missing package.json");

const required = [
  "The active Business Autopilot is an authenticated, internal-metadata, scoring, website/page memory, audit and review system.",
  "Historical draft-shaped and approval-shaped records remain readable for compatibility only.",
  "business:draft-runtime-safety:check",
  "business:historical-record-posture:check",
  "business:autopilot:check",
  "business:route-policy:check",
  "business_action_draft_build",
  "It saves one internal historical review record only.",
  "business_action_draft_save",
  "business_approval_request_save",
  "Direct POST requests to their underlying paths return `410 Gone`.",
  "Routine validation must not execute migrations or rewrite generated route files.",
  "Migration execution requires a separate, explicit database-target decision",
  "Dashboard verification is read-only",
];

for (const token of required) {
  if (!document.includes(token)) errors.push(`Validation workflow is missing: ${token}`);
}

const forbiddenActiveInstructions = [
  "Expected Business confirm-required route IDs:\n\n```text\nbusiness_organization_save",
  "all Business route IDs are advertised",
  "npm run db:migration:one -- 0021 --execute",
  "npm run growth:wiring:apply\nnpm run growth:route-catalogue:apply",
  "draft-only governance layer",
  "approval request builder\ndraft-review bundle builder",
  "unconfirmed draft-builder writes are blocked",
];

for (const token of forbiddenActiveInstructions) {
  if (document.includes(token)) errors.push(`Validation workflow contains stale active instruction: ${token}`);
}

const expectedCommand = "node scripts/check-business-validation-workflow-safety.mjs";
if (packageJson.scripts?.["business:validation-workflow-safety:check"] !== expectedCommand) {
  errors.push(`package.json must expose business:validation-workflow-safety:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run business:validation-workflow-safety:check")) {
  errors.push("check:local must include business:validation-workflow-safety:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "business-validation-workflow-v2-read-only",
  routineValidationExecutesMigrations: false,
  routineValidationRewritesGeneratedRoutes: false,
  disabledDraftWritesAdvertised: false,
  disabledApprovalWritesAdvertised: false,
  dashboardVerificationReadOnly: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
