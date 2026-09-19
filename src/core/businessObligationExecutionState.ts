export const BUSINESS_OBLIGATION_EXECUTION_STATE_CONTRACT = "business_obligation_execution_state_v1" as const;

export type BusinessObligationExecutionStatus =
  | "unrouted"
  | "planned"
  | "queued"
  | "executor_selected"
  | "admission_pending"
  | "admitted"
  | "executing"
  | "blocked"
  | "verification_required"
  | "succeeded"
  | "failed"
  | "unknown_after_effect";

export type BusinessObligationExecutionState = Readonly<{
  contract: typeof BUSINESS_OBLIGATION_EXECUTION_STATE_CONTRACT;
  obligationId: string;
  actionClass: string;
  capability?: string | null;
  desiredStateRef?: string | null;
  planningEvidenceIds?: readonly string[];
  provider?: string | null;
  canonicalExecutionOwner: string;
  requestId?: string | null;
  jobId?: string | null;
  idempotencyKey: string;
  executorRoute?: string | null;
  status: BusinessObligationExecutionStatus;
  observedAt: string;
  routingEvidenceIds?: readonly string[];
  admissionEvidenceIds: readonly string[];
  executionEvidenceIds: readonly string[];
  postconditionEvidenceIds: readonly string[];
  replaySafetyEvidenceIds?: readonly string[];
  executionAttempted: boolean;
  postconditionVerified: boolean;
  providerReadbackVerified: boolean;
  automaticReplayAllowed: boolean;
  blocker?: string | null;
}>;

export type BusinessObligationExecutionAssessment = Readonly<{
  contract: typeof BUSINESS_OBLIGATION_EXECUTION_STATE_CONTRACT;
  obligationId: string;
  status: BusinessObligationExecutionStatus;
  current: boolean;
  mayClaimActiveExecution: boolean;
  mayClaimCompletion: boolean;
  obligationMayBeSatisfied: boolean;
  requiresReconciliation: boolean;
  automaticReplayAllowed: boolean;
  blocker: string | null;
  evidenceIds: readonly string[];
}>;

const ACTIVE_FRESHNESS_MS = 15 * 60 * 1000;
const EXECUTION_STATUSES = new Set<BusinessObligationExecutionStatus>([
  "unrouted", "planned", "queued", "executor_selected", "admission_pending", "admitted", "executing",
  "blocked", "verification_required", "succeeded", "failed", "unknown_after_effect",
]);

function required(value: string | null | undefined, field: string, max = 500): string {
  const clean = value?.trim() ?? "";
  if (!clean || clean.length > max) throw new Error(`OBLIGATION_EXECUTION_${field.toUpperCase()}_INVALID`);
  return clean;
}

function optional(value: string | null | undefined, max = 500): string | null {
  const clean = value?.trim() ?? "";
  return clean ? clean.slice(0, max) : null;
}

function ids(values: readonly string[] | undefined): readonly string[] {
  return Object.freeze([...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))]);
}

function observedAt(value: string): string {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error("OBLIGATION_EXECUTION_OBSERVED_AT_INVALID");
  return date.toISOString();
}

export function assessBusinessObligationExecutionState(
  input: BusinessObligationExecutionState,
  now = new Date(),
): BusinessObligationExecutionAssessment {
  if (input.contract !== BUSINESS_OBLIGATION_EXECUTION_STATE_CONTRACT) {
    throw new Error("OBLIGATION_EXECUTION_CONTRACT_INVALID");
  }
  if (Number.isNaN(now.getTime())) throw new Error("OBLIGATION_EXECUTION_NOW_INVALID");

  const obligationId = required(input.obligationId, "obligation_id", 240);
  if (!EXECUTION_STATUSES.has(input.status)) throw new Error("OBLIGATION_EXECUTION_STATUS_INVALID");
  required(input.actionClass, "action_class", 240);
  optional(input.capability, 240);
  optional(input.desiredStateRef, 1000);
  required(input.canonicalExecutionOwner, "canonical_execution_owner", 240);
  required(input.idempotencyKey, "idempotency_key", 500);
  optional(input.provider, 240);
  optional(input.requestId, 500);
  optional(input.jobId, 500);
  optional(input.executorRoute, 500);

  const at = observedAt(input.observedAt);
  const planningEvidenceIds = ids(input.planningEvidenceIds);
  const routingEvidenceIds = ids(input.routingEvidenceIds);
  const admissionEvidenceIds = ids(input.admissionEvidenceIds);
  const executionEvidenceIds = ids(input.executionEvidenceIds);
  const postconditionEvidenceIds = ids(input.postconditionEvidenceIds);
  const replaySafetyEvidenceIds = ids(input.replaySafetyEvidenceIds);
  const allEvidence = Object.freeze([
    ...new Set([
      ...planningEvidenceIds,
      ...routingEvidenceIds,
      ...admissionEvidenceIds,
      ...executionEvidenceIds,
      ...postconditionEvidenceIds,
      ...replaySafetyEvidenceIds,
    ]),
  ]);

  const ageMs = now.getTime() - new Date(at).getTime();
  const current = ageMs >= 0 && ageMs <= ACTIVE_FRESHNESS_MS;
  const active = input.status === "admitted" || input.status === "executing";
  const activeEvidenceReady = admissionEvidenceIds.length > 0
    && (input.status !== "executing" || input.executionAttempted);
  const mayClaimActiveExecution = active && current && activeEvidenceReady;

  const completionEvidenceReady = input.status === "succeeded"
    && input.executionAttempted
    && executionEvidenceIds.length > 0
    && input.postconditionVerified
    && input.providerReadbackVerified
    && postconditionEvidenceIds.length > 0;
  const mayClaimCompletion = completionEvidenceReady;

  const requiresReconciliation = input.status === "unknown_after_effect"
    || input.status === "verification_required"
    || (input.status === "succeeded" && !completionEvidenceReady);

  let blocker = optional(input.blocker, 1000);
  if (!blocker) {
    if (active && !current) blocker = "execution_evidence_stale";
    else if (active && !activeEvidenceReady) blocker = "active_execution_evidence_missing";
    else if (input.status === "unrouted") blocker = "executor_route_missing";
    else if (input.status === "planned" || input.status === "queued" || input.status === "executor_selected" || input.status === "admission_pending") blocker = "execution_not_admitted";
    else if (input.status === "blocked") blocker = "execution_blocked";
    else if (input.status === "verification_required") blocker = "provider_postcondition_not_verified";
    else if (input.status === "failed") blocker = "execution_failed";
    else if (input.status === "unknown_after_effect") blocker = "execution_outcome_unknown_reconciliation_required";
    else if (input.status === "succeeded" && !completionEvidenceReady) blocker = "completion_evidence_incomplete";
  }

  const automaticReplayAllowed = input.automaticReplayAllowed === true
    && replaySafetyEvidenceIds.length > 0
    && input.status !== "unknown_after_effect";

  return Object.freeze({
    contract: BUSINESS_OBLIGATION_EXECUTION_STATE_CONTRACT,
    obligationId,
    status: input.status,
    current,
    mayClaimActiveExecution,
    mayClaimCompletion,
    obligationMayBeSatisfied: mayClaimCompletion,
    requiresReconciliation,
    automaticReplayAllowed,
    blocker,
    evidenceIds: allEvidence,
  });
}
