import {
  parseGrowthAutonomyPolicy,
  type GrowthAutonomyPolicy,
} from "./growthAutonomyPolicy";
import { copyBytesToArrayBuffer } from "./cryptoBufferSource";

export const GROWTH_AUTONOMY_POLICY_SYNC_VERSION =
  "growth_autonomy_policy_sync_v1" as const;
export const GROWTH_AUTONOMY_POLICY_SYNC_REQUEST_VERSION =
  "growth_autonomy_policy_sync_request_v1" as const;
export const GROWTH_AUTONOMY_POLICY_SYNC_KEY_REGISTRY_VERSION =
  "growth_autonomy_policy_sync_key_registry_v1" as const;
export const GROWTH_AUTONOMY_POLICY_SYNC_PATH =
  "/admin/growth/autonomy/policy-sync" as const;
export const GROWTH_AUTONOMY_POLICY_SYNC_CONTENT_TYPE =
  "application/json" as const;
export const GROWTH_AUTONOMY_POLICY_SYNC_MAX_BODY_BYTES = 32_000;
export const GROWTH_AUTONOMY_POLICY_SYNC_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;
export const GROWTH_AUTONOMY_POLICY_SYNC_MAX_CLOCK_SKEW_MS = 5 * 60 * 1_000;

export type GrowthAutonomyPolicySyncPacket = Readonly<{
  contractVersion: typeof GROWTH_AUTONOMY_POLICY_SYNC_VERSION;
  sourceSystem: "next-website";
  targetSystem: "evavo-worker-agent";
  organisationId: string;
  workspaceId: string;
  policyVersion: number;
  sourceUpdatedAt: string;
  policySha256: string;
  idempotencyKey: string;
  policy: GrowthAutonomyPolicy;
}>;

export type GrowthAutonomyPolicySyncKeyState = "active" | "retiring";

export type GrowthAutonomyPolicySyncSigningKey = Readonly<{
  keyId: string;
  secret: string;
  organisationId: string;
  workspaceId: string;
  state: GrowthAutonomyPolicySyncKeyState;
  notBefore: string;
  expiresAt: string;
}>;

export type GrowthAutonomyPolicySyncKeyRegistry = Readonly<{
  contractVersion: typeof GROWTH_AUTONOMY_POLICY_SYNC_KEY_REGISTRY_VERSION;
  activeKeyForTenant(
    organisationId: string,
    workspaceId: string,
  ): GrowthAutonomyPolicySyncSigningKey | null;
  verificationKeys(): readonly GrowthAutonomyPolicySyncSigningKey[];
  summary(): Readonly<{
    contractVersion: typeof GROWTH_AUTONOMY_POLICY_SYNC_KEY_REGISTRY_VERSION;
    keyCount: number;
    activeKeyCount: number;
    retiringKeyCount: number;
    tenantCount: number;
    acceptsRetiringKeys: true;
    exposesSecrets: false;
  }>;
  toJSON(): ReturnType<GrowthAutonomyPolicySyncKeyRegistry["summary"]>;
}>;

export type GrowthAutonomyPolicySyncVerifiedRequest = Readonly<{
  contractVersion: typeof GROWTH_AUTONOMY_POLICY_SYNC_REQUEST_VERSION;
  keyId: string;
  requestId: string;
  timestamp: number;
  signedAt: string;
  nonce: string;
  bodySha256: string;
  packet: GrowthAutonomyPolicySyncPacket;
}>;

export type GrowthAutonomyPolicySyncHeaderSource =
  | Headers
  | Readonly<Record<string, string | readonly string[] | undefined>>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{14,158}[A-Za-z0-9]$/;
const KEY_ID_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const HEX_64_PATTERN = /^[0-9a-f]{64}$/;
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const PACKET_KEYS = Object.freeze([
  "contractVersion",
  "idempotencyKey",
  "organisationId",
  "policy",
  "policySha256",
  "policyVersion",
  "sourceSystem",
  "sourceUpdatedAt",
  "targetSystem",
  "workspaceId",
] as const);
const CONFIG_KEYS = Object.freeze(["contractVersion", "keys"] as const);
const KEY_KEYS = Object.freeze([
  "expiresAt",
  "keyId",
  "notBefore",
  "organisationId",
  "secret",
  "state",
  "workspaceId",
] as const);
const MAX_KEYS = 8;
const MIN_SECRET_BYTES = 32;
const MAX_SECRET_BYTES = 512;
const MAX_KEY_LIFETIME_MS = 180 * 24 * 60 * 60 * 1_000;
const MAX_RETIRING_REMAINING_MS = 7 * 24 * 60 * 60 * 1_000;
const MIN_ACTIVE_REMAINING_MS = 5 * 60 * 1_000;
const REGISTRY_CONSTRUCTION_TOKEN = Object.freeze({});
const VERIFIED_REGISTRIES = new WeakSet<object>();
const VERIFIED_REQUESTS = new WeakSet<object>();
const STRICT_UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
const ENCODER = new TextEncoder();

