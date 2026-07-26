import {
  GROWTH_AUTONOMY_RUNTIME_VERSION,
  type GrowthAutonomyReservationCompletion,
  type GrowthAutonomyReservationDecision,
  type GrowthAutonomyReservationInput,
  type GrowthAutonomyRunUsage,
  type GrowthAutonomyUsageLedger,
} from "./growthAutonomyRuntime";

export const GROWTH_AUTONOMY_D1_LEDGER_VERSION =
  "growth_autonomy_d1_ledger_v1" as const;

export type D1ResultLike<T = unknown> = Readonly<{
  success?: boolean;
  results?: readonly T[];
  meta?: Readonly<{ changes?: number }>;
}>;

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = unknown>(): Promise<T | null>;
  run<T = unknown>(): Promise<D1ResultLike<T>>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
  batch<T = unknown>(
    statements: readonly D1PreparedStatementLike[],
  ): Promise<readonly D1ResultLike<T>[]>;
}

export type GrowthAutonomyD1LedgerOptions = Readonly<{
  database: D1DatabaseLike;
}>;

const RESERVATION_STATES = new Set(["active", "completed", "failed"]);
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{14,158}[A-Za-z0-9]$/;
const RESERVATION_ID_PATTERN = /^growth-run:[0-9a-f]{48}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WINDOW_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const RESERVE_WINDOW_SQL = `
insert into growth_autonomy_usage_windows (
  organisation_id,
  workspace_id,
  window_key,
  profile,
  max_runs_per_day,
  runs_started,
  reports_generated,
  sources_visited,
  network_requests,
  candidates_created,
  cpu_milliseconds,
  d1_rows_read,
  d1_rows_written,
  storage_bytes,
  estimated_paid_spend_cents,
  last_reservation_id,
  created_at,
  updated_at
) values (?, ?, ?, ?, ?, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, ?, ?, ?)
on conflict (organisation_id, workspace_id, window_key) do update set
  profile = excluded.profile,
  max_runs_per_day = excluded.max_runs_per_day,
  runs_started = growth_autonomy_usage_windows.runs_started + 1,
  last_reservation_id = excluded.last_reservation_id,
  updated_at = excluded.updated_at
where growth_autonomy_usage_windows.runs_started < excluded.max_runs_per_day
  and growth_autonomy_usage_windows.estimated_paid_spend_cents = 0
  and not exists (
    select 1
      from growth_autonomy_run_reservations existing
     where existing.run_id = ?
  )
returning runs_started, last_reservation_id
`;

const INSERT_RESERVATION_SQL = `
insert or ignore into growth_autonomy_run_reservations (
  reservation_id,
  run_id,
  organisation_id,
  workspace_id,
  window_key,
  profile,
  state,
  max_sources_per_run,
  max_network_requests_per_run,
  max_candidates_per_run,
  max_reports_per_run,
  max_cpu_milliseconds_per_run,
  max_d1_rows_read_per_run,
  max_d1_rows_written_per_run,
  max_storage_bytes_per_run,
  sources_visited,
  network_requests,
  candidates_created,
  reports_generated,
  cpu_milliseconds,
  d1_rows_read,
  d1_rows_written,
  storage_bytes,
  reserved_at,
  expires_at,
  completed_at,
  usage_applied
)
select ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0, ?, ?, null, 0
where exists (
  select 1
    from growth_autonomy_usage_windows window
   where window.organisation_id = ?
     and window.workspace_id = ?
     and window.window_key = ?
     and window.last_reservation_id = ?
)
`;

const READ_RESERVATION_SQL = `
select
  reservation_id,
  run_id,
  organisation_id,
  workspace_id,
  window_key,
  profile,
  state,
  reserved_at,
  expires_at,
  completed_at,
  usage_applied,
  (
    select runs_started
      from growth_autonomy_usage_windows window
     where window.organisation_id = reservation.organisation_id
       and window.workspace_id = reservation.workspace_id
       and window.window_key = reservation.window_key
  ) as runs_started
from growth_autonomy_run_reservations reservation
where run_id = ?
limit 1
`;

