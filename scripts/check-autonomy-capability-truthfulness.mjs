#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const CURRENT_CONTRACT = "autonomy-capability-truthfulness-v3-fail-closed-legacy-flags";
// Structured migration evidence keeps historical aggregate gates able to prove
// which reviewed contract was superseded without making the old contract active.
const SUPERSEDED_CONTRACT = Object.freeze({
  contract: "autonomy-capability-truthfulness-v2-bounded-settings",
  status: "superseded",
  supersededBy: CURRENT_CONTRACT,
});
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
  "canRunScheduledEngine: settings.engineEnabled",
  "canFetchSources: settings.engineEnabled",
  "canSaveOpportunities: settings.opportunityDiscoveryEnabled",
  'from "./opportunityAutonomy"',
  'from "./core/sourceExpansionEngine"',
  "runOpportunityAutonomy(",
  "runSourceExpansion(",
  "runDraftOnce(",
  "runSendApproved(",
  "fetch(",
]) {
  if (handler.includes(forbidden) || engine.includes(forbidden)) {
    errors.push(`Autonomy settings or scheduled engine contains stale execution capability: ${forbidden}`);
  }
}

for (const token of [
  'freeSafeOnly: true',
  'leadDiscoveryEnabled: false',
  'aiDraftsEnabled: false',
  'sendingEnabled: false',
  'await setSetting(env, "engine_enabled", "0")',
  'await setSetting(env, "crawl_cap_per_day", "0")',
  'await setSetting(env, "draft_cap_per_day", "0")',
  'await setSetting(env, "send_cap_per_day", "0")',
  'await setSetting(env, "drafting_enabled", "0")',
  'await setSetting(env, "sending_enabled", "0")',
  '"source_expansion_learning_tick_ok"',
  '"source_expansion_learning_tick_skip"',
  '"tick_skip"',
  '"tick_ok"',
  "existing D1 review metadata",
  "it never fetches sources or runs discovery",
]) {
  if (!engine.includes(token)) errors.push(`Scheduled autonomy fail-closed posture is missing: ${token}`);
}

const settingCalls = [...engine.matchAll(/setSetting\(env,\s*"([^"]+)",\s*([^\n;]+)\)/gu)]
  .map((match) => ({ key: match[1], value: match[2].trim() }));
const expectedSettings = new Map([
  ["engine_enabled", '"0"'],
  ["crawl_cap_per_day", '"0"'],
  ["draft_cap_per_day", '"0"'],
  ["send_cap_per_day", '"0"'],
  ["drafting_enabled", '"0"'],
  ["sending_enabled", '"0"'],
]);
if (settingCalls.length !== expectedSettings.size) {
  errors.push(`Scheduled autonomy must contain exactly ${expectedSettings.size} reviewed legacy-setting writes; found ${settingCalls.length}`);
}
for (const { key, value } of settingCalls) {
  if (!expectedSettings.has(key)) {
    errors.push(`Scheduled autonomy writes unreviewed legacy setting: ${key}`);
    continue;
  }
  if (value !== expectedSettings.get(key)) errors.push(`Scheduled autonomy must force ${key}=0; observed ${value}`);
}
for (const key of expectedSettings.keys()) {
  if (!settingCalls.some((entry) => entry.key === key)) errors.push(`Scheduled autonomy is missing fail-closed legacy setting write: ${key}`);
}

const allowedAuditEvents = new Set([
  "source_expansion_learning_tick_ok",
  "source_expansion_learning_tick_skip",
  "tick_skip",
  "tick_ok",
]);
const auditEvents = [...engine.matchAll(/logEvent\(\s*env,\s*"([^"]+)"/gu)].map((match) => match[1]);
for (const event of auditEvents) {
  if (!allowedAuditEvents.has(event)) errors.push(`Scheduled autonomy emits unreviewed audit event: ${event}`);
}
for (const event of allowedAuditEvents) {
  if (!auditEvents.includes(event)) errors.push(`Scheduled autonomy is missing reviewed audit event: ${event}`);
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
  contract: CURRENT_CONTRACT,
  supersededContract: SUPERSEDED_CONTRACT,
  scheduledExecutionEnabled: false,
  scheduledExternalResearchAllowed: false,
  manualResearchRequiresAuthentication: true,
  manualResearchRequiresConfirmation: true,
  manualResearchSavesReviewItemsOnly: true,
  settingsRequestBounded: true,
  exactBooleanConfirmationRequired: true,
  concurrentSettingsWriteAllowed: false,
  settingsAndAuditAtomic: true,
  legacyExternalWorkCapsForcedToZero: true,
  scheduledAuditEventsAllowlisted: true,
  aiAllowed: false,
  sendingAllowed: false,
  externalExecutionAllowed: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