function fail(code: string): never {
  throw new Error(code);
}

function objectValue(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value as Record<string, unknown>;
}

function exactKeys(
  record: Record<string, unknown>,
  expected: readonly string[],
  code: string,
): void {
  const actual = Object.keys(record).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) {
    fail(code);
  }
}

function uuid(value: unknown, code: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) fail(code);
  return value.toLowerCase();
}

function identifier(value: unknown, code: string): string {
  if (
    typeof value !== "string" ||
    !IDENTIFIER_PATTERN.test(value) ||
    value.includes("..")
  ) {
    fail(code);
  }
  return value;
}

function keyId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !KEY_ID_PATTERN.test(value) ||
    value.includes("..")
  ) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_KEY_ID_INVALID");
  }
  return value;
}

function canonicalTimestamp(value: unknown, code: string): Readonly<{
  iso: string;
  milliseconds: number;
}> {
  if (typeof value !== "string" || !UTC_TIMESTAMP_PATTERN.test(value)) fail(code);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) fail(code);
  const iso = new Date(milliseconds).toISOString();
  if (iso !== value) fail(code);
  return Object.freeze({ iso, milliseconds });
}

function canonicalNow(value: Date | undefined, code: string): Date {
  const result = value ?? new Date();
  if (!(result instanceof Date) || !Number.isFinite(result.getTime())) fail(code);
  return new Date(result.getTime());
}

function policyVersion(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_POLICY_VERSION_INVALID");
  }
  return Number(value);
}

function secret(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    /\p{Cc}/u.test(value)
  ) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_SECRET_INVALID");
  }
  const byteLength = ENCODER.encode(value).byteLength;
  if (byteLength < MIN_SECRET_BYTES || byteLength > MAX_SECRET_BYTES) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_SECRET_INVALID");
  }
  return value;
}

function canonicalPolicyJson(policy: GrowthAutonomyPolicy): string {
  return JSON.stringify(parseGrowthAutonomyPolicy(policy));
}

