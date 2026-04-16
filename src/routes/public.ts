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

function buildFallbackRun(event: any, runMode: string, values: Partial<Record<string, number>> = {}) {
  return {
    runId: `derived:${event?.id || "event"}`,
    started_at_iso: event?.created_at_iso || null,
    completed_at_iso: event?.created_at_iso || null,
    scanned: parseIntSafe(values.scanned, 0),
    expanded: parseIntSafe(values.expanded, 0),
    skipped: parseIntSafe(values.skipped, 0),
    skippedReasons: {},
    candidateDiagnostics: buildEmptyDiagnostics(),
    failed: parseIntSafe(values.failed, 0),
    drafted: parseIntSafe(values.drafted, 0),
    sent: parseIntSafe(values.sent, 0),
    sendFailed: parseIntSafe(values.sendFailed, 0),
    runMode,
    derivedFromEvents: true,
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

  if (lowerType === "tick_ok" && /finished/i.test(msg)) {
    if (tickMatch) {
      return buildFallbackRun(event, "tick", {
        scanned: tickMatch[1],
        expanded: tickMatch[2],
        failed: tickMatch[3],
        drafted: tickMatch[4],
        sent: tickMatch[5],
      });
    }
    return buildFallbackRun(event, "tick");
  }

  if (lowerType === "scan_ok") {
    if (scanMatch) {
      return buildFallbackRun(event, "manual_scan", {
        scanned: scanMatch[1],
        expanded: scanMatch[2],
        failed: scanMatch[3],
      });
    }
    return buildFallbackRun(event, "manual_scan");
  }

  if (lowerType === "draft_ok") {
    if (draftMatch) return buildFallbackRun(event, "manual_draft", { drafted: draftMatch[1] });
    return buildFallbackRun(event, "manual_draft");
  }

  if (lowerType === "send_ok" || lowerType === "send_skip") {
    if (sendMatch) {
      return buildFallbackRun(event, "manual_send", {
        sent: sendMatch[1],
        sendFailed: sendMatch[2],
      });
    }
    return buildFallbackRun(event, "manual_send");
  }

  return null;
}

function sanitizeStoredRun(stored: any) {
  if (!stored || typeof stored !== "object") return null;
  const started = stored.started_at_iso || stored.completed_at_iso || null;
  const completed = stored.completed_at_iso || stored.started_at_iso || null;
  const hasAnySignal =
    Boolean(stored.runId) ||
    Boolean(started) ||
    Boolean(completed) ||
    Number.isFinite(Number(stored.scanned)) ||
    Number.isFinite(Number(stored.expanded)) ||
    Number.isFinite(Number(stored.failed)) ||
    Number.isFinite(Number(stored.drafted)) ||
    Number.isFinite(Number(stored.sent));

  if (!hasAnySignal) return null;

  return {
    runId: stored.runId || `stored:${completed || started || "unknown"}`,
    started_at_iso: started,
    completed_at_iso: completed,
    scanned: parseIntSafe(stored.scanned, 0),
    expanded: parseIntSafe(stored.expanded, 0),
    skipped: parseIntSafe(stored.skipped, 0),
    skippedReasons: stored.skippedReasons && typeof stored.skippedReasons === "object" ? stored.skippedReasons : {},
    candidateDiagnostics:
      stored.candidateDiagnostics && typeof stored.candidateDiagnostics === "object"
        ? { ...buildEmptyDiagnostics(), ...stored.candidateDiagnostics }
        : buildEmptyDiagnostics(),
    failed: parseIntSafe(stored.failed, 0),
    drafted: parseIntSafe(stored.drafted, 0),
    sent: parseIntSafe(stored.sent, 0),
    sendFailed: parseIntSafe(stored.sendFailed, 0),
    runMode: stored.runMode || "tick",
    derivedFromEvents: false,
  };
}

function resolveLastRun(lastRunRaw: any, events: any[]) {
  const stored = sanitizeStoredRun(parseMaybeJson(lastRunRaw));
  const latestEvent = Array.isArray(events) && events.length ? events[0] : null;
  const derived = Array.isArray(events) ? events.map(snapshotFromEvent).find(Boolean) || null : null;

  if (!stored && derived) {
    return { lastRun: derived, snapshotLag: false, derivedFromEvents: true };
  }

  if (!stored) {
    return { lastRun: null, snapshotLag: false, derivedFromEvents: false };
  }

  const storedMs = Math.max(toMs(stored.completed_at_iso), toMs(stored.started_at_iso));
  const latestEventMs = toMs(latestEvent?.created_at_iso);
  const stale = Boolean(latestEventMs && (!storedMs || latestEventMs > storedMs));

  if (stale && derived) {
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

    const safeLastRun = resolved.lastRun || (latestEventISO
      ? {
          runId: `fallback:${latestEventISO}`,
          started_at_iso: latestEventISO,
          completed_at_iso: latestEventISO,
          scanned: 0,
          expanded: 0,
          skipped: 0,
          skippedReasons: {},
          candidateDiagnostics: buildEmptyDiagnostics(),
          failed: 0,
          drafted: 0,
          sent: 0,
          sendFailed: 0,
          runMode: "tick",
          derivedFromEvents: false,
          responseFallback: true,
        }
      : null);

    const derivedFromEvents = Boolean(resolved.derivedFromEvents && safeLastRun);

    return json({
      ok: true,
      nowISO: new Date().toISOString(),
      engine: {
        enabled: ((await getSetting(env, "engine_enabled")) || "1") !== "0",
        sendingEnabled: ((await getSetting(env, "sending_enabled")) || "0") === "1",
        pausedReason: "",
        lastRun: safeLastRun,
        snapshotLag: Boolean(resolved.snapshotLag || (!resolved.lastRun && latestEventISO)),
        derivedFromEvents,
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
