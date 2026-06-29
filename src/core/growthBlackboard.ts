import { Env, nowISO, uuid } from "../db";

function text(value: unknown, max = 2000): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, max);
  return normalized || null;
}

function requiredText(value: unknown, error: string, max = 2000): string {
  const normalized = text(value, max);
  if (!normalized) throw new Error(error);
  return normalized;
}

function clampScore(value: unknown, fallback = 50): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
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

function status(value: unknown): string {
  return text(value, 64) || "active";
}

export async function upsertGrowthBlackboardFact(env: Env, input: any, id = input?.id || uuid()) {
  const now = nowISO();
  await env.DB.prepare(
    `INSERT INTO growth_blackboard_facts (
       id, fact_type, subject_type, subject_id, subject_name, predicate, object_type, object_id, object_name,
       summary, evidence_refs_json, confidence_score, source, status, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET fact_type=excluded.fact_type, subject_type=excluded.subject_type, subject_id=excluded.subject_id,
       subject_name=excluded.subject_name, predicate=excluded.predicate, object_type=excluded.object_type, object_id=excluded.object_id,
       object_name=excluded.object_name, summary=excluded.summary, evidence_refs_json=excluded.evidence_refs_json,
       confidence_score=excluded.confidence_score, source=excluded.source, status=excluded.status, updated_at=excluded.updated_at`
  ).bind(
    id,
    text(input?.factType || input?.fact_type, 120) || "note",
    text(input?.subjectType || input?.subject_type, 120),
    text(input?.subjectId || input?.subject_id, 160),
    text(input?.subjectName || input?.subject_name, 240),
    text(input?.predicate, 160),
    text(input?.objectType || input?.object_type, 120),
    text(input?.objectId || input?.object_id, 160),
    text(input?.objectName || input?.object_name, 240),
    requiredText(input?.summary, "growth_blackboard_fact_summary_required", 2000),
    jsonText(input?.evidenceRefs || input?.evidence_refs_json || []),
    clampScore(input?.confidenceScore || input?.confidence_score, 50),
    text(input?.source, 500),
    status(input?.status),
    now,
    now
  ).run();
  return env.DB.prepare(`SELECT * FROM growth_blackboard_facts WHERE id = ? LIMIT 1`).bind(id).first();
}

export async function upsertGrowthEntity(env: Env, input: any, id = input?.id || uuid()) {
  const now = nowISO();
  await env.DB.prepare(
    `INSERT INTO growth_entities (id, entity_type, name, canonical_url, description, attributes_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET entity_type=excluded.entity_type, name=excluded.name, canonical_url=excluded.canonical_url,
       description=excluded.description, attributes_json=excluded.attributes_json, status=excluded.status, updated_at=excluded.updated_at`
  ).bind(
    id,
    requiredText(input?.entityType || input?.entity_type, "growth_entity_type_required", 120),
    requiredText(input?.name, "growth_entity_name_required", 240),
    text(input?.canonicalUrl || input?.canonical_url, 500),
    text(input?.description, 2000),
    jsonText(input?.attributes || input?.attributes_json || {}, {}),
    status(input?.status),
    now,
    now
  ).run();
  return env.DB.prepare(`SELECT * FROM growth_entities WHERE id = ? LIMIT 1`).bind(id).first();
}

export async function upsertGrowthEntityRelationship(env: Env, input: any, id = input?.id || uuid()) {
  const now = nowISO();
  await env.DB.prepare(
    `INSERT INTO growth_entity_relationships (id, from_entity_id, to_entity_id, relationship_type, summary, confidence_score, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET from_entity_id=excluded.from_entity_id, to_entity_id=excluded.to_entity_id,
       relationship_type=excluded.relationship_type, summary=excluded.summary, confidence_score=excluded.confidence_score,
       status=excluded.status, updated_at=excluded.updated_at`
  ).bind(
    id,
    requiredText(input?.fromEntityId || input?.from_entity_id, "growth_relationship_from_entity_required", 160),
    requiredText(input?.toEntityId || input?.to_entity_id, "growth_relationship_to_entity_required", 160),
    requiredText(input?.relationshipType || input?.relationship_type, "growth_relationship_type_required", 120),
    text(input?.summary, 2000),
    clampScore(input?.confidenceScore || input?.confidence_score, 50),
    status(input?.status),
    now,
    now
  ).run();
  return env.DB.prepare(`SELECT * FROM growth_entity_relationships WHERE id = ? LIMIT 1`).bind(id).first();
}

