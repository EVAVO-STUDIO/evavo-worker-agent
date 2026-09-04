import type { CommunicationDecisionPackage } from "./businessCommunicationDecisionPackage";
import type { MailboxKey } from "./businessMailboxRegistry";
import { EVAVO_COMMUNICATION_SENDERS, type CommunicationSenderKey } from "./businessCommunicationSenderIdentity";
import {
  communicationSendMaterialHash,
  type ApprovedAttachment,
  type CommunicationSendMaterial,
  type CommunicationWritingProvenanceBinding,
} from "./businessCommunicationSendEnvelope";
import type { RelationshipManagerMemoryPersistenceResult } from "./businessRelationshipManagerMemoryPersistence";
import type { StaffCommunicationHandoffV2Like } from "./businessStaffCommunicationHandoffV2";
import {
  bindStaffWritingOutputForApproval,
  type BoundStaffDraftSelection,
  type StaffDraftPackageLike,
} from "./businessStaffWritingOutputBinding";
import type { StaffWritingEnvelopeV2Like } from "./businessStaffWritingProvenanceBinding";

export const BUSINESS_STAFF_COMMUNICATION_APPROVAL_CANDIDATE_CONTRACT = "business_staff_communication_approval_candidate_v2" as const;

export type StaffCommunicationApprovalCandidate = Readonly<{
  contract: typeof BUSINESS_STAFF_COMMUNICATION_APPROVAL_CANDIDATE_CONTRACT;
  candidateId: string;
  createdAt: string;
  decisionPackageId: string;
  decisionOrigin: CommunicationDecisionPackage["origin"];
  relationshipCycleId: string | null;
  relationshipId: string;
  handoffId: string;
  writingRequestId: string;
  writingPackageId: string;
  writingCandidateId: string;
  senderKey: CommunicationSenderKey;
  mailboxKey: MailboxKey;
  writingProvenance: CommunicationWritingProvenanceBinding;
  material: CommunicationSendMaterial;
  materialSha256: string;
  evidenceIds: readonly string[];
  writingSourceRefs: readonly string[];
  readyForHumanApproval: true;
  externalEffectPerformed: false;
}>;

function required(value: string | null | undefined, code: string, max = 1000): string {
  const out = value?.trim() ?? "";
  if (!out || out.length > max) throw new Error(code);
  return out;
}

function timestamp(value: string, code: string): string {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) throw new Error(code);
  return parsed.toISOString();
}

function uniqueEvidence(values: readonly string[]): readonly string[] {
  const out = [...new Set(values.map((item) => item.trim()).filter(Boolean))].sort();
  if (!out.length) throw new Error("STAFF_APPROVAL_CANDIDATE_EVIDENCE_REQUIRED");
  return Object.freeze(out);
}

function assertDecisionAndHandoffAligned(
  decision: CommunicationDecisionPackage,
  handoff: StaffCommunicationHandoffV2Like,
): void {
  if (!decision.approvalGradeReady) throw new Error("STAFF_APPROVAL_CANDIDATE_DECISION_NOT_READY");
  if (decision.disposition !== "reply") throw new Error("STAFF_APPROVAL_CANDIDATE_DECISION_NOT_EXECUTABLE");
  if (handoff.staffContext.decisionPackageId !== decision.packageId) throw new Error("STAFF_APPROVAL_CANDIDATE_DECISION_MISMATCH");
  if (handoff.staffContext.decisionOrigin !== decision.origin) throw new Error("STAFF_APPROVAL_CANDIDATE_ORIGIN_MISMATCH");
  const handoffCycleId = handoff.staffContext.relationshipCycleId?.trim() || null;
  if (handoffCycleId !== decision.relationshipCycleId) throw new Error("STAFF_APPROVAL_CANDIDATE_CYCLE_MISMATCH");
}

function assertMemoryCheckpoint(
  decision: CommunicationDecisionPackage,
  persistence: RelationshipManagerMemoryPersistenceResult | null | undefined,
): void {
  if (decision.origin !== "relationship_manager_cycle") return;
  if (!decision.relationshipCycleId) throw new Error("STAFF_APPROVAL_CANDIDATE_CYCLE_REQUIRED");
  if (!persistence) throw new Error("STAFF_APPROVAL_CANDIDATE_MEMORY_CHECKPOINT_REQUIRED");
  if (persistence.contract !== "business_relationship_manager_memory_persistence_v1") {
    throw new Error("STAFF_APPROVAL_CANDIDATE_MEMORY_CONTRACT_INVALID");
  }
  if (persistence.cycleId !== decision.relationshipCycleId) throw new Error("STAFF_APPROVAL_CANDIDATE_MEMORY_CYCLE_MISMATCH");
  if (!persistence.durable || persistence.blockers.length) throw new Error("STAFF_APPROVAL_CANDIDATE_MEMORY_NOT_DURABLE");
  if (!persistence.recordIds.length) throw new Error("STAFF_APPROVAL_CANDIDATE_MEMORY_RECORDS_REQUIRED");
}

