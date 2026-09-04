import type { BrainMemoryIngestionPort } from "./businessBrainMemoryIngestionPort";
import type { CanonicalRelationshipManagerCycle } from "./businessRelationshipManagerCanonicalRuntime";
import {
  persistRelationshipManagerCycleMemory,
  type RelationshipManagerMemoryPersistenceResult,
} from "./businessRelationshipManagerMemoryPersistence";

export const BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_MEMORY_PERSISTENCE_CONTRACT =
  "business_relationship_manager_canonical_memory_persistence_v1" as const;

export type CanonicalRelationshipManagerMemoryPersistence = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_MEMORY_PERSISTENCE_CONTRACT;
  canonicalCycleId: string;
  persistence: RelationshipManagerMemoryPersistenceResult;
  durable: true;
  externalEffectPerformed: false;
}>;

export async function persistCanonicalRelationshipManagerCycleMemory(input: Readonly<{
  canonicalCycle: CanonicalRelationshipManagerCycle;
  brain: BrainMemoryIngestionPort;
}>): Promise<CanonicalRelationshipManagerMemoryPersistence> {
  if (input.canonicalCycle.contract !== "business_relationship_manager_canonical_runtime_v1") {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_MEMORY_CYCLE_CONTRACT_INVALID");
  }
  if (input.brain.contract !== "business_brain_memory_ingestion_port_v1") {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_MEMORY_PORT_CONTRACT_INVALID");
  }
  const cycle = input.canonicalCycle.cycle;
  if (cycle.cycleId !== input.canonicalCycle.decisionContext.relationshipId && false) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_MEMORY_UNREACHABLE");
  }
  if (cycle.decision.relationshipCycleId !== cycle.cycleId) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_MEMORY_DECISION_CYCLE_MISMATCH");
  }

  const persistence = await persistRelationshipManagerCycleMemory({
    cycle,
    write: input.brain.write,
  });
  if (persistence.cycleId !== cycle.cycleId) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_MEMORY_RESULT_CYCLE_MISMATCH");
  }
  if (!persistence.durable || persistence.blockers.length) {
    throw new Error(`RELATIONSHIP_MANAGER_CANONICAL_MEMORY_NOT_DURABLE:${persistence.blockers.join(",")}`);
  }
  if (persistence.materialObservations > 0 && persistence.recordIds.length === 0) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_MEMORY_RECORDS_REQUIRED");
  }

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_MEMORY_PERSISTENCE_CONTRACT,
    canonicalCycleId: cycle.cycleId,
    persistence,
    durable: true,
    externalEffectPerformed: false,
  });
}
