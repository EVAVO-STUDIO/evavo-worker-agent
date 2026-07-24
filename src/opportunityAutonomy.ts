import type { Env } from "./db";
import { logEvent } from "./db";
import { extractOpportunityCandidates } from "./core/opportunityDiscovery";
import { saveOpportunityCandidate } from "./core/opportunityPersistence";
import { finishOpportunityRun, recordCandidateRejection, recordSourceRunResult, startOpportunityRun, type OpportunityRunSummary } from "./core/opportunityRuns";
import { fetchPublicResearchHtml } from "./core/publicResearchFetch";

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
  const runId = await startOpportunityRun(env, "manual_confirmed", { ...settings, researchFetchContract: "public_research_fetch_v1" });
  let successfulSources = 0;
  let lastFailureCode: string | null = null;

  try {
    if (!settings.opportunityDiscoveryEnabled) {
      await logEvent(env, "opportunity_tick_skip", "Confirmed manual opportunity run skipped because opportunity discovery is disabled.");
      await finishOpportunityRun(env, runId, "skipped", summary, "opportunity_discovery_disabled");
      return { ...summary, runId, runType: "manual_confirmed", runStatus: "skipped", runError: "opportunity_discovery_disabled", successfulSources };
    }

    if (!(await tableExists(env, "opportunity_sources")) || !(await tableExists(env, "opportunities"))) {
      await logEvent(env, "opportunity_tick_skip", "Opportunity tables missing. Apply migration 0004_opportunity_intelligence.sql.");
      await finishOpportunityRun(env, runId, "skipped", summary, "missing_opportunity_tables");
      return { ...summary, runId, runType: "manual_confirmed", runStatus: "skipped", runError: "missing_opportunity_tables", successfulSources };
    }

    const limit = Math.max(0, Math.min(settings.dailySourceLimit, settings.maxNetworkCallsPerRun));
    if (limit <= 0) {
      await logEvent(env, "opportunity_tick_skip", "Confirmed manual opportunity run blocked by zero source/network limit.");
      await finishOpportunityRun(env, runId, "skipped", summary, "zero_source_or_network_limit");
      return { ...summary, runId, runType: "manual_confirmed", runStatus: "skipped", runError: "zero_source_or_network_limit", successfulSources };
    }

    const sources = await dueSources(env, limit);
    if (!sources.length) {
      await logEvent(env, "opportunity_tick_skip", "No due opportunity sources for confirmed manual review.");
      await finishOpportunityRun(env, runId, "skipped", summary, "no_due_sources");
      return { ...summary, runId, runType: "manual_confirmed", runStatus: "skipped", runError: "no_due_sources", successfulSources };
    }

    for (const source of sources) {
      summary.sourcesChecked += 1;
      let candidatesFound = 0;
      let candidatesSaved = 0;
      let candidatesRejected = 0;
      let duplicates = 0;

      try {
        const fetched = await fetchPublicResearchHtml(source.url);
        if (!fetched.ok || !fetched.body) {
          const error = fetched.error || "source_fetch_failed";
          lastFailureCode = error;
          summary.failed += 1;
          await updateSourceRun(env, source.id, false, error);
          await recordSourceRunResult(env, {
            runId: runId || "",
            sourceId: source.id,
            sourceUrl: source.url,
            fetchStatus: fetched.status,
            contentType: fetched.contentType,
            elapsedMs: fetched.elapsedMs,
            bytes: fetched.bytes,
            error,
          });
          continue;
        }

        const sourceReceipt = {
          contract: fetched.contract,
          requestedUrl: fetched.requestedUrl,
          finalUrl: fetched.finalUrl,
          status: fetched.status,
          contentType: fetched.contentType,
          bytes: fetched.bytes,
          bodySha256: fetched.bodySha256,
          redirectCount: fetched.redirectCount,
          fetchedAtISO: fetched.fetchedAtISO,
          timeoutScope: fetched.timeoutScope,
        };
        const candidates = extractOpportunityCandidates(fetched.body, fetched.finalUrl || source.url, 50);
        candidatesFound = candidates.length;
        summary.candidatesFound += candidates.length;

        for (const candidate of candidates.slice(0, 10)) {
          const candidateWithReceipt = {
            ...candidate,
            evidence: {
              ...(candidate.evidence || {}),
              sourceFetch: sourceReceipt,
            },
          };
          const result = await saveOpportunityCandidate(env, source, candidateWithReceipt, {
            minScore: settings.minOpportunityScore,
            discoveredBy: "manual-confirmed-run-due",
          });
          if (result.saved) {
            summary.saved += 1;
            candidatesSaved += 1;
          } else if (result.reason === "duplicate") {
            summary.duplicates += 1;
            duplicates += 1;
          } else {
            summary.skipped += 1;
            summary.rejected += 1;
            candidatesRejected += 1;
            await recordCandidateRejection(env, {
              runId,
              sourceId: source.id,
              sourceUrl: source.url,
              candidateUrl: result.normalizedUrl || candidate.url,
              candidateTitle: result.normalizedTitle || candidate.title,
              score: result.score ?? candidate.score,
              reason: result.reason,
              evidence: candidateWithReceipt.evidence,
            });
          }
        }

        await updateSourceRun(env, source.id, true, null);
        await recordSourceRunResult(env, {
          runId: runId || "",
          sourceId: source.id,
          sourceUrl: source.url,
          fetchStatus: fetched.status,
          contentType: fetched.contentType,
          elapsedMs: fetched.elapsedMs,
          bytes: fetched.bytes,
          candidatesFound,
          candidatesSaved,
          candidatesRejected,
          duplicates,
        });
        successfulSources += 1;
      } catch {
        const error = "manual_opportunity_source_processing_failed";
        lastFailureCode = error;
        summary.failed += 1;
        await updateSourceRun(env, source.id, false, error);
        await recordSourceRunResult(env, {
          runId: runId || "",
          sourceId: source.id,
          sourceUrl: source.url,
          candidatesFound,
          candidatesSaved,
          candidatesRejected,
          duplicates,
          error,
        });
      }
    }

    const runStatus = summary.failed > 0 && successfulSources === 0 ? "failed" : "completed";
    const runError = runStatus === "failed"
      ? lastFailureCode || "all_opportunity_sources_failed"
      : summary.failed > 0
        ? `partial_source_failures:${summary.failed}`
        : null;
    await logEvent(env, "opportunity_tick_ok", `Confirmed manual opportunity run checked ${summary.sourcesChecked} sources | successful ${successfulSources} | candidates ${summary.candidatesFound} | saved ${summary.saved} | duplicates ${summary.duplicates} | skipped ${summary.skipped} | rejected ${summary.rejected} | failed ${summary.failed} | run ${runId || "audit_disabled"}`);
    await finishOpportunityRun(env, runId, runStatus, summary, runError);
    return { ...summary, runId, runType: "manual_confirmed", runStatus, runError, successfulSources, fetchContract: "public_research_fetch_v1", fullOperationTimeout: true };
  } catch {
    const error = "manual_opportunity_run_failed";
    summary.failed += 1;
    await finishOpportunityRun(env, runId, "failed", summary, error);
    throw new Error(error);
  }
}
