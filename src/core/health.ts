import { Env, EventRow, getSetting, listEvents, safeJsonParse } from "../db";
import { getBudgetSnapshot } from "./budgetGuard";
import { getNumericSetting, getSettingWithDefault } from "./settings";

interface CountRow {
  status: string;
  count: number;
}

export interface HealthReport {
  ok: boolean;
  status: "healthy" | "degraded" | "paused" | "blocked";
  costMode: string;
  primaryIssues: string[];
  liveState: {
    leadCounts: Record<string, number>;
    draftCounts: Record<string, number>;
    draftBacklog: number;
    latestRepeatedFailures: Array<{ url: string; count: number }>;
  };
  budget: Record<string, { used: number; limit: number; remaining: number }>;
  blockedActions: Array<{ action: string; reason: string }>;
  recommendedActions: string[];
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
  if (issues.includes("draft_backlog_over_threshold")) recs.push("review_draft_backlog");
  if (issues.includes("planner_stuck_on_repeated_failed_source")) recs.push("cooldown_repeated_failed_source");
  if (issues.includes("stale_daily_counters")) recs.push("reset_stale_counters");
  if (!recs.length) recs.push("continue_free_safe_tick");
  if (issues.includes("draft_backlog_over_threshold")) recs.push("delay_large_scans_until_existing_drafts_are_reviewed");
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
  const budget = await getBudgetSnapshot(env);

  const primaryIssues: string[] = [];
  const blockedActions: Array<{ action: string; reason: string }> = [];
  const draftThreshold = await getNumericSetting(env, "draft_backlog_pause_scan_threshold");

  if (latestRepeatedFailures.length) {
    primaryIssues.push("planner_stuck_on_repeated_failed_source");
  }

  if (draftBacklog >= draftThreshold) {
    primaryIssues.push("draft_backlog_over_threshold");
    blockedActions.push({ action: "large_scan", reason: `Draft backlog is ${draftBacklog}, above threshold ${draftThreshold}. Review existing drafts before scanning more.` });
  }

  if (await detectStaleCounters(env)) primaryIssues.push("stale_daily_counters");

  if ((await getSetting(env, "ai_enabled")) !== "1") {
    blockedActions.push({ action: "ai_call", reason: "AI is disabled in FREE_SAFE mode." });
  }

  if ((await getSetting(env, "sending_enabled")) !== "1") {
    blockedActions.push({ action: "email_send", reason: "Sending is disabled." });
  }

  const engineEnabled = ((await getSetting(env, "engine_enabled")) || "1") !== "0";
  const status: HealthReport["status"] = !engineEnabled ? "paused" : primaryIssues.length ? "degraded" : "healthy";

  return {
    ok: status === "healthy",
    status,
    costMode,
    primaryIssues,
    liveState: {
      leadCounts,
      draftCounts,
      draftBacklog,
      latestRepeatedFailures,
    },
    budget,
    blockedActions,
    recommendedActions: buildRecommendations(primaryIssues),
  };
}

export async function buildDiagnosticsReport(env: Env, opts: { deep?: boolean; confirm?: boolean } = {}) {
  const costMode = await getSettingWithDefault(env, "cost_mode");
  if (costMode === "free_safe" && opts.deep && !opts.confirm) {
    return {
      ok: false,
      error: "deep_diagnostics_requires_confirm_in_free_safe_mode",
      hint: "Retry with ?deep=1&confirm=1 only when you intentionally want the heavier diagnostic path.",
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
  const settings: Record<string, string | null> = {};
  for (const key of settingsKeys) settings[key] = await getSetting(env, key);

  return {
    ok: true,
    mode: opts.deep ? "deep" : "cheap",
    health,
    settings,
    lastEngineRun: safeJsonParse(lastRunRaw) || lastRunRaw || null,
    recentEvents: events,
  };
}
