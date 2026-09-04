import type { BrainMemoryIngestionPort } from "./businessBrainMemoryIngestionPort";
import {
  persistRelationshipManagerCycleMemory,
  type RelationshipManagerMemoryPersistenceResult,
} from "./businessRelationshipManagerMemoryPersistence";
import type { RelationshipManagerCommunicationCycle } from "./businessRelationshipManagerRuntime";

export const BUSINESS_RELATIONSHIP_MANAGER_BRAIN_PERSISTENCE_RUNTIME_CONTRACT =
  "business_relationship_manager_brain_persistence_runtime_v1" as const;

export type RelationshipManagerBrainPersistenceRuntimeResult = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_BRAIN_PERSISTENCE_RUNTIME_CONTRACT;
  cycleId: string;
  persistence: RelationshipManagerMemoryPersistenceResult;
  durable: boolean;
  externalEffectPerformed: false;
}>;

export async function persistRelationshipManagerCycleToBrain(input: Readonly<{
  cycle: RelationshipManagerCommunicationCycle;
  brain: BrainMemoryIngestionPort;
}>): Promise<RelationshipManagerBrainPersistenceRuntimeResult> {
  if (input.cycle.contract !== "business_relationship_manager_runtime_v1") {
    throw new Error("RELATIONSHIP_MANAGER_BRAIN_PERSISTENCE_CYCLE_CONTRACT_INVALID");
  }
  if (input.cycle.decision.origin !== "relationship_manager_cycle") {
    throw new Error("RELATIONSHIP_MANAGER_BRAIN_PERSISTENCE_DECISION_ORIGIN_INVALID");
  }
  if (input.cycle.decision.relationshipCycleId !== input.cycle.cycleId) {
    throw new Error("RELATIONSHIP_MANAGER_BRAIN_PERSISTENCE_CYCLE_ID_MISMATCH");
  }
  if (input.brain.contract !== "business_brain_memory_ingestion_port_v1") {
    throw new Error("RELATIONSHIP_MANAGER_BRAIN_PERSISTENCE_PORT_CONTRACT_INVALID");
  }

  const persistence = await persistRelationshipManagerCycleMemory({
    cycle: input.cycle,
    write: input.brain.write,
  });
  if (persistence.cycleId !== input.cycle.cycleId) {
    throw new Error("RELATIONSHIP_MANAGER_BRAIN_PERSISTENCE_RESULT_CYCLE_MISMATCH");
  }

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_BRAIN_PERSISTENCE_RUNTIME_CONTRACT,
    cycleId: input.cycle.cycleId,
    persistence,
    durable: persistence.durable,
    externalEffectPerformed: false,
  });
}
