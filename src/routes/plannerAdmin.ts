import { Env, getAdminToken, nowISO, uuid } from "../db";
import { buildPlannerReport } from "../core/planner";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

type BadgeTone = "good" | "warning" | "danger" | "neutral";
type RiskLevel = "low" | "medium" | "high";

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

function confirmed(body: any): boolean {
  return body?.confirm === true || body?.confirm === 1 || body?.confirm === "1";
}

function safeParse(raw: unknown): any {
  try {
    return JSON.parse(String(raw || "{}"));
  } catch {
    return {};
  }
}

function badge(id: string, label: string, tone: BadgeTone, detail?: string) {
  return { id, label, tone, detail: detail || null };
}

function buildDashboardBadges(planner: any) {
  const flags = planner.flags || {};
  const state = planner.state || {};
  const sourceCounts = state.sourceCounts || {};
  const draftBacklog = Number(state.draftBacklog || 0);
  const activeSources = Number(sourceCounts.active || 0);
  const cooldownSources = Number(sourceCounts.cooldown || 0);
  const healthIssues = Array.isArray(state.healthIssues) ? state.healthIssues : [];
  const cards = planner.decision?.actionCards || [];

  const badges = [];
  badges.push(flags.engineEnabled ? badge("engine_on", "Engine on", "warning", "Cron loop can run.") : badge("engine_paused", "Engine paused", "good", "Manual bounded control is active."));
  badges.push(flags.aiEnabled ? badge("ai_on", "AI on", "warning", "AI calls may spend budget.") : badge("ai_off", "AI off", "good", "No AI calls allowed."));
  badges.push(flags.sendingEnabled ? badge("sending_on", "Sending on", "danger", "Outbound email sending is enabled.") : badge("sending_off", "Sending off", "good", "No outbound sends allowed."));

  if (draftBacklog >= 50) badges.push(badge("draft_backlog_high", "Draft backlog high", "warning", `${draftBacklog} drafts need review before heavy discovery.`));
  else if (draftBacklog > 0) badges.push(badge("draft_backlog_present", "Draft backlog present", "neutral", `${draftBacklog} drafts available for review.`));
  else badges.push(badge("draft_backlog_clear", "Draft backlog clear", "good", "No created/queued/approved draft backlog."));

  if (activeSources > 0) badges.push(badge("sources_available", "Sources available", "good", `${activeSources} active source(s).`));
  else badges.push(badge("no_active_sources", "No active sources", "warning", "Add or reactivate a source before discovery."));

  if (cooldownSources > 0) badges.push(badge("sources_in_cooldown", "Sources in cooldown", "neutral", `${cooldownSources} source(s) cooling down.`));

  if (healthIssues.length > 0) badges.push(badge("health_issues", "Health issues", "warning", `${healthIssues.length} issue(s) reported.`));
  else badges.push(badge("health_clear", "Health clear", "good", "No primary health issues reported."));

  if (cards.length > 0) badges.push(badge("planner_ready", "Planner ready", "good", `${cards.length} safe action card(s) available.`));
  else badges.push(badge("planner_no_actions", "No planner actions", "warning", "Planner did not return action cards."));

  badges.push(badge("manual_action_required", "Manual action required", "neutral", "Planner will not execute unsafe actions automatically."));
  return badges;
}