async function sha256Hex(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === "string" ? ENCODER.encode(value) : value;
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", copyBytesToArrayBuffer(bytes)),
  );
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexBytes(value: string, code: string): Uint8Array<ArrayBuffer> {
  if (!HEX_64_PATTERN.test(value)) fail(code);
  const result = new Uint8Array(new ArrayBuffer(32));
  for (let index = 0; index < 32; index += 1) {
    result[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return result;
}

async function importHmacKey(value: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    copyBytesToArrayBuffer(ENCODER.encode(value)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

function canonicalRequest(input: {
  keyId: string;
  requestId: string;
  timestamp: number;
  nonce: string;
  bodySha256: string;
}): string {
  return [
    GROWTH_AUTONOMY_POLICY_SYNC_REQUEST_VERSION,
    "POST",
    GROWTH_AUTONOMY_POLICY_SYNC_PATH,
    GROWTH_AUTONOMY_POLICY_SYNC_CONTENT_TYPE,
    input.keyId,
    input.requestId,
    String(input.timestamp),
    input.nonce,
    input.bodySha256,
  ].join("\n");
}

function packetIdempotencyKey(
  organisationId: string,
  workspaceId: string,
  version: number,
): string {
  return `growth-autonomy-policy:${organisationId}:${workspaceId}:v${version}`;
}

export async function parseGrowthAutonomyPolicySyncPacket(
  value: unknown,
  options: Readonly<{ now?: Date }> = {},
): Promise<GrowthAutonomyPolicySyncPacket> {
  const record = objectValue(value, "GROWTH_AUTONOMY_POLICY_SYNC_PACKET_INVALID");
  exactKeys(record, PACKET_KEYS, "GROWTH_AUTONOMY_POLICY_SYNC_PACKET_FIELDS_INVALID");
  if (
    record.contractVersion !== GROWTH_AUTONOMY_POLICY_SYNC_VERSION ||
    record.sourceSystem !== "next-website" ||
    record.targetSystem !== "evavo-worker-agent"
  ) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_PACKET_INVALID");
  }
  const organisationId = uuid(
    record.organisationId,
    "GROWTH_AUTONOMY_POLICY_SYNC_ORGANISATION_INVALID",
  );
  const workspaceId = uuid(
    record.workspaceId,
    "GROWTH_AUTONOMY_POLICY_SYNC_WORKSPACE_INVALID",
  );
  const version = policyVersion(record.policyVersion);
  const updatedAt = canonicalTimestamp(
    record.sourceUpdatedAt,
    "GROWTH_AUTONOMY_POLICY_SYNC_UPDATED_AT_INVALID",
  );
  const now = canonicalNow(options.now, "GROWTH_AUTONOMY_POLICY_SYNC_NOW_INVALID").getTime();
  if (updatedAt.milliseconds > now + GROWTH_AUTONOMY_POLICY_SYNC_MAX_CLOCK_SKEW_MS) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_UPDATED_AT_FUTURE");
  }
  if (updatedAt.milliseconds < now - GROWTH_AUTONOMY_POLICY_SYNC_MAX_AGE_MS) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_UPDATED_AT_STALE");
  }
  if (
    typeof record.policySha256 !== "string" ||
    !HEX_64_PATTERN.test(record.policySha256)
  ) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_POLICY_HASH_INVALID");
  }
  const expectedIdempotencyKey = packetIdempotencyKey(
    organisationId,
    workspaceId,
    version,
  );
  if (
    identifier(
      record.idempotencyKey,
      "GROWTH_AUTONOMY_POLICY_SYNC_IDEMPOTENCY_INVALID",
    ) !== expectedIdempotencyKey
  ) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_IDEMPOTENCY_INVALID");
  }
  const policy = parseGrowthAutonomyPolicy(record.policy);
  if (await sha256Hex(canonicalPolicyJson(policy)) !== record.policySha256) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_POLICY_HASH_MISMATCH");
  }
  return Object.freeze({
    contractVersion: GROWTH_AUTONOMY_POLICY_SYNC_VERSION,
    sourceSystem: "next-website",
    targetSystem: "evavo-worker-agent",
    organisationId,
    workspaceId,
    policyVersion: version,
    sourceUpdatedAt: updatedAt.iso,
    policySha256: record.policySha256,
    idempotencyKey: expectedIdempotencyKey,
    policy,
  });
}

class GrowthAutonomyPolicySyncKeyRegistryImplementation
implements GrowthAutonomyPolicySyncKeyRegistry {
  readonly contractVersion = GROWTH_AUTONOMY_POLICY_SYNC_KEY_REGISTRY_VERSION;
  private readonly keys: readonly GrowthAutonomyPolicySyncSigningKey[];

  constructor(
    token: object,
    keys: readonly GrowthAutonomyPolicySyncSigningKey[],
  ) {
    if (token !== REGISTRY_CONSTRUCTION_TOKEN) {
      fail("GROWTH_AUTONOMY_POLICY_SYNC_KEY_REGISTRY_CONSTRUCTION_INVALID");
    }
    this.keys = keys;
    VERIFIED_REGISTRIES.add(this);
    Object.freeze(this);
  }

  activeKeyForTenant(
    organisationIdInput: string,
    workspaceIdInput: string,
  ): GrowthAutonomyPolicySyncSigningKey | null {
    assertGrowthAutonomyPolicySyncKeyRegistry(this);
    const organisationId = uuid(
      organisationIdInput,
      "GROWTH_AUTONOMY_POLICY_SYNC_ORGANISATION_INVALID",
    );
    const workspaceId = uuid(
      workspaceIdInput,
      "GROWTH_AUTONOMY_POLICY_SYNC_WORKSPACE_INVALID",
    );
    return this.keys.find((key) =>
      key.organisationId === organisationId &&
      key.workspaceId === workspaceId &&
      key.state === "active") ?? null;
  }

  verificationKeys(): readonly GrowthAutonomyPolicySyncSigningKey[] {
    assertGrowthAutonomyPolicySyncKeyRegistry(this);
    return this.keys;
  }

  summary(): ReturnType<GrowthAutonomyPolicySyncKeyRegistry["summary"]> {
    assertGrowthAutonomyPolicySyncKeyRegistry(this);
    return Object.freeze({
      contractVersion: GROWTH_AUTONOMY_POLICY_SYNC_KEY_REGISTRY_VERSION,
      keyCount: this.keys.length,
      activeKeyCount: this.keys.filter((key) => key.state === "active").length,
      retiringKeyCount: this.keys.filter((key) => key.state === "retiring").length,
      tenantCount: new Set(
        this.keys.map((key) => `${key.organisationId}:${key.workspaceId}`),
      ).size,
      acceptsRetiringKeys: true,
      exposesSecrets: false,
    });
  }

  toJSON(): ReturnType<GrowthAutonomyPolicySyncKeyRegistry["summary"]> {
    return this.summary();
  }
}

