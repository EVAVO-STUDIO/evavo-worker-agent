import assert from "node:assert/strict";
import test from "node:test";

import type { Env } from "../src/db";
import {
  GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION,
  assertGrowthActivityBudgetLedgerClaim,
  claimGrowthActivityBudget,
  completeGrowthActivityBudgetClaim,
  readGrowthActivityBudgetUsage,
  type GrowthActivityBudgetLedgerClaim,
} from "../src/core/growthActivityBudgetLedger";

const NOW = new Date("2026-07-26T04:00:00.000Z");
const CLAIM_ID = "growth-budget-claim:000000000001";
const HASH = "a".repeat(64);

type ClaimState = {
  status: "admitted" | "completed" | "failed";
  outcomeCode: string | null;
  completedAt: string | null;
};

class FakeStatement {
  private readonly values: unknown[] = [];

  constructor(
    private readonly database: FakeDatabase,
    readonly sql: string,
  ) {}

  bind(...values: unknown[]): this {
    this.values.push(...values);
    return this;
  }

  async first<T>(): Promise<T | null> {
    this.database.calls.push({ kind: "first", sql: this.sql, values: [...this.values] });
    if (this.sql.includes("FROM growth_activity_budget_usage_daily")) {
      return this.database.usageRow as T | null;
    }
    if (this.sql.includes("FROM growth_activity_budget_claims")) {
      const claimId = String(this.values[0] ?? "");
      const state = this.database.claims.get(claimId);
      return state
        ? ({
            claim_id: claimId,
            status: state.status,
            outcome_code: state.outcomeCode,
            completed_at_iso: state.completedAt,
          } as T)
        : null;
    }
    throw new Error(`UNEXPECTED_FIRST:${this.sql}`);
  }

  async run(): Promise<unknown> {
    this.database.calls.push({ kind: "run", sql: this.sql, values: [...this.values] });
    if (this.sql.includes("INSERT INTO growth_activity_budget_claims")) {
      if (this.database.insertError) throw this.database.insertError;
      const claimId = String(this.values[0]);
      if (this.database.claims.has(claimId)) throw new Error("UNIQUE constraint failed: growth_activity_budget_claims.claim_id");
      this.database.claims.set(claimId, {
        status: "admitted",
        outcomeCode: null,
        completedAt: null,
      });
      this.database.lastInsertValues = [...this.values];
      return { success: true };
    }
    if (this.sql.includes("UPDATE growth_activity_budget_claims")) {
      if (this.database.updateError) throw this.database.updateError;
      const [status, outcomeCode, completedAt, claimId] = this.values as [
        "completed" | "failed",
        string,
        string,
        string,
      ];
      const state = this.database.claims.get(claimId);
      if (state?.status === "admitted") {
        this.database.claims.set(claimId, { status, outcomeCode, completedAt });
      }
      return { success: true };
    }
    throw new Error(`UNEXPECTED_RUN:${this.sql}`);
  }
}

class FakeDatabase {
  readonly calls: Array<{ kind: "first" | "run"; sql: string; values: unknown[] }> = [];
  readonly claims = new Map<string, ClaimState>();
  usageRow: Record<string, unknown> | null = null;
  lastInsertValues: unknown[] | null = null;
  insertError: Error | null = null;
  updateError: Error | null = null;

  prepare(sql: string): FakeStatement {
    return new FakeStatement(this, sql);
  }
}

function environment(database: FakeDatabase): Env {
  return { DB: database as unknown as D1Database };
}

async function domainHash(domain: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(domain),
  ));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function admittedClaim(database: FakeDatabase): Promise<GrowthActivityBudgetLedgerClaim> {
  const result = await claimGrowthActivityBudget(environment(database), {
    claimId: CLAIM_ID,
    requestBodySha256: HASH,
    intensity: "light",
    action: "public_research_run",
    invocation: "manual",
    ownerApproved: true,
    explicitlyConfirmed: true,
    targetDomain: "example.com",
    now: NOW,
  });
  assert.equal(result.accepted, true);
  return result.claim;
}

test("empty ledger returns a fresh zero usage snapshot", async () => {
  const database = new FakeDatabase();
  const usage = await readGrowthActivityBudgetUsage(environment(database), {
    targetDomain: "example.com",
    now: NOW,
  });
  assert.equal(usage.contractVersion, "growth_activity_budget_v1");
  assert.equal(usage.utcDay, "2026-07-26");
  assert.equal(usage.capturedAt, NOW.toISOString());
  assert.equal(usage.counters.externalFetches, 0);
  assert.equal(usage.targetDomainFetches, 0);
  assert.equal(usage.consecutiveFetchFailures, 0);
  assert.equal(usage.lastExternalResearchAt, null);
  assert.equal(Object.isFrozen(usage), true);
  assert.equal(Object.isFrozen(usage.counters), true);
});

