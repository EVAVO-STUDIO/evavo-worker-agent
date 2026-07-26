import {
  effectiveGrowthActivityLevel,
  type GrowthActivityLevel,
  type GrowthOperatingPolicy,
  type GrowthUsageCounters,
} from "./growthOperatingPolicy";

export const GROWTH_SCHEDULE_GOVERNOR_VERSION =
  "growth_schedule_governor_v1" as const;

export type GrowthScheduleDecision = Readonly<{
  contractVersion: typeof GROWTH_SCHEDULE_GOVERNOR_VERSION;
  due: boolean;
  reason:
    | "scheduled_slot_due"
    | "manual_run_due"
    | "activity_paused"
    | "lab_manual_only"
    | "usage_telemetry_required"
    | "daily_budget_exhausted"
    | "backoff_active"
    | "no_slot_due"
    | "slot_already_claimed";
  effectiveActivityLevel: GrowthActivityLevel;
  localDay: string;
  slotKey: string | null;
  scheduledFor: string | null;
  nextCheckAt: string;
  externalExecutionEnabled: false;
  paidCapabilityEnabled: false;
}>;

export type GrowthScheduleInput = Readonly<{
  policy: GrowthOperatingPolicy;
  usage: GrowthUsageCounters;
  now: Date;
  manualRequested: boolean;
  claimedSlotKeys: readonly string[];
  consecutiveFailures: number;
  backoffUntil: string | null;
}>;

type LocalClock = Readonly<{
  day: string;
  hour: number;
  minute: number;
}>;

const MAX_CLAIMED_SLOTS = 32;
const SLOT_KEY_PATTERN = /^growth-slot:\d{4}-\d{2}-\d{2}:(?:manual:[A-Za-z0-9._-]{8,80}|\d{2})$/;
const MAX_FAILURES = 100;
const SLOT_WINDOW_MINUTES = 55;
const SCHEDULE_HOURS: Readonly<Record<GrowthActivityLevel, readonly number[]>> = Object.freeze({
  paused: Object.freeze([]),
  light: Object.freeze([9, 15]),
  balanced: Object.freeze([8, 10, 12, 14, 16, 18]),
  active: Object.freeze([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]),
  lab: Object.freeze([]),
});

function fail(code: string): never {
  throw new Error(code);
}

function canonicalNow(value: Date): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    fail("GROWTH_SCHEDULE_TIME_INVALID");
  }
  return new Date(value.getTime());
}

function canonicalTimestamp(value: string | null, code: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > 80) fail(code);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) fail(code);
  const canonical = new Date(milliseconds).toISOString();
  if (canonical !== value) fail(code);
  return canonical;
}

function localClock(now: Date, timezone: string): LocalClock {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    fail("GROWTH_SCHEDULE_TIMEZONE_INVALID");
  }
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = Number(values.hour);
  const minute = Number(values.minute);
  if (
    !values.year ||
    !values.month ||
    !values.day ||
    !Number.isSafeInteger(hour) ||
    hour < 0 ||
    hour > 23 ||
    !Number.isSafeInteger(minute) ||
    minute < 0 ||
    minute > 59
  ) {
    fail("GROWTH_SCHEDULE_TIMEZONE_INVALID");
  }
  return Object.freeze({
    day: `${values.year}-${values.month}-${values.day}`,
    hour,
    minute,
  });
}

function claimedSlots(values: readonly string[], localDay: string): ReadonlySet<string> {
  if (!Array.isArray(values) || values.length > MAX_CLAIMED_SLOTS) {
    fail("GROWTH_SCHEDULE_CLAIMS_INVALID");
  }
  const result = new Set<string>();
  for (const value of values) {
    if (
      typeof value !== "string" ||
      !SLOT_KEY_PATTERN.test(value) ||
      !value.startsWith(`growth-slot:${localDay}:`) ||
      result.has(value)
    ) {
      fail("GROWTH_SCHEDULE_CLAIMS_INVALID");
    }
    result.add(value);
  }
  return result;
}

function failureCount(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_FAILURES) {
    fail("GROWTH_SCHEDULE_FAILURE_COUNT_INVALID");
  }
  return value;
}

function derivedBackoffMinutes(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return 0;
  if (consecutiveFailures === 1) return 30;
  if (consecutiveFailures === 2) return 120;
  return 360;
}

