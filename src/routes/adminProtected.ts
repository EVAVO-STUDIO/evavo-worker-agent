import type { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import { handleAdmin as handleAdminImplementation } from "./admin";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

function confirmed(body: any): boolean {
  return body?.confirm === true || body?.confirm === 1 || body?.confirm === "1";
}

export async function handleAdmin(
  request: Request,
  env: Env,
  pathname: string,
  ctx: any,
  json: JsonResponse,
): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET, POST" } });
  }

  if (pathname === "/admin/leads" && request.method === "POST") {
    const body = await request.clone().json().catch(() => ({}));
    if (!confirmed(body)) {
      return json({
        ok: false,
        error: "confirm_required",
        reason: "Manual historical-record insertion requires explicit confirmation. This is an internal metadata write only and does not trigger research, drafting, sending, posting, form submission, browser automation, or external mutation.",
        requiredPayload: { confirm: true },
        safety: {
          internalMetadataOnly: true,
          scheduled: false,
          callsNetwork: false,
          callsAI: false,
          sendsEmail: false,
          postsExternally: false,
          submitsForms: false,
          externalStateChange: false,
        },
      }, { status: 400 });
    }
  }

  return handleAdminImplementation(request, env, pathname, ctx, json);
}
