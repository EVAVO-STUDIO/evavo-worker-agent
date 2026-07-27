import type { Env } from "./db";
import { logEvent } from "./db";
import {
  claimGrowthActivityBudget,
  completeGrowthActivityBudgetClaim,
  type GrowthActivityBudgetLedgerClaim,
} from "./core/growthActivityBudgetLedger";
import {
  resolveGrowthActivitySettings,
  type GrowthActivityAutonomySettings,
} from "./core/growthActivityBudgetSettings";
import { acquireManualResearchLease, releaseManualResearchLease } from "./core/manualResearchLease";
import { extractOpportunityCandidates } from "./core/opportunityDiscovery";
import { saveOpportunityCandidate } from "./core/opportunityPersistence";
import {
  OPPORTUNITY_SOURCE_SELECTION_VERSION,
  opportunitySourceExplorationSlots,
  selectOpportunitySources,
  type OpportunitySourceSelectionResult,
} from "./core/opportunitySourceSelection";
import { finishOpportunityRun, prepareSourceRunResult, recordCandidateRejection, startOpportunityRun, type OpportunityRunSummary, type SourceRunResult } from "./core/opportunityRuns";
import { PUBLIC_RESEARCH_FETCH_CONTRACT, fetchPublicResearchHtml } from "./core/publicResearchFetch";

export type OpportunityAutonomySettings = GrowthActivityAutonomySettings & {
  freeSafeOnly: boolean;
  sourceExpansionEnabled: boolean;
  leadDiscoveryEnabled: boolean;
  aiDraftsEnabled: boolean;
  sendingEnabled: boolean;
  maxExpansionFetchesPerRun: number;
  maxExpansionCandidatesPerRun: number;
};

export type OpportunityAutonomyBudgetContext = Readonly<{
  requestBodySha256: string;
  ownerApproved: true;
  explicitlyConfirmed: true;
}>;

type OpportunitySource = {
  id: string;
  url: string;
  label?: string | null;
  source_type?: string | null;
  country?: string | null;
  region?: string | null;
  category?: string | null;
  priority: number;
  successCount: number;
  failureCount: number;
  opportunityCount: number;
  lastRunAtIso: string | null;
};

