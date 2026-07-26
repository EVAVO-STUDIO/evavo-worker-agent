export const GROWTH_AUTONOMY_POLICY_VERSION = "growth_autonomy_policy_v1" as const;
export const GROWTH_AUTONOMY_DEFAULT_TIMEZONE = "Australia/Melbourne" as const;

export const GROWTH_AUTONOMY_PROFILES = Object.freeze([
  "paused",
  "light",
  "balanced",
  "high",
] as const);

export const GROWTH_EXTERNAL_ACTION_MODES = Object.freeze([
  "disabled",
  "draft_only",
  "approval_required",
] as const);

export const GROWTH_EXTERNAL_ACTION_KINDS = Object.freeze([
  "email",
  "meeting",
  "social_post",
  "public_comment",
  "paid_advertising",
  "provider_writeback",
] as const);

export type GrowthAutonomyProfile = (typeof GROWTH_AUTONOMY_PROFILES)[number];
export type GrowthExternalActionMode = (typeof GROWTH_EXTERNAL_ACTION_MODES)[number];
export type GrowthExternalActionKind = (typeof GROWTH_EXTERNAL_ACTION_KINDS)[number];

export type GrowthAutonomyResearchBudget = Readonly<{
  maxRunsPerDay: number;
  maxSourcesPerRun: number;
  maxNetworkRequestsPerRun: number;
  maxCandidatesPerRun: number;
  maxReportsPerDay: number;
  maxCpuMillisecondsPerRun: number;
  maxD1RowsReadPerRun: number;
  maxD1RowsWrittenPerRun: number;
  maxStorageBytesPerRun: number;
}>;

export type GrowthAutonomyPolicy = Readonly<{
  contractVersion: typeof GROWTH_AUTONOMY_POLICY_VERSION;
  profile: GrowthAutonomyProfile;
  enabled: boolean;
  timezone: string;
  quietHours: Readonly<{
    startHourInclusive: number;
    endHourExclusive: number;
  }>;
  research: GrowthAutonomyResearchBudget;
  externalActions: Readonly<{
    email: GrowthExternalActionMode;
    meeting: GrowthExternalActionMode;
    socialPost: GrowthExternalActionMode;
    publicComment: GrowthExternalActionMode;
    paidAdvertising: "disabled";
    providerWriteback: "disabled";
    automaticExternalExecutionAllowed: false;
  }>;
  cost: Readonly<{
    paidServicesAllowed: false;
    maxPaidSpendCentsPerMonth: 0;
    failClosedWhenUsageUnknown: true;
  }>;
  quality: Readonly<{
    requireSourceProvenance: true;
    requireOptOutSuppression: true;
    respectRobotsAndPlatformTerms: true;
    requireCrossSourceConfirmation: boolean;
    allowExperimentalResearch: boolean;
    dedupeWindowHours: number;
    maxContactAttemptsPerLead: number;
  }>;
  communication: Readonly<{
    locale: "en-AU";
    voice: "direct_warm_specific";
    avoidGenericAiPhrasing: true;
    initialContactPreference: "email_first";
    callsBeforeAlignmentAllowed: false;
  }>;
}>;

export type GrowthAutonomyUsageSnapshot = Readonly<{
  windowStartedAt: string;
  usageKnown: boolean;
  runsStarted: number;
  reportsGenerated: number;
  estimatedPaidSpendCents: number;
}>;

export type GrowthAutonomyRunDecision = Readonly<{
  allowed: boolean;
  reason:
    | null
    | "paused"
    | "usage_unknown"
    | "paid_spend_detected"
    | "daily_run_limit"
    | "daily_report_limit";
  remainingRuns: number;
  remainingReports: number;
  runBudget: GrowthAutonomyResearchBudget | null;
}>;

export type GrowthExternalActionDecision = Readonly<{
  action: GrowthExternalActionKind;
  mode: GrowthExternalActionMode;
  draftAllowed: boolean;
  executionAllowed: boolean;
  ownerApprovalRequired: boolean;
  reason: "disabled" | "draft_only" | "approval_required" | "approved";
}>;

