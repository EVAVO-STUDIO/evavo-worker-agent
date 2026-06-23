import { Env, getAdminToken, logEvent, nowISO, uuid } from "../db";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
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

  if (result.ok) {
    await env.DB.prepare("UPDATE sources SET status = 'active', success_count = success_count + 1, last_run_at_iso = ?, updated_at_iso = ?, retired_reason = NULL WHERE id = ?")
      .bind(completed, completed, source.id)
      .run();
  } else {
    await env.DB.prepare("UPDATE sources SET failure_count = failure_count + 1, last_run_at_iso = ?, updated_at_iso = ? WHERE id = ?")
      .bind(completed, completed, source.id)
      .run();
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

    const limit = Math.max(1, Math.min(3, Number(body?.limit || 1)));
    const rows = await env.DB.prepare(
      "SELECT * FROM sources WHERE status = 'active' ORDER BY COALESCE(next_run_at_iso, created_at_iso), updated_at_iso LIMIT ?"
    ).bind(limit).all<any>();

    const sources = rows.results || [];
    const results = [];
    for (const source of sources) results.push(await runOneSource(env, source));

    await logEvent(env, "source_run_tiny", `Ran tiny source batch over ${results.length} source(s).`);
    return json({ ok: true, mode: "tiny_source_batch", requested: limit, processed: results.length, results });
  }

  return json({ ok: false, error: "Not found" }, { status: 404 });
}
