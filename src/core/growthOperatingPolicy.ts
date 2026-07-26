export const GROWTH_OPERATING_POLICY_VERSION = "growth_operating_policy_v1" as const;

export const GROWTH_ACTIVITY_LEVELS = Object.freeze([
  "paused",
  "light",
  "balanced",
  "active",
  "lab",
] as const);

export const GROWTH_AUTONOMY_LEVELS = Object.freeze([
  "observe",
  "draft",
  "approval",
  "trusted",
] as const);

export const GROWTH_COST_MODES = Object.freeze(["free_only"] as const);

export const GROWTH_ACTION_CLASSES = Object.freeze([
  "research.source_discovery",
  "research.public_fetch",
  "research.site_scan",
  "analysis.score_candidate",
  "analysis.generate_report",
  "communication.draft_email",
  "communication.send_email",
  "calendar.propose_slots",
  "calendar.create_meeting",
  "social.draft_post",
  "social.publish_post",
  "social.draft_comment",
  "social.publish_comment",
  "content.prepare_asset",
  "content.publish_asset",
  "provider.prepare_writeback",
  "provider.execute_writeback",
  "advertising.plan_campaign",
  "advertising.spend",
] as const);

export type GrowthActivityLevel = (typeof GROWTH_ACTIVITY_LEVELS)[number];
export type GrowthAutonomyLevel = (typeof GROWTH_AUTONOMY_LEVELS)[number];
export type GrowthCostMode = (typeof GROWTH_COST_MODES)[number];
export type GrowthActionClass = (typeof GROWTH_ACTION_CLASSES)[number];

export type GrowthOperatingPolicy = Readonly<{
  contractVersion: typeof GROWTH_OPERATING_POLICY_VERSION;
  activityLevel: GrowthActivityLevel;
  autonomyLevel: GrowthAutonomyLevel;
  costMode: GrowthCostMode;
  timezone: string;
  requireCurrentUsageTelemetry: true;
  allowTrustedExternalActions: boolean;
}>;

export type GrowthUsageCounters = Readonly<{
  telemetryStatus: "current" | "missing" | "stale";
  runs: number;
  workerInvocations: number;
  externalFetches: number;
  d1RowsRead: number;
  d1RowsWritten: number;
  queueOperations: number;
  browserRenderingSeconds: number;
  paidModelCalls: number;
  paidApiCalls: number;
  adSpendCents: number;
  candidatesCreated: number;
  outboundDraftsCreated: number;
  externalActionsExecuted: number;
}>;

export type GrowthActionEstimate = Readonly<{
  workerInvocations: number;
  externalFetches: number;
  d1RowsRead: number;
  d1RowsWritten: number;
  queueOperations: number;
  browserRenderingSeconds: number;
  paidModelCalls: number;
  paidApiCalls: number;
  adSpendCents: number;
  candidatesCreated: number;
  outboundDraftsCreated: number;
  externalActionsExecuted: number;
}>;

export type GrowthProposedAction = Readonly<{
  actionClass: GrowthActionClass;
  manualInvocation: boolean;
  explicitApproval: boolean;
  trustedScope: boolean;
  targetAllowlisted: boolean;
  platformPolicyConfirmed: boolean;
  estimate: GrowthActionEstimate;
}>;

export type GrowthOperatingDecision = Readonly<{
  contractVersion: typeof GROWTH_OPERATING_POLICY_VERSION;
  outcome: "allow" | "approval_required" | "deny";
  reason:
    | "allowed_internal"
    | "allowed_draft"
    | "allowed_explicit_approval"
    | "allowed_trusted_scope"
    | "activity_paused"
    | "lab_requires_manual_invocation"
    | "usage_telemetry_required"
    | "free_only_paid_capability_blocked"
    | "daily_budget_exhausted"
    | "activity_budget_exhausted"
    | "autonomy_observe_only"
    | "autonomy_draft_only"
    | "approval_required"
    | "target_allowlist_required"
    | "platform_policy_confirmation_required"
    | "meeting_requires_explicit_approval"
    | "advertising_spend_blocked"
    | "trusted_external_actions_disabled";
  effectiveActivityLevel: GrowthActivityLevel;
  budgetHeadroomPercent: number;
}>;

