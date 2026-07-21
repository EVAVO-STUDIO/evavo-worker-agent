#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const packagePath = path.join(root, "package.json");

if (!fs.existsSync(packagePath)) {
  errors.push("Missing package.json");
}

const packageJson = fs.existsSync(packagePath)
  ? JSON.parse(fs.readFileSync(packagePath, "utf8"))
  : {};
const scripts = packageJson.scripts || {};
const checkLocal = String(scripts["check:local"] || "");

const requiredSafetyCommands = {
  "docs:operating-posture:check": "node scripts/check-readme-operating-posture.mjs",
  "business:draft-runtime-safety:check": "node scripts/check-business-draft-runtime-safety.mjs",
  "business:historical-record-posture:check": "node scripts/check-business-historical-record-posture.mjs",
  "business:validation-workflow-safety:check": "node scripts/check-business-validation-workflow-safety.mjs",
  "admin:broad-read-truthfulness:check": "node scripts/check-broad-admin-read-truthfulness.mjs",
  "admin:broad-write-safety:check": "node scripts/check-broad-admin-write-safety.mjs",
  "admin:reporting-truthfulness:check": "node scripts/check-admin-reporting-truthfulness.mjs",
  "admin:schema-safety:check": "node scripts/check-admin-schema-safety.mjs",
  "autonomy:capability-truthfulness:check": "node scripts/check-autonomy-capability-truthfulness.mjs",
  "sources:confirmation-safety:check": "node scripts/check-source-action-confirmation-safety.mjs",
  "opportunities:execution-boundary-safety:check": "node scripts/check-opportunity-execution-boundary-safety.mjs",
  "growth:subhandler-auth-safety:check": "node scripts/check-growth-subhandler-auth-safety.mjs",
  "worker:central-auth-safety:check": "node scripts/check-central-authentication-safety.mjs",
};

for (const [scriptName, expectedCommand] of Object.entries(requiredSafetyCommands)) {
  if (scripts[scriptName] !== expectedCommand) {
    errors.push(`package.json must expose ${scriptName} as ${expectedCommand}`);
  }
  if (!checkLocal.includes(`npm run ${scriptName}`)) {
    errors.push(`check:local must include ${scriptName}`);
  }
}

for (const relativePath of [
  "scripts/check-readme-operating-posture.mjs",
  "scripts/check-business-draft-runtime-safety.mjs",
  "scripts/check-business-historical-record-posture.mjs",
  "scripts/check-business-validation-workflow-safety.mjs",
  "scripts/check-broad-admin-read-truthfulness.mjs",
  "scripts/check-broad-admin-write-safety.mjs",
  "scripts/check-admin-reporting-truthfulness.mjs",
  "scripts/check-admin-schema-safety.mjs",
  "scripts/check-autonomy-capability-truthfulness.mjs",
  "scripts/check-source-action-confirmation-safety.mjs",
  "scripts/check-opportunity-execution-boundary-safety.mjs",
  "scripts/check-growth-subhandler-auth-safety.mjs",
  "scripts/check-central-authentication-safety.mjs",
]) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    errors.push(`Missing safety contract: ${relativePath}`);
  }
}

if (!String(scripts.predeploy || "").includes("npm run check:local")) {
  errors.push("predeploy must run the complete check:local gate");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "safety-gate-completeness",
  readmeOperatingPostureRequired: true,
  businessDraftRuntimeSafetyRequired: true,
  businessHistoricalRecordPostureRequired: true,
  businessValidationWorkflowSafetyRequired: true,
  broadAdminReadTruthfulnessRequired: true,
  broadAdminWriteSafetyRequired: true,
  adminReportingTruthfulnessRequired: true,
  authenticatedSchemaSafetyRequired: true,
  autonomyCapabilityTruthfulnessRequired: true,
  sourceConfirmationSafetyRequired: true,
  opportunityExecutionBoundarySafetyRequired: true,
  growthSubhandlerAuthenticationSafetyRequired: true,
  centralAuthenticationSafetyRequired: true,
  predeployUsesCompleteLocalGate: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
