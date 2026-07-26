#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const CHECK_NAME = "check-growth-activity-budget-ledger";
const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const errors = [];

function requireTokens(label, content, tokens) {
  for (const token of tokens) {
    if (!content.includes(token)) errors.push(`${label} is missing: ${token}`);
  }
}

function forbidTokens(label, content, tokens) {
  for (const token of tokens) {
    if (content.includes(token)) errors.push(`${label} contains forbidden token: ${token}`);
  }
}

function requireOrder(label, content, tokens) {
  let previous = -1;
  for (const token of tokens) {
    const index = content.indexOf(token);
    if (index === -1 || index <= previous) {
      errors.push(`${label} is missing ordered token: ${token}`);
      return;
    }
    previous = index;
  }
}

const budget = read("src/core/growthActivityBudget.ts");
const ledger = read("src/core/growthActivityBudgetLedger.ts");
const migration = read("migrations/0023_growth_activity_budget_ledger.sql");
const tests = read("tests/growthActivityBudgetLedger.test.ts");
const inventory = read("scripts/check-migrations-present.mjs");
const migrationReadme = read("migrations/README.md");
const capabilities = read("src/core/growthCapabilities.ts");
const packageJson = JSON.parse(read("package.json"));

requireTokens("Growth activity budget ledger", ledger, [
  'GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION =\n  "growth_activity_budget_ledger_v1"',
  "CLAIM_TTL_MS = 15 * 60 * 1000",
  "const trustedClaims = new WeakSet<object>()",
  "readGrowthActivityBudgetUsage",
  "claimGrowthActivityBudget",
  "completeGrowthActivityBudgetClaim",
  "assertGrowthActivityBudgetLedgerClaim",
  "digestDomain",
  "GROWTH_ACTIVITY_BUDGET_CLAIM_UNTRUSTED",
  "GROWTH_ACTIVITY_BUDGET_LEDGER_UNAVAILABLE",
  "GROWTH_ACTIVITY_BUDGET_CLAIM_REPLAY",
  "automaticRetryAllowed: false",
  "persistentAdmission: true",
  "denialSource: \"database_race\"",
  "INSERT INTO growth_activity_budget_claims",
  "UPDATE growth_activity_budget_claims",
  "SELECT counters_json, domain_fetches_json, domain_failures_json",
  "targetDomainHash",
  "JSON.stringify(decision.profile.limits)",
]);
requireOrder("Growth activity ledger admission order", ledger, [
  "const usage = await readGrowthActivityBudgetUsage",
  "const decision = evaluateGrowthActivityBudget",
  "if (!decision.allowed)",
  "const cost = counterDelta",
  "INSERT INTO growth_activity_budget_claims",
]);
forbidTokens("Growth activity budget ledger", ledger, [
  "fetch(",
  "waitUntil(",
  "AI.run(",
  "sendEmail(",
  "document.cookie",
  "localStorage",
  "ADMIN_TOKEN",
  "EVAVO_GROWTH_WORKER_ADMIN_TOKEN",
]);

requireTokens("Growth activity budget migration", migration, [
  "CREATE TABLE IF NOT EXISTS growth_activity_budget_usage_daily",
  "CREATE TABLE IF NOT EXISTS growth_activity_budget_claims",
  "CREATE TRIGGER IF NOT EXISTS validate_growth_activity_budget_claim",
  "CREATE TRIGGER IF NOT EXISTS apply_growth_activity_budget_claim",
  "CREATE TRIGGER IF NOT EXISTS protect_growth_activity_budget_claim_update",
  "CREATE TRIGGER IF NOT EXISTS reconcile_growth_activity_budget_claim_outcome",
  "CREATE TRIGGER IF NOT EXISTS prevent_growth_activity_budget_claim_delete",
  "GROWTH_ACTIVITY_BUDGET_ZERO_COST_POSTURE_INVALID",
  "GROWTH_ACTIVITY_BUDGET_SCHEDULED_RESEARCH_FORBIDDEN",
  "GROWTH_ACTIVITY_BUDGET_PER_RUN_LIMIT",
  "GROWTH_ACTIVITY_BUDGET_DAILY_LIMIT",
  "GROWTH_ACTIVITY_BUDGET_DOMAIN_LIMIT",
  "GROWTH_ACTIVITY_BUDGET_FAILURE_CIRCUIT",
  "GROWTH_ACTIVITY_BUDGET_COOLDOWN",
  "GROWTH_ACTIVITY_BUDGET_CLAIM_IMMUTABLE",
  "GROWTH_ACTIVITY_BUDGET_CLAIM_DELETE_FORBIDDEN",
  "target_domain_hash",
  "request_body_sha256",
  "json_type(growth_activity_budget_usage_daily.domain_fetches_json",
  "THEN json_set(NEW.cost_json, '$.distinctDomains', 1)",
  "THEN 1 ELSE 0 END",
]);
requireOrder("Growth activity budget trigger order", migration, [
  "validate_growth_activity_budget_claim",
  "apply_growth_activity_budget_claim",
  "protect_growth_activity_budget_claim_update",
  "reconcile_growth_activity_budget_claim_outcome",
  "prevent_growth_activity_budget_claim_delete",
]);
forbidTokens("Growth activity budget migration", migration, [
  "DROP TABLE",
  "DROP TRIGGER",
  "DELETE FROM",
  "growth_accounts",
  "growth_opportunities",
  "sendEmail",
  "canonicalPromotion",
  "externalExecution",
  "AI.run",
]);

