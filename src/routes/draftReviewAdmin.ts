import { Env, getDraftById } from "../db";
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
  DRAFT_REVIEW_DECISIONS,
  listStrategyScores,
  normalizeDraftStrategyKey,
  reviewDraft,
  type DraftReviewDecision,
} from "../core/draftReview";
import {
  REVIEW_MUTATION_CONTRACT,
  boundedReviewText,
  reviewLeaseKey,
  validReviewRecordId,
} from "../core/reviewMutationSafety";

type JsonResponse = (data: any, init?: ResponseInit) => Response;
type DraftReviewBody = Record<string, unknown> & {
  confirm?: unknown;
  decision?: unknown;
  reason?: unknown;
  notes?: unknown;
  strategyKey?: unknown;
};

function resultStatus(result: any): number | undefined {
  if (result?.ok) return undefined;
  if (result?.error === "draft_not_found") return 404;
  if (result?.error === "missing_migration") return 503;
  return 400;
}

export async function handleDraftReviewAdmin(
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

  if (pathname === "/admin/strategy-scores") {
    if (request.method !== "GET") {
      return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET" } });
    }
    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get("limit") || 50);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(200, Math.round(rawLimit))) : 50;
    return json({ ok: true, strategyScores: await listStrategyScores(env, limit), readOnly: true });
  }

  if (!pathname.startsWith("/admin/draft-review/")) {
    return json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } });
  }

  const draftId = decodeURIComponent(pathname.slice("/admin/draft-review/".length));
  if (!validReviewRecordId(draftId)) {
    return json({ ok: false, error: "invalid_draft_id" }, { status: 404 });
  }

  const parsed = await readBoundedJsonObject<DraftReviewBody>(request, {
    maxBytes: 8_192,
    maxDepth: 4,
    maxNodes: 32,
    maxArrayLength: 4,
    maxStringLength: 4_096,
    maxKeyLength: 64,
  });
  if (!parsed.ok) return json(boundedJsonFailurePayload(parsed), { status: parsed.status });
  if (!isExplicitJsonConfirmation(parsed.value)) {
    return json({
      ok: false,
      error: "confirm_required",
      reason: "Draft review-state changes require exact JSON confirmation and never trigger external execution.",
      requiredPayload: { confirm: true },
      confirmationCoercionAllowed: false,
      requestBodyContract: parsed.contract,
    }, { status: 400 });
  }

  const decision = typeof parsed.value.decision === "string"
    ? parsed.value.decision.trim() as DraftReviewDecision
    : null;
  if (!decision || !DRAFT_REVIEW_DECISIONS.includes(decision)) {
    return json({
      ok: false,
      error: "unsupported_review_decision",
      allowedDecisions: DRAFT_REVIEW_DECISIONS,
    }, { status: 400 });
  }

  const reason = boundedReviewText(parsed.value.reason, "reason", 500);
  if (!reason.ok) return json({ ...reason, ok: false }, { status: 400 });
  const notes = boundedReviewText(parsed.value.notes, "notes", 4_000, { preserveLineBreaks: true });
  if (!notes.ok) return json({ ...notes, ok: false }, { status: 400 });
  const strategy = boundedReviewText(parsed.value.strategyKey, "strategyKey", 160);
  if (!strategy.ok) return json({ ...strategy, ok: false }, { status: 400 });

  const requestReceipt = {
    contract: parsed.contract,
    bytes: parsed.bytes,
    bodySha256: parsed.bodySha256,
  };
  const draftActionKey = `draft-review:${draftId}`;
  const draftLease = await acquireManualResearchLease(env, draftActionKey, 600);
  if (!draftLease) {
    return json({ ...manualResearchLeaseConflict(draftActionKey), requestReceipt }, { status: 409 });
  }

  let strategyLease: ManualResearchLease | null = null;
  try {
    const draft = await getDraftById(env, draftId);
    if (!draft) return json({ ok: false, error: "draft_not_found", requestReceipt }, { status: 404 });

    const strategyKey = normalizeDraftStrategyKey(strategy.value || draft.mode || "general_outreach");
    const strategyActionKey = await reviewLeaseKey("draft-strategy", [strategyKey]);
    strategyLease = await acquireManualResearchLease(env, strategyActionKey, 600);
    if (!strategyLease) {
      return json({ ...manualResearchLeaseConflict(strategyActionKey), requestReceipt }, { status: 409 });
    }

    const result = await reviewDraft(env, {
      draftId,
      decision,
      reason: reason.value,
      notes: notes.value,
      strategyKey,
    }, draft);
    const status = resultStatus(result);
    return json({
      ...result,
      contract: REVIEW_MUTATION_CONTRACT,
      requestReceipt,
      leaseContracts: [draftLease.contract, strategyLease.contract],
      exactBooleanConfirmation: true,
      confirmationCoercionAllowed: false,
      concurrentDuplicateReviewAllowed: false,
      concurrentStrategyScoreMutationAllowed: false,
    }, status ? { status } : undefined);
  } catch {
    return json({
      ok: false,
      error: "draft_review_failed",
      contract: REVIEW_MUTATION_CONTRACT,
      requestReceipt,
      reviewOnly: true,
      executable: false,
      externalExecutionAllowed: false,
    }, { status: 500 });
  } finally {
    await releaseManualResearchLease(env, strategyLease).catch(() => false);
    await releaseManualResearchLease(env, draftLease).catch(() => false);
  }
}