type BudgetRunSummary = {
  contractVersion: "growth_activity_budget_run_v1";
  intensity: "paused" | "light" | "balanced" | "high";
  effectiveSourceLimitPerRun: number;
  effectiveMinimumOpportunityScore: number;
  admittedSourceClaims: number;
  policyDeniedSourceClaims: number;
  raceDeniedSourceClaims: number;
  completedSourceClaims: number;
  failedSourceClaims: number;
  completionFailures: number;
  ledgerUnavailable: boolean;
  lastDenialCode: string | null;
  persistentAdmissionRequired: true;
  automaticRetryAllowed: false;
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

async function dueSources(
  env: Env,
  limit: number,
  intensity: "paused" | "light" | "balanced" | "high",
): Promise<OpportunitySourceSelectionResult<OpportunitySource>> {
  const now = new Date();
  const nowIso = now.toISOString();
  const poolLimit = Math.min(60, Math.max(limit, limit * 4));
  const rows = await env.DB.prepare(
    `SELECT
       source.id,
       source.url,
       source.label,
       source.source_type,
       source.country,
       source.region,
       source.category,
       source.priority,
       source.success_count AS successCount,
       source.failure_count AS failureCount,
       source.last_run_at_iso AS lastRunAtIso,
       COALESCE((
         SELECT COUNT(*)
         FROM opportunities opportunity
         WHERE opportunity.source_id = source.id
       ), 0) AS opportunityCount
     FROM opportunity_sources source
     WHERE source.status = 'active'
       AND (source.next_run_at_iso IS NULL OR source.next_run_at_iso <= ?)
       AND (source.cooldown_until_iso IS NULL OR source.cooldown_until_iso <= ?)
     ORDER BY source.priority DESC, COALESCE(source.last_run_at_iso, '') ASC, source.id ASC
     LIMIT ?`
  ).bind(nowIso, nowIso, poolLimit).all<OpportunitySource>();
  return selectOpportunitySources({
    sources: rows.results || [],
    limit,
    explorationSlots: opportunitySourceExplorationSlots(intensity, limit),
    now,
  });
}

function prepareSourceUpdate(
  env: Env,
  sourceId: string,
  result: SourceRunResult,
  ok: boolean,
): D1PreparedStatement {
  const now = new Date().toISOString();
  const nextHours = ok
    ? Number(result.candidatesSaved || 0) > 0
      ? 24
      : 72
    : 48;
  const nextRun = new Date(Date.now() + nextHours * 60 * 60 * 1000).toISOString();
  const cooldownUntil = ok ? null : nextRun;
  return env.DB.prepare(
    `UPDATE opportunity_sources
     SET success_count = success_count + ?,
         failure_count = failure_count + ?,
         last_run_at_iso = ?,
         next_run_at_iso = ?,
         cooldown_until_iso = ?,
         last_error = ?,
         updated_at_iso = ?
     WHERE id = ?`
  ).bind(
    ok ? 1 : 0,
    ok ? 0 : 1,
    now,
    nextRun,
    cooldownUntil,
    result.error || null,
    now,
    sourceId,
  );
}

async function commitSourceOutcome(
  env: Env,
  runId: string | null,
  result: SourceRunResult,
  ok: boolean,
): Promise<void> {
  const sourceUpdate = prepareSourceUpdate(env, result.sourceId || "", result, ok);
  if (runId) {
    await env.DB.batch([sourceUpdate, prepareSourceRunResult(env, result)]);
  } else {
    await sourceUpdate.run();
  }
}

function sourceDomain(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("opportunity_source_domain_invalid");
  }
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname.includes(":")) {
    throw new Error("opportunity_source_domain_invalid");
  }
  return hostname;
}

async function shortSourceHash(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  ));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}

async function sourceBudgetClaimId(runId: string | null, sourceId: string): Promise<string> {
  const runReference = runId || crypto.randomUUID();
  return `opportunity-budget:${runReference}:${await shortSourceHash(sourceId)}`;
}

function budgetDenialCode(result: Awaited<ReturnType<typeof claimGrowthActivityBudget>>): string | null {
  if (result.accepted) return null;
  if (result.ledgerCode) return result.ledgerCode;
  return result.decision.reasons[0] || "growth_activity_budget_denied";
}

function shouldStopAfterBudgetDenial(code: string | null): boolean {
  return code === "GROWTH_ACTIVITY_BUDGET_DAILY_LIMIT"
    || code === "usage_snapshot_invalid"
    || code === "usage_snapshot_stale"
    || code === "activity_profile_paused";
}

async function finishBudgetClaimSafely(
  env: Env,
  claim: GrowthActivityBudgetLedgerClaim,
  outcome: "completed" | "failed",
  outcomeCode: string,
  budget: BudgetRunSummary,
): Promise<void> {
  try {
    await completeGrowthActivityBudgetClaim(env, {
      claim,
      outcome,
      outcomeCode,
    });
    if (outcome === "completed") budget.completedSourceClaims += 1;
    else budget.failedSourceClaims += 1;
  } catch {
    budget.completionFailures += 1;
    await logEvent(
      env,
      "growth_activity_budget_completion_failed",
      `Growth activity claim completion failed after ${outcome}; reserved usage remains consumed and no automatic retry is allowed.`,
    ).catch(() => undefined);
  }
}

