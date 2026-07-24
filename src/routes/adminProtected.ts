import type { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import {
  boundedJsonFailurePayload,
  isExplicitJsonConfirmation,
  readBoundedJsonObject,
} from "../core/boundedJsonRequest";
import { handleAdmin as handleAdminImplementation } from "./admin";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

function manualMetadataWriteRequiresConfirmation(pathname: string, method: string): boolean {
  return method === "POST" && (pathname === "/admin/leads" || pathname === "/admin/seeds");
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

  if (manualMetadataWriteRequiresConfirmation(pathname, request.method)) {
    const parsed = await readBoundedJsonObject(request.clone(), {
      maxBytes: 65_536,
      maxDepth: 6,
      maxNodes: 600,
      maxArrayLength: 100,
      maxStringLength: 2_048,
      maxKeyLength: 96,
    });
    if (!parsed.ok) return json(boundedJsonFailurePayload(parsed), { status: parsed.status });
    if (!isExplicitJsonConfirmation(parsed.value)) {
      return json({
        ok: false,
        error: "confirm_required",
        reason: "Manual historical-record insertion requires exact JSON confirmation. This is an internal metadata write only and does not trigger research, drafting, sending, posting, form submission, browser automation, or external mutation.",
        requiredPayload: { confirm: true },
        confirmationCoercionAllowed: false,
        requestReceipt: {
          contract: parsed.contract,
          bytes: parsed.bytes,
          bodySha256: parsed.bodySha256,
        },
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
