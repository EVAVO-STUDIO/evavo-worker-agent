import type { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import {
  businessAccount360Failure,
  parseBusinessAccount360Limit,
  parseBusinessAccount360Path,
} from "../core/businessAccount360";
import { buildBusinessAccount360Batched } from "../core/businessAccount360Batched";
import { businessAutopilotReadSafety } from "../core/businessAutopilotSafety";
import type { JsonResponse } from "./businessAutopilotAdmin";

export async function handleBusinessAccount360Admin(
  request: Request,
  env: Env,
  pathname: string,
  json: JsonResponse,
): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const account360Path = parseBusinessAccount360Path(pathname);
  if (!account360Path.matched) {
    return json(
      { ok: false, error: "not_found", path: pathname, method: request.method },
      { status: 404 },
    );
  }
  if (!account360Path.organizationId) {
    return json(
      {
        ok: false,
        mode: "business_account_360_error",
        error: "invalid_organization_id",
        rawInputExposed: false,
        canonicalStateMutated: false,
        externalExecutionAllowed: false,
      },
      { status: 400 },
    );
  }
  if (request.method !== "GET") {
    return json(
      {
        ok: false,
        mode: "business_account_360",
        error: "method_not_allowed",
        readOnly: true,
        canonicalStateMutated: false,
        externalExecutionAllowed: false,
      },
      { status: 405, headers: { allow: "GET" } },
    );
  }

  const limit = parseBusinessAccount360Limit(new URL(request.url));
  if (!limit.ok) {
    return json(
      {
        ok: false,
        mode: "business_account_360_error",
        error: limit.error,
        ...(limit.fields ? { fields: limit.fields } : {}),
        rawInputExposed: false,
        canonicalStateMutated: false,
        externalExecutionAllowed: false,
      },
      { status: 400 },
    );
  }

  try {
    const generatedAt = Date.now();
    const account = await buildBusinessAccount360Batched(
      env,
      account360Path.organizationId,
      limit.value,
      generatedAt,
    );
    if (!account) {
      return json(
        {
          ok: false,
          mode: "business_account_360",
          contract: "business_account_360_read_v1",
          error: "organization_not_found",
          organizationId: account360Path.organizationId,
          canonicalStateMutated: false,
          externalExecutionAllowed: false,
        },
        { status: 404 },
      );
    }

    return json({
      ok: true,
      mode: "business_account_360",
      contract: "business_account_360_read_v1",
      generatedAt: new Date(generatedAt).toISOString(),
      organizationId: account360Path.organizationId,
      boundedCollectionLimit: limit.value,
      readOnly: true,
      internalReviewOnly: true,
      evidenceBackedOnly: true,
      uncertaintyExplicit: true,
      contactDetailsRedacted: true,
      metadataRedacted: true,
      canonicalBusinessState: false,
      canonicalStateOwner: "next-website/Supabase growth_*",
      canonicalPromotionAllowed: false,
      callsExternalNetwork: false,
      callsAI: false,
      sendsEmail: false,
      postsContent: false,
      createsMeetings: false,
      executesBrowserActions: false,
      mutatesExternalProviders: false,
      externalExecutionAllowed: false,
      ...account,
      safety: businessAutopilotReadSafety(),
    });
  } catch (error) {
    return json(businessAccount360Failure(error), { status: 503 });
  }
}
