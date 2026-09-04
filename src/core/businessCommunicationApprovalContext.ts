import type { CommunicationSendEnvelope } from "./businessCommunicationSendEnvelope";

export const BUSINESS_COMMUNICATION_APPROVAL_CONTEXT_CONTRACT = "business_communication_approval_context_v1" as const;

export type ApprovalContextChange = Readonly<{
  id: string;
  occurredAt: string;
  kind:
    | "thread_message"
    | "recipient_identity"
    | "attachment"
    | "commercial_state"
    | "project_state"
    | "role_state"
    | "calendar_state"
    | "obligation"
    | "suppression"
    | "operator_instruction"
    | "other";
  material: boolean;
  summary: string;
  evidenceIds: readonly string[];
}>;

export type ApprovalContextAssessment = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_APPROVAL_CONTEXT_CONTRACT;
  valid: boolean;
  approvedAt: string;
  latestMaterialChangeAt: string | null;
  invalidatingChanges: readonly ApprovalContextChange[];
  reasons: readonly string[];
}>;

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`COMMUNICATION_APPROVAL_CONTEXT_${field.toUpperCase()}_INVALID`);
  return parsed;
}

export function assessCommunicationApprovalContext(input: Readonly<{
  approval: CommunicationSendEnvelope;
  changes: readonly ApprovalContextChange[];
}>): ApprovalContextAssessment {
  const approvedAtMs = timestamp(input.approval.approvedAt, "approved_at");
  const checked = input.changes.map((change) => {
    if (!change.id.trim() || !change.summary.trim()) throw new Error("COMMUNICATION_APPROVAL_CONTEXT_CHANGE_INVALID");
    if (!change.evidenceIds.length) throw new Error("COMMUNICATION_APPROVAL_CONTEXT_CHANGE_EVIDENCE_REQUIRED");
    timestamp(change.occurredAt, "change_at");
    return change;
  });
  const invalidatingChanges = checked
    .filter((change) => change.material && timestamp(change.occurredAt, "change_at") > approvedAtMs)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const latestMaterialChangeAt = invalidatingChanges.at(-1)?.occurredAt ?? null;
  const reasons = invalidatingChanges.map((change) => `new_material_context:${change.kind}:${change.id}`);
  return Object.freeze({
    contract: BUSINESS_COMMUNICATION_APPROVAL_CONTEXT_CONTRACT,
    valid: invalidatingChanges.length === 0,
    approvedAt: input.approval.approvedAt,
    latestMaterialChangeAt,
    invalidatingChanges: Object.freeze(invalidatingChanges),
    reasons: Object.freeze(reasons),
  });
}
