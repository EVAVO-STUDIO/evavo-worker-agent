import {
  evaluateGrowthExternalAction,
  parseGrowthAutonomyPolicy,
  type GrowthAutonomyPolicy,
  type GrowthAutonomyResearchBudget,
  type GrowthExternalActionDecision,
  type GrowthExternalActionKind,
} from "./growthAutonomyPolicy";

export const GROWTH_AUTONOMY_RUNTIME_VERSION =
  "growth_autonomy_runtime_v1" as const;
export const GROWTH_AUTONOMY_RESERVATION_TTL_MS = 15 * 60 * 1_000;

export type GrowthAutonomyTenantScope = Readonly<{
  organisationId: string;
  workspaceId: string;
}>;

export type GrowthAutonomyRunUsage = Readonly<{
  sourcesVisited: number;
  networkRequests: number;
  candidatesCreated: number;
  reportsGenerated: number;
  cpuMilliseconds: number;
  d1RowsRead: number;
  d1RowsWritten: number;
  storageBytes: number;
}>;

export type GrowthAutonomyReservationInput = Readonly<{
  scope: GrowthAutonomyTenantScope;
  runId: string;
  reservationId: string;
  windowKey: string;
  profile: GrowthAutonomyPolicy["profile"];
  budget: GrowthAutonomyResearchBudget;
  reservedAt: string;
  expiresAt: string;
}>;

export type GrowthAutonomyReservationDecision =
  | Readonly<{
      allowed: true;
      reservationId: string;
      replayed: boolean;
      runsStarted: number;
    }>
  | Readonly<{
      allowed: false;
      reason: "daily_run_limit" | "temporarily_unavailable";
    }>;

export type GrowthAutonomyReservationCompletion = Readonly<{
  reservation: GrowthAutonomyRunReservation;
  outcome: "completed" | "failed";
  usage: GrowthAutonomyRunUsage;
  completedAt: string;
}>;

export interface GrowthAutonomyUsageLedger {
  reserve(
    input: GrowthAutonomyReservationInput,
  ): Promise<GrowthAutonomyReservationDecision>;
  complete(input: GrowthAutonomyReservationCompletion): Promise<void>;
}

export type GrowthAutonomyStartInput = Readonly<{
  scope: GrowthAutonomyTenantScope;
  runId: string;
  usageKnown: boolean;
  estimatedPaidSpendCents: number;
  ownerApprovedExternalActions?: readonly GrowthExternalActionKind[];
}>;

export type GrowthAutonomyStartDenied = Readonly<{
  allowed: false;
  reason:
    | "paused"
    | "quiet_hours"
    | "usage_unknown"
    | "paid_spend_detected"
    | "daily_run_limit"
    | "temporarily_unavailable";
}>;

export type GrowthAutonomyRunSession = Readonly<{
  contractVersion: typeof GROWTH_AUTONOMY_RUNTIME_VERSION;
  reservation: GrowthAutonomyRunReservation;
  budget: GrowthAutonomyResearchBudget;
  usage(): GrowthAutonomyRunUsage;
  consume(delta: Partial<GrowthAutonomyRunUsage>): GrowthAutonomyRunUsage;
  externalAction(action: GrowthExternalActionKind): GrowthExternalActionDecision;
  complete(outcome: "completed" | "failed"): Promise<void>;
}>;

export type GrowthAutonomyStartDecision =
  | GrowthAutonomyStartDenied
  | Readonly<{
      allowed: true;
      session: GrowthAutonomyRunSession;
    }>;

export type GrowthAutonomyRunReservation = Readonly<{
  contractVersion: typeof GROWTH_AUTONOMY_RUNTIME_VERSION;
  reservationId: string;
  runId: string;
  scope: GrowthAutonomyTenantScope;
  windowKey: string;
  profile: GrowthAutonomyPolicy["profile"];
  reservedAt: string;
  expiresAt: string;
  replayed: boolean;
}>;