requireTokens("Growth activity budget ledger tests", tests, [
  'from "../src/core/growthActivityBudgetLedger"',
  'test("empty ledger returns a fresh zero usage snapshot"',
  'test("ledger reads only the hashed target-domain counters"',
  'test("an allowed claim reserves conservative usage through one insert"',
  'test("policy denial does not attempt a claim insert"',
  'test("database trigger races return a finite denial and never auto-retry"',
  'test("claim identifiers are one-time and structural claim lookalikes are rejected"',
  'test("claim completion is branded, one-way and idempotent for the same outcome"',
  'test("malformed persisted usage and unavailable storage fail closed"',
  "GROWTH_ACTIVITY_BUDGET_DAILY_LIMIT",
  "GROWTH_ACTIVITY_BUDGET_CLAIM_REPLAY",
  "GROWTH_ACTIVITY_BUDGET_CLAIM_UNTRUSTED",
]);
forbidTokens("Growth activity budget ledger tests", tests, [
  "wrangler deploy",
  "supabase.co",
  "neon.tech",
  "rds.amazonaws.com",
  "ADMIN_TOKEN",
]);

requireTokens("Growth activity budget pure policy", budget, [
  "persistentUsageAccountingRequired: true",
  "accountWideCloudUsageKnown: false",
  "evaluateGrowthActivityBudget",
]);
requireTokens("Migration inventory", inventory, [
  '"0022_business_website_audit_records.sql"',
  '"0023_growth_activity_budget_ledger.sql"',
]);
requireOrder("Migration inventory order", inventory, [
  '"0022_business_website_audit_records.sql"',
  '"0023_growth_activity_budget_ledger.sql"',
]);
requireTokens("Migration runbook", migrationReadme, [
  "24. `0023_growth_activity_budget_ledger.sql`",
  "atomically admits activity against one daily counter row",
  "stores only hashed domain keys",
  "permits only one final completed or failed outcome",
  "does not claim to measure unrelated Cloudflare account activity",
]);
requireTokens("Growth capability budget ledger posture", capabilities, [
  "GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION",
  "ledgerContractVersion: GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION",
  "persistentUsageLedgerContractImplemented: true",
  "persistentUsageLedgerMigrationApplied: false",
  "manualResearchAdmissionIntegrated: false",
]);
forbidTokens("Growth capability budget ledger posture", capabilities, [
  "persistentUsageLedgerMigrationApplied: true",
  "manualResearchAdmissionIntegrated: true",
]);

if (packageJson.scripts?.["growth:activity-budget:check"] !== "node scripts/check-growth-activity-budget.mjs") {
  errors.push("package.json must expose growth:activity-budget:check through the aggregate budget guard.");
}
const localGate = String(packageJson.scripts?.["check:local"] ?? "");
if (!localGate.includes("npm run growth:activity-budget:check")) {
  errors.push("check:local must execute growth:activity-budget:check.");
}
if (
  localGate.indexOf("npm run growth:negative-safety:check") >=
  localGate.indexOf("npm run growth:activity-budget:check") ||
  localGate.indexOf("npm run growth:activity-budget:check") >=
  localGate.indexOf("npm run growth:capabilities:check")
) {
  errors.push("check:local must run Growth negative safety, then activity budget, then capability truthfulness.");
}

if (errors.length) {
  console.error(`${CHECK_NAME} failed:\n`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Growth activity budget ledger check passed.");
console.log("- one trigger-protected D1 insert is the final concurrency authority after the pure policy preflight");
console.log("- daily, per-run, distinct-domain, per-domain, cooldown and failure-circuit limits are rechecked against persisted state");
console.log("- target domains are stored only as SHA-256 hashes and claim identifiers are immutable, one-time and runtime-branded");
console.log("- claims reserve usage before work, never release reserved cost automatically and allow one completed or failed outcome");
console.log("- migration inventory and capability posture remain truthful: contract implemented, migration and manual research integration not yet claimed");
console.log("- the aggregate budget guard is included between Growth negative safety and capability truthfulness in check:local");
console.log("- AI, browser, paid services, sending, posting, forms, calendars, provider writes and external execution remain unavailable");
