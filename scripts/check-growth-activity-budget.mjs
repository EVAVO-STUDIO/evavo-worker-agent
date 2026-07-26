#!/usr/bin/env node

import { spawnSync } from "node:child_process";
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
const budgetSettings = read("src/core/growthActivityBudgetSettings.ts");
const budgetSettingsTests = read("tests/growthActivityBudgetSettings.test.ts");
const sourceSelection = read("src/core/opportunitySourceSelection.ts");
const sourceSelectionTests = read("tests/opportunitySourceSelection.test.ts");
const opportunityAutonomy = read("src/opportunityAutonomy.ts");
const docs = read("docs/growth-activity-budget.md");
const capabilities = read("src/core/growthCapabilities.ts");
const ledgerGuard = read("scripts/check-growth-activity-budget-ledger.mjs");
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

requireTokens("Growth activity setting resolution", budgetSettings, [
  'GROWTH_ACTIVITY_SETTINGS_VERSION =\n  "growth_activity_settings_v1"',
  "Run frequency and per-run source capacity are separate units.",
  "const effectiveSourceLimitPerRun = Math.min(",
  "legacyDailyLimit,",
  "legacyRunLimit,",
  "profile.limits.externalFetchesPerRun,",
  "manualResearchConfigured:",
  "scheduledExternalResearchEnabled: false",
  "externalExecutionEnabled: false",
]);
requireTokens("Growth activity setting regression tests", budgetSettingsTests, [
  'test("run frequency never masquerades as per-run source capacity"',
  "assert.equal(resolved.effectiveSourceLimitPerRun, 3)",
  "assert.equal(balanced.effectiveSourceLimitPerRun, 8)",
  "assert.equal(high.profile.limits.externalFetchesPerRun, 15)",
  "assert.equal(high.effectiveSourceLimitPerRun, 15)",
  'test("legacy caps may reduce but never increase named profile capacity"',
]);

requireTokens("Adaptive opportunity source selection", sourceSelection, [
  'OPPORTUNITY_SOURCE_SELECTION_VERSION =\n  "opportunity_source_selection_v1"',
  "opportunitySourceExplorationSlots",
  "selectOpportunitySources",
  "reliability",
  "opportunityYield",
  "failurePressure",
  "staleness",
  "Math.log1p(source.opportunityCount)",
  'mode: "explore" | "exploit"',
  "OPPORTUNITY_SOURCE_SELECTION_DUPLICATE_SOURCE",
  "MAX_CANDIDATES = 200",
  "MAX_SELECTION = 50",
]);
forbidTokens("Pure opportunity source selector", sourceSelection, [
  "fetch(",
  "env.DB",
  "process.env",
  "AI.run(",
  "waitUntil(",
  "setTimeout(",
  "ADMIN_TOKEN",
]);
requireTokens("Adaptive opportunity source selection tests", sourceSelectionTests, [
  'test("activity intensity reserves only a small bounded exploration allowance"',
  'test("selection favours useful evidence over a static high priority failure loop"',
  'test("one novel source is explored without displacing the entire useful set"',
  'test("stale sources receive a bounded revisit boost and ties remain deterministic"',
  "OPPORTUNITY_SOURCE_SELECTION_DUPLICATE_SOURCE",
  "OPPORTUNITY_SOURCE_SELECTION_SOURCE_INVALID",
]);