export async function upsertGrowthMarketSignal(env: Env, input: any, id = input?.id || uuid()) {
  const now = nowISO();
  await env.DB.prepare(
    `INSERT INTO growth_market_signals (id, signal_type, segment_id, segment_name, offer_id, offer_name, summary, source_url, evidence_refs_json, strength_score, freshness_score, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET signal_type=excluded.signal_type, segment_id=excluded.segment_id, segment_name=excluded.segment_name,
       offer_id=excluded.offer_id, offer_name=excluded.offer_name, summary=excluded.summary, source_url=excluded.source_url,
       evidence_refs_json=excluded.evidence_refs_json, strength_score=excluded.strength_score, freshness_score=excluded.freshness_score,
       status=excluded.status, updated_at=excluded.updated_at`
  ).bind(
    id,
    text(input?.signalType || input?.signal_type, 120) || "market_note",
    text(input?.segmentId || input?.segment_id, 160),
    text(input?.segmentName || input?.segment_name, 240),
    text(input?.offerId || input?.offer_id, 160),
    text(input?.offerName || input?.offer_name, 240),
    requiredText(input?.summary, "growth_market_signal_summary_required", 2000),
    text(input?.sourceUrl || input?.source_url, 500),
    jsonText(input?.evidenceRefs || input?.evidence_refs_json || []),
    clampScore(input?.strengthScore || input?.strength_score, 50),
    clampScore(input?.freshnessScore || input?.freshness_score, 50),
    status(input?.status),
    now,
    now
  ).run();
  return env.DB.prepare(`SELECT * FROM growth_market_signals WHERE id = ? LIMIT 1`).bind(id).first();
}

export async function upsertGrowthAsset(env: Env, input: any, id = input?.id || uuid()) {
  const now = nowISO();
  await env.DB.prepare(
    `INSERT INTO growth_asset_inventory (id, asset_type, name, url, summary, best_for_segments_json, best_for_offers_json, proof_points_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET asset_type=excluded.asset_type, name=excluded.name, url=excluded.url, summary=excluded.summary,
       best_for_segments_json=excluded.best_for_segments_json, best_for_offers_json=excluded.best_for_offers_json,
       proof_points_json=excluded.proof_points_json, status=excluded.status, updated_at=excluded.updated_at`
  ).bind(
    id,
    text(input?.assetType || input?.asset_type, 120) || "proof_asset",
    requiredText(input?.name, "growth_asset_name_required", 240),
    text(input?.url, 500),
    text(input?.summary, 2000),
    jsonText(input?.bestForSegments || input?.best_for_segments_json || []),
    jsonText(input?.bestForOffers || input?.best_for_offers_json || []),
    jsonText(input?.proofPoints || input?.proof_points_json || []),
    status(input?.status),
    now,
    now
  ).run();
  return env.DB.prepare(`SELECT * FROM growth_asset_inventory WHERE id = ? LIMIT 1`).bind(id).first();
}

export async function listGrowthBlackboardFacts(env: Env, limit = 50, subjectId?: string) {
  if (subjectId) return (await env.DB.prepare(`SELECT * FROM growth_blackboard_facts WHERE subject_id = ? ORDER BY updated_at DESC LIMIT ?`).bind(subjectId, limit).all()).results || [];
  return (await env.DB.prepare(`SELECT * FROM growth_blackboard_facts ORDER BY updated_at DESC LIMIT ?`).bind(limit).all()).results || [];
}

export async function listGrowthEntities(env: Env, limit = 50, entityType?: string) {
  if (entityType) return (await env.DB.prepare(`SELECT * FROM growth_entities WHERE entity_type = ? ORDER BY updated_at DESC LIMIT ?`).bind(entityType, limit).all()).results || [];
  return (await env.DB.prepare(`SELECT * FROM growth_entities ORDER BY updated_at DESC LIMIT ?`).bind(limit).all()).results || [];
}

export async function listGrowthEntityRelationships(env: Env, limit = 50, fromEntityId?: string) {
  if (fromEntityId) return (await env.DB.prepare(`SELECT * FROM growth_entity_relationships WHERE from_entity_id = ? ORDER BY updated_at DESC LIMIT ?`).bind(fromEntityId, limit).all()).results || [];
  return (await env.DB.prepare(`SELECT * FROM growth_entity_relationships ORDER BY updated_at DESC LIMIT ?`).bind(limit).all()).results || [];
}

export async function listGrowthMarketSignals(env: Env, limit = 50, segmentId?: string) {
  if (segmentId) return (await env.DB.prepare(`SELECT * FROM growth_market_signals WHERE segment_id = ? ORDER BY updated_at DESC LIMIT ?`).bind(segmentId, limit).all()).results || [];
  return (await env.DB.prepare(`SELECT * FROM growth_market_signals ORDER BY updated_at DESC LIMIT ?`).bind(limit).all()).results || [];
}

export async function listGrowthAssets(env: Env, limit = 50, assetType?: string) {
  if (assetType) return (await env.DB.prepare(`SELECT * FROM growth_asset_inventory WHERE asset_type = ? ORDER BY updated_at DESC LIMIT ?`).bind(assetType, limit).all()).results || [];
  return (await env.DB.prepare(`SELECT * FROM growth_asset_inventory ORDER BY updated_at DESC LIMIT ?`).bind(limit).all()).results || [];
}

export async function loadGrowthBlackboard(env: Env) {
  const [facts, entities, relationships, marketSignals, assets] = await Promise.all([
    listGrowthBlackboardFacts(env, 50),
    listGrowthEntities(env, 50),
    listGrowthEntityRelationships(env, 50),
    listGrowthMarketSignals(env, 50),
    listGrowthAssets(env, 50),
  ]);
  return {
    facts,
    entities,
    relationships,
    marketSignals,
    assets,
    counts: {
      facts: facts.length,
      entities: entities.length,
      relationships: relationships.length,
      marketSignals: marketSignals.length,
      assets: assets.length,
    },
  };
}
