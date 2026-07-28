import type { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import {
  boundedJsonFailurePayload,
  isExplicitJsonConfirmation,
  readBoundedJsonObject,
} from "../core/boundedJsonRequest";
import {
  businessAutopilotMetadataWriteSafety,
  businessAutopilotReadSafety,
} from "../core/businessAutopilotSafety";
import {
  businessPeopleReadPayload,
  businessPersonWritePayload,
  listBusinessPeople,
  type BusinessPersonInput,
} from "../core/businessAutopilotPeopleRecords";
import { saveBusinessPerson } from "../core/businessScoreProvenanceWriters";
import { validatePublicResearchUrl } from "../core/publicResearchFetch";

export type JsonResponse = (data: unknown, init?: ResponseInit) => Response;

type JsonRecord = Record<string, unknown>;
type BusinessPersonWriteBody = JsonRecord & {
  confirm?: unknown;
  person?: unknown;
};

type ValidationFailure = Readonly<{
  ok: false;
  error: string;
  field?: string;
  fields?: readonly string[];
}>;
type ValidationSuccess<T> = Readonly<{ ok: true; value: T }>;

const ROUTE_PATH = "/admin/business/people";
const schemaMissingMessage = "Business people schema is missing or unavailable.";
const scoreProvenanceMissingMessage =
  "Business people score provenance schema is missing or unavailable.";
const routeFailedMessage =
  "Business people route failed before a safe response could be returned.";
const TOP_LEVEL_WRITE_KEYS = new Set(["confirm", "person"]);
const PERSON_WRITE_KEYS = new Set([
  "id",
  "organizationId",
  "name",
  "role",
  "email",
  "phone",
  "profileUrl",
  "sourceType",
  "sourceUrl",
  "allowedUse",
  "contactStatus",
  "confidenceScore",
  "metadata",
]);
const GET_QUERY_KEYS = new Set(["limit", "contactStatus"]);
const SENSITIVE_KEY_FRAGMENTS = Object.freeze([
  "token",
  "secret",
  "password",
  "apikey",
  "privatekey",
  "servicerole",
] as const);
const SENSITIVE_EXACT_KEYS = new Set(["authorization", "cookie"]);
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/;

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizedKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function containsSensitiveInputKey(value: unknown): boolean {
  const stack: unknown[] = [value];
  while (stack.length) {
    const current = stack.pop();
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    if (!isJsonRecord(current)) continue;
    for (const [key, child] of Object.entries(current)) {
      const normalized = normalizedKey(key);
      if (
        SENSITIVE_EXACT_KEYS.has(normalized) ||
        SENSITIVE_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment))
      ) {
        return true;
      }
      stack.push(child);
    }
  }
  return false;
}

function unexpectedKeys(record: JsonRecord, allowed: ReadonlySet<string>): string[] {
  return Object.keys(record).filter((key) => !allowed.has(key)).sort();
}

function validateOptionalText(
  value: unknown,
  field: string,
  maxLength: number,
): ValidationSuccess<string | null | undefined> | ValidationFailure {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: "invalid_text", field };
  const normalized = value.trim();
  if (!normalized) return { ok: true, value: null };
  if (normalized.length > maxLength || CONTROL_CHARACTER_PATTERN.test(normalized)) {
    return { ok: false, error: "invalid_text", field };
  }
  return { ok: true, value: normalized };
}

function validateRequiredName(value: unknown): ValidationSuccess<string> | ValidationFailure {
  if (typeof value !== "string") {
    return { ok: false, error: "person_name_required", field: "name" };
  }
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > 255 ||
    CONTROL_CHARACTER_PATTERN.test(normalized)
  ) {
    return { ok: false, error: "person_name_required", field: "name" };
  }
  return { ok: true, value: normalized };
}

function validateOptionalIdentifier(
  value: unknown,
  field: string,
): ValidationSuccess<string | null | undefined> | ValidationFailure {
  const text = validateOptionalText(value, field, 128);
  if (!text.ok || text.value === undefined || text.value === null) return text;
  return IDENTIFIER_PATTERN.test(text.value)
    ? text
    : { ok: false, error: "invalid_identifier", field };
}

function validateOptionalPublicUrl(
  value: unknown,
  field: string,
): ValidationSuccess<string | null | undefined> | ValidationFailure {
  const text = validateOptionalText(value, field, 2_048);
  if (!text.ok || text.value === undefined || text.value === null) return text;
  const decision = validatePublicResearchUrl(text.value);
  return decision.ok && decision.url
    ? { ok: true, value: decision.url }
    : { ok: false, error: "invalid_public_url", field };
}

function setOptional<K extends keyof BusinessPersonInput>(
  target: BusinessPersonInput,
  key: K,
  value: BusinessPersonInput[K] | undefined,
): void {
  if (value !== undefined) target[key] = value;
}

