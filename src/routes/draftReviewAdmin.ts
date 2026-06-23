import { Env, getAdminToken } from "../db";
import { listStrategyScores, reviewDraft } from "../core/draftReview";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

export async function handleDraftReviewAdmin(
  request: Request,
  env: Env,
  pathname: string,
  json: JsonResponse
): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  if (pathname === "/admin/strategy-scores" && request.method === "GET") {
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));
    return json({ ok: true, strategyScores: await listStrategyScores(env, limit) });
  }

  if (pathname.startsWith("/admin/draft-review/") && request.method === "POST") {
    const draftId = pathname.split("/")[3];
    const body = await request.json().catch(() => ({}));
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
