import fs from "node:fs";
import path from "node:path";

const CHECK_NAME = "check-growth-autonomy-runtime";
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
    const next = content.indexOf(token, previous + 1);
    if (next === -1 || next <= previous) {
      errors.push(`${label} is missing ordered token: ${token}`);
      return;
    }
    previous = next;
  }
}

const policy = read("src/core/growthAutonomyPolicy.ts");
const runtime = read("src/core/growthAutonomyRuntime.ts");
const ledger = read("src/core/growthAutonomyD1Ledger.ts");
const migration = read("migrations/202607250001_growth_autonomy_usage.sql");
const runtimeTest = read("tests/growthAutonomyRuntime.test.ts");
const ledgerTest = read("tests/growthAutonomyD1Ledger.test.ts");
const policyTest = read("tests/growthAutonomyPolicy.test.ts");
const policyGuard = read("scripts/check-growth-autonomy-policy.mjs");
const documentation = read("docs/growth-autonomy-runtime.md");

requireTokens("Growth autonomy policy", policy, [
  'GROWTH_AUTONOMY_POLICY_VERSION = "growth_autonomy_policy_v1"',
  '"paused"',
  '"light"',
  '"balanced"',
  '"high"',
  "maxPaidSpendCentsPerMonth: 0",
  "paidServicesAllowed: false",
  "failClosedWhenUsageUnknown: true",
  "automaticExternalExecutionAllowed: false",
  "maxRunsPerDay: 6",
  "maxNetworkRequestsPerRun: 96",
  "maxCpuMillisecondsPerRun: 5_000",
]);

requireTokens("Growth autonomy runtime", runtime, [
  'GROWTH_AUTONOMY_RUNTIME_VERSION =\n  "growth_autonomy_runtime_v1"',
  "GROWTH_AUTONOMY_RESERVATION_TTL_MS = 15 * 60 * 1_000",
  "GrowthAutonomyUsageLedger",
  "GrowthAutonomyReservationInput",
  "reportPlanned: boolean",
  '"daily_run_limit"',
  '"daily_report_limit"',
  '"quiet_hours"',
  '"usage_unknown"',
  '"paid_spend_detected"',
  "RESERVATION_BRAND = new WeakSet<object>()",
  "SESSION_BRAND = new WeakSet<object>()",
  "d1RowsRead: 2",
  "d1RowsWritten: 5",
  "isQuietHour",
  "options.ledger.reserve",
  "evaluateGrowthExternalAction",
  "GROWTH_AUTONOMY_RUN_BUDGET_EXCEEDED",
  "GROWTH_AUTONOMY_RUNTIME_COMPLETION_IN_PROGRESS",
  "completing = false",
  "assertGrowthAutonomyRunSession",
]);
requireOrder("Growth autonomy runtime start order", runtime, [
  "if (!policy.enabled)",
  "failClosedWhenUsageUnknown",
  "estimatedPaidSpendCents > policy.cost.maxPaidSpendCentsPerMonth",
  "isQuietHour(local.hour, policy.quietHours)",
  "options.ledger.reserve",
]);
requireOrder("Growth autonomy completion order", runtime, [
  "completing = true",
  "await options.ledger.complete",
  "finished = true",
  "completing = false",
]);
forbidTokens("Growth autonomy runtime", runtime, [
  "fetch(",
  "process.env",
  "ADMIN_TOKEN",
  "EVAVO_GROWTH_WORKER_ADMIN_TOKEN",
  "automaticExternalExecutionAllowed: true",
  "paidServicesAllowed: true",
  "maxPaidSpendCentsPerMonth: 1",
  "wrangler deploy",
  "scheduled(",
]);

