import type { Env } from "./db";
import { logEvent, uuid } from "./db";
import { extractOpportunityCandidates } from "./core/opportunityDiscovery";

type OpportunityAutonomySettings = {
  opportunityDiscoveryEnabled: boolean;
  dailySourceLimit: number;
  maxNetworkCallsPerRun: number;
  minOpportunityScore: number;
};

type OpportunitySource = {
  id: string;
  url: string;
  label?: string | null;
  source_type?: string | null;
  country?: string | null;
  region?: string | null;
  category?: string | null;
};

async function tableExists(env: Env, tableName: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1").bind(tableName).first<any>();
  return Boolean(row?.name);
}

async function dueSources(env: Env, limit: number): Promise<OpportunitySource[]> {
  const now = new Date().toISOString();
  const rows = await env.DB.prepare(
    `SELECT id, url, label, source_type, country, region, category
     FROM opportunity_sources
     WHERE status = 'active'
       AND (next_run_at_iso IS NULL OR next_run_at_iso <= ?)
       AND (cooldown_until_iso IS NULL OR cooldown_until_iso <= ?)
     ORDER BY priority DESC, COALESCE(last_run_at_iso, '') ASC
     LIMIT ?`
  ).bind(now, now, limit).all<OpportunitySource>();
  return rows.results || [];
}

async function fetchHtml(url: string) {
  const started = Date.now();
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "user-agent": "Mozilla/5.0 (compatible; EVAVO-Opportunity-Agent/1.0; +https://evavo.com.au)",
    },
  });
  const contentType = response.headers.get("content-type") || "";
  const body = response.ok ? await response.text() : "";
  return { ok: response.ok, status: response.status, contentType, body, elapsedMs: Date.now() - started };
}

async function updateSourceRun(env: Env, sourceId: string, ok: boolean, error: string | null) {
  const now = new Date().toISOString();
  const nextHours = ok ? 24 : 6;
  const nextRun = new Date(Date.now() + nextHours * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    `UPDATE opportunity_sources
     SET success_count = success_count + ?, failure_count = failure_count + ?, last_run_at_iso = ?, next_run_at_iso = ?, last_error = ?, updated_at_iso = ?
     WHERE id = ?`
  ).bind(ok ? 1 : 0, ok ? 0 : 1, now, nextRun, error, now, sourceId).run();
}

async function saveCandidate(env: Env, source: OpportunitySource, candidate: any) {
  const existing = await env.DB.prepare("SELECT id FROM opportunities WHERE url = ? AND title = ? LIMIT 1").bind(candidate.url, candidate.title).first<any>();
  if (existing?.id) return { saved: false, reason: "duplicate", id: existing.id };

  const now = new Date().toISOString();
  const id = uuid();
  await env.DB.prepare(
    `INSERT INTO opportunities (
      id, source_id, url, title, opportunity_type, issuer, country, region, category,
      discovered_at_iso, updated_at_iso, status,
      fit_score, urgency_score, value_score, effort_score, risk_score, total_score, confidence,
      summary, recommended_action, evidence_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    source.id,
    candidate.url,
    candidate.title,
    candidate.opportunityType,
    source.label || null,
    source.country || null,
    source.region || null,
    source.category || null,
    now,
    now,
    "new",
    candidate.score,
    candidate.signals?.some((signal: string) => String(signal).startsWith("intent:")) ? Math.min(100, candidate.score + 5) : candidate.score,
    candidate.score,
    Math.max(0, 100 - candidate.score),
    candidate.confidence === "high" ? 10 : candidate.confidence === "medium" ? 25 : 45,
    candidate.score,
    candidate.confidence,
    `Autonomous opportunity signal from ${source.label || source.url}: ${candidate.title}`,
    candidate.recommendedAction,
    JSON.stringify({ signals: candidate.signals || [], sourceUrl: source.url, scheduled: true })
  ).run();

  return { saved: true, id };
}

export async function runOpportunityAutonomy(env: Env, settings: OpportunityAutonomySettings) {
  const summary = { sourcesChecked: 0, candidatesFound: 0, saved: 0, duplicates: 0, failed: 0, skipped: 0 };

  if (!settings.opportunityDiscoveryEnabled) {
    await logEvent(env, "opportunity_tick_skip", "Opportunity discovery disabled by autonomy settings.");
    return summary;
  }

  if (!(await tableExists(env, "opportunity_sources")) || !(await tableExists(env, "opportunities"))) {
    await logEvent(env, "opportunity_tick_skip", "Opportunity tables missing. Apply migration 0004_opportunity_intelligence.sql.");
    return summary;
  }

  const limit = Math.max(0, Math.min(settings.dailySourceLimit, settings.maxNetworkCallsPerRun));
  if (limit <= 0) {
    await logEvent(env, "opportunity_tick_skip", "Opportunity runner blocked by zero source/network limit.");
    return summary;
  }

  const sources = await dueSources(env, limit);
  if (!sources.length) {
    await logEvent(env, "opportunity_tick_skip", "No due opportunity sources.");
    return summary;
  }

  for (const source of sources) {
    summary.sourcesChecked += 1;
    try {
      const fetched = await fetchHtml(source.url);
      if (!fetched.ok || !fetched.body || (fetched.contentType && !fetched.contentType.includes("html"))) {
        summary.failed += 1;
        await updateSourceRun(env, source.id, false, fetched.ok ? "non_html_response" : `http_${fetched.status}`);
        continue;
      }

      const candidates = extractOpportunityCandidates(fetched.body, source.url, 50).filter((candidate) => candidate.score >= settings.minOpportunityScore);
      summary.candidatesFound += candidates.length;

      for (const candidate of candidates.slice(0, 10)) {
        const result = await saveCandidate(env, source, candidate);
        if (result.saved) summary.saved += 1;
        else summary.duplicates += 1;
      }

      await updateSourceRun(env, source.id, true, null);
    } catch (err: any) {
      summary.failed += 1;
      await updateSourceRun(env, source.id, false, String(err?.message || err));
    }
  }

  await logEvent(env, "opportunity_tick_ok", `Opportunity autonomy checked ${summary.sourcesChecked} sources | candidates ${summary.candidatesFound} | saved ${summary.saved} | duplicates ${summary.duplicates} | failed ${summary.failed}`);
  return summary;
}
