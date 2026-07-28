#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptsDir = path.join(root, "scripts");
const errors = [];
const passes = [];

const absolute = (relativePath) => path.join(root, relativePath);

function read(relativePath) {
  const filePath = absolute(relativePath);
  if (!fs.existsSync(filePath)) {
    errors.push(`Missing required file: ${relativePath}`);
    return "";
  }
  passes.push(`${relativePath} exists`);
  return fs.readFileSync(filePath, "utf8");
}

function requireAbsent(relativePath) {
  if (fs.existsSync(absolute(relativePath))) errors.push(`Removed file must remain absent: ${relativePath}`);
  else passes.push(`${relativePath} is absent`);
}

function requireTokens(relativePath, tokens) {
  const source = read(relativePath);
  if (!source) return;
  for (const token of tokens) {
    if (!source.includes(token)) errors.push(`${relativePath} is missing required token: ${token}`);
  }
}

function forbidTokens(relativePath, tokens) {
  const source = read(relativePath);
  if (!source) return;
  for (const token of tokens) {
    if (source.includes(token)) errors.push(`${relativePath} contains forbidden token: ${token}`);
  }
}

if (!fs.existsSync(scriptsDir)) errors.push("Missing scripts directory");
const helperScripts = fs.existsSync(scriptsDir)
  ? fs.readdirSync(scriptsDir).filter((name) => name.endsWith(".mjs")).sort()
  : [];
for (const scriptName of helperScripts) {
  const relativePath = path.posix.join("scripts", scriptName);
  const result = spawnSync(process.execPath, ["--check", absolute(relativePath)], { encoding: "utf8" });
  if (result.status !== 0) errors.push(`${relativePath} does not parse: ${result.stderr || result.stdout}`);
  else passes.push(`${relativePath} parses`);
}

const requiredFiles = [
  "Run-BusinessOperatorWorkerRunbook.ps1",
  "Run-WorkerFinalGate.ps1",
  "src/index.ts",
  "src/db.ts",
  "src/engineAutonomy.ts",
  "src/core/adminAuthentication.ts",
  "src/core/boundedJsonRequest.ts",
  "src/core/manualResearchLease.ts",
  "src/core/publicResearchFetch.ts",
  "src/core/reviewMutationSafety.ts",
  "src/core/draftReview.ts",
  "src/core/opportunityReview.ts",
  "src/core/opportunityDiscovery.ts",
  "src/core/opportunityPersistence.ts",
  "src/core/opportunityScoring.ts",
  "src/core/opportunitySourceDiscovery.ts",
  "src/routes/admin.ts",
  "src/routes/adminProtected.ts",
  "src/routes/autonomySettingsAdmin.ts",
  "src/routes/legacyExecutionSafetyAdmin.ts",
  "src/routes/draftReviewAdmin.ts",
  "src/routes/opportunityReviewAdmin.ts",
  "src/routes/opportunitySourceCandidatesAdmin.ts",
  "src/routes/opportunitySourceHealthActionsAdmin.ts",
  "src/routes/workerRoutePolicy.ts",
  "src/routes/growthRoutePolicy.ts",
  "src/routes/opportunityRoutePolicy.ts",
  "src/routes/businessRoutePolicy.ts",
  "src/routes/operationsRoutePolicy.ts",
  "scripts/check-central-authentication-safety.mjs",
  "scripts/check-worker-credential-contract.mjs",
  "scripts/check-worker-env-contract.mjs",
  "scripts/check-protected-response-safety.mjs",
  "scripts/check-scheduled-entrypoint-safety.mjs",
  "scripts/check-bounded-json-request-safety.mjs",
  "scripts/check-manual-research-lease-safety.mjs",
  "scripts/check-public-research-fetch-safety.mjs",
  "scripts/check-review-mutation-boundary-safety.mjs",
  "scripts/check-opportunity-evidence-quality.mjs",
  "scripts/check-autonomy-capability-truthfulness.mjs",
  "scripts/check-manual-execution-safety.mjs",
  "scripts/check-operations-route-policy.mjs",
  "scripts/check-runtime-capability-config.mjs",
  "scripts/check-package-service-identity.mjs",
  "scripts/check-worker-repository-visibility.mjs",
  "tests/adminAuthentication.test.ts",
  "tests/boundedJsonRequest.test.ts",
  "tests/publicResearchFetch.test.ts",
  "tests/reviewMutationSafety.test.ts",
  "tests/opportunitySourceCandidateSaveSource.test.ts",
  "docs/admin-token-security.md",
  "docs/bounded-admin-json-boundary.md",
  "docs/manual-research-concurrency.md",
  "docs/public-research-fetch-boundary.md",
  "docs/review-mutation-boundary.md",
  "docs/opportunity-evidence-quality.md",
  "docs/worker-repository-confidentiality.md",
  ".github/workflows/worker-contract.yml",
  ".github/workflows/worker-repository-confidentiality.yml",
  "wrangler.toml",
  "package.json",
  "package-lock.json",
];
for (const relativePath of requiredFiles) read(relativePath);

