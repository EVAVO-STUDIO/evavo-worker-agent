import type { Env } from "./db";
import { getSetting, logEvent, setSetting } from "./db";
import { runOpportunityAutonomy } from "./opportunityAutonomy";
import { runSourceExpansion } from "./core/sourceExpansionEngine";
import { learnSourceExpansionQuality } from "./core/sourceExpansionLearning";

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

  // Scheduled autonomy is permanently review-first. Stored settings may describe
  // future/manual capabilities, but cron execution never drafts or sends.
  settings.aiDraftsEnabled = false;
  settings.sendingEnabled = false;
  settings.leadDiscoveryEnabled = false;
  if (settings.mode === "draft_preparation" || settings.mode === "controlled_outreach") {
    settings.mode = "free_safe_autonomy";
  }
  return settings;
}

async function syncLegacyEngineFlags(env: Env, settings: AutonomySettings): Promise<void> {
  const researchCap = settings.maxNetworkCallsPerRun > 0
    ? Math.min(settings.dailySourceLimit, settings.maxNetworkCallsPerRun)
    : 0;

  // The legacy engine is not invoked by scheduled autonomy. Keep its external
  // execution stages disabled defensively in case another path reads these flags.
  await setSetting(env, "engine_enabled", "0");
  await setSetting(env, "crawl_cap_per_day", String(researchCap));
  await setSetting(env, "draft_cap_per_day", "0");
  await setSetting(env, "send_cap_per_day", "0");
  await setSetting(env, "drafting_enabled", "0");
  await setSetting(env, "sending_enabled", "0");
}

function scheduledFallbackSummary(result: any): string {
  const seedsChecked = Number(result?.seedsChecked || 0);
  const pagesFetched = Number(result?.pagesFetched || 0);
  const linksFound = Number(result?.linksFound || 0);
  const candidatesFound = Number(result?.candidatesFound || 0);
  const candidatesNew = Number(result?.candidatesNew || 0);
  const failed = Number(result?.failed || 0);

  if (!seedsChecked) return "fallback=no_due_seeds next=bootstrap_or_rotate_strategy guardrail=do_not_raise_caps_first";
  if (failed && !pagesFetched) return "fallback=all_fetches_failed next=source_health_or_sitemap guardrail=review_failures_before_retry";
  if (pagesFetched && !linksFound) return "fallback=thin_seed_pages next=sitemap_or_public_link_graph guardrail=rotate_method_before_depth";
  if (linksFound && !candidatesFound) return "fallback=links_without_candidates next=query_hints_or_filter_review guardrail=avoid_weak_manual_saves";
  if (candidatesFound && !candidatesNew) return "fallback=known_or_duplicate_candidates next=candidate_review_or_origin_rotation guardrail=do_not_count_duplicates_as_new_coverage";
  return "fallback=fresh_candidates_found next=candidate_review guardrail=confirmed_source_save_only";
}

async function learnExpansionQualityIfPossible(env: Env): Promise<void> {
  const result = await learnSourceExpansionQuality(env);
  if (result?.ok) {
    await logEvent(env, "source_expansion_learning_tick_ok", `Source expansion learning updated ${result.learnedCount || 0} strategy row(s).`);
  } else {
    await logEvent(env, "source_expansion_learning_tick_skip", `Source expansion learning skipped: ${result?.error || "unknown"}.`);
  }
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
    await logEvent(env, "source_expansion_tick_ok", `Scheduled source expansion found ${result.candidatesFound || 0} candidate(s), new ${result.candidatesNew || 0}. ${scheduledFallbackSummary(result)}.`);
  } else {
    await logEvent(env, "source_expansion_tick_skip", `Scheduled source expansion did not run: ${result?.error || "unknown"}.`);
  }
}

export async function dailyTickWithAutonomy(env: Env): Promise<void> {
  const settings = await readAutonomySettings(env);
  await syncLegacyEngineFlags(env, settings);

  if (!settings.engineEnabled) {
    await logEvent(env, "tick_skip", "Autonomy engine disabled by autonomy_settings_v1.");
    return;
  }

  if (settings.maxNetworkCallsPerRun <= 0 && settings.mode !== "observe_only") {
    await logEvent(env, "tick_skip", "Autonomy engine blocked because maxNetworkCallsPerRun is zero.");
    return;
  }

  await learnExpansionQualityIfPossible(env);
  await runSourceExpansionIfAllowed(env, settings);

  if (settings.opportunityDiscoveryEnabled) {
    await runOpportunityAutonomy(env, settings);
    await learnExpansionQualityIfPossible(env);
  }

  await logEvent(
    env,
    "tick_ok",
    `Autonomy tick completed in review-first mode | sourceExpansion ${settings.sourceExpansionEnabled ? "on" : "off"} | opportunityDiscovery ${settings.opportunityDiscoveryEnabled ? "on" : "off"} | legacyEngine off | AI drafts off | sending off`,
  );
}
