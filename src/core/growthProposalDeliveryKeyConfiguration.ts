export const GROWTH_PROPOSAL_DELIVERY_KEY_REGISTRY_VERSION = "growth_worker_key_registry_v1" as const;
export const GROWTH_PROPOSAL_DELIVERY_KEYS_BINDING = "EVAVO_GROWTH_WORKER_PROPOSAL_KEYS_JSON" as const;
export const GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_MAX_BYTES = 16_000;
export const GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_MAX_KEYS = 8;
export const GROWTH_PROPOSAL_DELIVERY_KEY_MAX_LIFETIME_MS = 180 * 24 * 60 * 60 * 1_000;
export const GROWTH_PROPOSAL_DELIVERY_RETIRING_MAX_REMAINING_MS = 7 * 24 * 60 * 60 * 1_000;
export const GROWTH_PROPOSAL_DELIVERY_ACTIVE_MIN_REMAINING_MS = 5 * 60 * 1_000;

export type GrowthProposalDeliveryKeyState = "active" | "retiring";

export type GrowthProposalDeliverySigningKey = Readonly<{
  keyId: string;
  secret: string;
  organisationId: string;
  workspaceId: string;
}>;

export type GrowthProposalDeliveryKeyRegistrySummary = Readonly<{
  contractVersion: typeof GROWTH_PROPOSAL_DELIVERY_KEY_REGISTRY_VERSION;
  keyCount: number;
  activeKeyCount: number;
  retiringKeyCount: number;
  tenantCount: number;
  acceptsRetiringKeysForVerificationOnly: true;
  selectsRetiringKeysForSigning: false;
  exposesSecrets: false;
}>;

export type GrowthProposalDeliveryKeyRegistry = Readonly<{
  contractVersion: typeof GROWTH_PROPOSAL_DELIVERY_KEY_REGISTRY_VERSION;
  keyCount: number;
  activeKeyCount: number;
  retiringKeyCount: number;
  tenantCount: number;
  acceptsRetiringKeysForVerificationOnly: true;
  selectsRetiringKeysForSigning: false;
  exposesSecrets: false;
  activeSigningKeyForTenant(organisationId: string, workspaceId: string): GrowthProposalDeliverySigningKey | null;
  hasRetiringKeyForTenant(organisationId: string, workspaceId: string): boolean;
  summary(): GrowthProposalDeliveryKeyRegistrySummary;
  toJSON(): GrowthProposalDeliveryKeyRegistrySummary;
}>;

export class GrowthProposalDeliveryKeyConfigurationError extends Error {
  constructor(
    public readonly code: string,
    public readonly field: string,
  ) {
    super(`${code}:${field}`);
    this.name = "GrowthProposalDeliveryKeyConfigurationError";
  }
}

const REGISTRY_KEYS = Object.freeze(["contractVersion", "keys"] as const);
const ENTRY_KEYS = Object.freeze([
  "keyId",
  "secret",
  "organisationId",
  "workspaceId",
  "state",
  "notBefore",
  "expiresAt",
] as const);
const KEY_ID_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const encoder = new TextEncoder();
const REGISTRY_CONSTRUCTION_TOKEN = Symbol("growth-proposal-delivery-key-registry");
const VERIFIED_REGISTRIES = new WeakSet<object>();

type UnknownRecord = Record<string, unknown>;
type ParserOptions = Readonly<{ now?: Date }>;
type InternalKey = Readonly<{
  keyId: string;
  secret: string;
  organisationId: string;
  workspaceId: string;
  state: GrowthProposalDeliveryKeyState;
  notBefore: string;
  expiresAt: string;
  notBeforeMs: number;
  expiresAtMs: number;
  tenantKey: string;
}>;

function fail(code: string, field: string): never {
  throw new GrowthProposalDeliveryKeyConfigurationError(code, field);
}

function ensureWorkerOnly(): void {
  if (typeof window !== "undefined") fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_WORKER_ONLY", "runtime");
}

function objectValue(value: unknown, field: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_OBJECT_REQUIRED", field);
  }
  return value as UnknownRecord;
}

function requireExactKeys(record: UnknownRecord, expected: readonly string[], field: string): void {
  const actual = Object.keys(record).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) {
    fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_FIELD_SET_INVALID", field);
  }
}

function stringValue(record: UnknownRecord, field: string, maximum: number): string {
  const value = record[field];
  if (typeof value !== "string") fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_STRING_REQUIRED", field);
  if (!value || value.trim() !== value || value.length > maximum || /\p{Cc}/u.test(value)) {
    fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_STRING_INVALID", field);
  }
  return value;
}

function keyIdValue(record: UnknownRecord, field: string): string {
  const value = stringValue(record, field, 64);
  if (!KEY_ID_PATTERN.test(value) || value.includes("..")) {
    fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_KEY_ID_INVALID", field);
  }
  return value;
}