requireAbsent("src/engine.ts");
requireAbsent("src/email.ts");

requireTokens("src/db.ts", [
  "ADMIN_TOKEN?: string",
  "export function getAdminToken(env: Env): string | undefined",
  "return env.ADMIN_TOKEN;",
]);
requireTokens("src/core/adminAuthentication.ts", [
  "ADMIN_TOKEN_MIN_BYTES = 32",
  "ADMIN_TOKEN_MAX_BYTES = 256",
  "function hasValidAdminTokenShape",
  'authorization.startsWith("Bearer ")',
  'authorization.slice("Bearer ".length)',
  "value.trim() !== value",
  "/\\s/.test(value)",
  'crypto.subtle.digest("SHA-256"',
  "difference |= leftDigest[index] ^ rightDigest[index]",
  "!expected || !provided || !hasValidAdminTokenShape(expected)",
]);
forbidTokens("src/core/adminAuthentication.ts", [
  "provided === expected",
  "provided == expected",
  "PUBLIC_CONTROL_KEY",
  "OUTBOUND_AGENT_ADMIN_TOKEN",
]);

requireTokens("src/core/boundedJsonRequest.ts", [
  'BOUNDED_JSON_REQUEST_CONTRACT = "bounded_admin_json_request_v1"',
  "DEFAULT_ADMIN_JSON_MAX_BYTES = 65_536",
  "readRequestBodyBounded",
  "validateJsonStructure",
  "isExplicitJsonConfirmation",
  "bodySha256",
  '"forbidden_json_key"',
]);
requireTokens("src/core/manualResearchLease.ts", [
  'MANUAL_RESEARCH_LEASE_CONTRACT = "manual_research_lease_v1"',
  "acquireManualResearchLease",
  "releaseManualResearchLease",
  'error: "research_action_in_progress"',
  "automaticRetryAllowed: false",
]);
requireTokens("src/core/publicResearchFetch.ts", [
  'PUBLIC_RESEARCH_FETCH_CONTRACT = "public_research_fetch_v2"',
  'redirect: "manual"',
  "SENSITIVE_QUERY_KEYS",
  "redirectChain",
  "isProbablyBinary",
  "readBodyBounded",
  "bodySha256",
  "fetchPublicResearchHtml",
  "fetchPublicResearchText",
  "const deadlineAt = startedAt + timeoutMs",
  'timeoutScope: "full_operation"',
]);
requireTokens("src/core/reviewMutationSafety.ts", [
  'REVIEW_MUTATION_CONTRACT = "review_mutation_boundary_v1"',
  "validReviewRecordId",
  "boundedReviewText",
  "boundedReviewRating",
  "reviewLeaseKey",
  'crypto.subtle.digest("SHA-256"',
]);

