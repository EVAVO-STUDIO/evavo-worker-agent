export const GROWTH_ACTIVITY_BUDGET_VERSION = "growth_activity_budget_v1" as const;

export const GROWTH_ACTIVITY_INTENSITIES = Object.freeze([
  "paused",
  "light",
  "balanced",
  "high",
  "custom",
] as const);

export const GROWTH_ACTIVITY_ACTION_KINDS = Object.freeze([
  "internal_learning_tick",
  "internal_signal_score",
  "owner_brief_generate",
  "public_research_run",
  "public_directory_scan",
  "candidate_persist",
  "proposal_prepare",
  "report_generate",
  "document_prepare",
  "meeting_agenda_prepare",
  "ai_draft",
  "browser_research",
  "email_send",
  "social_post",
  "social_comment",
  "form_submit",
  "calendar_create",
  "provider_write",
] as const);

export type GrowthActivityIntensity =
  (typeof GROWTH_ACTIVITY_INTENSITIES)[number];
export type GrowthActivityActionKind =
  (typeof GROWTH_ACTIVITY_ACTION_KINDS)[number];
export type GrowthActivityInvocation = "manual" | "scheduled";
export type GrowthActivityChannel =
  | "internal"
  | "public_research"
  | "ai"
  | "browser"
  | "external_state";

export type GrowthActivityLimits = Readonly<{
  manualResearchRunsPerDay: number;
  scheduledExternalResearchRunsPerDay: 0;
  externalFetchesPerDay: number;
  externalFetchesPerRun: number;
  distinctDomainsPerDay: number;
  fetchesPerDomainPerDay: number;
  consecutiveFetchFailuresPerRun: number;
  candidateWritesPerDay: number;
  proposalWritesPerDay: number;
  reportsPerDay: number;
  workerRequestsPerDay: number;
  d1RowsReadPerDay: number;
  d1RowsWrittenPerDay: number;
  queueOperationsPerDay: number;
  browserMinutesPerDay: 0;
  aiCallsPerDay: 0;
  paidServiceCallsPerDay: 0;
  externalActionsPerDay: 0;
  minimumResearchCooldownMinutes: number;
  minimumOpportunityScore: number;
}>;

export type GrowthActivityCounters = Readonly<{
  manualResearchRuns: number;
  scheduledExternalResearchRuns: number;
  externalFetches: number;
  distinctDomains: number;
  candidateWrites: number;
  proposalWrites: number;
  reportsGenerated: number;
  workerRequests: number;
  d1RowsRead: number;
  d1RowsWritten: number;
  queueOperations: number;
  browserMinutes: number;
  aiCalls: number;
  paidServiceCalls: number;
  externalActions: number;
}>;

export type GrowthActivityUsageSnapshot = Readonly<{
  contractVersion: typeof GROWTH_ACTIVITY_BUDGET_VERSION;
  utcDay: string;
  capturedAt: string;
  counters: GrowthActivityCounters;
  targetDomainFetches: number;
  consecutiveFetchFailures: number;
  lastExternalResearchAt: string | null;
}>;

export type GrowthActivityProfile = Readonly<{
  contractVersion: typeof GROWTH_ACTIVITY_BUDGET_VERSION;
  intensity: GrowthActivityIntensity;
  label: string;
  description: string;
  limits: GrowthActivityLimits;
  posture: Readonly<{
    zeroPaidServiceBudget: true;
    freeSafeOnly: true;
    scheduledExternalResearchEnabled: false;
    aiEnabled: false;
    browserEnabled: false;
    externalExecutionEnabled: false;
    automaticRetryEnabled: false;
    accountWideCloudUsageKnown: false;
    persistentUsageAccountingRequired: true;
  }>;
}>;

export type GrowthActivityBudgetReason =
  | "activity_profile_paused"
  | "action_not_implemented"
  | "manual_invocation_required"
  | "owner_approval_required"
  | "explicit_confirmation_required"
  | "scheduled_external_research_forbidden"
  | "ai_calls_forbidden"
  | "browser_runtime_forbidden"
  | "paid_service_calls_forbidden"
  | "external_state_change_forbidden"
  | "usage_snapshot_invalid"
  | "usage_snapshot_stale"
  | "research_cooldown_active"
  | "per_run_budget_exceeded"
  | "daily_budget_exceeded"
  | "domain_budget_exceeded"
  | "failure_circuit_open";

