import { businessSha256 } from "./businessSha256";

import type { MailboxKey } from "./businessMailboxRegistry";
import { EVAVO_COMMUNICATION_SENDERS, type CommunicationSenderKey } from "./businessCommunicationSenderIdentity";

export const BUSINESS_COMMUNICATION_SEND_ENVELOPE_CONTRACT = "business_communication_send_envelope_v1" as const;

export type ApprovedAttachment = Readonly<{
  artifactId: string;
  filename: string;
  sha256: string;
  versionRef?: string | null;
}>;

export type CommunicationSendMaterial = Readonly<{
  sender: string;
  to: readonly string[];
  cc?: readonly string[];
  bcc?: readonly string[];
  threadId: string;
  replyMessageId?: string | null;
  subject: string;
  body: string;
  attachments: readonly ApprovedAttachment[];
}>;

export type CommunicationWritingProvenanceBinding = Readonly<{
  handoffId: string;
  writingRequestId: string;
  decisionOrigin: "direct" | "relationship_manager_cycle";
  relationshipCycleId?: string;
}>;

export type CommunicationApprovalBinding = Readonly<{
  senderKey: CommunicationSenderKey;
  mailboxKey: MailboxKey;
  decisionPackageId: string;
  evidenceIds: readonly string[];
  approvalEvidenceIds: readonly string[];
  writingProvenance?: CommunicationWritingProvenanceBinding;
  bindingSha256: string;
}>;

export type CommunicationSendEnvelope = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_SEND_ENVELOPE_CONTRACT;
  envelopeId: string;
  approvedAt: string;
  expiresAt: string;
  approvedBy: string;
  material: CommunicationSendMaterial;
  materialSha256: string;
  approvalBinding?: CommunicationApprovalBinding;
}>;

function clean(value: string, field: string, max = 1000): string {
  const out = value.trim();
  if (!out || out.length > max) throw new Error(`COMMUNICATION_SEND_${field.toUpperCase()}_REQUIRED`);
  return out;
}

function normaliseAddress(value: string): string {
  const address = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length > 320) throw new Error("COMMUNICATION_SEND_ADDRESS_INVALID");
  return address;
}

function normaliseAddresses(values: readonly string[] | undefined): readonly string[] {
  return Object.freeze([...new Set((values ?? []).map(normaliseAddress))].sort());
}

function normaliseEvidence(values: readonly string[], field: "evidence" | "approval_evidence"): readonly string[] {
  const normalized = Object.freeze([...new Set(values.map((item) => item.trim()).filter(Boolean))].sort());
  if (!normalized.length) throw new Error(`COMMUNICATION_SEND_${field.toUpperCase()}_REQUIRED`);
  return normalized;
}

function canonicalWritingProvenance(
  value: CommunicationWritingProvenanceBinding | undefined,
): CommunicationWritingProvenanceBinding | undefined {
  if (!value) return undefined;
  const handoffId = clean(value.handoffId, "writing_handoff_id", 300);
  const writingRequestId = clean(value.writingRequestId, "writing_request_id", 300);
  const relationshipCycleId = value.relationshipCycleId?.trim() || undefined;
  if (value.decisionOrigin === "relationship_manager_cycle" && !relationshipCycleId) {
    throw new Error("COMMUNICATION_SEND_WRITING_RELATIONSHIP_CYCLE_REQUIRED");
  }
  if (value.decisionOrigin === "direct" && relationshipCycleId) {
    throw new Error("COMMUNICATION_SEND_WRITING_DIRECT_CYCLE_FORBIDDEN");
  }
  return Object.freeze({
    handoffId,
    writingRequestId,
    decisionOrigin: value.decisionOrigin,
    ...(relationshipCycleId ? { relationshipCycleId: clean(relationshipCycleId, "writing_relationship_cycle_id", 300) } : {}),
  });
}

