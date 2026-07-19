import { Env, getSetting, listEvents, listLeads, parseLeadSignals } from "../db";

type JsonResponse = (data: any, init?: ResponseInit) => Response;
type FallbackRunValues = Partial<Record<string, string | number | null | undefined>>;

function defaultJson(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "Content-Type",
      "access-control-allow-methods": "GET, OPTIONS",
      "cache-control": "no-store",
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

function buildFallbackRun(event: any, runMode: string, values: FallbackRunValues = {}) {
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
    drafted: 0,
    sent: 0,
    sendFailed: 0,
    runMode,
    derivedFromEvents: true,
  };
}

function snapshotFromEvent(event: any) {
  if (!event?.type || !event?.message) return null;
  const lowerType = String(event.type).toLowerCase();
  const msg = String(event.message);
  const scanMatch = msg.match(/scanned\s+(\d+)\s+\|\s+expanded\s+(\d+)\s+\|\s+failed\s+(\d+)/i);

  if (lowerType === "tick_ok" || lowerType === "scan_ok") {
    if (scanMatch) {
      return buildFallbackRun(event, lowerType === "tick_ok" ? "review_first_tick" : "bounded_research", {
        scanned: scanMatch[1],
        expanded: scanMatch[2],
        failed: scanMatch[3],
      });
    }
    return buildFallbackRun(event, lowerType === "tick_ok" ? "review_first_tick" : "bounded_research");
  }

  return null;
}

function sanitizeStoredRun(stored: any) {
  if (!stored || typeof stored !== "object") return null;
  const started = stored.started_at_iso || stored.completed_at_iso || null;
  const completed = stored.completed_at_iso || stored.started_at_iso || null;
  const hasAnySignal = Boolean(stored.runId) || Boolean(started) || Boolean(completed)
    || Number.isFinite(Number(stored.scanned)) || Number.isFinite(Number(stored.expanded)) || Number.isFinite(Number(stored.failed));
  if (!hasAnySignal) return null;

  return {
    runId: stored.runId || `stored:${completed || started || "unknown"}`,
    started_at_iso: started,
    completed_at_iso: completed,
    scanned: parseIntSafe(stored.scanned, 0),
    expanded: parseIntSafe(stored.expanded, 0),
    skipped: parseIntSafe(stored.skipped, 0),
    skippedReasons: stored.skippedReasons && typeof stored.skippedReasons === "object" ? stored.skippedReasons : {},
    candidateDiagnostics: stored.candidateDiagnostics && typeof stored.candidateDiagnostics === "object"
      ? { ...buildEmptyDiagnostics(), ...stored.candidateDiagnostics }
      : buildEmptyDiagnostics(),
    failed: parseIntSafe(stored.failed, 0),
    drafted: 0,
    sent: 0,
    sendFailed: 0,
    runMode: "review_first",
    derivedFromEvents: false,
  };
}

function resolveLastRun(lastRunRaw: any, events: any[]) {
  const stored = sanitizeStoredRun(parseMaybeJson(lastRunRaw));
  const latestEvent = Array.isArray(events) && events.length ? events[0] : null;
  const derived = Array.isArray(events) ? events.map(snapshotFromEvent).find(Boolean) || null : null;
  if (!stored && derived) return { lastRun: derived, snapshotLag: false, derivedFromEvents: true };
  if (!stored) return { lastRun: null, snapshotLag: false, derivedFromEvents: false };

  const storedMs = Math.max(toMs(stored.completed_at_iso), toMs(stored.started_at_iso));
  const latestEventMs = toMs(latestEvent?.created_at_iso);
  const stale = Boolean(latestEventMs && (!storedMs || latestEventMs > storedMs));
  if (stale && derived) return { lastRun: derived, snapshotLag: true, derivedFromEvents: true };
  return { lastRun: stored, snapshotLag: stale, derivedFromEvents: false };
}

export async function handlePublic(
  request: Request,
  env: Env,
  pathname: string,
  _ctx?: any,
  json: JsonResponse = defaultJson
) {
  if (request.method === "OPTIONS") return json({ ok: true });

  if (pathname === "/public/events") {
    return json({
      ok: false,
      error: "public_event_feed_disabled",
      reason: "Internal event records are not exposed publicly. Use authenticated diagnostics or aggregate public status.",
    }, { status: 410, headers: { "cache-control": "no-store" } });
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

    const latestEventISO = Array.isArray(events) && events.length ? events[0]?.created_at_iso || null : null;
    const resolved = resolveLastRun(await getSetting(env, "last_engine_run"), events);
    const safeLastRun = resolved.lastRun || (latestEventISO ? {
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
      runMode: "review_first",
      derivedFromEvents: false,
      responseFallback: true,
    } : null);

    return json({
      ok: true,
      contractVersion: "public_status_v2_review_first",
      nowISO: new Date().toISOString(),
      engine: {
        enabled: false,
        scheduledResearchEnabled: true,
        sendingEnabled: false,
        aiDraftingEnabled: false,
        externalExecutionEnabled: false,
        pausedReason: "review_first_external_execution_disabled",
        lastRun: safeLastRun,
        snapshotLag: Boolean(resolved.snapshotLag || (!resolved.lastRun && latestEventISO)),
        derivedFromEvents: Boolean(resolved.derivedFromEvents && safeLastRun),
      },
      budgets: {
        research: {
          usedToday: Number((await getSetting(env, "crawl_scanned_today")) || 0),
          capPerDay: Number((await getSetting(env, "crawl_cap_per_day")) || env.CAP_CRAWL_PER_DAY || 60),
        },
        ai: { usedToday: 0, capPerDay: 0 },
        send: { usedToday: 0, capPerDay: 0 },
      },
      stats: {
        leadsNewToday: Number((await getSetting(env, "leads_new_today")) || 0),
        draftsCreatedToday: 0,
        approvalsToday: Number((await getSetting(env, "approvals_today")) || 0),
        sendsSentToday: 0,
        qualifiedLeads: leads.filter((lead) => Number(lead.score_total || 0) >= 0.45).length,
      },
      topSlices,
      latestEventISO,
      safety: {
        rawEventsExposed: false,
        contactDataExposed: false,
        URLsExposed: false,
        externalExecutionEnabled: false,
      },
    }, { headers: { "cache-control": "no-store" } });
  }

  return json({ ok: false, error: "Not found" }, { status: 404 });
}
