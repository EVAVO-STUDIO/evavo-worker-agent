import { Env, EventRow, getSetting, listEvents, safeJsonParse } from "../db";
import { getBudgetSnapshot } from "./budgetGuard";
import { getNumericSetting, getSettingWithDefault } from "./settings";

interface CountRow {
  status: string;
  count: number;
}

export interface HealthReport {
  ok: boolean;
  status: "healthy" | "degraded" | "blocked";
  contractVersion: "admin_health_v2_manual_research_only";
  costMode: string;
  primaryIssues: string[];
  runtime: {
    scheduledExecutionEnabled: false;
    scheduledExternalResearchEnabled: false;
    manualResearchRequiresAuthentication: true;
    manualResearchRequiresConfirmation: true;
    manualResearchIsBounded: true;
    manualResearchSavesReviewItemsOnly: true;
    aiDraftingEnabled: false;
    sendingEnabled: false;
    externalExecutionEnabled: false;
  };
  historicalState: {
    leadCounts: Record<string, number>;
    draftCounts: Record<string, number>;
    draftBacklog: number;
    latestRepeatedFailures: Array<{ url: string; count: number }>;
    historicalOnly: true;
    executable: false;
  };
  historicalBudgetSnapshot: Record<string, { used: number; limit: number; remaining: number }>;
  blockedActions: Array<{ action: string; reason: string }>;
  recommendedActions: string[];
  safety: {
    internalMetadataOnly: true;
    historicalRecordsExecutable: false;
    callsAI: false;
    callsNetwork: false;
    canSendEmail: false;
    canPostSocial: false;
    canSubmitForms: false;
  };
}

async function statusCounts(env: Env, table: "leads" | "drafts"): Promise<Record<string, number>> {
  const { results } = (await env.DB.prepare(
    `SELECT status, COUNT(*) AS count FROM ${table} GROUP BY status`
  ).all()) as { results?: CountRow[] };
  const out: Record<string, number> = {};
  for (const row of results || []) out[String(row.status || "unknown")] = Number(row.count || 0);
  return out;
}

function extractUrl(message: string): string | null {
  const match = /(https?:\/\/[^\s)]+)(?:\s|$)/i.exec(message);
  if (!match) return null;
  return match[1].replace(/[.,;]+$/, "");
}

