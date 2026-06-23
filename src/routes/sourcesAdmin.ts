import { Env, getAdminToken, logEvent, nowISO, uuid } from "../db";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

function countryFromUrl(url: string): string {
  const lower = url.toLowerCase();
  return lower.includes(".nz") ? "NZ" : "AU";
}

export async function handleSourcesAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  if (pathname === "/admin/sources" && request.method === "GET") {
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 100)));
    const status = url.searchParams.get("status");
    const rows = status
      ? await env.DB.prepare("SELECT * FROM sources WHERE status = ? ORDER BY updated_at_iso DESC LIMIT ?").bind(status, limit).all()
      : await env.DB.prepare("SELECT * FROM sources ORDER BY updated_at_iso DESC LIMIT ?").bind(limit).all();
    return json({ ok: true, sources: rows.results || [] });
  }

  if (pathname === "/admin/sources" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const sourceUrl = String(body?.url || "").trim().replace(/\/+$/, "");
    if (!sourceUrl) return json({ ok: false, error: "url_required" }, { status: 400 });
    const id = uuid();
    const now = nowISO();
    await env.DB.prepare(
      "INSERT OR IGNORE INTO sources (id, url, source_type, label, country, region, category, status, quality_score, failure_count, success_count, created_at_iso, updated_at_iso) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 50, 0, 0, ?, ?)"
    ).bind(
      id,
      sourceUrl,
      String(body?.sourceType || "manual_seed"),
      body?.label ? String(body.label) : null,
      String(body?.country || countryFromUrl(sourceUrl)).toUpperCase(),
      body?.region ? String(body.region) : null,
      String(body?.category || "general"),
      now,
      now
    ).run();
    await logEvent(env, "source_add", `Added source ${sourceUrl}`);
    return json({ ok: true, source: { id, url: sourceUrl } });
  }

  const match = pathname.match(/^\/admin\/sources\/([^/]+)\/(cooldown|retire|activate)$/);
  if (match && request.method === "POST") {
    const id = match[1];
    const action = match[2];
    const body = await request.json().catch(() => ({}));
    const now = nowISO();
    if (action === "cooldown") {
      const hours = Math.max(1, Math.min(720, Number(body?.hours || 72)));
      const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      await env.DB.prepare("UPDATE sources SET status = 'cooldown', cooldown_until_iso = ?, retired_reason = ?, updated_at_iso = ? WHERE id = ?")
        .bind(until, body?.reason ? String(body.reason) : "manual_cooldown", now, id)
        .run();
    } else if (action === "retire") {
      await env.DB.prepare("UPDATE sources SET status = 'retired', retired_reason = ?, updated_at_iso = ? WHERE id = ?")
        .bind(body?.reason ? String(body.reason) : "manual_retire", now, id)
        .run();
    } else {
      await env.DB.prepare("UPDATE sources SET status = 'active', cooldown_until_iso = NULL, retired_reason = NULL, updated_at_iso = ? WHERE id = ?")
        .bind(now, id)
        .run();
    }
    await logEvent(env, "source_update", `Source ${id} ${action}`);
    return json({ ok: true, id, action });
  }

  return json({ ok: false, error: "Not found" }, { status: 404 });
}