function validatePerson(value: unknown): ValidationSuccess<BusinessPersonInput> | ValidationFailure {
  if (!isJsonRecord(value)) {
    return { ok: false, error: "person_object_required", field: "person" };
  }

  const extraKeys = unexpectedKeys(value, PERSON_WRITE_KEYS);
  if (extraKeys.length) {
    return { ok: false, error: "unsupported_person_fields", fields: extraKeys };
  }
  if (containsSensitiveInputKey(value)) {
    return { ok: false, error: "forbidden_business_input_key" };
  }

  const name = validateRequiredName(value.name);
  if (!name.ok) return name;

  const id = validateOptionalIdentifier(value.id, "id");
  if (!id.ok) return id;
  const organizationId = validateOptionalIdentifier(
    value.organizationId,
    "organizationId",
  );
  if (!organizationId.ok) return organizationId;
  const role = validateOptionalText(value.role, "role", 255);
  if (!role.ok) return role;
  const email = validateOptionalText(value.email, "email", 255);
  if (!email.ok) return email;
  const phone = validateOptionalText(value.phone, "phone", 64);
  if (!phone.ok) return phone;
  const profileUrl = validateOptionalPublicUrl(value.profileUrl, "profileUrl");
  if (!profileUrl.ok) return profileUrl;
  const sourceType = validateOptionalText(value.sourceType, "sourceType", 64);
  if (!sourceType.ok) return sourceType;
  const sourceUrl = validateOptionalPublicUrl(value.sourceUrl, "sourceUrl");
  if (!sourceUrl.ok) return sourceUrl;
  const allowedUse = validateOptionalText(value.allowedUse, "allowedUse", 64);
  if (!allowedUse.ok) return allowedUse;
  const contactStatus = validateOptionalText(
    value.contactStatus,
    "contactStatus",
    64,
  );
  if (!contactStatus.ok) return contactStatus;

  if (
    value.confidenceScore !== undefined &&
    value.confidenceScore !== null &&
    (typeof value.confidenceScore !== "number" ||
      !Number.isFinite(value.confidenceScore) ||
      value.confidenceScore < 0 ||
      value.confidenceScore > 100)
  ) {
    return {
      ok: false,
      error: "invalid_confidence_score",
      field: "confidenceScore",
    };
  }

  if (
    value.metadata !== undefined &&
    value.metadata !== null &&
    !isJsonRecord(value.metadata)
  ) {
    return { ok: false, error: "invalid_metadata", field: "metadata" };
  }

  const person: BusinessPersonInput = { name: name.value };
  setOptional(person, "id", id.value ?? undefined);
  setOptional(person, "organizationId", organizationId.value);
  setOptional(person, "role", role.value);
  setOptional(person, "email", email.value);
  setOptional(person, "phone", phone.value);
  setOptional(person, "profileUrl", profileUrl.value);
  setOptional(person, "sourceType", sourceType.value);
  setOptional(person, "sourceUrl", sourceUrl.value);
  setOptional(person, "allowedUse", allowedUse.value);
  setOptional(person, "contactStatus", contactStatus.value);
  setOptional(
    person,
    "confidenceScore",
    value.confidenceScore === null
      ? null
      : typeof value.confidenceScore === "number"
        ? value.confidenceScore
        : undefined,
  );
  setOptional(
    person,
    "metadata",
    value.metadata === null
      ? {}
      : isJsonRecord(value.metadata)
        ? value.metadata
        : undefined,
  );
  return { ok: true, value: person };
}

function parseLimit(url: URL): ValidationSuccess<number> | ValidationFailure {
  const values = url.searchParams.getAll("limit");
  if (values.length === 0) return { ok: true, value: 25 };
  if (values.length !== 1 || !/^[1-9]\d*$/.test(values[0])) {
    return { ok: false, error: "invalid_limit", field: "limit" };
  }
  const parsed = Number(values[0]);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 100
    ? { ok: true, value: parsed }
    : { ok: false, error: "invalid_limit", field: "limit" };
}

function parseContactStatus(
  url: URL,
): ValidationSuccess<string | undefined> | ValidationFailure {
  const values = url.searchParams.getAll("contactStatus");
  if (values.length === 0) return { ok: true, value: undefined };
  if (values.length !== 1) {
    return { ok: false, error: "invalid_contact_status", field: "contactStatus" };
  }
  const text = validateOptionalText(values[0], "contactStatus", 64);
  if (!text.ok) return text;
  return { ok: true, value: text.value ?? undefined };
}

function invalidRequest(json: JsonResponse, failure: ValidationFailure): Response {
  return json({
    ok: false,
    error: failure.error,
    ...(failure.field ? { field: failure.field } : {}),
    ...(failure.fields ? { fields: failure.fields } : {}),
    internalMetadataOnly: true,
    externalExecutionAllowed: false,
    rawInputExposed: false,
  }, { status: 400 });
}

function blockedWrite(json: JsonResponse): Response {
  return json({
    ok: false,
    error: "confirm_required",
    reason:
      "Business people writes require exact JSON confirmation and save internal metadata only. They do not enrich contacts, scrape profiles, send email, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems.",
    requiredPayload: { confirm: true },
    confirmationCoercionAllowed: false,
    queryConfirmationAllowed: false,
    safety: businessAutopilotMetadataWriteSafety(),
  }, { status: 400 });
}

