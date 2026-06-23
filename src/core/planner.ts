import { Env, getSetting, listEvents } from "../db";
import { buildHealthReport } from "./health";
import { getBudgetSnapshot } from "./budgetGuard";

interface CountRow {
  status: string;
  count: number;
}

interface PlannerActionCard {
  id: string;
  label: string;
  priority: "high" | "medium" | "low";
  method: "GET" | "POST";
  route: string;
  requiresConfirm: boolean;
  payload?: Record<string, unknown>;
  reason: string;
  safety: string[];
  powershell: string;
}

async function countByStatus(env: Env, table: "sources" | "drafts" | "leads"): Promise<Record<string, number>> {
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

async function sampleDrafts(env: Env, limit = 5) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, lead_id, subject, status, created_at_iso, updated_at_iso FROM drafts WHERE status IN ('queued', 'created', 'approved') ORDER BY updated_at_iso DESC LIMIT ?"
    ).bind(Math.max(1, Math.min(20, limit))).all<any>();
    return results || [];
  } catch {
    return [];
  }
}

async function sampleSources(env: Env, status: string, limit = 5) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, url, status, category, country, region, failure_count, success_count, next_run_at_iso, cooldown_until_iso, updated_at_iso FROM sources WHERE status = ? ORDER BY updated_at_iso DESC LIMIT ?"
    ).bind(status, Math.max(1, Math.min(20, limit))).all<any>();
    return results || [];
  } catch {
    return [];
  }
}

function sumCounts(counts: Record<string, number>, keys: string[]) {
  return keys.reduce((total, key) => total + Number(counts[key] || 0), 0);
}

