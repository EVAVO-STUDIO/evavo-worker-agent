#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const read = (relativePath) => {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
};

const handler = read("src/routes/autonomySettingsAdmin.ts");
const engine = read("src/engineAutonomy.ts");
const packageJson = JSON.parse(read("package.json") || "{}");

for (const token of [
  'AUTONOMY_SETTINGS_CONTRACT = "autonomy_settings_v4_bounded_review_only"',
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
  "leadDiscoveryEnabled: false",
  "aiDraftsEnabled: false",
  "sendingEnabled: false",
]) {
  if (!handler.includes(token)) errors.push(`Autonomy capability response is missing truthful token: ${token}`);
}

for (const token of [
  'from "../core/boundedJsonRequest"',
  'from "../core/manualResearchLease"',
  "readBoundedJsonObject<AutonomySettingsBody>(request",
  "boundedJsonFailurePayload(parsed)",
  "isExplicitJsonConfirmation(parsed.value)",
  "requiredPayload: { confirm: true }",
  "confirmationCoercionAllowed: false",
  'AUTONOMY_SETTINGS_LEASE = "autonomy-settings"',
  "const lease = await acquireManualResearchLease",
  "manualResearchLeaseConflict(AUTONOMY_SETTINGS_LEASE)",
  "requestReceipt",
  "bodySha256",
  "await env.DB.batch([",
  "VALUES (?, 'autonomy_settings_update', ?, NULL, ?)",
  "settingsAndAuditAtomic: true",
  "concurrentSettingsWriteAllowed: false",
  "reviewOnly: true",
  "executable: false",
  "externalExecutionAllowed: false",
]) {
  if (!handler.includes(token)) errors.push(`Autonomy settings mutation boundary is missing: ${token}`);
}

const confirmPosition = handler.indexOf("if (!isExplicitJsonConfirmation(parsed.value))");
const leasePosition = handler.indexOf("const lease = await acquireManualResearchLease");
const settingsReadPosition = handler.indexOf("const previous = normalizeStoredSettings");
const batchPosition = handler.indexOf("await env.DB.batch([");
if (
  confirmPosition < 0 ||
  leasePosition < 0 ||
  settingsReadPosition < 0 ||
  batchPosition < 0 ||
  !(confirmPosition < leasePosition && leasePosition < settingsReadPosition && settingsReadPosition < batchPosition)
) {
  errors.push("Exact confirmation and lease acquisition must precede autonomy settings read and atomic mutation");
}

for (const forbidden of [
  "request.json()",
  "request.clone().json()",
  "function confirmed(",
  "body?.confirm === 1",
  'body?.confirm === "1"',
  "setSetting(",
  "logEvent(",
  "canRunScheduledEngine: settings.engineEnabled",
  "canFetchSources: settings.engineEnabled",
  "canSaveOpportunities: settings.opportunityDiscoveryEnabled",
  'from "./opportunityAutonomy"',
  'from "./core/sourceExpansionEngine"',
  "runOpportunityAutonomy(",
  "runSourceExpansion(",
]) {
  if (handler.includes(forbidden) || engine.includes(forbidden)) {
    errors.push(`Autonomy settings or scheduled engine contains stale capability: ${forbidden}`);
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
  contract: "autonomy-capability-truthfulness-v2-bounded-settings",
  scheduledExecutionEnabled: false,
  scheduledExternalResearchAllowed: false,
  manualResearchRequiresAuthentication: true,
  manualResearchRequiresConfirmation: true,
  manualResearchSavesReviewItemsOnly: true,
  settingsRequestBounded: true,
  exactBooleanConfirmationRequired: true,
  concurrentSettingsWriteAllowed: false,
  settingsAndAuditAtomic: true,
  aiAllowed: false,
  sendingAllowed: false,
  externalExecutionAllowed: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
