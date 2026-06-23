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

async function plannerHistory(env: Env, limit: number) {
  const rows = await env.DB.prepare(
    `SELECT id, target_id, target_url, reason, confidence, evidence_json, created_at_iso
     FROM agent_decisions
     WHERE decision_type = 'planner_recommendation'
     ORDER BY created_at_iso DESC
     LIMIT ?`
  ).bind(Math.max(1, Math.min(100, limit))).all<any>();

  const history = (rows.results || []).map((row: any) => {
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
      flags: report.flags || null,
      state: report.state
        ? {
            healthStatus: report.state.healthStatus,
            healthIssues: report.state.healthIssues,
            draftBacklog: report.state.draftBacklog,
            sourceCounts: report.state.sourceCounts,
            draftCounts: report.state.draftCounts,
          }
        : null,
      safeActions: report.decision?.safeActions || [],
      blockedActions: report.decision?.blockedActions || [],
    };
  });

  return { ok: true, mode: "planner_history", count: history.length, history };
}

export async function handlePlannerAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  if (pathname === "/admin/planner" && request.method === "GET") {
    return json(await buildPlannerReport(env));
  }

  if (pathname === "/admin/planner/history" && request.method === "GET") {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || 20);
    return json(await plannerHistory(env, limit));
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
