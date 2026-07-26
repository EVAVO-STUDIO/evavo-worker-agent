#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const resolve = (...parts) => path.join(root, ...parts);
const read = (absolutePath) => {
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing required file: ${path.relative(root, absolutePath)}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
};

const paths = {
  workflow: resolve(".github", "workflows", "worker-contract.yml"),
  package: resolve("package.json"),
  index: resolve("src", "index.ts"),
  admin: resolve("src", "routes", "admin.ts"),
  adminWrapper: resolve("src", "routes", "adminProtected.ts"),
  plannerWrapper: resolve("src", "routes", "plannerAdminProtected.ts"),
  growthWrapper: resolve("src", "routes", "growthAdminProtected.ts"),
  autonomy: resolve("src", "routes", "autonomySettingsAdmin.ts"),
  legacy: resolve("src", "routes", "legacyExecutionSafetyAdmin.ts"),
  operationsPolicy: resolve("src", "routes", "operationsRoutePolicy.ts"),
  health: resolve("src", "core", "health.ts"),
  schema: resolve("src", "core", "schema.ts"),
  sourceCandidateCore: resolve("src", "core", "opportunitySourceDiscovery.ts"),
  sourceCandidateTests: resolve("tests", "opportunitySourceCandidateSaveSource.test.ts"),
  sourceSecrets: resolve("scripts", "check-worker-source-secrets.mjs"),
  bounded: resolve("scripts", "check-bounded-json-request-safety.mjs"),
  lease: resolve("scripts", "check-manual-research-lease-safety.mjs"),
  review: resolve("scripts", "check-review-mutation-boundary-safety.mjs"),
  publicFetch: resolve("scripts", "check-public-research-fetch-safety.mjs"),
  evidence: resolve("scripts", "check-opportunity-evidence-quality.mjs"),
  growthParity: resolve("scripts", "check-growth-route-parity.mjs"),
  autonomyTruth: resolve("scripts", "check-autonomy-capability-truthfulness.mjs"),
  manualSafety: resolve("scripts", "check-manual-execution-safety.mjs"),
  operationsPolicyCheck: resolve("scripts", "check-operations-route-policy.mjs"),
};

const sources = Object.fromEntries(
  Object.entries(paths).map(([key, absolutePath]) => [key, read(absolutePath)]),
);
const packageJson = sources.package ? JSON.parse(sources.package) : {};
const scripts = packageJson.scripts || {};
const checkLocal = String(scripts["check:local"] || "");

for (const token of [
  "branches: [main]",
  "permissions:\n  contents: read",
  'node-version: "24"',
  "cache: npm",
  "npm ci --no-audit --no-fund",
  "Verify tracked-source secret safety",
  "npm run worker:source-secret-safety:check",
  "node scripts/check-worker-contract-workflow.mjs",
  "node scripts/check-worker-health-contract.mjs",
  "Verify bounded admin JSON requests",
  "npm run research:bounded-json-safety:check",
  "Verify manual research concurrency leases",
  "npm run research:manual-lease-safety:check",
  "Verify review mutation safety",
  "npm run review:mutation-safety:check",
  "Verify public research fetch boundary",
  "npm run research:public-fetch-safety:check",
  "Verify deterministic opportunity evidence quality",
  "npm run opportunities:evidence-quality:check",
  "Verify Growth route parity",
  "npm run growth:route-parity:check",
  "Run deterministic core tests",
  "npm run test:core",
  "npm run check:local",
  "timeout-minutes: 12",
  "persist-credentials: false",
  "cancel-in-progress: true",
]) {
  if (!sources.workflow.includes(token)) errors.push(`Worker contract workflow is missing: ${token}`);
}
for (const watchedPath of [
  '      - "src/**"',
  '      - "scripts/**"',
  '      - "tests/**"',
  '      - "docs/**"',
  '      - "migrations/**"',
  '      - "README.md"',
  '      - ".gitignore"',
  '      - ".dev.vars.example"',
  '      - "wrangler.toml"',
  '      - "package.json"',
  '      - "package-lock.json"',
]) {
  if (!sources.workflow.includes(watchedPath)) errors.push(`Worker workflow must watch: ${watchedPath.trim()}`);
}
if (sources.workflow.includes("wrangler deploy")) errors.push("Contract workflow must not deploy the Worker");
for (const secretName of ["ADMIN_TOKEN", "OUTBOUND_AGENT_ADMIN_TOKEN", "PUBLIC_CONTROL_KEY"]) {
  if (sources.workflow.includes(secretName)) errors.push(`Contract workflow must not request Worker credential: ${secretName}`);
}

