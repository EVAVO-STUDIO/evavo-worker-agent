import type { BrainMemoryIngestionPort } from "./businessBrainMemoryIngestionPort";
import type { CanonicalRelationshipManagerCycle } from "./businessRelationshipManagerCanonicalRuntime";
import {
  persistRelationshipManagerCycleMemory,
  type RelationshipManagerMemoryPersistenceResult,
} from "./businessRelationshipManagerMemoryPersistence";

export const BUSINESS_RELATIONSHIP_MANAGER_BRAIN_PERSISTENCE_RUNTIME_CONTRACT =
  "business_relationship_manager_brain_persistence_runtime_v2" as const;

export type RelationshipManagerBrainPersistenceRuntimeResult = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_BRAIN_PERSISTENCE_RUNTIME_CONTRACT;
  cycleId: string;
  decisionPackageId: string;
  decisionContextContract: CanonicalRelationshipManagerCycle["decisionContext"]["contract"];
  persistence: RelationshipManagerMemoryPersistenceResult;
  durable: boolean;
  externalEffectPerformed: false;
}>;

export async function persistCanonicalRelationshipManagerCycleToBrain(input: Readonly<{
  canonicalCycle: CanonicalRelationshipManagerCycle;
  brain: BrainMemoryIngestionPort;
}>): Promise<RelationshipManagerBrainPersistenceRuntimeResult> {
  const canonical = input.canonicalCycle;
  if (canonical.contract !== "business_relationship_manager_canonical_runtime_v1") {
    throw new Error("RELATIONSHIP_MANAGER_BRAIN_PERSISTENCE_CANONICAL_CONTRACT_INVALID");
  }
  if (canonical.cycle.contract !== "business_relationship_manager_runtime_v1") {
    throw new Error("RELATIONSHIP_MANAGER_BRAIN_PERSISTENCE_CYCLE_CONTRACT_INVALID");
  }
  if (canonical.cycle.decision.origin !== "relationship_manager_cycle") {
    throw new Error("RELATIONSHIP_MANAGER_BRAIN_PERSISTENCE_DECISION_ORIGIN_INVALID");
  }
  if (canonical.cycle.decision.relationshipCycleId !== canonical.cycle.cycleId) {
    throw new Error("RELATIONSHIP_MANAGER_BRAIN_PERSISTENCE_CYCLE_ID_MISMATCH");
  }
  if (canonical.decisionContext.relationshipId !== canonical.cycle.projection.relationshipId) {
    throw new Error("RELATIONSHIP_MANAGER_BRAIN_PERSISTENCE_RELATIONSHIP_MISMATCH");
  }
  if (!canonical.approvalGradeReady || !canonical.decisionContext.approvalGradeReady || !canonical.cycle.decision.approvalGradeReady) {
    throw new Error("RELATIONSHIP_MANAGER_BRAIN_PERSISTENCE_CANONICAL_CONTEXT_NOT_READY");
  }
  if (input.brain.contract !== "business_brain_memory_ingestion_port_v2") {
    throw new Error("RELATIONSHIP_MANAGER_BRAIN_PERSISTENCE_PORT_CONTRACT_INVALID");
  }

  const persistence = await persistRelationshipManagerCycleMemory({
    cycle: canonical.cycle,
    write: input.brain.write,
  });
  if (persistence.cycleId !== canonical.cycle.cycleId) {
    throw new Error("RELATIONSHIP_MANAGER_BRAIN_PERSISTENCE_RESULT_CYCLE_MISMATCH");
  }

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_BRAIN_PERSISTENCE_RUNTIME_CONTRACT,
    cycleId: canonical.cycle.cycleId,
    decisionPackageId: canonical.cycle.decision.packageId,
    decisionContextContract: canonical.decisionContext.contract,
    persistence,
    durable: persistence.durable,
    externalEffectPerformed: false,
  });
}
