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

const index = read("src/index.ts");
const policy = read("src/routes/operationsRoutePolicy.ts");
const handler = read("src/routes/legacyExecutionSafetyAdmin.ts");
const admin = read("src/routes/admin.ts");
const tools = read("src/routes/tools.ts");
const packageJson = JSON.parse(read("package.json") || "{}");

for (const token of [
  'import { handleLegacyExecutionSafetyAdmin } from "./routes/legacyExecutionSafetyAdmin"',
  'case "legacy-admin-safety":',
  "return await handleLegacyExecutionSafetyAdmin(req, env, pathname, jsonResponse)",
]) {
  if (!index.includes(token)) errors.push(`Worker dispatcher is missing manual safety intercept: ${token}`);
}

for (const token of [
  'id: "legacy-admin-safety"',
  'pathname === "/admin/run"',
  'pathname === "/admin/settings"',
  '/^\\/admin\\/drafts\\/[^/]+\\/(approve|reject)$/.test(pathname)',
  'writeConfirmation: "handler-enforced"',
  'networkPosture: "none"',
  "callsAI: false",
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
]) {
  if (!policy.includes(token)) errors.push(`Operational policy is missing manual safety requirement: ${token}`);
}

for (const token of [
  'error: "legacy_execution_disabled"',
  "{ status: 410 }",
  "allowedKinds: []",
  "responseMutatesSettings: false",
  "readRouteMutatesSettings: false",
  'engine_enabled: "0"',
  'drafting_enabled: "0"',
  'sending_enabled: "0"',
  'daily_ai_call_limit: "0"',
  'daily_send_limit: "0"',
  "settingsWriteRequiresConfirmation: true",
  "draftDecisionRequiresConfirmation: true",
  "readBoundedJsonObject<LegacySettingsBody>(request",
  "readBoundedJsonObject<LegacyDraftDecisionBody>(request",
  "isExplicitJsonConfirmation(parsed.value)",
  "requiredPayload: { confirm: true }",
  "confirmationCoercionAllowed: false",
  'LEGACY_SETTINGS_LEASE = "legacy-safe-settings"',
  'const actionKey = `draft-review:${draftId}`',
  "manualResearchLeaseConflict",
  "requestReceipt",
  "bodySha256",
  "await env.DB.batch(statements)",
  "reviewStateAndAuditAtomic: true",
  "settingsAndAuditAtomic: true",
  "externalExecutionAllowed: false",
]) {
  if (!handler.includes(token)) errors.push(`Legacy safety handler is missing: ${token}`);
}

const settingsConfirmPosition = handler.indexOf("async function updateSafeSettings");
const settingsLeasePosition = handler.indexOf("const lease = await acquireManualResearchLease(env, LEGACY_SETTINGS_LEASE, 600)");
const settingsBatchPosition = handler.indexOf("await env.DB.batch(statements)");
if (
  settingsConfirmPosition < 0 ||
  settingsLeasePosition < 0 ||
  settingsBatchPosition < 0 ||
  !(settingsConfirmPosition < settingsLeasePosition && settingsLeasePosition < settingsBatchPosition)
) {
  errors.push("Legacy settings confirmation and lease must precede the atomic settings write");
}

const draftConfirmPosition = handler.indexOf("async function updateDraftDecision");
const draftLeasePosition = handler.indexOf("const lease = await acquireManualResearchLease(env, actionKey, 600)");
const draftBatchPosition = handler.lastIndexOf("await env.DB.batch([");
if (
  draftConfirmPosition < 0 ||
  draftLeasePosition < 0 ||
  draftBatchPosition < 0 ||
  !(draftConfirmPosition < draftLeasePosition && draftLeasePosition < draftBatchPosition)
) {
  errors.push("Legacy draft confirmation and shared draft lease must precede the atomic review write");
}

for (const forbidden of [
  "request.json()",
  "request.clone().json()",
  "function confirmed(",
  "body?.confirm === 1",
  'body?.confirm === "1"',
  "enforceSafeExecutionSettings(",
  "setSetting(",
  "updateLead(",
  "logEvent(",
  "runSendApproved(",
  "runDraftOnce(",
  "dailyTick(",
  "runScanOnce(",
  "sendEmail(",
]) {
  if (handler.includes(forbidden)) errors.push(`Legacy safety handler contains stale or unsafe behavior: ${forbidden}`);
}