const COMPLETE_RESERVATION_SQL = `
update growth_autonomy_run_reservations
   set state = ?,
       sources_visited = ?,
       network_requests = ?,
       candidates_created = ?,
       reports_generated = ?,
       cpu_milliseconds = ?,
       d1_rows_read = ?,
       d1_rows_written = ?,
       storage_bytes = ?,
       completed_at = ?
 where reservation_id = ?
   and run_id = ?
   and organisation_id = ?
   and workspace_id = ?
   and window_key = ?
   and (
     state = 'active'
     or (
       state = ?
       and sources_visited = ?
       and network_requests = ?
       and candidates_created = ?
       and reports_generated = ?
       and cpu_milliseconds = ?
       and d1_rows_read = ?
       and d1_rows_written = ?
       and storage_bytes = ?
       and completed_at = ?
     )
   )
`;

const APPLY_USAGE_SQL = `
update growth_autonomy_usage_windows
   set reports_generated = reports_generated + ?,
       sources_visited = sources_visited + ?,
       network_requests = network_requests + ?,
       candidates_created = candidates_created + ?,
       cpu_milliseconds = cpu_milliseconds + ?,
       d1_rows_read = d1_rows_read + ?,
       d1_rows_written = d1_rows_written + ?,
       storage_bytes = storage_bytes + ?,
       updated_at = ?
 where organisation_id = ?
   and workspace_id = ?
   and window_key = ?
   and exists (
     select 1
       from growth_autonomy_run_reservations reservation
      where reservation.reservation_id = ?
        and reservation.usage_applied = 0
   )
`;

const MARK_USAGE_APPLIED_SQL = `
update growth_autonomy_run_reservations
   set usage_applied = 1
 where reservation_id = ?
   and usage_applied = 0
`;

function fail(code: string): never {
  throw new Error(code);
}

function database(value: unknown): D1DatabaseLike {
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as D1DatabaseLike).prepare !== "function" ||
    typeof (value as D1DatabaseLike).batch !== "function"
  ) {
    fail("GROWTH_AUTONOMY_D1_DATABASE_INVALID");
  }
  return value as D1DatabaseLike;
}

function objectValue(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value as Record<string, unknown>;
}

function exactKeys(record: Record<string, unknown>, expected: readonly string[], code: string): void {
  const actual = Object.keys(record).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) {
    fail(code);
  }
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

function reservationId(value: unknown): string {
  if (typeof value !== "string" || !RESERVATION_ID_PATTERN.test(value)) {
    fail("GROWTH_AUTONOMY_D1_RESERVATION_ID_INVALID");
  }
  return value;
}

function uuid(value: unknown, code: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) fail(code);
  return value.toLowerCase();
}

function windowKey(value: unknown): string {
  if (typeof value !== "string" || !WINDOW_PATTERN.test(value)) {
    fail("GROWTH_AUTONOMY_D1_WINDOW_INVALID");
  }
  return value;
}

function timestamp(value: unknown, code: string): string {
  if (typeof value !== "string" || value.length > 80) fail(code);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) fail(code);
  const canonical = new Date(milliseconds).toISOString();
  if (canonical !== value) fail(code);
  return canonical;
}

function counter(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) fail(code);
  return Number(value);
}

function usage(value: GrowthAutonomyRunUsage): GrowthAutonomyRunUsage {
  if (!value || typeof value !== "object") fail("GROWTH_AUTONOMY_D1_USAGE_INVALID");
  return Object.freeze({
    sourcesVisited: counter(value.sourcesVisited, "GROWTH_AUTONOMY_D1_USAGE_INVALID"),
    networkRequests: counter(value.networkRequests, "GROWTH_AUTONOMY_D1_USAGE_INVALID"),
    candidatesCreated: counter(value.candidatesCreated, "GROWTH_AUTONOMY_D1_USAGE_INVALID"),
    reportsGenerated: counter(value.reportsGenerated, "GROWTH_AUTONOMY_D1_USAGE_INVALID"),
    cpuMilliseconds: counter(value.cpuMilliseconds, "GROWTH_AUTONOMY_D1_USAGE_INVALID"),
    d1RowsRead: counter(value.d1RowsRead, "GROWTH_AUTONOMY_D1_USAGE_INVALID"),
    d1RowsWritten: counter(value.d1RowsWritten, "GROWTH_AUTONOMY_D1_USAGE_INVALID"),
    storageBytes: counter(value.storageBytes, "GROWTH_AUTONOMY_D1_USAGE_INVALID"),
  });
}

