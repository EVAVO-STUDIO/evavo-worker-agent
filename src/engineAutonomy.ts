import type { Env } from "./db";
import { getSetting, logEvent } from "./db";
import { dailyTick as legacyDailyTick } from "./engine";

type AutonomySettings = {
  mode: string;
  engineEnabled: boolean;
  freeSafeOnly: boolean;
  opportunityDiscoveryEnabled: boolean;
  leadDiscoveryEnabled: boolean;
  aiDraftsEnabled: boolean;
  sendingEnabled: boolean;
  dailySourceLimit: number;
  maxNetworkCallsPerRun: number;
  minOpportunityScore: number;
};

const SETTINGS_KEY = "autonomy_settings_v1";

const DEFAULT_SETTINGS: AutonomySettings = {
  mode: "free_safe_autonomy",
  engineEnabled: false,
  freeSafeOnly: true,
  opportunityDiscoveryEnabled: true,
  leadDiscoveryEnabled: false,
  aiDraftsEnabled: false,
  sendingEnabled: false,
  dailySourceLimit: 10,
  maxNetworkCallsPerRun: 20,
  minOpportunityScore: 45,
};

function asBool(value: any, fallback: boolean): boolean {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

function asInt(value: any, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function parseJson(value: string | null): any {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function readAutonomySettings(env: Env): Promise<AutonomySettings> {
  const saved = parseJson(await getSetting(env, SETTINGS_KEY)) || {};
  const settings: AutonomySettings = {
    mode: typeof saved.mode === "string" ? saved.mode : DEFAULT_SETTINGS.mode,
    engineEnabled: asBool(saved.engineEnabled, DEFAULT_SETTINGS.engineEnabled),
    freeSafeOnly: asBool(saved.freeSafeOnly, DEFAULT_SETTINGS.freeSafeOnly),
    opportunityDiscoveryEnabled: asBool(saved.opportunityDiscoveryEnabled, DEFAULT_SETTINGS.opportunityDiscoveryEnabled),
    leadDiscoveryEnabled: asBool(saved.leadDiscoveryEnabled, DEFAULT_SETTINGS.leadDiscoveryEnabled),
    aiDraftsEnabled: asBool(saved.aiDraftsEnabled, DEFAULT_SETTINGS.aiDraftsEnabled),
    sendingEnabled: asBool(saved.sendingEnabled, DEFAULT_SETTINGS.sendingEnabled),
    dailySourceLimit: asInt(saved.dailySourceLimit, DEFAULT_SETTINGS.dailySourceLimit, 0, 100),
    maxNetworkCallsPerRun: asInt(saved.maxNetworkCallsPerRun, DEFAULT_SETTINGS.maxNetworkCallsPerRun, 0, 250),
    minOpportunityScore: asInt(saved.minOpportunityScore, DEFAULT_SETTINGS.minOpportunityScore, 1, 100),
  };

  if (settings.freeSafeOnly) {
    settings.aiDraftsEnabled = false;
    settings.sendingEnabled = false;
    if (settings.mode === "draft_preparation" || settings.mode === "controlled_outreach") settings.mode = "free_safe_autonomy";
  }

  if (settings.sendingEnabled && !settings.aiDraftsEnabled) settings.sendingEnabled = false;
  return settings;
}

export async function dailyTickWithAutonomy(env: Env): Promise<void> {
  const settings = await readAutonomySettings(env);

  if (!settings.engineEnabled) {
    await logEvent(env, "tick_skip", "Autonomy engine disabled by autonomy_settings_v1.");
    return;
  }

  if (settings.maxNetworkCallsPerRun <= 0 && settings.mode !== "observe_only") {
    await logEvent(env, "tick_skip", "Autonomy engine blocked because maxNetworkCallsPerRun is zero.");
    return;
  }

  if (settings.freeSafeOnly && (settings.aiDraftsEnabled || settings.sendingEnabled)) {
    await logEvent(env, "tick_skip", "Autonomy settings invalid: freeSafeOnly blocks AI drafts and sending.");
    return;
  }

  await logEvent(env, "tick_policy", `Autonomy mode ${settings.mode} | freeSafeOnly ${settings.freeSafeOnly ? "on" : "off"} | opportunityDiscovery ${settings.opportunityDiscoveryEnabled ? "on" : "off"}`);
  await legacyDailyTick(env);
}