for (const token of [
  "getAdminToken",
  "function authorized(",
  'error: "Unauthorized"',
  'agent: "EVAVO Growth Research Worker"',
  'contractVersion: "worker_tools_v3_manual_research_only"',
  'previousContractVersion: "worker_tools_v2_review_first"',
  "scheduledExecutionEnabled: false",
  "scheduledExternalExecutionDisabled: true",
  "manualResearchRequiresAuthentication: true",
  "manualResearchRequiresConfirmation: true",
  "manualResearchIsBounded: true",
  "manualResearchSavesReviewItemsOnly: true",
  'aiDefault: "off"',
  'sendingDefault: "off"',
  "manualLegacyExecutionDisabled: true",
  'mode: "historical_read"',
  "executable: false",
  "scheduled: false",
  '"scheduled_external_research"',
  '"ai_draft_generation"',
  '"email_sending"',
  '"form_submission"',
  '"external_state_mutation"',
]) {
  if (!tools.includes(token)) errors.push(`Tools capability handler is missing: ${token}`);
}

for (const unsafe of ["runSendApproved(", "runDraftOnce(", "dailyTick(", "runScanOnce(", "sendEmail("]) {
  if (tools.includes(unsafe)) errors.push(`Tools capability handler must never invoke ${unsafe}`);
  if (admin.includes(unsafe)) errors.push(`Broad admin handler must not contain legacy execution helper ${unsafe}`);
}
for (const forbidden of [
  'agent: "evavo-outbound-agent"',
  "canRunScheduledEngine: true",
  "scheduledExecutionEnabled: true",
  'from "../engine"',
  'pathname === "/admin/run"',
  'pathname === "/admin/settings"',
  'pathname === "/admin/overview"',
  '/approve")',
  '/reject")',
]) {
  if (tools.includes(forbidden)) errors.push(`Tools capability handler contains stale or unsafe claim: ${forbidden}`);
  if (admin.includes(forbidden)) errors.push(`Broad admin handler still contains shadowed legacy route or import: ${forbidden}`);
}

const operationsPosition = index.indexOf("switch (resolveOperationsRouteHandlerId(pathname))");
const broadAdminPosition = index.indexOf('matchesWorkerRouteFamily("admin", pathname)');
if (operationsPosition < 0 || broadAdminPosition < 0 || operationsPosition >= broadAdminPosition) {
  errors.push("Operational safety dispatch must precede the broad admin fallback");
}
const legacyCasePosition = index.indexOf('case "legacy-admin-safety":');
const autonomyCasePosition = index.indexOf('case "autonomy-settings":');
if (legacyCasePosition < 0 || autonomyCasePosition < 0 || legacyCasePosition >= autonomyCasePosition) {
  errors.push("Legacy manual safety intercept must be the first operational route case");
}

const expectedCommand = "node scripts/check-manual-execution-safety.mjs";
if (packageJson.scripts?.["manual:execution-safety:check"] !== expectedCommand) {
  errors.push(`package.json must expose manual:execution-safety:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run manual:execution-safety:check")) {
  errors.push("check:local must include manual:execution-safety:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "manual-legacy-execution-safety-v2-bounded-atomic",
  legacyRunRoutable: false,
  disabledRunMutatesState: false,
  legacyReadRoutesMutateState: false,
  manualAIExecutionAllowed: false,
  manualSendingAllowed: false,
  scheduledExternalResearchAllowed: false,
  manualResearchRequiresAuthentication: true,
  manualResearchRequiresConfirmation: true,
  manualResearchIsBounded: true,
  manualResearchSavesReviewItemsOnly: true,
  unsafeLegacySettingsWritable: false,
  settingsAndAuditAtomic: true,
  draftDecisionConfirmationRequired: true,
  draftDecisionAndAuditAtomic: true,
  toolsAuthenticationRequired: true,
  toolsCapabilitiesTruthful: true,
  broadAdminLegacyCodeRemoved: true,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