export function assertGrowthAutonomyPolicySyncKeyRegistry(
  value: GrowthAutonomyPolicySyncKeyRegistry,
): void {
  if (!value || typeof value !== "object" || !VERIFIED_REGISTRIES.has(value)) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_KEY_REGISTRY_UNVERIFIED");
  }
}

export function parseGrowthAutonomyPolicySyncKeyConfiguration(
  value: unknown,
  options: Readonly<{ now?: Date }> = {},
): GrowthAutonomyPolicySyncKeyRegistry {
  const record = objectValue(value, "GROWTH_AUTONOMY_POLICY_SYNC_KEY_CONFIG_INVALID");
  exactKeys(record, CONFIG_KEYS, "GROWTH_AUTONOMY_POLICY_SYNC_KEY_CONFIG_FIELDS_INVALID");
  if (record.contractVersion !== GROWTH_AUTONOMY_POLICY_SYNC_KEY_REGISTRY_VERSION) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_KEY_CONFIG_INVALID");
  }
  if (!Array.isArray(record.keys) || record.keys.length < 1 || record.keys.length > MAX_KEYS) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_KEY_COUNT_INVALID");
  }
  const now = canonicalNow(options.now, "GROWTH_AUTONOMY_POLICY_SYNC_KEY_NOW_INVALID").getTime();
  const seenKeyIds = new Set<string>();
  const seenSecrets = new Set<string>();
  const activeCounts = new Map<string, number>();
  const retiringCounts = new Map<string, number>();
  const keys = Object.freeze(record.keys.map((entry) => {
    const keyRecord = objectValue(entry, "GROWTH_AUTONOMY_POLICY_SYNC_KEY_INVALID");
    exactKeys(keyRecord, KEY_KEYS, "GROWTH_AUTONOMY_POLICY_SYNC_KEY_FIELDS_INVALID");
    const observedKeyId = keyId(keyRecord.keyId);
    const observedSecret = secret(keyRecord.secret);
    const organisationId = uuid(
      keyRecord.organisationId,
      "GROWTH_AUTONOMY_POLICY_SYNC_KEY_TENANT_INVALID",
    );
    const workspaceId = uuid(
      keyRecord.workspaceId,
      "GROWTH_AUTONOMY_POLICY_SYNC_KEY_TENANT_INVALID",
    );
    if (keyRecord.state !== "active" && keyRecord.state !== "retiring") {
      fail("GROWTH_AUTONOMY_POLICY_SYNC_KEY_STATE_INVALID");
    }
    const notBefore = canonicalTimestamp(
      keyRecord.notBefore,
      "GROWTH_AUTONOMY_POLICY_SYNC_KEY_WINDOW_INVALID",
    );
    const expiresAt = canonicalTimestamp(
      keyRecord.expiresAt,
      "GROWTH_AUTONOMY_POLICY_SYNC_KEY_WINDOW_INVALID",
    );
    if (
      expiresAt.milliseconds <= notBefore.milliseconds ||
      expiresAt.milliseconds - notBefore.milliseconds > MAX_KEY_LIFETIME_MS ||
      notBefore.milliseconds > now ||
      expiresAt.milliseconds <= now
    ) {
      fail("GROWTH_AUTONOMY_POLICY_SYNC_KEY_WINDOW_INVALID");
    }
    if (
      keyRecord.state === "active" &&
      expiresAt.milliseconds - now < MIN_ACTIVE_REMAINING_MS
    ) {
      fail("GROWTH_AUTONOMY_POLICY_SYNC_ACTIVE_KEY_EXPIRING");
    }
    if (
      keyRecord.state === "retiring" &&
      expiresAt.milliseconds - now > MAX_RETIRING_REMAINING_MS
    ) {
      fail("GROWTH_AUTONOMY_POLICY_SYNC_RETIRING_KEY_WINDOW_INVALID");
    }
    if (seenKeyIds.has(observedKeyId) || seenSecrets.has(observedSecret)) {
      fail("GROWTH_AUTONOMY_POLICY_SYNC_KEY_DUPLICATE");
    }
    seenKeyIds.add(observedKeyId);
    seenSecrets.add(observedSecret);
    const tenant = `${organisationId}:${workspaceId}`;
    const counts = keyRecord.state === "active" ? activeCounts : retiringCounts;
    counts.set(tenant, (counts.get(tenant) ?? 0) + 1);
    return Object.freeze({
      keyId: observedKeyId,
      secret: observedSecret,
      organisationId,
      workspaceId,
      state: keyRecord.state,
      notBefore: notBefore.iso,
      expiresAt: expiresAt.iso,
    });
  }));
  const tenants = new Set(keys.map((key) => `${key.organisationId}:${key.workspaceId}`));
  for (const tenant of tenants) {
    if (activeCounts.get(tenant) !== 1 || (retiringCounts.get(tenant) ?? 0) > 1) {
      fail("GROWTH_AUTONOMY_POLICY_SYNC_KEY_TENANT_SET_INVALID");
    }
  }
  return new GrowthAutonomyPolicySyncKeyRegistryImplementation(
    REGISTRY_CONSTRUCTION_TOKEN,
    keys,
  );
}

