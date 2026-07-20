#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const enginePath = path.join(root, "src", "engineAutonomy.ts");
const indexPath = path.join(root, "src", "index.ts");
const errors = [];

const engine = fs.existsSync(enginePath) ? fs.readFileSync(enginePath, "utf8") : "";
const index = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "";

if (!engine) errors.push("Missing scheduled autonomy engine");
if (!index) errors.push("Missing Worker entry point");

for (const forbidden of [
  'from "./engine"',
  'from "./opportunityAutonomy"',
  'from "./core/sourceExpansionEngine"',
  "legacyDailyTick",
  "runSourceExpansion(",
  "runSourceExpansionIfAllowed(",
  "runOpportunityAutonomy(",
  "runSend(",
  "sendEmail(",
  'setSetting(env, "sending_enabled", "1")',
  'setSetting(env, "drafting_enabled", "1")',
  'setSetting(env, "send_cap_per_day", "5")',
  'setSetting(env, "draft_cap_per_day", "10")',
]) {
  if (engine.includes(forbidden)) errors.push(`Scheduled autonomy must not contain: ${forbidden}`);
}

for (const required of [
  'settings.aiDraftsEnabled = false',
  'settings.sendingEnabled = false',
  'settings.leadDiscoveryEnabled = false',
  'setSetting(env, "engine_enabled", "0")',
  'setSetting(env, "draft_cap_per_day", "0")',
  'setSetting(env, "send_cap_per_day", "0")',
  'setSetting(env, "drafting_enabled", "0")',
  'setSetting(env, "sending_enabled", "0")',
  "await learnExpansionQualityIfPossible(env)",
  "scheduled external research off",
  "source expansion off",
  "opportunity discovery off",
  "legacy engine off | AI drafts off | sending off",
]) {
  if (!engine.includes(required)) errors.push(`Scheduled autonomy is missing safety token: ${required}`);
}

for (const required of [
  "async function runScheduledSafely(env: Env): Promise<void>",
  "await dailyTickWithAutonomy(env)",
  "ctx.waitUntil(runScheduledSafely(env))",
]) {
  if (!index.includes(required)) errors.push(`Worker scheduled entry point is missing: ${required}`);
}
if (index.includes("ctx.waitUntil(dailyTickWithAutonomy(env))")) {
  errors.push("Worker scheduled entry point must use the fail-closed wrapper instead of direct waitUntil delegation");
}
if (index.includes("dailyTick(env)")) {
  errors.push("Worker scheduled entry point must not call the legacy engine directly");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "scheduled-autonomy-review-first-safety",
  scheduledExternalResearchAllowed: false,
  scheduledInternalLearningAllowed: true,
  scheduledDraftingAllowed: false,
  scheduledSendingAllowed: false,
  scheduledLegacyEngineAllowed: false,
  failClosedEntrypointRequired: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
