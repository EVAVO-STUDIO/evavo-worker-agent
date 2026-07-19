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
const checkLocal = String(packageJson.scripts?.["check:local"] || "");

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

const expectedScripts = {
  "worker:health:check": "node scripts/check-worker-health-contract.mjs",
  "worker:protected-response-safety:check": "node scripts/check-protected-response-safety.mjs",
  "worker:routes:check": "node scripts/check-worker-route-policy.mjs",
  "db:historical-compatibility:check": "node scripts/check-historical-data-compatibility.mjs",
  "db:migration-safety:check": "node scripts/check-migration-execution-safety.mjs",
  "scheduled:autonomy-safety:check": "node scripts/check-scheduled-autonomy-safety.mjs",
  "manual:execution-safety:check": "node scripts/check-manual-execution-safety.mjs",
  "legacy:engine-isolation:check": "node scripts/check-legacy-engine-isolation.mjs",
  "public:surface-safety:check": "node scripts/check-public-surface-safety.mjs",
  "runtime:capability-config:check": "node scripts/check-runtime-capability-config.mjs",
  "growth:route-policy:check": "node scripts/check-growth-route-policy.mjs",
  "growth:negative-safety:check": "node scripts/check-growth-negative-safety.mjs",
  "opportunities:route-policy:check": "node scripts/check-opportunity-route-policy.mjs",
  "business:route-policy:check": "node scripts/check-business-route-policy.mjs",
  "operations:route-policy:check": "node scripts/check-operations-route-policy.mjs",
};
for (const [scriptName, expectedCommand] of Object.entries(expectedScripts)) {
  if (packageJson.scripts?.[scriptName] !== expectedCommand) {
    errors.push(`package.json must expose ${scriptName} as ${expectedCommand}`);
  }
  if (!checkLocal.includes(`npm run ${scriptName}`)) {
    errors.push(`The complete local gate must include ${scriptName}`);
  }
}

for (const [scriptName, expectedCommand] of Object.entries({
  "db:init:local": "node scripts/refuse-legacy-schema-init.mjs local",
  "db:init:remote": "node scripts/refuse-legacy-schema-init.mjs remote",
})) {
  if (packageJson.scripts?.[scriptName] !== expectedCommand) {
    errors.push(`package.json must keep ${scriptName} fail-closed as ${expectedCommand}`);
  }
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
  typedRoutePoliciesRequired: true,
  protectedResponsesCacheable: false,
  wildcardProtectedCorsAllowed: false,
  unauthenticatedProtectedPreflightAllowed: false,
  scheduledExternalExecutionAllowed: false,
  manualLegacyExecutionAllowed: false,
  legacyExecutionModulesPresent: false,
  legacyEngineImportExpansionAllowed: false,
  emailProviderConfigurationAllowed: false,
  draftOrSendRuntimeCapsAllowed: false,
  historicalStatusesExecutable: false,
  legacySchemaInitializationAllowed: false,
  migrationTargetDefaultsAllowed: false,
  ambiguousMigrationPrefixExecutionAllowed: false,
  unacknowledgedOneTimeMigrationExecutionAllowed: false,
  unacknowledgedRerunExecutionAllowed: false,
  publicOperationalRecordsExposed: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