function buildDashboardRisk(planner: any) {
  const flags = planner.flags || {};
  const state = planner.state || {};
  const sourceCounts = state.sourceCounts || {};
  const draftBacklog = Number(state.draftBacklog || 0);
  const healthIssues = Array.isArray(state.healthIssues) ? state.healthIssues : [];
  const blockedActions = planner.decision?.blockedActions || [];
  const activeSources = Number(sourceCounts.active || 0);
  const cooldownSources = Number(sourceCounts.cooldown || 0);
  const needsReviewSources = Number(sourceCounts.needs_review || 0);

  let riskScore = 0;
  const riskReasons: string[] = [];

  if (flags.sendingEnabled) {
    riskScore += 35;
    riskReasons.push("Sending is enabled, so outbound email risk is high.");
  }
  if (flags.aiEnabled) {
    riskScore += 15;
    riskReasons.push("AI is enabled, so budget/spend risk is present.");
  }
  if (flags.engineEnabled) {
    riskScore += 20;
    riskReasons.push("Engine is enabled, so automatic cron work may run.");
  }
  if (draftBacklog >= 50) {
    riskScore += 15;
    riskReasons.push(`Draft backlog is high (${draftBacklog}); review before more discovery.`);
  } else if (draftBacklog >= 20) {
    riskScore += 8;
    riskReasons.push(`Draft backlog is moderate (${draftBacklog}).`);
  }
  if (healthIssues.length > 0) {
    riskScore += Math.min(20, healthIssues.length * 5);
    riskReasons.push(`${healthIssues.length} health issue(s) reported.`);
  }
  if (activeSources === 0) {
    riskScore += 8;
    riskReasons.push("No active sources are available for safe discovery.");
  }
  if (cooldownSources > 0) {
    riskScore += Math.min(10, cooldownSources * 2);
    riskReasons.push(`${cooldownSources} source(s) are in cooldown.`);
  }
  if (needsReviewSources > 0) {
    riskScore += Math.min(12, needsReviewSources * 3);
    riskReasons.push(`${needsReviewSources} source(s) need review.`);
  }
  if (blockedActions.length > 0) {
    riskScore += Math.min(10, blockedActions.length * 2);
    riskReasons.push(`${blockedActions.length} blocked action(s) are currently enforced.`);
  }

  riskScore = Math.max(0, Math.min(100, riskScore));
  const riskLevel: RiskLevel = riskScore >= 60 ? "high" : riskScore >= 30 ? "medium" : "low";
  if (riskReasons.length === 0) riskReasons.push("No major operational risks detected in planner state.");

  return { riskLevel, riskScore, riskReasons };
}

function summarizeRecommendationRow(row: any) {
  if (!row) return null;
  const evidence = safeParse(row.evidence_json);
  const report = evidence.report || {};
  return {
    id: row.id,
    createdAt: row.created_at_iso,
    recommendedNextAction: row.target_id,
    primaryRoute: row.target_url,
    reason: row.reason,
    confidence: row.confidence,
    recordedBy: evidence.recordedBy || null,
    notes: evidence.notes || null,
    healthStatus: report.state?.healthStatus || null,
    draftBacklog: report.state?.draftBacklog ?? null,
    safeActions: report.decision?.safeActions || [],
    blockedActions: report.decision?.blockedActions || [],
  };
}

function summarizeExecutionRow(row: any) {
  if (!row) return null;
  const evidence = safeParse(row.evidence_json);
  const result = evidence.result || {};
  return {
    id: row.id,
    createdAt: row.created_at_iso,
    actionId: row.target_id,
    route: row.target_url,
    reason: row.reason,
    confidence: row.confidence,
    requestedBy: evidence.requestedBy || null,
    notes: evidence.notes || null,
    resultOk: result.ok === true,
    resultMode: result.mode || null,
    resultSummary: {
      error: result.error || null,
      selectedSourceCount: Array.isArray(result.selectedSources) ? result.selectedSources.length : null,
      draftCount: Array.isArray(result.drafts) ? result.drafts.length : null,
      sourceCount: Array.isArray(result.sources) ? result.sources.length : null,
      hasSource: Boolean(result.source),
    },
  };
}

async function latestDecision(env: Env, decisionType: string) {
  const row = await env.DB.prepare(
    `SELECT id, target_id, target_url, reason, confidence, evidence_json, created_at_iso
     FROM agent_decisions
     WHERE decision_type = ?
     ORDER BY created_at_iso DESC
     LIMIT 1`
  ).bind(decisionType).first<any>();
  return row || null;
}

async function plannerHistory(env: Env, limit: number) {
  const rows = await env.DB.prepare(
    `SELECT id, target_id, target_url, reason, confidence, evidence_json, created_at_iso
     FROM agent_decisions
     WHERE decision_type = 'planner_recommendation'
     ORDER BY created_at_iso DESC
     LIMIT ?`
  ).bind(Math.max(1, Math.min(100, limit))).all<any>();

  const history = (rows.results || []).map((row: any) => summarizeRecommendationRow(row));

  return { ok: true, mode: "planner_history", count: history.length, history };
}

