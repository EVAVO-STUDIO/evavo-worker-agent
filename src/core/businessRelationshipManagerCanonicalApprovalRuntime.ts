import type { StaffCommunicationHandoffV2Like } from "./businessStaffCommunicationHandoffV2";
import type { CanonicalRelationshipManagerCycle } from "./businessRelationshipManagerCanonicalRuntime";
import {
  prepareRelationshipManagerCommunicationForApproval,
  type RelationshipManagerApprovalPreparation,
} from "./businessRelationshipManagerApprovalRuntime";

export const BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_RUNTIME_CONTRACT =
  "business_relationship_manager_canonical_approval_runtime_v5" as const;

type LegacyPreparationInput = Parameters<typeof prepareRelationshipManagerCommunicationForApproval>[0];

export type CanonicalRelationshipManagerApprovalPreparation = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_RUNTIME_CONTRACT;
  canonicalCycleId: string;
  candidatePolicyBound: false;
  preparation: RelationshipManagerApprovalPreparation;
  externalEffectPerformed: false;
}>;

function normalizedSet(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.map((value) => value.trim()).filter(Boolean))].sort());
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  const a = normalizedSet(left);
  const b = normalizedSet(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function canonicalDraftSourceRefs(canonical: CanonicalRelationshipManagerCycle): readonly string[] {
  return normalizedSet([
    ...canonical.decisionContext.evidenceRefs,
    ...canonical.cycle.decision.evidenceIds,
    ...canonical.decisionContext.staffBrief.sourceRefs,
  ]);
}

export function assertCanonicalRelationshipManagerApprovalReadiness(
  canonical: CanonicalRelationshipManagerCycle,
): void {
  if (canonical.contract !== "business_relationship_manager_canonical_runtime_v2") {
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
  if (canonical.decisionContext.staffBrief.relationshipId !== canonical.decisionContext.relationshipId) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_STAFF_BRIEF_RELATIONSHIP_MISMATCH");
  }
  if (!canonical.decisionContext.resolutionPlan.ready) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_RESOLUTION_NOT_READY");
  }
  if (canonical.decisionContext.sourceReadiness && !canonical.decisionContext.sourceReadiness.ready) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_SOURCE_READINESS_NOT_READY");
  }
}

export function assertCanonicalRelationshipManagerDraftBinding(input: Readonly<{
  canonical: CanonicalRelationshipManagerCycle;
  handoff: StaffCommunicationHandoffV2Like;
}>): void {
  const expected = input.canonical;
  const handoff = input.handoff.staffContext;
  if (handoff.generatedAt !== expected.decisionContext.generatedAt) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_CONTEXT_CHANGED_AFTER_DRAFT");
  }
  if (handoff.decisionPackageId !== expected.cycle.decision.packageId) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_DRAFT_DECISION_MISMATCH");
  }
  if (handoff.relationshipCycleId !== expected.cycle.cycleId) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_DRAFT_CYCLE_MISMATCH");
  }
  if (!sameSet(handoff.sourceRefs, canonicalDraftSourceRefs(expected))) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_SOURCE_CONTEXT_CHANGED_AFTER_DRAFT");
  }
}

export function prepareCanonicalRelationshipManagerCommunicationForApproval(
  input: Omit<LegacyPreparationInput, "cycle"> & Readonly<{
    canonicalCycle: CanonicalRelationshipManagerCycle;
  }>,
): CanonicalRelationshipManagerApprovalPreparation {
  const canonical = input.canonicalCycle;
  assertCanonicalRelationshipManagerApprovalReadiness(canonical);
  if (canonical.cycle.decision.scenario === "graduate_or_candidate") {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_CANDIDATE_SPECIALIZED_RUNTIME_REQUIRED");
  }
  assertCanonicalRelationshipManagerDraftBinding({ canonical, handoff: input.handoff });

  const { canonicalCycle: _canonicalCycle, ...preparationInput } = input;
  const preparation = prepareRelationshipManagerCommunicationForApproval({
    ...preparationInput,
    cycle: canonical.cycle,
  });
  if (preparation.cycleId !== canonical.cycle.cycleId || preparation.decisionPackageId !== canonical.cycle.decision.packageId) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_PREPARATION_IDENTITY_MISMATCH");
  }

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_RUNTIME_CONTRACT,
    canonicalCycleId: canonical.cycle.cycleId,
    candidatePolicyBound: false,
    preparation,
    externalEffectPerformed: false,
  });
}