const orderedSteps = [
  "npm run worker:source-secret-safety:check",
  "node scripts/check-worker-contract-workflow.mjs",
  "npm run research:bounded-json-safety:check",
  "npm run research:manual-lease-safety:check",
  "npm run review:mutation-safety:check",
  "npm run research:public-fetch-safety:check",
  "npm run opportunities:evidence-quality:check",
  "npm run growth:route-parity:check",
  "npm run test:core",
  "npm run check:local",
];
let previousIndex = -1;
for (const step of orderedSteps) {
  const currentIndex = sources.workflow.indexOf(step);
  if (currentIndex < 0 || currentIndex <= previousIndex) errors.push(`Worker workflow step order is invalid at ${step}`);
  previousIndex = currentIndex;
}

for (const [label, source, tokens] of [
  ["tracked-source secret safety", sources.sourceSecrets, [
    'contract: "worker-tracked-source-secret-safety-v3-fixture-aware"',
    "realEnvironmentFilesTracked: false",
    "privateKeyMaterialAllowed: false",
    "liveProviderTokensAllowed: false",
    "nonReservedCredentialBearingUrlsAllowed: false",
    "reservedFixtureCredentialUrlsAllowed: true",
    "rawSecretValuesPrinted: false",
    "focusedReadOnlyCiRequired: true",
    "repositoryVisibilityChangedByThisContract: false",
  ]],
  ["bounded JSON safety", sources.bounded, [
    'contract: "bounded-admin-json-request-safety-v4-settings-and-legacy-review"',
    "exactBooleanConfirmationRequired: true",
    "prototypePollutionKeysRejected: true",
    "requestFingerprintRequired: true",
    "protectedBroadAdminWritesBounded: true",
    "autonomySettingsBounded: true",
    "legacySettingsBounded: true",
    "legacyDraftReviewBounded: true",
    "draftReviewBounded: true",
    "opportunityReviewBounded: true",
    "sourceCandidateCommitBounded: true",
  ]],
  ["manual lease safety", sources.lease, [
    'contract: "manual-research-lease-safety-v4-settings-and-legacy-review"',
    "atomicSingleStatementAcquisitionRequired: true",
    "staleHolderCanReleaseNewLease: false",
    "confirmationBeforeLeaseRequired: true",
    "sourceCandidateCommitLeaseRequired: true",
    "autonomySettingsLeaseRequired: true",
    "legacySettingsLeaseRequired: true",
    "draftRecordAndStrategyLeasesRequired: true",
    "legacyAndModernDraftReviewShareLease: true",
    "opportunityRecordAndStrategyLeasesRequired: true",
    "automaticRetryAllowed: false",
  ]],
  ["review mutation safety", sources.review, [
    'contract: "review-mutation-boundary-safety-v3-source-candidate-atomicity"',
    "exactBooleanConfirmationRequired: true",
    "boundedRequestBodyRequired: true",
    "requestFingerprintRequired: true",
    "perRecordLeaseRequired: true",
    "sharedLearningScopeLeaseRequired: true",
    "modernDraftReviewWritesAtomic: true",
    "legacyDraftReviewUsesSharedLease: true",
    "legacyDraftReviewWritesAtomic: true",
    "opportunityReviewWritesAtomic: true",
    "sourceCandidateWritesAtomic: true",
    "sourceCandidateBehavioralSourceTestsRequired: true",
  ]],
  ["public research safety", sources.publicFetch, [
    'contract: "public-research-fetch-safety-v7-hierarchical-source-exclusion"',
    'activeFetchContract: "public_research_fetch_v2"',
    "sensitiveQueryParametersRejected: true",
    "redirectChainEvidenceRequired: true",
    "binaryResponsesRejected: true",
    "timeoutCoversRedirectsAndBody: true",
    "overlappingBroadAndPerSourceActionsAllowed: false",
    "behavioralTestsRequired: true",
  ]],
  ["opportunity evidence quality", sources.evidence, [
    'contract: "opportunity-evidence-quality-v1"',
    "boundaryAwareTermMatching: true",
    "unmarkedNumbersParsedAsMoney: false",
    "missingFactsInvented: false",
    "weakEvidenceLearningBoostAllowed: false",
    "reviewOnlyCandidatePostureRequired: true",
    "canonicalUrlDeduplicationRequired: true",
  ]],
  ["Growth route parity", sources.growthParity, [
    'const CHECK_NAME = "check-growth-route-parity"',
    '"growth_worker_route_parity_v1"',
    "EXPECTED_BLOCKERS_BY_PAGE_STATE",
    '"next_website_ingestion_endpoint_not_implemented"',
    '"worker_proposal_delivery_not_implemented"',
    '"cross_repo_contract_tests_not_implemented"',
    'exactBoolean(record, "bridgeEnabled", false, label)',
    'exactBoolean(record, "deliveryEnabled", false, label)',
    "Worker workflow must run route parity before deterministic tests and the complete local gate.",
  ]],
  ["autonomy truthfulness", sources.autonomyTruth, [
    'contract: "autonomy-capability-truthfulness-v2-bounded-settings"',
    "settingsRequestBounded: true",
    "exactBooleanConfirmationRequired: true",
    "settingsAndAuditAtomic: true",
  ]],
  ["legacy execution safety", sources.manualSafety, [
    'contract: "manual-legacy-execution-safety-v2-bounded-atomic"',
    "disabledRunMutatesState: false",
    "legacyReadRoutesMutateState: false",
    "settingsAndAuditAtomic: true",
    "draftDecisionAndAuditAtomic: true",
  ]],
  ["operations policy safety", sources.operationsPolicyCheck, [
    'contract: "typed-operational-route-policy-v2-bounded-writes"',
    "readRoutesMutateState: false",
    "writePoliciesAmbiguous: false",
  ]],
]) {
  for (const token of tokens) {
    if (!source.includes(token)) errors.push(`${label} contract is missing CI-required posture: ${token}`);
  }
}

