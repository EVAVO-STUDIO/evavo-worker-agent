import {
  parseGrowthAutonomyPolicy,
  type GrowthAutonomyPolicy,
} from "./growthAutonomyPolicy";

export const GROWTH_AUTONOMY_SCHEDULER_VERSION =
  "growth_autonomy_scheduler_v1" as const;

export type GrowthAutonomyScheduleScope = Readonly<{
  organisationId: string;
  workspaceId: string;
}>;

export type GrowthAutonomyScheduleInput = Readonly<{
  scope: GrowthAutonomyScheduleScope;
  policy: GrowthAutonomyPolicy;
  now: Date;
  completedSlotKeys: readonly string[];
  manualRunRequested: boolean;
  sourceFrontierDue: boolean;
  canonicalChangesPending: boolean;
  allowExplorationRun: boolean;
}>;

export type GrowthAutonomyScheduleDecision = Readonly<{
  contractVersion: typeof GROWTH_AUTONOMY_SCHEDULER_VERSION;
  due: boolean;
  reason:
    | "paused"
    | "quiet_hours"
    | "before_first_slot"
    | "all_due_slots_completed"
    | "no_value_signal"
    | "manual_request"
    | "source_frontier_due"
    | "canonical_changes_pending"
    | "bounded_exploration";
  windowKey: string;
  slotKey: string | null;
  runId: string | null;
  reportPlanned: boolean;
  scheduledFor: string | null;
  nextCheckAt: string;
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLOT_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}:\d{2}:\d{2}$/;
const PROFILE_SLOTS: Readonly<Record<GrowthAutonomyPolicy["profile"], readonly number[]>> = Object.freeze({
  paused: Object.freeze([]),
  light: Object.freeze([10 * 60]),
  balanced: Object.freeze([9 * 60, 13 * 60, 17 * 60]),
  high: Object.freeze([8 * 60, 10 * 60, 12 * 60, 14 * 60, 16 * 60, 18 * 60]),
});

function fail(code: string): never {
  throw new Error(code);
}

function scopeValue(value: GrowthAutonomyScheduleScope): GrowthAutonomyScheduleScope {
  if (
    !value ||
    typeof value !== "object" ||
    !UUID_PATTERN.test(value.organisationId) ||
    !UUID_PATTERN.test(value.workspaceId)
  ) {
    fail("GROWTH_AUTONOMY_SCHEDULER_SCOPE_INVALID");
  }
  return Object.freeze({
    organisationId: value.organisationId.toLowerCase(),
    workspaceId: value.workspaceId.toLowerCase(),
  });
}

function canonicalNow(value: unknown): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    fail("GROWTH_AUTONOMY_SCHEDULER_TIME_INVALID");
  }
  return new Date(value.getTime());
}

function booleanValue(value: unknown, code: string): boolean {
  if (typeof value !== "boolean") fail(code);
  return value;
}

function completedSlots(values: readonly string[]): ReadonlySet<string> {
  if (!Array.isArray(values) || values.length > 24) {
    fail("GROWTH_AUTONOMY_SCHEDULER_COMPLETED_SLOTS_INVALID");
  }
  const result = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string" || !SLOT_KEY_PATTERN.test(value) || result.has(value)) {
      fail("GROWTH_AUTONOMY_SCHEDULER_COMPLETED_SLOTS_INVALID");
    }
    result.add(value);
  }
  return result;
}

function localParts(now: Date, timezone: string): Readonly<{
  year: string;
  month: string;
  day: string;
  hour: number;
  minute: number;
  windowKey: string;
}> {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value]),
  );
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  if (
    !parts.year ||
    !parts.month ||
    !parts.day ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    fail("GROWTH_AUTONOMY_SCHEDULER_TIMEZONE_FAILED");
  }
  return Object.freeze({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour,
    minute,
    windowKey: `${parts.year}-${parts.month}-${parts.day}`,
  });
}