export const GROWTH_AUTONOMY_HARD_CAPS = Object.freeze({
  maxRunsPerDay: 6,
  maxSourcesPerRun: 32,
  maxNetworkRequestsPerRun: 96,
  maxCandidatesPerRun: 16,
  maxReportsPerDay: 3,
  maxCpuMillisecondsPerRun: 5_000,
  maxD1RowsReadPerRun: 3_000,
  maxD1RowsWrittenPerRun: 150,
  maxStorageBytesPerRun: 3_000_000,
  maxContactAttemptsPerLead: 3,
  maxDedupeWindowHours: 24 * 30,
} as const);

const POLICY_KEYS = Object.freeze([
  "communication",
  "contractVersion",
  "cost",
  "enabled",
  "externalActions",
  "profile",
  "quality",
  "quietHours",
  "research",
  "timezone",
] as const);
const QUIET_HOUR_KEYS = Object.freeze(["endHourExclusive", "startHourInclusive"] as const);
const RESEARCH_KEYS = Object.freeze([
  "maxCandidatesPerRun",
  "maxCpuMillisecondsPerRun",
  "maxD1RowsReadPerRun",
  "maxD1RowsWrittenPerRun",
  "maxNetworkRequestsPerRun",
  "maxReportsPerDay",
  "maxRunsPerDay",
  "maxSourcesPerRun",
  "maxStorageBytesPerRun",
] as const);
const EXTERNAL_ACTION_KEYS = Object.freeze([
  "automaticExternalExecutionAllowed",
  "email",
  "meeting",
  "paidAdvertising",
  "providerWriteback",
  "publicComment",
  "socialPost",
] as const);
const COST_KEYS = Object.freeze([
  "failClosedWhenUsageUnknown",
  "maxPaidSpendCentsPerMonth",
  "paidServicesAllowed",
] as const);
const QUALITY_KEYS = Object.freeze([
  "allowExperimentalResearch",
  "dedupeWindowHours",
  "maxContactAttemptsPerLead",
  "requireCrossSourceConfirmation",
  "requireOptOutSuppression",
  "requireSourceProvenance",
  "respectRobotsAndPlatformTerms",
] as const);
const COMMUNICATION_KEYS = Object.freeze([
  "avoidGenericAiPhrasing",
  "callsBeforeAlignmentAllowed",
  "initialContactPreference",
  "locale",
  "voice",
] as const);
const USAGE_KEYS = Object.freeze([
  "estimatedPaidSpendCents",
  "reportsGenerated",
  "runsStarted",
  "usageKnown",
  "windowStartedAt",
] as const);

const PROFILE_RESEARCH: Readonly<Record<GrowthAutonomyProfile, GrowthAutonomyResearchBudget>> = Object.freeze({
  paused: Object.freeze({
    maxRunsPerDay: 0,
    maxSourcesPerRun: 0,
    maxNetworkRequestsPerRun: 0,
    maxCandidatesPerRun: 0,
    maxReportsPerDay: 0,
    maxCpuMillisecondsPerRun: 0,
    maxD1RowsReadPerRun: 0,
    maxD1RowsWrittenPerRun: 0,
    maxStorageBytesPerRun: 0,
  }),
  light: Object.freeze({
    maxRunsPerDay: 1,
    maxSourcesPerRun: 8,
    maxNetworkRequestsPerRun: 16,
    maxCandidatesPerRun: 3,
    maxReportsPerDay: 1,
    maxCpuMillisecondsPerRun: 1_500,
    maxD1RowsReadPerRun: 250,
    maxD1RowsWrittenPerRun: 20,
    maxStorageBytesPerRun: 500_000,
  }),
  balanced: Object.freeze({
    maxRunsPerDay: 3,
    maxSourcesPerRun: 16,
    maxNetworkRequestsPerRun: 40,
    maxCandidatesPerRun: 8,
    maxReportsPerDay: 2,
    maxCpuMillisecondsPerRun: 3_000,
    maxD1RowsReadPerRun: 1_000,
    maxD1RowsWrittenPerRun: 60,
    maxStorageBytesPerRun: 1_500_000,
  }),
  high: Object.freeze({
    maxRunsPerDay: 6,
    maxSourcesPerRun: 32,
    maxNetworkRequestsPerRun: 96,
    maxCandidatesPerRun: 16,
    maxReportsPerDay: 3,
    maxCpuMillisecondsPerRun: 5_000,
    maxD1RowsReadPerRun: 3_000,
    maxD1RowsWrittenPerRun: 150,
    maxStorageBytesPerRun: 3_000_000,
  }),
});

