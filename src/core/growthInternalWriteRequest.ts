import {
  BOUNDED_JSON_REQUEST_CONTRACT,
  boundedJsonFailurePayload,
  isExplicitJsonConfirmation,
  readBoundedJsonObject,
  type BoundedJsonRequestFailure,
} from "./boundedJsonRequest";

export const GROWTH_INTERNAL_WRITE_REQUEST_VERSION =
  "growth_internal_write_request_v1" as const;
export const GROWTH_INTERNAL_WRITE_MAX_BYTES = 32_768;

const SENSITIVE_KEY_FRAGMENTS = Object.freeze([
  "token",
  "secret",
  "password",
  "apikey",
  "privatekey",
  "servicerole",
] as const);
const SENSITIVE_EXACT_KEYS = new Set([
  "authorization",
  "cookie",
]);

type JsonRecord = Record<string, unknown>;

export type GrowthInternalWriteRequestFailureCode =
  | BoundedJsonRequestFailure["error"]
  | "confirm_required"
  | "forbidden_growth_input_key";

export type GrowthInternalWriteRequestSuccess = Readonly<{
  ok: true;
  contractVersion: typeof GROWTH_INTERNAL_WRITE_REQUEST_VERSION;
  boundedJsonContract: typeof BOUNDED_JSON_REQUEST_CONTRACT;
  body: Readonly<JsonRecord>;
  bodySha256: string;
  bytes: number;
  exactBooleanConfirmation: true;
  confirmationCoercionAllowed: false;
  sensitiveInputKeysAllowed: false;
}>;

export type GrowthInternalWriteRequestFailure = Readonly<{
  ok: false;
  contractVersion: typeof GROWTH_INTERNAL_WRITE_REQUEST_VERSION;
  status: 400 | 413 | 415;
  error: GrowthInternalWriteRequestFailureCode;
  requiredPayload: Readonly<{ confirm: true }> | null;
  confirmationCoercionAllowed: false;
  sensitiveInputKeysAllowed: false;
  boundedJsonFailure: ReturnType<typeof boundedJsonFailurePayload> | null;
}>;

export type GrowthInternalWriteRequestResult =
  | GrowthInternalWriteRequestSuccess
  | GrowthInternalWriteRequestFailure;

function normalizedKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isSensitiveKey(value: string): boolean {
  const normalized = normalizedKey(value);
  return SENSITIVE_EXACT_KEYS.has(normalized) ||
    SENSITIVE_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

function containsSensitiveKey(value: unknown): boolean {
  const stack: unknown[] = [value];
  while (stack.length) {
    const current = stack.pop();
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    if (!current || typeof current !== "object") continue;
    for (const [key, child] of Object.entries(current as JsonRecord)) {
      if (isSensitiveKey(key)) return true;
      stack.push(child);
    }
  }
  return false;
}

function deepFreezeJson<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const item of value) deepFreezeJson(item);
    return Object.freeze(value) as T;
  }
  if (value && typeof value === "object") {
    for (const child of Object.values(value as JsonRecord)) deepFreezeJson(child);
    return Object.freeze(value) as T;
  }
  return value;
}

function failure(
  status: 400 | 413 | 415,
  error: GrowthInternalWriteRequestFailureCode,
  options: Readonly<{
    requiredPayload?: boolean;
    boundedJsonFailure?: ReturnType<typeof boundedJsonFailurePayload> | null;
  }> = {},
): GrowthInternalWriteRequestFailure {
  return Object.freeze({
    ok: false,
    contractVersion: GROWTH_INTERNAL_WRITE_REQUEST_VERSION,
    status,
    error,
    requiredPayload: options.requiredPayload
      ? Object.freeze({ confirm: true as const })
      : null,
    confirmationCoercionAllowed: false,
    sensitiveInputKeysAllowed: false,
    boundedJsonFailure: options.boundedJsonFailure ?? null,
  });
}

export function growthInternalWriteFailurePayload(
  result: GrowthInternalWriteRequestFailure,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    ok: false,
    contractVersion: result.contractVersion,
    error: result.error,
    ...(result.requiredPayload ? { requiredPayload: result.requiredPayload } : {}),
    confirmationCoercionAllowed: false,
    sensitiveInputKeysAllowed: false,
    ...(result.boundedJsonFailure ?? {}),
  });
}

export async function readGrowthInternalWriteRequest(
  request: Request,
): Promise<GrowthInternalWriteRequestResult> {
  const parsed = await readBoundedJsonObject<JsonRecord>(request, {
    maxBytes: GROWTH_INTERNAL_WRITE_MAX_BYTES,
    maxDepth: 10,
    maxNodes: 1_000,
    maxArrayLength: 200,
    maxStringLength: 16_384,
    maxKeyLength: 160,
  });

  if (!parsed.ok) {
    return failure(parsed.status, parsed.error, {
      boundedJsonFailure: boundedJsonFailurePayload(parsed),
    });
  }
  if (!isExplicitJsonConfirmation(parsed.value)) {
    return failure(400, "confirm_required", { requiredPayload: true });
  }
  if (containsSensitiveKey(parsed.value)) {
    return failure(400, "forbidden_growth_input_key");
  }

  const { confirm: _confirm, ...body } = parsed.value;
  return Object.freeze({
    ok: true,
    contractVersion: GROWTH_INTERNAL_WRITE_REQUEST_VERSION,
    boundedJsonContract: parsed.contract,
    body: deepFreezeJson(body),
    bodySha256: parsed.bodySha256,
    bytes: parsed.bytes,
    exactBooleanConfirmation: true,
    confirmationCoercionAllowed: false,
    sensitiveInputKeysAllowed: false,
  });
}
