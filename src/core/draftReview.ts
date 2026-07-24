import { Env, type DraftRow, getDraftById, nowISO, uuid } from "../db";
import { REVIEW_MUTATION_CONTRACT, boundedReviewText } from "./reviewMutationSafety";

export type DraftReviewDecision =
  | "approved"
  | "rejected"
  | "needs_rewrite"
  | "too_generic"
  | "wrong_angle"
  | "bad_fit"
  | "bad_contact"
  | "good_angle"
  | "good_fit"
  | "do_not_contact";

export const DRAFT_REVIEW_DECISIONS: readonly DraftReviewDecision[] = Object.freeze([
  "approved",
  "rejected",
  "needs_rewrite",
  "too_generic",
  "wrong_angle",
  "bad_fit",
  "bad_contact",
  "good_angle",
  "good_fit",
  "do_not_contact",
]);

export interface DraftReviewInput {
  draftId: string;
  decision: DraftReviewDecision;
  reason?: string | null;
  notes?: string | null;
  strategyKey?: string | null;
}

export function normalizeDraftStrategyKey(value: string | null | undefined): string {
  return String(value || "general_outreach")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 160) || "general_outreach";
}

function scoreDeltaForDecision(decision: DraftReviewDecision): number {
  if (decision === "approved" || decision === "good_angle" || decision === "good_fit") return 3;
  if (decision === "needs_rewrite") return -1;
  return -3;
}

function statusForDecision(decision: DraftReviewDecision): "approved" | "rejected" | "created" {
  if (decision === "approved" || decision === "good_angle" || decision === "good_fit") return "approved";
  if (decision === "needs_rewrite") return "created";
  return "rejected";
}

async function tableExists(env: Env, tableName: string): Promise<boolean> {
  const row = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
  ).bind(tableName).first<{ name?: string }>();
  return Boolean(row?.name);
}

export async function reviewDraft(
  env: Env,
  input: DraftReviewInput,
  suppliedDraft?: DraftRow | null,
) {
  if (!DRAFT_REVIEW_DECISIONS.includes(input.decision)) {
    return { ok: false, error: "unsupported_review_decision", allowedDecisions: DRAFT_REVIEW_DECISIONS };
  }

  const [hasReviewTable, hasStrategyTable] = await Promise.all([
    tableExists(env, "draft_reviews"),
    tableExists(env, "strategy_scores"),
  ]);
  if (!hasReviewTable || !hasStrategyTable) {
    return {
      ok: false,
      error: "missing_migration",
      requiredMigration: "0002_draft_review_learning.sql",
      missing: [
        !hasReviewTable ? "draft_reviews" : null,
        !hasStrategyTable ? "strategy_scores" : null,
      ].filter(Boolean),
    };
  }

  const draft = suppliedDraft || await getDraftById(env, input.draftId);
  if (!draft) return { ok: false, error: "draft_not_found" };

  const reason = boundedReviewText(input.reason, "reason", 500);
  if (!reason.ok) return { ok: false, ...reason };
  const notes = boundedReviewText(input.notes, "notes", 4_000, { preserveLineBreaks: true });
  if (!notes.ok) return { ok: false, ...notes };
  const strategyInput = boundedReviewText(input.strategyKey, "strategyKey", 160);
  if (!strategyInput.ok) return { ok: false, ...strategyInput };

  const now = nowISO();
  const reviewId = uuid();
  const strategyKey = normalizeDraftStrategyKey(strategyInput.value || draft.mode || "general_outreach");
  const nextDraftStatus = statusForDecision(input.decision);
  const approved = nextDraftStatus === "approved" ? 1 : 0;
  const rejected = nextDraftStatus === "rejected" ? 1 : 0;
  const rewrite = input.decision === "needs_rewrite" ? 1 : 0;
  const delta = scoreDeltaForDecision(input.decision);

  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO draft_reviews (id, draft_id, lead_id, decision, reason, notes, created_at_iso)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(reviewId, draft.id, draft.lead_id, input.decision, reason.value, notes.value, now),
    env.DB.prepare(
      `INSERT INTO strategy_scores (strategy_key, approved_count, rejected_count, rewrite_count, score, updated_at_iso)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(strategy_key) DO UPDATE SET
         approved_count = strategy_scores.approved_count + excluded.approved_count,
         rejected_count = strategy_scores.rejected_count + excluded.rejected_count,
         rewrite_count = strategy_scores.rewrite_count + excluded.rewrite_count,
         score = MAX(0, MIN(100, strategy_scores.score + ?)),
         updated_at_iso = excluded.updated_at_iso`,
    ).bind(strategyKey, approved, rejected, rewrite, Math.max(0, Math.min(100, 50 + delta)), now, delta),
    env.DB.prepare("UPDATE drafts SET status = ?, updated_at_iso = ? WHERE id = ?")
      .bind(nextDraftStatus, now, draft.id),
  ];

  const nextLeadStatus = nextDraftStatus === "approved"
    ? "approved"
    : input.decision === "do_not_contact"
      ? "do_not_contact"
      : nextDraftStatus === "rejected"
        ? "rejected"
        : null;
  if (nextLeadStatus) {
    statements.push(
      env.DB.prepare("UPDATE leads SET status = ?, updated_at_iso = ? WHERE id = ?")
        .bind(nextLeadStatus, now, draft.lead_id),
    );
  }

  statements.push(
    env.DB.prepare(
      `INSERT INTO events (id, type, message, lead_id, created_at_iso)
       VALUES (?, 'draft_review', ?, ?, ?)`,
    ).bind(
      uuid(),
      JSON.stringify({
        contract: REVIEW_MUTATION_CONTRACT,
        reviewId,
        draftId: draft.id,
        decision: input.decision,
        draftStatus: nextDraftStatus,
        strategyKey,
        reviewOnly: true,
        executable: false,
        externalExecutionAllowed: false,
      }),
      draft.lead_id,
      now,
    ),
  );

  await env.DB.batch(statements);

  return {
    ok: true,
    mode: "draft_review",
    contract: REVIEW_MUTATION_CONTRACT,
    reviewId,
    draftId: draft.id,
    leadId: draft.lead_id,
    decision: input.decision,
    draftStatus: nextDraftStatus,
    strategyKey,
    reviewOnly: true,
    executable: false,
    deliverable: false,
    authoritativeForExternalExecution: false,
    externalExecutionAllowed: false,
    safety: {
      mutationAndAuditAtomic: true,
      callsNetwork: false,
      callsAI: false,
      sendsEmail: false,
      postsExternally: false,
    },
  };
}

export async function listStrategyScores(env: Env, limit = 50) {
  const safeLimit = Math.max(1, Math.min(200, limit));
  const { results } = (await env.DB.prepare(
    `SELECT strategy_key, approved_count, rejected_count, rewrite_count, score, updated_at_iso
     FROM strategy_scores
     ORDER BY score DESC, approved_count DESC, updated_at_iso DESC
     LIMIT ?`,
  ).bind(safeLimit).all()) as { results?: any[] };
  return results || [];
}
