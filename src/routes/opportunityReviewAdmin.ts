import { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

type ReviewDecision =
  | "shortlist"
  | "watch"
  | "apply_later"
  | "needs_research"
  | "bad_fit"
  | "not_eligible"
  | "too_low_value"
  | "too_much_effort"
  | "duplicate"
  | "archive";

const POSITIVE_DECISIONS = new Set<ReviewDecision>(["shortlist", "apply_later"]);
const WATCH_DECISIONS = new Set<ReviewDecision>(["watch", "needs_research"]);
const NEGATIVE_DECISIONS = new Set<ReviewDecision>(["bad_fit", "not_eligible", "too_low_value", "too_much_effort", "duplicate", "archive"]);

function confirmed(body: any): boolean {
  return body?.confirm === true || body?.confirm === 1 || body?.confirm === "1";
}

function uuid() {
  return crypto.randomUUID();
}

function nowISO() {
  return new Date().toISOString();
}

function clampRating(value: any): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(5, Math.round(n)));
}

async function tableExists(env: Env, tableName: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1").bind(tableName).first<any>();
  return Boolean(row?.name);
}

async function getOpportunity(env: Env, id: string) {
  if (!(await tableExists(env, "opportunities"))) return null;
  return await env.DB.prepare("SELECT * FROM opportunities WHERE id = ? LIMIT 1").bind(id).first<any>();
}

function statusForDecision(decision: ReviewDecision): string {
  if (decision === "shortlist") return "shortlisted";
  if (decision === "watch") return "watching";
  if (decision === "apply_later") return "apply_later";
  if (decision === "needs_research") return "needs_research";
  if (decision === "duplicate") return "duplicate";
  if (decision === "archive") return "archived";
  return "rejected";
}

function scoreDelta(decision: ReviewDecision): number {
  if (POSITIVE_DECISIONS.has(decision)) return 8;
  if (WATCH_DECISIONS.has(decision)) return 2;
  if (NEGATIVE_DECISIONS.has(decision)) return -7;
  return 0;
}

async function updateStrategyScore(env: Env, opportunity: any, decision: ReviewDecision, ratings: Record<string, number | null>) {
  if (!(await tableExists(env, "opportunity_strategy_scores"))) return;
  const key = {
    opportunity_type: opportunity.opportunity_type || "unknown",
    category: opportunity.category || null,
    country: opportunity.country || null,
    region: opportunity.region || null,
  };
  const existing = await env.DB.prepare(
    `SELECT * FROM opportunity_strategy_scores
     WHERE opportunity_type = ? AND COALESCE(category, '') = COALESCE(?, '') AND COALESCE(country, '') = COALESCE(?, '') AND COALESCE(region, '') = COALESCE(?, '')
     LIMIT 1`
  ).bind(key.opportunity_type, key.category, key.country, key.region).first<any>();

  const positiveInc = POSITIVE_DECISIONS.has(decision) ? 1 : 0;
  const negativeInc = NEGATIVE_DECISIONS.has(decision) ? 1 : 0;
  const watchInc = WATCH_DECISIONS.has(decision) ? 1 : 0;
  const shortlistInc = decision === "shortlist" ? 1 : 0;
  const nextScore = Math.max(0, Math.min(100, Number(existing?.score ?? 50) + scoreDelta(decision)));
  const now = nowISO();

  function avg(oldAvg: number, count: number, value: number | null): number {
    if (!value) return oldAvg;
    return Number((((oldAvg * count) + value) / (count + 1)).toFixed(2));
  }

  const ratingCount = Number(existing?.positive_count || 0) + Number(existing?.negative_count || 0) + Number(existing?.watch_count || 0);
  const nextValueAvg = avg(Number(existing?.average_value_rating || 0), ratingCount, ratings.value_rating);
  const nextFitAvg = avg(Number(existing?.average_fit_rating || 0), ratingCount, ratings.fit_rating);
  const nextEffortAvg = avg(Number(existing?.average_effort_rating || 0), ratingCount, ratings.effort_rating);
  const nextUrgencyAvg = avg(Number(existing?.average_urgency_rating || 0), ratingCount, ratings.urgency_rating);

  if (existing?.id) {
    await env.DB.prepare(
      `UPDATE opportunity_strategy_scores
       SET positive_count = positive_count + ?, negative_count = negative_count + ?, watch_count = watch_count + ?, shortlist_count = shortlist_count + ?,
           average_value_rating = ?, average_fit_rating = ?, average_effort_rating = ?, average_urgency_rating = ?, score = ?, last_decision = ?, updated_at_iso = ?
       WHERE id = ?`
    ).bind(positiveInc, negativeInc, watchInc, shortlistInc, nextValueAvg, nextFitAvg, nextEffortAvg, nextUrgencyAvg, nextScore, decision, now, existing.id).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO opportunity_strategy_scores (
        id, opportunity_type, category, country, region, positive_count, negative_count, watch_count, shortlist_count,
        average_value_rating, average_fit_rating, average_effort_rating, average_urgency_rating, score, last_decision, updated_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      uuid(),
      key.opportunity_type,
      key.category,
      key.country,
      key.region,
      positiveInc,
      negativeInc,
      watchInc,
      shortlistInc,
      ratings.value_rating || 0,
      ratings.fit_rating || 0,
      ratings.effort_rating || 0,
      ratings.urgency_rating || 0,
      nextScore,
      decision,
      now
    ).run();
  }
}

