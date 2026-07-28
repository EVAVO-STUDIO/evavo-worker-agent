import { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import {
  buildBusinessAuditObservationCandidates,
  businessAuditObservationCandidatePayload,
} from "../core/businessAutopilotAuditObservationCandidates";
import { businessAutopilotMetadataWriteSafety, businessAutopilotReadSafety } from "../core/businessAutopilotSafety";
import {
  businessWebsiteReadPayload,
  businessWebsiteWritePayload,
  listBusinessPages,
  listBusinessWebsites,
  saveBusinessPage,
  saveBusinessWebsite,
} from "../core/businessAutopilotWebsiteRecords";
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
    reason: "Business website/page/audit writes require confirmation and only save internal metadata. They do not crawl, fetch, send, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems.",
    safety: businessAutopilotMetadataWriteSafety(),
  }, { status: 400 });
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
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const website = await saveBusinessWebsite(env, body.website || body);
      return json({ mode: "business_website_saved", ...businessWebsiteWritePayload(website, "website") });
    }

    if (request.method === "GET" && pathname === "/admin/business/pages") {
      const pages = await listBusinessPages(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("pageType") || undefined);
      return json({ mode: "business_pages", ...businessWebsiteReadPayload(pages, "pages") });
    }

    if (request.method === "POST" && pathname === "/admin/business/pages") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const page = await saveBusinessPage(env, body.page || body);
      return json({ mode: "business_page_saved", ...businessWebsiteWritePayload(page, "page") });
    }

    if (request.method === "GET" && pathname === "/admin/business/website-audit-runs") {
      const auditRuns = await listBusinessWebsiteAuditRunsWithScoreProvenance(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      return json({ mode: "business_website_audit_runs", ...scoreReadPayload(auditRuns, "websiteAuditRuns") });
    }

    if (request.method === "POST" && pathname === "/admin/business/website-audit-runs") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const auditRun = await saveBusinessWebsiteAuditRun(env, body.auditRun || body);
      return json({ mode: "business_website_audit_run_saved", ...businessWebsiteWritePayload(auditRun, "websiteAuditRun") });
    }

    if (request.method === "GET" && pathname === "/admin/business/audit-observations") {
      const observations = await listBusinessAuditObservationsWithScoreProvenance(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("category") || undefined);
      return json({ mode: "business_audit_observations", ...scoreReadPayload(observations, "auditObservations") });
    }

    if (request.method === "POST" && pathname === "/admin/business/audit-observations") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const observation = await saveBusinessAuditObservation(env, body.observation || body);
      return json({ mode: "business_audit_observation_saved", ...businessWebsiteWritePayload(observation, "auditObservation") });
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
