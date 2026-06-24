import { Env, getAdminToken } from "../db";
import { previewOpportunitySourceCandidates } from "../core/opportunitySourceDiscovery";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

function numberParam(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

export async function handleOpportunitySourceCandidatesAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
  if (pathname !== "/admin/opportunities/sources/candidates/preview") return json({ ok: false, error: "Not found" }, { status: 404 });

  const url = new URL(request.url);
  const country = url.searchParams.get("country") || undefined;
  const category = url.searchParams.get("category") || undefined;
  const includeDuplicates = url.searchParams.get("includeDuplicates") === "true";
  const limit = numberParam(url.searchParams.get("limit"), 50, 1, 100);

  const result = await previewOpportunitySourceCandidates(env, { country, category, includeDuplicates, limit });
  return json(result);
}
