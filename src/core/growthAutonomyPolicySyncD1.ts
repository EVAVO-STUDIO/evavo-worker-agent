import {
  GROWTH_AUTONOMY_POLICY_SYNC_REQUEST_VERSION,
  assertVerifiedGrowthAutonomyPolicySyncRequest,
  type GrowthAutonomyPolicySyncVerifiedRequest,
} from "./growthAutonomyPolicySync";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "./growthAutonomyD1Ledger";

export const GROWTH_AUTONOMY_POLICY_SYNC_D1_VERSION =
  "growth_autonomy_policy_sync_d1_v1" as const;

export type GrowthAutonomyPolicySyncAcceptance = Readonly<{
  contractVersion: typeof GROWTH_AUTONOMY_POLICY_SYNC_D1_VERSION;
  organisationId: string;
  workspaceId: string;
  policyVersion: number;
  profile: "paused" | "light" | "balanced" | "high";
  changed: boolean;
  receivedAt: string;
}>;

export type GrowthAutonomyPolicySyncD1Options = Readonly<{
  database: D1DatabaseLike;
  clock?: () => Date;
}>;

const CLAIM_REQUEST_SQL = `
insert into growth_autonomy_policy_sync_requests (
  key_id,
  nonce,
  request_id,
  organisation_id,
  workspace_id,
  policy_version,
  policy_sha256,
  body_sha256,
  idempotency_key,
  changed,
  received_at
) values (
  ?, ?, ?, ?, ?, ?, ?, ?, ?,
  case
    when exists (
      select 1
        from growth_autonomy_policy_cache current
       where current.organisation_id = ?
         and current.workspace_id = ?
         and current.source_version = ?
         and current.policy_sha256 = ?
    ) then 0
    else 1
  end,
  ?
)
`;

const UPSERT_POLICY_SQL = `
insert into growth_autonomy_policy_cache (
  organisation_id,
  workspace_id,
  contract_version,
  profile,
  timezone,
  source_version,
  source_updated_at,
  policy_sha256,
  received_at
) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
on conflict (organisation_id, workspace_id) do update set
  contract_version = excluded.contract_version,
  profile = excluded.profile,
  timezone = excluded.timezone,
  source_version = excluded.source_version,
  source_updated_at = excluded.source_updated_at,
  policy_sha256 = excluded.policy_sha256,
  received_at = excluded.received_at
`;

const READ_ACCEPTANCE_SQL = `
select
  request.organisation_id,
  request.workspace_id,
  request.policy_version,
  request.changed,
  request.received_at,
  cache.profile,
  cache.source_version,
  cache.source_updated_at,
  cache.policy_sha256
from growth_autonomy_policy_sync_requests request
join growth_autonomy_policy_cache cache
  on cache.organisation_id = request.organisation_id
 and cache.workspace_id = request.workspace_id
where request.key_id = ? and request.request_id = ?
limit 1
`;

const ACCEPTANCE_KEYS = Object.freeze([
  "changed",
  "organisation_id",
  "policy_sha256",
  "policy_version",
  "profile",
  "received_at",
  "source_updated_at",
  "source_version",
  "workspace_id",
] as const);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const PROFILES = new Set(["paused", "light", "balanced", "high"] as const);

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
    fail("GROWTH_AUTONOMY_POLICY_SYNC_D1_DATABASE_INVALID");
  }
  return value as D1DatabaseLike;
}

function canonicalNow(clock: (() => Date) | undefined): string {
  const now = clock ? clock() : new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_D1_TIME_INVALID");
  }
  return new Date(now.getTime()).toISOString();
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

function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_D1_RESPONSE_INVALID");
  }
  return value.toLowerCase();
}

function version(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_D1_RESPONSE_INVALID");
  }
  return Number(value);
}

function timestamp(value: unknown): string {
  if (typeof value !== "string" || value.length > 80) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_D1_RESPONSE_INVALID");
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_D1_RESPONSE_INVALID");
  }
  const canonical = new Date(milliseconds).toISOString();
  if (canonical !== value) fail("GROWTH_AUTONOMY_POLICY_SYNC_D1_RESPONSE_INVALID");
  return canonical;
}

function stableD1Error(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("GROWTH_AUTONOMY_POLICY_SYNC_VERSION_CONFLICT")) {
    return "GROWTH_AUTONOMY_POLICY_SYNC_VERSION_CONFLICT";
  }
  if (
    message.includes("growth_autonomy_policy_sync_requests.key_id") ||
    message.includes("growth_autonomy_policy_sync_requests.request_id") ||
    message.includes("UNIQUE constraint failed")
  ) {
    return "GROWTH_AUTONOMY_POLICY_SYNC_REQUEST_REPLAY";
  }
  return "GROWTH_AUTONOMY_POLICY_SYNC_D1_FAILED";
}

