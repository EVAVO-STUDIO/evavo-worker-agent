import type { BusinessMailboxRecord } from "./businessMailboxRegistry";
import type { ApprovalContextChange } from "./businessCommunicationApprovalContext";
import type { CommunicationDecisionPackage } from "./businessCommunicationDecisionPackage";
import {
  evaluateCommunicationExecutionGate,
  type CommunicationExecutionGateResult,
} from "./businessCommunicationExecutionGate";
import type { OperatorCommunicationApprovalReceipt } from "./businessCommunicationOperatorApproval";
import type { CommunicationDraftReviewInput } from "./businessCommunicationPreSendReview";
import type {
  CommunicationSendEnvelope,
  CommunicationSendMaterial,
  CommunicationWritingProvenanceBinding,
} from "./businessCommunicationSendEnvelope";
import { approvalCandidatePersistenceEvidenceRef } from "./businessStaffCommunicationApprovalCandidatePersistence";
import type { RelationshipManagerMemoryPersistenceResult } from "./businessRelationshipManagerMemoryPersistence";

export const BUSINESS_COMMUNICATION_EXECUTION_REQUEST_CONTRACT = "business_communication_execution_request_v4" as const;

export type CommunicationApprovalCandidateAuthorization = Readonly<{
  candidateId: string;
  candidateSha256: string;
  recordId: string;
  evidenceRef: string;
}>;

export type AuthorizedCommunicationExecutionRequest = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_EXECUTION_REQUEST_CONTRACT;
  provider: "gmail";
  requestId: string;
  authorizedAt: string;
  sender: string;
  to: readonly string[];
  cc: readonly string[];
  bcc: readonly string[];
  threadId: string;
  replyMessageId: string | null;
  subject: string;
  body: string;
  attachments: CommunicationSendMaterial["attachments"];
  authorization: Readonly<{
    envelopeId: string;
    materialSha256: string;
    approvalBindingSha256: string;
    decisionPackageId: string;
    decisionOrigin: CommunicationDecisionPackage["origin"];
    relationshipCycleId: string | null;
    decisionEvidenceIds: readonly string[];
    approvalEvidenceIds: readonly string[];
    operatorApprovalId: string;
    operatorApprovalSource: OperatorCommunicationApprovalReceipt["sourceSystem"];
    approvedBy: string;
    approvedAt: string;
    expiresAt: string;
    mailboxKey: string;
    writingProvenance?: CommunicationWritingProvenanceBinding | null;
    approvalCandidate: CommunicationApprovalCandidateAuthorization | null;
    memoryCheckpoint: Readonly<{
      cycleId: string;
      recordIds: readonly string[];
    }> | null;
  }>;
}>;

export type CommunicationExecutionAuthorizationResult = Readonly<{
  gate: CommunicationExecutionGateResult;
  request: AuthorizedCommunicationExecutionRequest | null;
}>;

function requestId(envelope: CommunicationSendEnvelope): string {
  return `gmail-send:${envelope.envelopeId}:${envelope.materialSha256.slice(0, 24)}`;
}

function normalizeApprovalCandidate(
  candidate: CommunicationApprovalCandidateAuthorization | null | undefined,
  approval: CommunicationSendEnvelope,
): CommunicationApprovalCandidateAuthorization | null {
  if (!candidate) return null;
  const candidateId = candidate.candidateId.trim();
  const candidateSha256 = candidate.candidateSha256.trim().toLowerCase();
  const recordId = candidate.recordId.trim();
  const evidenceRef = candidate.evidenceRef.trim();
  if (!candidateId || !recordId || !evidenceRef || !/^[a-f0-9]{64}$/.test(candidateSha256)) {
    throw new Error("COMMUNICATION_EXECUTION_REQUEST_APPROVAL_CANDIDATE_INVALID");
  }
  const expectedEvidenceRef = approvalCandidatePersistenceEvidenceRef({ candidateId, candidateSha256, recordId });
  if (evidenceRef !== expectedEvidenceRef) {
    throw new Error("COMMUNICATION_EXECUTION_REQUEST_APPROVAL_CANDIDATE_EVIDENCE_MISMATCH");
  }
  const binding = approval.approvalBinding;
  if (!binding) throw new Error("COMMUNICATION_EXECUTION_REQUEST_APPROVAL_CANDIDATE_BINDING_REQUIRED");
  if (!binding.evidenceIds.includes(expectedEvidenceRef)) throw new Error("COMMUNICATION_EXECUTION_REQUEST_APPROVAL_CANDIDATE_EVIDENCE_NOT_BOUND");
  if (!binding.approvalEvidenceIds.includes(expectedEvidenceRef)) throw new Error("COMMUNICATION_EXECUTION_REQUEST_APPROVAL_CANDIDATE_OPERATOR_EVIDENCE_NOT_BOUND");
  return Object.freeze({ candidateId, candidateSha256, recordId, evidenceRef: expectedEvidenceRef });
}

