#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

const safety = read("src/core/businessAutopilotSafety.ts");
const packageJson = JSON.parse(read("package.json") || "{}");

for (const token of [
  "BusinessAutopilotHistoricalExecutionLevel",
  "BUSINESS_AUTOPILOT_HISTORICAL_EXECUTION_LEVELS",
  "BUSINESS_AUTOPILOT_EXECUTION_POSTURE",
  "business_autopilot_execution_posture_v2_internal_only",
  "level_0_internal_review_metadata_only",
  "historicalLevelsAuthoritative: false",
  "draftingEnabled: false",
  "approvalToExecutionEnabled: false",
  "scheduledExternalResearchEnabled: false",
  "autonomousCampaignsEnabled: false",
  "externalExecutionEnabled: false",
  "generate_deliverable_draft",
  "approve_for_delivery",
]) {
  if (!safety.includes(token)) errors.push(`Business safety registry is missing: ${token}`);
}

const activeArrayMatch = safety.match(/BUSINESS_AUTOPILOT_EXECUTION_LEVELS:[^=]*=\s*\[([\s\S]*?)\];/);
if (!activeArrayMatch) {
  errors.push("Could not locate authoritative Business execution-level array");
} else {
  const activeArray = activeArrayMatch[1];
  if (!activeArray.includes("level_0_internal_review_metadata_only")) {
    errors.push("Authoritative Business execution levels must contain the internal-review-only level");
  }
  for (const forbidden of [
    "level_1_draft_only",
    "level_2_approval_required_execution",
    "level_3_rules_approved_internal_actions",
    "level_4_capped_campaign_mode",
    "level_5_broad_external_autonomy_blocked",
  ]) {
    if (activeArray.includes(forbidden)) errors.push(`Historical execution level leaked into active array: ${forbidden}`);
  }
}

const historicalArrayMatch = safety.match(/BUSINESS_AUTOPILOT_HISTORICAL_EXECUTION_LEVELS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\s+as const/);
if (!historicalArrayMatch) {
  errors.push("Could not locate frozen historical Business execution-level list");
}

const expectedCommand = "node scripts/check-business-execution-level-truthfulness.mjs";
const scripts = packageJson.scripts || {};
if (scripts["business:execution-level-truthfulness:check"] !== expectedCommand) {
  errors.push(`package.json must expose business:execution-level-truthfulness:check as ${expectedCommand}`);
}
if (!String(scripts["check:local"] || "").includes("npm run business:execution-level-truthfulness:check")) {
  errors.push("check:local must include business:execution-level-truthfulness:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "business-execution-level-truthfulness-v2",
  activeLevel: "level_0_internal_review_metadata_only",
  historicalLevelsAuthoritative: false,
  draftingEnabled: false,
  approvalToExecutionEnabled: false,
  autonomousCampaignsEnabled: false,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
