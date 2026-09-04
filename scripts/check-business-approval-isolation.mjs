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

function requireTokens(relativePath, tokens) {
  const source = read(relativePath);
  for (const token of tokens) {
    if (!source.includes(token)) errors.push(`${relativePath} missing required safety token: ${token}`);
  }
  return source;
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolutePath);
    return entry.isFile() && /\.(ts|mjs)$/.test(entry.name) ? [absolutePath] : [];
  });
}

const recordsPath = "src/core/businessAutopilotRecords.ts";
const records = requireTokens(recordsPath, [
  "export async function saveBusinessApprovalRequest",
  "buildBusinessApprovalRequest(input)",
]);
const route = requireTokens("src/routes/businessAutopilotAdmin.ts", [
  'error: "historical_record_write_disabled"',
  'mode: "business_approval_request_write_disabled"',
  "{ status: 410 }",
]);
const catalogue = requireTokens("src/routes/businessAutopilotRouteCatalogue.ts", [
  '"business_approval_request_save"',
  "disabledBusinessAutopilotWriteRouteIds",
]);
if (/writeRoute\(\s*["']business_approval_request_save["']/.test(catalogue)) {
  errors.push("Route catalogue must not advertise business_approval_request_save as an active write route");
}

requireTokens("src/core/businessStaffCommunicationApprovalCandidatePersistence.ts", [
  '"evavo-approval-candidate-write-request-v1"',
  'actorId: "evavo-worker-agent"',
  'model: "immutable_document_version"',
  'vaultId: "internal"',
  "assertNativeStorageBinding",
  "approvalCandidatePersistenceEvidenceRef",
  "reconcileStaffApprovalCandidateWriteReceipt",
]);
requireTokens("src/core/businessEvavoStorageApprovalCandidatePort.ts", [
  '"business_evavo_storage_approval_candidate_port_v2"',
  '"/v1/actions/persist_approval_candidate"',
  '"Authorization": `Bearer ${writeToken}`',
  "expectedAuthorityId",
  "AUTHORITY_MISMATCH",
  "MAX_APPROVAL_CANDIDATE_REQUEST_BYTES",
  'redirect: "error"',
  'cache: "no-store"',
]);
requireTokens("src/core/businessBrainMemoryIngestionPort.ts", [
  '"business_brain_memory_ingestion_port_v2"',
  'name: "brain_memory_ingest_v2"',
  'autonomy: "auto_low_risk"',
  "scopedWriteToken",
  "businessHmacSha256",
  "writerProof",
]);
requireTokens("src/core/businessBrainMemoryIngestionEnv.ts", [
  "BRAIN_BASE_URL",
  "BRAIN_API_TOKEN",
  "BRAIN_RELATIONSHIP_MEMORY_WRITE_TOKEN",
  "requireBrainMemoryIngestionPortFromEnv",
]);
requireTokens("src/core/businessRelationshipManagerBrainPersistenceRuntime.ts", [
  '"business_relationship_manager_brain_persistence_runtime_v2"',
  "CanonicalRelationshipManagerCycle",
  "persistCanonicalRelationshipManagerCycleToBrain",
  "RELATIONSHIP_MANAGER_BRAIN_PERSISTENCE_CANONICAL_CONTEXT_NOT_READY",
]);
requireTokens("src/core/businessRelationshipManagerCanonicalMemoryPersistence.ts", [
  '"business_relationship_manager_canonical_memory_persistence_v2"',
  "persistCanonicalRelationshipManagerCycleToBrain",
  "RELATIONSHIP_MANAGER_CANONICAL_MEMORY_NOT_DURABLE",
]);

const previewPath = "src/routes/businessRelationshipManagerAdmin.ts";
const preview = requireTokens(previewPath, [
  'mode: "relationship_manager_caller_supplied_preview"',
  "canonicalContextBound: false",
  "canonicalApprovalGradeReady: false",
  "persistenceAllowedFromThisPreview: false",
  "externalExecutionAllowed: false",
]);
if (/persistCanonicalRelationshipManagerCycleToBrain|requireBrainMemoryIngestionPortFromEnv|createBrainMemoryIngestionPort/.test(preview)) {
  errors.push(`${previewPath} must not persist caller-supplied preview cycles to Brain`);
}

for (const relativePath of [
  "src/core/businessRelationshipManagerApprovalRuntime.ts",
  "src/core/businessStaffCommunicationApprovalFinalizer.ts",
]) {
  requireTokens(relativePath, ["approvalCandidatePersistenceEvidenceRef"]);
}
const approvalRuntime = read("src/core/businessRelationshipManagerApprovalRuntime.ts");
if (!approvalRuntime.includes("readyForCandidatePersistence: true") || !approvalRuntime.includes("readyForHumanApproval: false")) {
  errors.push("Prepared Relationship Manager candidates must remain non-approvable until persistence");
}

requireTokens("src/core/businessRelationshipManagerCanonicalRuntime.ts", [
  '"business_relationship_manager_canonical_runtime_v2"',
  "buildRelationshipDecisionContext",
  "decisionContext.approvalGradeReady",
  "careersSummary",
]);
requireTokens("src/core/businessRelationshipDecisionContext.ts", [
  '"business_relationship_decision_context_v3"',
  "sourceReadiness",
  "approvalGradeReady",
]);
requireTokens("src/core/businessRelationshipSourceReadiness.ts", [
  '"business_relationship_source_readiness_v2"',
  '"careers"',
  '"provider_unavailable"',
  '"not_queried"',
  '"not_found"',
  "absenceAcceptable",
]);
requireTokens("src/core/businessRelationship360Context.ts", [
  '"business_relationship_360_context_v3"',
  '"careers"',
  "careersSummary",
  "Dedicated careers truth",
]);
requireTokens("src/core/businessRelationshipContextFreshness.ts", [
  'domain: "careers"',
  "maximumAgeMinutes: 60",
  "staleBlocksApproval: true",
]);
requireTokens("src/core/businessRelationshipStaffBrief.ts", [
  "context.careers",
  "dedicated careers truth",
  "Do not infer pricing, scope, payment or contract authority",
]);
requireTokens("src/core/businessRoleOpeningTruth.ts", [
  '"business_role_opening_truth_v2"',
  "ROLE_OPENING_OPERATIONS_CORE_AUTHORITY_FORBIDDEN",
  "maySayNotHiring: false",
]);
const careersPolicy = requireTokens("src/core/businessCareersRelationshipPolicy.ts", [
  '"business_careers_relationship_policy_v3"',
  "input.roleTruth ? input.roleTruth.status === \"confirmed_open\"",
]);
if (/Boolean\(input\.openRoleConfirmed\)/.test(careersPolicy)) {
  errors.push("Careers policy must not authorize a role from caller-supplied openRoleConfirmed");
}

requireTokens("src/core/businessCareersRoleTruthPort.ts", [
  '"business_careers_role_truth_port_v1"',
  '"/api/v1/internal/relationship-manager/careers-snapshot"',
  "roleOpeningEvidenceFromCareersSnapshot",
  'source: "careers_registry"',
]);
requireTokens("src/core/businessRelationshipManagerCanonicalCareersContextRuntime.ts", [
  '"business_relationship_manager_canonical_careers_context_runtime_v2"',
  "careersEvidence",
  "careersSummary",
  "RELATIONSHIP_MANAGER_CANONICAL_CAREERS_EVIDENCE_NOT_BOUND",
]);
requireTokens("src/core/businessRelationshipManagerCanonicalSourceHydrationEnv.ts", [
  '"business_relationship_manager_canonical_source_hydration_env_v2"',
  "OPERATIONS_CAREERS_READ_TOKEN",
  "careersConfigured",
  "runCanonicalRelationshipManagerCycleWithCareersContext",
]);
const candidateRuntime = requireTokens("src/core/businessRelationshipManagerCanonicalCandidateRuntime.ts", [
  '"business_relationship_manager_canonical_candidate_runtime_v1"',
  "runCanonicalRelationshipManagerCycleWithSourcesFromEnv",
  "careersRequired: true",
  "roleTruth: sources.cycle.roleTruth",
  "RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_REFERRAL_WITHOUT_ROLE_TRUTH",
  "RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_MEETING_WITHOUT_ROLE_TRUTH",
]);
if (/openRoleConfirmed\s*:/.test(candidateRuntime)) {
  errors.push("Canonical candidate runtime must not pass caller-supplied openRoleConfirmed into careers policy");
}

requireTokens("src/core/businessRelationshipManagerCanonicalApprovalRuntime.ts", [
  '"business_relationship_manager_canonical_approval_runtime_v1"',
  "RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_CONTEXT_NOT_READY",
  "prepareRelationshipManagerCommunicationForApproval",
]);

const allowedDefinition = path.join(root, recordsPath);
for (const absolutePath of walk(path.join(root, "src"))) {
  if (absolutePath === allowedDefinition) continue;
  const source = fs.readFileSync(absolutePath, "utf8");
  if (/\bsaveBusinessApprovalRequest\b/.test(source)) {
    errors.push(`${path.relative(root, absolutePath)} must not import or invoke saveBusinessApprovalRequest`);
  }
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "business-approval-storage-isolation-v7",
  historicalStorageHelperRetained: true,
  directApprovalWriteRouteEnabled: false,
  governedApprovalCandidatePersistence: true,
  concreteEvavoStoragePortRequired: true,
  scopedBrainMemoryHmacRequired: true,
  canonicalBrainCheckpointRequiredByPreferredPath: true,
  callerSuppliedPreviewCannotPersist: true,
  canonicalDecisionContextV2Required: true,
  sourceReadinessV2Required: true,
  careersIsIndependentCanonicalSource: true,
  commercialStateCannotAuthorizeHiring: true,
  manualRoleFlagsCannotAuthorizeHiring: true,
  canonicalCandidateRuntimeRequired: true,
  careersEvidenceMustBindThroughDecision: true,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