type GrowthBudget = Readonly<{
  manualOnly: boolean;
  maxRunsPerDay: number;
  minimumMinutesBetweenRuns: number;
  maxWorkerInvocationsPerDay: number;
  maxExternalFetchesPerDay: number;
  maxD1RowsReadPerDay: number;
  maxD1RowsWrittenPerDay: number;
  maxCandidatesPerDay: number;
  maxDraftsPerDay: number;
  maxExternalActionsPerDay: number;
}>;

const TIMEZONE_PATTERN = /^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+$/;
const MAX_COUNTER = 10_000_000_000;
const POLICY_KEYS = Object.freeze([
  "activityLevel",
  "allowTrustedExternalActions",
  "autonomyLevel",
  "contractVersion",
  "costMode",
  "requireCurrentUsageTelemetry",
  "timezone",
]);

const ZERO_ESTIMATE: GrowthActionEstimate = Object.freeze({
  workerInvocations: 0,
  externalFetches: 0,
  d1RowsRead: 0,
  d1RowsWritten: 0,
  queueOperations: 0,
  browserRenderingSeconds: 0,
  paidModelCalls: 0,
  paidApiCalls: 0,
  adSpendCents: 0,
  candidatesCreated: 0,
  outboundDraftsCreated: 0,
  externalActionsExecuted: 0,
});

export const GROWTH_ACTIVITY_BUDGETS: Readonly<Record<GrowthActivityLevel, GrowthBudget>> = Object.freeze({
  paused: Object.freeze({
    manualOnly: true,
    maxRunsPerDay: 0,
    minimumMinutesBetweenRuns: 1_440,
    maxWorkerInvocationsPerDay: 0,
    maxExternalFetchesPerDay: 0,
    maxD1RowsReadPerDay: 0,
    maxD1RowsWrittenPerDay: 0,
    maxCandidatesPerDay: 0,
    maxDraftsPerDay: 0,
    maxExternalActionsPerDay: 0,
  }),
  light: Object.freeze({
    manualOnly: false,
    maxRunsPerDay: 2,
    minimumMinutesBetweenRuns: 360,
    maxWorkerInvocationsPerDay: 64,
    maxExternalFetchesPerDay: 48,
    maxD1RowsReadPerDay: 20_000,
    maxD1RowsWrittenPerDay: 250,
    maxCandidatesPerDay: 6,
    maxDraftsPerDay: 6,
    maxExternalActionsPerDay: 2,
  }),
  balanced: Object.freeze({
    manualOnly: false,
    maxRunsPerDay: 6,
    minimumMinutesBetweenRuns: 120,
    maxWorkerInvocationsPerDay: 192,
    maxExternalFetchesPerDay: 144,
    maxD1RowsReadPerDay: 75_000,
    maxD1RowsWrittenPerDay: 750,
    maxCandidatesPerDay: 24,
    maxDraftsPerDay: 24,
    maxExternalActionsPerDay: 6,
  }),
  active: Object.freeze({
    manualOnly: false,
    maxRunsPerDay: 12,
    minimumMinutesBetweenRuns: 60,
    maxWorkerInvocationsPerDay: 384,
    maxExternalFetchesPerDay: 288,
    maxD1RowsReadPerDay: 150_000,
    maxD1RowsWrittenPerDay: 1_500,
    maxCandidatesPerDay: 60,
    maxDraftsPerDay: 60,
    maxExternalActionsPerDay: 12,
  }),
  lab: Object.freeze({
    manualOnly: true,
    maxRunsPerDay: 4,
    minimumMinutesBetweenRuns: 30,
    maxWorkerInvocationsPerDay: 256,
    maxExternalFetchesPerDay: 320,
    maxD1RowsReadPerDay: 200_000,
    maxD1RowsWrittenPerDay: 1_000,
    maxCandidatesPerDay: 80,
    maxDraftsPerDay: 0,
    maxExternalActionsPerDay: 0,
  }),
});

