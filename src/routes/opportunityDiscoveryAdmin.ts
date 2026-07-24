import { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import { extractOpportunityCandidates, summarizeOpportunityPreview } from "../core/opportunityDiscovery";
import { saveOpportunityCandidate } from "../core/opportunityPersistence";
import { fetchPublicResearchHtml, type PublicResearchFetchResult } from "../core/publicResearchFetch";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

async function tableExists(env: Env, tableName: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1").bind(tableName).first<any>();
  return Boolean(row?.name);
}

async function getSource(env: Env, id: string) {
  if (!(await tableExists(env, "opportunity_sources"))) return null;
  return await env.DB.prepare("SELECT * FROM opportunity_sources WHERE id = ? LIMIT 1").bind(id).first<any>();
}

function fetchReceipt(fetched: PublicResearchFetchResult) {
  return {
    contract: fetched.contract,
    requestedUrl: fetched.requestedUrl,
    finalUrl: fetched.finalUrl,
    status: fetched.status,
    contentType: fetched.contentType,
    elapsedMs: fetched.elapsedMs,
    bytes: fetched.bytes,
    bodySha256: fetched.bodySha256,
    redirectCount: fetched.redirectCount,
    fetchedAtISO: fetched.fetchedAtISO,
    timeoutScope: fetched.timeoutScope,
    error: fetched.error,
  };
}

function parseSourceAction(pathname: string): { id: string; action: string } | null {
  const prefix = "/admin/opportunities/sources/";
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length);
  const parts = rest.split("/").filter(Boolean);
  if (parts.length !== 2) return null;
  const action = parts[1];
  if (!["test", "preview", "commit-preview"].includes(action)) return null;
  return { id: decodeURIComponent(parts[0]), action };
}

function confirmed(body: any): boolean {
  return body?.confirm === true || body?.confirm === "true" || body?.confirm === 1 || body?.confirm === "1";
}

async function testSource(env: Env, id: string) {
  const source = await getSource(env, id);
  if (!source) return { ok: false, error: "source_not_found_or_missing_migration", requiredMigration: "0004_opportunity_intelligence.sql" };

  const now = new Date().toISOString();
  const fetched = await fetchPublicResearchHtml(source.url);
  const looksHtml = fetched.ok && (fetched.contentType.includes("html") || /<a\s/i.test(fetched.body.slice(0, 2500)));
  const candidateCount = looksHtml ? extractOpportunityCandidates(fetched.body, fetched.finalUrl || source.url, 25).length : 0;
  const nextRun = new Date(Date.now() + (looksHtml ? 24 : 6) * 60 * 60 * 1000).toISOString();
  const status = looksHtml ? "active" : "failed";
  const error = looksHtml ? null : fetched.error || "non_html_response";

  await env.DB.prepare(
    `UPDATE opportunity_sources
     SET status = ?, success_count = success_count + ?, failure_count = failure_count + ?, last_run_at_iso = ?, next_run_at_iso = ?, last_error = ?, updated_at_iso = ?
     WHERE id = ?`
  ).bind(status, status === "active" ? 1 : 0, status === "failed" ? 1 : 0, now, nextRun, error, now, id).run();

  return {
    ok: status === "active",
    mode: "opportunity_source_test",
    source: { id: source.id, url: source.url, label: source.label, status },
    fetch: fetchReceipt(fetched),
    candidateCount,
    error,
    safety: { callsAI: false, sendsEmail: false, insertsOpportunities: false, publicWebOnly: true, boundedResponse: true, fullOperationTimeout: true },
  };
}