export function authorizeCommunicationExecutionRequest(input: Readonly<{
  mailbox: BusinessMailboxRecord;
  material: CommunicationSendMaterial;
  approval: CommunicationSendEnvelope;
  operatorApprovalReceipt: OperatorCommunicationApprovalReceipt;
  decisionPackage: CommunicationDecisionPackage;
  relationshipManagerMemoryPersistence?: RelationshipManagerMemoryPersistenceResult | null;
  approvalCandidate?: CommunicationApprovalCandidateAuthorization | null;
  review: Omit<CommunicationDraftReviewInput, "sendingEnabled" | "subject" | "body" | "recipients" | "attachments">;
  runtimeSendingEnabled: boolean;
  contextChangesSinceDecision?: readonly ApprovalContextChange[];
  now: Date;
}>): CommunicationExecutionAuthorizationResult {
  const gate = evaluateCommunicationExecutionGate(input);
  if (!gate.allowed) return Object.freeze({ gate, request: null });
  const binding = input.approval.approvalBinding;
  if (!binding) throw new Error("COMMUNICATION_EXECUTION_REQUEST_BINDING_REQUIRED");
  if (!Number.isFinite(input.now.getTime())) throw new Error("COMMUNICATION_EXECUTION_REQUEST_NOW_INVALID");

  let memoryCheckpoint: AuthorizedCommunicationExecutionRequest["authorization"]["memoryCheckpoint"] = null;
  if (input.decisionPackage.origin === "relationship_manager_cycle") {
    const persistence = input.relationshipManagerMemoryPersistence;
    const cycleId = input.decisionPackage.relationshipCycleId;
    if (!persistence || !cycleId || !persistence.durable || persistence.cycleId !== cycleId || persistence.blockers.length) {
      throw new Error("COMMUNICATION_EXECUTION_REQUEST_MEMORY_CHECKPOINT_REQUIRED");
    }
    memoryCheckpoint = Object.freeze({
      cycleId,
      recordIds: Object.freeze([...persistence.recordIds]),
    });
  }

  const writingProvenance = binding.writingProvenance
    ? Object.freeze({ ...binding.writingProvenance })
    : null;
  if (input.decisionPackage.origin === "relationship_manager_cycle") {
    if (!writingProvenance) throw new Error("COMMUNICATION_EXECUTION_REQUEST_WRITING_PROVENANCE_REQUIRED");
    if (writingProvenance.decisionOrigin !== "relationship_manager_cycle") {
      throw new Error("COMMUNICATION_EXECUTION_REQUEST_WRITING_ORIGIN_INVALID");
    }
    if (writingProvenance.relationshipCycleId !== input.decisionPackage.relationshipCycleId) {
      throw new Error("COMMUNICATION_EXECUTION_REQUEST_WRITING_CYCLE_MISMATCH");
    }
  }

  const approvalCandidate = normalizeApprovalCandidate(input.approvalCandidate, input.approval);
  if (input.decisionPackage.origin === "relationship_manager_cycle" && !approvalCandidate) {
    throw new Error("COMMUNICATION_EXECUTION_REQUEST_APPROVAL_CANDIDATE_REQUIRED");
  }

  const request: AuthorizedCommunicationExecutionRequest = Object.freeze({
    contract: BUSINESS_COMMUNICATION_EXECUTION_REQUEST_CONTRACT,
    provider: "gmail",
    requestId: requestId(input.approval),
    authorizedAt: input.now.toISOString(),
    sender: input.approval.material.sender,
    to: input.approval.material.to,
    cc: input.approval.material.cc ?? Object.freeze([]),
    bcc: input.approval.material.bcc ?? Object.freeze([]),
    threadId: input.approval.material.threadId,
    replyMessageId: input.approval.material.replyMessageId ?? null,
    subject: input.approval.material.subject,
    body: input.approval.material.body,
    attachments: input.approval.material.attachments,
    authorization: Object.freeze({
      envelopeId: input.approval.envelopeId,
      materialSha256: input.approval.materialSha256,
      approvalBindingSha256: binding.bindingSha256,
      decisionPackageId: binding.decisionPackageId,
      decisionOrigin: input.decisionPackage.origin,
      relationshipCycleId: input.decisionPackage.relationshipCycleId,
      decisionEvidenceIds: binding.evidenceIds,
      approvalEvidenceIds: binding.approvalEvidenceIds,
      operatorApprovalId: input.operatorApprovalReceipt.approvalId,
      operatorApprovalSource: input.operatorApprovalReceipt.sourceSystem,
      approvedBy: input.approval.approvedBy,
      approvedAt: input.approval.approvedAt,
      expiresAt: input.approval.expiresAt,
      mailboxKey: binding.mailboxKey,
      writingProvenance,
      approvalCandidate,
      memoryCheckpoint,
    }),
  });
  return Object.freeze({ gate, request });
}

export function assertAuthorizedCommunicationExecutionRequest(input: Parameters<typeof authorizeCommunicationExecutionRequest>[0]): AuthorizedCommunicationExecutionRequest {
  const result = authorizeCommunicationExecutionRequest(input);
  if (!result.request) throw new Error(`COMMUNICATION_EXECUTION_REQUEST_BLOCKED:${result.gate.reasons.join(",")}`);
  return result.request;
}
