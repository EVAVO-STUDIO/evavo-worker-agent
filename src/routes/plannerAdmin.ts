import { Env, getAdminToken } from "../db";
import { buildPlannerReport } from "../core/planner";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

export async function handlePlannerAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  if (pathname === "/admin/planner" && request.method === "GET") {
    return json(await buildPlannerReport(env));
  }

  return json({ ok: false, error: "Not found" }, { status: 404 });
}
