import {
  runCanonicalRelationshipManagerCycleWithOperationsContext,
  type CanonicalRelationshipManagerOperationsContextInput,
  type CanonicalRelationshipManagerOperationsContextResult,
} from "./businessRelationshipManagerCanonicalOperationsContextRuntime";
import {
  type OperationsCoreProviderExecutionSnapshotPort,
  type OperationsCoreProviderExecutionSnapshot,
} from "./businessOperationsCoreProviderExecutionSnapshotPort";
import {
  businessObligationExecutionStateFromOperationsProviderTruth,
} from "./businessOperationsProviderExecutionBridge";
import {
  BUSINESS_OBLIGATION_EXECUTION_STATE_CONTRACT,
  type BusinessObligationExecutionState,
} from "./businessObligationExecutionState";

export const BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_PROVIDER_EXECUTION_RUNTIME_CONTRACT =
  "business_relationship_manager_canonical_provider_execution_runtime_v1" as const;

export type CanonicalProviderExecutionBinding = Readonly<{
  obligationId: string;
  handoffId: string;
}>;

export type CanonicalRelationshipManagerProviderExecutionInput = Readonly<{
  cycle: Omit<CanonicalRelationshipManagerOperationsContextInput["cycle"], "obligationExecutions">;
  context: CanonicalRelationshipManagerOperationsContextInput["context"];
  brain: CanonicalRelationshipManagerOperationsContextInput["brain"];
  operations: CanonicalRelationshipManagerOperationsContextInput["operations"];
  operationsRequired: CanonicalRelationshipManagerOperationsContextInput["operationsRequired"];
  operationsIdentity?: CanonicalRelationshipManagerOperationsContextInput["operationsIdentity"];
  providerExecution: OperationsCoreProviderExecutionSnapshotPort;
  providerExecutionBindings: readonly CanonicalProviderExecutionBinding[];
}>;

export type CanonicalProviderExecutionBindingResult = Readonly<{
  obligationId: string;
  handoffId: string;
  state: "verified" | "not_found" | "provider_unavailable";
  evidenceRef: string | null;
  executionStatus: BusinessObligationExecutionState["status"];
  blocker: string | null;
}>;

export type CanonicalRelationshipManagerProviderExecutionResult = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_PROVIDER_EXECUTION_RUNTIME_CONTRACT;
  providerExecutionBindings: readonly CanonicalProviderExecutionBindingResult[];
  operations: CanonicalRelationshipManagerOperationsContextResult;
  externalEffectPerformed: false;
}>;

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/;

function exactId(value: string, code: string): string {
  const clean = value.trim();
  if (!SAFE_ID.test(clean)) throw new Error(code);
  return clean;
}

function availabilityFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message === "OPERATIONS_PROVIDER_EXECUTION_READ_TIMEOUT"
    || error.message === "OPERATIONS_PROVIDER_EXECUTION_READ_UNAVAILABLE"
    || /^OPERATIONS_PROVIDER_EXECUTION_READ_FAILED:\d{3}$/.test(error.message);
}

function fallbackExecution(
  binding: CanonicalProviderExecutionBinding,
  state: "not_found" | "provider_unavailable",
  observedAt: string,
  evidenceRef: string | null,
): BusinessObligationExecutionState {
  const blocked = state === "provider_unavailable";
  return Object.freeze({
    contract: BUSINESS_OBLIGATION_EXECUTION_STATE_CONTRACT,
    obligationId: binding.obligationId,
    actionClass: "provider.execution",
    provider: "operations_core",
    canonicalExecutionOwner: "EVAVO-STUDIO/evavo-operations-core",
    requestId: null,
    jobId: null,
    idempotencyKey: `provider-execution-observation:${binding.handoffId}`,
    executorRoute: null,
    status: blocked ? "blocked" : "unrouted",
    observedAt,
    admissionEvidenceIds: Object.freeze(evidenceRef ? [evidenceRef] : []),
    executionEvidenceIds: Object.freeze([]),
    postconditionEvidenceIds: Object.freeze([]),
    replaySafetyEvidenceIds: Object.freeze([]),
    executionAttempted: false,
    postconditionVerified: false,
    providerReadbackVerified: false,
    automaticReplayAllowed: false,
    blocker: blocked
      ? "operations_provider_execution_truth_unavailable"
      : "operations_provider_execution_handoff_not_found",
  });
}

function uniqueBindings(values: readonly CanonicalProviderExecutionBinding[]) {
  if (values.length > 40) throw new Error("RELATIONSHIP_MANAGER_PROVIDER_EXECUTION_BINDING_LIMIT");
  const obligationIds = new Set<string>();
  const handoffIds = new Set<string>();
  return Object.freeze(values.map((value) => {
    const obligationId = exactId(value.obligationId, "RELATIONSHIP_MANAGER_PROVIDER_EXECUTION_OBLIGATION_ID_INVALID");
    const handoffId = exactId(value.handoffId, "RELATIONSHIP_MANAGER_PROVIDER_EXECUTION_HANDOFF_ID_INVALID");
    if (obligationIds.has(obligationId)) throw new Error(`RELATIONSHIP_MANAGER_PROVIDER_EXECUTION_DUPLICATE_OBLIGATION:${obligationId}`);
    if (handoffIds.has(handoffId)) throw new Error(`RELATIONSHIP_MANAGER_PROVIDER_EXECUTION_DUPLICATE_HANDOFF:${handoffId}`);
    obligationIds.add(obligationId);
    handoffIds.add(handoffId);
    return Object.freeze({ obligationId, handoffId });
  }));
}

