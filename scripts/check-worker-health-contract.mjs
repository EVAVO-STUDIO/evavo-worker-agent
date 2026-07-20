#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const indexPath = path.join(root, "src", "index.ts");
const policyPath = path.join(root, "src", "routes", "workerRoutePolicy.ts");
const wranglerPath = path.join(root, "wrangler.toml");
const errors = [];

for (const filePath of [indexPath, policyPath, wranglerPath]) {
  if (!fs.existsSync(filePath)) errors.push(`Missing Worker health dependency: ${path.relative(root, filePath)}`);
}

const source = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "";
const policy = fs.existsSync(policyPath) ? fs.readFileSync(policyPath, "utf8") : "";
const wrangler = fs.existsSync(wranglerPath) ? fs.readFileSync(wranglerPath, "utf8") : "";

for (const token of [
  'const HEALTH_CONTRACT_VERSION = "2026-07"',
  'const PUBLIC_SERVICE_NAME = "EVAVO Growth Research Worker"',
  'matchesWorkerRouteFamily("health", pathname)',
  'env.DB.prepare("SELECT 1 AS ok")',
  "service: PUBLIC_SERVICE_NAME",
  'database: databaseReady ? "ok" : "unavailable"',
  'status: databaseReady ? 200 : 503',
  '"cache-control": "no-store"',
  '"x-evavo-worker-health-version": HEALTH_CONTRACT_VERSION',
  'service: PUBLIC_SERVICE_NAME, health: "/health"',
]) {
  if (!source.includes(token)) errors.push(`Worker health implementation is missing: ${token}`);
}

for (const token of [
  'id: "health"',
  'exposure: "public"',
  'authentication: "none"',
  'mutationPosture: "read-only"',
  'matches: (pathname: string) => pathname === "/health"',
]) {
  if (!policy.includes(token)) errors.push(`Worker health route policy is missing: ${token}`);
}

const healthStart = source.indexOf("async function handleHealth");
const healthEnd = source.indexOf("async function runScheduledSafely", healthStart);
const healthSource = healthStart >= 0 && healthEnd > healthStart ? source.slice(healthStart, healthEnd) : "";
if (!healthSource) errors.push("Unable to isolate Worker health handler");

for (const forbidden of [
  "ADMIN_TOKEN",
  "OUTBOUND_AGENT_ADMIN_TOKEN",
  "MAILCHANNELS_API_KEY",
  "FROM_EMAIL",
  "REPLY_TO_EMAIL",
  "SELECT *",
  "settings",
  "usage_counters",
  ".run(",
  ".batch(",
]) {
  if (healthSource.includes(forbidden)) errors.push(`Worker health endpoint must not reference sensitive or mutable token: ${forbidden}`);
}

for (const misleading of [
  'service: "evavo-worker-agent"',
  'message: "evavo-worker-agent"',
]) {
  if (source.includes(misleading)) errors.push(`Public Worker identity must not use stale service wording: ${misleading}`);
}

if (!/name\s*=\s*"evavo-outbound-agent"/.test(wrangler)) errors.push("Wrangler deployment name changed unexpectedly");
if (!/workers_dev\s*=\s*true/.test(wrangler)) errors.push("workers.dev availability must remain explicit for health verification");
if (!/binding\s*=\s*"DB"/.test(wrangler)) errors.push("D1 DB binding must remain configured");

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "worker-health-readonly-v2026-07",
  checks: {
    route: "/health",
    service: "EVAVO Growth Research Worker",
    deploymentNamePreserved: true,
    routePolicy: "public-read-only",
    databaseProbe: "SELECT 1",
    cachePolicy: "no-store",
    exposesSecrets: false,
    mutatesData: false,
  },
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;