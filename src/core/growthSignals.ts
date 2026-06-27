import { Env, nowISO, uuid } from "../db";
import { parseGrowthJsonArray } from "./growthAutonomy";
import { GrowthSignalRow } from "./growthEngagementReadModels";

export interface GrowthSignalInput {
  goalId?: string | null;
  channelId?: string | null;
  sourceUrl: string;
  sourceTitle?: string | null;
  signalType: string;
  serviceMatch?: string[];
  audienceMatch?: string[];
  evidence: string;
  urgency?: number;
  fitScore?: number;
  riskScore?: number;
  costScore?: number;
  status?: string;
  duplicateKey?: string | null;
  discoveredAt?: string | null;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function toJson(value: unknown): string {
  return JSON.stringify(value ?? []);
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) throw new Error("growth_signal_source_url_must_be_public_http_url");
  return trimmed;
}

function safeShortSlug(value: string): string {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96);
}

export function buildGrowthSignalDuplicateKey(input: GrowthSignalInput): string {
  const source = normalizeUrl(input.sourceUrl).toLowerCase().replace(/#.*$/, "").replace(/\/$/, "");
  const type = safeShortSlug(input.signalType || "signal");
  const evidence = safeShortSlug((input.evidence || "").slice(0, 180));
  return `${source}::${type}::${evidence}`.slice(0, 512);
}

export function normalizeGrowthSignalRow(row: GrowthSignalRow): GrowthSignalRow & {
  serviceMatch: unknown[];
  audienceMatch: unknown[];
} {
  return {
    ...row,
    serviceMatch: parseGrowthJsonArray(row.service_match),
    audienceMatch: parseGrowthJsonArray(row.audience_match),
  };
}

export async function upsertGrowthSignal(env: Env, input: GrowthSignalInput, id = uuid()): Promise<GrowthSignalRow> {
  const now = nowISO();
  const sourceUrl = normalizeUrl(input.sourceUrl);
  const evidence = normalizeText(input.evidence || "");
  const signalType = normalizeText(input.signalType || "");

  if (!signalType) throw new Error("growth_signal_type_required");
  if (!evidence || evidence.length < 12) throw new Error("growth_signal_evidence_too_short");

  const duplicateKey = input.duplicateKey === null ? null : input.duplicateKey || buildGrowthSignalDuplicateKey({ ...input, sourceUrl, evidence, signalType });
  const discoveredAt = input.discoveredAt || now;

  await env.DB.prepare(
    `INSERT INTO growth_signals (
       id, goal_id, channel_id, source_url, source_title, signal_type,
       service_match, audience_match, evidence, urgency, fit_score, risk_score,
       cost_score, status, duplicate_key, discovered_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       goal_id = excluded.goal_id,
       channel_id = excluded.channel_id,
       source_url = excluded.source_url,
       source_title = excluded.source_title,
       signal_type = excluded.signal_type,
       service_match = excluded.service_match,
       audience_match = excluded.audience_match,
       evidence = excluded.evidence,
       urgency = excluded.urgency,
       fit_score = excluded.fit_score,
       risk_score = excluded.risk_score,
       cost_score = excluded.cost_score,
       status = excluded.status,
       duplicate_key = excluded.duplicate_key,
       discovered_at = excluded.discovered_at,
       updated_at = excluded.updated_at`
  ).bind(
    id,
    input.goalId ?? null,
    input.channelId ?? null,
    sourceUrl,
    input.sourceTitle ?? null,
    signalType,
    toJson(input.serviceMatch || []),
    toJson(input.audienceMatch || []),
    evidence,
    clampInt(input.urgency, 50, 0, 100),
    clampInt(input.fitScore, 0, 0, 100),
    clampInt(input.riskScore, 50, 0, 100),
    clampInt(input.costScore, 100, 0, 100),
    input.status || "new",
    duplicateKey,
    discoveredAt,
    now,
    now
  ).run();

  const row = await env.DB.prepare(
    `SELECT id, goal_id, channel_id, source_url, source_title, signal_type,
            service_match, audience_match, evidence, urgency, fit_score, risk_score,
            cost_score, status, duplicate_key, discovered_at, created_at, updated_at
     FROM growth_signals WHERE id = ? LIMIT 1`
  ).bind(id).first<GrowthSignalRow>();

  if (!row) throw new Error("growth_signal_upsert_failed");
  return row;
}
