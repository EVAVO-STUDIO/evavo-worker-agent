import { Env, nowISO, uuid } from "../db";
import { REVIEW_MUTATION_CONTRACT } from "./reviewMutationSafety";

export type OpportunityReviewDecision =
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

export const OPPORTUNITY_REVIEW_DECISIONS: readonly OpportunityReviewDecision[] = Object.freeze([
  "shortlist",
  "watch",
  "apply_later",
  "needs_research",
  "bad_fit",
  "not_eligible",
  "too_low_value",
  "too_much_effort",
  "duplicate",
  "archive",
]);

export type OpportunityReviewContext = {
  id: string;
  title: string | null;
  opportunity_type: string | null;
  category: string | null;
  country: string | null;
  region: string | null;
  status: string | null;
};

export type OpportunityReviewRatings = {
  value_rating: number | null;
  fit_rating: number | null;
  effort_rating: number | null;
  urgency_rating: number | null;
};

export type OpportunityReviewInput = {
  decision: OpportunityReviewDecision;
  reason: string | null;
  reviewer: string | null;
  notes: string | null;
  ratings: OpportunityReviewRatings;
  requestBodySha256: string;
};

const POSITIVE_DECISIONS = new Set<OpportunityReviewDecision>(["shortlist", "apply_later"]);
const WATCH_DECISIONS = new Set<OpportunityReviewDecision>(["watch", "needs_research"]);
const NEGATIVE_DECISIONS = new Set<OpportunityReviewDecision>([
  "bad_fit",
  "not_eligible",
  "too_low_value",
  "too_much_effort",
  "duplicate",
  "archive",
]);

async function tableExists(env: Env, tableName: string): Promise<boolean> {
  const row = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
  ).bind(tableName).first<{ name?: string }>();
  return Boolean(row?.name);
}

export async function getOpportunityReviewContext(
  env: Env,
  id: string,
): Promise<OpportunityReviewContext | null> {
  if (!(await tableExists(env, "opportunities"))) return null;
  return await env.DB.prepare(
    `SELECT id, title, opportunity_type, category, country, region, status
     FROM opportunities
     WHERE id = ?
     LIMIT 1`,
  ).bind(id).first<OpportunityReviewContext>();
}

export function opportunityStrategyScope(opportunity: OpportunityReviewContext): readonly unknown[] {
  return [
    opportunity.opportunity_type || "unknown",
    opportunity.category,
    opportunity.country,
    opportunity.region,
  ];
}

function statusForDecision(decision: OpportunityReviewDecision): string {
  if (decision === "shortlist") return "shortlisted";
  if (decision === "watch") return "watching";
  if (decision === "apply_later") return "apply_later";
  if (decision === "needs_research") return "needs_research";
  if (decision === "duplicate") return "duplicate";
  if (decision === "archive") return "archived";
  return "rejected";
}

function scoreDelta(decision: OpportunityReviewDecision): number {
  if (POSITIVE_DECISIONS.has(decision)) return 8;
  if (WATCH_DECISIONS.has(decision)) return 2;
  if (NEGATIVE_DECISIONS.has(decision)) return -7;
  return 0;
}

function updatedAverage(oldAverage: number, outcomeCount: number, value: number | null): number {
  if (value === null) return oldAverage;
  return Number((((oldAverage * outcomeCount) + value) / (outcomeCount + 1)).toFixed(2));
}

