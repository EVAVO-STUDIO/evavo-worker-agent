import type { Env } from "./db";
import { getSetting, logEvent, setSetting } from "./db";
import { dailyTick as legacyDailyTick } from "./engine";
import { runOpportunityAutonomy } from "./opportunityAutonomy";
import { runSourceExpansion } from "./core/sourceExpansionEngine";

type AutonomySettings = {
  mode: string;
  engineEnabled: boolean;
  freeSafeOnly: boolean;
  opportunityDiscoveryEnabled: boolean;
  sourceExpansionEnabled: boolean;
  leadDiscoveryEnabled: boolean;
  aiDraftsEnabled: boolean;
  sendingEnabled: boolean;
  dailySourceLimit: number;
  maxNetworkCallsPerRun: number;
  minOpportunityScore: number;
  maxExpansionFetchesPerRun: number;
  maxExpansionCandidatesPerRun: number;
};

const SETTINGS_KEY = "autonomy_settings_v1";

const DEFAULT_SETTINGS: AutonomySettings = {
  mode: "free_safe_autonomy",
  engineEnabled: false,
  freeSafeOnly: true,
  opportunityDiscoveryEnabled: true,
  sourceExpansionEnabled: false,
  leadDiscoveryEnabled: false,
  aiDraftsEnabled: false,
  sendingEnabled: false,
  dailySourceLimit: 10,
  maxNetworkCallsPerRun: 20,
  minOpportunityScore: 45,
  maxExpansionFetchesPerRun: 2,
  maxExpansionCandidatesPerRun: 25,
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
    sourceExpansionEnabled: asBool(saved.sourceExpansionEnabled, DEFAULT_SETTINGS.sourceExpansionEnabled),
    leadDiscoveryEnabled: asBool(saved.leadDiscoveryEnabled, DEFAULT_SETTINGS.leadDiscoveryEnabled),
    aiDraftsEnabled: asBool(saved.aiDraftsEnabled, DEFAULT_SETTINGS.aiDraftsEnabled),
    sendingEnabled: asBool(saved.sendingEnabled, DEFAULT_SETTINGS.sendingEnabled),
    dailySourceLimit: asInt(saved.dailySourceLimit, DEFAULT_SETTINGS.dailySourceLimit, 0, 100),
    maxNetworkCallsPerRun: asInt(saved.maxNetworkCallsPerRun, DEFAULT_SETTINGS.maxNetworkCallsPerRun, 0, 250),
    minOpportunityScore: asInt(saved.minOpportunityScore, DEFAULT_SETTINGS.minOpportunityScore, 1, 100),
    maxExpansionFetchesPerRun: asInt(saved.maxExpansionFetchesPerRun, DEFAULT_SETTINGS.maxExpansionFetchesPerRun, 0, 10),
    maxExpansionCandidatesPerRun: asInt(saved.maxExpansionCandidatesPerRun, DEFAULT_SETTINGS.maxExpansionCandidatesPerRun, 0, 100),
  };

  if (settings.freeSafeOnly) {
    settings.aiDraftsEnabled = false;
    settings.sendingEnabled = false;
    if (settings.mode === "draft_preparation" || settings.mode === "controlled_outreach") settings.mode = "free_safe_autonomy";
  }

  if (settings.sendingEnabled && !settings.aiDraftsEnabled) settings.sendingEnabled = false;
  return settings;
}

async function syncLegacyEngineFlags(env: Env, settings: AutonomySettings): Promise<void> {
  const legacyScanAllowed = settings.leadDiscoveryEnabled && settings.maxNetworkCallsPerRun > 0;
  const legacyDraftAllowed = settings.aiDraftsEnabled && !settings.freeSafeOnly;
  const legacySendAllowed = settings.sendingEnabled && !settings.freeSafeOnly;

  await setSetting(env, "engine_enabled", settings.engineEnabled ? "1" : "0");
  await setSetting(env, "crawl_cap_per_day", String(legacyScanAllowed ? Math.min(settings.dailySourceLimit, settings.maxNetworkCallsPerRun) : 0));
  await setSetting(env, "draft_cap_per_day", legacyDraftAllowed ? "10" : "0");
  await setSetting(env, "send_cap_per_day", legacySendAllowed ? "5" : "0");
  await setSetting(env, "drafting_enabled", legacyDraftAllowed ? "1" : "0");
  await setSetting(env, "sending_enabled", legacySendAllowed ? "1" : "0");
}

