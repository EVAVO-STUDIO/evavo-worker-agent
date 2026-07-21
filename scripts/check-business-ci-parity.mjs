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

const workflow = read(".github/workflows/worker-contract.yml");
const packageJson = JSON.parse(read("package.json") || "{}");
const generalParity = read("scripts/check-worker-contract-workflow.mjs");
const scripts = packageJson.scripts || {};
const checkLocal = String(scripts["check:local"] || "");

const requiredBusinessContracts = {
  "business:autopilot:check": "node scripts/check-business-autopilot.mjs",
  "business:draft-runtime-safety:check": "node scripts/check-business-draft-runtime-safety.mjs",
  "business:historical-record-posture:check": "node scripts/check-business-historical-record-posture.mjs",
  "business:validation-workflow-safety:check": "node scripts/check-business-validation-workflow-safety.mjs",
  "business:route-catalogue-truthfulness:check": "node scripts/check-business-route-catalogue-truthfulness.mjs",
  "business:route-policy:check": "node scripts/check-business-route-policy.mjs",
};

for (const [scriptName, expectedCommand] of Object.entries(requiredBusinessContracts)) {
  if (scripts[scriptName] !== expectedCommand) {
    errors.push(`package.json must expose ${scriptName} as ${expectedCommand}`);
  }
  if (!checkLocal.includes(`npm run ${scriptName}`)) {
    errors.push(`check:local must include ${scriptName}`);
  }
}

for (const token of [
  "npm ci --no-audit --no-fund",
  "npm run check:local",
  '      - "src/**"',
  '      - "scripts/**"',
  '      - "docs/**"',
  '      - "migrations/**"',
  '      - "README.md"',
  '      - "**/*.ps1"',
  '      - "package.json"',
  '      - "package-lock.json"',
]) {
  if (!workflow.includes(token)) errors.push(`Worker contract workflow is missing: ${token}`);
}

if (workflow.includes("wrangler deploy")) errors.push("Worker contract workflow must not deploy");
if (workflow.includes("ADMIN_TOKEN")) errors.push("Worker contract workflow must not request runtime credentials");

for (const token of [
  'contract: "worker-ci-workflow-parity"',
  'safetyGateCompletenessRequired: true',
  'typedRoutePoliciesRequired: true',
  'historicalStatusesExecutable: false',
]) {
  if (!generalParity.includes(token)) errors.push(`General Worker CI parity checker is missing: ${token}`);
}

const expectedSelfCommand = "node scripts/check-business-ci-parity.mjs";
if (scripts["business:ci-parity:check"] !== expectedSelfCommand) {
  errors.push(`package.json must expose business:ci-parity:check as ${expectedSelfCommand}`);
}
if (!checkLocal.includes("npm run business:ci-parity:check")) {
  errors.push("check:local must include business:ci-parity:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "business-worker-ci-parity-v2",
  workflowRunsCompleteLocalGate: true,
  documentationChangesTriggerWorkflow: true,
  migrationChangesTriggerWorkflow: true,
  readmeChangesTriggerWorkflow: true,
  powershellRunnerChangesTriggerWorkflow: true,
  businessDraftRuntimeSafetyRequired: true,
  businessHistoricalRecordPostureRequired: true,
  businessValidationWorkflowSafetyRequired: true,
  businessRouteCatalogueTruthfulnessRequired: true,
  deploymentEnabled: false,
  credentialsRequired: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
