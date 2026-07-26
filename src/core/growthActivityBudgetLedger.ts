import type { Env } from "../db";
import {
  GROWTH_ACTIVITY_BUDGET_VERSION,
  emptyGrowthActivityUsageSnapshot,
  evaluateGrowthActivityBudget,
  type GrowthActivityActionKind,
  type GrowthActivityBudgetDecision,
  type GrowthActivityCounters,
  type GrowthActivityIntensity,
  type GrowthActivityInvocation,
  type GrowthActivityUsageSnapshot,
} from "./growthActivityBudget";

export const GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION =
  "growth_activity_budget_ledger_v1" as const;

const CLAIM_TTL_MS = 15 * 60 * 1000;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{14,158}[A-Za-z0-9]$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const OUTCOME_PATTERN = /^[a-z0-9][a-z0-9._:-]{1,79}$/;

const COUNTER_KEYS = Object.freeze([
  "manualResearchRuns",
  "scheduledExternalResearchRuns",
  "externalFetches",
  "distinctDomains",
  "candidateWrites",
  "proposalWrites",
  "reportsGenerated",
  "workerRequests",
  "d1RowsRead",
  "d1RowsWritten",
  "queueOperations",
  "browserMinutes",
  "aiCalls",
  "paidServiceCalls",
  "externalActions",
] as const);

const LEDGER_DENIAL_CODES = Object.freeze([
  "GROWTH_ACTIVITY_BUDGET_CLAIM_STATUS_INVALID",
  "GROWTH_ACTIVITY_BUDGET_CLAIM_OUTCOME_INVALID",
  "GROWTH_ACTIVITY_BUDGET_CLAIM_DAY_INVALID",
  "GROWTH_ACTIVITY_BUDGET_CLAIM_EXPIRY_INVALID",
  "GROWTH_ACTIVITY_BUDGET_COST_INVALID",
  "GROWTH_ACTIVITY_BUDGET_LIMITS_INVALID",
  "GROWTH_ACTIVITY_BUDGET_ZERO_COST_POSTURE_INVALID",
  "GROWTH_ACTIVITY_BUDGET_SCHEDULED_RESEARCH_FORBIDDEN",
  "GROWTH_ACTIVITY_BUDGET_TARGET_DOMAIN_REQUIRED",
  "GROWTH_ACTIVITY_BUDGET_PER_RUN_LIMIT",
  "GROWTH_ACTIVITY_BUDGET_DAILY_LIMIT",
  "GROWTH_ACTIVITY_BUDGET_DOMAIN_LIMIT",
  "GROWTH_ACTIVITY_BUDGET_FAILURE_CIRCUIT",
  "GROWTH_ACTIVITY_BUDGET_COOLDOWN",
] as const);

type LedgerDenialCode = (typeof LEDGER_DENIAL_CODES)[number];
type UnknownRecord = Record<string, unknown>;

type UsageRow = Readonly<{
  counters_json: string;
  domain_fetches_json: string;
  domain_failures_json: string;
  domain_last_research_json: string;
  updated_at_iso: string;
}>;

type ClaimRow = Readonly<{
  claim_id: string;
  status: "admitted" | "completed" | "failed";
  outcome_code: string | null;
  completed_at_iso: string | null;
}>;

export type GrowthActivityBudgetLedgerClaim = Readonly<{
  contractVersion: typeof GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION;
  claimId: string;
  action: GrowthActivityActionKind;
  invocation: GrowthActivityInvocation;
  profileIntensity: GrowthActivityIntensity;
  requestedUnits: number;
  utcDay: string;
  targetDomainHash: string | null;
  requestBodySha256: string;
  admittedAt: string;
  expiresAt: string;
}>;

export type ClaimGrowthActivityBudgetInput = Readonly<{
  claimId: string;
  requestBodySha256: string;
  intensity: GrowthActivityIntensity;
  customLimits?: unknown;
  action: GrowthActivityActionKind;
  invocation: GrowthActivityInvocation;
  requestedUnits?: number;
  ownerApproved?: boolean;
  explicitlyConfirmed?: boolean;
  targetDomain?: string | null;
  now?: Date;
}>;

export type ClaimGrowthActivityBudgetResult =
  | Readonly<{
      accepted: true;
      contractVersion: typeof GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION;
      decision: GrowthActivityBudgetDecision;
      claim: GrowthActivityBudgetLedgerClaim;
      replayed: false;
      persistentAdmission: true;
      automaticRetryAllowed: false;
    }>
  | Readonly<{
      accepted: false;
      contractVersion: typeof GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION;
      decision: GrowthActivityBudgetDecision;
      denialSource: "policy" | "database_race";
      ledgerCode: LedgerDenialCode | null;
      persistentAdmission: true;
      automaticRetryAllowed: false;
    }>;