function fail(code: string): never {
  throw new Error(code);
}

function objectValue(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value as Record<string, unknown>;
}

function exactKeys(
  record: Record<string, unknown>,
  expected: readonly string[],
  code: string,
): void {
  const actual = Object.keys(record).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) {
    fail(code);
  }
}

function integer(value: unknown, minimum: number, maximum: number, code: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) fail(code);
  return Number(value);
}

function profileValue(value: unknown): GrowthAutonomyProfile {
  if (typeof value !== "string" || !GROWTH_AUTONOMY_PROFILES.includes(value as GrowthAutonomyProfile)) {
    fail("GROWTH_AUTONOMY_PROFILE_INVALID");
  }
  return value as GrowthAutonomyProfile;
}

function timezoneValue(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length < 3 ||
    value.length > 64 ||
    /\p{Cc}/u.test(value)
  ) {
    fail("GROWTH_AUTONOMY_TIMEZONE_INVALID");
  }
  try {
    new Intl.DateTimeFormat("en-AU", { timeZone: value }).format(new Date(0));
  } catch {
    fail("GROWTH_AUTONOMY_TIMEZONE_INVALID");
  }
  return value;
}

function externalMode(value: unknown, code: string): GrowthExternalActionMode {
  if (typeof value !== "string" || !GROWTH_EXTERNAL_ACTION_MODES.includes(value as GrowthExternalActionMode)) {
    fail(code);
  }
  return value as GrowthExternalActionMode;
}

function deepFreezePolicy(policy: GrowthAutonomyPolicy): GrowthAutonomyPolicy {
  Object.freeze(policy.quietHours);
  Object.freeze(policy.research);
  Object.freeze(policy.externalActions);
  Object.freeze(policy.cost);
  Object.freeze(policy.quality);
  Object.freeze(policy.communication);
  return Object.freeze(policy);
}

function externalActionsForProfile(
  profile: GrowthAutonomyProfile,
): GrowthAutonomyPolicy["externalActions"] {
  if (profile === "paused") {
    return Object.freeze({
      email: "disabled",
      meeting: "disabled",
      socialPost: "disabled",
      publicComment: "disabled",
      paidAdvertising: "disabled",
      providerWriteback: "disabled",
      automaticExternalExecutionAllowed: false,
    });
  }
  if (profile === "light") {
    return Object.freeze({
      email: "draft_only",
      meeting: "draft_only",
      socialPost: "draft_only",
      publicComment: "disabled",
      paidAdvertising: "disabled",
      providerWriteback: "disabled",
      automaticExternalExecutionAllowed: false,
    });
  }
  return Object.freeze({
    email: "approval_required",
    meeting: "approval_required",
    socialPost: "approval_required",
    publicComment: "approval_required",
    paidAdvertising: "disabled",
    providerWriteback: "disabled",
    automaticExternalExecutionAllowed: false,
  });
}

export function growthAutonomyPolicyForProfile(
  profileInput: GrowthAutonomyProfile,
  timezoneInput: string = GROWTH_AUTONOMY_DEFAULT_TIMEZONE,
): GrowthAutonomyPolicy {
  const profile = profileValue(profileInput);
  const timezone = timezoneValue(timezoneInput);
  const qualityByProfile = {
    paused: { crossSource: true, experimental: false, dedupe: 24 * 30, contacts: 0 },
    light: { crossSource: true, experimental: false, dedupe: 24 * 7, contacts: 1 },
    balanced: { crossSource: true, experimental: true, dedupe: 24 * 14, contacts: 2 },
    high: { crossSource: true, experimental: true, dedupe: 24 * 30, contacts: 3 },
  } as const;
  const quality = qualityByProfile[profile];
  return deepFreezePolicy({
    contractVersion: GROWTH_AUTONOMY_POLICY_VERSION,
    profile,
    enabled: profile !== "paused",
    timezone,
    quietHours: Object.freeze({ startHourInclusive: 20, endHourExclusive: 8 }),
    research: Object.freeze({ ...PROFILE_RESEARCH[profile] }),
    externalActions: externalActionsForProfile(profile),
    cost: Object.freeze({
      paidServicesAllowed: false,
      maxPaidSpendCentsPerMonth: 0,
      failClosedWhenUsageUnknown: true,
    }),
    quality: Object.freeze({
      requireSourceProvenance: true,
      requireOptOutSuppression: true,
      respectRobotsAndPlatformTerms: true,
      requireCrossSourceConfirmation: quality.crossSource,
      allowExperimentalResearch: quality.experimental,
      dedupeWindowHours: quality.dedupe,
      maxContactAttemptsPerLead: quality.contacts,
    }),
    communication: Object.freeze({
      locale: "en-AU",
      voice: "direct_warm_specific",
      avoidGenericAiPhrasing: true,
      initialContactPreference: "email_first",
      callsBeforeAlignmentAllowed: false,
    }),
  });
}