const INTERNAL_ACTIONS = new Set<GrowthActionClass>([
  "research.source_discovery",
  "research.public_fetch",
  "research.site_scan",
  "analysis.score_candidate",
  "analysis.generate_report",
  "calendar.propose_slots",
]);

const DRAFT_ACTIONS = new Set<GrowthActionClass>([
  "communication.draft_email",
  "social.draft_post",
  "social.draft_comment",
  "content.prepare_asset",
  "provider.prepare_writeback",
  "advertising.plan_campaign",
]);

const EXTERNAL_ACTIONS = new Set<GrowthActionClass>([
  "communication.send_email",
  "calendar.create_meeting",
  "social.publish_post",
  "social.publish_comment",
  "content.publish_asset",
  "provider.execute_writeback",
]);

function fail(code: string): never {
  throw new Error(code);
}

function exactObject(value: unknown, keys: readonly string[], code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
  return record;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], code: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) fail(code);
  return value as T;
}

function counter(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > MAX_COUNTER) fail(code);
  return Number(value);
}

function estimateValue(value: GrowthActionEstimate): GrowthActionEstimate {
  return Object.freeze({
    workerInvocations: counter(value.workerInvocations, "GROWTH_OPERATING_ESTIMATE_INVALID"),
    externalFetches: counter(value.externalFetches, "GROWTH_OPERATING_ESTIMATE_INVALID"),
    d1RowsRead: counter(value.d1RowsRead, "GROWTH_OPERATING_ESTIMATE_INVALID"),
    d1RowsWritten: counter(value.d1RowsWritten, "GROWTH_OPERATING_ESTIMATE_INVALID"),
    queueOperations: counter(value.queueOperations, "GROWTH_OPERATING_ESTIMATE_INVALID"),
    browserRenderingSeconds: counter(value.browserRenderingSeconds, "GROWTH_OPERATING_ESTIMATE_INVALID"),
    paidModelCalls: counter(value.paidModelCalls, "GROWTH_OPERATING_ESTIMATE_INVALID"),
    paidApiCalls: counter(value.paidApiCalls, "GROWTH_OPERATING_ESTIMATE_INVALID"),
    adSpendCents: counter(value.adSpendCents, "GROWTH_OPERATING_ESTIMATE_INVALID"),
    candidatesCreated: counter(value.candidatesCreated, "GROWTH_OPERATING_ESTIMATE_INVALID"),
    outboundDraftsCreated: counter(value.outboundDraftsCreated, "GROWTH_OPERATING_ESTIMATE_INVALID"),
    externalActionsExecuted: counter(value.externalActionsExecuted, "GROWTH_OPERATING_ESTIMATE_INVALID"),
  });
}

export function parseGrowthOperatingPolicy(value: unknown): GrowthOperatingPolicy {
  const record = exactObject(value, POLICY_KEYS, "GROWTH_OPERATING_POLICY_INVALID");
  const timezone = record.timezone;
  if (typeof timezone !== "string" || timezone.length > 80 || !TIMEZONE_PATTERN.test(timezone)) {
    fail("GROWTH_OPERATING_POLICY_TIMEZONE_INVALID");
  }
  if (record.requireCurrentUsageTelemetry !== true || typeof record.allowTrustedExternalActions !== "boolean") {
    fail("GROWTH_OPERATING_POLICY_INVALID");
  }
  return Object.freeze({
    contractVersion: enumValue(
      record.contractVersion,
      [GROWTH_OPERATING_POLICY_VERSION],
      "GROWTH_OPERATING_POLICY_VERSION_INVALID",
    ),
    activityLevel: enumValue(record.activityLevel, GROWTH_ACTIVITY_LEVELS, "GROWTH_OPERATING_ACTIVITY_INVALID"),
    autonomyLevel: enumValue(record.autonomyLevel, GROWTH_AUTONOMY_LEVELS, "GROWTH_OPERATING_AUTONOMY_INVALID"),
    costMode: enumValue(record.costMode, GROWTH_COST_MODES, "GROWTH_OPERATING_COST_MODE_INVALID"),
    timezone,
    requireCurrentUsageTelemetry: true,
    allowTrustedExternalActions: record.allowTrustedExternalActions,
  });
}

