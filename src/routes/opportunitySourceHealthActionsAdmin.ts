import { Env, getAdminToken, logEvent } from "../db";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

type SourceHealthAction = "pause" | "activate" | "lower_priority" | "raise_priority" | "reset_error";

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

async function tableExists(env: Env, tableName: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1").bind(tableName).first<any>();
  return Boolean(row?.name);
}

function parseSourceId(pathname: string): string | null {
  const match = pathname.match(/^\/admin\/opportunities\/sources\/([^/]+)\/health-action$/);
  if (!match?.[1]) return null;
  const sourceId = decodeURIComponent(match[1]);
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(sourceId)) return null;
  return sourceId;
}

function clampPriority(value: unknown, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(fallback)));
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeAction(value: unknown): SourceHealthAction | null {
  if (value === "pause" || value === "activate" || value === "lower_priority" || value === "raise_priority" || value === "reset_error") return value;
  return null;
}

async function getSource(env: Env, sourceId: string) {
  return env.DB.prepare(
    `SELECT id, url, label, source_type, status, priority, success_count, failure_count, last_error
     FROM opportunity_sources
     WHERE id = ?
     LIMIT 1`
  ).bind(sourceId).first<any>();
}

async function performAction(env: Env, sourceId: string, body: any) {
  if (!(await tableExists(env, "opportunity_sources"))) {
    return { ok: false, error: "missing_migration", missing: "opportunity_sources", requiredMigration: "0004_opportunity_intelligence.sql" };
  }

  const action = normalizeAction(body?.action);
  if (!action) return { ok: false, error: "invalid_action", allowedActions: ["pause", "activate", "lower_priority", "raise_priority", "reset_error"] };
  if (body?.confirm !== true) return { ok: false, error: "confirmation_required", required: { confirm: true } };

  const source = await getSource(env, sourceId);
  if (!source?.id) return { ok: false, error: "source_not_found" };

  const now = new Date().toISOString();
  const before = { status: source.status, priority: source.priority, last_error: source.last_error };
  let after = { ...before };
  let message = "";

  if (action === "pause") {
    after.status = "paused";
    message = "Paused opportunity source from source-health action.";
    await env.DB.prepare("UPDATE opportunity_sources SET status = ?, updated_at_iso = ? WHERE id = ?").bind(after.status, now, sourceId).run();
  } else if (action === "activate") {
    after.status = "active";
    message = "Activated opportunity source from source-health action.";
    await env.DB.prepare("UPDATE opportunity_sources SET status = ?, updated_at_iso = ? WHERE id = ?").bind(after.status, now, sourceId).run();
  } else if (action === "lower_priority") {
    const amount = clampPriority(body?.amount, 10);
    after.priority = clampPriority(Number(source.priority || 0) - amount, 0);
    message = `Lowered opportunity source priority by ${amount}.`;
    await env.DB.prepare("UPDATE opportunity_sources SET priority = ?, updated_at_iso = ? WHERE id = ?").bind(after.priority, now, sourceId).run();
  } else if (action === "raise_priority") {
    const amount = clampPriority(body?.amount, 10);
    after.priority = clampPriority(Number(source.priority || 0) + amount, 100);
    message = `Raised opportunity source priority by ${amount}.`;
    await env.DB.prepare("UPDATE opportunity_sources SET priority = ?, updated_at_iso = ? WHERE id = ?").bind(after.priority, now, sourceId).run();
  } else if (action === "reset_error") {
    after.last_error = null;
    message = "Reset opportunity source error state.";
    await env.DB.prepare("UPDATE opportunity_sources SET last_error = NULL, cooldown_until_iso = NULL, updated_at_iso = ? WHERE id = ?").bind(now, sourceId).run();
  }

  await logEvent(
    env,
    "opportunity_source_health_action",
    `${message} Source ${source.label || source.url}`,
    JSON.stringify({ sourceId, action, before, after, reason: body?.reason || null }),
  );

  const updated = await getSource(env, sourceId);
  return {
    ok: true,
    mode: "opportunity_source_health_action",
    action,
    message,
    source: updated,
    before,
    after,
    safety: {
      writesOnlyD1SourceMetadata: true,
      callsNetwork: false,
      callsAI: false,
      sendsEmail: false,
      postsExternally: false,
      requiresConfirm: true,
    },
  };
}

export async function handleOpportunitySourceHealthActionsAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, { status: 405 });

  const sourceId = parseSourceId(pathname);
  if (!sourceId) return json({ ok: false, error: "invalid_source_health_action_path" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  return json(await performAction(env, sourceId, body));
}
