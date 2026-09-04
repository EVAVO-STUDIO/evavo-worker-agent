import { createHash } from "node:crypto";

import { assertMailboxUsable, type BusinessMailboxRecord } from "./businessMailboxRegistry";
import {
  EVAVO_COMMUNICATION_SENDERS,
  type CommunicationSenderKey,
} from "./businessCommunicationSenderIdentity";

export const BUSINESS_EXTERNAL_COMMUNICATION_APPROVAL_ENVELOPE_CONTRACT = "business_external_communication_approval_envelope_v1" as const;

export type ApprovedAttachmentBinding = Readonly<{
  attachmentId: string;
  fileName: string;
  contentHash: string;
  versionRef?: string | null;
}>;

export type ExternalSendExecutionCandidate = Readonly<{
  senderKey: CommunicationSenderKey;
  senderAddress: string;
  to: readonly string[];
  cc?: readonly string[];
  bcc?: readonly string[];
  threadId: string;
  inReplyToMessageId?: string | null;
  subject: string;
  body: string;
  attachments?: readonly ApprovedAttachmentBinding[];
  evidenceIds: readonly string[];
  decisionPackageId: string;
}>;

export type ExternalCommunicationApprovalEnvelope = Readonly<{
  contract: typeof BUSINESS_EXTERNAL_COMMUNICATION_APPROVAL_ENVELOPE_CONTRACT;
  envelopeId: string;
  createdAt: string;
  senderKey: CommunicationSenderKey;
  senderAddress: string;
  senderDisplayName: string;
  mailboxKey: BusinessMailboxRecord["key"];
  to: readonly string[];
  cc: readonly string[];
  bcc: readonly string[];
  threadId: string;
  inReplyToMessageId: string | null;
  subject: string;
  body: string;
  bodyHash: string;
  attachments: readonly ApprovedAttachmentBinding[];
  evidenceIds: readonly string[];
  decisionPackageId: string;
  bindingHash: string;
}>;

export type ExternalCommunicationApproval = Readonly<{
  contract: typeof BUSINESS_EXTERNAL_COMMUNICATION_APPROVAL_ENVELOPE_CONTRACT;
  approvalId: string;
  approverId: string;
  approvedAt: string;
  expiresAt: string;
  envelopeId: string;
  bindingHash: string;
}>;

export type ExternalCommunicationExecutionVerification = Readonly<{
  contract: typeof BUSINESS_EXTERNAL_COMMUNICATION_APPROVAL_ENVELOPE_CONTRACT;
  valid: boolean;
  bindingHash: string;
  reasons: readonly string[];
}>;

function required(value: string, field: string, max = 1000): string {
  const clean = value.trim();
  if (!clean || clean.length > max) throw new Error(`EXTERNAL_SEND_${field.toUpperCase()}_INVALID`);
  return clean;
}

function iso(value: string, field: string): string {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) throw new Error(`EXTERNAL_SEND_${field.toUpperCase()}_INVALID`);
  return parsed.toISOString();
}

function address(value: string): string {
  const clean = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) || clean.length > 320) throw new Error("EXTERNAL_SEND_ADDRESS_INVALID");
  return clean;
}

function recipients(values: readonly string[] | undefined): readonly string[] {
  return Object.freeze([...new Set((values ?? []).map(address))].sort());
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeAttachment(item: ApprovedAttachmentBinding): ApprovedAttachmentBinding {
  const attachmentId = required(item.attachmentId, "attachment_id", 300);
  const fileName = required(item.fileName, "attachment_file_name", 500);
  const contentHash = item.contentHash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(contentHash)) throw new Error("EXTERNAL_SEND_ATTACHMENT_HASH_INVALID");
  const versionRef = item.versionRef?.trim() || null;
  return Object.freeze({ attachmentId, fileName, contentHash, ...(versionRef ? { versionRef } : {}) });
}

