import { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import {
  buildBusinessAuditObservationCandidates,
  businessAuditObservationCandidatePayload,
} from "../core/businessAutopilotAuditObservationCandidates";
import { businessAutopilotReadSafety } from "../core/businessAutopilotSafety";
import {
  businessWebsiteReadPayload,
  businessWebsiteWritePayload,
  listBusinessPages,
  listBusinessWebsites,
  saveBusinessPage,
  saveBusinessWebsite,
} from "../core/businessAutopilotWebsiteRecords";
import {
  readBusinessMetadataWriteRequest,
  type BusinessMetadataWriteReceipt,
} from "../core/businessMetadataWriteBoundary";
import { BUSINESS_SCORE_PROVENANCE_CONTRACT } from "../core/businessScoreProvenance";
import {
  listBusinessAuditObservationsWithScoreProvenance,
  listBusinessWebsiteAuditRunsWithScoreProvenance,
} from "../core/businessScoreProvenanceReaders";
import {
  saveBusinessAuditObservation,
  saveBusinessWebsiteAuditRun,
} from "../core/businessScoreProvenanceWriters";

export type JsonResponse = (data: any, init?: ResponseInit) => Response;

const schemaMissingMessage = "Business website/page schema is missing or unavailable.";
const scoreProvenanceMissingMessage = "Business website audit score provenance schema is missing or unavailable.";
const routeFailedMessage = "Business website/page route failed before a safe response could be returned.";
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

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function migrationError(error: unknown) {
  const message = errorText(error);
  const missingScoreProvenance = /(?:no such column:\s*[^\s]*_observed|has no column named\s+[^\s]*_observed)/i.test(message);
  const missingTable = /no such table: business_(websites|pages|website_audit_runs|audit_observations|signals)/i.test(message);
  const schemaMissing = missingScoreProvenance || missingTable;
  return {
    ok: false,
    mode: "business_website_error",
    error: schemaMissing ? "business_autopilot_schema_missing" : "business_website_failed",
    message: missingScoreProvenance
      ? scoreProvenanceMissingMessage
      : missingTable
        ? schemaMissingMessage
        : routeFailedMessage,
    requiredMigration: missingScoreProvenance
      ? "0024_business_score_observation_flags.sql"
      : missingTable
        ? "0021_business_autopilot_foundation.sql + 0022_business_website_audit_records.sql"
        : null,
    rawErrorExposed: false,
    safety: businessAutopilotReadSafety(),
  };
}

function scoreReadPayload<T>(items: T[], key: string) {
  return {
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
    ...businessWebsiteReadPayload(items, key),
  };
}

export async function handleBusinessAutopilotWebsiteAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET, POST" } });
  }
  const url = new URL(request.url);

  try {
    if (request.method === "GET" && pathname === "/admin/business/websites") {
      const websites = await listBusinessWebsites(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      return json({ mode: "business_websites", ...businessWebsiteReadPayload(websites, "websites") });
    }

    if (request.method === "POST" && pathname === "/admin/business/websites") {
      const parsed = await readBusinessMetadataWriteRequest(request, {
        entityKey: "website",
        allowedEntityFields: new Set([
          "id", "organizationId", "url", "domain", "status", "lastCheckedAt", "robotsStatus",
          "crawlAllowed", "techHints", "metadata",
        ]),
        requiredTextFields: new Set(["url"]),
        textFields: new Set(["id", "organizationId", "url", "domain", "status", "lastCheckedAt", "robotsStatus"]),
        arrayFields: new Set(["techHints"]),
        objectFields: new Set(["metadata"]),
        booleanFields: new Set(["crawlAllowed"]),
      });
      if (!parsed.ok) return json(parsed.payload, { status: parsed.status });
      const website = await saveBusinessWebsite(
        env,
        parsed.entity as Parameters<typeof saveBusinessWebsite>[1],
      );
      return json({
        mode: "business_website_saved",
        ...confirmedWriteMetadata(parsed.requestReceipt),
        ...businessWebsiteWritePayload(website, "website"),
      });
    }

    if (request.method === "GET" && pathname === "/admin/business/pages") {
      const pages = await listBusinessPages(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("pageType") || undefined);
      return json({ mode: "business_pages", ...businessWebsiteReadPayload(pages, "pages") });
    }

    if (request.method === "POST" && pathname === "/admin/business/pages") {
      const parsed = await readBusinessMetadataWriteRequest(request, {
        entityKey: "page",
        allowedEntityFields: new Set([
          "id", "websiteId", "organizationId", "url", "pageType", "title", "status",
          "lastFetchedAt", "httpStatus", "contentHash", "metadata",
        ]),
        requiredTextFields: new Set(["url"]),
        textFields: new Set(["id", "websiteId", "organizationId", "url", "pageType", "title", "status", "lastFetchedAt", "contentHash"]),
        objectFields: new Set(["metadata"]),
        numberFields: { httpStatus: { min: 100, max: 599, integer: true } },
      });
      if (!parsed.ok) return json(parsed.payload, { status: parsed.status });
      const page = await saveBusinessPage(
        env,
        parsed.entity as Parameters<typeof saveBusinessPage>[1],
      );
      return json({
        mode: "business_page_saved",
        ...confirmedWriteMetadata(parsed.requestReceipt),
        ...businessWebsiteWritePayload(page, "page"),
      });
    }

    if (request.method === "GET" && pathname === "/admin/business/website-audit-runs") {
      const auditRuns = await listBusinessWebsiteAuditRunsWithScoreProvenance(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      return json({ mode: "business_website_audit_runs", ...scoreReadPayload(auditRuns, "websiteAuditRuns") });
    }

    if (request.method === "POST" && pathname === "/admin/business/website-audit-runs") {
      const parsed = await readBusinessMetadataWriteRequest(request, {
        entityKey: "auditRun",
        allowedEntityFields: new Set([
          "id", "websiteId", "organizationId", "status", "auditType", "source", "requestedBy",
          "startedAt", "completedAt", "readinessScore", "riskScore", "confidenceScore", "summary", "metadata",
        ]),
        textFields: new Set(["id", "websiteId", "organizationId", "status", "auditType", "source", "requestedBy", "startedAt", "completedAt", "summary"]),
        objectFields: new Set(["metadata"]),
        numberFields: {
          readinessScore: SCORE_RANGE,
          riskScore: SCORE_RANGE,
          confidenceScore: SCORE_RANGE,
        },
      });
      if (!parsed.ok) return json(parsed.payload, { status: parsed.status });
      const auditRun = await saveBusinessWebsiteAuditRun(
        env,
        parsed.entity as Parameters<typeof saveBusinessWebsiteAuditRun>[1],
      );
      return json({
        mode: "business_website_audit_run_saved",
        ...confirmedWriteMetadata(parsed.requestReceipt),
        ...businessWebsiteWritePayload(auditRun, "websiteAuditRun"),
      });
    }

    if (request.method === "GET" && pathname === "/admin/business/audit-observations") {
      const observations = await listBusinessAuditObservationsWithScoreProvenance(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("category") || undefined);
      return json({ mode: "business_audit_observations", ...scoreReadPayload(observations, "auditObservations") });
    }

    if (request.method === "POST" && pathname === "/admin/business/audit-observations") {
      const parsed = await readBusinessMetadataWriteRequest(request, {
        entityKey: "observation",
        allowedEntityFields: new Set([
          "id", "auditRunId", "websiteId", "organizationId", "pageId", "signalId", "category",
          "severity", "title", "evidenceSummary", "recommendation", "confidenceScore", "metadata",
        ]),
        requiredTextFields: new Set(["title"]),
        textFields: new Set(["id", "auditRunId", "websiteId", "organizationId", "pageId", "signalId", "category", "severity", "title", "evidenceSummary", "recommendation"]),
        objectFields: new Set(["metadata"]),
        numberFields: { confidenceScore: SCORE_RANGE },
      });
      if (!parsed.ok) return json(parsed.payload, { status: parsed.status });
      const observation = await saveBusinessAuditObservation(
        env,
        parsed.entity as Parameters<typeof saveBusinessAuditObservation>[1],
      );
      return json({
        mode: "business_audit_observation_saved",
        ...confirmedWriteMetadata(parsed.requestReceipt),
        ...businessWebsiteWritePayload(observation, "auditObservation"),
      });
    }

    if (request.method === "GET" && pathname === "/admin/business/audit-observation-candidates") {
      const candidates = await buildBusinessAuditObservationCandidates(env, intParam(url, "limit", 25, 1, 50));
      return json(businessAuditObservationCandidatePayload(candidates));
    }

    return json({ ok: false, error: "not_found", path: pathname, method: request.method }, { status: 404 });
  } catch (error) {
    const normalized = migrationError(error);
    return json(normalized, { status: 500 });
  }
}