export function defaultGrowthAutonomyPolicy(): GrowthAutonomyPolicy {
  return growthAutonomyPolicyForProfile("light");
}

export function parseGrowthAutonomyPolicy(value: unknown): GrowthAutonomyPolicy {
  const record = objectValue(value, "GROWTH_AUTONOMY_POLICY_OBJECT_REQUIRED");
  exactKeys(record, POLICY_KEYS, "GROWTH_AUTONOMY_POLICY_FIELDS_INVALID");
  if (record.contractVersion !== GROWTH_AUTONOMY_POLICY_VERSION) {
    fail("GROWTH_AUTONOMY_POLICY_VERSION_INVALID");
  }
  const profile = profileValue(record.profile);
  const expected = growthAutonomyPolicyForProfile(profile, timezoneValue(record.timezone));

  const quietHours = objectValue(record.quietHours, "GROWTH_AUTONOMY_QUIET_HOURS_INVALID");
  const research = objectValue(record.research, "GROWTH_AUTONOMY_RESEARCH_INVALID");
  const externalActions = objectValue(record.externalActions, "GROWTH_AUTONOMY_EXTERNAL_ACTIONS_INVALID");
  const cost = objectValue(record.cost, "GROWTH_AUTONOMY_COST_INVALID");
  const quality = objectValue(record.quality, "GROWTH_AUTONOMY_QUALITY_INVALID");
  const communication = objectValue(record.communication, "GROWTH_AUTONOMY_COMMUNICATION_INVALID");
  exactKeys(quietHours, QUIET_HOUR_KEYS, "GROWTH_AUTONOMY_QUIET_HOURS_INVALID");
  exactKeys(research, RESEARCH_KEYS, "GROWTH_AUTONOMY_RESEARCH_INVALID");
  exactKeys(externalActions, EXTERNAL_ACTION_KEYS, "GROWTH_AUTONOMY_EXTERNAL_ACTIONS_INVALID");
  exactKeys(cost, COST_KEYS, "GROWTH_AUTONOMY_COST_INVALID");
  exactKeys(quality, QUALITY_KEYS, "GROWTH_AUTONOMY_QUALITY_INVALID");
  exactKeys(communication, COMMUNICATION_KEYS, "GROWTH_AUTONOMY_COMMUNICATION_INVALID");

  if (JSON.stringify(record) !== JSON.stringify(expected)) {
    fail("GROWTH_AUTONOMY_POLICY_PRESET_MISMATCH");
  }
  return expected;
}

export function parseGrowthAutonomyPolicyJson(value: string | undefined): GrowthAutonomyPolicy {
  if (value === undefined || value.trim() === "") return defaultGrowthAutonomyPolicy();
  if (value.length > 32_000) fail("GROWTH_AUTONOMY_POLICY_JSON_TOO_LARGE");
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    fail("GROWTH_AUTONOMY_POLICY_JSON_INVALID");
  }
  return parseGrowthAutonomyPolicy(parsed);
}