function normalizeCandidate(input: ExternalSendExecutionCandidate): ExternalSendExecutionCandidate & Readonly<{
  cc: readonly string[];
  bcc: readonly string[];
  inReplyToMessageId: string | null;
  attachments: readonly ApprovedAttachmentBinding[];
}> {
  const to = recipients(input.to);
  const cc = recipients(input.cc);
  const bcc = recipients(input.bcc);
  if (!to.length) throw new Error("EXTERNAL_SEND_TO_REQUIRED");
  const allRecipients = [...to, ...cc, ...bcc];
  if (new Set(allRecipients).size !== allRecipients.length) throw new Error("EXTERNAL_SEND_DUPLICATE_RECIPIENT_ACROSS_FIELDS");

  const senderAddress = address(input.senderAddress);
  const sender = EVAVO_COMMUNICATION_SENDERS[input.senderKey];
  if (!sender || address(sender.address) !== senderAddress) throw new Error("EXTERNAL_SEND_SENDER_IDENTITY_MISMATCH");

  const threadId = required(input.threadId, "thread_id", 500);
  const inReplyToMessageId = input.inReplyToMessageId?.trim() || null;
  const subject = required(input.subject, "subject", 1000);
  if (!input.body || input.body.length > 200_000) throw new Error("EXTERNAL_SEND_BODY_INVALID");
  const decisionPackageId = required(input.decisionPackageId, "decision_package_id", 300);
  const evidenceIds = Object.freeze([...new Set(input.evidenceIds.map((item) => item.trim()).filter(Boolean))].sort());
  if (!evidenceIds.length) throw new Error("EXTERNAL_SEND_EVIDENCE_REQUIRED");
  const attachments = Object.freeze((input.attachments ?? []).map(normalizeAttachment).sort((a, b) => a.attachmentId.localeCompare(b.attachmentId)));
  if (new Set(attachments.map((item) => item.attachmentId)).size !== attachments.length) throw new Error("EXTERNAL_SEND_DUPLICATE_ATTACHMENT_ID");

  return Object.freeze({
    senderKey: input.senderKey,
    senderAddress,
    to,
    cc,
    bcc,
    threadId,
    inReplyToMessageId,
    subject,
    body: input.body,
    attachments,
    evidenceIds,
    decisionPackageId,
  });
}

function bindingPayload(candidate: ReturnType<typeof normalizeCandidate>): string {
  return JSON.stringify({
    senderKey: candidate.senderKey,
    senderAddress: candidate.senderAddress,
    to: candidate.to,
    cc: candidate.cc,
    bcc: candidate.bcc,
    threadId: candidate.threadId,
    inReplyToMessageId: candidate.inReplyToMessageId,
    subject: candidate.subject,
    bodyHash: sha256(candidate.body),
    attachments: candidate.attachments,
    evidenceIds: candidate.evidenceIds,
    decisionPackageId: candidate.decisionPackageId,
  });
}

export function externalSendBindingHash(input: ExternalSendExecutionCandidate): string {
  return sha256(bindingPayload(normalizeCandidate(input)));
}

export function buildExternalCommunicationApprovalEnvelope(input: Readonly<{
  envelopeId: string;
  createdAt: string;
  mailbox: BusinessMailboxRecord;
  execution: ExternalSendExecutionCandidate;
}>): ExternalCommunicationApprovalEnvelope {
  assertMailboxUsable(input.mailbox);
  const envelopeId = required(input.envelopeId, "envelope_id", 300);
  const createdAt = iso(input.createdAt, "created_at");
  const candidate = normalizeCandidate(input.execution);
  if (input.mailbox.key !== candidate.senderKey || address(input.mailbox.address) !== candidate.senderAddress) {
    throw new Error("EXTERNAL_SEND_MAILBOX_SENDER_MISMATCH");
  }
  const sender = EVAVO_COMMUNICATION_SENDERS[candidate.senderKey];
  const bodyHash = sha256(candidate.body);
  const bindingHash = sha256(bindingPayload(candidate));

  return Object.freeze({
    contract: BUSINESS_EXTERNAL_COMMUNICATION_APPROVAL_ENVELOPE_CONTRACT,
    envelopeId,
    createdAt,
    senderKey: candidate.senderKey,
    senderAddress: candidate.senderAddress,
    senderDisplayName: sender.displayName,
    mailboxKey: input.mailbox.key,
    to: candidate.to,
    cc: candidate.cc,
    bcc: candidate.bcc,
    threadId: candidate.threadId,
    inReplyToMessageId: candidate.inReplyToMessageId,
    subject: candidate.subject,
    body: candidate.body,
    bodyHash,
    attachments: candidate.attachments,
    evidenceIds: candidate.evidenceIds,
    decisionPackageId: candidate.decisionPackageId,
    bindingHash,
  });
}

