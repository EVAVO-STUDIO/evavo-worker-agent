import type { MailboxKey } from "./businessMailboxRegistry";
import type { CommunicationSenderKey } from "./businessCommunicationSenderIdentity";
import type { CommunicationSendEnvelope } from "./businessCommunicationSendEnvelope";

export const BUSINESS_COMMUNICATION_OPERATOR_APPROVAL_CONTRACT = "business_communication_operator_approval_v1" as const;

export type OperatorCommunicationApprovalReceipt = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_OPERATOR_APPROVAL_CONTRACT;
  approvalId: string;
  authority: "human_operator";
  approverId: string;
  approvedAt: string;
  expiresAt: string;
  materialSha256: string;
  decisionPackageId: string;
  senderKey: CommunicationSenderKey;
  mailboxKey: MailboxKey;
  evidenceRefs: readonly string[];
  sourceSystem: "operator_approval" | "evavo_control_plane";
}>;

function text(value: string, field: string, max = 1000): string {
  const clean = value.trim();
  if (!clean || clean.length > max) throw new Error(`COMMUNICATION_OPERATOR_APPROVAL_${field.toUpperCase()}_INVALID`);
  return clean;
}

function iso(value: string, field: string): string {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) throw new Error(`COMMUNICATION_OPERATOR_APPROVAL_${field.toUpperCase()}_INVALID`);
  return parsed.toISOString();
}

function sha256(value: string, field: string): string {
  const clean = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(clean)) throw new Error(`COMMUNICATION_OPERATOR_APPROVAL_${field.toUpperCase()}_INVALID`);
  return clean;
}

export function validateOperatorCommunicationApprovalReceipt(
  receipt: OperatorCommunicationApprovalReceipt,
): OperatorCommunicationApprovalReceipt {
  if (receipt.contract !== BUSINESS_COMMUNICATION_OPERATOR_APPROVAL_CONTRACT) throw new Error("COMMUNICATION_OPERATOR_APPROVAL_CONTRACT_INVALID");
  if (receipt.authority !== "human_operator") throw new Error("COMMUNICATION_OPERATOR_APPROVAL_AUTHORITY_INVALID");
  if (receipt.sourceSystem !== "operator_approval" && receipt.sourceSystem !== "evavo_control_plane") {
    throw new Error("COMMUNICATION_OPERATOR_APPROVAL_SOURCE_INVALID");
  }
  const approvedAt = iso(receipt.approvedAt, "approved_at");
  const expiresAt = iso(receipt.expiresAt, "expires_at");
  if (expiresAt <= approvedAt) throw new Error("COMMUNICATION_OPERATOR_APPROVAL_WINDOW_INVALID");
  const evidenceRefs = Object.freeze([...new Set(receipt.evidenceRefs.map((item) => item.trim()).filter(Boolean))].sort());
  if (!evidenceRefs.length) throw new Error("COMMUNICATION_OPERATOR_APPROVAL_EVIDENCE_REQUIRED");
  return Object.freeze({
    contract: BUSINESS_COMMUNICATION_OPERATOR_APPROVAL_CONTRACT,
    approvalId: text(receipt.approvalId, "approval_id", 300),
    authority: "human_operator",
    approverId: text(receipt.approverId, "approver_id", 300),
    approvedAt,
    expiresAt,
    materialSha256: sha256(receipt.materialSha256, "material_hash"),
    decisionPackageId: text(receipt.decisionPackageId, "decision_package_id", 300),
    senderKey: receipt.senderKey,
    mailboxKey: receipt.mailboxKey,
    evidenceRefs,
    sourceSystem: receipt.sourceSystem,
  });
}

export function verifyOperatorApprovalAgainstSendEnvelope(input: Readonly<{
  receipt: OperatorCommunicationApprovalReceipt | null | undefined;
  envelope: CommunicationSendEnvelope;
  now: Date;
}>): Readonly<{ valid: boolean; reasons: readonly string[] }> {
  const reasons: string[] = [];
  if (!input.receipt) return Object.freeze({ valid: false, reasons: Object.freeze(["operator_approval_receipt_missing"]) });
  let receipt: OperatorCommunicationApprovalReceipt;
  try {
    receipt = validateOperatorCommunicationApprovalReceipt(input.receipt);
  } catch {
    return Object.freeze({ valid: false, reasons: Object.freeze(["operator_approval_receipt_invalid"]) });
  }
  const binding = input.envelope.approvalBinding;
  if (!binding) reasons.push("operator_approval_send_binding_missing");
  if (receipt.materialSha256 !== input.envelope.materialSha256) reasons.push("operator_approval_material_mismatch");
  if (receipt.approvedAt !== input.envelope.approvedAt) reasons.push("operator_approval_time_mismatch");
  if (receipt.expiresAt !== input.envelope.expiresAt) reasons.push("operator_approval_expiry_mismatch");
  if (receipt.approverId !== input.envelope.approvedBy) reasons.push("operator_approval_approver_mismatch");
  if (binding && receipt.decisionPackageId !== binding.decisionPackageId) reasons.push("operator_approval_decision_mismatch");
  if (binding && receipt.senderKey !== binding.senderKey) reasons.push("operator_approval_sender_mismatch");
  if (binding && receipt.mailboxKey !== binding.mailboxKey) reasons.push("operator_approval_mailbox_mismatch");
  if (binding) {
    const boundEvidence = [...binding.approvalEvidenceIds].sort();
    if (JSON.stringify(boundEvidence) !== JSON.stringify([...receipt.evidenceRefs].sort())) reasons.push("operator_approval_evidence_mismatch");
  }
  if (!Number.isFinite(input.now.getTime())) reasons.push("operator_approval_verification_time_invalid");
  else if (input.now.toISOString() >= receipt.expiresAt) reasons.push("operator_approval_expired");
  return Object.freeze({ valid: reasons.length === 0, reasons: Object.freeze(reasons) });
}