requireTokens("src/core/draftReview.ts", [
  "DRAFT_REVIEW_DECISIONS",
  "normalizeDraftStrategyKey",
  "await env.DB.batch(statements)",
  "INSERT INTO draft_reviews",
  "INSERT INTO strategy_scores",
  "mutationAndAuditAtomic: true",
  "reviewOnly: true",
  "externalExecutionAllowed: false",
]);
requireTokens("src/core/opportunityReview.ts", [
  "OPPORTUNITY_REVIEW_DECISIONS",
  "opportunityStrategyScope",
  "await env.DB.batch([",
  "INSERT INTO opportunity_reviews",
  "UPDATE opportunities SET status",
  "reviewStatusScoreAndAuditAtomic: true",
  "reviewOnly: true",
  "externalExecutionAllowed: false",
]);
requireTokens("src/core/opportunityDiscovery.ts", [
  "evidenceQualityScore",
  "missingFacts",
  "reviewFlags",
  "canonicalPublicUrl",
  "shortlist_for_operator_review",
  "reviewOnly: true",
  "executable: false",
]);
requireTokens("src/core/opportunityPersistence.ts", [
  "hasRequiredReviewPosture",
  'schemaVersion: "opportunity_evidence_v4_quality_review_only"',
  "normalizeReviewAction",
  "groundedValueCents",
]);
requireTokens("src/core/opportunityScoring.ts", [
  "evidenceQualityFor",
  "guardrail:weak_evidence_no_positive_learning_boost",
  "guardrail:weak_evidence_ceiling_45",
]);
requireTokens("src/core/opportunitySourceDiscovery.ts", [
  'SOURCE_CANDIDATE_SAVE_CONTRACT = "opportunity_source_candidate_save_v2_atomic"',
  "const statements: D1PreparedStatement[] = []",
  "INSERT INTO opportunity_sources",
  "UPDATE source_expansion_candidates",
  "INSERT INTO events",
  "requestBodySha256: options.requestBodySha256 || null",
  "await env.DB.batch(statements)",
  "sourceRecordsExpansionMarkersAndAuditAtomic: true",
  "reviewOnly: true",
  "executable: false",
  "externalExecutionAllowed: false",
]);
forbidTokens("src/core/opportunitySourceDiscovery.ts", [
  "logEvent(",
  "await env.DB.prepare(`INSERT INTO opportunity_sources",
  "await env.DB.prepare(`UPDATE source_expansion_candidates",
  "fetch(",
  "sendEmail(",
  "waitUntil(",
]);
requireTokens("tests/opportunitySourceCandidateSaveSource.test.ts", [
  'test("reviewed source candidates commit source rows, markers and audit atomically"',
  'test("source candidate save has no sequential helper writes or external execution"',
  'test("source candidate route binds the audit to the bounded request receipt"',
  "sourceRecordsExpansionMarkersAndAuditAtomic: true",
  "requestBodySha256: parsed.bodySha256",
]);

requireTokens("src/index.ts", [
  'headers.set("cache-control", "no-store")',
  'headers.set("x-content-type-options", "nosniff")',
  'headers.set("referrer-policy", "no-referrer")',
  "runScheduledSafely",
  'import { isAdminRequestAuthorized } from "./core/adminAuthentication"',
  "if (protectedRoute && !(await isAdminRequestAuthorized(req, env)))",
  "sourceActionConfirmationFailure",
  "readBoundedJsonObject(request.clone())",
]);
requireTokens("src/routes/adminProtected.ts", [
  "manualMetadataWriteRequiresConfirmation",
  "readBoundedJsonObject(request.clone()",
  "boundedJsonFailurePayload(parsed)",
  "isExplicitJsonConfirmation(parsed.value)",
  "requiredPayload: { confirm: true }",
  "confirmationCoercionAllowed: false",
  "requestReceipt",
]);
forbidTokens("src/routes/adminProtected.ts", [
  "request.clone().json()",
  "body?.confirm === 1",
  'body?.confirm === "1"',
]);

