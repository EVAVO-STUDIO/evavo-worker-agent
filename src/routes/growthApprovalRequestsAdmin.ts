import { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import { listGrowthApprovalRequests, saveGrowthApprovalRequest, updateGrowthApprovalRequestStatus } from "../core/growthApprovalRequests";

export type JsonResponse = (data: any, init?: ResponseInit) => Response;

const readSafety = { readOnly: true, internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false, canSendEmail: false, canPostSocial: false, canSubmitForms: false };
const writeSafety = { readOnly: false, internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false, canSendEmail: false, canPostSocial: false, canSubmitForms: false };

function intParam(url: URL, key: string, fallback: number, min: number, max: number): number {
  const value = Number(url.searchParams.get(key));
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

async function parseBody(request: Request): Promise<any> {
  return request.json().catch(() => ({}));
}

function confirmed(url: URL, body: any): boolean {
  return url.searchParams.get("confirm") === "1" || body?.confirm === true || body?.confirm === 1 || body?.confirm === "1";
}

function blockedWrite(json: JsonResponse) {
  return json({
    ok: false,
    error: "confirm_required",
    reason: "Growth approval request writes require confirmation and only save internal review metadata. They do not execute, draft, send, post, browse, call AI, submit forms, spend, or write CRM state.",
    safety: writeSafety,
  }, { status: 400 });
}

function migrationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const missingTable = /no such table: growth_approval_requests/i.test(message);
  return {
    ok: false,
    mode: "growth_approval_requests_error",
    error: missingTable ? "growth_approval_requests_schema_missing" : "growth_approval_requests_failed",
    message,
    requiredMigration: missingTable ? "0019_growth_approval_requests.sql" : null,
    safety: readSafety,
  };
}

export async function handleGrowthApprovalRequestsAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET, POST" } });
  }
  const url = new URL(request.url);

  try {
    if (request.method === "GET" && pathname === "/admin/growth/approval-requests") {
      const requests = await listGrowthApprovalRequests(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      return json({ ok: true, mode: "growth_approval_requests", requests, count: requests.length, safety: readSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/approval-requests") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const pack = body.approvalPack || body.pack || body;
      const saved = await saveGrowthApprovalRequest(env, {
        source: pack.source || body.source || "growth_operator",
        step: pack.step || pack.title || body.step,
        route: pack.route || body.route,
        method: pack.method || body.method,
        requiresConfirm: pack.requiresConfirm ?? body.requiresConfirm ?? true,
        dashboardAnchor: pack.dashboardAnchor || body.dashboardAnchor || null,
        setupGap: pack.setupGap || body.setupGap || null,
        targetCampaignId: pack.targetCampaignId || body.targetCampaignId || null,
        targetCampaignName: pack.targetCampaignName || body.targetCampaignName || null,
        payloadHint: pack.payloadHint || pack.payload || body.payloadHint || body.payload || {},
        reviewChecklist: pack.reviewChecklist || body.reviewChecklist || [],
        explicitBlocks: pack.explicitBlocks || body.explicitBlocks || [],
        auditReason: pack.auditReason || body.auditReason || [],
        safety: pack.safety || body.safety || null,
      }, body.id || pack.id);
      return json({ ok: true, mode: "growth_approval_request_saved", request: saved, safety: writeSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/approval-requests/status") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const saved = await updateGrowthApprovalRequestStatus(env, String(body.id || body.requestId || ""), String(body.status || "pending"), body.reviewer || "admin", body.decisionNote || body.reason || null);
      return json({ ok: true, mode: "growth_approval_request_status_updated", request: saved, safety: writeSafety });
    }

    return json({ ok: false, error: "not_found", path: pathname, method: request.method }, { status: 404 });
  } catch (error) {
    const normalized = migrationError(error);
    return json(normalized, { status: 500 });
  }
}
