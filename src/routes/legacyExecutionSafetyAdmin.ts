import { Env, getDraftById, getSetting, nowISO, uuid } from "../db";
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
import {
  REVIEW_MUTATION_CONTRACT,
  boundedReviewText,
  validReviewRecordId,
} from "../core/reviewMutationSafety";
import { FREE_SAFE_DEFAULT_SETTINGS } from "../core/settings";

export type JsonResponse = (data: any, init?: ResponseInit) => Response;
type LegacySettingsBody = Record<string, unknown> & {
  confirm?: unknown;
  settings?: unknown;
  actor?: unknown;
  reason?: unknown;
};
type LegacyDraftDecisionBody = Record<string, unknown> & {
  confirm?: unknown;
  actor?: unknown;
  reason?: unknown;
  notes?: unknown;
};

type IntegerRule = Readonly<{ min: number; max: number }>;

const LEGACY_SETTINGS_LEASE = "legacy-safe-settings";
const SAFE_BOOLEAN_SETTING_KEYS = new Set([
  "hard_stop_on_budget",
  "approval_required",
]);
const SAFE_INTEGER_SETTING_RULES: Readonly<Record<string, IntegerRule>> = Object.freeze({
  daily_external_fetch_limit: { min: 0, max: 1_000 },
  daily_source_page_limit: { min: 0, max: 100 },
  daily_profile_page_limit: { min: 0, max: 500 },
  daily_business_site_scan_limit: { min: 0, max: 250 },
  daily_contact_page_scan_limit: { min: 0, max: 250 },
  daily_source_replenish_limit: { min: 0, max: 50 },
  per_tick_source_page_limit: { min: 0, max: 20 },
  per_tick_profile_page_limit: { min: 0, max: 50 },
  per_tick_business_site_limit: { min: 0, max: 25 },
  per_tick_contact_page_limit: { min: 0, max: 25 },
  source_failure_cooldown_threshold: { min: 1, max: 20 },
  source_failure_retire_threshold: { min: 1, max: 50 },
  source_cooldown_hours: { min: 1, max: 720 },
  draft_backlog_pause_scan_threshold: { min: 0, max: 1_000 },
  raw_event_retention_days: { min: 1, max: 365 },
});
const SAFE_MUTABLE_SETTING_KEYS = new Set([
  "cost_mode",
  ...SAFE_BOOLEAN_SETTING_KEYS,
  ...Object.keys(SAFE_INTEGER_SETTING_RULES),
]);
const FORCED_SAFE_SETTINGS: Readonly<Record<string, string>> = Object.freeze({
  engine_enabled: "0",
  ai_enabled: "0",
  ai_mode: "off",
  drafting_enabled: "0",
  sending_enabled: "0",
  daily_draft_limit: "0",
  daily_ai_call_limit: "0",
  daily_send_limit: "0",
  per_tick_draft_limit: "0",
  per_tick_ai_call_limit: "0",
  draft_cap_per_day: "0",
  send_cap_per_day: "0",
});

function settingUpsert(env: Env, key: string, value: string): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).bind(key, value);
}

async function persistedUnsafeSettingKeys(env: Env): Promise<string[]> {
  const drift: string[] = [];
  for (const [key, expected] of Object.entries(FORCED_SAFE_SETTINGS)) {
    const persisted = await getSetting(env, key);
    if (persisted !== null && persisted !== expected) drift.push(key);
  }
  return drift.sort();
}

async function safeSettingsPayload(env: Env) {
  const settings: Record<string, string> = { ...FORCED_SAFE_SETTINGS };
  for (const key of SAFE_MUTABLE_SETTING_KEYS) {
    settings[key] = (await getSetting(env, key))
      ?? FREE_SAFE_DEFAULT_SETTINGS[key as keyof typeof FREE_SAFE_DEFAULT_SETTINGS]
      ?? "0";
  }
  return {
    ok: true,
    mode: "review_first_settings",
    contractVersion: "legacy_admin_settings_v3_bounded_read_only",
    settings,
    persistedUnsafeSettingKeys: await persistedUnsafeSettingKeys(env),
    safety: {
      readOnly: true,
      readRouteMutatesSettings: false,
      legacyRunEndpointDisabled: true,
      scheduledExternalExecutionDisabled: true,
      manualAIExecutionDisabled: true,
      manualSendingDisabled: true,
      draftGenerationDisabled: true,
      settingsWriteRequiresConfirmation: true,
      draftDecisionRequiresConfirmation: true,
    },
  };
}