function migrationError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  const missingScoreProvenance = /(?:no such column:\s*[^\s]*_observed|has no column named\s+[^\s]*_observed)/i.test(text);
  const missingTable = /no such table: business_people/i.test(text);
  const schemaMissing = missingScoreProvenance || missingTable;
  return {
    ok: false,
    mode: "business_people_error",
    error: schemaMissing
      ? "business_autopilot_schema_missing"
      : "business_people_failed",
    message: missingScoreProvenance
      ? scoreProvenanceMissingMessage
      : missingTable
        ? schemaMissingMessage
        : routeFailedMessage,
    requiredMigration: missingScoreProvenance
      ? "0024_business_score_observation_flags.sql"
      : missingTable
        ? "0021_business_autopilot_foundation.sql"
        : null,
    rawErrorExposed: false,
    contactDetailsExposed: false,
    metadataExposed: false,
    safety: businessAutopilotReadSafety(),
  };
}

function minimiseBusinessPersonResponse<T extends Record<string, unknown>>(person: T) {
  const emailPresent =
    typeof person.email === "string" && person.email.trim().length > 0;
  const phonePresent =
    typeof person.phone === "string" && person.phone.trim().length > 0;
  const profileUrlPresent =
    typeof person.profileUrl === "string" && person.profileUrl.trim().length > 0;
  const sourceUrlPresent =
    typeof person.sourceUrl === "string" && person.sourceUrl.trim().length > 0;

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

export async function handleBusinessAutopilotPeopleAdmin(
  request: Request,
  env: Env,
  pathname: string,
  json: JsonResponse,
): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (request.method === "OPTIONS") {
    return json(
      { ok: false, error: "method_not_allowed" },
      { status: 405, headers: { allow: "GET, POST" } },
    );
  }
  if (pathname !== ROUTE_PATH) {
    return json(
      { ok: false, error: "not_found", path: pathname, method: request.method },
      { status: 404 },
    );
  }

  const url = new URL(request.url);

  if (request.method === "GET") {
    const queryKeys = [...new Set(url.searchParams.keys())];
    const unsupported = queryKeys.filter((key) => !GET_QUERY_KEYS.has(key)).sort();
    if (unsupported.length) {
      return invalidRequest(json, {
        ok: false,
        error: "query_not_supported",
        fields: unsupported,
      });
    }

    const limit = parseLimit(url);
    if (!limit.ok) return invalidRequest(json, limit);
    const contactStatus = parseContactStatus(url);
    if (!contactStatus.ok) return invalidRequest(json, contactStatus);

    try {
      const people = await listBusinessPeople(
        env,
        limit.value,
        contactStatus.value,
      );
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
    } catch (error) {
      return json(migrationError(error), { status: 503 });
    }
  }

  if (request.method === "POST") {
    if ([...url.searchParams.keys()].length > 0) {
      return json({
        ok: false,
        error: "query_not_supported",
        queryConfirmationAllowed: false,
        internalMetadataOnly: true,
        externalExecutionAllowed: false,
      }, { status: 400 });
    }

    const parsed = await readBoundedJsonObject<BusinessPersonWriteBody>(request, {
      maxBytes: 32_768,
      maxDepth: 8,
      maxNodes: 500,
      maxArrayLength: 100,
      maxStringLength: 16_384,
      maxKeyLength: 160,
    });
    if (!parsed.ok) {
      return json(boundedJsonFailurePayload(parsed), { status: parsed.status });
    }
    if (!isExplicitJsonConfirmation(parsed.value)) return blockedWrite(json);

    const extraKeys = unexpectedKeys(parsed.value, TOP_LEVEL_WRITE_KEYS);
    if (extraKeys.length) {
      return invalidRequest(json, {
        ok: false,
        error: "unsupported_request_fields",
        fields: extraKeys,
      });
    }

    const personInput = validatePerson(parsed.value.person);
    if (!personInput.ok) return invalidRequest(json, personInput);

    try {
      const person = await saveBusinessPerson(env, personInput.value);
      const redactedPerson = minimiseBusinessPersonResponse(person);
      return json({
        mode: "business_person_saved",
        contactDetailsRedacted: true,
        metadataRedacted: true,
        internalReviewOnly: true,
        executable: false,
        deliverable: false,
        authoritativeForExecution: false,
        exactBooleanConfirmation: true,
        confirmationCoercionAllowed: false,
        queryConfirmationAllowed: false,
        requestReceipt: {
          contract: parsed.contract,
          bytes: parsed.bytes,
          bodyHashAvailable: true,
        },
        ...businessPersonWritePayload(redactedPerson),
      });
    } catch (error) {
      return json(migrationError(error), { status: 503 });
    }
  }

  return json(
    { ok: false, error: "method_not_allowed" },
    { status: 405, headers: { allow: "GET, POST" } },
  );
}
