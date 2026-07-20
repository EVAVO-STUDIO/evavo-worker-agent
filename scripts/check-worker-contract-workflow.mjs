#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workflowPath = path.join(root, ".github", "workflows", "worker-contract.yml");
const packagePath = path.join(root, "package.json");
const indexPath = path.join(root, "src", "index.ts");
const plannerWrapperPath = path.join(root, "src", "routes", "plannerAdminProtected.ts");
const growthWrapperPath = path.join(root, "src", "routes", "growthAdminProtected.ts");
const errors = [];

if (!fs.existsSync(workflowPath)) errors.push("Missing Worker contract workflow");
if (!fs.existsSync(packagePath)) errors.push("Missing package.json");
if (!fs.existsSync(indexPath)) errors.push("Missing Worker dispatcher");
if (!fs.existsSync(plannerWrapperPath)) errors.push("Missing protected planner wrapper");
if (!fs.existsSync(growthWrapperPath)) errors.push("Missing protected Growth fallback wrapper");

const workflow = fs.existsSync(workflowPath) ? fs.readFileSync(workflowPath, "utf8") : "";
const packageJson = fs.existsSync(packagePath) ? JSON.parse(fs.readFileSync(packagePath, "utf8")) : {};
const index = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "";
const plannerWrapper = fs.existsSync(plannerWrapperPath) ? fs.readFileSync(plannerWrapperPath, "utf8") : "";
const growthWrapper = fs.existsSync(growthWrapperPath) ? fs.readFileSync(growthWrapperPath, "utf8") : "";
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

for (const token of [
  'import { handlePlannerAdmin } from "./routes/plannerAdminProtected"',
  'import { handleGrowthAdmin } from "./routes/growthAdminProtected"',
  'case "planner":',
  'case "growth-fallback":',
  "return await handlePlannerAdmin(req, env, pathname, jsonResponse)",
  "return await handleGrowthAdmin(req, env, pathname, jsonResponse)",
]) {
  if (!index.includes(token)) errors.push(`Worker dispatcher is missing protected wrapper routing token: ${token}`);
}
if (index.includes('from "./routes/plannerAdmin"')) errors.push("Worker dispatcher must not import the legacy planner implementation directly");
if (index.includes('from "./routes/growthAdmin"')) errors.push("Worker dispatcher must not import the legacy Growth fallback implementation directly");

for (const [label, content, delegateCall] of [
  ["Protected planner wrapper", plannerWrapper, 'return handlePlannerAdminImplementation(request, env, pathname, json)'],
  ["Protected Growth wrapper", growthWrapper, 'return handleGrowthAdminImplementation(request, env, pathname, json)'],
]) {
  for (const token of [
    'import { isAdminRequestAuthorized } from "../core/adminAuthentication"',
    'await isAdminRequestAuthorized(request, env)',
    'request.method === "OPTIONS"',
    'status: 405',
    delegateCall,
  ]) {
    if (!content.includes(token)) errors.push(`${label} is missing: ${token}`);
  }
}

const expectedScripts = {
  "worker:health:check": "node scripts/check-worker-health-contract.mjs",
  "worker:central-auth-safety:check": "node scripts/check-central-authentication-safety.mjs",
  "worker:credential-contract:check": "node scripts/check-worker-credential-contract.mjs",
  "worker:env-contract:check": "node scripts/check-worker-env-contract.mjs",
  "worker:protected-response-safety:check": "node scripts/check-protected-response-safety.mjs",
  "worker:routes:check": "node scripts/check-worker-route-policy.mjs",
  "db:historical-compatibility:check": "node scripts/check-historical-data-compatibility.mjs",
  "db:migration-safety:check": "node scripts/check-migration-execution-safety.mjs",
  "safety:gates:check": "node scripts/check-safety-gate-completeness.mjs",
  "autonomy:capability-truthfulness:check": "node scripts/check-autonomy-capability-truthfulness.mjs",
  "scheduled:entrypoint-safety:check": "node scripts/check-scheduled-entrypoint-safety.mjs",
  "scheduled:autonomy-safety:check": "node scripts/check-scheduled-autonomy-safety.mjs",
  "sources:confirmation-safety:check": "node scripts/check-source-action-confirmation-safety.mjs",
  "opportunities:execution-boundary-safety:check": "node scripts/check-opportunity-execution-boundary-safety.mjs",
  "manual:execution-safety:check": "node scripts/check-manual-execution-safety.mjs",
  "legacy:engine-isolation:check": "node scripts/check-legacy-engine-isolation.mjs",
  "public:surface-safety:check": "node scripts/check-public-surface-safety.mjs",
  "runtime:capability-config:check": "node scripts/check-runtime-capability-config.mjs",
  "growth:subhandler-auth-safety:check": "node scripts/check-growth-subhandler-auth-safety.mjs",
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
  canonicalCredential: "ADMIN_TOKEN",
  strictBearerParsingRequired: true,
  constantTimeCredentialComparisonRequired: true,
  centralAuthenticationBeforeProtectedDispatchRequired: true,
  plannerRuntimeUsesProtectedWrapper: true,
  directPlannerImplementationImportAllowed: false,
  unauthenticatedPlannerPreflightAllowed: false,
  growthFallbackRuntimeUsesProtectedWrapper: true,
  directGrowthFallbackImplementationImportAllowed: false,
  unauthenticatedGrowthFallbackPreflightAllowed: false,
  growthSubhandlersUseSharedAuthentication: true,
  growthSubhandlerWritesRequireConfirmation: true,
  safetyGateCompletenessRequired: true,
  autonomyCapabilityTruthfulnessRequired: true,
  publicRoutesRequireAdminToken: false,
  legacyCredentialAliasesAllowed: false,
  publicControlCredentialAllowed: false,
  typedRoutePoliciesRequired: true,
  mailProviderFieldsAdvertised: false,
  draftOrSendRuntimeCapsAdvertised: false,
  historicalStatusesReadable: true,
  historicalStatusesExecutable: false,
  protectedResponsesCacheable: false,
  wildcardProtectedCorsAllowed: false,
  unauthenticatedProtectedPreflightAllowed: false,
  unconfirmedSourceWritesAllowed: false,
  unconfirmedSourceNetworkActionsAllowed: false,
  sourceConfirmationBeforeRoutingRequired: true,
  opportunityExecutionRequiresConfirmation: true,
  opportunityExecutionIsBounded: true,
  unhandledScheduledPromiseAllowed: false,
  automaticScheduledRetryAllowed: false,
  alternateScheduledExecutionFallbackAllowed: false,
  scheduledExternalExecutionAllowed: false,
  manualLegacyExecutionAllowed: false,
  legacyExecutionModulesPresent: false,
  legacyEngineImportExpansionAllowed: false,
  emailProviderConfigurationAllowed: false,
  draftOrSendRuntimeCapsAllowed: false,
  legacySchemaInitializationAllowed: false,
  migrationTargetDefaultsAllowed: false,
  ambiguousMigrationPrefixExecutionAllowed: false,
  unacknowledgedOneTimeMigrationExecutionAllowed: false,
  unacknowledgedRerunExecutionAllowed: false,
  publicOperationalRecordsExposed: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
