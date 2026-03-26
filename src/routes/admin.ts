import type { Env } from "../db";
import {
  listLeads,
  listDrafts,
  LeadRow,
  DraftRow,
  getSetting,
  setSetting,
  getTodayStats,
} from "../db";
import { dailyTick, runScanOnce } from "../engine";

/**
 * A minimal admin API exposing introspection and control over the engine. All
 * admin endpoints should be authenticated via upstream middleware (e.g.
 * Cloudflare Access) before reaching this handler. The endpoints return
 * structured JSON responses containing leads, drafts and engine state.
 */

export async function handleAdmin(
  req: Request,
  env: Env,
  _ctx: ExecutionContext,
  url: URL,
  json: (data: any, init?: ResponseInit) => Response
): Promise<Response> {
  const path = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "");

  // Overview: return high‑level stats and last run info
  if (req.method === "GET" && path === "admin/overview") {
    const stats = await getTodayStats(env);
    const lastRunRaw = (await getSetting(env, "last_engine_run")) || null;
    let lastRun: any = null;
    if (lastRunRaw) {
      try {
        lastRun = JSON.parse(lastRunRaw);
      } catch {
        lastRun = null;
      }
    }
    return json({ ok: true, stats, lastRun });
  }

  // List leads with optional status filter
  if (req.method === "GET" && path === "admin/leads") {
    const status = url.searchParams.get("status") || undefined;
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
    const leads = await listLeads(env, { status: status as any, limit });
    return json({ ok: true, leads });
  }

  // List drafts with optional status filter
  if (req.method === "GET" && path === "admin/drafts") {
    const status = url.searchParams.get("status") || undefined;
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
    const drafts = await listDrafts(env, { status: status as any, limit });
    return json({ ok: true, drafts });
  }

  // Trigger a manual engine cycle
  if (req.method === "POST" && path === "admin/run") {
    _ctx.waitUntil(dailyTick(env));
    return json({ ok: true, message: "Engine cycle scheduled" });
  }

  // Trigger a manual scan only
  if (req.method === "POST" && path === "admin/scan") {
    const result = await runScanOnce(env);
    return json({ ok: true, scanned: result.scanned });
  }

  return json({ ok: false, error: "not_found" }, { status: 404 });
}