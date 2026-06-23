import { Env, getAdminToken } from "../db";
import { extractOpportunityCandidates, summarizeOpportunityPreview } from "../core/opportunityDiscovery";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

async function tableExists(env: Env, tableName: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1").bind(tableName).first<any>();
  return Boolean(row?.name);
}

async function getSource(env: Env, id: string) {
  if (!(await tableExists(env, "opportunity_sources"))) return null;
  return await env.DB.prepare("SELECT * FROM opportunity_sources WHERE id = ? LIMIT 1").bind(id).first<any>();
}

async function fetchHtml(url: string) {
  const started = Date.now();
  const response = await fetch(url, { method: "GET", headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" } });
  const contentType = response.headers.get("content-type") || "";
  const body = await response.text();
  return { ok: response.ok, status: response.status, contentType, body, elapsedMs: Date.now() - started };
}

async function testSource(env: Env, id: string) {
  const source = await getSource(env, id);
  if (!source) return { ok: false, error: "source_not_found_or_missing_migration", requiredMigration: "0004_opportunity_intelligence.sql" };

  const now = new Date().toISOString();
  try {
    const fetched = await fetchHtml(source.url);
    const looksHtml = fetched.contentType.includes("html") || /<a\s/i.test(fetched.body.slice(0, 2500));
    const candidateCount = fetched.ok && looksHtml ? extractOpportunityCandidates(fetched.body, source.url, 25).length : 0;
    const nextRun = new Date(Date.now() + (fetched.ok && looksHtml ? 24 : 6) * 60 * 60 * 1000).toISOString();
    const status = fetched.ok && looksHtml ? "active" : "failed";
    const error = fetched.ok ? (looksHtml ? null : "non_html_response") : `http_${fetched.status}`;

    await env.DB.prepare(
      `UPDATE opportunity_sources
       SET status = ?, success_count = success_count + ?, failure_count = failure_count + ?, last_run_at_iso = ?, next_run_at_iso = ?, last_error = ?, updated_at_iso = ?
       WHERE id = ?`
    ).bind(status, status === "active" ? 1 : 0, status === "failed" ? 1 : 0, now, nextRun, error, now, id).run();

    return {
      ok: status === "active",
      mode: "opportunity_source_test",
      source: { id: source.id, url: source.url, label: source.label, status },
      fetch: { status: fetched.status, contentType: fetched.contentType, elapsedMs: fetched.elapsedMs, bytes: fetched.body.length },
      candidateCount,
      error,
      safety: { callsAI: false, sendsEmail: false, insertsOpportunities: false },
    };
  } catch (err: any) {
    await env.DB.prepare(
      `UPDATE opportunity_sources
       SET status = 'failed', failure_count = failure_count + 1, last_run_at_iso = ?, next_run_at_iso = ?, last_error = ?, updated_at_iso = ?
       WHERE id = ?`
    ).bind(now, new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), String(err?.message || err), now, id).run();
    return { ok: false, mode: "opportunity_source_test", error: String(err?.message || err), safety: { callsAI: false, sendsEmail: false, insertsOpportunities: false } };
  }
}

async function previewSource(env: Env, id: string, requestUrl: URL) {
  const source = await getSource(env, id);
  if (!source) return { ok: false, error: "source_not_found_or_missing_migration", requiredMigration: "0004_opportunity_intelligence.sql" };

  const limit = Math.max(1, Math.min(100, Number(requestUrl.searchParams.get("limit") || 50)));
  const fetched = await fetchHtml(source.url);
  if (!fetched.ok) {
    return { ok: false, mode: "opportunity_source_preview", error: `http_${fetched.status}`, safety: { callsAI: false, sendsEmail: false, insertsOpportunities: false } };
  }

  const candidates = extractOpportunityCandidates(fetched.body, source.url, limit);
  return {
    ok: true,
    mode: "opportunity_source_preview",
    source: { id: source.id, url: source.url, label: source.label, sourceType: source.source_type },
    fetch: { status: fetched.status, contentType: fetched.contentType, elapsedMs: fetched.elapsedMs, bytes: fetched.body.length },
    summary: summarizeOpportunityPreview(candidates),
    candidates,
    safety: { callsAI: false, sendsEmail: false, insertsOpportunities: false, reviewRequired: true },
  };
}

export async function handleOpportunityDiscoveryAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, { status: 405 });

  const match = pathname.match(/^\/admin\/opportunities\/sources\/([^/]+)\/(test|preview)$/);
  if (!match) return json({ ok: false, error: "Not found" }, { status: 404 });
  const id = decodeURIComponent(match[1]);
  const action = match[2];
  const requestUrl = new URL(request.url);

  if (action === "test") return json(await testSource(env, id));
  if (action === "preview") return json(await previewSource(env, id, requestUrl));
  return json({ ok: false, error: "Not found" }, { status: 404 });
}