function buildMaterial(input: Readonly<{
  sender: string;
  to: readonly string[];
  cc?: readonly string[];
  bcc?: readonly string[];
  threadId: string;
  replyMessageId?: string | null;
  canonicalSubject: string;
  boundDraft: BoundStaffDraftSelection;
  attachments?: readonly ApprovedAttachment[];
}>): CommunicationSendMaterial {
  const canonicalSubject = required(input.canonicalSubject, "STAFF_APPROVAL_CANDIDATE_SUBJECT_REQUIRED", 998);
  return Object.freeze({
    sender: required(input.sender, "STAFF_APPROVAL_CANDIDATE_SENDER_REQUIRED", 320),
    to: Object.freeze([...input.to]),
    cc: Object.freeze([...(input.cc ?? [])]),
    bcc: Object.freeze([...(input.bcc ?? [])]),
    threadId: required(input.threadId, "STAFF_APPROVAL_CANDIDATE_THREAD_REQUIRED", 500),
    replyMessageId: input.replyMessageId?.trim() || null,
    subject: input.boundDraft.subject?.trim() || canonicalSubject,
    body: input.boundDraft.body,
    attachments: Object.freeze([...(input.attachments ?? [])]),
  });
}

/**
 * Produces immutable material that is ready to be shown to a human approver.
 * This function does not approve, send, persist, draft, call a provider or
 * perform any external effect.
 */
export function prepareStaffCommunicationApprovalCandidate(input: Readonly<{
  candidateId: string;
  createdAt: string;
  handoff: StaffCommunicationHandoffV2Like;
  decisionPackage: CommunicationDecisionPackage;
  relationshipManagerMemoryPersistence?: RelationshipManagerMemoryPersistenceResult | null;
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
  evidenceIds: readonly string[];
}>): StaffCommunicationApprovalCandidate {
  assertDecisionAndHandoffAligned(input.decisionPackage, input.handoff);
  assertMemoryCheckpoint(input.decisionPackage, input.relationshipManagerMemoryPersistence);
  if (input.senderKey !== input.mailboxKey) throw new Error("STAFF_APPROVAL_CANDIDATE_MAILBOX_SENDER_KEY_MISMATCH");
  const senderIdentity = EVAVO_COMMUNICATION_SENDERS[input.senderKey];
  if (!senderIdentity || senderIdentity.address.trim().toLowerCase() !== input.sender.trim().toLowerCase()) {
    throw new Error("STAFF_APPROVAL_CANDIDATE_SENDER_IDENTITY_MISMATCH");
  }

  const boundDraft = bindStaffWritingOutputForApproval({
    handoff: input.handoff,
    writingEnvelope: input.writingEnvelope,
    draftPackage: input.draftPackage,
    candidateId: input.writingCandidateId,
  });
  if (boundDraft.decisionPackageId !== input.decisionPackage.packageId) throw new Error("STAFF_APPROVAL_CANDIDATE_WRITING_DECISION_MISMATCH");

  const material = buildMaterial({
    sender: input.sender,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    threadId: input.threadId,
    replyMessageId: input.replyMessageId,
    canonicalSubject: input.canonicalSubject,
    boundDraft,
    attachments: input.attachments,
  });
  const materialSha256 = communicationSendMaterialHash(material);
  const evidenceIds = uniqueEvidence([
    ...input.evidenceIds,
    ...input.decisionPackage.evidenceIds,
    ...boundDraft.sourceRefs,
    ...(input.relationshipManagerMemoryPersistence?.recordIds ?? []),
  ]);

  return Object.freeze({
    contract: BUSINESS_STAFF_COMMUNICATION_APPROVAL_CANDIDATE_CONTRACT,
    candidateId: required(input.candidateId, "STAFF_APPROVAL_CANDIDATE_ID_REQUIRED", 300),
    createdAt: timestamp(input.createdAt, "STAFF_APPROVAL_CANDIDATE_CREATED_AT_INVALID"),
    decisionPackageId: input.decisionPackage.packageId,
    decisionOrigin: input.decisionPackage.origin,
    relationshipCycleId: input.decisionPackage.relationshipCycleId,
    relationshipId: input.handoff.staffContext.relationshipId,
    handoffId: required(input.handoff.handoff.handoffId, "STAFF_APPROVAL_CANDIDATE_HANDOFF_ID_REQUIRED", 300),
    writingRequestId: boundDraft.writingRequestId,
    writingPackageId: boundDraft.writingPackageId,
    writingCandidateId: boundDraft.candidateId,
    senderKey: input.senderKey,
    mailboxKey: input.mailboxKey,
    writingProvenance: boundDraft.writingProvenance,
    material,
    materialSha256,
    evidenceIds,
    writingSourceRefs: Object.freeze([...boundDraft.sourceRefs]),
    readyForHumanApproval: true,
    externalEffectPerformed: false,
  });
}
