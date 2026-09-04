export const BUSINESS_OPERATIONS_CORE_RELATIONSHIP_SNAPSHOT_PORT_CONTRACT =
  "business_operations_core_relationship_snapshot_port_v1" as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVIDENCE_PATTERN = /^operations:relationship-snapshot:[a-f0-9]{64}$/;
const WORKSPACE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export type OperationsCoreRelationshipSnapshotRequest = Readonly<{
  workspaceId: string;
  commercialClientId?: string | null;
  projectId?: string | null;
}>;

export type OperationsCoreRelationshipClientSnapshot = Readonly<{
  id: string;
  name: string;
  status: "active" | "prospect";
  relationshipStage: "active_delivery" | "qualified" | "discovery";
  summary: string;
  activeProjectCount: number;
  openBriefCount: number;
  proposalCount: number;
  readiness: "available" | "needs_review" | "blocked";
  reviewRequired: boolean;
  updatedAt: string;
}>;

export type OperationsCoreRelationshipProjectSnapshot = Readonly<{
  id: string;
  commercialClientId: string | null;
  code: string;
  clientName: string;
  title: string;
  status: "planned" | "active" | "blocked" | "completed";
  phase: string;
  progressPercent: number;
  milestoneCount: number;
  openWorkItemCount: number;
  blockedWorkItemCount: number;
  linkedWorkOrderCount: number;
  invoiceReadiness: "not_ready" | "review_ready" | "blocked";
  readiness: "available" | "needs_review" | "blocked";
  reviewRequired: boolean;
  clientVisible: boolean;
  updatedAt: string;
}>;

export type OperationsCoreRelationshipCommercialSnapshot = Readonly<{
  client: OperationsCoreRelationshipClientSnapshot | null;
  leadCount: number;
  openBriefCount: number;
  proposalCount: number;
  acceptedProposalCount: number;
  clientReadyProposalCount: number;
  latestCommercialUpdatedAt: string | null;
}>;

export type OperationsCoreRelationshipSnapshot = Readonly<{
  contract: "evavo-relationship-manager-operations-snapshot-v1";
  state: "verified" | "not_found" | "provider_unavailable";
  workspaceId: string;
  commercialClientId: string | null;
  projectId: string | null;
  observedAt: string;
  evidenceRef: string;
  commercial: OperationsCoreRelationshipCommercialSnapshot | null;
  project: OperationsCoreRelationshipProjectSnapshot | null;
  reasons: readonly string[];
  providerReads: number;
  providerWrites: 0;
  externalSends: 0;
  calendarChanges: 0;
  outsideEffects: 0;
}>;

export type OperationsCoreRelationshipSnapshotPortConfig = Readonly<{
  baseUrl: string;
  readToken: string;
  timeoutMs?: number;
}>;

