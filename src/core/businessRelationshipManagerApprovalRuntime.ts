import type { OperatorCommunicationApprovalReceipt } from "./businessCommunicationOperatorApproval";
import type { CommunicationSendEnvelope, ApprovedAttachment } from "./businessCommunicationSendEnvelope";
import type { MailboxKey } from "./businessMailboxRegistry";
import type { CommunicationSenderKey } from "./businessCommunicationSenderIdentity";
import type { RelationshipManagerMemoryPersistenceResult } from "./businessRelationshipManagerMemoryPersistence";
import type { RelationshipManagerCommunicationCycle } from "./businessRelationshipManagerRuntime";
import {
  prepareStaffCommunicationApprovalCandidate,
  type StaffCommunicationApprovalCandidate,
} from "./businessStaffCommunicationApprovalCandidate";
import { finalizeStaffCommunicationApproval } from "./businessStaffCommunicationApprovalFinalizer";
import type { StaffCommunicationHandoffV2Like } from "./businessStaffCommunicationHandoffV2";
import type { StaffDraftPackageLike } from "./businessStaffWritingOutputBinding";
import type { StaffWritingEnvelopeV2Like } from "./businessStaffWritingProvenanceBinding";

export const BUSINESS_RELATIONSHIP_MANAGER_APPROVAL_RUNTIME_CONTRACT = "business_relationship_manager_approval_runtime_v2" as const;

export type RelationshipManagerApprovalPreparation = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_APPROVAL_RUNTIME_CONTRACT;
  cycleId: string;
  decisionPackageId: string;
  approvalCandidate: StaffCommunicationApprovalCandidate;
  readyForHumanApproval: true;
  humanApprovalRecorded: false;
  externalExecutionAllowed: false;
  externalEffectPerformed: false;
}>;

export type RelationshipManagerApprovalFinalization = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_APPROVAL_RUNTIME_CONTRACT;
  cycleId: string;
  decisionPackageId: string;
  approvalCandidateId: string;
  operatorApprovalId: string;
  approval: CommunicationSendEnvelope;
  readyForHumanApproval: false;
  humanApprovalRecorded: true;
  externalExecutionAllowed: false;
  externalEffectPerformed: false;
}>;

/**
 * Canonical post-writing preparation path for Relationship Manager. It binds
 * the actual communication cycle and its durable memory checkpoint to the
 * staff handoff and returned Writing Studio artifacts. The result is only a
 * candidate for human approval; it is not an approval and cannot be executed.
 */