function canonicalMaterial(material: CommunicationSendMaterial): CommunicationSendMaterial {
  const attachments = material.attachments.map((item) => {
    const versionRef = item.versionRef?.trim() || null;
    return Object.freeze({
      artifactId: clean(item.artifactId, "attachment_artifact_id", 300),
      filename: clean(item.filename, "attachment_filename", 500),
      sha256: clean(item.sha256, "attachment_sha256", 64).toLowerCase(),
      ...(versionRef ? { versionRef } : {}),
    });
  }).sort((a, b) => a.artifactId.localeCompare(b.artifactId));
  if (attachments.some((item) => !/^[a-f0-9]{64}$/.test(item.sha256))) throw new Error("COMMUNICATION_SEND_ATTACHMENT_HASH_INVALID");
  if (new Set(attachments.map((item) => item.artifactId)).size !== attachments.length) throw new Error("COMMUNICATION_SEND_DUPLICATE_ATTACHMENT_ID");

  const to = normaliseAddresses(material.to);
  const cc = normaliseAddresses(material.cc);
  const bcc = normaliseAddresses(material.bcc);
  const combined = [...to, ...cc, ...bcc];
  if (new Set(combined).size !== combined.length) throw new Error("COMMUNICATION_SEND_DUPLICATE_RECIPIENT_ACROSS_FIELDS");

  return Object.freeze({
    sender: normaliseAddress(material.sender),
    to,
    cc,
    bcc,
    threadId: clean(material.threadId, "thread_id", 500),
    replyMessageId: material.replyMessageId?.trim() || null,
    subject: material.subject.trim(),
    body: material.body,
    attachments: Object.freeze(attachments),
  });
}

function sha256(value: string): string {
  return businessSha256(value);
}

export function communicationSendMaterialHash(material: CommunicationSendMaterial): string {
  return sha256(JSON.stringify(canonicalMaterial(material)));
}

function buildApprovalBinding(input: Readonly<{
  materialSha256: string;
  senderKey: CommunicationSenderKey;
  mailboxKey: MailboxKey;
  decisionPackageId: string;
  evidenceIds: readonly string[];
  approvalEvidenceIds: readonly string[];
  writingProvenance?: CommunicationWritingProvenanceBinding;
}>): CommunicationApprovalBinding {
  const sender = EVAVO_COMMUNICATION_SENDERS[input.senderKey];
  if (!sender) throw new Error("COMMUNICATION_SEND_SENDER_KEY_INVALID");
  const decisionPackageId = clean(input.decisionPackageId, "decision_package_id", 300);
  const evidenceIds = normaliseEvidence(input.evidenceIds, "evidence");
  const approvalEvidenceIds = normaliseEvidence(input.approvalEvidenceIds, "approval_evidence");
  const writingProvenance = canonicalWritingProvenance(input.writingProvenance);
  const payload = JSON.stringify({
    materialSha256: input.materialSha256,
    senderKey: input.senderKey,
    mailboxKey: input.mailboxKey,
    decisionPackageId,
    evidenceIds,
    approvalEvidenceIds,
    writingProvenance: writingProvenance ?? null,
  });
  return Object.freeze({
    senderKey: input.senderKey,
    mailboxKey: input.mailboxKey,
    decisionPackageId,
    evidenceIds,
    approvalEvidenceIds,
    ...(writingProvenance ? { writingProvenance } : {}),
    bindingSha256: sha256(payload),
  });
}

