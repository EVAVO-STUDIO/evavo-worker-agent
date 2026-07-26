import {
  resolveGrowthActivityProfile,
  type GrowthActivityIntensity,
  type GrowthActivityProfile,
} from "./growthActivityBudget";

export const GROWTH_ACTIVITY_SETTINGS_VERSION =
  "growth_activity_settings_v1" as const;

export type GrowthActivityAutonomySettings = Readonly<{
  mode: string;
  engineEnabled: boolean;
  opportunityDiscoveryEnabled: boolean;
  dailySourceLimit: number;
  maxNetworkCallsPerRun: number;
  minOpportunityScore: number;
}>;

export type GrowthActivitySettingsResolution = Readonly<{
  contractVersion: typeof GROWTH_ACTIVITY_SETTINGS_VERSION;
  intensity: Exclude<GrowthActivityIntensity, "custom">;
  profile: GrowthActivityProfile;
  selectedBy: "engine_disabled" | "observe_only" | "free_safe_autonomy" | "assisted_discovery";
  legacyControlsAreSecondaryCaps: true;
  manualResearchConfigured: boolean;
  effectiveSourceLimitPerRun: number;
  effectiveMinimumOpportunityScore: number;
  scheduledExternalResearchEnabled: false;
  externalExecutionEnabled: false;
}>;

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(minimum, Math.min(maximum, Math.round(parsed)))
    : fallback;
}

function assistedIntensity(
  settings: GrowthActivityAutonomySettings,
): "balanced" | "high" {
  const dailySourceLimit = boundedInteger(settings.dailySourceLimit, 0, 0, 100);
  const maxNetworkCallsPerRun = boundedInteger(
    settings.maxNetworkCallsPerRun,
    0,
    0,
    250,
  );
  const minimumScore = boundedInteger(settings.minOpportunityScore, 100, 1, 100);
  return (
    dailySourceLimit > 15 ||
    maxNetworkCallsPerRun > 8 ||
    minimumScore < 55
  )
    ? "high"
    : "balanced";
}

export function resolveGrowthActivitySettings(
  settings: GrowthActivityAutonomySettings,
): GrowthActivitySettingsResolution {
  const engineEnabled = settings.engineEnabled === true;
  const discoveryEnabled = settings.opportunityDiscoveryEnabled === true;
  let intensity: "paused" | "light" | "balanced" | "high";
  let selectedBy: GrowthActivitySettingsResolution["selectedBy"];

  if (!engineEnabled || !discoveryEnabled) {
    intensity = "paused";
    selectedBy = "engine_disabled";
  } else if (settings.mode === "observe_only") {
    intensity = "paused";
    selectedBy = "observe_only";
  } else if (settings.mode === "assisted_discovery") {
    intensity = assistedIntensity(settings);
    selectedBy = "assisted_discovery";
  } else {
    intensity = "light";
    selectedBy = "free_safe_autonomy";
  }

  const profile = resolveGrowthActivityProfile(intensity);
  const legacyDailyLimit = boundedInteger(settings.dailySourceLimit, 0, 0, 100);
  const legacyRunLimit = boundedInteger(settings.maxNetworkCallsPerRun, 0, 0, 250);
  const effectiveSourceLimitPerRun = Math.min(
    legacyDailyLimit,
    legacyRunLimit,
    profile.limits.manualResearchRunsPerDay,
    profile.limits.externalFetchesPerRun,
  );
  const effectiveMinimumOpportunityScore = Math.max(
    boundedInteger(settings.minOpportunityScore, 100, 1, 100),
    profile.limits.minimumOpportunityScore,
  );

  return Object.freeze({
    contractVersion: GROWTH_ACTIVITY_SETTINGS_VERSION,
    intensity,
    profile,
    selectedBy,
    legacyControlsAreSecondaryCaps: true,
    manualResearchConfigured:
      engineEnabled &&
      discoveryEnabled &&
      intensity !== "paused" &&
      effectiveSourceLimitPerRun > 0,
    effectiveSourceLimitPerRun,
    effectiveMinimumOpportunityScore,
    scheduledExternalResearchEnabled: false,
    externalExecutionEnabled: false,
  });
}
