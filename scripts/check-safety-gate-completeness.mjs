#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const packagePath = path.join(root, "package.json");
const packageJson = fs.existsSync(packagePath)
  ? JSON.parse(fs.readFileSync(packagePath, "utf8"))
  : {};
const scripts = packageJson.scripts ?? {};
const checkLocal = String(scripts["check:local"] ?? "");

const requiredSafetyCommands = Object.freeze({
  "growth:generated-routes:check":
    "node scripts/check-generated-route-wiring-clean.mjs",
  "growth:route-parity:check": "node scripts/check-growth-route-parity.mjs",
  "docs:operating-posture:check":
    "node scripts/check-readme-operating-posture.mjs",
  "docs:readme-truthfulness:check":
    "node scripts/check-readme-top-level-truthfulness.mjs",
  "business:approval-isolation:check":
    "node scripts/check-business-approval-isolation.mjs",
  "business:audit-pack-response-minimisation:check":
    "node scripts/check-business-audit-pack-response-minimisation.mjs",
  "business:autopilot:check": "node scripts/check-business-autopilot.mjs",
  "business:autopilot:raw-error-safety:check":
    "node scripts/check-business-autopilot-raw-error-safety.mjs",
  "business:ci-parity:check": "node scripts/check-business-ci-parity.mjs",
  "business:draft-runtime-safety:check":
    "node scripts/check-business-draft-runtime-safety.mjs",
  "business:execution-level-truthfulness:check":
    "node scripts/check-business-execution-level-truthfulness.mjs",
  "business:historical-read-minimisation:check":
    "node scripts/check-business-historical-read-minimisation.mjs",
  "business:historical-record-posture:check":
    "node scripts/check-business-historical-record-posture.mjs",
  "business:historical-type-isolation:check":
    "node scripts/check-business-historical-type-isolation.mjs",
  "business:internal-planning-safety:check":
    "node scripts/check-business-internal-planning-safety.mjs",
  "business:internal-read-minimisation:check":
    "node scripts/check-business-internal-read-minimisation.mjs",
  "business:learning-event-safety:check":
    "node scripts/check-business-learning-event-safety.mjs",
  "business:opportunity-review-safety:check":
    "node scripts/check-business-opportunity-review-safety.mjs",
  "business:people-response-minimisation:check":
    "node scripts/check-business-people-response-minimisation.mjs",
  "business:record-builder-safety:check":
    "node scripts/check-business-record-builder-safety.mjs",
  "business:review-record-storage-isolation:check":
    "node scripts/check-business-review-record-storage-isolation.mjs",
  "business:route-policy:check": "node scripts/check-business-route-policy.mjs",
  "business:suppression-integrity:check":
    "node scripts/check-business-suppression-integrity.mjs",
  "business:validation-workflow-safety:check":
    "node scripts/check-business-validation-workflow-safety.mjs",
  "business:route-catalogue-truthfulness:check":
    "node scripts/check-business-route-catalogue-truthfulness.mjs",
  "planner:catalogue-truthfulness:check":
    "node scripts/check-planner-catalogue-truthfulness.mjs",
  "admin:broad-read-truthfulness:check":
    "node scripts/check-broad-admin-read-truthfulness.mjs",
  "admin:broad-write-safety:check":
    "node scripts/check-broad-admin-write-safety.mjs",
  "admin:reporting-truthfulness:check":
    "node scripts/check-admin-reporting-truthfulness.mjs",
  "admin:schema-safety:check": "node scripts/check-admin-schema-safety.mjs",
  "autonomy:capability-truthfulness:check":
    "node scripts/check-autonomy-capability-truthfulness.mjs",
  "sources:confirmation-safety:check":
    "node scripts/check-source-action-confirmation-safety.mjs",
  "research:bounded-json-safety:check":
    "node scripts/check-bounded-json-request-safety.mjs",
  "research:manual-lease-safety:check":
    "node scripts/check-manual-research-lease-safety.mjs",
  "research:public-fetch-safety:check":
    "node scripts/check-public-research-fetch-safety.mjs",
  "review:mutation-safety:check":
    "node scripts/check-review-mutation-boundary-safety.mjs",
  "opportunities:evidence-quality:check":
    "node scripts/check-opportunity-evidence-quality.mjs",
  "opportunities:execution-boundary-safety:check":
    "node scripts/check-opportunity-execution-boundary-safety.mjs",
  "growth:subhandler-auth-safety:check":
    "node scripts/check-growth-subhandler-auth-safety.mjs",
  "runtime:capability-config:check":
    "node scripts/check-runtime-capability-config.mjs",
  "worker:central-auth-safety:check":
    "node scripts/check-central-authentication-safety.mjs",
  "worker:credential-contract:check":
    "node scripts/check-worker-credential-contract.mjs",
  "worker:dependabot-config:check": "node scripts/check-dependabot-config.mjs",
  "worker:package-identity:check":
    "node scripts/check-package-service-identity.mjs",
  "worker:repository-visibility:check":
    "node scripts/check-worker-repository-visibility.mjs",
  "worker:source-secret-safety:check":
    "node scripts/check-worker-source-secrets.mjs",
  "worker:workflow-action-pinning:check":
    "node scripts/check-workflow-action-pinning.mjs",
  "scripts:check": "node scripts/check-helper-scripts.mjs",
  "test:core":
    "node --experimental-strip-types --experimental-transform-types --experimental-loader ./scripts/typescript-test-loader.mjs --test",
});