function repeatedFailures(events: EventRow[], threshold: number): Array<{ url: string; count: number }> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    if (String(event.type).toLowerCase() !== "scan_fail") continue;
    const url = extractUrl(String(event.message || ""));
    if (!url) continue;
    counts[url] = (counts[url] || 0) + 1;
  }
  return Object.entries(counts)
    .filter(([, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([url, count]) => ({ url, count }));
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

async function detectStaleCounters(env: Env): Promise<boolean> {
  const today = todayUTC();
  const dailyReset = await getSetting(env, "daily_reset_iso");
  const statsDay = await getSetting(env, "stats_day");
  if (dailyReset && !String(dailyReset).startsWith(today)) return true;
  if (statsDay && String(statsDay) !== today) return true;
  return false;
}

function draftBacklogFromCounts(counts: Record<string, number>): number {
  return Number(counts.created || 0) + Number(counts.queued || 0) + Number(counts.approved || 0);
}

function buildRecommendations(issues: string[]) {
  const recs: string[] = [];
  if (issues.includes("historical_draft_backlog_over_threshold")) recs.push("review_historical_draft_records");
  if (issues.includes("historical_repeated_source_failures")) recs.push("review_source_health_before_manual_research");
  if (issues.includes("stale_historical_counters")) recs.push("review_stale_reporting_counters");
  if (!recs.length) recs.push("continue_review_first_monitoring");
  return Array.from(new Set(recs));
}

export async function buildHealthReport(env: Env): Promise<HealthReport> {
  const costMode = await getSettingWithDefault(env, "cost_mode");
  const leadCounts = await statusCounts(env, "leads");
  const draftCounts = await statusCounts(env, "drafts");
  const draftBacklog = draftBacklogFromCounts(draftCounts);
  const events = await listEvents(env, 50);
  const failureThreshold = await getNumericSetting(env, "source_failure_cooldown_threshold");
  const latestRepeatedFailures = repeatedFailures(events, failureThreshold || 3);
  const historicalBudgetSnapshot = await getBudgetSnapshot(env);

  const primaryIssues: string[] = [];
  const blockedActions: Array<{ action: string; reason: string }> = [
    { action: "scheduled_external_research", reason: "Scheduled external research is disabled by the active review-first runtime contract." },
    { action: "ai_drafting", reason: "AI drafting is disabled." },
    { action: "email_send", reason: "Email sending is disabled." },
    { action: "external_execution", reason: "External state mutation is disabled." },
  ];
  const draftThreshold = await getNumericSetting(env, "draft_backlog_pause_scan_threshold");

  if (latestRepeatedFailures.length) primaryIssues.push("historical_repeated_source_failures");
  if (draftBacklog >= draftThreshold) primaryIssues.push("historical_draft_backlog_over_threshold");
  if (await detectStaleCounters(env)) primaryIssues.push("stale_historical_counters");

  const status: HealthReport["status"] = primaryIssues.length ? "degraded" : "healthy";

  return {
    ok: status === "healthy",
    status,
    contractVersion: "admin_health_v2_manual_research_only",
    costMode,
    primaryIssues,
    runtime: {
      scheduledExecutionEnabled: false,
      scheduledExternalResearchEnabled: false,
      manualResearchRequiresAuthentication: true,
      manualResearchRequiresConfirmation: true,
      manualResearchIsBounded: true,
      manualResearchSavesReviewItemsOnly: true,
      aiDraftingEnabled: false,
      sendingEnabled: false,
      externalExecutionEnabled: false,
    },
    historicalState: {
      leadCounts,
      draftCounts,
      draftBacklog,
      latestRepeatedFailures,
      historicalOnly: true,
      executable: false,
    },
    historicalBudgetSnapshot,
    blockedActions,
    recommendedActions: buildRecommendations(primaryIssues),
    safety: {
      internalMetadataOnly: true,
      historicalRecordsExecutable: false,
      callsAI: false,
      callsNetwork: false,
      canSendEmail: false,
      canPostSocial: false,
      canSubmitForms: false,
    },
  };
}

export async function buildDiagnosticsReport(env: Env, opts: { deep?: boolean; confirm?: boolean } = {}) {
  const costMode = await getSettingWithDefault(env, "cost_mode");
  if (costMode === "free_safe" && opts.deep && !opts.confirm) {
    return {
      ok: false,
      error: "deep_diagnostics_requires_confirm_in_free_safe_mode",
      hint: "Retry with ?deep=1&confirm=1 only when you intentionally want the heavier read-only diagnostic path.",
      safety: { readOnly: true, callsNetwork: false, externalStateChange: false },
    };
  }

  const health = await buildHealthReport(env);
  const events = await listEvents(env, opts.deep ? 150 : 20);
  const lastRunRaw = await getSetting(env, "last_engine_run");
  const settingsKeys = [
    "engine_enabled",
    "cost_mode",
    "ai_enabled",
    "sending_enabled",
    "drafting_enabled",
    "approval_required",
    "daily_reset_iso",
    "stats_day",
    "draft_backlog_pause_scan_threshold",
  ];
  const compatibilitySettings: Record<string, string | null> = {};
  for (const key of settingsKeys) compatibilitySettings[key] = await getSetting(env, key);

  return {
    ok: true,
    contractVersion: "admin_diagnostics_v2_historical_read_only",
    mode: opts.deep ? "deep_read_only" : "cheap_read_only",
    health,
    compatibilitySettings: {
      values: compatibilitySettings,
      historicalOnly: true,
      authoritativeForExecution: false,
    },
    lastHistoricalRun: {
      value: safeJsonParse(lastRunRaw) || lastRunRaw || null,
      historicalOnly: true,
      executable: false,
    },
    recentEvents: {
      values: events,
      internalOnly: true,
      executable: false,
    },
    safety: {
      readOnly: true,
      internalMetadataOnly: true,
      callsAI: false,
      callsNetwork: false,
      externalStateChange: false,
    },
  };
}
