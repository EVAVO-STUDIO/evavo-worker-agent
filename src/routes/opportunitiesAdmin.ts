import { Env, getAdminToken } from "../db";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

function nowISO() {
  return new Date().toISOString();
}

function uuid() {
  return crypto.randomUUID();
}

async function tableExists(env: Env, tableName: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1").bind(tableName).first<any>();
  return Boolean(row?.name);
}

async function listOpportunitySources(env: Env, url: URL) {
  if (!(await tableExists(env, "opportunity_sources"))) {
    return { ok: false, error: "missing_migration", missing: "opportunity_sources", requiredMigration: "0004_opportunity_intelligence.sql" };
  }

  const status = url.searchParams.get("status") || "";
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 50)));
  const where = status ? "WHERE status = ?" : "";
  const stmt = env.DB.prepare(
    `SELECT id, url, label, source_type, country, region, category, status, priority, success_count, failure_count, last_run_at_iso, next_run_at_iso, cooldown_until_iso, last_error, updated_at_iso
     FROM opportunity_sources
     ${where}
     ORDER BY priority DESC, updated_at_iso DESC
     LIMIT ?`
  );
  const rows = status ? await stmt.bind(status, limit).all<any>() : await stmt.bind(limit).all<any>();
  return { ok: true, mode: "opportunity_sources", count: rows.results?.length || 0, sources: rows.results || [] };
}

async function listOpportunities(env: Env, url: URL) {
  if (!(await tableExists(env, "opportunities"))) {
    return { ok: false, error: "missing_migration", missing: "opportunities", requiredMigration: "0004_opportunity_intelligence.sql" };
  }

  const status = url.searchParams.get("status") || "";
  const type = url.searchParams.get("type") || "";
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 50)));
  const clauses: string[] = [];
  const binds: any[] = [];
  if (status) {
    clauses.push("status = ?");
    binds.push(status);
  }
  if (type) {
    clauses.push("opportunity_type = ?");
    binds.push(type);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  binds.push(limit);

  const rows = await env.DB.prepare(
    `SELECT id, source_id, url, title, opportunity_type, issuer, country, region, category, amount_text, currency, opens_at_iso, closes_at_iso, discovered_at_iso, status, fit_score, urgency_score, value_score, effort_score, risk_score, total_score, confidence, summary, eligibility_summary, recommended_action, evidence_json, updated_at_iso
     FROM opportunities
     ${where}
     ORDER BY total_score DESC, updated_at_iso DESC
     LIMIT ?`
  ).bind(...binds).all<any>();

  return { ok: true, mode: "opportunities", count: rows.results?.length || 0, opportunities: rows.results || [] };
}

async function addOpportunitySource(env: Env, body: any) {
  if (!(await tableExists(env, "opportunity_sources"))) {
    return { ok: false, error: "missing_migration", missing: "opportunity_sources", requiredMigration: "0004_opportunity_intelligence.sql" };
  }

  const rawUrl = String(body?.url || "").trim();
  if (!rawUrl) return { ok: false, error: "url_required" };
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: "invalid_url" };
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return { ok: false, error: "unsupported_protocol" };

  const id = uuid();
  const now = nowISO();
  await env.DB.prepare(
    `INSERT INTO opportunity_sources (id, url, label, source_type, country, region, category, status, priority, notes, created_at_iso, updated_at_iso)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    parsed.toString(),
    body?.label || null,
    body?.sourceType || body?.source_type || "opportunity_directory",
    body?.country || null,
    body?.region || null,
    body?.category || null,
    body?.status || "active",
    Number(body?.priority || 50),
    body?.notes || null,
    now,
    now
  ).run();

  return { ok: true, id, url: parsed.toString(), mode: "opportunity_source_added" };
}

async function opportunitySummary(env: Env) {
  const hasSources = await tableExists(env, "opportunity_sources");
  const hasOpportunities = await tableExists(env, "opportunities");
  if (!hasSources || !hasOpportunities) {
    return {
      ok: false,
      error: "missing_migration",
      requiredMigration: "0004_opportunity_intelligence.sql",
      tables: { opportunity_sources: hasSources, opportunities: hasOpportunities },
    };
  }

  const sources = await env.DB.prepare("SELECT status, COUNT(*) AS count FROM opportunity_sources GROUP BY status").all<any>();
  const oppsByStatus = await env.DB.prepare("SELECT status, COUNT(*) AS count FROM opportunities GROUP BY status").all<any>();
  const oppsByType = await env.DB.prepare("SELECT opportunity_type, COUNT(*) AS count FROM opportunities GROUP BY opportunity_type ORDER BY count DESC").all<any>();
  const top = await env.DB.prepare(
    `SELECT id, title, opportunity_type, issuer, amount_text, closes_at_iso, status, total_score, confidence, recommended_action
     FROM opportunities
     WHERE status IN ('new', 'watching', 'shortlisted')
     ORDER BY total_score DESC, updated_at_iso DESC
     LIMIT 10`
  ).all<any>();

  return {
    ok: true,
    mode: "opportunity_summary",
    sourcesByStatus: sources.results || [],
    opportunitiesByStatus: oppsByStatus.results || [],
    opportunitiesByType: oppsByType.results || [],
    topOpportunities: top.results || [],
    safety: {
      readOnlySummary: true,
      callsAI: false,
      sendsEmail: false,
      writesOnSummary: false,
    },
  };
}

export async function handleOpportunitiesAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);

  if (pathname === "/admin/opportunities/summary" && request.method === "GET") {
    return json(await opportunitySummary(env));
  }

  if (pathname === "/admin/opportunities/sources" && request.method === "GET") {
    return json(await listOpportunitySources(env, url));
  }

  if (pathname === "/admin/opportunities/sources" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    return json(await addOpportunitySource(env, body));
  }

  if (pathname === "/admin/opportunities" && request.method === "GET") {
    return json(await listOpportunities(env, url));
  }

  return json({ ok: false, error: "Not found" }, { status: 404 });
}
