#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const resolve = (...parts) => path.join(root, ...parts);
const read = (absolutePath) => fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : "";

const paths = {
  workflow: resolve(".github", "workflows", "worker-contract.yml"),
  package: resolve("package.json"),
  index: resolve("src", "index.ts"),
  admin: resolve("src", "routes", "admin.ts"),
  adminWrapper: resolve("src", "routes", "adminProtected.ts"),
  plannerWrapper: resolve("src", "routes", "plannerAdminProtected.ts"),
  growthWrapper: resolve("src", "routes", "growthAdminProtected.ts"),
  health: resolve("src", "core", "health.ts"),
  schema: resolve("src", "core", "schema.ts"),
  bounded: resolve("scripts", "check-bounded-json-request-safety.mjs"),
  lease: resolve("scripts", "check-manual-research-lease-safety.mjs"),
  review: resolve("scripts", "check-review-mutation-boundary-safety.mjs"),
  publicFetch: resolve("scripts", "check-public-research-fetch-safety.mjs"),
  evidence: resolve("scripts", "check-opportunity-evidence-quality.mjs"),
};

for (const [label, absolutePath] of Object.entries(paths)) {
  if (!fs.existsSync(absolutePath)) errors.push(`Missing ${label}: ${absolutePath}`);
}

const workflow = read(paths.workflow);
const packageJson = fs.existsSync(paths.package) ? JSON.parse(read(paths.package)) : {};
const index = read(paths.index);
const admin = read(paths.admin);
const adminWrapper = read(paths.adminWrapper);
const plannerWrapper = read(paths.plannerWrapper);
const growthWrapper = read(paths.growthWrapper);
const health = read(paths.health);
const schema = read(paths.schema);
const bounded = read(paths.bounded);
const lease = read(paths.lease);
const review = read(paths.review);
const publicFetch = read(paths.publicFetch);
const evidence = read(paths.evidence);
const scripts = packageJson.scripts || {};
const checkLocal = String(scripts["check:local"] || "");

for (const token of [
  "branches: [main]",
  "permissions:\n  contents: read",
  'node-version: "24"',
  "cache: npm",
  "npm ci --no-audit --no-fund",
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
  "Run deterministic core tests",
  "npm run test:core",
  "npm run check:local",
  "timeout-minutes: 12",
  "persist-credentials: false",
  "cancel-in-progress: true",
]) {
  if (!workflow.includes(token)) errors.push(`Worker contract workflow is missing: ${token}`);
}

for (const watchedPath of [
  '      - "src/**"',
  '      - "scripts/**"',
  '      - "tests/**"',
  '      - "docs/**"',
  '      - "migrations/**"',
  '      - "README.md"',
  '      - "wrangler.toml"',
  '      - "package.json"',
  '      - "package-lock.json"',
]) {
  if (!workflow.includes(watchedPath)) errors.push(`Worker workflow must watch: ${watchedPath.trim()}`);
}
if (workflow.includes("wrangler deploy")) errors.push("Contract workflow must not deploy the Worker");
for (const secretName of ["ADMIN_TOKEN", "OUTBOUND_AGENT_ADMIN_TOKEN", "PUBLIC_CONTROL_KEY"]) {
  if (workflow.includes(secretName)) errors.push(`Contract workflow must not request Worker credential: ${secretName}`);
}

const orderedSteps = [
  "npm run research:bounded-json-safety:check",
  "npm run research:manual-lease-safety:check",
  "npm run review:mutation-safety:check",
  "npm run research:public-fetch-safety:check",
  "npm run opportunities:evidence-quality:check",
  "npm run test:core",
  "npm run check:local",
];
let previousIndex = -1;
for (const step of orderedSteps) {
  const indexOfStep = workflow.indexOf(step);
  if (indexOfStep < 0 || indexOfStep <= previousIndex) errors.push(`Worker workflow step order is invalid at ${step}`);
  previousIndex = indexOfStep;
}

