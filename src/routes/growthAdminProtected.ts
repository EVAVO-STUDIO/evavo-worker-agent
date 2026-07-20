import { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import { handleGrowthAdmin as handleGrowthAdminImplementation } from "./growthAdmin";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

export async function handleGrowthAdmin(
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
      { status: 405, headers: { allow: "GET, POST" } },
    );
  }

  return handleGrowthAdminImplementation(request, env, pathname, json);
}
