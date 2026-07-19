#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const indexPath = path.join(root, "src", "index.ts");
const wranglerPath = path.join(root, "wrangler.toml");
const errors = [];

if (!fs.existsSync(indexPath)) errors.push("Missing Worker entry point: src/index.ts");
if (!fs.existsSync(wranglerPath)) errors.push("Missing Wrangler configuration: wrangler.toml");

const source = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "";
const wrangler = fs.existsSync(wranglerPath) ? fs.readFileSync(wranglerPath, "utf8") : "";

for (const token of [
  'const HEALTH_CONTRACT_VERSION = "2026-07"',
  'if (pathname === "/health") return await handleHealth(env)',
  'env.DB.prepare("SELECT 1 AS ok")',
  'service: "evavo-worker-agent"',
  'database: databaseReady ? "ok" : "unavailable"',
  'status: databaseReady ? 200 : 503',
  '"cache-control": "no-store"',
  '"x-evavo-worker-health-version": HEALTH_CONTRACT_VERSION',
]) {
  if (!source.includes(token)) errors.push(`Worker health implementation is missing: ${token}`);
}

for (const forbidden of [
  "ADMIN_TOKEN",
  "OUTBOUND_AGENT_ADMIN_TOKEN",
  "MAILCHANNELS_API_KEY",
  "FROM_EMAIL",
  "REPLY_TO_EMAIL",
  "SELECT *",
  "settings",
  "usage_counters",
]) {
  const healthStart = source.indexOf("async function handleHealth");
  const healthEnd = source.indexOf("function isOpportunityDiscoveryPath", healthStart);
  const healthSource = healthStart >= 0 && healthEnd > healthStart ? source.slice(healthStart, healthEnd) : "";
  if (healthSource.includes(forbidden)) errors.push(`Worker health endpoint must not reference sensitive or application data token: ${forbidden}`);
}

if (!/name\s*=\s*"evavo-outbound-agent"/.test(wrangler)) errors.push("Wrangler Worker name changed unexpectedly");
if (!/workers_dev\s*=\s*true/.test(wrangler)) errors.push("workers.dev availability must remain explicit for health verification");
if (!/binding\s*=\s*"DB"/.test(wrangler)) errors.push("D1 DB binding must remain configured");

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "worker-health-readonly-v2026-07",
  checks: {
    route: "/health",
    databaseProbe: "SELECT 1",
    cachePolicy: "no-store",
    exposesSecrets: false,
    mutatesData: false,
  },
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