async function plannerExecutions(env: Env, limit: number) {
  const rows = await env.DB.prepare(
    `SELECT id, target_id, target_url, reason, confidence, evidence_json, created_at_iso
     FROM agent_decisions
     WHERE decision_type = 'planner_execute'
     ORDER BY created_at_iso DESC
     LIMIT ?`
  ).bind(Math.max(1, Math.min(100, limit))).all<any>();

  const executions = (rows.results || []).map((row: any) => summarizeExecutionRow(row));

  return { ok: true, mode: "planner_executions", count: executions.length, executions };
}

async function plannerDashboard(env: Env) {
  const [planner, latestRecommendationRow, latestExecutionRow] = await Promise.all([
    buildPlannerReport(env),
    latestDecision(env, "planner_recommendation"),
    latestDecision(env, "planner_execute"),
  ]);

  const latestRecommendation = summarizeRecommendationRow(latestRecommendationRow);
  const latestExecution = summarizeExecutionRow(latestExecutionRow);
  const primaryAction = planner.decision?.primaryActionCard || null;
  const badges = buildDashboardBadges(planner);
  const risk = buildDashboardRisk(planner);

  return {
    ok: true,
    mode: "planner_dashboard",
    nowISO: new Date().toISOString(),
    risk,
    badges,
    status: {
      healthStatus: planner.state?.healthStatus || null,
      healthIssues: planner.state?.healthIssues || [],
      engineEnabled: planner.flags?.engineEnabled === true,
      aiEnabled: planner.flags?.aiEnabled === true,
      sendingEnabled: planner.flags?.sendingEnabled === true,
      costMode: planner.flags?.costMode || "free_safe",
    },
    counts: {
      draftBacklog: planner.state?.draftBacklog || 0,
      leadCounts: planner.state?.leadCounts || {},
      draftCounts: planner.state?.draftCounts || {},
      sourceCounts: planner.state?.sourceCounts || {},
    },
    recommendation: {
      recommendedNextAction: planner.decision?.recommendedNextAction || null,
      safeActions: planner.decision?.safeActions || [],
      blockedActions: planner.decision?.blockedActions || [],
      why: planner.decision?.why || [],
      primaryAction,
      actionCards: planner.decision?.actionCards || [],
    },
    latestRecommendation,
    latestExecution,
    recent: {
      sourceRuns: planner.recent?.sourceRuns || [],
      events: planner.recent?.events || [],
    },
  };
}