for (const [label, source, tokens] of [
  ["bounded JSON safety", bounded, [
    'contract: "bounded-admin-json-request-safety-v2-review-mutations"',
    "exactBooleanConfirmationRequired: true",
    "prototypePollutionKeysRejected: true",
    "requestFingerprintRequired: true",
    "draftReviewBounded: true",
    "opportunityReviewBounded: true",
    "sourceCandidateCommitBounded: true",
  ]],
  ["manual lease safety", lease, [
    'contract: "manual-research-lease-safety-v3-review-and-candidate-coverage"',
    "atomicSingleStatementAcquisitionRequired: true",
    "staleHolderCanReleaseNewLease: false",
    "confirmationBeforeLeaseRequired: true",
    "sourceCandidateCommitLeaseRequired: true",
    "draftRecordAndStrategyLeasesRequired: true",
    "opportunityRecordAndStrategyLeasesRequired: true",
    "automaticRetryAllowed: false",
  ]],
  ["review mutation safety", review, [
    'contract: "review-mutation-boundary-safety-v1"',
    "exactBooleanConfirmationRequired: true",
    "boundedRequestBodyRequired: true",
    "requestFingerprintRequired: true",
    "perRecordLeaseRequired: true",
    "sharedLearningScopeLeaseRequired: true",
    "draftReviewWritesAtomic: true",
    "opportunityReviewWritesAtomic: true",
  ]],
  ["public research safety", publicFetch, [
    'contract: "public-research-fetch-safety-v7-hierarchical-source-exclusion"',
    'activeFetchContract: "public_research_fetch_v2"',
    "sensitiveQueryParametersRejected: true",
    "redirectChainEvidenceRequired: true",
    "binaryResponsesRejected: true",
    "timeoutCoversRedirectsAndBody: true",
    "overlappingBroadAndPerSourceActionsAllowed: false",
    "behavioralTestsRequired: true",
  ]],
  ["opportunity evidence quality", evidence, [
    'contract: "opportunity-evidence-quality-v1"',
    "boundaryAwareTermMatching: true",
    "unmarkedNumbersParsedAsMoney: false",
    "missingFactsInvented: false",
    "weakEvidenceLearningBoostAllowed: false",
    "reviewOnlyCandidatePostureRequired: true",
    "canonicalUrlDeduplicationRequired: true",
  ]],
]) {
  for (const token of tokens) {
    if (!source.includes(token)) errors.push(`${label} contract is missing CI-required posture: ${token}`);
  }
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
  if (!index.includes(token)) errors.push(`Worker dispatcher is missing protected or bounded routing token: ${token}`);
}
for (const forbiddenImport of [
  'from "./routes/admin"',
  'from "./routes/plannerAdmin"',
  'from "./routes/growthAdmin"',
]) {
  if (index.includes(forbiddenImport)) errors.push(`Worker dispatcher contains direct implementation import: ${forbiddenImport}`);
}

for (const [label, content, delegateCall] of [
  ["Protected broad admin wrapper", adminWrapper, "return handleAdminImplementation(request, env, pathname, ctx, json)"],
  ["Protected planner wrapper", plannerWrapper, "return handlePlannerAdminImplementation(request, env, pathname, json)"],
  ["Protected Growth wrapper", growthWrapper, "return handleGrowthAdminImplementation(request, env, pathname, json)"],
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
  if (!adminWrapper.includes(token)) errors.push(`Protected broad admin wrapper is missing manual-write safety token: ${token}`);
}
for (const forbidden of ["request.clone().json()", "body?.confirm === 1", 'body?.confirm === "1"']) {
  if (adminWrapper.includes(forbidden)) errors.push(`Protected broad admin wrapper contains stale confirmation token: ${forbidden}`);
}

for (const token of [
  'contractVersion: "admin_historical_leads_v2_read_only"',
  'contractVersion: "admin_historical_drafts_v2_read_only"',
  'contractVersion: "admin_historical_events_v2_read_only"',
  'contractVersion: "admin_historical_insights_v2_read_only"',
  'contractVersion: "admin_historical_runs_v2_read_only"',
  "safety: historicalReadSafety",
]) {
  if (!admin.includes(token)) errors.push(`Broad admin read implementation is missing truthful token: ${token}`);
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
  if (!health.includes(token)) errors.push(`Admin reporting implementation is missing truthful runtime token: ${token}`);
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

const expectedScripts = {
  "worker:health:check": "node scripts/check-worker-health-contract.mjs",
  "worker:central-auth-safety:check": "node scripts/check-central-authentication-safety.mjs",
  "worker:credential-contract:check": "node scripts/check-worker-credential-contract.mjs",
  "research:bounded-json-safety:check": "node scripts/check-bounded-json-request-safety.mjs",
  "research:manual-lease-safety:check": "node scripts/check-manual-research-lease-safety.mjs",
  "research:public-fetch-safety:check": "node scripts/check-public-research-fetch-safety.mjs",
  "review:mutation-safety:check": "node scripts/check-review-mutation-boundary-safety.mjs",
  "opportunities:evidence-quality:check": "node scripts/check-opportunity-evidence-quality.mjs",
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
  contract: "worker-contract-workflow-v4-review-and-bounded-credential",
  nodeVersion: 24,
  lockedInstallRequired: true,
  readOnlyWorkflowPermissions: true,
  persistedCheckoutCredentialsAllowed: false,
  deploymentAllowed: false,
  workerCredentialsAllowed: false,
  boundedJsonGateRequired: true,
  manualLeaseGateRequired: true,
  reviewMutationGateRequired: true,
  publicResearchGateRequired: true,
  evidenceQualityGateRequired: true,
  deterministicCoreTestsRequired: true,
  completeLocalGateRequired: true,
  protectedWrappersRequired: true,
  broadAdminWritesBoundedAndExact: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
