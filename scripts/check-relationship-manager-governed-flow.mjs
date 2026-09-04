import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const files = {
  admin: "src/routes/businessRelationshipManagerAdmin.ts",
  candidateRuntime: "src/core/businessRelationshipManagerCanonicalCandidateRuntime.ts",
  candidateApproval: "src/core/businessRelationshipManagerCanonicalCandidateApprovalRuntime.ts",
  canonicalApproval: "src/core/businessRelationshipManagerCanonicalApprovalRuntime.ts",
  careersPolicy: "src/core/businessCareersRelationshipPolicy.ts",
  careersRuntime: "src/core/businessRelationshipManagerCanonicalCareersContextRuntime.ts",
  approvalRuntime: "src/core/businessRelationshipManagerApprovalRuntime.ts",
  approvalCandidate: "src/core/businessStaffCommunicationApprovalCandidate.ts",
  approvalCandidatePersistence: "src/core/businessStaffCommunicationApprovalCandidatePersistence.ts",
  approvalFinalizer: "src/core/businessStaffCommunicationApprovalFinalizer.ts",
  executionRuntime: "src/core/businessRelationshipManagerExecutionRuntime.ts",
  executionGate: "src/core/businessCommunicationExecutionGate.ts",
  executionRequest: "src/core/businessCommunicationExecutionRequest.ts",
  lifecycle: "src/core/businessCommunicationLifecycleReceipt.ts",
  learning: "src/core/businessCommunicationOutcomeLearningProvenance.ts",
  dryRun: "tests/businessRelationshipManagerEndToEndDryRun.test.ts",
  candidateTest: "tests/businessRelationshipManagerCanonicalCandidateRuntime.test.ts",
  bypassTest: "tests/businessRelationshipManagerCanonicalApprovalCandidateBinding.test.ts",
};
const source = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(path.join(root, file), "utf8")]));
const failures = [];
const requireToken = (key, token, message) => {
  if (!source[key].includes(token)) failures.push(message);
};
const forbidToken = (key, token, message) => {
  if (source[key].includes(token)) failures.push(message);
};

for (const token of [
  "createCommunicationSendEnvelope", "finalizeStaffCommunicationApproval",
  "authorizeCommunicationExecutionRequest", "gmail.users.messages.send",
]) forbidToken("admin", token, `Admin preview illegally references ${token}`);
requireToken("admin", "externalExecutionAllowed: false", "Admin preview must remain non-executable");
requireToken("admin", "persistenceAllowedFromThisPreview: false", "Admin preview must remain non-persistable");

for (const token of [
  '"business_relationship_manager_canonical_candidate_runtime_v2"',
  "runCanonicalRelationshipManagerCycleWithSourcesFromEnv", "careersRequired: true",
  "explicitRoleOpen: false", "activeRecruitmentProcess: false",
  "callerOpportunityAuthoritySuppressed: true",
  "RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_CALLER_OPPORTUNITY_AUTHORITY_LEAKED",
]) requireToken("candidateRuntime", token, `Canonical candidate runtime must retain ${token}`);
forbidToken("candidateRuntime", "openRoleConfirmed:", "Canonical candidate runtime must not pass manual role authority");
requireToken("careersRuntime", "RELATIONSHIP_MANAGER_CANONICAL_CAREERS_EVIDENCE_NOT_BOUND", "Careers evidence must bind through Decision Context");
requireToken("careersPolicy", "business_careers_relationship_policy_v3", "Careers policy must be evidence-backed v3");
forbidToken("careersPolicy", "Boolean(input.openRoleConfirmed)", "Careers policy must not trust manual open-role flags");
requireToken("candidateTest", "caller role and recruitment flags cannot bypass canonical careers truth", "Candidate regression must pin caller opportunity suppression");