for (const token of [
  'SOURCE_CANDIDATE_SAVE_CONTRACT = "opportunity_source_candidate_save_v2_atomic"',
  "const statements: D1PreparedStatement[] = []",
  "await env.DB.batch(statements)",
  "sourceRecordsExpansionMarkersAndAuditAtomic: true",
  "requestBodySha256: options.requestBodySha256 || null",
]) {
  if (!sources.sourceCandidateCore.includes(token)) errors.push(`Source-candidate application service is missing: ${token}`);
}
for (const token of [
  'test("reviewed source candidates commit source rows, markers and audit atomically"',
  'test("source candidate save has no sequential helper writes or external execution"',
  'test("source candidate route binds the audit to the bounded request receipt"',
]) {
  if (!sources.sourceCandidateTests.includes(token)) errors.push(`Source-candidate behavioral source test is missing: ${token}`);
}

for (const token of [
  'import { handleAdmin } from "./routes/adminProtected"',
  'import { handlePlannerAdmin } from "./routes/plannerAdminProtected"',
  'import { handleGrowthAdmin } from "./routes/growthAdminProtected"',
  "if (protectedRoute && !(await isAdminRequestAuthorized(req, env)))",
  "switch (resolveOpportunityRouteHandlerId(pathname))",
  "switch (resolveGrowthRouteHandlerId(pathname))",
  "switch (resolveBusinessRouteHandlerId(pathname))",
  "switch (resolveOperationsRouteHandlerId(pathname))",
  "return await handleAdmin(req, env, pathname, ctx, jsonResponse)",
  "return await handlePlannerAdmin(req, env, pathname, jsonResponse)",
  "return await handleGrowthAdmin(req, env, pathname, jsonResponse)",
  'import { boundedJsonFailurePayload, isExplicitJsonConfirmation, readBoundedJsonObject } from "./core/boundedJsonRequest"',
  "sourceActionConfirmationFailure",
  "readBoundedJsonObject(request.clone())",
]) {
  if (!sources.index.includes(token)) errors.push(`Worker dispatcher is missing protected or bounded routing token: ${token}`);
}
for (const forbiddenImport of [
  'from "./routes/admin"',
  'from "./routes/plannerAdmin"',
  'from "./routes/growthAdmin"',
]) {
  if (sources.index.includes(forbiddenImport)) errors.push(`Worker dispatcher contains direct implementation import: ${forbiddenImport}`);
}

