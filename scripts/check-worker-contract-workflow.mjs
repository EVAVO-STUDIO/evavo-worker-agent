#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workflowPath = path.join(root, ".github", "workflows", "worker-contract.yml");
const packagePath = path.join(root, "package.json");
const indexPath = path.join(root, "src", "index.ts");
const adminPath = path.join(root, "src", "routes", "admin.ts");
const adminWrapperPath = path.join(root, "src", "routes", "adminProtected.ts");
const plannerWrapperPath = path.join(root, "src", "routes", "plannerAdminProtected.ts");
const growthWrapperPath = path.join(root, "src", "routes", "growthAdminProtected.ts");
const healthPath = path.join(root, "src", "core", "health.ts");
const schemaPath = path.join(root, "src", "core", "schema.ts");
const boundedJsonSafetyPath = path.join(root, "scripts", "check-bounded-json-request-safety.mjs");
const manualLeaseSafetyPath = path.join(root, "scripts", "check-manual-research-lease-safety.mjs");
const publicResearchSafetyPath = path.join(root, "scripts", "check-public-research-fetch-safety.mjs");
const opportunityEvidenceQualityPath = path.join(root, "scripts", "check-opportunity-evidence-quality.mjs");
const errors = [];

for (const [label, absolutePath] of [
  ["Worker contract workflow", workflowPath],
  ["package.json", packagePath],
  ["Worker dispatcher", indexPath],
  ["broad admin implementation", adminPath],
  ["protected broad admin wrapper", adminWrapperPath],
  ["protected planner wrapper", plannerWrapperPath],
  ["protected Growth fallback wrapper", growthWrapperPath],
  ["admin health implementation", healthPath],
  ["authenticated schema implementation", schemaPath],
  ["bounded JSON request safety contract", boundedJsonSafetyPath],
  ["manual research lease safety contract", manualLeaseSafetyPath],
  ["public research fetch safety contract", publicResearchSafetyPath],
  ["opportunity evidence quality contract", opportunityEvidenceQualityPath],
]) {
  if (!fs.existsSync(absolutePath)) errors.push(`Missing ${label}`);
}

const read = (absolutePath) => fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : "";
const workflow = read(workflowPath);
const packageJson = fs.existsSync(packagePath) ? JSON.parse(read(packagePath)) : {};
const index = read(indexPath);
const admin = read(adminPath);
const adminWrapper = read(adminWrapperPath);
const plannerWrapper = read(plannerWrapperPath);
const growthWrapper = read(growthWrapperPath);
const health = read(healthPath);
const schema = read(schemaPath);
const boundedJsonSafety = read(boundedJsonSafetyPath);
const manualLeaseSafety = read(manualLeaseSafetyPath);
const publicResearchSafety = read(publicResearchSafetyPath);
const opportunityEvidenceQuality = read(opportunityEvidenceQualityPath);
const checkLocal = String(packageJson.scripts?.["check:local"] || "");

for (const token of [
  "branches: [main]",
  "permissions:\n  contents: read",
  'node-version: "24"',
  "cache: npm",
  "npm ci --no-audit --no-fund",
  "node scripts/check-worker-health-contract.mjs",
  "Verify bounded admin JSON requests",
  "npm run research:bounded-json-safety:check",
  "Verify manual research concurrency leases",
  "npm run research:manual-lease-safety:check",
  "Verify public research fetch boundary",
  "npm run research:public-fetch-safety:check",
  "Verify deterministic opportunity evidence quality",
  "npm run opportunities:evidence-quality:check",
  "Run deterministic core tests",
  "npm run test:core",
  "npm run check:local",
  "timeout-minutes: 12",
]) {
  if (!workflow.includes(token)) errors.push(`Worker contract workflow is missing: ${token}`);
}

for (const watchedPath of [
  '      - "src/**"',
  '      - "scripts/**"',
  '      - "tests/**"',
  '      - "docs/**"',
  '      - "README.md"',
  '      - "wrangler.toml"',
  '      - "package-lock.json"',
]) {
  if (!workflow.includes(watchedPath)) errors.push(`Worker workflow must watch: ${watchedPath.trim()}`);
}
if (workflow.includes("wrangler deploy")) errors.push("Contract workflow must not deploy the Worker");
if (workflow.includes("ADMIN_TOKEN") || workflow.includes("OUTBOUND_AGENT_ADMIN_TOKEN")) errors.push("Contract workflow must not request Worker credentials");