export type GrowthActivityBudgetRequest = Readonly<{
  intensity: GrowthActivityIntensity;
  customLimits?: unknown;
  action: GrowthActivityActionKind;
  invocation: GrowthActivityInvocation;
  requestedUnits?: number;
  ownerApproved?: boolean;
  explicitlyConfirmed?: boolean;
  targetDomain?: string | null;
  usage: GrowthActivityUsageSnapshot;
  now?: Date;
}>;

export type GrowthActivityBudgetDecision = Readonly<{
  contractVersion: typeof GROWTH_ACTIVITY_BUDGET_VERSION;
  allowed: boolean;
  action: GrowthActivityActionKind;
  invocation: GrowthActivityInvocation;
  requestedUnits: number;
  reasons: readonly GrowthActivityBudgetReason[];
  profile: GrowthActivityProfile;
  projectedUsage: GrowthActivityCounters;
  nextEligibleAt: string | null;
  requirements: Readonly<{
    ownerApproval: boolean;
    explicitConfirmation: boolean;
    targetDomain: boolean;
    persistentUsageAccounting: true;
  }>;
  safety: Readonly<{
    zeroPaidServiceBudget: true;
    scheduledExternalResearchEnabled: false;
    aiEnabled: false;
    browserEnabled: false;
    externalExecutionEnabled: false;
    automaticRetryEnabled: false;
  }>;
}>;

type MutableLimits = {
  -readonly [Key in keyof GrowthActivityLimits]: GrowthActivityLimits[Key];
};

type ActionCost = Readonly<{
  manualResearchRuns: number;
  scheduledExternalResearchRuns: number;
  externalFetches: number;
  distinctDomains: number;
  candidateWrites: number;
  proposalWrites: number;
  reportsGenerated: number;
  workerRequests: number;
  d1RowsRead: number;
  d1RowsWritten: number;
  queueOperations: number;
  browserMinutes: number;
  aiCalls: number;
  paidServiceCalls: number;
  externalActions: number;
}>;

type ActionSpec = Readonly<{
  channel: GrowthActivityChannel;
  implemented: boolean;
  requiresOwnerApproval: boolean;
  requiresExplicitConfirmation: boolean;
  requiresTargetDomain: boolean;
  costPerUnit: ActionCost;
}>;

const UTC_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const MAX_USAGE_SNAPSHOT_AGE_MS = 10 * 60 * 1000;
const MAX_USAGE_FUTURE_SKEW_MS = 60 * 1000;

const LIMIT_KEYS = Object.freeze([
  "manualResearchRunsPerDay",
  "scheduledExternalResearchRunsPerDay",
  "externalFetchesPerDay",
  "externalFetchesPerRun",
  "distinctDomainsPerDay",
  "fetchesPerDomainPerDay",
  "consecutiveFetchFailuresPerRun",
  "candidateWritesPerDay",
  "proposalWritesPerDay",
  "reportsPerDay",
  "workerRequestsPerDay",
  "d1RowsReadPerDay",
  "d1RowsWrittenPerDay",
  "queueOperationsPerDay",
  "browserMinutesPerDay",
  "aiCallsPerDay",
  "paidServiceCallsPerDay",
  "externalActionsPerDay",
  "minimumResearchCooldownMinutes",
  "minimumOpportunityScore",
] as const);

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

export const GROWTH_ACTIVITY_HARD_LIMITS: GrowthActivityLimits = Object.freeze({
  manualResearchRunsPerDay: 6,
  scheduledExternalResearchRunsPerDay: 0,
  externalFetchesPerDay: 50,
  externalFetchesPerRun: 15,
  distinctDomainsPerDay: 20,
  fetchesPerDomainPerDay: 4,
  consecutiveFetchFailuresPerRun: 3,
  candidateWritesPerDay: 300,
  proposalWritesPerDay: 100,
  reportsPerDay: 30,
  workerRequestsPerDay: 5_000,
  d1RowsReadPerDay: 500_000,
  d1RowsWrittenPerDay: 10_000,
  queueOperationsPerDay: 1_000,
  browserMinutesPerDay: 0,
  aiCallsPerDay: 0,
  paidServiceCallsPerDay: 0,
  externalActionsPerDay: 0,
  minimumResearchCooldownMinutes: 30,
  minimumOpportunityScore: 1,
});