export function createDefaultGrowthOperatingPolicy(
  overrides: Partial<Omit<GrowthOperatingPolicy, "contractVersion" | "costMode" | "requireCurrentUsageTelemetry">> = {},
): GrowthOperatingPolicy {
  return parseGrowthOperatingPolicy({
    contractVersion: GROWTH_OPERATING_POLICY_VERSION,
    activityLevel: overrides.activityLevel ?? "light",
    autonomyLevel: overrides.autonomyLevel ?? "draft",
    costMode: "free_only",
    timezone: overrides.timezone ?? "Australia/Melbourne",
    requireCurrentUsageTelemetry: true,
    allowTrustedExternalActions: overrides.allowTrustedExternalActions ?? false,
  });
}

export function zeroGrowthActionEstimate(): GrowthActionEstimate {
  return ZERO_ESTIMATE;
}

function projectedRatio(current: number, estimated: number, maximum: number): number {
  if (maximum === 0) return current + estimated === 0 ? 0 : Number.POSITIVE_INFINITY;
  return (current + estimated) / maximum;
}

function budgetRatios(
  budget: GrowthBudget,
  usage: GrowthUsageCounters,
  estimate: GrowthActionEstimate,
): readonly number[] {
  return Object.freeze([
    projectedRatio(usage.runs, 0, budget.maxRunsPerDay),
    projectedRatio(usage.workerInvocations, estimate.workerInvocations, budget.maxWorkerInvocationsPerDay),
    projectedRatio(usage.externalFetches, estimate.externalFetches, budget.maxExternalFetchesPerDay),
    projectedRatio(usage.d1RowsRead, estimate.d1RowsRead, budget.maxD1RowsReadPerDay),
    projectedRatio(usage.d1RowsWritten, estimate.d1RowsWritten, budget.maxD1RowsWrittenPerDay),
    projectedRatio(usage.candidatesCreated, estimate.candidatesCreated, budget.maxCandidatesPerDay),
    projectedRatio(usage.outboundDraftsCreated, estimate.outboundDraftsCreated, budget.maxDraftsPerDay),
    projectedRatio(usage.externalActionsExecuted, estimate.externalActionsExecuted, budget.maxExternalActionsPerDay),
  ]);
}

function activityRank(value: GrowthActivityLevel): number {
  return GROWTH_ACTIVITY_LEVELS.indexOf(value);
}

export function effectiveGrowthActivityLevel(
  policy: GrowthOperatingPolicy,
  usage: GrowthUsageCounters,
): GrowthActivityLevel {
  if (policy.activityLevel === "paused" || usage.telemetryStatus !== "current") return "paused";
  const budget = GROWTH_ACTIVITY_BUDGETS[policy.activityLevel];
  const peak = Math.max(...budgetRatios(budget, usage, ZERO_ESTIMATE));
  if (peak >= 1) return "paused";
  if (peak >= 0.8) return "light";
  if (peak >= 0.6 && activityRank(policy.activityLevel) > activityRank("balanced")) return "balanced";
  return policy.activityLevel;
}

function decision(
  outcome: GrowthOperatingDecision["outcome"],
  reason: GrowthOperatingDecision["reason"],
  effectiveActivityLevel: GrowthActivityLevel,
  budgetHeadroomPercent: number,
): GrowthOperatingDecision {
  return Object.freeze({
    contractVersion: GROWTH_OPERATING_POLICY_VERSION,
    outcome,
    reason,
    effectiveActivityLevel,
    budgetHeadroomPercent: Math.max(0, Math.min(100, Math.floor(budgetHeadroomPercent))),
  });
}