function reservationRow(value: unknown, input: GrowthAutonomyReservationInput): GrowthAutonomyReservationDecision {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return Object.freeze({ allowed: false, reason: "daily_run_limit" });
  }
  const row = value as Record<string, unknown>;
  exactKeys(
    row,
    [
      "completed_at",
      "expires_at",
      "organisation_id",
      "profile",
      "reservation_id",
      "reserved_at",
      "run_id",
      "runs_started",
      "state",
      "usage_applied",
      "window_key",
      "workspace_id",
    ],
    "GROWTH_AUTONOMY_D1_RESERVATION_RESPONSE_INVALID",
  );
  if (
    uuid(row.organisation_id, "GROWTH_AUTONOMY_D1_RESERVATION_RESPONSE_INVALID") !== input.scope.organisationId ||
    uuid(row.workspace_id, "GROWTH_AUTONOMY_D1_RESERVATION_RESPONSE_INVALID") !== input.scope.workspaceId ||
    identifier(row.run_id, "GROWTH_AUTONOMY_D1_RESERVATION_RESPONSE_INVALID") !== input.runId ||
    windowKey(row.window_key) !== input.windowKey ||
    row.profile !== input.profile ||
    row.state !== "active" ||
    !RESERVATION_STATES.has(String(row.state)) ||
    row.completed_at !== null ||
    row.usage_applied !== 0
  ) {
    fail("GROWTH_AUTONOMY_D1_RESERVATION_RESPONSE_INVALID");
  }
  const observedReservationId = reservationId(row.reservation_id);
  timestamp(row.reserved_at, "GROWTH_AUTONOMY_D1_RESERVATION_RESPONSE_INVALID");
  timestamp(row.expires_at, "GROWTH_AUTONOMY_D1_RESERVATION_RESPONSE_INVALID");
  return Object.freeze({
    allowed: true,
    reservationId: observedReservationId,
    replayed: observedReservationId !== input.reservationId,
    runsStarted: counter(row.runs_started, "GROWTH_AUTONOMY_D1_RESERVATION_RESPONSE_INVALID"),
  });
}

function statementsForReserve(
  db: D1DatabaseLike,
  input: GrowthAutonomyReservationInput,
): readonly D1PreparedStatementLike[] {
  const organisationId = uuid(input.scope.organisationId, "GROWTH_AUTONOMY_D1_SCOPE_INVALID");
  const workspaceId = uuid(input.scope.workspaceId, "GROWTH_AUTONOMY_D1_SCOPE_INVALID");
  const runId = identifier(input.runId, "GROWTH_AUTONOMY_D1_RUN_ID_INVALID");
  const observedReservationId = reservationId(input.reservationId);
  const observedWindow = windowKey(input.windowKey);
  const reservedAt = timestamp(input.reservedAt, "GROWTH_AUTONOMY_D1_RESERVED_AT_INVALID");
  const expiresAt = timestamp(input.expiresAt, "GROWTH_AUTONOMY_D1_EXPIRES_AT_INVALID");
  if (Date.parse(expiresAt) <= Date.parse(reservedAt)) {
    fail("GROWTH_AUTONOMY_D1_RESERVATION_WINDOW_INVALID");
  }
  const budget = input.budget;
  const maxRuns = counter(budget.maxRunsPerDay, "GROWTH_AUTONOMY_D1_BUDGET_INVALID");
  if (maxRuns < 1) fail("GROWTH_AUTONOMY_D1_BUDGET_INVALID");

  return Object.freeze([
    db.prepare(RESERVE_WINDOW_SQL).bind(
      organisationId,
      workspaceId,
      observedWindow,
      input.profile,
      maxRuns,
      observedReservationId,
      reservedAt,
      reservedAt,
      runId,
    ),
    db.prepare(INSERT_RESERVATION_SQL).bind(
      observedReservationId,
      runId,
      organisationId,
      workspaceId,
      observedWindow,
      input.profile,
      budget.maxSourcesPerRun,
      budget.maxNetworkRequestsPerRun,
      budget.maxCandidatesPerRun,
      budget.maxReportsPerDay,
      budget.maxCpuMillisecondsPerRun,
      budget.maxD1RowsReadPerRun,
      budget.maxD1RowsWrittenPerRun,
      budget.maxStorageBytesPerRun,
      reservedAt,
      expiresAt,
      organisationId,
      workspaceId,
      observedWindow,
      observedReservationId,
    ),
  ]);
}