export async function runCanonicalRelationshipManagerCycleWithProviderExecution(
  input: CanonicalRelationshipManagerProviderExecutionInput,
): Promise<CanonicalRelationshipManagerProviderExecutionResult> {
  if (input.providerExecution.contract !== "business_operations_core_provider_execution_snapshot_port_v1") {
    throw new Error("RELATIONSHIP_MANAGER_PROVIDER_EXECUTION_PORT_CONTRACT_INVALID");
  }
  if ((input.cycle as { obligationExecutions?: unknown }).obligationExecutions !== undefined) {
    throw new Error("RELATIONSHIP_MANAGER_PROVIDER_EXECUTION_CALLER_EXECUTION_STATE_FORBIDDEN");
  }

  const bindings = uniqueBindings(input.providerExecutionBindings);
  if (bindings.length && !input.operationsIdentity?.workspaceId) {
    throw new Error("RELATIONSHIP_MANAGER_PROVIDER_EXECUTION_WORKSPACE_ID_REQUIRED");
  }
  const workspaceId = input.operationsIdentity?.workspaceId ?? "";

  const executionStates: BusinessObligationExecutionState[] = [];
  const bindingResults: CanonicalProviderExecutionBindingResult[] = [];
  const evidenceRefs: string[] = [];

  for (const binding of bindings) {
    let snapshot: OperationsCoreProviderExecutionSnapshot | null = null;
    try {
      snapshot = await input.providerExecution.read({ workspaceId, handoffId: binding.handoffId });
    } catch (error) {
      if (!availabilityFailure(error)) throw error;
      const state = fallbackExecution(binding, "provider_unavailable", input.cycle.decisionAt, null);
      executionStates.push(state);
      bindingResults.push(Object.freeze({
        obligationId: binding.obligationId,
        handoffId: binding.handoffId,
        state: "provider_unavailable",
        evidenceRef: null,
        executionStatus: state.status,
        blocker: state.blocker ?? null,
      }));
      continue;
    }

    if (snapshot.evidenceRef) evidenceRefs.push(snapshot.evidenceRef);
    if (snapshot.state === "verified" && snapshot.projection) {
      const state = businessObligationExecutionStateFromOperationsProviderTruth({
        obligationId: binding.obligationId,
        projection: snapshot.projection,
      });
      executionStates.push(state);
      bindingResults.push(Object.freeze({
        obligationId: binding.obligationId,
        handoffId: binding.handoffId,
        state: "verified",
        evidenceRef: snapshot.evidenceRef,
        executionStatus: state.status,
        blocker: state.blocker ?? null,
      }));
      continue;
    }

    const state = fallbackExecution(binding, snapshot.state, snapshot.observedAt, snapshot.evidenceRef);
    executionStates.push(state);
    bindingResults.push(Object.freeze({
      obligationId: binding.obligationId,
      handoffId: binding.handoffId,
      state: snapshot.state,
      evidenceRef: snapshot.evidenceRef,
      executionStatus: state.status,
      blocker: state.blocker ?? null,
    }));
  }

  const operations = await runCanonicalRelationshipManagerCycleWithOperationsContext({
    cycle: Object.freeze({
      ...input.cycle,
      obligationExecutions: Object.freeze(executionStates),
      additionalEvidenceIds: Object.freeze([
        ...(input.cycle.additionalEvidenceIds ?? []),
        ...evidenceRefs,
      ]),
    }),
    context: input.context,
    brain: input.brain,
    operations: input.operations,
    operationsRequired: input.operationsRequired,
    operationsIdentity: input.operationsIdentity,
  });

  const projectedObligationIds = new Set(
    operations.brain.canonicalCycle.cycle.projection.obligations.map((obligation) => obligation.id),
  );
  for (const binding of bindings) {
    if (!projectedObligationIds.has(binding.obligationId)) {
      throw new Error(`RELATIONSHIP_MANAGER_PROVIDER_EXECUTION_OBLIGATION_NOT_IN_CURRENT_PROJECTION:${binding.obligationId}`);
    }
  }

  const decisionAssessments = new Set(
    operations.brain.canonicalCycle.cycle.decision.obligationExecutionAssessments.map((assessment) => assessment.obligationId),
  );
  for (const binding of bindings) {
    if (!decisionAssessments.has(binding.obligationId)) {
      throw new Error(`RELATIONSHIP_MANAGER_PROVIDER_EXECUTION_NOT_BOUND_TO_DECISION:${binding.obligationId}`);
    }
  }

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_PROVIDER_EXECUTION_RUNTIME_CONTRACT,
    providerExecutionBindings: Object.freeze(bindingResults),
    operations,
    externalEffectPerformed: false,
  });
}
