import type { Env } from "../db";
import { logEvent } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import {
  boundedJsonFailurePayload,
  isExplicitJsonConfirmation,
  readBoundedJsonObject,
} from "../core/boundedJsonRequest";
import {
  claimGrowthActivityBudget,
  completeGrowthActivityBudgetClaim,
  type GrowthActivityBudgetLedgerClaim,
} from "../core/growthActivityBudgetLedger";
import { resolveGrowthActivitySettings } from "../core/growthActivityBudgetSettings";
import { listGrowthActions, listGrowthSignals } from "../core/growthEngagementReadModels";
import {
  composeGrowthInternalOperatorPack,
  type GrowthInternalOperatorPackAction,
  type GrowthInternalOperatorPackSignal,
} from "../core/growthInternalOperatorPack";
import { readAutonomySettings } from "../engineAutonomy";

export const GROWTH_INTERNAL_OPERATOR_PACK_ROUTE =
  "/admin/growth/operator/artifacts" as const;
export const GROWTH_INTERNAL_OPERATOR_PACK_ROUTE_VERSION =
  "growth_internal_operator_pack_route_v1" as const;

const SIGNAL_LIMIT = 20;
const ACTION_LIMIT = 20;
const CONFIRMATION_MAX_BYTES = 256;

type JsonResponse = (data: unknown, init?: ResponseInit) => Response;
type ConfirmationBody = Record<string, unknown> & { confirm?: unknown };

const SAFETY = Object.freeze({
  ownerAuthenticationRequired: true,
  exactConfirmationRequired: true,
  requestBodyBounded: true,
  persistentBudgetAdmissionRequired: true,
  internalBudgetAccountingWritesOnly: true,
  readsSavedReviewModelsOnly: true,
  callsNetwork: false,
  callsAI: false,
  sendsEmail: false,
  createsCalendarEvent: false,
  postsExternally: false,
  submitsForms: false,
  writesProvider: false,
  promotesCanonicalRecord: false,
  automaticRetryAllowed: false,
});

function safeError(
  json: JsonResponse,
  status: number,
  error: string,
  detail?: Record<string, unknown>,
): Response {
  return json({
    ok: false,
    mode: "growth_internal_operator_pack_unavailable",
    contractVersion: GROWTH_INTERNAL_OPERATOR_PACK_ROUTE_VERSION,
    error,
    ...(detail ?? {}),
    safety: SAFETY,
  }, { status });
}

function exactConfirmation(value: ConfirmationBody): boolean {
  return (
    isExplicitJsonConfirmation(value) &&
    Object.keys(value).length === 1 &&
    Object.prototype.hasOwnProperty.call(value, "confirm")
  );
}

function claimId(): string {
  return `growth-operator-pack:${crypto.randomUUID()}`;
}

function suggestedFocus(
  signals: readonly GrowthInternalOperatorPackSignal[],
  actions: readonly GrowthInternalOperatorPackAction[],
): readonly string[] {
  const focus: string[] = [];
  const newSignals = signals.filter((signal) => signal.status === "new").length;
  const highFitSignals = signals.filter((signal) => signal.fitScore >= 75).length;
  const needsReview = actions.filter((action) => action.status === "needs_review").length;
  const blocked = actions.filter((action) => action.status === "blocked" || Boolean(action.blockedReason)).length;
  const queued = actions.filter((action) => action.status === "queued").length;

  if (blocked) focus.push(`${blocked} saved Growth action(s) are blocked and need an owner decision.`);
  if (needsReview) focus.push(`${needsReview} saved Growth action(s) need owner review.`);
  if (newSignals) focus.push(`${newSignals} new Growth signal(s) can be investigated, watched or marked inactive.`);
  if (highFitSignals) focus.push(`${highFitSignals} saved Growth signal(s) meet the high-fit review threshold.`);
  if (queued) focus.push(`${queued} queued Growth action(s) are waiting for evidence-backed review.`);
  if (!focus.length) focus.push("No urgent internal Growth review item is present in the saved Worker models.");
  return Object.freeze(focus.slice(0, 10));
}

async function completeClaimSafely(
  env: Env,
  claim: GrowthActivityBudgetLedgerClaim,
  outcome: "completed" | "failed",
  outcomeCode: string,
): Promise<boolean> {
  try {
    await completeGrowthActivityBudgetClaim(env, {
      claim,
      outcome,
      outcomeCode,
    });
    return true;
  } catch {
    await logEvent(
      env,
      "growth_internal_operator_pack_budget_completion_failed",
      `Growth operator pack budget completion failed after ${outcome}; reserved usage remains consumed and automatic retry is disabled.`,
    ).catch(() => undefined);
    return false;
  }
}

