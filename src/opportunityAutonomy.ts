import type { Env } from "./db";
import { logEvent } from "./db";
import { extractOpportunityCandidates } from "./core/opportunityDiscovery";
import { saveOpportunityCandidate } from "./core/opportunityPersistence";
import { finishOpportunityRun, startOpportunityRun, type OpportunityRunSummary } from "./core/opportunityRuns";

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

export async function runOpportunityAutonomy(env: Env, settings: OpportunityAutonomySettings) {
  const summary: OpportunityRunSummary = { sourcesChecked: 0, candidatesFound: 0, saved: 0, duplicates: 0, failed: 0, skipped: 0, rejected: 0 };
  const runId = await startOpportunityRun(env, "scheduled", settings);

  try {
    if (!settings.opportunityDiscoveryEnabled) {
      await logEvent(env, "opportunity_tick_skip", "Opportunity discovery disabled by autonomy settings.");
      await finishOpportunityRun(env, runId, "skipped", summary, "opportunity_discovery_disabled");
      return { ...summary, runId };
    }

    if (!(await tableExists(env, "opportunity_sources")) || !(await tableExists(env, "opportunities"))) {
      await logEvent(env, "opportunity_tick_skip", "Opportunity tables missing. Apply migration 0004_opportunity_intelligence.sql.");
      await finishOpportunityRun(env, runId, "skipped", summary, "missing_opportunity_tables");
      return { ...summary, runId };
    }

    const limit = Math.max(0, Math.min(settings.dailySourceLimit, settings.maxNetworkCallsPerRun));
    if (limit <= 0) {
      await logEvent(env, "opportunity_tick_skip", "Opportunity runner blocked by zero source/network limit.");
      await finishOpportunityRun(env, runId, "skipped", summary, "zero_source_or_network_limit");
      return { ...summary, runId };
    }

    const sources = await dueSources(env, limit);
    if (!sources.length) {
      await logEvent(env, "opportunity_tick_skip", "No due opportunity sources.");
      await finishOpportunityRun(env, runId, "skipped", summary, "no_due_sources");
      return { ...summary, runId };
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

        const candidates = extractOpportunityCandidates(fetched.body, source.url, 50);
        summary.candidatesFound += candidates.length;

        for (const candidate of candidates.slice(0, 10)) {
          const result = await saveOpportunityCandidate(env, source, candidate, {
            minScore: settings.minOpportunityScore,
            discoveredBy: "scheduled",
          });
          if (result.saved) summary.saved += 1;
          else if (result.reason === "duplicate") summary.duplicates += 1;
          else {
            summary.skipped += 1;
            summary.rejected += 1;
          }
        }

        await updateSourceRun(env, source.id, true, null);
      } catch (err: any) {
        summary.failed += 1;
        await updateSourceRun(env, source.id, false, String(err?.message || err));
      }
    }

    await logEvent(env, "opportunity_tick_ok", `Opportunity autonomy checked ${summary.sourcesChecked} sources | candidates ${summary.candidatesFound} | saved ${summary.saved} | duplicates ${summary.duplicates} | skipped ${summary.skipped} | rejected ${summary.rejected} | failed ${summary.failed} | run ${runId || "audit_disabled"}`);
    await finishOpportunityRun(env, runId, "completed", summary);
    return { ...summary, runId };
  } catch (err: any) {
    const error = String(err?.message || err);
    summary.failed += 1;
    await finishOpportunityRun(env, runId, "failed", summary, error);
    throw err;
  }
}
