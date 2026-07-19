import { Env, getAdminToken, getSetting, setSetting } from "../db";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

type AutonomyMode = "observe_only" | "free_safe_autonomy" | "assisted_discovery";

const SETTING_KEY = "autonomy_settings_v1";

const allowedModes: AutonomyMode[] = [
  "observe_only",
  "free_safe_autonomy",
  "assisted_discovery",
];

const defaultSettings = {
  mode: "free_safe_autonomy" as AutonomyMode,
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
  updatedAtISO: null as string | null,
  updatedBy: "system-default",
};

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

function confirmed(body: any): boolean {
  return body?.confirm === true || body?.confirm === 1 || body?.confirm === "1";
}

function parseJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function boolValue(value: any, fallback: boolean): boolean {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

function intValue(value: any, fallback: number, min: number, max: number): number {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(min, Math.min(max, Math.round(next)));
}

function normalizeSettings(input: any) {
  const requestedMode = allowedModes.includes(input?.mode) ? input.mode : defaultSettings.mode;
  const settings = {
    mode: requestedMode,
    engineEnabled: boolValue(input?.engineEnabled, defaultSettings.engineEnabled),
    freeSafeOnly: true,
    opportunityDiscoveryEnabled: boolValue(input?.opportunityDiscoveryEnabled, defaultSettings.opportunityDiscoveryEnabled),
    sourceExpansionEnabled: boolValue(input?.sourceExpansionEnabled, defaultSettings.sourceExpansionEnabled),
    leadDiscoveryEnabled: false,
    aiDraftsEnabled: false,
    sendingEnabled: false,
    dailySourceLimit: intValue(input?.dailySourceLimit, defaultSettings.dailySourceLimit, 0, 100),
    maxNetworkCallsPerRun: intValue(input?.maxNetworkCallsPerRun, defaultSettings.maxNetworkCallsPerRun, 0, 250),
    minOpportunityScore: intValue(input?.minOpportunityScore, defaultSettings.minOpportunityScore, 1, 100),
    maxExpansionFetchesPerRun: intValue(input?.maxExpansionFetchesPerRun, defaultSettings.maxExpansionFetchesPerRun, 0, 10),
    maxExpansionCandidatesPerRun: intValue(input?.maxExpansionCandidatesPerRun, defaultSettings.maxExpansionCandidatesPerRun, 0, 100),
    updatedAtISO: typeof input?.updatedAtISO === "string" ? input.updatedAtISO : null,
    updatedBy: typeof input?.updatedBy === "string" ? input.updatedBy : "operator",
  };

  if (settings.maxNetworkCallsPerRun <= 0) {
    settings.sourceExpansionEnabled = false;
    settings.opportunityDiscoveryEnabled = false;
  }

  return settings;
}

function policyFor(settings: ReturnType<typeof normalizeSettings>) {
  return {
    canRunScheduledEngine: settings.engineEnabled,
    canFetchSources: settings.engineEnabled && settings.maxNetworkCallsPerRun > 0,
    canExpandSourceCandidates: settings.engineEnabled && settings.sourceExpansionEnabled && settings.maxNetworkCallsPerRun > 0 && settings.maxExpansionFetchesPerRun > 0,
    canSaveExpansionCandidatesAutomatically: false,
    canSaveOpportunities: settings.opportunityDiscoveryEnabled,
    canSaveLeads: false,
    canGenerateDrafts: false,
    canSendEmail: false,
    dailySourceLimit: settings.dailySourceLimit,
    maxNetworkCallsPerRun: settings.maxNetworkCallsPerRun,
    minOpportunityScore: settings.minOpportunityScore,
    maxExpansionFetchesPerRun: settings.maxExpansionFetchesPerRun,
    maxExpansionCandidatesPerRun: settings.maxExpansionCandidatesPerRun,
  };
}

async function readSettings(env: Env) {
  const saved = normalizeSettings(parseJson(await getSetting(env, SETTING_KEY)) || defaultSettings);
  return {
    ok: true,
    mode: "autonomy_settings",
    contractVersion: "autonomy_settings_v2_review_first",
    settings: saved,
    policy: policyFor(saved),
    allowedModes,
    safety: {
      freeSafeOnly: true,
      aiAlwaysOff: true,
      sendingAlwaysOff: true,
      leadDiscoveryAlwaysOff: true,
      readSecretsFromServerOnly: true,
      sourceExpansionSaveRequiresConfirmation: true,
      settingsWriteRequiresConfirmation: true,
      scheduledExternalExecutionDisabled: true,
    },
  };
}

async function writeSettings(env: Env, body: any) {
  const previous = normalizeSettings(parseJson(await getSetting(env, SETTING_KEY)) || defaultSettings);
  const next = normalizeSettings({ ...previous, ...body, updatedAtISO: new Date().toISOString(), updatedBy: body?.updatedBy || "operator" });
  await setSetting(env, SETTING_KEY, JSON.stringify(next));
  return {
    ok: true,
    mode: "autonomy_settings_saved",
    settings: next,
    policy: policyFor(next),
    changed: JSON.stringify(previous) !== JSON.stringify(next),
    safety: {
      callsAI: false,
      sendsEmail: false,
      writesSettingsOnly: true,
      freeSafeOnly: true,
      sourceExpansionSaveRequiresConfirmation: true,
      settingsWriteRequiresConfirmation: true,
      scheduledExternalExecutionDisabled: true,
    },
  };
}

export async function handleAutonomySettingsAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (pathname !== "/admin/settings/autonomy") return json({ ok: false, error: "Not found" }, { status: 404 });

  if (request.method === "GET") return json(await readSettings(env));
  if (request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!confirmed(body)) {
      return json({
        ok: false,
        error: "confirm_required",
        reason: "Autonomy setting changes require explicit confirmation. The Worker remains review-first: AI drafting, lead discovery and sending cannot be enabled from this route.",
      }, { status: 400 });
    }
    return json(await writeSettings(env, body));
  }
  return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
