import type { Env } from "../db";
import { getAdminToken } from "../db";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

type SourceOriginRow = {
  status?: string | null;
  priority?: number | null;
  notes?: string | null;
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
  if (origin === "sitemap") return "sitemap";
  if (origin === "source_expansion") return "source_expansion";
  if (origin === "source_candidate_preview") return "source_candidate_preview";
  if (String(notes || "").startsWith("Saved from source candidate preview")) return "source_candidate_preview";
  if (String(notes || "").startsWith("Saved from")) return "other_saved_candidate";
  return "manual_or_unknown";
}

function blankBucket(origin: string) {
  return {
    origin,
    count: 0,
    active: 0,
    paused: 0,
    failed: 0,
    averagePriority: 0,
    priorityTotal: 0,
  };
}

export async function handleOpportunitySourceOriginMetricsAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (pathname !== "/admin/opportunities/sources/origin-metrics") return json({ ok: false, error: "Not found" }, { status: 404 });
  if (request.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!(await tableExists(env, "opportunity_sources"))) return json({ ok: false, error: "missing_migration", requiredMigration: "0004_opportunity_intelligence.sql" }, { status: 200 });

  const rows = await env.DB.prepare(
    `SELECT status, priority, notes
     FROM opportunity_sources
     LIMIT 10000`
  ).all<SourceOriginRow>();

  const buckets = new Map<string, ReturnType<typeof blankBucket>>();
  const order = ["query_hint", "sitemap", "source_expansion", "source_candidate_preview", "other_saved_candidate", "manual_or_unknown"];
  for (const origin of order) buckets.set(origin, blankBucket(origin));

  for (const row of rows.results || []) {
    const origin = classifyOrigin(row.notes);
    const bucket = buckets.get(origin) || blankBucket(origin);
    bucket.count += 1;
    const status = row.status || "unknown";
    if (status === "active") bucket.active += 1;
    else if (status === "paused") bucket.paused += 1;
    else if (status === "failed") bucket.failed += 1;
    bucket.priorityTotal += Number(row.priority || 0);
    buckets.set(origin, bucket);
  }

  const origins = Array.from(buckets.values()).map((bucket) => ({
    origin: bucket.origin,
    label: bucket.origin.replace(/_/g, " "),
    count: bucket.count,
    active: bucket.active,
    paused: bucket.paused,
    failed: bucket.failed,
    averagePriority: bucket.count ? Math.round(bucket.priorityTotal / bucket.count) : 0,
  }));

  return json({
    ok: true,
    mode: "opportunity_source_origin_metrics",
    totalSources: rows.results?.length || 0,
    origins,
    safety: { readOnly: true, writesTables: [], callsAI: false, sendsEmail: false, callsNetwork: false },
  });
}
