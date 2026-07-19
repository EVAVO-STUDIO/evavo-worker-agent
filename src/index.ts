import { dailyTickWithAutonomy } from "./engineAutonomy";
import type { Env } from "./db";
import { handlePublic } from "./routes/public";
import { handleAdmin } from "./routes/admin";
import { handleTools } from "./routes/tools";
import { handleDraftReviewAdmin } from "./routes/draftReviewAdmin";
import { handleSourcesAdmin } from "./routes/sourcesAdmin";
import { handleSourceBatchAdmin } from "./routes/sourceBatchAdmin";
import { handlePlannerAdmin } from "./routes/plannerAdmin";
import { handlePlannerRoutesAdmin } from "./routes/plannerRoutesAdmin";
import { handleGrowthAdmin } from "./routes/growthAdmin";
import { handleGrowthCapabilitiesAdmin } from "./routes/growthCapabilitiesAdmin";
import { handleGrowthCampaignIntelligenceAdmin } from "./routes/growthCampaignIntelligenceAdmin";
import { handleGrowthStrategyMemoryAdmin } from "./routes/growthStrategyMemoryAdmin";
import { handleGrowthBlackboardAdmin } from "./routes/growthBlackboardAdmin";
import { handleGrowthApprovalRequestsAdmin } from "./routes/growthApprovalRequestsAdmin";
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
import { matchesWorkerRouteFamily } from "./routes/workerRoutePolicy";

const unexpectedWorkerErrorMessage = "The Worker hit an unexpected internal error before a safe response could be returned.";
const HEALTH_CONTRACT_VERSION = "2026-07";

