import { Env, getAdminToken, getDraftById, getSetting, logEvent, setSetting, updateLead } from "../db";
import { FREE_SAFE_DEFAULT_SETTINGS } from "../core/settings";

export type JsonResponse = (data: any, init?: ResponseInit) => Response;

const SAFE_MUTABLE_SETTING_KEYS = new Set([
  "cost_mode",
  "hard_stop_on_budget",
  "approval_required",
  "daily_external_fetch_limit",
  "daily_source_page_limit",
  "daily_profile_page_limit",
  "daily_business_site_scan_limit",
  "daily_contact_page_scan_limit",
  "daily_source_replenish_limit",
  "per_tick_source_page_limit",
  "per_tick_profile_page_limit",
  "per_tick_business_site_limit",
  "per_tick_contact_page_limit",
  "source_failure_cooldown_threshold",
  "source_failure_retire_threshold",
  "source_cooldown_hours",
  "draft_backlog_pause_scan_threshold",
  "raw_event_retention_days",
] as const);

const FORCED_SAFE_SETTINGS = Object.freeze({
  ai_enabled: "0",
  ai_mode: "off",
  drafting_enabled: "0",
  sending_enabled: "0",
  daily_draft_limit: "0",
  daily_ai_call_limit: "0",
  daily_send_limit: "0",
  per_tick_draft_limit: "0",
  per_tick_ai_call_limit: "0",
});

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

function confirmed(body: any): boolean {
  return body?.confirm === true || body?.confirm === 1 || body?.confirm === "1";
}

async function enforceSafeExecutionSettings(env: Env): Promise<void> {
  for (const [key, value] of Object.entries(FORCED_SAFE_SETTINGS)) await setSetting(env, key, value);
  await setSetting(env, "engine_enabled", "0");
  await setSetting(env, "draft_cap_per_day", "0");
  await setSetting(env, "send_cap_per_day", "0");
}

async function safeSettingsPayload(env: Env) {
  const settings: Record<string, string> = {
    engine_enabled: "0",
    ...FORCED_SAFE_SETTINGS,
    draft_cap_per_day: "0",
    send_cap_per_day: "0",
  };

  for (const key of SAFE_MUTABLE_SETTING_KEYS) {
    settings[key] = (await getSetting(env, key)) ?? FREE_SAFE_DEFAULT_SETTINGS[key];
  }

  return {
    ok: true,
    mode: "review_first_settings",
    contractVersion: "legacy_admin_settings_v2_review_first",
    settings,
    safety: {
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

async function updateSafeSettings(env: Env, body: any, json: JsonResponse): Promise<Response> {
  if (!confirmed(body)) {
    return json({
      ok: false,
      error: "confirm_required",
      reason: "Legacy admin setting changes require explicit confirmation and may only adjust bounded research and retention limits.",
    }, { status: 400 });
  }

  const rawSettings = body?.settings && typeof body.settings === "object" ? body.settings : body;
  const updated: Record<string, string> = {};
  const rejected: string[] = [];

  for (const [key, value] of Object.entries(rawSettings || {})) {
    if (key === "confirm") continue;
    if (!SAFE_MUTABLE_SETTING_KEYS.has(key as any)) {
      rejected.push(key);
      continue;
    }
    const nextValue = String(value);
    await setSetting(env, key, nextValue);
    updated[key] = nextValue;
  }

  await enforceSafeExecutionSettings(env);
  await logEvent(env, "settings_update_review_first", `Updated ${Object.keys(updated).length} bounded setting(s); rejected ${rejected.length} unsafe or unsupported key(s).`);

  return json({
    ok: rejected.length === 0,
    mode: "review_first_settings_saved",
    updated,
    rejected,
    forcedSafeSettings: FORCED_SAFE_SETTINGS,
    safety: {
      externalExecutionEnabled: false,
      callsAI: false,
      sendsEmail: false,
      submitsForms: false,
    },
  }, rejected.length ? { status: 400 } : undefined);
}

async function updateDraftDecision(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  const match = pathname.match(/^\/admin\/drafts\/([^/]+)\/(approve|reject)$/);
  if (!match) return json({ ok: false, error: "not_found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  if (!confirmed(body)) {
    return json({ ok: false, error: "confirm_required", reason: "Draft review-state changes require explicit confirmation." }, { status: 400 });
  }

  const [, id, decision] = match;
  const draft = await getDraftById(env, id);
  if (!draft) return json({ ok: false, error: "Draft not found" }, { status: 404 });
  const status = decision === "approve" ? "approved" : "rejected";
  await updateLead(env, draft.lead_id, { status: status as any });
  await env.DB.prepare("UPDATE drafts SET status = ?, updated_at_iso = ? WHERE id = ?")
    .bind(status, new Date().toISOString(), id)
    .run();
  await logEvent(env, decision === "approve" ? "approve_ok" : "reject_ok", `Draft ${status} through review-first safety handler`, draft.lead_id);
  return json({
    ok: true,
    id,
    status,
    safety: { sendsEmail: false, externalExecutionEnabled: false, reviewStateOnly: true },
  });
}

export async function handleLegacyExecutionSafetyAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  if (pathname === "/admin/run") {
    await enforceSafeExecutionSettings(env);
    return json({
      ok: false,
      error: "legacy_execution_disabled",
      reason: "Legacy scan, tick, AI-draft and send execution is disabled. Use typed review-first opportunity, source-preview and internal metadata routes instead.",
      allowedKinds: [],
      safety: { callsAI: false, sendsEmail: false, externalExecutionEnabled: false },
    }, { status: 410 });
  }

  if (pathname === "/admin/settings" && request.method === "GET") {
    await enforceSafeExecutionSettings(env);
    return json(await safeSettingsPayload(env));
  }
  if (pathname === "/admin/settings" && request.method === "POST") return updateSafeSettings(env, await request.json().catch(() => ({})), json);
  if (/^\/admin\/drafts\/[^/]+\/(approve|reject)$/.test(pathname) && request.method === "POST") {
    return updateDraftDecision(request, env, pathname, json);
  }

  return json({ ok: false, error: "not_found", path: pathname, method: request.method }, { status: 404 });
}