function frozenLimits(input: MutableLimits): GrowthActivityLimits {
  return Object.freeze({ ...input });
}

const NAMED_LIMITS: Readonly<Record<Exclude<GrowthActivityIntensity, "custom">, GrowthActivityLimits>> = Object.freeze({
  paused: frozenLimits({
    manualResearchRunsPerDay: 0,
    scheduledExternalResearchRunsPerDay: 0,
    externalFetchesPerDay: 0,
    externalFetchesPerRun: 0,
    distinctDomainsPerDay: 0,
    fetchesPerDomainPerDay: 0,
    consecutiveFetchFailuresPerRun: 0,
    candidateWritesPerDay: 0,
    proposalWritesPerDay: 0,
    reportsPerDay: 0,
    workerRequestsPerDay: 0,
    d1RowsReadPerDay: 0,
    d1RowsWrittenPerDay: 0,
    queueOperationsPerDay: 0,
    browserMinutesPerDay: 0,
    aiCallsPerDay: 0,
    paidServiceCallsPerDay: 0,
    externalActionsPerDay: 0,
    minimumResearchCooldownMinutes: 1_440,
    minimumOpportunityScore: 100,
  }),
  light: frozenLimits({
    manualResearchRunsPerDay: 1,
    scheduledExternalResearchRunsPerDay: 0,
    externalFetchesPerDay: 5,
    externalFetchesPerRun: 3,
    distinctDomainsPerDay: 4,
    fetchesPerDomainPerDay: 2,
    consecutiveFetchFailuresPerRun: 1,
    candidateWritesPerDay: 25,
    proposalWritesPerDay: 10,
    reportsPerDay: 3,
    workerRequestsPerDay: 250,
    d1RowsReadPerDay: 25_000,
    d1RowsWrittenPerDay: 500,
    queueOperationsPerDay: 0,
    browserMinutesPerDay: 0,
    aiCallsPerDay: 0,
    paidServiceCallsPerDay: 0,
    externalActionsPerDay: 0,
    minimumResearchCooldownMinutes: 360,
    minimumOpportunityScore: 65,
  }),
  balanced: frozenLimits({
    manualResearchRunsPerDay: 2,
    scheduledExternalResearchRunsPerDay: 0,
    externalFetchesPerDay: 15,
    externalFetchesPerRun: 8,
    distinctDomainsPerDay: 10,
    fetchesPerDomainPerDay: 3,
    consecutiveFetchFailuresPerRun: 2,
    candidateWritesPerDay: 100,
    proposalWritesPerDay: 30,
    reportsPerDay: 10,
    workerRequestsPerDay: 1_000,
    d1RowsReadPerDay: 100_000,
    d1RowsWrittenPerDay: 2_000,
    queueOperationsPerDay: 0,
    browserMinutesPerDay: 0,
    aiCallsPerDay: 0,
    paidServiceCallsPerDay: 0,
    externalActionsPerDay: 0,
    minimumResearchCooldownMinutes: 180,
    minimumOpportunityScore: 55,
  }),
  high: frozenLimits({
    manualResearchRunsPerDay: 4,
    scheduledExternalResearchRunsPerDay: 0,
    externalFetchesPerDay: 40,
    externalFetchesPerRun: 15,
    distinctDomainsPerDay: 20,
    fetchesPerDomainPerDay: 4,
    consecutiveFetchFailuresPerRun: 3,
    candidateWritesPerDay: 300,
    proposalWritesPerDay: 75,
    reportsPerDay: 20,
    workerRequestsPerDay: 5_000,
    d1RowsReadPerDay: 300_000,
    d1RowsWrittenPerDay: 7_500,
    queueOperationsPerDay: 0,
    browserMinutesPerDay: 0,
    aiCallsPerDay: 0,
    paidServiceCallsPerDay: 0,
    externalActionsPerDay: 0,
    minimumResearchCooldownMinutes: 60,
    minimumOpportunityScore: 45,
  }),
});

