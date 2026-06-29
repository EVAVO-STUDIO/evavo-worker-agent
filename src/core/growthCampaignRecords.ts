import { Env, nowISO, uuid } from "../db";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : 0)));
}

function intValue(value: unknown, fallback = 0, min = 0, max = 100000): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function normalizeText(value: unknown, max = 1200): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, max);
  return normalized || null;
}

function normalizeJson(value: unknown): string {
  if (typeof value === "string") {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return JSON.stringify({ raw: value.slice(0, 2000) });
    }
  }
  return JSON.stringify(value && typeof value === "object" ? value : {});
}

export interface GrowthCampaignMetricInput {
  campaignId: string;
  experimentId?: string | null;
  metricDate?: string;
  preparedCount?: number;
  reviewedCount?: number;
  positiveCount?: number;
  negativeCount?: number;
  meetingCount?: number;
  contentCount?: number;
  engagementCount?: number;
  costUnits?: number;
  healthState?: string;
  notes?: string | null;
}

export interface GrowthEvidenceInput {
  campaignId?: string | null;
  experimentId?: string | null;
  targetRef?: string | null;
  evidenceType: string;
  sourceUrl?: string | null;
  summary: string;
  snapshot?: unknown;
}

export interface GrowthLearningInput {
  campaignId?: string | null;
  experimentId?: string | null;
  noteType: string;
  summary: string;
  recommendation?: string | null;
  confidenceScore?: number;
}

export async function upsertGrowthCampaignMetric(env: Env, input: GrowthCampaignMetricInput, id = uuid()) {
  if (!input.campaignId) throw new Error("growth_metric_campaign_required");
  const now = nowISO();
  const metricDate = input.metricDate || now.slice(0, 10);

  await env.DB.prepare(
    `INSERT INTO growth_campaign_metrics (
       id, campaign_id, experiment_id, metric_date, prepared_count, reviewed_count,
       positive_count, negative_count, meeting_count, content_count, engagement_count,
       cost_units, health_state, notes, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       campaign_id = excluded.campaign_id,
       experiment_id = excluded.experiment_id,
       metric_date = excluded.metric_date,
       prepared_count = excluded.prepared_count,
       reviewed_count = excluded.reviewed_count,
       positive_count = excluded.positive_count,
       negative_count = excluded.negative_count,
       meeting_count = excluded.meeting_count,
       content_count = excluded.content_count,
       engagement_count = excluded.engagement_count,
       cost_units = excluded.cost_units,
       health_state = excluded.health_state,
       notes = excluded.notes,
       updated_at = excluded.updated_at`
  ).bind(
    id,
    input.campaignId,
    input.experimentId || null,
    metricDate,
    intValue(input.preparedCount),
    intValue(input.reviewedCount),
    intValue(input.positiveCount),
    intValue(input.negativeCount),
    intValue(input.meetingCount),
    intValue(input.contentCount),
    intValue(input.engagementCount),
    intValue(input.costUnits),
    normalizeText(input.healthState, 64) || "unknown",
    normalizeText(input.notes, 1600),
    now,
    now
  ).run();

  const row = await env.DB.prepare(`SELECT * FROM growth_campaign_metrics WHERE id = ? LIMIT 1`).bind(id).first();
  if (!row) throw new Error("growth_metric_save_failed");
  return row;
}

export async function listGrowthCampaignMetrics(env: Env, limit = 25, campaignId?: string) {
  if (campaignId) {
    const rows = await env.DB.prepare(`SELECT * FROM growth_campaign_metrics WHERE campaign_id = ? ORDER BY metric_date DESC, updated_at DESC LIMIT ?`).bind(campaignId, limit).all();
    return rows.results || [];
  }
  const rows = await env.DB.prepare(`SELECT * FROM growth_campaign_metrics ORDER BY metric_date DESC, updated_at DESC LIMIT ?`).bind(limit).all();
  return rows.results || [];
}

export async function createGrowthEvidenceItem(env: Env, input: GrowthEvidenceInput, id = uuid()) {
  const evidenceType = normalizeText(input.evidenceType, 96);
  const summary = normalizeText(input.summary, 2000);
  if (!evidenceType) throw new Error("growth_evidence_type_required");
  if (!summary) throw new Error("growth_evidence_summary_required");
  const now = nowISO();

  await env.DB.prepare(
    `INSERT INTO growth_evidence_items (
       id, campaign_id, experiment_id, target_ref, evidence_type, source_url, summary, snapshot_json, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    input.campaignId || null,
    input.experimentId || null,
    normalizeText(input.targetRef, 240),
    evidenceType,
    normalizeText(input.sourceUrl, 1000),
    summary,
    normalizeJson(input.snapshot),
    now
  ).run();

  const row = await env.DB.prepare(`SELECT * FROM growth_evidence_items WHERE id = ? LIMIT 1`).bind(id).first();
  if (!row) throw new Error("growth_evidence_save_failed");
  return row;
}

export async function listGrowthEvidenceItems(env: Env, limit = 25, campaignId?: string, targetRef?: string) {
  if (campaignId) {
    const rows = await env.DB.prepare(`SELECT * FROM growth_evidence_items WHERE campaign_id = ? ORDER BY created_at DESC LIMIT ?`).bind(campaignId, limit).all();
    return rows.results || [];
  }
  if (targetRef) {
    const rows = await env.DB.prepare(`SELECT * FROM growth_evidence_items WHERE target_ref = ? ORDER BY created_at DESC LIMIT ?`).bind(targetRef, limit).all();
    return rows.results || [];
  }
  const rows = await env.DB.prepare(`SELECT * FROM growth_evidence_items ORDER BY created_at DESC LIMIT ?`).bind(limit).all();
  return rows.results || [];
}

export async function createGrowthLearningNote(env: Env, input: GrowthLearningInput, id = uuid()) {
  const noteType = normalizeText(input.noteType, 96);
  const summary = normalizeText(input.summary, 2000);
  if (!noteType) throw new Error("growth_learning_type_required");
  if (!summary) throw new Error("growth_learning_summary_required");
  const now = nowISO();

  await env.DB.prepare(
    `INSERT INTO growth_learning_notes (
       id, campaign_id, experiment_id, note_type, summary, recommendation, confidence_score, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    input.campaignId || null,
    input.experimentId || null,
    noteType,
    summary,
    normalizeText(input.recommendation, 2000),
    clamp(input.confidenceScore ?? 0),
    now
  ).run();

  const row = await env.DB.prepare(`SELECT * FROM growth_learning_notes WHERE id = ? LIMIT 1`).bind(id).first();
  if (!row) throw new Error("growth_learning_save_failed");
  return row;
}

export async function listGrowthLearningNotes(env: Env, limit = 25, campaignId?: string) {
  if (campaignId) {
    const rows = await env.DB.prepare(`SELECT * FROM growth_learning_notes WHERE campaign_id = ? ORDER BY created_at DESC LIMIT ?`).bind(campaignId, limit).all();
    return rows.results || [];
  }
  const rows = await env.DB.prepare(`SELECT * FROM growth_learning_notes ORDER BY created_at DESC LIMIT ?`).bind(limit).all();
  return rows.results || [];
}