export function evaluateGrowthOperatingAction(input: Readonly<{
  policy: GrowthOperatingPolicy;
  usage: GrowthUsageCounters;
  action: GrowthProposedAction;
}>): GrowthOperatingDecision {
  const policy = parseGrowthOperatingPolicy(input.policy);
  const estimate = estimateValue(input.action.estimate);
  const actionClass = enumValue(input.action.actionClass, GROWTH_ACTION_CLASSES, "GROWTH_OPERATING_ACTION_INVALID");
  const budget = GROWTH_ACTIVITY_BUDGETS[policy.activityLevel];
  const effective = effectiveGrowthActivityLevel(policy, input.usage);
  const ratios = budgetRatios(budget, input.usage, estimate);
  const peak = Math.max(...ratios);
  const headroom = Number.isFinite(peak) ? (1 - peak) * 100 : 0;

  if (policy.activityLevel === "paused") return decision("deny", "activity_paused", effective, headroom);
  if (budget.manualOnly && !input.action.manualInvocation) {
    return decision("deny", "lab_requires_manual_invocation", effective, headroom);
  }
  if (policy.requireCurrentUsageTelemetry && input.usage.telemetryStatus !== "current") {
    return decision("deny", "usage_telemetry_required", "paused", 0);
  }
  if (
    estimate.queueOperations > 0 ||
    estimate.browserRenderingSeconds > 0 ||
    estimate.paidModelCalls > 0 ||
    estimate.paidApiCalls > 0 ||
    estimate.adSpendCents > 0
  ) {
    return decision("deny", "free_only_paid_capability_blocked", effective, headroom);
  }
  if (input.action.actionClass === "advertising.spend") {
    return decision("deny", "advertising_spend_blocked", effective, headroom);
  }
  if (peak > 1) return decision("deny", "daily_budget_exhausted", effective, headroom);
  if (effective === "paused") return decision("deny", "activity_budget_exhausted", effective, headroom);

  if (INTERNAL_ACTIONS.has(actionClass)) {
    return decision("allow", "allowed_internal", effective, headroom);
  }
  if (DRAFT_ACTIONS.has(actionClass)) {
    if (policy.autonomyLevel === "observe") {
      return decision("deny", "autonomy_observe_only", effective, headroom);
    }
    return decision("allow", "allowed_draft", effective, headroom);
  }
  if (!EXTERNAL_ACTIONS.has(actionClass)) {
    return decision("deny", "approval_required", effective, headroom);
  }
  if (actionClass === "calendar.create_meeting" && !input.action.explicitApproval) {
    return decision("approval_required", "meeting_requires_explicit_approval", effective, headroom);
  }
  if (policy.autonomyLevel === "observe") {
    return decision("deny", "autonomy_observe_only", effective, headroom);
  }
  if (policy.autonomyLevel === "draft") {
    return decision("approval_required", "autonomy_draft_only", effective, headroom);
  }
  if (!input.action.targetAllowlisted) {
    return decision("approval_required", "target_allowlist_required", effective, headroom);
  }
  if (!input.action.platformPolicyConfirmed) {
    return decision("approval_required", "platform_policy_confirmation_required", effective, headroom);
  }
  if (input.action.explicitApproval) {
    return decision("allow", "allowed_explicit_approval", effective, headroom);
  }
  if (
    policy.autonomyLevel === "trusted" &&
    policy.allowTrustedExternalActions &&
    input.action.trustedScope
  ) {
    return decision("allow", "allowed_trusted_scope", effective, headroom);
  }
  if (policy.autonomyLevel === "trusted" && !policy.allowTrustedExternalActions) {
    return decision("approval_required", "trusted_external_actions_disabled", effective, headroom);
  }
  return decision("approval_required", "approval_required", effective, headroom);
}