for (const token of [
  'contract: "bounded-admin-json-request-safety-v1"',
  "exactBooleanConfirmationRequired: true",
  "queryStringConfirmationAllowed: false",
  "confirmationCoercionAllowed: false",
  "prototypePollutionKeysRejected: true",
  "requestFingerprintRequired: true",
  "behavioralTestsRequired: true",
  "focusedCiGateRequired: true",
]) {
  if (!boundedJsonSafety.includes(token)) errors.push(`Bounded JSON safety contract is missing CI-required posture: ${token}`);
}

for (const token of [
  'contract: "manual-research-lease-safety-v3-hierarchical-source-exclusion"',
  "atomicSingleStatementAcquisitionRequired: true",
  "readThenWriteAcquisitionAllowed: false",
  "staleHolderCanReleaseNewLease: false",
  "confirmationBeforeLeaseRequired: true",
  "broadOpportunityRunPerSourceLeaseRequired: true",
  "tinySourceBatchPerSourceLeaseRequired: true",
  "overlappingBroadAndPerSourceActionsAllowed: false",
  "automaticRetryAllowed: false",
  "scheduledFallbackAllowed: false",
]) {
  if (!manualLeaseSafety.includes(token)) errors.push(`Manual lease safety contract is missing CI-required posture: ${token}`);
}

for (const token of [
  'contract: "public-research-fetch-safety-v7-hierarchical-source-exclusion"',
  'activeFetchContract: "public_research_fetch_v2"',
  "sensitiveQueryParametersRejected: true",
  "redirectChainEvidenceRequired: true",
  "binaryResponsesRejected: true",
  "timeoutCoversRedirectsAndBody: true",
  "rejectedUnsafeInputsEchoed: false",
  "sourceExpansionRunTruthfulnessRequired: true",
  "relationshipGraphRunTruthfulnessRequired: true",
  "sitemapIndexTraversalRequired: true",
  "manualOpportunityRunTruthfulnessRequired: true",
  "broadOpportunityPerSourceLeaseRequired: true",
  "tinyBatchPerSourceLeaseRequired: true",
  "overlappingBroadAndPerSourceActionsAllowed: false",
  "sourceHealthAuditAtomicityRequired: true",
  "behavioralTestsRequired: true",
  "focusedCiGateRequired: true",
]) {
  if (!publicResearchSafety.includes(token)) errors.push(`Public research safety contract is missing CI-required posture: ${token}`);
}

for (const token of [
  'contract: "opportunity-evidence-quality-v1"',
  "boundaryAwareTermMatching: true",
  "publicCanonicalCandidateUrlsRequired: true",
  "deadlineYearGuessingAllowed: false",
  "unmarkedNumbersParsedAsMoney: false",
  "missingFactsInvented: false",
  "weakEvidenceLearningBoostAllowed: false",
  "reviewOnlyCandidatePostureRequired: true",
  "executableCandidatePersistenceAllowed: false",
  "draftingRecommendationStored: false",
  "canonicalUrlDeduplicationRequired: true",
  "groundedCurrencyRequiredForStoredValue: true",
]) {
  if (!opportunityEvidenceQuality.includes(token)) errors.push(`Opportunity evidence quality contract is missing CI-required posture: ${token}`);
}

for (const token of [
  'import { handleAdmin } from "./routes/adminProtected"',
  'import { handlePlannerAdmin } from "./routes/plannerAdminProtected"',
  'import { handleGrowthAdmin } from "./routes/growthAdminProtected"',
  'case "planner":',
  'case "growth-fallback":',
  "return await handleAdmin(req, env, pathname, ctx, jsonResponse)",
  "return await handlePlannerAdmin(req, env, pathname, jsonResponse)",
  "return await handleGrowthAdmin(req, env, pathname, jsonResponse)",
  'import { boundedJsonFailurePayload, isExplicitJsonConfirmation, readBoundedJsonObject } from "./core/boundedJsonRequest"',
  "sourceActionConfirmationFailure",
  "readBoundedJsonObject(request.clone())",
]) {
  if (!index.includes(token)) errors.push(`Worker dispatcher is missing protected or bounded routing token: ${token}`);
}
if (index.includes('from "./routes/admin"')) errors.push("Worker dispatcher must not import the broad admin implementation directly");
if (index.includes('from "./routes/plannerAdmin"')) errors.push("Worker dispatcher must not import the legacy planner implementation directly");
if (index.includes('from "./routes/growthAdmin"')) errors.push("Worker dispatcher must not import the legacy Growth fallback implementation directly");

