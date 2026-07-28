import { businessAutopilotReadSafety } from "./businessAutopilotSafety";

export const BUSINESS_METADATA_READ_QUERY_CONTRACT =
  "business_metadata_read_query_v1" as const;

type TextRule = Readonly<{
  maxLength: number;
}>;

export type BusinessMetadataReadQueryOptions = Readonly<{
  textFields?: Readonly<Record<string, TextRule>>;
  booleanFields?: ReadonlySet<string>;
  defaultLimit?: number;
  maxLimit?: number;
}>;

export type BusinessMetadataReadQueryFailure = Readonly<{
  ok: false;
  status: 400;
  payload: Readonly<Record<string, unknown>>;
}>;

export type BusinessMetadataReadQuerySuccess = Readonly<{
  ok: true;
  contract: typeof BUSINESS_METADATA_READ_QUERY_CONTRACT;
  limit: number;
  text: Readonly<Record<string, string | undefined>>;
  booleans: Readonly<Record<string, boolean | undefined>>;
}>;

export type BusinessMetadataReadQueryResult =
  | BusinessMetadataReadQueryFailure
  | BusinessMetadataReadQuerySuccess;

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const SAFE_QUERY_KEY = /^[A-Za-z0-9._-]+$/;
const MAX_QUERY_STRING_LENGTH = 2_048;
const MAX_QUERY_FIELDS = 16;
const MAX_QUERY_KEY_LENGTH = 64;
const MAX_QUERY_VALUE_LENGTH = 256;

const BUSINESS_READ_ROUTE_OPTIONS: Readonly<Record<string, BusinessMetadataReadQueryOptions>> = Object.freeze({
  "/admin/business/organizations": { textFields: { status: { maxLength: 64 } } },
  "/admin/business/signals": { textFields: { signalType: { maxLength: 128 } } },
  "/admin/business/opportunities": { textFields: { status: { maxLength: 64 } } },
  "/admin/business/service-matches": { textFields: { serviceKey: { maxLength: 128 } } },
  "/admin/business/audit-packs": { textFields: { status: { maxLength: 64 } } },
  "/admin/business/action-drafts": { textFields: { status: { maxLength: 64 } } },
  "/admin/business/approval-requests": { textFields: { status: { maxLength: 64 } } },
  "/admin/business/suppression": { booleanFields: new Set(["active"]) },
  "/admin/business/content-ideas": { textFields: { status: { maxLength: 64 } } },
  "/admin/business/followups": { textFields: { status: { maxLength: 64 } } },
  "/admin/business/learning": { textFields: { entityType: { maxLength: 64 } } },
  "/admin/business/websites": { textFields: { status: { maxLength: 64 } } },
  "/admin/business/pages": { textFields: { pageType: { maxLength: 128 } } },
  "/admin/business/website-audit-runs": { textFields: { status: { maxLength: 64 } } },
  "/admin/business/audit-observations": { textFields: { category: { maxLength: 128 } } },
  "/admin/business/audit-observation-candidates": { maxLimit: 50 },
});

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function failure(
  error: string,
  extras: Record<string, unknown> = {},
): BusinessMetadataReadQueryFailure {
  return {
    ok: false,
    status: 400,
    payload: {
      ok: false,
      error,
      queryContract: BUSINESS_METADATA_READ_QUERY_CONTRACT,
      readOnly: true,
      internalMetadataOnly: true,
      rawInputExposed: false,
      externalExecutionAllowed: false,
      ...extras,
      safety: businessAutopilotReadSafety(),
    },
  };
}

function safeFieldSummary(fields: readonly string[]): Record<string, unknown> {
  return {
    fieldCount: fields.length,
    fields: fields.slice(0, 8).map((field) =>
      field.length <= MAX_QUERY_KEY_LENGTH && SAFE_QUERY_KEY.test(field)
        ? field
        : "[redacted]"
    ),
  };
}

function queryEntries(url: URL): Array<readonly [string, string]> {
  const entries: Array<readonly [string, string]> = [];
  url.searchParams.forEach((value, key) => entries.push([key, value]));
  return entries;
}

function queryValues(entries: readonly (readonly [string, string])[]): Map<string, string[]> {
  const values = new Map<string, string[]>();
  for (const [key, value] of entries) {
    const existing = values.get(key);
    if (existing) existing.push(value);
    else values.set(key, [value]);
  }
  return values;
}

