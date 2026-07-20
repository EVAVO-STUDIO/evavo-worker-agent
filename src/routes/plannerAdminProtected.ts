import { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import { handlePlannerAdmin as handlePlannerAdminImplementation } from "./plannerAdmin";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

export async function handlePlannerAdmin(
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

  return handlePlannerAdminImplementation(request, env, pathname, json);
}