for (const [relativePath, routeToken] of [
  ["src/routes/autonomySettingsAdmin.ts", "const lease = await acquireManualResearchLease"],
  ["src/routes/legacyExecutionSafetyAdmin.ts", "const lease = await acquireManualResearchLease"],
  ["src/routes/draftReviewAdmin.ts", "const draftLease = await acquireManualResearchLease"],
  ["src/routes/opportunityReviewAdmin.ts", "const opportunityLease = await acquireManualResearchLease"],
  ["src/routes/opportunitySourceCandidatesAdmin.ts", "const lease = await acquireManualResearchLease"],
  ["src/routes/opportunitySourceHealthActionsAdmin.ts", "const lease = await acquireManualResearchLease"],
]) {
  requireTokens(relativePath, [
    'import { isAdminRequestAuthorized } from "../core/adminAuthentication"',
    "await isAdminRequestAuthorized(request, env)",
    "readBoundedJsonObject",
    "isExplicitJsonConfirmation",
    "requiredPayload: { confirm: true }",
    "confirmationCoercionAllowed: false",
    "requestReceipt",
    routeToken,
    "manualResearchLeaseConflict",
    "finally {",
    "externalExecutionAllowed: false",
  ]);
  forbidTokens(relativePath, [
    "request.json()",
    "request.clone().json()",
    'searchParams.get("confirm")',
    "body?.confirm === 1",
    'body?.confirm === "1"',
  ]);
}

for (const relativePath of [
  "src/routes/admin.ts",
  "src/routes/tools.ts",
  "src/routes/autonomySettingsAdmin.ts",
  "src/routes/legacyExecutionSafetyAdmin.ts",
  "src/routes/draftReviewAdmin.ts",
  "src/routes/opportunityReviewAdmin.ts",
  "src/routes/opportunitySourceCandidatesAdmin.ts",
  "src/routes/opportunitySourceHealthActionsAdmin.ts",
]) {
  const source = read(relativePath);
  for (const forbidden of ["getAdminToken", "function authorized(", "function authorised(", "`Bearer ${token}`"]) {
    if (source.includes(forbidden)) errors.push(`${relativePath} must use shared authentication instead of: ${forbidden}`);
  }
}

requireTokens("src/routes/growthRoutePolicy.ts", [
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
  'authentication: "handler-enforced"',
]);
requireTokens("src/routes/opportunityRoutePolicy.ts", [
  'id: "learning"',
  'mutationPosture: "read-only"',
  'confirmation: "not-required"',
  'networkPosture: "read-only-research"',
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
]);
requireTokens("src/routes/businessRoutePolicy.ts", [
  "callsExternalNetwork: false",
  "callsAI: false",
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
  'writeConfirmation: "handler-enforced"',
  'authentication: "handler-enforced"',
]);
requireTokens("src/routes/operationsRoutePolicy.ts", [
  'id: "legacy-admin-safety"',
  'id: "autonomy-settings"',
  'id: "source-batch"',
  'id: "draft-review"',
  'writeConfirmation: "handler-enforced"',
  'writeConfirmation: "not-applicable"',
  "callsAI: false",
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
]);
forbidTokens("src/routes/operationsRoutePolicy.ts", ['writeConfirmation: "handler-defined"']);

