import { Env, getSetting, listEvents } from "../db";
import { buildHealthReport } from "./health";
import { getBudgetSnapshot } from "./budgetGuard";

interface CountRow {
  status: string;
  count: number;
}

async function countByStatus(env: Env, table: "sources" | "drafts" | "leads") {
  const { results } = (await env.DB.prepare(`SELECT status, COUNT(*) AS count FROM ${table} GROUP BY status`).all()) as { results?: CountRow[] };
  const out: Record<string, number> = {};
  for (const row of results || []) out[String(row.status || "unknown")] = Number(row.count || 0);
  return out;
}

async function recentSourceRuns(env: Env, limit = 10) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, source_id, status, profiles_found, external_sites_found, leads_inserted, duplicates_skipped, failed_reason, created_at_iso FROM source_runs ORDER BY created_at_iso DESC LIMIT ?"
    ).bind(Math.max(1, Math.min(50, limit))).all<any>();
    return results || [];
  } catch {
    return [];
  }
}

function sumCounts(counts: Record<string, number>, keys: string[]) {
  return keys.reduce((total, key) => total + Number(counts[key] || 0), 0);
}

function decide(input: {
  engineEnabled: boolean;
  aiEnabled: boolean;
  sendingEnabled: boolean;
  draftBacklog: number;
  activeSources: number;
  cooldownSources: number;
  sourceRuns: any[];
  healthIssues: string[];
}) {
  const safeActions: string[] = [];
  const blockedActions: Array<{ action: string; reason: string }> = [];
  const why: string[] = [];

  if (!input.engineEnabled) {
    why.push("Engine cron loop is paused, so manual bounded actions are safer than automatic running.");
  }
  if (!input.aiEnabled) blockedActions.push({ action: "ai_call", reason: "AI is disabled." });
  if (!input.sendingEnabled) blockedActions.push({ action: "email_send", reason: "Sending is disabled." });

  if (input.draftBacklog >= 50) {
    safeActions.push("review_draft_backlog");
    blockedActions.push({ action: "large_scan", reason: `Draft backlog is ${input.draftBacklog}; review existing drafts before large scans.` });
    why.push(`Draft backlog is ${input.draftBacklog}, so review work should happen before heavy discovery.`);
  }

  if (input.activeSources > 0) {
    safeActions.push("run_tiny_source_batch");
    safeActions.push("source_expand_preview");
    why.push(`${input.activeSources} active source(s) are available for bounded manual source work.`);
  } else {
    safeActions.push("add_manual_source");
    why.push("No active sources are available, so the safest discovery action is to add a manual source.");
  }

  if (input.cooldownSources > 0) {
    safeActions.push("inspect_cooldown_sources");
    why.push(`${input.cooldownSources} source(s) are cooling down and should not be retried yet.`);
  }

  if (input.healthIssues.includes("planner_stuck_on_repeated_failed_source")) {
    safeActions.push("cooldown_repeated_failed_source");
  }

  let recommendedNextAction = "review_draft_backlog";
  if (input.draftBacklog < 50 && input.activeSources > 0) recommendedNextAction = "run_tiny_source_batch";
  if (input.draftBacklog < 10 && input.activeSources > 0) recommendedNextAction = "source_expand_preview";
  if (input.activeSources === 0) recommendedNextAction = "add_manual_source";

  return {
    recommendedNextAction,
    safeActions: Array.from(new Set(safeActions)),
    blockedActions,
    why,
  };
}

export async function buildPlannerReport(env: Env) {
  const [health, budget, sourceCounts, draftCounts, leadCounts, events, sourceRuns] = await Promise.all([
    buildHealthReport(env),
    getBudgetSnapshot(env),
    countByStatus(env, "sources").catch(() => ({})),
    countByStatus(env, "drafts").catch(() => ({})),
    countByStatus(env, "leads").catch(() => ({})),
    listEvents(env, 15).catch(() => []),
    recentSourceRuns(env, 10),
  ]);

  const engineEnabled = ((await getSetting(env, "engine_enabled")) || "1") !== "0";
  const aiEnabled = (await getSetting(env, "ai_enabled")) === "1";
  const sendingEnabled = (await getSetting(env, "sending_enabled")) === "1";
  const draftBacklog = sumCounts(draftCounts, ["queued", "created", "approved"]);
  const activeSources = Number(sourceCounts.active || 0);
  const cooldownSources = Number(sourceCounts.cooldown || 0);
  const decision = decide({
    engineEnabled,
    aiEnabled,
    sendingEnabled,
    draftBacklog,
    activeSources,
    cooldownSources,
    sourceRuns,
    healthIssues: health.primaryIssues || [],
  });

  return {
    ok: true,
    mode: "read_only_planner_v1",
    nowISO: new Date().toISOString(),
    flags: {
      engineEnabled,
      aiEnabled,
      sendingEnabled,
      costMode: health.costMode,
    },
    state: {
      healthStatus: health.status,
      healthIssues: health.primaryIssues,
      leadCounts,
      draftCounts,
      sourceCounts,
      draftBacklog,
    },
    budget,
    recent: {
      sourceRuns,
      events,
    },
    decision,
  };
}