requireTokens("Opportunity research runtime source selection", opportunityAutonomy, [
  'from "./core/opportunitySourceSelection"',
  "OPPORTUNITY_SOURCE_SELECTION_VERSION",
  "opportunitySourceExplorationSlots",
  "selectOpportunitySources",
  "const poolLimit = Math.min(60, Math.max(limit, limit * 4))",
  "source.success_count AS successCount",
  "source.failure_count AS failureCount",
  "source.last_run_at_iso AS lastRunAtIso",
  "AS opportunityCount",
  "const sourceSelection = await dueSources(env, limit, activitySettings.intensity)",
  "for (const selectedSource of sourceSelection.selected)",
  "sourceSelection: {",
  "mode: selectedSource.mode",
  "score: selectedSource.score",
  "metrics: selectedSource.metrics",
  "source-pool ${sourceSelection.considered}",
  "explored ${sourceSelection.explorationSelected}",
  "const nextHours = ok",
  "? 24",
  ": 72",
  ": 48",
  "cooldown_until_iso = ?",
  "persistentAdmissionRequired: true",
  "automaticRetryAllowed: false",
]);
forbidTokens("Opportunity research runtime source selection", opportunityAutonomy, [
  "ORDER BY priority DESC, COALESCE(last_run_at_iso, '') ASC\n     LIMIT ?",
  "const nextHours = ok ? 24 : 6",
  "scheduledExternalResearchEnabled: true",
  "externalExecutionAllowed: true",
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

requireTokens("Growth capability activity budget exposure", capabilities, [
  'from "./growthActivityBudget"',
  'from "./growthActivityBudgetLedger"',
  'from "./opportunitySourceSelection"',
  "GROWTH_ACTIVITY_BUDGET_VERSION",
  "GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION",
  "OPPORTUNITY_SOURCE_SELECTION_VERSION",
  "GROWTH_ACTIVITY_HARD_LIMITS",
  "listGrowthActivityProfiles",
  "activityBudget: {",
  'defaultIntensity: "light"',
  "profiles: listGrowthActivityProfiles()",
  "hardLimits: GROWTH_ACTIVITY_HARD_LIMITS",
  "sourceSelectionContractVersion: OPPORTUNITY_SOURCE_SELECTION_VERSION",
  "zeroPaidServiceBudget: true",
  "persistentUsageLedgerContractImplemented: true",
  "persistentUsageLedgerMigrationApplied: false",
  "manualResearchAdmissionIntegrated: true",
  "adaptiveSourceSelectionIntegrated: true",
  "adaptiveSourceSelectionEnabled: true",
  "accountWideCloudUsageKnown: false",
  "scheduledExternalResearchEnabled: false",
  "aiEnabled: false",
  "browserEnabled: false",
  "externalExecutionEnabled: false",
  "scheduledExecutionEnabled: false",
  "manualResearchRequiresAuthentication: true",
  "manualResearchRequiresConfirmation: true",
  "draftingEnabled: false",
  "browserExecutionEnabled: false",
  "externalDeliveryEnabled: false",
  "autonomousCampaignsEnabled: false",
  'id: "research_public_website"',
  'allowedInFreeSafeMode: true, currentImplementation: "available"',
  "Every source fetch requires persistent Growth activity-budget admission.",
]);
forbidTokens("Growth capability activity budget exposure", capabilities, [
  "persistentUsageLedgerMigrationApplied: true",
  "manualResearchAdmissionIntegrated: false",
  "adaptiveSourceSelectionIntegrated: false",
  "scheduledExternalResearchEnabled: true",
  "aiEnabled: true",
  "browserEnabled: true",
  "externalExecutionEnabled: true",
]);
requireTokens("Growth budget ledger source guard", ledgerGuard, [
  "Growth activity budget ledger check passed.",
  "one trigger-protected D1 insert is the final concurrency authority",
  "migration inventory and capability posture remain truthful",
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

const ledgerResult = spawnSync(
  process.execPath,
  ["scripts/check-growth-activity-budget-ledger.mjs"],
  { cwd: root, encoding: "utf8", shell: false, stdio: "inherit" },
);
if (ledgerResult.status !== 0) process.exit(ledgerResult.status ?? 1);

console.log("Growth activity budget check passed.");
console.log("- paused, light, balanced, high and exact custom profiles remain inside one immutable zero-paid-service hard envelope");
console.log("- per-day run frequency and per-run source capacity remain separate units so named profiles are useful without exceeding their fetch caps");
console.log("- confirmed manual research uses the persistent budget ledger plus adaptive evidence-yield selection and a bounded exploration allowance");
console.log("- failing sources back off for 48 hours and successful zero-yield sources wait 72 hours instead of consuming budget more frequently");
console.log("- scheduled public research, AI, browser runtime, paid services and external state changes remain hard-disabled at every intensity");
console.log("- public research requires a fresh persistent usage snapshot, owner approval, exact confirmation, domain caps, cooldown and failure-circuit checks");
console.log("- the protected capability registry exposes integrated manual admission and source selection without claiming migration application or scheduled research");
console.log("- current capability, autonomy, scheduled and Cloudflare configuration files remain aligned with the review-first posture");
