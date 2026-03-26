import { dailyTick, runScanOnce } from "./engine";
import type { Env } from "./db";
import { handlePublic } from "./routes/public";
import { handleAdmin } from "./routes/admin";

/**
 * Entry point for the Cloudflare Worker. This module dispatches HTTP
 * requests to either the public or admin routers and wires up cron
 * invocation of the engine cycle. All responses are JSON encoded by
 * default. Errors are caught and returned with a 500 status.
 */

function jsonResponse(data: any, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export default {
  /**
   * Handle scheduled cron events. A daily cron should be configured in
   * wrangler.toml to hit this handler. Cron events always run the full
   * engine cycle via `dailyTick`.
   */
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(dailyTick(env));
  },

  /**
   * Handle HTTP requests. Routes are separated into public and admin
   * namespaces. Unknown paths return a simple JSON 404.
   */
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(req.url);
      const path = url.pathname.replace(/^\/+/, "");
      if (path.startsWith("admin/")) {
        return await handleAdmin(req, env, ctx, url, jsonResponse);
      }
      if (path.startsWith("public/")) {
        return await handlePublic(req, env, ctx, url, jsonResponse);
      }
      // Root path can return a simple health check
      if (path === "" || path === "/") {
        return jsonResponse({ ok: true, message: "evavo-worker-agent" });
      }
      return jsonResponse({ ok: false, error: "not_found" }, { status: 404 });
    } catch (err: any) {
      return jsonResponse({ ok: false, error: String(err) }, { status: 500 });
    }
  },
};