export function parseBusinessMetadataReadQuery(
  url: URL,
  options: BusinessMetadataReadQueryOptions = {},
): BusinessMetadataReadQueryResult {
  const maxLimit = boundedInteger(options.maxLimit, 100, 1, 100);
  const defaultLimit = boundedInteger(options.defaultLimit, Math.min(25, maxLimit), 1, maxLimit);
  const textRules = options.textFields ?? {};
  const booleanFields = options.booleanFields ?? new Set<string>();
  const allowedFields = new Set(["limit", ...Object.keys(textRules), ...booleanFields]);

  if (url.search.length > MAX_QUERY_STRING_LENGTH) {
    return failure("query_string_too_large", { maxQueryStringLength: MAX_QUERY_STRING_LENGTH });
  }

  const entries = queryEntries(url);
  if (entries.length > MAX_QUERY_FIELDS) {
    return failure("query_structure_too_large", {
      maxQueryFields: MAX_QUERY_FIELDS,
      fieldCount: entries.length,
    });
  }

  const invalidKeys = entries
    .map(([key]) => key)
    .filter((key) =>
      !key ||
      key.length > MAX_QUERY_KEY_LENGTH ||
      !SAFE_QUERY_KEY.test(key) ||
      CONTROL_CHARACTERS.test(key)
    );
  if (invalidKeys.length) {
    return failure("invalid_query_key", { fieldCount: invalidKeys.length });
  }

  const invalidValueFields = entries
    .filter(([, value]) => value.length > MAX_QUERY_VALUE_LENGTH || CONTROL_CHARACTERS.test(value))
    .map(([key]) => key);
  if (invalidValueFields.length) {
    return failure("invalid_query_value", {
      ...safeFieldSummary(invalidValueFields),
      maxQueryValueLength: MAX_QUERY_VALUE_LENGTH,
    });
  }

  const values = queryValues(entries);
  const unsupported = [...values.keys()].filter((key) => !allowedFields.has(key)).sort();
  if (unsupported.length) return failure("query_not_supported", safeFieldSummary(unsupported));

  const duplicate = [...values.entries()]
    .filter(([, fieldValues]) => fieldValues.length !== 1)
    .map(([key]) => key)
    .sort();
  if (duplicate.length) return failure("duplicate_query_parameter", safeFieldSummary(duplicate));

  let limit = defaultLimit;
  const limitValue = values.get("limit")?.[0];
  if (limitValue !== undefined) {
    if (!/^[1-9]\d*$/.test(limitValue)) {
      return failure("invalid_limit", { field: "limit", acceptedRange: { min: 1, max: maxLimit } });
    }
    const parsedLimit = Number(limitValue);
    if (!Number.isSafeInteger(parsedLimit) || parsedLimit > maxLimit) {
      return failure("invalid_limit", { field: "limit", acceptedRange: { min: 1, max: maxLimit } });
    }
    limit = parsedLimit;
  }

  const text: Record<string, string | undefined> = {};
  for (const [field, rule] of Object.entries(textRules)) {
    const value = values.get(field)?.[0];
    if (value === undefined) {
      text[field] = undefined;
      continue;
    }
    if (!value || value.trim() !== value || value.length > rule.maxLength || CONTROL_CHARACTERS.test(value)) {
      return failure("invalid_text_query", { field, maxLength: rule.maxLength });
    }
    text[field] = value;
  }

  const booleans: Record<string, boolean | undefined> = {};
  for (const field of booleanFields) {
    const value = values.get(field)?.[0];
    if (value === undefined) {
      booleans[field] = undefined;
      continue;
    }
    if (value !== "0" && value !== "1") {
      return failure("invalid_boolean_query", { field, acceptedValues: ["0", "1"] });
    }
    booleans[field] = value === "1";
  }

  return {
    ok: true,
    contract: BUSINESS_METADATA_READ_QUERY_CONTRACT,
    limit,
    text,
    booleans,
  };
}

export function parseBusinessMetadataReadRouteQuery(
  url: URL,
  pathname: string,
  method: string,
): BusinessMetadataReadQueryResult | null {
  if (method !== "GET") return null;
  const options = BUSINESS_READ_ROUTE_OPTIONS[pathname];
  return options ? parseBusinessMetadataReadQuery(url, options) : null;
}
