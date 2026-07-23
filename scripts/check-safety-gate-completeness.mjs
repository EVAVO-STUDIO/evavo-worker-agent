#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const packagePath = path.join(root, "package.json");

if (!fs.existsSync(packagePath)) {
  errors.push("Missing package.json");
}

const packageJson = fs.existsSync(packagePath)
  ? JSON.parse(fs.readFileSync(packagePath, "utf8"))
  : {};
const scripts = packageJson.scripts || {};
const checkLocal = String(scripts["check:local"] || "");

const requiredSafetyCommands = {
  "growth:generated-routes:check": "node scripts/check-generated-route-wiring-clean.mjs",
  "docs:operating-posture:check": "node scripts/check-readme-operating-posture.mjs",
  "docs:readme-truthfulness:check": "node scripts/check-readme-top-level-truthfulness.mjs",
  "business:approval-isolation:check": "node scripts/check-business-approval-isolation.mjs",
  "business:audit-pack-response-minimisation:check": "node scripts/check-business-audit-pack-response-minimisation.mjs",
  "business:autopilot:check": "node scripts/check-business-autopilot.mjs",
  "business:autopilot:raw-error-safety:check": "node scripts/check-business-autopilot-raw-error-safety.mjs",
  "business:ci-parity:check": "node scripts/check-business-ci-parity.mjs",
  "business:draft-runtime-safety:check": "node scripts/check-business-draft-runtime-safety.mjs",
  "business:execution-level-truthfulness:check": "node scripts/check-business-execution-level-truthfulness.mjs",
  "business:historical-read-minimisation:check": "node scripts/check-business-historical-read-minimisation.mjs",
  "business:historical-record-posture:check": "node scripts/check-business-historical-record-posture.mjs",
  "business:historical-type-isolation:check": "node scripts/check-business-historical-type-isolation.mjs",
  "business:internal-planning-safety:check": "node scripts/check-business-internal-planning-safety.mjs",
  "business:internal-read-minimisation:check": "node scripts/check-business-internal-read-minimisation.mjs",
  "business:opportunity-review-safety:check": "node scripts/check-business-opportunity-review-safety.mjs",
  "business:people-response-minimisation:check": "node scripts/check-business-people-response-minimisation.mjs",
  "business:record-builder-safety:check": "node scripts/check-business-record-builder-safety.mjs",
  "business:review-record-storage-isolation:check": "node scripts/check-business-review-record-storage-isolation.mjs",
  "business:route-policy:check": "node scripts/check-business-route-policy.mjs",
  "business:validation-workflow-safety:check": "node scripts/check-business-validation-workflow-safety.mjs",
  "business:route-catalogue-truthfulness:check": "node scripts/check-business-route-catalogue-truthfulness.mjs",
  "planner:catalogue-truthfulness:check": "node scripts/check-planner-catalogue-truthfulness.mjs",
  "admin:broad-read-truthfulness:check": "node scripts/check-broad-admin-read-truthfulness.mjs",
  "admin:broad-write-safety:check": "node scripts/check-broad-admin-write-safety.mjs",
  "admin:reporting-truthfulness:check": "node scripts/check-admin-reporting-truthfulness.mjs",
  "admin:schema-safety:check": "node scripts/check-admin-schema-safety.mjs",
  "autonomy:capability-truthfulness:check": "node scripts/check-autonomy-capability-truthfulness.mjs",
  "sources:confirmation-safety:check": "node scripts/check-source-action-confirmation-safety.mjs",
  "opportunities:execution-boundary-safety:check": "node scripts/check-opportunity-execution-boundary-safety.mjs",
  "growth:subhandler-auth-safety:check": "node scripts/check-growth-subhandler-auth-safety.mjs",
  "worker:central-auth-safety:check": "node scripts/check-central-authentication-safety.mjs",
  "worker:package-identity:check": "node scripts/check-package-service-identity.mjs",
  "worker:workflow-action-pinning:check": "node scripts/check-workflow-action-pinning.mjs",
};

for (const [scriptName, expectedCommand] of Object.entries(requiredSafetyCommands)) {
  if (scripts[scriptName] !== expectedCommand) {
    errors.push(`package.json must expose ${scriptName} as ${expectedCommand}`);
  }
  if (!checkLocal.includes(`npm run ${scriptName}`)) {
    errors.push(`check:local must include ${scriptName}`);
  }
}