requireTokens("scripts/check-central-authentication-safety.mjs", [
  'contract: "central-protected-route-authentication-v2-bounded-credential"',
  'canonicalCredential: "ADMIN_TOKEN"',
  "minimumCredentialBytes: 32",
  "maximumCredentialBytes: 256",
]);
requireTokens("scripts/check-worker-credential-contract.mjs", [
  'contract: "canonical-bounded-server-side-worker-credential-v2"',
  'canonicalCredential: "ADMIN_TOKEN"',
  "minimumCredentialBytes: 32",
  "maximumCredentialBytes: 256",
  "legacyCredentialAliasesAllowed: false",
]);
requireTokens("scripts/check-bounded-json-request-safety.mjs", [
  'contract: "bounded-admin-json-request-safety-v4-settings-and-legacy-review"',
  "exactBooleanConfirmationRequired: true",
  "prototypePollutionKeysRejected: true",
  "autonomySettingsBounded: true",
  "legacySettingsBounded: true",
  "legacyDraftReviewBounded: true",
]);
requireTokens("scripts/check-manual-research-lease-safety.mjs", [
  'contract: "manual-research-lease-safety-v4-settings-and-legacy-review"',
  "atomicSingleStatementAcquisitionRequired: true",
  "autonomySettingsLeaseRequired: true",
  "legacySettingsLeaseRequired: true",
  "legacyAndModernDraftReviewShareLease: true",
]);
requireTokens("scripts/check-review-mutation-boundary-safety.mjs", [
  'contract: "review-mutation-boundary-safety-v3-source-candidate-atomicity"',
  "boundedRequestBodyRequired: true",
  "requestFingerprintRequired: true",
  "legacyDraftReviewUsesSharedLease: true",
  "legacyDraftReviewWritesAtomic: true",
  "sourceCandidateWritesAtomic: true",
  "sourceCandidateBehavioralSourceTestsRequired: true",
]);
requireTokens("scripts/check-autonomy-capability-truthfulness.mjs", [
  'contract: "autonomy-capability-truthfulness-v2-bounded-settings"',
  "settingsRequestBounded: true",
  "settingsAndAuditAtomic: true",
]);
requireTokens("scripts/check-manual-execution-safety.mjs", [
  'contract: "manual-legacy-execution-safety-v2-bounded-atomic"',
  "legacyReadRoutesMutateState: false",
  "draftDecisionAndAuditAtomic: true",
]);
requireTokens("scripts/check-operations-route-policy.mjs", [
  'contract: "typed-operational-route-policy-v2-bounded-writes"',
  "readRoutesMutateState: false",
  "writePoliciesAmbiguous: false",
]);
requireTokens("scripts/check-public-research-fetch-safety.mjs", [
  'contract: "public-research-fetch-safety-v7-hierarchical-source-exclusion"',
  'activeFetchContract: "public_research_fetch_v2"',
  "sensitiveQueryParametersRejected: true",
  "redirectChainEvidenceRequired: true",
  "binaryResponsesRejected: true",
  "timeoutCoversRedirectsAndBody: true",
]);
requireTokens("scripts/check-opportunity-evidence-quality.mjs", [
  'contract: "opportunity-evidence-quality-v1"',
  "boundaryAwareTermMatching: true",
  "unmarkedNumbersParsedAsMoney: false",
  "missingFactsInvented: false",
  "weakEvidenceLearningBoostAllowed: false",
]);
requireTokens("scripts/check-runtime-capability-config.mjs", [
  'canonicalCredential: "ADMIN_TOKEN"',
  "legacyCredentialAliasesAdvertised: false",
  "emailProviderConfigured: false",
  "draftRuntimeCapConfigured: false",
  "sendRuntimeCapConfigured: false",
]);
requireTokens("scripts/check-package-service-identity.mjs", [
  'contract: "package-service-identity-v2-active-package"',
  'packageIdentifier: packageJson.name || null',
  'historicalDeploymentIdentifier: identity.historicalDeploymentIdentifier || null',
  'historicalDatabaseIdentifier: identity.historicalDatabaseIdentifier || null',
  'npmPackageUsesHistoricalDeploymentName: packageJson.name === identity.historicalDeploymentIdentifier',
  "packageLockAligned:",
  "outboundExecutionEnabled: false",
]);
requireTokens("scripts/check-worker-repository-visibility.mjs", [
  'contract: "worker-repository-confidentiality-v1-live-metadata"',
  'requiredVisibility: "private"',
  "liveRepositoryVisibilityVerified:",
  "tokenLogged: false",
  "responseBodyLogged: false",
  "repositoryMutationPerformed: false",
  "deploymentPerformed: false",
]);

const packageJson = JSON.parse(read("package.json") || "{}");
const scripts = packageJson.scripts || {};
const typescriptCoreTestCommand =
  "node --experimental-strip-types --experimental-transform-types --experimental-loader ./scripts/typescript-test-loader.mjs --test";
