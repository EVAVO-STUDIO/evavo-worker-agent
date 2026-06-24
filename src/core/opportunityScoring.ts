import type { Env } from "../db";
import type { OpportunityCandidate } from "./opportunityDiscovery";

type SourceLike = {
  id: string;
  url: string;
  label?: string | null;
  source_type?: string | null;
  category?: string | null;
};

export type ScoreCalibration = {
  rawScore: number;
  calibratedScore: number;
  adjustment: number;
  reasons: string[];
  guardrails: string[];
  sourceHealth?: {
    runCount: number;
    saved: number;
    found: number;
    rejected: number;
    duplicates: number;
    failedRuns: number;
    saveRate: number;
    rejectionRate: number;
    duplicateRate: number;
  };
  reviewLearning?: {
    scoreAdjustment: number;
    source: string;
  };
};

function clampInt(value: unknown, fallback: number, min = 0, max = 100): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

async function tableExists(env: Env, tableName: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1").bind(tableName).first<any>();
  return Boolean(row?.name);
}

async function getSourceHealthSignal(env: Env, source: SourceLike) {
  if (!(await tableExists(env, "opportunity_run_source_results"))) return null;
  const row = await env.DB.prepare(
    `SELECT
       COUNT(id) AS run_count,
       COALESCE(SUM(candidates_found), 0) AS found,
       COALESCE(SUM(candidates_saved), 0) AS saved,
       COALESCE(SUM(candidates_rejected), 0) AS rejected,
       COALESCE(SUM(duplicates), 0) AS duplicates,
       COALESCE(SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END), 0) AS failed_runs
     FROM opportunity_run_source_results
     WHERE source_id = ?`
  ).bind(source.id).first<any>();

  const runCount = clampInt(row?.run_count, 0, 0, 100000);
  const found = clampInt(row?.found, 0, 0, 100000);
  const saved = clampInt(row?.saved, 0, 0, 100000);
  const rejected = clampInt(row?.rejected, 0, 0, 100000);
  const duplicates = clampInt(row?.duplicates, 0, 0, 100000);
  const failedRuns = clampInt(row?.failed_runs, 0, 0, 100000);

  return {
    runCount,
    found,
    saved,
    rejected,
    duplicates,
    failedRuns,
    saveRate: found ? saved / found : 0,
    rejectionRate: found ? rejected / found : 0,
    duplicateRate: found ? duplicates / found : 0,
    failureRate: runCount ? failedRuns / runCount : 0,
  };
}

async function getReviewLearningSignal(env: Env, source: SourceLike, candidate: OpportunityCandidate) {
  if (!(await tableExists(env, "opportunity_strategy_scores"))) return null;

  const opportunityType = candidate.opportunityType || "unknown";
  const category = source.category || "uncategorized";

  const exact = await env.DB.prepare(
    `SELECT score_adjustment, opportunity_type, category
     FROM opportunity_strategy_scores
     WHERE opportunity_type = ? AND category = ?
     LIMIT 1`
  ).bind(opportunityType, category).first<any>();

  if (exact) {
    return {
      scoreAdjustment: clampInt(exact.score_adjustment, 0, -25, 25),
      source: `exact:${opportunityType}:${category}`,
    };
  }

  const typeOnly = await env.DB.prepare(
    `SELECT AVG(score_adjustment) AS score_adjustment
     FROM opportunity_strategy_scores
     WHERE opportunity_type = ?`
  ).bind(opportunityType).first<any>();

  const avg = Number(typeOnly?.score_adjustment);
  if (Number.isFinite(avg) && avg !== 0) {
    return {
      scoreAdjustment: clampInt(avg, 0, -15, 15),
      source: `type:${opportunityType}`,
    };
  }

  return null;
}

function candidateHasStrongReviewSignals(candidate: OpportunityCandidate): boolean {
  const signals = Array.isArray(candidate.signals) ? candidate.signals : [];
  const breakdown = candidate.scoreBreakdown;
  const hasFitSignal = signals.some((signal) => String(signal).startsWith("evavo_fit:"));
  const hasIntentSignal = signals.some((signal) => String(signal).startsWith("intent:"));
  const fitScore = Number(breakdown?.evavoFitScore || 0);
  const urgencyScore = Number(breakdown?.urgencyScore || 0);
  const valueScore = Number(breakdown?.valueScore || 0);
  return hasFitSignal || hasIntentSignal || fitScore >= 8 || urgencyScore >= 8 || valueScore >= 10;
}

