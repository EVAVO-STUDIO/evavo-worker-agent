import { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import {
  boundedJsonFailurePayload,
  isExplicitJsonConfirmation,
  readBoundedJsonObject,
} from "../core/boundedJsonRequest";
import {
  acquireManualResearchLease,
  manualResearchLeaseConflict,
  releaseManualResearchLease,
} from "../core/manualResearchLease";
import { validatePublicResearchUrl } from "../core/publicResearchFetch";
import { boundedReviewText } from "../core/reviewMutationSafety";
import {
  previewOpportunitySourceCandidates,
  saveOpportunitySourceCandidates,
} from "../core/opportunitySourceDiscovery";

type JsonResponse = (data: any, init?: ResponseInit) => Response;
type SourceCandidateCommitBody = Record<string, unknown> & {
  confirm?: unknown;
  urls?: unknown;
  reason?: unknown;
  actor?: unknown;
};

const SOURCE_CANDIDATE_COMMIT_LEASE = "opportunity-source-candidates-commit";

function numberParam(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function normalizedCandidateUrls(value: unknown):
  | { ok: true; urls: string[] }
  | { ok: false; error: "urls_required" | "too_many_urls" | "invalid_candidate_url"; index?: number; maxItems?: number } {
  if (!Array.isArray(value) || value.length === 0) return { ok: false, error: "urls_required" };
  if (value.length > 25) return { ok: false, error: "too_many_urls", maxItems: 25 };

  const urls: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const raw = value[index];
    if (typeof raw !== "string" || raw.length > 2_048) {
      return { ok: false, error: "invalid_candidate_url", index };
    }
    const decision = validatePublicResearchUrl(raw.trim());
    if (!decision.ok || !decision.url) {
      return { ok: false, error: "invalid_candidate_url", index };
    }
    const parsed = new URL(decision.url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return { ok: false, error: "invalid_candidate_url", index };
    }
    const normalized = parsed.toString().replace(/\/+$/, "");
    if (!urls.includes(normalized)) urls.push(normalized);
  }
  return urls.length ? { ok: true, urls } : { ok: false, error: "urls_required" };
}

export async function handleOpportunitySourceCandidatesAdmin(
  request: Request,
  env: Env,
  pathname: string,
  json: JsonResponse,
): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET, POST" } });
  }

  if (pathname === "/admin/opportunities/sources/candidates/preview") {
    if (request.method !== "GET") {
      return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET" } });
    }
    const url = new URL(request.url);
    const country = url.searchParams.get("country") || undefined;
    const category = url.searchParams.get("category") || undefined;
    const includeDuplicates = url.searchParams.get("includeDuplicates") === "true";
    const limit = numberParam(url.searchParams.get("limit"), 50, 1, 100);
    return json(await previewOpportunitySourceCandidates(env, {
      country,
      category,
      includeDuplicates,
      limit,
    }));
  }

  if (pathname !== "/admin/opportunities/sources/candidates/commit") {
    return json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } });
  }

  const parsed = await readBoundedJsonObject<SourceCandidateCommitBody>(request, {
    maxBytes: 65_536,
    maxDepth: 4,
    maxNodes: 80,
    maxArrayLength: 25,
    maxStringLength: 2_048,
    maxKeyLength: 64,
  });
  if (!parsed.ok) return json(boundedJsonFailurePayload(parsed), { status: parsed.status });
  if (!isExplicitJsonConfirmation(parsed.value)) {
    return json({
      ok: false,
      error: "confirm_required",
      reason: "Saving reviewed source candidates requires exact JSON confirmation.",
      requiredPayload: { confirm: true },
      confirmationCoercionAllowed: false,
      requestBodyContract: parsed.contract,
    }, { status: 400 });
  }

  const selected = normalizedCandidateUrls(parsed.value.urls);
  if (!selected.ok) return json({ ...selected, ok: false }, { status: 400 });
  const reason = boundedReviewText(parsed.value.reason, "reason", 500);
  if (!reason.ok) return json({ ...reason, ok: false }, { status: 400 });
  const actor = boundedReviewText(parsed.value.actor, "actor", 120);
  if (!actor.ok) return json({ ...actor, ok: false }, { status: 400 });

  const requestReceipt = {
    contract: parsed.contract,
    bytes: parsed.bytes,
    bodySha256: parsed.bodySha256,
  };
  const lease = await acquireManualResearchLease(env, SOURCE_CANDIDATE_COMMIT_LEASE, 600);
  if (!lease) {
    return json({
      ...manualResearchLeaseConflict(SOURCE_CANDIDATE_COMMIT_LEASE),
      requestReceipt,
    }, { status: 409 });
  }

  try {
    const result = await saveOpportunitySourceCandidates(env, {
      urls: selected.urls,
      reason: reason.value,
      actor: actor.value,
      requestBodySha256: parsed.bodySha256,
    });
    const resultError = "error" in result ? result.error : null;
    const inheritedSafety = "safety" in result && result.safety && typeof result.safety === "object"
      ? result.safety
      : {};
    const status = result.ok ? undefined : resultError === "missing_migration" ? 503 : 400;
    return json({
      ...result,
      requestReceipt,
      leaseContract: lease.contract,
      exactBooleanConfirmation: true,
      confirmationCoercionAllowed: false,
      internalMetadataOnly: true,
      reviewOnly: true,
      executable: false,
      deliverable: false,
      authoritativeForExecution: false,
      externalExecutionAllowed: false,
      safety: {
        ...inheritedSafety,
        publicHttpsCandidateUrlsOnly: true,
        publicResearchUrlPolicyRequired: true,
        sensitiveQueryParametersRejected: true,
        maximumCandidateCount: 25,
        concurrentDuplicateCommitAllowed: false,
        callsAI: false,
        sendsEmail: false,
        postsExternally: false,
        appliesExternally: false,
      },
    }, status ? { status } : undefined);
  } catch {
    return json({
      ok: false,
      error: "source_candidate_commit_failed",
      requestReceipt,
      internalMetadataOnly: true,
      reviewOnly: true,
      executable: false,
      externalExecutionAllowed: false,
    }, { status: 500 });
  } finally {
    await releaseManualResearchLease(env, lease).catch(() => false);
  }
}
