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
  "legacyDailyTick",
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
  "await runSourceExpansionIfAllowed(env, settings)",
  "await runOpportunityAutonomy(env, settings)",
  "legacyEngine off | AI drafts off | sending off",
]) {
  if (!engine.includes(required)) errors.push(`Scheduled autonomy is missing safety token: ${required}`);
}

if (!index.includes("ctx.waitUntil(dailyTickWithAutonomy(env))")) {
  errors.push("Worker scheduled entry point must continue to delegate through dailyTickWithAutonomy");
}
if (index.includes("dailyTick(env)")) {
  errors.push("Worker scheduled entry point must not call the legacy engine directly");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "scheduled-autonomy-review-first-safety",
  scheduledExternalResearchAllowed: true,
  scheduledDraftingAllowed: false,
  scheduledSendingAllowed: false,
  scheduledLegacyEngineAllowed: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