requireTokens("Growth autonomy D1 ledger", ledger, [
  'GROWTH_AUTONOMY_D1_LEDGER_VERSION =\n  "growth_autonomy_d1_ledger_v1"',
  "GrowthAutonomyD1Ledger",
  "RESERVE_WINDOW_SQL",
  "INSERT_RESERVATION_SQL",
  "READ_RESERVATION_SQL",
  "READ_WINDOW_USAGE_SQL",
  "COMPLETE_RESERVATION_SQL",
  "APPLY_USAGE_SQL",
  "MARK_USAGE_APPLIED_SQL",
  "on conflict (organisation_id, workspace_id, window_key) do update set",
  "not exists (",
  "existing.run_id = ?",
  "estimated_paid_spend_cents = 0",
  "reports_reserved",
  "max_reports_per_day",
  "report_planned",
  "insert or ignore into growth_autonomy_run_reservations",
  "usage_applied = 0",
  "set usage_applied = 1",
  "this.db.batch",
  'reason: "daily_report_limit"',
  'reason: "daily_run_limit"',
  'reason: "temporarily_unavailable"',
]);
forbidTokens("Growth autonomy D1 ledger", ledger, [
  "fetch(",
  "process.env",
  "ADMIN_TOKEN",
  "EVAVO_GROWTH_WORKER_ADMIN_TOKEN",
  "DELETE FROM growth_autonomy_usage_windows",
  "DROP TABLE",
  "canonicalPromotionRequested: true",
  "externalExecutionRequested: true",
]);

requireTokens("Growth autonomy D1 migration", migration, [
  "create table if not exists growth_autonomy_usage_windows",
  "create table if not exists growth_autonomy_run_reservations",
  "primary key (organisation_id, workspace_id, window_key)",
  "estimated_paid_spend_cents integer not null default 0",
  "check (estimated_paid_spend_cents = 0)",
  "max_reports_per_day integer not null",
  "reports_reserved integer not null default 0",
  "report_planned integer not null",
  "run_id text not null unique",
  "usage_applied integer not null default 0",
  "growth_autonomy_run_state_expiry_idx",
]);
forbidTokens("Growth autonomy D1 migration", migration, [
  "drop table",
  "delete from",
  "truncate",
  "growth_accounts",
  "growth_opportunities",
  "growth_next_best_actions",
]);

requireTokens("Growth autonomy runtime tests", runtimeTest, [
  "Growth autonomy runtime tests passed.",
  "paused-denied",
  "usage-unknown",
  "paid-spend",
  "quiet-hours-denied",
  "daily_report_limit",
  "unreserved-report",
  "network-budget",
  "approved-email",
  "ads-never-execute",
  "writeback-never-execute",
  "completion-retry-attempted",
  "forged-session",
]);
requireTokens("Growth autonomy D1 ledger tests", ledgerTest, [
  "Growth autonomy D1 ledger tests passed.",
  "reserve-two-statement-batch",
  "reserve-daily-report-slot",
  "reserve-zero-spend-gate",
  "duplicate-run-replayed",
  "daily-report-limit",
  "daily-run-limit",
  "d1-error-reduced",
  "cross-tenant-row",
  "complete-three-statement-batch",
  "usage-once-window-update",
  "completion-conflict",
]);
requireTokens("Growth autonomy policy tests", policyTest, [
  "Growth autonomy policy tests passed.",
  "unknown usage fails closed",
  "paid spend fails closed",
]);
requireTokens("Growth autonomy policy guard", policyGuard, [
  "Growth autonomy policy check passed.",
  "both repositories use the same byte-for-byte policy source and canonical fixture",
]);

requireTokens("Growth autonomy runtime documentation", documentation, [
  "Growth Zero-Cost Autonomy Runtime",
  "growth_autonomy_runtime_v1",
  "growth_autonomy_d1_ledger_v1",
  "No absolute account-wide cost guarantee",
  "Light is the no-setup default",
  "Run reservation",
  "Report reservation",
  "Usage application",
  "External-action boundary",
  "Worker delivery remains disabled",
  "automatic posting, commenting, emailing, meeting booking, paid advertising and provider write-back remain unavailable",
]);

if (errors.length) {
  console.error(`${CHECK_NAME} failed:\n`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Growth autonomy runtime check passed.");
console.log("- Paused, Light, Balanced and High share one zero-paid-spend policy with Light as the no-setup default");
console.log("- durable D1 run and report reservations enforce daily ceilings before research starts and duplicate run IDs cannot inflate counters");
console.log("- each run meters sources, requests, candidates, reports, CPU, D1 rows and storage against a fixed budget with conservative ledger overhead");
console.log("- completion applies usage once, conflicts fail closed and a failed completion can be retried safely");
console.log("- paid ads, provider write-back and unrestricted automatic external execution remain disabled; Worker delivery and scheduling remain separate blocked milestones");
