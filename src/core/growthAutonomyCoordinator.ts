import {
  GROWTH_AUTONOMY_PLAN_VERSION,
  createGrowthAutonomyPlan,
  type GrowthAutonomyPlannerSignals,
  type GrowthAutonomyTask,
} from "./growthAutonomyPlanner";
import type {
  GrowthActionEstimate,
  GrowthOperatingPolicy,
  GrowthUsageCounters,
} from "./growthOperatingPolicy";

export const GROWTH_AUTONOMY_RUN_VERSION = "growth_autonomy_run_v1" as const;

export type GrowthAutonomyScope = Readonly<{
  organisationId: string;
  workspaceId: string;
}>;

export type GrowthAutonomySourceSelection = Readonly<{
  sourceId: string;
  sourceKind:
    | "website"
    | "search"
    | "directory"
    | "newsroom"
    | "procurement"
    | "social"
    | "forum"
    | "video"
    | "dataset"
    | "manual";
  sourceLabel: string;
}>;

export type GrowthAutonomyTaskExecution = Readonly<{
  status: "completed" | "no_change" | "insufficient_evidence";
  summary: string;
  evidenceCount: number;
  candidatesCreated: number;
  draftsCreated: number;
  externalExecutionRequested: false;
  canonicalPromotionRequested: false;
  paidCostIncurredCents: 0;
}>;

export type GrowthAutonomyUsageReservationDecision =
  | Readonly<{ allowed: true; replayed: boolean; reservationId: string }>
  | Readonly<{
      allowed: false;
      reason:
        | "activity_paused"
        | "usage_telemetry_required"
        | "free_only_paid_capability_blocked"
        | "daily_budget_exhausted"
        | "activity_budget_exhausted"
        | "lab_requires_manual_invocation"
        | "reservation_conflict"
        | "temporarily_unavailable";
    }>;

export type GrowthAutonomyTaskResult = Readonly<{
  taskId: string;
  taskKind: GrowthAutonomyTask["taskKind"];
  status:
    | "completed"
    | "no_change"
    | "insufficient_evidence"
    | "source_unavailable"
    | "reservation_denied"
    | "execution_failed"
    | "source_memory_failed";
  summary: string;
  sourceSelected: boolean;
  evidenceCount: number;
  candidatesCreated: number;
  draftsCreated: number;
  reservationReplayed: boolean;
}>;

export type GrowthAutonomyRunResult = Readonly<{
  contractVersion: typeof GROWTH_AUTONOMY_RUN_VERSION;
  planVersion: typeof GROWTH_AUTONOMY_PLAN_VERSION;
  runId: string;
  startedAt: string;
  completedAt: string;
  status: "no_work" | "completed" | "partial" | "failed";
  effectiveActivityLevel: ReturnType<typeof createGrowthAutonomyPlan>["effectiveActivityLevel"];
  tasksPlanned: number;
  tasksReserved: number;
  tasksCompleted: number;
  tasksDeferred: number;
  tasksFailed: number;
  taskResults: readonly GrowthAutonomyTaskResult[];
  externalExecutionEnabled: false;
  canonicalPromotionEnabled: false;
  advertisingSpendEnabled: false;
}>;

export type GrowthAutonomyUsageLedger = Readonly<{
  current(input: Readonly<{
    scope: GrowthAutonomyScope;
    localDay: string;
    now: string;
  }>): Promise<GrowthUsageCounters>;
  reserve(input: Readonly<{
    scope: GrowthAutonomyScope;
    localDay: string;
    runId: string;
    reservationId: string;
    activityLevel: GrowthOperatingPolicy["activityLevel"];
    manualInvocation: boolean;
    estimate: GrowthActionEstimate;
    now: string;
  }>): Promise<GrowthAutonomyUsageReservationDecision>;
}>;

export type GrowthAutonomySourceMemory = Readonly<{
  select(input: Readonly<{
    scope: GrowthAutonomyScope;
    task: GrowthAutonomyTask;
    now: string;
  }>): Promise<GrowthAutonomySourceSelection | null>;
  record(input: Readonly<{
    scope: GrowthAutonomyScope;
    task: GrowthAutonomyTask;
    source: GrowthAutonomySourceSelection;
    outcome:
      | "completed"
      | "no_change"
      | "insufficient_evidence"
      | "execution_failed";
    evidenceCount: number;
    candidatesCreated: number;
    now: string;
  }>): Promise<void>;
}>;