function statements(
  db: D1DatabaseLike,
  request: GrowthAutonomyPolicySyncVerifiedRequest,
  receivedAt: string,
): readonly D1PreparedStatementLike[] {
  const packet = request.packet;
  return Object.freeze([
    db.prepare(CLAIM_REQUEST_SQL).bind(
      request.keyId,
      request.nonce,
      request.requestId,
      packet.organisationId,
      packet.workspaceId,
      packet.policyVersion,
      packet.policySha256,
      request.bodySha256,
      packet.idempotencyKey,
      packet.organisationId,
      packet.workspaceId,
      packet.policyVersion,
      packet.policySha256,
      receivedAt,
    ),
    db.prepare(UPSERT_POLICY_SQL).bind(
      packet.organisationId,
      packet.workspaceId,
      packet.policy.contractVersion,
      packet.policy.profile,
      packet.policy.timezone,
      packet.policyVersion,
      packet.sourceUpdatedAt,
      packet.policySha256,
      receivedAt,
    ),
  ]);
}

function parseAcceptance(
  value: unknown,
  request: GrowthAutonomyPolicySyncVerifiedRequest,
): GrowthAutonomyPolicySyncAcceptance {
  const row = objectValue(value, "GROWTH_AUTONOMY_POLICY_SYNC_D1_RESPONSE_INVALID");
  exactKeys(row, ACCEPTANCE_KEYS, "GROWTH_AUTONOMY_POLICY_SYNC_D1_RESPONSE_INVALID");
  const packet = request.packet;
  const organisationId = uuid(row.organisation_id);
  const workspaceId = uuid(row.workspace_id);
  const policyVersion = version(row.policy_version);
  const sourceVersion = version(row.source_version);
  const receivedAt = timestamp(row.received_at);
  const sourceUpdatedAt = timestamp(row.source_updated_at);
  if (
    organisationId !== packet.organisationId ||
    workspaceId !== packet.workspaceId ||
    policyVersion !== packet.policyVersion ||
    sourceVersion !== packet.policyVersion ||
    sourceUpdatedAt !== packet.sourceUpdatedAt ||
    row.policy_sha256 !== packet.policySha256 ||
    typeof row.policy_sha256 !== "string" ||
    !HASH_PATTERN.test(row.policy_sha256) ||
    typeof row.profile !== "string" ||
    !PROFILES.has(row.profile as GrowthAutonomyPolicySyncAcceptance["profile"]) ||
    row.profile !== packet.policy.profile ||
    (row.changed !== 0 && row.changed !== 1)
  ) {
    fail("GROWTH_AUTONOMY_POLICY_SYNC_D1_RESPONSE_INVALID");
  }
  return Object.freeze({
    contractVersion: GROWTH_AUTONOMY_POLICY_SYNC_D1_VERSION,
    organisationId,
    workspaceId,
    policyVersion,
    profile: row.profile as GrowthAutonomyPolicySyncAcceptance["profile"],
    changed: row.changed === 1,
    receivedAt,
  });
}

export class GrowthAutonomyPolicySyncD1Repository {
  readonly contractVersion = GROWTH_AUTONOMY_POLICY_SYNC_D1_VERSION;
  private readonly db: D1DatabaseLike;
  private readonly clock?: () => Date;

  constructor(options: GrowthAutonomyPolicySyncD1Options) {
    this.db = database(options.database);
    if (options.clock !== undefined && typeof options.clock !== "function") {
      fail("GROWTH_AUTONOMY_POLICY_SYNC_D1_CLOCK_INVALID");
    }
    this.clock = options.clock;
  }

  async acceptVerified(
    request: GrowthAutonomyPolicySyncVerifiedRequest,
  ): Promise<GrowthAutonomyPolicySyncAcceptance> {
    assertVerifiedGrowthAutonomyPolicySyncRequest(request);
    if (request.contractVersion !== GROWTH_AUTONOMY_POLICY_SYNC_REQUEST_VERSION) {
      fail("GROWTH_AUTONOMY_POLICY_SYNC_D1_REQUEST_INVALID");
    }
    const receivedAt = canonicalNow(this.clock);
    try {
      const results = await this.db.batch(statements(this.db, request, receivedAt));
      if (results.length !== 2) fail("GROWTH_AUTONOMY_POLICY_SYNC_D1_BATCH_INVALID");
      const row = await this.db.prepare(READ_ACCEPTANCE_SQL).bind(
        request.keyId,
        request.requestId,
      ).first();
      return parseAcceptance(row, request);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("GROWTH_AUTONOMY_POLICY_SYNC_D1_")
      ) {
        throw error;
      }
      fail(stableD1Error(error));
    }
  }
}