function isoAfter(now: Date, minutes: number): string {
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

function nextSlotDelayMinutes(
  clock: LocalClock,
  hours: readonly number[],
): number {
  const current = clock.hour * 60 + clock.minute;
  for (const hour of hours) {
    const candidate = hour * 60;
    if (candidate > current) return candidate - current;
  }
  if (hours.length === 0) return 24 * 60;
  return 24 * 60 - current + hours[0] * 60;
}

function scheduledSlot(
  clock: LocalClock,
  activityLevel: GrowthActivityLevel,
): Readonly<{ key: string; scheduledMinute: number }> | null {
  const currentMinute = clock.hour * 60 + clock.minute;
  for (const hour of SCHEDULE_HOURS[activityLevel]) {
    const scheduledMinute = hour * 60;
    if (
      currentMinute >= scheduledMinute &&
      currentMinute <= scheduledMinute + SLOT_WINDOW_MINUTES
    ) {
      return Object.freeze({
        key: `growth-slot:${clock.day}:${String(hour).padStart(2, "0")}`,
        scheduledMinute,
      });
    }
  }
  return null;
}

function manualSlotKey(localDay: string, now: Date): string {
  const suffix = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `growth-slot:${localDay}:manual:${suffix}`;
}

function result(input: Omit<GrowthScheduleDecision, "contractVersion" | "externalExecutionEnabled" | "paidCapabilityEnabled">): GrowthScheduleDecision {
  return Object.freeze({
    contractVersion: GROWTH_SCHEDULE_GOVERNOR_VERSION,
    ...input,
    externalExecutionEnabled: false,
    paidCapabilityEnabled: false,
  });
}

export function evaluateGrowthSchedule(input: GrowthScheduleInput): GrowthScheduleDecision {
  const now = canonicalNow(input.now);
  const clock = localClock(now, input.policy.timezone);
  const claimed = claimedSlots(input.claimedSlotKeys, clock.day);
  const failures = failureCount(input.consecutiveFailures);
  const explicitBackoff = canonicalTimestamp(
    input.backoffUntil,
    "GROWTH_SCHEDULE_BACKOFF_INVALID",
  );
  const effectiveActivityLevel = effectiveGrowthActivityLevel(input.policy, input.usage);
  const hours = SCHEDULE_HOURS[effectiveActivityLevel];
  const defaultNextCheckAt = isoAfter(
    now,
    Math.max(15, Math.min(360, nextSlotDelayMinutes(clock, hours))),
  );

  if (input.policy.activityLevel === "paused") {
    return result({
      due: false,
      reason: "activity_paused",
      effectiveActivityLevel,
      localDay: clock.day,
      slotKey: null,
      scheduledFor: null,
      nextCheckAt: isoAfter(now, 24 * 60),
    });
  }
  if (input.usage.telemetryStatus !== "current") {
    return result({
      due: false,
      reason: "usage_telemetry_required",
      effectiveActivityLevel: "paused",
      localDay: clock.day,
      slotKey: null,
      scheduledFor: null,
      nextCheckAt: isoAfter(now, 60),
    });
  }
  if (effectiveActivityLevel === "paused") {
    return result({
      due: false,
      reason: "daily_budget_exhausted",
      effectiveActivityLevel,
      localDay: clock.day,
      slotKey: null,
      scheduledFor: null,
      nextCheckAt: isoAfter(now, 24 * 60),
    });
  }

  const failureBackoffUntil = failures === 0
    ? null
    : isoAfter(now, derivedBackoffMinutes(failures));
  const backoffUntil = [explicitBackoff, failureBackoffUntil]
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1) ?? null;
  if (backoffUntil && Date.parse(backoffUntil) > now.getTime()) {
    return result({
      due: false,
      reason: "backoff_active",
      effectiveActivityLevel,
      localDay: clock.day,
      slotKey: null,
      scheduledFor: null,
      nextCheckAt: backoffUntil,
    });
  }

  if (input.manualRequested) {
    const key = manualSlotKey(clock.day, now);
    return result({
      due: true,
      reason: "manual_run_due",
      effectiveActivityLevel,
      localDay: clock.day,
      slotKey: key,
      scheduledFor: now.toISOString(),
      nextCheckAt: defaultNextCheckAt,
    });
  }
  if (input.policy.activityLevel === "lab") {
    return result({
      due: false,
      reason: "lab_manual_only",
      effectiveActivityLevel,
      localDay: clock.day,
      slotKey: null,
      scheduledFor: null,
      nextCheckAt: isoAfter(now, 24 * 60),
    });
  }

  const slot = scheduledSlot(clock, effectiveActivityLevel);
  if (!slot) {
    return result({
      due: false,
      reason: "no_slot_due",
      effectiveActivityLevel,
      localDay: clock.day,
      slotKey: null,
      scheduledFor: null,
      nextCheckAt: defaultNextCheckAt,
    });
  }
  if (claimed.has(slot.key)) {
    return result({
      due: false,
      reason: "slot_already_claimed",
      effectiveActivityLevel,
      localDay: clock.day,
      slotKey: slot.key,
      scheduledFor: null,
      nextCheckAt: defaultNextCheckAt,
    });
  }

  return result({
    due: true,
    reason: "scheduled_slot_due",
    effectiveActivityLevel,
    localDay: clock.day,
    slotKey: slot.key,
    scheduledFor: now.toISOString(),
    nextCheckAt: defaultNextCheckAt,
  });
}
