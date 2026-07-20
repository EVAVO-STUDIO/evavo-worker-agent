import { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

type SourceHealthRow = {
  source_id: string;
  source_url: string;
  label?: string | null;
  source_type?: string | null;
  status?: string | null;
  priority?: number | null;
  success_count?: number | null;
  failure_count?: number | null;
  last_run_at_iso?: string | null;
  last_error?: string | null;
  run_count?: number | null;
  total_found?: number | null;
  total_saved?: number | null;
  total_rejected?: number | null;
  total_duplicates?: number | null;
  total_failed_runs?: number | null;
  avg_elapsed_ms?: number | null;
  last_audit_at_iso?: string | null;
};

async function tableExists(env: Env, tableName: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1").bind(tableName).first<any>();
  return Boolean(row?.name);
}

function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function classifyHealth(score: number, row: SourceHealthRow) {
  if (safeNumber(row.total_failed_runs) > 0 && safeNumber(row.run_count) > 0 && safeNumber(row.total_failed_runs) / safeNumber(row.run_count) >= 0.75) return "failing";
  if (score >= 75) return "strong";
  if (score >= 55) return "useful";
  if (score >= 35) return "noisy";
  return "weak";
}

function buildRecommendation(health: string, row: SourceHealthRow) {
  if (health === "strong") return "keep_high_priority";
  if (health === "useful") return "keep_monitoring";
  if (health === "noisy") return "lower_priority_or_tighten_filters";
  if (health === "failing") return "pause_or_fix_source";
  if (safeNumber(row.total_duplicates) > safeNumber(row.total_saved) * 2) return "dedupe_heavy_review_needed";
  return "review_source_quality";
}

function scoreSource(row: SourceHealthRow) {
  const runCount = safeNumber(row.run_count);
  const found = safeNumber(row.total_found);
  const saved = safeNumber(row.total_saved);
  const rejected = safeNumber(row.total_rejected);
  const duplicates = safeNumber(row.total_duplicates);
  const failedRuns = safeNumber(row.total_failed_runs);
  const sourceSuccess = safeNumber(row.success_count);
  const sourceFailure = safeNumber(row.failure_count);

  const sourceAttempts = sourceSuccess + sourceFailure;
  const fetchReliability = sourceAttempts ? (sourceSuccess / sourceAttempts) * 30 : 12;
  const saveYield = found ? (saved / found) * 35 : 0;
  const usefulVolume = Math.min(20, saved * 4);
  const duplicatePenalty = found ? Math.min(15, (duplicates / Math.max(1, found)) * 20) : 0;
  const rejectionPenalty = found ? Math.min(20, (rejected / Math.max(1, found)) * 22) : 0;
  const failurePenalty = runCount ? Math.min(25, (failedRuns / Math.max(1, runCount)) * 30) : 0;
  const prioritySignal = Math.min(10, safeNumber(row.priority) / 10);

  const score = clamp(fetchReliability + saveYield + usefulVolume + prioritySignal - duplicatePenalty - rejectionPenalty - failurePenalty);
  const health = classifyHealth(score, row);

  return {
    score,
    health,
    recommendation: buildRecommendation(health, row),
    metrics: {
      runCount,
      fetchReliability: Math.round(fetchReliability),
      saved,
      found,
      rejected,
      duplicates,
      failedRuns,
      saveRate: found ? Number((saved / found).toFixed(3)) : 0,
      rejectionRate: found ? Number((rejected / found).toFixed(3)) : 0,
      duplicateRate: found ? Number((duplicates / found).toFixed(3)) : 0,
    },
  };
}

async function sourceHealth(env: Env, requestUrl: URL) {
  if (!(await tableExists(env, "opportunity_sources"))) {
    return { ok: false, error: "missing_migration", missing: "opportunity_sources", requiredMigration: "0004_opportunity_intelligence.sql" };
  }

  const hasAudit = await tableExists(env, "opportunity_run_source_results");
  const limit = Math.max(1, Math.min(100, Number(requestUrl.searchParams.get("limit") || 50)));

  if (!hasAudit) {
    const rows = await env.DB.prepare(
      `SELECT id AS source_id, url AS source_url, label, source_type, status, priority, success_count, failure_count, last_run_at_iso, last_error
       FROM opportunity_sources
       ORDER BY priority DESC, COALESCE(updated_at_iso, '') DESC
       LIMIT ?`
    ).bind(limit).all<SourceHealthRow>();

    return {
      ok: false,
      mode: "opportunity_source_health",
      error: "missing_run_audit_migration",
      requiredMigration: "0006_opportunity_run_audit.sql",
      sources: (rows.results || []).map((row) => ({ ...row, ...scoreSource(row), auditAvailable: false })),
      safety: { readOnly: true, callsAI: false, sendsEmail: false },
    };
  }

  const rows = await env.DB.prepare(
    `SELECT
       s.id AS source_id,
       s.url AS source_url,
       s.label,
       s.source_type,
       s.status,
       s.priority,
       s.success_count,
       s.failure_count,
       s.last_run_at_iso,
       s.last_error,
       COUNT(r.id) AS run_count,
       COALESCE(SUM(r.candidates_found), 0) AS total_found,
       COALESCE(SUM(r.candidates_saved), 0) AS total_saved,
       COALESCE(SUM(r.candidates_rejected), 0) AS total_rejected,
       COALESCE(SUM(r.duplicates), 0) AS total_duplicates,
       COALESCE(SUM(CASE WHEN r.error IS NOT NULL THEN 1 ELSE 0 END), 0) AS total_failed_runs,
       AVG(r.elapsed_ms) AS avg_elapsed_ms,
       MAX(r.created_at_iso) AS last_audit_at_iso
     FROM opportunity_sources s
     LEFT JOIN opportunity_run_source_results r ON r.source_id = s.id
     GROUP BY s.id
     ORDER BY total_saved DESC, s.priority DESC, last_audit_at_iso DESC
     LIMIT ?`
  ).bind(limit).all<SourceHealthRow>();

  const sources = (rows.results || []).map((row) => ({ ...row, ...scoreSource(row), auditAvailable: true }));
  const summary = sources.reduce(
    (acc, source: any) => {
      acc.total += 1;
      acc[source.health] = (acc[source.health] || 0) + 1;
      return acc;
    },
    { total: 0 } as Record<string, number>,
  );

  return {
    ok: true,
    mode: "opportunity_source_health",
    count: sources.length,
    summary,
    sources,
    safety: { readOnly: true, callsAI: false, sendsEmail: false },
  };
}

export async function handleOpportunitySourceHealthAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET" } });
  }
  if (request.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET" } });
  if (pathname !== "/admin/opportunities/sources/health") return json({ ok: false, error: "Not found" }, { status: 404 });

  return json(await sourceHealth(env, new URL(request.url)));
}