export function prepareRelationshipManagerCommunicationForApproval(input: Readonly<{
  candidateId: string;
  createdAt: string;
  cycle: RelationshipManagerCommunicationCycle;
  memoryPersistence: RelationshipManagerMemoryPersistenceResult;
  handoff: StaffCommunicationHandoffV2Like;
  writingEnvelope: StaffWritingEnvelopeV2Like | unknown;
  draftPackage: StaffDraftPackageLike | unknown;
  writingCandidateId?: string | null;
  senderKey: CommunicationSenderKey;
  mailboxKey: MailboxKey;
  sender: string;
  to: readonly string[];
  cc?: readonly string[];
  bcc?: readonly string[];
  threadId: string;
  replyMessageId?: string | null;
  canonicalSubject: string;
  attachments?: readonly ApprovedAttachment[];
  evidenceIds?: readonly string[];
}>): RelationshipManagerApprovalPreparation {
  if (input.cycle.contract !== "business_relationship_manager_runtime_v1") {
    throw new Error("RELATIONSHIP_MANAGER_APPROVAL_RUNTIME_CYCLE_CONTRACT_INVALID");
  }
  if (input.cycle.decision.origin !== "relationship_manager_cycle") {
    throw new Error("RELATIONSHIP_MANAGER_APPROVAL_RUNTIME_DECISION_ORIGIN_INVALID");
  }
  if (input.cycle.decision.relationshipCycleId !== input.cycle.cycleId) {
    throw new Error("RELATIONSHIP_MANAGER_APPROVAL_RUNTIME_DECISION_CYCLE_MISMATCH");
  }
  if (input.memoryPersistence.cycleId !== input.cycle.cycleId) {
    throw new Error("RELATIONSHIP_MANAGER_APPROVAL_RUNTIME_MEMORY_CYCLE_MISMATCH");
  }
  if (input.handoff.staffContext.decisionPackageId !== input.cycle.decision.packageId) {
    throw new Error("RELATIONSHIP_MANAGER_APPROVAL_RUNTIME_HANDOFF_DECISION_MISMATCH");
  }
  if (input.handoff.staffContext.relationshipCycleId !== input.cycle.cycleId) {
    throw new Error("RELATIONSHIP_MANAGER_APPROVAL_RUNTIME_HANDOFF_CYCLE_MISMATCH");
  }
  if (input.cycle.projection.relationshipId && input.handoff.staffContext.relationshipId !== input.cycle.projection.relationshipId) {
    throw new Error("RELATIONSHIP_MANAGER_APPROVAL_RUNTIME_RELATIONSHIP_MISMATCH");
  }
  if (input.threadId.trim() !== input.cycle.projection.threadId) {
    throw new Error("RELATIONSHIP_MANAGER_APPROVAL_RUNTIME_THREAD_MISMATCH");
  }

  const approvalCandidate = prepareStaffCommunicationApprovalCandidate({
    candidateId: input.candidateId,
    createdAt: input.createdAt,
    handoff: input.handoff,
    decisionPackage: input.cycle.decision,
    relationshipManagerMemoryPersistence: input.memoryPersistence,
    writingEnvelope: input.writingEnvelope,
    draftPackage: input.draftPackage,
    writingCandidateId: input.writingCandidateId,
    senderKey: input.senderKey,
    mailboxKey: input.mailboxKey,
    sender: input.sender,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    threadId: input.threadId,
    replyMessageId: input.replyMessageId,
    canonicalSubject: input.canonicalSubject,
    attachments: input.attachments,
    evidenceIds: input.evidenceIds ?? input.cycle.decision.evidenceIds,
  });

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_APPROVAL_RUNTIME_CONTRACT,
    cycleId: input.cycle.cycleId,
    decisionPackageId: input.cycle.decision.packageId,
    approvalCandidate,
    readyForHumanApproval: true,
    humanApprovalRecorded: false,
    externalExecutionAllowed: false,
    externalEffectPerformed: false,
  });
}

/**
 * Records an explicit human approval against the exact immutable preparation.
 * The result is an approval envelope, not permission to execute externally;
 * the normal communication execution gate must still pass afterwards.
 */
export function finalizeRelationshipManagerCommunicationApproval(input: Readonly<{
  envelopeId: string;
  preparation: RelationshipManagerApprovalPreparation;
  operatorApprovalReceipt: OperatorCommunicationApprovalReceipt;
}>): RelationshipManagerApprovalFinalization {
  const preparation = input.preparation;
  if (preparation.contract !== BUSINESS_RELATIONSHIP_MANAGER_APPROVAL_RUNTIME_CONTRACT) {
    throw new Error("RELATIONSHIP_MANAGER_APPROVAL_RUNTIME_PREPARATION_CONTRACT_INVALID");
  }
  if (!preparation.readyForHumanApproval || preparation.humanApprovalRecorded || preparation.externalExecutionAllowed) {
    throw new Error("RELATIONSHIP_MANAGER_APPROVAL_RUNTIME_PREPARATION_STATE_INVALID");
  }
  if (preparation.approvalCandidate.relationshipCycleId !== preparation.cycleId) {
    throw new Error("RELATIONSHIP_MANAGER_APPROVAL_RUNTIME_PREPARATION_CYCLE_MISMATCH");
  }
  if (preparation.approvalCandidate.decisionPackageId !== preparation.decisionPackageId) {
    throw new Error("RELATIONSHIP_MANAGER_APPROVAL_RUNTIME_PREPARATION_DECISION_MISMATCH");
  }

  const finalized = finalizeStaffCommunicationApproval({
    envelopeId: input.envelopeId,
    candidate: preparation.approvalCandidate,
    operatorApprovalReceipt: input.operatorApprovalReceipt,
  });

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_APPROVAL_RUNTIME_CONTRACT,
    cycleId: preparation.cycleId,
    decisionPackageId: preparation.decisionPackageId,
    approvalCandidateId: preparation.approvalCandidate.candidateId,
    operatorApprovalId: finalized.operatorApprovalId,
    approval: finalized.approval,
    readyForHumanApproval: false,
    humanApprovalRecorded: true,
    externalExecutionAllowed: false,
    externalEffectPerformed: false,
  });
}
