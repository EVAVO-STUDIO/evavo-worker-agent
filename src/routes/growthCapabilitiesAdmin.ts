import { Env, getAdminToken } from "../db";
import { listGrowthCapabilities } from "../core/growthCapabilities";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

export async function handleGrowthCapabilitiesAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method !== "GET") return json({ ok: false, error: "method_not_allowed", path: pathname, method: request.method }, { status: 405 });

  return json({
    ok: true,
    mode: "growth_capabilities",
    ...listGrowthCapabilities(),
  });
}