async function reviewOpportunity(env: Env, id: string, body: any) {
  const hasReviewTable = await tableExists(env, "opportunity_reviews");
  if (!hasReviewTable) return { ok: false, error: "missing_migration", requiredMigration: "0005_opportunity_review_learning.sql" };

  const opportunity = await getOpportunity(env, id);
  if (!opportunity) return { ok: false, error: "opportunity_not_found_or_missing_migration" };

  const decision = String(body?.decision || "").trim() as ReviewDecision;
  const allowed: ReviewDecision[] = ["shortlist", "watch", "apply_later", "needs_research", "bad_fit", "not_eligible", "too_low_value", "too_much_effort", "duplicate", "archive"];
  if (!allowed.includes(decision)) return { ok: false, error: "invalid_decision", allowed };

  const ratings = {
    value_rating: clampRating(body?.valueRating ?? body?.value_rating),
    fit_rating: clampRating(body?.fitRating ?? body?.fit_rating),
    effort_rating: clampRating(body?.effortRating ?? body?.effort_rating),
    urgency_rating: clampRating(body?.urgencyRating ?? body?.urgency_rating),
  };
  const now = nowISO();
  const reviewId = uuid();

  await env.DB.prepare(
    `INSERT INTO opportunity_reviews (id, opportunity_id, decision, reason, reviewer, value_rating, fit_rating, effort_rating, urgency_rating, notes, created_at_iso)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    reviewId,
    id,
    decision,
    body?.reason || null,
    body?.reviewer || "operator",
    ratings.value_rating,
    ratings.fit_rating,
    ratings.effort_rating,
    ratings.urgency_rating,
    body?.notes || null,
    now
  ).run();

  const nextStatus = statusForDecision(decision);
  await env.DB.prepare("UPDATE opportunities SET status = ?, notes = COALESCE(?, notes), updated_at_iso = ? WHERE id = ?").bind(nextStatus, body?.notes || null, now, id).run();
  await updateStrategyScore(env, opportunity, decision, ratings);

  return {
    ok: true,
    mode: "opportunity_review",
    reviewId,
    opportunityId: id,
    decision,
    nextStatus,
    ratings,
    safety: { callsAI: false, sendsEmail: false, postsSocial: false, autoApplies: false },
  };
}

async function listReviews(env: Env, url: URL) {
  if (!(await tableExists(env, "opportunity_reviews"))) return { ok: false, error: "missing_migration", requiredMigration: "0005_opportunity_review_learning.sql" };
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 50)));
  const rows = await env.DB.prepare(
    `SELECT r.id, r.opportunity_id, r.decision, r.reason, r.reviewer, r.value_rating, r.fit_rating, r.effort_rating, r.urgency_rating, r.notes, r.created_at_iso,
            o.title, o.opportunity_type, o.url, o.status
     FROM opportunity_reviews r
     LEFT JOIN opportunities o ON o.id = r.opportunity_id
     ORDER BY r.created_at_iso DESC
     LIMIT ?`
  ).bind(limit).all<any>();
  return { ok: true, mode: "opportunity_reviews", count: rows.results?.length || 0, reviews: rows.results || [] };
}

async function listStrategyScores(env: Env, url: URL) {
  if (!(await tableExists(env, "opportunity_strategy_scores"))) return { ok: false, error: "missing_migration", requiredMigration: "0005_opportunity_review_learning.sql" };
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 50)));
  const rows = await env.DB.prepare(
    `SELECT * FROM opportunity_strategy_scores ORDER BY score DESC, updated_at_iso DESC LIMIT ?`
  ).bind(limit).all<any>();
  return { ok: true, mode: "opportunity_strategy_scores", count: rows.results?.length || 0, scores: rows.results || [] };
}

export async function handleOpportunityReviewAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET, POST" } });
  }
  const url = new URL(request.url);

  if (pathname === "/admin/opportunities/reviews" && request.method === "GET") return json(await listReviews(env, url));
  if (pathname === "/admin/opportunities/strategy-scores" && request.method === "GET") return json(await listStrategyScores(env, url));

  const prefix = "/admin/opportunities/";
  if (pathname.startsWith(prefix) && pathname.endsWith("/review") && request.method === "POST") {
    const id = decodeURIComponent(pathname.slice(prefix.length).replace(/\/review$/, ""));
    const body = await request.json().catch(() => ({}));
    if (!confirmed(body)) {
      return json({
        ok: false,
        error: "confirm_required",
        reason: "Opportunity review-state and strategy-score changes require explicit confirmation and never trigger external execution.",
      }, { status: 400 });
    }
    return json(await reviewOpportunity(env, id, body));
  }

  return json({ ok: false, error: "Not found" }, { status: 404 });
}