function applyGuardrails(rawScore: number, candidate: OpportunityCandidate, proposedAdjustment: number, reasons: string[]) {
  const guardrails: string[] = [];
  const confidence = candidate.confidence || "low";
  const strongSignals = candidateHasStrongReviewSignals(candidate);

  let boundedAdjustment = clampInt(proposedAdjustment, 0, -18, 18);
  if (boundedAdjustment !== Math.round(proposedAdjustment)) guardrails.push("guardrail:adjustment_cap_18");

  if (confidence === "low" && boundedAdjustment > 6) {
    boundedAdjustment = 6;
    guardrails.push("guardrail:low_confidence_boost_cap_6");
  }

  if (confidence === "medium" && boundedAdjustment > 12) {
    boundedAdjustment = 12;
    guardrails.push("guardrail:medium_confidence_boost_cap_12");
  }

  let calibratedScore = clampInt(rawScore + boundedAdjustment, rawScore, 0, 100);

  if (confidence === "low" && !strongSignals && calibratedScore > 55) {
    calibratedScore = Math.min(calibratedScore, 55);
    guardrails.push("guardrail:low_confidence_no_strong_signal_ceiling_55");
  }

  if (confidence === "medium" && !strongSignals && calibratedScore > 70) {
    calibratedScore = Math.min(calibratedScore, 70);
    guardrails.push("guardrail:medium_confidence_no_strong_signal_ceiling_70");
  }

  if (strongSignals && rawScore >= 45 && calibratedScore < 40) {
    calibratedScore = 40;
    guardrails.push("guardrail:strong_signal_review_floor_40");
  }

  if (strongSignals && rawScore >= 60 && calibratedScore < 55) {
    calibratedScore = 55;
    guardrails.push("guardrail:strong_signal_review_floor_55");
  }

  if (guardrails.length) reasons.push(...guardrails);

  return {
    calibratedScore,
    adjustment: calibratedScore - rawScore,
    guardrails,
  };
}

export async function calibrateOpportunityScore(env: Env, source: SourceLike, candidate: OpportunityCandidate, rawScoreInput: number): Promise<ScoreCalibration> {
  const rawScore = clampInt(rawScoreInput, 0, 0, 100);
  const reasons: string[] = [];
  let adjustment = 0;

  const sourceHealth = await getSourceHealthSignal(env, source);
  if (sourceHealth && sourceHealth.runCount > 0) {
    if (sourceHealth.saveRate >= 0.25 && sourceHealth.saved >= 3) {
      adjustment += 8;
      reasons.push("source_health:strong_save_rate");
    } else if (sourceHealth.saveRate >= 0.1 && sourceHealth.saved >= 1) {
      adjustment += 4;
      reasons.push("source_health:useful_save_rate");
    }

    if (sourceHealth.rejectionRate >= 0.75 && sourceHealth.found >= 4) {
      adjustment -= 10;
      reasons.push("source_health:high_rejection_rate");
    } else if (sourceHealth.rejectionRate >= 0.5 && sourceHealth.found >= 4) {
      adjustment -= 5;
      reasons.push("source_health:moderate_rejection_rate");
    }

    if (sourceHealth.duplicateRate >= 0.5 && sourceHealth.found >= 4) {
      adjustment -= 6;
      reasons.push("source_health:duplicate_heavy");
    }

    if (sourceHealth.failureRate >= 0.5 && sourceHealth.runCount >= 2) {
      adjustment -= 8;
      reasons.push("source_health:unstable_source");
    }
  }

  const learning = await getReviewLearningSignal(env, source, candidate);
  if (learning && learning.scoreAdjustment !== 0) {
    adjustment += learning.scoreAdjustment;
    reasons.push(`review_learning:${learning.source}:${learning.scoreAdjustment > 0 ? "boost" : "penalty"}`);
  }

  const guarded = applyGuardrails(rawScore, candidate, adjustment, reasons);

  return {
    rawScore,
    calibratedScore: guarded.calibratedScore,
    adjustment: guarded.adjustment,
    reasons,
    guardrails: guarded.guardrails,
    sourceHealth: sourceHealth
      ? {
          runCount: sourceHealth.runCount,
          saved: sourceHealth.saved,
          found: sourceHealth.found,
          rejected: sourceHealth.rejected,
          duplicates: sourceHealth.duplicates,
          failedRuns: sourceHealth.failedRuns,
          saveRate: Number(sourceHealth.saveRate.toFixed(3)),
          rejectionRate: Number(sourceHealth.rejectionRate.toFixed(3)),
          duplicateRate: Number(sourceHealth.duplicateRate.toFixed(3)),
        }
      : undefined,
    reviewLearning: learning || undefined,
  };
}
