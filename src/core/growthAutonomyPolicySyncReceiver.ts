import {
  GROWTH_AUTONOMY_POLICY_SYNC_CONTENT_TYPE,
  GROWTH_AUTONOMY_POLICY_SYNC_MAX_BODY_BYTES,
  GROWTH_AUTONOMY_POLICY_SYNC_PATH,
  assertGrowthAutonomyPolicySyncKeyRegistry,
  parseGrowthAutonomyPolicySyncKeyConfigurationJson,
  verifyGrowthAutonomyPolicySyncRequest,
  type GrowthAutonomyPolicySyncHeaderSource,
  type GrowthAutonomyPolicySyncKeyRegistry,
} from "./growthAutonomyPolicySync";
import {
  GROWTH_AUTONOMY_POLICY_SYNC_D1_VERSION,
  GrowthAutonomyPolicySyncD1Repository,
  type GrowthAutonomyPolicySyncAcceptance,
} from "./growthAutonomyPolicySyncD1";
import type { D1DatabaseLike } from "./growthAutonomyD1Ledger";

export const GROWTH_AUTONOMY_POLICY_SYNC_RECEIVER_VERSION =
  "growth_autonomy_policy_sync_receiver_v1" as const;
export const GROWTH_AUTONOMY_POLICY_SYNC_MAX_CHUNKS = 128;

export type GrowthAutonomyPolicySyncRequest = Readonly<{
  method: unknown;
  pathname: unknown;
  headers: GrowthAutonomyPolicySyncHeaderSource;
  bodySource: AsyncIterable<unknown>;
  signal?: AbortSignal;
}>;

export type GrowthAutonomyPolicySyncResponse = Readonly<{
  status: number;
  headers: Readonly<Record<string, string>>;
  body:
    | Readonly<{
        ok: true;
        contractVersion: typeof GROWTH_AUTONOMY_POLICY_SYNC_D1_VERSION;
        policyVersion: number;
        profile: "paused" | "light" | "balanced" | "high";
        changed: boolean;
        receivedAt: string;
      }>
    | Readonly<{
        ok: false;
        error:
          | "method_not_allowed"
          | "not_found"
          | "unsupported_media_type"
          | "request_too_large"
          | "request_rejected"
          | "request_conflict"
          | "temporarily_unavailable";
      }>;
}>;

export type GrowthAutonomyPolicySyncRepository = Readonly<{
  acceptVerified(
    request: Parameters<GrowthAutonomyPolicySyncD1Repository["acceptVerified"]>[0],
  ): Promise<GrowthAutonomyPolicySyncAcceptance>;
}>;

export type GrowthAutonomyPolicySyncReceiverDependencies = Readonly<{
  keyRegistry: GrowthAutonomyPolicySyncKeyRegistry;
  repository: GrowthAutonomyPolicySyncRepository;
  clock?: () => Date;
}>;

export type GrowthAutonomyPolicySyncReceiverFromEnvironmentOptions = Readonly<{
  database: D1DatabaseLike;
  environment: Readonly<{
    EVAVO_GROWTH_AUTONOMY_POLICY_SYNC_KEYS_JSON?: string;
  }>;
  clock?: () => Date;
}>;

const BASE_HEADERS = Object.freeze({
  "cache-control": "private, no-store",
  "content-type": "application/json; charset=utf-8",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
} as const);
const CONSUMED_BODY_SOURCES = new WeakSet<object>();
const AUTHENTICATION_ERROR_PREFIXES = Object.freeze([
  "GROWTH_AUTONOMY_POLICY_SYNC_REQUEST_",
  "GROWTH_AUTONOMY_POLICY_SYNC_KEY_",
  "GROWTH_AUTONOMY_POLICY_SYNC_SIGNATURE_",
  "GROWTH_AUTONOMY_POLICY_SYNC_TIMESTAMP_",
  "GROWTH_AUTONOMY_POLICY_SYNC_NONCE_",
  "GROWTH_AUTONOMY_POLICY_SYNC_BODY_HASH_",
  "GROWTH_AUTONOMY_POLICY_SYNC_BODY_INVALID",
  "GROWTH_AUTONOMY_POLICY_SYNC_BODY_NONCANONICAL",
  "GROWTH_AUTONOMY_POLICY_SYNC_PACKET_",
  "GROWTH_AUTONOMY_POLICY_SYNC_POLICY_",
  "GROWTH_AUTONOMY_POLICY_SYNC_IDEMPOTENCY_",
  "GROWTH_AUTONOMY_POLICY_SYNC_ORGANISATION_",
  "GROWTH_AUTONOMY_POLICY_SYNC_WORKSPACE_",
  "GROWTH_AUTONOMY_POLICY_PRESET_MISMATCH",
]);

