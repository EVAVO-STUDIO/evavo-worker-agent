import type { BrainMemoryContextPort } from "./businessBrainMemoryContextPort";
import {
  roleOpeningEvidenceFromCareersSnapshot,
  type CareersRoleTruthPort,
  type CareersRoleTruthSnapshot,
} from "./businessCareersRoleTruthPort";
import type { OperationsCoreRelationshipSnapshotPort } from "./businessOperationsCoreRelationshipSnapshotPort";
import {
  resolveRoleOpeningTruth,
  type RoleOpeningTruth,
} from "./businessRoleOpeningTruth";
import {
  runCanonicalRelationshipManagerCycleWithOperationsContext,
  type CanonicalRelationshipManagerOperationsContextInput,
  type CanonicalRelationshipManagerOperationsContextResult,
} from "./businessRelationshipManagerCanonicalOperationsContextRuntime";
import type { RelationshipSourceReadinessItem } from "./businessRelationshipSourceReadiness";

export const BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_CAREERS_CONTEXT_RUNTIME_CONTRACT =
  "business_relationship_manager_canonical_careers_context_runtime_v1" as const;

export type CanonicalRelationshipManagerCareersContextInput = Readonly<{
  cycle: CanonicalRelationshipManagerOperationsContextInput["cycle"];
  context: CanonicalRelationshipManagerOperationsContextInput["context"];
  brain: BrainMemoryContextPort;
  operations: OperationsCoreRelationshipSnapshotPort;
  operationsRequired: boolean;
  operationsIdentity?: CanonicalRelationshipManagerOperationsContextInput["operationsIdentity"];
  careers: CareersRoleTruthPort;
  careersRequired: boolean;
  careersIdentity?: Readonly<{
    workspaceId: string;
    targetRoleId?: string | null;
    targetRoleKey?: string | null;
  }> | null;
}>;

export type CanonicalRelationshipManagerCareersContextResult = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_CAREERS_CONTEXT_RUNTIME_CONTRACT;
  careersState: "verified" | "not_found" | "provider_unavailable" | "not_required";
  careersEvidenceRef: string | null;
  roleTruth: RoleOpeningTruth | null;
  canonical: CanonicalRelationshipManagerOperationsContextResult;
  externalEffectPerformed: false;
}>;

function withoutCareersDomain(
  values: readonly RelationshipSourceReadinessItem[] | null | undefined,
): readonly RelationshipSourceReadinessItem[] {
  const input = values ?? [];
  if (input.some((item) => item.domain === "careers")) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CAREERS_CALLER_READINESS_FORBIDDEN");
  }
  return Object.freeze([...input]);
}

function availabilityFailure(error: unknown) {
  return error instanceof Error && (
    error.message === "CAREERS_ROLE_TRUTH_READ_TIMEOUT"
    || error.message === "CAREERS_ROLE_TRUTH_READ_UNAVAILABLE"
    || /^CAREERS_ROLE_TRUTH_READ_FAILED:\d{3}$/.test(error.message)
  );
}

function readiness(snapshot: CareersRoleTruthSnapshot): RelationshipSourceReadinessItem {
  if (snapshot.state === "verified") {
    return Object.freeze({
      domain: "careers",
      state: "verified",
      required: true,
      observedAt: snapshot.observedAt,
      sourceRefs: Object.freeze([snapshot.evidenceRef]),
      detail: "Dedicated persistent careers role-state truth was queried successfully.",
    });
  }
  if (snapshot.state === "not_found") {
    return Object.freeze({
      domain: "careers",
      state: "not_found",
      required: true,
      absenceAcceptable: true,
      observedAt: snapshot.observedAt,
      sourceRefs: Object.freeze([snapshot.evidenceRef]),
      detail: "Dedicated careers truth was queried successfully and returned no matching role. This supports only that no confirmed opening was found; it does not support a company-wide not-hiring claim.",
    });
  }
  return Object.freeze({
    domain: "careers",
    state: "provider_unavailable",
    required: true,
    detail: "Dedicated careers role-state truth is unavailable; current role-opening status is unknown.",
  });
}

export async function runCanonicalRelationshipManagerCycleWithCareersContext(
  input: CanonicalRelationshipManagerCareersContextInput,
): Promise<CanonicalRelationshipManagerCareersContextResult> {
  if (input.careers.contract !== "business_careers_role_truth_port_v1") {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CAREERS_PORT_CONTRACT_INVALID");
  }
  const baseReadiness = withoutCareersDomain(input.context.sourceReadiness);
  if (!input.careersRequired) {
    const canonical = await runCanonicalRelationshipManagerCycleWithOperationsContext({
      cycle: input.cycle,
      context: Object.freeze({ ...input.context, sourceReadiness: baseReadiness }),
      brain: input.brain,
      operations: input.operations,
      operationsRequired: input.operationsRequired,
      operationsIdentity: input.operationsIdentity,
    });
    return Object.freeze({
      contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_CAREERS_CONTEXT_RUNTIME_CONTRACT,
      careersState: "not_required",
      careersEvidenceRef: null,
      roleTruth: null,
      canonical,
      externalEffectPerformed: false,
    });
  }

  if (!input.careersIdentity) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CAREERS_IDENTITY_REQUIRED");
  }

  let snapshot: CareersRoleTruthSnapshot | null = null;
  let careersState: Exclude<CanonicalRelationshipManagerCareersContextResult["careersState"], "not_required"> = "provider_unavailable";
  let careersReadiness: RelationshipSourceReadinessItem;
  let roleTruth: RoleOpeningTruth | null = null;
  try {
    snapshot = await input.careers.read(input.careersIdentity);
    careersState = snapshot.state;
    careersReadiness = readiness(snapshot);
    if (snapshot.state !== "provider_unavailable") {
      const evidence = roleOpeningEvidenceFromCareersSnapshot(snapshot);
      roleTruth = resolveRoleOpeningTruth({
        evidence,
        targetRoleId: snapshot.targetRoleId,
      });
    }
  } catch (error) {
    if (!availabilityFailure(error)) throw error;
    careersReadiness = Object.freeze({
      domain: "careers",
      state: "provider_unavailable",
      required: true,
      detail: "Dedicated careers truth could not be queried; current role-opening status is unknown.",
    });
  }

  const canonical = await runCanonicalRelationshipManagerCycleWithOperationsContext({
    cycle: input.cycle,
    context: Object.freeze({
      ...input.context,
      sourceReadiness: Object.freeze([...baseReadiness, careersReadiness]),
    }),
    brain: input.brain,
    operations: input.operations,
    operationsRequired: input.operationsRequired,
    operationsIdentity: input.operationsIdentity,
  });
  if (careersState === "provider_unavailable" && canonical.brain.canonicalCycle.approvalGradeReady) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CAREERS_READINESS_WIDENED");
  }
  if (roleTruth?.maySayNotHiring) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CAREERS_GLOBAL_NOT_HIRING_AUTHORITY_FORBIDDEN");
  }

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_CAREERS_CONTEXT_RUNTIME_CONTRACT,
    careersState,
    careersEvidenceRef: snapshot?.evidenceRef ?? null,
    roleTruth,
    canonical,
    externalEffectPerformed: false,
  });
}
