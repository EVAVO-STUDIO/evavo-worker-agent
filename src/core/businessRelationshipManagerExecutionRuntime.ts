import type { BusinessMailboxRecord } from "./businessMailboxRegistry";
import type { ApprovalContextChange } from "./businessCommunicationApprovalContext";
import {
  authorizeCommunicationExecutionRequest,
  type AuthorizedCommunicationExecutionRequest,
  type CommunicationExecutionAuthorizationResult,
} from "./businessCommunicationExecutionRequest";
import type { OperatorCommunicationApprovalReceipt } from "./businessCommunicationOperatorApproval";
import type { CommunicationDraftReviewInput } from "./businessCommunicationPreSendReview";
import type { RelationshipManagerApprovalFinalization } from "./businessRelationshipManagerApprovalRuntime";
import type { RelationshipManagerMemoryPersistenceResult } from "./businessRelationshipManagerMemoryPersistence";
import type { RelationshipManagerCommunicationCycle } from "./businessRelationshipManagerRuntime";

export const BUSINESS_RELATIONSHIP_MANAGER_EXECUTION_RUNTIME_CONTRACT = "business_relationship_manager_execution_runtime_v1" as const;

export type RelationshipManagerExecutionAuthorization = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_EXECUTION_RUNTIME_CONTRACT;
  cycleId: string;
  decisionPackageId: string;
  authorization: CommunicationExecutionAuthorizationResult;
  providerRequest: AuthorizedCommunicationExecutionRequest | null;
  externalExecutionAllowed: boolean;
  externalEffectPerformed: false;
}>;

/**
 * Canonical bridge from a finalized human approval to the provider-neutral
 * execution request. It performs no send. The returned Gmail request exists
 * only when every normal communication execution gate passes.
 */
export function authorizeRelationshipManagerCommunicationExecution(input: Readonly<{
  cycle: RelationshipManagerCommunicationCycle;
  memoryPersistence: RelationshipManagerMemoryPersistenceResult;
  finalization: RelationshipManagerApprovalFinalization;
  operatorApprovalReceipt: OperatorCommunicationApprovalReceipt;
  mailbox: BusinessMailboxRecord;
  review: Omit<CommunicationDraftReviewInput, "sendingEnabled" | "subject" | "body" | "recipients" | "attachments">;
  runtimeSendingEnabled: boolean;
  contextChangesSinceDecision?: readonly ApprovalContextChange[];
  now: Date;
}>): RelationshipManagerExecutionAuthorization {
  if (input.cycle.contract !== "business_relationship_manager_runtime_v1") {
    throw new Error("RELATIONSHIP_MANAGER_EXECUTION_RUNTIME_CYCLE_CONTRACT_INVALID");
  }
  if (input.cycle.decision.origin !== "relationship_manager_cycle") {
    throw new Error("RELATIONSHIP_MANAGER_EXECUTION_RUNTIME_DECISION_ORIGIN_INVALID");
  }
  if (!input.cycle.decision.relationshipCycleId || input.cycle.decision.relationshipCycleId !== input.cycle.cycleId) {
    throw new Error("RELATIONSHIP_MANAGER_EXECUTION_RUNTIME_DECISION_CYCLE_MISMATCH");
  }
  if (input.memoryPersistence.cycleId !== input.cycle.cycleId) {
    throw new Error("RELATIONSHIP_MANAGER_EXECUTION_RUNTIME_MEMORY_CYCLE_MISMATCH");
  }
  if (!input.memoryPersistence.durable || input.memoryPersistence.blockers.length || !input.memoryPersistence.recordIds.length) {
    throw new Error("RELATIONSHIP_MANAGER_EXECUTION_RUNTIME_MEMORY_NOT_DURABLE");
  }
  if (input.finalization.cycleId !== input.cycle.cycleId) {
    throw new Error("RELATIONSHIP_MANAGER_EXECUTION_RUNTIME_APPROVAL_CYCLE_MISMATCH");
  }
  if (input.finalization.decisionPackageId !== input.cycle.decision.packageId) {
    throw new Error("RELATIONSHIP_MANAGER_EXECUTION_RUNTIME_APPROVAL_DECISION_MISMATCH");
  }
  if (!input.finalization.humanApprovalRecorded || input.finalization.externalExecutionAllowed) {
    throw new Error("RELATIONSHIP_MANAGER_EXECUTION_RUNTIME_APPROVAL_STATE_INVALID");
  }
  const writingProvenance = input.finalization.approval.approvalBinding?.writingProvenance;
  if (!writingProvenance) throw new Error("RELATIONSHIP_MANAGER_EXECUTION_RUNTIME_WRITING_PROVENANCE_REQUIRED");
  if (writingProvenance.decisionOrigin !== "relationship_manager_cycle") {
    throw new Error("RELATIONSHIP_MANAGER_EXECUTION_RUNTIME_WRITING_ORIGIN_INVALID");
  }
  if (writingProvenance.relationshipCycleId !== input.cycle.cycleId) {
    throw new Error("RELATIONSHIP_MANAGER_EXECUTION_RUNTIME_WRITING_CYCLE_MISMATCH");
  }

  const authorization = authorizeCommunicationExecutionRequest({
    mailbox: input.mailbox,
    material: input.finalization.approval.material,
    approval: input.finalization.approval,
    operatorApprovalReceipt: input.operatorApprovalReceipt,
    decisionPackage: input.cycle.decision,
    relationshipManagerMemoryPersistence: input.memoryPersistence,
    review: input.review,
    runtimeSendingEnabled: input.runtimeSendingEnabled,
    contextChangesSinceDecision: input.contextChangesSinceDecision,
    now: input.now,
  });

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_EXECUTION_RUNTIME_CONTRACT,
    cycleId: input.cycle.cycleId,
    decisionPackageId: input.cycle.decision.packageId,
    authorization,
    providerRequest: authorization.request,
    externalExecutionAllowed: Boolean(authorization.request),
    externalEffectPerformed: false,
  });
}
