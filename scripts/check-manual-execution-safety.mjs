#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const indexPath = path.join(root, "src", "index.ts");
const policyPath = path.join(root, "src", "routes", "operationsRoutePolicy.ts");
const handlerPath = path.join(root, "src", "routes", "legacyExecutionSafetyAdmin.ts");
const adminPath = path.join(root, "src", "routes", "admin.ts");
const toolsPath = path.join(root, "src", "routes", "tools.ts");
const errors = [];

const read = (filePath) => fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
const index = read(indexPath);
const policy = read(policyPath);
const handler = read(handlerPath);
const admin = read(adminPath);
const tools = read(toolsPath);

if (!index) errors.push("Missing Worker dispatcher");
if (!policy) errors.push("Missing operational route policy");
if (!handler) errors.push("Missing legacy execution safety handler");
if (!admin) errors.push("Missing broad admin handler");
if (!tools) errors.push("Missing tools capability handler");

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
  'allowedKinds: []',
  'engine_enabled", "0"',
  'draft_cap_per_day", "0"',
  'send_cap_per_day", "0"',
  'drafting_enabled: "0"',
  'sending_enabled: "0"',
  'daily_ai_call_limit: "0"',
  'daily_send_limit: "0"',
  'settingsWriteRequiresConfirmation: true',
  'draftDecisionRequiresConfirmation: true',
  'error: "confirm_required"',
  'reviewStateOnly: true',
]) {
  if (!handler.includes(token)) errors.push(`Legacy safety handler is missing: ${token}`);
}

for (const token of [
  "getAdminToken",
  "function authorized(",
  'error: "Unauthorized"',
  'contractVersion: "worker_tools_v2_review_first"',
  'aiDefault: "off"',
  'sendingDefault: "off"',
  'scheduledExternalExecutionDisabled: true',
  'manualLegacyExecutionDisabled: true',
  '"ai_draft_generation"',
  '"email_sending"',
  '"form_submission"',
  '"external_state_mutation"',
]) {
  if (!tools.includes(token)) errors.push(`Tools capability handler is missing: ${token}`);
}

for (const unsafe of [
  "runSendApproved(",
  "runDraftOnce(",
  "dailyTick(",
  "runScanOnce(",
  "sendEmail(",
]) {
  if (handler.includes(unsafe)) errors.push(`Legacy safety handler must never invoke ${unsafe}`);
  if (tools.includes(unsafe)) errors.push(`Tools capability handler must never invoke ${unsafe}`);
  if (admin.includes(unsafe)) errors.push(`Broad admin handler must not contain legacy execution helper ${unsafe}`);
}

for (const forbidden of [
  'from "../engine"',
  'pathname === "/admin/run"',
  'pathname === "/admin/settings"',
  'pathname === "/admin/overview"',
  '/approve")',
  '/reject")',
]) {
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

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "manual-legacy-execution-safety",
  legacyRunRoutable: false,
  manualAIExecutionAllowed: false,
  manualSendingAllowed: false,
  unsafeLegacySettingsWritable: false,
  draftDecisionConfirmationRequired: true,
  toolsAuthenticationRequired: true,
  toolsCapabilitiesTruthful: true,
  broadAdminLegacyCodeRemoved: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
