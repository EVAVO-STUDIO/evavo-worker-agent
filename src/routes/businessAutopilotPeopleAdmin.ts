import { Env, getAdminToken } from "../db";
import { businessAutopilotMetadataWriteSafety, businessAutopilotReadSafety } from "../core/businessAutopilotSafety";
import {
  businessPeopleReadPayload,
  businessPersonWritePayload,
  listBusinessPeople,
  saveBusinessPerson,
} from "../core/businessAutopilotPeopleRecords";

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
    reason: "Business people writes require confirmation and only save internal metadata. They do not enrich contacts, scrape profiles, send email, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems.",
    safety: businessAutopilotMetadataWriteSafety(),
  }, { status: 400 });
}

function migrationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const missingTable = /no such table: business_people/i.test(message);
  return {
    ok: false,
    mode: "business_people_error",
    error: missingTable ? "business_autopilot_schema_missing" : "business_people_failed",
    message,
    requiredMigration: missingTable ? "0021_business_autopilot_foundation.sql" : null,
    safety: businessAutopilotReadSafety(),
  };
}

export async function handleBusinessAutopilotPeopleAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);

  try {
    if (request.method === "GET" && pathname === "/admin/business/people") {
      const people = await listBusinessPeople(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("contactStatus") || undefined);
      return json({ mode: "business_people", ...businessPeopleReadPayload(people) });
    }

    if (request.method === "POST" && pathname === "/admin/business/people") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const person = await saveBusinessPerson(env, body.person || body);
      return json({ mode: "business_person_saved", ...businessPersonWritePayload(person) });
    }

    return json({ ok: false, error: "not_found", path: pathname, method: request.method }, { status: 404 });
  } catch (error) {
    const normalized = migrationError(error);
    return json(normalized, { status: 500 });
  }
}
