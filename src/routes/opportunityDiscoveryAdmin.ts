import { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import { boundedJsonFailurePayload, isExplicitJsonConfirmation, readBoundedJsonObject } from "../core/boundedJsonRequest";
import { acquireManualResearchLease, manualResearchLeaseConflict, releaseManualResearchLease } from "../core/manualResearchLease";
import { extractOpportunityCandidates, summarizeOpportunityPreview } from "../core/opportunityDiscovery";
import { saveOpportunityCandidate } from "../core/opportunityPersistence";
import { fetchPublicResearchHtml, type PublicResearchFetchResult } from "../core/publicResearchFetch";

type JsonResponse = (data: any, init?: ResponseInit) => Response;
type SourceAction = "test" | "preview" | "commit-preview";
type RequestReceipt = { contract: string; bytes: number; bodySha256: string; sourceId: string; action: SourceAction };

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

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
    contentLength: fetched.contentLength,
    elapsedMs: fetched.elapsedMs,
    bytes: fetched.bytes,
    bodySha256: fetched.bodySha256,
    redirectCount: fetched.redirectCount,
    redirectChain: fetched.redirectChain,
    etag: fetched.etag,
    lastModified: fetched.lastModified,
    contentLanguage: fetched.contentLanguage,
    fetchedAtISO: fetched.fetchedAtISO,
    timeoutScope: fetched.timeoutScope,
    error: fetched.error,
  };
}

function parseSourceAction(pathname: string): { id: string; action: SourceAction } | null {
  const prefix = "/admin/opportunities/sources/";
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length);
  const parts = rest.split("/").filter(Boolean);
  if (parts.length !== 2) return null;
  if (parts[1] !== "test" && parts[1] !== "preview" && parts[1] !== "commit-preview") return null;
  try {
    const id = decodeURIComponent(parts[0]).trim();
    if (!id || id.length > 160) return null;
    return { id, action: parts[1] };
  } catch {
    return null;
  }
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

async function previewSource(env: Env, id: string, body: Record<string, unknown>) {
  const source = await getSource(env, id);
  if (!source) return { ok: false, error: "source_not_found_or_missing_migration", requiredMigration: "0004_opportunity_intelligence.sql" };

  const limit = boundedInteger(body.limit, 50, 1, 100);
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

async function commitPreview(env: Env, id: string, body: Record<string, unknown>) {
  const source = await getSource(env, id);
  if (!source || !(await tableExists(env, "opportunities"))) {
    return { ok: false, error: "source_or_opportunities_table_missing", requiredMigration: "0004_opportunity_intelligence.sql" };
  }

  const minScore = boundedInteger(body.minScore, 45, 1, 100);
  const limit = boundedInteger(body.limit, 50, 1, 100);
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
    if (!candidate.evidence) {
      skipped.push({
        url: candidate.url,
        title: candidate.title,
        score: candidate.score,
        opportunityType: candidate.opportunityType,
        reason: "missing_candidate_evidence",
      });
      continue;
    }
    const candidateWithReceipt = {
      ...candidate,
      evidence: {
        ...candidate.evidence,
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

async function withSourceLease(env: Env, json: JsonResponse, sourceId: string, requestReceipt: RequestReceipt, run: () => Promise<Response>): Promise<Response> {
  const actionKey = `opportunity-source:${sourceId}`;
  const lease = await acquireManualResearchLease(env, actionKey, 600);
  if (!lease) return json({ ...manualResearchLeaseConflict(actionKey), requestReceipt }, { status: 409 });
  try {
    return await run();
  } finally {
    await releaseManualResearchLease(env, lease).catch(() => false);
  }
}

export async function handleOpportunityDiscoveryAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } });
  }
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } });

  const sourceAction = parseSourceAction(pathname);
  if (!sourceAction) return json({ ok: false, error: "Not found" }, { status: 404 });

  const parsed = await readBoundedJsonObject(request);
  if (!parsed.ok) return json(boundedJsonFailurePayload(parsed), { status: parsed.status });
  if (!isExplicitJsonConfirmation(parsed.value)) {
    return json({
      ok: false,
      error: "confirm_required",
      requiredPayload: { confirm: true },
      confirmationCoercionAllowed: false,
      requestBodyContract: parsed.contract,
      reason: "Opportunity source tests, previews and preview commits require exact JSON confirmation before bounded public-network access or internal state changes.",
    }, { status: 400 });
  }

  const requestReceipt: RequestReceipt = {
    contract: parsed.contract,
    bytes: parsed.bytes,
    bodySha256: parsed.bodySha256,
    sourceId: sourceAction.id,
    action: sourceAction.action,
  };

  return withSourceLease(env, json, sourceAction.id, requestReceipt, async () => {
    let result: any;
    if (sourceAction.action === "test") result = await testSource(env, sourceAction.id);
    else if (sourceAction.action === "preview") result = await previewSource(env, sourceAction.id, parsed.value);
    else result = await commitPreview(env, sourceAction.id, parsed.value);
    return json({ ...result, requestReceipt });
  });
}