const expectedScripts = {
  "worker:health:check": "node scripts/check-worker-health-contract.mjs",
  "worker:central-auth-safety:check": "node scripts/check-central-authentication-safety.mjs",
  "worker:credential-contract:check": "node scripts/check-worker-credential-contract.mjs",
  "worker:env-contract:check": "node scripts/check-worker-env-contract.mjs",
  "worker:protected-response-safety:check": "node scripts/check-protected-response-safety.mjs",
  "worker:package-identity:check": "node scripts/check-package-service-identity.mjs",
  "worker:repository-visibility:check": "node scripts/check-worker-repository-visibility.mjs",
  "worker:routes:check": "node scripts/check-worker-route-policy.mjs",
  "scheduled:entrypoint-safety:check": "node scripts/check-scheduled-entrypoint-safety.mjs",
  "scheduled:autonomy-safety:check": "node scripts/check-scheduled-autonomy-safety.mjs",
  "manual:execution-safety:check": "node scripts/check-manual-execution-safety.mjs",
  "legacy:engine-isolation:check": "node scripts/check-legacy-engine-isolation.mjs",
  "public:surface-safety:check": "node scripts/check-public-surface-safety.mjs",
  "research:bounded-json-safety:check": "node scripts/check-bounded-json-request-safety.mjs",
  "research:manual-lease-safety:check": "node scripts/check-manual-research-lease-safety.mjs",
  "research:public-fetch-safety:check": "node scripts/check-public-research-fetch-safety.mjs",
  "review:mutation-safety:check": "node scripts/check-review-mutation-boundary-safety.mjs",
  "opportunities:evidence-quality:check": "node scripts/check-opportunity-evidence-quality.mjs",
  "autonomy:capability-truthfulness:check": "node scripts/check-autonomy-capability-truthfulness.mjs",
  "operations:route-policy:check": "node scripts/check-operations-route-policy.mjs",
  "runtime:capability-config:check": "node scripts/check-runtime-capability-config.mjs",
  "scripts:check": "node scripts/check-helper-scripts.mjs",
  "test:core": typescriptCoreTestCommand,
  "typecheck": "tsc --noEmit",
};
for (const [name, command] of Object.entries(expectedScripts)) {
  if (scripts[name] !== command) errors.push(`package.json script ${name} must equal: ${command}`);
}
const localGate = String(scripts["check:local"] || "");
for (const name of Object.keys(expectedScripts)) {
  if (!localGate.includes(`npm run ${name}`)) errors.push(`check:local is missing: npm run ${name}`);
}
if (!String(scripts.predeploy || "").includes("npm run check:local")) {
  errors.push("predeploy must run the authoritative check:local gate");
}

const adminContent = read("src/routes/admin.ts");
if (adminContent.includes('access-control-allow-origin": "*"')) {
  errors.push("Protected admin fallback must not expose wildcard CORS");
}
const dbContent = read("src/db.ts");
for (const forbidden of ["PUBLIC_CONTROL_KEY", "OUTBOUND_AGENT_ADMIN_TOKEN"]) {
  if (dbContent.includes(forbidden)) errors.push(`Worker environment must not contain legacy credential alias: ${forbidden}`);
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "dynamic-helper-and-gate-validation-v10-package-identity",
  parsedHelperScripts: helperScripts.length,
  verifiedFiles: passes.length,
  canonicalCredentialRequired: "ADMIN_TOKEN",
  boundedCredentialBehaviorRequired: true,
  sharedProtectedAuthenticationRequired: true,
  legacyCredentialAliasesAllowed: false,
  removedLegacyExecutionModulesRequired: true,
  boundedJsonRequestSafetyRequired: true,
  manualResearchLeaseSafetyRequired: true,
  reviewMutationSafetyRequired: true,
  sourceCandidateAtomicityRequired: true,
  autonomySettingsSafetyRequired: true,
  legacyCompatibilitySafetyRequired: true,
  operationalRoutePolicySafetyRequired: true,
  publicResearchFetchSafetyRequired: true,
  opportunityEvidenceQualityRequired: true,
  activePackageIdentityRequired: true,
  packageAndLockIdentityAlignmentRequired: true,
  historicalDeploymentIdentifierRetained: true,
  repositoryConfidentialityPolicyRequired: true,
  liveRepositoryVisibilityWorkflowRequired: true,
  typescriptLoaderCoreTestsRequired: true,
  deterministicCoreBehavioralTestsRequired: true,
  weakEvidenceLearningBoostAllowed: false,
  opportunityDraftRecommendationAllowed: false,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
