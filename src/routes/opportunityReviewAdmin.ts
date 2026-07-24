import { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import {
  boundedJsonFailurePayload,
  isExplicitJsonConfirmation,
  readBoundedJsonObject,
} from "../core/boundedJsonRequest";
import {
  acquireManualResearchLease,
  manualResearchLeaseConflict,
  releaseManualResearchLease,
  type ManualResearchLease,
} from "../core/manualResearchLease";
import {
  OPPORTUNITY_REVIEW_DECISIONS,
  applyOpportunityReview,
  getOpportunityReviewContext,
  listOpportunityReviews,
  listOpportunityStrategyScores,
  opportunityStrategyScope,
  type OpportunityReviewDecision,
  type OpportunityReviewRatings,
} from "../core/opportunityReview";
import {
  REVIEW_MUTATION_CONTRACT,
  boundedReviewRating,
  boundedReviewText,
  reviewLeaseKey,
  validReviewRecordId,
} from "../core/reviewMutationSafety";

type JsonResponse = (data: any, init?: ResponseInit) => Response;
type OpportunityReviewBody = Record<string, unknown> & {
  confirm?: unknown;
  decision?: unknown;
  reason?: unknown;
  reviewer?: unknown;
  notes?: unknown;
  valueRating?: unknown;
  value_rating?: unknown;
  fitRating?: unknown;
  fit_rating?: unknown;
  effortRating?: unknown;
  effort_rating?: unknown;
  urgencyRating?: unknown;
  urgency_rating?: unknown;
};

type RatingField = keyof Pick<
  OpportunityReviewBody,
  | "valueRating"
  | "value_rating"
  | "fitRating"
  | "fit_rating"
  | "effortRating"
  | "effort_rating"
  | "urgencyRating"
  | "urgency_rating"
>;

function boundedLimit(url: URL): number {
  const parsed = Number(url.searchParams.get("limit") || 50);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(100, Math.round(parsed))) : 50;
}

function readRating(
  body: OpportunityReviewBody,
  currentField: RatingField,
  legacyField: RatingField,
): ReturnType<typeof boundedReviewRating> | { ok: false; error: "ambiguous_rating_fields"; fields: RatingField[] } {
  const currentPresent = Object.prototype.hasOwnProperty.call(body, currentField);
  const legacyPresent = Object.prototype.hasOwnProperty.call(body, legacyField);
  if (currentPresent && legacyPresent) {
    return { ok: false, error: "ambiguous_rating_fields", fields: [currentField, legacyField] };
  }
  return boundedReviewRating(
    currentPresent ? body[currentField] : legacyPresent ? body[legacyField] : undefined,
    currentField,
  );
}

function resultStatus(result: any): number | undefined {
  if (result?.ok) return undefined;
  if (result?.error === "missing_migration") return 503;
  if (result?.error === "opportunity_not_found") return 404;
  return 400;
}

