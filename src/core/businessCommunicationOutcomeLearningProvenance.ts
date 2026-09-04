import type { CommunicationLifecycleReceipt } from "./businessCommunicationLifecycleReceipt";
import type { CommunicationOutcomeLearningProvenance } from "./businessCommunicationOutcomeMemory";

export const BUSINESS_COMMUNICATION_OUTCOME_LEARNING_PROVENANCE_CONTRACT = "business_communication_outcome_learning_provenance_v2" as const;

export type CommunicationOutcomeLearningProvenanceResult = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_OUTCOME_LEARNING_PROVENANCE_CONTRACT;
  provenance: CommunicationOutcomeLearningProvenance;
}>;

/**
 * Derives durable-learning lineage only from a lifecycle whose provider send
 * has already been reconciled to the exact approved request. This prevents
 * callers from inventing decision, writing or approval-candidate provenance.
 */
export function deriveCommunicationOutcomeLearningProvenance(
  lifecycle: CommunicationLifecycleReceipt,
): CommunicationOutcomeLearningProvenanceResult {
  if (lifecycle.contract !== "business_communication_lifecycle_receipt_v4") {
    throw new Error("COMMUNICATION_OUTCOME_LEARNING_LIFECYCLE_CONTRACT_INVALID");
  }
  if (!lifecycle.executionVerified || !lifecycle.execution || !lifecycle.communicationId) {
    throw new Error("COMMUNICATION_OUTCOME_LEARNING_EXECUTION_NOT_VERIFIED");
  }
  if (lifecycle.execution.providerMessageId !== lifecycle.communicationId) {
    throw new Error("COMMUNICATION_OUTCOME_LEARNING_COMMUNICATION_ID_MISMATCH");
  }
  if (lifecycle.execution.decisionPackageId !== lifecycle.decision.packageId) {
    throw new Error("COMMUNICATION_OUTCOME_LEARNING_DECISION_MISMATCH");
  }

  if (lifecycle.decision.origin === "relationship_manager_cycle") {
    const writing = lifecycle.execution.writingProvenance;
    const candidate = lifecycle.execution.approvalCandidate;
    if (!lifecycle.decision.relationshipCycleId) throw new Error("COMMUNICATION_OUTCOME_LEARNING_CYCLE_REQUIRED");
    if (!writing) throw new Error("COMMUNICATION_OUTCOME_LEARNING_WRITING_PROVENANCE_REQUIRED");
    if (writing.decisionOrigin !== "relationship_manager_cycle") throw new Error("COMMUNICATION_OUTCOME_LEARNING_WRITING_ORIGIN_INVALID");
    if (writing.relationshipCycleId !== lifecycle.decision.relationshipCycleId) throw new Error("COMMUNICATION_OUTCOME_LEARNING_WRITING_CYCLE_MISMATCH");
    if (!candidate) throw new Error("COMMUNICATION_OUTCOME_LEARNING_APPROVAL_CANDIDATE_REQUIRED");
    return Object.freeze({
      contract: BUSINESS_COMMUNICATION_OUTCOME_LEARNING_PROVENANCE_CONTRACT,
      provenance: Object.freeze({
        decisionPackageId: lifecycle.decision.packageId,
        decisionOrigin: "relationship_manager_cycle" as const,
        relationshipCycleId: lifecycle.decision.relationshipCycleId,
        handoffId: writing.handoffId,
        writingRequestId: writing.writingRequestId,
        approvalCandidateId: candidate.candidateId,
        approvalCandidateSha256: candidate.candidateSha256,
        approvalCandidateRecordId: candidate.recordId,
        providerMessageId: lifecycle.execution.providerMessageId,
      }),
    });
  }

  const writing = lifecycle.execution.writingProvenance;
  const candidate = lifecycle.execution.approvalCandidate;
  return Object.freeze({
    contract: BUSINESS_COMMUNICATION_OUTCOME_LEARNING_PROVENANCE_CONTRACT,
    provenance: Object.freeze({
      decisionPackageId: lifecycle.decision.packageId,
      decisionOrigin: "direct" as const,
      ...(writing ? {
        handoffId: writing.handoffId,
        writingRequestId: writing.writingRequestId,
      } : {}),
      ...(candidate ? {
        approvalCandidateId: candidate.candidateId,
        approvalCandidateSha256: candidate.candidateSha256,
        approvalCandidateRecordId: candidate.recordId,
      } : {}),
      providerMessageId: lifecycle.execution.providerMessageId,
    }),
  });
}
