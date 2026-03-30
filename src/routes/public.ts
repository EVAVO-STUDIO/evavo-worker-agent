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
    case "scan_fail":
      return "A site scan failed and was logged for review.";
    case "draft_created":
      return "A draft was prepared for review.";
    case "draft_ok":
      return "Manual draft run completed.";
    case "draft_fail":
      return "A draft attempt failed and was logged.";
    case "send_ok":
      return "An approved email was sent.";
    case "send_fail":
      return "A send attempt failed.";
    case "send_skip":
      return "A send was skipped because controls blocked it.";
    case "unsubscribe":
      return "An unsubscribe request was recorded.";
    default:
      return message;
  }
}

async function getNumericSetting(env: Env, key: string, fallback = 0): Promise<number> {
  const raw = await getSetting(env, key);
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

async function buildPipeline(env: Env) {
  try {
    const leadStatusResult = (await env.DB.prepare(
      `SELECT status, COUNT(*) AS count
       FROM leads
       GROUP BY status`
    ).all()) as { results: Array<{ status: string | null; count: number }> };

    const draftStatusResult = (await env.DB.prepare(
      `SELECT status, COUNT(*) AS count
       FROM drafts
       GROUP BY status`
    ).all()) as { results: Array<{ status: string | null; count: number }> };

    const contactableRow = await env.DB.prepare(
      `SELECT COUNT(*) AS count
       FROM leads
       WHERE COALESCE(TRIM(contact_email), '') <> ''
          OR has_contact_form = 1`
    ).first<{ count: number }>();

    const topLeadRow = await env.DB.prepare(
      `SELECT website_url, company_name, category, score_total, status, updated_at_iso
       FROM leads
       ORDER BY score_total DESC, updated_at_iso DESC
       LIMIT 1`
    ).first<{
      website_url: string;
      company_name: string | null;
      category: string | null;
      score_total: number;
      status: string;
      updated_at_iso: string;
    }>();

    const byLeadStatus: Record<string, number> = {};
    for (const row of leadStatusResult.results || []) {
      byLeadStatus[String(row.status || "unknown")] = Number(row.count || 0);
    }

    const byDraftStatus: Record<string, number> = {};
    for (const row of draftStatusResult.results || []) {
      byDraftStatus[String(row.status || "unknown")] = Number(row.count || 0);
    }

    const totalLeads = Object.values(byLeadStatus).reduce((sum, count) => sum + Number(count || 0), 0);

    return {
      totalLeads,
      contactableLeads: Number(contactableRow?.count || 0),
      leads: byLeadStatus,
      drafts: byDraftStatus,
      readyToSend: Number(byDraftStatus.approved || 0),
      queuedDrafts: Number(byDraftStatus.created || 0) + Number(byDraftStatus.queued || 0),
      topLead: topLeadRow
        ? {
            website_url: topLeadRow.website_url,
            company_name: topLeadRow.company_name,
            category: topLeadRow.category,
            score_total: Number(topLeadRow.score_total || 0),
            status: topLeadRow.status,
            updated_at_iso: topLeadRow.updated_at_iso,
          }
        : null,
    };
  } catch {
    return {
      totalLeads: 0,
      contactableLeads: 0,
      leads: {},
      drafts: {},
      readyToSend: 0,
      queuedDrafts: 0,
      topLead: null,
    };
  }
}

async function buildTopSlices(env: Env) {
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
}

function publicModeSummary(input: {
  engineEnabled: boolean;
  sendingEnabled: boolean;
  readyToSend: number;
  queuedDrafts: number;
}): string {
  if (!input.engineEnabled) return "Engine paused. Discovery and drafting are currently disabled.";
  if (!input.sendingEnabled) {
    if (input.readyToSend > 0) {
      return "The assistant is running in review mode. It can discover and draft, but approved sending is still gated.";
    }
    if (input.queuedDrafts > 0) {
      return "The assistant is currently gathering and drafting opportunities while sending remains gated.";
    }
    return "The assistant is operating inside conservative discovery and drafting limits while sending remains gated.";
  }
  return "The assistant is operating inside conservative discovery, drafting, and approved sending limits.";
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
      try {
        lastRun = JSON.parse(lastRunRaw);
      } catch {
        lastRun = null;
      }
    }

    const crawlCap = Number((await getSetting(env, "crawl_cap_per_day")) || env.CAP_CRAWL_PER_DAY || 60);
    const draftCap = Number((await getSetting(env, "draft_cap_per_day")) || env.CAP_DRAFTS_PER_DAY || 25);
    const sendCap = Number((await getSetting(env, "send_cap_per_day")) || env.CAP_SEND_PER_DAY || 12);

    const crawlScannedToday = await getNumericSetting(env, "crawl_scanned_today", stats.leadsNewToday || 0);
    const draftsCreatedToday = await getNumericSetting(env, "drafts_created_today", stats.draftsCreatedToday || 0);
    const approvalsToday = await getNumericSetting(env, "approvals_today", stats.approvalsToday || 0);
    const sendsSentToday = await getNumericSetting(env, "sends_sent_today", stats.sendsSentToday || 0);
    const repliesToday = await getNumericSetting(env, "replies_today", stats.repliesToday || 0);
    const bouncesToday = await getNumericSetting(env, "bounces_today", stats.bouncesToday || 0);
    const unsubscribesToday = await getNumericSetting(env, "unsubscribes_today", stats.unsubscribesToday || 0);

    const pipeline = await buildPipeline(env);
    const topSlices = await buildTopSlices(env);

    const engineEnabled = ((await getSetting(env, "engine_enabled")) || "1") !== "0";
    const sendingEnabled =
      ((await getSetting(env, "sending_enabled")) || "0") !== "0" &&
      !!env.MAILCHANNELS_API_KEY &&
      !!env.FROM_EMAIL;

    return withCors(
      json({
        ok: true,
        nowISO: new Date().toISOString(),
        engine: {
          enabled: engineEnabled,
          sendingEnabled,
          pausedReason: (await getSetting(env, "engine_paused_reason")) || null,
          modeSummary: publicModeSummary({
            engineEnabled,
            sendingEnabled,
            readyToSend: Number(pipeline.readyToSend || 0),
            queuedDrafts: Number(pipeline.queuedDrafts || 0),
          }),
          lastRun,
        },
        budgets: {
          crawl: {
            scannedToday: crawlScannedToday,
            capPerDay: crawlCap,
            remaining: Math.max(0, crawlCap - crawlScannedToday),
          },
          ai: {
            usedToday: draftsCreatedToday,
            capPerDay: draftCap,
            remaining: Math.max(0, draftCap - draftsCreatedToday),
          },
          send: {
            sentToday: sendsSentToday,
            capPerDay: sendCap,
            remaining: Math.max(0, sendCap - sendsSentToday),
          },
        },
        stats: {
          leadsNewToday: stats.leadsNewToday || 0,
          draftsCreatedToday,
          approvalsToday,
          sendsSentToday,
          repliesToday,
          bouncesToday,
          unsubscribesToday,
        },
        pipeline,
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
