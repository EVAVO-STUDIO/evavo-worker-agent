import { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import { businessAutopilotMetadataWriteSafety, businessAutopilotReadSafety } from "../core/businessAutopilotSafety";
import {
  businessPeopleReadPayload,
  businessPersonWritePayload,
  listBusinessPeople,
  saveBusinessPerson,
} from "../core/businessAutopilotPeopleRecords";

export type JsonResponse = (data: any, init?: ResponseInit) => Response;

const schemaMissingMessage = "Business people schema is missing or unavailable.";
const routeFailedMessage = "Business people route failed before a safe response could be returned.";

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

function minimiseBusinessPersonResponse<T extends Record<string, unknown>>(person: T) {
  const emailPresent = typeof person.email === "string" && person.email.trim().length > 0;
  const phonePresent = typeof person.phone === "string" && person.phone.trim().length > 0;
  const profileUrlPresent = typeof person.profileUrl === "string" && person.profileUrl.trim().length > 0;
  const sourceUrlPresent = typeof person.sourceUrl === "string" && person.sourceUrl.trim().length > 0;

  const {
    email: _email,
    phone: _phone,
    profileUrl: _profileUrl,
    sourceUrl: _sourceUrl,
    metadata: _metadata,
    ...businessContext
  } = person;

  return {
    ...businessContext,
    email: null,
    phone: null,
    profileUrl: null,
    sourceUrl: null,
    metadata: {},
    contactDetailsRedacted: true,
    metadataRedacted: true,
    emailPresent,
    phonePresent,
    profileUrlPresent,
    sourceUrlPresent,
    internalReviewOnly: true,
    executable: false,
    deliverable: false,
    authoritativeForExecution: false,
  };
}

function blockedWrite(json: JsonResponse) {
  return json({
    ok: false,
    error: "confirm_required",
    reason: "Business people writes require confirmation and only save internal metadata. They do not enrich contacts, scrape profiles, send email, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems.",
    safety: businessAutopilotMetadataWriteSafety(),
  }, { status: 400 });
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function migrationError(error: unknown) {
  const missingTable = /no such table: business_people/i.test(errorText(error));
  return {
    ok: false,
    mode: "business_people_error",
    error: missingTable ? "business_autopilot_schema_missing" : "business_people_failed",
    message: missingTable ? schemaMissingMessage : routeFailedMessage,
    requiredMigration: missingTable ? "0021_business_autopilot_foundation.sql" : null,
    safety: businessAutopilotReadSafety(),
  };
}

export async function handleBusinessAutopilotPeopleAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET, POST" } });
  }
  const url = new URL(request.url);

  try {
    if (request.method === "GET" && pathname === "/admin/business/people") {
      const people = await listBusinessPeople(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("contactStatus") || undefined);
      const redactedPeople = people.map(minimiseBusinessPersonResponse);
      return json({
        mode: "business_people",
        contactDetailsRedacted: true,
        metadataRedacted: true,
        internalReviewOnly: true,
        executable: false,
        deliverable: false,
        authoritativeForExecution: false,
        ...businessPeopleReadPayload(redactedPeople),
      });
    }

    if (request.method === "POST" && pathname === "/admin/business/people") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const person = await saveBusinessPerson(env, body.person || body);
      const redactedPerson = minimiseBusinessPersonResponse(person);
      return json({
        mode: "business_person_saved",
        contactDetailsRedacted: true,
        metadataRedacted: true,
        internalReviewOnly: true,
        executable: false,
        deliverable: false,
        authoritativeForExecution: false,
        ...businessPersonWritePayload(redactedPerson),
      });
    }

    return json({ ok: false, error: "not_found", path: pathname, method: request.method }, { status: 404 });
  } catch (error) {
    const normalized = migrationError(error);
    return json(normalized, { status: 500 });
  }
}
