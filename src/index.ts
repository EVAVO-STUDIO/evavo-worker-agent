import { dailyTick } from "./engine";
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

function jsonResponse(data: any, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function isOpportunityDiscoveryPath(pathname: string): boolean {
  return pathname.startsWith("/admin/opportunities/sources/") && (pathname.endsWith("/test") || pathname.endsWith("/preview"));
}

export default {
  async scheduled(_controller: any, env: Env, ctx: any) {
    ctx.waitUntil(dailyTick(env));
  },

  async fetch(req: Request, env: Env, ctx: any): Promise<Response> {
    try {
      const url = new URL(req.url);
      const pathname = url.pathname;

      if (isOpportunityDiscoveryPath(pathname)) {
        return await handleOpportunityDiscoveryAdmin(req, env, pathname, jsonResponse);
      }

      if (pathname.startsWith("/admin/opportunities")) {
        return await handleOpportunitiesAdmin(req, env, pathname, jsonResponse);
      }

      if (pathname === "/admin/planner/routes") {
        return await handlePlannerRoutesAdmin(req, env, pathname, jsonResponse);
      }

      if (pathname === "/admin/planner" || pathname.startsWith("/admin/planner/")) {
        return await handlePlannerAdmin(req, env, pathname, jsonResponse);
      }

      if (pathname === "/admin/sources/run-tiny") {
        return await handleSourceBatchAdmin(req, env, pathname, jsonResponse);
      }

      if (pathname.startsWith("/admin/sources") || pathname === "/admin/seeds") {
        return await handleSourcesAdmin(req, env, pathname, jsonResponse);
      }

      if (pathname.startsWith("/admin/draft-review") || pathname.startsWith("/admin/strategy-scores")) {
        return await handleDraftReviewAdmin(req, env, pathname, jsonResponse);
      }

      if (pathname.startsWith("/admin")) {
        return await handleAdmin(req, env, pathname, ctx, jsonResponse);
      }

      if (pathname.startsWith("/tools")) {
        return await handleTools(req, env, pathname, jsonResponse);
      }

      if (pathname.startsWith("/public")) {
        return await handlePublic(req, env, pathname, ctx, jsonResponse);
      }

      if (pathname === "/" || pathname === "") {
        return jsonResponse({ ok: true, message: "evavo-worker-agent" });
      }

      return jsonResponse({ ok: false, error: "not_found" }, { status: 404 });
    } catch (err: any) {
      return jsonResponse({ ok: false, error: String(err) }, { status: 500 });
    }
  },
};