const PROFILE_COPY: Readonly<Record<Exclude<GrowthActivityIntensity, "custom">, Readonly<{ label: string; description: string }>>> = Object.freeze({
  paused: Object.freeze({
    label: "Paused",
    description: "No Growth activity is admitted. Existing records remain readable.",
  }),
  light: Object.freeze({
    label: "Light",
    description: "One small confirmed research cycle per day with conservative evidence and write caps.",
  }),
  balanced: Object.freeze({
    label: "Balanced",
    description: "Two bounded confirmed research cycles per day with moderate review-queue throughput.",
  }),
  high: Object.freeze({
    label: "High",
    description: "The largest reviewed zero-paid-service envelope. AI, browser and external actions remain disabled.",
  }),
});

const ZERO_COUNTERS: GrowthActivityCounters = Object.freeze({
  manualResearchRuns: 0,
  scheduledExternalResearchRuns: 0,
  externalFetches: 0,
  distinctDomains: 0,
  candidateWrites: 0,
  proposalWrites: 0,
  reportsGenerated: 0,
  workerRequests: 0,
  d1RowsRead: 0,
  d1RowsWritten: 0,
  queueOperations: 0,
  browserMinutes: 0,
  aiCalls: 0,
  paidServiceCalls: 0,
  externalActions: 0,
});

function actionCost(input: Partial<ActionCost> = {}): ActionCost {
  return Object.freeze({ ...ZERO_COUNTERS, ...input });
}

