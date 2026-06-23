import { Env, getAdminToken, getSetting, logEvent, nowISO, uuid } from "../db";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

async function numberSetting(env: Env, key: string, fallback: number): Promise<number> {
  const raw = await getSetting(env, key);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function fetchHtml(url: string): Promise<{ ok: boolean; html: string; status: number; contentType: string }> {
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; EVAVO-Outbound-Agent/1.0; +https://evavo.com.au)",
        "accept-language": "en-AU,en;q=0.9",
      },
      redirect: "follow",
    });
    const contentType = String(res.headers.get("content-type") || "").toLowerCase();
    if (!res.ok || (contentType && !/text\/html|application\/xhtml\+xml/.test(contentType))) {
      return { ok: false, html: "", status: res.status, contentType };
    }
    const html = await res.text();
    return { ok: Boolean(html.trim()), html, status: res.status, contentType };
  } catch {
    return { ok: false, html: "", status: 0, contentType: "" };
  }
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
  const started = nowISO();
  const result = await fetchHtml(String(source.url));
  const completed = nowISO();
  const profilesFound = result.ok ? countProfileHints(result.html) : 0;
  const hrefCount = result.ok ? countLinks(result.html) : 0;
  const status = result.ok ? "ok" : "failed";
  const failedReason = result.ok ? null : `status_${result.status || "fetch_failed"}`;

  await env.DB.prepare(
    "INSERT INTO source_runs (id, source_id, status, started_at_iso, completed_at_iso, profiles_found, external_sites_found, leads_inserted, duplicates_skipped, failed_reason, created_at_iso) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)"
  ).bind(uuid(), source.id, status, started, completed, profilesFound, failedReason, completed).run();

  let policy: any = { action: "active" };
  if (result.ok) {
    const nextRunAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare("UPDATE sources SET status = 'active', success_count = success_count + 1, last_run_at_iso = ?, next_run_at_iso = ?, updated_at_iso = ?, retired_reason = NULL WHERE id = ?")
      .bind(completed, nextRunAt, completed, source.id)
      .run();
    policy = { action: "active", nextRunAt };
  } else {
    const retryAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare("UPDATE sources SET failure_count = failure_count + 1, last_run_at_iso = ?, next_run_at_iso = ?, updated_at_iso = ? WHERE id = ?")
      .bind(completed, retryAt, completed, source.id)
      .run();
    policy = await applyFailurePolicy(env, source.id, failedReason);
  }

  return {
    sourceId: source.id,
    url: source.url,
    status,
    httpStatus: result.status,
    contentType: result.contentType,
    hrefCount,
    profileHintCount: profilesFound,
    htmlBytes: result.html.length,
    policy,
  };
}

export async function handleSourceBatchAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  if (pathname === "/admin/sources/run-tiny" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (body?.confirm !== true && body?.confirm !== 1 && body?.confirm !== "1") {
      return json({ ok: false, error: "confirm_required" }, { status: 400 });
    }

    const perTickLimit = Math.max(1, Math.min(10, await numberSetting(env, "per_tick_source_page_limit", 2)));
    const requestedLimit = Math.max(1, Math.min(10, Number(body?.limit || 1)));
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
    for (const source of runnable) results.push(await runOneSource(env, source));

    await logEvent(env, "source_run_tiny", `Ran tiny source batch over ${results.length} source(s), skipped ${skipped.length}.`);
    return json({
      ok: true,
      mode: "tiny_source_batch",
      requested: requestedLimit,
      perTickLimit,
      effectiveLimit: limit,
      considered: candidates.length,
      processed: results.length,
      skipped,
      results,
    });
  }

  return json({ ok: false, error: "Not found" }, { status: 404 });
}
