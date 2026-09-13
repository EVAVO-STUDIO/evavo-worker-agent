import {
  validateOperatorCommunicationApprovalReceipt,
  type OperatorCommunicationApprovalReceipt,
} from "./businessCommunicationOperatorApproval";
import {
  createCommunicationSendEnvelope,
  type CommunicationSendEnvelope,
} from "./businessCommunicationSendEnvelope";
import {
  BUSINESS_STAFF_COMMUNICATION_APPROVAL_CANDIDATE_CONTRACT,
  type StaffCommunicationApprovalCandidate,
} from "./businessStaffCommunicationApprovalCandidate";
import {
  BUSINESS_STAFF_COMMUNICATION_APPROVAL_CANDIDATE_PERSISTENCE_CONTRACT,
  approvalCandidatePersistenceEvidenceRef,
  staffApprovalCandidateHash,
  type StaffApprovalCandidatePersistenceResult,
} from "./businessStaffCommunicationApprovalCandidatePersistence";

export const BUSINESS_STAFF_COMMUNICATION_APPROVAL_FINALIZER_CONTRACT = "business_staff_communication_approval_finalizer_v2" as const;

export type StaffCommunicationApprovalFinalization = Readonly<{
  contract: typeof BUSINESS_STAFF_COMMUNICATION_APPROVAL_FINALIZER_CONTRACT;
  candidateId: string;
  candidateRecordId: string;
  candidateSha256: string;
  operatorApprovalId: string;
  approval: CommunicationSendEnvelope;
  externalEffectPerformed: false;
}>;

/**
 * Converts one immutable, durably persisted pre-approval candidate into the
 * real send envelope only after a separately issued human-operator approval
 * receipt matches that exact candidate. No communication is sent here.
 */
export function finalizeStaffCommunicationApproval(input: Readonly<{
  envelopeId: string;
  candidate: StaffCommunicationApprovalCandidate;
  candidatePersistence: StaffApprovalCandidatePersistenceResult;
  operatorApprovalReceipt: OperatorCommunicationApprovalReceipt;
}>): StaffCommunicationApprovalFinalization {
  const candidate = input.candidate;
  if (candidate.contract !== BUSINESS_STAFF_COMMUNICATION_APPROVAL_CANDIDATE_CONTRACT) {
    throw new Error("STAFF_APPROVAL_FINALIZER_CANDIDATE_CONTRACT_INVALID");
  }
  if (!candidate.readyForHumanApproval || candidate.externalEffectPerformed) {
    throw new Error("STAFF_APPROVAL_FINALIZER_CANDIDATE_NOT_APPROVABLE");
  }

  const persistence = input.candidatePersistence;
  if (persistence.contract !== BUSINESS_STAFF_COMMUNICATION_APPROVAL_CANDIDATE_PERSISTENCE_CONTRACT) {
    throw new Error("STAFF_APPROVAL_FINALIZER_CANDIDATE_PERSISTENCE_CONTRACT_INVALID");
  }
  if (!persistence.durable || persistence.status !== "persisted" || persistence.blocker) {
    throw new Error("STAFF_APPROVAL_FINALIZER_CANDIDATE_NOT_DURABLE");
  }
  if (persistence.candidateId !== candidate.candidateId) throw new Error("STAFF_APPROVAL_FINALIZER_PERSISTED_CANDIDATE_ID_MISMATCH");
  const candidateSha256 = staffApprovalCandidateHash(candidate);
  if (persistence.candidateSha256 !== candidateSha256) throw new Error("STAFF_APPROVAL_FINALIZER_PERSISTED_CANDIDATE_HASH_MISMATCH");
  const candidateRecordId = persistence.recordId?.trim() ?? "";
  const candidateEvidenceRef = persistence.approvalEvidenceRef?.trim() ?? "";
  if (!candidateRecordId || !candidateEvidenceRef) throw new Error("STAFF_APPROVAL_FINALIZER_PERSISTED_CANDIDATE_EVIDENCE_REQUIRED");
  const expectedCandidateEvidenceRef = approvalCandidatePersistenceEvidenceRef({
    candidateId: candidate.candidateId,
    candidateSha256,
    recordId: candidateRecordId,
  });
  if (candidateEvidenceRef !== expectedCandidateEvidenceRef) {
    throw new Error("STAFF_APPROVAL_FINALIZER_PERSISTED_CANDIDATE_EVIDENCE_MISMATCH");
  }

  const receipt = validateOperatorCommunicationApprovalReceipt(input.operatorApprovalReceipt);
  if (!receipt.evidenceRefs.includes(expectedCandidateEvidenceRef)) {
    throw new Error("STAFF_APPROVAL_FINALIZER_OPERATOR_CANDIDATE_EVIDENCE_MISSING");
  }
  if (receipt.materialSha256 !== candidate.materialSha256) throw new Error("STAFF_APPROVAL_FINALIZER_MATERIAL_MISMATCH");
  if (receipt.decisionPackageId !== candidate.decisionPackageId) throw new Error("STAFF_APPROVAL_FINALIZER_DECISION_MISMATCH");
  if (receipt.senderKey !== candidate.senderKey) throw new Error("STAFF_APPROVAL_FINALIZER_SENDER_MISMATCH");
  if (receipt.mailboxKey !== candidate.mailboxKey) throw new Error("STAFF_APPROVAL_FINALIZER_MAILBOX_MISMATCH");
  if (Date.parse(receipt.approvedAt) < Date.parse(candidate.createdAt)) throw new Error("STAFF_APPROVAL_FINALIZER_APPROVAL_BEFORE_CANDIDATE");

  const approval = createCommunicationSendEnvelope({
    envelopeId: input.envelopeId,
    approvedAt: receipt.approvedAt,
    expiresAt: receipt.expiresAt,
    approvedBy: receipt.approverId,
    material: candidate.material,
    senderKey: candidate.senderKey,
    mailboxKey: candidate.mailboxKey,
    decisionPackageId: candidate.decisionPackageId,
    evidenceIds: [...candidate.evidenceIds, expectedCandidateEvidenceRef],
    approvalEvidenceIds: receipt.evidenceRefs,
    writingProvenance: candidate.writingProvenance,
  });

  if (approval.materialSha256 !== candidate.materialSha256) throw new Error("STAFF_APPROVAL_FINALIZER_CANONICAL_MATERIAL_CHANGED");

  return Object.freeze({
    contract: BUSINESS_STAFF_COMMUNICATION_APPROVAL_FINALIZER_CONTRACT,
    candidateId: candidate.candidateId,
    candidateRecordId,
    candidateSha256,
    operatorApprovalId: receipt.approvalId,
    approval,
    externalEffectPerformed: false,
  });
}
