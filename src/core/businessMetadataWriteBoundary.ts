import {
  boundedJsonFailurePayload,
  isExplicitJsonConfirmation,
  readBoundedJsonObject,
} from "./boundedJsonRequest";
import { businessAutopilotMetadataWriteSafety } from "./businessAutopilotSafety";

export const BUSINESS_METADATA_WRITE_BOUNDARY_CONTRACT =
  "business_metadata_write_boundary_v1" as const;

export type BusinessMetadataWriteReceipt = Readonly<{
  contract: string;
  boundaryContract: typeof BUSINESS_METADATA_WRITE_BOUNDARY_CONTRACT;
  bytes: number;
  bodyHashAvailable: true;
}>;

type JsonRecord = Record<string, unknown>;

type NumberRule = Readonly<{
  min: number;
  max: number;
  integer?: boolean;
}>;

export type BusinessMetadataWriteBoundaryOptions = Readonly<{
  entityKey: string;
  allowedEntityFields: ReadonlySet<string>;
  requiredTextFields?: ReadonlySet<string>;
  textFields?: ReadonlySet<string>;
  arrayFields?: ReadonlySet<string>;
  objectFields?: ReadonlySet<string>;
  booleanFields?: ReadonlySet<string>;
  numberFields?: Readonly<Record<string, NumberRule>>;
  maxBytes?: number;
}>;

export type BusinessMetadataWriteBoundaryFailure = Readonly<{
  ok: false;
  status: 400 | 413 | 415;
  payload: Record<string, unknown>;
}>;

export type BusinessMetadataWriteBoundarySuccess = Readonly<{
  ok: true;
  entity: JsonRecord;
  requestReceipt: BusinessMetadataWriteReceipt;
}>;

export type BusinessMetadataWriteBoundaryResult =
  | BusinessMetadataWriteBoundaryFailure
  | BusinessMetadataWriteBoundarySuccess;

const TOP_LEVEL_SHARED_FIELDS = new Set(["confirm"]);
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const SENSITIVE_EXACT_KEYS = new Set([
  "authorization",
  "cookie",
  "setcookie",
]);
const SENSITIVE_KEY_FRAGMENTS = Object.freeze([
  "token",
  "secret",
  "password",
  "apikey",
  "privatekey",
  "servicerole",
  "bearer",
] as const);

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

function failure(
  status: 400 | 413 | 415,
  error: string,
  extras: Record<string, unknown> = {},
): BusinessMetadataWriteBoundaryFailure {
  return {
    ok: false,
    status,
    payload: {
      ok: false,
      error,
      boundaryContract: BUSINESS_METADATA_WRITE_BOUNDARY_CONTRACT,
      internalMetadataOnly: true,
      exactBooleanConfirmation: true,
      confirmationCoercionAllowed: false,
      queryConfirmationAllowed: false,
      rawInputExposed: false,
      externalExecutionAllowed: false,
      ...extras,
      safety: businessAutopilotMetadataWriteSafety(),
    },
  };
}

function validateEntity(
  entity: JsonRecord,
  options: BusinessMetadataWriteBoundaryOptions,
): BusinessMetadataWriteBoundaryFailure | null {
  const extraFields = unexpectedKeys(entity, options.allowedEntityFields);
  if (extraFields.length) {
    return failure(400, "unsupported_entity_fields", { fields: extraFields });
  }
  if (containsSensitiveInputKey(entity)) {
    return failure(400, "forbidden_business_input_key");
  }

  for (const field of options.requiredTextFields ?? []) {
    const value = entity[field];
    if (
      typeof value !== "string" ||
      !value.trim() ||
      CONTROL_CHARACTERS.test(value)
    ) {
      return failure(400, "required_text_invalid", { field });
    }
  }

  for (const field of options.textFields ?? []) {
    const value = entity[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== "string" || CONTROL_CHARACTERS.test(value)) {
      return failure(400, "text_field_invalid", { field });
    }
  }

  for (const field of options.arrayFields ?? []) {
    const value = entity[field];
    if (value === undefined || value === null) continue;
    if (!Array.isArray(value)) return failure(400, "array_field_invalid", { field });
  }

  for (const field of options.objectFields ?? []) {
    const value = entity[field];
    if (value === undefined || value === null) continue;
    if (!isJsonRecord(value)) return failure(400, "object_field_invalid", { field });
  }

  for (const field of options.booleanFields ?? []) {
    const value = entity[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== "boolean") return failure(400, "boolean_field_invalid", { field });
  }

  for (const [field, rule] of Object.entries(options.numberFields ?? {})) {
    const value = entity[field];
    if (value === undefined || value === null) continue;
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < rule.min ||
      value > rule.max ||
      (rule.integer === true && !Number.isInteger(value))
    ) {
      return failure(400, "number_field_invalid", {
        field,
        acceptedRange: { min: rule.min, max: rule.max },
        integerRequired: rule.integer === true,
      });
    }
  }

  return null;
}

export async function readBusinessMetadataWriteRequest(
  request: Request,
  options: BusinessMetadataWriteBoundaryOptions,
): Promise<BusinessMetadataWriteBoundaryResult> {
  const url = new URL(request.url);
  const queryFieldNames: string[] = [];
  url.searchParams.forEach((_value, key) => queryFieldNames.push(key));
  const queryFields = Array.from(new Set(queryFieldNames)).sort();
  if (queryFields.length) {
    return failure(400, "query_not_supported", { fields: queryFields });
  }

  const parsed = await readBoundedJsonObject(request, {
    maxBytes: options.maxBytes ?? 32_768,
    maxDepth: 8,
    maxNodes: 500,
    maxArrayLength: 100,
    maxStringLength: 16_384,
    maxKeyLength: 160,
  });
  if (!parsed.ok) {
    return {
      ok: false,
      status: parsed.status,
      payload: {
        ...boundedJsonFailurePayload(parsed),
        boundaryContract: BUSINESS_METADATA_WRITE_BOUNDARY_CONTRACT,
        internalMetadataOnly: true,
        exactBooleanConfirmation: true,
        confirmationCoercionAllowed: false,
        queryConfirmationAllowed: false,
        rawInputExposed: false,
        externalExecutionAllowed: false,
        safety: businessAutopilotMetadataWriteSafety(),
      },
    };
  }

  if (!isExplicitJsonConfirmation(parsed.value)) {
    return failure(400, "confirm_required", {
      requiredPayload: { confirm: true, [options.entityKey]: "object" },
    });
  }

  const topLevelFields = new Set([...TOP_LEVEL_SHARED_FIELDS, options.entityKey]);
  const extraTopLevelFields = unexpectedKeys(parsed.value, topLevelFields);
  if (extraTopLevelFields.length) {
    return failure(400, "unsupported_request_fields", { fields: extraTopLevelFields });
  }

  const entity = parsed.value[options.entityKey];
  if (!isJsonRecord(entity)) {
    return failure(400, "entity_object_required", { field: options.entityKey });
  }

  const entityFailure = validateEntity(entity, options);
  if (entityFailure) return entityFailure;

  return {
    ok: true,
    entity,
    requestReceipt: {
      contract: parsed.contract,
      boundaryContract: BUSINESS_METADATA_WRITE_BOUNDARY_CONTRACT,
      bytes: parsed.bytes,
      bodyHashAvailable: true,
    },
  };
}
