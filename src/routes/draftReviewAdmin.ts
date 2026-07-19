import { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import { listStrategyScores, reviewDraft } from "../core/draftReview";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

function confirmed(body: any): boolean {
  return body?.confirm === true || body?.confirm === 1 || body?.confirm === "1";
}

export async function handleDraftReviewAdmin(
  request: Request,
  env: Env,
  pathname: string,
  json: JsonResponse
): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET, POST" } });
  }

  if (pathname === "/admin/strategy-scores" && request.method === "GET") {
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));
    return json({ ok: true, strategyScores: await listStrategyScores(env, limit) });
  }

  if (pathname.startsWith("/admin/draft-review/") && request.method === "POST") {
    const draftId = pathname.split("/")[3];
    const body = await request.json().catch(() => ({}));
    if (!confirmed(body)) {
      return json({
        ok: false,
        error: "confirm_required",
        reason: "Draft review-state changes require explicit confirmation and never trigger external execution.",
      }, { status: 400 });
    }

    const decision = String(body?.decision || "").trim() as any;
    const allowed = new Set([
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

    if (!draftId) return json({ ok: false, error: "draft_id_required" }, { status: 400 });
    if (!allowed.has(decision)) return json({ ok: false, error: "unsupported_review_decision" }, { status: 400 });

    const result = await reviewDraft(env, {
      draftId,
      decision,
      reason: body?.reason ? String(body.reason) : null,
      notes: body?.notes ? String(body.notes) : null,
      strategyKey: body?.strategyKey ? String(body.strategyKey) : null,
    });

    return json(result, result.ok ? undefined : { status: 404 });
  }

  return json({ ok: false, error: "Not found" }, { status: 404 });
}
