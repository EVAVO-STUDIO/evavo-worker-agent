import { Env, getAdminToken } from "../db";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

const allowedModes = new Set(["observe_only", "free_safe_autonomy", "assisted_discovery", "draft_preparation", "controlled_outreach"]);

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

function boolInt(value: any, fallback: number): number {
  if (value === true || value === 1 || value === "1" || value === "true") return 1;
  if (value === false || value === 0 || value === "0" || value === "false") return 0;
  return fallback;
}

function boundedInt(value: any, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

async function tableExists(env: Env, tableName: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1").bind(tableName).first<any>();
  return Boolean(row?.name);
}

async function readSettings(env: Env) {
  if (!(await tableExists(env, "agent_settings"))) {
    return { ok: false, error: "missing_migration", requiredMigration: "0006_agent_settings.sql" };
  }
  const row = await env.DB.prepare("SELECT * FROM agent_settings WHERE id = 'default' LIMIT 1").first<any>();
  return { ok: true, mode: "agent_settings", settings: row };
}

function validatePatch(current: any, body: any) {
  const next = {
    mode: allowedModes.has(String(body.mode || current.mode)) ? String(body.mode || current.mode) : current.mode,
    engine_enabled: boolInt(body.engine_enabled ?? body.engineEnabled, current.engine_enabled),
    free_safe_only: boolInt(body.free_safe_only ?? body.freeSafeOnly, current.free_safe_only),
    opportunity_enabled: boolInt(body.opportunity_enabled ?? body.opportunityEnabled, current.opportunity_enabled),
    lead_enabled: boolInt(body.lead_enabled ?? body.leadEnabled, current.lead_enabled),
    draft_enabled: boolInt(body.draft_enabled ?? body.draftEnabled, current.draft_enabled),
    send_enabled: boolInt(body.send_enabled ?? body.sendEnabled, current.send_enabled),
    daily_source_limit: boundedInt(body.daily_source_limit ?? body.dailySourceLimit, current.daily_source_limit, 0, 100),
    max_network_calls_per_run: boundedInt(body.max_network_calls_per_run ?? body.maxNetworkCallsPerRun, current.max_network_calls_per_run, 0, 250),
    min_opportunity_score: boundedInt(body.min_opportunity_score ?? body.minOpportunityScore, current.min_opportunity_score, 1, 100),
    min_lead_score: boundedInt(body.min_lead_score ?? body.minLeadScore, current.min_lead_score, 1, 100),
    max_saved_items_per_run: boundedInt(body.max_saved_items_per_run ?? body.maxSavedItemsPerRun, current.max_saved_items_per_run, 0, 100),
    cooldown_hours_after_failure: boundedInt(body.cooldown_hours_after_failure ?? body.cooldownHoursAfterFailure, current.cooldown_hours_after_failure, 1, 168),
    review_required: boolInt(body.review_required ?? body.reviewRequired, current.review_required),
    notes: typeof body.notes === "string" ? body.notes.slice(0, 1000) : current.notes,
  };

  if (next.free_safe_only) {
    next.draft_enabled = 0;
    next.send_enabled = 0;
  }
  if (next.mode === "observe_only") {
    next.engine_enabled = 0;
    next.opportunity_enabled = 0;
    next.lead_enabled = 0;
    next.draft_enabled = 0;
    next.send_enabled = 0;
  }
  if (next.mode === "free_safe_autonomy") {
    next.free_safe_only = 1;
    next.draft_enabled = 0;
    next.send_enabled = 0;
  }
  if (!next.review_required) {
    next.send_enabled = 0;
  }

  return next;
}

async function updateSettings(env: Env, body: any) {
  if (!(await tableExists(env, "agent_settings"))) {
    return { ok: false, error: "missing_migration", requiredMigration: "0006_agent_settings.sql" };
  }
  const current = await env.DB.prepare("SELECT * FROM agent_settings WHERE id = 'default' LIMIT 1").first<any>();
  if (!current) return { ok: false, error: "settings_not_seeded" };
  const next = validatePatch(current, body || {});
  await env.DB.prepare(
    `UPDATE agent_settings
     SET mode = ?, engine_enabled = ?, free_safe_only = ?, opportunity_enabled = ?, lead_enabled = ?, draft_enabled = ?, send_enabled = ?,
         daily_source_limit = ?, max_network_calls_per_run = ?, min_opportunity_score = ?, min_lead_score = ?, max_saved_items_per_run = ?, cooldown_hours_after_failure = ?, review_required = ?, notes = ?, updated_at_iso = ?
     WHERE id = 'default'`
  ).bind(
    next.mode,
    next.engine_enabled,
    next.free_safe_only,
    next.opportunity_enabled,
    next.lead_enabled,
    next.draft_enabled,
    next.send_enabled,
    next.daily_source_limit,
    next.max_network_calls_per_run,
    next.min_opportunity_score,
    next.min_lead_score,
    next.max_saved_items_per_run,
    next.cooldown_hours_after_failure,
    next.review_required,
    next.notes,
    new Date().toISOString()
  ).run();
  return await readSettings(env);
}

export async function handleAgentSettingsAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (pathname !== "/admin/settings/agent") return json({ ok: false, error: "Not found" }, { status: 404 });
  if (request.method === "GET") return json(await readSettings(env));
  if (request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    return json(await updateSettings(env, body));
  }
  return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