function hasLegacyStage(settings: AutonomySettings): boolean {
  return Boolean(settings.leadDiscoveryEnabled || settings.aiDraftsEnabled || settings.sendingEnabled);
}

async function runSourceExpansionIfAllowed(env: Env, settings: AutonomySettings): Promise<void> {
  if (!settings.sourceExpansionEnabled) return;
  if (settings.maxNetworkCallsPerRun <= 0) {
    await logEvent(env, "source_expansion_skip", "Source expansion skipped because maxNetworkCallsPerRun is zero.");
    return;
  }
  if (settings.maxExpansionFetchesPerRun <= 0 || settings.maxExpansionCandidatesPerRun <= 0) {
    await logEvent(env, "source_expansion_skip", "Source expansion skipped because expansion fetch/candidate caps are zero.");
    return;
  }

  const maxFetches = Math.min(settings.maxExpansionFetchesPerRun, settings.maxNetworkCallsPerRun, 10);
  const maxCandidates = Math.min(settings.maxExpansionCandidatesPerRun, 100);
  const result = await runSourceExpansion(env, {
    limitSeeds: maxFetches,
    maxFetches,
    maxLinksPerSeed: 30,
    maxCandidates,
  });

  if (result?.ok) {
    await logEvent(env, "source_expansion_tick_ok", `Scheduled source expansion found ${result.candidatesFound || 0} candidate(s), new ${result.candidatesNew || 0}.`);
  } else {
    await logEvent(env, "source_expansion_tick_skip", `Scheduled source expansion did not run: ${result?.error || "unknown"}.`);
  }
}

export async function dailyTickWithAutonomy(env: Env): Promise<void> {
  const settings = await readAutonomySettings(env);

  if (!settings.engineEnabled) {
    await syncLegacyEngineFlags(env, settings);
    await logEvent(env, "tick_skip", "Autonomy engine disabled by autonomy_settings_v1.");
    return;
  }

  if (settings.maxNetworkCallsPerRun <= 0 && settings.mode !== "observe_only") {
    await syncLegacyEngineFlags(env, settings);
    await logEvent(env, "tick_skip", "Autonomy engine blocked because maxNetworkCallsPerRun is zero.");
    return;
  }

  if (settings.freeSafeOnly && (settings.aiDraftsEnabled || settings.sendingEnabled)) {
    await syncLegacyEngineFlags(env, settings);
    await logEvent(env, "tick_skip", "Autonomy settings invalid: freeSafeOnly blocks AI drafts and sending.");
    return;
  }

  await syncLegacyEngineFlags(env, settings);

  await runSourceExpansionIfAllowed(env, settings);

  if (settings.opportunityDiscoveryEnabled) {
    await runOpportunityAutonomy(env, settings);
  }

  if (!hasLegacyStage(settings)) {
    await logEvent(env, "tick_ok", "Autonomy tick completed free-safe opportunity/source-expansion run with no legacy stages enabled.");
    return;
  }

  await logEvent(env, "tick_policy", `Autonomy mode ${settings.mode} | freeSafeOnly ${settings.freeSafeOnly ? "on" : "off"} | sourceExpansion ${settings.sourceExpansionEnabled ? "on" : "off"} | opportunityDiscovery ${settings.opportunityDiscoveryEnabled ? "on" : "off"} | leadDiscovery ${settings.leadDiscoveryEnabled ? "on" : "off"} | drafts ${settings.aiDraftsEnabled ? "on" : "off"} | sending ${settings.sendingEnabled ? "on" : "off"}`);
  await legacyDailyTick(env);
}