const ACTION_SPECS: Readonly<Record<GrowthActivityActionKind, ActionSpec>> = Object.freeze({
  internal_learning_tick: Object.freeze({
    channel: "internal",
    implemented: true,
    requiresOwnerApproval: false,
    requiresExplicitConfirmation: false,
    requiresTargetDomain: false,
    costPerUnit: actionCost({ workerRequests: 1, d1RowsRead: 500, d1RowsWritten: 25 }),
  }),
  internal_signal_score: Object.freeze({
    channel: "internal",
    implemented: true,
    requiresOwnerApproval: false,
    requiresExplicitConfirmation: false,
    requiresTargetDomain: false,
    costPerUnit: actionCost({ workerRequests: 1, d1RowsRead: 100 }),
  }),
  owner_brief_generate: Object.freeze({
    channel: "internal",
    implemented: true,
    requiresOwnerApproval: false,
    requiresExplicitConfirmation: false,
    requiresTargetDomain: false,
    costPerUnit: actionCost({ workerRequests: 1, d1RowsRead: 1_000, reportsGenerated: 1 }),
  }),
  public_research_run: Object.freeze({
    channel: "public_research",
    implemented: true,
    requiresOwnerApproval: true,
    requiresExplicitConfirmation: true,
    requiresTargetDomain: true,
    costPerUnit: actionCost({
      manualResearchRuns: 1,
      externalFetches: 1,
      distinctDomains: 1,
      workerRequests: 1,
      d1RowsRead: 250,
      d1RowsWritten: 50,
    }),
  }),
  public_directory_scan: Object.freeze({
    channel: "public_research",
    implemented: true,
    requiresOwnerApproval: true,
    requiresExplicitConfirmation: true,
    requiresTargetDomain: true,
    costPerUnit: actionCost({
      manualResearchRuns: 1,
      externalFetches: 1,
      distinctDomains: 1,
      candidateWrites: 10,
      workerRequests: 1,
      d1RowsRead: 500,
      d1RowsWritten: 100,
    }),
  }),
  candidate_persist: Object.freeze({
    channel: "internal",
    implemented: true,
    requiresOwnerApproval: true,
    requiresExplicitConfirmation: true,
    requiresTargetDomain: false,
    costPerUnit: actionCost({ candidateWrites: 1, workerRequests: 1, d1RowsRead: 50, d1RowsWritten: 5 }),
  }),
  proposal_prepare: Object.freeze({
    channel: "internal",
    implemented: true,
    requiresOwnerApproval: false,
    requiresExplicitConfirmation: false,
    requiresTargetDomain: false,
    costPerUnit: actionCost({ proposalWrites: 1, workerRequests: 1, d1RowsRead: 100, d1RowsWritten: 5 }),
  }),
  report_generate: Object.freeze({
    channel: "internal",
    implemented: false,
    requiresOwnerApproval: false,
    requiresExplicitConfirmation: false,
    requiresTargetDomain: false,
    costPerUnit: actionCost({ reportsGenerated: 1, workerRequests: 1, d1RowsRead: 1_500 }),
  }),
  document_prepare: Object.freeze({
    channel: "internal",
    implemented: false,
    requiresOwnerApproval: false,
    requiresExplicitConfirmation: false,
    requiresTargetDomain: false,
    costPerUnit: actionCost({ reportsGenerated: 1, workerRequests: 1, d1RowsRead: 1_500 }),
  }),
  meeting_agenda_prepare: Object.freeze({
    channel: "internal",
    implemented: false,
    requiresOwnerApproval: false,
    requiresExplicitConfirmation: false,
    requiresTargetDomain: false,
    costPerUnit: actionCost({ reportsGenerated: 1, workerRequests: 1, d1RowsRead: 750 }),
  }),
  ai_draft: Object.freeze({
    channel: "ai",
    implemented: false,
    requiresOwnerApproval: true,
    requiresExplicitConfirmation: true,
    requiresTargetDomain: false,
    costPerUnit: actionCost({ workerRequests: 1, aiCalls: 1, paidServiceCalls: 1 }),
  }),
  browser_research: Object.freeze({
    channel: "browser",
    implemented: false,
    requiresOwnerApproval: true,
    requiresExplicitConfirmation: true,
    requiresTargetDomain: true,
    costPerUnit: actionCost({ workerRequests: 1, browserMinutes: 1 }),
  }),
  email_send: Object.freeze({
    channel: "external_state",
    implemented: false,
    requiresOwnerApproval: true,
    requiresExplicitConfirmation: true,
    requiresTargetDomain: false,
    costPerUnit: actionCost({ workerRequests: 1, externalActions: 1 }),
  }),
  social_post: Object.freeze({
    channel: "external_state",
    implemented: false,
    requiresOwnerApproval: true,
    requiresExplicitConfirmation: true,
    requiresTargetDomain: false,
    costPerUnit: actionCost({ workerRequests: 1, externalActions: 1 }),
  }),
  social_comment: Object.freeze({
    channel: "external_state",
    implemented: false,
    requiresOwnerApproval: true,
    requiresExplicitConfirmation: true,
    requiresTargetDomain: false,
    costPerUnit: actionCost({ workerRequests: 1, externalActions: 1 }),
  }),
  form_submit: Object.freeze({
    channel: "external_state",
    implemented: false,
    requiresOwnerApproval: true,
    requiresExplicitConfirmation: true,
    requiresTargetDomain: true,
    costPerUnit: actionCost({ workerRequests: 1, externalActions: 1 }),
  }),
  calendar_create: Object.freeze({
    channel: "external_state",
    implemented: false,
    requiresOwnerApproval: true,
    requiresExplicitConfirmation: true,
    requiresTargetDomain: false,
    costPerUnit: actionCost({ workerRequests: 1, externalActions: 1 }),
  }),
  provider_write: Object.freeze({
    channel: "external_state",
    implemented: false,
    requiresOwnerApproval: true,
    requiresExplicitConfirmation: true,
    requiresTargetDomain: false,
    costPerUnit: actionCost({ workerRequests: 1, externalActions: 1 }),
  }),
});

function exactKeys(record: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  const required = [...expected].sort();
  return actual.length === required.length && actual.every((key, index) => key === required[index]);
}

function integer(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum
    ? value
    : null;
}

