import { Env, nowISO, uuid } from "../db";

function jsonText(value: unknown): string {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return JSON.stringify({ error: "json_serialize_failed" });
  }
}

function parseJsonText(value: unknown, fallback: unknown) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function hydrateCycleEvent(row: any) {
  if (!row) return row;
  return {
    ...row,
    rationale: parseJsonText(row.rationale_json, []),
    blocked: parseJsonText(row.blocked_json, []),
    readiness: parseJsonText(row.readiness_json, {}),
    loopPlan: parseJsonText(row.loop_plan_json, {}),
    counts: parseJsonText(row.counts_json, {}),
    strategy: parseJsonText(row.strategy_json, {}),
    blackboard: parseJsonText(row.blackboard_json, {}),
    safety: parseJsonText(row.safety_json, {}),
  };
}

export async function saveGrowthOperatorCycleEvent(env: Env, cycle: any, id = uuid()) {
  const now = nowISO();
  const loopPlan = cycle?.loopPlan || {};

  await env.DB.prepare(
    `INSERT INTO growth_operator_cycle_events (
       id, cycle_mode, selected_step, target_campaign_id, target_campaign_name,
       priority, rationale_json, blocked_json, recommended_command, readiness_json,
       loop_plan_json, counts_json, strategy_json, blackboard_json, safety_json, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    "read_only_snapshot",
    loopPlan.selectedStep || null,
    loopPlan.targetCampaignId || null,
    loopPlan.targetCampaignName || null,
    Number(loopPlan.priority || 0),
    jsonText(loopPlan.rationale || []),
    jsonText(cycle?.blocked || loopPlan.blockedBy || []),
    loopPlan.recommendedCommand || null,
    jsonText(cycle?.readiness || {}),
    jsonText(loopPlan),
    jsonText(cycle?.counts || {}),
    jsonText(cycle?.strategy || {}),
    jsonText(cycle?.blackboard || {}),
    jsonText(cycle?.safety || {}),
    now
  ).run();

  const row = await env.DB.prepare(`SELECT * FROM growth_operator_cycle_events WHERE id = ? LIMIT 1`).bind(id).first();
  if (!row) throw new Error("growth_operator_cycle_event_save_failed");
  return hydrateCycleEvent(row);
}

export async function listGrowthOperatorCycleEvents(env: Env, limit = 25, selectedStep?: string) {
  if (selectedStep) {
    const rows = await env.DB.prepare(`SELECT * FROM growth_operator_cycle_events WHERE selected_step = ? ORDER BY created_at DESC LIMIT ?`).bind(selectedStep, limit).all();
    return (rows.results || []).map(hydrateCycleEvent);
  }
  const rows = await env.DB.prepare(`SELECT * FROM growth_operator_cycle_events ORDER BY created_at DESC LIMIT ?`).bind(limit).all();
  return (rows.results || []).map(hydrateCycleEvent);
}