async function previewSource(env: Env, id: string, requestUrl: URL) {
  const source = await getSource(env, id);
  if (!source) return { ok: false, error: "source_not_found_or_missing_migration", requiredMigration: "0004_opportunity_intelligence.sql" };

  const limit = Math.max(1, Math.min(100, Number(requestUrl.searchParams.get("limit") || 50)));
  const fetched = await fetchPublicResearchHtml(source.url);
  if (!fetched.ok) {
    return {
      ok: false,
      mode: "opportunity_source_preview",
      error: fetched.error || "source_fetch_failed",
      fetch: fetchReceipt(fetched),
      safety: { callsAI: false, sendsEmail: false, insertsOpportunities: false, publicWebOnly: true, boundedResponse: true, fullOperationTimeout: true },
    };
  }

  const candidates = extractOpportunityCandidates(fetched.body, fetched.finalUrl || source.url, limit);
  return {
    ok: true,
    mode: "opportunity_source_preview",
    source: { id: source.id, url: source.url, label: source.label, sourceType: source.source_type },
    fetch: fetchReceipt(fetched),
    summary: summarizeOpportunityPreview(candidates),
    candidates,
    safety: { callsAI: false, sendsEmail: false, insertsOpportunities: false, reviewRequired: true, publicWebOnly: true, boundedResponse: true, fullOperationTimeout: true },
  };
}

async function commitPreview(env: Env, id: string, body: any) {
  const source = await getSource(env, id);
  if (!source || !(await tableExists(env, "opportunities"))) {
    return { ok: false, error: "source_or_opportunities_table_missing", requiredMigration: "0004_opportunity_intelligence.sql" };
  }

  const minScore = Math.max(1, Math.min(100, Number(body?.minScore || 45)));
  const limit = Math.max(1, Math.min(100, Number(body?.limit || 50)));
  const now = new Date().toISOString();
  const fetched = await fetchPublicResearchHtml(source.url);
  const sourceFetch = fetchReceipt(fetched);
  if (!fetched.ok) {
    return { ok: false, mode: "opportunity_commit_preview", error: fetched.error || "source_fetch_failed", inserted: 0, fetch: sourceFetch };
  }

  const candidates = extractOpportunityCandidates(fetched.body, fetched.finalUrl || source.url, limit);
  const inserted: any[] = [];
  const skipped: any[] = [];

  for (const candidate of candidates) {
    const candidateWithReceipt = {
      ...candidate,
      evidence: {
        ...(candidate.evidence || {}),
        sourceFetch,
      },
    };
    const result = await saveOpportunityCandidate(env, source, candidateWithReceipt, {
      minScore,
      discoveredBy: "commit-preview",
      nowISO: now,
    });

    if (result.saved) {
      inserted.push({ id: result.id, url: result.normalizedUrl, title: result.normalizedTitle, score: result.score, opportunityType: result.opportunityType, confidence: result.confidence });
    } else {
      skipped.push({ url: result.normalizedUrl || candidate.url, title: result.normalizedTitle || candidate.title, score: result.score ?? candidate.score, opportunityType: result.opportunityType || candidate.opportunityType, reason: result.reason, existingId: result.existingId });
    }
  }

  return {
    ok: true,
    mode: "opportunity_commit_preview",
    source: { id: source.id, url: source.url, label: source.label },
    fetch: sourceFetch,
    minScore,
    considered: candidates.length,
    insertedCount: inserted.length,
    skippedCount: skipped.length,
    inserted,
    skipped,
    safety: { callsAI: false, sendsEmail: false, postsSocial: false, autoApplies: false, reviewRequired: true, publicWebOnly: true, boundedResponse: true, fullOperationTimeout: true },
  };
}

export async function handleOpportunityDiscoveryAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } });
  }
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } });

  const parsed = parseSourceAction(pathname);
  if (!parsed) return json({ ok: false, error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  if (!confirmed(body)) {
    return json({
      ok: false,
      error: "confirm_required",
      reason: "Opportunity source tests, previews and preview commits require explicit confirmation before bounded public-network access or internal state changes.",
    }, { status: 400 });
  }

  const requestUrl = new URL(request.url);
  if (parsed.action === "test") return json(await testSource(env, parsed.id));
  if (parsed.action === "preview") return json(await previewSource(env, parsed.id, requestUrl));
  if (parsed.action === "commit-preview") return json(await commitPreview(env, parsed.id, body));
  return json({ ok: false, error: "Not found" }, { status: 404 });
}
