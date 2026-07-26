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

test("Growth activity budget source remains pure, zero-cost and capability-visible", () => {
  const budget = read("src/core/growthActivityBudget.ts");
  const capabilities = read("src/core/growthCapabilities.ts");
  const guard = read("scripts/check-growth-activity-budget.mjs");
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

  includesEvery(capabilities, [
    "activityBudget: {",
    "GROWTH_ACTIVITY_BUDGET_VERSION",
    "profiles: listGrowthActivityProfiles()",
    "hardLimits: GROWTH_ACTIVITY_HARD_LIMITS",
    'defaultIntensity: "light"',
    "zeroPaidServiceBudget: true",
    "persistentUsageLedgerImplemented: false",
    "manualResearchAdmissionIntegrated: false",
    "accountWideCloudUsageKnown: false",
    "scheduledExternalResearchEnabled: false",
    "aiEnabled: false",
    "browserEnabled: false",
    "externalExecutionEnabled: false",
  ], "capabilities");

  assert.equal(capabilities.includes("persistentUsageLedgerImplemented: true"), false);
  assert.equal(capabilities.includes("manualResearchAdmissionIntegrated: true"), false);
  assert.equal(capabilities.includes("externalExecutionEnabled: true"), false);

  includesEvery(guard, [
    "Growth activity budget check passed.",
    "the protected capability registry exposes profile and hard-limit posture without claiming the ledger or network admission integration already exists",
    "this source contract does not claim persistent D1 budget enforcement until the usage ledger is implemented",
  ], "guard");

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