async function recordExecution(env: Env, actionId: string, route: string, result: any, body: any) {
  const id = uuid();
  await env.DB.prepare(
    `INSERT INTO agent_decisions (id, run_id, decision_type, target_type, target_id, target_url, reason, confidence, evidence_json, created_at_iso)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    null,
    "planner_execute",
    "planner_action",
    actionId,
    route,
    `Planner execute envelope ran ${actionId}.`,
    80,
    JSON.stringify({ result, requestedBy: body?.requestedBy || "admin", notes: body?.notes || null }),
    nowISO()
  ).run();
  return id;
}

async function executePlannerAction(env: Env, actionId: string, body: any) {
  if (actionId === "review_draft_backlog") {
    const rows = await env.DB.prepare(
      "SELECT id, lead_id, subject, status, created_at_iso, updated_at_iso FROM drafts WHERE status IN ('created', 'queued', 'approved') ORDER BY updated_at_iso DESC LIMIT 20"
    ).all<any>();
    return { route: "/admin/drafts?status=created&limit=20", result: { ok: true, mode: "read_only", drafts: rows.results || [] } };
  }

  if (actionId === "inspect_cooldown_sources") {
    const rows = await env.DB.prepare(
      "SELECT id, url, status, failure_count, success_count, cooldown_until_iso, next_run_at_iso, retired_reason, updated_at_iso FROM sources WHERE status = 'cooldown' ORDER BY updated_at_iso DESC LIMIT 20"
    ).all<any>();
    return { route: "/admin/sources?status=cooldown&limit=20", result: { ok: true, mode: "read_only", sources: rows.results || [] } };
  }

  if (actionId === "run_tiny_source_batch") {
    const limit = Math.max(1, Math.min(1, Number(body?.limit || 1)));
    const rows = await env.DB.prepare(
      "SELECT * FROM sources WHERE status = 'active' AND (next_run_at_iso IS NULL OR next_run_at_iso <= ?) ORDER BY COALESCE(next_run_at_iso, created_at_iso), updated_at_iso LIMIT ?"
    ).bind(nowISO(), limit).all<any>();
    const sources = rows.results || [];
    return {
      route: "/admin/sources/run-tiny",
      result: {
        ok: true,
        mode: "planner_execute_preview_only",
        note: "Planner execute envelope selected active due sources only. Use /admin/sources/run-tiny for real fetch execution.",
        selectedSources: sources.map((source: any) => ({ id: source.id, url: source.url, status: source.status, nextRunAt: source.next_run_at_iso })),
      },
    };
  }

  if (actionId === "source_expand_preview") {
    const sourceId = body?.sourceId || body?.id;
    if (!sourceId) return { route: "/admin/sources/:id/expand-preview", result: { ok: false, error: "source_id_required" } };
    const source = await env.DB.prepare("SELECT id, url, status, category, country, region, updated_at_iso FROM sources WHERE id = ? LIMIT 1").bind(String(sourceId)).first<any>();
    return { route: `/admin/sources/${sourceId}/expand-preview`, result: { ok: Boolean(source), mode: "planner_execute_preview_only", source: source || null } };
  }

  return { route: null, result: { ok: false, error: "action_not_allowed", allowed: ["review_draft_backlog", "inspect_cooldown_sources", "run_tiny_source_batch", "source_expand_preview"] } };
}

export async function handlePlannerAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  if (pathname === "/admin/planner" && request.method === "GET") {
    return json(await buildPlannerReport(env));
  }

  if (pathname === "/admin/planner/dashboard" && request.method === "GET") {
    return json(await plannerDashboard(env));
  }

  if (pathname === "/admin/planner/history" && request.method === "GET") {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || 20);
    return json(await plannerHistory(env, limit));
  }

  if (pathname === "/admin/planner/executions" && request.method === "GET") {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || 20);
    return json(await plannerExecutions(env, limit));
  }

  if (pathname === "/admin/planner/execute" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!confirmed(body)) return json({ ok: false, error: "confirm_required" }, { status: 400 });
    const actionId = String(body?.actionId || "");
    const executed = await executePlannerAction(env, actionId, body);
    const auditId = await recordExecution(env, actionId || "unknown", executed.route || "", executed.result, body);
    return json({ ok: true, auditId, actionId, route: executed.route, result: executed.result });
  }

  if (pathname === "/admin/planner/record" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!confirmed(body)) return json({ ok: false, error: "confirm_required" }, { status: 400 });

    const report = await buildPlannerReport(env);
    const id = uuid();
    const recommended = String(report.decision?.recommendedNextAction || "unknown");
    const primaryRoute = String(report.decision?.primaryActionCard?.route || "");
    const reason = `Planner recommended ${recommended}${primaryRoute ? ` via ${primaryRoute}` : ""}.`;

    await env.DB.prepare(
      `INSERT INTO agent_decisions (id, run_id, decision_type, target_type, target_id, target_url, reason, confidence, evidence_json, created_at_iso)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      null,
      "planner_recommendation",
      "planner_action",
      recommended,
      primaryRoute || null,
      reason,
      75,
      JSON.stringify({ report, recordedBy: body?.recordedBy || "admin", notes: body?.notes || null }),
      nowISO()
    ).run();

    return json({ ok: true, id, decisionType: "planner_recommendation", recommendedNextAction: recommended, primaryRoute: primaryRoute || null });
  }

  return json({ ok: false, error: "Not found" }, { status: 404 });
}
