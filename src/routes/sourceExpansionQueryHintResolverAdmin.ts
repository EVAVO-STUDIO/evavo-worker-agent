import type { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import { boundedJsonFailurePayload, isExplicitJsonConfirmation, readBoundedJsonObject } from "../core/boundedJsonRequest";
import { acquireManualResearchLease, manualResearchLeaseConflict, releaseManualResearchLease } from "../core/manualResearchLease";
import { resolveQueryHintUrls } from "../core/sourceExpansionQueryResolver";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

function normalizedHintId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= 160 ? normalized : null;
}

function boundedNote(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 500) : undefined;
}

export async function handleSourceExpansionQueryHintResolverAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } });
  }
  if (pathname !== "/admin/opportunities/sources/expansion/query-hints/resolve") return json({ ok: false, error: "Not found" }, { status: 404 });
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } });

  const parsed = await readBoundedJsonObject(request);
  if (!parsed.ok) return json(boundedJsonFailurePayload(parsed), { status: parsed.status });
  if (!isExplicitJsonConfirmation(parsed.value)) {
    return json({
      ok: false,
      error: "confirm_required",
      requiredPayload: { confirm: true },
      confirmationCoercionAllowed: false,
      requestBodyContract: parsed.contract,
    }, { status: 400 });
  }

  const hintId = normalizedHintId(parsed.value.hintId);
  if (!hintId) return json({ ok: false, error: "hint_id_required" }, { status: 400 });
  const urls = Array.isArray(parsed.value.urls)
    ? parsed.value.urls.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean).slice(0, 25)
    : [];
  if (!urls.length) return json({ ok: false, error: "urls_required" }, { status: 400 });

  const requestReceipt = {
    contract: parsed.contract,
    bytes: parsed.bytes,
    bodySha256: parsed.bodySha256,
    hintId,
  };
  const actionKey = `query-hint-resolve:${hintId}`;
  const lease = await acquireManualResearchLease(env, actionKey, 300);
  if (!lease) return json({ ...manualResearchLeaseConflict(actionKey), requestReceipt }, { status: 409 });

  try {
    const result = await resolveQueryHintUrls(env, {
      hintId,
      urls,
      note: boundedNote(parsed.value.note),
    });
    return json({ ...result, requestReceipt, leaseContract: lease.contract });
  } finally {
    await releaseManualResearchLease(env, lease).catch(() => false);
  }
}
