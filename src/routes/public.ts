import type { Env } from "../db";
import {
  getTodayStats,
  getSetting,
  listEvents,
  addSuppression,
  logEvent,
  setSetting,
} from "../db";

/**
 * Apply CORS headers to a response. Public API responses always include CORS
 * headers allowing any origin. The caller’s origin header is echoed if
 * present; otherwise '*' is used.
 */
function withCors(res: Response, origin: string | null): Response {
  const headers = new Headers(res.headers);
  headers.set("access-control-allow-origin", origin || "*");
  headers.set("access-control-allow-credentials", "true");
  headers.set("access-control-allow-headers", "Content-Type, Authorization");
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("vary", "Origin");
  return new Response(res.body, { status: res.status, headers });
}

function humanizePublicEvent(type: string, message: string): string {
  switch (type) {
    case "tick_ok":
      return "System cycle completed.";
    case "tick_fail":
      return "System cycle failed.";
    case "scan_ok":
      return message.replace(/^Scanned\s+/i, "Site scanned: ");
    case "draft_created":
      return "A draft was prepared for review.";
    case "send_ok":
      return "An approved email was sent.";
    case "send_fail":
      return "A send attempt failed.";
    default:
      return message;
  }
}

export async function handlePublic(
  req: Request,
  env: Env,
  _ctx: ExecutionContext,
  url: URL,
  json: (data: any, init?: ResponseInit) => Response
): Promise<Response> {
  const origin = req.headers.get("origin");
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }), origin);
  }
  const path = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "");

  if (req.method === "GET" && path === "public/status") {
    // Gather engine status and budgets
    const stats = await getTodayStats(env);
    const lastRunRaw = (await getSetting(env, "last_engine_run")) || null;
    let lastRun: any = null;
    if (lastRunRaw) {
      try {
        lastRun = JSON.parse(lastRunRaw);
      } catch {
        lastRun = null;
      }
    }
    // Daily caps (default values if missing)
    const crawlCap = Number((await getSetting(env, "crawl_cap_per_day")) || 50);
    const aiCap = Number((await getSetting(env, "draft_cap_per_day")) || 30);
    const sendCap = Number((await getSetting(env, "send_cap_per_day")) || 25);
    // Compute budgets
    const budgets = {
      crawl: {
        scannedToday: stats.leadsNewToday,
        capPerDay: crawlCap,
        remaining: Math.max(0, crawlCap - stats.leadsNewToday),
      },
      ai: {
        usedToday: stats.draftsCreatedToday,
        capPerDay: aiCap,
        remaining: Math.max(0, aiCap - stats.draftsCreatedToday),
      },
      send: {
        // Use approvalsToday as a proxy for sent emails since sends follow approvals
        sentToday: stats.approvalsToday,
        capPerDay: sendCap,
        remaining: Math.max(0, sendCap - stats.approvalsToday),
      },
    };
    // Compute top slices (classification distribution)
    async function computeTopSlices(): Promise<{ label: string; value: number }[]> {
      try {
        const { results } = (await env.DB.prepare(
          `SELECT json_extract(data, '$.classification') as class, COUNT(*) as count FROM leads WHERE data IS NOT NULL GROUP BY class`
        ).all()) as { results: any[] };
        const total = results.reduce((sum, r) => sum + (Number(r.count) || 0), 0) || 0;
        const slices = results
          .map((r) => ({ label: r.class || "unknown", value: total ? Math.round((Number(r.count) / total) * 100) : 0 }))
          .filter((r) => r.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, 3);
        return slices;
      } catch {
        return [];
      }
    }
    const topSlices = await computeTopSlices();
    const response = json({
      ok: true,
      nowISO: new Date().toISOString(),
      engine: {
        enabled: ((await getSetting(env, "engine_enabled")) || "1") !== "0",
        sendingEnabled:
          ((await getSetting(env, "sending_enabled")) || "0") !== "0" &&
          !!env.MAILCHANNELS_API_KEY &&
          !!env.FROM_EMAIL,
        pausedReason: (await getSetting(env, "engine_paused_reason")) || null,
        lastRun,
      },
      budgets,
      stats,
      topSlices,
    });
    return withCors(response, origin);
  }

  if (req.method === "GET" && path === "public/events") {
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 18)));
    const events = await listEvents(env, limit);
    const response = json({
      ok: true,
      events: events.map((event) => ({
        id: event.id,
        type: event.type,
        message: humanizePublicEvent(event.type, event.message),
        created_at_iso: event.created_at_iso,
      })),
    });
    return withCors(response, origin);
  }

  if (req.method === "GET" && path === "public/unsubscribe") {
    const email = (url.searchParams.get("email") || "").trim().toLowerCase();
    if (!email) return withCors(json({ ok: false, error: "missing_email" }, { status: 400 }), origin);
    await addSuppression(env, email, "unsubscribed");
    await logEvent(env, "unsubscribe", `Unsubscribed ${email}`);
    return withCors(json({ ok: true, email }), origin);
  }

  if (req.method === "POST" && path === "public/pause") {
    const key = req.headers.get("x-public-key") || "";
    if (!env.PUBLIC_CONTROL_KEY || key !== env.PUBLIC_CONTROL_KEY) {
      return withCors(json({ ok: false, error: "unauthorized" }, { status: 401 }), origin);
    }
    const body = await req.json().catch(() => ({}));
    const reason = typeof body?.reason === "string" ? body.reason.slice(0, 200) : "manual pause";
    await setSetting(env, "engine_enabled", "0");
    await setSetting(env, "engine_paused_reason", reason);
    await logEvent(env, "public_pause", `Engine paused: ${reason}`);
    return withCors(json({ ok: true }), origin);
  }

  return withCors(json({ ok: false, error: "not_found" }, { status: 404 }), origin);
}