import { dailyTickWithAutonomy } from "./engineAutonomy";
import type { Env } from "./db";
import { logEvent } from "./db";
import { isAdminRequestAuthorized } from "./core/adminAuthentication";
import { boundedJsonFailurePayload, isExplicitJsonConfirmation, readBoundedJsonObject } from "./core/boundedJsonRequest";
import {
  parseBusinessMetadataReadRouteQuery,
  preflightBusinessMetadataReadQuery,
} from "./core/businessMetadataReadBoundary";
import { handlePublic } from "./routes/public";
import { handleAdmin } from "./routes/adminProtected";
import { handleTools } from "./routes/tools";
import { handleDraftReviewAdmin } from "./routes/draftReviewAdmin";
import { handleSourcesAdmin } from "./routes/sourcesAdmin";
import { handleSourceBatchAdmin } from "./routes/sourceBatchAdmin";
import { handlePlannerAdmin } from "./routes/plannerAdminProtected";
import { handlePlannerRoutesAdmin } from "./routes/plannerRoutesAdmin";
import { handleGrowthAdmin } from "./routes/growthAdminProtected";
import { handleGrowthCapabilitiesAdmin } from "./routes/growthCapabilitiesAdmin";
import { handleGrowthCampaignIntelligenceAdmin } from "./routes/growthCampaignIntelligenceAdmin";
import { handleGrowthInternalOperatorPackAdmin } from "./routes/growthInternalOperatorPackAdmin";
import { handleGrowthStrategyMemoryAdmin } from "./routes/growthStrategyMemoryAdmin";
import { handleGrowthBlackboardAdmin } from "./routes/growthBlackboardAdmin";
import { handleGrowthApprovalRequestsAdmin } from "./routes/growthApprovalRequestsAdmin";
import { handleBusinessAccount360Admin } from "./routes/businessAccount360Admin";
import { handleBusinessAutopilotAdmin } from "./routes/businessAutopilotAdmin";
import { handleBusinessAutopilotWebsiteAdmin } from "./routes/businessAutopilotWebsiteAdmin";
import { handleBusinessAutopilotPeopleAdmin } from "./routes/businessAutopilotPeopleAdmin";
import { handleOpportunitiesAdmin } from "./routes/opportunitiesAdmin";
import { handleOpportunityDiscoveryAdmin } from "./routes/opportunityDiscoveryAdmin";
import { handleOpportunityReviewAdmin } from "./routes/opportunityReviewAdmin";
import { handleOpportunityLearningAdmin } from "./routes/opportunityLearningAdmin";
import { handleOpportunityRunDueAdmin } from "./routes/opportunityRunDueAdmin";
import { handleOpportunityRunsAdmin } from "./routes/opportunityRunsAdmin";
import { handleOpportunitySourceHealthAdmin } from "./routes/opportunitySourceHealthAdmin";
import { handleOpportunitySourceHealthActionsAdmin } from "./routes/opportunitySourceHealthActionsAdmin";
import { handleOpportunityScoringDiagnosticsAdmin } from "./routes/opportunityScoringDiagnosticsAdmin";
import { handleOpportunitySourceCandidatesAdmin } from "./routes/opportunitySourceCandidatesAdmin";
import { handleOpportunitySourceOriginMetricsAdmin } from "./routes/opportunitySourceOriginMetricsAdmin";
import { handleSourceExpansionAdmin } from "./routes/sourceExpansionAdmin";
import { handleSourceExpansionQueryHintResolverAdmin } from "./routes/sourceExpansionQueryHintResolverAdmin";
import { handleSourceExpansionBudgetRecommendationsAdmin } from "./routes/sourceExpansionBudgetRecommendationsAdmin";
import { handleSourceExpansionPublicDirectoryScanAdmin } from "./routes/sourceExpansionPublicDirectoryScanAdmin";
import { handleAutonomySettingsAdmin } from "./routes/autonomySettingsAdmin";
import { handleLegacyExecutionSafetyAdmin } from "./routes/legacyExecutionSafetyAdmin";
import { resolveBusinessRouteHandlerId } from "./routes/businessRoutePolicy";
import { resolveGrowthRouteHandlerId } from "./routes/growthRoutePolicy";
import { resolveOperationsRouteHandlerId } from "./routes/operationsRoutePolicy";
import { resolveOpportunityRouteHandlerId } from "./routes/opportunityRoutePolicy";
import { matchesWorkerRouteFamily } from "./routes/workerRoutePolicy";

const unexpectedWorkerErrorMessage = "The Worker hit an unexpected internal error before a safe response could be returned.";
const HEALTH_CONTRACT_VERSION = "2026-07";
const PUBLIC_SERVICE_NAME = "EVAVO Growth Research Worker";

