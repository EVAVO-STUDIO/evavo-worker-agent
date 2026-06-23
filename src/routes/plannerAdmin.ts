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

export async function handlePlannerAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  if (pathname === "/admin/planner" && request.method === "GET") {
    return json(await buildPlannerReport(env));
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
