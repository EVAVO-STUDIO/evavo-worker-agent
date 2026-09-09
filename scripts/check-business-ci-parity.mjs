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

const requiredBusinessContracts = Object.freeze({
  "business:approval-isolation:check":
    "node scripts/check-business-approval-isolation.mjs",
  "business:audit-pack-response-minimisation:check":
    "node scripts/check-business-audit-pack-response-minimisation.mjs",
  "business:autopilot:check": "node scripts/check-business-autopilot.mjs",
  "business:autopilot:raw-error-safety:check":
    "node scripts/check-business-autopilot-raw-error-safety.mjs",
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
  "business:score-provenance:check":
    "node scripts/check-business-score-provenance.mjs",
  "business:suppression-integrity:check":
    "node scripts/check-business-suppression-integrity.mjs",
  "business:validation-workflow-safety:check":
    "node scripts/check-business-validation-workflow-safety.mjs",
  "business:route-catalogue-truthfulness:check":
    "node scripts/check-business-route-catalogue-truthfulness.mjs",
  "business:route-policy:check": "node scripts/check-business-route-policy.mjs",
});

if (!fs.existsSync(packagePath)) errors.push("Missing package.json.");

for (const [scriptName, command] of Object.entries(requiredBusinessContracts)) {
  if (scripts[scriptName] !== command) {
    errors.push(`package.json must expose ${scriptName} as ${command}`);
  }
  if (!checkLocal.includes(`npm run ${scriptName}`)) {
    errors.push(`check:local must include ${scriptName}`);
  }
  const match = command.match(/^node\s+(.+)$/u);
  if (match && !fs.existsSync(path.join(root, match[1]))) {
    errors.push(`Missing business safety checker: ${match[1]}`);
  }
}

if (
  scripts["business:ci-parity:check"] !==
  "node scripts/check-business-ci-parity.mjs"
) {
  errors.push(
    "package.json must retain business:ci-parity:check as the compatibility name for local business-gate parity.",
  );
}
if (!checkLocal.includes("npm run business:ci-parity:check")) {
  errors.push("check:local must include business:ci-parity:check");
}
if (!checkLocal.includes("npm run worker:workflow-action-pinning:check")) {
  errors.push(
    "check:local must also enforce the repository hosted-execution policy.",
  );
}

console.log(
  JSON.stringify(
    {
      passed: errors.length === 0,
      activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
      contract: "business-local-gate-parity-v1",
      compatibilityScriptNameRetained: true,
      githubActionsRequired: false,
      hostedRunnerRequired: false,
      completeLocalGateRequired: true,
      businessSafetyContractCount: Object.keys(requiredBusinessContracts).length,
      businessApprovalIsolationRequired: true,
      businessReviewRecordStorageIsolationRequired: true,
      businessDraftRuntimeSafetyRequired: true,
      businessExecutionLevelTruthfulnessRequired: true,
      businessHistoricalReadMinimisationRequired: true,
      businessHistoricalRecordPostureRequired: true,
      businessHistoricalTypeIsolationRequired: true,
      businessInternalPlanningSafetyRequired: true,
      businessInternalReadMinimisationRequired: true,
      businessLearningEventSafetyRequired: true,
      businessOpportunityReviewSafetyRequired: true,
      businessPeopleResponseMinimisationRequired: true,
      businessScoreProvenanceRequired: true,
      businessSuppressionIntegrityRequired: true,
      businessRouteCatalogueTruthfulnessRequired: true,
      externalExecutionEnabled: false,
      errors,
    },
    null,
    2,
  ),
);

if (errors.length) process.exitCode = 1;
