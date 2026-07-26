import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CHECK_NAME = "check-growth-zero-cost-envelope";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

const envelope = read("src/core/growthZeroCostEnvelope.ts");
const budget = read("src/core/growthActivityBudget.ts");
const capabilities = read("src/core/growthCapabilities.ts");
const tests = read("tests/growthZeroCostEnvelope.test.ts");
const documentation = read("docs/growth-zero-cost-envelope.md");
const wrangler = read("wrangler.toml");

requireTokens("Growth zero-cost envelope", envelope, [
  'GROWTH_ZERO_COST_ENVELOPE_VERSION =\n  "growth_zero_cost_envelope_v1"',
  'GROWTH_ZERO_COST_LIMIT_SNAPSHOT = "2026-07-26"',
  'GROWTH_ZERO_COST_REVIEW_BY = "2026-10-01"',
  "workersRequestsPerDay: 100_000",
  "workersCpuMillisecondsPerInvocation: 10",
  "externalSubrequestsPerInvocation: 50",
  "cloudServiceSubrequestsPerInvocation: 1_000",
  "cronTriggersPerAccount: 5",
  "d1RowsReadPerDay: 5_000_000",
  "d1RowsWrittenPerDay: 100_000",
  "d1StorageBytesPerAccount: 5_000_000_000",
  "d1StorageBytesPerDatabase: 500_000_000",
  "queueOperationsPerDay: 10_000",
  "queueRetentionHours: 24",
  "kvReadsPerDay: 100_000",
  "kvWritesPerDay: 1_000",
  "workersAiNeuronsPerDay: 10_000",
  "browserMinutesPerDay: 10",
  "browserConcurrentSessions: 3",
  "workersRequestsPerDay: 10_000",
  "externalSubrequestsPerInvocation: 15",
  "d1RowsReadPerDay: 500_000",
  "d1RowsWrittenPerDay: 10_000",
  "queueOperationsPerDay: 1_000",
  "workersAiNeuronsPerDay: 0",
  "browserMinutesPerDay: 0",
  'requiredCloudflarePlan: "workers_free"',
  "zeroPaidServiceBudget: true",
  "paidOverageAllowed: false",
  "absoluteZeroCostGuaranteed: false",
  "accountWideUsageKnown: false",
  "accountPlanVerifiedAtRuntime: false",
  "reservationWithinFreeLimits",
  "profilesRemainNonExecuting",
  "freePlanQuotaExhaustionMustFailClosed: true",
  "https://developers.cloudflare.com/workers/platform/limits/",
  "https://developers.cloudflare.com/d1/platform/pricing/",
  "https://developers.cloudflare.com/queues/platform/pricing/",
  "https://developers.cloudflare.com/workers-ai/platform/pricing/",
  "https://developers.cloudflare.com/browser-run/limits/",
  "https://developers.cloudflare.com/kv/platform/limits/",
]);
forbidTokens("Growth zero-cost envelope", envelope, [
  "paidOverageAllowed: true",
  "absoluteZeroCostGuaranteed: true",
  "accountWideUsageKnown: true",
  "accountPlanVerifiedAtRuntime: true",
  "workersAiEnabled: true",
  "browserEnabled: true",
  "paidServicesEnabled: true",
  "externalExecutionEnabled: true",
  "automaticRetryEnabled: true",
]);

requireTokens("Growth activity hard limits", budget, [
  "workerRequestsPerDay: 5_000",
  "externalFetchesPerDay: 50",
  "externalFetchesPerRun: 15",
  "d1RowsReadPerDay: 500_000",
  "d1RowsWrittenPerDay: 10_000",
  "queueOperationsPerDay: 1_000",
  "browserMinutesPerDay: 0",
  "aiCallsPerDay: 0",
  "paidServiceCallsPerDay: 0",
  "externalActionsPerDay: 0",
  'description: "The largest reviewed zero-paid-service envelope. AI, browser and external actions remain disabled."',
]);
forbidTokens("Growth activity hard limits", budget, [
  "scheduledExternalResearchRunsPerDay: 1",
  "browserMinutesPerDay: 1",
  "aiCallsPerDay: 1",
  "paidServiceCallsPerDay: 1",
  "externalActionsPerDay: 1",
]);

requireTokens("Growth capability registry", capabilities, [
  'import { growthZeroCostEnvelope } from "./growthZeroCostEnvelope"',
  "const zeroCostEnvelope = growthZeroCostEnvelope()",
  "zeroCostEnvelope,",
  "accountWideCloudUsageKnown: zeroCostEnvelope.accountWideUsageKnown",
  "absoluteZeroCostGuaranteed: zeroCostEnvelope.absoluteZeroCostGuaranteed",
  "requiredCloudflarePlan: zeroCostEnvelope.requiredCloudflarePlan",
  "reservationWithinFreeLimits: zeroCostEnvelope.reservationWithinFreeLimits",
  "aiEnabled: false",
  "browserEnabled: false",
  "externalExecutionEnabled: false",
]);

requireTokens("Growth zero-cost tests", tests, [
  "zero-cost envelope records current Cloudflare free quotas and honest plan uncertainty",
  "Growth hard limits reserve only a conservative share of account free quotas",
  "free quota and reservation constants retain fail-closed values",
  "light, balanced and high remain activity levels rather than execution permissions",
  "AI and browser capacity remain disabled until account-wide metering can fail closed",
  "assert.equal(envelope.absoluteZeroCostGuaranteed, false)",
  "assert.equal(quotas.external_subrequests_per_invocation?.reservationPercent, 30)",
  "assert.equal(profile.externalActionsPerDay, 0, profile.intensity)",
]);

requireTokens("Growth zero-cost documentation", documentation, [
  "growth_zero_cost_envelope_v1",
  "This is a usage policy and fail-closed runtime contract. It is not a promise that the Cloudflare account can never be billed.",
  "requiredCloudflarePlan: workers_free",
  "absoluteZeroCostGuaranteed: false",
  "EVAVO reservation ceiling",
  "High means more bounded internal work and confirmed public research.",
  "Requirements before enabling free AI or browser capacity",
  "External communication and social channels",
  "node scripts/check-growth-zero-cost-envelope.mjs",
]);

requireTokens("Worker deployment posture", wrangler, [
  'compatibility_flags = ["global_fetch_strictly_public"]',
  'triggers = { crons = ["0 * * * *", "15 2 * * *"] }',
  "Scheduled handlers may synchronise defensive settings, learn from existing",
  "AI execution.",
  "No email-provider secrets are used or accepted by the active Worker source.",
]);
const cronLine = wrangler.match(/^triggers\s*=\s*\{\s*crons\s*=\s*\[([^\]]*)\]\s*\}/m)?.[1] ?? "";
const cronCount = [...cronLine.matchAll(/"[^"]+"/g)].length;
if (cronCount > 5) errors.push(`Worker config declares ${cronCount} Cron Triggers, above the reviewed free-plan limit.`);

if (errors.length) {
  console.error(`${CHECK_NAME} failed:\n`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Growth zero-cost envelope check passed.");
console.log("- current Cloudflare free-limit values are versioned with a review date and official source references");
console.log("- Growth hard limits reserve no more than 30% of a mapped free quota and normally no more than 10%");
console.log("- paused, light, balanced and high remain non-paying, non-AI, non-browser and non-executing activity profiles");
console.log("- the contract refuses to claim an absolute zero-cost guarantee while account plan and other account usage are unknown");
console.log("- AI, browser runtime and external channels require separate persistent metering and fail-closed approval contracts");