async function safeOverviewPayload(env: Env) {
  return {
    ok: true,
    mode: "review_first_overview",
    contractVersion: "legacy_admin_overview_v3_read_only",
    counters: {
      researchPagesProcessedToday: Number((await getSetting(env, "crawl_scanned_today")) || 0),
      internalDraftRecordsCreatedToday: Number((await getSetting(env, "drafts_created_today")) || 0),
      reviewDecisionsToday: Number((await getSetting(env, "approvals_today")) || 0),
      externalSendsToday: 0,
      aiCallsToday: 0,
    },
    caps: {
      boundedResearchPerDay: Number(
        (await getSetting(env, "daily_external_fetch_limit"))
        || FREE_SAFE_DEFAULT_SETTINGS.daily_external_fetch_limit,
      ),
      aiCallsPerDay: 0,
      draftsPerDay: 0,
      sendsPerDay: 0,
    },
    execution: {
      scheduledEngineEnabled: false,
      manualLegacyExecutionEnabled: false,
      aiDraftGenerationEnabled: false,
      emailSendingEnabled: false,
      socialPostingEnabled: false,
      formSubmissionEnabled: false,
    },
    persistedUnsafeSettingKeys: await persistedUnsafeSettingKeys(env),
    safety: {
      readOnly: true,
      readRouteMutatesSettings: false,
      aggregateOnly: true,
      contactDataExposed: false,
      rawEventsExposed: false,
      externalExecutionEnabled: false,
    },
  };
}

function normalizeSafeSettings(value: unknown):
  | { ok: true; settings: Record<string, string> }
  | { ok: false; error: string; [key: string]: unknown } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "settings_object_required" };
  }
  const settings: Record<string, string> = {};
  const unsupported: string[] = [];
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!SAFE_MUTABLE_SETTING_KEYS.has(key)) {
      unsupported.push(key);
      continue;
    }
    if (key === "cost_mode") {
      if (raw !== "free_safe") {
        return { ok: false, error: "invalid_setting_value", field: key, requiredValue: "free_safe" };
      }
      settings[key] = raw;
      continue;
    }
    if (SAFE_BOOLEAN_SETTING_KEYS.has(key)) {
      if (typeof raw !== "boolean") {
        return { ok: false, error: "invalid_setting_boolean", field: key };
      }
      settings[key] = raw ? "1" : "0";
      continue;
    }
    const rule = SAFE_INTEGER_SETTING_RULES[key];
    if (!rule || typeof raw !== "number" || !Number.isInteger(raw) || raw < rule.min || raw > rule.max) {
      return { ok: false, error: "invalid_setting_integer", field: key, allowed: rule || null };
    }
    settings[key] = String(raw);
  }
  if (unsupported.length) return { ok: false, error: "unsupported_setting_keys", keys: unsupported.sort() };
  if (!Object.keys(settings).length) return { ok: false, error: "no_supported_settings" };
  return { ok: true, settings };
}

