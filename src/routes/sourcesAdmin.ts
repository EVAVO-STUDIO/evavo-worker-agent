import { Env, getSetting, insertLead, logEvent, nowISO, uuid } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import { boundedJsonFailurePayload, isExplicitJsonConfirmation, readBoundedJsonObject } from "../core/boundedJsonRequest";
import { acquireManualResearchLease, manualResearchLeaseConflict, releaseManualResearchLease } from "../core/manualResearchLease";
import { fetchPublicResearchHtml, validatePublicResearchUrl, type PublicResearchFetchResult } from "../core/publicResearchFetch";

type JsonResponse = (data: any, init?: ResponseInit) => Response;
type JsonObject = Record<string, unknown>;
type RequestReceipt = { contract: string; bytes: number; bodySha256: string };
type ConfirmedBodyResult =
  | { ok: true; body: JsonObject; requestReceipt: RequestReceipt }
  | { ok: false; response: Response };

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function boundedText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : fallback;
}

function boundedOptionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function countryFromUrl(url: string): string {
  const lower = url.toLowerCase();
  return lower.includes(".nz") ? "NZ" : "AU";
}

function normalizeCountry(value: unknown, fallback: string): string {
  const normalized = boundedText(value, fallback, 8).toUpperCase();
  return /^[A-Z]{2,3}$/.test(normalized) ? normalized : fallback;
}

function normalizeSourceUrl(raw: unknown, baseUrl?: string): string {
  const decision = validatePublicResearchUrl(raw, baseUrl);
  return decision.ok && decision.url ? decision.url.replace(/\/+$/, "") : "";
}

function absoluteUrl(href: string, baseUrl: string): string | null {
  const normalized = normalizeSourceUrl(href, baseUrl);
  return normalized || null;
}

function getDomain(raw: string): string {
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return String(raw || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
  }
}

function isNoiseExternal(url: string): boolean {
  const lower = url.toLowerCase();
  return /facebook\.com|instagram\.com|linkedin\.com|x\.com|twitter\.com|youtube\.com|tiktok\.com|pinterest\.com/.test(lower) ||
    /\.(jpg|jpeg|png|gif|svg|webp|css|js|pdf|zip|ico|woff2?|ttf)(\?|$)/i.test(lower) ||
    /mailto:|tel:|javascript:/i.test(lower);
}

function isMarketplaceDomain(domain: string): boolean {
  return domain === "hipages.com.au" || domain.endsWith(".hipages.com.au") ||
    domain === "truelocal.com.au" || domain.endsWith(".truelocal.com.au") ||
    domain === "yellowpages.com.au" || domain.endsWith(".yellowpages.com.au") ||
    domain === "yellow.co.nz" || domain.endsWith(".yellow.co.nz");
}

function extractHrefLinks(html: string, baseUrl: string): string[] {
  const out: string[] = [];
  const regex = /href=["']([^"'#]+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null && out.length < 2_000) {
    const next = absoluteUrl(match[1], baseUrl);
    if (next) out.push(next);
  }
  return Array.from(new Set(out));
}