for (const relativePath of [
  "scripts/check-generated-route-wiring-clean.mjs",
  "scripts/check-readme-operating-posture.mjs",
  "scripts/check-readme-top-level-truthfulness.mjs",
  "scripts/check-business-approval-isolation.mjs",
  "scripts/check-business-audit-pack-response-minimisation.mjs",
  "scripts/check-business-autopilot.mjs",
  "scripts/check-business-autopilot-raw-error-safety.mjs",
  "scripts/check-business-ci-parity.mjs",
  "scripts/check-business-draft-runtime-safety.mjs",
  "scripts/check-business-execution-level-truthfulness.mjs",
  "scripts/check-business-historical-read-minimisation.mjs",
  "scripts/check-business-historical-record-posture.mjs",
  "scripts/check-business-historical-type-isolation.mjs",
  "scripts/check-business-internal-planning-safety.mjs",
  "scripts/check-business-internal-read-minimisation.mjs",
  "scripts/check-business-opportunity-review-safety.mjs",
  "scripts/check-business-people-response-minimisation.mjs",
  "scripts/check-business-record-builder-safety.mjs",
  "scripts/check-business-review-record-storage-isolation.mjs",
  "scripts/check-business-route-policy.mjs",
  "scripts/check-business-validation-workflow-safety.mjs",
  "scripts/check-business-route-catalogue-truthfulness.mjs",
  "scripts/check-planner-catalogue-truthfulness.mjs",
  "scripts/check-broad-admin-read-truthfulness.mjs",
  "scripts/check-broad-admin-write-safety.mjs",
  "scripts/check-admin-reporting-truthfulness.mjs",
  "scripts/check-admin-schema-safety.mjs",
  "scripts/check-autonomy-capability-truthfulness.mjs",
  "scripts/check-source-action-confirmation-safety.mjs",
  "scripts/check-opportunity-execution-boundary-safety.mjs",
  "scripts/check-growth-subhandler-auth-safety.mjs",
  "scripts/check-central-authentication-safety.mjs",
  "scripts/check-package-service-identity.mjs",
  "scripts/check-workflow-action-pinning.mjs",
]) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    errors.push(`Missing safety contract: ${relativePath}`);
  }
}

if (!String(scripts.predeploy || "").includes("npm run check:local")) {
  errors.push("predeploy must run the complete check:local gate");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "safety-gate-completeness",
  generatedRouteIntegrityRequired: true,
  readmeOperatingPostureRequired: true,
  readmeTopLevelTruthfulnessRequired: true,
  businessApprovalIsolationRequired: true,
  businessAuditPackResponseMinimisationRequired: true,
  businessAutopilotFoundationRequired: true,
  businessAutopilotRawErrorSafetyRequired: true,
  businessCiParityRequired: true,
  businessDraftRuntimeSafetyRequired: true,
  businessExecutionLevelTruthfulnessRequired: true,
  businessHistoricalReadMinimisationRequired: true,
  businessHistoricalRecordPostureRequired: true,
  businessHistoricalTypeIsolationRequired: true,
  businessInternalPlanningSafetyRequired: true,
  businessInternalReadMinimisationRequired: true,
  businessOpportunityReviewSafetyRequired: true,
  businessPeopleResponseMinimisationRequired: true,
  businessRecordBuilderSafetyRequired: true,
  businessReviewRecordStorageIsolationRequired: true,
  businessRoutePolicyRequired: true,
  businessValidationWorkflowSafetyRequired: true,
  businessRouteCatalogueTruthfulnessRequired: true,
  plannerCatalogueTruthfulnessRequired: true,
  broadAdminReadTruthfulnessRequired: true,
  broadAdminWriteSafetyRequired: true,
  adminReportingTruthfulnessRequired: true,
  authenticatedSchemaSafetyRequired: true,
  autonomyCapabilityTruthfulnessRequired: true,
  sourceConfirmationSafetyRequired: true,
  opportunityExecutionBoundarySafetyRequired: true,
  growthSubhandlerAuthenticationSafetyRequired: true,
  centralAuthenticationSafetyRequired: true,
  packageServiceIdentityRequired: true,
  workflowActionPinningRequired: true,
  predeployUsesCompleteLocalGate: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
