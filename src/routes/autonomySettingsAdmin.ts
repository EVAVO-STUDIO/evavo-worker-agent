import { Env, getSetting, nowISO, uuid } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import {
  boundedJsonFailurePayload,
  isExplicitJsonConfirmation,
  readBoundedJsonObject,
} from "../core/boundedJsonRequest";
import {
  acquireManualResearchLease,
  manualResearchLeaseConflict,
  releaseManualResearchLease,
} from "../core/manualResearchLease";
import { boundedReviewText } from "../core/reviewMutationSafety";

type JsonResponse = (data: any, init?: ResponseInit) => Response;
type AutonomyMode = "observe_only" | "free_safe_autonomy" | "assisted_discovery";
type AutonomySettingsBody = Record<string, unknown> & {
  confirm?: unknown;
  mode?: unknown;
  engineEnabled?: unknown;
  opportunityDiscoveryEnabled?: unknown;
  sourceExpansionEnabled?: unknown;
  leadDiscoveryEnabled?: unknown;
  aiDraftsEnabled?: unknown;
  sendingEnabled?: unknown;
  dailySourceLimit?: unknown;
  maxNetworkCallsPerRun?: unknown;
  minOpportunityScore?: unknown;
  maxExpansionFetchesPerRun?: unknown;
  maxExpansionCandidatesPerRun?: unknown;
  updatedBy?: unknown;
};

const SETTING_KEY = "autonomy_settings_v1";
const AUTONOMY_SETTINGS_LEASE = "autonomy-settings";
const AUTONOMY_SETTINGS_CONTRACT = "autonomy_settings_v4_bounded_review_only";
const allowedModes: readonly AutonomyMode[] = Object.freeze([
  "observe_only",
  "free_safe_autonomy",
  "assisted_discovery",
]);
const acceptedWriteKeys = new Set([
  "confirm",
  "mode",
  "engineEnabled",
  "opportunityDiscoveryEnabled",
  "sourceExpansionEnabled",
  "leadDiscoveryEnabled",
  "aiDraftsEnabled",
  "sendingEnabled",
  "dailySourceLimit",
  "maxNetworkCallsPerRun",
  "minOpportunityScore",
  "maxExpansionFetchesPerRun",
  "maxExpansionCandidatesPerRun",
  "updatedBy",
]);

const defaultSettings = Object.freeze({
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
});

type NormalizedAutonomySettings = { ...typeof defaultSettings };

function parseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function storedBoolean(value: unknown, fallback: boolean): boolean {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

function storedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function normalizeStoredSettings(value: unknown): NormalizedAutonomySettings {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const mode = typeof input.mode === "string" && allowedModes.includes(input.mode as AutonomyMode)
    ? input.mode as AutonomyMode
    : defaultSettings.mode;
  const settings: NormalizedAutonomySettings = {
    mode,
    engineEnabled: storedBoolean(input.engineEnabled, defaultSettings.engineEnabled),
    freeSafeOnly: true,
    opportunityDiscoveryEnabled: storedBoolean(
      input.opportunityDiscoveryEnabled,
      defaultSettings.opportunityDiscoveryEnabled,
    ),
    sourceExpansionEnabled: storedBoolean(
      input.sourceExpansionEnabled,
      defaultSettings.sourceExpansionEnabled,
    ),
    leadDiscoveryEnabled: false,
    aiDraftsEnabled: false,
    sendingEnabled: false,
    dailySourceLimit: storedInteger(input.dailySourceLimit, defaultSettings.dailySourceLimit, 0, 100),
    maxNetworkCallsPerRun: storedInteger(
      input.maxNetworkCallsPerRun,
      defaultSettings.maxNetworkCallsPerRun,
      0,
      250,
    ),
    minOpportunityScore: storedInteger(
      input.minOpportunityScore,
      defaultSettings.minOpportunityScore,
      1,
      100,
    ),
    maxExpansionFetchesPerRun: storedInteger(
      input.maxExpansionFetchesPerRun,
      defaultSettings.maxExpansionFetchesPerRun,
      0,
      10,
    ),
    maxExpansionCandidatesPerRun: storedInteger(
      input.maxExpansionCandidatesPerRun,
      defaultSettings.maxExpansionCandidatesPerRun,
      0,
      100,
    ),
    updatedAtISO: typeof input.updatedAtISO === "string" ? input.updatedAtISO : null,
    updatedBy: typeof input.updatedBy === "string" ? input.updatedBy.slice(0, 120) : "operator",
  };
  if (settings.maxNetworkCallsPerRun <= 0) {
    settings.sourceExpansionEnabled = false;
    settings.opportunityDiscoveryEnabled = false;
  }
  return settings;
}

function exactBoolean(
  body: AutonomySettingsBody,
  key: keyof AutonomySettingsBody,
  fallback: boolean,
): { ok: true; value: boolean } | { ok: false; error: "invalid_boolean"; field: string } {
  if (!Object.prototype.hasOwnProperty.call(body, key)) return { ok: true, value: fallback };
  const value = body[key];
  if (typeof value !== "boolean") return { ok: false, error: "invalid_boolean", field: String(key) };
  return { ok: true, value };
}

function exactInteger(
  body: AutonomySettingsBody,
  key: keyof AutonomySettingsBody,
  fallback: number,
  min: number,
  max: number,
): { ok: true; value: number } | { ok: false; error: "invalid_integer"; field: string; allowed: { min: number; max: number } } {
  if (!Object.prototype.hasOwnProperty.call(body, key)) return { ok: true, value: fallback };
  const value = body[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    return { ok: false, error: "invalid_integer", field: String(key), allowed: { min, max } };
  }
  return { ok: true, value };
}

function policyFor(settings: NormalizedAutonomySettings) {
  const manualResearchConfigured = settings.engineEnabled && settings.maxNetworkCallsPerRun > 0;
  return {
    scheduledExecutionEnabled: false,
    canRunScheduledEngine: false,
    canFetchSources: false,
    canExpandSourceCandidates: false,
    canSaveExpansionCandidatesAutomatically: false,
    canSaveOpportunities: false,
    canSaveLeads: false,
    canGenerateDrafts: false,
    canSendEmail: false,
    manualResearchConfigured,
    manualResearchRequiresAuthentication: true,
    manualResearchRequiresConfirmation: true,
    manualOpportunityDiscoveryAvailable:
      manualResearchConfigured && settings.opportunityDiscoveryEnabled,
    manualSourceExpansionAvailable:
      manualResearchConfigured
      && settings.sourceExpansionEnabled
      && settings.maxExpansionFetchesPerRun > 0,
    manualResearchSavesReviewItemsOnly: true,
    dailySourceLimit: settings.dailySourceLimit,
    maxNetworkCallsPerRun: settings.maxNetworkCallsPerRun,
    minOpportunityScore: settings.minOpportunityScore,
    maxExpansionFetchesPerRun: settings.maxExpansionFetchesPerRun,
    maxExpansionCandidatesPerRun: settings.maxExpansionCandidatesPerRun,
  };
}

function compatibilityMetadata() {
  return {
    contractVersion: "autonomy_settings_v2_review_first",
    readOnlyAlias: true,
    authoritative: false,
    executable: false,
  };
}

async function readSettings(env: Env) {
  const saved = normalizeStoredSettings(parseJson(await getSetting(env, SETTING_KEY)));
  return {
    ok: true,
    mode: "autonomy_settings",
    contractVersion: AUTONOMY_SETTINGS_CONTRACT,
    compatibility: compatibilityMetadata(),
    settings: saved,
    policy: policyFor(saved),
    allowedModes,
    safety: {
      readOnly: true,
      freeSafeOnly: true,
      aiAlwaysOff: true,
      sendingAlwaysOff: true,
      leadDiscoveryAlwaysOff: true,
      readSecretsFromServerOnly: true,
      sourceExpansionSaveRequiresConfirmation: true,
      settingsWriteRequiresConfirmation: true,
      scheduledExternalExecutionDisabled: true,
      manualResearchRequiresAuthentication: true,
      manualResearchRequiresConfirmation: true,
      manualResearchSavesReviewItemsOnly: true,
    },
  };
}

function buildNextSettings(
  body: AutonomySettingsBody,
  previous: NormalizedAutonomySettings,
  now: string,
): { ok: true; settings: NormalizedAutonomySettings } | { ok: false; error: string; [key: string]: unknown } {
  const unknownKeys = Object.keys(body).filter((key) => !acceptedWriteKeys.has(key));
  if (unknownKeys.length) return { ok: false, error: "unsupported_setting_keys", keys: unknownKeys.sort() };

  if (Object.prototype.hasOwnProperty.call(body, "mode")
    && (typeof body.mode !== "string" || !allowedModes.includes(body.mode as AutonomyMode))) {
    return { ok: false, error: "invalid_mode", allowedModes };
  }
  for (const key of ["leadDiscoveryEnabled", "aiDraftsEnabled", "sendingEnabled"] as const) {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== false) {
      return { ok: false, error: "forbidden_execution_capability", field: key, requiredValue: false };
    }
  }

  const engineEnabled = exactBoolean(body, "engineEnabled", previous.engineEnabled);
  if (!engineEnabled.ok) return engineEnabled;
  const opportunityDiscoveryEnabled = exactBoolean(
    body,
    "opportunityDiscoveryEnabled",
    previous.opportunityDiscoveryEnabled,
  );
  if (!opportunityDiscoveryEnabled.ok) return opportunityDiscoveryEnabled;
  const sourceExpansionEnabled = exactBoolean(
    body,
    "sourceExpansionEnabled",
    previous.sourceExpansionEnabled,
  );
  if (!sourceExpansionEnabled.ok) return sourceExpansionEnabled;

  const dailySourceLimit = exactInteger(body, "dailySourceLimit", previous.dailySourceLimit, 0, 100);
  if (!dailySourceLimit.ok) return dailySourceLimit;
  const maxNetworkCallsPerRun = exactInteger(
    body,
    "maxNetworkCallsPerRun",
    previous.maxNetworkCallsPerRun,
    0,
    250,
  );
  if (!maxNetworkCallsPerRun.ok) return maxNetworkCallsPerRun;
  const minOpportunityScore = exactInteger(
    body,
    "minOpportunityScore",
    previous.minOpportunityScore,
    1,
    100,
  );
  if (!minOpportunityScore.ok) return minOpportunityScore;
  const maxExpansionFetchesPerRun = exactInteger(
    body,
    "maxExpansionFetchesPerRun",
    previous.maxExpansionFetchesPerRun,
    0,
    10,
  );
  if (!maxExpansionFetchesPerRun.ok) return maxExpansionFetchesPerRun;
  const maxExpansionCandidatesPerRun = exactInteger(
    body,
    "maxExpansionCandidatesPerRun",
    previous.maxExpansionCandidatesPerRun,
    0,
    100,
  );
  if (!maxExpansionCandidatesPerRun.ok) return maxExpansionCandidatesPerRun;

  const updatedBy = boundedReviewText(body.updatedBy, "updatedBy", 120);
  if (!updatedBy.ok) return updatedBy;

  const settings: NormalizedAutonomySettings = {
    mode: typeof body.mode === "string" ? body.mode as AutonomyMode : previous.mode,
    engineEnabled: engineEnabled.value,
    freeSafeOnly: true,
    opportunityDiscoveryEnabled: opportunityDiscoveryEnabled.value,
    sourceExpansionEnabled: sourceExpansionEnabled.value,
    leadDiscoveryEnabled: false,
    aiDraftsEnabled: false,
    sendingEnabled: false,
    dailySourceLimit: dailySourceLimit.value,
    maxNetworkCallsPerRun: maxNetworkCallsPerRun.value,
    minOpportunityScore: minOpportunityScore.value,
    maxExpansionFetchesPerRun: maxExpansionFetchesPerRun.value,
    maxExpansionCandidatesPerRun: maxExpansionCandidatesPerRun.value,
    updatedAtISO: now,
    updatedBy: updatedBy.value || "operator",
  };
  if (settings.maxNetworkCallsPerRun <= 0) {
    settings.sourceExpansionEnabled = false;
    settings.opportunityDiscoveryEnabled = false;
  }
  return { ok: true, settings };
}

