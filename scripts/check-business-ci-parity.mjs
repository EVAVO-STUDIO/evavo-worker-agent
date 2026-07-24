#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

const workflow = read(".github/workflows/worker-contract.yml");
const packageJson = JSON.parse(read("package.json") || "{}");
const generalParity = read("scripts/check-worker-contract-workflow.mjs");
const routePolicy = read("scripts/check-business-route-policy.mjs");
const routeCatalogueTruthfulness = read("scripts/check-business-route-catalogue-truthfulness.mjs");
const approvalIsolation = read("scripts/check-business-approval-isolation.mjs");
const reviewRecordIsolation = read("scripts/check-business-review-record-storage-isolation.mjs");
const opportunityReviewSafety = read("scripts/check-business-opportunity-review-safety.mjs");
const peopleResponseMinimisation = read("scripts/check-business-people-response-minimisation.mjs");
const internalReadMinimisation = read("scripts/check-business-internal-read-minimisation.mjs");
const learningEventSafety = read("scripts/check-business-learning-event-safety.mjs");
const suppressionIntegrity = read("scripts/check-business-suppression-integrity.mjs");
const historicalReadMinimisation = read("scripts/check-business-historical-read-minimisation.mjs");
const scripts = packageJson.scripts || {};
const checkLocal = String(scripts["check:local"] || "");

const requiredBusinessContracts = {
  "business:approval-isolation:check": "node scripts/check-business-approval-isolation.mjs",
  "business:audit-pack-response-minimisation:check": "node scripts/check-business-audit-pack-response-minimisation.mjs",
  "business:autopilot:check": "node scripts/check-business-autopilot.mjs",
  "business:autopilot:raw-error-safety:check": "node scripts/check-business-autopilot-raw-error-safety.mjs",
  "business:draft-runtime-safety:check": "node scripts/check-business-draft-runtime-safety.mjs",
  "business:execution-level-truthfulness:check": "node scripts/check-business-execution-level-truthfulness.mjs",
  "business:historical-read-minimisation:check": "node scripts/check-business-historical-read-minimisation.mjs",
  "business:historical-record-posture:check": "node scripts/check-business-historical-record-posture.mjs",
  "business:historical-type-isolation:check": "node scripts/check-business-historical-type-isolation.mjs",
  "business:internal-planning-safety:check": "node scripts/check-business-internal-planning-safety.mjs",
  "business:internal-read-minimisation:check": "node scripts/check-business-internal-read-minimisation.mjs",
  "business:learning-event-safety:check": "node scripts/check-business-learning-event-safety.mjs",
  "business:opportunity-review-safety:check": "node scripts/check-business-opportunity-review-safety.mjs",
  "business:people-response-minimisation:check": "node scripts/check-business-people-response-minimisation.mjs",
  "business:record-builder-safety:check": "node scripts/check-business-record-builder-safety.mjs",
  "business:review-record-storage-isolation:check": "node scripts/check-business-review-record-storage-isolation.mjs",
  "business:suppression-integrity:check": "node scripts/check-business-suppression-integrity.mjs",
  "business:validation-workflow-safety:check": "node scripts/check-business-validation-workflow-safety.mjs",
  "business:route-catalogue-truthfulness:check": "node scripts/check-business-route-catalogue-truthfulness.mjs",
  "business:route-policy:check": "node scripts/check-business-route-policy.mjs",
};

for (const [scriptName, expectedCommand] of Object.entries(requiredBusinessContracts)) {
  if (scripts[scriptName] !== expectedCommand) errors.push(`package.json must expose ${scriptName} as ${expectedCommand}`);
  if (!checkLocal.includes(`npm run ${scriptName}`)) errors.push(`check:local must include ${scriptName}`);
}

for (const token of [
  "npm ci --no-audit --no-fund",
  "npm run check:local",
  '      - "src/**"',
  '      - "scripts/**"',
  '      - "docs/**"',
  '      - "migrations/**"',
  '      - "README.md"',
  '      - "**/*.ps1"',
  '      - "package.json"',
  '      - "package-lock.json"',
]) {
  if (!workflow.includes(token)) errors.push(`Worker contract workflow is missing: ${token}`);
}

if (workflow.includes("wrangler deploy")) errors.push("Worker contract workflow must not deploy");
if (workflow.includes("ADMIN_TOKEN")) errors.push("Worker contract workflow must not request runtime credentials");

