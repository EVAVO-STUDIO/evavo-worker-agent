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

function jsonResponse(data: any, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
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

export default {
  async scheduled(_controller: any, env: Env, ctx: any) {
    ctx.waitUntil(dailyTickWithAutonomy(env));
  },

  async fetch(req: Request, env: Env, ctx: any): Promise<Response> {
    try {
      const url = new URL(req.url);
      const pathname = url.pathname;

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
      if (pathname === "/admin/sources/run-tiny") return await handleSourceBatchAdmin(req, env, pathname, jsonResponse);
      if (pathname.startsWith("/admin/sources") || pathname === "/admin/seeds") return await handleSourcesAdmin(req, env, pathname, jsonResponse);
      if (pathname.startsWith("/admin/draft-review") || pathname.startsWith("/admin/strategy-scores")) return await handleDraftReviewAdmin(req, env, pathname, jsonResponse);
      if (pathname.startsWith("/admin")) return await handleAdmin(req, env, pathname, ctx, jsonResponse);
      if (pathname.startsWith("/tools")) return await handleTools(req, env, pathname, jsonResponse);
      if (pathname.startsWith("/public")) return await handlePublic(req, env, pathname, ctx, jsonResponse);
      if (pathname === "/" || pathname === "") return jsonResponse({ ok: true, message: "evavo-worker-agent" });
      return jsonResponse({ ok: false, error: "not_found" }, { status: 404 });
    } catch (err: any) {
      return jsonResponse({ ok: false, error: String(err) }, { status: 500 });
    }
  },
};