export type GrowthAutonomyTaskExecutor = Readonly<{
  execute(input: Readonly<{
    scope: GrowthAutonomyScope;
    task: GrowthAutonomyTask;
    source: GrowthAutonomySourceSelection | null;
    signal?: AbortSignal;
  }>): Promise<GrowthAutonomyTaskExecution>;
}>;

export type GrowthAutonomyCoordinatorDependencies = Readonly<{
  usageLedger: GrowthAutonomyUsageLedger;
  sourceMemory: GrowthAutonomySourceMemory;
  taskExecutor: GrowthAutonomyTaskExecutor;
  clock?: () => Date;
}>;

export type RunGrowthAutonomyInput = Readonly<{
  scope: GrowthAutonomyScope;
  runId: string;
  policy: GrowthOperatingPolicy;
  signals: GrowthAutonomyPlannerSignals;
  manualInvocation: boolean;
  signal?: AbortSignal;
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{14,158}[A-Za-z0-9]$/;
const SOURCE_ID_PATTERN = /^sha256:[0-9a-f]{64}$/;
const MAX_SUMMARY_CHARS = 600;
const MAX_RESULT_COUNT = 1_000;
const MAX_FAILURES_PER_RUN = 2;
const EXTERNAL_ACTION_CLASSES = new Set([
  "communication.send_email",
  "calendar.create_meeting",
  "social.publish_post",
  "social.publish_comment",
  "content.publish_asset",
  "provider.execute_writeback",
  "advertising.spend",
]);

function fail(code: string): never {
  throw new Error(code);
}

function exactObject(
  value: unknown,
  expected: readonly string[],
  code: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) {
    fail(code);
  }
  return record;
}

function uuid(value: unknown, code: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) fail(code);
  return value.toLowerCase();
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

function nowValue(clock: (() => Date) | undefined): Date {
  const value = clock ? clock() : new Date();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    fail("GROWTH_AUTONOMY_RUN_TIME_INVALID");
  }
  return new Date(value.getTime());
}

function ensureDependency(
  value: unknown,
  methods: readonly string[],
  code: string,
): void {
  if (!value || typeof value !== "object") fail(code);
  const record = value as Record<string, unknown>;
  for (const method of methods) {
    if (typeof record[method] !== "function") fail(code);
  }
}

function sourceSelection(value: unknown): GrowthAutonomySourceSelection | null {
  if (value === null) return null;
  const record = exactObject(
    value,
    ["sourceId", "sourceKind", "sourceLabel"],
    "GROWTH_AUTONOMY_SOURCE_SELECTION_INVALID",
  );
  if (
    typeof record.sourceId !== "string" ||
    !SOURCE_ID_PATTERN.test(record.sourceId) ||
    typeof record.sourceKind !== "string" ||
    ![
      "website",
      "search",
      "directory",
      "newsroom",
      "procurement",
      "social",
      "forum",
      "video",
      "dataset",
      "manual",
    ].includes(record.sourceKind) ||
    typeof record.sourceLabel !== "string" ||
    record.sourceLabel.trim() !== record.sourceLabel ||
    !record.sourceLabel ||
    record.sourceLabel.length > 200 ||
    /\p{Cc}/u.test(record.sourceLabel)
  ) {
    fail("GROWTH_AUTONOMY_SOURCE_SELECTION_INVALID");
  }
  return Object.freeze({
    sourceId: record.sourceId,
    sourceKind: record.sourceKind as GrowthAutonomySourceSelection["sourceKind"],
    sourceLabel: record.sourceLabel,
  });
}

function reservationDecision(
  value: unknown,
  expectedReservationId: string,
): GrowthAutonomyUsageReservationDecision {
  const record = value as Record<string, unknown> | null;
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    fail("GROWTH_AUTONOMY_RESERVATION_INVALID");
  }
  if (record.allowed === true) {
    exactObject(
      record,
      ["allowed", "replayed", "reservationId"],
      "GROWTH_AUTONOMY_RESERVATION_INVALID",
    );
    if (
      typeof record.replayed !== "boolean" ||
      record.reservationId !== expectedReservationId
    ) {
      fail("GROWTH_AUTONOMY_RESERVATION_INVALID");
    }
    return Object.freeze({
      allowed: true,
      replayed: record.replayed,
      reservationId: expectedReservationId,
    });
  }
  if (record.allowed === false) {
    exactObject(record, ["allowed", "reason"], "GROWTH_AUTONOMY_RESERVATION_INVALID");
    if (
      typeof record.reason !== "string" ||
      ![
        "activity_paused",
        "usage_telemetry_required",
        "free_only_paid_capability_blocked",
        "daily_budget_exhausted",
        "activity_budget_exhausted",
        "lab_requires_manual_invocation",
        "reservation_conflict",
        "temporarily_unavailable",
      ].includes(record.reason)
    ) {
      fail("GROWTH_AUTONOMY_RESERVATION_INVALID");
    }
    return Object.freeze({
      allowed: false,
      reason: record.reason as Extract<
        GrowthAutonomyUsageReservationDecision,
        { allowed: false }
      >["reason"],
    });
  }
  fail("GROWTH_AUTONOMY_RESERVATION_INVALID");
}

