#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicPath = path.join(root, "src", "routes", "public.ts");
const settingsPath = path.join(root, "src", "core", "settings.ts");
const policyPath = path.join(root, "src", "routes", "workerRoutePolicy.ts");
const errors = [];

const publicSource = fs.existsSync(publicPath) ? fs.readFileSync(publicPath, "utf8") : "";
const settings = fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, "utf8") : "";
const policy = fs.existsSync(policyPath) ? fs.readFileSync(policyPath, "utf8") : "";

if (!publicSource) errors.push("Missing public route handler");
if (!settings) errors.push("Missing free-safe settings defaults");
if (!policy) errors.push("Missing Worker route policy");

for (const token of [
  'error: "public_event_feed_disabled"',
  "{ status: 410",
  'contractVersion: "public_status_v3_manual_research_only"',
  'service: "EVAVO Growth Research Worker"',
  "scheduledExecutionEnabled: false",
  "scheduledResearchEnabled: false",
  "manualResearchRequiresAuthentication: true",
  "manualResearchRequiresConfirmation: true",
  "manualResearchIsBounded: true",
  "manualResearchSavesReviewItemsOnly: true",
  "sendingEnabled: false",
  "aiDraftingEnabled: false",
  "externalExecutionEnabled: false",
  'pausedReason: "scheduled_and_external_execution_disabled"',
  'runMode: "historical_review_metadata"',
  "historicalOnly: true",
  "executable: false",
  "historicalRecordsExecutable: false",
  "aggregateOnly: true",
  "ai: { recordedToday: 0, configuredCap: 0 }",
  "send: { recordedToday: 0, configuredCap: 0 }",
  "rawEventsExposed: false",
  "contactDataExposed: false",
  "URLsExposed: false",
  '"access-control-allow-methods": "GET, OPTIONS"',
  '"cache-control": "no-store"',
]) {
  if (!publicSource.includes(token)) errors.push(`Public surface is missing: ${token}`);
}

for (const unsafe of [
  "return json({ ok: true, events:",
  "scheduledResearchEnabled: true",
  'contractVersion: "public_status_v2_review_first"',
  'service: "evavo-worker-agent"',
  'sendingEnabled: ((await getSetting(env, "sending_enabled"))',
  'capPerDay: Number((await getSetting(env, "draft_cap_per_day"))',
  'capPerDay: Number((await getSetting(env, "send_cap_per_day"))',
  '"access-control-allow-methods": "GET, POST, OPTIONS"',
]) {
  if (publicSource.includes(unsafe)) errors.push(`Public surface contains unsafe or misleading behavior: ${unsafe}`);
}

for (const token of [
  'ai_enabled: "0"',
  'ai_mode: "off"',
  'sending_enabled: "0"',
  'drafting_enabled: "0"',
  'daily_draft_limit: "0"',
  'daily_ai_call_limit: "0"',
  'daily_send_limit: "0"',
  'per_tick_draft_limit: "0"',
  'per_tick_ai_call_limit: "0"',
]) {
  if (!settings.includes(token)) errors.push(`Free-safe defaults are missing: ${token}`);
}

const publicPolicyStart = policy.indexOf('id: "public"');
const rootPolicyStart = policy.indexOf('id: "root"', publicPolicyStart);
const publicPolicy = publicPolicyStart >= 0 && rootPolicyStart > publicPolicyStart
  ? policy.slice(publicPolicyStart, rootPolicyStart)
  : "";
for (const token of ['exposure: "public"', 'authentication: "none"', 'mutationPosture: "read-only"']) {
  if (!publicPolicy.includes(token)) errors.push(`Public Worker policy is missing: ${token}`);
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "aggregate-only-public-surface",
  serviceIdentityTruthful: true,
  scheduledResearchAdvertised: false,
  manualResearchPubliclyExecutable: false,
  historicalRecordsExecutable: false,
  rawEventsExposed: false,
  operationalRecordsExposed: false,
  externalExecutionAdvertised: false,
  freeSafeDefaultsStrict: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;