export function createCommunicationSendEnvelope(input: Readonly<{
  envelopeId: string;
  approvedAt: string;
  expiresAt: string;
  approvedBy: string;
  material: CommunicationSendMaterial;
  senderKey?: CommunicationSenderKey;
  mailboxKey?: MailboxKey;
  decisionPackageId?: string;
  evidenceIds?: readonly string[];
  approvalEvidenceIds?: readonly string[];
  writingProvenance?: CommunicationWritingProvenanceBinding;
}>): CommunicationSendEnvelope {
  const approvedAt = new Date(input.approvedAt);
  const expiresAt = new Date(input.expiresAt);
  if (Number.isNaN(approvedAt.getTime()) || Number.isNaN(expiresAt.getTime()) || expiresAt <= approvedAt) {
    throw new Error("COMMUNICATION_SEND_APPROVAL_WINDOW_INVALID");
  }
  const material = canonicalMaterial(input.material);
  if (!material.to.length) throw new Error("COMMUNICATION_SEND_TO_REQUIRED");
  const materialSha256 = communicationSendMaterialHash(material);

  const hasAnyBinding = Boolean(input.senderKey || input.mailboxKey || input.decisionPackageId || input.evidenceIds || input.approvalEvidenceIds || input.writingProvenance);
  const hasFullBinding = Boolean(input.senderKey && input.mailboxKey && input.decisionPackageId && input.evidenceIds?.length && input.approvalEvidenceIds?.length);
  if (hasAnyBinding && !hasFullBinding) throw new Error("COMMUNICATION_SEND_APPROVAL_BINDING_INCOMPLETE");

  let approvalBinding: CommunicationApprovalBinding | undefined;
  if (hasFullBinding) {
    const sender = EVAVO_COMMUNICATION_SENDERS[input.senderKey!];
    if (normaliseAddress(sender.address) !== material.sender) throw new Error("COMMUNICATION_SEND_SENDER_IDENTITY_MISMATCH");
    if (input.mailboxKey !== input.senderKey) throw new Error("COMMUNICATION_SEND_MAILBOX_SENDER_KEY_MISMATCH");
    approvalBinding = buildApprovalBinding({
      materialSha256,
      senderKey: input.senderKey!,
      mailboxKey: input.mailboxKey!,
      decisionPackageId: input.decisionPackageId!,
      evidenceIds: input.evidenceIds!,
      approvalEvidenceIds: input.approvalEvidenceIds!,
      writingProvenance: input.writingProvenance,
    });
  }

  return Object.freeze({
    contract: BUSINESS_COMMUNICATION_SEND_ENVELOPE_CONTRACT,
    envelopeId: clean(input.envelopeId, "envelope_id", 300),
    approvedAt: approvedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    approvedBy: clean(input.approvedBy, "approved_by", 300),
    material,
    materialSha256,
    ...(approvalBinding ? { approvalBinding } : {}),
  });
}

export function verifyCommunicationApprovalBinding(envelope: CommunicationSendEnvelope): Readonly<{ ok: boolean; reasons: readonly string[] }> {
  const reasons: string[] = [];
  const binding = envelope.approvalBinding;
  if (!binding) return Object.freeze({ ok: false, reasons: Object.freeze(["approval_binding_missing"]) });

  const expected = buildApprovalBinding({
    materialSha256: envelope.materialSha256,
    senderKey: binding.senderKey,
    mailboxKey: binding.mailboxKey,
    decisionPackageId: binding.decisionPackageId,
    evidenceIds: binding.evidenceIds,
    approvalEvidenceIds: binding.approvalEvidenceIds,
    writingProvenance: binding.writingProvenance,
  });
  if (expected.bindingSha256 !== binding.bindingSha256) reasons.push("approval_binding_integrity_failed");
  if (communicationSendMaterialHash(envelope.material) !== envelope.materialSha256) reasons.push("approved_material_integrity_failed");
  const sender = EVAVO_COMMUNICATION_SENDERS[binding.senderKey];
  if (!sender || normaliseAddress(sender.address) !== envelope.material.sender) reasons.push("approval_sender_identity_mismatch");
  if (binding.mailboxKey !== binding.senderKey) reasons.push("approval_mailbox_sender_key_mismatch");
  return Object.freeze({ ok: reasons.length === 0, reasons: Object.freeze(reasons) });
}

export function verifyCommunicationSendEnvelope(
  envelope: CommunicationSendEnvelope,
  candidate: CommunicationSendMaterial,
  now = new Date(),
): Readonly<{ ok: boolean; reasons: readonly string[] }> {
  const reasons: string[] = [];
  if (envelope.contract !== BUSINESS_COMMUNICATION_SEND_ENVELOPE_CONTRACT) reasons.push("approval_contract_mismatch");
  if (!Number.isFinite(now.getTime())) reasons.push("approval_verification_time_invalid");
  else if (now.getTime() >= new Date(envelope.expiresAt).getTime()) reasons.push("approval_expired");
  const candidateHash = communicationSendMaterialHash(candidate);
  if (candidateHash !== envelope.materialSha256) reasons.push("approved_material_changed");
  if (communicationSendMaterialHash(envelope.material) !== envelope.materialSha256) reasons.push("approved_material_integrity_failed");
  return Object.freeze({ ok: reasons.length === 0, reasons: Object.freeze([...new Set(reasons)]) });
}

export function assertCommunicationSendApproved(
  envelope: CommunicationSendEnvelope,
  candidate: CommunicationSendMaterial,
  now = new Date(),
): void {
  const result = verifyCommunicationSendEnvelope(envelope, candidate, now);
  if (!result.ok) throw new Error(`COMMUNICATION_SEND_NOT_APPROVED:${result.reasons.join(",")}`);
}
