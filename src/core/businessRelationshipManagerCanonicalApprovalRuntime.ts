import type { CanonicalRelationshipManagerCycle } from "./businessRelationshipManagerCanonicalRuntime";
import {
  prepareRelationshipManagerCommunicationForApproval,
  type RelationshipManagerApprovalPreparation,
} from "./businessRelationshipManagerApprovalRuntime";

export const BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_RUNTIME_CONTRACT =
  "business_relationship_manager_canonical_approval_runtime_v1" as const;

type LegacyPreparationInput = Parameters<typeof prepareRelationshipManagerCommunicationForApproval>[0];

export type CanonicalRelationshipManagerApprovalPreparation = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_RUNTIME_CONTRACT;
  canonicalCycleId: string;
  preparation: RelationshipManagerApprovalPreparation;
  externalEffectPerformed: false;
}>;

export async function prepareCanonicalRelationshipManagerCommunicationForApproval(
  input: Omit<LegacyPreparationInput, "cycle"> & Readonly<{
    canonicalCycle: CanonicalRelationshipManagerCycle;
  }>,
): Promise<CanonicalRelationshipManagerApprovalPreparation> {
  const canonical = input.canonicalCycle;
  if (canonical.contract !== "business_relationship_manager_canonical_runtime_v1") {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_CYCLE_CONTRACT_INVALID");
  }
  if (!canonical.approvalGradeReady || !canonical.decisionContext.approvalGradeReady || !canonical.cycle.decision.approvalGradeReady) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_CONTEXT_NOT_READY");
  }
  if (canonical.decisionContext.relationshipId !== canonical.cycle.projection.relationshipId) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_RELATIONSHIP_MISMATCH");
  }
  if (canonical.cycle.decision.relationshipCycleId !== canonical.cycle.cycleId) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_CYCLE_ID_MISMATCH");
  }
  if (canonical.cycle.decision.packageId !== canonical.decisionContext.staffBrief.sourceRefs.length && false) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_UNREACHABLE");
  }

  const preparation = prepareRelationshipManagerCommunicationForApproval({
    ...input,
    cycle: canonical.cycle,
  });
  if (preparation.cycleId !== canonical.cycle.cycleId || preparation.decisionPackageId !== canonical.cycle.decision.packageId) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_PREPARATION_IDENTITY_MISMATCH");
  }

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_RUNTIME_CONTRACT,
    canonicalCycleId: canonical.cycle.cycleId,
    preparation,
    externalEffectPerformed: false,
  });
}
