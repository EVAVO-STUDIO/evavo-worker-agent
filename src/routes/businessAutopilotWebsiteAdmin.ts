import { Env, getAdminToken } from "../db";
import { businessAutopilotMetadataWriteSafety, businessAutopilotReadSafety } from "../core/businessAutopilotSafety";
import {
  businessWebsiteReadPayload,
  businessWebsiteWritePayload,
  listBusinessPages,
  listBusinessWebsites,
  saveBusinessPage,
  saveBusinessWebsite,
} from "../core/businessAutopilotWebsiteRecords";

export type JsonResponse = (data: any, init?: ResponseInit) => Response;

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

function intParam(url: URL, key: string, fallback: number, min: number, max: number): number {
  const value = Number(url.searchParams.get(key));
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

async function parseBody(request: Request): Promise<any> {
  return request.json().catch(() => ({}));
}

function confirmed(url: URL, body: any): boolean {
  return url.searchParams.get("confirm") === "1" || body?.confirm === true || body?.confirm === 1 || body?.confirm === "1";
}

function blockedWrite(json: JsonResponse) {
  return json({
    ok: false,
    error: "confirm_required",
    reason: "Business website/page writes require confirmation and only save internal metadata. They do not crawl, fetch, send, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems.",
    safety: businessAutopilotMetadataWriteSafety(),
  }, { status: 400 });
}

function migrationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const missingTable = /no such table: business_(websites|pages)/i.test(message);
  return {
    ok: false,
    mode: "business_website_error",
    error: missingTable ? "business_autopilot_schema_missing" : "business_website_failed",
    message,
    requiredMigration: missingTable ? "0021_business_autopilot_foundation.sql" : null,
    safety: businessAutopilotReadSafety(),
  };
}

export async function handleBusinessAutopilotWebsiteAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);

  try {
    if (request.method === "GET" && pathname === "/admin/business/websites") {
      const websites = await listBusinessWebsites(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      return json({ mode: "business_websites", ...businessWebsiteReadPayload(websites, "websites") });
    }

    if (request.method === "POST" && pathname === "/admin/business/websites") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const website = await saveBusinessWebsite(env, body.website || body);
      return json({ mode: "business_website_saved", ...businessWebsiteWritePayload(website, "website") });
    }

    if (request.method === "GET" && pathname === "/admin/business/pages") {
      const pages = await listBusinessPages(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("pageType") || undefined);
      return json({ mode: "business_pages", ...businessWebsiteReadPayload(pages, "pages") });
    }

    if (request.method === "POST" && pathname === "/admin/business/pages") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const page = await saveBusinessPage(env, body.page || body);
      return json({ mode: "business_page_saved", ...businessWebsiteWritePayload(page, "page") });
    }

    return json({ ok: false, error: "not_found", path: pathname, method: request.method }, { status: 404 });
  } catch (error) {
    const normalized = migrationError(error);
    return json(normalized, { status: 500 });
  }
}
