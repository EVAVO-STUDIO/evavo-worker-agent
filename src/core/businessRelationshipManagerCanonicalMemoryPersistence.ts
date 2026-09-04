import type { BrainMemoryIngestionPort } from "./businessBrainMemoryIngestionPort";
import type { CanonicalRelationshipManagerCycle } from "./businessRelationshipManagerCanonicalRuntime";
import {
  persistCanonicalRelationshipManagerCycleToBrain,
  type RelationshipManagerBrainPersistenceRuntimeResult,
} from "./businessRelationshipManagerBrainPersistenceRuntime";

export const BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_MEMORY_PERSISTENCE_CONTRACT =
  "business_relationship_manager_canonical_memory_persistence_v2" as const;

export type CanonicalRelationshipManagerMemoryPersistence = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_MEMORY_PERSISTENCE_CONTRACT;
  canonicalCycleId: string;
  persistence: RelationshipManagerBrainPersistenceRuntimeResult["persistence"];
  durable: true;
  externalEffectPerformed: false;
}>;

/**
 * Compatibility facade for callers that imported the older canonical-memory
 * helper. The actual authority lives in businessRelationshipManagerBrainPersistenceRuntime.
 * This path cannot bypass canonical context readiness, the v2 scoped Brain port,
 * or per-material-observation durability checks.
 */
export async function persistCanonicalRelationshipManagerCycleMemory(input: Readonly<{
  canonicalCycle: CanonicalRelationshipManagerCycle;
  brain: BrainMemoryIngestionPort;
}>): Promise<CanonicalRelationshipManagerMemoryPersistence> {
  const result = await persistCanonicalRelationshipManagerCycleToBrain(input);
  if (!result.durable || result.persistence.blockers.length) {
    throw new Error(`RELATIONSHIP_MANAGER_CANONICAL_MEMORY_NOT_DURABLE:${result.persistence.blockers.join(",")}`);
  }
  if (result.persistence.materialObservations > 0 && result.persistence.recordIds.length === 0) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_MEMORY_RECORDS_REQUIRED");
  }
  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_MEMORY_PERSISTENCE_CONTRACT,
    canonicalCycleId: result.cycleId,
    persistence: result.persistence,
    durable: true,
    externalEffectPerformed: false,
  });
}
