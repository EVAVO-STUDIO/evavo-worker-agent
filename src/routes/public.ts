import type { Env } from "../db";
import { getTodayStats, getSetting, listEvents, addSuppression, logEvent, setSetting } from "../db";

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
  if (req.method === "OPTIONS") return withCors(new Response(null, { status: 204 }), origin);
  const path = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "");

  if (req.method === "GET" && path === "public/status") {
    const stats = await getTodayStats(env);
    const lastRunRaw = (await getSetting(env, "last_engine_run")) || null;
    let lastRun: any = null;
    if (lastRunRaw) {
      try { lastRun = JSON.parse(lastRunRaw); } catch {}
    }

    const crawlCap = Number((await getSetting(env, "crawl_cap_per_day")) || env.CAP_CRAWL_PER_DAY || 60);
    const draftCap = Number((await getSetting(env, "draft_cap_per_day")) || env.CAP_DRAFTS_PER_DAY || 25);
    const sendCap = Number((await getSetting(env, "send_cap_per_day")) || env.CAP_SEND_PER_DAY || 12);

    const topSlices = await (async () => {
      try {
        const { results } = (await env.DB.prepare(
          `SELECT category, COUNT(*) as count
           FROM leads
           GROUP BY category
           ORDER BY count DESC
           LIMIT 6`
        ).all()) as { results: Array<{ category: string | null; count: number }> };
        const total = (results || []).reduce((sum, row) => sum + Number(row.count || 0), 0);
        return (results || []).map((row) => ({
          label: row.category || "unknown",
          value: total ? Math.round((Number(row.count || 0) / total) * 100) : 0,
        }));
      } catch {
        return [];
      }
    })();

    return withCors(
      json({
        ok: true,
        nowISO: new Date().toISOString(),
        engine: {
          enabled: ((await getSetting(env, "engine_enabled")) || "1") !== "0",
          sendingEnabled: ((await getSetting(env, "sending_enabled")) || "0") !== "0" && !!env.MAILCHANNELS_API_KEY && !!env.FROM_EMAIL,
          pausedReason: (await getSetting(env, "engine_paused_reason")) || null,
          lastRun,
        },
        budgets: {
          crawl: {
            scannedToday: stats.leadsNewToday,
            capPerDay: crawlCap,
            remaining: Math.max(0, crawlCap - stats.leadsNewToday),
          },
          ai: {
            usedToday: stats.draftsCreatedToday,
            capPerDay: draftCap,
            remaining: Math.max(0, draftCap - stats.draftsCreatedToday),
          },
          send: {
            sentToday: stats.sendsSentToday,
            capPerDay: sendCap,
            remaining: Math.max(0, sendCap - stats.sendsSentToday),
          },
        },
        stats,
        topSlices,
      }),
      origin
    );
  }

  if (req.method === "GET" && path === "public/events") {
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 18)));
    const events = await listEvents(env, limit);
    return withCors(
      json({
        ok: true,
        events: events.map((event) => ({
          id: event.id,
          type: event.type,
          message: humanizePublicEvent(event.type, event.message),
          created_at_iso: event.created_at_iso,
        })),
      }),
      origin
    );
  }

  if (req.method === "GET" && path === "public/unsubscribe") {
    const email = String(url.searchParams.get("email") || "").trim().toLowerCase();
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
