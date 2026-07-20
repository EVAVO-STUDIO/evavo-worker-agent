#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const healthPath = path.join(root, "src", "core", "health.ts");
const adminPath = path.join(root, "src", "routes", "admin.ts");
const packagePath = path.join(root, "package.json");
const errors = [];

const health = fs.existsSync(healthPath) ? fs.readFileSync(healthPath, "utf8") : "";
const admin = fs.existsSync(adminPath) ? fs.readFileSync(adminPath, "utf8") : "";
const packageJson = fs.existsSync(packagePath) ? JSON.parse(fs.readFileSync(packagePath, "utf8")) : {};

if (!health) errors.push("Missing admin health implementation");
if (!admin) errors.push("Missing broad admin implementation");

for (const token of [
  'contractVersion: "admin_health_v2_manual_research_only"',
  "scheduledExecutionEnabled: false",
  "scheduledExternalResearchEnabled: false",
  "manualResearchRequiresAuthentication: true",
  "manualResearchRequiresConfirmation: true",
  "manualResearchIsBounded: true",
  "manualResearchSavesReviewItemsOnly: true",
  "aiDraftingEnabled: false",
  "sendingEnabled: false",
  "externalExecutionEnabled: false",
  "historicalOnly: true",
  "executable: false",
  "historicalRecordsExecutable: false",
  'contractVersion: "admin_diagnostics_v2_historical_read_only"',
  'mode: opts.deep ? "deep_read_only" : "cheap_read_only"',
  "authoritativeForExecution: false",
  "callsNetwork: false",
  "externalStateChange: false",
]) {
  if (!health.includes(token)) errors.push(`Admin reporting is missing truthful token: ${token}`);
}

for (const token of [
  'pathname === "/admin/health"',
  "buildHealthReport(env)",
  'pathname === "/admin/diagnostics"',
  "buildDiagnosticsReport(env",
]) {
  if (!admin.includes(token)) errors.push(`Broad admin route is missing reporting token: ${token}`);
}

for (const forbidden of [
  'recs.push("continue_free_safe_tick")',
  'status: HealthReport["status"] = !engineEnabled ? "paused"',
  'scheduledResearchEnabled: true',
  'lastEngineRun:',
  'mode: opts.deep ? "deep" : "cheap"',
]) {
  if (health.includes(forbidden)) errors.push(`Admin reporting contains stale execution claim: ${forbidden}`);
}

const expectedCommand = "node scripts/check-admin-reporting-truthfulness.mjs";
if (packageJson.scripts?.["admin:reporting-truthfulness:check"] !== expectedCommand) {
  errors.push(`package.json must expose admin:reporting-truthfulness:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run admin:reporting-truthfulness:check")) {
  errors.push("check:local must include admin:reporting-truthfulness:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "admin-reporting-truthfulness",
  scheduledExecutionAdvertised: false,
  scheduledExternalResearchAdvertised: false,
  historicalRecordsExecutable: false,
  diagnosticsReadOnly: true,
  manualResearchRequiresAuthentication: true,
  manualResearchRequiresConfirmation: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
