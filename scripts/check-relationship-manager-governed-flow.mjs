import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const files = {
  admin: "src/routes/businessRelationshipManagerAdmin.ts",
  brainPort: "src/core/businessBrainMemoryContextPort.ts",
  brainRuntime: "src/core/businessRelationshipManagerCanonicalBrainContextRuntime.ts",
  candidateRuntime: "src/core/businessRelationshipManagerCanonicalCandidateRuntime.ts",
  candidateApproval: "src/core/businessRelationshipManagerCanonicalCandidateApprovalRuntime.ts",
  canonicalApproval: "src/core/businessRelationshipManagerCanonicalApprovalRuntime.ts",
  careersPolicy: "src/core/businessCareersRelationshipPolicy.ts",
  careersRuntime: "src/core/businessRelationshipManagerCanonicalCareersContextRuntime.ts",
  careersPort: "src/core/businessCareersRoleTruthPort.ts",
  draftReview: "src/core/businessCandidateDraftPolicyReview.ts",
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
  openRoleTest: "tests/businessRelationshipManagerCanonicalCandidateOpenRole.test.ts",
  brainStateTest: "tests/businessRelationshipManagerCanonicalBrainContextRuntime.test.ts",
  draftBindingTest: "tests/businessRelationshipManagerCanonicalDraftBinding.test.ts",
  bypassTest: "tests/businessRelationshipManagerCanonicalApprovalCandidateBinding.test.ts",
};
const source = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(path.join(root, file), "utf8")]));
const failures = [];
const requireToken = (key, token, message) => { if (!source[key].includes(token)) failures.push(message); };
const forbidToken = (key, token, message) => { if (source[key].includes(token)) failures.push(message); };

for (const token of ["createCommunicationSendEnvelope", "finalizeStaffCommunicationApproval", "authorizeCommunicationExecutionRequest", "gmail.users.messages.send"]) {
  forbidToken("admin", token, `Admin preview illegally references ${token}`);
}
requireToken("admin", "externalExecutionAllowed: false", "Admin preview must remain non-executable");
requireToken("admin", "persistenceAllowedFromThisPreview: false", "Admin preview must remain non-persistable");

for (const token of ['"business_brain_memory_context_port_v2"', "stateEvidenceRef", "queryEvidenceRef", "BRAIN_MEMORY_CONTEXT_STATE_EVIDENCE_INVALID"]) {
  requireToken("brainPort", token, `Brain context port must retain ${token}`);
}
for (const token of ['"business_relationship_manager_canonical_brain_context_runtime_v2"', "read.stateEvidenceRef", "RELATIONSHIP_MANAGER_CANONICAL_BRAIN_STATE_EVIDENCE_NOT_BOUND"]) {
  requireToken("brainRuntime", token, `Canonical Brain runtime must retain ${token}`);
}
requireToken("brainStateTest", "different query receipts with unchanged Brain state produce identical canonical evidence identity", "Brain state/query identity regression must remain present");

for (const token of [
  '"business_relationship_manager_canonical_candidate_runtime_v4"', "runCanonicalRelationshipManagerCycleWithSourcesFromEnv",
  "careersRequired: true", "explicitRoleOpen: false", "activeRecruitmentProcess: false",
  "callerOpportunityAuthoritySuppressed: true", "referralPathDerivedFromCareers",
  "sources.cycle.applicationUrl", "RELATIONSHIP_MANAGER_CANONICAL_CANDIDATE_REFERRAL_PATH_WITHOUT_ROLE_AUTHORITY",
]) requireToken("candidateRuntime", token, `Canonical candidate runtime must retain ${token}`);
forbidToken("candidateRuntime", "input.candidate.relevantRoleConfirmed", "Candidate runtime must not trust caller role relevance");
forbidToken("candidateRuntime", "input.candidate.referralPathKnown", "Candidate runtime must not trust caller referral paths");
for (const token of [
  '"business_relationship_manager_canonical_careers_context_runtime_v4"', "candidateRoleAuthorityDerived",
  "verifiedApplicationUrl", "applicationUrl", "RELATIONSHIP_MANAGER_CANONICAL_CAREERS_CANDIDATE_ROLE_DERIVATION_MISMATCH",
  "RELATIONSHIP_MANAGER_CANONICAL_CAREERS_APPLICATION_PATH_WITHOUT_ROLE_AUTHORITY",
]) requireToken("careersRuntime", token, `Careers runtime must retain ${token}`);
requireToken("careersPolicy", "business_careers_relationship_policy_v3", "Careers policy must remain evidence-backed v3");
forbidToken("careersPolicy", "Boolean(input.openRoleConfirmed)", "Careers policy must not trust manual open-role flags");
requireToken("careersPort", "nullableHttpUrl", "Careers port must validate application URLs");
requireToken("careersPort", "CAREERS_ROLE_TRUTH_APPLICATION_URL_INVALID", "Invalid application URLs must fail closed");
requireToken("candidateTest", "caller role and recruitment flags cannot bypass unavailable canonical careers truth", "Candidate suppression regression must remain present");
requireToken("openRoleTest", "role referral and application path authority", "Open-role referral regression must remain present");
requireToken("openRoleTest", "referralPathDerivedFromCareers", "Open-role regression must assert referral authority is source-derived");