export class GrowthAutonomyD1Ledger implements GrowthAutonomyUsageLedger {
  readonly contractVersion = GROWTH_AUTONOMY_D1_LEDGER_VERSION;
  private readonly db: D1DatabaseLike;

  constructor(options: GrowthAutonomyD1LedgerOptions) {
    this.db = database(options.database);
  }

  async reserve(
    input: GrowthAutonomyReservationInput,
  ): Promise<GrowthAutonomyReservationDecision> {
    if (!input || typeof input !== "object") {
      fail("GROWTH_AUTONOMY_D1_RESERVATION_INPUT_INVALID");
    }
    try {
      await this.db.batch(statementsForReserve(this.db, input));
      const row = await this.db.prepare(READ_RESERVATION_SQL).bind(input.runId).first();
      return reservationRow(row, input);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("GROWTH_AUTONOMY_D1_")) {
        throw error;
      }
      return Object.freeze({ allowed: false, reason: "temporarily_unavailable" });
    }
  }

  async complete(input: GrowthAutonomyReservationCompletion): Promise<void> {
    if (!input || typeof input !== "object") {
      fail("GROWTH_AUTONOMY_D1_COMPLETION_INPUT_INVALID");
    }
    const reservation = input.reservation;
    if (reservation.contractVersion !== GROWTH_AUTONOMY_RUNTIME_VERSION) {
      fail("GROWTH_AUTONOMY_D1_COMPLETION_INPUT_INVALID");
    }
    if (input.outcome !== "completed" && input.outcome !== "failed") {
      fail("GROWTH_AUTONOMY_D1_COMPLETION_INPUT_INVALID");
    }
    const observedUsage = usage(input.usage);
    const completedAt = timestamp(input.completedAt, "GROWTH_AUTONOMY_D1_COMPLETED_AT_INVALID");
    const observedReservationId = reservationId(reservation.reservationId);
    const runId = identifier(reservation.runId, "GROWTH_AUTONOMY_D1_RUN_ID_INVALID");
    const organisationId = uuid(reservation.scope.organisationId, "GROWTH_AUTONOMY_D1_SCOPE_INVALID");
    const workspaceId = uuid(reservation.scope.workspaceId, "GROWTH_AUTONOMY_D1_SCOPE_INVALID");
    const observedWindow = windowKey(reservation.windowKey);

    const completionValues = [
      input.outcome,
      observedUsage.sourcesVisited,
      observedUsage.networkRequests,
      observedUsage.candidatesCreated,
      observedUsage.reportsGenerated,
      observedUsage.cpuMilliseconds,
      observedUsage.d1RowsRead,
      observedUsage.d1RowsWritten,
      observedUsage.storageBytes,
      completedAt,
      observedReservationId,
      runId,
      organisationId,
      workspaceId,
      observedWindow,
      input.outcome,
      observedUsage.sourcesVisited,
      observedUsage.networkRequests,
      observedUsage.candidatesCreated,
      observedUsage.reportsGenerated,
      observedUsage.cpuMilliseconds,
      observedUsage.d1RowsRead,
      observedUsage.d1RowsWritten,
      observedUsage.storageBytes,
      completedAt,
    ] as const;

    try {
      const results = await this.db.batch([
        this.db.prepare(COMPLETE_RESERVATION_SQL).bind(...completionValues),
        this.db.prepare(APPLY_USAGE_SQL).bind(
          observedUsage.reportsGenerated,
          observedUsage.sourcesVisited,
          observedUsage.networkRequests,
          observedUsage.candidatesCreated,
          observedUsage.cpuMilliseconds,
          observedUsage.d1RowsRead,
          observedUsage.d1RowsWritten,
          observedUsage.storageBytes,
          completedAt,
          organisationId,
          workspaceId,
          observedWindow,
          observedReservationId,
        ),
        this.db.prepare(MARK_USAGE_APPLIED_SQL).bind(observedReservationId),
      ]);
      if (results.length !== 3) fail("GROWTH_AUTONOMY_D1_COMPLETION_FAILED");
      const completionChanges = Number(results[0]?.meta?.changes ?? 0);
      if (!Number.isSafeInteger(completionChanges) || completionChanges < 1) {
        fail("GROWTH_AUTONOMY_D1_COMPLETION_CONFLICT");
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("GROWTH_AUTONOMY_D1_")) {
        throw error;
      }
      fail("GROWTH_AUTONOMY_D1_COMPLETION_FAILED");
    }
  }
}
