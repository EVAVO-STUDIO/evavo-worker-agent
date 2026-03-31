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

    return json({
      ok: true,
      nowISO: new Date().toISOString(),
      engine: {
        enabled: ((await getSetting(env, "engine_enabled")) || "1") !== "0",
        sendingEnabled: ((await getSetting(env, "sending_enabled")) || "0") === "1",
        pausedReason: "",
        lastRun: await getSetting(env, "last_engine_run"),
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
    });
  }

  return json({ ok: false, error: "Not found" }, { status: 404 });
}
