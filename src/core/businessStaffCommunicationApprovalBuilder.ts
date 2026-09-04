import type { MailboxKey } from "./businessMailboxRegistry";
import type { CommunicationSenderKey } from "./businessCommunicationSenderIdentity";
import {
  createCommunicationSendEnvelope,
  type ApprovedAttachment,
  type CommunicationSendEnvelope,
} from "./businessCommunicationSendEnvelope";
import type { BoundStaffDraftSelection } from "./businessStaffWritingOutputBinding";

export const BUSINESS_STAFF_COMMUNICATION_APPROVAL_BUILDER_CONTRACT = "business_staff_communication_approval_builder_v1" as const;

export type StaffCommunicationApprovalBuildResult = Readonly<{
  contract: typeof BUSINESS_STAFF_COMMUNICATION_APPROVAL_BUILDER_CONTRACT;
  approval: CommunicationSendEnvelope;
  writingPackageId: string;
  writingCandidateId: string;
}>;

function requiredSubject(value: string): string {
  const subject = value.trim();
  if (!subject || subject.length > 998) throw new Error("STAFF_COMMUNICATION_APPROVAL_SUBJECT_REQUIRED");
  return subject;
}

/**
 * Creates an approval envelope from a draft that has already passed the
 * Writing Studio provenance/output boundary. Callers provide routing and
 * attachment material, but cannot substitute different body text or a
 * different decision package while retaining the validated draft provenance.
 * A Writing Studio subject may refine the canonical thread subject; when the
 * candidate omits one, the caller-supplied canonical subject is preserved.
 */
export function buildStaffCommunicationApproval(input: Readonly<{
  envelopeId: string;
  approvedAt: string;
  expiresAt: string;
  approvedBy: string;
  senderKey: CommunicationSenderKey;
  mailboxKey: MailboxKey;
  sender: string;
  to: readonly string[];
  cc?: readonly string[];
  bcc?: readonly string[];
  threadId: string;
  replyMessageId?: string | null;
  canonicalSubject: string;
  boundDraft: BoundStaffDraftSelection;
  attachments?: readonly ApprovedAttachment[];
  evidenceIds: readonly string[];
  approvalEvidenceIds: readonly string[];
}>): StaffCommunicationApprovalBuildResult {
  const evidenceIds = [...new Set([
    ...input.evidenceIds.map((item) => item.trim()).filter(Boolean),
    ...input.boundDraft.sourceRefs.map((item) => item.trim()).filter(Boolean),
  ])];
  if (!evidenceIds.length) throw new Error("STAFF_COMMUNICATION_APPROVAL_EVIDENCE_REQUIRED");
  const subject = requiredSubject(input.boundDraft.subject ?? input.canonicalSubject);

  const approval = createCommunicationSendEnvelope({
    envelopeId: input.envelopeId,
    approvedAt: input.approvedAt,
    expiresAt: input.expiresAt,
    approvedBy: input.approvedBy,
    material: {
      sender: input.sender,
      to: input.to,
      cc: input.cc ?? [],
      bcc: input.bcc ?? [],
      threadId: input.threadId,
      replyMessageId: input.replyMessageId ?? null,
      subject,
      body: input.boundDraft.body,
      attachments: input.attachments ?? [],
    },
    senderKey: input.senderKey,
    mailboxKey: input.mailboxKey,
    decisionPackageId: input.boundDraft.decisionPackageId,
    evidenceIds,
    approvalEvidenceIds: input.approvalEvidenceIds,
    writingProvenance: input.boundDraft.writingProvenance,
  });

  return Object.freeze({
    contract: BUSINESS_STAFF_COMMUNICATION_APPROVAL_BUILDER_CONTRACT,
    approval,
    writingPackageId: input.boundDraft.writingPackageId,
    writingCandidateId: input.boundDraft.candidateId,
  });
}
