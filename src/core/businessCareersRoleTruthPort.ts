import type { RoleOpeningEvidence } from "./businessRoleOpeningTruth";

export const BUSINESS_CAREERS_ROLE_TRUTH_PORT_CONTRACT =
  "business_careers_role_truth_port_v1" as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WORKSPACE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ROLE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const EVIDENCE_PATTERN = /^operations:careers-snapshot:[a-f0-9]{64}$/;

export type CareersRoleTruthRequest = Readonly<{
  workspaceId: string;
  targetRoleId?: string | null;
  targetRoleKey?: string | null;
}>;

export type CareersRoleTruthRecord = Readonly<{
  id: string;
  roleKey: string;
  title: string;
  state: "open" | "closed" | "paused";
  authoritative: boolean;
  employmentType: "employee" | "contract" | "internship" | "graduate" | "casual" | "other" | null;
  locationLabel: string | null;
  locationMode: "remote" | "hybrid" | "onsite" | "flexible" | null;
  summary: string;
  applicationUrl: string | null;
  openedAt: string | null;
  closesAt: string | null;
  roleOwnerLabel: string;
  reviewRequired: boolean;
  updatedAt: string;
  stateReason: "stored_state" | "closing_time_elapsed" | "opening_time_not_reached";
}>;

export type CareersRoleTruthSnapshot = Readonly<{
  contract: "evavo-relationship-manager-careers-snapshot-v1";
  state: "verified" | "not_found" | "provider_unavailable";
  workspaceId: string;
  targetRoleId: string | null;
  targetRoleKey: string | null;
  observedAt: string;
  evidenceRef: string;
  roles: readonly CareersRoleTruthRecord[];
  reasons: readonly string[];
  providerReads: 0 | 1;
  providerWrites: 0;
  externalPublications: 0;
  candidateMessages: 0;
  interviewCalendarChanges: 0;
  employmentCommitments: 0;
  outsideEffects: 0;
}>;

export type CareersRoleTruthPortConfig = Readonly<{
  baseUrl: string;
  readToken: string;
  timeoutMs?: number;
}>;

