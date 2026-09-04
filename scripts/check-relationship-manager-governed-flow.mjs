import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const files = {
  admin: "src/routes/businessRelationshipManagerAdmin.ts",
  candidateRuntime: "src/core/businessRelationshipManagerCanonicalCandidateRuntime.ts",
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
  learningProvenance: "src/core/businessCommunicationOutcomeLearningProvenance.ts",
  dryRun: "tests/businessRelationshipManagerEndToEndDryRun.test.ts",
  candidateTest: "tests/businessRelationshipManagerCanonicalCandidateRuntime.test.ts",
};

const source = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));
const failures = [];
const requireToken = (key, token, message) => {
  if (!source[key].includes(token)) failures.push(message);
};
const forbidToken = (key, token, message) => {
  if (source[key].includes(token)) failures.push(message);
};

for (const token of [
  "createCommunicationSendEnvelope",
  "finalizeStaffCommunicationApproval",
  "buildStaffApprovalCandidateWriteRequest",
  "bindRelationshipManagerApprovalCandidatePersistence",
  "authorizeCommunicationExecutionRequest",
  "authorizeRelationshipManagerCommunicationExecution",
  "finalizeRelationshipManagerCommunicationApproval",
  "gmail.users.messages.send",
]) forbidToken("admin", token, `Relationship Manager admin preview illegally references ${token}`);
requireToken("admin", "externalExecutionAllowed: false", "Admin preview must advertise externalExecutionAllowed:false");
requireToken("admin", "sendsEmail: false", "Admin preview must advertise sendsEmail:false");

for (const token of [
  "runCanonicalRelationshipManagerCycleWithSourcesFromEnv",
  "careersRequired: true",
  "roleTruth: sources.cycle.roleTruth",
  "RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_REFERRAL_WITHOUT_ROLE_TRUTH",
  "RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_MEETING_WITHOUT_ROLE_TRUTH",
]) requireToken("candidateRuntime", token, `Candidate runtime must retain ${token}`);
forbidToken("candidateRuntime", "openRoleConfirmed:", "Candidate runtime must not pass manual openRoleConfirmed authority");
requireToken("careersRuntime", "RELATIONSHIP_MANAGER_CANONICAL_CAREERS_EVIDENCE_NOT_BOUND", "Careers runtime must prove its source receipt is bound through Decision Context");
requireToken("careersRuntime", "careersSummary", "Careers runtime must hydrate careers truth into 360 context");
requireToken("careersPolicy", "business_careers_relationship_policy_v3", "Careers policy must use v3 evidence-backed contract");
forbidToken("careersPolicy", "Boolean(input.openRoleConfirmed)", "Careers policy must not trust openRoleConfirmed fallback");
requireToken("candidateTest", "manual role flags cannot bypass missing canonical careers and Brain truth", "Candidate regression must pin manual-role bypass prevention");

requireToken("approvalRuntime", "prepareStaffCommunicationApprovalCandidate", "Approval runtime must use canonical staff approval candidate builder");
requireToken("approvalRuntime", "bindRelationshipManagerApprovalCandidatePersistence", "Approval runtime must expose candidate-persistence transition");
requireToken("approvalRuntime", "readyForCandidatePersistence: true", "Unpersisted approval preparation must advertise persistence as next state");
requireToken("approvalRuntime", "readyForHumanApproval: false", "Unpersisted approval preparation must not be human-approvable");
requireToken("approvalRuntime", "finalizeStaffCommunicationApproval", "Approval runtime must use explicit human approval finalizer");
requireToken("approvalRuntime", "externalExecutionAllowed: false", "Approval runtime must remain non-executable after human approval");
requireToken("approvalCandidate", "bindStaffWritingOutputForApproval", "Approval candidate must validate Writing Studio output provenance");
requireToken("approvalCandidate", "STAFF_APPROVAL_CANDIDATE_MEMORY_NOT_DURABLE", "Approval candidate must fail closed on non-durable Relationship Manager memory");
requireToken("approvalCandidate", "STAFF_APPROVAL_CANDIDATE_SENDER_IDENTITY_MISMATCH", "Approval candidate must verify sender identity before human approval");
requireToken("approvalCandidatePersistence", "evavo-approval-candidate-write-request-v1", "Approval candidate persistence must use an explicit durable write request");
requireToken("approvalCandidatePersistence", "idempotent_replay", "Approval candidate persistence must support safe idempotent replay");
requireToken("approvalCandidatePersistence", "approvalCandidatePersistenceEvidenceRef", "Approval candidate persistence must derive immutable human-approval evidence");
requireToken("approvalFinalizer", "candidatePersistence", "Human approval finalization must require candidate persistence");
requireToken("approvalFinalizer", "STAFF_APPROVAL_FINALIZER_CANDIDATE_NOT_DURABLE", "Human approval finalization must fail closed on non-durable candidates");
requireToken("approvalFinalizer", "STAFF_APPROVAL_FINALIZER_OPERATOR_CANDIDATE_EVIDENCE_MISSING", "Human approval receipt must reference durable candidate identity");