export type GrowthAutonomyRuntimeOptions = Readonly<{
  policy: GrowthAutonomyPolicy;
  ledger: GrowthAutonomyUsageLedger;
  clock?: () => Date;
  reservationIdFactory?: () => string;
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{14,158}[A-Za-z0-9]$/;
const RESERVATION_ID_PATTERN = /^growth-run:[0-9a-f]{48}$/;
const RESERVATION_BRAND = new WeakSet<object>();
const SESSION_BRAND = new WeakSet<object>();
const USAGE_KEYS = Object.freeze([
  "candidatesCreated",
  "cpuMilliseconds",
  "d1RowsRead",
  "d1RowsWritten",
  "networkRequests",
  "reportsGenerated",
  "sourcesVisited",
  "storageBytes",
] as const);

const ZERO_USAGE: GrowthAutonomyRunUsage = Object.freeze({
  sourcesVisited: 0,
  networkRequests: 0,
  candidatesCreated: 0,
  reportsGenerated: 0,
  cpuMilliseconds: 0,
  d1RowsRead: 2,
  d1RowsWritten: 5,
  storageBytes: 0,
});

function fail(code: string): never {
  throw new Error(code);
}

function canonicalNow(clock: (() => Date) | undefined): Date {
  const now = clock ? clock() : new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    fail("GROWTH_AUTONOMY_RUNTIME_TIME_INVALID");
  }
  return new Date(now.getTime());
}

function scope(value: GrowthAutonomyTenantScope): GrowthAutonomyTenantScope {
  if (!value || typeof value !== "object") fail("GROWTH_AUTONOMY_RUNTIME_SCOPE_INVALID");
  if (!UUID_PATTERN.test(value.organisationId) || !UUID_PATTERN.test(value.workspaceId)) {
    fail("GROWTH_AUTONOMY_RUNTIME_SCOPE_INVALID");
  }
  return Object.freeze({
    organisationId: value.organisationId.toLowerCase(),
    workspaceId: value.workspaceId.toLowerCase(),
  });
}

function identifier(value: unknown, code: string): string {
  if (
    typeof value !== "string" ||
    !IDENTIFIER_PATTERN.test(value) ||
    value.includes("..")
  ) {
    fail(code);
  }
  return value;
}

function reservationIdentifier(value: unknown): string {
  if (typeof value !== "string" || !RESERVATION_ID_PATTERN.test(value)) {
    fail("GROWTH_AUTONOMY_RUNTIME_RESERVATION_ID_INVALID");
  }
  return value;
}

function finiteCounter(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) fail(code);
  return Number(value);
}

function canonicalTimestamp(value: unknown, code: string): string {
  if (typeof value !== "string" || value.length > 80) fail(code);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) fail(code);
  const canonical = new Date(milliseconds).toISOString();
  if (canonical !== value) fail(code);
  return canonical;
}

function usageValue(value: GrowthAutonomyRunUsage): GrowthAutonomyRunUsage {
  if (!value || typeof value !== "object") fail("GROWTH_AUTONOMY_RUNTIME_USAGE_INVALID");
  return Object.freeze({
    sourcesVisited: finiteCounter(value.sourcesVisited, "GROWTH_AUTONOMY_RUNTIME_USAGE_INVALID"),
    networkRequests: finiteCounter(value.networkRequests, "GROWTH_AUTONOMY_RUNTIME_USAGE_INVALID"),
    candidatesCreated: finiteCounter(value.candidatesCreated, "GROWTH_AUTONOMY_RUNTIME_USAGE_INVALID"),
    reportsGenerated: finiteCounter(value.reportsGenerated, "GROWTH_AUTONOMY_RUNTIME_USAGE_INVALID"),
    cpuMilliseconds: finiteCounter(value.cpuMilliseconds, "GROWTH_AUTONOMY_RUNTIME_USAGE_INVALID"),
    d1RowsRead: finiteCounter(value.d1RowsRead, "GROWTH_AUTONOMY_RUNTIME_USAGE_INVALID"),
    d1RowsWritten: finiteCounter(value.d1RowsWritten, "GROWTH_AUTONOMY_RUNTIME_USAGE_INVALID"),
    storageBytes: finiteCounter(value.storageBytes, "GROWTH_AUTONOMY_RUNTIME_USAGE_INVALID"),
  });
}

function localParts(now: Date, timezone: string): Readonly<{
  windowKey: string;
  hour: number;
}> {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value]),
  );
  const year = parts.year;
  const month = parts.month;
  const day = parts.day;
  const hour = Number(parts.hour);
  if (!year || !month || !day || !Number.isInteger(hour)) {
    fail("GROWTH_AUTONOMY_RUNTIME_TIMEZONE_FAILED");
  }
  return Object.freeze({ windowKey: `${year}-${month}-${day}`, hour });
}