export async function applyOpportunityReview(
  env: Env,
  opportunity: OpportunityReviewContext,
  input: OpportunityReviewInput,
) {
  if (!OPPORTUNITY_REVIEW_DECISIONS.includes(input.decision)) {
    return { ok: false, error: "invalid_decision", allowedDecisions: OPPORTUNITY_REVIEW_DECISIONS };
  }

  const [hasReviewTable, hasStrategyTable] = await Promise.all([
    tableExists(env, "opportunity_reviews"),
    tableExists(env, "opportunity_strategy_scores"),
  ]);
  if (!hasReviewTable || !hasStrategyTable) {
    return {
      ok: false,
      error: "missing_migration",
      requiredMigration: "0005_opportunity_review_learning.sql",
      missing: [
        !hasReviewTable ? "opportunity_reviews" : null,
        !hasStrategyTable ? "opportunity_strategy_scores" : null,
      ].filter(Boolean),
    };
  }

  const strategyScope = opportunityStrategyScope(opportunity);
  const existing = await env.DB.prepare(
    `SELECT id, positive_count, negative_count, watch_count, shortlist_count,
            average_value_rating, average_fit_rating, average_effort_rating,
            average_urgency_rating, score
     FROM opportunity_strategy_scores
     WHERE opportunity_type = ?
       AND COALESCE(category, '') = COALESCE(?, '')
       AND COALESCE(country, '') = COALESCE(?, '')
       AND COALESCE(region, '') = COALESCE(?, '')
     LIMIT 1`,
  ).bind(...strategyScope).first<any>();

  const positiveIncrement = POSITIVE_DECISIONS.has(input.decision) ? 1 : 0;
  const negativeIncrement = NEGATIVE_DECISIONS.has(input.decision) ? 1 : 0;
  const watchIncrement = WATCH_DECISIONS.has(input.decision) ? 1 : 0;
  const shortlistIncrement = input.decision === "shortlist" ? 1 : 0;
  const outcomeCount = Number(existing?.positive_count || 0)
    + Number(existing?.negative_count || 0)
    + Number(existing?.watch_count || 0);
  const nextScore = Math.max(0, Math.min(100, Number(existing?.score ?? 50) + scoreDelta(input.decision)));
  const now = nowISO();
  const reviewId = uuid();
  const nextStatus = statusForDecision(input.decision);

  const strategyStatement = existing?.id
    ? env.DB.prepare(
      `UPDATE opportunity_strategy_scores
       SET positive_count = positive_count + ?,
           negative_count = negative_count + ?,
           watch_count = watch_count + ?,
           shortlist_count = shortlist_count + ?,
           average_value_rating = ?,
           average_fit_rating = ?,
           average_effort_rating = ?,
           average_urgency_rating = ?,
           score = ?,
           last_decision = ?,
           updated_at_iso = ?
       WHERE id = ?`,
    ).bind(
      positiveIncrement,
      negativeIncrement,
      watchIncrement,
      shortlistIncrement,
      updatedAverage(Number(existing.average_value_rating || 0), outcomeCount, input.ratings.value_rating),
      updatedAverage(Number(existing.average_fit_rating || 0), outcomeCount, input.ratings.fit_rating),
      updatedAverage(Number(existing.average_effort_rating || 0), outcomeCount, input.ratings.effort_rating),
      updatedAverage(Number(existing.average_urgency_rating || 0), outcomeCount, input.ratings.urgency_rating),
      nextScore,
      input.decision,
      now,
      existing.id,
    )
    : env.DB.prepare(
      `INSERT INTO opportunity_strategy_scores (
         id, opportunity_type, category, country, region,
         positive_count, negative_count, watch_count, shortlist_count,
         average_value_rating, average_fit_rating, average_effort_rating,
         average_urgency_rating, score, last_decision, updated_at_iso
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      uuid(),
      ...strategyScope,
      positiveIncrement,
      negativeIncrement,
      watchIncrement,
      shortlistIncrement,
      input.ratings.value_rating || 0,
      input.ratings.fit_rating || 0,
      input.ratings.effort_rating || 0,
      input.ratings.urgency_rating || 0,
      nextScore,
      input.decision,
      now,
    );

  const auditMessage = JSON.stringify({
    contract: REVIEW_MUTATION_CONTRACT,
    reviewId,
    opportunityId: opportunity.id,
    decision: input.decision,
    nextStatus,
    requestBodySha256: input.requestBodySha256,
    reviewOnly: true,
    executable: false,
    deliverable: false,
    authoritativeForExecution: false,
    externalExecutionAllowed: false,
  });

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO opportunity_reviews (
         id, opportunity_id, decision, reason, reviewer,
         value_rating, fit_rating, effort_rating, urgency_rating, notes, created_at_iso
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      reviewId,
      opportunity.id,
      input.decision,
      input.reason,
      input.reviewer || "operator",
      input.ratings.value_rating,
      input.ratings.fit_rating,
      input.ratings.effort_rating,
      input.ratings.urgency_rating,
      input.notes,
      now,
    ),
    env.DB.prepare(
      "UPDATE opportunities SET status = ?, notes = COALESCE(?, notes), updated_at_iso = ? WHERE id = ?",
    ).bind(nextStatus, input.notes, now, opportunity.id),
    strategyStatement,
    env.DB.prepare(
      `INSERT INTO events (id, type, message, lead_id, created_at_iso)
       VALUES (?, 'opportunity_review', ?, NULL, ?)`,
    ).bind(uuid(), auditMessage, now),
  ]);

  return {
    ok: true,
    mode: "opportunity_review",
    contract: REVIEW_MUTATION_CONTRACT,
    reviewId,
    opportunityId: opportunity.id,
    decision: input.decision,
    nextStatus,
    ratings: input.ratings,
    reviewOnly: true,
    executable: false,
    deliverable: false,
    authoritativeForExecution: false,
    externalExecutionAllowed: false,
    safety: {
      reviewStatusScoreAndAuditAtomic: true,
      callsNetwork: false,
      callsAI: false,
      sendsEmail: false,
      postsExternally: false,
      autoApplies: false,
    },
  };
}

export async function listOpportunityReviews(env: Env, limit: number) {
  if (!(await tableExists(env, "opportunity_reviews"))) {
    return { ok: false, error: "missing_migration", requiredMigration: "0005_opportunity_review_learning.sql" };
  }
  const safeLimit = Math.max(1, Math.min(100, Math.round(limit)));
  const rows = await env.DB.prepare(
    `SELECT r.id, r.opportunity_id, r.decision, r.reason, r.reviewer,
            r.value_rating, r.fit_rating, r.effort_rating, r.urgency_rating,
            r.notes, r.created_at_iso, o.title, o.opportunity_type, o.status
     FROM opportunity_reviews r
     LEFT JOIN opportunities o ON o.id = r.opportunity_id
     ORDER BY r.created_at_iso DESC
     LIMIT ?`,
  ).bind(safeLimit).all<any>();
  return { ok: true, mode: "opportunity_reviews", count: rows.results?.length || 0, reviews: rows.results || [], readOnly: true };
}

export async function listOpportunityStrategyScores(env: Env, limit: number) {
  if (!(await tableExists(env, "opportunity_strategy_scores"))) {
    return { ok: false, error: "missing_migration", requiredMigration: "0005_opportunity_review_learning.sql" };
  }
  const safeLimit = Math.max(1, Math.min(100, Math.round(limit)));
  const rows = await env.DB.prepare(
    `SELECT id, opportunity_type, category, country, region,
            positive_count, negative_count, watch_count, shortlist_count,
            average_value_rating, average_fit_rating, average_effort_rating,
            average_urgency_rating, score, last_decision, updated_at_iso
     FROM opportunity_strategy_scores
     ORDER BY score DESC, updated_at_iso DESC
     LIMIT ?`,
  ).bind(safeLimit).all<any>();
  return { ok: true, mode: "opportunity_strategy_scores", count: rows.results?.length || 0, scores: rows.results || [], readOnly: true };
}
