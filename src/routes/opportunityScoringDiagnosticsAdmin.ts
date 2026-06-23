import { Env, getAdminToken } from "../db";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

type OpportunityRow = {
  id: string;
  title: string;
  url: string;
  opportunity_type?: string | null;
  category?: string | null;
  status?: string | null;
  total_score?: number | null;
  confidence?: string | null;
  evidence_json?: string | null;
  updated_at_iso?: string | null;
};

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

async function tableExists(env: Env, tableName: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1").bind(tableName).first<any>();
  return Boolean(row?.name);
}

function clampLimit(value: string | null) {
  const n = Number(value || 100);
  if (!Number.isFinite(n)) return 100;
  return Math.max(1, Math.min(250, Math.round(n)));
}

function parseEvidence(raw?: string | null): any | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function inc(map: Record<string, number>, key: string, amount = 1) {
  map[key] = (map[key] || 0) + amount;
}

function slimOpportunity(row: OpportunityRow, calibration: any) {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    opportunityType: row.opportunity_type || "unknown",
    category: row.category || null,
    status: row.status || null,
    totalScore: Number(row.total_score || 0),
    confidence: row.confidence || null,
    rawScore: calibration?.rawScore ?? null,
    calibratedScore: calibration?.calibratedScore ?? null,
    adjustment: calibration?.adjustment ?? 0,
    reasons: Array.isArray(calibration?.reasons) ? calibration.reasons : [],
    reviewLearning: calibration?.reviewLearning || null,
    sourceHealth: calibration?.sourceHealth || null,
    updatedAtISO: row.updated_at_iso || null,
  };
}

async function diagnostics(env: Env, url: URL) {
  if (!(await tableExists(env, "opportunities"))) {
    return { ok: false, error: "missing_migration", missing: "opportunities", requiredMigration: "0004_opportunity_intelligence.sql" };
  }

  const limit = clampLimit(url.searchParams.get("limit"));
  const rows = await env.DB.prepare(
    `SELECT id, title, url, opportunity_type, category, status, total_score, confidence, evidence_json, updated_at_iso
     FROM opportunities
     ORDER BY updated_at_iso DESC
     LIMIT ?`
  ).bind(limit).all<OpportunityRow>();

  const reasonCounts: Record<string, number> = {};
  const reviewLearningCounts: Record<string, number> = {};
  const sourceHealthReasonCounts: Record<string, number> = {};
  const typeAdjustmentTotals: Record<string, { count: number; totalAdjustment: number }> = {};
  const boosted: any[] = [];
  const penalised: any[] = [];
  const uncalibrated: any[] = [];
  let calibratedCount = 0;
  let totalAdjustment = 0;
  let positive = 0;
  let negative = 0;
  let neutral = 0;

  for (const row of rows.results || []) {
    const evidence = parseEvidence(row.evidence_json);
    const calibration = evidence?.scoreCalibration;
    if (!calibration || typeof calibration !== "object") {
      uncalibrated.push({ id: row.id, title: row.title, url: row.url, totalScore: row.total_score || 0 });
      continue;
    }

    calibratedCount += 1;
    const adjustment = Number(calibration.adjustment || 0);
    totalAdjustment += adjustment;
    if (adjustment > 0) positive += 1;
    else if (adjustment < 0) negative += 1;
    else neutral += 1;

    const typeKey = row.opportunity_type || "unknown";
    typeAdjustmentTotals[typeKey] = typeAdjustmentTotals[typeKey] || { count: 0, totalAdjustment: 0 };
    typeAdjustmentTotals[typeKey].count += 1;
    typeAdjustmentTotals[typeKey].totalAdjustment += adjustment;

    for (const reason of Array.isArray(calibration.reasons) ? calibration.reasons : []) {
      inc(reasonCounts, reason);
      if (String(reason).startsWith("source_health:")) inc(sourceHealthReasonCounts, reason);
      if (String(reason).startsWith("review_learning:")) inc(reviewLearningCounts, reason);
    }

    const slim = slimOpportunity(row, calibration);
    if (adjustment > 0) boosted.push(slim);
    if (adjustment < 0) penalised.push(slim);
  }

  boosted.sort((a, b) => Math.abs(b.adjustment) - Math.abs(a.adjustment));
  penalised.sort((a, b) => Math.abs(b.adjustment) - Math.abs(a.adjustment));

  const typeAverages = Object.entries(typeAdjustmentTotals).map(([opportunityType, value]) => ({
    opportunityType,
    count: value.count,
    averageAdjustment: value.count ? Number((value.totalAdjustment / value.count).toFixed(2)) : 0,
    totalAdjustment: value.totalAdjustment,
  })).sort((a, b) => Math.abs(b.averageAdjustment) - Math.abs(a.averageAdjustment));

  return {
    ok: true,
    mode: "opportunity_scoring_diagnostics",
    inspected: rows.results?.length || 0,
    calibratedCount,
    uncalibratedCount: uncalibrated.length,
    summary: {
      positive,
      negative,
      neutral,
      averageAdjustment: calibratedCount ? Number((totalAdjustment / calibratedCount).toFixed(2)) : 0,
      totalAdjustment,
    },
    reasonCounts,
    sourceHealthReasonCounts,
    reviewLearningCounts,
    typeAverages,
    boosted: boosted.slice(0, 20),
    penalised: penalised.slice(0, 20),
    uncalibrated: uncalibrated.slice(0, 20),
    safety: {
      readOnly: true,
      callsAI: false,
      sendsEmail: false,
      writesTables: [],
    },
  };
}

export async function handleOpportunityScoringDiagnosticsAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
  if (pathname !== "/admin/opportunities/scoring-diagnostics") return json({ ok: false, error: "Not found" }, { status: 404 });

  return json(await diagnostics(env, new URL(request.url)));
}