test("ledger reads only the hashed target-domain counters", async () => {
  const database = new FakeDatabase();
  const hash = await domainHash("example.com");
  database.usageRow = {
    counters_json: JSON.stringify({
      manualResearchRuns: 1,
      scheduledExternalResearchRuns: 0,
      externalFetches: 2,
      distinctDomains: 1,
      candidateWrites: 5,
      proposalWrites: 2,
      reportsGenerated: 0,
      workerRequests: 8,
      d1RowsRead: 2_000,
      d1RowsWritten: 100,
      queueOperations: 0,
      browserMinutes: 0,
      aiCalls: 0,
      paidServiceCalls: 0,
      externalActions: 0,
    }),
    domain_fetches_json: JSON.stringify({ [hash]: 2, other: 999 }),
    domain_failures_json: JSON.stringify({ [hash]: 1 }),
    domain_last_research_json: JSON.stringify({ [hash]: "2026-07-25T20:00:00.000Z" }),
    updated_at_iso: "2026-07-26T03:59:59.000Z",
  };
  const usage = await readGrowthActivityBudgetUsage(environment(database), {
    targetDomain: "example.com",
    now: NOW,
  });
  assert.equal(usage.counters.externalFetches, 2);
  assert.equal(usage.targetDomainFetches, 2);
  assert.equal(usage.consecutiveFetchFailures, 1);
  assert.equal(usage.lastExternalResearchAt, "2026-07-25T20:00:00.000Z");
  assert.equal(JSON.stringify(usage).includes("example.com"), false);
});

test("an allowed claim reserves conservative usage through one insert", async () => {
  const database = new FakeDatabase();
  const result = await claimGrowthActivityBudget(environment(database), {
    claimId: CLAIM_ID,
    requestBodySha256: HASH,
    intensity: "light",
    action: "public_research_run",
    invocation: "manual",
    ownerApproved: true,
    explicitlyConfirmed: true,
    targetDomain: "example.com",
    now: NOW,
  });
  assert.equal(result.accepted, true);
  assert.equal(result.contractVersion, GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION);
  assert.equal(result.replayed, false);
  assert.equal(result.persistentAdmission, true);
  assert.equal(result.automaticRetryAllowed, false);
  assert.equal(result.claim.expiresAt, "2026-07-26T04:15:00.000Z");
  assert.equal(Object.isFrozen(result.claim), true);
  assert.doesNotThrow(() => assertGrowthActivityBudgetLedgerClaim(result.claim));

  const insertCalls = database.calls.filter((call) => call.kind === "run");
  assert.equal(insertCalls.length, 1);
  assert.ok(insertCalls[0]?.sql.includes("INSERT INTO growth_activity_budget_claims"));
  const values = database.lastInsertValues ?? [];
  assert.equal(values[0], CLAIM_ID);
  assert.equal(values[1], "2026-07-26");
  assert.equal(values[2], "public_research_run");
  assert.equal(values[3], "manual");
  assert.equal(values[4], "light");
  assert.equal(values[5], 1);
  assert.match(String(values[6]), /^[0-9a-f]{64}$/);
  assert.notEqual(values[6], "example.com");
  assert.deepEqual(JSON.parse(String(values[7])), {
    manualResearchRuns: 1,
    scheduledExternalResearchRuns: 0,
    externalFetches: 1,
    distinctDomains: 1,
    candidateWrites: 0,
    proposalWrites: 0,
    reportsGenerated: 0,
    workerRequests: 1,
    d1RowsRead: 250,
    d1RowsWritten: 50,
    queueOperations: 0,
    browserMinutes: 0,
    aiCalls: 0,
    paidServiceCalls: 0,
    externalActions: 0,
  });
  assert.equal(JSON.parse(String(values[8])).externalActionsPerDay, 0);
  assert.equal(values[9], HASH);
});

test("policy denial does not attempt a claim insert", async () => {
  const database = new FakeDatabase();
  const result = await claimGrowthActivityBudget(environment(database), {
    claimId: CLAIM_ID,
    requestBodySha256: HASH,
    intensity: "light",
    action: "public_research_run",
    invocation: "scheduled",
    ownerApproved: true,
    explicitlyConfirmed: true,
    targetDomain: "example.com",
    now: NOW,
  });
  assert.equal(result.accepted, false);
  assert.equal(result.denialSource, "policy");
  assert.equal(result.ledgerCode, null);
  assert.ok(result.decision.reasons.includes("scheduled_external_research_forbidden"));
  assert.equal(database.calls.some((call) => call.kind === "run"), false);
});

