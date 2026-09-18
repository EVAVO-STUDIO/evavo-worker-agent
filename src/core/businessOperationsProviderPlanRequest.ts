import type { BusinessObligation } from "./businessObligationLedger";

export const BUSINESS_OPERATIONS_PROVIDER_PLAN_REQUEST_CONTRACT =
  "business_operations_provider_plan_request_v1" as const;

export type OperationsProviderPlanActionKey = "vercel.desired-state.reconcile";

export type OperationsProviderPlanPreparedRequest = Readonly<{
  contract: typeof BUSINESS_OPERATIONS_PROVIDER_PLAN_REQUEST_CONTRACT;
  endpointPath: "/api/v1/internal/provider-execution/plan";
  method: "POST";
  body: Readonly<{
    binding: Readonly<{
      organisationId: string;
      workspaceId: string;
      obligationId: string;
      taskId?: string | null;
      stepId?: string | null;
      relationshipId?: string | null;
      commercialClientId?: string | null;
      projectId?: string | null;
    }>;
    intent: Readonly<{
      contract: "evavo_provider_execution_intent_v1";
      handoffId: string;
      actionKey: OperationsProviderPlanActionKey;
      idempotencyKey: string;
      requestedAt: string;
      reason: string;
      planningEvidenceIds: readonly string[];
    }>;
  }>;
  obligationId: string;
  submissionRequiresScopedOperationsCredential: true;
  providerEffectPerformed: false;
  externalEffectPerformed: false;
}>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function required(value: string | null | undefined, field: string, max = 1_000): string {
  const clean = value?.trim() ?? "";
  if (!clean || clean.length > max || /[\u0000-\u001f\u007f]/u.test(clean)) {
    throw new Error(`OPERATIONS_PROVIDER_PLAN_REQUEST_${field.toUpperCase()}_INVALID`);
  }
  return clean;
}

function optional(value: string | null | undefined, field: string, max = 500): string | null {
  const clean = value?.trim() ?? "";
  if (!clean) return null;
  if (clean.length > max || /[\u0000-\u001f\u007f]/u.test(clean)) {
    throw new Error(`OPERATIONS_PROVIDER_PLAN_REQUEST_${field.toUpperCase()}_INVALID`);
  }
  return clean;
}

function uuid(value: string, field: string): string {
  const clean = value.trim().toLowerCase();
  if (!UUID_PATTERN.test(clean)) throw new Error(`OPERATIONS_PROVIDER_PLAN_REQUEST_${field.toUpperCase()}_INVALID`);
  return clean;
}

function timestamp(value: string): string {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) {
    throw new Error("OPERATIONS_PROVIDER_PLAN_REQUEST_REQUESTED_AT_INVALID");
  }
  return parsed.toISOString();
}

function evidence(values: readonly string[]): readonly string[] {
  const cleaned = [...new Set(values.map((value) => required(value, "evidence", 1_000)))];
  if (!cleaned.length || cleaned.length > 100) {
    throw new Error("OPERATIONS_PROVIDER_PLAN_REQUEST_EVIDENCE_INVALID");
  }
  return Object.freeze(cleaned);
}

function matchOptionalBinding(
  obligationValue: string | null | undefined,
  suppliedValue: string | null | undefined,
  field: string,
): string | null {
  const obligation = optional(obligationValue, field);
  const supplied = optional(suppliedValue, field);
  if (obligation && supplied && obligation !== supplied) {
    throw new Error(`OPERATIONS_PROVIDER_PLAN_REQUEST_${field.toUpperCase()}_MISMATCH`);
  }
  return supplied ?? obligation;
}

export function prepareOperationsProviderPlanRequest(input: Readonly<{
  organisationId: string;
  workspaceId: string;
  obligation: BusinessObligation;
  actionKey: OperationsProviderPlanActionKey;
  handoffId: string;
  idempotencyKey: string;
  requestedAt: string;
  reason: string;
  planningEvidenceIds?: readonly string[];
  taskId?: string | null;
  stepId?: string | null;
  relationshipId?: string | null;
  commercialClientId?: string | null;
  projectId?: string | null;
}>): OperationsProviderPlanPreparedRequest {
  if (input.obligation.owner !== "evavo") {
    throw new Error("OPERATIONS_PROVIDER_PLAN_REQUEST_OBLIGATION_OWNER_INVALID");
  }
  if (input.obligation.status !== "open" && input.obligation.status !== "uncertain") {
    throw new Error("OPERATIONS_PROVIDER_PLAN_REQUEST_OBLIGATION_NOT_ACTIVE");
  }
  if (input.actionKey !== "vercel.desired-state.reconcile") {
    throw new Error("OPERATIONS_PROVIDER_PLAN_REQUEST_ACTION_NOT_REGISTERED");
  }

  const organisationId = uuid(input.organisationId, "organisation_id");
  const workspaceId = uuid(input.workspaceId, "workspace_id");
  const obligationId = required(input.obligation.id, "obligation_id", 240);
  const relationshipId = matchOptionalBinding(
    input.obligation.relationshipId,
    input.relationshipId,
    "relationship_id",
  );
  const projectId = matchOptionalBinding(
    input.obligation.projectId,
    input.projectId,
    "project_id",
  );
  const planningEvidenceIds = evidence([
    ...input.obligation.sourceEvidenceIds,
    ...(input.planningEvidenceIds ?? []),
  ]);

  return Object.freeze({
    contract: BUSINESS_OPERATIONS_PROVIDER_PLAN_REQUEST_CONTRACT,
    endpointPath: "/api/v1/internal/provider-execution/plan",
    method: "POST",
    body: Object.freeze({
      binding: Object.freeze({
        organisationId,
        workspaceId,
        obligationId,
        taskId: optional(input.taskId, "task_id"),
        stepId: optional(input.stepId, "step_id"),
        relationshipId,
        commercialClientId: optional(input.commercialClientId, "commercial_client_id"),
        projectId,
      }),
      intent: Object.freeze({
        contract: "evavo_provider_execution_intent_v1",
        handoffId: required(input.handoffId, "handoff_id", 240),
        actionKey: input.actionKey,
        idempotencyKey: required(input.idempotencyKey, "idempotency_key", 500),
        requestedAt: timestamp(input.requestedAt),
        reason: required(input.reason, "reason", 1_000),
        planningEvidenceIds,
      }),
    }),
    obligationId,
    submissionRequiresScopedOperationsCredential: true,
    providerEffectPerformed: false,
    externalEffectPerformed: false,
  });
}

export const operationsProviderPlanRequestSafetyContract = Object.freeze({
  activeEvavoObligationRequired: true,
  registeredActionRequired: true,
  exactRelationshipBindingRequiredWhenKnown: true,
  exactProjectBindingRequiredWhenKnown: true,
  scopedOperationsCredentialNotAcceptedInBody: true,
  callerSelectedProviderRouteAccepted: false,
  callerSelectedExecutionOwnerAccepted: false,
  rawProviderPayloadAccepted: false,
  rawProviderPathAccepted: false,
  rawProviderMethodAccepted: false,
  rawCommandAccepted: false,
  providerEffectPerformed: false,
});