export async function handleOpportunityReviewAdmin(
  request: Request,
  env: Env,
  pathname: string,
  json: JsonResponse,
): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET, POST" } });
  }

  const url = new URL(request.url);
  if (pathname === "/admin/opportunities/reviews") {
    if (request.method !== "GET") {
      return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET" } });
    }
    const result = await listOpportunityReviews(env, boundedLimit(url));
    return json(result, result.ok ? undefined : { status: 503 });
  }
  if (pathname === "/admin/opportunities/strategy-scores") {
    if (request.method !== "GET") {
      return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET" } });
    }
    const result = await listOpportunityStrategyScores(env, boundedLimit(url));
    return json(result, result.ok ? undefined : { status: 503 });
  }

  const prefix = "/admin/opportunities/";
  if (!pathname.startsWith(prefix) || !pathname.endsWith("/review")) {
    return json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } });
  }

  const opportunityId = decodeURIComponent(pathname.slice(prefix.length).replace(/\/review$/, ""));
  if (!validReviewRecordId(opportunityId)) {
    return json({ ok: false, error: "invalid_opportunity_id" }, { status: 404 });
  }

  const parsed = await readBoundedJsonObject<OpportunityReviewBody>(request, {
    maxBytes: 12_288,
    maxDepth: 4,
    maxNodes: 48,
    maxArrayLength: 4,
    maxStringLength: 4_096,
    maxKeyLength: 64,
  });
  if (!parsed.ok) return json(boundedJsonFailurePayload(parsed), { status: parsed.status });
  if (!isExplicitJsonConfirmation(parsed.value)) {
    return json({
      ok: false,
      error: "confirm_required",
      reason: "Opportunity review-state and strategy-score changes require exact JSON confirmation and never trigger external execution.",
      requiredPayload: { confirm: true },
      confirmationCoercionAllowed: false,
      requestBodyContract: parsed.contract,
    }, { status: 400 });
  }

  const decision = typeof parsed.value.decision === "string"
    ? parsed.value.decision.trim() as OpportunityReviewDecision
    : null;
  if (!decision || !OPPORTUNITY_REVIEW_DECISIONS.includes(decision)) {
    return json({
      ok: false,
      error: "invalid_decision",
      allowedDecisions: OPPORTUNITY_REVIEW_DECISIONS,
    }, { status: 400 });
  }

  const reason = boundedReviewText(parsed.value.reason, "reason", 500);
  if (!reason.ok) return json({ ok: false, ...reason }, { status: 400 });
  const reviewer = boundedReviewText(parsed.value.reviewer, "reviewer", 120);
  if (!reviewer.ok) return json({ ok: false, ...reviewer }, { status: 400 });
  const notes = boundedReviewText(parsed.value.notes, "notes", 4_000, { preserveLineBreaks: true });
  if (!notes.ok) return json({ ok: false, ...notes }, { status: 400 });

  const valueRating = readRating(parsed.value, "valueRating", "value_rating");
  if (!valueRating.ok) return json({ ok: false, ...valueRating }, { status: 400 });
  const fitRating = readRating(parsed.value, "fitRating", "fit_rating");
  if (!fitRating.ok) return json({ ok: false, ...fitRating }, { status: 400 });
  const effortRating = readRating(parsed.value, "effortRating", "effort_rating");
  if (!effortRating.ok) return json({ ok: false, ...effortRating }, { status: 400 });
  const urgencyRating = readRating(parsed.value, "urgencyRating", "urgency_rating");
  if (!urgencyRating.ok) return json({ ok: false, ...urgencyRating }, { status: 400 });
  const ratings: OpportunityReviewRatings = {
    value_rating: valueRating.value,
    fit_rating: fitRating.value,
    effort_rating: effortRating.value,
    urgency_rating: urgencyRating.value,
  };

  const requestReceipt = {
    contract: parsed.contract,
    bytes: parsed.bytes,
    bodySha256: parsed.bodySha256,
  };
  const opportunityActionKey = `opportunity-review:${opportunityId}`;
  const opportunityLease = await acquireManualResearchLease(env, opportunityActionKey, 600);
  if (!opportunityLease) {
    return json({ ...manualResearchLeaseConflict(opportunityActionKey), requestReceipt }, { status: 409 });
  }

  let strategyLease: ManualResearchLease | null = null;
  try {
    const opportunity = await getOpportunityReviewContext(env, opportunityId);
    if (!opportunity) {
      return json({ ok: false, error: "opportunity_not_found", requestReceipt }, { status: 404 });
    }

    const strategyActionKey = await reviewLeaseKey(
      "opportunity-strategy",
      opportunityStrategyScope(opportunity),
    );
    strategyLease = await acquireManualResearchLease(env, strategyActionKey, 600);
    if (!strategyLease) {
      return json({ ...manualResearchLeaseConflict(strategyActionKey), requestReceipt }, { status: 409 });
    }

    const result = await applyOpportunityReview(env, opportunity, {
      decision,
      reason: reason.value,
      reviewer: reviewer.value,
      notes: notes.value,
      ratings,
      requestBodySha256: parsed.bodySha256,
    });
    const status = resultStatus(result);
    return json({
      ...result,
      contract: REVIEW_MUTATION_CONTRACT,
      requestReceipt,
      leaseContracts: [opportunityLease.contract, strategyLease.contract],
      exactBooleanConfirmation: true,
      confirmationCoercionAllowed: false,
      concurrentDuplicateReviewAllowed: false,
      concurrentStrategyScoreMutationAllowed: false,
    }, status ? { status } : undefined);
  } catch {
    return json({
      ok: false,
      error: "opportunity_review_failed",
      contract: REVIEW_MUTATION_CONTRACT,
      requestReceipt,
      reviewOnly: true,
      executable: false,
      externalExecutionAllowed: false,
    }, { status: 500 });
  } finally {
    await releaseManualResearchLease(env, strategyLease).catch(() => false);
    await releaseManualResearchLease(env, opportunityLease).catch(() => false);
  }
}
