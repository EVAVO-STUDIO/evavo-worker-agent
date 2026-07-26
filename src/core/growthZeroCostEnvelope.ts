import {
  GROWTH_ACTIVITY_HARD_LIMITS,
  listGrowthActivityProfiles,
  type GrowthActivityIntensity,
  type GrowthActivityLimits,
} from "./growthActivityBudget";

export const GROWTH_ZERO_COST_ENVELOPE_VERSION =
  "growth_zero_cost_envelope_v1" as const;
export const GROWTH_ZERO_COST_LIMIT_SNAPSHOT = "2026-07-26" as const;
export const GROWTH_ZERO_COST_REVIEW_BY = "2026-10-01" as const;

export const GROWTH_ZERO_COST_FREE_LIMITS = Object.freeze({
  workersRequestsPerDay: 100_000,
  workersCpuMillisecondsPerInvocation: 10,
  externalSubrequestsPerInvocation: 50,
  cloudServiceSubrequestsPerInvocation: 1_000,
  cronTriggersPerAccount: 5,
  d1RowsReadPerDay: 5_000_000,
  d1RowsWrittenPerDay: 100_000,
  d1StorageBytesPerAccount: 5_000_000_000,
  d1StorageBytesPerDatabase: 500_000_000,
  queueOperationsPerDay: 10_000,
  queueRetentionHours: 24,
  kvReadsPerDay: 100_000,
  kvWritesPerDay: 1_000,
  workersAiNeuronsPerDay: 10_000,
  browserMinutesPerDay: 10,
  browserConcurrentSessions: 3,
} as const);

export const GROWTH_ZERO_COST_RESERVATION_CEILINGS = Object.freeze({
  workersRequestsPerDay: 10_000,
  externalSubrequestsPerInvocation: 15,
  d1RowsReadPerDay: 500_000,
  d1RowsWrittenPerDay: 10_000,
  queueOperationsPerDay: 1_000,
  workersAiNeuronsPerDay: 0,
  browserMinutesPerDay: 0,
  paidServiceCallsPerDay: 0,
  externalActionsPerDay: 0,
} as const);

export type GrowthZeroCostQuotaId =
  | "workers_requests"
  | "external_subrequests_per_invocation"
  | "d1_rows_read"
  | "d1_rows_written"
  | "queue_operations"
  | "workers_ai_neurons"
  | "browser_minutes";

export type GrowthZeroCostQuotaAssessment = Readonly<{
  quota: GrowthZeroCostQuotaId;
  freeLimit: number;
  reservedLimit: number;
  headroom: number;
  reservationPercent: number;
  withinReservationCeiling: boolean;
}>;

export type GrowthZeroCostProfileAssessment = Readonly<{
  intensity: Exclude<GrowthActivityIntensity, "custom">;
  withinHardLimits: boolean;
  paidServiceCallsPerDay: 0;
  externalActionsPerDay: 0;
  aiCallsPerDay: 0;
  browserMinutesPerDay: 0;
  scheduledExternalResearchRunsPerDay: 0;
}>;

function percentage(reserved: number, freeLimit: number): number {
  if (!Number.isFinite(reserved) || !Number.isFinite(freeLimit) || freeLimit <= 0) {
    throw new Error("GROWTH_ZERO_COST_QUOTA_INVALID");
  }
  return Math.round((reserved / freeLimit) * 10_000) / 100;
}

function quotaAssessment(input: {
  quota: GrowthZeroCostQuotaId;
  freeLimit: number;
  reservedLimit: number;
  reservationCeiling: number;
}): GrowthZeroCostQuotaAssessment {
  if (
    !Number.isSafeInteger(input.freeLimit) ||
    !Number.isSafeInteger(input.reservedLimit) ||
    !Number.isSafeInteger(input.reservationCeiling) ||
    input.freeLimit < 1 ||
    input.reservedLimit < 0 ||
    input.reservationCeiling < 0
  ) {
    throw new Error("GROWTH_ZERO_COST_QUOTA_INVALID");
  }
  return Object.freeze({
    quota: input.quota,
    freeLimit: input.freeLimit,
    reservedLimit: input.reservedLimit,
    headroom: Math.max(0, input.freeLimit - input.reservedLimit),
    reservationPercent: percentage(input.reservedLimit, input.freeLimit),
    withinReservationCeiling: input.reservedLimit <= input.reservationCeiling,
  });
}

function limitsWithinHardLimits(limits: GrowthActivityLimits): boolean {
  const keys = Object.keys(GROWTH_ACTIVITY_HARD_LIMITS) as Array<keyof GrowthActivityLimits>;
  return keys.every((key) => limits[key] <= GROWTH_ACTIVITY_HARD_LIMITS[key]);
}

function profileAssessments(): readonly GrowthZeroCostProfileAssessment[] {
  return Object.freeze(
    listGrowthActivityProfiles().map((profile) => Object.freeze({
      intensity: profile.intensity as Exclude<GrowthActivityIntensity, "custom">,
      withinHardLimits: limitsWithinHardLimits(profile.limits),
      paidServiceCallsPerDay: profile.limits.paidServiceCallsPerDay,
      externalActionsPerDay: profile.limits.externalActionsPerDay,
      aiCallsPerDay: profile.limits.aiCallsPerDay,
      browserMinutesPerDay: profile.limits.browserMinutesPerDay,
      scheduledExternalResearchRunsPerDay: profile.limits.scheduledExternalResearchRunsPerDay,
    })),
  );
}

