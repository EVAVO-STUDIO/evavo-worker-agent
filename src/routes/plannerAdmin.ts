import { Env, getAdminToken, nowISO, uuid } from "../db";
import { buildPlannerReport } from "../core/planner";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

function confirmed(body: any): boolean {
  return body?.confirm === true || body?.confirm === 1 || body?.confirm === "1";
}

function safeParse(raw: unknown): any {
  try {
    return JSON.parse(String(raw || "{}"));
  } catch {
    return {};
  }
}

function summarizeRecommendationRow(row: any) {
  if (!row) return null;
  const evidence = safeParse(row.evidence_json);
  const report = evidence.report || {};
  return {
    id: row.id,
    createdAt: row.created_at_iso,
    recommendedNextAction: row.target_id,
    primaryRoute: row.target_url,
    reason: row.reason,
    confidence: row.confidence,
    recordedBy: evidence.recordedBy || null,
    notes: evidence.notes || null,
    healthStatus: report.state?.healthStatus || null,
    draftBacklog: report.state?.draftBacklog ?? null,
    safeActions: report.decision?.safeActions || [],
    blockedActions: report.decision?.blockedActions || [],
  };
}

function summarizeExecutionRow(row: any) {
  if (!row) return null;
  const evidence = safeParse(row.evidence_json);
  const result = evidence.result || {};
  return {
    id: row.id,
    createdAt: row.created_at_iso,
    actionId: row.target_id,
    route: row.target_url,
    reason: row.reason,
    confidence: row.confidence,
    requestedBy: evidence.requestedBy || null,
    notes: evidence.notes || null,
    resultOk: result.ok === true,
    resultMode: result.mode || null,
    resultSummary: {
      error: result.error || null,
      selectedSourceCount: Array.isArray(result.selectedSources) ? result.selectedSources.length : null,
      draftCount: Array.isArray(result.drafts) ? result.drafts.length : null,
      sourceCount: Array.isArray(result.sources) ? result.sources.length : null,
      hasSource: Boolean(result.source),
    },
  };
}

async function latestDecision(env: Env, decisionType: string) {
  const row = await env.DB.prepare(
    `SELECT id, target_id, target_url, reason, confidence, evidence_json, created_at_iso
     FROM agent_decisions
     WHERE decision_type = ?
     ORDER BY created_at_iso DESC
     LIMIT 1`
  ).bind(decisionType).first<any>();
  return row || null;
}

async function plannerHistory(env: Env, limit: number) {
  const rows = await env.DB.prepare(
    `SELECT id, target_id, target_url, reason, confidence, evidence_json, created_at_iso
     FROM agent_decisions
     WHERE decision_type = 'planner_recommendation'
     ORDER BY created_at_iso DESC
     LIMIT ?`
  ).bind(Math.max(1, Math.min(100, limit))).all<any>();

  const history = (rows.results || []).map((row: any) => summarizeRecommendationRow(row));

  return { ok: true, mode: "planner_history", count: history.length, history };
}

async function plannerExecutions(env: Env, limit: number) {
  const rows = await env.DB.prepare(
    `SELECT id, target_id, target_url, reason, confidence, evidence_json, created_at_iso
     FROM agent_decisions
     WHERE decision_type = 'planner_execute'
     ORDER BY created_at_iso DESC
     LIMIT ?`
  ).bind(Math.max(1, Math.min(100, limit))).all<any>();

  const executions = (rows.results || []).map((row: any) => summarizeExecutionRow(row));

  return { ok: true, mode: "planner_executions", count: executions.length, executions };
}

async function plannerDashboard(env: Env) {
  const [planner, latestRecommendationRow, latestExecutionRow] = await Promise.all([
    buildPlannerReport(env),
    latestDecision(env, "planner_recommendation"),
    latestDecision(env, "planner_execute"),
  ]);

  const latestRecommendation = summarizeRecommendationRow(latestRecommendationRow);
  const latestExecution = summarizeExecutionRow(latestExecutionRow);
  const primaryAction = planner.decision?.primaryActionCard || null;

  return {
    ok: true,
    mode: "planner_dashboard",
    nowISO: new Date().toISOString(),
    status: {
      healthStatus: planner.state?.healthStatus || null,
      healthIssues: planner.state?.healthIssues || [],
      engineEnabled: planner.flags?.engineEnabled === true,
      aiEnabled: planner.flags?.aiEnabled === true,
      sendingEnabled: planner.flags?.sendingEnabled === true,
      costMode: planner.flags?.costMode || "free_safe",
    },
    counts: {
      draftBacklog: planner.state?.draftBacklog || 0,
      leadCounts: planner.state?.leadCounts || {},
      draftCounts: planner.state?.draftCounts || {},
      sourceCounts: planner.state?.sourceCounts || {},
    },
    recommendation: {
      recommendedNextAction: planner.decision?.recommendedNextAction || null,
      safeActions: planner.decision?.safeActions || [],
      blockedActions: planner.decision?.blockedActions || [],
      why: planner.decision?.why || [],
      primaryAction,
      actionCards: planner.decision?.actionCards || [],
    },
    latestRecommendation,
    latestExecution,
    recent: {
      sourceRuns: planner.recent?.sourceRuns || [],
      events: planner.recent?.events || [],
    },
  };
}

