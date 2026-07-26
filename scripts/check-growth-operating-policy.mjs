import fs from "node:fs";
import path from "node:path";

const CHECK_NAME = "check-growth-operating-policy";
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

const policy = read("src/core/growthOperatingPolicy.ts");
const contract = read("tests/growthOperatingPolicy.test.ts");
const documentation = read("docs/growth-operating-policy.md");

requireTokens("Growth operating policy", policy, [
  'GROWTH_OPERATING_POLICY_VERSION = "growth_operating_policy_v1"',
  '"paused"',
  '"light"',
  '"balanced"',
  '"active"',
  '"lab"',
  '"observe"',
  '"draft"',
  '"approval"',
  '"trusted"',
  'GROWTH_COST_MODES = Object.freeze(["free_only"]',
  '"research.source_discovery"',
  '"communication.send_email"',
  '"calendar.create_meeting"',
  '"social.publish_post"',
  '"social.publish_comment"',
  '"advertising.spend"',
  "requireCurrentUsageTelemetry: true",
  "allowTrustedExternalActions: boolean",
  "GROWTH_ACTIVITY_BUDGETS",
  "maxRunsPerDay",
  "maxWorkerInvocationsPerDay",
  "maxExternalFetchesPerDay",
  "maxD1RowsReadPerDay",
  "maxD1RowsWrittenPerDay",
  "maxCandidatesPerDay",
  "maxDraftsPerDay",
  "maxExternalActionsPerDay",
  "effectiveGrowthActivityLevel",
  "evaluateGrowthOperatingAction",
  '"usage_telemetry_required"',
  '"free_only_paid_capability_blocked"',
  '"meeting_requires_explicit_approval"',
  '"advertising_spend_blocked"',
  '"target_allowlist_required"',
  '"platform_policy_confirmation_required"',
  '"allowed_trusted_scope"',
]);

forbidTokens("Growth operating policy", policy, [
  "fetch(",
  "env.DB",
  "process.env",
  "ADMIN_TOKEN",
  "EVAVO_GROWTH_WORKER_ADMIN_TOKEN",
  "wrangler",
  "scheduled(",
  "queue(",
  "sendEmail",
  "postTo",
  "createMeeting",
  "canonicalPromotion",
  "externalExecutionEnabled: true",
  "bridgeEnabled: true",
  "deliveryEnabled: true",
]);

requireTokens("Growth operating policy contract", contract, [
  "Growth operating policy contract passed.",
  "default-free-only",
  "internal-allowed",
  "draft-allowed",
  "draft-send-approval",
  "approved-send",
  "meeting-always-approval",
  "trusted-send",
  "paid-model-denied",
  "ad-spend-denied",
  "missing-telemetry-denied",
  "budget-denied",
  "active-degrades-to-balanced",
  "balanced-degrades-to-light",
  "stale-pauses",
  "lab-scheduled-denied",
  "unknown-field",
  "paid-cost-mode",
]);

forbidTokens("Growth operating policy contract", contract, [
  "https://",
  "http://",
  "fetch(",
  "ADMIN_TOKEN",
  "process.env",
  "setTimeout(",
  "externalExecutionRequested: true",
]);

requireTokens("Growth operating policy documentation", documentation, [
  "Growth Operating Policy",
  "Activity is not authority",
  "Free-only cost governor",
  "Autonomous internal work",
  "Approval-gated external work",
  "Meetings always require explicit owner approval",
  "Advertising spend is blocked",
  "No telemetry, no scheduled run",
  "Cloudflare account usage is shared capacity",
  "This contract is not a billing guarantee",
  "Growth manager",
  "business development manager",
  "sales manager",
  "account manager",
  "business analyst",
  "marketing manager",
]);

forbidTokens("Growth operating policy documentation", documentation, [
  "fully autonomous public posting is enabled",
  "unlimited crawling",
  "guaranteed zero cost",
  "bypass platform policy",
  "reuse ADMIN_TOKEN",
]);

if (errors.length) {
  console.error(`${CHECK_NAME} failed:\n`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Growth operating policy check passed.");
console.log("- activity, authority and cost posture are independent finite controls");
console.log("- internal research, scoring and reporting may automate within conservative budgets");
console.log("- missing telemetry, paid capabilities, advertising spend and exhausted budgets fail closed");
console.log("- email, meetings, provider writes and public publishing remain approval or trusted-scope gated");
console.log("- the policy is pure and cannot itself fetch, schedule, persist, send, publish, promote or execute externally");