function customLimits(value: unknown): GrowthActivityLimits {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GROWTH_ACTIVITY_CUSTOM_LIMITS_INVALID");
  }
  const record = value as Record<string, unknown>;
  if (!exactKeys(record, LIMIT_KEYS)) throw new Error("GROWTH_ACTIVITY_CUSTOM_LIMITS_INVALID");

  const limits: Record<string, number> = {};
  for (const key of LIMIT_KEYS) {
    const hardMaximum = key === "minimumResearchCooldownMinutes"
      ? 1_440
      : key === "minimumOpportunityScore"
        ? 100
        : Number(GROWTH_ACTIVITY_HARD_LIMITS[key]);
    const minimum = key === "minimumResearchCooldownMinutes"
      ? GROWTH_ACTIVITY_HARD_LIMITS.minimumResearchCooldownMinutes
      : key === "minimumOpportunityScore"
        ? 1
        : 0;
    const parsed = integer(record[key], minimum, hardMaximum);
    if (parsed === null) throw new Error(`GROWTH_ACTIVITY_CUSTOM_LIMIT_INVALID:${key}`);
    limits[key] = parsed;
  }

  for (const forcedZero of [
    "scheduledExternalResearchRunsPerDay",
    "browserMinutesPerDay",
    "aiCallsPerDay",
    "paidServiceCallsPerDay",
    "externalActionsPerDay",
  ] as const) {
    if (limits[forcedZero] !== 0) throw new Error(`GROWTH_ACTIVITY_CUSTOM_LIMIT_FORBIDDEN:${forcedZero}`);
  }
  if (limits.externalFetchesPerRun > limits.externalFetchesPerDay) {
    throw new Error("GROWTH_ACTIVITY_CUSTOM_LIMIT_INVALID:externalFetchesPerRun");
  }
  if (limits.fetchesPerDomainPerDay > limits.externalFetchesPerDay) {
    throw new Error("GROWTH_ACTIVITY_CUSTOM_LIMIT_INVALID:fetchesPerDomainPerDay");
  }
  return frozenLimits(limits as MutableLimits);
}

function profilePosture(): GrowthActivityProfile["posture"] {
  return Object.freeze({
    zeroPaidServiceBudget: true,
    freeSafeOnly: true,
    scheduledExternalResearchEnabled: false,
    aiEnabled: false,
    browserEnabled: false,
    externalExecutionEnabled: false,
    automaticRetryEnabled: false,
    accountWideCloudUsageKnown: false,
    persistentUsageAccountingRequired: true,
  });
}

export function resolveGrowthActivityProfile(
  intensity: GrowthActivityIntensity,
  customLimitInput?: unknown,
): GrowthActivityProfile {
  if (!GROWTH_ACTIVITY_INTENSITIES.includes(intensity)) {
    throw new Error("GROWTH_ACTIVITY_INTENSITY_INVALID");
  }
  if (intensity !== "custom" && customLimitInput !== undefined) {
    throw new Error("GROWTH_ACTIVITY_NAMED_PROFILE_OVERRIDES_FORBIDDEN");
  }
  const limits = intensity === "custom"
    ? customLimits(customLimitInput)
    : NAMED_LIMITS[intensity];
  const copy = intensity === "custom"
    ? Object.freeze({
      label: "Custom",
      description: "Operator-tuned limits inside the immutable zero-paid-service hard envelope.",
    })
    : PROFILE_COPY[intensity];
  return Object.freeze({
    contractVersion: GROWTH_ACTIVITY_BUDGET_VERSION,
    intensity,
    label: copy.label,
    description: copy.description,
    limits,
    posture: profilePosture(),
  });
}

function canonicalTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 80) return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  const canonical = new Date(milliseconds).toISOString();
  return canonical === value ? canonical : null;
}

function canonicalNow(value: Date | undefined): Date {
  const now = value ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("GROWTH_ACTIVITY_NOW_INVALID");
  }
  return new Date(now.getTime());
}

function utcDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function validCounters(value: unknown): value is GrowthActivityCounters {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (!exactKeys(record, COUNTER_KEYS)) return false;
  return COUNTER_KEYS.every((key) => integer(record[key], 0, Number.MAX_SAFE_INTEGER) !== null);
}

