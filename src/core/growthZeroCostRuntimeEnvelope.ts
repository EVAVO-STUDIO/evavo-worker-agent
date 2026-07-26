import {
  resolveGrowthActivityProfile,
  type GrowthActivityProfile,
} from "./growthActivityBudget";
import { opportunitySourceExplorationSlots } from "./opportunitySourceSelection";

export const GROWTH_ZERO_COST_RUNTIME_ENVELOPE_VERSION =
  "growth_zero_cost_runtime_envelope_v1" as const;

export const GROWTH_ZERO_COST_RUNTIME_PROFILES = Object.freeze([
  "paused",
  "light",
  "balanced",
  "high",
] as const);

export type GrowthZeroCostRuntimeProfile =
  (typeof GROWTH_ZERO_COST_RUNTIME_PROFILES)[number];

export type GrowthZeroCostRuntimeEnvelope = Readonly<{
  contractVersion: typeof GROWTH_ZERO_COST_RUNTIME_ENVELOPE_VERSION;
  profile: GrowthZeroCostRuntimeProfile;
  label: string;
  summary: string;
  manualResearchRunsPerDay: number;
  externalFetchesPerDay: number;
  externalFetchesPerRun: number;
  explorationSourcesPerRun: number;
  minimumOpportunityScore: number;
  minimumResearchCooldownMinutes: number;
  candidateWritesPerDay: number;
  proposalWritesPerDay: number;
  reportsPerDay: number;
  workerRequestsPerDay: number;
  d1RowsReadPerDay: number;
  d1RowsWrittenPerDay: number;
  scheduledExternalResearchEnabled: false;
  aiEnabled: false;
  browserEnabled: false;
  paidServicesAllowed: false;
  externalExecutionEnabled: false;
  automaticRetryEnabled: false;
  accountWideCloudUsageKnown: false;
  persistentUsageAccountingRequired: true;
}>;

function profileValue(value: unknown): GrowthZeroCostRuntimeProfile {
  if (
    typeof value !== "string" ||
    !GROWTH_ZERO_COST_RUNTIME_PROFILES.includes(
      value as GrowthZeroCostRuntimeProfile,
    )
  ) {
    throw new Error("GROWTH_ZERO_COST_RUNTIME_PROFILE_INVALID");
  }
  return value as GrowthZeroCostRuntimeProfile;
}

function projectProfile(
  source: GrowthActivityProfile,
): GrowthZeroCostRuntimeEnvelope {
  const profile = profileValue(source.intensity);
  const limits = source.limits;
  return Object.freeze({
    contractVersion: GROWTH_ZERO_COST_RUNTIME_ENVELOPE_VERSION,
    profile,
    label: source.label,
    summary: source.description,
    manualResearchRunsPerDay: limits.manualResearchRunsPerDay,
    externalFetchesPerDay: limits.externalFetchesPerDay,
    externalFetchesPerRun: limits.externalFetchesPerRun,
    explorationSourcesPerRun: opportunitySourceExplorationSlots(
      profile,
      limits.externalFetchesPerRun,
    ),
    minimumOpportunityScore: limits.minimumOpportunityScore,
    minimumResearchCooldownMinutes: limits.minimumResearchCooldownMinutes,
    candidateWritesPerDay: limits.candidateWritesPerDay,
    proposalWritesPerDay: limits.proposalWritesPerDay,
    reportsPerDay: limits.reportsPerDay,
    workerRequestsPerDay: limits.workerRequestsPerDay,
    d1RowsReadPerDay: limits.d1RowsReadPerDay,
    d1RowsWrittenPerDay: limits.d1RowsWrittenPerDay,
    scheduledExternalResearchEnabled: false,
    aiEnabled: false,
    browserEnabled: false,
    paidServicesAllowed: false,
    externalExecutionEnabled: false,
    automaticRetryEnabled: false,
    accountWideCloudUsageKnown: false,
    persistentUsageAccountingRequired: true,
  });
}

export function growthZeroCostRuntimeEnvelopeForProfile(
  profile: GrowthZeroCostRuntimeProfile,
): GrowthZeroCostRuntimeEnvelope {
  return projectProfile(resolveGrowthActivityProfile(profileValue(profile)));
}

export function listGrowthZeroCostRuntimeEnvelopes(): readonly GrowthZeroCostRuntimeEnvelope[] {
  return Object.freeze(
    GROWTH_ZERO_COST_RUNTIME_PROFILES.map((profile) =>
      growthZeroCostRuntimeEnvelopeForProfile(profile),
    ),
  );
}