export function parseGrowthAutonomyPolicySyncKeyConfigurationJson(
  value: string | undefined,
  options: Readonly<{ now?: Date }> = {},
): GrowthAutonomyPolicySyncKeyRegistry {
  if (typeof value !== "string" || !value || value.length > 16_000) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_KEY_CONFIG_JSON_INVALID");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_KEY_CONFIG_JSON_INVALID");
  }
  return parseGrowthAutonomyPolicySyncKeyConfiguration(parsed, options);
}

function headerValue(
  source: GrowthAutonomyPolicySyncHeaderSource,
  name: string,
): string | null {
  if (source instanceof Headers) return source.get(name);
  const matches = Object.entries(source).filter(
    ([key]) => key.toLowerCase() === name,
  );
  if (matches.length !== 1) return null;
  const value = matches[0]?.[1];
  return typeof value === "string" ? value : null;
}

export function assertVerifiedGrowthAutonomyPolicySyncRequest(
  value: GrowthAutonomyPolicySyncVerifiedRequest,
): void {
  if (!value || typeof value !== "object" || !VERIFIED_REQUESTS.has(value)) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_REQUEST_UNVERIFIED");
  }
}

export async function verifyGrowthAutonomyPolicySyncRequest(input: {
  method: unknown;
  pathname: unknown;
  headers: GrowthAutonomyPolicySyncHeaderSource;
  rawBody: Uint8Array;
  keyRegistry: GrowthAutonomyPolicySyncKeyRegistry;
  now?: Date;
}): Promise<GrowthAutonomyPolicySyncVerifiedRequest> {
  assertGrowthAutonomyPolicySyncKeyRegistry(input.keyRegistry);
  if (input.method !== "POST") fail("GROWTH_AUTONOMY_POLICY_SYNC_METHOD_INVALID");
  if (input.pathname !== GROWTH_AUTONOMY_POLICY_SYNC_PATH) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_PATH_INVALID");
  }
  if (headerValue(input.headers, "content-type") !== GROWTH_AUTONOMY_POLICY_SYNC_CONTENT_TYPE) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_CONTENT_TYPE_INVALID");
  }
  if (
    headerValue(input.headers, "x-evavo-growth-policy-sync-contract-version") !==
    GROWTH_AUTONOMY_POLICY_SYNC_REQUEST_VERSION
  ) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_REQUEST_VERSION_INVALID");
  }
  if (!(input.rawBody instanceof Uint8Array)) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_BODY_INVALID");
  }
  if (
    input.rawBody.byteLength < 2 ||
    input.rawBody.byteLength > GROWTH_AUTONOMY_POLICY_SYNC_MAX_BODY_BYTES
  ) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_BODY_TOO_LARGE");
  }
  const observedKeyId = keyId(
    headerValue(input.headers, "x-evavo-growth-policy-sync-key-id"),
  );
  const requestId = identifier(
    headerValue(input.headers, "x-evavo-growth-policy-sync-request-id"),
    "GROWTH_AUTONOMY_POLICY_SYNC_REQUEST_ID_INVALID",
  );
  const timestampText = headerValue(input.headers, "x-evavo-growth-policy-sync-timestamp");
  if (typeof timestampText !== "string" || !/^\d{10}$/.test(timestampText)) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_TIMESTAMP_INVALID");
  }
  const timestamp = Number(timestampText);
  if (!Number.isSafeInteger(timestamp)) fail("GROWTH_AUTONOMY_POLICY_SYNC_TIMESTAMP_INVALID");
  const nonce = headerValue(input.headers, "x-evavo-growth-policy-sync-nonce");
  if (typeof nonce !== "string" || !NONCE_PATTERN.test(nonce)) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_NONCE_INVALID");
  }
  const suppliedBodySha256 = headerValue(
    input.headers,
    "x-evavo-growth-policy-sync-content-sha256",
  );
  if (typeof suppliedBodySha256 !== "string" || !HEX_64_PATTERN.test(suppliedBodySha256)) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_BODY_HASH_INVALID");
  }
  const actualBodySha256 = await sha256Hex(input.rawBody);
  if (actualBodySha256 !== suppliedBodySha256) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_BODY_HASH_MISMATCH");
  }
  const signatureHeader = headerValue(
    input.headers,
    "x-evavo-growth-policy-sync-signature",
  );
  if (
    typeof signatureHeader !== "string" ||
    !/^sha256=[0-9a-f]{64}$/.test(signatureHeader)
  ) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_SIGNATURE_INVALID");
  }
  const now = canonicalNow(input.now, "GROWTH_AUTONOMY_POLICY_SYNC_REQUEST_TIME_INVALID");
  if (Math.abs(now.getTime() - timestamp * 1_000) > GROWTH_AUTONOMY_POLICY_SYNC_MAX_CLOCK_SKEW_MS) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_TIMESTAMP_INVALID");
  }
  const signingKey = input.keyRegistry.verificationKeys().find(
    (key) => key.keyId === observedKeyId,
  );
  if (
    !signingKey ||
    Date.parse(signingKey.notBefore) > now.getTime() ||
    Date.parse(signingKey.expiresAt) <= now.getTime()
  ) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_KEY_UNKNOWN");
  }
  const canonical = canonicalRequest({
    keyId: observedKeyId,
    requestId,
    timestamp,
    nonce,
    bodySha256: suppliedBodySha256,
  });
  const key = await importHmacKey(signingKey.secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    copyBytesToArrayBuffer(
      hexBytes(
        signatureHeader.slice("sha256=".length),
        "GROWTH_AUTONOMY_POLICY_SYNC_SIGNATURE_INVALID",
      ),
    ),
    copyBytesToArrayBuffer(ENCODER.encode(canonical)),
  );
  if (!valid) fail("GROWTH_AUTONOMY_POLICY_SYNC_SIGNATURE_INVALID");

  let bodyText: string;
  let parsed: unknown;
  try {
    bodyText = STRICT_UTF8_DECODER.decode(input.rawBody);
    parsed = JSON.parse(bodyText);
  } catch {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_BODY_INVALID");
  }
  const packet = await parseGrowthAutonomyPolicySyncPacket(parsed, { now });
  if (JSON.stringify(packet) !== bodyText) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_BODY_NONCANONICAL");
  }
  if (
    packet.organisationId !== signingKey.organisationId ||
    packet.workspaceId !== signingKey.workspaceId
  ) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_KEY_TENANT_MISMATCH");
  }
  const verified = Object.freeze({
    contractVersion: GROWTH_AUTONOMY_POLICY_SYNC_REQUEST_VERSION,
    keyId: observedKeyId,
    requestId,
    timestamp,
    signedAt: new Date(timestamp * 1_000).toISOString(),
    nonce,
    bodySha256: suppliedBodySha256,
    packet,
  });
  VERIFIED_REQUESTS.add(verified);
  return verified;
}