function isQuietHour(
  hour: number,
  quietHours: GrowthAutonomyPolicy["quietHours"],
): boolean {
  const start = quietHours.startHourInclusive;
  const end = quietHours.endHourExclusive;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

function reservationDecision(value: unknown): GrowthAutonomyReservationDecision {
  if (!value || typeof value !== "object") {
    return Object.freeze({ allowed: false, reason: "temporarily_unavailable" });
  }
  const record = value as Record<string, unknown>;
  if (record.allowed === false) {
    return Object.freeze({
      allowed: false,
      reason: record.reason === "daily_run_limit"
        ? "daily_run_limit"
        : "temporarily_unavailable",
    });
  }
  if (
    record.allowed !== true ||
    typeof record.replayed !== "boolean" ||
    !Number.isSafeInteger(record.runsStarted) ||
    Number(record.runsStarted) < 1
  ) {
    return Object.freeze({ allowed: false, reason: "temporarily_unavailable" });
  }
  return Object.freeze({
    allowed: true,
    reservationId: reservationIdentifier(record.reservationId),
    replayed: record.replayed,
    runsStarted: Number(record.runsStarted),
  });
}

function assertReservation(value: GrowthAutonomyRunReservation): void {
  if (!value || typeof value !== "object" || !RESERVATION_BRAND.has(value)) {
    fail("GROWTH_AUTONOMY_RUNTIME_RESERVATION_UNVERIFIED");
  }
}

function addUsage(
  current: GrowthAutonomyRunUsage,
  delta: Partial<GrowthAutonomyRunUsage>,
  budget: GrowthAutonomyResearchBudget,
): GrowthAutonomyRunUsage {
  if (!delta || typeof delta !== "object" || Array.isArray(delta)) {
    fail("GROWTH_AUTONOMY_RUNTIME_USAGE_DELTA_INVALID");
  }
  const unknownKeys = Object.keys(delta).filter(
    (key) => !(USAGE_KEYS as readonly string[]).includes(key),
  );
  if (unknownKeys.length > 0) fail("GROWTH_AUTONOMY_RUNTIME_USAGE_DELTA_INVALID");
  const next = { ...current };
  for (const key of USAGE_KEYS) {
    const increment = delta[key];
    if (increment === undefined) continue;
    next[key] += finiteCounter(increment, "GROWTH_AUTONOMY_RUNTIME_USAGE_DELTA_INVALID");
  }
  const limits: Readonly<Record<keyof GrowthAutonomyRunUsage, number>> = {
    sourcesVisited: budget.maxSourcesPerRun,
    networkRequests: budget.maxNetworkRequestsPerRun,
    candidatesCreated: budget.maxCandidatesPerRun,
    reportsGenerated: budget.maxReportsPerDay,
    cpuMilliseconds: budget.maxCpuMillisecondsPerRun,
    d1RowsRead: budget.maxD1RowsReadPerRun,
    d1RowsWritten: budget.maxD1RowsWrittenPerRun,
    storageBytes: budget.maxStorageBytesPerRun,
  };
  for (const key of USAGE_KEYS) {
    if (next[key] > limits[key]) {
      fail(`GROWTH_AUTONOMY_RUN_BUDGET_EXCEEDED:${key}`);
    }
  }
  return usageValue(next);
}

export function createGrowthAutonomyRuntime(
  options: GrowthAutonomyRuntimeOptions,
): Readonly<{
  contractVersion: typeof GROWTH_AUTONOMY_RUNTIME_VERSION;
  policy: GrowthAutonomyPolicy;
  start(input: GrowthAutonomyStartInput): Promise<GrowthAutonomyStartDecision>;
}> {
  const policy = parseGrowthAutonomyPolicy(options.policy);
  if (!options.ledger || typeof options.ledger.reserve !== "function" || typeof options.ledger.complete !== "function") {
    fail("GROWTH_AUTONOMY_RUNTIME_LEDGER_INVALID");
  }
  if (options.clock !== undefined && typeof options.clock !== "function") {
    fail("GROWTH_AUTONOMY_RUNTIME_CLOCK_INVALID");
  }
  if (
    options.reservationIdFactory !== undefined &&
    typeof options.reservationIdFactory !== "function"
  ) {
    fail("GROWTH_AUTONOMY_RUNTIME_RESERVATION_FACTORY_INVALID");
  }

  async function start(
    input: GrowthAutonomyStartInput,
  ): Promise<GrowthAutonomyStartDecision> {
    const tenantScope = scope(input.scope);
    const runId = identifier(input.runId, "GROWTH_AUTONOMY_RUNTIME_RUN_ID_INVALID");
    if (typeof input.usageKnown !== "boolean") {
      fail("GROWTH_AUTONOMY_RUNTIME_USAGE_KNOWN_INVALID");
    }
    const estimatedPaidSpendCents = finiteCounter(
      input.estimatedPaidSpendCents,
      "GROWTH_AUTONOMY_RUNTIME_SPEND_INVALID",
    );
    if (!policy.enabled) return Object.freeze({ allowed: false, reason: "paused" });
    if (policy.cost.failClosedWhenUsageUnknown && !input.usageKnown) {
      return Object.freeze({ allowed: false, reason: "usage_unknown" });
    }
    if (estimatedPaidSpendCents > policy.cost.maxPaidSpendCentsPerMonth) {
      return Object.freeze({ allowed: false, reason: "paid_spend_detected" });
    }

    const now = canonicalNow(options.clock);
    const local = localParts(now, policy.timezone);
    if (isQuietHour(local.hour, policy.quietHours)) {
      return Object.freeze({ allowed: false, reason: "quiet_hours" });
    }
    const generatedReservationId = reservationIdentifier(
      options.reservationIdFactory
        ? options.reservationIdFactory()
        : `growth-run:${crypto.getRandomValues(new Uint8Array(24)).reduce(
            (result, byte) => result + byte.toString(16).padStart(2, "0"),
            "",
          )}`,
    );
    const reservedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + GROWTH_AUTONOMY_RESERVATION_TTL_MS).toISOString();

    let decision: GrowthAutonomyReservationDecision;
    try {
      decision = reservationDecision(await options.ledger.reserve({
        scope: tenantScope,
        runId,
        reservationId: generatedReservationId,
        windowKey: local.windowKey,
        profile: policy.profile,
        budget: policy.research,
        reservedAt,
        expiresAt,
      }));
    } catch {
      return Object.freeze({ allowed: false, reason: "temporarily_unavailable" });
    }
    if (!decision.allowed) return decision;

    const reservation = Object.freeze({
      contractVersion: GROWTH_AUTONOMY_RUNTIME_VERSION,
      reservationId: decision.reservationId,
      runId,
      scope: tenantScope,
      windowKey: local.windowKey,
      profile: policy.profile,
      reservedAt,
      expiresAt,
      replayed: decision.replayed,
    });
    RESERVATION_BRAND.add(reservation);

    let currentUsage = usageValue(ZERO_USAGE);
    let finished = false;
    const approvedActions = new Set(input.ownerApprovedExternalActions ?? []);
    for (const action of approvedActions) {
      evaluateGrowthExternalAction(policy, action, true);
    }

    const session: GrowthAutonomyRunSession = Object.freeze({
      contractVersion: GROWTH_AUTONOMY_RUNTIME_VERSION,
      reservation,
      budget: policy.research,
      usage: () => currentUsage,
      consume: (delta) => {
        if (finished) fail("GROWTH_AUTONOMY_RUNTIME_SESSION_FINISHED");
        currentUsage = addUsage(currentUsage, delta, policy.research);
        return currentUsage;
      },
      externalAction: (action) =>
        evaluateGrowthExternalAction(policy, action, approvedActions.has(action)),
      complete: async (outcome) => {
        if (finished) fail("GROWTH_AUTONOMY_RUNTIME_SESSION_FINISHED");
        if (outcome !== "completed" && outcome !== "failed") {
          fail("GROWTH_AUTONOMY_RUNTIME_OUTCOME_INVALID");
        }
        assertReservation(reservation);
        finished = true;
        try {
          await options.ledger.complete({
            reservation,
            outcome,
            usage: currentUsage,
            completedAt: canonicalNow(options.clock).toISOString(),
          });
        } catch {
          fail("GROWTH_AUTONOMY_RUNTIME_COMPLETION_FAILED");
        }
      },
    });
    SESSION_BRAND.add(session);
    return Object.freeze({ allowed: true, session });
  }

  return Object.freeze({
    contractVersion: GROWTH_AUTONOMY_RUNTIME_VERSION,
    policy,
    start,
  });
}

export function assertGrowthAutonomyRunSession(
  value: GrowthAutonomyRunSession,
): void {
  if (!value || typeof value !== "object" || !SESSION_BRAND.has(value)) {
    fail("GROWTH_AUTONOMY_RUNTIME_SESSION_UNVERIFIED");
  }
}