function psInvoke(method: "GET" | "POST", route: string, payload?: Record<string, unknown>): string {
  if (method === "GET") {
    return `Invoke-RestMethod "$Base${route}" -Headers @{ Authorization = "Bearer $Token" } | ConvertTo-Json -Depth 30`;
  }
  const body = payload ? JSON.stringify(payload).replace(/"/g, '\\"') : "{}";
  return `$Body = '${body}'\nInvoke-RestMethod "$Base${route}" -Method POST -Headers @{ Authorization = "Bearer $Token"; "Content-Type" = "application/json" } -Body $Body | ConvertTo-Json -Depth 30`;
}

function buildActionCards(input: {
  draftBacklog: number;
  activeSources: number;
  cooldownSources: number;
  sampleDrafts: any[];
  sampleActiveSources: any[];
  sampleCooldownSources: any[];
}): PlannerActionCard[] {
  const cards: PlannerActionCard[] = [];

  if (input.draftBacklog > 0) {
    cards.push({
      id: "review_draft_backlog",
      label: `Review draft backlog (${input.draftBacklog})`,
      priority: input.draftBacklog >= 50 ? "high" : "medium",
      method: "GET",
      route: "/admin/drafts?status=created&limit=20",
      requiresConfirm: false,
      reason: "Existing drafts are already paid-for work. Review them before spending more crawl or AI budget.",
      safety: ["read_only", "no_ai", "no_sending"],
      powershell: psInvoke("GET", "/admin/drafts?status=created&limit=20"),
    });
  }

  if (input.sampleDrafts[0]?.id) {
    cards.push({
      id: "review_one_draft_needs_rewrite",
      label: "Mark one draft as needing rewrite",
      priority: "medium",
      method: "POST",
      route: `/admin/draft-review/${input.sampleDrafts[0].id}`,
      requiresConfirm: true,
      payload: { decision: "needs_rewrite", reason: "too_generic", notes: "Needs more specific evidence before approval." },
      reason: "Creates learning data without sending anything.",
      safety: ["no_ai", "no_sending", "audit_logged"],
      powershell: psInvoke("POST", `/admin/draft-review/${input.sampleDrafts[0].id}`, { decision: "needs_rewrite", reason: "too_generic", notes: "Needs more specific evidence before approval." }),
    });
  }

  if (input.activeSources > 0) {
    cards.push({
      id: "run_tiny_source_batch",
      label: "Run tiny source batch",
      priority: input.draftBacklog >= 50 ? "low" : "high",
      method: "POST",
      route: "/admin/sources/run-tiny",
      requiresConfirm: true,
      payload: { confirm: true, limit: 1 },
      reason: "Tests a very small number of active sources and records source_runs without calling AI or sending email.",
      safety: ["bounded_fetch", "no_ai", "no_sending", "max_3_sources", "confirm_required"],
      powershell: psInvoke("POST", "/admin/sources/run-tiny", { confirm: true, limit: 1 }),
    });
  }

  if (input.sampleActiveSources[0]?.id) {
    cards.push({
      id: "source_expand_preview",
      label: "Preview one source expansion",
      priority: "medium",
      method: "POST",
      route: `/admin/sources/${input.sampleActiveSources[0].id}/expand-preview`,
      requiresConfirm: true,
      payload: { limit: 20 },
      reason: "Shows candidate profile links before inserting any leads.",
      safety: ["preview_only", "no_lead_inserts", "no_ai", "no_sending"],
      powershell: psInvoke("POST", `/admin/sources/${input.sampleActiveSources[0].id}/expand-preview`, { limit: 20 }),
    });
  }

  if (input.activeSources === 0) {
    cards.push({
      id: "add_manual_source",
      label: "Add a manual source",
      priority: "high",
      method: "POST",
      route: "/admin/sources",
      requiresConfirm: true,
      payload: { url: "https://example.com/directory", sourceType: "manual_seed", category: "general", country: "AU" },
      reason: "The agent needs active sources before it can do safe bounded discovery.",
      safety: ["metadata_only", "no_fetch", "no_ai", "no_sending"],
      powershell: psInvoke("POST", "/admin/sources", { url: "https://example.com/directory", sourceType: "manual_seed", category: "general", country: "AU" }),
    });
  }

  if (input.cooldownSources > 0) {
    cards.push({
      id: "inspect_cooldown_sources",
      label: `Inspect cooldown sources (${input.cooldownSources})`,
      priority: "low",
      method: "GET",
      route: "/admin/sources?status=cooldown&limit=20",
      requiresConfirm: false,
      reason: "Cooling-down sources should not be retried until their cooldown expires.",
      safety: ["read_only", "no_fetch", "no_ai", "no_sending"],
      powershell: psInvoke("GET", "/admin/sources?status=cooldown&limit=20"),
    });
  }

  return cards;
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
  const emptyCounts: Record<string, number> = {};
  const [health, budget, sourceCounts, draftCounts, leadCounts, events, sourceRuns, draftsForAction, activeSourcesForAction, cooldownSourcesForAction] = await Promise.all([
    buildHealthReport(env),
    getBudgetSnapshot(env),
    countByStatus(env, "sources").catch(() => emptyCounts),
    countByStatus(env, "drafts").catch(() => emptyCounts),
    countByStatus(env, "leads").catch(() => emptyCounts),
    listEvents(env, 15).catch(() => []),
    recentSourceRuns(env, 10),
    sampleDrafts(env, 5),
    sampleSources(env, "active", 5),
    sampleSources(env, "cooldown", 5),
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

  const actionCards = buildActionCards({
    draftBacklog,
    activeSources,
    cooldownSources,
    sampleDrafts: draftsForAction,
    sampleActiveSources: activeSourcesForAction,
    sampleCooldownSources: cooldownSourcesForAction,
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
    samples: {
      drafts: draftsForAction,
      activeSources: activeSourcesForAction,
      cooldownSources: cooldownSourcesForAction,
    },
    decision: {
      ...decision,
      actionCards,
      primaryActionCard: actionCards.find((card) => card.id === decision.recommendedNextAction) || actionCards[0] || null,
    },
  };
}