function usageStatus(
  usage: GrowthActivityUsageSnapshot,
  now: Date,
): "valid" | "invalid" | "stale" {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return "invalid";
  const record = usage as unknown as Record<string, unknown>;
  if (!exactKeys(record, [
    "contractVersion",
    "utcDay",
    "capturedAt",
    "counters",
    "targetDomainFetches",
    "consecutiveFetchFailures",
    "lastExternalResearchAt",
  ])) return "invalid";
  if (usage.contractVersion !== GROWTH_ACTIVITY_BUDGET_VERSION) return "invalid";
  if (!UTC_DAY_PATTERN.test(usage.utcDay) || usage.utcDay !== utcDay(now)) return "stale";
  const capturedAt = canonicalTimestamp(usage.capturedAt);
  if (!capturedAt || !validCounters(usage.counters)) return "invalid";
  const capturedMilliseconds = Date.parse(capturedAt);
  if (capturedMilliseconds > now.getTime() + MAX_USAGE_FUTURE_SKEW_MS) return "invalid";
  if (now.getTime() - capturedMilliseconds > MAX_USAGE_SNAPSHOT_AGE_MS) return "stale";
  if (integer(usage.targetDomainFetches, 0, Number.MAX_SAFE_INTEGER) === null) return "invalid";
  if (integer(usage.consecutiveFetchFailures, 0, Number.MAX_SAFE_INTEGER) === null) return "invalid";
  if (usage.lastExternalResearchAt !== null && canonicalTimestamp(usage.lastExternalResearchAt) === null) {
    return "invalid";
  }
  return "valid";
}

function requestedUnits(value: number | undefined): number {
  if (value === undefined) return 1;
  const parsed = integer(value, 1, 1_000);
  if (parsed === null) throw new Error("GROWTH_ACTIVITY_REQUESTED_UNITS_INVALID");
  return parsed;
}

function targetDomain(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value !== value.toLowerCase() || !DOMAIN_PATTERN.test(value)) {
    throw new Error("GROWTH_ACTIVITY_TARGET_DOMAIN_INVALID");
  }
  return value;
}

function addCounters(
  current: GrowthActivityCounters,
  cost: ActionCost,
  units: number,
  includeDistinctDomain: boolean,
): GrowthActivityCounters {
  const projected = Object.fromEntries(COUNTER_KEYS.map((key) => {
    const multiplier = key === "manualResearchRuns" || key === "distinctDomains" ? 1 : units;
    const extra = key === "distinctDomains" && !includeDistinctDomain ? 0 : cost[key] * multiplier;
    return [key, current[key] + extra];
  })) as unknown as GrowthActivityCounters;
  return Object.freeze(projected);
}

function dailyExceeded(
  projected: GrowthActivityCounters,
  limits: GrowthActivityLimits,
): boolean {
  return (
    projected.manualResearchRuns > limits.manualResearchRunsPerDay ||
    projected.scheduledExternalResearchRuns > limits.scheduledExternalResearchRunsPerDay ||
    projected.externalFetches > limits.externalFetchesPerDay ||
    projected.distinctDomains > limits.distinctDomainsPerDay ||
    projected.candidateWrites > limits.candidateWritesPerDay ||
    projected.proposalWrites > limits.proposalWritesPerDay ||
    projected.reportsGenerated > limits.reportsPerDay ||
    projected.workerRequests > limits.workerRequestsPerDay ||
    projected.d1RowsRead > limits.d1RowsReadPerDay ||
    projected.d1RowsWritten > limits.d1RowsWrittenPerDay ||
    projected.queueOperations > limits.queueOperationsPerDay ||
    projected.browserMinutes > limits.browserMinutesPerDay ||
    projected.aiCalls > limits.aiCallsPerDay ||
    projected.paidServiceCalls > limits.paidServiceCallsPerDay ||
    projected.externalActions > limits.externalActionsPerDay
  );
}

function requirementReasons(
  spec: ActionSpec,
  request: GrowthActivityBudgetRequest,
): GrowthActivityBudgetReason[] {
  const reasons: GrowthActivityBudgetReason[] = [];
  if (spec.requiresOwnerApproval && request.ownerApproved !== true) {
    reasons.push("owner_approval_required");
  }
  if (spec.requiresExplicitConfirmation && request.explicitlyConfirmed !== true) {
    reasons.push("explicit_confirmation_required");
  }
  return reasons;
}