function jsonResponse(data: any, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function sourceActionRequiresConfirmation(pathname: string, method: string): boolean {
  if (method !== "POST") return false;
  if (pathname === "/admin/sources" || pathname === "/admin/seeds" || pathname === "/admin/sources/run-tiny") return true;
  return /^\/admin\/sources\/[^/]+\/(test|expand-preview|expand-commit|cooldown|retire|activate)$/.test(pathname);
}

async function sourceActionConfirmationFailure(request: Request, pathname: string): Promise<Response | null> {
  if (!sourceActionRequiresConfirmation(pathname, request.method)) return null;
  const parsed = await readBoundedJsonObject(request.clone());
  if (!parsed.ok) return jsonResponse(boundedJsonFailurePayload(parsed), { status: parsed.status });
  if (isExplicitJsonConfirmation(parsed.value)) return null;
  return jsonResponse({
    ok: false,
    error: "confirm_required",
    requiredPayload: { confirm: true },
    confirmationCoercionAllowed: false,
    requestBodyContract: parsed.contract,
    reason: "Source writes and bounded source-network actions require exact JSON confirmation. No AI, email, posting, form submission, browser automation, or third-party mutation is performed.",
  }, { status: 400 });
}

async function handleHealth(env: Env): Promise<Response> {
  const checkedAt = new Date().toISOString();
  if (!env.DB) {
    return jsonResponse(
      { ok: false, status: "unavailable", service: PUBLIC_SERVICE_NAME, version: HEALTH_CONTRACT_VERSION, database: "unavailable", checkedAt },
      { status: 503, headers: { "cache-control": "no-store", "x-evavo-worker-health-version": HEALTH_CONTRACT_VERSION } },
    );
  }

  try {
    const result = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    const databaseReady = Number(result?.ok) === 1;
    return jsonResponse(
      {
        ok: databaseReady,
        status: databaseReady ? "ok" : "unavailable",
        service: PUBLIC_SERVICE_NAME,
        version: HEALTH_CONTRACT_VERSION,
        database: databaseReady ? "ok" : "unavailable",
        checkedAt,
      },
      {
        status: databaseReady ? 200 : 503,
        headers: { "cache-control": "no-store", "x-evavo-worker-health-version": HEALTH_CONTRACT_VERSION },
      },
    );
  } catch {
    return jsonResponse(
      { ok: false, status: "unavailable", service: PUBLIC_SERVICE_NAME, version: HEALTH_CONTRACT_VERSION, database: "unavailable", checkedAt },
      { status: 503, headers: { "cache-control": "no-store", "x-evavo-worker-health-version": HEALTH_CONTRACT_VERSION } },
    );
  }
}

async function runScheduledSafely(env: Env): Promise<void> {
  if (!env.DB) {
    console.error("scheduled_autonomy_unavailable");
    return;
  }

  try {
    await dailyTickWithAutonomy(env);
  } catch {
    console.error("scheduled_autonomy_failed");
    try {
      await logEvent(env, "scheduled_autonomy_failed", "Scheduled autonomy stopped safely after an unexpected internal failure.");
    } catch {
      // The original failure may be a D1 outage. Do not retry, throw, or invoke an alternate execution path.
    }
  }
}

export default {
  async scheduled(_controller: any, env: Env, ctx: any) {
    ctx.waitUntil(runScheduledSafely(env));
  },

  async fetch(req: Request, env: Env, ctx: any): Promise<Response> {
    try {
      const url = new URL(req.url);
      const pathname = url.pathname;

      if (matchesWorkerRouteFamily("health", pathname)) return await handleHealth(env);

      const protectedRoute =
        matchesWorkerRouteFamily("admin", pathname) ||
        matchesWorkerRouteFamily("tools", pathname);
      if (protectedRoute && !(await isAdminRequestAuthorized(req, env))) {
        return jsonResponse({ ok: false, error: "Unauthorized" }, { status: 401 });
      }

      const sourceConfirmationFailure = await sourceActionConfirmationFailure(req, pathname);
      if (sourceConfirmationFailure) return sourceConfirmationFailure;

      const businessReadPreflight = preflightBusinessMetadataReadQuery(url, pathname, req.method);
      if (businessReadPreflight && !businessReadPreflight.ok) {
        return jsonResponse(businessReadPreflight.payload, { status: businessReadPreflight.status });
      }

      const businessReadQuery = parseBusinessMetadataReadRouteQuery(url, pathname, req.method);
      if (businessReadQuery && !businessReadQuery.ok) {
        return jsonResponse(businessReadQuery.payload, { status: businessReadQuery.status });
      }

      switch (resolveOpportunityRouteHandlerId(pathname)) {
        case "run-due":
          return await handleOpportunityRunDueAdmin(req, env, pathname, jsonResponse);
        case "runs":
          return await handleOpportunityRunsAdmin(req, env, pathname, jsonResponse);
        case "source-health-action":
          return await handleOpportunitySourceHealthActionsAdmin(req, env, pathname, jsonResponse);
        case "origin-metrics":
          return await handleOpportunitySourceOriginMetricsAdmin(req, env, pathname, jsonResponse);
        case "expansion-budget-recommendations":
          return await handleSourceExpansionBudgetRecommendationsAdmin(req, env, pathname, jsonResponse);
        case "public-directory-scan":
          return await handleSourceExpansionPublicDirectoryScanAdmin(req, env, pathname, jsonResponse);
        case "query-hint-resolver":
          return await handleSourceExpansionQueryHintResolverAdmin(req, env, pathname, jsonResponse);
        case "source-expansion":
          return await handleSourceExpansionAdmin(req, env, pathname, jsonResponse);
        case "source-candidates":
          return await handleOpportunitySourceCandidatesAdmin(req, env, pathname, jsonResponse);
        case "source-health":
          return await handleOpportunitySourceHealthAdmin(req, env, pathname, jsonResponse);
        case "scoring-diagnostics":
          return await handleOpportunityScoringDiagnosticsAdmin(req, env, pathname, jsonResponse);
        case "discovery":
          return await handleOpportunityDiscoveryAdmin(req, env, pathname, jsonResponse);
        case "learning":
          return await handleOpportunityLearningAdmin(req, env, pathname, jsonResponse);
        case "review":
          return await handleOpportunityReviewAdmin(req, env, pathname, jsonResponse);
        case "opportunities-fallback":
          return await handleOpportunitiesAdmin(req, env, pathname, jsonResponse);
        default:
          break;
      }

      switch (resolveGrowthRouteHandlerId(pathname)) {
        case "approval-requests":
          return await handleGrowthApprovalRequestsAdmin(req, env, pathname, jsonResponse);
        case "operator-artifacts":
          return await handleGrowthInternalOperatorPackAdmin(req, env, pathname, jsonResponse);
        case "capabilities":
          return await handleGrowthCapabilitiesAdmin(req, env, pathname, jsonResponse);
        case "blackboard":
          return await handleGrowthBlackboardAdmin(req, env, pathname, jsonResponse);
        case "strategy-memory":
          return await handleGrowthStrategyMemoryAdmin(req, env, pathname, jsonResponse);
        case "campaign-intelligence":
          return await handleGrowthCampaignIntelligenceAdmin(req, env, pathname, jsonResponse);
        case "growth-fallback":
          return await handleGrowthAdmin(req, env, pathname, jsonResponse);
        default:
          break;
      }

      switch (resolveBusinessRouteHandlerId(pathname)) {
        case "account-intelligence":
          return await handleBusinessAccount360Admin(req, env, pathname, jsonResponse);
        case "business-historical":
        case "business-fallback":
          return await handleBusinessAutopilotAdmin(req, env, pathname, jsonResponse);
        case "people":
          return await handleBusinessAutopilotPeopleAdmin(req, env, pathname, jsonResponse);
        case "website-audit":
          return await handleBusinessAutopilotWebsiteAdmin(req, env, pathname, jsonResponse);
        default:
          break;
      }

      switch (resolveOperationsRouteHandlerId(pathname)) {
        case "legacy-admin-safety":
          return await handleLegacyExecutionSafetyAdmin(req, env, pathname, jsonResponse);
        case "autonomy-settings":
          return await handleAutonomySettingsAdmin(req, env, pathname, jsonResponse);
        case "planner-routes":
          return await handlePlannerRoutesAdmin(req, env, pathname, jsonResponse);
        case "planner":
          return await handlePlannerAdmin(req, env, pathname, jsonResponse);
        case "source-batch":
          return await handleSourceBatchAdmin(req, env, pathname, jsonResponse);
        case "sources":
          return await handleSourcesAdmin(req, env, pathname, jsonResponse);
        case "draft-review":
        case "strategy-scores":
          return await handleDraftReviewAdmin(req, env, pathname, jsonResponse);
        default:
          break;
      }

      if (matchesWorkerRouteFamily("admin", pathname)) return await handleAdmin(req, env, pathname, ctx, jsonResponse);
      if (matchesWorkerRouteFamily("tools", pathname)) return await handleTools(req, env, pathname, jsonResponse);
      if (matchesWorkerRouteFamily("public", pathname)) return await handlePublic(req, env, pathname, ctx, jsonResponse);
      if (matchesWorkerRouteFamily("root", pathname)) return jsonResponse({ ok: true, service: PUBLIC_SERVICE_NAME, health: "/health" });
      return jsonResponse({ ok: false, error: "not_found" }, { status: 404 });
    } catch {
      return jsonResponse({ ok: false, error: "worker_unexpected_error", message: unexpectedWorkerErrorMessage }, { status: 500 });
    }
  },
};
