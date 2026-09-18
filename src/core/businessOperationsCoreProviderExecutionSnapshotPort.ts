export const BUSINESS_OPERATIONS_CORE_PROVIDER_EXECUTION_SNAPSHOT_PORT_CONTRACT =
  "business_operations_core_provider_execution_snapshot_port_v1" as const;

const EVIDENCE_PATTERN = /^operations:provider-execution:[a-f0-9]{64}$/;
const WORKSPACE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HANDOFF_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/;
const EXECUTION_STATUSES = new Set([
  "unrouted", "planned", "queued", "admission_pending", "admitted", "executing",
  "blocked", "verification_required", "succeeded", "failed", "unknown_after_effect",
]);

export type OperationsCoreProviderExecutionProjection = Readonly<{
  contract: "evavo_provider_execution_truth_v1";
  handoffId: string;
  providerKey: string;
  action: string;
  canonicalExecutionOwner: string;
  route: string | null;
  requestId: string | null;
  jobId: string | null;
  idempotencyKey: string;
  status:
    | "unrouted" | "planned" | "queued" | "admission_pending" | "admitted" | "executing"
    | "blocked" | "verification_required" | "succeeded" | "failed" | "unknown_after_effect";
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

export type OperationsCoreProviderExecutionAssessment = Readonly<{
  contract: "evavo_provider_execution_truth_v1";
  handoffId: string;
  status: OperationsCoreProviderExecutionProjection["status"];
  current: boolean;
  queuedOnly: boolean;
  activeExecutionProven: boolean;
  completionProven: boolean;
  requiresReconciliation: boolean;
  automaticReplayAllowed: boolean;
  blocker: string | null;
  evidenceIds: readonly string[];
}>;

export type OperationsCoreProviderExecutionSnapshot = Readonly<{
  contract: "evavo-relationship-manager-provider-execution-snapshot-v1";
  state: "verified" | "not_found" | "provider_unavailable";
  workspaceId: string;
  handoffId: string;
  observedAt: string;
  evidenceRef: string;
  projection: OperationsCoreProviderExecutionProjection | null;
  assessment: OperationsCoreProviderExecutionAssessment | null;
  reason?: string;
  providerReads: 0 | 1;
  providerWrites: 0;
  outsideEffects: 0;
}>;

export type OperationsCoreProviderExecutionSnapshotPortConfig = Readonly<{
  baseUrl: string;
  readToken: string;
  timeoutMs?: number;
}>;

export type OperationsCoreProviderExecutionSnapshotFetch = (
  input: string,
  init: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json">>;

export type OperationsCoreProviderExecutionSnapshotPort = Readonly<{
  contract: typeof BUSINESS_OPERATIONS_CORE_PROVIDER_EXECUTION_SNAPSHOT_PORT_CONTRACT;
  read(input: Readonly<{ workspaceId: string; handoffId: string }>): Promise<OperationsCoreProviderExecutionSnapshot>;
}>;

type ApiEnvelope = Readonly<{ ok?: unknown; data?: unknown; error?: unknown }>;

function object(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}
function requiredString(value: unknown, code: string, maximum = 2_000): string {
  if (typeof value !== "string") throw new Error(code);
  const clean = value.trim();
  if (!clean || clean.length > maximum || /[\u0000-\u001f\u007f]/u.test(clean)) throw new Error(code);
  return clean;
}
function optionalString(value: unknown, code: string, maximum = 2_000): string | null {
  if (value === null) return null;
  return requiredString(value, code, maximum);
}
function requiredBoolean(value: unknown, code: string): boolean {
  if (typeof value !== "boolean") throw new Error(code);
  return value;
}
function exactInteger(value: unknown, allowed: readonly number[], code: string): number {
  if (!Number.isSafeInteger(value) || !allowed.includes(Number(value))) throw new Error(code);
  return Number(value);
}
function stringArray(value: unknown, code: string): readonly string[] {
  if (!Array.isArray(value) || value.length > 500) throw new Error(code);
  return Object.freeze(value.map((item) => requiredString(item, code, 1_000)));
}
function iso(value: unknown, code: string): string {
  const clean = requiredString(value, code, 100);
  const time = Date.parse(clean);
  if (!Number.isFinite(time)) throw new Error(code);
  return new Date(time).toISOString();
}
function enumStatus(value: unknown, code: string): OperationsCoreProviderExecutionProjection["status"] {
  if (typeof value !== "string" || !EXECUTION_STATUSES.has(value)) throw new Error(code);
  return value as OperationsCoreProviderExecutionProjection["status"];
}
function baseUrl(value: string): string {
  const clean = value.trim().replace(/\/+$/, "");
  if (!clean) throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_BASE_URL_REQUIRED");
  let parsed: URL;
  try { parsed = new URL(clean); } catch { throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_BASE_URL_INVALID"); }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_BASE_URL_PROTOCOL_INVALID");
  if (parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_BASE_URL_UNSAFE");
  return clean;
}
function token(value: string): string {
  const clean = value.trim();
  if (new TextEncoder().encode(clean).byteLength < 32 || clean.length > 4096) {
    throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_TOKEN_INVALID");
  }
  return clean;
}
function timeout(value: number | undefined): number {
  const result = value ?? 10_000;
  if (!Number.isFinite(result) || result < 250 || result > 60_000) {
    throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_TIMEOUT_INVALID");
  }
  return Math.floor(result);
}
function exactRequest(input: Readonly<{ workspaceId: string; handoffId: string }>) {
  const workspaceId = input.workspaceId.trim();
  const handoffId = input.handoffId.trim();
  if (!WORKSPACE_ID_PATTERN.test(workspaceId)) throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_WORKSPACE_ID_INVALID");
  if (!HANDOFF_ID_PATTERN.test(handoffId)) throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_HANDOFF_ID_INVALID");
  return Object.freeze({ workspaceId, handoffId });
}
function projection(value: unknown, expectedHandoffId: string): OperationsCoreProviderExecutionProjection {
  const raw = object(value, "OPERATIONS_PROVIDER_EXECUTION_READ_PROJECTION_INVALID");
  if (raw.contract !== "evavo_provider_execution_truth_v1") throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_PROJECTION_CONTRACT_INVALID");
  if (raw.handoffId !== expectedHandoffId) throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_PROJECTION_IDENTITY_MISMATCH");
  return Object.freeze({
    contract: "evavo_provider_execution_truth_v1",
    handoffId: expectedHandoffId,
    providerKey: requiredString(raw.providerKey, "OPERATIONS_PROVIDER_EXECUTION_READ_PROVIDER_KEY_INVALID", 240),
    action: requiredString(raw.action, "OPERATIONS_PROVIDER_EXECUTION_READ_ACTION_INVALID", 240),
    canonicalExecutionOwner: requiredString(raw.canonicalExecutionOwner, "OPERATIONS_PROVIDER_EXECUTION_READ_OWNER_INVALID", 240),
    route: optionalString(raw.route, "OPERATIONS_PROVIDER_EXECUTION_READ_ROUTE_INVALID", 500),
    requestId: optionalString(raw.requestId, "OPERATIONS_PROVIDER_EXECUTION_READ_REQUEST_ID_INVALID", 500),
    jobId: optionalString(raw.jobId, "OPERATIONS_PROVIDER_EXECUTION_READ_JOB_ID_INVALID", 500),
    idempotencyKey: requiredString(raw.idempotencyKey, "OPERATIONS_PROVIDER_EXECUTION_READ_IDEMPOTENCY_INVALID", 500),
    status: enumStatus(raw.status, "OPERATIONS_PROVIDER_EXECUTION_READ_STATUS_INVALID"),
    observedAt: iso(raw.observedAt, "OPERATIONS_PROVIDER_EXECUTION_READ_OBSERVED_AT_INVALID"),
    admissionEvidenceIds: stringArray(raw.admissionEvidenceIds, "OPERATIONS_PROVIDER_EXECUTION_READ_ADMISSION_EVIDENCE_INVALID"),
    executionEvidenceIds: stringArray(raw.executionEvidenceIds, "OPERATIONS_PROVIDER_EXECUTION_READ_EXECUTION_EVIDENCE_INVALID"),
    postconditionEvidenceIds: stringArray(raw.postconditionEvidenceIds, "OPERATIONS_PROVIDER_EXECUTION_READ_POSTCONDITION_EVIDENCE_INVALID"),
    replaySafetyEvidenceIds: stringArray(raw.replaySafetyEvidenceIds, "OPERATIONS_PROVIDER_EXECUTION_READ_REPLAY_EVIDENCE_INVALID"),
    executionAttempted: requiredBoolean(raw.executionAttempted, "OPERATIONS_PROVIDER_EXECUTION_READ_EXECUTION_ATTEMPTED_INVALID"),
    postconditionVerified: requiredBoolean(raw.postconditionVerified, "OPERATIONS_PROVIDER_EXECUTION_READ_POSTCONDITION_VERIFIED_INVALID"),
    providerReadbackVerified: requiredBoolean(raw.providerReadbackVerified, "OPERATIONS_PROVIDER_EXECUTION_READ_PROVIDER_READBACK_INVALID"),
    automaticReplayAllowed: requiredBoolean(raw.automaticReplayAllowed, "OPERATIONS_PROVIDER_EXECUTION_READ_AUTOMATIC_REPLAY_INVALID"),
    blocker: optionalString(raw.blocker, "OPERATIONS_PROVIDER_EXECUTION_READ_BLOCKER_INVALID", 1_000),
  });
}
function assessment(value: unknown, expected: OperationsCoreProviderExecutionProjection): OperationsCoreProviderExecutionAssessment {
  const raw = object(value, "OPERATIONS_PROVIDER_EXECUTION_READ_ASSESSMENT_INVALID");
  if (raw.contract !== "evavo_provider_execution_truth_v1") throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_ASSESSMENT_CONTRACT_INVALID");
  if (raw.handoffId !== expected.handoffId || raw.status !== expected.status) {
    throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_ASSESSMENT_IDENTITY_MISMATCH");
  }
  return Object.freeze({
    contract: "evavo_provider_execution_truth_v1",
    handoffId: expected.handoffId,
    status: expected.status,
    current: requiredBoolean(raw.current, "OPERATIONS_PROVIDER_EXECUTION_READ_ASSESSMENT_CURRENT_INVALID"),
    queuedOnly: requiredBoolean(raw.queuedOnly, "OPERATIONS_PROVIDER_EXECUTION_READ_ASSESSMENT_QUEUED_INVALID"),
    activeExecutionProven: requiredBoolean(raw.activeExecutionProven, "OPERATIONS_PROVIDER_EXECUTION_READ_ASSESSMENT_ACTIVE_INVALID"),
    completionProven: requiredBoolean(raw.completionProven, "OPERATIONS_PROVIDER_EXECUTION_READ_ASSESSMENT_COMPLETION_INVALID"),
    requiresReconciliation: requiredBoolean(raw.requiresReconciliation, "OPERATIONS_PROVIDER_EXECUTION_READ_ASSESSMENT_RECONCILIATION_INVALID"),
    automaticReplayAllowed: requiredBoolean(raw.automaticReplayAllowed, "OPERATIONS_PROVIDER_EXECUTION_READ_ASSESSMENT_REPLAY_INVALID"),
    blocker: optionalString(raw.blocker, "OPERATIONS_PROVIDER_EXECUTION_READ_ASSESSMENT_BLOCKER_INVALID", 1_000),
    evidenceIds: stringArray(raw.evidenceIds, "OPERATIONS_PROVIDER_EXECUTION_READ_ASSESSMENT_EVIDENCE_INVALID"),
  });
}
function snapshot(value: unknown, expected: ReturnType<typeof exactRequest>): OperationsCoreProviderExecutionSnapshot {
  const raw = object(value, "OPERATIONS_PROVIDER_EXECUTION_READ_SNAPSHOT_INVALID");
  if (raw.contract !== "evavo-relationship-manager-provider-execution-snapshot-v1") {
    throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_CONTRACT_INVALID");
  }
  const state = raw.state;
  if (state !== "verified" && state !== "not_found" && state !== "provider_unavailable") {
    throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_STATE_INVALID");
  }
  if (raw.workspaceId !== expected.workspaceId || raw.handoffId !== expected.handoffId) {
    throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_IDENTITY_MISMATCH");
  }
  const observedAt = iso(raw.observedAt, "OPERATIONS_PROVIDER_EXECUTION_READ_SNAPSHOT_OBSERVED_AT_INVALID");
  if (Date.parse(observedAt) > Date.now() + 60_000) throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_SNAPSHOT_FUTURE");
  const evidenceRef = requiredString(raw.evidenceRef, "OPERATIONS_PROVIDER_EXECUTION_READ_EVIDENCE_REF_INVALID", 200);
  if (!EVIDENCE_PATTERN.test(evidenceRef)) throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_EVIDENCE_REF_INVALID");
  const providerReads = exactInteger(raw.providerReads, [0, 1], "OPERATIONS_PROVIDER_EXECUTION_READ_PROVIDER_READS_INVALID") as 0 | 1;
  if (raw.providerWrites !== 0 || raw.outsideEffects !== 0) throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_EFFECT_COUNTER_INVALID");

  if (state === "verified") {
    if (raw.projection === null || raw.assessment === null) throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_VERIFIED_WITHOUT_TRUTH");
    const parsedProjection = projection(raw.projection, expected.handoffId);
    const parsedAssessment = assessment(raw.assessment, parsedProjection);
    if (Date.parse(parsedProjection.observedAt) > Date.parse(observedAt)) {
      throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_PROJECTION_NEWER_THAN_SNAPSHOT");
    }
    return Object.freeze({
      contract: "evavo-relationship-manager-provider-execution-snapshot-v1",
      state,
      workspaceId: expected.workspaceId,
      handoffId: expected.handoffId,
      observedAt,
      evidenceRef,
      projection: parsedProjection,
      assessment: parsedAssessment,
      providerReads,
      providerWrites: 0,
      outsideEffects: 0,
    });
  }

  if (raw.projection !== null || raw.assessment !== null) {
    throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_NONVERIFIED_WITH_TRUTH");
  }
  const reason = requiredString(raw.reason, "OPERATIONS_PROVIDER_EXECUTION_READ_REASON_INVALID", 1_000);
  return Object.freeze({
    contract: "evavo-relationship-manager-provider-execution-snapshot-v1",
    state,
    workspaceId: expected.workspaceId,
    handoffId: expected.handoffId,
    observedAt,
    evidenceRef,
    projection: null,
    assessment: null,
    reason,
    providerReads,
    providerWrites: 0,
    outsideEffects: 0,
  });
}

export function createOperationsCoreProviderExecutionSnapshotPort(
  config: OperationsCoreProviderExecutionSnapshotPortConfig,
  fetchFn: OperationsCoreProviderExecutionSnapshotFetch = fetch,
): OperationsCoreProviderExecutionSnapshotPort {
  const root = baseUrl(config.baseUrl);
  const readToken = token(config.readToken);
  const timeoutMs = timeout(config.timeoutMs);
  const endpoint = `${root}/api/v1/internal/relationship-manager/provider-execution-snapshot`;

  return Object.freeze({
    contract: BUSINESS_OPERATIONS_CORE_PROVIDER_EXECUTION_SNAPSHOT_PORT_CONTRACT,
    async read(input) {
      const expected = exactRequest(input);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Pick<Response, "ok" | "status" | "json">;
      try {
        response = await fetchFn(endpoint, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${readToken}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify(expected),
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_TIMEOUT");
        throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_UNAVAILABLE", { cause: error });
      } finally {
        clearTimeout(timer);
      }

      let envelope: ApiEnvelope;
      try { envelope = await response.json() as ApiEnvelope; }
      catch { throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_RESPONSE_INVALID"); }
      if (!response.ok) throw new Error(`OPERATIONS_PROVIDER_EXECUTION_READ_FAILED:${response.status}`);
      if (envelope.ok !== true || envelope.data === undefined) {
        throw new Error("OPERATIONS_PROVIDER_EXECUTION_READ_ENVELOPE_INVALID");
      }
      return snapshot(envelope.data, expected);
    },
  });
}