export async function handleGrowthInternalOperatorPackAdmin(
  request: Request,
  env: Env,
  pathname: string,
  json: JsonResponse,
): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (request.method === "OPTIONS") {
    return json(
      { ok: false, error: "method_not_allowed" },
      { status: 405, headers: { allow: "POST" } },
    );
  }
  if (pathname !== GROWTH_INTERNAL_OPERATOR_PACK_ROUTE) {
    return json({ ok: false, error: "not_found" }, { status: 404 });
  }
  if (request.method !== "POST") {
    return json(
      { ok: false, error: "method_not_allowed" },
      { status: 405, headers: { allow: "POST" } },
    );
  }

  const url = new URL(request.url);
  if ([...url.searchParams.keys()].length !== 0) {
    return safeError(json, 400, "query_not_supported");
  }

  const parsed = await readBoundedJsonObject<ConfirmationBody>(request, {
    maxBytes: CONFIRMATION_MAX_BYTES,
    maxDepth: 1,
    maxNodes: 16,
    maxArrayLength: 1,
    maxStringLength: 16,
    maxKeyLength: 16,
  });
  if (!parsed.ok) return json(boundedJsonFailurePayload(parsed), { status: parsed.status });
  if (!exactConfirmation(parsed.value)) {
    return json({
      ok: false,
      error: "confirm_required",
      requiredPayload: { confirm: true },
      confirmationCoercionAllowed: false,
      requestBodyContract: parsed.contract,
      safety: SAFETY,
    }, { status: 400 });
  }
  if (!env?.DB) return safeError(json, 503, "growth_activity_budget_unavailable");

  const generatedAt = new Date();
  const settings = await readAutonomySettings(env);
  const activity = resolveGrowthActivitySettings(settings);
  let budgetClaim: GrowthActivityBudgetLedgerClaim | null = null;

  try {
    const admission = await claimGrowthActivityBudget(env, {
      claimId: claimId(),
      requestBodySha256: parsed.bodySha256,
      intensity: activity.intensity,
      action: "owner_brief_generate",
      invocation: "manual",
      requestedUnits: 1,
      ownerApproved: true,
      explicitlyConfirmed: true,
      now: generatedAt,
    });
    if (!admission.accepted) {
      return safeError(json, 429, "growth_activity_budget_denied", {
        activity: Object.freeze({
          intensity: activity.intensity,
          selectedBy: activity.selectedBy,
          reasons: admission.decision.reasons,
          nextEligibleAt: admission.decision.nextEligibleAt,
          persistentBudgetAdmissionRequired: true,
          automaticRetryAllowed: false,
        }),
      });
    }
    budgetClaim = admission.claim;

    const [signals, actions] = await Promise.all([
      listGrowthSignals(env, SIGNAL_LIMIT),
      listGrowthActions(env, ACTION_LIMIT),
    ]);
    const pack = composeGrowthInternalOperatorPack({
      generatedAt: generatedAt.toISOString(),
      intensity: activity.intensity,
      suggestedFocus: suggestedFocus(signals, actions),
      signals,
      actions,
      externalExecutionRequested: false,
      canonicalPromotionRequested: false,
    });

    const completed = await completeClaimSafely(
      env,
      budgetClaim,
      "completed",
      "operator_pack_generated",
    );
    if (!completed) {
      return safeError(json, 503, "growth_activity_budget_completion_failed");
    }

    return json({
      ok: true,
      mode: "growth_internal_operator_pack",
      contractVersion: GROWTH_INTERNAL_OPERATOR_PACK_ROUTE_VERSION,
      exactBooleanConfirmation: true,
      confirmationCoercionAllowed: false,
      pack,
      activity: Object.freeze({
        contractVersion: activity.contractVersion,
        intensity: activity.intensity,
        selectedBy: activity.selectedBy,
        profileLabel: activity.profile.label,
        persistentBudgetAdmissionRequired: true,
        budgetAction: "owner_brief_generate",
        automaticRetryAllowed: false,
      }),
      safety: SAFETY,
    });
  } catch {
    if (budgetClaim) {
      await completeClaimSafely(
        env,
        budgetClaim,
        "failed",
        "operator_pack_failed",
      );
    }
    return safeError(json, 503, "growth_internal_operator_pack_failed", {
      migrationRequired: "0023_growth_activity_budget_ledger.sql",
    });
  }
}