for (const token of [
  'contract: "worker-ci-workflow-parity"',
  'safetyGateCompletenessRequired: true',
  'typedRoutePoliciesRequired: true',
  'historicalStatusesExecutable: false',
]) {
  if (!generalParity.includes(token)) errors.push(`General Worker CI parity checker is missing: ${token}`);
}

for (const token of [
  'contract: "typed-business-route-policy-v2-historical-explicit"',
  'historicalRouteGroupExplicit: true',
  'historicalReadsOnly: true',
  'retiredHistoricalWritesFailClosed: true',
  'historicalGroupPrecedesFallback: true',
  'externalExecutionEnabled: false',
]) {
  if (!routePolicy.includes(token)) errors.push(`Business route-policy checker is missing CI-required posture: ${token}`);
}

for (const token of [
  'contract: "business-route-catalogue-truthfulness-v10-full-historical-posture"',
  'plannerBusinessImportCountExpected: 1',
  'plannerBusinessSpreadCountExpected: 1',
  'catalogueApplyScriptIdempotent: true',
  'catalogueApplyScriptValidatesPostureBeforeWrite: true',
  'catalogueApplyScriptBlocksRetiredRouteIds: true',
  'historicalReadsUseDedicatedCataloguePosture: true',
  'historicalReadsRecommendedInOperationsHub: false',
  'historicalReadVerificationChecksCompletePosture: true',
  'historicalReadSmokeChecksCompletePosture: true',
  'historicalReviewWriteUsesDedicatedCataloguePosture: true',
  'historicalReviewWriteRecommendedInOperationsHub: false',
  'disabledDirectDraftWriteAdvertised: false',
  'disabledApprovalWriteAdvertised: false',
  'retiredWriteEndpointsExpectedStatus: 410',
  'deployedRetiredWriteChecksRequired: true',
]) {
  if (!routeCatalogueTruthfulness.includes(token)) errors.push(`Business route-catalogue truthfulness checker is missing CI-required posture: ${token}`);
}

for (const token of [
  'contract: "business-historical-read-minimisation-v2-full-posture"',
  'historicalReadsReviewOnly: true',
  'historicalReadsExecutable: false',
  'historicalReadsDeliverable: false',
  'historicalReadsAuthoritativeForExecution: false',
  'historicalReadsExternalExecutionAllowed: false',
]) {
  if (!historicalReadMinimisation.includes(token)) errors.push(`Business historical-read minimisation checker is missing CI-required posture: ${token}`);
}

for (const token of [
  'contract: "business-approval-storage-isolation-v1"',
  'runtimeImportsAllowed: false',
  'directApprovalWriteRouteEnabled: false',
  'retiredRouteExpectedStatus: 410',
  'externalExecutionEnabled: false',
]) {
  if (!approvalIsolation.includes(token)) errors.push(`Business approval-isolation checker is missing CI-required posture: ${token}`);
}

for (const token of [
  'contract: "business-review-record-storage-isolation-v2-redacted-reads"',
  'storageDefinitionAllowed: true',
  'guardedCompatibilityRouteAllowed: true',
  'otherRuntimeImportsAllowed: false',
  'historicalDeliverableContentReturned: false',
  'historicalContentRedactionRequired: true',
  'deliverableDraftGenerationEnabled: false',
  'approvalToExecutionEnabled: false',
  'externalExecutionEnabled: false',
]) {
  if (!reviewRecordIsolation.includes(token)) errors.push(`Business review-record isolation checker is missing CI-required posture: ${token}`);
}

for (const token of [
  'contract: "business-opportunity-review-safety-v1-internal-only"',
  'opportunityRecommendationsInternalOnly: true',
  'auditPackStatus: "needs_review"',
  'auditPacksDeliverable: false',
  'approvalCanEnableExternalAction: false',
  'outreachRecommendationEnabled: false',
  'externalExecutionEnabled: false',
]) {
  if (!opportunityReviewSafety.includes(token)) errors.push(`Business opportunity-review safety checker is missing CI-required posture: ${token}`);
}

