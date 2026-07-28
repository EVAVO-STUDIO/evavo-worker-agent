import assert from "node:assert/strict";
import test from "node:test";

import type { Env } from "../src/db";
import {
  BUSINESS_ACCOUNT_360_SNAPSHOT_CONTRACT,
  BUSINESS_ACCOUNT_360_SNAPSHOT_ORDER,
  BUSINESS_ACCOUNT_360_SNAPSHOT_STATEMENT_COUNT,
  readBusinessAccount360Snapshot,
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

function batchResults(): FakeBatchResult[] {
  return BUSINESS_ACCOUNT_360_SNAPSHOT_ORDER.map((key, index) => ({
    success: true,
    results: index === 0 ? [{ id: "organization-1" }] : [{ id: key }],
  }));
}

function environment(
  results: FakeBatchResult[],
  onBatch?: (statements: FakeStatement[]) => void,
): Env {
  return {
    DB: {
      prepare(sql: string) {
        return statement(sql);
      },
      async batch(statements: FakeStatement[]) {
        onBatch?.(statements);
        return results;
      },
    },
  } as unknown as Env;
}

test("Account 360 snapshot uses one fixed-order D1 batch", async () => {
  let prepared: FakeStatement[] = [];
  const snapshot = await readBusinessAccount360Snapshot(
    environment(batchResults(), (statements) => {
      prepared = statements;
    }),
    "organization-1",
    25,
  );

  assert.ok(snapshot);
  assert.equal(snapshot.contract, BUSINESS_ACCOUNT_360_SNAPSHOT_CONTRACT);
  assert.equal(snapshot.snapshotConsistency, "d1_batch_read_transaction");
  assert.equal(snapshot.statementCount, BUSINESS_ACCOUNT_360_SNAPSHOT_STATEMENT_COUNT);
  assert.equal(prepared.length, BUSINESS_ACCOUNT_360_SNAPSHOT_STATEMENT_COUNT);
  assert.deepEqual(prepared[0]?.values, ["organization-1"]);
  for (const preparedStatement of prepared.slice(1)) {
    assert.deepEqual(preparedStatement.values, ["organization-1", 25]);
  }

  const expectedTables = [
    "business_organizations",
    "business_people",
    "business_websites",
    "business_pages",
    "business_website_audit_runs",
    "business_audit_observations",
    "business_signals",
    "business_opportunities",
    "business_service_matches",
    "business_audit_packs",
    "business_followups",
  ];
  assert.deepEqual(
    prepared.map((preparedStatement, index) =>
      preparedStatement.sql.includes(expectedTables[index])),
    Array.from({ length: BUSINESS_ACCOUNT_360_SNAPSHOT_STATEMENT_COUNT }, () => true),
  );

  assert.equal(snapshot.organization.id, "organization-1");
  assert.equal(snapshot.people[0]?.id, "people");
  assert.equal(snapshot.followups[0]?.id, "followups");
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.people), true);
});

test("missing organization returns null without a partial account view", async () => {
  const results = batchResults();
  results[0] = { success: true, results: [] };
  const snapshot = await readBusinessAccount360Snapshot(
    environment(results),
    "missing-organization",
    25,
  );
  assert.equal(snapshot, null);
});

test("batch result count drift fails closed", async () => {
  await assert.rejects(
    () => readBusinessAccount360Snapshot(
      environment(batchResults().slice(0, -1)),
      "organization-1",
      25,
    ),
    /BUSINESS_ACCOUNT_360_BATCH_RESULT_COUNT_INVALID/,
  );
});

test("an unsuccessful statement prevents a partial snapshot", async () => {
  const results = batchResults();
  results[4] = { success: false, results: [] };
  await assert.rejects(
    () => readBusinessAccount360Snapshot(
      environment(results),
      "organization-1",
      25,
    ),
    /BUSINESS_ACCOUNT_360_BATCH_RESULT_INVALID:4/,
  );
});

test("organization cardinality drift fails closed", async () => {
  const results = batchResults();
  results[0] = {
    success: true,
    results: [{ id: "organization-1" }, { id: "organization-duplicate" }],
  };
  await assert.rejects(
    () => readBusinessAccount360Snapshot(
      environment(results),
      "organization-1",
      25,
    ),
    /BUSINESS_ACCOUNT_360_BATCH_ORGANIZATION_COUNT_INVALID/,
  );
});
