#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptsDir = path.join(root, "scripts");
const errors = [];
const passes = [];

function requireFile(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) errors.push(`Missing required file: ${relativePath}`);
  else passes.push(`${relativePath} exists`);
  return absolutePath;
}

function requireAbsent(relativePath) {
  if (fs.existsSync(path.join(root, relativePath))) errors.push(`Removed file must remain absent: ${relativePath}`);
  else passes.push(`${relativePath} is absent`);
}

function requireTokens(relativePath, tokens) {
  const absolutePath = requireFile(relativePath);
  if (!fs.existsSync(absolutePath)) return;
  const content = fs.readFileSync(absolutePath, "utf8");
  for (const token of tokens) {
    if (!content.includes(token)) errors.push(`${relativePath} is missing required token: ${token}`);
  }
}

if (!fs.existsSync(scriptsDir)) errors.push("Missing scripts directory");
const helperScripts = fs.existsSync(scriptsDir)
  ? fs.readdirSync(scriptsDir).filter((name) => name.endsWith(".mjs")).sort()
  : [];

for (const scriptName of helperScripts) {
  const relativePath = path.join("scripts", scriptName).replaceAll("\\", "/");
  const absolutePath = path.join(scriptsDir, scriptName);
  const result = spawnSync(process.execPath, ["--check", absolutePath], { encoding: "utf8" });
  if (result.status !== 0) errors.push(`${relativePath} does not parse: ${result.stderr || result.stdout}`);
  else passes.push(`${relativePath} parses`);
}

for (const relativePath of [
  "Run-BusinessOperatorWorkerRunbook.ps1",
  "Run-WorkerFinalGate.ps1",
  "src/index.ts",
  "src/db.ts",
  "src/engineAutonomy.ts",
  "src/core/adminAuthentication.ts",
  "src/core/publicResearchFetch.ts",
  "src/core/opportunityDiscovery.ts",
  "src/core/opportunityPersistence.ts",
  "src/core/opportunityScoring.ts",
  "src/routes/admin.ts",
  "src/routes/autonomySettingsAdmin.ts",
  "src/routes/legacyExecutionSafetyAdmin.ts",
  "src/routes/tools.ts",
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
  "scripts/check-public-research-fetch-safety.mjs",
  "scripts/check-opportunity-evidence-quality.mjs",
  "scripts/check-runtime-capability-config.mjs",
  "docs/public-research-fetch-boundary.md",
  "docs/opportunity-evidence-quality.md",
  ".github/workflows/worker-contract.yml",
  "wrangler.toml",
  "package.json",
  "package-lock.json",
]) requireFile(relativePath);

requireAbsent("src/engine.ts");
requireAbsent("src/email.ts");