function secretValue(record: UnknownRecord, field: string): string {
  const value = stringValue(record, field, 512);
  const bytes = encoder.encode(value).byteLength;
  if (bytes < 32 || bytes > 512) {
    fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_SECRET_INVALID", field);
  }
  return value;
}

function uuidValue(record: UnknownRecord, field: string): string {
  const value = stringValue(record, field, 80);
  if (!UUID_PATTERN.test(value)) fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_UUID_INVALID", field);
  return value.toLowerCase();
}

function stateValue(record: UnknownRecord, field: string): GrowthProposalDeliveryKeyState {
  const value = record[field];
  if (value !== "active" && value !== "retiring") {
    fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_STATE_INVALID", field);
  }
  return value;
}

function timestampValue(record: UnknownRecord, field: string): Readonly<{ iso: string; milliseconds: number }> {
  const value = stringValue(record, field, 40);
  if (!UTC_TIMESTAMP_PATTERN.test(value)) fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_TIMESTAMP_INVALID", field);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_TIMESTAMP_INVALID", field);
  return Object.freeze({ iso: new Date(milliseconds).toISOString(), milliseconds });
}

function nowMilliseconds(value: Date | undefined): number {
  const now = value ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_NOW_INVALID", "now");
  }
  return now.getTime();
}

function tenantKey(organisationId: string, workspaceId: string): string {
  return `${organisationId}:${workspaceId}`;
}

function parseEntry(value: unknown, index: number, now: number): InternalKey {
  const field = `keys[${index}]`;
  const record = objectValue(value, field);
  requireExactKeys(record, ENTRY_KEYS, field);
  const keyId = keyIdValue(record, "keyId");
  const secret = secretValue(record, "secret");
  const organisationId = uuidValue(record, "organisationId");
  const workspaceId = uuidValue(record, "workspaceId");
  const state = stateValue(record, "state");
  const notBefore = timestampValue(record, "notBefore");
  const expiresAt = timestampValue(record, "expiresAt");

  if (notBefore.milliseconds >= expiresAt.milliseconds) {
    fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_WINDOW_INVALID", field);
  }
  if (expiresAt.milliseconds - notBefore.milliseconds > GROWTH_PROPOSAL_DELIVERY_KEY_MAX_LIFETIME_MS) {
    fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_LIFETIME_INVALID", field);
  }
  if (notBefore.milliseconds > now) {
    fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_NOT_ACTIVE", field);
  }
  if (expiresAt.milliseconds <= now) {
    fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_EXPIRED", field);
  }
  if (state === "active" && expiresAt.milliseconds - now < GROWTH_PROPOSAL_DELIVERY_ACTIVE_MIN_REMAINING_MS) {
    fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_ACTIVE_EXPIRY_TOO_SOON", field);
  }
  if (state === "retiring" && expiresAt.milliseconds - now > GROWTH_PROPOSAL_DELIVERY_RETIRING_MAX_REMAINING_MS) {
    fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_RETIRING_WINDOW_INVALID", field);
  }

  return Object.freeze({
    keyId,
    secret,
    organisationId,
    workspaceId,
    state,
    notBefore: notBefore.iso,
    expiresAt: expiresAt.iso,
    notBeforeMs: notBefore.milliseconds,
    expiresAtMs: expiresAt.milliseconds,
    tenantKey: tenantKey(organisationId, workspaceId),
  });
}

function signingKey(key: InternalKey): GrowthProposalDeliverySigningKey {
  return Object.freeze({
    keyId: key.keyId,
    secret: key.secret,
    organisationId: key.organisationId,
    workspaceId: key.workspaceId,
  });
}

class GrowthProposalDeliveryKeyRegistryImplementation implements GrowthProposalDeliveryKeyRegistry {
  readonly contractVersion = GROWTH_PROPOSAL_DELIVERY_KEY_REGISTRY_VERSION;
  readonly keyCount: number;
  readonly activeKeyCount: number;
  readonly retiringKeyCount: number;
  readonly tenantCount: number;
  readonly acceptsRetiringKeysForVerificationOnly = true as const;
  readonly selectsRetiringKeysForSigning = false as const;
  readonly exposesSecrets = false as const;
  #activeByTenant: ReadonlyMap<string, InternalKey>;
  #retiringTenants: ReadonlySet<string>;

  constructor(keys: readonly InternalKey[], token: symbol) {
    if (token !== REGISTRY_CONSTRUCTION_TOKEN) {
      fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_CONSTRUCTION_FORBIDDEN", "registry");
    }
    const activeByTenant = new Map<string, InternalKey>();
    const retiringTenants = new Set<string>();
    for (const key of keys) {
      if (key.state === "active") activeByTenant.set(key.tenantKey, key);
      else retiringTenants.add(key.tenantKey);
    }
    this.#activeByTenant = activeByTenant;
    this.#retiringTenants = retiringTenants;
    this.keyCount = keys.length;
    this.activeKeyCount = activeByTenant.size;
    this.retiringKeyCount = retiringTenants.size;
    this.tenantCount = activeByTenant.size;
    VERIFIED_REGISTRIES.add(this);
    Object.freeze(this);
  }

