import assert from "node:assert/strict";
import test from "node:test";

import type { Env } from "../src/db";
import { buildBusinessAccount360Batched } from "../src/core/businessAccount360Batched";
import {
  BUSINESS_ACCOUNT_360_SNAPSHOT_CONTRACT,
  BUSINESS_ACCOUNT_360_SNAPSHOT_ORDER,
} from "../src/core/businessAccount360Snapshot";

type FakeStatement = {
  sql: string;
  values: unknown[];
  bind(...values: unknown[]): FakeStatement;
};

type FakeBatchResult = {
  success: boolean;
  results: Array<Record<string, unknown>>;
};

function statement(sql: string): FakeStatement {
  return {
    sql,
    values: [],
    bind(...values: unknown[]) {
      this.values = values;
      return this;
    },
  };
}

function results(): FakeBatchResult[] {
  return BUSINESS_ACCOUNT_360_SNAPSHOT_ORDER.map((key, index) => ({
    success: true,
    results: index === 0
      ? [{
          id: "organization-1",
          name: "Example Organization",
          fitScore: 0,
          fitScoreObserved: 1,
          priorityScore: 80,
          priorityScoreObserved: 1,
          riskScore: 0,
          riskScoreObserved: 1,
          confidenceScore: 90,
          confidenceScoreObserved: 1,
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-28T00:00:00.000Z",
        }]
      : key === "signals"
        ? [{
            id: "signal-1",
            signalType: "technology_stack",
            signalStrength: 0,
            signalStrengthObserved: 1,
            confidenceScore: 80,
            confidenceScoreObserved: 1,
            evidenceSummary: "Reviewed technology evidence.",
            evidenceUrl: "https://example.test/evidence/technology",
            riskFlagsJson: "[]",
            createdAt: "2026-07-20T00:00:00.000Z",
            updatedAt: "2026-07-27T00:00:00.000Z",
          }]
        : [],
  }));
}

function environment(
  batchResults: FakeBatchResult[],
  counters: { prepare: number; batch: number },
): Env {
  return {
    DB: {
      prepare(sql: string) {
        counters.prepare += 1;
        return statement(sql);
      },
      async batch(statements: FakeStatement[]) {
        counters.batch += 1;
        assert.equal(statements.length, BUSINESS_ACCOUNT_360_SNAPSHOT_ORDER.length);
        return batchResults;
      },
    },
  } as unknown as Env;
}

test("batched Account 360 performs one real D1 batch and no follow-up D1 reads", async () => {
  const counters = { prepare: 0, batch: 0 };
  const account = await buildBusinessAccount360Batched(
    environment(results(), counters),
    "organization-1",
    25,
    Date.parse("2026-07-29T00:00:00.000Z"),
  );

  assert.ok(account);
  assert.equal(counters.batch, 1);
  assert.equal(counters.prepare, BUSINESS_ACCOUNT_360_SNAPSHOT_ORDER.length);
  assert.equal(account.snapshotEvidenceContract, BUSINESS_ACCOUNT_360_SNAPSHOT_CONTRACT);
  assert.equal(
    account.deterministicIndicators.snapshotConsistency,
    "d1_batch_read_transaction",
  );
  assert.equal(account.deterministicIndicators.snapshotStatementCount, 11);
  assert.equal(account.organization.fitScore, 0);
  assert.equal(account.organization.priorityScore, 80);
  assert.equal(account.accountEvidence.signals[0]?.signalStrength, 0);
  assert.equal(
    account.accountEvidence.dimensions.technology.maximumSignalStrengthScore,
    0,
  );
  assert.equal(Object.isFrozen(account), true);
  assert.equal(Object.isFrozen(account.deterministicIndicators), true);
});

test("missing organization remains null and still uses one batch", async () => {
  const counters = { prepare: 0, batch: 0 };
  const batchResults = results();
  batchResults[0] = { success: true, results: [] };
  const account = await buildBusinessAccount360Batched(
    environment(batchResults, counters),
    "missing-organization",
    25,
  );

  assert.equal(account, null);
  assert.equal(counters.batch, 1);
  assert.equal(counters.prepare, BUSINESS_ACCOUNT_360_SNAPSHOT_ORDER.length);
});

test("batch failure propagates without running the projection composer", async () => {
  const counters = { prepare: 0, batch: 0 };
  const batchResults = results();
  batchResults[6] = { success: false, results: [] };
  await assert.rejects(
    () => buildBusinessAccount360Batched(
      environment(batchResults, counters),
      "organization-1",
      25,
    ),
    /BUSINESS_ACCOUNT_360_BATCH_RESULT_INVALID:6/,
  );
  assert.equal(counters.batch, 1);
  assert.equal(counters.prepare, BUSINESS_ACCOUNT_360_SNAPSHOT_ORDER.length);
});