for (const [label, content, delegateCall] of [
  ["Protected broad admin wrapper", adminWrapper, 'return handleAdminImplementation(request, env, pathname, ctx, json)'],
  ["Protected planner wrapper", plannerWrapper, 'return handlePlannerAdminImplementation(request, env, pathname, json)'],
  ["Protected Growth wrapper", growthWrapper, 'return handleGrowthAdminImplementation(request, env, pathname, json)'],
]) {
  for (const token of [
    'import { isAdminRequestAuthorized } from "../core/adminAuthentication"',
    "await isAdminRequestAuthorized(request, env)",
    'request.method === "OPTIONS"',
    "status: 405",
    delegateCall,
  ]) {
    if (!content.includes(token)) errors.push(`${label} is missing: ${token}`);
  }
}

for (const token of [
  'pathname === "/admin/leads" && request.method === "POST"',
  "const body = await request.clone().json()",
  "if (!confirmed(body))",
  'error: "confirm_required"',
  "internalMetadataOnly: true",
  "scheduled: false",
  "callsNetwork: false",
  "callsAI: false",
  "sendsEmail: false",
  "externalStateChange: false",
]) {
  if (!adminWrapper.includes(token)) errors.push(`Protected broad admin wrapper is missing manual-write safety token: ${token}`);
}

for (const token of [
  "const historicalReadSafety = Object.freeze({",
  "readOnly: true",
  "authenticated: true",
  "historicalOnly: true",
  "executable: false",
  "scheduled: false",
  "callsNetwork: false",
  "callsAI: false",
  "sendsEmail: false",
  'contractVersion: "admin_historical_leads_v2_read_only"',
  'contractVersion: "admin_historical_drafts_v2_read_only"',
  'contractVersion: "admin_historical_events_v2_read_only"',
  'contractVersion: "admin_historical_insights_v2_read_only"',
  'contractVersion: "admin_historical_runs_v2_read_only"',
  "safety: historicalReadSafety",
]) {
  if (!admin.includes(token)) errors.push(`Broad admin read implementation is missing truthful token: ${token}`);
}
for (const forbidden of [
  "return json({ ok: true, leads });",
  "return json({ ok: true, drafts: enriched });",
  "return json({ ok: true, events: await listEvents(env, 150) });",
  "return json({ ok: true, runs: await listEvents(env, 100) });",
  "executable: true",
  "scheduled: true",
]) {
  if (admin.includes(forbidden)) errors.push(`Broad admin reads must not contain stale execution token: ${forbidden}`);
}

for (const token of [
  'contractVersion: "admin_health_v2_manual_research_only"',
  "scheduledExecutionEnabled: false",
  "scheduledExternalResearchEnabled: false",
  "manualResearchRequiresAuthentication: true",
  "manualResearchRequiresConfirmation: true",
  "historicalOnly: true",
  "executable: false",
  'contractVersion: "admin_diagnostics_v2_historical_read_only"',
  "authoritativeForExecution: false",
]) {
  if (!health.includes(token)) errors.push(`Admin reporting implementation is missing truthful runtime token: ${token}`);
}
for (const forbidden of [
  'recs.push("continue_free_safe_tick")',
  'status: HealthReport["status"] = !engineEnabled ? "paused"',
  "lastEngineRun:",
]) {
  if (health.includes(forbidden)) errors.push(`Admin reporting must not contain stale execution token: ${forbidden}`);
}