for (const [label, content, delegateCall] of [
  ["Protected broad admin wrapper", sources.adminWrapper, "return handleAdminImplementation(request, env, pathname, ctx, json)"],
  ["Protected planner wrapper", sources.plannerWrapper, "return handlePlannerAdminImplementation(request, env, pathname, json)"],
  ["Protected Growth wrapper", sources.growthWrapper, "return handleGrowthAdminImplementation(request, env, pathname, json)"],
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
  "manualMetadataWriteRequiresConfirmation",
  "readBoundedJsonObject(request.clone()",
  "boundedJsonFailurePayload(parsed)",
  "isExplicitJsonConfirmation(parsed.value)",
  "requiredPayload: { confirm: true }",
  "confirmationCoercionAllowed: false",
  "requestReceipt",
  "internalMetadataOnly: true",
  "callsNetwork: false",
  "callsAI: false",
  "sendsEmail: false",
  "externalStateChange: false",
]) {
  if (!sources.adminWrapper.includes(token)) errors.push(`Protected broad admin wrapper is missing manual-write safety token: ${token}`);
}
for (const forbidden of ["request.clone().json()", "body?.confirm === 1", 'body?.confirm === "1"']) {
  if (sources.adminWrapper.includes(forbidden)) errors.push(`Protected broad admin wrapper contains stale confirmation token: ${forbidden}`);
}

for (const [label, source, tokens] of [
  ["Autonomy settings handler", sources.autonomy, [
    "readBoundedJsonObject<AutonomySettingsBody>(request",
    "isExplicitJsonConfirmation(parsed.value)",
    'AUTONOMY_SETTINGS_LEASE = "autonomy-settings"',
    "await env.DB.batch([",
    "settingsAndAuditAtomic: true",
  ]],
  ["Legacy compatibility handler", sources.legacy, [
    "readBoundedJsonObject<LegacySettingsBody>(request",
    "readBoundedJsonObject<LegacyDraftDecisionBody>(request",
    "isExplicitJsonConfirmation(parsed.value)",
    'LEGACY_SETTINGS_LEASE = "legacy-safe-settings"',
    'const actionKey = `draft-review:${draftId}`',
    "readRouteMutatesSettings: false",
    "responseMutatesSettings: false",
  ]],
  ["Operations route policy", sources.operationsPolicy, [
    'writeConfirmation: "handler-enforced"',
    'writeConfirmation: "not-applicable"',
    "callsAI: false",
    "canSendEmail: false",
    "canPostSocial: false",
    "canSubmitForms: false",
  ]],
]) {
  for (const token of tokens) {
    if (!source.includes(token)) errors.push(`${label} is missing: ${token}`);
  }
}

