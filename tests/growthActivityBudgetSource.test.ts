import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relativePath: string): string =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

function includesEvery(content: string, tokens: readonly string[], label: string): void {
  for (const token of tokens) {
    assert.ok(content.includes(token), `${label}:${token}`);
  }
}

test("Growth activity budget source remains pure, zero-cost, ledger-backed and capability-visible", () => {
  const budget = read("src/core/growthActivityBudget.ts");
  const ledger = read("src/core/growthActivityBudgetLedger.ts");
  const migration = read("migrations/0023_growth_activity_budget_ledger.sql");
  const capabilities = read("src/core/growthCapabilities.ts");
  const guard = read("scripts/check-growth-activity-budget.mjs");
  const ledgerGuard = read("scripts/check-growth-activity-budget-ledger.mjs");
  const docs = read("docs/growth-activity-budget.md");
  const wrangler = read("wrangler.toml");

  includesEvery(budget, [
    'GROWTH_ACTIVITY_BUDGET_VERSION = "growth_activity_budget_v1"',
    '"paused"',
    '"light"',
    '"balanced"',
    '"high"',
    '"custom"',
    "persistentUsageAccountingRequired: true",
    "accountWideCloudUsageKnown: false",
    "scheduledExternalResearchRunsPerDay: 0",
    "browserMinutesPerDay: 0",
    "aiCallsPerDay: 0",
    "paidServiceCallsPerDay: 0",
    "externalActionsPerDay: 0",
    "usage_snapshot_stale",
    "research_cooldown_active",
    "failure_circuit_open",
  ], "budget");

  for (const forbidden of [
    "fetch(",
    "env.DB",
    "process.env",
    "waitUntil(",
    "setTimeout(",
    "AI.run(",
    "sendEmail(",
    "ADMIN_TOKEN",
  ]) {
    assert.equal(budget.includes(forbidden), false, `budget-purity:${forbidden}`);
  }

  includesEvery(ledger, [
    'GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION =\n  "growth_activity_budget_ledger_v1"',
    "const trustedClaims = new WeakSet<object>()",
    "readGrowthActivityBudgetUsage",
    "claimGrowthActivityBudget",
    "completeGrowthActivityBudgetClaim",
    "INSERT INTO growth_activity_budget_claims",
    "automaticRetryAllowed: false",
    "denialSource: \"database_race\"",
  ], "ledger");
  for (const forbidden of [
    "fetch(",
    "waitUntil(",
    "AI.run(",
    "sendEmail(",
    "ADMIN_TOKEN",
  ]) {
    assert.equal(ledger.includes(forbidden), false, `ledger-purity:${forbidden}`);
  }

  includesEvery(migration, [
    "growth_activity_budget_usage_daily",
    "growth_activity_budget_claims",
    "validate_growth_activity_budget_claim",
    "apply_growth_activity_budget_claim",
    "protect_growth_activity_budget_claim_update",
    "reconcile_growth_activity_budget_claim_outcome",
    "prevent_growth_activity_budget_claim_delete",
    "GROWTH_ACTIVITY_BUDGET_ZERO_COST_POSTURE_INVALID",
    "GROWTH_ACTIVITY_BUDGET_DAILY_LIMIT",
    "GROWTH_ACTIVITY_BUDGET_DOMAIN_LIMIT",
    "GROWTH_ACTIVITY_BUDGET_FAILURE_CIRCUIT",
    "GROWTH_ACTIVITY_BUDGET_COOLDOWN",
    "json_type(growth_activity_budget_usage_daily.domain_fetches_json",
  ], "migration");
  for (const forbidden of [
    "DROP TABLE",
    "DELETE FROM",
    "growth_accounts",
    "sendEmail",
    "canonicalPromotion",
    "externalExecution",
  ]) {
    assert.equal(migration.includes(forbidden), false, `migration-safety:${forbidden}`);
  }

  includesEvery(capabilities, [
    "activityBudget: {",
    "GROWTH_ACTIVITY_BUDGET_VERSION",
    "GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION",
    "ledgerContractVersion: GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION",
    "profiles: listGrowthActivityProfiles()",
    "hardLimits: GROWTH_ACTIVITY_HARD_LIMITS",
    'defaultIntensity: "light"',
    "zeroPaidServiceBudget: true",
    "persistentUsageLedgerContractImplemented: true",
    "persistentUsageLedgerMigrationApplied: false",
    "manualResearchAdmissionIntegrated: false",
    "accountWideCloudUsageKnown: false",
    "scheduledExternalResearchEnabled: false",
    "aiEnabled: false",
    "browserEnabled: false",
    "externalExecutionEnabled: false",
  ], "capabilities");

  assert.equal(capabilities.includes("persistentUsageLedgerMigrationApplied: true"), false);
  assert.equal(capabilities.includes("manualResearchAdmissionIntegrated: true"), false);
  assert.equal(capabilities.includes("externalExecutionEnabled: true"), false);

  includesEvery(guard, [
    "Growth activity budget check passed.",
    "the protected capability registry exposes profile, ledger-contract and hard-limit posture without claiming migration application or network admission integration",
    "the ledger contract is implemented, while D1 application and manual research integration remain separately truthful milestones",
    "scripts/check-growth-activity-budget-ledger.mjs",
  ], "guard");
  includesEvery(ledgerGuard, [
    "Growth activity budget ledger check passed.",
    "one trigger-protected D1 insert is the final concurrency authority",
    "target domains are stored only as SHA-256 hashes",
    "manual research integration not yet claimed",
  ], "ledger-guard");

  includesEvery(docs, [
    "The Worker cannot know all account-wide Cloudflare activity from a single request.",
    "Custom cannot raise the immutable zero values.",
    "Automation must be useful rather than merely active.",
    "Credentials, OAuth consent and platform review are legitimate setup requirements and must not be bypassed.",
  ], "docs");

  includesEvery(wrangler, [
    'compatibility_flags = ["global_fetch_strictly_public"]',
    "Historical schedules retained for internal-only maintenance.",
    "No email-provider secrets are used or accepted by the active Worker source.",
  ], "wrangler");
});