for (const token of [
  'contractVersion: "admin_schema_v2_names_only"',
  "SELECT name, type",
  "rawSqlExposed: false",
  "rowDataExposed: false",
  "secretsExposed: false",
  "executable: false",
]) {
  if (!schema.includes(token)) errors.push(`Authenticated schema implementation is missing safe token: ${token}`);
}
for (const forbidden of ["SELECT name, type, sql", "item.sql", "rawSqlExposed: true", "rowDataExposed: true"]) {
  if (schema.includes(forbidden)) errors.push(`Authenticated schema implementation contains unsafe token: ${forbidden}`);
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
  "admin:broad-read-truthfulness:check": "node scripts/check-broad-admin-read-truthfulness.mjs",
  "admin:broad-write-safety:check": "node scripts/check-broad-admin-write-safety.mjs",
  "admin:reporting-truthfulness:check": "node scripts/check-admin-reporting-truthfulness.mjs",
  "admin:schema-safety:check": "node scripts/check-admin-schema-safety.mjs",
  "autonomy:capability-truthfulness:check": "node scripts/check-autonomy-capability-truthfulness.mjs",
  "scheduled:entrypoint-safety:check": "node scripts/check-scheduled-entrypoint-safety.mjs",
  "scheduled:autonomy-safety:check": "node scripts/check-scheduled-autonomy-safety.mjs",
  "sources:confirmation-safety:check": "node scripts/check-source-action-confirmation-safety.mjs",
  "research:bounded-json-safety:check": "node scripts/check-bounded-json-request-safety.mjs",
  "research:manual-lease-safety:check": "node scripts/check-manual-research-lease-safety.mjs",
  "research:public-fetch-safety:check": "node scripts/check-public-research-fetch-safety.mjs",
  "opportunities:evidence-quality:check": "node scripts/check-opportunity-evidence-quality.mjs",
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
  "test:core": "node --test",
};
for (const [scriptName, expectedCommand] of Object.entries(expectedScripts)) {
  if (packageJson.scripts?.[scriptName] !== expectedCommand) errors.push(`package.json must expose ${scriptName} as ${expectedCommand}`);
  if (!checkLocal.includes(`npm run ${scriptName}`)) errors.push(`The complete local gate must include ${scriptName}`);
}

for (const [scriptName, expectedCommand] of Object.entries({
  "db:init:local": "node scripts/refuse-legacy-schema-init.mjs local",
  "db:init:remote": "node scripts/refuse-legacy-schema-init.mjs remote",
})) {
  if (packageJson.scripts?.[scriptName] !== expectedCommand) errors.push(`package.json must keep ${scriptName} fail-closed as ${expectedCommand}`);
}

if (!String(packageJson.scripts?.predeploy || "").includes("npm run check:local")) errors.push("Predeploy must continue to run the complete local gate");

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "worker-ci-workflow-parity-v5-hierarchical-source-exclusion",
  deploymentEnabled: false,
  credentialsRequired: false,
  canonicalCredential: "ADMIN_TOKEN",
  strictBearerParsingRequired: true,
  constantTimeCredentialComparisonRequired: true,
  centralAuthenticationBeforeProtectedDispatchRequired: true,
  broadAdminRuntimeUsesProtectedWrapper: true,
  directBroadAdminImplementationImportAllowed: false,
  broadAdminManualWritesRequireConfirmation: true,
  broadAdminReadTruthfulnessRequired: true,
  broadAdminHistoricalReadsExecutable: false,
  adminReportingTruthfulnessRequired: true,
  adminHealthTreatsDisabledExecutionAsSafe: true,
  historicalAdminRecordsExecutable: false,
  authenticatedSchemaSafetyRequired: true,
  authenticatedSchemaRawSqlExposed: false,
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
  boundedJsonRequestSafetyRequired: true,
  boundedJsonFocusedCiGateRequired: true,
  exactBooleanResearchConfirmationRequired: true,
  manualResearchLeaseSafetyRequired: true,
  manualResearchHierarchicalSourceExclusionRequired: true,
  manualResearchLeaseFocusedCiGateRequired: true,
  publicResearchFetchSafetyRequired: true,
  publicResearchFetchV2Required: true,
  publicResearchHierarchicalSourceExclusionRequired: true,
  overlappingBroadAndPerSourceActionsAllowed: false,
  publicResearchFocusedCiGateRequired: true,
  publicResearchInputRedactionRequired: true,
  publicResearchRunTruthfulnessRequired: true,
  publicResearchBehavioralTestsRequired: true,
  opportunityEvidenceQualityRequired: true,
  opportunityEvidenceFocusedCiGateRequired: true,
  weakEvidenceLearningBoostAllowed: false,
  opportunityDraftRecommendationAllowed: false,
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
