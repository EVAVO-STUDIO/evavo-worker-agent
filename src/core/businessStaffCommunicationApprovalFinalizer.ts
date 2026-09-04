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

export const BUSINESS_STAFF_COMMUNICATION_APPROVAL_FINALIZER_CONTRACT = "business_staff_communication_approval_finalizer_v1" as const;

export type StaffCommunicationApprovalFinalization = Readonly<{
  contract: typeof BUSINESS_STAFF_COMMUNICATION_APPROVAL_FINALIZER_CONTRACT;
  candidateId: string;
  operatorApprovalId: string;
  approval: CommunicationSendEnvelope;
  externalEffectPerformed: false;
}>;

/**
 * Converts one immutable pre-approval candidate into the real send envelope
 * only after a separately issued human-operator approval receipt matches that
 * candidate exactly. No communication is sent here.
 */
export function finalizeStaffCommunicationApproval(input: Readonly<{
  envelopeId: string;
  candidate: StaffCommunicationApprovalCandidate;
  operatorApprovalReceipt: OperatorCommunicationApprovalReceipt;
}>): StaffCommunicationApprovalFinalization {
  const candidate = input.candidate;
  if (candidate.contract !== BUSINESS_STAFF_COMMUNICATION_APPROVAL_CANDIDATE_CONTRACT) {
    throw new Error("STAFF_APPROVAL_FINALIZER_CANDIDATE_CONTRACT_INVALID");
  }
  if (!candidate.readyForHumanApproval || candidate.externalEffectPerformed) {
    throw new Error("STAFF_APPROVAL_FINALIZER_CANDIDATE_NOT_APPROVABLE");
  }

  const receipt = validateOperatorCommunicationApprovalReceipt(input.operatorApprovalReceipt);
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
    evidenceIds: candidate.evidenceIds,
    approvalEvidenceIds: receipt.evidenceRefs,
    writingProvenance: candidate.writingProvenance,
  });

  if (approval.materialSha256 !== candidate.materialSha256) throw new Error("STAFF_APPROVAL_FINALIZER_CANONICAL_MATERIAL_CHANGED");

  return Object.freeze({
    contract: BUSINESS_STAFF_COMMUNICATION_APPROVAL_FINALIZER_CONTRACT,
    candidateId: candidate.candidateId,
    operatorApprovalId: receipt.approvalId,
    approval,
    externalEffectPerformed: false,
  });
}
