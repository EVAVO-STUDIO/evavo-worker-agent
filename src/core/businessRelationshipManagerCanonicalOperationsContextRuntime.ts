import type {
  OperationsCoreRelationshipSnapshot,
  OperationsCoreRelationshipSnapshotPort,
} from "./businessOperationsCoreRelationshipSnapshotPort";
import {
  runCanonicalRelationshipManagerCycleWithBrainContext,
  type CanonicalBrainHydratedContextInput,
  type CanonicalRelationshipManagerBrainContextResult,
} from "./businessRelationshipManagerCanonicalBrainContextRuntime";
import type { BrainMemoryContextPort } from "./businessBrainMemoryContextPort";
import type { Relationship360EvidenceItem } from "./businessRelationship360Context";
import type { RelationshipSourceReadinessItem } from "./businessRelationshipSourceReadiness";

export const BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_OPERATIONS_CONTEXT_RUNTIME_CONTRACT =
  "business_relationship_manager_canonical_operations_context_runtime_v1" as const;

export type CanonicalRelationshipManagerOperationsContextInput = Readonly<{
  cycle: Parameters<typeof runCanonicalRelationshipManagerCycleWithBrainContext>[0]["cycle"];
  context: CanonicalBrainHydratedContextInput;
  brain: BrainMemoryContextPort;
  operations: OperationsCoreRelationshipSnapshotPort;
  operationsRequired: boolean;
  operationsIdentity?: Readonly<{
    workspaceId: string;
    commercialClientId?: string | null;
    projectId?: string | null;
  }> | null;
}>;

export type CanonicalRelationshipManagerOperationsContextResult = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_OPERATIONS_CONTEXT_RUNTIME_CONTRACT;
  operationsState: "verified" | "not_found" | "provider_unavailable" | "not_required";
  operationsEvidenceRef: string | null;
  brain: CanonicalRelationshipManagerBrainContextResult;
  externalEffectPerformed: false;
}>;

function withoutOperationsDomain(
  values: readonly RelationshipSourceReadinessItem[] | null | undefined,
): readonly RelationshipSourceReadinessItem[] {
  const input = values ?? [];
  if (input.some((item) => item.domain === "operations")) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_OPERATIONS_CALLER_READINESS_FORBIDDEN");
  }
  return Object.freeze([...input]);
}

function availabilityFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message === "OPERATIONS_RELATIONSHIP_READ_TIMEOUT"
    || error.message === "OPERATIONS_RELATIONSHIP_READ_UNAVAILABLE"
    || /^OPERATIONS_RELATIONSHIP_READ_FAILED:\d{3}$/.test(error.message);
}

function commercialSummary(snapshot: OperationsCoreRelationshipSnapshot): string | undefined {
  const commercial = snapshot.commercial;
  if (!commercial) return undefined;
  const client = commercial.client;
  const parts = [
    client
      ? `${client.name}: ${client.status}, relationship ${client.relationshipStage}, ${client.activeProjectCount} active project${client.activeProjectCount === 1 ? "" : "s"}; readiness ${client.readiness}${client.reviewRequired ? " with review required" : ""}.`
      : "No current client master row matched, but linked commercial records exist.",
    `${commercial.openBriefCount} open brief${commercial.openBriefCount === 1 ? "" : "s"}, ${commercial.proposalCount} proposal${commercial.proposalCount === 1 ? "" : "s"}, ${commercial.acceptedProposalCount} accepted, ${commercial.clientReadyProposalCount} client-ready.`,
  ];
  return parts.join(" ");
}

function projectSummary(snapshot: OperationsCoreRelationshipSnapshot): string | undefined {
  const project = snapshot.project;
  if (!project) return undefined;
  return `${project.code} ${project.title}: ${project.status}, phase ${project.phase}, ${project.progressPercent}% progress, ${project.openWorkItemCount} open work item${project.openWorkItemCount === 1 ? "" : "s"}, ${project.blockedWorkItemCount} blocked, invoice readiness ${project.invoiceReadiness}, operational readiness ${project.readiness}${project.reviewRequired ? ", review required" : ""}.`;
}

function operationsEvidence(snapshot: OperationsCoreRelationshipSnapshot): Relationship360EvidenceItem {
  return Object.freeze({
    id: `operations-snapshot-${snapshot.evidenceRef.slice(-24)}`,
    domain: "operations",
    summary: snapshot.state === "verified"
      ? [commercialSummary(snapshot), projectSummary(snapshot)].filter(Boolean).join(" ")
      : "Operations Core exact relationship/project lookup completed with no matching current persistent record.",
    status: "current",
    authority: "canonical",
    observedAt: snapshot.observedAt,
    sourceRefs: Object.freeze([snapshot.evidenceRef]),
  });
}