function resultCount(value: unknown, maximum: number, code: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > maximum) {
    fail(code);
  }
  return Number(value);
}

function taskExecution(
  value: unknown,
  task: GrowthAutonomyTask,
): GrowthAutonomyTaskExecution {
  const record = exactObject(
    value,
    [
      "canonicalPromotionRequested",
      "candidatesCreated",
      "draftsCreated",
      "evidenceCount",
      "externalExecutionRequested",
      "paidCostIncurredCents",
      "status",
      "summary",
    ],
    "GROWTH_AUTONOMY_TASK_RESULT_INVALID",
  );
  if (
    typeof record.status !== "string" ||
    !["completed", "no_change", "insufficient_evidence"].includes(record.status) ||
    typeof record.summary !== "string" ||
    record.summary.trim() !== record.summary ||
    !record.summary ||
    record.summary.length > MAX_SUMMARY_CHARS ||
    /\p{Cc}/u.test(record.summary) ||
    record.externalExecutionRequested !== false ||
    record.canonicalPromotionRequested !== false ||
    record.paidCostIncurredCents !== 0
  ) {
    fail("GROWTH_AUTONOMY_TASK_RESULT_INVALID");
  }
  const evidenceCount = resultCount(
    record.evidenceCount,
    MAX_RESULT_COUNT,
    "GROWTH_AUTONOMY_TASK_RESULT_INVALID",
  );
  const candidatesCreated = resultCount(
    record.candidatesCreated,
    task.estimate.candidatesCreated,
    "GROWTH_AUTONOMY_TASK_RESULT_BUDGET_EXCEEDED",
  );
  const draftsCreated = resultCount(
    record.draftsCreated,
    task.estimate.outboundDraftsCreated,
    "GROWTH_AUTONOMY_TASK_RESULT_BUDGET_EXCEEDED",
  );
  return Object.freeze({
    status: record.status as GrowthAutonomyTaskExecution["status"],
    summary: record.summary,
    evidenceCount,
    candidatesCreated,
    draftsCreated,
    externalExecutionRequested: false,
    canonicalPromotionRequested: false,
    paidCostIncurredCents: 0,
  });
}

function usageSnapshot(value: unknown): GrowthUsageCounters {
  const record = exactObject(
    value,
    [
      "adSpendCents",
      "browserRenderingSeconds",
      "candidatesCreated",
      "d1RowsRead",
      "d1RowsWritten",
      "externalActionsExecuted",
      "externalFetches",
      "outboundDraftsCreated",
      "paidApiCalls",
      "paidModelCalls",
      "queueOperations",
      "runs",
      "telemetryStatus",
      "workerInvocations",
    ],
    "GROWTH_AUTONOMY_USAGE_SNAPSHOT_INVALID",
  );
  if (
    record.telemetryStatus !== "current" &&
    record.telemetryStatus !== "missing" &&
    record.telemetryStatus !== "stale"
  ) {
    fail("GROWTH_AUTONOMY_USAGE_SNAPSHOT_INVALID");
  }
  const numericKeys = Object.keys(record).filter((key) => key !== "telemetryStatus");
  for (const key of numericKeys) {
    if (
      !Number.isSafeInteger(record[key]) ||
      Number(record[key]) < 0 ||
      Number(record[key]) > 10_000_000_000
    ) {
      fail("GROWTH_AUTONOMY_USAGE_SNAPSHOT_INVALID");
    }
  }
  return Object.freeze({
    telemetryStatus: record.telemetryStatus,
    runs: Number(record.runs),
    workerInvocations: Number(record.workerInvocations),
    externalFetches: Number(record.externalFetches),
    d1RowsRead: Number(record.d1RowsRead),
    d1RowsWritten: Number(record.d1RowsWritten),
    queueOperations: Number(record.queueOperations),
    browserRenderingSeconds: Number(record.browserRenderingSeconds),
    paidModelCalls: Number(record.paidModelCalls),
    paidApiCalls: Number(record.paidApiCalls),
    adSpendCents: Number(record.adSpendCents),
    candidatesCreated: Number(record.candidatesCreated),
    outboundDraftsCreated: Number(record.outboundDraftsCreated),
    externalActionsExecuted: Number(record.externalActionsExecuted),
  });
}

