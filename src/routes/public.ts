
import { Env, getSetting, listEvents, listLeads, parseLeadSignals } from "../db";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

function defaultJson(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "Content-Type, Authorization",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      ...(init.headers || {}),
    },
  });
}

function inferKind(lead: any): string {
  const hay = JSON.stringify({
    website: lead.website_url || "",
    category: lead.category || "",
    signals_json: lead.signals_json || "",
  }).toLowerCase();

  if (/(agency|studio|creative|branding|white label|partner|developers|software studio)/.test(hay)) return "agency";
  if (/(builder|construction|joinery|cabinet|plumber|electrician|roofing|glazing|concrete|carpentry|landscap|civil contractor|earthworks|fabrication|dentist|lawyer|accountant|clinic|cleaning|mechanic)/.test(hay)) return "service";
  if (/(ecommerce|shopify|checkout|cart|product)/.test(hay)) return "ecommerce";
  if (/(government|school|university|charity|nonprofit|not-for-profit|foundation)/.test(hay)) return "not_fit";
  return "general";
}

function parseMaybeJson(raw: any) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

function buildEventSnapshot(event: any) {
  const message = String(event?.message || "");
  const scanned = Number(message.match(/scanned (\d+)/i)?.[1] || 0);
  const expanded = Number(message.match(/expanded (\d+)/i)?.[1] || 0);
  const failed = Number(message.match(/failed (\d+)/i)?.[1] || 0);
  const drafted = Number(message.match(/drafted (\d+)/i)?.[1] || 0);
  const sent = Number(message.match(/sent (\d+)/i)?.[1] || 0);

  let runMode: "tick" | "manual_scan" | "manual_draft" | "manual_send" = "tick";
  const type = String(event?.type || "");
  if (type === "scan_ok") runMode = "manual_scan";
  else if (type === "draft_ok") runMode = "manual_draft";
  else if (type === "send_ok") runMode = "manual_send";

  return {
    runId: event?.id || null,
    started_at_iso: event?.created_at_iso || null,
    completed_at_iso: event?.created_at_iso || null,
    scanned,
    expanded,
    skipped: 0,
    skippedReasons: {},
    candidateDiagnostics: {},
    failed,
    drafted,
    sent,
    sendFailed: 0,
    runMode,
    inferredFromEvent: true,
  };
}

export async function handlePublic(
  request: Request,
  env: Env,
  pathname: string,
  _ctx?: ExecutionContext,
  json: JsonResponse = defaultJson
) {
  if (request.method === "OPTIONS") return json({ ok: true });

  if (pathname === "/public/events" && request.method === "GET") {
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") || 10)));
    return json({ ok: true, events: await listEvents(env, limit) });
  }

  if (pathname === "/public/status" && request.method === "GET") {
    const leads = await listLeads(env, { limit: 500 });
    const events = await listEvents(env, 12);

    const segments: Record<string, number> = {};
    for (const lead of leads) {
      const signals = parseLeadSignals(lead) as any;
      const key = signals.leadClass || inferKind(lead);
      segments[key] = (segments[key] || 0) + 1;
    }

    const topSlices = Object.entries(segments)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, value]) => ({ label, value }));

    const lastRunRaw = await getSetting(env, "last_engine_run");
    const storedLastRun = parseMaybeJson(lastRunRaw);
    const latestEvent = Array.isArray(events) && events.length ? events[0] : null;
    const latestEventISO = latestEvent?.created_at_iso || null;

    let lastRun = storedLastRun;
    if (!lastRun && latestEvent) {
      lastRun = buildEventSnapshot(latestEvent);
    }

    const completedIso = lastRun?.completed_at_iso || lastRun?.started_at_iso || null;
    const snapshotLag =
      Boolean(completedIso) &&
      Boolean(latestEventISO) &&
      new Date(String(latestEventISO)).getTime() > new Date(String(completedIso)).getTime();

    return json({
      ok: true,
      nowISO: new Date().toISOString(),
      engine: {
        enabled: ((await getSetting(env, "engine_enabled")) || "1") !== "0",
        sendingEnabled: ((await getSetting(env, "sending_enabled")) || "0") === "1",
        pausedReason: "",
        lastRun,
        snapshotLag,
      },
      budgets: {
        crawl: {
          usedToday: Number((await getSetting(env, "crawl_scanned_today")) || 0),
          capPerDay: Number((await getSetting(env, "crawl_cap_per_day")) || env.CAP_CRAWL_PER_DAY || 60),
        },
        ai: {
          usedToday: Number((await getSetting(env, "ai_calls")) || 0),
          capPerDay: Number((await getSetting(env, "draft_cap_per_day")) || env.CAP_DRAFTS_PER_DAY || 25),
        },
        send: {
          usedToday: Number((await getSetting(env, "sends_sent_today")) || 0),
          capPerDay: Number((await getSetting(env, "send_cap_per_day")) || env.CAP_SEND_PER_DAY || 12),
        },
      },
      stats: {
        leadsNewToday: Number((await getSetting(env, "leads_new_today")) || 0),
        draftsCreatedToday: Number((await getSetting(env, "drafts_created_today")) || 0),
        approvalsToday: Number((await getSetting(env, "approvals_today")) || 0),
        sendsSentToday: Number((await getSetting(env, "sends_sent_today")) || 0),
        repliesToday: Number((await getSetting(env, "replies_today")) || 0),
        bouncesToday: Number((await getSetting(env, "bounces_today")) || 0),
        unsubscribesToday: Number((await getSetting(env, "unsubscribes_today")) || 0),
        qualifiedLeads: leads.filter((l) => Number(l.score_total || 0) >= 0.45).length,
      },
      topSlices,
      latestEventISO,
      publicEventsCount: events.length,
    });
  }

  return json({ ok: false, error: "Not found" }, { status: 404 });
}