export function growthZeroCostEnvelope() {
  const quotas = Object.freeze([
    quotaAssessment({
      quota: "workers_requests",
      freeLimit: GROWTH_ZERO_COST_FREE_LIMITS.workersRequestsPerDay,
      reservedLimit: GROWTH_ACTIVITY_HARD_LIMITS.workerRequestsPerDay,
      reservationCeiling: GROWTH_ZERO_COST_RESERVATION_CEILINGS.workersRequestsPerDay,
    }),
    quotaAssessment({
      quota: "external_subrequests_per_invocation",
      freeLimit: GROWTH_ZERO_COST_FREE_LIMITS.externalSubrequestsPerInvocation,
      reservedLimit: GROWTH_ACTIVITY_HARD_LIMITS.externalFetchesPerRun,
      reservationCeiling: GROWTH_ZERO_COST_RESERVATION_CEILINGS.externalSubrequestsPerInvocation,
    }),
    quotaAssessment({
      quota: "d1_rows_read",
      freeLimit: GROWTH_ZERO_COST_FREE_LIMITS.d1RowsReadPerDay,
      reservedLimit: GROWTH_ACTIVITY_HARD_LIMITS.d1RowsReadPerDay,
      reservationCeiling: GROWTH_ZERO_COST_RESERVATION_CEILINGS.d1RowsReadPerDay,
    }),
    quotaAssessment({
      quota: "d1_rows_written",
      freeLimit: GROWTH_ZERO_COST_FREE_LIMITS.d1RowsWrittenPerDay,
      reservedLimit: GROWTH_ACTIVITY_HARD_LIMITS.d1RowsWrittenPerDay,
      reservationCeiling: GROWTH_ZERO_COST_RESERVATION_CEILINGS.d1RowsWrittenPerDay,
    }),
    quotaAssessment({
      quota: "queue_operations",
      freeLimit: GROWTH_ZERO_COST_FREE_LIMITS.queueOperationsPerDay,
      reservedLimit: GROWTH_ACTIVITY_HARD_LIMITS.queueOperationsPerDay,
      reservationCeiling: GROWTH_ZERO_COST_RESERVATION_CEILINGS.queueOperationsPerDay,
    }),
    quotaAssessment({
      quota: "workers_ai_neurons",
      freeLimit: GROWTH_ZERO_COST_FREE_LIMITS.workersAiNeuronsPerDay,
      reservedLimit: 0,
      reservationCeiling: GROWTH_ZERO_COST_RESERVATION_CEILINGS.workersAiNeuronsPerDay,
    }),
    quotaAssessment({
      quota: "browser_minutes",
      freeLimit: GROWTH_ZERO_COST_FREE_LIMITS.browserMinutesPerDay,
      reservedLimit: GROWTH_ACTIVITY_HARD_LIMITS.browserMinutesPerDay,
      reservationCeiling: GROWTH_ZERO_COST_RESERVATION_CEILINGS.browserMinutesPerDay,
    }),
  ]);
  const profiles = profileAssessments();
  const reservationWithinFreeLimits = quotas.every(
    (quota) => quota.reservedLimit <= quota.freeLimit && quota.withinReservationCeiling,
  );
  const profilesRemainNonExecuting = profiles.every(
    (profile) =>
      profile.withinHardLimits &&
      profile.paidServiceCallsPerDay === 0 &&
      profile.externalActionsPerDay === 0 &&
      profile.aiCallsPerDay === 0 &&
      profile.browserMinutesPerDay === 0 &&
      profile.scheduledExternalResearchRunsPerDay === 0,
  );

  return Object.freeze({
    contractVersion: GROWTH_ZERO_COST_ENVELOPE_VERSION,
    limitSnapshot: GROWTH_ZERO_COST_LIMIT_SNAPSHOT,
    reviewBy: GROWTH_ZERO_COST_REVIEW_BY,
    requiredCloudflarePlan: "workers_free" as const,
    zeroPaidServiceBudget: true as const,
    paidOverageAllowed: false as const,
    absoluteZeroCostGuaranteed: false as const,
    accountWideUsageKnown: false as const,
    accountPlanVerifiedAtRuntime: false as const,
    reservationWithinFreeLimits,
    profilesRemainNonExecuting,
    quotas,
    profiles,
    untrackedSharedLimits: Object.freeze([
      "account-wide Worker requests from other scripts",
      "account-wide D1 usage outside the Growth ledger",
      "actual D1 storage consumption",
      "Cloudflare account billing-plan state",
      "Cloudflare usage recorded outside this Worker",
    ] as const),
    requirementsBeforeAnyAiOrBrowserUse: Object.freeze([
      "verify the account is on Workers Free or otherwise cannot incur overage",
      "add a persistent neuron or browser-minute usage ledger",
      "reserve account-wide headroom for every other Worker",
      "fail closed before the free allocation is exhausted",
      "keep the selected activity profile owner-visible and reversible",
    ] as const),
    safety: Object.freeze({
      scheduledExternalResearchEnabled: false as const,
      workersAiEnabled: false as const,
      browserEnabled: false as const,
      paidServicesEnabled: false as const,
      externalExecutionEnabled: false as const,
      automaticRetryEnabled: false as const,
      persistentGrowthLedgerRequired: true as const,
      freePlanQuotaExhaustionMustFailClosed: true as const,
    }),
    sourceReferences: Object.freeze([
      "https://developers.cloudflare.com/workers/platform/limits/",
      "https://developers.cloudflare.com/workers/platform/pricing/",
      "https://developers.cloudflare.com/d1/platform/pricing/",
      "https://developers.cloudflare.com/queues/platform/pricing/",
      "https://developers.cloudflare.com/workers-ai/platform/pricing/",
      "https://developers.cloudflare.com/browser-run/limits/",
      "https://developers.cloudflare.com/kv/platform/limits/",
    ] as const),
  });
}
