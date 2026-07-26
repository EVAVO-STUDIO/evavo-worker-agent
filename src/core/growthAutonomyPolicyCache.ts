import {
  GROWTH_AUTONOMY_POLICY_VERSION,
  defaultGrowthAutonomyPolicy,
  growthAutonomyPolicyForProfile,
  type GrowthAutonomyPolicy,
  type GrowthAutonomyProfile,
} from "./growthAutonomyPolicy";
import {
  GrowthAutonomyD1Ledger,
  type D1DatabaseLike,
} from "./growthAutonomyD1Ledger";
import {
  createGrowthAutonomyRuntime,
  type GrowthAutonomyRuntimeOptions,
} from "./growthAutonomyRuntime";

export const GROWTH_AUTONOMY_POLICY_CACHE_VERSION =
  "growth_autonomy_policy_cache_v1" as const;
export const GROWTH_AUTONOMY_POLICY_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

export type GrowthAutonomyPolicyCacheScope = Readonly<{
  organisationId: string;
  workspaceId: string;
}>;

export type GrowthAutonomyPolicyCacheResult = Readonly<{
  contractVersion: typeof GROWTH_AUTONOMY_POLICY_CACHE_VERSION;
  configured: boolean;
  stale: boolean;
  sourceVersion: number;
  sourceUpdatedAt: string | null;
  receivedAt: string | null;
  storedProfile: GrowthAutonomyProfile | null;
  effectivePolicy: GrowthAutonomyPolicy;
}>;

export type GrowthAutonomyPolicyCacheOptions = Readonly<{
  database: D1DatabaseLike;
  clock?: () => Date;
}>;

export type GrowthAutonomyRuntimeFromD1Options = Readonly<{
  database: D1DatabaseLike;
  scope: GrowthAutonomyPolicyCacheScope;
  clock?: () => Date;
  reservationIdFactory?: GrowthAutonomyRuntimeOptions["reservationIdFactory"];
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const PROFILES = new Set<GrowthAutonomyProfile>([
  "paused",
  "light",
  "balanced",
  "high",
]);
const POLICY_ROW_KEYS = Object.freeze([
  "contract_version",
  "organisation_id",
  "policy_sha256",
  "profile",
  "received_at",
  "source_updated_at",
  "source_version",
  "timezone",
  "workspace_id",
] as const);

const READ_POLICY_SQL = `
select
  organisation_id,
  workspace_id,
  contract_version,
  profile,
  timezone,
  source_version,
  source_updated_at,
  policy_sha256,
  received_at
from growth_autonomy_policy_cache
where organisation_id = ? and workspace_id = ?
limit 1
`;

function fail(code: string): never {
  throw new Error(code);
}

function database(value: unknown): D1DatabaseLike {
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as D1DatabaseLike).prepare !== "function" ||
    typeof (value as D1DatabaseLike).batch !== "function"
  ) {
    fail("GROWTH_AUTONOMY_POLICY_CACHE_DATABASE_INVALID");
  }
  return value as D1DatabaseLike;
}

function canonicalNow(clock: (() => Date) | undefined): Date {
  const now = clock ? clock() : new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    fail("GROWTH_AUTONOMY_POLICY_CACHE_TIME_INVALID");
  }
  return new Date(now.getTime());
}

function scopeValue(value: GrowthAutonomyPolicyCacheScope): GrowthAutonomyPolicyCacheScope {
  if (
    !value ||
    typeof value !== "object" ||
    !UUID_PATTERN.test(value.organisationId) ||
    !UUID_PATTERN.test(value.workspaceId)
  ) {
    fail("GROWTH_AUTONOMY_POLICY_CACHE_SCOPE_INVALID");
  }
  return Object.freeze({
    organisationId: value.organisationId.toLowerCase(),
    workspaceId: value.workspaceId.toLowerCase(),
  });
}

function objectValue(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value as Record<string, unknown>;
}

function exactKeys(record: Record<string, unknown>, expected: readonly string[], code: string): void {
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

function timestamp(value: unknown, code: string): string {
  if (typeof value !== "string" || value.length > 80) fail(code);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) fail(code);
  const canonical = new Date(milliseconds).toISOString();
  if (canonical !== value) fail(code);
  return canonical;
}

function profile(value: unknown): GrowthAutonomyProfile {
  if (typeof value !== "string" || !PROFILES.has(value as GrowthAutonomyProfile)) {
    fail("GROWTH_AUTONOMY_POLICY_CACHE_ROW_INVALID");
  }
  return value as GrowthAutonomyProfile;
}

function timezone(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length < 3 ||
    value.length > 64 ||
    /\p{Cc}/u.test(value)
  ) {
    fail("GROWTH_AUTONOMY_POLICY_CACHE_ROW_INVALID");
  }
  try {
    new Intl.DateTimeFormat("en-AU", { timeZone: value }).format(new Date(0));
  } catch {
    fail("GROWTH_AUTONOMY_POLICY_CACHE_ROW_INVALID");
  }
  return value;
}

function sourceVersion(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    fail("GROWTH_AUTONOMY_POLICY_CACHE_ROW_INVALID");
  }
  return Number(value);
}