export async function handleAutonomySettingsAdmin(
  request: Request,
  env: Env,
  pathname: string,
  json: JsonResponse,
): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET, POST" } });
  }
  if (pathname !== "/admin/settings/autonomy") {
    return json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (request.method === "GET") return json(await readSettings(env));
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET, POST" } });
  }

  const parsed = await readBoundedJsonObject<AutonomySettingsBody>(request, {
    maxBytes: 8_192,
    maxDepth: 3,
    maxNodes: 32,
    maxArrayLength: 4,
    maxStringLength: 256,
    maxKeyLength: 64,
  });
  if (!parsed.ok) return json(boundedJsonFailurePayload(parsed), { status: parsed.status });
  if (!isExplicitJsonConfirmation(parsed.value)) {
    return json({
      ok: false,
      error: "confirm_required",
      reason: "Autonomy setting changes require exact JSON confirmation. Scheduled external execution, AI drafting, lead discovery and sending cannot be enabled from this route.",
      requiredPayload: { confirm: true },
      confirmationCoercionAllowed: false,
      requestBodyContract: parsed.contract,
    }, { status: 400 });
  }

  const requestReceipt = {
    contract: parsed.contract,
    bytes: parsed.bytes,
    bodySha256: parsed.bodySha256,
  };
  const lease = await acquireManualResearchLease(env, AUTONOMY_SETTINGS_LEASE, 600);
  if (!lease) {
    return json({ ...manualResearchLeaseConflict(AUTONOMY_SETTINGS_LEASE), requestReceipt }, { status: 409 });
  }

  try {
    const previous = normalizeStoredSettings(parseJson(await getSetting(env, SETTING_KEY)));
    const now = nowISO();
    const next = buildNextSettings(parsed.value, previous, now);
    if (!next.ok) return json({ ...next, requestReceipt }, { status: 400 });
    const changed = JSON.stringify(previous) !== JSON.stringify(next.settings);
    const auditMessage = JSON.stringify({
      contract: AUTONOMY_SETTINGS_CONTRACT,
      changed,
      previous,
      next: next.settings,
      requestBodySha256: parsed.bodySha256,
      reviewOnly: true,
      scheduledExternalExecutionEnabled: false,
      externalExecutionAllowed: false,
    });

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO settings (key, value)
         VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ).bind(SETTING_KEY, JSON.stringify(next.settings)),
      env.DB.prepare(
        `INSERT INTO events (id, type, message, lead_id, created_at_iso)
         VALUES (?, 'autonomy_settings_update', ?, NULL, ?)`,
      ).bind(uuid(), auditMessage, now),
    ]);

    return json({
      ok: true,
      mode: "autonomy_settings_saved",
      contractVersion: AUTONOMY_SETTINGS_CONTRACT,
      compatibility: compatibilityMetadata(),
      settings: next.settings,
      policy: policyFor(next.settings),
      changed,
      requestReceipt,
      leaseContract: lease.contract,
      exactBooleanConfirmation: true,
      confirmationCoercionAllowed: false,
      concurrentSettingsWriteAllowed: false,
      reviewOnly: true,
      executable: false,
      deliverable: false,
      authoritativeForExternalExecution: false,
      externalExecutionAllowed: false,
      safety: {
        settingsAndAuditAtomic: true,
        callsNetwork: false,
        callsAI: false,
        sendsEmail: false,
        postsExternally: false,
        submitsForms: false,
        freeSafeOnly: true,
        sourceExpansionSaveRequiresConfirmation: true,
        settingsWriteRequiresConfirmation: true,
        scheduledExternalExecutionDisabled: true,
        manualResearchRequiresAuthentication: true,
        manualResearchRequiresConfirmation: true,
        manualResearchSavesReviewItemsOnly: true,
      },
    });
  } catch {
    return json({
      ok: false,
      error: "autonomy_settings_update_failed",
      contractVersion: AUTONOMY_SETTINGS_CONTRACT,
      requestReceipt,
      reviewOnly: true,
      executable: false,
      externalExecutionAllowed: false,
    }, { status: 500 });
  } finally {
    await releaseManualResearchLease(env, lease).catch(() => false);
  }
}