export type CompleteGrowthActivityBudgetClaimInput = Readonly<{
  claim: GrowthActivityBudgetLedgerClaim;
  outcome: "completed" | "failed";
  outcomeCode: string;
  now?: Date;
}>;

const trustedClaims = new WeakSet<object>();

function fail(code: string): never {
  throw new Error(code);
}

function exactKeys(record: UnknownRecord, expected: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  const required = [...expected].sort();
  return actual.length === required.length && actual.every((key, index) => key === required[index]);
}

function canonicalNow(value: Date | undefined): Date {
  const now = value ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    fail("GROWTH_ACTIVITY_BUDGET_LEDGER_TIME_INVALID");
  }
  return new Date(now.getTime());
}

function identifier(value: unknown, code: string): string {
  if (
    typeof value !== "string" ||
    !IDENTIFIER_PATTERN.test(value) ||
    value.includes("..")
  ) fail(code);
  return value;
}

function sha256(value: unknown, code: string): string {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) fail(code);
  return value;
}

function canonicalDomain(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (value !== value.toLowerCase() || !DOMAIN_PATTERN.test(value)) {
    fail("GROWTH_ACTIVITY_BUDGET_TARGET_DOMAIN_INVALID");
  }
  return value;
}

function outcomeCode(value: unknown): string {
  if (typeof value !== "string" || !OUTCOME_PATTERN.test(value)) {
    fail("GROWTH_ACTIVITY_BUDGET_OUTCOME_CODE_INVALID");
  }
  return value;
}

async function digestDomain(domain: string | null): Promise<string | null> {
  if (!domain) return null;
  const bytes = new TextEncoder().encode(domain);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function objectJson(value: unknown, code: string): UnknownRecord {
  if (typeof value !== "string" || value.length > 200_000) fail(code);
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    fail(code);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail(code);
  return parsed as UnknownRecord;
}

function integer(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) fail(code);
  return value;
}

function countersFromJson(value: string): GrowthActivityCounters {
  const record = objectJson(value, "GROWTH_ACTIVITY_BUDGET_USAGE_INVALID");
  if (!exactKeys(record, COUNTER_KEYS)) fail("GROWTH_ACTIVITY_BUDGET_USAGE_INVALID");
  return Object.freeze(Object.fromEntries(
    COUNTER_KEYS.map((key) => [key, integer(record[key], "GROWTH_ACTIVITY_BUDGET_USAGE_INVALID")]),
  )) as GrowthActivityCounters;
}

function domainCounter(value: string, domainHash: string | null): number {
  if (!domainHash) return 0;
  const record = objectJson(value, "GROWTH_ACTIVITY_BUDGET_DOMAIN_USAGE_INVALID");
  const observed = record[domainHash];
  return observed === undefined ? 0 : integer(observed, "GROWTH_ACTIVITY_BUDGET_DOMAIN_USAGE_INVALID");
}

function domainTimestamp(value: string, domainHash: string | null): string | null {
  if (!domainHash) return null;
  const record = objectJson(value, "GROWTH_ACTIVITY_BUDGET_DOMAIN_USAGE_INVALID");
  const observed = record[domainHash];
  if (observed === undefined) return null;
  if (typeof observed !== "string" || observed.length > 80) {
    fail("GROWTH_ACTIVITY_BUDGET_DOMAIN_USAGE_INVALID");
  }
  const milliseconds = Date.parse(observed);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== observed) {
    fail("GROWTH_ACTIVITY_BUDGET_DOMAIN_USAGE_INVALID");
  }
  return observed;
}

function emptyCounters(): GrowthActivityCounters {
  return emptyGrowthActivityUsageSnapshot(new Date(0)).counters;
}

async function readUsageRow(env: Env, utcDay: string): Promise<UsageRow | null> {
  try {
    return await env.DB.prepare(
      `SELECT counters_json, domain_fetches_json, domain_failures_json,
              domain_last_research_json, updated_at_iso
       FROM growth_activity_budget_usage_daily
       WHERE utc_day = ?
       LIMIT 1`,
    ).bind(utcDay).first<UsageRow>();
  } catch {
    fail("GROWTH_ACTIVITY_BUDGET_LEDGER_UNAVAILABLE");
  }
}