function taskResult(input: {
  task: GrowthAutonomyTask;
  status: GrowthAutonomyTaskResult["status"];
  summary: string;
  sourceSelected: boolean;
  evidenceCount?: number;
  candidatesCreated?: number;
  draftsCreated?: number;
  reservationReplayed?: boolean;
}): GrowthAutonomyTaskResult {
  return Object.freeze({
    taskId: input.task.taskId,
    taskKind: input.task.taskKind,
    status: input.status,
    summary: input.summary,
    sourceSelected: input.sourceSelected,
    evidenceCount: input.evidenceCount ?? 0,
    candidatesCreated: input.candidatesCreated ?? 0,
    draftsCreated: input.draftsCreated ?? 0,
    reservationReplayed: input.reservationReplayed ?? false,
  });
}

function finalStatus(
  planned: number,
  completed: number,
  failed: number,
): GrowthAutonomyRunResult["status"] {
  if (planned === 0) return "no_work";
  if (failed === 0 && completed === planned) return "completed";
  if (completed > 0) return "partial";
  return "failed";
}

export function createGrowthAutonomyCoordinator(
  dependencies: GrowthAutonomyCoordinatorDependencies,
): Readonly<{
  contractVersion: typeof GROWTH_AUTONOMY_RUN_VERSION;
  run(input: RunGrowthAutonomyInput): Promise<GrowthAutonomyRunResult>;
}> {
  ensureDependency(
    dependencies.usageLedger,
    ["current", "reserve"],
    "GROWTH_AUTONOMY_USAGE_LEDGER_INVALID",
  );
  ensureDependency(
    dependencies.sourceMemory,
    ["select", "record"],
    "GROWTH_AUTONOMY_SOURCE_MEMORY_INVALID",
  );
  ensureDependency(
    dependencies.taskExecutor,
    ["execute"],
    "GROWTH_AUTONOMY_TASK_EXECUTOR_INVALID",
  );
  if (dependencies.clock !== undefined && typeof dependencies.clock !== "function") {
    fail("GROWTH_AUTONOMY_CLOCK_INVALID");
  }

  async function run(input: RunGrowthAutonomyInput): Promise<GrowthAutonomyRunResult> {
    const started = nowValue(dependencies.clock);
    const scope = Object.freeze({
      organisationId: uuid(input.scope.organisationId, "GROWTH_AUTONOMY_ORGANISATION_INVALID"),
      workspaceId: uuid(input.scope.workspaceId, "GROWTH_AUTONOMY_WORKSPACE_INVALID"),
    });
    const runId = identifier(input.runId, "GROWTH_AUTONOMY_RUN_ID_INVALID");
    if (input.signal?.aborted) fail("GROWTH_AUTONOMY_RUN_ABORTED");

    const provisionalDay = new Intl.DateTimeFormat("en-CA", {
      timeZone: input.policy.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(started);
    const currentUsage = usageSnapshot(await dependencies.usageLedger.current({
      scope,
      localDay: provisionalDay,
      now: started.toISOString(),
    }));
    const plan = createGrowthAutonomyPlan({
      policy: input.policy,
      usage: currentUsage,
      signals: input.signals,
      now: started,
      manualInvocation: input.manualInvocation,
    });
    const results: GrowthAutonomyTaskResult[] = [];
    let reserved = 0;
    let completed = 0;
    let failed = 0;

    for (const [index, task] of plan.tasks.entries()) {
      if (input.signal?.aborted) break;
      if (failed >= MAX_FAILURES_PER_RUN) break;
      if (EXTERNAL_ACTION_CLASSES.has(task.actionClass)) {
        fail("GROWTH_AUTONOMY_EXTERNAL_TASK_FORBIDDEN");
      }

      let source: GrowthAutonomySourceSelection | null = null;
      if (task.requiresSourceSelection) {
        try {
          source = sourceSelection(await dependencies.sourceMemory.select({
            scope,
            task,
            now: nowValue(dependencies.clock).toISOString(),
          }));
        } catch {
          results.push(taskResult({
            task,
            status: "source_memory_failed",
            summary: "Source selection was unavailable; no task work was attempted.",
            sourceSelected: false,
          }));
          failed += 1;
          continue;
        }
        if (!source) {
          results.push(taskResult({
            task,
            status: "source_unavailable",
            summary: "No source passed the current source-quality and policy boundary.",
            sourceSelected: false,
          }));
          continue;
        }
      }

      const reservationId = `${runId}:task:${String(index + 1).padStart(2, "0")}`;
      let reservation: GrowthAutonomyUsageReservationDecision;
      try {
        reservation = reservationDecision(
          await dependencies.usageLedger.reserve({
            scope,
            localDay: plan.localDay,
            runId,
            reservationId,
            activityLevel: input.policy.activityLevel,
            manualInvocation: input.manualInvocation,
            estimate: task.estimate,
            now: nowValue(dependencies.clock).toISOString(),
          }),
          reservationId,
        );
      } catch {
        reservation = Object.freeze({ allowed: false, reason: "temporarily_unavailable" });
      }
      if (!reservation.allowed) {
        results.push(taskResult({
          task,
          status: "reservation_denied",
          summary: `Usage reservation denied: ${reservation.reason}.`,
          sourceSelected: Boolean(source),
        }));
        if (reservation.reason === "temporarily_unavailable") failed += 1;
        continue;
      }
      reserved += 1;

      let execution: GrowthAutonomyTaskExecution;
      try {
        execution = taskExecution(
          await dependencies.taskExecutor.execute({
            scope,
            task,
            source,
            ...(input.signal ? { signal: input.signal } : {}),
          }),
          task,
        );
      } catch {
        results.push(taskResult({
          task,
          status: "execution_failed",
          summary: "The internal task failed after quota reservation; reserved quota was retained.",
          sourceSelected: Boolean(source),
          reservationReplayed: reservation.replayed,
        }));
        failed += 1;
        if (source) {
          try {
            await dependencies.sourceMemory.record({
              scope,
              task,
              source,
              outcome: "execution_failed",
              evidenceCount: 0,
              candidatesCreated: 0,
              now: nowValue(dependencies.clock).toISOString(),
            });
          } catch {
            // The task remains failed and quota remains reserved; the run failure ceiling prevents runaway work.
          }
        }
        continue;
      }

      if (source) {
        try {
          await dependencies.sourceMemory.record({
            scope,
            task,
            source,
            outcome: execution.status,
            evidenceCount: execution.evidenceCount,
            candidatesCreated: execution.candidatesCreated,
            now: nowValue(dependencies.clock).toISOString(),
          });
        } catch {
          results.push(taskResult({
            task,
            status: "source_memory_failed",
            summary: "Task work completed but source outcome memory could not be recorded.",
            sourceSelected: true,
            evidenceCount: execution.evidenceCount,
            candidatesCreated: execution.candidatesCreated,
            draftsCreated: execution.draftsCreated,
            reservationReplayed: reservation.replayed,
          }));
          failed += 1;
          continue;
        }
      }

      results.push(taskResult({
        task,
        status: execution.status,
        summary: execution.summary,
        sourceSelected: Boolean(source),
        evidenceCount: execution.evidenceCount,
        candidatesCreated: execution.candidatesCreated,
        draftsCreated: execution.draftsCreated,
        reservationReplayed: reservation.replayed,
      }));
      completed += 1;
    }

    const completedAt = nowValue(dependencies.clock).toISOString();
    return Object.freeze({
      contractVersion: GROWTH_AUTONOMY_RUN_VERSION,
      planVersion: GROWTH_AUTONOMY_PLAN_VERSION,
      runId,
      startedAt: started.toISOString(),
      completedAt,
      status: finalStatus(plan.tasks.length, completed, failed),
      effectiveActivityLevel: plan.effectiveActivityLevel,
      tasksPlanned: plan.tasks.length,
      tasksReserved: reserved,
      tasksCompleted: completed,
      tasksDeferred: plan.deferred.length + results.filter((value) =>
        value.status === "source_unavailable" || value.status === "reservation_denied"
      ).length,
      tasksFailed: failed,
      taskResults: Object.freeze(results),
      externalExecutionEnabled: false,
      canonicalPromotionEnabled: false,
      advertisingSpendEnabled: false,
    });
  }

  return Object.freeze({
    contractVersion: GROWTH_AUTONOMY_RUN_VERSION,
    run,
  });
}
