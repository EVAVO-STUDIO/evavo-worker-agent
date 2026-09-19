import {
  BUSINESS_OBLIGATION_EXECUTION_STATE_CONTRACT,
  type BusinessObligationExecutionState,
} from "./businessObligationExecutionState";

export const OPERATIONS_PROVIDER_EXECUTION_TRUTH_CONTRACT =
  "evavo_provider_execution_truth_v1" as const;

export type OperationsProviderExecutionProjectionV1 = Readonly<{
  contract: typeof OPERATIONS_PROVIDER_EXECUTION_TRUTH_CONTRACT;
  handoffId: string;
  providerKey: string;
  action: string;
  capability?: string | null;
  desiredStateRef?: string | null;
  planningEvidenceIds?: readonly string[];
  canonicalExecutionOwner: string;
  route: string | null;
  requestId: string | null;
  jobId: string | null;
  idempotencyKey: string;
  status:
    | "unrouted"
    | "planned"
    | "queued"
    | "admission_pending"
    | "admitted"
    | "executing"
    | "blocked"
    | "verification_required"
    | "succeeded"
    | "failed"
    | "unknown_after_effect";
  observedAt: string;
  admissionEvidenceIds: readonly string[];
  executionEvidenceIds: readonly string[];
  postconditionEvidenceIds: readonly string[];
  replaySafetyEvidenceIds: readonly string[];
  executionAttempted: boolean;
  postconditionVerified: boolean;
  providerReadbackVerified: boolean;
  automaticReplayAllowed: boolean;
  blocker: string | null;
}>;

function bounded(value: string | null | undefined, field: string, max = 500): string | null {
  const clean = value?.trim() ?? "";
  if (!clean) return null;
  if (clean.length > max || /[\u0000-\u001f\u007f]/u.test(clean)) {
    throw new Error(`OPERATIONS_PROVIDER_EXECUTION_${field.toUpperCase()}_INVALID`);
  }
  return clean;
}

function evidence(values: readonly string[], field: string): readonly string[] {
  if (!Array.isArray(values) || values.length > 500) {
    throw new Error(`OPERATIONS_PROVIDER_EXECUTION_${field.toUpperCase()}_INVALID`);
  }
  return Object.freeze(values.map((value) => {
    const clean = bounded(value, field, 1_000);
    if (!clean) throw new Error(`OPERATIONS_PROVIDER_EXECUTION_${field.toUpperCase()}_INVALID`);
    return clean;
  }));
}

export function businessObligationExecutionStateFromOperationsProviderTruth(input: Readonly<{
  obligationId: string;
  storedObligationId?: string | null;
  projection: OperationsProviderExecutionProjectionV1;
}>): BusinessObligationExecutionState {
  const obligationId = bounded(input.obligationId, "obligation_id", 240);
  if (!obligationId) throw new Error("OPERATIONS_PROVIDER_EXECUTION_OBLIGATION_ID_REQUIRED");
  const storedObligationId = bounded(input.storedObligationId, "stored_obligation_id", 500);
  if (storedObligationId && storedObligationId !== obligationId) {
    throw new Error("OPERATIONS_PROVIDER_EXECUTION_OBLIGATION_ID_MISMATCH");
  }
  if (input.projection.contract !== OPERATIONS_PROVIDER_EXECUTION_TRUTH_CONTRACT) {
    throw new Error("OPERATIONS_PROVIDER_EXECUTION_CONTRACT_INVALID");
  }

  const providerKey = bounded(input.projection.providerKey, "provider_key", 240);
  const action = bounded(input.projection.action, "action", 240);
  const capability = bounded(input.projection.capability, "capability", 240);
  const desiredStateRef = bounded(input.projection.desiredStateRef, "desired_state_ref", 1_000);
  const owner = bounded(input.projection.canonicalExecutionOwner, "canonical_execution_owner", 240);
  const idempotencyKey = bounded(input.projection.idempotencyKey, "idempotency_key", 500);
  if (!providerKey || !action || !owner || !idempotencyKey) {
    throw new Error("OPERATIONS_PROVIDER_EXECUTION_IDENTITY_INVALID");
  }

  return Object.freeze({
    contract: BUSINESS_OBLIGATION_EXECUTION_STATE_CONTRACT,
    obligationId,
    actionClass: action,
    capability,
    desiredStateRef,
    planningEvidenceIds: evidence(input.projection.planningEvidenceIds ?? [], "planning_evidence"),
    provider: providerKey,
    canonicalExecutionOwner: owner,
    requestId: bounded(input.projection.requestId, "request_id", 500),
    jobId: bounded(input.projection.jobId, "job_id", 500),
    idempotencyKey,
    executorRoute: bounded(input.projection.route, "route", 500),
    status: input.projection.status,
    observedAt: input.projection.observedAt,
    admissionEvidenceIds: evidence(input.projection.admissionEvidenceIds, "admission_evidence"),
    executionEvidenceIds: evidence(input.projection.executionEvidenceIds, "execution_evidence"),
    postconditionEvidenceIds: evidence(input.projection.postconditionEvidenceIds, "postcondition_evidence"),
    replaySafetyEvidenceIds: evidence(input.projection.replaySafetyEvidenceIds, "replay_safety_evidence"),
    executionAttempted: input.projection.executionAttempted,
    postconditionVerified: input.projection.postconditionVerified,
    providerReadbackVerified: input.projection.providerReadbackVerified,
    automaticReplayAllowed: input.projection.automaticReplayAllowed,
    blocker: bounded(input.projection.blocker, "blocker", 1_000),
  });
}

export const operationsProviderExecutionBridgeSafetyContract = Object.freeze({
  canonicalSourceContract: OPERATIONS_PROVIDER_EXECUTION_TRUTH_CONTRACT,
  exactObligationBindingRequired: true,
  storedObligationMismatchRejected: true,
  fuzzyRelationshipMatchingAllowed: false,
  providerCredentialsAccepted: false,
  planningEvidenceIsExecutionEvidence: false,
  queuedIsActiveExecution: false,
  completionRecomputedLocally: true,
  providerReadbackRequiredForCompletion: true,
  automaticReplayOfUnknownEffect: false,
});
