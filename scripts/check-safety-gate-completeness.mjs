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
  autonomyCapabilityTruthfulnessRequired: true,
  sourceConfirmationSafetyRequired: true,
  opportunityExecutionBoundarySafetyRequired: true,
  growthSubhandlerAuthenticationSafetyRequired: true,
  centralAuthenticationSafetyRequired: true,
  predeployUsesCompleteLocalGate: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
