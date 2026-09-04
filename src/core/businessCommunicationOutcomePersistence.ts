import { businessSha256 } from "./businessSha256";

import type { CommunicationOutcomeAssessment } from "./businessCommunicationOutcome";
import {
  communicationOutcomeToMemoryRecord,
  type CommunicationOutcomeMemoryRecord,
} from "./businessCommunicationOutcomeMemory";

export const BUSINESS_COMMUNICATION_OUTCOME_PERSISTENCE_CONTRACT = "business_communication_outcome_persistence_v1" as const;

export type BusinessOutcomeMemoryWriteRequest = Readonly<{
  protocol: "evavo-memory-write-request-v1";
  version: 1;
  requestId: string;
  idempotencyKey: string;
  requestedAt: string;
  actorId: "evavo-worker-agent";
  record: CommunicationOutcomeMemoryRecord & Readonly<{
    recordedAt: string;
    actorId: "evavo-worker-agent";
  }>;
}>;

export type BusinessOutcomeMemoryWriteReceipt = Readonly<{
  protocol: "evavo-memory-write-receipt-v1";
  version: 1;
  requestId: string;
  recordId: string;
  idempotencyKey: string;
  status: "appended" | "idempotent_replay" | "rejected";
  journalPosition: number | string | null;
  recordedAt: string;
  storageAuthority: Readonly<{ system: "evavo-storage"; instanceId: string }>;
  integrity: Readonly<{ recordHash: string; algorithm: "sha256"; immutableJournal: true }>;
  rejection?: Readonly<{ code: string; message: string }>;
}>;

export type BusinessOutcomePersistenceResult = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_OUTCOME_PERSISTENCE_CONTRACT;
  status: "not_eligible" | "persisted" | "rejected";
  durable: boolean;
  recordId: string | null;
  receiptStatus: BusinessOutcomeMemoryWriteReceipt["status"] | null;
  reason: string;
}>;

function stableId(input: readonly string[]): string {
  return businessSha256(input.join("\n")).slice(0, 24);
}

export function buildBusinessOutcomeMemoryWriteRequest(
  assessment: CommunicationOutcomeAssessment,
): BusinessOutcomeMemoryWriteRequest | null {
  const record = communicationOutcomeToMemoryRecord(assessment);
  if (!record) return null;
  const requestedAt = assessment.assessedAt;
  const idempotencyKey = `communication-outcome:${stableId([
    assessment.relationshipId,
    assessment.communicationId,
    assessment.outcome,
    assessment.relationshipEffect,
    ...assessment.evidenceRefs.slice().sort(),
  ])}`;
  const requestId = `memory-write:${stableId([assessment.communicationId, requestedAt, idempotencyKey])}`;
  return Object.freeze({
    protocol: "evavo-memory-write-request-v1",
    version: 1,
    requestId,
    idempotencyKey,
    requestedAt,
    actorId: "evavo-worker-agent",
    record: Object.freeze({
      ...record,
      recordedAt: requestedAt,
      actorId: "evavo-worker-agent",
    }),
  });
}

export function reconcileBusinessOutcomeMemoryReceipt(input: Readonly<{
  assessment: CommunicationOutcomeAssessment;
  request: BusinessOutcomeMemoryWriteRequest | null;
  receipt?: BusinessOutcomeMemoryWriteReceipt | null;
}>): BusinessOutcomePersistenceResult {
  if (!input.request) {
    return Object.freeze({
      contract: BUSINESS_COMMUNICATION_OUTCOME_PERSISTENCE_CONTRACT,
      status: "not_eligible",
      durable: false,
      recordId: null,
      receiptStatus: null,
      reason: "The communication outcome is pending or lacks sufficient evidence for durable learning.",
    });
  }
  if (!input.receipt) throw new Error("BUSINESS_OUTCOME_MEMORY_RECEIPT_REQUIRED");
  if (input.receipt.protocol !== "evavo-memory-write-receipt-v1" || input.receipt.version !== 1) {
    throw new Error("BUSINESS_OUTCOME_MEMORY_RECEIPT_PROTOCOL_INVALID");
  }
  if (input.receipt.requestId !== input.request.requestId) throw new Error("BUSINESS_OUTCOME_MEMORY_RECEIPT_REQUEST_MISMATCH");
  if (input.receipt.idempotencyKey !== input.request.idempotencyKey) throw new Error("BUSINESS_OUTCOME_MEMORY_RECEIPT_IDEMPOTENCY_MISMATCH");
  if (input.receipt.storageAuthority.system !== "evavo-storage") throw new Error("BUSINESS_OUTCOME_MEMORY_STORAGE_AUTHORITY_INVALID");

  if (input.receipt.status === "rejected") {
    return Object.freeze({
      contract: BUSINESS_COMMUNICATION_OUTCOME_PERSISTENCE_CONTRACT,
      status: "rejected",
      durable: false,
      recordId: null,
      receiptStatus: "rejected",
      reason: input.receipt.rejection?.message ?? "EVAVO storage rejected the durable memory write.",
    });
  }

  if (input.receipt.journalPosition === null || !input.receipt.recordId.trim()) {
    throw new Error("BUSINESS_OUTCOME_MEMORY_RECEIPT_DURABILITY_INVALID");
  }
  return Object.freeze({
    contract: BUSINESS_COMMUNICATION_OUTCOME_PERSISTENCE_CONTRACT,
    status: "persisted",
    durable: true,
    recordId: input.receipt.recordId,
    receiptStatus: input.receipt.status,
    reason: input.receipt.status === "idempotent_replay"
      ? "The outcome was already durably stored; retry was safely deduplicated."
      : "The outcome was durably appended to EVAVO memory storage.",
  });
}
