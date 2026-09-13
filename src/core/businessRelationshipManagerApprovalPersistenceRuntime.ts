import type { EvavoStorageApprovalCandidatePort } from "./businessEvavoStorageApprovalCandidatePort";
import {
  bindRelationshipManagerApprovalCandidatePersistence,
  type RelationshipManagerApprovalPreparation,
  type RelationshipManagerPersistedApprovalPreparation,
} from "./businessRelationshipManagerApprovalRuntime";

export const BUSINESS_RELATIONSHIP_MANAGER_APPROVAL_PERSISTENCE_RUNTIME_CONTRACT =
  "business_relationship_manager_approval_persistence_runtime_v1" as const;

export type RelationshipManagerApprovalPersistenceRuntimeResult = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_APPROVAL_PERSISTENCE_RUNTIME_CONTRACT;
  preparation: RelationshipManagerPersistedApprovalPreparation;
  externalEffectPerformed: false;
}>;

/**
 * Canonical persistence transition for an approval candidate. The caller
 * supplies the configured EVAVO Storage port; this function persists the exact
 * immutable candidate and immediately binds the returned durable identity back
 * into the approval state machine. No human approval or provider action occurs.
 */
export async function persistRelationshipManagerApprovalCandidate(input: Readonly<{
  preparation: RelationshipManagerApprovalPreparation;
  storage: EvavoStorageApprovalCandidatePort;
}>): Promise<RelationshipManagerApprovalPersistenceRuntimeResult> {
  if (input.preparation.contract !== "business_relationship_manager_approval_runtime_v3") {
    throw new Error("RELATIONSHIP_MANAGER_APPROVAL_PERSISTENCE_PREPARATION_CONTRACT_INVALID");
  }
  if (!input.preparation.readyForCandidatePersistence || input.preparation.readyForHumanApproval) {
    throw new Error("RELATIONSHIP_MANAGER_APPROVAL_PERSISTENCE_PREPARATION_STATE_INVALID");
  }
  if (input.storage.contract !== "business_evavo_storage_approval_candidate_port_v2") {
    throw new Error("RELATIONSHIP_MANAGER_APPROVAL_PERSISTENCE_STORAGE_PORT_INVALID");
  }

  const persistence = await input.storage.persist(input.preparation.approvalCandidate);
  const preparation = bindRelationshipManagerApprovalCandidatePersistence({
    preparation: input.preparation,
    persistence,
  });

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_APPROVAL_PERSISTENCE_RUNTIME_CONTRACT,
    preparation,
    externalEffectPerformed: false,
  });
}
