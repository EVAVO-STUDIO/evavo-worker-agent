import { Env, getDraftById, logEvent, nowISO, updateDraft, updateLead, uuid } from "../db";

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

export interface DraftReviewInput {
  draftId: string;
  decision: DraftReviewDecision;
  reason?: string | null;
  notes?: string | null;
  strategyKey?: string | null;
}

function normalizeStrategyKey(value: string | null | undefined): string {
  return String(value || "general_outreach")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "general_outreach";
}

function scoreDeltaForDecision(decision: DraftReviewDecision): number {
  if (decision === "approved" || decision === "good_angle" || decision === "good_fit") return 3;
  if (decision === "needs_rewrite") return -1;
  if (decision === "rejected" || decision === "too_generic" || decision === "wrong_angle" || decision === "bad_fit" || decision === "bad_contact" || decision === "do_not_contact") return -3;
  return 0;
}

function statusForDecision(decision: DraftReviewDecision): "approved" | "rejected" | "created" {
  if (decision === "approved" || decision === "good_angle" || decision === "good_fit") return "approved";
  if (decision === "needs_rewrite") return "created";
  return "rejected";
}

async function insertDraftReview(env: Env, input: DraftReviewInput, leadId: string): Promise<string> {
  const id = uuid();
  await env.DB.prepare(
    `INSERT INTO draft_reviews (id, draft_id, lead_id, decision, reason, notes, created_at_iso)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    input.draftId,
    leadId,
    input.decision,
    input.reason || null,
    input.notes || null,
    nowISO()
  ).run();
  return id;
}

async function updateStrategyScore(env: Env, strategyKeyRaw: string | null | undefined, decision: DraftReviewDecision): Promise<void> {
  const strategyKey = normalizeStrategyKey(strategyKeyRaw);
  const approved = decision === "approved" || decision === "good_angle" || decision === "good_fit" ? 1 : 0;
  const rejected = decision === "rejected" || decision === "too_generic" || decision === "wrong_angle" || decision === "bad_fit" || decision === "bad_contact" || decision === "do_not_contact" ? 1 : 0;
  const rewrite = decision === "needs_rewrite" ? 1 : 0;
  const delta = scoreDeltaForDecision(decision);

  await env.DB.prepare(
    `INSERT INTO strategy_scores (strategy_key, approved_count, rejected_count, rewrite_count, score, updated_at_iso)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(strategy_key) DO UPDATE SET
       approved_count = approved_count + excluded.approved_count,
       rejected_count = rejected_count + excluded.rejected_count,
       rewrite_count = rewrite_count + excluded.rewrite_count,
       score = MAX(0, MIN(100, score + ?)),
       updated_at_iso = excluded.updated_at_iso`
  ).bind(strategyKey, approved, rejected, rewrite, Math.max(0, Math.min(100, 50 + delta)), nowISO(), delta).run();
}

export async function reviewDraft(env: Env, input: DraftReviewInput) {
  const draft = await getDraftById(env, input.draftId);
  if (!draft) return { ok: false, error: "draft_not_found" };

  const nextDraftStatus = statusForDecision(input.decision);
  await insertDraftReview(env, input, draft.lead_id);
  await updateStrategyScore(env, input.strategyKey || draft.mode || "general_outreach", input.decision);
  await updateDraft(env, draft.id, { status: nextDraftStatus });

  if (nextDraftStatus === "approved") {
    await updateLead(env, draft.lead_id, { status: "approved" });
  } else if (input.decision === "do_not_contact") {
    await updateLead(env, draft.lead_id, { status: "do_not_contact" });
  } else if (nextDraftStatus === "rejected") {
    await updateLead(env, draft.lead_id, { status: "rejected" });
  }

  await logEvent(env, "draft_review", `Draft ${input.draftId} reviewed as ${input.decision}`, draft.lead_id);

  return {
    ok: true,
    draftId: draft.id,
    leadId: draft.lead_id,
    decision: input.decision,
    draftStatus: nextDraftStatus,
    strategyKey: normalizeStrategyKey(input.strategyKey || draft.mode || "general_outreach"),
  };
}

export async function listStrategyScores(env: Env, limit = 50) {
  const safeLimit = Math.max(1, Math.min(200, limit));
  const { results } = (await env.DB.prepare(
    `SELECT strategy_key, approved_count, rejected_count, rewrite_count, score, updated_at_iso
     FROM strategy_scores
     ORDER BY score DESC, approved_count DESC, updated_at_iso DESC
     LIMIT ?`
  ).bind(safeLimit).all()) as { results?: any[] };
  return results || [];
}