export function evaluateGrowthActivityBudget(
  request: GrowthActivityBudgetRequest,
): GrowthActivityBudgetDecision {
  const profile = resolveGrowthActivityProfile(request.intensity, request.customLimits);
  const units = requestedUnits(request.requestedUnits);
  const now = canonicalNow(request.now);
  const domain = targetDomain(request.targetDomain);
  const spec = ACTION_SPECS[request.action];
  if (!spec) throw new Error("GROWTH_ACTIVITY_ACTION_INVALID");

  const reasons: GrowthActivityBudgetReason[] = [];
  const usageState = usageStatus(request.usage, now);
  if (usageState === "invalid") reasons.push("usage_snapshot_invalid");
  if (usageState === "stale") reasons.push("usage_snapshot_stale");
  if (profile.intensity === "paused") reasons.push("activity_profile_paused");
  if (!spec.implemented) reasons.push("action_not_implemented");
  if (spec.channel === "public_research" && request.invocation !== "manual") {
    reasons.push("scheduled_external_research_forbidden");
    reasons.push("manual_invocation_required");
  }
  if (spec.channel === "ai") reasons.push("ai_calls_forbidden");
  if (spec.channel === "browser") reasons.push("browser_runtime_forbidden");
  if (spec.costPerUnit.paidServiceCalls > 0) reasons.push("paid_service_calls_forbidden");
  if (spec.channel === "external_state") reasons.push("external_state_change_forbidden");
  reasons.push(...requirementReasons(spec, request));
  if (spec.requiresTargetDomain && !domain) reasons.push("domain_budget_exceeded");

  const includeDistinctDomain = Boolean(domain && request.usage.targetDomainFetches === 0);
  const projectedUsage = validCounters(request.usage?.counters)
    ? addCounters(request.usage.counters, spec.costPerUnit, units, includeDistinctDomain)
    : ZERO_COUNTERS;

  if (
    spec.channel === "public_research" &&
    units > profile.limits.externalFetchesPerRun
  ) reasons.push("per_run_budget_exceeded");
  if (
    spec.channel === "public_research" &&
    request.usage?.targetDomainFetches + units > profile.limits.fetchesPerDomainPerDay
  ) reasons.push("domain_budget_exceeded");
  if (
    spec.channel === "public_research" &&
    request.usage?.consecutiveFetchFailures >= profile.limits.consecutiveFetchFailuresPerRun
  ) reasons.push("failure_circuit_open");
  if (validCounters(request.usage?.counters) && dailyExceeded(projectedUsage, profile.limits)) {
    reasons.push("daily_budget_exceeded");
  }

  let nextEligibleAt: string | null = null;
  if (spec.channel === "public_research" && request.usage?.lastExternalResearchAt) {
    const last = Date.parse(request.usage.lastExternalResearchAt);
    const eligible = last + profile.limits.minimumResearchCooldownMinutes * 60 * 1000;
    if (Number.isFinite(last) && now.getTime() < eligible) {
      reasons.push("research_cooldown_active");
      nextEligibleAt = new Date(eligible).toISOString();
    }
  }

  const uniqueReasons = Object.freeze([...new Set(reasons)]);
  return Object.freeze({
    contractVersion: GROWTH_ACTIVITY_BUDGET_VERSION,
    allowed: uniqueReasons.length === 0,
    action: request.action,
    invocation: request.invocation,
    requestedUnits: units,
    reasons: uniqueReasons,
    profile,
    projectedUsage,
    nextEligibleAt,
    requirements: Object.freeze({
      ownerApproval: spec.requiresOwnerApproval,
      explicitConfirmation: spec.requiresExplicitConfirmation,
      targetDomain: spec.requiresTargetDomain,
      persistentUsageAccounting: true,
    }),
    safety: Object.freeze({
      zeroPaidServiceBudget: true,
      scheduledExternalResearchEnabled: false,
      aiEnabled: false,
      browserEnabled: false,
      externalExecutionEnabled: false,
      automaticRetryEnabled: false,
    }),
  });
}

export function emptyGrowthActivityUsageSnapshot(now: Date = new Date()): GrowthActivityUsageSnapshot {
  const canonical = canonicalNow(now);
  return Object.freeze({
    contractVersion: GROWTH_ACTIVITY_BUDGET_VERSION,
    utcDay: utcDay(canonical),
    capturedAt: canonical.toISOString(),
    counters: ZERO_COUNTERS,
    targetDomainFetches: 0,
    consecutiveFetchFailures: 0,
    lastExternalResearchAt: null,
  });
}

export function listGrowthActivityProfiles(): readonly GrowthActivityProfile[] {
  return Object.freeze([
    resolveGrowthActivityProfile("paused"),
    resolveGrowthActivityProfile("light"),
    resolveGrowthActivityProfile("balanced"),
    resolveGrowthActivityProfile("high"),
  ]);
}