requireToken("executionRuntime", "authorizeCommunicationExecutionRequest", "Execution runtime must delegate to canonical request authorizer");
requireToken("executionRuntime", "approvalCandidatePersistenceEvidenceRef", "Execution runtime must rederive persisted candidate evidence identity");
requireToken("executionRuntime", "RELATIONSHIP_MANAGER_EXECUTION_RUNTIME_CANDIDATE_EVIDENCE_NOT_BOUND", "Execution runtime must bind persisted candidate evidence");
requireToken("executionRuntime", "externalEffectPerformed: false", "Execution runtime must remain provider-neutral");
requireToken("executionRuntime", "RELATIONSHIP_MANAGER_EXECUTION_RUNTIME_WRITING_PROVENANCE_REQUIRED", "Execution runtime must require Writing Studio provenance");
forbidToken("executionRuntime", "gmail.users.messages.send", "Execution runtime must not call Gmail directly");

requireToken("executionGate", "decision_writing_provenance_missing", "Execution gate must block canonical cycles without approved Writing provenance");
requireToken("executionRequest", "business_communication_execution_request_v4", "Provider authorization must use execution request v4");
requireToken("executionRequest", "approvalCandidate", "Provider authorization must carry persisted approval candidate identity");
requireToken("lifecycle", "business_communication_lifecycle_receipt_v4", "Lifecycle must use persisted-candidate-aware v4 contract");
requireToken("lifecycle", "sameWritingProvenance", "Lifecycle must reconcile Writing Studio provenance");
requireToken("lifecycle", "sameApprovalCandidate", "Lifecycle must reconcile persisted candidate identity");
requireToken("learningProvenance", "business_communication_lifecycle_receipt_v4", "Outcome learning must require verified lifecycle v4");
requireToken("learningProvenance", "approvalCandidateSha256", "Outcome learning must retain persisted candidate lineage");

for (const token of [
  "prepareRelationshipManagerCommunicationForApproval",
  "buildStaffApprovalCandidateWriteRequest",
  "reconcileStaffApprovalCandidateWriteReceipt",
  "bindRelationshipManagerApprovalCandidatePersistence",
  "finalizeRelationshipManagerCommunicationApproval",
  "authorizeRelationshipManagerCommunicationExecution",
]) requireToken("dryRun", token, `End-to-end dry run must exercise ${token}`);
for (const token of ["createCommunicationSendEnvelope", "assertAuthorizedCommunicationExecutionRequest"]) {
  forbidToken("dryRun", token, `End-to-end dry run must not bypass governed flow via ${token}`);
}
requireToken("dryRun", "approvalCandidate", "End-to-end dry run must carry persisted approval candidate into lifecycle");
requireToken("dryRun", "business_communication_lifecycle_receipt_v4", "End-to-end dry run must verify lifecycle v4");
requireToken("dryRun", "No Gmail connector/send API is invoked", "End-to-end dry run must explicitly remain non-sending");

if (failures.length) {
  console.error("Relationship Manager governed-flow check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  contract: "relationship_manager_governed_flow_check_v4_careers_truth",
  adminPreviewSendCapable: false,
  candidateUsesCanonicalCareersTruth: true,
  manualRoleFlagsAuthorizeHiring: false,
  approvalRequiresDurableCycle: true,
  approvalRequiresWritingProvenance: true,
  approvalRequiresDurableCandidate: true,
  humanApprovalBindsPersistedCandidateEvidence: true,
  providerAuthorizationCarriesPersistedCandidate: true,
  executionUsesCanonicalGate: true,
  lifecycleReconcilesWritingProvenance: true,
  lifecycleReconcilesPersistedCandidate: true,
  learningRetainsPersistedCandidate: true,
  dryRunUsesGovernedPath: true,
}, null, 2));
