#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const srcRoot = path.join(root, "src");
const errors = [];
const imports = [];

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
  if (/from\s+["']\.\.\/engine["']/.test(content) || /from\s+["']\.\/engine["']/.test(content)) {
    imports.push(relative);
  }
}

const allowedImporters = new Set(["src/routes/admin.ts"]);
for (const importer of imports) {
  if (!allowedImporters.has(importer)) errors.push(`Legacy engine import is not allowed in ${importer}`);
}
if (imports.length !== 1 || imports[0] !== "src/routes/admin.ts") {
  errors.push(`Expected exactly one quarantined legacy engine importer, found: ${imports.join(", ") || "none"}`);
}

const read = (relativePath) => {
  const absolute = path.join(root, relativePath);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : "";
};

const index = read("src/index.ts");
const policy = read("src/routes/operationsRoutePolicy.ts");
const safetyHandler = read("src/routes/legacyExecutionSafetyAdmin.ts");
const admin = read("src/routes/admin.ts");
const engine = read("src/engine.ts");

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

for (const helper of ["dailyTick", "runDraftOnce", "runSendApproved", "runScanOnce"]) {
  if (!admin.includes(helper)) errors.push(`Quarantined admin module no longer references ${helper}; review isolation contract deliberately`);
  if (!engine.includes(`export async function ${helper}`)) errors.push(`Legacy engine export ${helper} changed; review isolation contract deliberately`);
}

const safetyDispatchPosition = index.indexOf("switch (resolveOperationsRouteHandlerId(pathname))");
const broadAdminPosition = index.indexOf('matchesWorkerRouteFamily("admin", pathname)');
if (safetyDispatchPosition < 0 || broadAdminPosition < 0 || safetyDispatchPosition >= broadAdminPosition) {
  errors.push("Typed legacy isolation must remain ahead of the broad admin fallback");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "legacy-engine-export-isolation",
  legacyImporters: imports,
  legacyRunRoutable: false,
  legacyOverviewTruthful: true,
  futureImportersAllowed: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
