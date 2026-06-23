import { Env, getAdminToken } from "../db";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

async function tableExists(env: Env, tableName: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1").bind(tableName).first<any>();
  return Boolean(row?.name);
}

async function learningSummary(env: Env, requestUrl: URL) {
  const hasReviews = await tableExists(env, "opportunity_reviews");
  const hasScores = await tableExists(env, "opportunity_strategy_scores");
  if (!hasReviews || !hasScores) {
    return {
      ok: false,
      mode: "opportunity_learning_summary",
      error: "missing_migration",
      requiredMigration: "0005_opportunity_review_learning.sql",
      tables: { opportunity_reviews: hasReviews, opportunity_strategy_scores: hasScores },
      safety: { readOnly: true, callsAI: false, sendsEmail: false, writes: false },
    };
  }

  const limit = Math.max(1, Math.min(100, Number(requestUrl.searchParams.get("limit") || 25)));
  const reviews = await env.DB.prepare(
    `SELECT r.id, r.opportunity_id, r.decision, r.reason, r.reviewer, r.value_rating, r.fit_rating, r.effort_rating, r.urgency_rating, r.notes, r.created_at_iso,
            o.title, o.opportunity_type, o.status, o.url
     FROM opportunity_reviews r
     LEFT JOIN opportunities o ON o.id = r.opportunity_id
     ORDER BY r.created_at_iso DESC
     LIMIT ?`
  ).bind(limit).all<any>();

  const scores = await env.DB.prepare(
    `SELECT id, opportunity_type, category, country, region, positive_count, negative_count, watch_count, shortlist_count,
            average_value_rating, average_fit_rating, average_effort_rating, average_urgency_rating, score, last_decision, updated_at_iso
     FROM opportunity_strategy_scores
     ORDER BY score DESC, updated_at_iso DESC
     LIMIT ?`
  ).bind(limit).all<any>();

  const decisionCounts = await env.DB.prepare(
    `SELECT decision, COUNT(*) AS count
     FROM opportunity_reviews
     GROUP BY decision
     ORDER BY count DESC`
  ).all<any>();

  return {
    ok: true,
    mode: "opportunity_learning_summary",
    learning: { enabled: true, maxFutureScoreAdjustment: 12, scoringBaseline: 50 },
    decisionCounts: decisionCounts.results || [],
    recentReviews: reviews.results || [],
    strategyScores: scores.results || [],
    safety: { readOnly: true, callsAI: false, sendsEmail: false, writes: false },
  };
}

export async function handleOpportunityLearningAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
  if (pathname !== "/admin/opportunities/learning") return json({ ok: false, error: "Not found" }, { status: 404 });
  return json(await learningSummary(env, new URL(request.url)));
}
