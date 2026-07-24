import { Env, getSetting, logEvent, nowISO, uuid } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import { boundedJsonFailurePayload, isExplicitJsonConfirmation, readBoundedJsonObject } from "../core/boundedJsonRequest";
import { acquireManualResearchLease, manualResearchLeaseConflict, releaseManualResearchLease } from "../core/manualResearchLease";
import { fetchPublicResearchHtml } from "../core/publicResearchFetch";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

async function numberSetting(env: Env, key: string, fallback: number): Promise<number> {
  const raw = await getSetting(env, key);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function countProfileHints(html: string): number {
  const matches = html.match(/\/business\/|\/connect\/|yellowpages\.com\.au\/|profile|contractor|builder|company/gi);
  return matches ? matches.length : 0;
}

function countLinks(html: string): number {
  const matches = html.match(/href=[\"']/gi);
  return matches ? matches.length : 0;
}

function isFutureIso(value: unknown): boolean {
  if (!value) return false;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) && ms > Date.now();
}

async function applyFailurePolicy(env: Env, sourceId: string, failedReason: string | null) {
  const failureThreshold = await numberSetting(env, "source_failure_cooldown_threshold", 3);
  const retireThreshold = await numberSetting(env, "source_failure_retire_threshold", 8);
  const cooldownHours = await numberSetting(env, "source_cooldown_hours", 72);
  const now = nowISO();
  const row = await env.DB.prepare("SELECT failure_count FROM sources WHERE id = ? LIMIT 1").bind(sourceId).first<{ failure_count: number }>();
  const failures = Number(row?.failure_count || 0);

  if (retireThreshold > 0 && failures >= retireThreshold) {
    await env.DB.prepare("UPDATE sources SET status = 'needs_review', retired_reason = ?, next_run_at_iso = NULL, updated_at_iso = ? WHERE id = ?")
      .bind(failedReason || "repeated_source_failure", now, sourceId)
      .run();
    await logEvent(env, "source_auto_review", `Source ${sourceId} moved to needs_review after ${failures} failures.`);
    return { action: "needs_review", failureCount: failures };
  }

  if (failureThreshold > 0 && failures >= failureThreshold) {
    const cooldownUntil = new Date(Date.now() + Math.max(1, cooldownHours) * 60 * 60 * 1000).toISOString();
    await env.DB.prepare("UPDATE sources SET status = 'cooldown', cooldown_until_iso = ?, next_run_at_iso = ?, retired_reason = ?, updated_at_iso = ? WHERE id = ?")
      .bind(cooldownUntil, cooldownUntil, failedReason || "repeated_source_failure", now, sourceId)
      .run();
    await logEvent(env, "source_auto_cooldown", `Source ${sourceId} cooled down after ${failures} failures.`);
    return { action: "cooldown", failureCount: failures, cooldownUntil };
  }

  return { action: "tracked_failure", failureCount: failures };
}

async function runOneSource(env: Env, source: any) {
  const sourceRunId = uuid();
  const started = nowISO();
  const result = await fetchPublicResearchHtml(String(source.url));
  const completed = nowISO();
  const profilesFound = result.ok ? countProfileHints(result.body) : 0;
  const hrefCount = result.ok ? countLinks(result.body) : 0;
  const status = result.ok ? "ok" : "failed";
  const failedReason = result.ok ? null : result.error || "research_fetch_failed";
  const runInsert = env.DB.prepare(
    "INSERT INTO source_runs (id, source_id, status, started_at_iso, completed_at_iso, profiles_found, external_sites_found, leads_inserted, duplicates_skipped, failed_reason, created_at_iso) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)"
  ).bind(sourceRunId, source.id, status, started, completed, profilesFound, failedReason, completed);

  let policy: any;
  if (result.ok) {
    const nextRunAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const sourceUpdate = env.DB.prepare("UPDATE sources SET status = 'active', success_count = success_count + 1, last_run_at_iso = ?, next_run_at_iso = ?, updated_at_iso = ?, retired_reason = NULL WHERE id = ?")
      .bind(completed, nextRunAt, completed, source.id);
    await env.DB.batch([runInsert, sourceUpdate]);
    policy = { action: "active", nextRunAt };
  } else {
    const retryAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    const sourceUpdate = env.DB.prepare("UPDATE sources SET failure_count = failure_count + 1, last_run_at_iso = ?, next_run_at_iso = ?, updated_at_iso = ? WHERE id = ?")
      .bind(completed, retryAt, completed, source.id);
    await env.DB.batch([runInsert, sourceUpdate]);
    policy = await applyFailurePolicy(env, source.id, failedReason);
  }

  return {
    sourceRunId,
    sourceId: source.id,
    url: source.url,
    status,
    fetch: {
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
    },
    hrefCount,
    profileHintCount: profilesFound,
    policy,
  };
}

export async function handleSourceBatchAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } });
  }

  if (pathname === "/admin/sources/run-tiny" && request.method === "POST") {
    const parsed = await readBoundedJsonObject(request);
    if (!parsed.ok) return json(boundedJsonFailurePayload(parsed), { status: parsed.status });
    if (!isExplicitJsonConfirmation(parsed.value)) {
      return json({
        ok: false,
        error: "confirm_required",
        requiredPayload: { confirm: true },
        confirmationCoercionAllowed: false,
        requestBodyContract: parsed.contract,
      }, { status: 400 });
    }

    const requestReceipt = {
      contract: parsed.contract,
      bytes: parsed.bytes,
      bodySha256: parsed.bodySha256,
    };
    const actionKey = "sources-run-tiny";
    const lease = await acquireManualResearchLease(env, actionKey, 600);
    if (!lease) return json({ ...manualResearchLeaseConflict(actionKey), requestReceipt }, { status: 409 });

    try {
      const perTickLimit = Math.max(1, Math.min(10, await numberSetting(env, "per_tick_source_page_limit", 2)));
      const requestedLimit = boundedInteger(parsed.value.limit, 1, 1, 10);
      const limit = Math.min(perTickLimit, requestedLimit, 3);

      const candidateRows = await env.DB.prepare(
        "SELECT * FROM sources WHERE status IN ('active', 'cooldown') ORDER BY COALESCE(next_run_at_iso, created_at_iso), updated_at_iso LIMIT 25"
      ).all<any>();

      const candidates = candidateRows.results || [];
      const skipped: Array<{ sourceId: string; url: string; reason: string }> = [];
      const runnable = [];

      for (const source of candidates) {
        if (runnable.length >= limit) break;
        if (String(source.status) === "cooldown" && isFutureIso(source.cooldown_until_iso)) {
          skipped.push({ sourceId: source.id, url: source.url, reason: "cooldown_until_future" });
          continue;
        }
        if (source.next_run_at_iso && isFutureIso(source.next_run_at_iso)) {
          skipped.push({ sourceId: source.id, url: source.url, reason: "next_run_in_future" });
          continue;
        }
        runnable.push(source);
      }

      const results = [];
      for (const source of runnable) {
        const sourceActionKey = `legacy-source:${source.id}`;
        const sourceLease = await acquireManualResearchLease(env, sourceActionKey, 600);
        if (!sourceLease) {
          skipped.push({ sourceId: source.id, url: source.url, reason: "source_action_in_progress" });
          continue;
        }
        try {
          results.push(await runOneSource(env, source));
        } finally {
          await releaseManualResearchLease(env, sourceLease).catch(() => false);
        }
      }

      const failed = results.filter((result) => result.status === "failed").length;
      const successful = results.length - failed;
      const runStatus = results.length === 0 ? "skipped" : failed === results.length ? "failed" : failed > 0 ? "partial" : "completed";
      const error = runStatus === "failed" ? "all_source_fetches_failed" : runStatus === "partial" ? `partial_source_failures:${failed}` : null;
      await logEvent(env, "source_run_tiny", `Confirmed tiny source batch ${runStatus} over ${results.length} source(s), successful ${successful}, failed ${failed}, skipped ${skipped.length}.`);
      return json({
        ok: runStatus !== "failed",
        mode: "tiny_source_batch",
        runStatus,
        error,
        fetchContract: "public_research_fetch_v2",
        leaseContract: lease.contract,
        requestReceipt,
        requested: requestedLimit,
        perTickLimit,
        effectiveLimit: limit,
        considered: candidates.length,
        processed: results.length,
        successful,
        failed,
        skipped,
        results,
        safety: { callsNetwork: true, publicWebOnly: true, boundedResponse: true, fullOperationTimeout: true, callsAI: false, sendsEmail: false, externalStateChange: false, concurrentDuplicateRunAllowed: false, overlappingPerSourceActionAllowed: false, auditAndSourceUpdateAtomic: true },
      });
    } finally {
      await releaseManualResearchLease(env, lease).catch(() => false);
    }
  }

  return json({ ok: false, error: "Not found" }, { status: 404 });
}