function readiness(snapshot: OperationsCoreRelationshipSnapshot): RelationshipSourceReadinessItem {
  if (snapshot.state === "verified") {
    return Object.freeze({
      domain: "operations",
      state: "verified",
      required: true,
      observedAt: snapshot.observedAt,
      sourceRefs: Object.freeze([snapshot.evidenceRef]),
      detail: "Current persistent Operations Core commercial/delivery state was resolved from exact workspace-scoped IDs.",
    });
  }
  if (snapshot.state === "not_found") {
    return Object.freeze({
      domain: "operations",
      state: "not_found",
      required: true,
      absenceAcceptable: false,
      observedAt: snapshot.observedAt,
      sourceRefs: Object.freeze([snapshot.evidenceRef]),
      detail: "The exact Operations Core lookup completed successfully but no matching current record was found; operational truth required by this decision remains unresolved.",
    });
  }
  return Object.freeze({
    domain: "operations",
    state: "provider_unavailable",
    required: true,
    detail: "Operations Core persistent commercial/delivery truth is unavailable; current project/commercial state is unknown.",
  });
}

export async function runCanonicalRelationshipManagerCycleWithOperationsContext(
  input: CanonicalRelationshipManagerOperationsContextInput,
): Promise<CanonicalRelationshipManagerOperationsContextResult> {
  if (input.operations.contract !== "business_operations_core_relationship_snapshot_port_v1") {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_OPERATIONS_PORT_CONTRACT_INVALID");
  }
  const baseReadiness = withoutOperationsDomain(input.context.sourceReadiness);
  if (!input.operationsRequired) {
    const brain = await runCanonicalRelationshipManagerCycleWithBrainContext({
      cycle: input.cycle,
      context: Object.freeze({
        ...input.context,
        sourceReadiness: baseReadiness,
      }),
      brain: input.brain,
    });
    return Object.freeze({
      contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_OPERATIONS_CONTEXT_RUNTIME_CONTRACT,
      operationsState: "not_required",
      operationsEvidenceRef: null,
      brain,
      externalEffectPerformed: false,
    });
  }

  const identity = input.operationsIdentity;
  if (!identity) throw new Error("RELATIONSHIP_MANAGER_CANONICAL_OPERATIONS_IDENTITY_REQUIRED");
  let snapshot: OperationsCoreRelationshipSnapshot | null = null;
  let operationsState: Exclude<CanonicalRelationshipManagerOperationsContextResult["operationsState"], "not_required"> = "provider_unavailable";
  let operationsReadiness: RelationshipSourceReadinessItem;
  let evidence: Relationship360EvidenceItem | null = null;

  try {
    snapshot = await input.operations.read(identity);
    operationsState = snapshot.state;
    operationsReadiness = readiness(snapshot);
    if (snapshot.state !== "provider_unavailable") evidence = operationsEvidence(snapshot);
  } catch (error) {
    if (!availabilityFailure(error)) throw error;
    operationsReadiness = Object.freeze({
      domain: "operations",
      state: "provider_unavailable",
      required: true,
      detail: "Operations Core relationship snapshot could not be queried; current commercial/project truth is unknown.",
    });
  }

  const context: CanonicalBrainHydratedContextInput = Object.freeze({
    ...input.context,
    ...(snapshot?.commercial ? { commercialSummary: commercialSummary(snapshot) } : {}),
    ...(snapshot?.project ? { projectSummary: projectSummary(snapshot) } : {}),
    evidenceItems: Object.freeze([
      ...input.context.evidenceItems,
      ...(evidence ? [evidence] : []),
    ]),
    sourceReadiness: Object.freeze([...baseReadiness, operationsReadiness]),
  });
  const brain = await runCanonicalRelationshipManagerCycleWithBrainContext({
    cycle: input.cycle,
    context,
    brain: input.brain,
  });
  if (operationsState !== "verified" && brain.canonicalCycle.approvalGradeReady) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_OPERATIONS_READINESS_WIDENED");
  }

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_OPERATIONS_CONTEXT_RUNTIME_CONTRACT,
    operationsState,
    operationsEvidenceRef: snapshot?.evidenceRef ?? null,
    brain,
    externalEffectPerformed: false,
  });
}
