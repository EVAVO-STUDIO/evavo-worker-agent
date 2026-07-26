#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const CHECK_NAME = "check-growth-activity-budget";
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
const tests = read("tests/growthActivityBudget.test.ts");
const docs = read("docs/growth-activity-budget.md");
const capabilities = read("src/core/growthCapabilities.ts");
const autonomySettings = read("src/routes/autonomySettingsAdmin.ts");
const scheduledEngine = read("src/engineAutonomy.ts");
const wrangler = read("wrangler.toml");

requireTokens("Growth activity budget contract", budget, [
  'GROWTH_ACTIVITY_BUDGET_VERSION = "growth_activity_budget_v1"',
  "GROWTH_ACTIVITY_INTENSITIES = Object.freeze([",
  '"paused"',
  '"light"',
  '"balanced"',
  '"high"',
  '"custom"',
  "GROWTH_ACTIVITY_ACTION_KINDS = Object.freeze([",
  '"internal_learning_tick"',
  '"public_research_run"',
  '"public_directory_scan"',
  '"candidate_persist"',
  '"proposal_prepare"',
  '"report_generate"',
  '"document_prepare"',
  '"meeting_agenda_prepare"',
  '"ai_draft"',
  '"browser_research"',
  '"email_send"',
  '"social_post"',
  '"social_comment"',
  '"form_submit"',
  '"calendar_create"',
  '"provider_write"',
  "GROWTH_ACTIVITY_HARD_LIMITS",
  "manualResearchRunsPerDay: 6",
  "externalFetchesPerDay: 50",
  "workerRequestsPerDay: 5_000",
  "d1RowsReadPerDay: 500_000",
  "d1RowsWrittenPerDay: 10_000",
  "scheduledExternalResearchRunsPerDay: 0",
  "browserMinutesPerDay: 0",
  "aiCallsPerDay: 0",
  "paidServiceCallsPerDay: 0",
  "externalActionsPerDay: 0",
  "zeroPaidServiceBudget: true",
  "accountWideCloudUsageKnown: false",
  "persistentUsageAccountingRequired: true",
  "scheduled_external_research_forbidden",
  "usage_snapshot_stale",
  "research_cooldown_active",
  "domain_budget_exceeded",
  "failure_circuit_open",
  "resolveGrowthActivityProfile",
  "evaluateGrowthActivityBudget",
  "emptyGrowthActivityUsageSnapshot",
  "listGrowthActivityProfiles",
]);

requireOrder("Growth activity profile order", budget, [
  "paused: frozenLimits({",
  "light: frozenLimits({",
  "balanced: frozenLimits({",
  "high: frozenLimits({",
]);
requireOrder("Growth activity evaluation order", budget, [
  "const usageState = usageStatus(request.usage, now);",
  'if (profile.intensity === "paused")',
  "if (!spec.implemented)",
  'if (spec.channel === "public_research" && request.invocation !== "manual")',
  "reasons.push(...requirementReasons(spec, request));",
  "const projectedUsage",
  "dailyExceeded(projectedUsage, profile.limits)",
]);

forbidTokens("Pure Growth activity budget", budget, [
  "fetch(",
  "env.DB",
  "process.env",
  "waitUntil(",
  "setTimeout(",
  "AI.run(",
  "sendEmail(",
  "wrangler deploy",
  "ADMIN_TOKEN",
  "EVAVO_GROWTH_WORKER_ADMIN_TOKEN",
]);

requireTokens("Growth activity budget behavioral tests", tests, [
  'from "../src/core/growthActivityBudget"',
  'test("named profiles are frozen, ordered and stay inside the hard zero-cost envelope"',
  'test("a light confirmed manual public research action is admitted and projected conservatively"',
  'test("scheduled external research remains denied at every intensity"',
  'test("research cooldown and failure circuit stop wasteful retry loops"',
  'test("high mode does not enable AI, browser, paid services or external actions"',
  'test("custom mode permits tuning only inside immutable zero-cost limits"',
  'test("stale or malformed usage snapshots fail closed"',
  "GROWTH_ACTIVITY_TARGET_DOMAIN_INVALID",
  "GROWTH_ACTIVITY_REQUESTED_UNITS_INVALID",
]);
forbidTokens("Growth activity budget behavioral tests", tests, [
  "supabase.co",
  "neon.tech",
  "rds.amazonaws.com",
  "wrangler deploy",
  "ADMIN_TOKEN",
  "EVAVO_GROWTH_WORKER_ADMIN_TOKEN",
]);

requireTokens("Growth activity budget documentation", docs, [
  "# Growth Activity Budget",
  "growth_activity_budget_v1",
  "## Product objective",
  "## Current Cloudflare planning assumptions",
  "## Immutable zero-paid-service posture",
  "## Activity profiles",
  "### Paused",
  "### Light",
  "### Balanced",
  "### High",
  "### Custom",
  "## Waste controls",
  "## Future connector architecture",
  "## Communication and personality design",
  "persistentUsageAccountingRequired: true",
  "accountWideCloudUsageKnown: false",
  "High remains far below the published Worker and D1 daily allowances",
  "Credentials, OAuth consent and platform review are legitimate setup requirements and must not be bypassed.",
  "Keep unsolicited mass outreach, fake engagement and uncontrolled forum commenting out of scope.",
]);

requireTokens("Existing Growth capability posture", capabilities, [
  "scheduledExecutionEnabled: false",
  "scheduledExternalResearchEnabled: false",
  "draftingEnabled: false",
  "browserExecutionEnabled: false",
  "externalDeliveryEnabled: false",
  "autonomousCampaignsEnabled: false",
]);
requireTokens("Existing autonomy settings posture", autonomySettings, [
  'type AutonomyMode = "observe_only" | "free_safe_autonomy" | "assisted_discovery"',
  "freeSafeOnly: true",
  "aiDraftsEnabled: false",
  "sendingEnabled: false",
  "scheduledExecutionEnabled: false",
  "canFetchSources: false",
  "manualResearchRequiresAuthentication: true",
  "manualResearchRequiresConfirmation: true",
]);
requireTokens("Scheduled autonomy posture", scheduledEngine, [
  "settings.aiDraftsEnabled = false",
  "settings.sendingEnabled = false",
  "settings.leadDiscoveryEnabled = false",
  "Scheduled autonomy is permanently review-first.",
  "it never fetches sources or runs discovery",
]);
requireTokens("Cloudflare runtime posture", wrangler, [
  'compatibility_flags = ["global_fetch_strictly_public"]',
  "Historical schedules retained for internal-only maintenance.",
  "AI execution",
  "No email-provider secrets are used or accepted by the active Worker source.",
]);

if (errors.length) {
  console.error(`${CHECK_NAME} failed:\n`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Growth activity budget check passed.");
console.log("- paused, light, balanced, high and exact custom profiles remain inside one immutable zero-paid-service hard envelope");
console.log("- scheduled public research, AI, browser runtime, paid services and external state changes remain hard-disabled at every intensity");
console.log("- public research requires a fresh persistent usage snapshot, owner approval, exact confirmation, domain caps, cooldown and failure-circuit checks");
console.log("- behavioral fixtures cover named profiles, custom limits, exhaustion, stale usage and future email/social/calendar/provider actions");
console.log("- current capability, autonomy, scheduled and Cloudflare configuration files remain aligned with the review-first posture");
console.log("- this source contract does not claim persistent D1 budget enforcement until the usage ledger is implemented");
