import type { Env } from "../db";
import { getAdminToken } from "../db";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

type OriginMetric = {
  origin: string;
  count: number;
  active: number;
  paused: number;
  failed: number;
  averagePriority: number;
};

type StrategyScore = {
  strategy: string;
  quality_score: number;
  recommendation: string;
  saved_count: number;
  duplicate_count: number;
  failure_count: number;
  opportunity_count: number;
};

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

async function tableExists(env: Env, tableName: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1").bind(tableName).first<any>();
  return Boolean(row?.name);
}

function noteValue(notes: string | null | undefined, key: string): string | null {
  if (!notes) return null;
  const match = notes.match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`));
  return match ? match[1].trim() : null;
}

function classifyOrigin(notes: string | null | undefined) {
  const origin = noteValue(notes, "origin");
  if (origin === "query_hint") return "query_hint";
  if (origin === "public_link_graph") return "public_link_graph";
  if (origin === "sitemap") return "sitemap";
  if (origin === "source_expansion") return "source_expansion";
  if (origin === "source_candidate_preview") return "source_candidate_preview";
  if (String(notes || "").startsWith("Saved from public link graph")) return "public_link_graph";
  if (String(notes || "").startsWith("Saved from source candidate preview")) return "source_candidate_preview";
  if (String(notes || "").startsWith("Saved from")) return "other_saved_candidate";
  return "manual_or_unknown";
}

function recommendationForOrigin(metric: OriginMetric, total: number) {
  const share = total ? metric.count / total : 0;
  const failRate = metric.count ? metric.failed / metric.count : 0;
  let score = Math.round(45 + share * 55 + metric.active * 3 + Math.max(0, metric.averagePriority - 50) * 0.25 - failRate * 30);
  score = Math.max(0, Math.min(100, score));
  if (metric.count === 0) return { action: "seed_more", score: 38, reason: "No saved live sources yet for this origin; test with low budget." };
  if (score >= 78) return { action: "increase_budget", score, reason: "High saved-source share and healthy active count." };
  if (score >= 58) return { action: "maintain_budget", score, reason: "Useful origin path with moderate evidence." };
  if (failRate >= 0.35) return { action: "cool_down", score, reason: "Failure rate is high relative to saved sources." };
  return { action: "tighten_filters", score, reason: "Some evidence exists, but quality is not strong enough to expand aggressively." };
}

async function originMetrics(env: Env): Promise<OriginMetric[]> {
  if (!(await tableExists(env, "opportunity_sources"))) return [];
  const rows = await env.DB.prepare("SELECT status, priority, notes FROM opportunity_sources LIMIT 10000").all<any>();
  const map = new Map<string, any>();
  for (const origin of ["query_hint", "public_link_graph", "sitemap", "source_expansion", "source_candidate_preview", "other_saved_candidate", "manual_or_unknown"]) {
    map.set(origin, { origin, count: 0, active: 0, paused: 0, failed: 0, priorityTotal: 0 });
  }
  for (const row of rows.results || []) {
    const origin = classifyOrigin(row.notes);
    const bucket = map.get(origin) || { origin, count: 0, active: 0, paused: 0, failed: 0, priorityTotal: 0 };
    bucket.count += 1;
    if (row.status === "active") bucket.active += 1;
    if (row.status === "paused") bucket.paused += 1;
    if (row.status === "failed") bucket.failed += 1;
    bucket.priorityTotal += Number(row.priority || 0);
    map.set(origin, bucket);
  }
  return Array.from(map.values()).map((bucket) => ({ ...bucket, averagePriority: bucket.count ? Math.round(bucket.priorityTotal / bucket.count) : 0 }));
}

async function strategyScores(env: Env): Promise<StrategyScore[]> {
  if (!(await tableExists(env, "source_expansion_strategy_scores"))) return [];
  const rows = await env.DB.prepare(
    `SELECT strategy, quality_score, recommendation, saved_count, duplicate_count, failure_count, opportunity_count
     FROM source_expansion_strategy_scores
     ORDER BY quality_score DESC
     LIMIT 100`
  ).all<any>();
  return (rows.results || []).map((row) => ({
    strategy: String(row.strategy || "unknown"),
    quality_score: Number(row.quality_score || 0),
    recommendation: String(row.recommendation || "monitor_strategy"),
    saved_count: Number(row.saved_count || 0),
    duplicate_count: Number(row.duplicate_count || 0),
    failure_count: Number(row.failure_count || 0),
    opportunity_count: Number(row.opportunity_count || 0),
  }));
}

export async function handleSourceExpansionBudgetRecommendationsAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (pathname !== "/admin/opportunities/sources/expansion/budget-recommendations") return json({ ok: false, error: "Not found" }, { status: 404 });
  if (request.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const origins = await originMetrics(env);
  const strategies = await strategyScores(env);
  const totalSources = origins.reduce((sum, row) => sum + row.count, 0);
  const originRecommendations = origins.map((metric) => ({ ...metric, ...recommendationForOrigin(metric, totalSources) }));
  const strategyRecommendations = strategies.map((strategy) => ({
    ...strategy,
    action: strategy.recommendation,
    reason: strategy.quality_score >= 78 ? "Strong strategy quality." : strategy.quality_score >= 58 ? "Moderate strategy quality." : strategy.failure_count > 0 ? "Needs quality tightening or cooldown." : "Insufficient yield evidence.",
  }));

  const nextRun = {
    queryHintResolvePriority: originRecommendations.find((row) => row.origin === "query_hint")?.action || "seed_more",
    publicLinkScanPriority: originRecommendations.find((row) => row.origin === "public_link_graph")?.action || "seed_more",
    sitemapScanPriority: originRecommendations.find((row) => row.origin === "sitemap")?.action || "seed_more",
    boundedExpansionPriority: originRecommendations.find((row) => row.origin === "source_expansion")?.action || "seed_more",
    candidatePreviewPriority: originRecommendations.find((row) => row.origin === "source_candidate_preview")?.action || "monitor",
  };

  return json({
    ok: true,
    mode: "source_expansion_budget_recommendations",
    totalSources,
    originRecommendations,
    strategyRecommendations,
    nextRun,
    safety: { readOnly: true, writesTables: [], callsAI: false, sendsEmail: false, callsNetwork: false },
  });
}
