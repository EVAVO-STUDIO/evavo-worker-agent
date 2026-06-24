import type { Env } from "../db";
import { logEvent, nowISO } from "../db";

type StrategyScoreRow = {
  strategy: string;
  candidate_count: number;
  saved_count: number;
  duplicate_count: number;
  failure_count: number;
  source_count: number;
  source_success_count: number;
  source_failure_count: number;
  opportunity_count: number;
  shortlisted_count: number;
  rejected_count: number;
  average_candidate_score: number;
  average_source_priority: number;
  quality_score: number;
  recommendation: string;
};

async function tableExists(env: Env, tableName: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1").bind(tableName).first<any>();
  return Boolean(row?.name);
}

async function requiredTables(env: Env) {
  return {
    candidates: await tableExists(env, "source_expansion_candidates"),
    strategies: await tableExists(env, "source_expansion_strategy_scores"),
    sources: await tableExists(env, "opportunity_sources"),
    opportunities: await tableExists(env, "opportunities"),
    sourceResults: await tableExists(env, "opportunity_run_source_results"),
  };
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function recommendationFor(score: number, savedCount: number, duplicateCount: number, failureCount: number, opportunityCount: number) {
  if (score >= 78 && opportunityCount > 0) return "prioritise_strategy";
  if (score >= 65 && savedCount > 0) return "continue_strategy";
  if (duplicateCount > savedCount + opportunityCount && duplicateCount >= 5) return "tighten_strategy_filters";
  if (failureCount >= 5 && savedCount === 0) return "cool_down_strategy";
  if (score < 35) return "deprioritise_strategy";
  return "monitor_strategy";
}

function computeQuality(row: any) {
  const candidateCount = Number(row.candidate_count || 0);
  const savedCount = Number(row.saved_count || 0);
  const duplicateCount = Number(row.duplicate_count || 0);
  const failureCount = Number(row.failure_count || 0);
  const sourceSuccessCount = Number(row.source_success_count || 0);
  const sourceFailureCount = Number(row.source_failure_count || 0);
  const opportunityCount = Number(row.opportunity_count || 0);
  const shortlistedCount = Number(row.shortlisted_count || 0);
  const rejectedCount = Number(row.rejected_count || 0);
  const averageCandidateScore = Number(row.average_candidate_score || 0);
  const averageSourcePriority = Number(row.average_source_priority || 0);

  let score = 42;
  score += Math.min(18, savedCount * 4);
  score += Math.min(18, opportunityCount * 3);
  score += Math.min(12, shortlistedCount * 5);
  score += Math.min(10, sourceSuccessCount * 2);
  score += Math.round((averageCandidateScore - 50) * 0.22);
  score += Math.round((averageSourcePriority - 50) * 0.12);
  score -= Math.min(18, duplicateCount * 2);
  score -= Math.min(20, failureCount * 4);
  score -= Math.min(14, sourceFailureCount * 3);
  score -= Math.min(12, rejectedCount * 2);
  if (candidateCount > 12 && savedCount === 0 && opportunityCount === 0) score -= 10;
  return clampScore(score);
}

async function strategyAggregates(env: Env) {
  const tables = await requiredTables(env);
  if (!tables.candidates || !tables.strategies) return { ok: false, error: "missing_migration", requiredMigration: "0008_source_expansion_strategy_quality.sql", tables } as const;

  const rows = await env.DB.prepare(
    `SELECT
       c.strategy AS strategy,
       COUNT(*) AS candidate_count,
       SUM(CASE WHEN c.status = 'saved' THEN 1 ELSE 0 END) AS saved_count,
       SUM(CASE WHEN c.status = 'duplicate_existing_source' THEN 1 ELSE 0 END) AS duplicate_count,
       SUM(CASE WHEN c.failure_count > 0 THEN c.failure_count ELSE 0 END) AS failure_count,
       COUNT(DISTINCT c.saved_source_id) AS source_count,
       COALESCE(SUM(s.success_count), 0) AS source_success_count,
       COALESCE(SUM(s.failure_count), 0) AS source_failure_count,
       COUNT(DISTINCT o.id) AS opportunity_count,
       SUM(CASE WHEN o.status IN ('shortlisted', 'watching') THEN 1 ELSE 0 END) AS shortlisted_count,
       SUM(CASE WHEN o.status IN ('rejected', 'archived', 'duplicate') THEN 1 ELSE 0 END) AS rejected_count,
       AVG(c.score) AS average_candidate_score,
       AVG(s.priority) AS average_source_priority
     FROM source_expansion_candidates c
     LEFT JOIN opportunity_sources s ON s.id = c.saved_source_id
     LEFT JOIN opportunities o ON o.source_id = c.saved_source_id
     WHERE c.strategy IS NOT NULL AND c.strategy != ''
     GROUP BY c.strategy
     ORDER BY candidate_count DESC`
  ).all<any>();

  return { ok: true, tables, rows: rows.results || [] } as const;
}

export async function learnSourceExpansionQuality(env: Env) {
  const aggregates = await strategyAggregates(env);
  if (!aggregates.ok) return aggregates;
  const now = nowISO();
  const learned: StrategyScoreRow[] = [];

  for (const raw of aggregates.rows) {
    const strategy = String(raw.strategy || "unknown");
    const qualityScore = computeQuality(raw);
    const savedCount = Number(raw.saved_count || 0);
    const duplicateCount = Number(raw.duplicate_count || 0);
    const failureCount = Number(raw.failure_count || 0);
    const opportunityCount = Number(raw.opportunity_count || 0);
    const recommendation = recommendationFor(qualityScore, savedCount, duplicateCount, failureCount, opportunityCount);
    const row: StrategyScoreRow = {
      strategy,
      candidate_count: Number(raw.candidate_count || 0),
      saved_count: savedCount,
      duplicate_count: duplicateCount,
      failure_count: failureCount,
      source_count: Number(raw.source_count || 0),
      source_success_count: Number(raw.source_success_count || 0),
      source_failure_count: Number(raw.source_failure_count || 0),
      opportunity_count: opportunityCount,
      shortlisted_count: Number(raw.shortlisted_count || 0),
      rejected_count: Number(raw.rejected_count || 0),
      average_candidate_score: Number(raw.average_candidate_score || 0),
      average_source_priority: Number(raw.average_source_priority || 0),
      quality_score: qualityScore,
      recommendation,
    };

    await env.DB.prepare(
      `INSERT INTO source_expansion_strategy_scores (
         strategy, candidate_count, saved_count, duplicate_count, failure_count, source_count,
         source_success_count, source_failure_count, opportunity_count, shortlisted_count, rejected_count,
         average_candidate_score, average_source_priority, quality_score, recommendation,
         last_learned_at_iso, created_at_iso, updated_at_iso
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(strategy) DO UPDATE SET
         candidate_count = excluded.candidate_count,
         saved_count = excluded.saved_count,
         duplicate_count = excluded.duplicate_count,
         failure_count = excluded.failure_count,
         source_count = excluded.source_count,
         source_success_count = excluded.source_success_count,
         source_failure_count = excluded.source_failure_count,
         opportunity_count = excluded.opportunity_count,
         shortlisted_count = excluded.shortlisted_count,
         rejected_count = excluded.rejected_count,
         average_candidate_score = excluded.average_candidate_score,
         average_source_priority = excluded.average_source_priority,
         quality_score = excluded.quality_score,
         recommendation = excluded.recommendation,
         last_learned_at_iso = excluded.last_learned_at_iso,
         updated_at_iso = excluded.updated_at_iso`
    ).bind(
      strategy,
      row.candidate_count,
      row.saved_count,
      row.duplicate_count,
      row.failure_count,
      row.source_count,
      row.source_success_count,
      row.source_failure_count,
      row.opportunity_count,
      row.shortlisted_count,
      row.rejected_count,
      row.average_candidate_score,
      row.average_source_priority,
      row.quality_score,
      row.recommendation,
      now,
      now,
      now,
    ).run();

    await env.DB.prepare(
      `UPDATE source_expansion_seeds
       SET quality_score = ?,
           priority = CASE
             WHEN ? >= 78 THEN MIN(100, priority + 5)
             WHEN ? <= 30 THEN MAX(0, priority - 8)
             ELSE priority
           END,
           updated_at_iso = ?
       WHERE strategy = ?`
    ).bind(row.quality_score, row.quality_score, row.quality_score, now, strategy).run();

    learned.push(row);
  }

  await logEvent(env, "source_expansion_quality_learned", `Learned source expansion quality for ${learned.length} strategy row(s).`);
  return { ok: true, mode: "source_expansion_quality_learning", learnedCount: learned.length, strategies: learned };
}

export async function listSourceExpansionStrategyScores(env: Env, limit = 50) {
  const tables = await requiredTables(env);
  if (!tables.strategies) return { ok: false, error: "missing_migration", requiredMigration: "0008_source_expansion_strategy_quality.sql", tables };
  const safeLimit = Math.max(1, Math.min(100, Math.round(Number(limit || 50))));
  const rows = await env.DB.prepare(
    `SELECT strategy, candidate_count, saved_count, duplicate_count, failure_count, source_count,
            source_success_count, source_failure_count, opportunity_count, shortlisted_count, rejected_count,
            average_candidate_score, average_source_priority, quality_score, recommendation,
            last_learned_at_iso, updated_at_iso
     FROM source_expansion_strategy_scores
     ORDER BY quality_score DESC, updated_at_iso DESC
     LIMIT ?`
  ).bind(safeLimit).all<any>();
  return { ok: true, mode: "source_expansion_strategy_scores", count: rows.results?.length || 0, strategies: rows.results || [] };
}