requireToken("canonicalApproval", "business_relationship_manager_canonical_approval_runtime_v4", "Generic canonical approval must use v4");
requireToken("canonicalApproval", "RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_CANDIDATE_SPECIALIZED_RUNTIME_REQUIRED", "Generic canonical approval must reject candidate cycles");
requireToken("candidateApproval", "business_relationship_manager_canonical_candidate_approval_runtime_v3", "Candidate approval must use v3");
requireToken("candidateApproval", "runCanonicalRelationshipManagerCandidateResponse", "Candidate approval must rehydrate sources itself");
requireToken("candidateApproval", "candidateRuntimeInput", "Candidate approval must accept source input, not prebuilt candidate results");
requireToken("candidateApproval", "RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_DECISION_CAREERS_EVIDENCE_NOT_BOUND", "Candidate approval must bind careers receipt into the final decision");
requireToken("candidateApproval", "prepareRelationshipManagerCommunicationForApproval", "Specialized candidate approval must delegate only after fresh policy checks");
forbidToken("candidateApproval", "candidateResult:", "Candidate approval must not accept caller-constructed candidate results");
requireToken("bypassTest", "generic canonical approval refuses every candidate cycle and requires the specialized runtime", "Regression must pin generic candidate bypass rejection");

for (const [key, tokens] of Object.entries({
  approvalRuntime: ["readyForCandidatePersistence: true", "readyForHumanApproval: false", "externalExecutionAllowed: false"],
  approvalCandidate: ["bindStaffWritingOutputForApproval", "STAFF_APPROVAL_CANDIDATE_MEMORY_NOT_DURABLE"],
  approvalCandidatePersistence: ["evavo-approval-candidate-write-request-v1", "idempotent_replay", "approvalCandidatePersistenceEvidenceRef"],
  approvalFinalizer: ["candidatePersistence", "STAFF_APPROVAL_FINALIZER_CANDIDATE_NOT_DURABLE"],
  executionRuntime: ["authorizeCommunicationExecutionRequest", "approvalCandidatePersistenceEvidenceRef", "externalEffectPerformed: false"],
  executionGate: ["decision_writing_provenance_missing"],
  executionRequest: ["business_communication_execution_request_v4", "approvalCandidate"],
  lifecycle: ["business_communication_lifecycle_receipt_v4", "sameWritingProvenance", "sameApprovalCandidate"],
  learning: ["business_communication_lifecycle_receipt_v4", "approvalCandidateSha256"],
})) {
  for (const token of tokens) requireToken(key, token, `${files[key]} must retain ${token}`);
}
forbidToken("executionRuntime", "gmail.users.messages.send", "Execution runtime must not call Gmail directly");

for (const token of [
  "prepareRelationshipManagerCommunicationForApproval", "buildStaffApprovalCandidateWriteRequest",
  "reconcileStaffApprovalCandidateWriteReceipt", "bindRelationshipManagerApprovalCandidatePersistence",
  "finalizeRelationshipManagerCommunicationApproval", "authorizeRelationshipManagerCommunicationExecution",
]) requireToken("dryRun", token, `Dry run must exercise ${token}`);
for (const token of ["createCommunicationSendEnvelope", "assertAuthorizedCommunicationExecutionRequest"]) {
  forbidToken("dryRun", token, `Dry run must not bypass governed flow via ${token}`);
}
requireToken("dryRun", "No Gmail connector/send API is invoked", "Dry run must explicitly remain non-sending");

if (failures.length) {
  console.error("Relationship Manager governed-flow check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(JSON.stringify({
  ok: true,
  contract: "relationship_manager_governed_flow_check_v6_rehydrated_candidate_approval",
  adminPreviewSendCapable: false,
  callerOpportunityAuthoritySuppressed: true,
  genericCandidateApprovalRejected: true,
  specializedCandidateApprovalRehydratesSources: true,
  approvalRequiresDurableCycle: true,
  approvalRequiresWritingProvenance: true,
  approvalRequiresDurableCandidate: true,
  providerAuthorizationCarriesPersistedCandidate: true,
  lifecycleReconcilesPersistedCandidate: true,
  learningRetainsPersistedCandidate: true,
  dryRunUsesGovernedPath: true,
}, null, 2));
