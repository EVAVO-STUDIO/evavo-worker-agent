#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workflowPath = path.join(root, ".github", "workflows", "worker-contract.yml");
const packagePath = path.join(root, "package.json");
const errors = [];

if (!fs.existsSync(workflowPath)) errors.push("Missing Worker contract workflow");
if (!fs.existsSync(packagePath)) errors.push("Missing package.json");

const workflow = fs.existsSync(workflowPath) ? fs.readFileSync(workflowPath, "utf8") : "";
const packageJson = fs.existsSync(packagePath) ? JSON.parse(fs.readFileSync(packagePath, "utf8")) : {};

for (const token of [
  "branches: [main]",
  "permissions:\n  contents: read",
  'node-version: "24"',
  "cache: npm",
  "npm ci --no-audit --no-fund",
  "node scripts/check-worker-health-contract.mjs",
  "npm run check:local",
  "timeout-minutes: 12",
]) {
  if (!workflow.includes(token)) errors.push(`Worker contract workflow is missing: ${token}`);
}

if (!workflow.includes('      - "src/**"')) errors.push("Worker workflow must watch source changes");
if (!workflow.includes('      - "scripts/**"')) errors.push("Worker workflow must watch validation scripts");
if (!workflow.includes('      - "wrangler.toml"')) errors.push("Worker workflow must watch Wrangler configuration");
if (!workflow.includes('      - "package-lock.json"')) errors.push("Worker workflow must watch the dependency lockfile");
if (workflow.includes("wrangler deploy")) errors.push("Contract workflow must not deploy the Worker");
if (workflow.includes("ADMIN_TOKEN") || workflow.includes("OUTBOUND_AGENT_ADMIN_TOKEN")) errors.push("Contract workflow must not request Worker credentials");

if (packageJson.scripts?.["worker:health:check"] !== "node scripts/check-worker-health-contract.mjs") {
  errors.push("package.json must expose the Worker health contract command");
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run worker:health:check")) {
  errors.push("The complete local gate must include the Worker health contract");
}
if (!String(packageJson.scripts?.predeploy || "").includes("npm run check:local")) {
  errors.push("Predeploy must continue to run the complete local gate");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "worker-ci-workflow-parity",
  deploymentEnabled: false,
  credentialsRequired: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