export async function readGrowthActivityBudgetUsage(
  env: Env,
  input: Readonly<{ targetDomain?: string | null; now?: Date }> = {},
): Promise<GrowthActivityUsageSnapshot> {
  if (!env?.DB) fail("GROWTH_ACTIVITY_BUDGET_LEDGER_UNAVAILABLE");
  const now = canonicalNow(input.now);
  const day = now.toISOString().slice(0, 10);
  const domain = canonicalDomain(input.targetDomain);
  const domainHash = await digestDomain(domain);
  const row = await readUsageRow(env, day);
  if (!row) {
    return Object.freeze({
      contractVersion: GROWTH_ACTIVITY_BUDGET_VERSION,
      utcDay: day,
      capturedAt: now.toISOString(),
      counters: emptyCounters(),
      targetDomainFetches: 0,
      consecutiveFetchFailures: 0,
      lastExternalResearchAt: null,
    });
  }
  return Object.freeze({
    contractVersion: GROWTH_ACTIVITY_BUDGET_VERSION,
    utcDay: day,
    capturedAt: now.toISOString(),
    counters: countersFromJson(row.counters_json),
    targetDomainFetches: domainCounter(row.domain_fetches_json, domainHash),
    consecutiveFetchFailures: domainCounter(row.domain_failures_json, domainHash),
    lastExternalResearchAt: domainTimestamp(row.domain_last_research_json, domainHash),
  });
}

function counterDelta(
  current: GrowthActivityCounters,
  projected: GrowthActivityCounters,
): GrowthActivityCounters {
  return Object.freeze(Object.fromEntries(COUNTER_KEYS.map((key) => {
    const difference = projected[key] - current[key];
    if (!Number.isSafeInteger(difference) || difference < 0) {
      fail("GROWTH_ACTIVITY_BUDGET_COST_INVALID");
    }
    return [key, difference];
  }))) as GrowthActivityCounters;
}

function ledgerCode(error: unknown): LedgerDenialCode | null {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return LEDGER_DENIAL_CODES.find((code) => message.includes(code)) ?? null;
}

function brandClaim(value: GrowthActivityBudgetLedgerClaim): GrowthActivityBudgetLedgerClaim {
  const frozen = Object.freeze({ ...value });
  trustedClaims.add(frozen);
  return frozen;
}

export function assertGrowthActivityBudgetLedgerClaim(
  value: unknown,
): asserts value is GrowthActivityBudgetLedgerClaim {
  if (!value || typeof value !== "object" || !trustedClaims.has(value)) {
    fail("GROWTH_ACTIVITY_BUDGET_CLAIM_UNTRUSTED");
  }
}

export async function claimGrowthActivityBudget(
  env: Env,
  input: ClaimGrowthActivityBudgetInput,
): Promise<ClaimGrowthActivityBudgetResult> {
  if (!env?.DB) fail("GROWTH_ACTIVITY_BUDGET_LEDGER_UNAVAILABLE");
  const now = canonicalNow(input.now);
  const claimId = identifier(input.claimId, "GROWTH_ACTIVITY_BUDGET_CLAIM_ID_INVALID");
  const requestBodySha256 = sha256(
    input.requestBodySha256,
    "GROWTH_ACTIVITY_BUDGET_REQUEST_HASH_INVALID",
  );
  const domain = canonicalDomain(input.targetDomain);
  const targetDomainHash = await digestDomain(domain);
  const usage = await readGrowthActivityBudgetUsage(env, { targetDomain: domain, now });
  const decision = evaluateGrowthActivityBudget({
    intensity: input.intensity,
    ...(input.customLimits === undefined ? {} : { customLimits: input.customLimits }),
    action: input.action,
    invocation: input.invocation,
    ...(input.requestedUnits === undefined ? {} : { requestedUnits: input.requestedUnits }),
    ownerApproved: input.ownerApproved,
    explicitlyConfirmed: input.explicitlyConfirmed,
    targetDomain: domain,
    usage,
    now,
  });
  if (!decision.allowed) {
    return Object.freeze({
      accepted: false,
      contractVersion: GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION,
      decision,
      denialSource: "policy",
      ledgerCode: null,
      persistentAdmission: true,
      automaticRetryAllowed: false,
    });
  }

  const admittedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + CLAIM_TTL_MS).toISOString();
  const cost = counterDelta(usage.counters, decision.projectedUsage);
  try {
    await env.DB.prepare(
      `INSERT INTO growth_activity_budget_claims (
         claim_id, utc_day, action, invocation, profile_intensity,
         requested_units, target_domain_hash, cost_json, limits_json,
         request_body_sha256, status, outcome_code, created_at_iso,
         expires_at_iso, completed_at_iso
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admitted', NULL, ?, ?, NULL)`,
    ).bind(
      claimId,
      usage.utcDay,
      input.action,
      input.invocation,
      decision.profile.intensity,
      decision.requestedUnits,
      targetDomainHash,
      JSON.stringify(cost),
      JSON.stringify(decision.profile.limits),
      requestBodySha256,
      admittedAt,
      expiresAt,
    ).run();
  } catch (error) {
    const code = ledgerCode(error);
    if (code) {
      return Object.freeze({
        accepted: false,
        contractVersion: GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION,
        decision,
        denialSource: "database_race",
        ledgerCode: code,
        persistentAdmission: true,
        automaticRetryAllowed: false,
      });
    }
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (message.includes("UNIQUE constraint failed")) {
      fail("GROWTH_ACTIVITY_BUDGET_CLAIM_REPLAY");
    }
    fail("GROWTH_ACTIVITY_BUDGET_LEDGER_UNAVAILABLE");
  }

  return Object.freeze({
    accepted: true,
    contractVersion: GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION,
    decision,
    claim: brandClaim({
      contractVersion: GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION,
      claimId,
      action: input.action,
      invocation: input.invocation,
      profileIntensity: decision.profile.intensity,
      requestedUnits: decision.requestedUnits,
      utcDay: usage.utcDay,
      targetDomainHash,
      requestBodySha256,
      admittedAt,
      expiresAt,
    }),
    replayed: false,
    persistentAdmission: true,
    automaticRetryAllowed: false,
  });
}

