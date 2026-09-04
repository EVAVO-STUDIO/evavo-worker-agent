export const BUSINESS_COMMUNICATION_LIFECYCLE_RECEIPT_CONTRACT = "business_communication_lifecycle_receipt_v1" as const;

export type CommunicationLifecycleStage =
  | "decided"
  | "approved"
  | "sent"
  | "outcome_observed"
  | "learned"
  | "blocked";

export type CommunicationLifecycleReceipt = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_LIFECYCLE_RECEIPT_CONTRACT;
  lifecycleId: string;
  relationshipId: string;
  threadId: string;
  communicationId: string | null;
  stage: CommunicationLifecycleStage;
  decision: Readonly<{
    packageId: string;
    decisionAt: string;
    disposition: string;
    evidenceIds: readonly string[];
  }>;
  approval: Readonly<{
    envelopeId: string;
    approvedAt: string;
    materialSha256: string;
  }> | null;
  execution: Readonly<{
    provider: string;
    providerMessageId: string;
    sentAt: string;
    sender: string;
    recipientAddresses: readonly string[];
  }> | null;
  outcome: Readonly<{
    assessedAt: string;
    result: "positive" | "neutral" | "negative" | "pending" | "mixed";
    evidenceRefs: readonly string[];
  }> | null;
  memory: Readonly<{
    recordId: string;
    receiptStatus: "appended" | "idempotent_replay";
    storageInstanceId: string;
    recordedAt: string;
  }> | null;
  blockers: readonly string[];
}>;

function text(value: string, field: string): string {
  const clean = value.trim();
  if (!clean) throw new Error(`COMMUNICATION_LIFECYCLE_${field.toUpperCase()}_REQUIRED`);
  return clean;
}

function iso(value: string, field: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`COMMUNICATION_LIFECYCLE_${field.toUpperCase()}_INVALID`);
  return new Date(parsed).toISOString();
}

export function buildCommunicationLifecycleReceipt(input: Readonly<{
  lifecycleId: string;
  relationshipId: string;
  threadId: string;
  decision: CommunicationLifecycleReceipt["decision"];
  approval?: CommunicationLifecycleReceipt["approval"];
  execution?: CommunicationLifecycleReceipt["execution"];
  outcome?: CommunicationLifecycleReceipt["outcome"];
  memory?: CommunicationLifecycleReceipt["memory"];
  blockers?: readonly string[];
}>): CommunicationLifecycleReceipt {
  const blockers = [...new Set((input.blockers ?? []).map((item) => item.trim()).filter(Boolean))];
  const decisionAt = iso(input.decision.decisionAt, "decision_at");
  const approval = input.approval ? Object.freeze({
    envelopeId: text(input.approval.envelopeId, "approval_envelope_id"),
    approvedAt: iso(input.approval.approvedAt, "approved_at"),
    materialSha256: text(input.approval.materialSha256, "material_hash").toLowerCase(),
  }) : null;
  if (approval && approval.approvedAt < decisionAt) throw new Error("COMMUNICATION_LIFECYCLE_APPROVAL_BEFORE_DECISION");

  const execution = input.execution ? Object.freeze({
    provider: text(input.execution.provider, "execution_provider"),
    providerMessageId: text(input.execution.providerMessageId, "provider_message_id"),
    sentAt: iso(input.execution.sentAt, "sent_at"),
    sender: text(input.execution.sender, "sender").toLowerCase(),
    recipientAddresses: Object.freeze([...new Set(input.execution.recipientAddresses.map((item) => item.trim().toLowerCase()).filter(Boolean))]),
  }) : null;
  if (execution && !approval) throw new Error("COMMUNICATION_LIFECYCLE_SEND_WITHOUT_APPROVAL");
  if (execution && execution.sentAt < approval!.approvedAt) throw new Error("COMMUNICATION_LIFECYCLE_SEND_BEFORE_APPROVAL");
  if (execution && !execution.recipientAddresses.length) throw new Error("COMMUNICATION_LIFECYCLE_RECIPIENT_REQUIRED");

  const outcome = input.outcome ? Object.freeze({
    assessedAt: iso(input.outcome.assessedAt, "outcome_at"),
    result: input.outcome.result,
    evidenceRefs: Object.freeze([...new Set(input.outcome.evidenceRefs.map((item) => item.trim()).filter(Boolean))]),
  }) : null;
  if (outcome && !execution) throw new Error("COMMUNICATION_LIFECYCLE_OUTCOME_WITHOUT_SEND");
  if (outcome && outcome.assessedAt < execution!.sentAt) throw new Error("COMMUNICATION_LIFECYCLE_OUTCOME_BEFORE_SEND");
  if (outcome && !outcome.evidenceRefs.length) throw new Error("COMMUNICATION_LIFECYCLE_OUTCOME_EVIDENCE_REQUIRED");

  const memory = input.memory ? Object.freeze({
    recordId: text(input.memory.recordId, "memory_record_id"),
    receiptStatus: input.memory.receiptStatus,
    storageInstanceId: text(input.memory.storageInstanceId, "storage_instance_id"),
    recordedAt: iso(input.memory.recordedAt, "memory_recorded_at"),
  }) : null;
  if (memory && !outcome) throw new Error("COMMUNICATION_LIFECYCLE_MEMORY_WITHOUT_OUTCOME");
  if (memory && outcome!.result === "pending") throw new Error("COMMUNICATION_LIFECYCLE_PENDING_OUTCOME_CANNOT_BE_LEARNED");

  let stage: CommunicationLifecycleStage = "decided";
  if (blockers.length) stage = "blocked";
  else if (memory) stage = "learned";
  else if (outcome) stage = "outcome_observed";
  else if (execution) stage = "sent";
  else if (approval) stage = "approved";

  return Object.freeze({
    contract: BUSINESS_COMMUNICATION_LIFECYCLE_RECEIPT_CONTRACT,
    lifecycleId: text(input.lifecycleId, "lifecycle_id"),
    relationshipId: text(input.relationshipId, "relationship_id"),
    threadId: text(input.threadId, "thread_id"),
    communicationId: execution?.providerMessageId ?? null,
    stage,
    decision: Object.freeze({
      packageId: text(input.decision.packageId, "decision_package_id"),
      decisionAt,
      disposition: text(input.decision.disposition, "decision_disposition"),
      evidenceIds: Object.freeze([...new Set(input.decision.evidenceIds.map((item) => item.trim()).filter(Boolean))]),
    }),
    approval,
    execution,
    outcome,
    memory,
    blockers: Object.freeze(blockers),
  });
}