function defaultResult(): GrowthAutonomyPolicyCacheResult {
  return Object.freeze({
    contractVersion: GROWTH_AUTONOMY_POLICY_CACHE_VERSION,
    configured: false,
    stale: false,
    sourceVersion: 0,
    sourceUpdatedAt: null,
    receivedAt: null,
    storedProfile: null,
    effectivePolicy: defaultGrowthAutonomyPolicy(),
  });
}

function parsePolicyRow(
  value: unknown,
  expectedScope: GrowthAutonomyPolicyCacheScope,
  now: Date,
): GrowthAutonomyPolicyCacheResult {
  const row = objectValue(value, "GROWTH_AUTONOMY_POLICY_CACHE_ROW_INVALID");
  exactKeys(row, POLICY_ROW_KEYS, "GROWTH_AUTONOMY_POLICY_CACHE_ROW_INVALID");
  if (
    uuid(row.organisation_id, "GROWTH_AUTONOMY_POLICY_CACHE_ROW_INVALID") !==
      expectedScope.organisationId ||
    uuid(row.workspace_id, "GROWTH_AUTONOMY_POLICY_CACHE_ROW_INVALID") !==
      expectedScope.workspaceId ||
    row.contract_version !== GROWTH_AUTONOMY_POLICY_VERSION ||
    typeof row.policy_sha256 !== "string" ||
    !HASH_PATTERN.test(row.policy_sha256)
  ) {
    fail("GROWTH_AUTONOMY_POLICY_CACHE_ROW_INVALID");
  }
  const storedProfile = profile(row.profile);
  const observedTimezone = timezone(row.timezone);
  const observedSourceVersion = sourceVersion(row.source_version);
  const sourceUpdatedAt = timestamp(
    row.source_updated_at,
    "GROWTH_AUTONOMY_POLICY_CACHE_ROW_INVALID",
  );
  const receivedAt = timestamp(
    row.received_at,
    "GROWTH_AUTONOMY_POLICY_CACHE_ROW_INVALID",
  );
  const sourceTime = Date.parse(sourceUpdatedAt);
  const receivedTime = Date.parse(receivedAt);
  if (
    sourceTime > receivedTime + 5 * 60 * 1_000 ||
    receivedTime > now.getTime() + 5 * 60 * 1_000
  ) {
    fail("GROWTH_AUTONOMY_POLICY_CACHE_TIME_ORDER_INVALID");
  }
  const stale = now.getTime() - sourceTime > GROWTH_AUTONOMY_POLICY_CACHE_MAX_AGE_MS;
  return Object.freeze({
    contractVersion: GROWTH_AUTONOMY_POLICY_CACHE_VERSION,
    configured: true,
    stale,
    sourceVersion: observedSourceVersion,
    sourceUpdatedAt,
    receivedAt,
    storedProfile,
    effectivePolicy: stale
      ? growthAutonomyPolicyForProfile("light", observedTimezone)
      : growthAutonomyPolicyForProfile(storedProfile, observedTimezone),
  });
}

export class GrowthAutonomyPolicyCache {
  readonly contractVersion = GROWTH_AUTONOMY_POLICY_CACHE_VERSION;
  private readonly db: D1DatabaseLike;
  private readonly clock?: () => Date;

  constructor(options: GrowthAutonomyPolicyCacheOptions) {
    this.db = database(options.database);
    if (options.clock !== undefined && typeof options.clock !== "function") {
      fail("GROWTH_AUTONOMY_POLICY_CACHE_CLOCK_INVALID");
    }
    this.clock = options.clock;
  }

  async read(input: GrowthAutonomyPolicyCacheScope): Promise<GrowthAutonomyPolicyCacheResult> {
    const observedScope = scopeValue(input);
    const now = canonicalNow(this.clock);
    let row: unknown;
    try {
      row = await this.db.prepare(READ_POLICY_SQL).bind(
        observedScope.organisationId,
        observedScope.workspaceId,
      ).first();
    } catch {
      fail("GROWTH_AUTONOMY_POLICY_CACHE_READ_FAILED");
    }
    return row === null ? defaultResult() : parsePolicyRow(row, observedScope, now);
  }
}

export async function createGrowthAutonomyRuntimeFromD1(
  options: GrowthAutonomyRuntimeFromD1Options,
): Promise<Readonly<{
  policyCache: GrowthAutonomyPolicyCacheResult;
  runtime: ReturnType<typeof createGrowthAutonomyRuntime>;
}>> {
  const observedScope = scopeValue(options.scope);
  const policyCache = await new GrowthAutonomyPolicyCache({
    database: options.database,
    ...(options.clock ? { clock: options.clock } : {}),
  }).read(observedScope);
  const ledger = new GrowthAutonomyD1Ledger({ database: options.database });
  const runtime = createGrowthAutonomyRuntime({
    policy: policyCache.effectivePolicy,
    ledger,
    ...(options.clock ? { clock: options.clock } : {}),
    ...(options.reservationIdFactory
      ? { reservationIdFactory: options.reservationIdFactory }
      : {}),
  });
  return Object.freeze({ policyCache, runtime });
}
