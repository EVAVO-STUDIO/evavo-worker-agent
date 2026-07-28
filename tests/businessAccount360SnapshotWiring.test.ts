import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const snapshot = read("src/core/businessAccount360Snapshot.ts");
const adapter = read("src/core/businessAccount360Batched.ts");
const legacyComposer = read("src/core/businessAccount360.ts");
const handler = read("src/routes/businessAccount360Admin.ts");
const entrypoint = read("src/index.ts");
const genericHandler = read("src/routes/businessAutopilotAdmin.ts");

test("Account 360 snapshot source uses one fixed D1 batch", () => {
  for (const token of [
    '"business_account_360_d1_batch_snapshot_v1"',
    'snapshotConsistency: "d1_batch_read_transaction"',
    "BUSINESS_ACCOUNT_360_SNAPSHOT_ORDER",
    "BUSINESS_ACCOUNT_360_SNAPSHOT_STATEMENT_COUNT",
    "env.DB.batch<Row>(statements)",
    "BUSINESS_ACCOUNT_360_BATCH_STATEMENT_COUNT_INVALID",
    "BUSINESS_ACCOUNT_360_BATCH_RESULT_COUNT_INVALID",
    "BUSINESS_ACCOUNT_360_BATCH_RESULT_INVALID",
    "BUSINESS_ACCOUNT_360_BATCH_ORGANIZATION_COUNT_INVALID",
  ]) {
    assert.equal(snapshot.includes(token), true, token);
  }
  for (const forbidden of ["Promise.all(", ".first<Row>()", "best_effort_bounded_multi_query"]) {
    assert.equal(snapshot.includes(forbidden), false, forbidden);
  }
});

test("batch adapter composes from memory without additional D1 calls", () => {
  for (const token of [
    "readBusinessAccount360Snapshot",
    "inMemorySnapshotEnv",
    "buildBusinessAccount360(",
    "snapshotEvidenceContract: BUSINESS_ACCOUNT_360_SNAPSHOT_CONTRACT",
    "snapshotConsistency: snapshot.snapshotConsistency",
    "snapshotStatementCount: snapshot.statementCount",
    "BUSINESS_ACCOUNT_360_SNAPSHOT_QUERY_UNKNOWN",
    "BUSINESS_ACCOUNT_360_SNAPSHOT_BIND_REQUIRED",
  ]) {
    assert.equal(adapter.includes(token), true, token);
  }
  assert.equal(adapter.includes("env.DB.batch"), false);
  assert.equal(adapter.includes("fetch("), false);
});

test("Account Intelligence dispatches only to the transactional handler", () => {
  for (const token of [
    'import { handleBusinessAccount360Admin } from "./routes/businessAccount360Admin";',
    'case "account-intelligence":',
    "return await handleBusinessAccount360Admin(req, env, pathname, jsonResponse);",
    'case "business-historical":',
    'case "business-fallback":',
    "return await handleBusinessAutopilotAdmin(req, env, pathname, jsonResponse);",
  ]) {
    assert.equal(entrypoint.includes(token), true, token);
  }
  assert.equal(
    entrypoint.includes('case "account-intelligence":\n        case "business-historical":'),
    false,
  );
});

test("transactional handler preserves the existing read-only authority boundary", () => {
  for (const token of [
    "buildBusinessAccount360Batched",
    "isAdminRequestAuthorized",
    'request.method !== "GET"',
    "parseBusinessAccount360Limit",
    "businessAccount360Failure",
    "canonicalBusinessState: false",
    'canonicalStateOwner: "next-website/Supabase growth_*"',
    "canonicalPromotionAllowed: false",
    "callsExternalNetwork: false",
    "callsAI: false",
    "sendsEmail: false",
    "postsContent: false",
    "createsMeetings: false",
    "executesBrowserActions: false",
    "mutatesExternalProviders: false",
    "externalExecutionAllowed: false",
  ]) {
    assert.equal(handler.includes(token), true, token);
  }
  for (const forbidden of ["method: \"POST\"", "fetch(", "sendEmail", "postToSocial"]) {
    assert.equal(handler.includes(forbidden), false, forbidden);
  }
});

test("legacy composer remains available for reuse but is no longer the live D1 reader", () => {
  assert.equal(genericHandler.includes("buildBusinessAccount360("), true);
  assert.equal(legacyComposer.includes('snapshotConsistency: "best_effort_bounded_multi_query"'), true);
  assert.equal(genericHandler.includes("buildBusinessAccount360Batched"), false);
  assert.equal(entrypoint.includes("handleBusinessAutopilotAdmin(req, env, pathname, jsonResponse)"), true);
  assert.equal(entrypoint.includes("handleBusinessAccount360Admin(req, env, pathname, jsonResponse)"), true);
});