function fail(code: string): never {
  throw new Error(code);
}

function response(
  status: number,
  body: GrowthAutonomyPolicySyncResponse["body"],
  allowPost = false,
): GrowthAutonomyPolicySyncResponse {
  return Object.freeze({
    status,
    headers: Object.freeze({
      ...BASE_HEADERS,
      ...(allowPost ? { allow: "POST" } : {}),
    }),
    body: Object.freeze(body),
  });
}

function dependency(value: unknown): GrowthAutonomyPolicySyncRepository {
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as GrowthAutonomyPolicySyncRepository).acceptVerified !== "function"
  ) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_REPOSITORY_INVALID");
  }
  return value as GrowthAutonomyPolicySyncRepository;
}

function canonicalNow(clock: (() => Date) | undefined): Date {
  const now = clock ? clock() : new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_RECEIVER_TIME_INVALID");
  }
  return new Date(now.getTime());
}

function chunkBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  fail("GROWTH_AUTONOMY_POLICY_SYNC_BODY_CHUNK_INVALID");
}

async function readRawBody(input: {
  source: AsyncIterable<unknown>;
  signal?: AbortSignal;
}): Promise<Uint8Array> {
  if (
    !input.source ||
    typeof input.source !== "object" ||
    typeof input.source[Symbol.asyncIterator] !== "function"
  ) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_BODY_SOURCE_INVALID");
  }
  if (CONSUMED_BODY_SOURCES.has(input.source as object)) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_BODY_SOURCE_REUSED");
  }
  CONSUMED_BODY_SOURCES.add(input.source as object);
  if (input.signal?.aborted) fail("GROWTH_AUTONOMY_POLICY_SYNC_BODY_ABORTED");

  const chunks: Uint8Array[] = [];
  let total = 0;
  let count = 0;
  try {
    for await (const value of input.source) {
      if (input.signal?.aborted) fail("GROWTH_AUTONOMY_POLICY_SYNC_BODY_ABORTED");
      count += 1;
      if (count > GROWTH_AUTONOMY_POLICY_SYNC_MAX_CHUNKS) {
        fail("GROWTH_AUTONOMY_POLICY_SYNC_BODY_CHUNK_LIMIT");
      }
      const bytes = chunkBytes(value);
      total += bytes.byteLength;
      if (total > GROWTH_AUTONOMY_POLICY_SYNC_MAX_BODY_BYTES) {
        fail("GROWTH_AUTONOMY_POLICY_SYNC_BODY_TOO_LARGE");
      }
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      chunks.push(copy);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("GROWTH_AUTONOMY_POLICY_SYNC_")) {
      throw error;
    }
    fail("GROWTH_AUTONOMY_POLICY_SYNC_BODY_READ_FAILED");
  }
  if (total < 2) fail("GROWTH_AUTONOMY_POLICY_SYNC_BODY_INVALID");
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message.trim() : "";
}

function authenticationFailure(code: string): boolean {
  return AUTHENTICATION_ERROR_PREFIXES.some((prefix) => code.startsWith(prefix));
}

