import { Env, getAdminToken } from "../db";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

async function tableExists(env: Env, tableName: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1").bind(tableName).first<any>();
  return Boolean(row?.name);
}

async function listRuns(env: Env, requestUrl: URL) {
  if (!(await tableExists(env, "opportunity_runs"))) {
    return { ok: false, error: "missing_migration", missing: "opportunity_runs", requiredMigration: "0006_opportunity_run_audit.sql" };
  }

  const limit = Math.max(1, Math.min(100, Number(requestUrl.searchParams.get("limit") || 25)));
  const rows = await env.DB.prepare(
    `SELECT id, run_type, started_at_iso, finished_at_iso, status, sources_checked, candidates_found, candidates_saved, candidates_rejected, duplicates, failed, skipped, error
     FROM opportunity_runs
     ORDER BY started_at_iso DESC
     LIMIT ?`
  ).bind(limit).all<any>();

  return {
    ok: true,
    mode: "opportunity_runs",
    count: rows.results?.length || 0,
    runs: rows.results || [],
    safety: { readOnly: true, callsAI: false, sendsEmail: false },
  };
}

async function readRun(env: Env, id: string) {
  if (!(await tableExists(env, "opportunity_runs"))) {
    return { ok: false, error: "missing_migration", missing: "opportunity_runs", requiredMigration: "0006_opportunity_run_audit.sql" };
  }

  const run = await env.DB.prepare("SELECT * FROM opportunity_runs WHERE id = ? LIMIT 1").bind(id).first<any>();
  if (!run) return { ok: false, error: "run_not_found" };

  const sources = (await tableExists(env, "opportunity_run_source_results"))
    ? await env.DB.prepare(
        `SELECT * FROM opportunity_run_source_results
         WHERE run_id = ?
         ORDER BY created_at_iso DESC`
      ).bind(id).all<any>()
    : { results: [] };

  const rejections = (await tableExists(env, "opportunity_candidate_rejections"))
    ? await env.DB.prepare(
        `SELECT * FROM opportunity_candidate_rejections
         WHERE run_id = ?
         ORDER BY created_at_iso DESC
         LIMIT 100`
      ).bind(id).all<any>()
    : { results: [] };

  return {
    ok: true,
    mode: "opportunity_run_detail",
    run,
    sources: sources.results || [],
    rejections: rejections.results || [],
    safety: { readOnly: true, callsAI: false, sendsEmail: false },
  };
}

function parseRunId(pathname: string): string | null {
  const prefix = "/admin/opportunities/runs/";
  if (!pathname.startsWith(prefix)) return null;
  const id = pathname.slice(prefix.length).split("/").filter(Boolean)[0];
  return id ? decodeURIComponent(id) : null;
}

export async function handleOpportunityRunsAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, { status: 405 });

  const requestUrl = new URL(request.url);
  if (pathname === "/admin/opportunities/runs") return json(await listRuns(env, requestUrl));

  const id = parseRunId(pathname);
  if (id) return json(await readRun(env, id));

  return json({ ok: false, error: "Not found" }, { status: 404 });
}