function isQuietHour(
  hour: number,
  quietHours: GrowthAutonomyPolicy["quietHours"],
): boolean {
  const start = quietHours.startHourInclusive;
  const end = quietHours.endHourExclusive;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

function stableJitterMinutes(scope: GrowthAutonomyScheduleScope, windowKey: string, slot: number): number {
  const input = `${scope.organisationId}:${scope.workspaceId}:${windowKey}:${slot}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 20;
}

function slotKey(windowKey: string, minuteOfDay: number): string {
  const hour = Math.floor(minuteOfDay / 60).toString().padStart(2, "0");
  const minute = (minuteOfDay % 60).toString().padStart(2, "0");
  return `${windowKey}:${hour}:${minute}`;
}

function reportSlotIndexes(slotCount: number, reportCount: number): ReadonlySet<number> {
  if (slotCount < 1 || reportCount < 1) return new Set();
  if (reportCount === 1) return new Set([0]);
  const result = new Set<number>();
  for (let index = 0; index < reportCount; index += 1) {
    result.add(Math.round((index * (slotCount - 1)) / (reportCount - 1)));
  }
  return result;
}

function isoForNextCheck(now: Date): string {
  const next = new Date(now.getTime());
  next.setUTCSeconds(0, 0);
  next.setUTCMinutes(next.getUTCMinutes() + (15 - (next.getUTCMinutes() % 15 || 15)));
  if (next.getTime() <= now.getTime()) next.setUTCMinutes(next.getUTCMinutes() + 15);
  return next.toISOString();
}

function reasonForValueSignal(input: GrowthAutonomyScheduleInput): GrowthAutonomyScheduleDecision["reason"] {
  if (input.manualRunRequested) return "manual_request";
  if (input.canonicalChangesPending) return "canonical_changes_pending";
  if (input.sourceFrontierDue) return "source_frontier_due";
  return "bounded_exploration";
}

export function planGrowthAutonomyRun(
  input: GrowthAutonomyScheduleInput,
): GrowthAutonomyScheduleDecision {
  const policy = parseGrowthAutonomyPolicy(input.policy);
  const observedScope = scopeValue(input.scope);
  const now = canonicalNow(input.now);
  const completed = completedSlots(input.completedSlotKeys);
  booleanValue(input.manualRunRequested, "GROWTH_AUTONOMY_SCHEDULER_SIGNAL_INVALID");
  booleanValue(input.sourceFrontierDue, "GROWTH_AUTONOMY_SCHEDULER_SIGNAL_INVALID");
  booleanValue(input.canonicalChangesPending, "GROWTH_AUTONOMY_SCHEDULER_SIGNAL_INVALID");
  booleanValue(input.allowExplorationRun, "GROWTH_AUTONOMY_SCHEDULER_SIGNAL_INVALID");
  const local = localParts(now, policy.timezone);
  const nextCheckAt = isoForNextCheck(now);

  if (!policy.enabled) {
    return Object.freeze({
      contractVersion: GROWTH_AUTONOMY_SCHEDULER_VERSION,
      due: false,
      reason: "paused",
      windowKey: local.windowKey,
      slotKey: null,
      runId: null,
      reportPlanned: false,
      scheduledFor: null,
      nextCheckAt,
    });
  }
  if (isQuietHour(local.hour, policy.quietHours)) {
    return Object.freeze({
      contractVersion: GROWTH_AUTONOMY_SCHEDULER_VERSION,
      due: false,
      reason: "quiet_hours",
      windowKey: local.windowKey,
      slotKey: null,
      runId: null,
      reportPlanned: false,
      scheduledFor: null,
      nextCheckAt,
    });
  }

  const baseSlots = PROFILE_SLOTS[policy.profile];
  if (baseSlots.length !== policy.research.maxRunsPerDay) {
    fail("GROWTH_AUTONOMY_SCHEDULER_PROFILE_SLOT_MISMATCH");
  }
  const slots = baseSlots.map((slot) => slot + stableJitterMinutes(observedScope, local.windowKey, slot));
  const currentMinute = local.hour * 60 + local.minute;
  const dueIndexes = slots
    .map((slot, index) => ({ slot, index, key: slotKey(local.windowKey, slot) }))
    .filter((entry) => entry.slot <= currentMinute && !completed.has(entry.key));

  if (dueIndexes.length === 0) {
    const anyElapsed = slots.some((slot) => slot <= currentMinute);
    return Object.freeze({
      contractVersion: GROWTH_AUTONOMY_SCHEDULER_VERSION,
      due: false,
      reason: anyElapsed ? "all_due_slots_completed" : "before_first_slot",
      windowKey: local.windowKey,
      slotKey: null,
      runId: null,
      reportPlanned: false,
      scheduledFor: null,
      nextCheckAt,
    });
  }

  if (
    !input.manualRunRequested &&
    !input.sourceFrontierDue &&
    !input.canonicalChangesPending &&
    !input.allowExplorationRun
  ) {
    return Object.freeze({
      contractVersion: GROWTH_AUTONOMY_SCHEDULER_VERSION,
      due: false,
      reason: "no_value_signal",
      windowKey: local.windowKey,
      slotKey: null,
      runId: null,
      reportPlanned: false,
      scheduledFor: null,
      nextCheckAt,
    });
  }

  const selected = dueIndexes[dueIndexes.length - 1];
  if (!selected) fail("GROWTH_AUTONOMY_SCHEDULER_SLOT_SELECTION_FAILED");
  const reports = reportSlotIndexes(slots.length, policy.research.maxReportsPerDay);
  const observedSlotKey = selected.key;
  const runId = `growth-autonomy:${observedScope.organisationId}:${observedScope.workspaceId}:${observedSlotKey}`;
  return Object.freeze({
    contractVersion: GROWTH_AUTONOMY_SCHEDULER_VERSION,
    due: true,
    reason: reasonForValueSignal(input),
    windowKey: local.windowKey,
    slotKey: observedSlotKey,
    runId,
    reportPlanned: reports.has(selected.index),
    scheduledFor: `${observedSlotKey}:00.000`,
    nextCheckAt,
  });
}
