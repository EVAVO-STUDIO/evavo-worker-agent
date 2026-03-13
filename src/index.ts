import { handleAdmin } from "./routes/admin";
import { handlePublic } from "./routes/public";
import type { Env } from "./db";
import { dailyTick, sendApprovedBatch } from "./engine";
import { logEvent } from "./db";

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
}

function unauthorized() {
  return json({ ok: false, error: "unauthorized" }, { status: 401 });
}

function notFound() {
  return json({ ok: false, error: "not_found" }, { status: 404 });
}

function withNormalizedPath(req: Request) {
  const url = new URL(req.url);
  const normalized = url.pathname.replace(/^\/api\//, "/");
  if (normalized !== url.pathname) {
    const next = new URL(req.url);
    next.pathname = normalized;
    return { req: new Request(next.toString(), req), url: next, path: normalized.replace(/^\/+/, "").replace(/\/+$/, "") };
  }
  return { req, url, path: url.pathname.replace(/^\/+/, "").replace(/\/+$/, "") };
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const normalized = withNormalizedPath(req);
    if (normalized.path.startsWith("admin/")) {
      const token = normalized.req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
      if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return unauthorized();
      return handleAdmin(normalized.req, env, ctx, normalized.url, json);
    }
    if (normalized.path.startsWith("public/")) {
      return handlePublic(normalized.req, env, ctx, normalized.url, json);
    }
    if (normalized.path === "" || normalized.path === "health") {
      return json({ ok: true, name: env.PUBLIC_ENGINE_NAME || "EVAVO Outbound Assistant" });
    }
    return notFound();
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    if (event.cron === "0 * * * *") {
      ctx.waitUntil(dailyTick(env).catch(() => null));
      return;
    }
    if (event.cron === "15 2 * * *") {
      ctx.waitUntil(
        (async () => {
          try {
            await sendApprovedBatch(env);
          } catch (error: any) {
            await logEvent(env, "cron_send_fail", `Scheduled send failed: ${String(error?.message || error).slice(0, 500)}`);
          }
        })()
      );
    }
  },
};
