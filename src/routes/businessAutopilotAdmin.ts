import { Env, getAdminToken } from "../db";
import {
  businessReadPayload,
  businessWritePayload,
  listBusinessActionDrafts,
  listBusinessApprovalRequests,
  listBusinessContentIdeas,
  listBusinessFollowups,
  listBusinessLearningEvents,
  listBusinessOpportunities,
  listBusinessOrganizations,
  listBusinessServiceMatches,
  listBusinessSignals,
  listBusinessSuppression,
  saveBusinessActionDraft,
  saveBusinessApprovalRequest,
  saveBusinessContentIdea,
  saveBusinessFollowup,
  saveBusinessLearningEvent,
  saveBusinessOpportunity,
  saveBusinessOrganization,
  saveBusinessServiceMatch,
  saveBusinessSignal,
  saveBusinessSuppression,
} from "../core/businessAutopilotRecords";
import { businessAuditPackReadPayload, listBusinessAuditPacks, saveBusinessAuditPack } from "../core/businessAutopilotAuditPackRecords";
import { businessAutopilotMetadataWriteSafety, businessAutopilotReadSafety } from "../core/businessAutopilotSafety";

export type JsonResponse = (data: any, init?: ResponseInit) => Response;

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

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
    reason: "Business Autopilot writes require confirmation and only save internal metadata. They do not send, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems.",
    safety: businessAutopilotMetadataWriteSafety(),
  }, { status: 400 });
}

function migrationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const missingTable = /no such table: business_(organizations|people|websites|pages|signals|opportunities|service_matches|audit_packs|action_drafts|approval_requests|execution_records|suppression_list|content_ideas|content_calendar|followups|learning_events)/i.test(message);
  return {
    ok: false,
    mode: "business_autopilot_error",
    error: missingTable ? "business_autopilot_schema_missing" : "business_autopilot_failed",
    message,
    requiredMigration: missingTable ? "0021_business_autopilot_foundation.sql" : null,
    safety: businessAutopilotReadSafety(),
  };
}

export async function handleBusinessAutopilotAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);

  try {
    if (request.method === "GET" && pathname === "/admin/business/organizations") {
      const organizations = await listBusinessOrganizations(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      return json({ mode: "business_organizations", ...businessReadPayload(organizations, "organizations") });
    }

    if (request.method === "GET" && pathname === "/admin/business/signals") {
      const signals = await listBusinessSignals(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("signalType") || undefined);
      return json({ mode: "business_signals", ...businessReadPayload(signals, "signals") });
    }

    if (request.method === "GET" && pathname === "/admin/business/opportunities") {
      const opportunities = await listBusinessOpportunities(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      return json({ mode: "business_opportunities", ...businessReadPayload(opportunities, "opportunities") });
    }

    if (request.method === "GET" && pathname === "/admin/business/service-matches") {
      const matches = await listBusinessServiceMatches(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("serviceKey") || undefined);
      return json({ mode: "business_service_matches", ...businessReadPayload(matches, "serviceMatches") });
    }

    if (request.method === "GET" && pathname === "/admin/business/audit-packs") {
      const packs = await listBusinessAuditPacks(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      return json({ mode: "business_audit_packs", ...businessAuditPackReadPayload(packs) });
    }

    if (request.method === "GET" && pathname === "/admin/business/action-drafts") {
      const drafts = await listBusinessActionDrafts(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      return json({ mode: "business_action_drafts", ...businessReadPayload(drafts, "drafts") });
    }

    if (request.method === "GET" && pathname === "/admin/business/approval-requests") {
      const approvals = await listBusinessApprovalRequests(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      return json({ mode: "business_approval_requests", ...businessReadPayload(approvals, "approvalRequests") });
    }

    if (request.method === "GET" && pathname === "/admin/business/suppression") {
      const records = await listBusinessSuppression(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("active") !== "0");
      return json({ mode: "business_suppression_list", ...businessReadPayload(records, "suppression") });
    }

    if (request.method === "GET" && pathname === "/admin/business/content-ideas") {
      const ideas = await listBusinessContentIdeas(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      return json({ mode: "business_content_ideas", ...businessReadPayload(ideas, "contentIdeas") });
    }

    if (request.method === "GET" && pathname === "/admin/business/followups") {
      const followups = await listBusinessFollowups(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      return json({ mode: "business_followups", ...businessReadPayload(followups, "followups") });
    }

    if (request.method === "GET" && pathname === "/admin/business/learning") {
      const learning = await listBusinessLearningEvents(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("entityType") || undefined);
      return json({ mode: "business_learning_events", ...businessReadPayload(learning, "learningEvents") });
    }

    if (request.method === "POST" && pathname === "/admin/business/organizations") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const organization = await saveBusinessOrganization(env, body.organization || body);
      return json({ mode: "business_organization_saved", ...businessWritePayload(organization, "organization") });
    }

    if (request.method === "POST" && pathname === "/admin/business/signals") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const signal = await saveBusinessSignal(env, body.signal || body);
      return json({ mode: "business_signal_saved", ...businessWritePayload(signal, "signal") });
    }

    if (request.method === "POST" && pathname === "/admin/business/opportunities") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const opportunity = await saveBusinessOpportunity(env, body.opportunity || body);
      return json({ mode: "business_opportunity_saved", ...businessWritePayload(opportunity, "opportunity") });
    }

    if (request.method === "POST" && pathname === "/admin/business/service-matches") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const serviceMatch = await saveBusinessServiceMatch(env, body.serviceMatch || body);
      return json({ mode: "business_service_match_saved", ...businessWritePayload(serviceMatch, "serviceMatch") });
    }

    if (request.method === "POST" && pathname === "/admin/business/audit-packs") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const auditPack = await saveBusinessAuditPack(env, body.auditPack || body);
      return json({ mode: "business_audit_pack_saved", ...businessWritePayload(auditPack, "auditPack") });
    }

    if (request.method === "POST" && pathname === "/admin/business/action-drafts") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const draft = await saveBusinessActionDraft(env, body.draft || body);
      return json({ mode: "business_action_draft_saved", ...businessWritePayload(draft, "draft") });
    }

    if (request.method === "POST" && pathname === "/admin/business/approval-requests") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const approvalRequest = await saveBusinessApprovalRequest(env, body.approvalRequest || body);
      return json({ mode: "business_approval_request_saved", ...businessWritePayload(approvalRequest, "approvalRequest") });
    }

    if (request.method === "POST" && pathname === "/admin/business/suppression") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const suppression = await saveBusinessSuppression(env, body.suppression || body);
      return json({ mode: "business_suppression_saved", ...businessWritePayload(suppression, "suppression") });
    }

    if (request.method === "POST" && pathname === "/admin/business/content-ideas") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const contentIdea = await saveBusinessContentIdea(env, body.contentIdea || body);
      return json({ mode: "business_content_idea_saved", ...businessWritePayload(contentIdea, "contentIdea") });
    }

    if (request.method === "POST" && pathname === "/admin/business/followups") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const followup = await saveBusinessFollowup(env, body.followup || body);
      return json({ mode: "business_followup_saved", ...businessWritePayload(followup, "followup") });
    }

    if (request.method === "POST" && pathname === "/admin/business/learning") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const learningEvent = await saveBusinessLearningEvent(env, body.learningEvent || body);
      return json({ mode: "business_learning_event_saved", ...businessWritePayload(learningEvent, "learningEvent") });
    }

    return json({ ok: false, error: "not_found", path: pathname, method: request.method }, { status: 404 });
  } catch (error) {
    const normalized = migrationError(error);
    return json(normalized, { status: 500 });
  }
}