export type CareersRoleTruthFetch = (
  input: string,
  init: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json">>;

export type CareersRoleTruthPort = Readonly<{
  contract: typeof BUSINESS_CAREERS_ROLE_TRUTH_PORT_CONTRACT;
  read(request: CareersRoleTruthRequest): Promise<CareersRoleTruthSnapshot>;
}>;

function object(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function string(value: unknown, code: string, max = 2000) {
  if (typeof value !== "string") throw new Error(code);
  const clean = value.trim();
  if (!clean || clean.length > max) throw new Error(code);
  return clean;
}

function nullableString(value: unknown, code: string, max = 2000): string | null {
  if (value === null) return null;
  return string(value, code, max);
}

function bool(value: unknown, code: string) {
  if (typeof value !== "boolean") throw new Error(code);
  return value;
}

function iso(value: unknown, code: string): string {
  const clean = string(value, code, 100);
  if (!Number.isFinite(Date.parse(clean))) throw new Error(code);
  return new Date(clean).toISOString();
}

function nullableIso(value: unknown, code: string): string | null {
  return value === null ? null : iso(value, code);
}

function enumValue<T extends string>(value: unknown, values: readonly T[], code: string): T {
  if (typeof value !== "string" || !(values as readonly string[]).includes(value)) throw new Error(code);
  return value as T;
}

function token(value: string) {
  const clean = value.trim();
  if (new TextEncoder().encode(clean).byteLength < 32 || clean.length > 4096) {
    throw new Error("CAREERS_ROLE_TRUTH_TOKEN_INVALID");
  }
  return clean;
}

function baseUrl(value: string) {
  const clean = value.trim().replace(/\/+$/, "");
  let parsed: URL;
  try { parsed = new URL(clean); } catch { throw new Error("CAREERS_ROLE_TRUTH_BASE_URL_INVALID"); }
  if (!clean || (parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("CAREERS_ROLE_TRUTH_BASE_URL_INVALID");
  }
  return clean;
}

function timeout(value: number | undefined) {
  const result = value ?? 10_000;
  if (!Number.isSafeInteger(result) || result < 250 || result > 60_000) throw new Error("CAREERS_ROLE_TRUTH_TIMEOUT_INVALID");
  return result;
}

function request(input: CareersRoleTruthRequest) {
  const workspaceId = input.workspaceId.trim();
  if (!WORKSPACE_ID_PATTERN.test(workspaceId)) throw new Error("CAREERS_ROLE_TRUTH_WORKSPACE_INVALID");
  const targetRoleId = input.targetRoleId?.trim() || null;
  const targetRoleKey = input.targetRoleKey?.trim() || null;
  if (targetRoleId && !UUID_PATTERN.test(targetRoleId)) throw new Error("CAREERS_ROLE_TRUTH_ROLE_ID_INVALID");
  if (targetRoleKey && !ROLE_KEY_PATTERN.test(targetRoleKey)) throw new Error("CAREERS_ROLE_TRUTH_ROLE_KEY_INVALID");
  if (targetRoleId && targetRoleKey) throw new Error("CAREERS_ROLE_TRUTH_SINGLE_SELECTOR_REQUIRED");
  return Object.freeze({
    workspaceId,
    targetRoleId: targetRoleId?.toLowerCase() ?? null,
    targetRoleKey,
  });
}

function role(value: unknown, observedAtMs: number): CareersRoleTruthRecord {
  const raw = object(value, "CAREERS_ROLE_TRUTH_ROLE_INVALID");
  const id = string(raw.id, "CAREERS_ROLE_TRUTH_ROLE_ID_INVALID", 100).toLowerCase();
  if (!UUID_PATTERN.test(id)) throw new Error("CAREERS_ROLE_TRUTH_ROLE_ID_INVALID");
  const updatedAt = iso(raw.updatedAt, "CAREERS_ROLE_TRUTH_ROLE_UPDATED_AT_INVALID");
  if (Date.parse(updatedAt) > observedAtMs) throw new Error("CAREERS_ROLE_TRUTH_ROLE_UPDATED_AFTER_SNAPSHOT");
  return Object.freeze({
    id,
    roleKey: string(raw.roleKey, "CAREERS_ROLE_TRUTH_ROLE_KEY_INVALID", 120),
    title: string(raw.title, "CAREERS_ROLE_TRUTH_ROLE_TITLE_INVALID", 240),
    state: enumValue(raw.state, ["open", "closed", "paused"] as const, "CAREERS_ROLE_TRUTH_ROLE_STATE_INVALID"),
    authoritative: bool(raw.authoritative, "CAREERS_ROLE_TRUTH_ROLE_AUTHORITY_INVALID"),
    employmentType: raw.employmentType === null ? null : enumValue(raw.employmentType, ["employee", "contract", "internship", "graduate", "casual", "other"] as const, "CAREERS_ROLE_TRUTH_EMPLOYMENT_TYPE_INVALID"),
    locationLabel: nullableString(raw.locationLabel, "CAREERS_ROLE_TRUTH_LOCATION_INVALID", 240),
    locationMode: raw.locationMode === null ? null : enumValue(raw.locationMode, ["remote", "hybrid", "onsite", "flexible"] as const, "CAREERS_ROLE_TRUTH_LOCATION_MODE_INVALID"),
    summary: string(raw.summary, "CAREERS_ROLE_TRUTH_SUMMARY_INVALID", 2000),
    applicationUrl: nullableString(raw.applicationUrl, "CAREERS_ROLE_TRUTH_APPLICATION_URL_INVALID", 2000),
    openedAt: nullableIso(raw.openedAt, "CAREERS_ROLE_TRUTH_OPENED_AT_INVALID"),
    closesAt: nullableIso(raw.closesAt, "CAREERS_ROLE_TRUTH_CLOSES_AT_INVALID"),
    roleOwnerLabel: string(raw.roleOwnerLabel, "CAREERS_ROLE_TRUTH_OWNER_INVALID", 240),
    reviewRequired: bool(raw.reviewRequired, "CAREERS_ROLE_TRUTH_REVIEW_REQUIRED_INVALID"),
    updatedAt,
    stateReason: enumValue(raw.stateReason, ["stored_state", "closing_time_elapsed", "opening_time_not_reached"] as const, "CAREERS_ROLE_TRUTH_STATE_REASON_INVALID"),
  });
}

function snapshot(value: unknown, expected: ReturnType<typeof request>): CareersRoleTruthSnapshot {
  const raw = object(value, "CAREERS_ROLE_TRUTH_SNAPSHOT_INVALID");
  if (raw.contract !== "evavo-relationship-manager-careers-snapshot-v1") throw new Error("CAREERS_ROLE_TRUTH_CONTRACT_INVALID");
  if (raw.workspaceId !== expected.workspaceId || raw.targetRoleId !== expected.targetRoleId || raw.targetRoleKey !== expected.targetRoleKey) {
    throw new Error("CAREERS_ROLE_TRUTH_IDENTITY_MISMATCH");
  }
  const state = enumValue(raw.state, ["verified", "not_found", "provider_unavailable"] as const, "CAREERS_ROLE_TRUTH_STATE_INVALID");
  const observedAt = iso(raw.observedAt, "CAREERS_ROLE_TRUTH_OBSERVED_AT_INVALID");
  const observedAtMs = Date.parse(observedAt);
  if (observedAtMs > Date.now() + 60_000) throw new Error("CAREERS_ROLE_TRUTH_OBSERVED_AT_FUTURE");
  const evidenceRef = string(raw.evidenceRef, "CAREERS_ROLE_TRUTH_EVIDENCE_INVALID", 200);
  if (!EVIDENCE_PATTERN.test(evidenceRef)) throw new Error("CAREERS_ROLE_TRUTH_EVIDENCE_INVALID");
  if (!Array.isArray(raw.roles)) throw new Error("CAREERS_ROLE_TRUTH_ROLES_INVALID");
  const roles = Object.freeze(raw.roles.map((item) => role(item, observedAtMs)));
  if (new Set(roles.map((item) => item.id)).size !== roles.length) throw new Error("CAREERS_ROLE_TRUTH_DUPLICATE_ROLE_ID");
  if (new Set(roles.map((item) => item.roleKey)).size !== roles.length) throw new Error("CAREERS_ROLE_TRUTH_DUPLICATE_ROLE_KEY");
  if (expected.targetRoleId && roles.some((item) => item.id !== expected.targetRoleId)) throw new Error("CAREERS_ROLE_TRUTH_ROLE_ID_MISMATCH");
  if (expected.targetRoleKey && roles.some((item) => item.roleKey !== expected.targetRoleKey)) throw new Error("CAREERS_ROLE_TRUTH_ROLE_KEY_MISMATCH");
  if (!Array.isArray(raw.reasons) || raw.reasons.length < 1) throw new Error("CAREERS_ROLE_TRUTH_REASONS_INVALID");
  const reasons = Object.freeze(raw.reasons.map((item) => string(item, "CAREERS_ROLE_TRUTH_REASON_INVALID", 1000)));
  if (raw.providerReads !== 0 && raw.providerReads !== 1) throw new Error("CAREERS_ROLE_TRUTH_PROVIDER_READS_INVALID");
  if (raw.providerWrites !== 0 || raw.externalPublications !== 0 || raw.candidateMessages !== 0 || raw.interviewCalendarChanges !== 0 || raw.employmentCommitments !== 0 || raw.outsideEffects !== 0) {
    throw new Error("CAREERS_ROLE_TRUTH_EFFECT_COUNTER_INVALID");
  }
  if (state === "verified" && roles.length === 0) throw new Error("CAREERS_ROLE_TRUTH_VERIFIED_WITHOUT_ROLE");
  if ((state === "not_found" || state === "provider_unavailable") && roles.length > 0) throw new Error("CAREERS_ROLE_TRUTH_NONVERIFIED_WITH_ROLE");
  return Object.freeze({
    contract: "evavo-relationship-manager-careers-snapshot-v1",
    state,
    workspaceId: expected.workspaceId,
    targetRoleId: expected.targetRoleId,
    targetRoleKey: expected.targetRoleKey,
    observedAt,
    evidenceRef,
    roles,
    reasons,
    providerReads: raw.providerReads,
    providerWrites: 0,
    externalPublications: 0,
    candidateMessages: 0,
    interviewCalendarChanges: 0,
    employmentCommitments: 0,
    outsideEffects: 0,
  });
}

export function createCareersRoleTruthPort(
  config: CareersRoleTruthPortConfig,
  fetchFn: CareersRoleTruthFetch = fetch,
): CareersRoleTruthPort {
  const root = baseUrl(config.baseUrl);
  const readToken = token(config.readToken);
  const timeoutMs = timeout(config.timeoutMs);
  const endpoint = `${root}/api/v1/internal/relationship-manager/careers-snapshot`;
  return Object.freeze({
    contract: BUSINESS_CAREERS_ROLE_TRUTH_PORT_CONTRACT,
    async read(input) {
      const expected = request(input);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Pick<Response, "ok" | "status" | "json">;
      try {
        response = await fetchFn(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${readToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            workspaceId: expected.workspaceId,
            ...(expected.targetRoleId ? { targetRoleId: expected.targetRoleId } : {}),
            ...(expected.targetRoleKey ? { targetRoleKey: expected.targetRoleKey } : {}),
          }),
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) throw new Error("CAREERS_ROLE_TRUTH_READ_TIMEOUT");
        throw new Error("CAREERS_ROLE_TRUTH_READ_UNAVAILABLE", { cause: error });
      } finally {
        clearTimeout(timer);
      }
      let envelope: unknown;
      try { envelope = await response.json(); } catch { throw new Error("CAREERS_ROLE_TRUTH_RESPONSE_INVALID"); }
      if (!response.ok) throw new Error(`CAREERS_ROLE_TRUTH_READ_FAILED:${response.status}`);
      const raw = object(envelope, "CAREERS_ROLE_TRUTH_ENVELOPE_INVALID");
      if (raw.ok !== true || raw.data === undefined) throw new Error("CAREERS_ROLE_TRUTH_ENVELOPE_INVALID");
      return snapshot(raw.data, expected);
    },
  });
}

export function roleOpeningEvidenceFromCareersSnapshot(
  input: CareersRoleTruthSnapshot,
): readonly RoleOpeningEvidence[] {
  if (input.state !== "verified") return Object.freeze([]);
  return Object.freeze(input.roles.map((role) => Object.freeze({
    id: `careers-role-${role.id}`,
    source: "careers_registry" as const,
    observedAt: input.observedAt,
    roleId: role.id,
    roleLabel: role.title,
    state: role.state,
    authoritative: role.authoritative,
    sourceRef: input.evidenceRef,
  })));
}
