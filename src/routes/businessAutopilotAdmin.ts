import { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import { buildBusinessDraftOnlyAction } from "../core/businessAutopilotActionDraftBuilder";
import {
  markBusinessInternalPlanningRecord,
  normalizeBusinessContentIdeaInput,
  normalizeBusinessFollowupInput,
} from "../core/businessInternalPlanningSafety";
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

const schemaMissingMessage = "Business Autopilot schema is missing or unavailable.";
const routeFailedMessage = "Business Autopilot route failed before a safe response could be returned.";
const historicalContentRedaction = "[historical deliverable-looking content redacted]";

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

function blockedHistoricalRecordWrite(json: JsonResponse, mode: string) {
  return json({
    ok: false,
    mode,
    error: "historical_record_write_disabled",
    reason: "New arbitrary draft and approval records are disabled. Historical records remain available through authenticated read-only routes.",
    historicalOnly: true,
    reviewOnly: true,
    executable: false,
    deliverable: false,
    authoritativeForExecution: false,
    externalExecutionAllowed: false,
    compatibility: {
      legacyBuilder: "buildBusinessDraftOnlyAction",
      legacyMode: "business_action_draft_built",
    },
    safety: businessAutopilotMetadataWriteSafety(),
  }, { status: 410 });
}

function markHistoricalBusinessRecord<T extends Record<string, unknown>>(record: T) {
  const legacySubjectPresent = typeof record.subject === "string" && record.subject.length > 0;
  const legacyBodyPresent = typeof record.body === "string" && record.body.length > 0;
  return {
    ...record,
    ...(legacySubjectPresent ? { subject: historicalContentRedaction } : {}),
    ...(legacyBodyPresent ? { body: historicalContentRedaction } : {}),
    historicalContentRedacted: legacySubjectPresent || legacyBodyPresent,
    historicalOnly: true,
    reviewOnly: true,
    executable: false,
    deliverable: false,
    authoritativeForExecution: false,
    statusAuthoritative: false,
    externalExecutionAllowed: false,
  };
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function migrationError(error: unknown) {
  const missingTable = /no such table: business_(organizations|people|websites|pages|signals|opportunities|service_matches|audit_packs|action_drafts|approval_requests|execution_records|suppression_list|content_ideas|content_calendar|followups|learning_events)/i.test(errorText(error));
  return {
    ok: false,
    mode: "business_autopilot_error",
    error: missingTable ? "business_autopilot_schema_missing" : "business_autopilot_failed",
    message: missingTable ? schemaMissingMessage : routeFailedMessage,
    requiredMigration: missingTable ? "0021_business_autopilot_foundation.sql" : null,
    safety: businessAutopilotReadSafety(),
  };
}

export async function handleBusinessAutopilotAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET, POST" } });
  }
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
      const historicalDrafts = drafts.map(markHistoricalBusinessRecord);
      return json({ mode: "business_action_drafts", historicalOnly: true, historicalContentRedacted: true, executable: false, deliverable: false, authoritativeForExecution: false, ...businessReadPayload(historicalDrafts, "drafts") });
    }
    if (request.method === "GET" && pathname === "/admin/business/approval-requests") {
      const approvals = await listBusinessApprovalRequests(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      const historicalApprovals = approvals.map(markHistoricalBusinessRecord);
      return json({ mode: "business_approval_requests", historicalOnly: true, executable: false, deliverable: false, authoritativeForExecution: false, ...businessReadPayload(historicalApprovals, "approvalRequests") });
    }
    if (request.method === "GET" && pathname === "/admin/business/suppression") {
      const records = await listBusinessSuppression(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("active") !== "0");
      return json({ mode: "business_suppression_list", ...businessReadPayload(records, "suppression") });
    }
    if (request.method === "GET" && pathname === "/admin/business/content-ideas") {
      const ideas = await listBusinessContentIdeas(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      const internalIdeas = ideas.map(markBusinessInternalPlanningRecord);
      return json({ mode: "business_content_ideas", reviewOnly: true, executable: false, deliverable: false, authoritativeForExecution: false, ...businessReadPayload(internalIdeas, "contentIdeas") });
    }
    if (request.method === "GET" && pathname === "/admin/business/followups") {
      const followups = await listBusinessFollowups(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      const internalFollowups = followups.map(markBusinessInternalPlanningRecord);
      return json({ mode: "business_followups", reviewOnly: true, executable: false, deliverable: false, authoritativeForExecution: false, ...businessReadPayload(internalFollowups, "followups") });
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
    if (request.method === "POST" && pathname === "/admin/business/action-drafts/build") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const built = buildBusinessDraftOnlyAction(body.draftRequest || body);
      const reviewRecord = await saveBusinessActionDraft(env, built.draft);
      return json({
        ok: true,
        mode: "business_historical_review_record_saved",
        legacyMode: "business_action_draft_built",
        reviewRecord,
        historicalOnly: true,
        reviewOnly: true,
        executable: false,
        deliverable: false,
        authoritativeForExecution: false,
        externalExecutionAllowed: false,
        reviewChecklist: built.reviewChecklist,
        explicitBlocks: built.explicitBlocks,
        riskFlags: built.riskFlags,
        safety: built.safety,
      });
    }
    if (request.method === "POST" && pathname === "/admin/business/action-drafts") {
      return blockedHistoricalRecordWrite(json, "business_action_draft_write_disabled");
    }
    if (request.method === "POST" && pathname === "/admin/business/approval-requests") {
      return blockedHistoricalRecordWrite(json, "business_approval_request_write_disabled");
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
      const normalized = normalizeBusinessContentIdeaInput(body.contentIdea || body);
      const contentIdea = markBusinessInternalPlanningRecord(await saveBusinessContentIdea(env, normalized));
      return json({ mode: "business_content_idea_saved", reviewOnly: true, executable: false, deliverable: false, authoritativeForExecution: false, ...businessWritePayload(contentIdea, "contentIdea") });
    }
    if (request.method === "POST" && pathname === "/admin/business/followups") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const normalized = normalizeBusinessFollowupInput(body.followup || body);
      const followup = markBusinessInternalPlanningRecord(await saveBusinessFollowup(env, normalized));
      return json({ mode: "business_followup_saved", reviewOnly: true, executable: false, deliverable: false, authoritativeForExecution: false, ...businessWritePayload(followup, "followup") });
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
