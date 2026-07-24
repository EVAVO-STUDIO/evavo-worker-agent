import type { Env } from "./db";
import { logEvent } from "./db";
import { extractOpportunityCandidates } from "./core/opportunityDiscovery";
import { saveOpportunityCandidate } from "./core/opportunityPersistence";
import { finishOpportunityRun, prepareSourceRunResult, recordCandidateRejection, startOpportunityRun, type OpportunityRunSummary, type SourceRunResult } from "./core/opportunityRuns";
import { PUBLIC_RESEARCH_FETCH_CONTRACT, fetchPublicResearchHtml } from "./core/publicResearchFetch";

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

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

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

function prepareSourceUpdate(env: Env, sourceId: string, ok: boolean, error: string | null): D1PreparedStatement {
  const now = new Date().toISOString();
  const nextHours = ok ? 24 : 6;
  const nextRun = new Date(Date.now() + nextHours * 60 * 60 * 1000).toISOString();
  return env.DB.prepare(
    `UPDATE opportunity_sources
     SET success_count = success_count + ?, failure_count = failure_count + ?, last_run_at_iso = ?, next_run_at_iso = ?, last_error = ?, updated_at_iso = ?
     WHERE id = ?`
  ).bind(ok ? 1 : 0, ok ? 0 : 1, now, nextRun, error, now, sourceId);
}

async function commitSourceOutcome(env: Env, runId: string | null, result: SourceRunResult, ok: boolean): Promise<void> {
  const sourceUpdate = prepareSourceUpdate(env, result.sourceId || "", ok, result.error || null);
  if (runId) {
    await env.DB.batch([sourceUpdate, prepareSourceRunResult(env, result)]);
  } else {
    await sourceUpdate.run();
  }
}

export async function runOpportunityAutonomy(env: Env, settings: OpportunityAutonomySettings) {
  const summary: OpportunityRunSummary = { sourcesChecked: 0, candidatesFound: 0, saved: 0, duplicates: 0, failed: 0, skipped: 0, rejected: 0 };
  const runId = await startOpportunityRun(env, "manual_confirmed", { ...settings, researchFetchContract: PUBLIC_RESEARCH_FETCH_CONTRACT });
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

    const limit = Math.min(
      boundedInteger(settings.dailySourceLimit, 0, 0, 100),
      boundedInteger(settings.maxNetworkCallsPerRun, 0, 0, 250),
    );
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
          await commitSourceOutcome(env, runId, {
            runId: runId || "",
            sourceId: source.id,
            sourceUrl: source.url,
            fetchStatus: fetched.status,
            contentType: fetched.contentType,
            elapsedMs: fetched.elapsedMs,
            bytes: fetched.bytes,
            error,
          }, false);
          continue;
        }

        const sourceReceipt = {
          contract: fetched.contract,
          requestedUrl: fetched.requestedUrl,
          finalUrl: fetched.finalUrl,
          status: fetched.status,
          contentType: fetched.contentType,
          contentLength: fetched.contentLength,
          contentLanguage: fetched.contentLanguage,
          etag: fetched.etag,
          lastModified: fetched.lastModified,
          bytes: fetched.bytes,
          bodySha256: fetched.bodySha256,
          redirectCount: fetched.redirectCount,
          redirectChain: fetched.redirectChain,
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
            minScore: boundedInteger(settings.minOpportunityScore, 45, 1, 100),
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

        await commitSourceOutcome(env, runId, {
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
        }, true);
        successfulSources += 1;
      } catch {
        const error = "manual_opportunity_source_processing_failed";
        lastFailureCode = error;
        summary.failed += 1;
        await commitSourceOutcome(env, runId, {
          runId: runId || "",
          sourceId: source.id,
          sourceUrl: source.url,
          candidatesFound,
          candidatesSaved,
          candidatesRejected,
          duplicates,
          error,
        }, false);
      }
    }

    const runStatus = summary.failed > 0 && successfulSources === 0 ? "failed" : summary.failed > 0 ? "partial" : "completed";
    const runError = runStatus === "failed"
      ? lastFailureCode || "all_opportunity_sources_failed"
      : runStatus === "partial"
        ? `partial_source_failures:${summary.failed}`
        : null;
    await logEvent(env, "opportunity_tick_ok", `Confirmed manual opportunity run ${runStatus} | checked ${summary.sourcesChecked} | successful ${successfulSources} | candidates ${summary.candidatesFound} | saved ${summary.saved} | duplicates ${summary.duplicates} | skipped ${summary.skipped} | rejected ${summary.rejected} | failed ${summary.failed} | run ${runId || "audit_disabled"}`);
    await finishOpportunityRun(env, runId, runStatus, summary, runError);
    return {
      ...summary,
      runId,
      runType: "manual_confirmed",
      runStatus,
      runError,
      successfulSources,
      fetchContract: PUBLIC_RESEARCH_FETCH_CONTRACT,
      fullOperationTimeout: true,
      sourceHealthAndAuditAtomic: true,
      reviewOnly: true,
      executable: false,
      deliverable: false,
      authoritativeForExecution: false,
      externalExecutionAllowed: false,
    };
  } catch {
    const error = "manual_opportunity_run_failed";
    summary.failed += 1;
    await finishOpportunityRun(env, runId, "failed", summary, error);
    throw new Error(error);
  }
}