test("database trigger races return a finite denial and never auto-retry", async () => {
  const database = new FakeDatabase();
  database.insertError = new Error("D1_ERROR: GROWTH_ACTIVITY_BUDGET_DAILY_LIMIT");
  const result = await claimGrowthActivityBudget(environment(database), {
    claimId: CLAIM_ID,
    requestBodySha256: HASH,
    intensity: "balanced",
    action: "public_research_run",
    invocation: "manual",
    ownerApproved: true,
    explicitlyConfirmed: true,
    targetDomain: "example.com",
    now: NOW,
  });
  assert.equal(result.accepted, false);
  assert.equal(result.denialSource, "database_race");
  assert.equal(result.ledgerCode, "GROWTH_ACTIVITY_BUDGET_DAILY_LIMIT");
  assert.equal(result.automaticRetryAllowed, false);
  assert.equal(database.calls.filter((call) => call.kind === "run").length, 1);
});

test("claim identifiers are one-time and structural claim lookalikes are rejected", async () => {
  const database = new FakeDatabase();
  await admittedClaim(database);
  await assert.rejects(
    () => claimGrowthActivityBudget(environment(database), {
      claimId: CLAIM_ID,
      requestBodySha256: HASH,
      intensity: "light",
      action: "public_research_run",
      invocation: "manual",
      ownerApproved: true,
      explicitlyConfirmed: true,
      targetDomain: "example.com",
      now: NOW,
    }),
    /GROWTH_ACTIVITY_BUDGET_CLAIM_REPLAY/,
  );

  const fakeClaim = {
    contractVersion: GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION,
    claimId: CLAIM_ID,
    action: "public_research_run",
    invocation: "manual",
    profileIntensity: "light",
    requestedUnits: 1,
    utcDay: "2026-07-26",
    targetDomainHash: "b".repeat(64),
    requestBodySha256: HASH,
    admittedAt: NOW.toISOString(),
    expiresAt: "2026-07-26T04:15:00.000Z",
  } as GrowthActivityBudgetLedgerClaim;
  assert.throws(
    () => assertGrowthActivityBudgetLedgerClaim(fakeClaim),
    /GROWTH_ACTIVITY_BUDGET_CLAIM_UNTRUSTED/,
  );
});

test("claim completion is branded, one-way and idempotent for the same outcome", async () => {
  const database = new FakeDatabase();
  const claim = await admittedClaim(database);
  const completed = await completeGrowthActivityBudgetClaim(environment(database), {
    claim,
    outcome: "completed",
    outcomeCode: "research_completed",
    now: new Date("2026-07-26T04:02:00.000Z"),
  });
  assert.equal(completed.completed, true);
  assert.equal(completed.idempotent, false);
  assert.equal(completed.automaticRetryAllowed, false);

  const replay = await completeGrowthActivityBudgetClaim(environment(database), {
    claim,
    outcome: "completed",
    outcomeCode: "research_completed",
    now: new Date("2026-07-26T04:03:00.000Z"),
  });
  assert.equal(replay.idempotent, true);

  await assert.rejects(
    () => completeGrowthActivityBudgetClaim(environment(database), {
      claim,
      outcome: "failed",
      outcomeCode: "research_failed",
      now: new Date("2026-07-26T04:04:00.000Z"),
    }),
    /GROWTH_ACTIVITY_BUDGET_CLAIM_ALREADY_COMPLETED/,
  );
});

test("malformed persisted usage and unavailable storage fail closed", async () => {
  const malformed = new FakeDatabase();
  malformed.usageRow = {
    counters_json: "{}",
    domain_fetches_json: "{}",
    domain_failures_json: "{}",
    domain_last_research_json: "{}",
    updated_at_iso: NOW.toISOString(),
  };
  await assert.rejects(
    () => readGrowthActivityBudgetUsage(environment(malformed), { now: NOW }),
    /GROWTH_ACTIVITY_BUDGET_USAGE_INVALID/,
  );

  const unavailable = {
    DB: {
      prepare() {
        throw new Error("database unavailable detail");
      },
    } as unknown as D1Database,
  } satisfies Env;
  await assert.rejects(
    () => readGrowthActivityBudgetUsage(unavailable, { now: NOW }),
    /GROWTH_ACTIVITY_BUDGET_LEDGER_UNAVAILABLE/,
  );
});