requireTokens("src/db.ts", [
  "ADMIN_TOKEN?: string",
  "export function getAdminToken(env: Env): string | undefined",
  "return env.ADMIN_TOKEN;",
]);
requireTokens("src/core/adminAuthentication.ts", [
  'authorization.startsWith("Bearer ")',
  'authorization.slice("Bearer ".length)',
  'crypto.subtle.digest("SHA-256"',
  "difference |= leftDigest[index] ^ rightDigest[index]",
  "return constantTimeEqual(provided, expected)",
]);
requireTokens("src/core/publicResearchFetch.ts", [
  'PUBLIC_RESEARCH_FETCH_CONTRACT = "public_research_fetch_v1"',
  'redirect: "manual"',
  "readBodyBounded",
  "bodySha256",
  "fetchPublicResearchHtml",
  "fetchPublicResearchText",
  "const deadlineAt = startedAt + timeoutMs",
  'timeoutScope: "full_operation"',
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
requireTokens("src/index.ts", [
  'headers.set("cache-control", "no-store")',
  'headers.set("x-content-type-options", "nosniff")',
  'headers.set("referrer-policy", "no-referrer")',
  "runScheduledSafely",
  'import { isAdminRequestAuthorized } from "./core/adminAuthentication"',
  "if (protectedRoute && !(await isAdminRequestAuthorized(req, env)))",
]);
requireTokens("src/routes/admin.ts", [
  'import { isAdminRequestAuthorized } from "../core/adminAuthentication"',
  "await isAdminRequestAuthorized(request, env)",
  'error: "Unauthorized"',
  'error: "method_not_allowed"',
  "status: 405",
  'headers: { allow: "GET, POST" }',
  'headers.set("cache-control", "no-store")',
  'headers.set("x-content-type-options", "nosniff")',
]);
requireTokens("src/routes/growthRoutePolicy.ts", [
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
  'authentication: "handler-enforced"',
]);
requireTokens("src/routes/opportunityRoutePolicy.ts", [
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
  'networkPosture: "read-only-research"',
  'authentication: "handler-enforced"',
]);
requireTokens("src/routes/businessRoutePolicy.ts", [
  "callsExternalNetwork: false",
  "callsAI: false",
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
  'readMethods: Object.freeze(["GET"] as const)',
  'writeMethods: Object.freeze(["POST"] as const)',
  'writeConfirmation: "handler-enforced"',
  'authentication: "handler-enforced"',
]);
requireTokens("src/routes/operationsRoutePolicy.ts", [
  'id: "legacy-admin-safety"',
  'id: "autonomy-settings"',
  'id: "planner-routes"',
  'id: "source-batch"',
  'id: "strategy-scores"',
  'networkPosture: "read-only-research"',
  'writeConfirmation: "handler-enforced"',
  "callsAI: false",
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
  'authentication: "handler-enforced"',
]);
requireTokens("src/engineAutonomy.ts", [
  "settings.aiDraftsEnabled = false",
  "settings.sendingEnabled = false",
  "settings.leadDiscoveryEnabled = false",
  'setSetting(env, "engine_enabled", "0")',
  'setSetting(env, "drafting_enabled", "0")',
  'setSetting(env, "sending_enabled", "0")',
]);
requireTokens("src/routes/autonomySettingsAdmin.ts", [
  'import { isAdminRequestAuthorized } from "../core/adminAuthentication"',
  "await isAdminRequestAuthorized(request, env)",
  'contractVersion: "autonomy_settings_v2_review_first"',
  "freeSafeOnly: true",
  "canGenerateDrafts: false",
  "canSendEmail: false",
  "scheduledExternalExecutionDisabled: true",
]);
requireTokens("src/routes/legacyExecutionSafetyAdmin.ts", [
  'import { isAdminRequestAuthorized } from "../core/adminAuthentication"',
  "await isAdminRequestAuthorized(request, env)",
  'error: "legacy_execution_disabled"',
  "allowedKinds: []",
  'engine_enabled", "0"',
  'drafting_enabled: "0"',
  'sending_enabled: "0"',
  "settingsWriteRequiresConfirmation: true",
  "draftDecisionRequiresConfirmation: true",
  "reviewStateOnly: true",
]);
requireTokens("src/routes/tools.ts", [
  'import { isAdminRequestAuthorized } from "../core/adminAuthentication"',
  "await isAdminRequestAuthorized(request, env)",
  'error: "Unauthorized"',
  'contractVersion: "worker_tools_v2_review_first"',
  'aiDefault: "off"',
  'sendingDefault: "off"',
  "manualLegacyExecutionDisabled: true",
]);
requireTokens("src/routes/workerRoutePolicy.ts", [
  'id: "health"',
  'id: "admin"',
  'authentication: "handler-enforced"',
  'mutationPosture: "read-only"',
]);
requireTokens("wrangler.toml", [
  'PUBLIC_ENGINE_NAME = "EVAVO Growth Research Worker"',
  'CAP_CRAWL_PER_DAY = "60"',
  'compatibility_flags = ["global_fetch_strictly_public"]',
  "No email-provider secrets are used or accepted by the active Worker source.",
  "ADMIN_TOKEN",
]);
requireTokens("scripts/check-central-authentication-safety.mjs", [
  'contract: "central-protected-route-authentication"',
  'canonicalCredential: "ADMIN_TOKEN"',
  "constantTimeDigestComparison: true",
  "unauthenticatedProtectedPreflightAllowed: false",
  "localBearerEqualityAllowed: false",
]);
requireTokens("scripts/check-worker-credential-contract.mjs", [
  'contract: "canonical-server-side-worker-credential"',
  'canonicalCredential: "ADMIN_TOKEN"',
  "legacyCredentialAliasesAllowed: false",
  "publicControlCredentialAllowed: false",
]);
requireTokens("scripts/check-worker-env-contract.mjs", [
  'canonicalCredential: "ADMIN_TOKEN"',
  "legacyCredentialAliasesAdvertised: false",
]);
requireTokens("scripts/check-protected-response-safety.mjs", [
  'contract: "protected-worker-response-safety"',
  "wildcardAdminCorsAllowed: false",
  "browserPreflightAllowedWithoutAuthentication: false",
  "protectedResponsesCacheable: false",
]);
requireTokens("scripts/check-scheduled-entrypoint-safety.mjs", [
  'contract: "scheduled-worker-entrypoint-safety"',
  "automaticRetryAllowed: false",
  "alternateExecutionFallbackAllowed: false",
]);
requireTokens("scripts/check-public-research-fetch-safety.mjs", [
  'contract: "public-research-fetch-safety-v5-truthful-redacted-evidence"',
  "strictPublicCloudflareFetchRequired: true",
  "timeoutCoversRedirectsAndBody: true",
  "rejectedUnsafeInputsEchoed: false",
  "sourceRunProvenanceRequired: true",
  "sourceExpansionRunTruthfulnessRequired: true",
  "relationshipGraphRunTruthfulnessRequired: true",
  "sitemapRunTruthfulnessRequired: true",
  "manualOpportunityRunTruthfulnessRequired: true",
  "boundaryDocumentationRequired: true",
]);
requireTokens("scripts/check-opportunity-evidence-quality.mjs", [
  'contract: "opportunity-evidence-quality-v1"',
  "boundaryAwareTermMatching: true",
  "unmarkedNumbersParsedAsMoney: false",
  "missingFactsInvented: false",
  "weakEvidenceLearningBoostAllowed: false",
  "reviewOnlyCandidatePostureRequired: true",
  "draftingRecommendationStored: false",
  "canonicalUrlDeduplicationRequired: true",
]);
requireTokens("scripts/check-runtime-capability-config.mjs", [
  'contract: "review-first-runtime-capability-configuration',
  'canonicalCredential: "ADMIN_TOKEN"',
  "strictPublicSubrequestsEnabled:",
  "legacyCredentialAliasesAdvertised: false",
  "emailProviderConfigured: false",
  "draftRuntimeCapConfigured: false",
  "sendRuntimeCapConfigured: false",
]);
requireTokens("scripts/check-growth-negative-safety.mjs", [
  "canSendEmail: true",
  "canPostSocial: true",
  "canSubmitForms: true",
]);

const dbContent = fs.readFileSync(path.join(root, "src/db.ts"), "utf8");
for (const forbidden of ["PUBLIC_CONTROL_KEY", "OUTBOUND_AGENT_ADMIN_TOKEN"]) {
  if (dbContent.includes(forbidden)) errors.push(`Worker environment must not contain legacy credential alias: ${forbidden}`);
}

for (const relativePath of [
  "src/routes/admin.ts",
  "src/routes/tools.ts",
  "src/routes/autonomySettingsAdmin.ts",
  "src/routes/legacyExecutionSafetyAdmin.ts",
]) {
  const content = fs.readFileSync(path.join(root, relativePath), "utf8");
  for (const forbidden of ["getAdminToken", "function authorized(", "`Bearer ${token}`"]) {
    if (content.includes(forbidden)) errors.push(`${relativePath} must use shared authentication instead of: ${forbidden}`);
  }
}

const adminContent = fs.readFileSync(path.join(root, "src/routes/admin.ts"), "utf8");
if (adminContent.includes('access-control-allow-origin": "*"')) {
  errors.push("Protected admin fallback must not expose wildcard CORS");
}

const packagePath = path.join(root, "package.json");
if (fs.existsSync(packagePath)) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const scripts = packageJson.scripts || {};
  const expectedScripts = {
    "worker:health:check": "node scripts/check-worker-health-contract.mjs",
    "worker:central-auth-safety:check": "node scripts/check-central-authentication-safety.mjs",
    "worker:credential-contract:check": "node scripts/check-worker-credential-contract.mjs",
    "worker:env-contract:check": "node scripts/check-worker-env-contract.mjs",
    "worker:protected-response-safety:check": "node scripts/check-protected-response-safety.mjs",
    "worker:routes:check": "node scripts/check-worker-route-policy.mjs",
    "scheduled:entrypoint-safety:check": "node scripts/check-scheduled-entrypoint-safety.mjs",
    "scheduled:autonomy-safety:check": "node scripts/check-scheduled-autonomy-safety.mjs",
    "manual:execution-safety:check": "node scripts/check-manual-execution-safety.mjs",
    "legacy:engine-isolation:check": "node scripts/check-legacy-engine-isolation.mjs",
    "public:surface-safety:check": "node scripts/check-public-surface-safety.mjs",
    "research:public-fetch-safety:check": "node scripts/check-public-research-fetch-safety.mjs",
    "opportunities:evidence-quality:check": "node scripts/check-opportunity-evidence-quality.mjs",
    "runtime:capability-config:check": "node scripts/check-runtime-capability-config.mjs",
    "growth:route-policy:check": "node scripts/check-growth-route-policy.mjs",
    "growth:negative-safety:check": "node scripts/check-growth-negative-safety.mjs",
    "opportunities:route-policy:check": "node scripts/check-opportunity-route-policy.mjs",
    "business:route-policy:check": "node scripts/check-business-route-policy.mjs",
    "operations:route-policy:check": "node scripts/check-operations-route-policy.mjs",
    "scripts:check": "node scripts/check-helper-scripts.mjs",
    "typecheck": "tsc --noEmit",
  };
  for (const [name, command] of Object.entries(expectedScripts)) {
    if (scripts[name] !== command) errors.push(`package.json script ${name} must equal: ${command}`);
  }

  const requiredLocalSteps = [
    "npm run scripts:check",
    "npm run db:migrations:check",
    "npm run worker:health:check",
    "npm run worker:central-auth-safety:check",
    "npm run worker:credential-contract:check",
    "npm run worker:env-contract:check",
    "npm run worker:protected-response-safety:check",
    "npm run worker:routes:check",
    "npm run scheduled:entrypoint-safety:check",
    "npm run scheduled:autonomy-safety:check",
    "npm run manual:execution-safety:check",
    "npm run legacy:engine-isolation:check",
    "npm run public:surface-safety:check",
    "npm run research:public-fetch-safety:check",
    "npm run opportunities:evidence-quality:check",
    "npm run runtime:capability-config:check",
    "npm run opportunities:route-policy:check",
    "npm run business:route-policy:check",
    "npm run operations:route-policy:check",
    "npm run growth:route-policy:check",
    "npm run growth:negative-safety:check",
    "npm run typecheck",
  ];
  const localGate = String(scripts["check:local"] || "");
  for (const step of requiredLocalSteps) {
    if (!localGate.includes(step)) errors.push(`check:local is missing: ${step}`);
  }
  if (!String(scripts.predeploy || "").includes("npm run check:local")) {
    errors.push("predeploy must run the authoritative check:local gate");
  }
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "dynamic-helper-and-gate-validation-v4-opportunity-evidence",
  parsedHelperScripts: helperScripts.length,
  verifiedFiles: passes.length,
  canonicalCredentialRequired: "ADMIN_TOKEN",
  sharedProtectedAuthenticationRequired: true,
  legacyCredentialAliasesAllowed: false,
  removedLegacyExecutionModulesRequired: true,
  protectedResponseSafetyRequired: true,
  scheduledEntrypointSafetyRequired: true,
  publicResearchFetchSafetyRequired: true,
  publicResearchInputRedactionRequired: true,
  publicResearchRunTruthfulnessRequired: true,
  opportunityEvidenceQualityRequired: true,
  weakEvidenceLearningBoostAllowed: false,
  opportunityDraftRecommendationAllowed: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
