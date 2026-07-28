import type { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import { buildBusinessDraftOnlyAction } from "../core/businessAutopilotActionDraftBuilder";
import {
  markBusinessInternalPlanningRecord,
  normalizeBusinessContentIdeaInput,
  normalizeBusinessFollowupInput,
} from "../core/businessInternalPlanningSafety";
import {
  markBusinessLearningEventRecord,
  normalizeBusinessLearningEventInput,
} from "../core/businessLearningEventSafety";
import {
  markBusinessSuppressionRecord,
  normalizeBusinessSuppressionInput,
} from "../core/businessSuppressionSafety";
import {
  projectHistoricalBusinessApproval,
  projectHistoricalBusinessDraft,
} from "../core/businessHistoricalReadProjection";
import {
  projectInternalContentIdea,
  projectInternalFollowup,
  projectInternalLearningRecord,
} from "../core/businessInternalReadProjection";
import {
  businessReadPayload,
  businessWritePayload,
  listBusinessActionDrafts,
  listBusinessApprovalRequests,
  listBusinessContentIdeas,
  listBusinessFollowups,
  listBusinessLearningEvents,
  listBusinessSuppression,
  saveBusinessActionDraft,
  saveBusinessContentIdea,
  saveBusinessFollowup,
  saveBusinessLearningEvent,
  saveBusinessSuppression,
} from "../core/businessAutopilotRecords";
import {
  businessAuditPackReadPayload,
} from "../core/businessAutopilotAuditPackRecords";
import { businessAutopilotMetadataWriteSafety, businessAutopilotReadSafety } from "../core/businessAutopilotSafety";
import {
  buildBusinessAccount360,
  businessAccount360Failure,
  parseBusinessAccount360Limit,
  parseBusinessAccount360Path,
} from "../core/businessAccount360";
import {
  readBusinessMetadataWriteRequest,
  type BusinessMetadataWriteReceipt,
} from "../core/businessMetadataWriteBoundary";
import { BUSINESS_SCORE_PROVENANCE_CONTRACT } from "../core/businessScoreProvenance";
import {
  listBusinessAuditPacksWithScoreProvenance,
  listBusinessOpportunitiesWithScoreProvenance,
  listBusinessOrganizationsWithScoreProvenance,
  listBusinessServiceMatchesWithScoreProvenance,
  listBusinessSignalsWithScoreProvenance,
} from "../core/businessScoreProvenanceReaders";
import {
  saveBusinessAuditPack,
  saveBusinessOpportunity,
  saveBusinessOrganization,
  saveBusinessServiceMatch,
  saveBusinessSignal,
} from "../core/businessScoreProvenanceWriters";

export type JsonResponse = (data: any, init?: ResponseInit) => Response;

const schemaMissingMessage = "Business Autopilot schema is missing or unavailable.";
const scoreProvenanceMissingMessage = "Business score provenance schema is missing or unavailable.";
const routeFailedMessage = "Business Autopilot route failed before a safe response could be returned.";
const SCORE_RANGE = Object.freeze({ min: 0, max: 100 });

function intParam(url: URL, key: string, fallback: number, min: number, max: number): number {
  const value = Number(url.searchParams.get(key));
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function confirmedWriteMetadata(receipt: BusinessMetadataWriteReceipt) {
  return {
    exactBooleanConfirmation: true,
    confirmationCoercionAllowed: false,
    queryConfirmationAllowed: false,
    internalMetadataOnly: true,
    externalExecutionAllowed: false,
    requestReceipt: receipt,
  };
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

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function migrationError(error: unknown) {
  const message = errorText(error);
  const missingScoreProvenance = /(?:no such column:\s*[^\s]*_observed|has no column named\s+[^\s]*_observed)/i.test(message);
  const missingTable = /no such table: business_(organizations|people|websites|pages|signals|opportunities|service_matches|audit_packs|action_drafts|approval_requests|execution_records|suppression_list|content_ideas|content_calendar|followups|learning_events)/i.test(message);
  const schemaMissing = missingScoreProvenance || missingTable;
  return {
    ok: false,
    mode: "business_autopilot_error",
    error: schemaMissing ? "business_autopilot_schema_missing" : "business_autopilot_failed",
    message: missingScoreProvenance
      ? scoreProvenanceMissingMessage
      : missingTable
        ? schemaMissingMessage
        : routeFailedMessage,
    requiredMigration: missingScoreProvenance
      ? "0024_business_score_observation_flags.sql"
      : missingTable
        ? "0021_business_autopilot_foundation.sql"
        : null,
    rawErrorExposed: false,
    safety: businessAutopilotReadSafety(),
  };
}

function scoreReadPayload<T>(items: T[], key: string) {
  return {
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
    ...businessReadPayload(items, key),
  };
}

export async function handleBusinessAutopilotAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET, POST" } });
  }
  const url = new URL(request.url);
  const account360Path = parseBusinessAccount360Path(pathname);

  if (account360Path.matched) {
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

    const limit = parseBusinessAccount360Limit(url);
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
      const account = await buildBusinessAccount360(
        env,
        account360Path.organizationId,
        limit.value,
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
        generatedAt: new Date().toISOString(),
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

  try {
    if (request.method === "GET" && pathname === "/admin/business/organizations") {
      const organizations = await listBusinessOrganizationsWithScoreProvenance(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      return json({ mode: "business_organizations", ...scoreReadPayload(organizations, "organizations") });
    }
    if (request.method === "GET" && pathname === "/admin/business/signals") {
      const signals = await listBusinessSignalsWithScoreProvenance(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("signalType") || undefined);
      return json({ mode: "business_signals", ...scoreReadPayload(signals, "signals") });
    }
    if (request.method === "GET" && pathname === "/admin/business/opportunities") {
      const opportunities = await listBusinessOpportunitiesWithScoreProvenance(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      return json({ mode: "business_opportunities", ...scoreReadPayload(opportunities, "opportunities") });
    }
    if (request.method === "GET" && pathname === "/admin/business/service-matches") {
      const matches = await listBusinessServiceMatchesWithScoreProvenance(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("serviceKey") || undefined);
      return json({ mode: "business_service_matches", ...scoreReadPayload(matches, "serviceMatches") });
    }
    if (request.method === "GET" && pathname === "/admin/business/audit-packs") {
      const packs = await listBusinessAuditPacksWithScoreProvenance(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      return json({
        mode: "business_audit_packs",
        scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
        ...businessAuditPackReadPayload(packs),
      });
    }
    if (request.method === "GET" && pathname === "/admin/business/action-drafts") {
      const drafts = await listBusinessActionDrafts(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      const historicalDrafts = drafts.map((record) => projectHistoricalBusinessDraft(record));
      return json({
        mode: "business_action_drafts",
        contract: "business_historical_draft_reads_v4_full_posture",
        historicalOnly: true,
        reviewOnly: true,
        historicalContentRedacted: true,
        executable: false,
        deliverable: false,
        authoritativeForExecution: false,
        externalExecutionAllowed: false,
        ...businessReadPayload(historicalDrafts, "drafts"),
      });
    }
    if (request.method === "GET" && pathname === "/admin/business/approval-requests") {
      const approvals = await listBusinessApprovalRequests(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      const historicalApprovals = approvals.map((record) => projectHistoricalBusinessApproval(record));
      return json({
        mode: "business_approval_requests",
        contract: "business_historical_approval_reads_v4_full_posture",
        historicalOnly: true,
        reviewOnly: true,
        historicalContentRedacted: true,
        historicalIdentityRedacted: true,
        executable: false,
        deliverable: false,
        authoritativeForExecution: false,
        externalExecutionAllowed: false,
        ...businessReadPayload(historicalApprovals, "approvalRequests"),
      });
    }
    if (request.method === "GET" && pathname === "/admin/business/suppression") {
      const records = await listBusinessSuppression(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("active") !== "0");
      return json({
        mode: "business_suppression_list",
        contract: "business_suppression_reads_v2",
        safetyCritical: true,
        executable: false,
        deliverable: false,
        authoritativeForExecution: false,
        ...businessReadPayload(records, "suppression"),
      });
    }
    if (request.method === "GET" && pathname === "/admin/business/content-ideas") {
      const ideas = await listBusinessContentIdeas(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      const internalIdeas = ideas.map(projectInternalContentIdea);
      return json({
        mode: "business_content_ideas",
        contract: "business_content_idea_reads_v2_minimized",
        reviewOnly: true,
        detailsRedacted: true,
        executable: false,
        deliverable: false,
        authoritativeForExecution: false,
        ...businessReadPayload(internalIdeas, "contentIdeas"),
      });
    }
    if (request.method === "GET" && pathname === "/admin/business/followups") {
      const followups = await listBusinessFollowups(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      const internalFollowups = followups.map(projectInternalFollowup);
      return json({
        mode: "business_followups",
        contract: "business_followup_reads_v2_minimized",
        reviewOnly: true,
        detailsRedacted: true,
        identityLinksRedacted: true,
        executable: false,
        deliverable: false,
        authoritativeForExecution: false,
        ...businessReadPayload(internalFollowups, "followups"),
      });
    }
    if (request.method === "GET" && pathname === "/admin/business/learning") {
      const learning = await listBusinessLearningEvents(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("entityType") || undefined);
      const internalLearning = learning.map(projectInternalLearningRecord);
      return json({
        mode: "business_learning_events",
        contract: "business_learning_reads_v2_minimized",
        reviewOnly: true,
        detailsRedacted: true,
        executable: false,
        deliverable: false,
        authoritativeForExecution: false,
        ...businessReadPayload(internalLearning, "learningEvents"),
      });
    }

    if (request.method === "POST" && pathname === "/admin/business/organizations") {
      const parsed = await readBusinessMetadataWriteRequest(request, {
        entityKey: "organization",
        allowedEntityFields: new Set([
          "id", "name", "domain", "websiteUrl", "industry", "location", "sourceType", "sourceUrl",
          "fitScore", "priorityScore", "riskScore", "confidenceScore", "metadata",
        ]),
        requiredTextFields: new Set(["name"]),
        textFields: new Set(["id", "name", "domain", "websiteUrl", "industry", "location", "sourceType", "sourceUrl"]),
        objectFields: new Set(["metadata"]),
        numberFields: {
          fitScore: SCORE_RANGE,
          priorityScore: SCORE_RANGE,
          riskScore: SCORE_RANGE,
          confidenceScore: SCORE_RANGE,
        },
      });
      if (!parsed.ok) return json(parsed.payload, { status: parsed.status });
      const organization = await saveBusinessOrganization(
        env,
        parsed.entity as Parameters<typeof saveBusinessOrganization>[1],
      );
      return json({
        mode: "business_organization_saved",
        ...confirmedWriteMetadata(parsed.requestReceipt),
        ...businessWritePayload(organization, "organization"),
      });
    }
    if (request.method === "POST" && pathname === "/admin/business/signals") {
      const parsed = await readBusinessMetadataWriteRequest(request, {
        entityKey: "signal",
        allowedEntityFields: new Set([
          "id", "organizationId", "websiteId", "pageId", "signalType", "signalStrength",
          "evidenceSummary", "evidenceUrl", "confidenceScore", "riskFlags", "metadata",
        ]),
        requiredTextFields: new Set(["signalType"]),
        textFields: new Set(["id", "organizationId", "websiteId", "pageId", "signalType", "evidenceSummary", "evidenceUrl"]),
        arrayFields: new Set(["riskFlags"]),
        objectFields: new Set(["metadata"]),
        numberFields: { signalStrength: SCORE_RANGE, confidenceScore: SCORE_RANGE },
      });
      if (!parsed.ok) return json(parsed.payload, { status: parsed.status });
      const signal = await saveBusinessSignal(
        env,
        parsed.entity as Parameters<typeof saveBusinessSignal>[1],
      );
      return json({
        mode: "business_signal_saved",
        ...confirmedWriteMetadata(parsed.requestReceipt),
        ...businessWritePayload(signal, "signal"),
      });
    }
    if (request.method === "POST" && pathname === "/admin/business/opportunities") {
      const parsed = await readBusinessMetadataWriteRequest(request, {
        entityKey: "opportunity",
        allowedEntityFields: new Set([
          "id", "organizationId", "opportunityType", "recommendedService", "recommendedAngle", "nextStep",
          "fitScore", "needScore", "urgencyScore", "budgetLikelihoodScore", "contactabilityScore",
          "evidenceQualityScore", "riskScore", "confidenceScore", "metadata",
        ]),
        textFields: new Set(["id", "organizationId", "opportunityType", "recommendedService", "recommendedAngle", "nextStep"]),
        objectFields: new Set(["metadata"]),
        numberFields: {
          fitScore: SCORE_RANGE,
          needScore: SCORE_RANGE,
          urgencyScore: SCORE_RANGE,
          budgetLikelihoodScore: SCORE_RANGE,
          contactabilityScore: SCORE_RANGE,
          evidenceQualityScore: SCORE_RANGE,
          riskScore: SCORE_RANGE,
          confidenceScore: SCORE_RANGE,
        },
      });
      if (!parsed.ok) return json(parsed.payload, { status: parsed.status });
      const opportunity = await saveBusinessOpportunity(
        env,
        parsed.entity as Parameters<typeof saveBusinessOpportunity>[1],
      );
      return json({
        mode: "business_opportunity_saved",
        ...confirmedWriteMetadata(parsed.requestReceipt),
        ...businessWritePayload(opportunity, "opportunity"),
      });
    }
    if (request.method === "POST" && pathname === "/admin/business/service-matches") {
      const parsed = await readBusinessMetadataWriteRequest(request, {
        entityKey: "serviceMatch",
        allowedEntityFields: new Set([
          "id", "organizationId", "opportunityId", "signalId", "serviceKey", "matchScore", "reason", "evidence", "metadata",
        ]),
        requiredTextFields: new Set(["serviceKey"]),
        textFields: new Set(["id", "organizationId", "opportunityId", "signalId", "serviceKey", "reason"]),
        arrayFields: new Set(["evidence"]),
        objectFields: new Set(["metadata"]),
        numberFields: { matchScore: SCORE_RANGE },
      });
      if (!parsed.ok) return json(parsed.payload, { status: parsed.status });
      const serviceMatch = await saveBusinessServiceMatch(
        env,
        parsed.entity as Parameters<typeof saveBusinessServiceMatch>[1],
      );
      return json({
        mode: "business_service_match_saved",
        ...confirmedWriteMetadata(parsed.requestReceipt),
        ...businessWritePayload(serviceMatch, "serviceMatch"),
      });
    }
    if (request.method === "POST" && pathname === "/admin/business/audit-packs") {
      const parsed = await readBusinessMetadataWriteRequest(request, {
        entityKey: "auditPack",
        allowedEntityFields: new Set([
          "id", "organizationId", "organizationName", "domain", "websiteUrl", "industry", "location",
          "hasContactPath", "signals", "riskFlags", "notes", "opportunityId",
        ]),
        requiredTextFields: new Set(["organizationName"]),
        textFields: new Set(["id", "organizationId", "organizationName", "domain", "websiteUrl", "industry", "location", "notes", "opportunityId"]),
        arrayFields: new Set(["signals", "riskFlags"]),
        booleanFields: new Set(["hasContactPath"]),
      });
      if (!parsed.ok) return json(parsed.payload, { status: parsed.status });
      const auditPack = await saveBusinessAuditPack(
        env,
        parsed.entity as Parameters<typeof saveBusinessAuditPack>[1],
      );
      return json({
        mode: "business_audit_pack_saved",
        ...confirmedWriteMetadata(parsed.requestReceipt),
        ...businessWritePayload(auditPack, "auditPack"),
      });
    }
    if (request.method === "POST" && pathname === "/admin/business/action-drafts/build") {
      const parsed = await readBusinessMetadataWriteRequest(request, {
        entityKey: "draftRequest",
        allowedEntityFields: new Set([
          "intent", "organizationId", "organizationName", "personId", "opportunityId", "auditPackId",
          "recommendedService", "recommendedAngle", "evidenceSummary", "nextStep", "contactName", "tone",
        ]),
        textFields: new Set([
          "intent", "organizationId", "organizationName", "personId", "opportunityId", "auditPackId",
          "recommendedService", "recommendedAngle", "evidenceSummary", "nextStep", "contactName", "tone",
        ]),
      });
      if (!parsed.ok) return json(parsed.payload, { status: parsed.status });
      const built = buildBusinessDraftOnlyAction(
        parsed.entity as Parameters<typeof buildBusinessDraftOnlyAction>[0],
      );
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
        reviewChecklist: built.reviewChecklist,
        explicitBlocks: built.explicitBlocks,
        riskFlags: built.riskFlags,
        ...confirmedWriteMetadata(parsed.requestReceipt),
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
      const parsed = await readBusinessMetadataWriteRequest(request, {
        entityKey: "suppression",
        allowedEntityFields: new Set(["id", "scopeType", "scopeValue", "reason", "source", "active", "expiresAt", "metadata"]),
        textFields: new Set(["id", "scopeType", "scopeValue", "reason", "source", "expiresAt"]),
        booleanFields: new Set(["active"]),
        objectFields: new Set(["metadata"]),
      });
      if (!parsed.ok) return json(parsed.payload, { status: parsed.status });
      const normalized = normalizeBusinessSuppressionInput(parsed.entity);
      const suppression = markBusinessSuppressionRecord(await saveBusinessSuppression(env, normalized));
      return json({
        mode: "business_suppression_saved",
        contract: "business_suppression_integrity_v2",
        safetyCritical: true,
        forcedActive: true,
        automaticExpiryAllowed: false,
        executable: false,
        deliverable: false,
        authoritativeForExecution: false,
        ...confirmedWriteMetadata(parsed.requestReceipt),
        ...businessWritePayload(suppression, "suppression"),
      });
    }
    if (request.method === "POST" && pathname === "/admin/business/content-ideas") {
      const parsed = await readBusinessMetadataWriteRequest(request, {
        entityKey: "contentIdea",
        allowedEntityFields: new Set([
          "id", "title", "contentType", "summary", "sourceSignalIds", "targetSegment",
          "recommendedChannel", "priorityScore", "status", "metadata",
        ]),
        requiredTextFields: new Set(["title"]),
        textFields: new Set(["id", "title", "contentType", "summary", "targetSegment", "recommendedChannel", "status"]),
        arrayFields: new Set(["sourceSignalIds"]),
        objectFields: new Set(["metadata"]),
        numberFields: { priorityScore: SCORE_RANGE },
      });
      if (!parsed.ok) return json(parsed.payload, { status: parsed.status });
      const normalized = normalizeBusinessContentIdeaInput(parsed.entity);
      const contentIdea = markBusinessInternalPlanningRecord(await saveBusinessContentIdea(env, normalized));
      return json({
        mode: "business_content_idea_saved",
        reviewOnly: true,
        executable: false,
        deliverable: false,
        authoritativeForExecution: false,
        ...confirmedWriteMetadata(parsed.requestReceipt),
        ...businessWritePayload(contentIdea, "contentIdea"),
      });
    }
    if (request.method === "POST" && pathname === "/admin/business/followups") {
      const parsed = await readBusinessMetadataWriteRequest(request, {
        entityKey: "followup",
        allowedEntityFields: new Set([
          "id", "organizationId", "personId", "opportunityId", "actionDraftId", "followupType",
          "dueAt", "status", "notes", "metadata",
        ]),
        textFields: new Set(["id", "organizationId", "personId", "opportunityId", "actionDraftId", "followupType", "dueAt", "status", "notes"]),
        objectFields: new Set(["metadata"]),
      });
      if (!parsed.ok) return json(parsed.payload, { status: parsed.status });
      const normalized = normalizeBusinessFollowupInput(parsed.entity);
      const followup = markBusinessInternalPlanningRecord(await saveBusinessFollowup(env, normalized));
      return json({
        mode: "business_followup_saved",
        reviewOnly: true,
        executable: false,
        deliverable: false,
        authoritativeForExecution: false,
        ...confirmedWriteMetadata(parsed.requestReceipt),
        ...businessWritePayload(followup, "followup"),
      });
    }
    if (request.method === "POST" && pathname === "/admin/business/learning") {
      const parsed = await readBusinessMetadataWriteRequest(request, {
        entityKey: "learningEvent",
        allowedEntityFields: new Set(["id", "entityType", "entityId", "eventType", "outcome", "scoreDelta", "notes", "metadata"]),
        requiredTextFields: new Set(["entityId"]),
        textFields: new Set(["id", "entityType", "entityId", "eventType", "outcome", "notes"]),
        objectFields: new Set(["metadata"]),
        numberFields: { scoreDelta: { min: -10, max: 10 } },
      });
      if (!parsed.ok) return json(parsed.payload, { status: parsed.status });
      const normalized = normalizeBusinessLearningEventInput(parsed.entity);
      const learningEvent = markBusinessLearningEventRecord(await saveBusinessLearningEvent(env, normalized));
      return json({
        mode: "business_learning_event_saved",
        contract: "business_internal_learning_event_v2",
        reviewOnly: true,
        executable: false,
        deliverable: false,
        authoritativeForExecution: false,
        ...confirmedWriteMetadata(parsed.requestReceipt),
        ...businessWritePayload(learningEvent, "learningEvent"),
      });
    }

    return json({ ok: false, error: "not_found", path: pathname, method: request.method }, { status: 404 });
  } catch (error) {
    const normalized = migrationError(error);
    return json(normalized, { status: 500 });
  }
}