for (const token of [
  'contract: "business-people-response-minimisation-v1"',
  'storageCompatibilityPreserved: true',
  'rawEmailReturned: false',
  'rawPhoneReturned: false',
  'rawProfileUrlReturned: false',
  'rawSourceUrlReturned: false',
  'arbitraryMetadataReturned: false',
  'presenceFlagsReturned: true',
  'internalReviewOnly: true',
  'externalExecutionEnabled: false',
]) {
  if (!peopleResponseMinimisation.includes(token)) errors.push(`Business people-response minimisation checker is missing CI-required posture: ${token}`);
}

for (const token of [
  'contract: "business-internal-read-minimisation-v1"',
  'contentIdeaMetadataExposed: false',
  'contentIdeaSourceIdsExposed: false',
  'followupNotesExposed: false',
  'followupPersonLinksExposed: false',
  'followupDraftLinksExposed: false',
  'learningNotesExposed: false',
  'learningMetadataExposed: false',
  'externalExecutionEnabled: false',
]) {
  if (!internalReadMinimisation.includes(token)) errors.push(`Business internal-read minimisation checker is missing CI-required posture: ${token}`);
}

for (const token of [
  "contract: 'business-learning-event-safety-v1'",
  'eventTypeForcedToOperatorFeedback: true',
  'entityTypesAllowlisted: true',
  'outcomesAllowlisted: true',
  'scoreDeltaMinimum: -10',
  'scoreDeltaMaximum: 10',
  'callerRequestedValuesNonAuthoritative: true',
  'reviewOnly: true',
  'externalExecutionEnabled: false',
]) {
  if (!learningEventSafety.includes(token)) errors.push(`Business learning-event safety checker is missing CI-required posture: ${token}`);
}

for (const token of [
  "contract: 'business-suppression-integrity-v2'",
  'suppressionWritesForcedActive: true',
  'automaticSuppressionExpiryAllowed: false',
  'arbitrarySuppressionScopeAllowed: false',
  'arbitrarySuppressionReasonAllowed: false',
  'outboundExecutionEnabled: false',
]) {
  if (!suppressionIntegrity.includes(token)) errors.push(`Business suppression-integrity checker is missing CI-required posture: ${token}`);
}

const expectedSelfCommand = "node scripts/check-business-ci-parity.mjs";
if (scripts["business:ci-parity:check"] !== expectedSelfCommand) errors.push(`package.json must expose business:ci-parity:check as ${expectedSelfCommand}`);
if (!checkLocal.includes("npm run business:ci-parity:check")) errors.push("check:local must include business:ci-parity:check");

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "business-worker-ci-parity-v14-full-historical-posture",
  workflowRunsCompleteLocalGate: true,
  documentationChangesTriggerWorkflow: true,
  migrationChangesTriggerWorkflow: true,
  readmeChangesTriggerWorkflow: true,
  powershellRunnerChangesTriggerWorkflow: true,
  businessApprovalIsolationRequired: true,
  businessAuditPackResponseMinimisationRequired: true,
  businessAutopilotRawErrorSafetyRequired: true,
  businessReviewRecordStorageIsolationRequired: true,
  businessDraftRuntimeSafetyRequired: true,
  businessExecutionLevelTruthfulnessRequired: true,
  businessHistoricalReadMinimisationRequired: true,
  businessHistoricalRecordPostureRequired: true,
  businessHistoricalTypeIsolationRequired: true,
  businessHistoricalRoutePolicyRequired: true,
  historicalRouteGroupExplicit: true,
  historicalGroupPrecedesFallback: true,
  retiredHistoricalWritesFailClosed: true,
  businessInternalPlanningSafetyRequired: true,
  businessInternalReadMinimisationRequired: true,
  businessLearningEventSafetyRequired: true,
  businessOpportunityReviewSafetyRequired: true,
  businessPeopleResponseMinimisationRequired: true,
  businessRecordBuilderSafetyRequired: true,
  businessSuppressionIntegrityRequired: true,
  businessValidationWorkflowSafetyRequired: true,
  businessRouteCatalogueTruthfulnessRequired: true,
  businessRouteCatalogueImportCountExpected: 1,
  businessRouteCatalogueSpreadCountExpected: 1,
  businessRouteCatalogueGeneratorIdempotencyRequired: true,
  historicalReadCompletePostureRequired: true,
  retiredBusinessWritesExpectedStatus: 410,
  deploymentEnabled: false,
  credentialsRequired: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;