function sourceProfileScore(url: string): number {
  const lower = url.toLowerCase();
  let score = 0;
  if (/truelocal\.com\.au\/business\//i.test(lower)) score += 80;
  if (/hipages\.com\.au\/connect\//i.test(lower)) score += 80;
  if (/yellowpages\.com\.au\/[^/]+\/[^/]+-\d+/i.test(lower) && !/\/find\//i.test(lower)) score += 80;
  if (/business|connect|profile|company|contractor|builder|agency|service/i.test(lower)) score += 20;
  if (/login|signup|privacy|terms|articles|blog|category|search|find\//i.test(lower)) score -= 40;
  if (/\.(jpg|jpeg|png|gif|svg|webp|css|js|pdf|zip)(\?|$)/i.test(lower)) score -= 100;
  return score;
}

function pickCandidateLinks(html: string, baseUrl: string, limit: number) {
  return extractHrefLinks(html, baseUrl)
    .map((url) => ({ url, score: sourceProfileScore(url) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))
    .slice(0, Math.max(1, Math.min(100, limit)));
}

function extractExternalWebsite(profileUrl: string, html: string): string | null {
  const profileDomain = getDomain(profileUrl);
  const links = extractHrefLinks(html, profileUrl);
  for (const link of links) {
    const domain = getDomain(link);
    if (!domain || domain === profileDomain || isMarketplaceDomain(domain) || isNoiseExternal(link)) continue;
    return link;
  }
  const textMatches = Array.from(html.matchAll(/https?:\/\/[^\s"'<>]+/gi)).map((match) => match[0]).slice(0, 500);
  for (const raw of textMatches) {
    const normalized = normalizeSourceUrl(raw);
    const domain = getDomain(normalized);
    if (!normalized || !domain || domain === profileDomain || isMarketplaceDomain(domain) || isNoiseExternal(normalized)) continue;
    return normalized;
  }
  return null;
}

function fetchReceipt(result: PublicResearchFetchResult) {
  return {
    contract: result.contract,
    requestedUrl: result.requestedUrl,
    finalUrl: result.finalUrl,
    status: result.status,
    contentType: result.contentType,
    contentLength: result.contentLength,
    redirectCount: result.redirectCount,
    redirectChain: result.redirectChain,
    etag: result.etag,
    lastModified: result.lastModified,
    contentLanguage: result.contentLanguage,
    bytes: result.bytes,
    bodySha256: result.bodySha256,
    elapsedMs: result.elapsedMs,
    fetchedAtISO: result.fetchedAtISO,
    timeoutScope: result.timeoutScope,
    error: result.error,
  };
}

async function getNumberSetting(env: Env, key: string, fallback: number): Promise<number> {
  const raw = await getSetting(env, key);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function confirmedBody(request: Request, json: JsonResponse): Promise<ConfirmedBodyResult> {
  const parsed = await readBoundedJsonObject(request);
  if (!parsed.ok) return { ok: false, response: json(boundedJsonFailurePayload(parsed), { status: parsed.status }) };
  if (!isExplicitJsonConfirmation(parsed.value)) {
    return {
      ok: false,
      response: json({
        ok: false,
        error: "confirm_required",
        requiredPayload: { confirm: true },
        confirmationCoercionAllowed: false,
        requestBodyContract: parsed.contract,
      }, { status: 400 }),
    };
  }
  return {
    ok: true,
    body: parsed.value,
    requestReceipt: {
      contract: parsed.contract,
      bytes: parsed.bytes,
      bodySha256: parsed.bodySha256,
    },
  };
}

function decodeSourceId(raw: string): string | null {
  try {
    const value = decodeURIComponent(raw).trim();
    return value && value.length <= 160 ? value : null;
  } catch {
    return null;
  }
}

async function withSourceLease(
  env: Env,
  json: JsonResponse,
  sourceId: string,
  requestReceipt: RequestReceipt,
  run: () => Promise<Response>,
): Promise<Response> {
  const actionKey = `legacy-source:${sourceId}`;
  const lease = await acquireManualResearchLease(env, actionKey, 600);
  if (!lease) return json({ ...manualResearchLeaseConflict(actionKey), requestReceipt }, { status: 409 });
  try {
    return await run();
  } finally {
    await releaseManualResearchLease(env, lease).catch(() => false);
  }
}

async function insertSource(env: Env, body: JsonObject, rawUrl: unknown) {
  const decision = validatePublicResearchUrl(rawUrl);
  if (!decision.ok || !decision.url) {
    return { ok: false, error: decision.error || "invalid_research_url", inputRedacted: true };
  }
  const sourceUrl = decision.url.replace(/\/+$/, "");
  const id = uuid();
  const now = nowISO();
  const fallbackCountry = countryFromUrl(sourceUrl);
  const result = await env.DB.prepare(
    "INSERT OR IGNORE INTO sources (id, url, source_type, label, country, region, category, status, quality_score, failure_count, success_count, created_at_iso, updated_at_iso) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 50, 0, 0, ?, ?)"
  ).bind(
    id,
    sourceUrl,
    boundedText(body.sourceType ?? body.type, "manual_seed", 80),
    boundedOptionalText(body.label, 160),
    normalizeCountry(body.country, fallbackCountry),
    boundedOptionalText(body.region, 80),
    boundedText(body.category, "general", 80),
    now,
    now,
  ).run();
  const inserted = Number(result.meta?.changes || 0) > 0;
  if (inserted) return { ok: true, id, url: sourceUrl, inserted: true };
  const existing = await env.DB.prepare("SELECT id FROM sources WHERE url = ? LIMIT 1").bind(sourceUrl).first<{ id: string }>();
  return { ok: true, id: existing?.id || null, url: sourceUrl, inserted: false };
}

async function applyFailurePolicy(env: Env, sourceId: string, completed: string, failedReason: string | null) {
  const failureThreshold = await getNumberSetting(env, "source_failure_cooldown_threshold", 3);
  const retireThreshold = await getNumberSetting(env, "source_failure_retire_threshold", 8);
  const cooldownHours = await getNumberSetting(env, "source_cooldown_hours", 72);
  const row = await env.DB.prepare("SELECT failure_count FROM sources WHERE id = ? LIMIT 1").bind(sourceId).first<{ failure_count: number }>();
  const failures = Number(row?.failure_count || 0);
  if (retireThreshold > 0 && failures >= retireThreshold) {
    await env.DB.prepare("UPDATE sources SET status = 'needs_review', retired_reason = ?, updated_at_iso = ? WHERE id = ?").bind(failedReason || "repeated_source_failure", completed, sourceId).run();
    await logEvent(env, "source_auto_review", `Source ${sourceId} moved to needs_review after ${failures} failures.`);
    return { sourceAction: "needs_review", failureCount: failures };
  }
  if (failureThreshold > 0 && failures >= failureThreshold) {
    const until = new Date(Date.now() + Math.max(1, cooldownHours) * 60 * 60 * 1000).toISOString();
    await env.DB.prepare("UPDATE sources SET status = 'cooldown', cooldown_until_iso = ?, retired_reason = ?, updated_at_iso = ? WHERE id = ?").bind(until, failedReason || "repeated_source_failure", completed, sourceId).run();
    await logEvent(env, "source_auto_cooldown", `Source ${sourceId} cooled down after ${failures} failures.`);
    return { sourceAction: "cooldown", failureCount: failures, cooldownUntil: until };
  }
  return { sourceAction: "tracked_failure", failureCount: failures };
}

async function testSource(env: Env, sourceId: string) {
  const source = await env.DB.prepare("SELECT * FROM sources WHERE id = ? LIMIT 1").bind(sourceId).first<any>();
  if (!source) return { ok: false, error: "source_not_found" };
  const sourceRunId = uuid();
  const started = nowISO();
  const result = await fetchPublicResearchHtml(String(source.url));
  const completed = nowISO();
  const hrefCount = result.ok ? (result.body.match(/href=[\"']/gi) || []).length : 0;
  const profileHintCount = result.ok ? (result.body.match(/\/business\/|\/connect\/|yellowpages\.com\.au\//gi) || []).length : 0;
  const status = result.ok ? "ok" : "failed";
  const failedReason = result.ok ? null : result.error || "research_fetch_failed";
  const runInsert = env.DB.prepare("INSERT INTO source_runs (id, source_id, status, started_at_iso, completed_at_iso, profiles_found, external_sites_found, leads_inserted, duplicates_skipped, failed_reason, created_at_iso) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)")
    .bind(sourceRunId, sourceId, status, started, completed, profileHintCount, failedReason, completed);
  let sourcePolicy: any;
  if (result.ok) {
    const sourceUpdate = env.DB.prepare("UPDATE sources SET status = 'active', success_count = success_count + 1, last_run_at_iso = ?, updated_at_iso = ?, retired_reason = NULL WHERE id = ?")
      .bind(completed, completed, sourceId);
    await env.DB.batch([runInsert, sourceUpdate]);
    sourcePolicy = { sourceAction: "active" };
  } else {
    const sourceUpdate = env.DB.prepare("UPDATE sources SET failure_count = failure_count + 1, last_run_at_iso = ?, updated_at_iso = ? WHERE id = ?")
      .bind(completed, completed, sourceId);
    await env.DB.batch([runInsert, sourceUpdate]);
    sourcePolicy = await applyFailurePolicy(env, sourceId, completed, failedReason);
  }
  await logEvent(env, result.ok ? "source_test_ok" : "source_test_fail", `Source ${sourceId} test ${status}: ${source.url}`);
  return { ok: result.ok, sourceRunId, sourceId, sourceUrl: source.url, status, fetch: fetchReceipt(result), hrefCount, profileHintCount, sourcePolicy, auditAndSourceUpdateAtomic: true };
}

async function loadActiveSource(env: Env, sourceId: string) {
  const source = await env.DB.prepare("SELECT * FROM sources WHERE id = ? LIMIT 1").bind(sourceId).first<any>();
  if (!source) return { source: null, error: "source_not_found" };
  if (["cooldown", "retired", "blocked", "needs_review"].includes(String(source.status))) return { source, error: "source_not_active" };
  return { source, error: null };
}

async function expandPreview(env: Env, sourceId: string, limit: number) {
  const loaded = await loadActiveSource(env, sourceId);
  if (loaded.error) return { ok: false, error: loaded.error, sourceId, status: loaded.source?.status };
  const source = loaded.source;
  const result = await fetchPublicResearchHtml(String(source.url));
  if (!result.ok) return { ok: false, error: result.error || "source_fetch_failed", sourceId, fetch: fetchReceipt(result) };
  const candidates = pickCandidateLinks(result.body, result.finalUrl || String(source.url), limit);
  await logEvent(env, "source_expand_preview", `Previewed ${candidates.length} candidate links from source ${sourceId}`);
  return { ok: true, mode: "preview_only", sourceId, sourceUrl: source.url, fetch: fetchReceipt(result), candidateCount: candidates.length, candidates };
}

async function expandCommit(env: Env, sourceId: string, limit: number) {
  const loaded = await loadActiveSource(env, sourceId);
  if (loaded.error) return { ok: false, error: loaded.error, sourceId, status: loaded.source?.status };
  const source = loaded.source;
  const sourceRunId = uuid();
  const started = nowISO();
  const sourceResult = await fetchPublicResearchHtml(String(source.url));
  const completed = nowISO();
  if (!sourceResult.ok) {
    const failure = sourceResult.error || "research_fetch_failed";
    const runInsert = env.DB.prepare("INSERT INTO source_runs (id, source_id, status, started_at_iso, completed_at_iso, profiles_found, external_sites_found, leads_inserted, duplicates_skipped, failed_reason, created_at_iso) VALUES (?, ?, 'failed', ?, ?, 0, 0, 0, 0, ?, ?)")
      .bind(sourceRunId, sourceId, started, completed, failure, completed);
    const sourceUpdate = env.DB.prepare("UPDATE sources SET failure_count = failure_count + 1, last_run_at_iso = ?, updated_at_iso = ? WHERE id = ?")
      .bind(completed, completed, sourceId);
    await env.DB.batch([runInsert, sourceUpdate]);
    const policy = await applyFailurePolicy(env, sourceId, completed, failure);
    return { ok: false, error: failure, sourceRunId, sourceId, fetch: fetchReceipt(sourceResult), sourcePolicy: policy, auditAndSourceUpdateAtomic: true };
  }

  const sourceFetch = fetchReceipt(sourceResult);
  const candidates = pickCandidateLinks(sourceResult.body, sourceResult.finalUrl || String(source.url), limit);
  const existingRows = await env.DB.prepare("SELECT website_url FROM leads LIMIT 5000").all<any>();
  const existingDomains = new Set((existingRows.results || []).map((row: any) => getDomain(String(row.website_url || ""))).filter(Boolean));
  let profilesFetched = 0;
  let externalSitesFound = 0;
  let leadsInserted = 0;
  let duplicatesSkipped = 0;
  let profileFetchFailures = 0;
  const inserted: any[] = [];
  const profileFailures: Array<{ profileUrl: string; error: string }> = [];

  for (const candidate of candidates.slice(0, Math.max(1, Math.min(25, limit)))) {
    profilesFetched += 1;
    const profileResult = await fetchPublicResearchHtml(candidate.url);
    if (!profileResult.ok) {
      profileFetchFailures += 1;
      if (profileFailures.length < 10) profileFailures.push({ profileUrl: candidate.url, error: profileResult.error || "research_fetch_failed" });
      continue;
    }
    const profileUrl = profileResult.finalUrl || candidate.url;
    const external = extractExternalWebsite(profileUrl, profileResult.body);
    if (!external) continue;
    externalSitesFound += 1;
    const domain = getDomain(external);
    if (!domain || existingDomains.has(domain)) {
      duplicatesSkipped += 1;
      continue;
    }
    const profileReceipt = fetchReceipt(profileResult);
    const lead = await insertLead(env, {
      websiteUrl: external,
      discoverySource: `source:${sourceId}`,
      category: source.category || "general",
      country: source.country || countryFromUrl(external),
      region: source.region || null,
      signalsJson: JSON.stringify({
        discoveredFromSourceId: sourceId,
        discoveredFromSourceUrl: source.url,
        sourceRunId,
        sourceFetch,
        profileUrl,
        profileFetch: profileReceipt,
        sourceExpansion: true,
        reviewOnly: true,
        executable: false,
        deliverable: false,
        authoritativeForExecution: false,
        externalExecutionAllowed: false,
      }),
    });
    await env.DB.prepare("INSERT INTO lead_discoveries (id, lead_id, source_id, source_run_id, discovered_url, created_at_iso) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(uuid(), lead.id, sourceId, sourceRunId, profileUrl, nowISO()).run();
    existingDomains.add(domain);
    leadsInserted += 1;
    inserted.push({ leadId: lead.id, websiteUrl: external, profileUrl, profileFetch: profileReceipt, reviewOnly: true, executable: false });
  }

  const finished = nowISO();
  const runInsert = env.DB.prepare("INSERT INTO source_runs (id, source_id, status, started_at_iso, completed_at_iso, profiles_found, external_sites_found, leads_inserted, duplicates_skipped, failed_reason, created_at_iso) VALUES (?, ?, 'ok', ?, ?, ?, ?, ?, ?, NULL, ?)")
    .bind(sourceRunId, sourceId, started, finished, profilesFetched, externalSitesFound, leadsInserted, duplicatesSkipped, finished);
  const sourceUpdate = env.DB.prepare("UPDATE sources SET status = 'active', success_count = success_count + 1, last_run_at_iso = ?, updated_at_iso = ?, quality_score = MIN(100, quality_score + ?) WHERE id = ?")
    .bind(finished, finished, leadsInserted > 0 ? 2 : 0, sourceId);
  await env.DB.batch([runInsert, sourceUpdate]);
  await logEvent(env, "source_expand_commit", `Expanded source ${sourceId}: ${leadsInserted} internal review lead(s), ${duplicatesSkipped} duplicates, ${profileFetchFailures} profile fetch failure(s).`);
  return {
    ok: true,
    mode: "commit",
    sourceRunId,
    sourceId,
    sourceUrl: source.url,
    sourceFetch,
    candidatesSeen: candidates.length,
    profilesFetched,
    profileFetchFailures,
    profileFailures,
    externalSitesFound,
    leadsInserted,
    duplicatesSkipped,
    inserted,
    auditAndSourceUpdateAtomic: true,
    reviewOnly: true,
    executable: false,
    deliverable: false,
    authoritativeForExecution: false,
    externalExecutionAllowed: false,
  };
}

export async function handleSourcesAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET, POST" } });
  }

  if (pathname === "/admin/sources" && request.method === "GET") {
    const url = new URL(request.url);
    const limit = boundedInteger(url.searchParams.get("limit"), 100, 1, 500);
    const status = boundedOptionalText(url.searchParams.get("status"), 40);
    const rows = status
      ? await env.DB.prepare("SELECT * FROM sources WHERE status = ? ORDER BY updated_at_iso DESC LIMIT ?").bind(status, limit).all()
      : await env.DB.prepare("SELECT * FROM sources ORDER BY updated_at_iso DESC LIMIT ?").bind(limit).all();
    return json({ ok: true, sources: rows.results || [] });
  }

  if ((pathname === "/admin/sources" || pathname === "/admin/seeds") && request.method === "POST") {
    const confirmed = await confirmedBody(request, json);
    if (!confirmed.ok) return confirmed.response;
    const body = confirmed.body;
    const rawItems = Array.isArray(body.items)
      ? body.items
      : Array.isArray(body.urls)
        ? body.urls.map((url) => ({ url }))
        : [{ url: body.url }];
    const accepted = [];
    const rejected = [];
    for (const [index, rawItem] of rawItems.slice(0, 100).entries()) {
      const item = rawItem && typeof rawItem === "object" && !Array.isArray(rawItem) ? rawItem as JsonObject : { url: rawItem };
      const result = await insertSource(env, { ...body, ...item }, item.url ?? rawItem);
      if (result.ok) accepted.push(result);
      else rejected.push({ index, error: result.error, inputRedacted: true });
    }
    await logEvent(env, "source_add", `Accepted ${accepted.length} public source URL(s); rejected ${rejected.length}.`);
    return json({
      ok: rejected.length === 0,
      acceptedCount: accepted.length,
      rejectedCount: rejected.length,
      sources: accepted,
      rejected,
      fetchContract: "public_research_fetch_v2",
      requestReceipt: confirmed.requestReceipt,
    }, rejected.length && !accepted.length ? { status: 400 } : undefined);
  }

  const previewMatch = pathname.match(/^\/admin\/sources\/([^/]+)\/expand-preview$/);
  if (previewMatch && request.method === "POST") {
    const sourceId = decodeSourceId(previewMatch[1]);
    if (!sourceId) return json({ ok: false, error: "invalid_source_id" }, { status: 400 });
    const confirmed = await confirmedBody(request, json);
    if (!confirmed.ok) return confirmed.response;
    const limit = boundedInteger(confirmed.body.limit, 40, 1, 100);
    return withSourceLease(env, json, sourceId, confirmed.requestReceipt, async () => json({ ...(await expandPreview(env, sourceId, limit)), requestReceipt: confirmed.requestReceipt }));
  }

  const commitMatch = pathname.match(/^\/admin\/sources\/([^/]+)\/expand-commit$/);
  if (commitMatch && request.method === "POST") {
    const sourceId = decodeSourceId(commitMatch[1]);
    if (!sourceId) return json({ ok: false, error: "invalid_source_id" }, { status: 400 });
    const confirmed = await confirmedBody(request, json);
    if (!confirmed.ok) return confirmed.response;
    const limit = boundedInteger(confirmed.body.limit, 5, 1, 25);
    return withSourceLease(env, json, sourceId, confirmed.requestReceipt, async () => json({ ...(await expandCommit(env, sourceId, limit)), requestReceipt: confirmed.requestReceipt }));
  }

  const testMatch = pathname.match(/^\/admin\/sources\/([^/]+)\/test$/);
  if (testMatch && request.method === "POST") {
    const sourceId = decodeSourceId(testMatch[1]);
    if (!sourceId) return json({ ok: false, error: "invalid_source_id" }, { status: 400 });
    const confirmed = await confirmedBody(request, json);
    if (!confirmed.ok) return confirmed.response;
    return withSourceLease(env, json, sourceId, confirmed.requestReceipt, async () => json({ ...(await testSource(env, sourceId)), requestReceipt: confirmed.requestReceipt }));
  }

  const actionMatch = pathname.match(/^\/admin\/sources\/([^/]+)\/(cooldown|retire|activate)$/);
  if (actionMatch && request.method === "POST") {
    const sourceId = decodeSourceId(actionMatch[1]);
    if (!sourceId) return json({ ok: false, error: "invalid_source_id" }, { status: 400 });
    const confirmed = await confirmedBody(request, json);
    if (!confirmed.ok) return confirmed.response;
    return withSourceLease(env, json, sourceId, confirmed.requestReceipt, async () => {
      const action = actionMatch[2];
      const now = nowISO();
      if (action === "cooldown") {
        const hours = boundedInteger(confirmed.body.hours, 72, 1, 720);
        const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
        await env.DB.prepare("UPDATE sources SET status = 'cooldown', cooldown_until_iso = ?, retired_reason = ?, updated_at_iso = ? WHERE id = ?")
          .bind(until, boundedText(confirmed.body.reason, "manual_cooldown", 240), now, sourceId).run();
      } else if (action === "retire") {
        await env.DB.prepare("UPDATE sources SET status = 'retired', retired_reason = ?, updated_at_iso = ? WHERE id = ?")
          .bind(boundedText(confirmed.body.reason, "manual_retire", 240), now, sourceId).run();
      } else {
        await env.DB.prepare("UPDATE sources SET status = 'active', cooldown_until_iso = NULL, retired_reason = NULL, updated_at_iso = ? WHERE id = ?")
          .bind(now, sourceId).run();
      }
      await logEvent(env, "source_update", `Source ${sourceId} ${action}`);
      return json({ ok: true, id: sourceId, action, requestReceipt: confirmed.requestReceipt, leaseContract: "manual_research_lease_v1" });
    });
  }

  return json({ ok: false, error: "Not found" }, { status: 404 });
}
