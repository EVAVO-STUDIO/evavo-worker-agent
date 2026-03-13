import type { Env } from "../db";
import { addSuppression, getSetting, listEvents, logEvent, setSetting } from "../db";
import { getTodayStats } from "../engine";

function withCors(res: Response, origin: string | null) {
  const headers = new Headers(res.headers);
  headers.set("access-control-allow-origin", origin || "*");
  headers.set("access-control-allow-credentials", "true");
  headers.set("access-control-allow-headers", "Content-Type, Authorization");
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("vary", "Origin");
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(res.body, { status: res.status, headers });
}

function humanizePublicEvent(type: string, message: string) {
  switch (type) {
    case "tick_ok":
      return "System cycle completed.";
    case "discover_summary":
      return message.replace(/^Seed processed:\s*/i, "Discovery cycle: ");
    case "scan_ok":
      return message.replace(/^Scanned\s+/i, "Site scanned: ");
    case "scan_fail":
      return "A site scan failed.";
    case "draft_created":
      return "A draft was prepared for review.";
    case "draft_skip":
      return message;
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
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }), origin);
  }

  const path = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "");

  if (req.method === "GET" && path === "public/status") {
    const stats = await getTodayStats(env);
    const response = json({
      ok: true,
      nowISO: new Date().toISOString(),
      engine: {
        enabled: ((await getSetting(env, "engine_enabled")) || "1") !== "0",
        sendingEnabled:
          ((await getSetting(env, "sending_enabled")) || "0") !== "0" && !!env.MAILCHANNELS_API_KEY && !!env.FROM_EMAIL,
        pausedReason: (await getSetting(env, "engine_paused_reason")) || null,
      },
      budgets: {
        ai: {
          usedToday: Number((await getSetting(env, "ai_used_today")) || 0),
          capPerDay: Number((await getSetting(env, "draft_cap_per_day")) || 25),
          remaining: Math.max(0, Number((await getSetting(env, "draft_cap_per_day")) || 25) - Number((await getSetting(env, "ai_used_today")) || 0)),
        },
        crawl: {
          scannedToday: Number((await getSetting(env, "crawl_scanned_today")) || 0),
          capPerDay: Number((await getSetting(env, "crawl_cap_per_day")) || 60),
          remaining: Math.max(0, Number((await getSetting(env, "crawl_cap_per_day")) || 60) - Number((await getSetting(env, "crawl_scanned_today")) || 0)),
        },
        send: {
          sentToday: Number((await getSetting(env, "send_sent_today")) || 0),
          capPerDay: Number((await getSetting(env, "send_cap_per_day")) || 12),
          remaining: Math.max(0, Number((await getSetting(env, "send_cap_per_day")) || 12) - Number((await getSetting(env, "send_sent_today")) || 0)),
        },
      },
      stats: {
        leadsNewToday: stats.leadsNewToday,
        draftsCreatedToday: stats.draftsCreatedToday,
        approvalsToday: stats.approvalsToday,
        repliesToday: stats.repliesToday,
        bouncesToday: stats.bouncesToday,
        unsubscribesToday: stats.unsubscribesToday,
      },
      topSlices: [
        { label: "Partner overflow", value: 38 },
        { label: "Rebuilds", value: 34 },
        { label: "Teardowns", value: 28 },
      ],
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