if (!fs.existsSync(packagePath)) errors.push("Missing package.json.");

for (const [scriptName, command] of Object.entries(requiredSafetyCommands)) {
  if (scripts[scriptName] !== command) {
    errors.push(`package.json must expose ${scriptName} as ${command}`);
  }
  if (!checkLocal.includes(`npm run ${scriptName}`)) {
    errors.push(`check:local must include ${scriptName}`);
  }
  const match = command.match(/^node(?:\s+--[^\s]+)*\s+([^\s]+\.mjs)/u);
  if (match && !fs.existsSync(path.join(root, match[1]))) {
    errors.push(`Missing safety checker: ${match[1]}`);
  }
}

for (const relativePath of [
  ".dev.vars.example",
  "docs/admin-token-security.md",
  "docs/review-mutation-boundary.md",
  "docs/growth-route-parity.md",
  "docs/worker-repository-confidentiality.md",
  "docs/worker-source-secret-posture.md",
  "tests/adminAuthentication.test.ts",
  "tests/boundedJsonRequest.test.ts",
  "tests/publicResearchFetch.test.ts",
  "tests/reviewMutationSafety.test.ts",
  "tests/opportunitySourceCandidateSaveSource.test.ts",
  "tests/growthRouteParity.test.ts",
  "tests/growthRouteParitySource.test.ts",
  "fixtures/growth-worker-route-parity-v1.json",
  "wrangler.toml",
]) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    errors.push(`Missing safety contract or behavioral test: ${relativePath}`);
  }
}

if (!String(scripts.predeploy ?? "").includes("npm run check:local")) {
  errors.push("predeploy must run the complete check:local gate");
}

const workflowPolicyPath = path.join(
  root,
  "scripts",
  "check-workflow-action-pinning.mjs",
);
const workflowPolicy = fs.existsSync(workflowPolicyPath)
  ? fs.readFileSync(workflowPolicyPath, "utf8")
  : "";
for (const token of [
  'contract: "worker-hosted-execution-policy-v1-local-first"',
  "githubActionsRequired: false",
  "hostedRunnerRequired: false",
  "localValidationAuthoritative: true",
  "providerVisibilityReadUsesLocalChecker: true",
]) {
  if (!workflowPolicy.includes(token)) {
    errors.push(`Hosted-execution policy is missing: ${token}`);
  }
}

console.log(
  JSON.stringify(
    {
      passed: errors.length === 0,
      activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
      contract: "safety-gate-completeness-v11-local-first",
      requiredSafetyCommandCount: Object.keys(requiredSafetyCommands).length,
      completeLocalGateRequired: true,
      predeployUsesCompleteLocalGate: true,
      githubActionsRequired: false,
      hostedRunnerRequired: false,
      liveRepositoryVisibilityWorkflowRequired: false,
      liveRepositoryVisibilityProviderReadRequired: true,
      workerRepositoryConfidentialityPolicyRequired: true,
      workerTrackedSourceSecretSafetyRequired: true,
      centralAuthenticationSafetyRequired: true,
      boundedCredentialBehaviorRequired: true,
      boundedJsonRequestSafetyRequired: true,
      manualResearchLeaseSafetyRequired: true,
      publicResearchFetchSafetyRequired: true,
      reviewMutationSafetyRequired: true,
      opportunityEvidenceQualityRequired: true,
      opportunityExecutionBoundarySafetyRequired: true,
      businessSafetySuiteRequired: true,
      deterministicCoreBehavioralTestsRequired: true,
      deploymentEnabledByValidation: false,
      errors,
    },
    null,
    2,
  ),
);

if (errors.length) process.exitCode = 1;