export function parseGrowthAutonomyUsageSnapshot(value: unknown): GrowthAutonomyUsageSnapshot {
  const record = objectValue(value, "GROWTH_AUTONOMY_USAGE_OBJECT_REQUIRED");
  exactKeys(record, USAGE_KEYS, "GROWTH_AUTONOMY_USAGE_FIELDS_INVALID");
  if (typeof record.windowStartedAt !== "string" || !Number.isFinite(Date.parse(record.windowStartedAt))) {
    fail("GROWTH_AUTONOMY_USAGE_WINDOW_INVALID");
  }
  const windowStartedAt = new Date(Date.parse(record.windowStartedAt)).toISOString();
  if (windowStartedAt !== record.windowStartedAt) fail("GROWTH_AUTONOMY_USAGE_WINDOW_INVALID");
  if (typeof record.usageKnown !== "boolean") fail("GROWTH_AUTONOMY_USAGE_KNOWN_INVALID");
  return Object.freeze({
    windowStartedAt,
    usageKnown: record.usageKnown,
    runsStarted: integer(record.runsStarted, 0, 1_000_000, "GROWTH_AUTONOMY_USAGE_RUNS_INVALID"),
    reportsGenerated: integer(record.reportsGenerated, 0, 1_000_000, "GROWTH_AUTONOMY_USAGE_REPORTS_INVALID"),
    estimatedPaidSpendCents: integer(
      record.estimatedPaidSpendCents,
      0,
      1_000_000_000,
      "GROWTH_AUTONOMY_USAGE_SPEND_INVALID",
    ),
  });
}

export function evaluateGrowthAutonomyRun(
  policyInput: GrowthAutonomyPolicy,
  usageInput: GrowthAutonomyUsageSnapshot,
): GrowthAutonomyRunDecision {
  const policy = parseGrowthAutonomyPolicy(policyInput);
  const usage = parseGrowthAutonomyUsageSnapshot(usageInput);
  const remainingRuns = Math.max(0, policy.research.maxRunsPerDay - usage.runsStarted);
  const remainingReports = Math.max(0, policy.research.maxReportsPerDay - usage.reportsGenerated);
  let reason: GrowthAutonomyRunDecision["reason"] = null;
  if (!policy.enabled) reason = "paused";
  else if (policy.cost.failClosedWhenUsageUnknown && !usage.usageKnown) reason = "usage_unknown";
  else if (usage.estimatedPaidSpendCents > policy.cost.maxPaidSpendCentsPerMonth) reason = "paid_spend_detected";
  else if (remainingRuns < 1) reason = "daily_run_limit";
  else if (remainingReports < 1) reason = "daily_report_limit";
  return Object.freeze({
    allowed: reason === null,
    reason,
    remainingRuns,
    remainingReports,
    runBudget: reason === null ? policy.research : null,
  });
}

export function evaluateGrowthExternalAction(
  policyInput: GrowthAutonomyPolicy,
  actionInput: GrowthExternalActionKind,
  ownerApproved: boolean,
): GrowthExternalActionDecision {
  const policy = parseGrowthAutonomyPolicy(policyInput);
  if (!GROWTH_EXTERNAL_ACTION_KINDS.includes(actionInput)) {
    fail("GROWTH_AUTONOMY_EXTERNAL_ACTION_KIND_INVALID");
  }
  if (typeof ownerApproved !== "boolean") fail("GROWTH_AUTONOMY_OWNER_APPROVAL_INVALID");
  const modeByAction: Readonly<Record<GrowthExternalActionKind, GrowthExternalActionMode>> = {
    email: policy.externalActions.email,
    meeting: policy.externalActions.meeting,
    social_post: policy.externalActions.socialPost,
    public_comment: policy.externalActions.publicComment,
    paid_advertising: policy.externalActions.paidAdvertising,
    provider_writeback: policy.externalActions.providerWriteback,
  };
  const mode = modeByAction[actionInput];
  const draftAllowed = mode === "draft_only" || mode === "approval_required";
  const executionAllowed = mode === "approval_required" && ownerApproved;
  return Object.freeze({
    action: actionInput,
    mode,
    draftAllowed,
    executionAllowed,
    ownerApprovalRequired: mode === "approval_required" && !ownerApproved,
    reason: mode === "disabled"
      ? "disabled"
      : mode === "draft_only"
        ? "draft_only"
        : ownerApproved
          ? "approved"
          : "approval_required",
  });
}
