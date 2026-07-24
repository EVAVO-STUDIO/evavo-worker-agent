import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const source = fs.readFileSync(
  path.join(root, "src/routes/opportunitySourceHealthActionsAdmin.ts"),
  "utf8",
);
const concurrencyDoc = fs.readFileSync(
  path.join(root, "docs/manual-research-concurrency.md"),
  "utf8",
);

function requires(content: string, tokens: readonly string[], label: string): void {
  for (const token of tokens) {
    assert.ok(content.includes(token), `${label} missing ${token}`);
  }
}

function forbids(content: string, tokens: readonly string[], label: string): void {
  for (const token of tokens) {
    assert.equal(content.includes(token), false, `${label} contains ${token}`);
  }
}

test("source health actions require an authenticated bounded exact confirmation", () => {
  requires(source, [
    'from "../core/adminAuthentication"',
    'from "../core/boundedJsonRequest"',
    "await isAdminRequestAuthorized(request, env)",
    "readBoundedJsonObject<SourceHealthActionBody>(request",
    "maxBytes: 4_096",
    "maxDepth: 4",
    "maxNodes: 32",
    "maxArrayLength: 4",
    "maxStringLength: 512",
    "maxKeyLength: 64",
    "if (!isExplicitJsonConfirmation(parsed.value))",
    'error: "confirm_required"',
    "requiredPayload: { confirm: true }",
    "confirmationCoercionAllowed: false",
    "bodySha256: parsed.bodySha256",
  ], "source health route");

  forbids(source, [
    "request.json()",
    "request.clone().json()",
    'searchParams.get("confirm")',
    'confirm === 1',
    'confirm === "1"',
    'confirm === "true"',
  ], "source health route");
});

test("source health actions share the opportunity source exclusion key", () => {
  requires(source, [
    'from "../core/manualResearchLease"',
    'const actionKey = `opportunity-source:${sourceId}`',
    "acquireManualResearchLease(env, actionKey, 600)",
    "manualResearchLeaseConflict(actionKey)",
    "status: 409",
    "releaseManualResearchLease(env, lease)",
    "overlappingPerSourceActionAllowed: false",
  ], "source health route");

  const confirmation = source.indexOf("if (!isExplicitJsonConfirmation(parsed.value))");
  const lease = source.indexOf("const lease = await acquireManualResearchLease(env, actionKey, 600)");
  const mutation = source.indexOf("await env.DB.batch([mutation.statement, auditInsert])");
  assert.ok(confirmation >= 0, "confirmation boundary missing");
  assert.ok(lease > confirmation, "lease must follow confirmation");
  assert.ok(mutation > lease, "mutation must follow lease acquisition");
});

test("source health mutation and audit are one review-only D1 transaction", () => {
  requires(source, [
    'SOURCE_HEALTH_ACTION_CONTRACT = "opportunity_source_health_action_v2_review_only"',
    "const auditMessage = JSON.stringify({",
    "requestBodySha256: parsed.bodySha256",
    "reviewOnly: true",
    "executable: false",
    "deliverable: false",
    "authoritativeForExecution: false",
    "externalExecutionAllowed: false",
    "INSERT INTO events (id, type, message, lead_id, created_at_iso)",
    "VALUES (?, 'opportunity_source_health_action', ?, NULL, ?)",
    "await env.DB.batch([mutation.statement, auditInsert])",
    "auditAndSourceUpdateAtomic: true",
    "writesOnlyD1SourceMetadata: true",
    "callsNetwork: false",
    "callsAI: false",
    "sendsEmail: false",
    "postsExternally: false",
  ], "source health route");

  forbids(source, [
    "logEvent(",
    "fetch(",
    "env.AI",
    "lead_id, created_at_iso) VALUES (?, ?, ?, ?, ?)",
  ], "source health route");
});

test("source health failures remain bounded and non-executable", () => {
  requires(source, [
    'error: "source_health_action_failed"',
    "requestReceipt",
    "reviewOnly: true",
    "executable: false",
    "deliverable: false",
    "authoritativeForExecution: false",
    "externalExecutionAllowed: false",
  ], "source health route");

  assert.equal(source.includes("caught.message"), false);
  assert.equal(source.includes("error.message"), false);
  assert.equal(source.includes("String(error)"), false);
});

test("concurrency documentation covers source health exclusion and audit semantics", () => {
  requires(concurrencyDoc, [
    "Opportunity source test, preview, commit-preview and source-health routes share a key",
    "opportunity-source:<source-id>",
    "a source-health pause, activation, priority change or error reset from racing research on the same source",
    "batches the `opportunity_sources` mutation and its `events` audit record in one D1 transaction",
    "The audit uses `lead_id = NULL`",
  ], "manual research concurrency documentation");
});
