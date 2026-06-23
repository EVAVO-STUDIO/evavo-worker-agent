import { Env, getAdminToken } from "../db";
import { opportunityRadarProfileSummary, scoreOpportunityRadar } from "../core/opportunityIntelligence";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

export async function handleOpportunityRadarAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  if (pathname === "/admin/opportunity-radar/profiles" && request.method === "GET") {
    return json({
      ok: true,
      mode: "opportunity_radar_profiles",
      profiles: opportunityRadarProfileSummary(),
      safety: { callsAI: false, writesToDatabase: false, networkFetch: false },
    });
  }

  if (pathname === "/admin/opportunity-radar/score-preview" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const score = scoreOpportunityRadar({
      url: body?.url,
      title: body?.title,
      text: body?.text || body?.description,
      sourceType: body?.sourceType || body?.source_type,
      country: body?.country,
      region: body?.region,
      category: body?.category,
    });
    return json({
      ok: true,
      mode: "opportunity_score_preview",
      score,
    });
  }

  return json({ ok: false, error: "Not found" }, { status: 404 });
}
