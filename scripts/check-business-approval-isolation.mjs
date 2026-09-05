#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const read = (relativePath) => {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
};
const requireTokens = (relativePath, tokens) => {
  const source = read(relativePath);
  for (const token of tokens) {
    if (!source.includes(token)) errors.push(`${relativePath} missing required safety token: ${token}`);
  }
  return source;
};
const walk = (directory) => fs.existsSync(directory)
  ? fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return walk(absolutePath);
      return entry.isFile() && /\.(ts|mjs)$/.test(entry.name) ? [absolutePath] : [];
    })
  : [];

const recordsPath = "src/core/businessAutopilotRecords.ts";
requireTokens(recordsPath, ["export async function saveBusinessApprovalRequest", "buildBusinessApprovalRequest(input)"]);
const catalogue = requireTokens("src/routes/businessAutopilotRouteCatalogue.ts", [
  '"business_approval_request_save"',
  "disabledBusinessAutopilotWriteRouteIds",
]);
if (/writeRoute\(\s*["']business_approval_request_save["']/.test(catalogue)) {
  errors.push("Route catalogue must not advertise business_approval_request_save as active");
}
requireTokens("src/routes/businessAutopilotAdmin.ts", [
  'error: "historical_record_write_disabled"',
  'mode: "business_approval_request_write_disabled"',
  "{ status: 410 }",
]);

requireTokens("src/core/businessStaffCommunicationApprovalCandidatePersistence.ts", [
  '"evavo-approval-candidate-write-request-v1"', 'actorId: "evavo-worker-agent"',
  'model: "immutable_document_version"', 'vaultId: "internal"',
  "assertNativeStorageBinding", "approvalCandidatePersistenceEvidenceRef",
]);
requireTokens("src/core/businessEvavoStorageApprovalCandidatePort.ts", [
  '"business_evavo_storage_approval_candidate_port_v2"',
  '"/v1/actions/persist_approval_candidate"', "expectedAuthorityId",
  "MAX_APPROVAL_CANDIDATE_REQUEST_BYTES", 'redirect: "error"', 'cache: "no-store"',
]);
requireTokens("src/core/businessBrainMemoryIngestionPort.ts", [
  '"business_brain_memory_ingestion_port_v2"', 'name: "brain_memory_ingest_v2"',
  "scopedWriteToken", "businessHmacSha256", "writerProof",
]);
requireTokens("src/core/businessRelationshipManagerBrainPersistenceRuntime.ts", [
  '"business_relationship_manager_brain_persistence_runtime_v2"',
  "persistCanonicalRelationshipManagerCycleToBrain",
  "RELATIONSHIP_MANAGER_BRAIN_PERSISTENCE_CANONICAL_CONTEXT_NOT_READY",
]);

const previewPath = "src/routes/businessRelationshipManagerAdmin.ts";
const preview = requireTokens(previewPath, [
  'mode: "relationship_manager_caller_supplied_preview"', "canonicalContextBound: false",
  "canonicalApprovalGradeReady: false", "persistenceAllowedFromThisPreview: false",
  "externalExecutionAllowed: false",
]);
if (/persistCanonicalRelationshipManagerCycleToBrain|createBrainMemoryIngestionPort/.test(preview)) {
  errors.push(`${previewPath} must not persist caller-supplied preview cycles`);
}

requireTokens("src/core/businessRelationshipManagerCanonicalRuntime.ts", [
  '"business_relationship_manager_canonical_runtime_v2"', "buildRelationshipDecisionContext",
  "decisionContext.approvalGradeReady", "careersSummary",
]);
requireTokens("src/core/businessRelationshipSourceReadiness.ts", [
  '"business_relationship_source_readiness_v2"', '"careers"', '"provider_unavailable"',
  '"not_queried"', '"not_found"', "absenceAcceptable",
]);
requireTokens("src/core/businessRelationship360Context.ts", [
  '"business_relationship_360_context_v3"', '"careers"', "careersSummary", "Dedicated careers truth",
]);
requireTokens("src/core/businessRelationshipContextFreshness.ts", [
  'domain: "careers"', "maximumAgeMinutes: 60", "staleBlocksApproval: true",
]);
requireTokens("src/core/businessRoleOpeningTruth.ts", [
  '"business_role_opening_truth_v2"', "ROLE_OPENING_OPERATIONS_CORE_AUTHORITY_FORBIDDEN", "maySayNotHiring: false",
]);
const careersPolicy = requireTokens("src/core/businessCareersRelationshipPolicy.ts", [
  '"business_careers_relationship_policy_v3"',
  'input.roleTruth ? input.roleTruth.status === "confirmed_open"',
]);
if (/Boolean\(input\.openRoleConfirmed\)/.test(careersPolicy)) {
  errors.push("Careers policy must not authorize roles from openRoleConfirmed");
}
requireTokens("src/core/businessCareersRoleTruthPort.ts", [
  '"business_careers_role_truth_port_v1"',
  '"/api/v1/internal/relationship-manager/careers-snapshot"',
  'source: "careers_registry"',
]);
requireTokens("src/core/businessRelationshipManagerCanonicalCareersContextRuntime.ts", [
  '"business_relationship_manager_canonical_careers_context_runtime_v3"',
  "careersEvidence", "careersSummary", "RELATIONSHIP_MANAGER_CANONICAL_CAREERS_EVIDENCE_NOT_BOUND",
  "const explicitRoleOpen = roleTruth?.maySayRoleExists === true",
  "candidateRoleAuthorityDerived = true",
  "RELATIONSHIP_MANAGER_CANONICAL_CAREERS_CANDIDATE_ROLE_DERIVATION_MISMATCH",
]);
requireTokens("src/core/businessRelationshipManagerCanonicalSourceHydrationEnv.ts", [
  '"business_relationship_manager_canonical_source_hydration_env_v2"',
  "OPERATIONS_CAREERS_READ_TOKEN", "careersConfigured",
]);

const candidateRuntime = requireTokens("src/core/businessRelationshipManagerCanonicalCandidateRuntime.ts", [
  '"business_relationship_manager_canonical_candidate_runtime_v3"',
  'scenario !== "graduate_or_candidate"', "careersRequired: true",
  "explicitRoleOpen: false", "activeRecruitmentProcess: false",
  "callerOpportunityAuthoritySuppressed: true",
  "RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_OPPORTUNITY_AUTHORITY_NOT_BACKED_BY_CAREERS",
  "RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_OPEN_ROLE_NOT_PROPAGATED",
  "relevantRoleConfirmed: Boolean(roleTruth?.maySayRoleExists)",
]);
if (/openRoleConfirmed\s*:/.test(candidateRuntime) || /input\.candidate\.relevantRoleConfirmed/.test(candidateRuntime)) {
  errors.push("Canonical candidate runtime must derive role relevance from careers truth, never caller opportunity flags");
}

requireTokens("src/core/businessRelationshipManagerCanonicalApprovalRuntime.ts", [
  '"business_relationship_manager_canonical_approval_runtime_v5"',
  "assertCanonicalRelationshipManagerApprovalReadiness",
  "assertCanonicalRelationshipManagerDraftBinding",
  "RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_CONTEXT_CHANGED_AFTER_DRAFT",
  "RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_SOURCE_CONTEXT_CHANGED_AFTER_DRAFT",
  "RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_CANDIDATE_SPECIALIZED_RUNTIME_REQUIRED",
  'scenario === "graduate_or_candidate"',
]);
const candidateApproval = requireTokens("src/core/businessRelationshipManagerCanonicalCandidateApprovalRuntime.ts", [
  '"business_relationship_manager_canonical_candidate_approval_runtime_v4"',
  "runCanonicalRelationshipManagerCandidateResponse",
  "candidateRuntimeInput", "assertCanonicalRelationshipManagerApprovalReadiness",
  "assertCanonicalRelationshipManagerDraftBinding",
  "candidatePolicyEvidenceRef", "reviewCandidateDraftAgainstPolicy",
  "freshDraftContextBound: true",
  "RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_DRAFT_POLICY_BLOCKED",
  "prepareRelationshipManagerCommunicationForApproval",
]);
if (/candidateResult\s*:/.test(candidateApproval)) {
  errors.push("Specialized candidate approval must rehydrate, not accept caller-supplied candidateResult");
}
requireTokens("tests/businessRelationshipManagerCanonicalApprovalCandidateBinding.test.ts", [
  "generic canonical approval refuses every candidate cycle and requires the specialized runtime",
  "CANDIDATE_SPECIALIZED_RUNTIME_REQUIRED",
]);
requireTokens("tests/businessRelationshipManagerCanonicalCandidateRuntime.test.ts", [
  "caller role and recruitment flags cannot bypass unavailable canonical careers truth",
  "callerOpportunityAuthoritySuppressed",
]);
requireTokens("tests/businessRelationshipManagerCanonicalCandidateOpenRole.test.ts", [
  "verified careers opening derives active_process and role referral authority",
  'candidateStage, "active_process"',
  "candidateRoleAuthorityDerived",
]);
requireTokens("tests/businessRelationshipManagerCanonicalDraftBinding.test.ts", [
  "new or removed source evidence after drafting forces regeneration",
  "SOURCE_CONTEXT_CHANGED_AFTER_DRAFT",
  "CONTEXT_CHANGED_AFTER_DRAFT",
]);

const approvalRuntime = requireTokens("src/core/businessRelationshipManagerApprovalRuntime.ts", [
  "readyForCandidatePersistence: true", "readyForHumanApproval: false",
  "approvalCandidatePersistenceEvidenceRef",
]);
if (!approvalRuntime.includes("externalExecutionAllowed: false")) {
  errors.push("Approval runtime must remain non-executable");
}

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
  contract: "business-approval-storage-isolation-v13",
  callerSuppliedPreviewCannotPersist: true,
  canonicalCareersTruthRequired: true,
  candidateRoleAuthorityDerivedByCareers: true,
  callerOpportunityAuthoritySuppressed: true,
  openRolePropagatesOnlyFromCareersTruth: true,
  genericCandidateApprovalRejected: true,
  specializedCandidateApprovalRehydratesSources: true,
  freshDraftSourceContextRequired: true,
  candidatePolicyEvidenceRequired: true,
  candidateDraftPolicyReviewRequired: true,
  approvalCandidatePersistenceRequired: true,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