for (const token of [
  'contractVersion: "admin_historical_leads_v2_read_only"',
  'contractVersion: "admin_historical_drafts_v2_read_only"',
  'contractVersion: "admin_historical_events_v2_read_only"',
  'contractVersion: "admin_historical_insights_v2_read_only"',
  'contractVersion: "admin_historical_runs_v2_read_only"',
  "safety: historicalReadSafety",
]) {
  if (!sources.admin.includes(token)) errors.push(`Broad admin read implementation is missing truthful token: ${token}`);
}
for (const token of [
  'contractVersion: "admin_health_v2_manual_research_only"',
  "scheduledExecutionEnabled: false",
  "scheduledExternalResearchEnabled: false",
  "manualResearchRequiresAuthentication: true",
  "manualResearchRequiresConfirmation: true",
  'contractVersion: "admin_diagnostics_v2_historical_read_only"',
  "authoritativeForExecution: false",
]) {
  if (!sources.health.includes(token)) errors.push(`Admin reporting implementation is missing truthful runtime token: ${token}`);
}
for (const token of [
  'contractVersion: "admin_schema_v2_names_only"',
  "SELECT name, type",
  "rawSqlExposed: false",
  "rowDataExposed: false",
  "secretsExposed: false",
  "executable: false",
]) {
  if (!sources.schema.includes(token)) errors.push(`Authenticated schema implementation is missing safe token: ${token}`);
}

const expectedScripts = {
  "worker:health:check": "node scripts/check-worker-health-contract.mjs",
  "worker:central-auth-safety:check": "node scripts/check-central-authentication-safety.mjs",
  "worker:credential-contract:check": "node scripts/check-worker-credential-contract.mjs",
  "worker:source-secret-safety:check": "node scripts/check-worker-source-secrets.mjs",
  "research:bounded-json-safety:check": "node scripts/check-bounded-json-request-safety.mjs",
  "research:manual-lease-safety:check": "node scripts/check-manual-research-lease-safety.mjs",
  "research:public-fetch-safety:check": "node scripts/check-public-research-fetch-safety.mjs",
  "review:mutation-safety:check": "node scripts/check-review-mutation-boundary-safety.mjs",
  "opportunities:evidence-quality:check": "node scripts/check-opportunity-evidence-quality.mjs",
  "growth:route-parity:check": "node scripts/check-growth-route-parity.mjs",
  "autonomy:capability-truthfulness:check": "node scripts/check-autonomy-capability-truthfulness.mjs",
  "manual:execution-safety:check": "node scripts/check-manual-execution-safety.mjs",
  "operations:route-policy:check": "node scripts/check-operations-route-policy.mjs",
  "test:core": "node --test",
  "safety:gates:check": "node scripts/check-safety-gate-completeness.mjs",
};
for (const [name, command] of Object.entries(expectedScripts)) {
  if (scripts[name] !== command) errors.push(`package.json must expose ${name} as ${command}`);
  if (!checkLocal.includes(`npm run ${name}`)) errors.push(`check:local must include npm run ${name}`);
}
if (!String(scripts.predeploy || "").includes("npm run check:local")) errors.push("predeploy must run check:local");

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "worker-contract-workflow-v8-source-secrets",
  nodeVersion: 24,
  lockedInstallRequired: true,
  readOnlyWorkflowPermissions: true,
  persistedCheckoutCredentialsAllowed: false,
  deploymentAllowed: false,
  workerCredentialsAllowed: false,
  trackedSourceSecretGateRequired: true,
  trackedSourceSecretGateBeforeWorkflowParityRequired: true,
  workerEnvironmentTemplateChangesWatched: true,
  boundedJsonGateRequired: true,
  manualLeaseGateRequired: true,
  reviewMutationGateRequired: true,
  autonomySettingsGateRequired: true,
  legacyExecutionSafetyGateRequired: true,
  operationsRoutePolicyGateRequired: true,
  publicResearchGateRequired: true,
  evidenceQualityGateRequired: true,
  growthRouteParityGateRequired: true,
  growthRouteParityBeforeTestsRequired: true,
  deterministicCoreTestsRequired: true,
  sourceCandidateWritesAtomic: true,
  sourceCandidateBehavioralSourceTestsRequired: true,
  completeLocalGateRequired: true,
  protectedWrappersRequired: true,
  broadAdminWritesBoundedAndExact: true,
  settingsWritesBoundedLeasedAndAtomic: true,
  legacyReviewWritesBoundedLeasedAndAtomic: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