  activeSigningKeyForTenant(organisationId: string, workspaceId: string): GrowthProposalDeliverySigningKey | null {
    assertGrowthProposalDeliveryKeyRegistry(this);
    if (!UUID_PATTERN.test(organisationId) || !UUID_PATTERN.test(workspaceId)) {
      fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_UUID_INVALID", "tenant");
    }
    const key = this.#activeByTenant.get(tenantKey(organisationId.toLowerCase(), workspaceId.toLowerCase()));
    return key ? signingKey(key) : null;
  }

  hasRetiringKeyForTenant(organisationId: string, workspaceId: string): boolean {
    assertGrowthProposalDeliveryKeyRegistry(this);
    if (!UUID_PATTERN.test(organisationId) || !UUID_PATTERN.test(workspaceId)) {
      fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_UUID_INVALID", "tenant");
    }
    return this.#retiringTenants.has(tenantKey(organisationId.toLowerCase(), workspaceId.toLowerCase()));
  }

  summary(): GrowthProposalDeliveryKeyRegistrySummary {
    assertGrowthProposalDeliveryKeyRegistry(this);
    return Object.freeze({
      contractVersion: this.contractVersion,
      keyCount: this.keyCount,
      activeKeyCount: this.activeKeyCount,
      retiringKeyCount: this.retiringKeyCount,
      tenantCount: this.tenantCount,
      acceptsRetiringKeysForVerificationOnly: true,
      selectsRetiringKeysForSigning: false,
      exposesSecrets: false,
    });
  }

  toJSON(): GrowthProposalDeliveryKeyRegistrySummary {
    return this.summary();
  }
}

export function assertGrowthProposalDeliveryKeyRegistry(value: unknown): asserts value is GrowthProposalDeliveryKeyRegistry {
  if (!value || typeof value !== "object" || !VERIFIED_REGISTRIES.has(value as object)) {
    fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_REGISTRY_REQUIRED", "registry");
  }
}

export function parseGrowthProposalDeliveryKeyConfiguration(
  value: unknown,
  options: ParserOptions = {},
): GrowthProposalDeliveryKeyRegistry {
  ensureWorkerOnly();
  const now = nowMilliseconds(options.now);
  const record = objectValue(value, "configuration");
  requireExactKeys(record, REGISTRY_KEYS, "configuration");
  if (record.contractVersion !== GROWTH_PROPOSAL_DELIVERY_KEY_REGISTRY_VERSION) {
    fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_VERSION_INVALID", "contractVersion");
  }
  if (!Array.isArray(record.keys) || record.keys.length < 1 || record.keys.length > GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_MAX_KEYS) {
    fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_COUNT_INVALID", "keys");
  }

  const keys = record.keys.map((key, index) => parseEntry(key, index, now));
  const keyIds = new Set<string>();
  const secrets = new Set<string>();
  const tenantStates = new Map<string, { active: number; retiring: number }>();
  for (const key of keys) {
    if (keyIds.has(key.keyId)) fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_KEY_ID_DUPLICATE", "keyId");
    keyIds.add(key.keyId);
    if (secrets.has(key.secret)) fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_SECRET_REUSED", "secret");
    secrets.add(key.secret);
    const counts = tenantStates.get(key.tenantKey) ?? { active: 0, retiring: 0 };
    counts[key.state] += 1;
    tenantStates.set(key.tenantKey, counts);
  }

  for (const [scope, counts] of tenantStates) {
    if (counts.active !== 1) fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_ACTIVE_KEY_REQUIRED", scope);
    if (counts.retiring > 1) fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_RETIRING_KEY_LIMIT", scope);
  }

  return new GrowthProposalDeliveryKeyRegistryImplementation(
    Object.freeze(keys),
    REGISTRY_CONSTRUCTION_TOKEN,
  );
}

export function parseGrowthProposalDeliveryKeyConfigurationJson(
  raw: string,
  options: ParserOptions = {},
): GrowthProposalDeliveryKeyRegistry {
  ensureWorkerOnly();
  if (!raw || raw.trim() !== raw) {
    fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_JSON_INVALID", GROWTH_PROPOSAL_DELIVERY_KEYS_BINDING);
  }
  if (encoder.encode(raw).byteLength > GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_MAX_BYTES) {
    fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_JSON_TOO_LARGE", GROWTH_PROPOSAL_DELIVERY_KEYS_BINDING);
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    fail("GROWTH_PROPOSAL_DELIVERY_KEY_CONFIGURATION_JSON_INVALID", GROWTH_PROPOSAL_DELIVERY_KEYS_BINDING);
  }
  return parseGrowthProposalDeliveryKeyConfiguration(value, options);
}
