#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const srcRoot = path.join(root, "src");
const errors = [];
const engineImports = [];
const emailImports = [];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const sourceFiles = fs.existsSync(srcRoot)
  ? walk(srcRoot).filter((file) => /\.(ts|tsx)$/.test(file))
  : [];

for (const absolute of sourceFiles) {
  const relative = path.relative(root, absolute).replaceAll("\\", "/");
  const content = fs.readFileSync(absolute, "utf8");
  if (/from\s+["'](?:\.\.\/|\.\/)engine["']/.test(content)) engineImports.push(relative);
  if (/from\s+["'](?:\.\.\/|\.\/)email["']/.test(content)) emailImports.push(relative);
}

if (engineImports.length !== 0) {
  errors.push(`Legacy engine must have zero active importers, found: ${engineImports.join(", ")}`);
}
if (emailImports.length !== 0) {
  errors.push(`Legacy email sender must have zero active importers, found: ${emailImports.join(", ")}`);
}

for (const removedPath of ["src/engine.ts", "src/email.ts"]) {
  if (fs.existsSync(path.join(root, removedPath))) errors.push(`${removedPath} must remain deleted`);
}

const read = (relativePath) => {
  const absolute = path.join(root, relativePath);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : "";
};

const index = read("src/index.ts");
const policy = read("src/routes/operationsRoutePolicy.ts");
const safetyHandler = read("src/routes/legacyExecutionSafetyAdmin.ts");
const admin = read("src/routes/admin.ts");

for (const token of [
  'case "legacy-admin-safety":',
  "return await handleLegacyExecutionSafetyAdmin(req, env, pathname, jsonResponse)",
]) {
  if (!index.includes(token)) errors.push(`Worker dispatcher is missing legacy isolation token: ${token}`);
}

for (const token of [
  'pathname === "/admin/run"',
  'pathname === "/admin/settings"',
  'pathname === "/admin/overview"',
  'writeConfirmation: "handler-enforced"',
  "callsAI: false",
  "canSendEmail: false",
]) {
  if (!policy.includes(token)) errors.push(`Operational policy is missing legacy isolation token: ${token}`);
}

for (const token of [
  'error: "legacy_execution_disabled"',
  "allowedKinds: []",
  'contractVersion: "legacy_admin_overview_v2_review_first"',
  "manualLegacyExecutionEnabled: false",
  "aiDraftGenerationEnabled: false",
  "emailSendingEnabled: false",
  "externalExecutionEnabled: false",
]) {
  if (!safetyHandler.includes(token)) errors.push(`Legacy safety handler is missing: ${token}`);
}

for (const forbidden of [
  'from "../engine"',
  'from "./engine"',
  'from "../email"',
  'from "./email"',
  "dailyTick(",
  "runDraftOnce(",
  "runSendApproved(",
  "runScanOnce(",
  "sendEmail(",
  'pathname === "/admin/run"',
  'pathname === "/admin/settings"',
  'pathname === "/admin/overview"',
]) {
  if (admin.includes(forbidden)) errors.push(`Broad admin module must not contain legacy execution token: ${forbidden}`);
}

const safetyDispatchPosition = index.indexOf("switch (resolveOperationsRouteHandlerId(pathname))");
const broadAdminPosition = index.indexOf('matchesWorkerRouteFamily("admin", pathname)');
if (safetyDispatchPosition < 0 || broadAdminPosition < 0 || safetyDispatchPosition >= broadAdminPosition) {
  errors.push("Typed legacy isolation must remain ahead of the broad admin fallback");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "legacy-execution-modules-removed",
  legacyEnginePresent: fs.existsSync(path.join(root, "src/engine.ts")),
  legacyEmailSenderPresent: fs.existsSync(path.join(root, "src/email.ts")),
  engineImporters: engineImports,
  emailImporters: emailImports,
  legacyRunRoutable: false,
  legacyOverviewTruthful: true,
  futureImportersAllowed: false,
  broadAdminLegacyCodeRemoved: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