export async function runOpportunityAutonomy(
  env: Env,
  settings: OpportunityAutonomySettings,
  budgetContext?: OpportunityAutonomyBudgetContext,
) {
  const summary: OpportunityRunSummary = { sourcesChecked: 0, candidatesFound: 0, saved: 0, duplicates: 0, failed: 0, skipped: 0, rejected: 0 };
  const activitySettings = resolveGrowthActivitySettings(settings);
  const budget: BudgetRunSummary = {
    contractVersion: "growth_activity_budget_run_v1",
    intensity: activitySettings.intensity,
    effectiveSourceLimitPerRun: activitySettings.effectiveSourceLimitPerRun,
    effectiveMinimumOpportunityScore: activitySettings.effectiveMinimumOpportunityScore,
    admittedSourceClaims: 0,
    policyDeniedSourceClaims: 0,
    raceDeniedSourceClaims: 0,
    completedSourceClaims: 0,
    failedSourceClaims: 0,
    completionFailures: 0,
    ledgerUnavailable: false,
    lastDenialCode: null,
    persistentAdmissionRequired: true,
    automaticRetryAllowed: false,
  };
  const runId = await startOpportunityRun(env, "manual_confirmed", {
    ...settings,
    activityBudget: {
      contractVersion: activitySettings.contractVersion,
      intensity: activitySettings.intensity,
      effectiveSourceLimitPerRun: activitySettings.effectiveSourceLimitPerRun,
      effectiveMinimumOpportunityScore: activitySettings.effectiveMinimumOpportunityScore,
      persistentAdmissionRequired: true,
    },
    sourceSelectionContract: OPPORTUNITY_SOURCE_SELECTION_VERSION,
    researchFetchContract: PUBLIC_RESEARCH_FETCH_CONTRACT,
  });
  let successfulSources = 0;
  let sourceLeaseConflicts = 0;
  let lastFailureCode: string | null = null;

  try {
    if (!budgetContext) {
      await logEvent(env, "opportunity_tick_skip", "Confirmed manual opportunity run blocked because no Growth activity budget context was supplied.");
      await finishOpportunityRun(env, runId, "skipped", summary, "activity_budget_context_required");
      return { ...summary, runId, runType: "manual_confirmed", runStatus: "skipped", runError: "activity_budget_context_required", successfulSources, sourceLeaseConflicts, budget };
    }

    if (!activitySettings.manualResearchConfigured) {
      await logEvent(env, "opportunity_tick_skip", "Confirmed manual opportunity run skipped because engine, discovery or selected Growth activity profile is disabled.");
      await finishOpportunityRun(env, runId, "skipped", summary, "manual_research_not_configured");
      return { ...summary, runId, runType: "manual_confirmed", runStatus: "skipped", runError: "manual_research_not_configured", successfulSources, sourceLeaseConflicts, budget };
    }

    if (!(await tableExists(env, "opportunity_sources")) || !(await tableExists(env, "opportunities"))) {
      await logEvent(env, "opportunity_tick_skip", "Opportunity tables missing. Apply migration 0004_opportunity_intelligence.sql.");
      await finishOpportunityRun(env, runId, "skipped", summary, "missing_opportunity_tables");
      return { ...summary, runId, runType: "manual_confirmed", runStatus: "skipped", runError: "missing_opportunity_tables", successfulSources, sourceLeaseConflicts, budget };
    }

    if (!(await tableExists(env, "growth_activity_budget_usage_daily")) || !(await tableExists(env, "growth_activity_budget_claims"))) {
      budget.ledgerUnavailable = true;
      await logEvent(env, "opportunity_tick_skip", "Growth activity budget tables missing. Apply migration 0023_growth_activity_budget_ledger.sql before public research.");
      await finishOpportunityRun(env, runId, "skipped", summary, "activity_budget_migration_required");
      return { ...summary, runId, runType: "manual_confirmed", runStatus: "skipped", runError: "activity_budget_migration_required", successfulSources, sourceLeaseConflicts, budget };
    }

    const limit = Math.min(
      boundedInteger(settings.dailySourceLimit, 0, 0, 100),
      boundedInteger(settings.maxNetworkCallsPerRun, 0, 0, 250),
      activitySettings.effectiveSourceLimitPerRun,
    );
    if (limit <= 0) {
      await logEvent(env, "opportunity_tick_skip", "Confirmed manual opportunity run blocked by the effective Growth activity source limit.");
      await finishOpportunityRun(env, runId, "skipped", summary, "zero_effective_activity_limit");
      return { ...summary, runId, runType: "manual_confirmed", runStatus: "skipped", runError: "zero_effective_activity_limit", successfulSources, sourceLeaseConflicts, budget };
    }

    const sourceSelection = await dueSources(env, limit, activitySettings.intensity);
    if (!sourceSelection.selected.length) {
      await logEvent(env, "opportunity_tick_skip", "No due opportunity sources for confirmed manual review.");
      await finishOpportunityRun(env, runId, "skipped", summary, "no_due_sources");
      return {
        ...summary,
        runId,
        runType: "manual_confirmed",
        runStatus: "skipped",
        runError: "no_due_sources",
        successfulSources,
        sourceLeaseConflicts,
        budget,
        sourceSelection,
      };
    }

    for (const selectedSource of sourceSelection.selected) {
      const source = selectedSource.source;
      const sourceActionKey = `opportunity-source:${source.id}`;
      const sourceLease = await acquireManualResearchLease(env, sourceActionKey, 600);
      if (!sourceLease) {
        sourceLeaseConflicts += 1;
        continue;
      }

      let activityClaim: GrowthActivityBudgetLedgerClaim | null = null;
      try {
        let domain: string;
        try {
          domain = sourceDomain(source.url);
        } catch {
          summary.skipped += 1;
          lastFailureCode = "opportunity_source_domain_invalid";
          continue;
        }

        let claimResult: Awaited<ReturnType<typeof claimGrowthActivityBudget>>;
        try {
          claimResult = await claimGrowthActivityBudget(env, {
            claimId: await sourceBudgetClaimId(runId, source.id),
            requestBodySha256: budgetContext.requestBodySha256,
            intensity: activitySettings.intensity,
            action: "public_directory_scan",
            invocation: "manual",
            requestedUnits: 1,
            ownerApproved: budgetContext.ownerApproved,
            explicitlyConfirmed: budgetContext.explicitlyConfirmed,
            targetDomain: domain,
          });
        } catch {
          budget.ledgerUnavailable = true;
          budget.lastDenialCode = "growth_activity_budget_ledger_unavailable";
          lastFailureCode = budget.lastDenialCode;
          break;
        }

        if (!claimResult.accepted) {
          const denialCode = budgetDenialCode(claimResult);
          budget.lastDenialCode = denialCode;
          if (claimResult.denialSource === "database_race") budget.raceDeniedSourceClaims += 1;
          else budget.policyDeniedSourceClaims += 1;
          summary.skipped += 1;
          if (shouldStopAfterBudgetDenial(denialCode)) break;
          continue;
        }
        activityClaim = claimResult.claim;
        budget.admittedSourceClaims += 1;
        summary.sourcesChecked += 1;

        let candidatesFound = 0;
        let candidatesSaved = 0;
        let candidatesRejected = 0;
        let duplicates = 0;
        let activityOutcome: "completed" | "failed" = "failed";
        let activityOutcomeCode = "source_processing_failed";

        try {
          const fetched = await fetchPublicResearchHtml(source.url);
          if (!fetched.ok || !fetched.body) {
            const error = fetched.error || "source_fetch_failed";
            activityOutcomeCode = "source_fetch_failed";
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
            sourceSelection: {
              contractVersion: sourceSelection.contractVersion,
              mode: selectedSource.mode,
              score: selectedSource.score,
              metrics: selectedSource.metrics,
            },
          };
          const candidates = extractOpportunityCandidates(fetched.body, fetched.finalUrl || source.url, 50);
          candidatesFound = candidates.length;
          summary.candidatesFound += candidates.length;

          for (const candidate of candidates.slice(0, 10)) {
            if (!candidate.evidence) {
              summary.skipped += 1;
              summary.rejected += 1;
              candidatesRejected += 1;
              await recordCandidateRejection(env, {
                runId,
                sourceId: source.id,
                sourceUrl: source.url,
                candidateUrl: candidate.url,
                candidateTitle: candidate.title,
                score: candidate.score,
                reason: "missing_candidate_evidence",
                evidence: { sourceFetch: sourceReceipt },
              });
              continue;
            }
            const candidateWithReceipt = {
              ...candidate,
              evidence: {
                ...candidate.evidence,
                sourceFetch: sourceReceipt,
              },
            };
            const result = await saveOpportunityCandidate(env, source, candidateWithReceipt, {
              minScore: activitySettings.effectiveMinimumOpportunityScore,
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
          activityOutcome = "completed";
          activityOutcomeCode = "source_processed";
        } catch {
          const error = "manual_opportunity_source_processing_failed";
          lastFailureCode = error;
          activityOutcomeCode = "source_processing_failed";
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
        } finally {
          await finishBudgetClaimSafely(
            env,
            activityClaim,
            activityOutcome,
            activityOutcomeCode,
            budget,
          );
        }
      } finally {
        await releaseManualResearchLease(env, sourceLease).catch(() => false);
      }
    }

    const runStatus = budget.ledgerUnavailable && successfulSources === 0
      ? "skipped"
      : successfulSources === 0 && summary.failed === 0
        ? "skipped"
        : summary.failed > 0 && successfulSources === 0
          ? "failed"
          : summary.failed > 0 || sourceLeaseConflicts > 0 || budget.policyDeniedSourceClaims > 0 || budget.raceDeniedSourceClaims > 0
            ? "partial"
            : "completed";
    const runError = budget.ledgerUnavailable
      ? "activity_budget_ledger_unavailable"
      : runStatus === "skipped" && budget.policyDeniedSourceClaims + budget.raceDeniedSourceClaims > 0
        ? budget.lastDenialCode || "activity_budget_denied"
        : runStatus === "skipped"
          ? "all_selected_sources_busy"
          : runStatus === "failed"
            ? lastFailureCode || "all_opportunity_sources_failed"
            : runStatus === "partial"
              ? `partial_source_outcomes:failed:${summary.failed}:busy:${sourceLeaseConflicts}:budget:${budget.policyDeniedSourceClaims + budget.raceDeniedSourceClaims}`
              : null;
    await logEvent(
      env,
      "opportunity_tick_ok",
      `Confirmed manual opportunity run ${runStatus} | activity ${budget.intensity} | source-pool ${sourceSelection.considered} | explored ${sourceSelection.explorationSelected} | exploited ${sourceSelection.exploitationSelected} | checked ${summary.sourcesChecked} | admitted ${budget.admittedSourceClaims} | budget-denied ${budget.policyDeniedSourceClaims + budget.raceDeniedSourceClaims} | successful ${successfulSources} | busy ${sourceLeaseConflicts} | candidates ${summary.candidatesFound} | saved ${summary.saved} | duplicates ${summary.duplicates} | skipped ${summary.skipped} | rejected ${summary.rejected} | failed ${summary.failed} | run ${runId || "audit_disabled"}`,
    );
    await finishOpportunityRun(env, runId, runStatus, summary, runError);
    return {
      ...summary,
      runId,
      runType: "manual_confirmed",
      runStatus,
      runError,
      successfulSources,
      sourceLeaseConflicts,
      budget,
      sourceSelection: {
        contractVersion: sourceSelection.contractVersion,
        considered: sourceSelection.considered,
        selected: sourceSelection.selected.length,
        explorationSlots: sourceSelection.explorationSlots,
        explorationSelected: sourceSelection.explorationSelected,
        exploitationSelected: sourceSelection.exploitationSelected,
      },
      fetchContract: PUBLIC_RESEARCH_FETCH_CONTRACT,
      fullOperationTimeout: true,
      sourceHealthAndAuditAtomic: true,
      overlappingPerSourceActionAllowed: false,
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