function failure(error: unknown): GrowthAutonomyPolicySyncResponse {
  const code = errorCode(error);
  if (code === "GROWTH_AUTONOMY_POLICY_SYNC_METHOD_INVALID") {
    return response(405, { ok: false, error: "method_not_allowed" }, true);
  }
  if (code === "GROWTH_AUTONOMY_POLICY_SYNC_PATH_INVALID") {
    return response(404, { ok: false, error: "not_found" });
  }
  if (code === "GROWTH_AUTONOMY_POLICY_SYNC_CONTENT_TYPE_INVALID") {
    return response(415, { ok: false, error: "unsupported_media_type" });
  }
  if (code === "GROWTH_AUTONOMY_POLICY_SYNC_BODY_TOO_LARGE") {
    return response(413, { ok: false, error: "request_too_large" });
  }
  if (authenticationFailure(code)) {
    return response(401, { ok: false, error: "request_rejected" });
  }
  if (
    code === "GROWTH_AUTONOMY_POLICY_SYNC_REQUEST_REPLAY" ||
    code === "GROWTH_AUTONOMY_POLICY_SYNC_VERSION_CONFLICT"
  ) {
    return response(409, { ok: false, error: "request_conflict" });
  }
  return response(503, { ok: false, error: "temporarily_unavailable" });
}

function success(
  value: GrowthAutonomyPolicySyncAcceptance,
): GrowthAutonomyPolicySyncResponse {
  return response(200, {
    ok: true,
    contractVersion: GROWTH_AUTONOMY_POLICY_SYNC_D1_VERSION,
    policyVersion: value.policyVersion,
    profile: value.profile,
    changed: value.changed,
    receivedAt: value.receivedAt,
  });
}

export function createGrowthAutonomyPolicySyncReceiver(
  dependencies: GrowthAutonomyPolicySyncReceiverDependencies,
): Readonly<{
  contractVersion: typeof GROWTH_AUTONOMY_POLICY_SYNC_RECEIVER_VERSION;
  handle(
    request: GrowthAutonomyPolicySyncRequest,
  ): Promise<GrowthAutonomyPolicySyncResponse>;
}> {
  assertGrowthAutonomyPolicySyncKeyRegistry(dependencies.keyRegistry);
  const repository = dependency(dependencies.repository);
  if (dependencies.clock !== undefined && typeof dependencies.clock !== "function") {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_RECEIVER_CLOCK_INVALID");
  }

  async function handle(
    request: GrowthAutonomyPolicySyncRequest,
  ): Promise<GrowthAutonomyPolicySyncResponse> {
    try {
      if (request.method !== "POST") fail("GROWTH_AUTONOMY_POLICY_SYNC_METHOD_INVALID");
      if (request.pathname !== GROWTH_AUTONOMY_POLICY_SYNC_PATH) {
        fail("GROWTH_AUTONOMY_POLICY_SYNC_PATH_INVALID");
      }
      const contentType = request.headers instanceof Headers
        ? request.headers.get("content-type")
        : Object.entries(request.headers).find(
            ([name]) => name.toLowerCase() === "content-type",
          )?.[1];
      if (contentType !== GROWTH_AUTONOMY_POLICY_SYNC_CONTENT_TYPE) {
        fail("GROWTH_AUTONOMY_POLICY_SYNC_CONTENT_TYPE_INVALID");
      }
      const rawBody = await readRawBody({
        source: request.bodySource,
        ...(request.signal ? { signal: request.signal } : {}),
      });
      const verified = await verifyGrowthAutonomyPolicySyncRequest({
        method: request.method,
        pathname: request.pathname,
        headers: request.headers,
        rawBody,
        keyRegistry: dependencies.keyRegistry,
        now: canonicalNow(dependencies.clock),
      });
      return success(await repository.acceptVerified(verified));
    } catch (error) {
      return failure(error);
    }
  }

  return Object.freeze({
    contractVersion: GROWTH_AUTONOMY_POLICY_SYNC_RECEIVER_VERSION,
    handle,
  });
}

export function createGrowthAutonomyPolicySyncReceiverFromEnvironment(
  options: GrowthAutonomyPolicySyncReceiverFromEnvironmentOptions,
): ReturnType<typeof createGrowthAutonomyPolicySyncReceiver> {
  const registry = parseGrowthAutonomyPolicySyncKeyConfigurationJson(
    options.environment.EVAVO_GROWTH_AUTONOMY_POLICY_SYNC_KEYS_JSON,
    { now: canonicalNow(options.clock) },
  );
  return createGrowthAutonomyPolicySyncReceiver({
    keyRegistry: registry,
    repository: new GrowthAutonomyPolicySyncD1Repository({
      database: options.database,
      ...(options.clock ? { clock: options.clock } : {}),
    }),
    ...(options.clock ? { clock: options.clock } : {}),
  });
}
