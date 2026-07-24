export const BOUNDED_JSON_REQUEST_CONTRACT = "bounded_admin_json_request_v1";
export const DEFAULT_ADMIN_JSON_MAX_BYTES = 65_536;

const FORBIDDEN_JSON_KEYS = new Set(["__proto__", "prototype", "constructor"]);

type JsonObject = Record<string, unknown>;

export type BoundedJsonRequestOptions = {
  maxBytes?: number;
  maxDepth?: number;
  maxNodes?: number;
  maxArrayLength?: number;
  maxStringLength?: number;
  maxKeyLength?: number;
};

export type BoundedJsonRequestSuccess<T extends JsonObject = JsonObject> = {
  ok: true;
  contract: typeof BOUNDED_JSON_REQUEST_CONTRACT;
  value: T;
  bytes: number;
  bodySha256: string;
};

export type BoundedJsonRequestFailure = {
  ok: false;
  contract: typeof BOUNDED_JSON_REQUEST_CONTRACT;
  status: 400 | 413 | 415;
  error:
    | "json_content_type_required"
    | "invalid_content_length"
    | "request_body_too_large"
    | "request_body_read_failed"
    | "invalid_utf8_json"
    | "invalid_json"
    | "json_object_required"
    | "json_structure_too_deep"
    | "json_structure_too_large"
    | "json_array_too_large"
    | "json_string_too_long"
    | "json_key_too_long"
    | "forbidden_json_key";
  maxBytes: number;
  bytesRead: number;
};

export type BoundedJsonRequestResult<T extends JsonObject = JsonObject> =
  | BoundedJsonRequestSuccess<T>
  | BoundedJsonRequestFailure;

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function failure(
  error: BoundedJsonRequestFailure["error"],
  status: BoundedJsonRequestFailure["status"],
  maxBytes: number,
  bytesRead = 0,
): BoundedJsonRequestFailure {
  return {
    ok: false,
    contract: BOUNDED_JSON_REQUEST_CONTRACT,
    status,
    error,
    maxBytes,
    bytesRead,
  };
}

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();
  return mediaType === "application/json" || /^application\/[a-z0-9!#$&^_.+-]+\+json$/.test(mediaType);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function readRequestBodyBounded(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; error: "request_body_too_large" | "request_body_read_failed"; bytesRead: number }> {
  if (!request.body) return { ok: true, bytes: new Uint8Array() };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      if (!next.value) continue;
      total += next.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("request_body_too_large").catch(() => undefined);
        return { ok: false, error: "request_body_too_large", bytesRead: total };
      }
      chunks.push(next.value);
    }
  } catch {
    return { ok: false, error: "request_body_read_failed", bytesRead: total };
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Cancelled or failed streams may already have released their lock.
    }
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes: combined };
}

function validateJsonStructure(
  root: JsonObject,
  options: Required<Omit<BoundedJsonRequestOptions, "maxBytes">>,
): BoundedJsonRequestFailure["error"] | null {
  const stack: Array<{ value: unknown; depth: number }> = [{ value: root, depth: 0 }];
  let nodes = 0;

  while (stack.length) {
    const current = stack.pop()!;
    nodes += 1;
    if (nodes > options.maxNodes) return "json_structure_too_large";
    if (current.depth > options.maxDepth) return "json_structure_too_deep";

    if (typeof current.value === "string") {
      if (current.value.length > options.maxStringLength) return "json_string_too_long";
      continue;
    }

    if (Array.isArray(current.value)) {
      if (current.value.length > options.maxArrayLength) return "json_array_too_large";
      for (const item of current.value) stack.push({ value: item, depth: current.depth + 1 });
      continue;
    }

    if (!current.value || typeof current.value !== "object") continue;

    for (const [key, value] of Object.entries(current.value as JsonObject)) {
      if (FORBIDDEN_JSON_KEYS.has(key)) return "forbidden_json_key";
      if (key.length > options.maxKeyLength) return "json_key_too_long";
      stack.push({ value, depth: current.depth + 1 });
    }
  }

  return null;
}

export function isExplicitJsonConfirmation(value: unknown): value is JsonObject & { confirm: true } {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && (value as JsonObject).confirm === true);
}

export function boundedJsonFailurePayload(result: BoundedJsonRequestFailure) {
  return {
    ok: false,
    error: result.error,
    requestBodyContract: result.contract,
    maxBytes: result.maxBytes,
  };
}

export async function readBoundedJsonObject<T extends JsonObject = JsonObject>(
  request: Request,
  options: BoundedJsonRequestOptions = {},
): Promise<BoundedJsonRequestResult<T>> {
  const maxBytes = boundedInteger(options.maxBytes, DEFAULT_ADMIN_JSON_MAX_BYTES, 256, 1_048_576);
  const structureOptions = {
    maxDepth: boundedInteger(options.maxDepth, 12, 1, 64),
    maxNodes: boundedInteger(options.maxNodes, 2_000, 16, 25_000),
    maxArrayLength: boundedInteger(options.maxArrayLength, 250, 1, 5_000),
    maxStringLength: boundedInteger(options.maxStringLength, 16_384, 16, 262_144),
    maxKeyLength: boundedInteger(options.maxKeyLength, 160, 8, 2_048),
  };

  if (!isJsonContentType(request.headers.get("content-type"))) {
    return failure("json_content_type_required", 415, maxBytes);
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader !== null) {
    if (!/^\d+$/.test(contentLengthHeader.trim())) return failure("invalid_content_length", 400, maxBytes);
    const declaredLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(declaredLength)) return failure("invalid_content_length", 400, maxBytes);
    if (declaredLength > maxBytes) return failure("request_body_too_large", 413, maxBytes, declaredLength);
  }

  const body = await readRequestBodyBounded(request, maxBytes);
  if (!body.ok) {
    return failure(body.error, body.error === "request_body_too_large" ? 413 : 400, maxBytes, body.bytesRead);
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(body.bytes);
  } catch {
    return failure("invalid_utf8_json", 400, maxBytes, body.bytes.byteLength);
  }

  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return failure("invalid_json", 400, maxBytes, body.bytes.byteLength);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return failure("json_object_required", 400, maxBytes, body.bytes.byteLength);
  }

  const structureError = validateJsonStructure(parsed as JsonObject, structureOptions);
  if (structureError) return failure(structureError, 400, maxBytes, body.bytes.byteLength);

  return {
    ok: true,
    contract: BOUNDED_JSON_REQUEST_CONTRACT,
    value: parsed as T,
    bytes: body.bytes.byteLength,
    bodySha256: await sha256Hex(body.bytes),
  };
}
