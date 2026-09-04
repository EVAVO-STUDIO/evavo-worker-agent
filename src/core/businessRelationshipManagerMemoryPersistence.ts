import { businessSha256 } from "./businessSha256";
import type { BusinessMemoryIngestionObservation } from "./businessMemoryIngestionObservation";
import type { RelationshipManagerCommunicationCycle } from "./businessRelationshipManagerRuntime";

export const BUSINESS_RELATIONSHIP_MANAGER_MEMORY_PERSISTENCE_CONTRACT = "business_relationship_manager_memory_persistence_v1" as const;

export type RelationshipManagerMemoryIngestionRequest = Readonly<{
  contract: "evavo-memory-ingestion-request-v2";
  requestId: string;
  idempotencyKey: string;
  requestedAt: string;
  cycleId: string;
  observation: BusinessMemoryIngestionObservation;
}>;

export type RelationshipManagerMemoryIngestionReceipt = Readonly<{
  contract: "evavo-memory-ingestion-receipt-v2";
  requestId: string;
  idempotencyKey: string;
  sourceRef: string;
  status: "appended" | "idempotent_replay" | "skipped" | "rejected";
  durable: boolean;
  recordId?: string | null;
  reasons: readonly string[];
}>;

export type RelationshipManagerMemoryWriter = (
  request: RelationshipManagerMemoryIngestionRequest,
) => Promise<RelationshipManagerMemoryIngestionReceipt>;

export type RelationshipManagerMemoryPersistenceResult = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_MEMORY_PERSISTENCE_CONTRACT;
  cycleId: string;
  durable: boolean;
  materialObservations: number;
  durableObservations: number;
  skippedObservations: number;
  rejectedObservations: number;
  recordIds: readonly string[];
  receipts: readonly RelationshipManagerMemoryIngestionReceipt[];
  blockers: readonly string[];
  externalEffectPerformed: false;
}>;

function idempotencyKey(cycleId: string, observation: BusinessMemoryIngestionObservation): string {
  return `relationship-cycle-memory:${businessSha256(JSON.stringify({
    cycleId,
    sourceSystem: observation.sourceSystem,
    sourceRef: observation.sourceRef,
    kind: observation.kind,
    occurredAt: observation.occurredAt,
    summary: observation.summary,
  }))}`;
}

export function buildRelationshipManagerMemoryIngestionRequests(
  cycle: RelationshipManagerCommunicationCycle,
): readonly RelationshipManagerMemoryIngestionRequest[] {
  return Object.freeze(cycle.memoryObservations.map((observation) => {
    const key = idempotencyKey(cycle.cycleId, observation);
    return Object.freeze({
      contract: "evavo-memory-ingestion-request-v2" as const,
      requestId: `memory-ingest:${key.slice(-40)}`,
      idempotencyKey: key,
      requestedAt: cycle.decision.decisionAt,
      cycleId: cycle.cycleId,
      observation,
    });
  }));
}

function validateReceipt(
  request: RelationshipManagerMemoryIngestionRequest,
  receipt: RelationshipManagerMemoryIngestionReceipt,
): RelationshipManagerMemoryIngestionReceipt {
  if (receipt.contract !== "evavo-memory-ingestion-receipt-v2") throw new Error("RELATIONSHIP_MANAGER_MEMORY_RECEIPT_CONTRACT_INVALID");
  if (receipt.requestId !== request.requestId) throw new Error("RELATIONSHIP_MANAGER_MEMORY_RECEIPT_REQUEST_MISMATCH");
  if (receipt.idempotencyKey !== request.idempotencyKey) throw new Error("RELATIONSHIP_MANAGER_MEMORY_RECEIPT_IDEMPOTENCY_MISMATCH");
  if (receipt.sourceRef !== request.observation.sourceRef) throw new Error("RELATIONSHIP_MANAGER_MEMORY_RECEIPT_SOURCE_MISMATCH");
  if ((receipt.status === "appended" || receipt.status === "idempotent_replay") && (!receipt.durable || !receipt.recordId?.trim())) {
    throw new Error("RELATIONSHIP_MANAGER_MEMORY_RECEIPT_DURABILITY_INVALID");
  }
  if ((receipt.status === "skipped" || receipt.status === "rejected") && receipt.durable) {
    throw new Error("RELATIONSHIP_MANAGER_MEMORY_RECEIPT_NONPERSISTED_MARKED_DURABLE");
  }
  if (receipt.status === "rejected" && !receipt.reasons.length) throw new Error("RELATIONSHIP_MANAGER_MEMORY_RECEIPT_REJECTION_REASON_REQUIRED");
  return receipt;
}

export async function persistRelationshipManagerCycleMemory(input: Readonly<{
  cycle: RelationshipManagerCommunicationCycle;
  write: RelationshipManagerMemoryWriter;
}>): Promise<RelationshipManagerMemoryPersistenceResult> {
  const requests = buildRelationshipManagerMemoryIngestionRequests(input.cycle);
  const receipts: RelationshipManagerMemoryIngestionReceipt[] = [];
  const blockers: string[] = [];

  for (const request of requests) {
    let receipt: RelationshipManagerMemoryIngestionReceipt;
    try {
      receipt = validateReceipt(request, await input.write(request));
    } catch (error) {
      const code = error instanceof Error ? error.message : "RELATIONSHIP_MANAGER_MEMORY_WRITE_FAILED";
      blockers.push(`${request.observation.sourceRef}:${code}`);
      continue;
    }
    receipts.push(receipt);
    if (request.observation.material && receipt.status !== "appended" && receipt.status !== "idempotent_replay") {
      blockers.push(`${request.observation.sourceRef}:material_observation_not_durable:${receipt.status}`);
    }
  }

  const materialObservations = requests.filter((request) => request.observation.material).length;
  const durableReceipts = receipts.filter((receipt) => receipt.status === "appended" || receipt.status === "idempotent_replay");
  const durableMaterialRefs = new Set(durableReceipts.map((receipt) => receipt.sourceRef));
  const allMaterialDurable = requests
    .filter((request) => request.observation.material)
    .every((request) => durableMaterialRefs.has(request.observation.sourceRef));

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_MEMORY_PERSISTENCE_CONTRACT,
    cycleId: input.cycle.cycleId,
    durable: allMaterialDurable && blockers.length === 0,
    materialObservations,
    durableObservations: durableReceipts.length,
    skippedObservations: receipts.filter((receipt) => receipt.status === "skipped").length,
    rejectedObservations: receipts.filter((receipt) => receipt.status === "rejected").length + (requests.length - receipts.length),
    recordIds: Object.freeze([...new Set(durableReceipts.map((receipt) => receipt.recordId!).filter(Boolean))]),
    receipts: Object.freeze(receipts),
    blockers: Object.freeze([...new Set(blockers)]),
    externalEffectPerformed: false,
  });
}