async function updateSafeSettings(
  request: Request,
  env: Env,
  json: JsonResponse,
): Promise<Response> {
  const parsed = await readBoundedJsonObject<LegacySettingsBody>(request, {
    maxBytes: 16_384,
    maxDepth: 4,
    maxNodes: 80,
    maxArrayLength: 4,
    maxStringLength: 512,
    maxKeyLength: 96,
  });
  if (!parsed.ok) return json(boundedJsonFailurePayload(parsed), { status: parsed.status });
  if (!isExplicitJsonConfirmation(parsed.value)) {
    return json({
      ok: false,
      error: "confirm_required",
      reason: "Legacy admin setting changes require exact JSON confirmation and may only adjust bounded research and retention limits.",
      requiredPayload: { confirm: true },
      confirmationCoercionAllowed: false,
      requestBodyContract: parsed.contract,
    }, { status: 400 });
  }
  const normalized = normalizeSafeSettings(parsed.value.settings);
  if (!normalized.ok) return json(normalized, { status: 400 });
  const actor = boundedReviewText(parsed.value.actor, "actor", 120);
  if (!actor.ok) return json({ ...actor, ok: false }, { status: 400 });
  const reason = boundedReviewText(parsed.value.reason, "reason", 500);
  if (!reason.ok) return json({ ...reason, ok: false }, { status: 400 });

  const requestReceipt = {
    contract: parsed.contract,
    bytes: parsed.bytes,
    bodySha256: parsed.bodySha256,
  };
  const lease = await acquireManualResearchLease(env, LEGACY_SETTINGS_LEASE, 600);
  if (!lease) {
    return json({ ...manualResearchLeaseConflict(LEGACY_SETTINGS_LEASE), requestReceipt }, { status: 409 });
  }
  try {
    const now = nowISO();
    const statements = [
      ...Object.entries(normalized.settings).map(([key, value]) => settingUpsert(env, key, value)),
      ...Object.entries(FORCED_SAFE_SETTINGS).map(([key, value]) => settingUpsert(env, key, value)),
    ];
    const auditMessage = JSON.stringify({
      contract: "legacy_admin_settings_v3_bounded_review_only",
      updatedKeys: Object.keys(normalized.settings).sort(),
      actor: actor.value || "operator",
      reason: reason.value,
      requestBodySha256: parsed.bodySha256,
      forcedSafeKeys: Object.keys(FORCED_SAFE_SETTINGS).sort(),
      externalExecutionAllowed: false,
    });
    statements.push(
      env.DB.prepare(
        `INSERT INTO events (id, type, message, lead_id, created_at_iso)
         VALUES (?, 'settings_update_review_first', ?, NULL, ?)`,
      ).bind(uuid(), auditMessage, now),
    );
    await env.DB.batch(statements);

    return json({
      ok: true,
      mode: "review_first_settings_saved",
      contractVersion: "legacy_admin_settings_v3_bounded_review_only",
      updated: normalized.settings,
      forcedSafeSettings: FORCED_SAFE_SETTINGS,
      requestReceipt,
      leaseContract: lease.contract,
      exactBooleanConfirmation: true,
      confirmationCoercionAllowed: false,
      concurrentSettingsWriteAllowed: false,
      reviewOnly: true,
      executable: false,
      externalExecutionAllowed: false,
      safety: {
        settingsAndAuditAtomic: true,
        externalExecutionEnabled: false,
        callsNetwork: false,
        callsAI: false,
        sendsEmail: false,
        postsExternally: false,
        submitsForms: false,
      },
    });
  } catch {
    return json({
      ok: false,
      error: "legacy_settings_update_failed",
      requestReceipt,
      reviewOnly: true,
      executable: false,
      externalExecutionAllowed: false,
    }, { status: 500 });
  } finally {
    await releaseManualResearchLease(env, lease).catch(() => false);
  }
}

