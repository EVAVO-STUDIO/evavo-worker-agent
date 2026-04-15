
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

function toMs(value: unknown): number {
  if (!value) return 0;
  const ms = new Date(String(value)).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function parseIntSafe(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildEmptyDiagnostics() {
  return {
    inserted: 0,
    duplicatesSkipped: 0,
    noiseSkipped: 0,
    lowScoreSkipped: 0,
    outOfRegionSkipped: 0,
    badDomainSkipped: 0,
    marketplaceSkipped: 0,
    profilesVisited: 0,
    fallbackUsed: 0,
    noExternalWebsite: 0,
    requeuedSources: 0,
    inferredRegionAccepted: 0,
    sourcePagesRetried: 0,
    assetRejected: 0,
    weakPageRejected: 0,
    autoSeededSources: 0,
  };
}

function snapshotFromEvent(event: any) {
  if (!event?.type || !event?.message) return null;
  const lowerType = String(event.type).toLowerCase();
  const msg = String(event.message);

  const tickMatch = msg.match(/scanned\s+(\d+)\s+\|\s+expanded\s+(\d+)\s+\|\s+failed\s+(\d+)\s+\|\s+drafted\s+(\d+)\s+\|\s+sent\s+(\d+)/i);
  const scanMatch = msg.match(/scanned\s+(\d+)\s+\|\s+expanded\s+(\d+)\s+\|\s+failed\s+(\d+)/i);
  const draftMatch = msg.match(/drafted\s+(\d+)/i);
  const sendMatch = msg.match(/sent\s+(\d+)(?:\s+\|\s+failed\s+(\d+))?/i);

  if (lowerType === "tick_ok" && tickMatch) {
    return {
      runId: `derived:${event.id}`,
      started_at_iso: event.created_at_iso,
      completed_at_iso: event.created_at_iso,
      scanned: parseIntSafe(tickMatch[1]),
      expanded: parseIntSafe(tickMatch[2]),
      skipped: 0,
      skippedReasons: {},
      candidateDiagnostics: buildEmptyDiagnostics(),
      failed: parseIntSafe(tickMatch[3]),
      drafted: parseIntSafe(tickMatch[4]),
      sent: parseIntSafe(tickMatch[5]),
      sendFailed: 0,
      runMode: "tick",
      derivedFromEvents: true,
    };
  }

  if (lowerType === "scan_ok" && /manual scan completed/i.test(msg) && scanMatch) {
    return {
      runId: `derived:${event.id}`,
      started_at_iso: event.created_at_iso,
      completed_at_iso: event.created_at_iso,
      scanned: parseIntSafe(scanMatch[1]),
      expanded: parseIntSafe(scanMatch[2]),
      skipped: 0,
      skippedReasons: {},
      candidateDiagnostics: buildEmptyDiagnostics(),
      failed: parseIntSafe(scanMatch[3]),
      drafted: 0,
      sent: 0,
      sendFailed: 0,
      runMode: "manual_scan",
      derivedFromEvents: true,
    };
  }

  if (lowerType === "draft_ok" && draftMatch) {
    return {
      runId: `derived:${event.id}`,
      started_at_iso: event.created_at_iso,
      completed_at_iso: event.created_at_iso,
      scanned: 0,
      expanded: 0,
      skipped: 0,
      skippedReasons: {},
      candidateDiagnostics: buildEmptyDiagnostics(),
      failed: 0,
      drafted: parseIntSafe(draftMatch[1]),
      sent: 0,
      sendFailed: 0,
      runMode: "manual_draft",
      derivedFromEvents: true,
    };
  }

  if ((lowerType === "send_ok" || lowerType === "send_skip") && sendMatch) {
    return {
      runId: `derived:${event.id}`,
      started_at_iso: event.created_at_iso,
      completed_at_iso: event.created_at_iso,
      scanned: 0,
      expanded: 0,
      skipped: 0,
      skippedReasons: {},
      candidateDiagnostics: buildEmptyDiagnostics(),
      failed: 0,
      drafted: 0,
      sent: parseIntSafe(sendMatch[1]),
      sendFailed: parseIntSafe(sendMatch[2]),
      runMode: "manual_send",
      derivedFromEvents: true,
    };
  }

  return null;
}

function resolveLastRun(lastRunRaw: any, events: any[]) {
  const stored = parseMaybeJson(lastRunRaw);
  const latestEvent = Array.isArray(events) && events.length ? events[0] : null;
  const derived = Array.isArray(events) ? events.map(snapshotFromEvent).find(Boolean) || null : null;

  if (!stored && derived) {
    return { lastRun: derived, snapshotLag: false, derivedFromEvents: true };
  }

  if (!stored) {
    return { lastRun: null, snapshotLag: false, derivedFromEvents: false };
  }

  const storedMs = Math.max(toMs((stored as any).completed_at_iso), toMs((stored as any).started_at_iso));
  const latestEventMs = toMs(latestEvent?.created_at_iso);
  const stale = Boolean(latestEventMs && storedMs && latestEventMs > storedMs);

  if (stale && derived && toMs((derived as any).completed_at_iso) >= storedMs) {
    return { lastRun: derived, snapshotLag: true, derivedFromEvents: true };
  }

  return { lastRun: stored, snapshotLag: stale, derivedFromEvents: false };
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
    const latestEventISO = Array.isArray(events) && events.length ? events[0]?.created_at_iso || null : null;
    const resolved = resolveLastRun(lastRunRaw, events);

    return json({
      ok: true,
      nowISO: new Date().toISOString(),
      engine: {
        enabled: ((await getSetting(env, "engine_enabled")) || "1") !== "0",
        sendingEnabled: ((await getSetting(env, "sending_enabled")) || "0") === "1",
        pausedReason: "",
        lastRun: resolved.lastRun,
        snapshotLag: resolved.snapshotLag,
        derivedFromEvents: resolved.derivedFromEvents,
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
