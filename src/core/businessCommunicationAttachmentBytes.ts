import { businessSha256Bytes } from "./businessSha256";
import type { ApprovedAttachment } from "./businessCommunicationSendEnvelope";
import type { AuthorizedCommunicationExecutionRequest } from "./businessCommunicationExecutionRequest";

export const BUSINESS_COMMUNICATION_ATTACHMENT_BYTES_CONTRACT = "business_communication_attachment_bytes_v1" as const;

export type CommunicationAttachmentBytesInput = Readonly<{
  artifactId: string;
  filename: string;
  bytes: Uint8Array;
  sourceEvidenceIds: readonly string[];
  observedAt: string;
}>;

export type VerifiedCommunicationAttachmentBytes = Readonly<{
  artifactId: string;
  filename: string;
  sha256: string;
  byteLength: number;
  bytes: Uint8Array;
  sourceEvidenceIds: readonly string[];
  observedAt: string;
}>;

export type ProviderReadyCommunicationRequest = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_ATTACHMENT_BYTES_CONTRACT;
  provider: "gmail";
  requestId: string;
  verifiedAt: string;
  sender: string;
  to: readonly string[];
  cc: readonly string[];
  bcc: readonly string[];
  threadId: string;
  replyMessageId: string | null;
  subject: string;
  body: string;
  attachments: readonly VerifiedCommunicationAttachmentBytes[];
  authorization: AuthorizedCommunicationExecutionRequest["authorization"];
}>;

function clean(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`COMMUNICATION_ATTACHMENT_${field.toUpperCase()}_REQUIRED`);
  return normalized;
}

function timestamp(value: string, field: string): string {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) throw new Error(`COMMUNICATION_ATTACHMENT_${field.toUpperCase()}_INVALID`);
  return parsed.toISOString();
}

function approvedById(attachments: readonly ApprovedAttachment[]): Map<string, ApprovedAttachment> {
  const map = new Map<string, ApprovedAttachment>();
  for (const attachment of attachments) {
    const id = clean(attachment.artifactId, "approved_artifact_id");
    if (map.has(id)) throw new Error("COMMUNICATION_ATTACHMENT_DUPLICATE_APPROVED_ARTIFACT");
    map.set(id, attachment);
  }
  return map;
}

export function verifyCommunicationAttachmentBytes(input: Readonly<{
  approvedAttachments: readonly ApprovedAttachment[];
  actualAttachments: readonly CommunicationAttachmentBytesInput[];
}>): readonly VerifiedCommunicationAttachmentBytes[] {
  if (input.actualAttachments.length !== input.approvedAttachments.length) {
    throw new Error("COMMUNICATION_ATTACHMENT_COUNT_MISMATCH");
  }
  const approved = approvedById(input.approvedAttachments);
  const seen = new Set<string>();
  const verified: VerifiedCommunicationAttachmentBytes[] = [];

  for (const actual of input.actualAttachments) {
    const artifactId = clean(actual.artifactId, "artifact_id");
    if (seen.has(artifactId)) throw new Error("COMMUNICATION_ATTACHMENT_DUPLICATE_ACTUAL_ARTIFACT");
    seen.add(artifactId);
    const expected = approved.get(artifactId);
    if (!expected) throw new Error("COMMUNICATION_ATTACHMENT_NOT_APPROVED");
    const filename = clean(actual.filename, "filename");
    if (filename !== expected.filename) throw new Error("COMMUNICATION_ATTACHMENT_FILENAME_MISMATCH");
    if (!(actual.bytes instanceof Uint8Array)) throw new Error("COMMUNICATION_ATTACHMENT_BYTES_REQUIRED");
    if (!actual.sourceEvidenceIds.map((item) => item.trim()).filter(Boolean).length) {
      throw new Error("COMMUNICATION_ATTACHMENT_SOURCE_EVIDENCE_REQUIRED");
    }
    const observedAt = timestamp(actual.observedAt, "observed_at");
    const sha256 = businessSha256Bytes(actual.bytes);
    if (sha256 !== expected.sha256.toLowerCase()) throw new Error("COMMUNICATION_ATTACHMENT_BYTES_HASH_MISMATCH");
    verified.push(Object.freeze({
      artifactId,
      filename,
      sha256,
      byteLength: actual.bytes.byteLength,
      bytes: actual.bytes,
      sourceEvidenceIds: Object.freeze([...new Set(actual.sourceEvidenceIds.map((item) => item.trim()).filter(Boolean))]),
      observedAt,
    }));
  }

  return Object.freeze(verified.sort((a, b) => a.artifactId.localeCompare(b.artifactId)));
}

export function materializeProviderReadyCommunicationRequest(input: Readonly<{
  request: AuthorizedCommunicationExecutionRequest;
  actualAttachments: readonly CommunicationAttachmentBytesInput[];
  verifiedAt: string;
}>): ProviderReadyCommunicationRequest {
  const verifiedAt = timestamp(input.verifiedAt, "verified_at");
  const authorizedAt = timestamp(input.request.authorizedAt, "authorized_at");
  const expiresAt = timestamp(input.request.authorization.expiresAt, "approval_expires_at");
  if (verifiedAt < authorizedAt) throw new Error("COMMUNICATION_ATTACHMENT_VERIFIED_BEFORE_AUTHORIZATION");
  if (verifiedAt >= expiresAt) throw new Error("COMMUNICATION_ATTACHMENT_VERIFIED_AFTER_APPROVAL_EXPIRY");

  const attachments = verifyCommunicationAttachmentBytes({
    approvedAttachments: input.request.attachments,
    actualAttachments: input.actualAttachments,
  });

  return Object.freeze({
    contract: BUSINESS_COMMUNICATION_ATTACHMENT_BYTES_CONTRACT,
    provider: input.request.provider,
    requestId: input.request.requestId,
    verifiedAt,
    sender: input.request.sender,
    to: input.request.to,
    cc: input.request.cc,
    bcc: input.request.bcc,
    threadId: input.request.threadId,
    replyMessageId: input.request.replyMessageId,
    subject: input.request.subject,
    body: input.request.body,
    attachments,
    authorization: input.request.authorization,
  });
}
