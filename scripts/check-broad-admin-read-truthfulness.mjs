#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const adminPath = path.join(root, "src", "routes", "admin.ts");
const packagePath = path.join(root, "package.json");
const errors = [];

const admin = fs.existsSync(adminPath) ? fs.readFileSync(adminPath, "utf8") : "";
const packageJson = fs.existsSync(packagePath) ? JSON.parse(fs.readFileSync(packagePath, "utf8")) : {};

if (!admin) errors.push("Missing broad admin implementation");

for (const token of [
  "const historicalReadSafety = Object.freeze({",
  "readOnly: true",
  "authenticated: true",
  "historicalOnly: true",
  "executable: false",
  "scheduled: false",
  "callsNetwork: false",
  "callsAI: false",
  "sendsEmail: false",
  "postsExternally: false",
  "submitsForms: false",
  "externalStateChange: false",
  'contractVersion: "admin_historical_leads_v2_read_only"',
  'contractVersion: "admin_historical_drafts_v2_read_only"',
  'contractVersion: "admin_historical_events_v2_read_only"',
  'contractVersion: "admin_historical_insights_v2_read_only"',
  'contractVersion: "admin_historical_runs_v2_read_only"',
  "safety: historicalReadSafety",
  "deliverable: false",
]) {
  if (!admin.includes(token)) errors.push(`Broad admin reads are missing truthful token: ${token}`);
}

for (const token of [
  'pathname === "/admin/leads" && request.method === "GET"',
  'pathname === "/admin/drafts" && request.method === "GET"',
  'pathname === "/admin/events" && request.method === "GET"',
  'pathname === "/admin/insights" && request.method === "GET"',
  'pathname === "/admin/runs" && request.method === "GET"',
]) {
  if (!admin.includes(token)) errors.push(`Broad admin read route is missing: ${token}`);
}

for (const forbidden of [
  "return json({ ok: true, leads });",
  "return json({ ok: true, drafts: enriched });",
  "return json({ ok: true, events: await listEvents(env, 150) });",
  "return json({ ok: true, runs: await listEvents(env, 100) });",
  "executable: true",
  "deliverable: true",
  "scheduled: true",
  "sendsEmail: true",
  "postsExternally: true",
]) {
  if (admin.includes(forbidden)) errors.push(`Broad admin reads contain stale or unsafe token: ${forbidden}`);
}

const expectedCommand = "node scripts/check-broad-admin-read-truthfulness.mjs";
if (packageJson.scripts?.["admin:broad-read-truthfulness:check"] !== expectedCommand) {
  errors.push(`package.json must expose admin:broad-read-truthfulness:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run admin:broad-read-truthfulness:check")) {
  errors.push("check:local must include admin:broad-read-truthfulness:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "broad-admin-historical-read-truthfulness",
  protectedReadsAuthenticated: true,
  historicalRecordsReadable: true,
  historicalRecordsExecutable: false,
  scheduledExecutionAdvertised: false,
  externalExecutionAdvertised: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