requireToken("canonicalApproval", "business_relationship_manager_canonical_approval_runtime_v5", "Generic canonical approval must use v5");
requireToken("canonicalApproval", "assertCanonicalRelationshipManagerDraftBinding", "Canonical approval must bind draft to fresh source state");
requireToken("canonicalApproval", "RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_SOURCE_CONTEXT_CHANGED_AFTER_DRAFT", "Changed source state must force regeneration");
requireToken("canonicalApproval", "RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_CANDIDATE_SPECIALIZED_RUNTIME_REQUIRED", "Generic approval must reject candidate cycles");
for (const token of [
  '"business_relationship_manager_canonical_candidate_approval_runtime_v5"', "runCanonicalRelationshipManagerCandidateResponse",
  "assertCanonicalRelationshipManagerDraftBinding", "candidatePolicyEvidenceRef", "verifiedApplicationUrl",
  "expectedApplicationUrl: verifiedApplicationUrl", "reviewCandidateDraftAgainstPolicy", "freshDraftContextBound: true",
  "RELATIONSHIP_MANAGER_CANDIDATE_APPROVAL_DRAFT_POLICY_BLOCKED",
]) requireToken("candidateApproval", token, `Specialized candidate approval must retain ${token}`);
forbidToken("candidateApproval", "candidateResult:", "Candidate approval must never accept caller-constructed candidate results");
for (const token of ['"business_candidate_draft_policy_review_v2"', "expectedApplicationUrl", "verified_application_path_missing", "unsupported_global_not_hiring_claim"]) {
  requireToken("draftReview", token, `Candidate draft review must retain ${token}`);
}
requireToken("draftBindingTest", "new or removed source evidence after drafting forces regeneration", "Draft binding regression must cover material source changes");
requireToken("bypassTest", "generic canonical approval refuses every candidate cycle and requires the specialized runtime", "Generic candidate approval bypass must remain blocked");

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
})) for (const token of tokens) requireToken(key, token, `${files[key]} must retain ${token}`);
forbidToken("executionRuntime", "gmail.users.messages.send", "Execution runtime must not call Gmail directly");

for (const token of [
  "prepareRelationshipManagerCommunicationForApproval", "buildStaffApprovalCandidateWriteRequest",
  "reconcileStaffApprovalCandidateWriteReceipt", "bindRelationshipManagerApprovalCandidatePersistence",
  "finalizeRelationshipManagerCommunicationApproval", "authorizeRelationshipManagerCommunicationExecution",
]) requireToken("dryRun", token, `Dry run must exercise ${token}`);
for (const token of ["createCommunicationSendEnvelope", "assertAuthorizedCommunicationExecutionRequest"]) forbidToken("dryRun", token, `Dry run must not bypass governed flow via ${token}`);
requireToken("dryRun", "No Gmail connector/send API is invoked", "Dry run must explicitly remain non-sending");

if (failures.length) {
  console.error("Relationship Manager governed-flow check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(JSON.stringify({
  ok: true,
  contract: "relationship_manager_governed_flow_check_v10_stable_source_and_referral_authority",
  adminPreviewSendCapable: false,
  brainStateFingerprintStableAcrossQueries: true,
  callerOpportunityAuthoritySuppressed: true,
  candidateRoleAuthorityDerivedByCareers: true,
  candidateReferralPathDerivedByCareers: true,
  genericCandidateApprovalRejected: true,
  specializedCandidateApprovalRehydratesSources: true,
  freshDraftSourceContextRequired: true,
  candidatePolicyEvidenceBound: true,
  verifiedApplicationPathBound: true,
  candidateDraftPolicyReviewRequired: true,
  approvalRequiresDurableCycle: true,
  approvalRequiresWritingProvenance: true,
  approvalRequiresDurableCandidate: true,
  providerAuthorizationCarriesPersistedCandidate: true,
  lifecycleReconcilesPersistedCandidate: true,
  learningRetainsPersistedCandidate: true,
  dryRunUsesGovernedPath: true,
}, null, 2));
