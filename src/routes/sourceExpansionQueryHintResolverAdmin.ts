import type { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import { resolveQueryHintUrls } from "../core/sourceExpansionQueryResolver";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

async function readJson(request: Request) {
  return request.json().catch(() => ({}));
}

export async function handleSourceExpansionQueryHintResolverAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } });
  }
  if (pathname !== "/admin/opportunities/sources/expansion/query-hints/resolve") return json({ ok: false, error: "Not found" }, { status: 404 });
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } });

  const body = await readJson(request);
  if (body?.confirm !== true) return json({ ok: false, error: "confirm_required" }, { status: 400 });
  if (typeof body?.hintId !== "string" || !body.hintId) return json({ ok: false, error: "hint_id_required" }, { status: 400 });
  const urls = Array.isArray(body?.urls) ? body.urls.map(String).slice(0, 25) : [];
  if (!urls.length) return json({ ok: false, error: "urls_required" }, { status: 400 });

  return json(await resolveQueryHintUrls(env, {
    hintId: body.hintId,
    urls,
    note: typeof body?.note === "string" ? body.note : undefined,
  }));
}
