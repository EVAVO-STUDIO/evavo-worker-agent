import { Env, nowISO, uuid } from "../db";

function clampPriority(value: unknown, fallback = 50): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function text(value: unknown, max = 2000): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, max);
  return normalized || null;
}

function jsonText(value: unknown, fallback: unknown = []): string {
  if (typeof value === "string") {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return JSON.stringify([value.slice(0, 1000)]);
    }
  }
  try {
    return JSON.stringify(value ?? fallback);
  } catch {
    return JSON.stringify(fallback);
  }
}

function activeStatus(value: unknown): string {
  return text(value, 64) || "active";
}

export async function upsertGrowthObjective(env: Env, input: any, id = input?.id || uuid()) {
  const now = nowISO();
  const name = text(input?.name, 240);
  if (!name) throw new Error("growth_objective_name_required");
  await env.DB.prepare(
    `INSERT INTO growth_objectives (id, name, description, status, priority, success_metric, target_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, status=excluded.status, priority=excluded.priority, success_metric=excluded.success_metric, target_date=excluded.target_date, updated_at=excluded.updated_at`
  ).bind(id, name, text(input?.description), activeStatus(input?.status), clampPriority(input?.priority), text(input?.successMetric || input?.success_metric, 500), text(input?.targetDate || input?.target_date, 80), now, now).run();
  return env.DB.prepare(`SELECT * FROM growth_objectives WHERE id = ? LIMIT 1`).bind(id).first();
}

export async function upsertGrowthKeyResult(env: Env, input: any, id = input?.id || uuid()) {
  const now = nowISO();
  const name = text(input?.name, 240);
  if (!name) throw new Error("growth_key_result_name_required");
  await env.DB.prepare(
    `INSERT INTO growth_key_results (id, objective_id, name, metric_name, target_value, current_value, unit, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET objective_id=excluded.objective_id, name=excluded.name, metric_name=excluded.metric_name, target_value=excluded.target_value, current_value=excluded.current_value, unit=excluded.unit, status=excluded.status, updated_at=excluded.updated_at`
  ).bind(id, text(input?.objectiveId || input?.objective_id, 120), name, text(input?.metricName || input?.metric_name, 160), Number(input?.targetValue ?? input?.target_value ?? 0), Number(input?.currentValue ?? input?.current_value ?? 0), text(input?.unit, 80), activeStatus(input?.status), now, now).run();
  return env.DB.prepare(`SELECT * FROM growth_key_results WHERE id = ? LIMIT 1`).bind(id).first();
}

export async function upsertGrowthTargetSegment(env: Env, input: any, id = input?.id || uuid()) {
  const now = nowISO();
  const name = text(input?.name, 240);
  if (!name) throw new Error("growth_target_segment_name_required");
  await env.DB.prepare(
    `INSERT INTO growth_target_segments (id, name, description, geography, industry, company_size, buyer_roles, pain_points_json, priority, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, geography=excluded.geography, industry=excluded.industry, company_size=excluded.company_size, buyer_roles=excluded.buyer_roles, pain_points_json=excluded.pain_points_json, priority=excluded.priority, status=excluded.status, updated_at=excluded.updated_at`
  ).bind(id, name, text(input?.description), text(input?.geography, 240), text(input?.industry, 240), text(input?.companySize || input?.company_size, 120), text(input?.buyerRoles || input?.buyer_roles, 500), jsonText(input?.painPoints || input?.pain_points_json || []), clampPriority(input?.priority), activeStatus(input?.status), now, now).run();
  return env.DB.prepare(`SELECT * FROM growth_target_segments WHERE id = ? LIMIT 1`).bind(id).first();
}

export async function upsertGrowthOfferProfile(env: Env, input: any, id = input?.id || uuid()) {
  const now = nowISO();
  const name = text(input?.name, 240);
  if (!name) throw new Error("growth_offer_profile_name_required");
  await env.DB.prepare(
    `INSERT INTO growth_offer_profiles (id, name, description, offer_type, proof_points_json, best_for_segments_json, risk_notes, priority, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, offer_type=excluded.offer_type, proof_points_json=excluded.proof_points_json, best_for_segments_json=excluded.best_for_segments_json, risk_notes=excluded.risk_notes, priority=excluded.priority, status=excluded.status, updated_at=excluded.updated_at`
  ).bind(id, name, text(input?.description), text(input?.offerType || input?.offer_type, 120), jsonText(input?.proofPoints || input?.proof_points_json || []), jsonText(input?.bestForSegments || input?.best_for_segments_json || []), text(input?.riskNotes || input?.risk_notes), clampPriority(input?.priority), activeStatus(input?.status), now, now).run();
  return env.DB.prepare(`SELECT * FROM growth_offer_profiles WHERE id = ? LIMIT 1`).bind(id).first();
}

export async function upsertGrowthPositioningProfile(env: Env, input: any, id = input?.id || uuid()) {
  const now = nowISO();
  const name = text(input?.name, 240);
  if (!name) throw new Error("growth_positioning_profile_name_required");
  await env.DB.prepare(
    `INSERT INTO growth_positioning_profiles (id, name, voice_notes, value_prop, avoid_phrases_json, preferred_angles_json, proof_assets_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, voice_notes=excluded.voice_notes, value_prop=excluded.value_prop, avoid_phrases_json=excluded.avoid_phrases_json, preferred_angles_json=excluded.preferred_angles_json, proof_assets_json=excluded.proof_assets_json, status=excluded.status, updated_at=excluded.updated_at`
  ).bind(id, name, text(input?.voiceNotes || input?.voice_notes), text(input?.valueProp || input?.value_prop), jsonText(input?.avoidPhrases || input?.avoid_phrases_json || []), jsonText(input?.preferredAngles || input?.preferred_angles_json || []), jsonText(input?.proofAssets || input?.proof_assets_json || []), activeStatus(input?.status), now, now).run();
  return env.DB.prepare(`SELECT * FROM growth_positioning_profiles WHERE id = ? LIMIT 1`).bind(id).first();
}