async function recordExecution(env: Env, actionId: string, route: string, result: any, body: any) {
  const id = uuid();
  await env.DB.prepare(
    `INSERT INTO agent_decisions (id, run_id, decision_type, target_type, target_id, target_url, reason, confidence, evidence_json, created_at_iso)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    null,
    "planner_execute",
    "planner_action",
    actionId,
    route,
    `Planner execute envelope ran ${actionId}.`,
    80,
    JSON.stringify({ result, requestedBy: body?.requestedBy || "admin", notes: body?.notes || null }),
    nowISO()
  ).run();
  return id;
}

async function executePlannerAction(env: Env, actionId: string, body: any) {
  if (actionId === "review_draft_backlog") {
    const rows = await env.DB.prepare(
      "SELECT id, lead_id, subject, status, created_at_iso, updated_at_iso FROM drafts WHERE status IN ('created', 'queued', 'approved') ORDER BY updated_at_iso DESC LIMIT 20"
    ).all<any>();
    return { route: "/admin/drafts?status=created&limit=20", result: { ok: true, mode: "read_only", drafts: rows.results || [] } };
  }

  if (actionId === "inspect_cooldown_sources") {
    const rows = await env.DB.prepare(
      "SELECT id, url, status, failure_count, success_count, cooldown_until_iso, next_run_at_iso, retired_reason, updated_at_iso FROM sources WHERE status = 'cooldown' ORDER BY updated_at_iso DESC LIMIT 20"
    ).all<any>();
    return { route: "/admin/sources?status=cooldown&limit=20", result: { ok: true, mode: "read_only", sources: rows.results || [] } };
  }

  if (actionId === "run_tiny_source_batch") {
    const limit = Math.max(1, Math.min(1, Number(body?.limit || 1)));
    const rows = await env.DB.prepare(
      "SELECT * FROM sources WHERE status = 'active' AND (next_run_at_iso IS NULL OR next_run_at_iso <= ?) ORDER BY COALESCE(next_run_at_iso, created_at_iso), updated_at_iso LIMIT ?"
    ).bind(nowISO(), limit).all<any>();
    const sources = rows.results || [];
    return {
      route: "/admin/sources/run-tiny",
      result: {
        ok: true,
        mode: "planner_execute_preview_only",
        note: "Planner execute envelope selected active due sources only. Use /admin/sources/run-tiny for real fetch execution.",
        selectedSources: sources.map((source: any) => ({ id: source.id, url: source.url, status: source.status, nextRunAt: source.next_run_at_iso })),
      },
    };
  }

  if (actionId === "source_expand_preview") {
    const sourceId = body?.sourceId || body?.id;
    if (!sourceId) return { route: "/admin/sources/:id/expand-preview", result: { ok: false, error: "source_id_required" } };
    const source = await env.DB.prepare("SELECT id, url, status, category, country, region, updated_at_iso FROM sources WHERE id = ? LIMIT 1").bind(String(sourceId)).first<any>();
    return { route: `/admin/sources/${sourceId}/expand-preview`, result: { ok: Boolean(source), mode: "planner_execute_preview_only", source: source || null } };
  }

  return { route: null, result: { ok: false, error: "action_not_allowed", allowed: ["review_draft_backlog", "inspect_cooldown_sources", "run_tiny_source_batch", "source_expand_preview"] } };
}

export async function handlePlannerAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  if (pathname === "/admin/planner" && request.method === "GET") {
    return json(await buildPlannerReport(env));
  }

  if (pathname === "/admin/planner/dashboard" && request.method === "GET") {
    return json(await plannerDashboard(env));
  }

  if (pathname === "/admin/planner/history" && request.method === "GET") {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || 20);
    return json(await plannerHistory(env, limit));
  }

  if (pathname === "/admin/planner/executions" && request.method === "GET") {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || 20);
    return json(await plannerExecutions(env, limit));
  }

  if (pathname === "/admin/planner/execute" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!confirmed(body)) return json({ ok: false, error: "confirm_required" }, { status: 400 });
    const actionId = String(body?.actionId || "");
    const executed = await executePlannerAction(env, actionId, body);
    const auditId = await recordExecution(env, actionId || "unknown", executed.route || "", executed.result, body);
    return json({ ok: true, auditId, actionId, route: executed.route, result: executed.result });
  }

  if (pathname === "/admin/planner/record" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!confirmed(body)) return json({ ok: false, error: "confirm_required" }, { status: 400 });

    const report = await buildPlannerReport(env);
    const id = uuid();
    const recommended = String(report.decision?.recommendedNextAction || "unknown");
    const primaryRoute = String(report.decision?.primaryActionCard?.route || "");
    const reason = `Planner recommended ${recommended}${primaryRoute ? ` via ${primaryRoute}` : ""}.`;

    await env.DB.prepare(
      `INSERT INTO agent_decisions (id, run_id, decision_type, target_type, target_id, target_url, reason, confidence, evidence_json, created_at_iso)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      null,
      "planner_recommendation",
      "planner_action",
      recommended,
      primaryRoute || null,
      reason,
      75,
      JSON.stringify({ report, recordedBy: body?.recordedBy || "admin", notes: body?.notes || null }),
      nowISO()
    ).run();

    return json({ ok: true, id, decisionType: "planner_recommendation", recommendedNextAction: recommended, primaryRoute: primaryRoute || null });
  }

  return json({ ok: false, error: "Not found" }, { status: 404 });
}
