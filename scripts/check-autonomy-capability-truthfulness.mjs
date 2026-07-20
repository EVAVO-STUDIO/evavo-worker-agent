#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const handlerPath = path.join(root, "src", "routes", "autonomySettingsAdmin.ts");
const enginePath = path.join(root, "src", "engineAutonomy.ts");
const packagePath = path.join(root, "package.json");
const errors = [];

const handler = fs.existsSync(handlerPath) ? fs.readFileSync(handlerPath, "utf8") : "";
const engine = fs.existsSync(enginePath) ? fs.readFileSync(enginePath, "utf8") : "";
const packageJson = fs.existsSync(packagePath) ? JSON.parse(fs.readFileSync(packagePath, "utf8")) : {};

if (!handler) errors.push("Missing autonomy settings handler");
if (!engine) errors.push("Missing scheduled autonomy engine");

for (const token of [
  'contractVersion: "autonomy_settings_v3_manual_research_only"',
  "scheduledExecutionEnabled: false",
  "canRunScheduledEngine: false",
  "canFetchSources: false",
  "canExpandSourceCandidates: false",
  "canSaveExpansionCandidatesAutomatically: false",
  "canSaveOpportunities: false",
  "canSaveLeads: false",
  "canGenerateDrafts: false",
  "canSendEmail: false",
  "manualResearchRequiresAuthentication: true",
  "manualResearchRequiresConfirmation: true",
  "manualResearchSavesReviewItemsOnly: true",
  "manualOpportunityDiscoveryAvailable:",
  "manualSourceExpansionAvailable:",
  "scheduledExternalExecutionDisabled: true",
]) {
  if (!handler.includes(token)) errors.push(`Autonomy capability response is missing truthful token: ${token}`);
}

for (const forbidden of [
  "canRunScheduledEngine: settings.engineEnabled",
  "canFetchSources: settings.engineEnabled",
  "canSaveOpportunities: settings.opportunityDiscoveryEnabled",
  'from "./opportunityAutonomy"',
  'from "./core/sourceExpansionEngine"',
  "runOpportunityAutonomy(",
  "runSourceExpansion(",
]) {
  if (handler.includes(forbidden) || engine.includes(forbidden)) {
    errors.push(`Scheduled capability must not be advertised or executed through: ${forbidden}`);
  }
}

const expectedCommand = "node scripts/check-autonomy-capability-truthfulness.mjs";
if (packageJson.scripts?.["autonomy:capability-truthfulness:check"] !== expectedCommand) {
  errors.push(`package.json must expose autonomy:capability-truthfulness:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run autonomy:capability-truthfulness:check")) {
  errors.push("check:local must include autonomy:capability-truthfulness:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "autonomy-capability-truthfulness",
  scheduledExecutionEnabled: false,
  scheduledExternalResearchAllowed: false,
  manualResearchRequiresAuthentication: true,
  manualResearchRequiresConfirmation: true,
  manualResearchSavesReviewItemsOnly: true,
  aiAllowed: false,
  sendingAllowed: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
