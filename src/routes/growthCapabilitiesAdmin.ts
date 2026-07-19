import { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import { listGrowthCapabilities } from "../core/growthCapabilities";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

const readSafety = { readOnly: true, internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false, canSendEmail: false, canPostSocial: false, canSubmitForms: false };

export async function handleGrowthCapabilitiesAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET" } });
  }
  if (request.method !== "GET") return json({ ok: false, error: "method_not_allowed", path: pathname, method: request.method }, { status: 405, headers: { allow: "GET" } });

  return json({
    ok: true,
    mode: "growth_capabilities",
    ...listGrowthCapabilities(),
    safety: readSafety,
  });
}
