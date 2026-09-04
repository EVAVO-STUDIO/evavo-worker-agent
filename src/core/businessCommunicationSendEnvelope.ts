import { createHash } from "node:crypto";

export const BUSINESS_COMMUNICATION_SEND_ENVELOPE_CONTRACT = "business_communication_send_envelope_v1" as const;

export type ApprovedAttachment = Readonly<{
  artifactId: string;
  filename: string;
  sha256: string;
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

export type CommunicationSendEnvelope = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_SEND_ENVELOPE_CONTRACT;
  envelopeId: string;
  approvedAt: string;
  expiresAt: string;
  approvedBy: string;
  material: CommunicationSendMaterial;
  materialSha256: string;
}>;

function clean(value: string, field: string): string {
  const out = value.trim();
  if (!out) throw new Error(`COMMUNICATION_SEND_${field.toUpperCase()}_REQUIRED`);
  return out;
}

function normaliseAddresses(values: readonly string[] | undefined): readonly string[] {
  return Object.freeze([...(values ?? [])].map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function canonicalMaterial(material: CommunicationSendMaterial): CommunicationSendMaterial {
  const attachments = material.attachments.map((item) => Object.freeze({
    artifactId: clean(item.artifactId, "attachment_artifact_id"),
    filename: clean(item.filename, "attachment_filename"),
    sha256: clean(item.sha256, "attachment_sha256").toLowerCase(),
  }));
  if (attachments.some((item) => !/^[a-f0-9]{64}$/.test(item.sha256))) throw new Error("COMMUNICATION_SEND_ATTACHMENT_HASH_INVALID");
  return Object.freeze({
    sender: clean(material.sender, "sender").toLowerCase(),
    to: normaliseAddresses(material.to),
    cc: normaliseAddresses(material.cc),
    bcc: normaliseAddresses(material.bcc),
    threadId: clean(material.threadId, "thread_id"),
    replyMessageId: material.replyMessageId?.trim() || null,
    subject: material.subject.trim(),
    body: material.body,
    attachments: Object.freeze(attachments),
  });
}

export function communicationSendMaterialHash(material: CommunicationSendMaterial): string {
  const canonical = canonicalMaterial(material);
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function createCommunicationSendEnvelope(input: Readonly<{
  envelopeId: string;
  approvedAt: string;
  expiresAt: string;
  approvedBy: string;
  material: CommunicationSendMaterial;
}>): CommunicationSendEnvelope {
  const approvedAt = new Date(input.approvedAt);
  const expiresAt = new Date(input.expiresAt);
  if (Number.isNaN(approvedAt.getTime()) || Number.isNaN(expiresAt.getTime()) || expiresAt <= approvedAt) {
    throw new Error("COMMUNICATION_SEND_APPROVAL_WINDOW_INVALID");
  }
  const material = canonicalMaterial(input.material);
  if (!material.to.length) throw new Error("COMMUNICATION_SEND_TO_REQUIRED");
  return Object.freeze({
    contract: BUSINESS_COMMUNICATION_SEND_ENVELOPE_CONTRACT,
    envelopeId: clean(input.envelopeId, "envelope_id"),
    approvedAt: approvedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    approvedBy: clean(input.approvedBy, "approved_by"),
    material,
    materialSha256: communicationSendMaterialHash(material),
  });
}

export function verifyCommunicationSendEnvelope(
  envelope: CommunicationSendEnvelope,
  candidate: CommunicationSendMaterial,
  now = new Date(),
): Readonly<{ ok: boolean; reasons: readonly string[] }> {
  const reasons: string[] = [];
  if (envelope.contract !== BUSINESS_COMMUNICATION_SEND_ENVELOPE_CONTRACT) reasons.push("approval_contract_mismatch");
  if (now.getTime() > new Date(envelope.expiresAt).getTime()) reasons.push("approval_expired");
  const candidateHash = communicationSendMaterialHash(candidate);
  if (candidateHash !== envelope.materialSha256) reasons.push("approved_material_changed");
  return Object.freeze({ ok: reasons.length === 0, reasons: Object.freeze(reasons) });
}

export function assertCommunicationSendApproved(
  envelope: CommunicationSendEnvelope,
  candidate: CommunicationSendMaterial,
  now = new Date(),
): void {
  const result = verifyCommunicationSendEnvelope(envelope, candidate, now);
  if (!result.ok) throw new Error(`COMMUNICATION_SEND_NOT_APPROVED:${result.reasons.join(",")}`);
}