export function approveExternalCommunicationEnvelope(input: Readonly<{
  envelope: ExternalCommunicationApprovalEnvelope;
  approvalId: string;
  approverId: string;
  approvedAt: string;
  expiresAt: string;
}>): ExternalCommunicationApproval {
  const approvedAt = iso(input.approvedAt, "approved_at");
  const expiresAt = iso(input.expiresAt, "expires_at");
  if (expiresAt <= approvedAt) throw new Error("EXTERNAL_SEND_APPROVAL_EXPIRY_INVALID");
  return Object.freeze({
    contract: BUSINESS_EXTERNAL_COMMUNICATION_APPROVAL_ENVELOPE_CONTRACT,
    approvalId: required(input.approvalId, "approval_id", 300),
    approverId: required(input.approverId, "approver_id", 300),
    approvedAt,
    expiresAt,
    envelopeId: input.envelope.envelopeId,
    bindingHash: input.envelope.bindingHash,
  });
}

export function verifyApprovedExternalCommunicationForExecution(input: Readonly<{
  envelope: ExternalCommunicationApprovalEnvelope;
  approval: ExternalCommunicationApproval;
  mailbox: BusinessMailboxRecord;
  execution: ExternalSendExecutionCandidate;
  now: string;
}>): ExternalCommunicationExecutionVerification {
  assertMailboxUsable(input.mailbox);
  const now = iso(input.now, "verification_now");
  const reasons: string[] = [];
  const currentBindingHash = externalSendBindingHash(input.execution);

  if (input.approval.contract !== BUSINESS_EXTERNAL_COMMUNICATION_APPROVAL_ENVELOPE_CONTRACT) reasons.push("Approval contract does not match the send envelope contract.");
  if (input.envelope.contract !== BUSINESS_EXTERNAL_COMMUNICATION_APPROVAL_ENVELOPE_CONTRACT) reasons.push("Envelope contract is invalid.");
  if (input.approval.envelopeId !== input.envelope.envelopeId) reasons.push("Approval references a different envelope.");
  if (input.approval.bindingHash !== input.envelope.bindingHash) reasons.push("Approval is not bound to this envelope content.");
  if (currentBindingHash !== input.envelope.bindingHash) reasons.push("Execution candidate materially differs from the approved envelope.");
  if (now > input.approval.expiresAt) reasons.push("Approval has expired.");
  if (input.mailbox.key !== input.envelope.mailboxKey || address(input.mailbox.address) !== input.envelope.senderAddress) reasons.push("Current verified mailbox differs from the approved sender mailbox.");
  if (sha256(input.envelope.body) !== input.envelope.bodyHash) reasons.push("Approved envelope body integrity check failed.");

  return Object.freeze({
    contract: BUSINESS_EXTERNAL_COMMUNICATION_APPROVAL_ENVELOPE_CONTRACT,
    valid: reasons.length === 0,
    bindingHash: currentBindingHash,
    reasons: Object.freeze(reasons),
  });
}

export function assertApprovedExternalCommunicationExecutable(input: Parameters<typeof verifyApprovedExternalCommunicationForExecution>[0]): void {
  const result = verifyApprovedExternalCommunicationForExecution(input);
  if (!result.valid) throw new Error(`EXTERNAL_SEND_APPROVAL_INVALID:${result.reasons.join(" | ")}`);
}