async function updateDraftDecision(
  request: Request,
  env: Env,
  pathname: string,
  json: JsonResponse,
): Promise<Response> {
  const match = pathname.match(/^\/admin\/drafts\/([^/]+)\/(approve|reject)$/);
  if (!match) return json({ ok: false, error: "not_found" }, { status: 404 });
  const draftId = decodeURIComponent(match[1]);
  if (!validReviewRecordId(draftId)) return json({ ok: false, error: "invalid_draft_id" }, { status: 404 });

  const parsed = await readBoundedJsonObject<LegacyDraftDecisionBody>(request, {
    maxBytes: 8_192,
    maxDepth: 3,
    maxNodes: 24,
    maxArrayLength: 2,
    maxStringLength: 4_096,
    maxKeyLength: 64,
  });
  if (!parsed.ok) return json(boundedJsonFailurePayload(parsed), { status: parsed.status });
  if (!isExplicitJsonConfirmation(parsed.value)) {
    return json({
      ok: false,
      error: "confirm_required",
      reason: "Draft review-state changes require exact JSON confirmation and cannot trigger delivery.",
      requiredPayload: { confirm: true },
      confirmationCoercionAllowed: false,
      requestBodyContract: parsed.contract,
    }, { status: 400 });
  }
  const actor = boundedReviewText(parsed.value.actor, "actor", 120);
  if (!actor.ok) return json({ ...actor, ok: false }, { status: 400 });
  const reason = boundedReviewText(parsed.value.reason, "reason", 500);
  if (!reason.ok) return json({ ...reason, ok: false }, { status: 400 });
  const notes = boundedReviewText(parsed.value.notes, "notes", 4_000, { preserveLineBreaks: true });
  if (!notes.ok) return json({ ...notes, ok: false }, { status: 400 });

  const requestReceipt = {
    contract: parsed.contract,
    bytes: parsed.bytes,
    bodySha256: parsed.bodySha256,
  };
  const actionKey = `draft-review:${draftId}`;
  const lease = await acquireManualResearchLease(env, actionKey, 600);
  if (!lease) return json({ ...manualResearchLeaseConflict(actionKey), requestReceipt }, { status: 409 });

  try {
    const draft = await getDraftById(env, draftId);
    if (!draft) return json({ ok: false, error: "draft_not_found", requestReceipt }, { status: 404 });
    const decision = match[2] as "approve" | "reject";
    const status = decision === "approve" ? "approved" : "rejected";
    const now = nowISO();
    const auditMessage = JSON.stringify({
      contract: REVIEW_MUTATION_CONTRACT,
      legacyCompatibilityRoute: true,
      draftId,
      decision,
      status,
      actor: actor.value || "operator",
      reason: reason.value,
      notes: notes.value,
      requestBodySha256: parsed.bodySha256,
      reviewOnly: true,
      executable: false,
      deliverable: false,
      externalExecutionAllowed: false,
    });
    await env.DB.batch([
      env.DB.prepare("UPDATE leads SET status = ?, updated_at_iso = ? WHERE id = ?")
        .bind(status, now, draft.lead_id),
      env.DB.prepare("UPDATE drafts SET status = ?, updated_at_iso = ? WHERE id = ?")
        .bind(status, now, draftId),
      env.DB.prepare(
        `INSERT INTO events (id, type, message, lead_id, created_at_iso)
         VALUES (?, 'legacy_draft_review', ?, ?, ?)`,
      ).bind(uuid(), auditMessage, draft.lead_id, now),
    ]);
    return json({
      ok: true,
      id: draftId,
      status,
      contract: REVIEW_MUTATION_CONTRACT,
      requestReceipt,
      leaseContract: lease.contract,
      exactBooleanConfirmation: true,
      confirmationCoercionAllowed: false,
      concurrentDuplicateReviewAllowed: false,
      reviewOnly: true,
      executable: false,
      deliverable: false,
      externalExecutionAllowed: false,
      safety: {
        reviewStateAndAuditAtomic: true,
        sendsEmail: false,
        callsAI: false,
        postsExternally: false,
        externalExecutionEnabled: false,
      },
    });
  } catch {
    return json({
      ok: false,
      error: "legacy_draft_review_failed",
      requestReceipt,
      reviewOnly: true,
      executable: false,
      externalExecutionAllowed: false,
    }, { status: 500 });
  } finally {
    await releaseManualResearchLease(env, lease).catch(() => false);
  }
}

export async function handleLegacyExecutionSafetyAdmin(
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
  if (pathname === "/admin/run") {
    return json({
      ok: false,
      error: "legacy_execution_disabled",
      reason: "Legacy scan, tick, AI-draft and send execution is disabled. Use typed review-first opportunity, source-preview and internal metadata routes instead.",
      allowedKinds: [],
      safety: {
        readOnlyResponse: true,
        responseMutatesSettings: false,
        callsAI: false,
        sendsEmail: false,
        externalExecutionEnabled: false,
      },
    }, { status: 410 });
  }
  if (pathname === "/admin/overview" && request.method === "GET") {
    return json(await safeOverviewPayload(env));
  }
  if (pathname === "/admin/settings" && request.method === "GET") {
    return json(await safeSettingsPayload(env));
  }
  if (pathname === "/admin/settings" && request.method === "POST") {
    return updateSafeSettings(request, env, json);
  }
  if (/^\/admin\/drafts\/[^/]+\/(approve|reject)$/.test(pathname) && request.method === "POST") {
    return updateDraftDecision(request, env, pathname, json);
  }
  return json({ ok: false, error: "not_found", path: pathname, method: request.method }, { status: 404 });
}
