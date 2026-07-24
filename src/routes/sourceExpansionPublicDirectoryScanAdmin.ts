import type { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import { boundedJsonFailurePayload, isExplicitJsonConfirmation, readBoundedJsonObject } from "../core/boundedJsonRequest";
import { acquireManualResearchLease, manualResearchLeaseConflict, releaseManualResearchLease } from "../core/manualResearchLease";
import { runRelationshipGraphDiscovery } from "../core/sourceExpansionGraphDiscovery";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

export async function handleSourceExpansionPublicDirectoryScanAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } });
  }
  if (pathname !== "/admin/opportunities/sources/expansion/public-directory-scan") return json({ ok: false, error: "Not found" }, { status: 404 });
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

  const requestReceipt = {
    contract: parsed.contract,
    bytes: parsed.bytes,
    bodySha256: parsed.bodySha256,
  };
  const actionKey = "source-expansion-relationship-graph";
  const lease = await acquireManualResearchLease(env, actionKey, 900);
  if (!lease) return json({ ...manualResearchLeaseConflict(actionKey), requestReceipt }, { status: 409 });

  try {
    const body = parsed.value;
    const result = await runRelationshipGraphDiscovery(env, {
      limitSeeds: boundedInteger(body.limitSeeds, 3, 1, 10),
      maxFetches: boundedInteger(body.maxFetches, 3, 1, 10),
      maxLinksPerSeed: boundedInteger(body.maxLinksPerSeed, 50, 10, 100),
      maxCandidates: boundedInteger(body.maxCandidates, 40, 5, 100),
    });
    return json({ ...result, leaseContract: lease.contract, requestReceipt });
  } finally {
    await releaseManualResearchLease(env, lease).catch(() => false);
  }
}