export type OperationsCoreRelationshipSnapshotFetch = (
  input: string,
  init: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json">>;

export type OperationsCoreRelationshipSnapshotPort = Readonly<{
  contract: typeof BUSINESS_OPERATIONS_CORE_RELATIONSHIP_SNAPSHOT_PORT_CONTRACT;
  read(request: OperationsCoreRelationshipSnapshotRequest): Promise<OperationsCoreRelationshipSnapshot>;
}>;

type ApiEnvelope = Readonly<{
  ok?: unknown;
  data?: unknown;
  error?: unknown;
}>;

function object(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, code: string, maximum = 2000): string {
  if (typeof value !== "string") throw new Error(code);
  const clean = value.trim();
  if (!clean || clean.length > maximum) throw new Error(code);
  return clean;
}

function requiredBoolean(value: unknown, code: string): boolean {
  if (typeof value !== "boolean") throw new Error(code);
  return value;
}

function requiredUuid(value: unknown, code: string): string {
  const clean = requiredString(value, code, 100).toLowerCase();
  if (!UUID_PATTERN.test(clean)) throw new Error(code);
  return clean;
}

function baseUrl(value: string): string {
  const clean = value.trim().replace(/\/+$/, "");
  if (!clean) throw new Error("OPERATIONS_RELATIONSHIP_READ_BASE_URL_REQUIRED");
  let parsed: URL;
  try {
    parsed = new URL(clean);
  } catch {
    throw new Error("OPERATIONS_RELATIONSHIP_READ_BASE_URL_INVALID");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("OPERATIONS_RELATIONSHIP_READ_BASE_URL_PROTOCOL_INVALID");
  if (parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("OPERATIONS_RELATIONSHIP_READ_BASE_URL_UNSAFE");
  return clean;
}

function token(value: string): string {
  const clean = value.trim();
  if (new TextEncoder().encode(clean).byteLength < 32 || clean.length > 4096) {
    throw new Error("OPERATIONS_RELATIONSHIP_READ_TOKEN_INVALID");
  }
  return clean;
}

function timeout(value: number | undefined): number {
  const result = value ?? 10_000;
  if (!Number.isFinite(result) || result < 250 || result > 60_000) throw new Error("OPERATIONS_RELATIONSHIP_READ_TIMEOUT_INVALID");
  return Math.floor(result);
}

function exactRequest(input: OperationsCoreRelationshipSnapshotRequest) {
  const workspaceId = input.workspaceId.trim();
  if (!WORKSPACE_ID_PATTERN.test(workspaceId)) throw new Error("OPERATIONS_RELATIONSHIP_READ_WORKSPACE_ID_INVALID");
  const optionalUuid = (value: string | null | undefined, code: string): string | null => {
    const clean = value?.trim() ?? "";
    if (!clean) return null;
    if (!UUID_PATTERN.test(clean)) throw new Error(code);
    return clean.toLowerCase();
  };
  const commercialClientId = optionalUuid(input.commercialClientId, "OPERATIONS_RELATIONSHIP_READ_COMMERCIAL_CLIENT_ID_INVALID");
  const projectId = optionalUuid(input.projectId, "OPERATIONS_RELATIONSHIP_READ_PROJECT_ID_INVALID");
  if (!commercialClientId && !projectId) throw new Error("OPERATIONS_RELATIONSHIP_READ_EXACT_ID_REQUIRED");
  return Object.freeze({ workspaceId, commercialClientId, projectId });
}

function iso(value: unknown, code: string): string {
  const clean = requiredString(value, code, 100);
  const parsed = Date.parse(clean);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return new Date(parsed).toISOString();
}

function nonNegativeInteger(value: unknown, code: string, maximum = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > maximum) throw new Error(code);
  return Number(value);
}

function enumValue<T extends string>(value: unknown, values: readonly T[], code: string): T {
  if (typeof value !== "string" || !(values as readonly string[]).includes(value)) throw new Error(code);
  return value as T;
}

function client(value: unknown): OperationsCoreRelationshipClientSnapshot | null {
  if (value === null) return null;
  const raw = object(value, "OPERATIONS_RELATIONSHIP_READ_CLIENT_INVALID");
  return Object.freeze({
    id: requiredUuid(raw.id, "OPERATIONS_RELATIONSHIP_READ_CLIENT_ID_INVALID"),
    name: requiredString(raw.name, "OPERATIONS_RELATIONSHIP_READ_CLIENT_NAME_INVALID", 300),
    status: enumValue(raw.status, ["active", "prospect"] as const, "OPERATIONS_RELATIONSHIP_READ_CLIENT_STATUS_INVALID"),
    relationshipStage: enumValue(raw.relationshipStage, ["active_delivery", "qualified", "discovery"] as const, "OPERATIONS_RELATIONSHIP_READ_CLIENT_STAGE_INVALID"),
    summary: requiredString(raw.summary, "OPERATIONS_RELATIONSHIP_READ_CLIENT_SUMMARY_INVALID", 4000),
    activeProjectCount: nonNegativeInteger(raw.activeProjectCount, "OPERATIONS_RELATIONSHIP_READ_CLIENT_PROJECT_COUNT_INVALID", 10000),
    openBriefCount: nonNegativeInteger(raw.openBriefCount, "OPERATIONS_RELATIONSHIP_READ_CLIENT_BRIEF_COUNT_INVALID", 10000),
    proposalCount: nonNegativeInteger(raw.proposalCount, "OPERATIONS_RELATIONSHIP_READ_CLIENT_PROPOSAL_COUNT_INVALID", 10000),
    readiness: enumValue(raw.readiness, ["available", "needs_review", "blocked"] as const, "OPERATIONS_RELATIONSHIP_READ_CLIENT_READINESS_INVALID"),
    reviewRequired: requiredBoolean(raw.reviewRequired, "OPERATIONS_RELATIONSHIP_READ_CLIENT_REVIEW_REQUIRED_INVALID"),
    updatedAt: iso(raw.updatedAt, "OPERATIONS_RELATIONSHIP_READ_CLIENT_UPDATED_AT_INVALID"),
  });
}

function commercial(value: unknown): OperationsCoreRelationshipCommercialSnapshot | null {
  if (value === null) return null;
  const raw = object(value, "OPERATIONS_RELATIONSHIP_READ_COMMERCIAL_INVALID");
  const latest = raw.latestCommercialUpdatedAt === null ? null : iso(raw.latestCommercialUpdatedAt, "OPERATIONS_RELATIONSHIP_READ_COMMERCIAL_UPDATED_AT_INVALID");
  const proposalCount = nonNegativeInteger(raw.proposalCount, "OPERATIONS_RELATIONSHIP_READ_PROPOSAL_COUNT_INVALID", 10000);
  const acceptedProposalCount = nonNegativeInteger(raw.acceptedProposalCount, "OPERATIONS_RELATIONSHIP_READ_ACCEPTED_PROPOSAL_COUNT_INVALID", 10000);
  const clientReadyProposalCount = nonNegativeInteger(raw.clientReadyProposalCount, "OPERATIONS_RELATIONSHIP_READ_CLIENT_READY_PROPOSAL_COUNT_INVALID", 10000);
  if (acceptedProposalCount > proposalCount || clientReadyProposalCount > proposalCount) {
    throw new Error("OPERATIONS_RELATIONSHIP_READ_PROPOSAL_COUNTS_INCONSISTENT");
  }
  return Object.freeze({
    client: client(raw.client),
    leadCount: nonNegativeInteger(raw.leadCount, "OPERATIONS_RELATIONSHIP_READ_LEAD_COUNT_INVALID", 10000),
    openBriefCount: nonNegativeInteger(raw.openBriefCount, "OPERATIONS_RELATIONSHIP_READ_OPEN_BRIEF_COUNT_INVALID", 10000),
    proposalCount,
    acceptedProposalCount,
    clientReadyProposalCount,
    latestCommercialUpdatedAt: latest,
  });
}

function project(value: unknown): OperationsCoreRelationshipProjectSnapshot | null {
  if (value === null) return null;
  const raw = object(value, "OPERATIONS_RELATIONSHIP_READ_PROJECT_INVALID");
  const commercialClientId = raw.commercialClientId === null
    ? null
    : requiredUuid(raw.commercialClientId, "OPERATIONS_RELATIONSHIP_READ_PROJECT_CLIENT_ID_INVALID");
  const openWorkItemCount = nonNegativeInteger(raw.openWorkItemCount, "OPERATIONS_RELATIONSHIP_READ_PROJECT_OPEN_ITEM_COUNT_INVALID", 100000);
  const blockedWorkItemCount = nonNegativeInteger(raw.blockedWorkItemCount, "OPERATIONS_RELATIONSHIP_READ_PROJECT_BLOCKED_ITEM_COUNT_INVALID", 100000);
  if (blockedWorkItemCount > openWorkItemCount) {
    throw new Error("OPERATIONS_RELATIONSHIP_READ_PROJECT_WORK_ITEM_COUNTS_INCONSISTENT");
  }
  return Object.freeze({
    id: requiredUuid(raw.id, "OPERATIONS_RELATIONSHIP_READ_PROJECT_ID_INVALID"),
    commercialClientId,
    code: requiredString(raw.code, "OPERATIONS_RELATIONSHIP_READ_PROJECT_CODE_INVALID", 100),
    clientName: requiredString(raw.clientName, "OPERATIONS_RELATIONSHIP_READ_PROJECT_CLIENT_NAME_INVALID", 300),
    title: requiredString(raw.title, "OPERATIONS_RELATIONSHIP_READ_PROJECT_TITLE_INVALID", 300),
    status: enumValue(raw.status, ["planned", "active", "blocked", "completed"] as const, "OPERATIONS_RELATIONSHIP_READ_PROJECT_STATUS_INVALID"),
    phase: requiredString(raw.phase, "OPERATIONS_RELATIONSHIP_READ_PROJECT_PHASE_INVALID", 300),
    progressPercent: nonNegativeInteger(raw.progressPercent, "OPERATIONS_RELATIONSHIP_READ_PROJECT_PROGRESS_INVALID", 100),
    milestoneCount: nonNegativeInteger(raw.milestoneCount, "OPERATIONS_RELATIONSHIP_READ_PROJECT_MILESTONE_COUNT_INVALID", 10000),
    openWorkItemCount,
    blockedWorkItemCount,
    linkedWorkOrderCount: nonNegativeInteger(raw.linkedWorkOrderCount, "OPERATIONS_RELATIONSHIP_READ_PROJECT_WORK_ORDER_COUNT_INVALID", 10000),
    invoiceReadiness: enumValue(raw.invoiceReadiness, ["not_ready", "review_ready", "blocked"] as const, "OPERATIONS_RELATIONSHIP_READ_PROJECT_INVOICE_READINESS_INVALID"),
    readiness: enumValue(raw.readiness, ["available", "needs_review", "blocked"] as const, "OPERATIONS_RELATIONSHIP_READ_PROJECT_READINESS_INVALID"),
    reviewRequired: requiredBoolean(raw.reviewRequired, "OPERATIONS_RELATIONSHIP_READ_PROJECT_REVIEW_REQUIRED_INVALID"),
    clientVisible: requiredBoolean(raw.clientVisible, "OPERATIONS_RELATIONSHIP_READ_PROJECT_CLIENT_VISIBLE_INVALID"),
    updatedAt: iso(raw.updatedAt, "OPERATIONS_RELATIONSHIP_READ_PROJECT_UPDATED_AT_INVALID"),
  });
}

function snapshot(value: unknown, expected: ReturnType<typeof exactRequest>): OperationsCoreRelationshipSnapshot {
  const raw = object(value, "OPERATIONS_RELATIONSHIP_READ_SNAPSHOT_INVALID");
  if (raw.contract !== "evavo-relationship-manager-operations-snapshot-v1") throw new Error("OPERATIONS_RELATIONSHIP_READ_CONTRACT_INVALID");
  const state = enumValue(raw.state, ["verified", "not_found", "provider_unavailable"] as const, "OPERATIONS_RELATIONSHIP_READ_STATE_INVALID");
  if (raw.workspaceId !== expected.workspaceId || raw.commercialClientId !== expected.commercialClientId || raw.projectId !== expected.projectId) {
    throw new Error("OPERATIONS_RELATIONSHIP_READ_IDENTITY_MISMATCH");
  }
  const observedAt = iso(raw.observedAt, "OPERATIONS_RELATIONSHIP_READ_OBSERVED_AT_INVALID");
  const observedAtMs = Date.parse(observedAt);
  if (observedAtMs > Date.now() + 60_000) throw new Error("OPERATIONS_RELATIONSHIP_READ_OBSERVED_AT_FUTURE");
  const evidenceRef = requiredString(raw.evidenceRef, "OPERATIONS_RELATIONSHIP_READ_EVIDENCE_INVALID", 200);
  if (!EVIDENCE_PATTERN.test(evidenceRef)) throw new Error("OPERATIONS_RELATIONSHIP_READ_EVIDENCE_INVALID");
  const commercialSnapshot = commercial(raw.commercial);
  const projectSnapshot = project(raw.project);
  if (projectSnapshot && expected.projectId && projectSnapshot.id !== expected.projectId) throw new Error("OPERATIONS_RELATIONSHIP_READ_PROJECT_ID_MISMATCH");
  if (commercialSnapshot?.client && expected.commercialClientId && commercialSnapshot.client.id !== expected.commercialClientId) throw new Error("OPERATIONS_RELATIONSHIP_READ_CLIENT_ID_MISMATCH");
  if (projectSnapshot?.commercialClientId && expected.commercialClientId && projectSnapshot.commercialClientId !== expected.commercialClientId) throw new Error("OPERATIONS_RELATIONSHIP_READ_PROJECT_CLIENT_MISMATCH");
  if (projectSnapshot && Date.parse(projectSnapshot.updatedAt) > observedAtMs) throw new Error("OPERATIONS_RELATIONSHIP_READ_PROJECT_UPDATED_AFTER_SNAPSHOT");
  if (commercialSnapshot?.client && Date.parse(commercialSnapshot.client.updatedAt) > observedAtMs) throw new Error("OPERATIONS_RELATIONSHIP_READ_CLIENT_UPDATED_AFTER_SNAPSHOT");
  if (commercialSnapshot?.latestCommercialUpdatedAt && Date.parse(commercialSnapshot.latestCommercialUpdatedAt) > observedAtMs) throw new Error("OPERATIONS_RELATIONSHIP_READ_COMMERCIAL_UPDATED_AFTER_SNAPSHOT");
  const reasons = Array.isArray(raw.reasons)
    ? Object.freeze(raw.reasons.map((item) => requiredString(item, "OPERATIONS_RELATIONSHIP_READ_REASON_INVALID", 1000)))
    : (() => { throw new Error("OPERATIONS_RELATIONSHIP_READ_REASONS_INVALID"); })();
  if (!reasons.length) throw new Error("OPERATIONS_RELATIONSHIP_READ_REASON_REQUIRED");
  const providerReads = nonNegativeInteger(raw.providerReads, "OPERATIONS_RELATIONSHIP_READ_PROVIDER_READS_INVALID", 6);
  if (raw.providerWrites !== 0 || raw.externalSends !== 0 || raw.calendarChanges !== 0 || raw.outsideEffects !== 0) {
    throw new Error("OPERATIONS_RELATIONSHIP_READ_EFFECT_COUNTER_INVALID");
  }
  if (state === "verified" && !commercialSnapshot && !projectSnapshot) throw new Error("OPERATIONS_RELATIONSHIP_READ_VERIFIED_WITHOUT_RECORD");
  if (state === "not_found" && (commercialSnapshot || projectSnapshot)) throw new Error("OPERATIONS_RELATIONSHIP_READ_NOT_FOUND_WITH_RECORD");
  if (state === "provider_unavailable" && (commercialSnapshot || projectSnapshot)) throw new Error("OPERATIONS_RELATIONSHIP_READ_UNAVAILABLE_WITH_RECORD");
  return Object.freeze({
    contract: "evavo-relationship-manager-operations-snapshot-v1",
    state,
    workspaceId: expected.workspaceId,
    commercialClientId: expected.commercialClientId,
    projectId: expected.projectId,
    observedAt,
    evidenceRef,
    commercial: commercialSnapshot,
    project: projectSnapshot,
    reasons,
    providerReads,
    providerWrites: 0,
    externalSends: 0,
    calendarChanges: 0,
    outsideEffects: 0,
  });
}

export function createOperationsCoreRelationshipSnapshotPort(
  config: OperationsCoreRelationshipSnapshotPortConfig,
  fetchFn: OperationsCoreRelationshipSnapshotFetch = fetch,
): OperationsCoreRelationshipSnapshotPort {
  const root = baseUrl(config.baseUrl);
  const readToken = token(config.readToken);
  const timeoutMs = timeout(config.timeoutMs);
  const endpoint = `${root}/api/v1/internal/relationship-manager/operations-snapshot`;

  return Object.freeze({
    contract: BUSINESS_OPERATIONS_CORE_RELATIONSHIP_SNAPSHOT_PORT_CONTRACT,
    async read(request) {
      const expected = exactRequest(request);
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
          body: JSON.stringify({
            workspaceId: expected.workspaceId,
            ...(expected.commercialClientId ? { commercialClientId: expected.commercialClientId } : {}),
            ...(expected.projectId ? { projectId: expected.projectId } : {}),
          }),
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) throw new Error("OPERATIONS_RELATIONSHIP_READ_TIMEOUT");
        throw new Error("OPERATIONS_RELATIONSHIP_READ_UNAVAILABLE", { cause: error });
      } finally {
        clearTimeout(timer);
      }

      let envelope: ApiEnvelope;
      try {
        envelope = await response.json() as ApiEnvelope;
      } catch {
        throw new Error("OPERATIONS_RELATIONSHIP_READ_RESPONSE_INVALID");
      }
      if (!response.ok) throw new Error(`OPERATIONS_RELATIONSHIP_READ_FAILED:${response.status}`);
      if (envelope.ok !== true || envelope.data === undefined) throw new Error("OPERATIONS_RELATIONSHIP_READ_ENVELOPE_INVALID");
      return snapshot(envelope.data, expected);
    },
  });
}