export async function upsertGrowthRuntimeConstraint(env: Env, input: any, id = input?.id || uuid()) {
  const now = nowISO();
  const name = text(input?.name, 240);
  if (!name) throw new Error("growth_runtime_constraint_name_required");
  await env.DB.prepare(
    `INSERT INTO growth_runtime_constraints (id, name, constraint_type, description, severity, rule_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, constraint_type=excluded.constraint_type, description=excluded.description, severity=excluded.severity, rule_json=excluded.rule_json, status=excluded.status, updated_at=excluded.updated_at`
  ).bind(id, name, text(input?.constraintType || input?.constraint_type, 120) || "policy", text(input?.description), text(input?.severity, 64) || "hard", jsonText(input?.rule || input?.rule_json || {}), activeStatus(input?.status), now, now).run();
  return env.DB.prepare(`SELECT * FROM growth_runtime_constraints WHERE id = ? LIMIT 1`).bind(id).first();
}

export async function listGrowthObjectives(env: Env, limit = 25, status?: string) {
  if (status) return (await env.DB.prepare(`SELECT * FROM growth_objectives WHERE status = ? ORDER BY priority DESC, updated_at DESC LIMIT ?`).bind(status, limit).all()).results || [];
  return (await env.DB.prepare(`SELECT * FROM growth_objectives ORDER BY priority DESC, updated_at DESC LIMIT ?`).bind(limit).all()).results || [];
}

export async function listGrowthKeyResults(env: Env, limit = 50, objectiveId?: string) {
  if (objectiveId) return (await env.DB.prepare(`SELECT * FROM growth_key_results WHERE objective_id = ? ORDER BY updated_at DESC LIMIT ?`).bind(objectiveId, limit).all()).results || [];
  return (await env.DB.prepare(`SELECT * FROM growth_key_results ORDER BY updated_at DESC LIMIT ?`).bind(limit).all()).results || [];
}

export async function listGrowthTargetSegments(env: Env, limit = 25, status?: string) {
  if (status) return (await env.DB.prepare(`SELECT * FROM growth_target_segments WHERE status = ? ORDER BY priority DESC, updated_at DESC LIMIT ?`).bind(status, limit).all()).results || [];
  return (await env.DB.prepare(`SELECT * FROM growth_target_segments ORDER BY priority DESC, updated_at DESC LIMIT ?`).bind(limit).all()).results || [];
}

export async function listGrowthOfferProfiles(env: Env, limit = 25, status?: string) {
  if (status) return (await env.DB.prepare(`SELECT * FROM growth_offer_profiles WHERE status = ? ORDER BY priority DESC, updated_at DESC LIMIT ?`).bind(status, limit).all()).results || [];
  return (await env.DB.prepare(`SELECT * FROM growth_offer_profiles ORDER BY priority DESC, updated_at DESC LIMIT ?`).bind(limit).all()).results || [];
}

export async function listGrowthPositioningProfiles(env: Env, limit = 25, status?: string) {
  if (status) return (await env.DB.prepare(`SELECT * FROM growth_positioning_profiles WHERE status = ? ORDER BY updated_at DESC LIMIT ?`).bind(status, limit).all()).results || [];
  return (await env.DB.prepare(`SELECT * FROM growth_positioning_profiles ORDER BY updated_at DESC LIMIT ?`).bind(limit).all()).results || [];
}

export async function listGrowthRuntimeConstraints(env: Env, limit = 50, status?: string) {
  if (status) return (await env.DB.prepare(`SELECT * FROM growth_runtime_constraints WHERE status = ? ORDER BY severity ASC, updated_at DESC LIMIT ?`).bind(status, limit).all()).results || [];
  return (await env.DB.prepare(`SELECT * FROM growth_runtime_constraints ORDER BY severity ASC, updated_at DESC LIMIT ?`).bind(limit).all()).results || [];
}

export async function loadGrowthStrategyMemory(env: Env) {
  const [objectives, keyResults, targetSegments, offerProfiles, positioningProfiles, runtimeConstraints] = await Promise.all([
    listGrowthObjectives(env, 25, "active"),
    listGrowthKeyResults(env, 50),
    listGrowthTargetSegments(env, 25, "active"),
    listGrowthOfferProfiles(env, 25, "active"),
    listGrowthPositioningProfiles(env, 25, "active"),
    listGrowthRuntimeConstraints(env, 50, "active"),
  ]);
  return {
    objectives,
    keyResults,
    targetSegments,
    offerProfiles,
    positioningProfiles,
    runtimeConstraints,
    counts: {
      objectives: objectives.length,
      keyResults: keyResults.length,
      targetSegments: targetSegments.length,
      offerProfiles: offerProfiles.length,
      positioningProfiles: positioningProfiles.length,
      runtimeConstraints: runtimeConstraints.length,
    },
  };
}