async function readClaim(env: Env, claimId: string): Promise<ClaimRow | null> {
  try {
    return await env.DB.prepare(
      `SELECT claim_id, status, outcome_code, completed_at_iso
       FROM growth_activity_budget_claims
       WHERE claim_id = ?
       LIMIT 1`,
    ).bind(claimId).first<ClaimRow>();
  } catch {
    fail("GROWTH_ACTIVITY_BUDGET_LEDGER_UNAVAILABLE");
  }
}

export async function completeGrowthActivityBudgetClaim(
  env: Env,
  input: CompleteGrowthActivityBudgetClaimInput,
): Promise<Readonly<{
  contractVersion: typeof GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION;
  completed: true;
  outcome: "completed" | "failed";
  idempotent: boolean;
  automaticRetryAllowed: false;
}>> {
  if (!env?.DB) fail("GROWTH_ACTIVITY_BUDGET_LEDGER_UNAVAILABLE");
  assertGrowthActivityBudgetLedgerClaim(input.claim);
  const now = canonicalNow(input.now);
  const code = outcomeCode(input.outcomeCode);
  if (now.toISOString() < input.claim.admittedAt) {
    fail("GROWTH_ACTIVITY_BUDGET_CLAIM_COMPLETION_INVALID");
  }

  const existing = await readClaim(env, input.claim.claimId);
  if (!existing) fail("GROWTH_ACTIVITY_BUDGET_CLAIM_NOT_FOUND");
  if (existing.status !== "admitted") {
    if (existing.status === input.outcome && existing.outcome_code === code) {
      return Object.freeze({
        contractVersion: GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION,
        completed: true,
        outcome: input.outcome,
        idempotent: true,
        automaticRetryAllowed: false,
      });
    }
    fail("GROWTH_ACTIVITY_BUDGET_CLAIM_ALREADY_COMPLETED");
  }

  try {
    await env.DB.prepare(
      `UPDATE growth_activity_budget_claims
       SET status = ?, outcome_code = ?, completed_at_iso = ?
       WHERE claim_id = ? AND status = 'admitted'`,
    ).bind(input.outcome, code, now.toISOString(), input.claim.claimId).run();
  } catch {
    fail("GROWTH_ACTIVITY_BUDGET_LEDGER_UNAVAILABLE");
  }
  const completed = await readClaim(env, input.claim.claimId);
  if (
    !completed ||
    completed.status !== input.outcome ||
    completed.outcome_code !== code ||
    completed.completed_at_iso !== now.toISOString()
  ) fail("GROWTH_ACTIVITY_BUDGET_CLAIM_COMPLETION_CONFLICT");

  return Object.freeze({
    contractVersion: GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION,
    completed: true,
    outcome: input.outcome,
    idempotent: false,
    automaticRetryAllowed: false,
  });
}