function jsonResponse(data: any, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

async function handleHealth(env: Env): Promise<Response> {
  const checkedAt = new Date().toISOString();
  if (!env.DB) {
    return jsonResponse(
      { ok: false, status: "unavailable", service: "evavo-worker-agent", version: HEALTH_CONTRACT_VERSION, database: "unavailable", checkedAt },
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
        service: "evavo-worker-agent",
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
      { ok: false, status: "unavailable", service: "evavo-worker-agent", version: HEALTH_CONTRACT_VERSION, database: "unavailable", checkedAt },
      { status: 503, headers: { "cache-control": "no-store", "x-evavo-worker-health-version": HEALTH_CONTRACT_VERSION } },
    );
  }
}

function isOpportunityDiscoveryPath(pathname: string): boolean {
  return pathname.startsWith("/admin/opportunities/sources/") && (pathname.endsWith("/test") || pathname.endsWith("/preview") || pathname.endsWith("/commit-preview"));
}

function isOpportunityReviewPath(pathname: string): boolean {
  return pathname === "/admin/opportunities/reviews" || pathname === "/admin/opportunities/strategy-scores" || (pathname.startsWith("/admin/opportunities/") && pathname.endsWith("/review"));
}

function isOpportunityRunAuditPath(pathname: string): boolean {
  return pathname === "/admin/opportunities/runs" || pathname.startsWith("/admin/opportunities/runs/");
}

function isOpportunitySourceHealthActionPath(pathname: string): boolean {
  return /^\/admin\/opportunities\/sources\/[^/]+\/health-action$/.test(pathname);
}

function isOpportunitySourceCandidatePath(pathname: string): boolean {
  return pathname === "/admin/opportunities/sources/candidates/preview" || pathname === "/admin/opportunities/sources/candidates/commit";
}

function isSourceExpansionPath(pathname: string): boolean {
  return pathname.startsWith("/admin/opportunities/sources/expansion/");
}

function isBusinessWebsitePath(pathname: string): boolean {
  return pathname === "/admin/business/websites"
    || pathname === "/admin/business/pages"
    || pathname === "/admin/business/website-audit-runs"
    || pathname === "/admin/business/audit-observations"
    || pathname === "/admin/business/audit-observation-candidates";
}

export default {
  async scheduled(_controller: any, env: Env, ctx: any) {
    ctx.waitUntil(dailyTickWithAutonomy(env));
  },

  async fetch(req: Request, env: Env, ctx: any): Promise<Response> {
    try {
      const url = new URL(req.url);
      const pathname = url.pathname;

      if (matchesWorkerRouteFamily("health", pathname)) return await handleHealth(env);
      if (pathname === "/admin/settings/autonomy") return await handleAutonomySettingsAdmin(req, env, pathname, jsonResponse);
      if (pathname === "/admin/opportunities/run-due") return await handleOpportunityRunDueAdmin(req, env, pathname, jsonResponse);
      if (isOpportunityRunAuditPath(pathname)) return await handleOpportunityRunsAdmin(req, env, pathname, jsonResponse);
      if (isOpportunitySourceHealthActionPath(pathname)) return await handleOpportunitySourceHealthActionsAdmin(req, env, pathname, jsonResponse);
      if (pathname === "/admin/opportunities/sources/origin-metrics") return await handleOpportunitySourceOriginMetricsAdmin(req, env, pathname, jsonResponse);
      if (pathname === "/admin/opportunities/sources/expansion/budget-recommendations") return await handleSourceExpansionBudgetRecommendationsAdmin(req, env, pathname, jsonResponse);
      if (pathname === "/admin/opportunities/sources/expansion/public-directory-scan") return await handleSourceExpansionPublicDirectoryScanAdmin(req, env, pathname, jsonResponse);
      if (pathname === "/admin/opportunities/sources/expansion/query-hints/resolve") return await handleSourceExpansionQueryHintResolverAdmin(req, env, pathname, jsonResponse);
      if (isSourceExpansionPath(pathname)) return await handleSourceExpansionAdmin(req, env, pathname, jsonResponse);
      if (isOpportunitySourceCandidatePath(pathname)) return await handleOpportunitySourceCandidatesAdmin(req, env, pathname, jsonResponse);
      if (pathname === "/admin/opportunities/sources/health") return await handleOpportunitySourceHealthAdmin(req, env, pathname, jsonResponse);
      if (pathname === "/admin/opportunities/scoring-diagnostics") return await handleOpportunityScoringDiagnosticsAdmin(req, env, pathname, jsonResponse);
      if (isOpportunityDiscoveryPath(pathname)) return await handleOpportunityDiscoveryAdmin(req, env, pathname, jsonResponse);
      if (pathname === "/admin/opportunities/learning") return await handleOpportunityLearningAdmin(req, env, pathname, jsonResponse);
      if (isOpportunityReviewPath(pathname)) return await handleOpportunityReviewAdmin(req, env, pathname, jsonResponse);
      if (pathname.startsWith("/admin/opportunities")) return await handleOpportunitiesAdmin(req, env, pathname, jsonResponse);
      if (pathname === "/admin/planner/routes") return await handlePlannerRoutesAdmin(req, env, pathname, jsonResponse);
      if (pathname === "/admin/planner" || pathname.startsWith("/admin/planner/")) return await handlePlannerAdmin(req, env, pathname, jsonResponse);
      if (pathname === "/admin/growth/approval-requests" || pathname === "/admin/growth/approval-requests/status") return await handleGrowthApprovalRequestsAdmin(req, env, pathname, jsonResponse);
      if (pathname === "/admin/growth/capabilities") return await handleGrowthCapabilitiesAdmin(req, env, pathname, jsonResponse);
      if (pathname === "/admin/growth/blackboard" || pathname === "/admin/growth/blackboard/facts" || pathname === "/admin/growth/blackboard/entities" || pathname === "/admin/growth/blackboard/relationships" || pathname === "/admin/growth/blackboard/signals" || pathname === "/admin/growth/blackboard/assets") return await handleGrowthBlackboardAdmin(req, env, pathname, jsonResponse);
      if (pathname === "/admin/growth/strategy-memory" || pathname === "/admin/growth/objectives" || pathname === "/admin/growth/key-results" || pathname === "/admin/growth/segments" || pathname === "/admin/growth/offers" || pathname === "/admin/growth/positioning" || pathname === "/admin/growth/runtime-constraints") return await handleGrowthStrategyMemoryAdmin(req, env, pathname, jsonResponse);
      if (pathname === "/admin/growth/autonomy" || pathname === "/admin/growth/cycle" || pathname === "/admin/growth/cycle/events" || pathname === "/admin/growth/cycle/record" || pathname === "/admin/growth/operator" || pathname === "/admin/growth/campaigns" || pathname === "/admin/growth/experiments" || pathname === "/admin/growth/decisions" || pathname === "/admin/growth/decisions/plan" || pathname === "/admin/growth/metrics" || pathname === "/admin/growth/evidence" || pathname === "/admin/growth/learning") return await handleGrowthCampaignIntelligenceAdmin(req, env, pathname, jsonResponse);
      if (pathname === "/admin/growth" || pathname.startsWith("/admin/growth/")) return await handleGrowthAdmin(req, env, pathname, jsonResponse);
      if (pathname === "/admin/business/people") return await handleBusinessAutopilotPeopleAdmin(req, env, pathname, jsonResponse);
      if (isBusinessWebsitePath(pathname)) return await handleBusinessAutopilotWebsiteAdmin(req, env, pathname, jsonResponse);
      if (pathname === "/admin/business" || pathname.startsWith("/admin/business/")) return await handleBusinessAutopilotAdmin(req, env, pathname, jsonResponse);
      if (pathname === "/admin/sources/run-tiny") return await handleSourceBatchAdmin(req, env, pathname, jsonResponse);
      if (pathname.startsWith("/admin/sources") || pathname === "/admin/seeds") return await handleSourcesAdmin(req, env, pathname, jsonResponse);
      if (pathname.startsWith("/admin/draft-review") || pathname.startsWith("/admin/strategy-scores")) return await handleDraftReviewAdmin(req, env, pathname, jsonResponse);
      if (matchesWorkerRouteFamily("admin", pathname)) return await handleAdmin(req, env, pathname, ctx, jsonResponse);
      if (matchesWorkerRouteFamily("tools", pathname)) return await handleTools(req, env, pathname, jsonResponse);
      if (matchesWorkerRouteFamily("public", pathname)) return await handlePublic(req, env, pathname, ctx, jsonResponse);
      if (matchesWorkerRouteFamily("root", pathname)) return jsonResponse({ ok: true, message: "evavo-worker-agent", health: "/health" });
      return jsonResponse({ ok: false, error: "not_found" }, { status: 404 });
    } catch {
      return jsonResponse({ ok: false, error: "worker_unexpected_error", message: unexpectedWorkerErrorMessage }, { status: 500 });
    }
  },
};
