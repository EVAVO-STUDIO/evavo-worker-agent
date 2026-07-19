#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const read = (relativePath) => {
  const absolute = path.join(root, relativePath);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : "";
};

const index = read("src/index.ts");
const autonomy = read("src/engineAutonomy.ts");
const packageJson = JSON.parse(read("package.json") || "{}");

if (!index) errors.push("Missing src/index.ts");
if (!autonomy) errors.push("Missing src/engineAutonomy.ts");

for (const token of [
  "async function runScheduledSafely(env: Env): Promise<void>",
  "if (!env.DB)",
  'console.error("scheduled_autonomy_unavailable")',
  "await dailyTickWithAutonomy(env)",
  'console.error("scheduled_autonomy_failed")',
  'await logEvent(env, "scheduled_autonomy_failed"',
  "Do not retry, throw, or invoke an alternate execution path.",
  "ctx.waitUntil(runScheduledSafely(env))",
]) {
  if (!index.includes(token)) errors.push(`Scheduled entrypoint is missing fail-closed token: ${token}`);
}

for (const forbidden of [
  "ctx.waitUntil(dailyTickWithAutonomy(env))",
  "setTimeout(",
  "setInterval(",
  "dailyTick(",
  "runDraftOnce(",
  "runSendApproved(",
  "sendEmail(",
]) {
  if (index.includes(forbidden)) errors.push(`Scheduled entrypoint contains forbidden fallback or retry token: ${forbidden}`);
}

for (const token of [
  "settings.aiDraftsEnabled = false",
  "settings.sendingEnabled = false",
  "settings.leadDiscoveryEnabled = false",
  'setSetting(env, "engine_enabled", "0")',
  'setSetting(env, "drafting_enabled", "0")',
  'setSetting(env, "sending_enabled", "0")',
]) {
  if (!autonomy.includes(token)) errors.push(`Scheduled autonomy remains missing review-first token: ${token}`);
}

const expectedCommand = "node scripts/check-scheduled-entrypoint-safety.mjs";
if (packageJson.scripts?.["scheduled:entrypoint-safety:check"] !== expectedCommand) {
  errors.push(`package.json must expose scheduled:entrypoint-safety:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run scheduled:entrypoint-safety:check")) {
  errors.push("check:local must include scheduled:entrypoint-safety:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "scheduled-entrypoint-fail-closed",
  directUnhandledWaitUntilAllowed: false,
  alternateExecutionFallbackAllowed: false,
  automaticRetryAllowed: false,
  rawErrorDisclosureAllowed: false,
  missingDatabaseFailsClosed: true,
  bestEffortInternalFailureEventOnly: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
